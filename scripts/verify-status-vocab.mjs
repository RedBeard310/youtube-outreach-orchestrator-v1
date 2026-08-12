// Confirm the database will accept every review_status / outreach_status the
// orchestrator writes.
//
// This replaces verify-singleselect.mjs, which asked Airtable's Meta API for the
// choices on a singleSelect field. The equivalent in Postgres is a vocabulary table
// that the status column references, so the check is the same question against a
// different source: is every value the code writes actually allowed?
//
// Worth keeping rather than trusting the schema: the d100 path is the only writer of
// deep_research_in_progress / _complete / _failed, and it writes them hours apart from
// anything that would notice. A missing value fails at the write, mid-run.
//
//   node scripts/verify-status-vocab.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

// What the orchestrator reads (branch selection) and writes (d100 transitions).
// Kept here rather than imported so this stays a standalone diagnostic.
const REVIEW_READ = ["approved", "D100"];
const OUTREACH_WRITE = ["deep_research_in_progress", "deep_research_complete", "deep_research_failed"];
const OUTREACH_READ = ["pending", "email_found", "email_verified", "no_email_found", "email_invalid",
  "ready_data_scraped", "ready_no_data", "enriched", "email_drafted", "sent_to_smartlead", "failed"];

function databaseUrl() {
  for (const k of ["PIPELINE_DATABASE_URL", "DATABASE_URL"]) {
    if ((process.env[k] || "").trim()) return process.env[k].trim();
  }
  const f = process.env.PIPELINE_DB_ENV_FILE || "/home/casey/.pipeline-db.env";
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(`No database URL in env or ${f}`);
}

const url = databaseUrl();
const values = (table) =>
  execFileSync("psql", [url, "-At", "-c", `SELECT value FROM leads.${table} ORDER BY sort_order, value`],
    { encoding: "utf8" }).split("\n").map((s) => s.trim()).filter(Boolean);

const review = values("vocab_lead_candidates_review_status");
const outreach = values("vocab_lead_candidates_outreach_status");

console.log("review_status values:");
for (const v of review) console.log("  -", v);
console.log("\noutreach_status values:");
for (const v of outreach) console.log("  -", v);

const missing = [
  ...REVIEW_READ.filter((v) => !review.includes(v)).map((v) => `review_status: ${v} (branch selection)`),
  ...OUTREACH_WRITE.filter((v) => !outreach.includes(v)).map((v) => `outreach_status: ${v} (d100 writes this)`),
  ...OUTREACH_READ.filter((v) => !outreach.includes(v)).map((v) => `outreach_status: ${v} (read by the tick)`),
];

if (missing.length) {
  console.log(`\n${missing.length} value(s) the orchestrator needs are NOT in the vocabulary:`);
  for (const m of missing) console.log("  MISSING " + m);
  console.log("\nAdd them with: INSERT INTO leads.vocab_lead_candidates_<field>(value) VALUES ('...');");
  process.exit(1);
}
console.log("\nEvery status the orchestrator reads or writes is present.");
