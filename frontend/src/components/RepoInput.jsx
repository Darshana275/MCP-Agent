import React, { useState } from 'react';
import './RepoInput.css';  // import the CSS file

function RepoInput({ onAnalyze }) {
  const [repoUrl, setRepoUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze(repoUrl);
  };

  return (
    <div className="repo-input-page">
      <form className="repo-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repo URL"
          className="repo-input-field"
        />
        <button type="submit" className="repo-input-btn">
          Analyze
        </button>
      </form>
    </div>
  );
}

export default RepoInput;
