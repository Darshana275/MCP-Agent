import React, { useState } from 'react';

function RepoInput({ onAnalyze }) {
  const [repoUrl, setRepoUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAnalyze(repoUrl);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        placeholder="Enter GitHub repo URL"
        style={{ width: '60%', padding: '8px', marginRight: '10px' }}
      />
      <button type="submit">Analyze</button>
    </form>
  );
}

export default RepoInput;   // ✅ must be "default"
