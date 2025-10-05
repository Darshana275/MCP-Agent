const axios = require('axios');

exports.getMcpExplanation = async (packageJson) => {
  const prompt = `Analyze the following package.json for vulnerabilities:\n\n${JSON.stringify(packageJson, null, 2)}`;
  
  const response = await axios.post('http://localhost:11434/api/generate', {
    model: 'mistral',
    prompt,
    stream: false
  });

  return response.data.response;
};
