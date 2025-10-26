import React, { useState } from "react";
import RepoInput from "./components/RepoInput";
import AnalysisResult from "./components/AnalysisResult";
import Spinner from "./components/Spinner";
import "./App.css";

function App() {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  // New state for user-friendly error messages
  const [errorMsg, setErrorMsg] = useState(null); 
  const [spinnerText, setSpinnerText] = useState("🔍 Starting analysis...");

  const handleAnalysis = async (repoUrl) => {
    try {
      // Reset all states on new submission
      setAnalysisData(null);
      setErrorMsg(null);
      setLoading(true);
      setSpinnerText("🧩 Scanning repository files...");

      const res = await fetch("http://localhost:4000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      // Handle non-OK HTTP status codes
      if (!res.ok) {
        const errorDetail = await res.text();
        throw new Error(`Server returned status ${res.status}: ${errorDetail.substring(0, 100)}...`);
      }

      setSpinnerText("📦 Analyzing dependencies and vulnerabilities...");

      const data = await res.json();

      if (data.success) {
        setSpinnerText("🧠 Generating AI risk explanation...");
        // short delay to make transition smoother
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAnalysisData(data);
      } else {
        // Handle a 'success: false' response from the backend
        setErrorMsg("Analysis failed or incomplete. The backend log may contain details.");
      }
    } catch (err) {
      console.error("Error fetching analysis:", err);
      // Set a user-friendly error message
      setErrorMsg(`⚠️ Error occurred while analyzing repository: ${err.message || 'Check the console for details.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Wrap content in a container class for better layout (defined in App.css)
    <div className="App container">
      <h1>🔍 GitHub Risk Analyzer</h1>
      
      {/* Pass the loading state to RepoInput */}
      <RepoInput onAnalyze={handleAnalysis} isAnalyzing={loading} />

      {/* Display error message if it exists */}
      {errorMsg && <div className="status error">{errorMsg}</div>}

      {/* Show spinner while loading */}
      {loading && <Spinner text={spinnerText} />}

      {/* Show results only when not loading, data exists, and was successful */}
      {!loading && analysisData && analysisData.success && (
        <AnalysisResult data={analysisData} />
      )}

      {/* Optionally, display something if analysis was successful but returned no data */}
      {!loading && !analysisData && !errorMsg && (
        <p className="no-result-msg">Enter a GitHub URL and click Analyze to begin.</p>
      )}
    </div>
  );
}

export default App;