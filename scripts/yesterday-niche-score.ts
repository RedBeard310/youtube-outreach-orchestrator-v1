import 'dotenv/config';
import Airtable from 'airtable';
(async()=>{
  const lb = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const recs = await lb('lead_candidates').select({
    filterByFormula: `IS_AFTER(CREATED_TIME(), '2026-07-07T00:00:00Z')`,
    fields: ['niche_category','signal_score','review_status','outreach_status']
  }).all();
  const byN: Record<string,{tot:number;s6:number;sum:number;hold:number}> = {};
  for (const r of recs) {
    const n=String(r.get('niche_category')??'(none)'); const s=Number(r.get('signal_score')??0);
    byN[n]??={tot:0,s6:0,sum:0,hold:0}; byN[n].tot++; byN[n].sum+=s;
    if(s>=6) byN[n].s6++;
    if(String(r.get('review_status'))==='approved_hold') byN[n].hold++;
  }
  console.log(`\n===== LEADS created since 2026-07-07 (${recs.length}) =====`);
  console.log(`total  score>=6  hit%  avg   hold   niche`);
  for (const n of Object.keys(byN).sort((a,b)=>byN[b].s6-byN[a].s6)) {
    const b=byN[n]; const hit=b.tot?b.s6/b.tot*100:0;
    console.log(`${String(b.tot).padStart(5)}  ${String(b.s6).padStart(7)}  ${hit.toFixed(0).padStart(3)}%  ${(b.sum/b.tot).toFixed(1).padStart(4)}  ${String(b.hold).padStart(4)}   ${n}`);
  }
  const tot=recs.length, s6=recs.filter(r=>Number(r.get('signal_score')??0)>=6).length;
  const hold=recs.filter(r=>String(r.get('review_status'))==='approved_hold').length;
  console.log(`\nTOTALS: ${tot} leads, ${s6} score>=6 (${(s6/tot*100).toFixed(0)}%), ${hold} approved_hold`);
  // current global approved_hold count (not just yesterday)
  const allHold = await lb('lead_candidates').select({ filterByFormula:`{review_status}='approved_hold'`, fields:['niche_category'] }).all();
  const hb:Record<string,number>={}; for(const r of allHold){const n=String(r.get('niche_category')??'(none)');hb[n]=(hb[n]??0)+1;}
  console.log(`\n===== ALL approved_hold right now (${allHold.length}) by niche =====`);
  for(const n of Object.keys(hb).sort((a,b)=>hb[b]-hb[a])) console.log(`${String(hb[n]).padStart(4)}  ${n}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
