
// backend/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors({
    origin: 'http://localhost:3000'
    }));
app.use(express.json());

// use your route file
const analyzerRoutes = require("./routes/analyzerRoutes");
app.use("/api", analyzerRoutes); // 👈 Prefix all routes with /api

// simple test endpoint (optional)
app.get("/", (req, res) => res.send("✅ Backend running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
