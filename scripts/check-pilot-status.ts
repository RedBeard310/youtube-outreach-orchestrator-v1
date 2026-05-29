import 'dotenv/config';
import Airtable from 'airtable';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
  const ids = ['rec4rjsDm25Wp7chW','recYJUlvdC7L9ARu1','recNM2TtOh1u9d676','recNICmiH4MArFkCA','recc6dnXubiiNdix3'];
  for (const id of ids) {
    try {
      const r = await base(table).find(id);
      console.log(`${id} | ${r.get('channel_name')}`);
      console.log(`  outreach_status=${r.get('outreach_status')}`);
      console.log(`  outreach_processed_at=${r.get('outreach_processed_at')}`);
      console.log(`  last_contacted_at=${r.get('last_contacted_at')}`);
      console.log(`  email_drafted_variant=${r.get('email_drafted_variant') ?? r.get('campaign_variant') ?? 'n/a'}`);
    } catch(e:any) { console.log(`${id} | ERROR: ${e.message}`); }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
