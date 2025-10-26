/// <reference types="node" />
import "dotenv/config";
import express from "express";
import { z } from "zod";
import { Octokit } from "octokit";
import pLimit from "p-limit";
import { queryOSV, inferEcosystem } from "./utils/osvLookup.js";
const app = express();
// increase payload cap; large repos may send big JSON
app.use(express.json({ limit: "10mb" }));
// --- Initialize GitHub client ---
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
// ---------------------------------------------
// Tool 1: github_scan
// ---------------------------------------------
app.post("/tool/github_scan", async (req, res) => {
    try {
        const schema = z.object({
            repoUrl: z.string().url(),
            branch: z.string().optional(),
        });
        const parsed = schema.parse(req.body);
        const repoUrl = parsed.repoUrl;
        const branch = parsed.branch ?? "main";
        const pathParts = new URL(repoUrl).pathname.replace(/^\/+/, "").split("/");
        const owner = pathParts[0] || "";
        const repo = pathParts[1] || "";
        if (!owner || !repo) {
            return res.status(400).json({ error: "Invalid GitHub repo URL format." });
        }
        const { data: tree } = await octokit.request("GET /repos/{owner}/{repo}/git/trees/{tree_sha}", { owner, repo, tree_sha: branch, recursive: "1" });
        const files = (tree.tree || [])
            .filter((x) => x.type === "blob")
            .map((x) => x.path);
        const interesting = [
            "package.json",
            "requirements.txt",
            "pyproject.toml",
            "Pipfile",
            "poetry.lock",
            "pom.xml",
            "build.gradle",
        ];
        const depFiles = files.filter((f) => interesting.some((n) => f.toLowerCase().endsWith(n)));
        const fetchFile = async (path) => {
            const resp = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                owner,
                repo,
                path,
                ref: branch,
            });
            const content = Buffer.from(resp.data.content, "base64").toString("utf8");
            return { path, content };
        };
        const depContents = await Promise.all(depFiles.map(fetchFile));
        const secretHits = files.filter((p) => /(\.env|id_rsa|\.pem|secret|key)/i.test(p));
        const anomalyHits = files.filter((p) => /(^|\/)(\.(github|gitlab)\/workflows\/.*\.yml$)/i.test(p));
        res.json({
            output: {
                files,
                deps: depContents,
                findings: { secrets: secretHits, anomalies: anomalyHits },
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// ---------------------------------------------
// Tool 2: risk_score  (with caching + concurrency + de-dup)
// ---------------------------------------------
app.post("/tool/risk_score", async (req, res) => {
    try {
        const schema = z.object({
            deps: z.array(z.object({ path: z.string(), content: z.string() })),
        });
        const { deps } = schema.parse(req.body);
        const npmPkgs = [];
        const pipPkgs = [];
        // Extract package names from dependency files
        for (const f of deps) {
            if (f.path.endsWith("package.json")) {
                const j = JSON.parse(f.content);
                npmPkgs.push(...Object.keys(j.dependencies || {}), ...Object.keys(j.devDependencies || {}));
            }
            else if (f.path.endsWith("requirements.txt")) {
                const lines = f.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                pipPkgs.push(...lines
                    .map((l) => {
                    const safe = l || "";
                    return safe.replace(/[# ].*$/, "").split(/[=<>~!]/)[0] || "";
                })
                    .filter(Boolean));
            }
            // TODO: parse pyproject.toml/Pipfile/poetry.lock/pom.xml/gradle if needed
        }
        // --- de-duplicate & sort (stable output)
        const uniqNpm = Array.from(new Set(npmPkgs)).sort();
        const uniqPip = Array.from(new Set(pipPkgs)).sort();
        // --- prepare concurrency limiter (avoid OSV rate-limits)
        const limit = pLimit(5); // run up to 5 OSV requests at once
        // --- base heuristic function
        const heuristicScore = (pkg) => {
            const name = pkg.toLowerCase();
            const highRiskPatterns = [
                "eval",
                "exec",
                "unsafe",
                "shell",
                "spawn",
                "child_process",
                "system",
                "subprocess",
                "pickle",
                "crypto-miner",
                "bitcoin",
                "wallet",
                "hashcat",
                "shelljs",
            ];
            const deprecated = ["request", "event-stream", "left-pad", "hoek", "xmlhttprequest"];
            const mediumRisk = ["lodash", "moment", "express", "flask", "axios", "django", "requests", "urllib3"];
            if (highRiskPatterns.some((w) => name.includes(w)))
                return 9;
            if (deprecated.includes(name))
                return 8;
            if (mediumRisk.includes(name))
                return 5;
            return 2;
        };
        const results = [];
        // --- helper to score one package w/ OSV + heuristic + cache
        const scoreOne = async (pkg, eco) => {
            // heuristic baseline
            let score = heuristicScore(pkg);
            // live CVE lookup (cached)
            const osv = await queryOSV(pkg, eco);
            if (osv.vulnerable) {
                // bump score by number of CVEs & severity
                const bump = Math.min(3, osv.vulns.length); // cap contribution from count
                const sevBump = Math.max(0, ...osv.vulns.map((v) => (v.severity ? Math.min(3, Math.floor(v.severity / 3)) : 0))); // adds up to +3 from severity buckets
                score = Math.min(10, score + bump + sevBump);
            }
            const level = score >= 7 ? "High" : score >= 4 ? "Medium" : "Low";
            results.push({ package: pkg, score, level, osv: osv.vulns, ecosystem: eco });
        };
        // --- run with concurrency
        const tasks = [];
        for (const pkg of uniqNpm)
            tasks.push(limit(() => scoreOne(pkg, "npm")));
        for (const pkg of uniqPip)
            tasks.push(limit(() => scoreOne(pkg, "PyPI")));
        await Promise.allSettled(tasks);
        // --- compute overall
        const worst = results.reduce((a, b) => (a.score > b.score ? a : b), { package: "", score: 0, level: "Low" });
        // stable sort by level desc, then score desc, then name
        const levelOrder = { High: 0, Medium: 1, Low: 2 };
        results.sort((a, b) => {
            if (levelOrder[a.level] !== levelOrder[b.level])
                return levelOrder[a.level] - levelOrder[b.level];
            if (b.score !== a.score)
                return b.score - a.score;
            return a.package.localeCompare(b.package);
        });
        res.json({ output: { scores: results, overall: worst.level } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// ---------------------------------------------
// Tool 3: recommend_actions (unchanged)
// ---------------------------------------------
app.post("/tool/recommend_actions", async (req, res) => {
    try {
        const schema = z.object({
            overall: z.enum(["Low", "Medium", "High"]),
            findings: z.object({
                secrets: z.array(z.string()),
                anomalies: z.array(z.string()),
            }),
        });
        const { overall, findings } = schema.parse(req.body);
        const actions = [];
        if (findings.secrets.length)
            actions.push({ type: "ALERT", message: `Secrets found: ${findings.secrets.join(", ")}` });
        if (overall === "High")
            actions.push({ type: "BLOCK_PR", message: "High risk detected. PR must be reviewed." });
        else if (overall === "Medium")
            actions.push({ type: "COMMENT", message: "Medium risk: review recommended." });
        else
            actions.push({ type: "PASS", message: "Low risk, safe to proceed." });
        res.json({ output: { actions } });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// ---------------------------------------------
// Start server
// ---------------------------------------------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`✅ MCP-style server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map