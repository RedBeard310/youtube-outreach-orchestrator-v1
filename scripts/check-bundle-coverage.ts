import 'dotenv/config';
import Airtable from 'airtable';
import fs from 'fs';

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
  const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';

  // All approved, non-terminal
  const formula = `AND({review_status}='approved', NOT(OR({outreach_status}='sent_to_smartlead', {outreach_status}='no_email_found', {outreach_status}='email_invalid')))`;
  const records = await base(table).select({ filterByFormula: formula }).all();

  const bundleDir = '/Users/casey/Documents/_Stuff/Claude/youtube-email-outreach-v1/enrichment-bundles';
  const onDisk = new Set(fs.readdirSync(bundleDir).filter(d => d.startsWith('rec')));

  const withBundlePath: any[] = [];
  const withoutBundlePath: any[] = [];
  const onDiskOnly: any[] = [];

  for (const r of records) {
    const bp = r.get('enrichment_bundle_path') as string | undefined;
    const onDiskMatch = onDisk.has(r.id);
    const entry = { id: r.id, name: r.get('channel_name'), bp: !!bp, onDisk: onDiskMatch, status: r.get('outreach_status'), runId: r.get('enrichment_run_id') };
    if (bp) withBundlePath.push(entry);
    else withoutBundlePath.push(entry);
    if (onDiskMatch && !bp) onDiskOnly.push(entry);
  }

  console.log(`Approved + non-terminal: ${records.length}`);
  console.log(`  with enrichment_bundle_path field set: ${withBundlePath.length}`);
  console.log(`  without bundle path field: ${withoutBundlePath.length}`);
  console.log(`  bundle exists on disk but field not set: ${onDiskOnly.length}`);

  console.log(`\nFirst 20 with bundle path:`);
  withBundlePath.slice(0, 20).forEach(e => console.log(`  ${e.id} | ${e.name} | status=${e.status} | run=${e.runId}`));

  console.log(`\nFirst 10 on-disk-only (backfill candidates without bundle path field):`);
  onDiskOnly.slice(0, 10).forEach(e => console.log(`  ${e.id} | ${e.name} | status=${e.status}`));

  console.log(`\nTotal bundle dirs on disk (excluding _archived-runs): ${onDisk.size}`);
}
main().catch(e => { console.error(e); process.exit(1); });
