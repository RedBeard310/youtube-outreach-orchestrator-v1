import 'dotenv/config'; import Airtable from 'pipeline-db/sdk';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  // parked TODAY (created since 17:14 AND now approved_hold)
  const parked=await lb('lead_candidates').select({filterByFormula:`AND(IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z'),{review_status}='approved_hold')`,fields:['niche_category','signal_score']}).all();
  const bn:Record<string,{n:number;sum:number}>={};
  for(const r of parked){const k=String(r.get('niche_category')??'?');bn[k]??={n:0,sum:0};bn[k].n++;bn[k].sum+=Number(r.get('signal_score')??0);}
  console.log(`PARKED today (approved_hold, created since 17:14): ${parked.length}`);
  for(const k of Object.keys(bn).sort((a,b)=>bn[b].n-bn[a].n)) console.log(`  ${String(bn[k].n).padStart(3)}  avg${(bn[k].sum/bn[k].n).toFixed(1)}  ${k}`);
  // all daytime leads by score>=6 niche
  const all=await lb('lead_candidates').select({filterByFormula:`IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z')`,fields:['signal_score','review_status']}).all();
  const s6=all.filter(r=>Number(r.get('signal_score')??0)>=6).length;
  const demo=all.filter(r=>String(r.get('review_status'))==='demo_niche_excluded').length;
  console.log(`\nDAYTIME total leads: ${all.length} | score>=6: ${s6} | demo-excluded: ${demo}`);
  const hold=await lb('lead_candidates').select({filterByFormula:`{review_status}='approved_hold'`,fields:['id']}).all();
  console.log(`TOTAL approved_hold in base: ${hold.length}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
