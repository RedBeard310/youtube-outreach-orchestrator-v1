import 'dotenv/config'; import Airtable from 'pipeline-db/sdk';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  const nc=await lb('lead_candidates').select({filterByFormula:`{review_status}='needs_contact'`,fields:['outreach_status']}).all();
  const os:Record<string,number>={}; for(const r of nc){const k=String(r.get('outreach_status')??'?');os[k]=(os[k]??0)+1;}
  console.log(`review_status='needs_contact': ${nc.length}`, os);
  const stuck=await lb('lead_candidates').select({filterByFormula:`AND({review_status}='approved',OR({outreach_status}='no_email_found',{outreach_status}='email_invalid'))`,fields:['id']}).all().catch(()=>[]);
  console.log(`still-stuck approved+email-failed (should be ~0): ${stuck.length}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
