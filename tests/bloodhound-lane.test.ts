import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isDue,
  laneOptsFromEnv,
  runRecoveryDuringOpenRouterHalt,
  staleCollectAfterMs,
  lastCollectPassFinished,
  lastCollectPassSearchDead,
  lastCollectPassYield,
  rewindWaiver,
  collectRewalk,
  MAX_CONSECUTIVE_REWINDS,
  MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS,
  VERIFIABLE_IDS_SQL,
  COLLECT_IDS_SQL,
  IN_COLLECT_LANE_SQL,
  RESCORE_IDS_SQL,
  RESCORE_IDS_PATH,
  rescoreCommands,
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

// A lead the collector can get a site for WITHOUT paying Brave sorts first,
// because nine of the eleven methods need one. Since 2026-09-13 that means a
// declared external link OR a website already stored on an earlier pass — the
// stored one is what keeps the lane productive while Brave's cap is hit.
test('COLLECT_IDS_SQL: leads with a free-to-resolve site sort first', () => {
  assert.match(COLLECT_IDS_SQL, /CASE WHEN COALESCE\(lc\.external_links, ''\) NOT IN \('', '\[\]'\)/);
  assert.match(COLLECT_IDS_SQL, /OR EXISTS \(SELECT 1 FROM leads\.contact_points cp[\s\S]*?cp\.kind = 'website'\)/);
  assert.match(COLLECT_IDS_SQL, /THEN 0 ELSE 1 END AS tier/);
});

// 2026-09-13: the score bar is leads.may_seek_contact(), defined once in
// youtube-email-outreach-v1. A number typed out here is the copy that drifts.
test('COLLECT_IDS_SQL and the book count call the shared score gate, never a number', () => {
  assert.match(IN_COLLECT_LANE_SQL, /leads\.may_seek_contact\(lc\)/);
  assert.ok(COLLECT_IDS_SQL.includes(IN_COLLECT_LANE_SQL));
  assert.doesNotMatch(COLLECT_IDS_SQL, /signal_score(_v2)?\s*>=/);
  assert.doesNotMatch(IN_COLLECT_LANE_SQL, /signal_score(_v2)?\s*>=/);
});

// Listed leads go two tiers ahead, and keep the free-site order inside that.
// The cursor stays one 3-tuple, so a listed lead is still walked exactly once.
test('COLLECT_IDS_SQL: leads on the recovery priority list sort ahead of the book', () => {
  assert.match(COLLECT_IDS_SQL, /LEFT JOIN leads\.recovery_priority rp ON rp\.lead_id = lc\.id/);
  assert.match(COLLECT_IDS_SQL, /CASE WHEN rp\.lead_id IS NOT NULL THEN -2 ELSE 0 END\s*\+ CASE WHEN/);
});

test('COLLECT_IDS_SQL: keeps the pool guards it inherited', () => {
  assert.match(COLLECT_IDS_SQL, /review_status = 'needs_contact'/);
  assert.match(COLLECT_IDS_SQL, /COALESCE\(lc\.do_not_contact, false\) = false/);
});

// THE GAP IS THE BUG (2026-09-13). Excluding a lead that has ANY contact point
// meant a lead holding a website, a phone or a social handle was invisible to
// collect AND unrulable by verify: 2,780 leads sat there while the collect pool
// ran at 251. This selector must exclude on the absence of an EMAIL only, which
// makes it the exact complement of VERIFIABLE_IDS_SQL. If the bare form ever
// comes back, so does the gap.
test('COLLECT_IDS_SQL: excludes only leads that already have an EMAIL, not any contact point', () => {
  assert.match(
    COLLECT_IDS_SQL,
    /NOT EXISTS \(SELECT 1 FROM leads\.contact_points cp[\s\S]*?cp\.kind IN \('business_email', 'personal_email', 'youtube_email'\)\)/,
  );
  assert.doesNotMatch(
    COLLECT_IDS_SQL,
    /NOT EXISTS \(SELECT 1 FROM leads\.contact_points cp WHERE cp\.lead_id = lc\.id\)/,
  );
});

