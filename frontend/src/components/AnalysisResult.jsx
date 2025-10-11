import React, { useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "./AnalysisResult.css";

const AnalysisResult = ({ data }) => {
  const [aiText, setAiText] = useState(data.llmExplanation);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = React.useState(null);

  if (!data) return null;

  const { repoUrl, riskAnalysis, overallRisk, recommendedActions } = data;

  const fetchAI = async (detail = "short") => {
    setAiText(""); // reset previous text
    setLoading(true);

    const url = `http://localhost:4000/api/ai-explain/stream?repoUrl=${encodeURIComponent(
      repoUrl
    )}&detail=${detail}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      if (event.data === "[END]") {
        eventSource.close();
        setLoading(false);
        return;
      }
      setAiText((prev) => prev + event.data);
    };

    eventSource.onerror = (err) => {
      console.error("Stream error:", err);
      setLoading(false);
      eventSource.close();
    };
  };


  return (
    <div className="analysis-container">
      <h2 className="title">📦 Repository Analysis</h2>
      <p>
        <strong>Repository:</strong>{" "}
        <a href={repoUrl} target="_blank" rel="noreferrer">
          {repoUrl}
        </a>
      </p>

      <div className={`overall-risk ${overallRisk.toLowerCase()}`}>
        <strong>Overall Risk:</strong> {overallRisk}
      </div>

      <h3 className="section-title">🧩 Dependency Risk Breakdown</h3>
      <table className="risk-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>Risk Level</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {riskAnalysis.map((pkg, i) => (
            <React.Fragment key={i}>
              <tr>
                <td>{pkg.package}</td>
                <td className={pkg.level.toLowerCase()}>{pkg.level}</td>
                <td>{pkg.score}</td>
              </tr>
              {pkg.osv && pkg.osv.length > 0 && (
                <tr>
                  <td colSpan="3">
                    <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                      {pkg.osv.map((v, j) => (
                        <li key={j}>
                          <a href={v.url} target="_blank" rel="noreferrer">
                            {v.id}
                          </a>
                          {v.summary ? ` — ${v.summary}` : ""}
                          {typeof v.severity === "number"
                            ? ` (severity: ${v.severity})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Recommended Actions */}


<h3 className="section-title">🚨 Recommended Actions</h3>

<div className="actions-list">
  {recommendedActions.length === 0 && <p>✅ No critical actions required.</p>}

  {recommendedActions.map((a, i) => {
    const isAlert = a.type === "ALERT";
    const isBlock = a.type === "BLOCK_PR";
    const isComment = a.type === "COMMENT";
    const shortMessage =
      a.message.length > 300
        ? a.message.substring(0, 300) + "..."
        : a.message;

    const isExpanded = expandedIndex === i;

    return (
      <div
        key={i}
        className={`action-card ${
          isAlert ? "alert" : isBlock ? "block" : isComment ? "comment" : ""
        }`}
      >
        <div className="action-header">
          {isAlert && <span>⚠️ <strong>Alert:</strong></span>}
          {isBlock && <span>⛔ <strong>Block PR:</strong></span>}
          {isComment && <span>💬 <strong>Comment:</strong></span>}
          {!isAlert && !isBlock && !isComment && (
            <span>✅ <strong>{a.type}:</strong></span>
          )}
        </div>

        <div className="action-body">
          <pre className="action-text">
            {isExpanded ? a.message : shortMessage}
          </pre>
          {a.message.length > 300 && (
            <button
              onClick={() =>
                setExpandedIndex(isExpanded ? null : i)
              }
              className="show-more-btn"
            >
              {isExpanded ? "Show Less ▲" : "Show More ▼"}
            </button>
          )}
        </div>
      </div>
    );
  })}
</div>



      <h3 className="section-title">🧠 AI Explanation</h3>
      <div className="ai-controls">
        <button onClick={() => fetchAI("short")} disabled={loading}>
          {loading ? "Generating..." : "🔄 Refresh (Short)"}
        </button>
        <button onClick={() => fetchAI("detailed")} disabled={loading}>
          {loading ? "Generating..." : "🧩 Explain in Detail"}
        </button>
      </div>

      <div className="explanation">
        <div className="markdown">
          {aiText ? (
            <div
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(marked.parse(aiText)),
              }}
            />
          ) : (
            <p>⏳ Awaiting AI explanation...</p>
          )}  
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
