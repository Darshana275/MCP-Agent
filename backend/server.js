// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// ✅ RAW only for webhook endpoint (signature verification)
app.use("/api/webhooks/github", express.raw({ type: "application/json" }));

// ✅ JSON for everything else
app.use(express.json({ limit: "10mb" }));

// routes
const webhookRoutes = require("./routes/webhookRoutes");
app.use("/api/webhooks", webhookRoutes);

const analyzerRoutes = require("./routes/analyzerRoutes");
app.use("/api", analyzerRoutes);

app.get("/", (req, res) => res.send("✅ Backend running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
