import React, { useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import "./AnalysisResult.css";

const AnalysisResult = ({ data }) => {
  const [aiText, setAiText] = useState(data.llmExplanation);
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = React.useState(null);

  // OSV toggle state per-row (use a stable key instead of index to work with pagination)
  const [openOSVKey, setOpenOSVKey] = useState(null);

  // Pagination state for Dependency table
  const rowsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(0);

  if (!data) return null;

  const { repoUrl, riskAnalysis, overallRisk, recommendedActions } = data;

  const totalPages = Math.max(1, Math.ceil((riskAnalysis?.length || 0) / rowsPerPage));
  const startIndex = currentPage * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedRisk = (riskAnalysis || []).slice(startIndex, endIndex);

  const goPrev = () => {
    setCurrentPage((p) => {
      const next = Math.max(0, p - 1);
      if (next !== p) setOpenOSVKey(null);
      return next;
    });
  };

  const goNext = () => {
    setCurrentPage((p) => {
      const next = Math.min(totalPages - 1, p + 1);
      if (next !== p) setOpenOSVKey(null);
      return next;
    });
  };

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

  // helper to render severity if number/array/string
  const renderSeverity = (sev) => {
    if (typeof sev === "number") return String(sev);
    if (Array.isArray(sev)) return sev.join(", ");
    return sev || "—";
  };

  return (
    <div className="analysis-page">
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

        <div className="risk-table-wrapper">
          <table className="risk-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Risk Level</th>
                <th>Score</th>
                <th>OSV</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRisk.map((pkg, i) => {
                const absoluteIndex = startIndex + i;
                const hasOSV = pkg.osv && pkg.osv.length > 0;
                const first = hasOSV ? pkg.osv[0] : null;
                const rest = hasOSV && pkg.osv.length > 1 ? pkg.osv.slice(1) : [];
                const rowKey = `${pkg.package || "pkg"}|${absoluteIndex}`;
                const isOpen = openOSVKey === rowKey;

                return (
                  <tr key={rowKey}>
                    <td>{pkg.package}</td>
                    <td className={pkg.level.toLowerCase()}>{pkg.level}</td>
                    <td>{pkg.score}</td>
                    <td className="osv-cell">
                      {!hasOSV && <span className="osv-empty">—</span>}

                      {hasOSV && (
                        <>
                          <div className="osv-line">
                            <span className="osv-main">
                              <a href={first.url} target="_blank" rel="noreferrer">
                                {first.id}
                              </a>
                              {first.summary ? ` — ${first.summary}` : ""}
                              {first.severity != null
                                ? ` (severity: ${renderSeverity(first.severity)})`
                                : ""}
                            </span>

                            {rest.length > 0 && (
                              <button
                                type="button"
                                className={`osv-toggle ${isOpen ? "open" : ""}`}
                                aria-expanded={isOpen}
                                onClick={() =>
                                  setOpenOSVKey(isOpen ? null : rowKey)
                                }
                                title={
                                  isOpen
                                    ? "Hide other OSV entries"
                                    : "Show other OSV entries"
                                }
                              >
                                {isOpen ? "▴" : "▾"}
                              </button>
                            )}
                          </div>

                          {rest.length > 0 && isOpen && (
                            <ul className="osv-list">
                              {rest.map((v, j) => (
                                <li key={j}>
                                  <a href={v.url} target="_blank" rel="noreferrer">
                                    {v.id}
                                  </a>
                                  {v.summary ? ` — ${v.summary}` : ""}
                                  {v.severity != null
                                    ? ` (severity: ${renderSeverity(v.severity)})`
                                    : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                type="button"
                className="page-btn"
                onClick={goPrev}
                disabled={currentPage === 0}
              >
                ◀ Prev
              </button>
              <span className="page-status">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="page-btn"
                onClick={goNext}
                disabled={currentPage >= totalPages - 1}
              >
                Next ▶
              </button>
            </div>
          )}
        </div>

        {/* Recommended Actions */}
        <h3 className="section-title">🚨 Recommended Actions</h3>

        <div className="actions-list">
          {recommendedActions.length === 0 && <p>✅ No critical actions required.</p>}

          {recommendedActions.map((a, i) => {
            const isAlert = a.type === "ALERT";
            const isBlock = a.type === "BLOCK_PR";
            const isComment = a.type === "COMMENT";
            const shortMessage =
              a.message.length > 300 ? a.message.substring(0, 300) + "..." : a.message;

            const isExpanded = expandedIndex === i;

            return (
              <div
                key={i}
                className={`action-card ${
                  isAlert ? "alert" : isBlock ? "block" : isComment ? "comment" : ""
                }`}
              >
                <div className="action-header">
                  {isAlert && (
                    <span>
                      ⚠️ <strong>Alert:</strong>
                    </span>
                  )}
                  {isBlock && (
                    <span>
                      ⛔ <strong>Block PR:</strong>
                    </span>
                  )}
                  {isComment && (
                    <span>
                      💬 <strong>Comment:</strong>
                    </span>
                  )}
                  {!isAlert && !isBlock && !isComment && (
                    <span>
                      ✅ <strong>{a.type}:</strong>
                    </span>
                  )}
                </div>

                <div className="action-body">
                  <pre className="action-text">
                    {isExpanded ? a.message : shortMessage}
                  </pre>
                  {a.message.length > 300 && (
                    <button
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
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
    </div>
  );
};

export default AnalysisResult;
