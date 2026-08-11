import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';
async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await base('lead_candidates').select({
    filterByFormula: `{review_status}='approved'`,
    fields: ['outreach_status','niche_category','signal_score','enrichment_bundle_path']
  }).all();
  const TERMINAL = new Set(['sent_to_smartlead','no_email_found','email_invalid']);
  const ready = recs.filter(r => !TERMINAL.has(String(r.get('outreach_status') ?? '')));
  const byNiche: Record<string,number> = {};
  const byStatus: Record<string,number> = {};
  let preEnriched = 0;
  for (const r of ready) {
    const n = String(r.get('niche_category') ?? '(none)');
    const s = String(r.get('outreach_status') ?? '(blank)');
    byNiche[n] = (byNiche[n] ?? 0) + 1;
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    if (r.get('enrichment_bundle_path')) preEnriched++;
  }
  console.log('approved & not-terminal:', ready.length);
  console.log('\nby niche_category:'); for (const k of Object.keys(byNiche).sort((a,b)=>byNiche[b]-byNiche[a])) console.log(`  ${byNiche[k]}\t${k}`);
  console.log('\nby outreach_status:'); for (const k of Object.keys(byStatus).sort((a,b)=>byStatus[b]-byStatus[a])) console.log(`  ${byStatus[k]}\t${k}`);
  console.log('\nalready have enrichment_bundle_path (cheap resume, skip re-enrich):', preEnriched);
}
main().catch(e => { console.error(e); process.exit(1); });
