import 'dotenv/config';
import Airtable from 'airtable';
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
const recs = await base(table).select({
  filterByFormula: `{outreach_status}='sent_to_smartlead'`,
  fields: ['channel_name','outreach_processed_at']
}).all();
const byDay: Record<string, number> = {};
for (const r of recs) {
  const d = String(r.get('outreach_processed_at') ?? '').slice(0,10) || '(none)';
  byDay[d] = (byDay[d] ?? 0) + 1;
}
console.log(`Total sent_to_smartlead: ${recs.length}`);
console.log('Loaded-by-day (outreach_processed_at):');
for (const d of Object.keys(byDay).sort()) console.log(`  ${d}: ${byDay[d]}`);
