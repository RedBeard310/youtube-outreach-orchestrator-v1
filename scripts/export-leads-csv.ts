// Export selected lead_candidates fields to CSV.
// Usage: npx tsx scripts/export-leads-csv.ts [outfile.csv]
import 'dotenv/config';
import Airtable from 'airtable';
import { writeFileSync } from 'node:fs';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';

// [CSV header, Airtable field name]
const COLS: [string, string][] = [
  ['hostname', 'host_first_name'],
  ['email_address', 'email_address'],
  ['channel_id', 'channel_id'],
  ['channel_url', 'channel_url'],
  ['channel_name', 'channel_name'],
  ['summary_note', 'summary_note'],
  ['subscriber_count', 'subscriber_count'],
  ['about_description', 'about_description'],
  ['niche_category', 'niche_category'],
  ['signal_score', 'signal_score'],
  ['review_status', 'review_status'],
  ['reply_received', 'reply_received'],
  ['email_confidence', 'email_confidence'],
  ['email_verification_result', 'email_verification_result'],
  ['email_bounced', 'email_bounced'],
];

const recs = await base(table).select({ fields: COLS.map((c) => c[1]) }).all();

const esc = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  s = s.replace(/[\x00-\x1F\x7F]+/g, ' ').trim(); // flatten newlines + strip NULs/control chars
  if (/[",]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
};

const lines: string[] = [];
lines.push(COLS.map((c) => c[0]).join(','));
for (const r of recs) lines.push(COLS.map((c) => esc(r.get(c[1]))).join(','));

const out = process.argv[2] ?? 'lead-candidates-export.csv';
writeFileSync(out, lines.join('\n') + '\n');
console.log(`Wrote ${recs.length} rows -> ${out}`);
