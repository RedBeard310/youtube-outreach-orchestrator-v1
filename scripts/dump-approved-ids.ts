import 'dotenv/config';
import Airtable from 'airtable';
import { writeFileSync } from 'fs';
async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('usage: dump-approved-ids.ts <outfile>');
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await base('lead_candidates').select({
    filterByFormula: `{review_status}='approved'`,
    fields: ['outreach_status']
  }).all();
  const TERMINAL = new Set(['sent_to_smartlead','no_email_found','email_invalid']);
  const ids = recs.filter(r => !TERMINAL.has(String(r.get('outreach_status') ?? ''))).map(r => r.id);
  writeFileSync(out, ids.join('\n') + '\n');
  console.log(`wrote ${ids.length} approved-not-terminal lead IDs to ${out}`);
}
main().catch(e => { console.error(e); process.exit(1); });
