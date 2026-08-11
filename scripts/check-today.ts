import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';

  const today = '2026-05-28';
  const formula = `DATETIME_FORMAT({first_discovered_at}, 'YYYY-MM-DD')='${today}'`;
  const records = await base(table).select({ filterByFormula: formula }).all();

  console.log(`Total leads discovered ${today}: ${records.length}`);

  const byReview: Record<string, number> = {};
  const passingAll3: any[] = [];
  const approved: any[] = [];
  let scoreSum = 0, scoreCount = 0;

  for (const r of records) {
    const rs = (r.get('review_status') as string) ?? 'null';
    byReview[rs] = (byReview[rs] ?? 0) + 1;
    const score = r.get('signal_score') as number | undefined;
    const hostStatus = r.get('host_identification_status') as string | undefined;
    const email = r.get('email_verification_result') as string | undefined;
    if (typeof score === 'number') { scoreSum += score; scoreCount++; }
    if (rs === 'approved') approved.push({ id: r.id, name: r.get('channel_name'), score, host: hostStatus, email, outreach: r.get('outreach_status') });
    if (score && score >= 6 && hostStatus && hostStatus !== 'no_host' && (email === 'valid' || email === 'risky')) {
      passingAll3.push({ id: r.id, name: r.get('channel_name'), score, host: hostStatus, email });
    }
  }

  console.log(`\nBy review_status:`);
  Object.entries(byReview).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log(`\nMean signal_score: ${scoreCount ? (scoreSum/scoreCount).toFixed(2) : 'n/a'}`);
  console.log(`Passing all 3 criteria (score>=6, host identified, email valid/risky): ${passingAll3.length}`);

  console.log(`\nApproved today (${approved.length}):`);
  approved.slice(0, 30).forEach(l => console.log(`  ${l.id} | ${l.name} | score=${l.score} | host=${l.host} | email=${l.email} | outreach=${l.outreach ?? 'pending'}`));
  if (approved.length > 30) console.log(`  ... and ${approved.length - 30} more`);
}

main().catch(e => { console.error(e); process.exit(1); });
