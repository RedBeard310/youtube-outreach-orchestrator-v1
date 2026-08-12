// Fetch the next batch of approved_hold leads still awaiting enrichment and
// write them to a dated ids file for the backfill chain (2026-08-01).
//
// Pool: review_status='approved_hold' AND outreach_status IN (email_verified, failed)
// AND subscriber_count >= the pitchable floor. Completed leads leave the pool by
// flipping to ready_data_scraped; 'failed' stays in the pool (failures here are mostly
// transient), so to avoid an infinite loop on a genuinely broken lead, any id that
// already appears in MAX_ATTEMPTS or more prior *-ids.txt files in the backfill dir is
// excluded and reported.
//
// Reads Postgres directly (2026-08-12). This used to call the Airtable REST API by
// hand, which is why the migration's first sweep missed it -- it is a .cjs file and
// builds its request with `https.get` rather than the Airtable SDK, so neither the
// dependency check nor a search for SDK call sites found it.
//
// Prints shell-parseable lines: COUNT=, FILE=, POOL=, EXCLUDED=.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIR = "/home/casey/repos/youtube-outreach-orchestrator-v1/logs/backfill-2026-07";
const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE) || 500;
const MAX_ATTEMPTS = Number(process.env.BACKFILL_MAX_ATTEMPTS) || 3;

// Mirrors PITCHABLE_MIN_SUBSCRIBERS in youtube-lead-finder-v1/src/scoring/subscriber_gate.ts.
// Enrichment is the expensive stage, so paying for a channel that can never be pitched is
// the one waste worth a guard here. The finder now caps a sub-floor channel's score below
// the approval bar, so nothing new should reach this pool under the floor -- but 1,065 ids
// frozen into the Mac's claim file on 2026-08-09 were later demoted to below_threshold,
// and 272 of them had already been enriched by then. The floor stops that recurring.
const PITCHABLE_MIN_SUBSCRIBERS = Number(process.env.BACKFILL_MIN_SUBSCRIBERS) || 3000;

function databaseUrl() {
  for (const k of ["PIPELINE_DATABASE_URL", "DATABASE_URL"]) {
    if ((process.env[k] || "").trim()) return process.env[k].trim();
  }
  // Deliberately not the shared env bank: the Mac overwrites that file every couple of
  // minutes while it is awake, so anything added there on the VPS silently reverts.
  const f = process.env.PIPELINE_DB_ENV_FILE || "/home/casey/.pipeline-db.env";
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (line.startsWith("DATABASE_URL=")) return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`No database URL in env or ${f}`);
}

function pendingIds() {
  const sql =
    `SELECT id FROM leads.lead_candidates
      WHERE review_status = 'approved_hold'
        AND outreach_status IN ('email_verified','failed')
        AND COALESCE(subscriber_count, 0) >= ${PITCHABLE_MIN_SUBSCRIBERS}
      ORDER BY signal_score DESC NULLS LAST, subscriber_count DESC NULLS LAST, id`;
  const out = execFileSync("psql", [databaseUrl(), "-At", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\n").map((l) => l.trim()).filter(Boolean);
}

function belowFloorCount() {
  const sql =
    `SELECT count(*) FROM leads.lead_candidates
      WHERE review_status = 'approved_hold'
        AND outreach_status IN ('email_verified','failed')
        AND COALESCE(subscriber_count, 0) < ${PITCHABLE_MIN_SUBSCRIBERS}`;
  return Number(execFileSync("psql", [databaseUrl(), "-At", "-c", sql], { encoding: "utf8" }).trim());
}

(() => {
  // Ordered best-first now that the source is a database rather than Airtable's
  // insertion order. If a run is cut short by quota, the leads that did get enriched
  // are the ones most worth having enriched.
  const ids = pendingIds();
  const belowFloor = belowFloorCount();

  // Count prior attempts per id across all ids files already in the dir.
  const attempts = new Map();
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith("-ids.txt")) continue;
    for (const line of fs.readFileSync(path.join(DIR, f), "utf8").split("\n")) {
      const id = line.trim();
      if (id) attempts.set(id, (attempts.get(id) || 0) + 1);
    }
  }

  // Machine split (2026-08-09, Casey's plan): the Mac owns the whole backfill
  // snapshot (scripts/backfill/mac-claimed-ids.txt, 1,836 ids frozen 08-09);
  // the VPS owns everything else — i.e. new approved_hold inflow. Same script
  // both sides: BACKFILL_CLAIM_ROLE=mac processes ONLY claimed ids, anything
  // else (the VPS default) processes only UNclaimed ids. The claim file is
  // committed, so both machines see the same split via git.
  const claimFile = path.join(__dirname, "mac-claimed-ids.txt");
  const claimed = new Set(
    fs.existsSync(claimFile)
      ? fs.readFileSync(claimFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
      : [],
  );
  const role = (process.env.BACKFILL_CLAIM_ROLE || "vps").toLowerCase();
  const mine = ids.filter((id) => (role === "mac" ? claimed.has(id) : !claimed.has(id)));

  const eligible = mine.filter((id) => (attempts.get(id) || 0) < MAX_ATTEMPTS);
  const excluded = mine.length - eligible.length;
  const batch = eligible.slice(0, BATCH_SIZE);

  let file = "";
  if (batch.length > 0) {
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    file = path.join(DIR, `batch-${stamp}-ids.txt`);
    fs.writeFileSync(file, batch.join("\n") + "\n");
  }

  console.log(`COUNT=${batch.length}`);
  console.log(`FILE=${file}`);
  console.log(`POOL=${mine.length}`);
  console.log(`EXCLUDED=${excluded}`);
  console.log(`BELOW_FLOOR=${belowFloor} (skipped: under ${PITCHABLE_MIN_SUBSCRIBERS} subscribers)`);
  console.log(`ROLE=${role} (total pending across both machines: ${ids.length})`);
})();
