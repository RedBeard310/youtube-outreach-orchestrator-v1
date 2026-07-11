import 'dotenv/config';
import Airtable from 'airtable';
async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await base('lead_candidates').select({
    filterByFormula: `AND({review_status}='unreviewed', {signal_score}>=6)`,
    fields: ['niche_category','signal_score']
  }).all();
  const byNiche: Record<string,number> = {};
  for (const r of recs) {
    const n = String(r.get('niche_category') ?? '(none)');
    byNiche[n] = (byNiche[n] ?? 0) + 1;
  }
  console.log('unreviewed AND score>=6:', recs.length);
  console.log('\nby niche_category:');
  for (const k of Object.keys(byNiche).sort((a,b)=>byNiche[b]-byNiche[a])) console.log(`  ${byNiche[k]}\t${k}`);
}
main().catch(e => { console.error(e); process.exit(1); });