// The two selectors must agree on what "done" means, or a widened collect pass
// just fills contact_points with points nobody ever checks.
test('collect and verify selectors are complements: same email kinds on both sides', () => {
  const kinds = /'business_email', 'personal_email', 'youtube_email'/;
  assert.match(COLLECT_IDS_SQL, kinds);
  assert.match(VERIFIABLE_IDS_SQL, kinds);
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

// --- rewind budgets (2026-09-10) ---------------------------------------------
// A truncated pass and a search-dead pass shared one 3-deep budget, so a
// sustained Brave outage alternated three wasted re-walks with one blind
// 150-lead advance. The budgets are separate now, and the search-dead one is
// long enough to outlast a monthly spending cap.

test('search-dead rewinds get a far longer budget than truncated ones', () => {
  assert.equal(MAX_CONSECUTIVE_REWINDS, 3);
  assert.ok(
    MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS > MAX_CONSECUTIVE_REWINDS * 4,
    'a search-dead outage must survive far more passes than a dying child',
  );
  // Still finite: a misfiring detector must not pin the walk forever.
  assert.ok(Number.isFinite(MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS));
});

test('search-dead budget outlasts a multi-day search outage at the 6h cadence', () => {
  const daysCovered = (MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS * 6) / 24;
  assert.ok(daysCovered >= 7, `only ${daysCovered} days of cover`);
});

test('lastCollectPassSearchDead: unknown log never rewinds', () => {
  assert.equal(lastCollectPassSearchDead('/nonexistent/collect.log'), null);
  assert.equal(lastCollectPassFinished('/nonexistent/collect.log'), null);
});

test('lastCollectPassSearchDead reads the newest pass only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bh-'));
  const p = join(dir, 'collect.log');
  // An older pass that hit the cap, then a newer clean one: the newer wins.
  writeFileSync(p, [
    '',
    'Bloodhound: 150 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded',
    'Collected 186 contact points from 40/150 leads.',
    'Bloodhound: 150 leads',
    '[recA] "A" site=https://a.com/ +5 pts, 1 skipped, 0 err',
    'Collected 885 contact points from 148/150 leads.',
    '',
  ].join('\n'));
  assert.equal(lastCollectPassSearchDead(p), false);
  assert.equal(lastCollectPassFinished(p), true);

  // And a refusal inside the newest pass is seen.
  writeFileSync(p, [
    '',
    'Bloodhound: 150 leads',
    'Collected 885 contact points from 148/150 leads.',
    'Bloodhound: 150 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded',
    'Collected 186 contact points from 40/150 leads.',
    '',
  ].join('\n'));
  assert.equal(lastCollectPassSearchDead(p), true);
  rmSync(dir, { recursive: true, force: true });
});

// --- 2026-09-11: a failed pass is not automatically a re-walkable one ---
// The 24h to 2026-09-11T07:00Z: the collect cursor sat on the book's short tail,
// the tail was unsearchable with Brave capped, and three passes in a row logged
// "Collected 0 contact points from 0/58 leads" while 3,737 leads waited.

test('lastCollectPassYield reads the newest completion line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bh-'));
  const p = join(dir, 'collect.log');
  writeFileSync(p, [
    '',
    'Bloodhound: 150 leads',
    'Collected 885 contact points from 148/150 leads.',
    'Bloodhound: 58 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded',
    'Collected 0 contact points from 0/58 leads.',
    '',
  ].join('\n'));
  assert.deepEqual(lastCollectPassYield(p), { walked: 58, withPoints: 0 });
  rmSync(dir, { recursive: true, force: true });
});

test('lastCollectPassYield: unknown log is no evidence, never zero', () => {
  assert.equal(lastCollectPassYield('/nonexistent/collect.log'), null);
});

test('rewindWaiver: a lap-closing batch is never rewound', () => {
  // The live shape: search dead, collected nothing, but the batch closed the lap
  // so every one of its leads returns at the top of the next lap anyway.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: true }, { walked: 58, withPoints: 0 }),
    'lap_complete',
  );
  // Same for a truncated pass: nothing was stranded behind an advanced cursor.
  assert.equal(
    rewindWaiver('previous_pass_truncated', { lapComplete: true }, null),
    'lap_complete',
  );
});

test('rewindWaiver: a search-dead pass that still collected advances', () => {
  // Measured degraded passes from the 09-09/09-10 outage. Holding the cursor on
  // one of these costs the rest of the book for a MONTHLY cap.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 40 }),
    'yield_held',
  );
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 111, withPoints: 53 }),
    'yield_held',
  );
});

