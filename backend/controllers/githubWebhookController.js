// backend/controllers/githubWebhookController.js
const crypto = require("crypto");
const axios = require("axios");
const {
  EVENTS_FILE,
  ANALYSES_FILE,
  appendLine,
  loadLastN,
} = require("../utils/webhookStore");

// -------------------------------
// In-memory + persisted stores
// -------------------------------
const MAX_EVENTS = 50;
const MAX_ANALYSES_LOAD = 200;

const events = loadLastN(EVENTS_FILE, MAX_EVENTS); // ✅ load persisted events
const latestByRepo = new Map();

// keep small analysis history per repo (for trends later)
const historyByRepo = new Map();
const MAX_HISTORY_PER_REPO = 20;

// hydrate latestByRepo + history from persisted analyses
const pastAnalyses = loadLastN(ANALYSES_FILE, MAX_ANALYSES_LOAD);
for (const a of pastAnalyses) {
  if (a?.repoUrl) {
    latestByRepo.set(a.repoUrl, a);
    const arr = historyByRepo.get(a.repoUrl) || [];
    arr.push(a);
    historyByRepo.set(a.repoUrl, arr.slice(-MAX_HISTORY_PER_REPO));
  }
}

function pushEvent(e) {
  events.unshift(e);
  if (events.length > MAX_EVENTS) events.pop();
  appendLine(EVENTS_FILE, e); // ✅ persist
}

function verifySignature(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing WEBHOOK_SECRET in .env");

  const sig = req.headers["x-hub-signature-256"];
  if (!sig) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(req.body).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function normalize(eventName, payload) {
  const repoUrl = payload?.repository?.html_url;
  const sender = payload?.sender?.login || null;

  if (eventName === "ping") {
    return { type: "ping", repoUrl, sender };
  }

  if (!repoUrl) {
    return { type: "unknown", repoUrl: null, sender, eventName };
  }

  if (eventName === "push") {
    const ref = payload.ref || "";
    return {
      type: "push",
      repoUrl,
      sender,
      branch: ref.replace("refs/heads/", ""),
    };
  }

  if (eventName === "pull_request") {
    const pr = payload.pull_request;
    return {
      type: "pull_request",
      repoUrl,
      sender,
      action: payload.action,
      prNumber: pr?.number,
      prTitle: pr?.title,
      base: pr?.base?.ref,
      head: pr?.head?.ref,
    };
  }

  if (eventName === "workflow_run") {
    const run = payload.workflow_run;
    return {
      type: "workflow_run",
      repoUrl,
      sender,
      action: payload.action,
      name: run?.name,
      status: run?.status,
      conclusion: run?.conclusion,
      branch: run?.head_branch,
    };
  }

  return { type: eventName, repoUrl, sender };
}

async function runPipeline(repoUrl) {
  const scan = await axios.post("http://localhost:8000/tool/github_scan", { repoUrl });
  const { deps, findings } = scan.data.output;

  const score = await axios.post("http://localhost:8000/tool/risk_score", { deps });
  const { scores, overall } = score.data.output;

  const rec = await axios.post("http://localhost:8000/tool/recommend_actions", {
    overall,
    findings,
  });
  const { actions } = rec.data.output;

  // ✅ CI/CD workflow security scan (always include)
  let cicdFindings = { workflowsScanned: 0, findings: [] };
  try {
    const wf = await axios.post("http://localhost:8000/tool/actions_security_scan", {
      repoUrl,
    });
    cicdFindings = wf.data.output;
  } catch (e) {
    cicdFindings = {
      workflowsScanned: 0,
      findings: [
        {
          severity: "LOW",
          ruleId: "ACTIONS_SCAN_UNAVAILABLE",
          workflow: "(system)",
          message: "CI/CD workflow security scan unavailable.",
          recommendation:
            "Check mcp-server tool /tool/actions_security_scan is running.",
        },
      ],
    };
  }

  return {
    success: true,
    repoUrl,
    dependencies: deps,
    riskAnalysis: scores,
    overallRisk: overall,
    recommendedActions: actions,
    cicdFindings,
    llmExplanation: null,
    updatedAt: new Date().toISOString(),
    mode: "webhook",
  };
}

// -----------------------------------
// POST /api/webhooks/github
// -----------------------------------
exports.githubWebhook = async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).send("Invalid signature");
    }

    const eventName = req.headers["x-github-event"];
    const delivery = req.headers["x-github-delivery"];
    const payload = JSON.parse(req.body.toString("utf8"));

    const evt = normalize(eventName, payload);
    pushEvent({ delivery, receivedAt: Date.now(), ...evt });

    // ACK immediately
    res.status(200).json({ ok: true });

    // Run async
    if (evt.repoUrl && evt.type !== "ping") {
      runPipeline(evt.repoUrl)
        .then((analysis) => {
          latestByRepo.set(evt.repoUrl, analysis);

          // keep small in-memory history per repo
          const arr = historyByRepo.get(evt.repoUrl) || [];
          arr.push(analysis);
          historyByRepo.set(evt.repoUrl, arr.slice(-MAX_HISTORY_PER_REPO));

          appendLine(ANALYSES_FILE, analysis); // ✅ persist analysis
          console.log(`✅ Webhook scan updated for ${evt.repoUrl}`);
        })
        .catch((err) => console.error("❗ Webhook pipeline failed:", err.message));
    }
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
};

// -----------------------------------
// GET /api/webhooks/events
// -----------------------------------
exports.getEvents = (req, res) => {
  res.json({ events });
};

// -----------------------------------
// GET /api/webhooks/latest?repoUrl=...
// -----------------------------------
exports.getLatest = (req, res) => {
  const repoUrl = req.query.repoUrl;

  if (repoUrl) {
    const analysis = latestByRepo.get(repoUrl);
    if (!analysis) return res.status(404).json({ error: "No analysis yet for this repo" });
    return res.json({ analysis });
  }

  // return latest available
  for (const e of events) {
    if (e.repoUrl && latestByRepo.has(e.repoUrl)) {
      return res.json({ analysis: latestByRepo.get(e.repoUrl) });
    }
  }

  return res.status(404).json({ error: "No webhook analyses yet" });
};

// -----------------------------------
// GET /api/webhooks/history?repoUrl=...&limit=20
// -----------------------------------
exports.getHistory = (req, res) => {
  const repoUrl = req.query.repoUrl;
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));

  if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

  const arr = historyByRepo.get(repoUrl) || [];
  return res.json({ history: arr.slice(-limit) });
};

// POST /api/webhooks/reanalyze
// body: { repoUrl: "https://github.com/owner/repo" }
exports.reanalyze = async (req, res) => {
  try {
    const { repoUrl } = req.body || {};
    if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

    // respond immediately (don’t block UI)
    res.json({ ok: true, repoUrl });

    // run async pipeline (same as webhook)
    runPipeline(repoUrl)
      .then((analysis) => {
        latestByRepo.set(repoUrl, analysis);

        // history (if you have it)
        if (typeof historyByRepo !== "undefined") {
          const arr = historyByRepo.get(repoUrl) || [];
          arr.push(analysis);
          historyByRepo.set(repoUrl, arr.slice(-20));
        }

        // persistence (if enabled)
        try {
          appendLine(ANALYSES_FILE, analysis);
        } catch {}

        console.log(`🔁 Manual re-analysis updated for ${repoUrl}`);
      })
      .catch((err) => console.error("❗ Reanalyze failed:", err.message));
  } catch (err) {
    console.error("Reanalyze error:", err);
    return res.status(500).json({ error: err.message });
  }
};
