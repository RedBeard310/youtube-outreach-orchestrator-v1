// Dump all currently-verifiable pitchable leads (score>=6, unreviewed, no resolved
// email yet) to a file — the recoverable pool for the campaign's verify step.
//   npx tsx scripts/dump-pitchable.ts <out.txt> [--limit N]
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { getVerifiablePitchableLeads } from '../src/airtable.ts';

const out = process.argv.find(a => a.endsWith('.txt')) ?? 'logs/pitchable.txt';
const li = process.argv.indexOf('--limit');
const limit = li >= 0 ? Number(process.argv[li + 1]) : Infinity;

const leads = await getVerifiablePitchableLeads();
const ids = leads.map(l => l.id).slice(0, limit);
writeFileSync(out, ids.join('\n') + '\n');
console.log(`pitchable waiting: ${leads.length} | wrote ${ids.length} → ${out}`);