test('rewindWaiver: a search-dead pass that collected nothing still rewinds', () => {
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 0 }),
    null,
  );
  // Under the floor but not zero: still the case the rewind was written for.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 9 }),
    null,
  );
});

test('rewindWaiver: a second consecutive zero re-walk advances instead of pinning', () => {
  // The real 2026-09-11/12 sequence. Pass three rewound once (rewinds -> 1);
  // pass four was the identical 150-lead batch and collected nothing again.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 0 }, 0),
    null,
    'the FIRST zero still rewinds — that is the case the rewind exists for',
  );
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 0 }, 1),
    'rewalk_produced_nothing',
    'a re-walk that collected nothing must not be re-walked a third time',
  );
});

test('rewindWaiver: the second-zero waiver does not leak into the other cases', () => {
  // Under the floor but NOT zero: the pass collected something, so the evidence
  // is ambiguous and the old patience applies however many rewinds deep we are.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 9 }, 5),
    null,
  );
  // A truncated pass is a different failure: nobody walked those leads at all,
  // so the search-dead re-walk budget must not speak for it.
  assert.equal(
    rewindWaiver('previous_pass_truncated', { lapComplete: false }, { walked: 150, withPoints: 0 }, 3),
    null,
  );
  // And a pass that held its yield still advances for the older reason.
  assert.equal(
    rewindWaiver('previous_pass_search_dead', { lapComplete: false }, { walked: 150, withPoints: 40 }, 2),
    'yield_held',
  );
});

test('rewindWaiver: no yield evidence never waives, and a truncated pass ignores yield', () => {
  assert.equal(rewindWaiver('previous_pass_search_dead', { lapComplete: false }, null), null);
  // A child killed 30s in prints a high hit rate over the handful it reached.
  assert.equal(
    rewindWaiver('previous_pass_truncated', { lapComplete: false }, { walked: 6, withPoints: 6 }),
    null,
  );
});

test('rewindWaiver: no failure reason means nothing to waive', () => {
  assert.equal(rewindWaiver(null, { lapComplete: true }, { walked: 58, withPoints: 0 }), null);
});

test('state written before 2026-09-11 carries no lapComplete and rewinds as before', () => {
  const legacy: LaneState['collectResume'] = { from: null, laps: 1 };
  assert.equal(
    rewindWaiver('previous_pass_search_dead', legacy, { walked: 58, withPoints: 0 }),
    null,
  );
});

// --- collectRewalk: is the lane re-reading leads it already read? -----------
// Added 2026-09-14. collectBookDepth PREDICTS repetition from a drained pool;
// this MEASURES it, so it also catches a pinned cursor with a large book behind
// it. See the 7b-ii block in scripts/autopilot/checkin.ts.

function collectPass(ids: string[]): string {
  const lines = ids.map((id) => `[${id}] "Some Channel" site=https://example.com/ +3 pts, 1 skipped, 0 err`);
  lines.push(`Collected ${ids.length * 3} contact points from ${ids.length}/${ids.length} leads.`);
  return lines.join('\n');
}
const idRange = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => `rec${String(from + i).padStart(8, '0')}`);

test('collectRewalk: a clean forward walk scores 1.0', () => {
  const log = [collectPass(idRange(0, 10)), collectPass(idRange(10, 10)), collectPass(idRange(20, 10))].join('\n');
  const r = collectRewalk(log, 3);
  assert.deepEqual(r, { slots: 30, distinct: 30, ratio: 1 });
});

test('collectRewalk: identical passes score by how many times each lead was re-read', () => {
  const same = collectPass(idRange(0, 10));
  const r = collectRewalk([same, same, same].join('\n'), 3);
  assert.equal(r?.slots, 30);
  assert.equal(r?.distinct, 10);
  // 0.333 is far below the 0.7 alarm ratio — this is the 2026-09-11 rewind loop.
  assert.ok(r!.ratio < 0.7);
});

