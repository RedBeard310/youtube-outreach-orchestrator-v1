import 'dotenv/config'; import Airtable from 'pipeline-db/sdk';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  // Whole-base counts by outreach_status (proves nothing was tossed)
  const os:Record<string,number>={};
  await lb('lead_candidates').select({fields:['outreach_status']}).eachPage((recs,next)=>{
    for(const r of recs){const k=String(r.get('outreach_status')??'(blank)');os[k]=(os[k]??0)+1;} next();
  });
  console.log('=== ENTIRE lead_candidates base, by outreach_status ===');
  let total=0; for(const k of Object.keys(os).sort((a,b)=>os[b]-os[a])){console.log(`  ${String(os[k]).padStart(5)}  ${k}`);total+=os[k];}
  console.log(`  ${String(total).padStart(5)}  TOTAL rows`);
  // The recoverable email-failed pool that scored >=6 (worth chasing)
  const noEmail=await lb('lead_candidates').select({filterByFormula:`AND({outreach_status}='no_email_found',{signal_score}>=6)`,fields:['signal_score']}).all();
  const invalid=await lb('lead_candidates').select({filterByFormula:`AND({outreach_status}='email_invalid',{signal_score}>=6)`,fields:['signal_score']}).all();
  console.log(`\n=== RECOVERABLE, score>=6 (already in the base, no re-finding needed) ===`);
  console.log(`  no_email_found & >=6 : ${noEmail.length}`);
  console.log(`  email_invalid  & >=6 : ${invalid.length}`);
  console.log(`  TOTAL chase-worthy    : ${noEmail.length+invalid.length}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
