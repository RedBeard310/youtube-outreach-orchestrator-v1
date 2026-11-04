import { query } from 'pipeline-db';
async function main() {
  const r = await query(`select date_trunc('hour', sent_at) h, count(*) n from leads.outreach_sends
    where sent_at >= '2026-11-03T08:00:00Z' and sent_at < '2026-11-04T08:00:00Z' group by 1 order by 1`);
  console.log(JSON.stringify(r));
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
