// Dump full record(s) for an email in the lead base, incl. createdTime.
import 'dotenv/config';
import PipelineDb from 'pipeline-db/sdk';

const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!baseId) throw new Error('LEAD_BASE_ID not set');

const email = (process.argv[2] ?? '').toLowerCase().trim();
if (!email) throw new Error('pass an email');

const base = new PipelineDb().base(baseId);
const hits: any[] = [];
await base(table)
  .select({ filterByFormula: `LOWER({email_address}) = '${email}'` })
  .eachPage((records, next) => {
    for (const r of records) hits.push({ id: r.id, createdTime: (r as any)._rawJson?.createdTime, fields: r.fields });
    next();
  });

console.log(JSON.stringify(hits, null, 2));
