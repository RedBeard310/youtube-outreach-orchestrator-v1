import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';
(async()=>{
  const lb = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await lb('lead_candidates').select({
    filterByFormula: `AND(IS_AFTER(CREATED_TIME(), '2026-07-07T00:00:00Z'), {signal_score}>=6)`,
    fields: ['review_status','outreach_status','signal_score']
  }).all();
  const rv:Record<string,number>={}, os:Record<string,number>={};
  for(const r of recs){
    rv[String(r.get('review_status')??'?')]=(rv[String(r.get('review_status')??'?')]??0)+1;
    os[String(r.get('outreach_status')??'(blank)')]=(os[String(r.get('outreach_status')??'(blank)')]??0)+1;
  }
  console.log(`score>=6 leads created since 07-07: ${recs.length}`);
  console.log('\nby review_status:'); for(const k of Object.keys(rv).sort((a,b)=>rv[b]-rv[a])) console.log(`  ${String(rv[k]).padStart(4)}  ${k}`);
  console.log('\nby outreach_status:'); for(const k of Object.keys(os).sort((a,b)=>os[b]-os[a])) console.log(`  ${String(os[k]).padStart(4)}  ${k}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
