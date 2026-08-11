import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';

  // Pull every approved + non-terminal lead
  const formula = `AND({review_status}='approved', NOT(OR({outreach_status}='sent_to_smartlead', {outreach_status}='no_email_found', {outreach_status}='email_invalid')))`;
  const records = await base(table).select({ filterByFormula: formula }).all();

  const byStatus: Record<string, number> = {};
  const readyForCompose: any[] = []; // enriched
  const readyForSend: any[] = []; // email_drafted
  const enrichedHasBundle: any[] = [];

  for (const r of records) {
    const s = (r.get('outreach_status') as string) ?? 'null';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    const bundle = r.get('enrichment_bundle_path') as string | undefined;
    if (s === 'enriched') {
      readyForCompose.push({ id: r.id, name: r.get('channel_name'), bundle: !!bundle, runId: r.get('enrichment_run_id') });
      if (bundle) enrichedHasBundle.push(r);
    }
    if (s === 'email_drafted') {
      readyForSend.push({ id: r.id, name: r.get('channel_name') });
    }
  }

  console.log(`Approved + non-terminal: ${records.length}`);
  console.log(`\nBy outreach_status:`);
  Object.entries(byStatus).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log(`\nReady for compose (enriched, ${readyForCompose.length}):`);
  console.log(`  - with bundle path: ${enrichedHasBundle.length}`);
  console.log(`  - without bundle path: ${readyForCompose.length - enrichedHasBundle.length}`);
  readyForCompose.slice(0, 15).forEach(l => console.log(`  ${l.id} | ${l.name} | bundle=${l.bundle} | run=${l.runId ?? 'none'}`));
  if (readyForCompose.length > 15) console.log(`  ... +${readyForCompose.length - 15} more`);

  console.log(`\nReady for send (email_drafted, ${readyForSend.length}):`);
  readyForSend.slice(0, 10).forEach(l => console.log(`  ${l.id} | ${l.name}`));
  if (readyForSend.length > 10) console.log(`  ... +${readyForSend.length - 10} more`);
}
main().catch(e => { console.error(e); process.exit(1); });
