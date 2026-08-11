import 'dotenv/config'; import Airtable from 'pipeline-db/sdk'; import { writeFileSync } from 'node:fs';
const OUT=process.argv[2]??'/tmp/hold-candidates-0708-b.txt';
(async()=>{
  const lb=new Airtable({apiKey:process.env.AIRTABLE_PAT!}).base(process.env.LEAD_BASE_ID!);
  const recs=await lb('lead_candidates').select({filterByFormula:`AND(IS_AFTER(CREATED_TIME(),'2026-07-08T17:14:00Z'),{review_status}='unreviewed',{signal_score}>=6,{outreach_status}='')`,fields:['signal_score']}).all();
  writeFileSync(OUT,recs.map(r=>r.id).join('\n')+'\n');
  console.log(`${recs.length} unprocessed score>=6 → ${OUT}`);
})().catch(e=>{console.error(e.message||e);process.exit(1);});
