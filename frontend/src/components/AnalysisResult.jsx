import React from 'react';
import './AnalysisResult.css';

// Helper function to map risk level to a CSS class
const getRiskClass = (level) => {
  if (!level) return 'low';
  return level.toLowerCase();
};

// Helper component for displaying a single package row
const PackageRow = ({ pkg }) => {
  const riskClass = getRiskClass(pkg.risk_level);

  return (
    <tr>
      <td>{pkg.name || 'N/A'}</td>
      <td>{pkg.version || 'N/A'}</td>
      <td className={`risk-level ${riskClass}`}>
        {pkg.risk_level || 'LOW'}
      </td>
      <td>{pkg.vulnerabilities?.length || 0}</td>
      <td>
        {/* Display alternatives or a simple message */}
        {pkg.alternatives && pkg.alternatives.length > 0
          ? pkg.alternatives.join(', ')
          : 'None suggested'}
      </td>
    </tr>
  );
};

// Main component
function AnalysisResult({ data }) {
  if (!data || !data.analysis) {
    return <div className="status error">No analysis data found.</div>;
  }

  const { overall_risk, explanation, packages, actions } = data.analysis;

  return (
    <div className="analysis-container">
      
      {/* Overall Risk Section */}
      <section>
        <h2 className="section-title">
          <span role="img" aria-label="shield">🛡️</span> Overall Risk Assessment
        </h2>
        <p>
          This repository has been assessed with an **Overall Risk Level:** <span className={`overall-risk ${getRiskClass(overall_risk)}`}>
            {overall_risk || 'LOW'}
          </span>
        </p>
      </section>

      {/* Dependency Risk Table */}
      <section>
        <h2 className="section-title">
          <span role="img" aria-label="package">📦</span> Dependency Risk Breakdown
        </h2>
        
        {packages && packages.length > 0 ? (
          <table className="risk-table">
            <thead>
              <tr>
                <th>Package Name</th>
                <th>Version</th>
                <th>Risk Level</th>
                <th>Vulnerabilities</th>
                <th>Suggested Alternatives</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg, index) => (
                <PackageRow key={index} pkg={pkg} />
              ))}
            </tbody>
          </table>
        ) : (
          <p>No external dependencies or risks found in the manifest files.</p>
        )}
      </section>

      {/* Recommended Actions (Optional, if the API provides this) */}
      {actions && actions.length > 0 && (
        <section>
          <h2 className="section-title">
            <span role="img" aria-label="tool">🛠️</span> Recommended Actions
          </h2>
          <div className="actions-list">
            {actions.map((action, index) => (
              <div key={index} className={`action-card ${action.type.toLowerCase()}`}>
                <div className="action-header">{action.title}</div>
                <div className="action-text">{action.description}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Explanation Section (using the existing markdown style) */}
      <section>
        <h2 className="section-title">
          <span role="img" aria-label="robot">🤖</span> AI-Generated Risk Explanation
        </h2>
        <div className="explanation">
          {/* NOTE: If the explanation is in Markdown, you might need a library 
             like 'react-markdown' to render it. For now, we use a simple div. */}
          <div className="markdown" dangerouslySetInnerHTML={{ __html: explanation }} />
        </div>
      </section>

    </div>
  );
}

export default AnalysisResult;