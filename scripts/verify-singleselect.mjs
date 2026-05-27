// Reads the current outreach_status singleSelect choices and reports whether
// the three deep_research_* options needed by the orchestrator are present.
// Run: node scripts/verify-singleselect.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);

const headers = { Authorization: `Bearer ${env.AIRTABLE_PAT}` };
const url = `https://api.airtable.com/v0/meta/bases/${env.LEAD_BASE_ID}/tables`;
const r = await fetch(url, { headers });
const s = await r.json();
if (s.error) { console.error(s.error); process.exit(1); }

const field = s.tables
  .find(t => t.id === "tbldoduDIuwQePfgS")
  .fields.find(f => f.id === "fldrJuWdk3hgeRXKc");

const names = field.options.choices.map(c => c.name);
console.log("Current outreach_status choices:");
names.forEach(n => console.log("  -", n || "(empty)"));

const needed = ["deep_research_in_progress", "deep_research_complete", "deep_research_failed"];
const missing = needed.filter(n => !names.includes(n));
if (missing.length) {
  console.log(`\nMissing: ${missing.join(", ")}`);
  process.exit(1);
} else {
  console.log("\nAll three new options present.");
}
