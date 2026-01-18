// backend/utils/webhookStore.js
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "webhook-events.jsonl");
const ANALYSES_FILE = path.join(DATA_DIR, "webhook-analyses.jsonl");

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, "");
  if (!fs.existsSync(ANALYSES_FILE)) fs.writeFileSync(ANALYSES_FILE, "");
}

function appendLine(file, obj) {
  ensure();
  fs.appendFileSync(file, JSON.stringify(obj) + "\n", "utf8");
}

function loadLastN(file, n) {
  ensure();
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  const slice = lines.slice(Math.max(0, lines.length - n));
  const out = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // ignore malformed lines
    }
  }
  return out;
}

module.exports = {
  EVENTS_FILE,
  ANALYSES_FILE,
  appendLine,
  loadLastN,
};
