import React, { useState } from "react";
import RepoInput from "./components/RepoInput";
import AnalysisResult from "./components/AnalysisResult";

function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async (repoUrl) => {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await fetch("http://localhost:4000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();
      setLoading(false);

      if (data.error) setError(data.error);
      else setResult(data.analysis || data);
    } catch (err) {
      setLoading(false);
      setError("Something went wrong.");
      console.error(err);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>MCP Agent — Dependency Analyzer</h1>
      <RepoInput onAnalyze={handleAnalyze} />
      {loading && <p>Analyzing — please wait…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      <AnalysisResult result={result} />
    </div>
  );
}

export default App;
