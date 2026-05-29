import 'dotenv/config';
import Airtable from 'airtable';
async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
  const records = await base(table).select({ sort: [{ field: 'first_discovered_at', direction: 'desc' }], maxRecords: 5, fields: ['channel_name', 'first_discovered_at', 'review_status', 'signal_score'] }).all();
  for (const r of records) {
    console.log(`  ${r.get('first_discovered_at')} | ${r.get('channel_name')} | review=${r.get('review_status')} | score=${r.get('signal_score')}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
