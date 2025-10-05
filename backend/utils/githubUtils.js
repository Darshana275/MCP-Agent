const axios = require('axios');

function extractOwnerRepo(githubUrl) {
  const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchPackageJson(githubUrl) {
  const repoInfo = extractOwnerRepo(githubUrl);
  if (!repoInfo) return null;

  const { owner, repo } = repoInfo;

  // Try main branch
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/package.json`
  ];

  for (const url of urls) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (err) {
      // Continue trying next branch
    }
  }

  return null;
}

module.exports = {
  fetchPackageJson,
};
