import 'dotenv/config';
import Airtable from 'airtable';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
  const ids = ['recYJUlvdC7L9ARu1','recbZOvkglb831pYw','recSmB4vUqzjYluJM','recSipAGg29M9TA26','recXb1AuYELmbnsM1','recQrgrpeR559OaKK','recbBjIgE5Sww1bYL','recU1xR915IM758Ax','recQfKxjIBAKpSCkE','recUhScToPjhdB4iT','recJ4hY6EZKlpNo6F','recWprnnnSrZvDBUI','recbYE1GJ8vCyJWem','recZNs4wBiNB4JaNi','recQJpn7JjS7Br0JH','recYGRbHFVMyf5dsz','recC1z9Mb5fMSZRHR','recNKzErTOODP0Rrn','recIN5MIc8AWapbKm','recbVkoSICF78Cjrd','recLYiGHs7MffKYY6','recQoeMl0FTQ13DxM','recQ4dLDThv9m11aq','recLaXQ1Jj36OWcme'];
  let sent=0, gated=0, mismatches=0, missing=0;
  const mismatched: any[] = [];
  for (const id of ids) {
    const r = await base(table).find(id);
    const status = r.get('outreach_status');
    const proc = r.get('outreach_processed_at') as string|undefined;
    const last = r.get('last_contacted_at') as string|undefined;
    if (status === 'sent_to_smartlead') {
      sent++;
      if (!last) { missing++; mismatched.push({ id, name: r.get('channel_name'), proc, last, why: 'last_contacted_at empty' }); }
      else if (proc && Math.abs(new Date(proc).getTime() - new Date(last).getTime()) > 5000) {
        mismatches++; mismatched.push({ id, name: r.get('channel_name'), proc, last, why: 'drift > 5s' });
      }
    } else {
      gated++;
    }
  }
  console.log(`Verification of 24-lead batch:`);
  console.log(`  sent_to_smartlead: ${sent}`);
  console.log(`  gated/other: ${gated}`);
  console.log(`  last_contacted_at MISSING on sent leads: ${missing}`);
  console.log(`  last_contacted_at DRIFT > 5s on sent leads: ${mismatches}`);
  if (mismatched.length) {
    console.log(`\nProblematic rows:`);
    mismatched.forEach(m => console.log(`  ${m.id} | ${m.name} | proc=${m.proc} | last=${m.last} | ${m.why}`));
  } else {
    console.log(`\n✓ All ${sent} sent leads have last_contacted_at matching outreach_processed_at within 5s.`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
