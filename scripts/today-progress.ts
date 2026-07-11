import 'dotenv/config'; import Airtable from 'airtable';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function run(){
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  const recs=await lb('lead_candidates').select({filterByFormula:`IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z')`,fields:['niche_category','signal_score','review_status']}).all();
  const s6=recs.filter(r=>Number(r.get('signal_score')??0)>=6);
  const demo=recs.filter(r=>String(r.get('review_status'))==='demo_niche_excluded');
  console.log(`Today (07-08): ${recs.length} leads | score>=6: ${s6.length} (${(s6.length/recs.length*100).toFixed(0)}%) | demo-excluded: ${demo.length}`);
  const bn:Record<string,number>={}; for(const r of s6){const n=String(r.get('niche_category')??'?');bn[n]=(bn[n]??0)+1;}
  console.log('score>=6 by niche:'); for(const k of Object.keys(bn).sort((a,b)=>bn[b]-bn[a])) console.log(`  ${String(bn[k]).padStart(3)}  ${k}`);
}
(async()=>{ for(let i=1;i<=6;i++){ try{ await run(); return; }catch(e:any){ console.error(`attempt ${i} failed: ${e.message||e}`); await sleep(5000*i);} } process.exit(1); })();
