import React, { useState } from "react";
import RepoInput from "./components/RepoInput";
import AnalysisResult from "./components/AnalysisResult";
import Spinner from "./components/Spinner";
import WebhookMonitor from "./components/WebhookMonitor"; // ✅ NEW
import "./App.css";

function App() {
  const [mode, setMode] = useState("manual"); // manual | webhook

  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spinnerText, setSpinnerText] = useState("🔍 Starting analysis...");

  const toggleMode = () => {
    setMode((m) => (m === "manual" ? "webhook" : "manual"));
    // optional: keep previous analysis data, or reset it
    // setAnalysisData(null);
  };

  const handleAnalysis = async (repoUrl) => {
    try {
      setAnalysisData(null);
      setLoading(true);
      setSpinnerText("🧩 Scanning repository files...");

      const res = await fetch("http://localhost:4000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      setSpinnerText("📦 Analyzing dependencies and vulnerabilities...");

      const data = await res.json();

      if (data.success) {
        setSpinnerText("🧠 Generating AI risk explanation...");
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAnalysisData(data);
      } else {
        alert("Analysis failed or incomplete. Please check the backend logs.");
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
      alert("⚠️ Error occurred while analyzing repository.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <h1 style={{ textAlign: "center", margin: 0, flex: 1 }}>🔍 GitHub Risk Analyzer</h1>

        <button
          onClick={toggleMode}
          style={{ marginLeft: 12, padding: "8px 12px", cursor: "pointer" }}
        >
          {mode === "manual" ? "🔔 Webhook Mode" : "🔎 Manual Scan"}
        </button>
      </div>

      {mode === "manual" ? (
        <>
          <RepoInput onAnalyze={handleAnalysis} />

          {loading && <Spinner text={spinnerText} />}

          {!loading && analysisData && analysisData.success && (
            <AnalysisResult data={analysisData} />
          )}
        </>
      ) : (
        <WebhookMonitor />
      )}
    </div>
  );
}

export default App;
