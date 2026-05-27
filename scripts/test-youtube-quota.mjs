// Tests whether YouTube API quotas are per-project or shared across projects.
//
// Fires 15 search.list calls in parallel for each of 4 keys (60 total).
// search.list costs 100 quota units. Per-minute search limit is 10/project.
//
//   - PER-PROJECT quotas: ~10 succeed per key (~40 total)
//   - SHARED quotas:      ~10 total successes across all 4 keys
//
// Run: node scripts/test-youtube-quota.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.test-keys", "utf8")
    .split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const keys = [1, 2, 3, 4].map(i => env[`TEST_YT_KEY_${i}`]).filter(Boolean);
if (keys.length !== 4) {
  console.error(`Expected 4 keys in .env.test-keys; got ${keys.length}`);
  process.exit(1);
}

const PER_KEY = 15;
const TEST_QUERY = "node.js tutorial";

async function fireOne(key) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(TEST_QUERY)}&type=video&maxResults=1&key=${key}`;
  const r = await fetch(url);
  if (r.status === 200) return { ok: true };
  const body = await r.json().catch(() => ({}));
  const reason = body?.error?.errors?.[0]?.reason ?? "unknown";
  const quotaRelated = ["rateLimitExceeded", "quotaExceeded", "userRateLimitExceeded"].includes(reason);
  return { ok: false, status: r.status, reason, quotaRelated };
}

async function testKey(key, label) {
  const calls = Array.from({ length: PER_KEY }, () => fireOne(key));
  const results = await Promise.all(calls);
  const ok = results.filter(r => r.ok).length;
  const quota = results.filter(r => !r.ok && r.quotaRelated).length;
  const other = results.filter(r => !r.ok && !r.quotaRelated);
  return { label, ok, quota, other };
}

console.log(`Firing ${PER_KEY} search.list calls in parallel for each of 4 keys (60 total)`);
console.log(`If quotas are PER-PROJECT: expect ~10 successes per key (~40 total)`);
console.log(`If quotas are SHARED:      expect ~10 successes TOTAL across all keys`);
console.log();

const startedAt = Date.now();
const results = await Promise.all(keys.map((k, i) => testKey(k, `key#${i + 1}`)));
const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

let totalOk = 0;
let totalQuota = 0;
for (const r of results) {
  totalOk += r.ok;
  totalQuota += r.quota;
  let line = `  ${r.label}: ok=${r.ok}  quota_rejected=${r.quota}`;
  if (r.other.length) {
    line += `  other_errors=${r.other.length}`;
  }
  console.log(line);
  if (r.other.length) {
    for (const e of r.other.slice(0, 3)) {
      console.log(`     -> ${e.status} ${e.reason}`);
    }
  }
}

console.log();
console.log(`TOTAL: ${totalOk} successful, ${totalQuota} quota-rejected (${elapsedSec}s)`);
console.log();

if (totalOk >= 30) {
  console.log("CONCLUSION: Quotas appear PER-PROJECT.");
  console.log("Spinning up more projects under your Google account does increase real quota.");
} else if (totalOk <= 15) {
  console.log("CONCLUSION: Quotas appear SHARED across projects.");
  console.log("More projects under the same account won't help — would need separate accounts.");
} else {
  console.log("CONCLUSION: Inconclusive (between the two hypotheses).");
  console.log("Re-run after a minute or two, or increase PER_KEY for a sharper signal.");
}
