import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDue, laneOptsFromEnv, type LaneState } from '../src/recovery/bloodhound-lane.ts';

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
    assert.equal(opts.collectBatch, 40);
    // Negative batches must fall back too; a negative LIMIT errors in Postgres.
    assert.equal(opts.verifyBatch, 200);
  } finally {
    process.env = saved;
  }
});
