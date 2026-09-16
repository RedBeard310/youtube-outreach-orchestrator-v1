// READ-ONLY: count sent_to_smartlead leads and print a couple of sample emails
// so we can see how the proposed video title sits inside the body.
import 'dotenv/config';
import PipelineDb from 'pipeline-db/sdk';

const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!baseId) throw new Error('LEAD_BASE_ID not set');
const base = new PipelineDb().base(baseId);

const recs = await base(table)
  .select({ filterByFormula: `{outreach_status}='sent_to_smartlead'`,
            fields: ['channel_name', 'email_subject', 'email_body', 'outreach_processed_at'] })
  .all();

console.log(`sent_to_smartlead leads in Postgres: ${recs.length}\n`);

// show 2 samples
for (const r of recs.slice(0, 2)) {
  console.log('========================================');
  console.log('channel:', r.get('channel_name'));
  console.log('processed_at:', r.get('outreach_processed_at'));
  console.log('--- SUBJECT ---');
  console.log(r.get('email_subject'));
  console.log('--- BODY ---');
  console.log(r.get('email_body'));
  console.log('');
}