import 'dotenv/config';
import Airtable from 'airtable';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
  // Approved + failed + bundle exists + email valid OR risky
  const formula = `AND({review_status}='approved', {outreach_status}='failed', NOT({enrichment_bundle_path}=''), OR({email_verification_result}='valid', {email_verification_result}='risky'))`;
  const records = await base(table).select({ filterByFormula: formula, sort: [{ field: 'signal_score', direction: 'desc' }] }).all();
  console.log(`Total ready (valid|risky + bundle): ${records.length}`);
  records.forEach(r => console.log(`  ${r.id} | ${r.get('channel_name')} | score=${r.get('signal_score')} | ev=${r.get('email_verification_result')} | email=${r.get('email_address')}`));
  console.log('\n--lead-ids arg:');
  console.log(records.map(r => r.id).join(','));
}
main().catch(e => { console.error(e); process.exit(1); });
