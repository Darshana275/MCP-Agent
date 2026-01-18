// backend/routes/webhookRoutes.js
const express = require("express");
const router = express.Router();
const wh = require("../controllers/githubWebhookController");

router.post("/github", wh.githubWebhook);
router.get("/events", wh.getEvents);
router.get("/latest", wh.getLatest);
router.get("/history", wh.getHistory); // ✅ NEW
router.post("/reanalyze", wh.reanalyze); // ✅ NEW

module.exports = router;
