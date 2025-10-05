import React from "react";

function AnalysisResult({ result }) {
  if (!result) return null;

  // If backend returns a string
  if (typeof result === "string") {
    return (
      <div style={{ marginTop: "1rem" }}>
        <h3>Analysis Result:</h3>
        <pre>{result}</pre>
      </div>
    );
  }

  // If backend returns an array
  if (Array.isArray(result)) {
    return (
      <div style={{ marginTop: "1rem" }}>
        <h3>Analysis Result:</h3>
        {result.map((item, idx) => {
          const alternatives =
            Array.isArray(item.alternatives)
              ? item.alternatives.join(", ")
              : item.alternatives || "None";

          return (
            <div
              key={idx}
              style={{
                marginBottom: "1rem",
                padding: "0.8rem",
                border: "1px solid #ccc",
                borderRadius: "6px",
                background: "#fafafa",
              }}
            >
              <p><b>Package:</b> {item.package || "Unknown"}</p>
              <p><b>Risk:</b> {item.risk || "Not specified"}</p>
              <p><b>Alternatives:</b> {alternatives}</p>
            </div>
          );
        })}
      </div>
    );
  }

  // For any unexpected response
  return (
    <div style={{ marginTop: "1rem" }}>
      <h3>Raw Response:</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

export default AnalysisResult;
