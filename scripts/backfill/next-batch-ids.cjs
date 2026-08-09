// Fetch the next batch of approved_hold leads still awaiting enrichment and
// write them to a dated ids file for the backfill chain (2026-08-01).
//
// Pool: review_status='approved_hold' AND outreach_status IN (email_verified, failed).
// Completed leads leave the pool by flipping to ready_data_scraped; 'failed' stays
// in the pool (failures here are mostly transient), so to avoid an infinite loop on
// a genuinely broken lead, any id that already appears in MAX_ATTEMPTS or more
// prior *-ids.txt files in the backfill dir is excluded and reported.
//
// Run from a cwd whose .env has AIRTABLE_PAT (the email repo). Prints shell-
// parseable lines: COUNT=, FILE=, POOL=, EXCLUDED=.

require("dotenv/config");
const fs = require("fs");
const path = require("path");
const https = require("https");

const BASE = "appenY7r5jlZMRpJ0";
const DIR = "/home/casey/repos/youtube-outreach-orchestrator-v1/logs/backfill-2026-07";
const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE) || 500;
const MAX_ATTEMPTS = Number(process.env.BACKFILL_MAX_ATTEMPTS) || 3;

const pat = process.env.AIRTABLE_PAT;
if (!pat) {
  console.error("AIRTABLE_PAT not set");
  process.exit(1);
}

function fetchPage(offset) {
  const formula = encodeURIComponent(
    "AND({review_status}='approved_hold', OR({outreach_status}='email_verified',{outreach_status}='failed'))",
  );
  const url =
    `https://api.airtable.com/v0/${BASE}/lead_candidates?fields%5B%5D=channel_name` +
    `&filterByFormula=${formula}${offset ? `&offset=${offset}` : ""}`;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { authorization: `Bearer ${pat}` } }, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            const j = JSON.parse(d);
            if (j.error) return reject(new Error(JSON.stringify(j.error)));
            resolve(j);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

(async () => {
  const ids = [];
  let offset;
  do {
    const page = await fetchPage(offset);
    for (const r of page.records) ids.push(r.id);
    offset = page.offset;
  } while (offset);

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
  console.log(`ROLE=${role} (total pending across both machines: ${ids.length})`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
