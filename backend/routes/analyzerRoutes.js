// backend/routes/analyzerRoutes.js
const express = require("express");
const router = express.Router();
const analyzer = require("../controllers/analyzerController");
//const { generateLLMExplanation } = require("../utils/llmExplain");

router.post("/analyze", analyzer.analyzePackage);
router.get("/ai-explain", analyzer.getAIExplanation);

// 🧠 new streaming endpoint
//router.get("/ai-explain/stream", async (req, res) => {
//  try {
//    const { repoUrl, detail } = req.query;
//    const cache = analyzer.getCachedScan
//      ? analyzer.getCachedScan()
//      : new Map();
//
//    const analysis = cache.get(repoUrl);
//    if (!analysis)
//      return res
//        .status(404)
//        .json({ error: "No analysis found for this repo" });
//
//    await generateLLMExplanation(res, analysis.scores, analysis.overall, detail || "short");
//  } catch (err) {
//    console.error("Stream route error:", err);
//    res.status(500).end();
//  }
//});

module.exports = router;
