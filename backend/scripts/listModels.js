// backend/scripts/listModels.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fetch = global.fetch;

async function main() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Missing GEMINI_API_KEY in .env");

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
        console.error("HTTP", r.status, data);
        process.exit(1);
    }

    // Print only models that support generateContent (and streaming if present)
    const models = (data.models || []).map(m => ({
        name: m.name, // e.g. "models/gemini-2.5-flash"
        methods: m.supportedGenerationMethods || [],
    }));

    const gen = models.filter(m => m.methods.includes("generateContent"));
    const stream = models.filter(m => m.methods.includes("streamGenerateContent"));

    console.log("\n=== generateContent models ===");
    gen.forEach(m => console.log(m.name, "=>", m.methods.join(",")));

    console.log("\n=== streamGenerateContent models ===");
    stream.forEach(m => console.log(m.name, "=>", m.methods.join(",")));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
