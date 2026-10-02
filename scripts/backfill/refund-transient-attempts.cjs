// Refund the retry budget of leads a batch failed for a reason that was not about
// the lead (2026-10-02).
//
// WHY. `next-batch-ids.cjs` counts a lead's attempts as the number of launched
// `*-ids.txt` files its id appears in, and drops it from the pool for good at
// BACKFILL_MAX_ATTEMPTS (3). chain.sh already refunds a WHOLE batch when the
// batch obviously died of infrastructure — the mass-failure guard (>100 failures)
// and the zero-progress guard (0 done, 2+ failed). Neither can see the shape this
// cycle produced: on 2026-10-01 the 15:35 batch enriched 92 leads and failed 12,
// and TEN of those 12 died on `503 backendError` from YouTube's `videos`
// endpoint — Google being briefly unavailable, nothing to do with the channel.
// The batch looked healthy, so those ten leads silently paid an attempt each.
// Three such minutes across a lead's life and a perfectly good lead is excluded
// from enrichment forever, with no log line saying why.
//
// WHAT. Remove the transiently-failed ids from the batch's own ids file, which is
// exactly what "refund an attempt" means here. Safe by construction: a lead that
// DID get enriched leaves the pool by its `outreach_status` flip, never by its
// attempt count, so editing the attempt record cannot resurrect finished work.
//
// Only known-transient signatures are refunded. A lead that failed for its own
// reasons still pays, and still ages out of the pool at three attempts. A refund
// ledger caps each lead at BACKFILL_MAX_TRANSIENT_REFUNDS (3) refunds across its
// whole life, so no lead can become immortal by failing transiently forever.
//
// Usage:  node refund-transient-attempts.cjs <run.log> <ids-file> [--dry-run]
// Prints one summary line for chain.sh to log, and nothing else.

const fs = require("fs");
const path = require("path");

const MAX_REFUNDS = Number(process.env.BACKFILL_MAX_TRANSIENT_REFUNDS) || 3;

// Failures that are a statement about a service, not about a channel. Matched
// against the stderr block the runner prints under each lead's FAILED line.
// Deliberately narrow: an unrecognised failure pays its attempt, which is the
// old behaviour, so a bad pattern here can only ever under-refund.
const TRANSIENT = [
  [/"reason":\s*"backendError"/, "youtube 503 backendError"],
  [/\bstatus:\s*(?:500|502|503|504)\b/, "upstream 5xx"],
  [/The service is currently unavailable/i, "upstream unavailable"],
  [/\b(?:ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH)\b/, "network error"],
  [/socket hang up|fetch failed|Connect Timeout|terminated/i, "connection dropped"],
  [/openrouter[^\n]*\b(?:429|500|502|503|504)\b/i, "openrouter transient"],
  [/\brate ?limit(?:ed)?\b/i, "rate limited"],
];

/** Full record ids of this run's failures, from the end-of-run summary block,
 *  e.g. `[FAILED            ] Young Plumbing → recQfyeIuKKYWpOiZ__Young_Plumbing.md`. */
function summaryFailedIds(log) {
  const ids = [];
  const re = /^\[FAILED\s*\][^\n]*?(rec[A-Za-z0-9]+)__/gm;
  let m;
  while ((m = re.exec(log))) ids.push(m[1]);
  return ids;
}

/** Per-lead failure blocks: the 6-char id tail the runner prints, plus the stderr
 *  that follows it, bounded by the NEXT per-lead log line so one lead's error can
 *  never be charged to its neighbour. */
function failureBlocks(log) {
  const lines = log.split("\n");
  const leadLine = /^\[\d\d:\d\d:\d\d\] \[([^\s\]]+)[^\]]*\]/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(leadLine);
    if (!m || !/\] FAILED:/.test(lines[i])) continue;
    const body = [lines[i]];
    for (let j = i + 1; j < lines.length && !leadLine.test(lines[j]); j++) body.push(lines[j]);
    out.push({ tail: m[1], text: body.join("\n") });
  }
  return out;
}

function classify(text) {
  for (const [re, label] of TRANSIENT) if (re.test(text)) return label;
  return null;
}

(() => {
  const [runLog, idsFile] = process.argv.slice(2);
  const dryRun = process.argv.includes("--dry-run");
  if (!runLog || !idsFile || !fs.existsSync(runLog) || !fs.existsSync(idsFile)) {
    console.log("REFUND=0 reason=no-log-or-ids-file");
    return;
  }

  const log = fs.readFileSync(runLog, "utf8");
  const ids = fs.readFileSync(idsFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
  const failedIds = summaryFailedIds(log);

  // Resolve each failure block's 6-char tail to a full id. Prefer the summary ids
  // (same run, so unambiguous); fall back to the batch's ids file.
  const resolve = (tail) => {
    const hits = failedIds.filter((id) => id.endsWith(tail));
    if (hits.length === 1) return hits[0];
    const pool = ids.filter((id) => id.endsWith(tail));
    return pool.length === 1 ? pool[0] : null;
  };

  const ledgerFile = path.join(path.dirname(idsFile), "transient-refunds.json");
  let ledger = {};
  try { ledger = JSON.parse(fs.readFileSync(ledgerFile, "utf8")); } catch { /* first run */ }

  const inBatch = new Set(ids);
  const refund = new Map();   // id -> reason
  const reasons = new Map();  // reason -> count
  let capped = 0;
  let unresolved = 0;

  for (const b of failureBlocks(log)) {
    const reason = classify(b.text);
    if (!reason) continue;
    const id = resolve(b.tail);
    if (!id) { unresolved++; continue; }
    // Idempotent: an id already struck from this file was refunded on an earlier
    // pass over the same log, so re-running must neither re-report it nor spend
    // another slot of its lifetime cap.
    if (!inBatch.has(id)) continue;
    if ((ledger[id] || 0) >= MAX_REFUNDS) { capped++; continue; }
    if (!refund.has(id)) {
      refund.set(id, reason);
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
  }

  if (refund.size === 0) {
    const tail = [
      capped ? `capped=${capped}` : "",
      unresolved ? `unresolved=${unresolved}` : "",
    ].filter(Boolean).join(" ");
    console.log(`REFUND=0${tail ? " " + tail : ""}`);
    return;
  }

  const kept = ids.filter((id) => !refund.has(id));
  const summary = [...reasons.entries()].map(([r, n]) => `${n}× ${r}`).join(", ");
  if (!dryRun) {
    fs.writeFileSync(idsFile, kept.length ? kept.join("\n") + "\n" : "");
    for (const id of refund.keys()) ledger[id] = (ledger[id] || 0) + 1;
    fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 0));
  }
  console.log(
    `REFUND=${refund.size}${dryRun ? " (dry-run)" : ""} ${summary}` +
    `${capped ? ` capped=${capped}` : ""}${unresolved ? ` unresolved=${unresolved}` : ""}`,
  );
})();
