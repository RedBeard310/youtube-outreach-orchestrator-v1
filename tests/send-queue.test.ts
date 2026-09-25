// Regression tests for the 2026-09-24 stranding: the 07:20 send composed 18
// emails, lost 9 to `fetch failed` on the SmartLead push, wrote them `failed`,
// and no selector in this repo would ever look at them again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireResumeStage, isApprovedFireReady, type Lead } from '../src/airtable.ts';
import { parseFinalTally, tallyCount } from '../src/drivers/approved.ts';

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: 'recTest',
    review_status: 'approved',
    outreach_status: 'ready_data_scraped',
    email_address: 'a@b.com',
    email_verification_result: 'valid',
    channel_id: null,
    channel_url: null,
    channel_name: 'Test Channel',
    niche_category: null,
    signal_score: 7,
    first_discovered_at: null,
    discovered_via: null,
    do_not_contact: false,
    dnc_reason: null,
    email_subject: null,
    email_body: null,
    enrichment_bundle_path: null,
    ...over,
  };
}

test('fireResumeStage: a parked lead resumes at compose', () => {
  assert.equal(fireResumeStage(lead({ outreach_status: 'ready_data_scraped' })), 'compose');
  assert.equal(fireResumeStage(lead({ outreach_status: 'enriched' })), 'compose');
});

test('fireResumeStage: a drafted lead resumes at push', () => {
  assert.equal(fireResumeStage(lead({ outreach_status: 'email_drafted' })), 'push');
});

test('fireResumeStage: a lead that died on the push keeps its written email and resumes at push', () => {
  // This is the exact shape of all ten leads stranded on 2026-09-24: status
  // `failed`, subject and body written, bundle on disk, no smartlead_lead_id.
  const stranded = lead({
    outreach_status: 'failed',
    email_subject: 'about your videos',
    email_body: 'Hey Kamal,\n\nI watched...',
    enrichment_bundle_path: '/enrichment-bundles/recUFUJklPLCRy9Pr',
  });
  assert.equal(fireResumeStage(stranded), 'push');
  assert.equal(isApprovedFireReady(stranded), true);
});

test('fireResumeStage: a lead that died after enrichment but before compose resumes at compose', () => {
  const s = lead({
    outreach_status: 'failed',
    enrichment_bundle_path: '/enrichment-bundles/recX',
  });
  assert.equal(fireResumeStage(s), 'compose');
});

test('fireResumeStage: a lead that failed before any work is NOT the send queue’s problem', () => {
  // No draft and no bundle means it never reached prep's end. Firing it would
  // turn a send into a find/verify/enrich run, which is the coupling that was
  // deliberately removed on 2026-07-17.
  const early = lead({ outreach_status: 'failed' });
  assert.equal(fireResumeStage(early), null);
  assert.equal(isApprovedFireReady(early), false);
});

test('fireResumeStage: an empty-string draft does not count as written', () => {
  const blank = lead({ outreach_status: 'failed', email_subject: '   ', email_body: '' });
  assert.equal(fireResumeStage(blank), null);
});

test('fireResumeStage: already-sent and mid-prep leads stay out of the send queue', () => {
  for (const status of ['sent_to_smartlead', 'email_verified', 'no_email_found', 'ready_no_data'] as const) {
    assert.equal(fireResumeStage(lead({ outreach_status: status })), null, status);
  }
  assert.equal(fireResumeStage(lead({ outreach_status: null })), null);
});

test('isApprovedFireReady: do-not-contact and non-approved leads are refused whatever their fields say', () => {
  const draftedButBlocked = lead({
    outreach_status: 'failed',
    email_subject: 's',
    email_body: 'b',
    do_not_contact: true,
  });
  assert.equal(isApprovedFireReady(draftedButBlocked), false);
  assert.equal(
    isApprovedFireReady(lead({ review_status: 'approved_hold', outreach_status: 'ready_data_scraped' })),
    false,
  );
});

test('parseFinalTally: reads the real 2026-09-24 summary', () => {
  const output = [
    '[07:28:29] 18 of 18 leads settled in 476.5s',
    '',
    '=== Final tally ===',
    '  sent_to_smartlead: 8',
    '  failed: 10',
    '',
    'Total wall time: 476.5s',
  ].join('\n');
  assert.deepEqual(parseFinalTally(output), { sent_to_smartlead: 8, failed: 10 });
});

test('parseFinalTally: stops at the end of the indented block', () => {
  const output = '=== Final tally ===\n  sent_to_smartlead: 3\nTotal wall time: 9s\n  not: 5\n';
  assert.deepEqual(parseFinalTally(output), { sent_to_smartlead: 3 });
});

test('parseFinalTally: a run with no tally reports nothing rather than zero', () => {
  // null, not {} — "the child never printed a summary" and "the child sent zero"
  // are different facts and the JSONL line has to be able to tell them apart.
  assert.equal(parseFinalTally('crashed before the summary'), null);
  assert.equal(parseFinalTally('=== Final tally ===\n'), null);
});

// tallyCount (2026-09-25): a parsed tally is a complete statement, so a status it
// does not mention happened zero times. Only a MISSING tally is unknown. Today's
// clean 10-of-10 send printed `failed=?` and logged `send_failed: null`, which is
// what an unmeasured send also looks like.
test('tallyCount: a status absent from a parsed tally is zero, not unknown', () => {
  assert.equal(tallyCount({ sent_to_smartlead: 10 }, 'failed'), 0);
  assert.equal(tallyCount({ sent_to_smartlead: 10 }, 'sent_to_smartlead'), 10);
});

test('tallyCount: no tally at all stays unknown', () => {
  assert.equal(tallyCount(null, 'failed'), null);
  assert.equal(tallyCount(undefined, 'sent_to_smartlead'), null);
});

test('tallyCount: the 09-24 stranding reads as 8 sent and 10 failed', () => {
  const tally = parseFinalTally('=== Final tally ===\n  sent_to_smartlead: 8\n  failed: 10\n');
  assert.equal(tallyCount(tally, 'sent_to_smartlead'), 8);
  assert.equal(tallyCount(tally, 'failed'), 10);
});

test('tallyCount: a tally of only failures reports 0 sent, which must trip the warning', () => {
  const tally = parseFinalTally('=== Final tally ===\n  failed: 18\n');
  const sent = tallyCount(tally, 'sent_to_smartlead');
  const failed = tallyCount(tally, 'failed');
  assert.equal(sent, 0);
  assert.equal(failed, 18);
  // run-send.ts warns on `failed && sent !== null && failed > sent`. Under the old
  // null-for-absent reading sent was null here, so the worst possible send — every
  // lead lost — was the one case that printed no warning.
  assert.ok(failed && sent !== null && failed > sent);
});
