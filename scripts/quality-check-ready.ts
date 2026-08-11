import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';

  const formula = `AND({review_status}='approved', {outreach_status}='failed', NOT({enrichment_bundle_path}=''))`;
  const records = await base(table).select({ filterByFormula: formula }).all();

  console.log(`Approved + failed + has bundle: ${records.length}`);

  const lacking: any[] = [];
  let validEmail = 0, riskyEmail = 0, invalidEmail = 0, noEmail = 0;
  let scoreGe6 = 0, hostId = 0, allThree = 0;

  for (const r of records) {
    const score = r.get('signal_score') as number | undefined;
    const host = r.get('host_identification_status') as string | undefined;
    const ev = r.get('email_verification_result') as string | undefined;
    const email = r.get('email_address') as string | undefined;
    if (ev === 'valid') validEmail++;
    else if (ev === 'risky') riskyEmail++;
    else if (ev === 'invalid') invalidEmail++;
    if (!email) noEmail++;
    if (score && score >= 6) scoreGe6++;
    if (host && host !== 'no_host' && host !== 'no_host_identified') hostId++;
    const passes3 = (score ?? 0) >= 6 && host && host !== 'no_host' && host !== 'no_host_identified' && (ev === 'valid' || ev === 'risky');
    if (passes3) allThree++;
    if (!passes3) lacking.push({ id: r.id, name: r.get('channel_name'), score, host, ev, email: !!email });
  }

  console.log(`\nQuality:`);
  console.log(`  signal_score >= 6: ${scoreGe6}`);
  console.log(`  host identified: ${hostId}`);
  console.log(`  email valid: ${validEmail} | risky: ${riskyEmail} | invalid: ${invalidEmail} | none: ${noEmail}`);
  console.log(`  passing all 3: ${allThree}`);

  if (lacking.length > 0) {
    console.log(`\nLacking on at least one criterion (${lacking.length}):`);
    lacking.slice(0, 15).forEach(l => console.log(`  ${l.id} | ${l.name} | score=${l.score} | host=${l.host} | ev=${l.ev} | email=${l.email}`));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
