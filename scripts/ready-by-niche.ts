import 'dotenv/config';
import Airtable from 'airtable';
async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await base('lead_candidates').select({
    filterByFormula: `{review_status}='approved'`,
    fields: ['outreach_status','niche_category']
  }).all();
  const TERMINAL = new Set(['sent_to_smartlead','no_email_found','email_invalid']);
  const ready = recs.filter(r => !TERMINAL.has(String(r.get('outreach_status') ?? '')));
  const byNiche: Record<string,number> = {};
  for (const r of ready) { const n = String(r.get('niche_category') ?? '(none)'); byNiche[n]=(byNiche[n]??0)+1; }
  console.log('approved & not-terminal (the 19):', ready.length);
  for (const k of Object.keys(byNiche).sort((a,b)=>byNiche[b]-byNiche[a])) console.log(`  ${byNiche[k]}\t${k}`);
}
main().catch(e => { console.error(e); process.exit(1); });
