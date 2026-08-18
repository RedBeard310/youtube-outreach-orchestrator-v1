import 'dotenv/config';
import { countByReviewStatus } from '../src/airtable.ts';
for (const s of ['approved_hold', 'needs_contact', 'unreviewed', 'approved'] as const) {
  console.log(`${s}: ${await countByReviewStatus(s)}`);
}
