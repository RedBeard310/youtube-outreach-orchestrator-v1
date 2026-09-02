import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDue,
  laneOptsFromEnv,
  runRecoveryDuringOpenRouterHalt,
  staleCollectAfterMs,
  VERIFIABLE_IDS_SQL,
  COLLECT_IDS_SQL,
  type LaneState,
} from '../src/recovery/bloodhound-lane.ts';

// The recovery lane runs inside the campaign's fade pivot, which fires many
// times a day. The cadence gate is what keeps it from re-spawning Bloodhound
// on every pass: collect and verify each fire at most once per interval.

const H = 3600_000;
const NOW = Date.parse('2026-08-23T21:00:00Z');

test('isDue: empty state is due (never ran)', () => {
  assert.equal(isDue({}, 'lastCollectAt', NOW, 6), true);
  assert.equal(isDue({}, 'lastVerifyAt', NOW, 3), true);
});

test('isDue: fresh timestamp inside the interval is not due', () => {
  const state: LaneState = { lastCollectAt: '2026-08-23T18:00:00Z' };
  assert.equal(isDue(state, 'lastCollectAt', NOW, 6), false);
});

test('isDue: timestamp at exactly the interval boundary is due', () => {
  const state: LaneState = { lastCollectAt: '2026-08-23T15:00:00Z' };
  assert.equal(isDue(state, 'lastCollectAt', NOW, 6), true);
});

test('isDue: timestamp past the interval is due', () => {
  const state: LaneState = { lastVerifyAt: '2026-08-23T10:00:00Z' };
  assert.equal(isDue(state, 'lastVerifyAt', NOW, 3), true);
});

test('isDue: unparseable timestamp fails open (due), never stalls the lane', () => {
  const state: LaneState = { lastCollectAt: 'garbage' };
  assert.equal(isDue(state, 'lastCollectAt', NOW, 6), true);
});

test('isDue: keys are independent (verify due does not imply collect due)', () => {
  const state: LaneState = {
    lastCollectAt: '2026-08-23T20:00:00Z',
    lastVerifyAt: '2026-08-23T09:00:00Z',
  };
  assert.equal(isDue(state, 'lastCollectAt', NOW, 6), false);
  assert.equal(isDue(state, 'lastVerifyAt', NOW, 3), true);
});

test('laneOptsFromEnv: malformed env numbers fall back to defaults, never NaN', () => {
  const saved = { ...process.env };
  try {
    process.env.BLOODHOUND_COLLECT_INTERVAL_HOURS = 'garbage';
    process.env.BLOODHOUND_VERIFY_INTERVAL_HOURS = '';
    process.env.BLOODHOUND_COLLECT_BATCH = 'NaN';
    process.env.BLOODHOUND_VERIFY_BATCH = '-5';
    const opts = laneOptsFromEnv('/tmp/repo', true, () => {});
    assert.equal(Number.isNaN(opts.collectIntervalHours), false);
    assert.equal(Number.isNaN(opts.verifyIntervalHours), false);
    assert.equal(opts.collectIntervalHours, 6);
    assert.equal(opts.verifyIntervalHours, 3);
    assert.equal(opts.collectBatch, 150);
    // Negative batches must fall back too; a negative LIMIT errors in Postgres.
    assert.equal(opts.verifyBatch, 200);
  } finally {
    process.env = saved;
  }
});

// 2026-08-24: the lane's first night re-selected 84 of the same 91 leads three
// hours apart and spent 34 ZeroBounce credits to flip nothing, because
// `verified = false` is the resting state of a CHECKED-AND-DEAD address, not
// just an unchecked one. Both exclusions below are load-bearing on money.
test('verify selector excludes contact points already ruled on', () => {
  // ZeroBounce returned a verdict.
  assert.match(VERIFIABLE_IDS_SQL, /cp\.verified_at IS NULL/);
  // The identity gate rejected the address before any credit was spent. This
  // one also covers rows written before verify.ts began stamping verified_at,
  // so the fix needs no backfill.
  assert.match(VERIFIABLE_IDS_SQL, /notes[^)]*\)\s*NOT LIKE '%\[ownership:%'/);
  // And the original guard is still there.
  assert.match(VERIFIABLE_IDS_SQL, /COALESCE\(cp\.verified, false\) = false/);
  assert.match(VERIFIABLE_IDS_SQL, /COALESCE\(lc\.do_not_contact, false\) = false/);
});

test('OpenRouter credit halt still runs the independent recovery lane', async () => {
  let runs = 0;
  const ran = await runRecoveryDuringOpenRouterHalt(
    'HALT — OpenRouter account out of credits (2026-08-25T00:49:00Z)',
    async () => { runs += 1; },
  );

  assert.equal(ran, true);
  assert.equal(runs, 1);
});

test('generic halt does not bypass the full-stop guardrail', async () => {
  let runs = 0;
  const ran = await runRecoveryDuringOpenRouterHalt(
    'migration freeze',
    async () => { runs += 1; },
  );

  assert.equal(ran, false);
  assert.equal(runs, 0);
});

