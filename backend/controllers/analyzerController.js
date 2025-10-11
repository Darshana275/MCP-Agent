// backend/controllers/analyzerController.js
const axios = require("axios");
const { getLLMExplanation } = require("../utils/llmExplain");

// In-memory cache for scan results (to use when fetching explanations)
const scanCache = new Map();

exports.analyzePackage = async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl)
      return res.status(400).json({ error: 'Expected "repoUrl" in request body.' });

    // Step 1️⃣ – GitHub scan
    const scan = await axios.post("http://localhost:8000/tool/github_scan", { repoUrl });
    const { deps, findings } = scan.data.output;

    // Step 2️⃣ – Risk scoring
    const score = await axios.post("http://localhost:8000/tool/risk_score", { deps });
    const { scores, overall } = score.data.output;

    // Step 3️⃣ – Governance actions
    const rec = await axios.post("http://localhost:8000/tool/recommend_actions", {
      overall,
      findings,
    });
    const { actions } = rec.data.output;

    // Store analysis data for LLM use
    scanCache.set(repoUrl, { scores, overall });

    // Return main response immediately
    res.json({
      success: true,
      repoUrl,
      dependencies: deps,
      riskAnalysis: scores,
      overallRisk: overall,
      recommendedActions: actions,
      llmExplanation: null, // placeholder (AI loads async)
    });

    // Background LLM generation (async)
    getLLMExplanation(repoUrl, scores, overall).then((text) => {
      scanCache.set(repoUrl, { ...scanCache.get(repoUrl), shortAI: text });
      console.log(`🧠 Cached LLM summary for ${repoUrl}`);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// 🔁 Endpoint to fetch or refresh AI explanation
exports.getAIExplanation = async (req, res) => {
  try {
    const { repoUrl, detail } = req.query;
    if (!repoUrl) return res.status(400).json({ error: "Missing repoUrl" });

    const analysis = scanCache.get(repoUrl);
    if (!analysis) return res.status(404).json({ error: "No previous scan found" });

    const text = await getLLMExplanation(repoUrl, analysis.scores, analysis.overall, detail || "short");
    res.json({ explanation: text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
// expose cached scans for streaming
exports.getCachedScan = () => scanCache;
