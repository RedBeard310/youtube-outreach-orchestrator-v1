import { query } from 'pipeline-db';
async function main() {
  const ids = ['reckl59GwKZc3zk4I','recGlwYlWTpP1HeDX','recfZgvMI3UFEO2GH','recWmP6gDPOLzHK1K','rectQuC1Y8R24T1w7','recPSkSNP2HeR6CCV'];
  const r = await query(`select lead_id, min(sent_at) as first_sent, count(*) n from leads.outreach_sends where lead_id = any($1) group by lead_id order by 2`, [ids]);
  console.log('SEND ROWS:', JSON.stringify(r));
  const p = await query(`select id, outreach_status, outreach_processed_at from leads.lead_candidates where id = any($1)`, [ids]);
  console.log('LEADS:', JSON.stringify(p));
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
