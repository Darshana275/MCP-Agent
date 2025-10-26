import React, { useState } from 'react';

// Accept 'isAnalyzing' as a new prop to disable the button
function RepoInput({ onAnalyze, isAnalyzing }) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');

  const validateUrl = (url) => {
    if (!url.trim()) {
      return 'Repository URL cannot be empty.';
    }
    // Basic check for a standard GitHub URL format
    if (!url.startsWith('http') || !url.includes('github.com')) {
      return 'Please enter a valid GitHub repository URL (e.g., https://github.com/user/repo).';
    }
    return ''; // Return empty string if valid
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    const validationError = validateUrl(repoUrl);
    if (validationError) {
      setError(validationError);
      return;
    }

    onAnalyze(repoUrl);
  };

  return (
    // Add class for styling
    <form className="repo-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={repoUrl}
        onChange={(e) => {
          setRepoUrl(e.target.value);
          // Clear error as user starts typing again
          if (error) setError('');
        }}
        placeholder="Enter GitHub repository URL (e.g., https://github.com/user/repo)"
        // Remove inline style and use CSS class
      />
      <button 
        type="submit"
        // Disable button if input is empty or if analysis is running
        disabled={isAnalyzing || !repoUrl.trim()}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
      </button>

      {/* Display error message if present */}
      {error && <div className="status error">{error}</div>}
    </form>
  );
}

export default RepoInput;