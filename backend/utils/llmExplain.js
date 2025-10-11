// backend/utils/llmExplain.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Normal single-response generator (for fallback use)
exports.generateLLMExplanation = async (riskData, overallRisk, detail = "short") => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Explain the dependency risk analysis in ${detail === "detailed" ? "detailed, technical" : "concise"} markdown format.
Include:
- Key risky dependencies (and why)
- Safer alternatives
- Project security summary
- Developer recommendations

JSON data:
${JSON.stringify(riskData, null, 2)}

Overall risk: ${overallRisk}
Return only markdown text (no code blocks).
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("❗ LLM generation failed:", err.message);
    return "⚠️ AI explanation unavailable.";
  }
};

// 🧠 Streaming response generator (SSE)
exports.streamLLMExplanation = async (res, riskData, overallRisk, detail = "short") => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `
You are a cybersecurity AI assistant.
Explain the dependency risk analysis in ${detail === "detailed" ? "detailed, technical" : "concise"} markdown format.
Include:
- Key risky dependencies (and why)
- Safer alternatives
- Project security summary
- Developer recommendations

JSON data:
${JSON.stringify(riskData, null, 2)}

Overall risk: ${overallRisk}
Return only markdown text (no code blocks).
`;

  // Set headers for SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    const stream = await model.generateContentStream(prompt);

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) res.write(`data: ${text}\n\n`);
    }

    res.write("data: [END]\n\n");
    res.end();
  } catch (err) {
    console.error("❗ Stream error:", err.message);
    res.write(`data: ⚠️ Streaming failed: ${err.message}\n\n`);
    res.write("data: [END]\n\n");
    res.end();
  }
};