test('generic halt that quotes the credit message remains a full stop', async () => {
  let runs = 0;
  const ran = await runRecoveryDuringOpenRouterHalt(
    'HALT: migration freeze while investigating "OpenRouter account out of credits"',
    async () => { runs += 1; },
  );

  assert.equal(ran, false);
  assert.equal(runs, 0);
});

// --- collect lap cursor (2026-08-27) ------------------------------------
// The collect pass used to re-select the same 40 leads every 6 hours, because
// the only way out of the pool was to gain a contact point. These lock the
// cursor walk that replaced it.

test('COLLECT_IDS_SQL: a null cursor selects the whole pool (fresh lap)', () => {
  assert.match(COLLECT_IDS_SQL, /\$2::int IS NULL/);
});

test('COLLECT_IDS_SQL: the cursor is one ascending 3-tuple comparison', () => {
  assert.match(COLLECT_IDS_SQL, /\(tier, disc, id\) > \(\$2::int, \$3::timestamptz, \$4::text\)/);
  assert.match(COLLECT_IDS_SQL, /ORDER BY tier, disc, id/);
});

test('COLLECT_IDS_SQL: link-carrying leads sort first (9 of 11 methods need a site)', () => {
  assert.match(COLLECT_IDS_SQL, /CASE WHEN COALESCE\(lc\.external_links, ''\) NOT IN \('', '\[\]'\) THEN 0 ELSE 1 END AS tier/);
});

test('COLLECT_IDS_SQL: keeps the pool guards it inherited', () => {
  assert.match(COLLECT_IDS_SQL, /review_status = 'needs_contact'/);
  assert.match(COLLECT_IDS_SQL, /signal_score >= 6/);
  assert.match(COLLECT_IDS_SQL, /COALESCE\(lc\.do_not_contact, false\) = false/);
  assert.match(COLLECT_IDS_SQL, /NOT EXISTS \(SELECT 1 FROM leads\.contact_points cp WHERE cp\.lead_id = lc\.id\)/);
});

test('COLLECT_IDS_SQL: a null first_discovered_at still sorts, never drops out', () => {
  assert.match(COLLECT_IDS_SQL, /COALESCE\(lc\.first_discovered_at, 'infinity'::timestamptz\)/);
});

test('LaneState carries a cursor and a lap count', () => {
  const s: LaneState = { collectCursor: { tier: 0, disc: '2026-05-22T17:31:37.050Z', id: 'recX' }, collectLaps: 2 };
  assert.equal(s.collectCursor?.tier, 0);
  assert.equal(s.collectLaps, 2);
});

// Both ways a lead can arrive in needs_contact are the same recovery job. The
// selectors read 'no_email_found' alone until 2026-09-02, which hid the 1,181
// email_invalid leads -- a quarter of the backlog -- from the collector for ten
// days. Nothing downstream needed that: the email repo's hold-guard gates on
// review_status and the score bar, never on outreach_status.
test('both selectors work no_email_found AND email_invalid', () => {
  const lanes = /outreach_status = ANY\(ARRAY\['no_email_found', 'email_invalid'\]\)/;
  assert.match(COLLECT_IDS_SQL, lanes);
  assert.match(VERIFIABLE_IDS_SQL, lanes);
});

// A widened collect pass that the verifier cannot follow just fills
// contact_points with addresses nobody ever rules on.
test('the two selectors agree on which lanes they work', () => {
  const lanesOf = (sql: string): string[] =>
    [...sql.matchAll(/outreach_status = ANY\(ARRAY\[([^\]]*)\]\)/g)].map((m) => m[1]!.trim());
  assert.deepEqual(lanesOf(COLLECT_IDS_SQL), lanesOf(VERIFIABLE_IDS_SQL));
});

// The stale-PID window was a flat 2h written against a 40-lead batch. A flat
// number is wrong the moment the batch moves, and the failure is silent in the
// bad direction: a live child gets a second one spawned on top of it.
test('staleCollectAfterMs: scales with the batch', () => {
  assert.equal(staleCollectAfterMs(150), 150 * 90_000);
  assert.ok(staleCollectAfterMs(400) > staleCollectAfterMs(150));
});

test('staleCollectAfterMs: never drops below the original 2h floor', () => {
  assert.equal(staleCollectAfterMs(40), 2 * 3600_000);
  assert.equal(staleCollectAfterMs(1), 2 * 3600_000);
});

// The window has to outlast the batch it guards by a real margin. Measured cost
// is 18.5s per lead at concurrency 8; the guard budgets 90s.
test('staleCollectAfterMs: outlasts the measured cost of its own batch', () => {
  const measuredMsPerLead = 18_500;
  for (const batch of [40, 150, 400]) {
    assert.ok(staleCollectAfterMs(batch) > batch * measuredMsPerLead * 3);
  }
});
