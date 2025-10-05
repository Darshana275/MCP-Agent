const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.analyzePackage = async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl)
      return res.status(400).json({ error: 'Expected "repoUrl" in request body.' });

    // Extract owner and repo
    const [owner, repo] = repoUrl.replace('https://github.com/', '').split('/');

    // Fetch repo tree recursively
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    const treeResponse = await axios.get(treeUrl, {
      headers: { 'User-Agent': 'MCP-AI-Agent' },
    });

    const tree = treeResponse.data.tree;

    // Dependency file patterns (lowercase for comparison)
    const dependencyFiles = [
      'package.json',
      'requirements.txt',
      'pyproject.toml',
      'environment.yml',
      'composer.json',
      'pom.xml',
      'build.gradle',
      'go.mod',
      'cargo.toml',
      'gemfile',
      'mix.exs'
    ];

    // Find dependency files (case-insensitive)
    const foundFiles = tree.filter(item =>
      dependencyFiles.some(dep => item.path.toLowerCase().endsWith(dep))
    );

    if (foundFiles.length === 0) {
      return res.status(404).json({
        error: 'No recognized dependency file found in this repository.',
      });
    }

    // Fetch contents from actual file paths (respecting case)
    const fileContents = [];
    for (const file of foundFiles) {
      const filePath = file.path; // preserve original case
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
      try {
        const fileResponse = await axios.get(rawUrl);
        fileContents.push({ file: filePath, content: fileResponse.data });
      } catch (err) {
        console.warn(`❗ Could not fetch ${filePath}: ${err.message}`);
      }
    }

    if (fileContents.length === 0) {
      return res.status(404).json({
        error: 'Could not fetch any dependency file contents.',
      });
    }

    // Build analysis prompt
    let filesForPrompt = fileContents
      .map(f => `File: ${f.file}\n\n${f.content}`)
      .join('\n\n---\n\n');

    const prompt = `
Analyze the following dependency files (JavaScript, Python, PHP, Java, etc.)
and return a concise JSON array.

For each risky or noteworthy dependency, include:
1. "package": name of dependency
2. "risk": one-line summary of vulnerability or issue
3. "alternatives": safer or modern options

Return ONLY valid JSON.

Dependency files:
${filesForPrompt}
`;

    // Send to Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\[.*\]/s);
      parsed = match ? JSON.parse(match[0]) : responseText;
    }

    res.json({
      success: true,
      filesAnalyzed: foundFiles.map(f => f.path),
      analysis: parsed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Failed to analyze repo',
      details: err.message,
    });
  }
};
