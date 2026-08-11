// Look up one or more emails in the lead base and print channel_url/_name.
// Usage: npx tsx scripts/airtable-email-lookup.ts email1 [email2 ...]
import 'dotenv/config';
import Airtable from 'pipeline-db/sdk';

const apiKey = process.env.AIRTABLE_PAT;
const baseId = process.env.LEAD_BASE_ID;
const table = process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
if (!apiKey || !baseId) throw new Error('AIRTABLE_PAT / LEAD_BASE_ID not set');

const emails = process.argv.slice(2).map((e) => e.toLowerCase().trim()).filter(Boolean);
if (emails.length === 0) throw new Error('pass at least one email');

const base = new Airtable({ apiKey }).base(baseId);

// One pass over the base, building a lowercase-email -> records map.
const map = new Map<string, Array<{ url: string; name: string; review: string; outreach: string }>>();
await base(table)
  .select({ fields: ['email_address', 'channel_url', 'channel_name', 'review_status', 'outreach_status'] })
  .eachPage((records, next) => {
    for (const r of records) {
      const e = String(r.get('email_address') ?? '').toLowerCase().trim();
      if (!e) continue;
      const arr = map.get(e) ?? [];
      arr.push({
        url: String(r.get('channel_url') ?? ''),
        name: String(r.get('channel_name') ?? ''),
        review: String(r.get('review_status') ?? ''),
        outreach: String(r.get('outreach_status') ?? ''),
      });
      map.set(e, arr);
    }
    next();
  });

console.log(`Scanned base; ${map.size} distinct emails on file.\n`);
for (const e of emails) {
  const hits = map.get(e);
  if (!hits) { console.log(`✗ ${e} → NOT FOUND`); continue; }
  console.log(`✓ ${e} → ${hits.length} match(es)`);
  for (const h of hits) console.log(`    url=${h.url || '(none)'}  name="${h.name}"  review=${h.review} outreach=${h.outreach}`);
}