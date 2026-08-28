import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeEvalDue } from '../src/drivers/campaign.ts';

// The mid-run probe evaluation is triggered by a FADE COUNT, and on 2026-08-27→28
// 589 of 591 finder passes faded — so it fired 205 times in 24h, each one a 31s
// scan of ~23k probe rows, for 4 promotions and 71 pauses. That is 1h46m of a
// 20.5h pass loop spent deciding almost nothing, in a cycle where every session
// ended on its time budget. The floor below is what stops it.

test('probeEvalDue: no prior run (Infinity) is always due', () => {
  assert.equal(probeEvalDue(Infinity, 30), true);
});

test('probeEvalDue: inside the floor is not due', () => {
  assert.equal(probeEvalDue(7, 30), false);
  assert.equal(probeEvalDue(29.9, 30), false);
});

test('probeEvalDue: exactly at the floor is due', () => {
  assert.equal(probeEvalDue(30, 30), true);
});

test('probeEvalDue: past the floor is due', () => {
  assert.equal(probeEvalDue(45, 30), true);
});

// The finish-block call passes no floor, so a session ALWAYS ends with a full
// evaluation no matter when the last mid-run one fired. Same escape hatch as the
// harvest and discover backoffs: setting the interval to 0 restores the old
// fade-only behaviour without a code change.
test('probeEvalDue: a zero or negative floor disables the gate', () => {
  assert.equal(probeEvalDue(0, 0), true);
  assert.equal(probeEvalDue(1, 0), true);
  assert.equal(probeEvalDue(1, -5), true);
});

// Fail-open: a corrupt or missing stamp reads as NaN/Infinity upstream. NaN must
// never be treated as "recently ran" — that would silently disable the evaluation.
test('probeEvalDue: an unparseable elapsed time does not disable the evaluation', () => {
  assert.equal(probeEvalDue(Number.NaN, 30), true);
});
