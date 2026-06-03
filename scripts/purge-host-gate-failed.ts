// Export-then-delete the host_name_low_confidence failures from lead_candidates.
// Safety: writes a full JSON backup and verifies it on disk BEFORE any delete.
// Keeps transient failures (504 / quota / key-suspension) so the tick can retry.
import 'dotenv/config';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_PAT;
const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!apiKey || !baseId) throw new Error('AIRTABLE_PAT / LEAD_BASE_ID not set');

const apply = process.argv.includes('--apply'); // dry-run unless --apply
const base = new Airtable({ apiKey }).base(baseId);

const records = await base(table)
  .select({ filterByFormula: `{outreach_status}='failed'` })
  .all();

const GATE = 'host_name_low_confidence';
const toDelete = records.filter((r) =>
  String(r.get('outreach_error') ?? '').includes(GATE),
);
const toKeep = records.filter(
  (r) => !String(r.get('outreach_error') ?? '').includes(GATE),
);

console.log(`failed total=${records.length}  host-gate(delete)=${toDelete.length}  transient(keep)=${toKeep.length}`);
console.log('\nKEEPING (transient, tick will retry):');
for (const r of toKeep) {
  console.log(`  ${r.id}  ${String(r.get('channel_name'))}  :: ${String(r.get('outreach_error') ?? '').replace(/\s+/g, ' ').slice(0, 90)}`);
}

if (toDelete.length === 0) {
  console.log('\nNothing to delete.');
  process.exit(0);
}

// --- BACKUP (always, even on dry-run) ---
const date = new Date().toISOString().slice(0, 10);
const dir = join('backups');
mkdirSync(dir, { recursive: true });
const backupPath = join(dir, `failed-host-gate-${date}.json`);
const payload = toDelete.map((r) => ({ id: r.id, fields: r.fields }));
writeFileSync(backupPath, JSON.stringify(payload, null, 2) + '\n');

// Verify the backup landed and parses with the expected count.
if (!existsSync(backupPath)) throw new Error(`backup not written: ${backupPath}`);
const verified = JSON.parse(readFileSync(backupPath, 'utf8'));
if (!Array.isArray(verified) || verified.length !== toDelete.length) {
  throw new Error(`backup verify failed: expected ${toDelete.length}, got ${verified?.length}`);
}
console.log(`\n✓ Backup verified: ${verified.length} records → ${backupPath}`);

if (!apply) {
  console.log('\nDRY RUN — re-run with --apply to delete. No records were deleted.');
  process.exit(0);
}

// --- DELETE in batches of 10 (Airtable limit) ---
const ids = toDelete.map((r) => r.id);
let deleted = 0;
for (let i = 0; i < ids.length; i += 10) {
  const batch = ids.slice(i, i + 10);
  await base(table).destroy(batch);
  deleted += batch.length;
  console.log(`  deleted ${deleted}/${ids.length}`);
}
console.log(`\n✓ Deleted ${deleted} host-gate leads. Backup: ${backupPath}`);
