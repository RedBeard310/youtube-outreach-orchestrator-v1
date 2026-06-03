// Read-only diagnostic: categorize approved leads stuck at outreach_status=failed
// so we can tell transient/recoverable failures (quota, timeouts) apart from
// terminal ones (no email, rejected email, no host). Prints a table + buckets.
import 'dotenv/config';
import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_PAT;
const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!apiKey || !baseId) throw new Error('AIRTABLE_PAT / LEAD_BASE_ID not set');

const base = new Airtable({ apiKey }).base(baseId);

const records = await base(table)
  .select({ filterByFormula: `{outreach_status}='failed'` })
  .all();

interface Row {
  id: string;
  name: string;
  review: string;
  email: string;
  verify: string;
  score: number | null;
  err: string;
}

const rows: Row[] = records.map((r) => ({
  id: r.id,
  name: String(r.get('channel_name') ?? '(no name)'),
  review: String(r.get('review_status') ?? '(null)'),
  email: String(r.get('email_address') ?? ''),
  verify: String(r.get('email_verification_result') ?? ''),
  score: (r.get('signal_score') as number | undefined) ?? null,
  err: String(r.get('outreach_error') ?? '').replace(/\s+/g, ' ').slice(0, 160),
}));

const buckets = {
  no_email: [] as Row[],
  bad_email: [] as Row[],
  has_valid_email: [] as Row[],
};

const VALID = new Set(['valid', 'ok', 'deliverable', 'catch-all', 'catchall', 'accept_all']);

for (const row of rows) {
  if (!row.email) buckets.no_email.push(row);
  else if (row.verify && !VALID.has(row.verify.toLowerCase())) buckets.bad_email.push(row);
  else buckets.has_valid_email.push(row);
}

console.log(`\nTotal at outreach_status=failed: ${rows.length}\n`);

const reviewCounts: Record<string, number> = {};
for (const r of rows) reviewCounts[r.review] = (reviewCounts[r.review] ?? 0) + 1;
console.log('By review_status:', reviewCounts);

console.log(`\n── NO EMAIL (${buckets.no_email.length}) — generic 'failed' (find threw; NOT clean no_email_found)`);
for (const r of buckets.no_email) console.log(`   ${r.id}  score=${r.score}  ${r.name}\n        err: ${r.err || '(none recorded)'}`);

console.log(`\n── BAD/INVALID EMAIL (${buckets.bad_email.length}) — verify rejected`);
for (const r of buckets.bad_email) console.log(`   ${r.id}  verify="${r.verify}"  ${r.email}  ${r.name}\n        err: ${r.err || '(none recorded)'}`);

console.log(`\n── HAS A VALID EMAIL (${buckets.has_valid_email.length}) — failed downstream`);
for (const r of buckets.has_valid_email) console.log(`   ${r.id}  email=${r.email}  ${r.name}\n        err: ${r.err || '(none recorded)'}`);

// Emit IDs of the downstream-failure group so we can grep the orchestrator logs.
console.log('\nDOWNSTREAM_IDS=' + buckets.has_valid_email.map((r) => r.id).join(','));
