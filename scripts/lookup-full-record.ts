// Dump full record(s) for an email in the lead base, incl. createdTime.
import 'dotenv/config';
import Airtable from 'airtable';

const apiKey = process.env.AIRTABLE_PAT;
const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!apiKey || !baseId) throw new Error('AIRTABLE_PAT / LEAD_BASE_ID not set');

const email = (process.argv[2] ?? '').toLowerCase().trim();
if (!email) throw new Error('pass an email');

const base = new Airtable({ apiKey }).base(baseId);
const hits: any[] = [];
await base(table)
  .select({ filterByFormula: `LOWER({email_address}) = '${email}'` })
  .eachPage((records, next) => {
    for (const r of records) hits.push({ id: r.id, createdTime: (r as any)._rawJson?.createdTime, fields: r.fields });
    next();
  });

console.log(JSON.stringify(hits, null, 2));
