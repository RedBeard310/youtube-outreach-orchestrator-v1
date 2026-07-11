import 'dotenv/config'; import Airtable from 'airtable';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  const unp=await lb('lead_candidates').select({filterByFormula:`AND(IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z'),{review_status}='unreviewed',{signal_score}>=6,{outreach_status}='')`,fields:['signal_score']}).all();
  const hold=await lb('lead_candidates').select({filterByFormula:`{review_status}='approved_hold'`,fields:['signal_score']}).all();
  console.log(`unprocessed score>=6 unreviewed (blank): ${unp.length}`);
  console.log(`TOTAL approved_hold in base now: ${hold.length}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
