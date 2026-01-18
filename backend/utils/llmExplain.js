// backend/utils/llmExplain.js
const { GoogleGenerativeAI } = require("@google/generative-ai");


function safeStringify(obj, space = 2) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
      return value;
    },
    space
  );
}
// Single-response generator (stable, non-streaming)
exports.generateLLMExplanation = async (riskData, overallRisk, detail = "short") => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Use a model that actually exists for your key
    const model = genAI.getGenerativeModel({
      model: "gemma-3-1b-it", // Adjust as needed
    });
    const jsonData = safeStringify(riskData, 2);
    const prompt = `
You are a cybersecurity assistant.

Explain the dependency risk analysis in ${detail === "detailed" ? "detailed, technical" : "concise"
      } markdown format.

Include:
- Key risky dependencies (and why)
- Safer alternatives
- Project security summary
- Developer recommendations

JSON data:
${jsonData}
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
