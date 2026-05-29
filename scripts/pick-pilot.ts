import 'dotenv/config';
import Airtable from 'airtable';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
  // Approved + failed + bundle exists + email valid (skip risky for pilot)
  const formula = `AND({review_status}='approved', {outreach_status}='failed', NOT({enrichment_bundle_path}=''), {email_verification_result}='valid')`;
  const records = await base(table).select({ filterByFormula: formula, sort: [{ field: 'signal_score', direction: 'desc' }] }).all();
  // Take top 5 by signal_score
  const pick = records.slice(0, 5);
  console.log('Pilot picks:');
  pick.forEach(r => console.log(`  ${r.id} | ${r.get('channel_name')} | score=${r.get('signal_score')} | email=${r.get('email_address')} | run=${r.get('enrichment_run_id')}`));
  console.log('\n--lead-ids arg:');
  console.log(pick.map(r => r.id).join(','));
}
main().catch(e => { console.error(e); process.exit(1); });
