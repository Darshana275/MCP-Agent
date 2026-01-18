import yaml from "js-yaml";
import { Octokit } from "octokit";

type FindingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Finding = {
  severity: FindingSeverity;
  ruleId: string;
  workflow: string;
  message: string;
  evidence?: any;
  recommendation: string;
};

function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
  // supports: https://github.com/owner/repo or owner/repo
  const cleaned = repoUrl.replace("https://github.com/", "").replace(/\/+$/, "");
  const parts = cleaned.split("/");

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repoUrl: ${repoUrl}`);
  }

  return { owner: parts[0], repo: parts[1] };
}

function isUnpinnedAction(uses: string): boolean {
  if (uses.startsWith("./")) return false; // local action

  const at = uses.lastIndexOf("@");
  if (at === -1) return true;

  const ref = uses.slice(at + 1).trim();
  if (!ref) return true;

  const badRefs = new Set(["main", "master", "head", "latest", "dev", "develop", "trunk"]);
  if (badRefs.has(ref.toLowerCase())) return true;

  if (/^[a-f0-9]{40}$/i.test(ref)) return false; // commit SHA pinned
  if (/^v?\d+(\.\d+){0,2}$/i.test(ref)) return false; // tag like v3 or 1.2.3

  return true; // branch-like
}

function collectUses(node: any, out: string[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const n of node) collectUses(n, out);
    return;
  }
  if (typeof node === "object") {
    if (typeof node.uses === "string") out.push(node.uses);
    for (const k of Object.keys(node)) collectUses((node as any)[k], out);
  }
}

function normalizePermissions(perms: any): { raw: any; writeAll: boolean; riskyKeys: string[] } {
  const riskyKeys: string[] = [];
  if (!perms) return { raw: perms, writeAll: false, riskyKeys };

  if (typeof perms === "string") {
    return { raw: perms, writeAll: perms.toLowerCase() === "write-all", riskyKeys };
  }

  if (typeof perms === "object") {
    for (const [k, v] of Object.entries(perms)) {
      const val = String(v).toLowerCase();
      if (val === "write") riskyKeys.push(k);
    }
  }
  return { raw: perms, writeAll: false, riskyKeys };
}

function analyzeWorkflow(workflowPath: string, doc: any): Finding[] {
  const findings: Finding[] = [];

  const onBlock = doc?.on ?? doc?.["on"];
  const onKeys =
    typeof onBlock === "string"
      ? [onBlock]
      : Array.isArray(onBlock)
      ? onBlock
      : typeof onBlock === "object" && onBlock
      ? Object.keys(onBlock)
      : [];

  if (onKeys.map((k) => String(k).toLowerCase()).includes("pull_request_target")) {
    findings.push({
      severity: "HIGH",
      ruleId: "ACTIONS_PULL_REQUEST_TARGET",
      workflow: workflowPath,
      message:
        "Workflow uses pull_request_target, which can expose secrets to untrusted code if misused.",
      evidence: { on: onBlock },
      recommendation:
        "Prefer pull_request for forks. If pull_request_target is necessary, avoid checking out untrusted code and restrict permissions/secrets.",
    });
  }

  const perms = normalizePermissions(doc?.permissions);
  if (perms.writeAll) {
    findings.push({
      severity: "CRITICAL",
      ruleId: "ACTIONS_PERMISSIONS_WRITE_ALL",
      workflow: workflowPath,
      message: "Workflow sets permissions: write-all.",
      evidence: { permissions: perms.raw },
      recommendation:
        "Use least privilege, e.g. permissions: { contents: read }. Grant write only for specific scopes when required.",
    });
  } else if (perms.riskyKeys.length > 0) {
    findings.push({
      severity: "HIGH",
      ruleId: "ACTIONS_PERMISSIONS_WRITE_SCOPES",
      workflow: workflowPath,
      message: `Workflow grants write permissions to: ${perms.riskyKeys.join(", ")}.`,
      evidence: { permissions: perms.raw },
      recommendation:
        "Reduce to least privilege. For most CI: contents: read is enough. Add write scopes only for release/publish jobs.",
    });
  }

  const uses: string[] = [];
  collectUses(doc?.jobs, uses);

  const unpinned = uses.filter(isUnpinnedAction);
  if (unpinned.length > 0) {
    findings.push({
      severity: "MEDIUM",
      ruleId: "ACTIONS_UNPINNED_ACTIONS",
      workflow: workflowPath,
      message: `Workflow uses unpinned or branch-referenced actions (${unpinned.length}).`,
      evidence: { unpinned },
      recommendation:
        "Pin third-party actions to a commit SHA (best) or at least a stable version tag (e.g. v3). Avoid @main/@master.",
    });
  }

  const jobs = doc?.jobs;
  if (jobs && typeof jobs === "object") {
    for (const [jobId, job] of Object.entries<any>(jobs)) {
      const runsOn = job?.["runs-on"];
      const runsOnArr = Array.isArray(runsOn) ? runsOn : runsOn ? [runsOn] : [];
      const hasSelfHosted = runsOnArr.some((x: any) =>
        String(x).toLowerCase().includes("self-hosted")
      );
      if (hasSelfHosted) {
        findings.push({
          severity: "MEDIUM",
          ruleId: "ACTIONS_SELF_HOSTED_RUNNER",
          workflow: workflowPath,
          message: `Job "${jobId}" runs on self-hosted runner.`,
          evidence: { jobId, "runs-on": runsOn },
          recommendation:
            "Ensure self-hosted runners are isolated and not used for untrusted PRs. Prefer ephemeral runners; harden network/credentials.",
        });
      }
    }
  }

  return findings;
}

async function listWorkflowFiles(octokit: Octokit, owner: string, repo: string, ref: string) {
  try {
    const res = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: ".github/workflows",
      ref,
    });

    const data: any = res.data;
    if (!Array.isArray(data)) return [];

    return data
      .filter((x: any) => x.type === "file")
      .filter((x: any) => typeof x.name === "string" && (x.name.endsWith(".yml") || x.name.endsWith(".yaml")))
      .map((x: any) => ({ path: x.path as string }));
  } catch {
    return [];
  }
}

async function fetchFileText(octokit: Octokit, owner: string, repo: string, path: string, ref: string) {
  const res = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path,
    ref,
  });

  const data: any = res.data;
  if (Array.isArray(data)) throw new Error(`Expected file but got directory: ${path}`);
  if (!data.content) throw new Error(`No content for file: ${path}`);

  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function actionsSecurityScan(input: { repoUrl: string; ref?: string }) {
  const { owner, repo } = parseRepoUrl(input.repoUrl);
  const ref = input.ref || "main";

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN in environment");

  const octokit = new Octokit({ auth: token });

  const workflowFiles = await listWorkflowFiles(octokit, owner, repo, ref);

  const findings: Finding[] = [];
  for (const wf of workflowFiles) {
    try {
      const text = await fetchFileText(octokit, owner, repo, wf.path, ref);
      const doc = yaml.load(text);
      findings.push(...analyzeWorkflow(wf.path, doc));
    } catch (err: any) {
      findings.push({
        severity: "LOW",
        ruleId: "ACTIONS_WORKFLOW_PARSE_ERROR",
        workflow: wf.path,
        message: `Could not parse/analyze workflow: ${err.message}`,
        recommendation: "Ensure workflow YAML is valid and accessible via the API.",
      });
    }
  }

  const rank: Record<FindingSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  findings.sort((a, b) => rank[b.severity] - rank[a.severity]);

  return { workflowsScanned: workflowFiles.length, findings };
}
