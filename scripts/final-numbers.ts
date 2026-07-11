import 'dotenv/config'; import Airtable from 'airtable';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  const hold=await lb('lead_candidates').select({filterByFormula:`{review_status}='approved_hold'`,fields:['signal_score']}).all();
  const newToday=await lb('lead_candidates').select({filterByFormula:`AND(IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z'),{review_status}='approved_hold')`,fields:['signal_score']}).all();
  const dayAll=await lb('lead_candidates').select({filterByFormula:`IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z')`,fields:['signal_score','review_status','outreach_status']}).all();
  const s6=dayAll.filter(r=>Number(r.get('signal_score')??0)>=6).length;
  const demo=dayAll.filter(r=>String(r.get('review_status'))==='demo_niche_excluded').length;
  const stillUnp=dayAll.filter(r=>String(r.get('review_status'))==='unreviewed'&&Number(r.get('signal_score')??0)>=6&&!String(r.get('outreach_status'))).length;
  console.log(`TOTAL approved_hold now: ${hold.length}`);
  console.log(`NEW to approved_hold today (daytime): ${newToday.length}`);
  console.log(`Daytime leads scanned: ${dayAll.length} | score>=6: ${s6} | demo-excluded: ${demo} | still-unprocessed score>=6: ${stillUnp}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
