import React, { useState } from "react";
import RepoInput from "./components/RepoInput";
import AnalysisResult from "./components/AnalysisResult";
import Spinner from "./components/Spinner";
import "./App.css";

function App() {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spinnerText, setSpinnerText] = useState("🔍 Starting analysis...");

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
        // short delay to make transition smoother
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
      <h1 style={{ textAlign: 'center', marginTop: '20px' }}>🔍 GitHub Risk Analyzer</h1>
      <RepoInput onAnalyze={handleAnalysis} />

      {loading && <Spinner text={spinnerText} />}

      {!loading && analysisData && analysisData.success && (
        <AnalysisResult data={analysisData} />
      )}
    </div>
  );
}

export default App;