test('collectRewalk: the 2026-09-12 shape (571 slots, 271 distinct) trips the 0.7 alarm', () => {
  // Two fresh passes then two re-reads of the first, the walking-in-place shape.
  const a = collectPass(idRange(0, 150));
  const b = collectPass(idRange(150, 121));
  const r = collectRewalk([a, b, a, a].join('\n'), 4);
  assert.equal(r?.slots, 571);
  assert.equal(r?.distinct, 271);
  assert.ok(r!.ratio < 0.7, 'must alarm');
});

test('collectRewalk: the window is the last N passes only, not the whole log', () => {
  const old = collectPass(idRange(0, 10));
  const log = [old, old, collectPass(idRange(50, 10)), collectPass(idRange(60, 10))].join('\n');
  // The two repeated passes are older than the window and must not drag it down.
  const r = collectRewalk(log, 2);
  assert.deepEqual(r, { slots: 20, distinct: 20, ratio: 1 });
});

test('collectRewalk: too few completed passes is null, not a clean walk', () => {
  assert.equal(collectRewalk(collectPass(idRange(0, 10)), 4), null);
  assert.equal(collectRewalk('', 4), null);
});

test('collectRewalk: a pass still running is not counted (no summary line yet)', () => {
  const partial = idRange(99, 5).map((id) => `[${id}] "X" site=(none) +0 pts, 9 skipped, 0 err`).join('\n');
  const log = [collectPass(idRange(0, 10)), collectPass(idRange(10, 10)), partial].join('\n');
  const r = collectRewalk(log, 2);
  assert.deepEqual(r, { slots: 20, distinct: 20, ratio: 1 });
});

// 2026-09-14: the lane verified 40 good emails in a day and parked 6, because
// leads admitted on Signal Score v2 need a re-score after verifying before the
// hold gate counts their contact point. The re-score pass closes that gap.
test('rescore selector calls the shared hold gate, never a score number', () => {
  assert.match(RESCORE_IDS_SQL, /NOT leads\.may_enter_hold\(lc\)/);
  assert.doesNotMatch(RESCORE_IDS_SQL, /signal_score(_v2)?\s*>=?\s*\d/);
});

test('rescore selector takes only verified-valid lane leads still missing the contact point', () => {
  assert.match(RESCORE_IDS_SQL, /review_status = 'needs_contact'/);
  assert.match(RESCORE_IDS_SQL, /outreach_status = 'email_verified'/);
  // Risky never earns the v2 contact point (Casey, 2026-09-13), so re-scoring
  // a risky lead would change nothing and repeat every hour.
  assert.match(RESCORE_IDS_SQL, /email_verification_result = 'valid'/);
  assert.match(RESCORE_IDS_SQL, /signal_score_v2 IS NOT NULL/);
  assert.match(RESCORE_IDS_SQL, /->> 'contact', '0'\) = '0'/);
  assert.match(RESCORE_IDS_SQL, /COALESCE\(lc\.do_not_contact, false\) = false/);
  assert.match(RESCORE_IDS_SQL, /LIMIT \$1/);
});

test('rescore pass runs only the free assemble stage, then promotes just those leads', () => {
  const { rescore, promote } = rescoreCommands('/abs/ids.txt');
  assert.deepEqual(rescore.slice(0, 4), ['python3', 'scripts/rescore-v2.py', '--stage', 'assemble']);
  assert.ok(!rescore.includes('classify') && !rescore.includes('all'), 'classify spends OpenRouter credit');
  assert.ok(rescore.includes('/abs/ids.txt'));
  assert.ok(promote.includes('/abs/ids.txt'));
  assert.ok(promote.includes('--no-sweep'));
  assert.match(RESCORE_IDS_PATH, /\.txt$/);
});

test('laneOptsFromEnv: automator path and rescore batch have committed defaults', () => {
  const saved = { ...process.env };
  try {
    delete process.env.AUTOMATOR_REPO_PATH;
    process.env.BLOODHOUND_RESCORE_BATCH = 'nope';
    const opts = laneOptsFromEnv('/tmp/repo', true, () => {});
    assert.equal(opts.automatorRepoPath, '/home/casey/repos/automator');
    assert.equal(opts.rescoreBatch, 500);
    process.env.AUTOMATOR_REPO_PATH = '  /srv/automator ';
    assert.equal(laneOptsFromEnv('/tmp/repo', true, () => {}).automatorRepoPath, '/srv/automator');
  } finally {
    process.env = saved;
  }
});
