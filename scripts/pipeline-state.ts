import 'dotenv/config';
import Airtable from 'airtable';
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT! }).base(process.env.LEAD_BASE_ID!);
const recs = await base('lead_candidates').select({
  fields: ['review_status','outreach_status','signal_score'] }).all();
const byReview: Record<string, number> = {};
let unreviewedStrong = 0;      // approvable supply: unreviewed + score>=6
let approvedReady = 0;          // ready for a tick: approved + not terminal
const APPROVED_TERMINAL = new Set(['sent_to_smartlead','no_email_found','email_invalid']);
for (const r of recs) {
  const rv = String(r.get('review_status') ?? '(none)');
  byReview[rv] = (byReview[rv] ?? 0) + 1;
  const score = Number(r.get('signal_score') ?? -99);
  const os = String(r.get('outreach_status') ?? '');
  if (rv === 'unreviewed' && score >= 6) unreviewedStrong++;
  if (rv === 'approved' && !APPROVED_TERMINAL.has(os)) approvedReady++;
}
console.log('Total leads:', recs.length);
console.log('By review_status:', byReview);
console.log('\n>> approvable supply (unreviewed AND score>=6):', unreviewedStrong);
console.log('>> approved & NOT terminal (a tick would process now):', approvedReady);
