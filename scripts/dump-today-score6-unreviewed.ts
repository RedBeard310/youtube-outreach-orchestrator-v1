// Dump lead IDs for today's score>=6, still-unreviewed leads (the approved_hold
// candidates) → a file for youtube-email-outreach-v1 --stop-after verify, then
// promote-verified-to-hold.ts. Excludes demo_niche_excluded / below_threshold
// (those aren't review_status=unreviewed). Scoped to the daytime push (>=17:14Z).
import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';
import { writeFileSync } from 'node:fs';
const SINCE = process.argv[2] ?? '2026-07-08T17:14:00Z';
const OUT = process.argv[3] ?? '/tmp/hold-candidates-0708.txt';
(async () => {
  const lb = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await lb('lead_candidates').select({
    filterByFormula: `AND(IS_AFTER(CREATED_TIME(),'${SINCE}'), {review_status}='unreviewed', {signal_score}>=6)`,
    fields: ['signal_score', 'niche_category', 'outreach_status'],
  }).all();
  const ids = recs.map((r) => r.id);
  writeFileSync(OUT, ids.join('\n') + '\n');
  const os: Record<string, number> = {};
  for (const r of recs) os[String(r.get('outreach_status') ?? '(blank)')] = (os[String(r.get('outreach_status') ?? '(blank)')] ?? 0) + 1;
  console.log(`${ids.length} score>=6 unreviewed leads (since ${SINCE}) → ${OUT}`);
  console.log('current outreach_status:', os);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
