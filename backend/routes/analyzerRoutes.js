const express = require('express');
const router = express.Router();
const { analyzePackage } = require('../controllers/analyzerController');

// POST /api/analyze
router.post('/', analyzePackage);

module.exports = router;
