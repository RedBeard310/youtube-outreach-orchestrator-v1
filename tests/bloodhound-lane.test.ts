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
  collectCursorKey,
  collectRewalk,
  collectRewalkCause,
  collectPasses,
  parseCauseEntries,
  causeCondition,
  rollUpConditions,
  collectYield,
  collectPassAttribution,
  noSiteCause,
  searchDied,
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
import { firstTouchReadingText } from '../scripts/autopilot/debrief-data.ts';

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

// 2026-09-16, the same class a third time. The two marks above are written per
// ROW; the verifier rules on an ADDRESS. A lead holding the same address twice
// under two kinds (About-tab button → youtube_email, website scrape →
// business_email) gets one row stamped and one left blank forever, so it
// re-selects every pass and buys another ZeroBounce credit. On the cycle ending
// 2026-09-16 the entire four-lead verify queue was this shape, one of them
// running since 08-24. The exclusion has to ask whether THIS ADDRESS was ruled
// on for this lead, by any row.
test('verify selector retires an address ruled on under a different contact kind', () => {
  const exclusion = VERIFIABLE_IDS_SQL.match(/AND NOT EXISTS \([\s\S]*?\)\)/);
  assert.ok(exclusion, 'the duplicate-address exclusion is missing');
  const sql = exclusion[0];

  // Same lead, same address, ignoring case and ignoring the contact kind.
  assert.match(sql, /ruled\.lead_id = cp\.lead_id/);
  assert.match(sql, /lower\(ruled\.value\) = lower\(cp\.value\)/);
  assert.doesNotMatch(sql, /ruled\.kind/);

  // "Ruled on" must mean exactly what the per-row test above means, or the two
  // halves disagree and a lead lands in the gap between them.
  assert.match(sql, /ruled\.verified_at IS NOT NULL/);
  assert.match(sql, /COALESCE\(ruled\.verified, false\) = true/);
  assert.match(sql, /COALESCE\(ruled\.notes, ''\) LIKE '%\[ownership:%'/);
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

// --- 2026-10-21: the rewind was still running on the latched line ---
// searchDied() settled on 2026-10-20 that the all-keys-refused line fires on ONE
// transient refusal and is not a spent plan. The snapshot and the alarm moved to
// it; this function did not, so at 2026-10-21T00:00:56Z the lane rewound its
// cursor for `previous_pass_search_dead` and re-walked 150 leads over the 10-20
// 05:00 pass, which asked Brave 43 times, lost 2, and found 34 real candidates.
test('a transient refusal in a pass that mostly searched fine does not rewind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bh-'));
  const p = join(dir, 'collect.log');
  const leads = (n: number, from = 0) => Array.from({ length: n }, (_, i) =>
    `[rec${from + i}AAAAAAAA] "C${from + i}" site=https://c${from + i}.com/ +0 pts, 1 skipped, 0 err`);
  // The 10-20 05:00 shape: the latch prints before the first lead, and the
  // footer on the next line says search was alive for 41 of 43 lookups.
  writeFileSync(p, [
    '',
    'Bloodhound: 43 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 429 Too Many Requests',
    ...leads(43),
    'Collected 1 contact points from 1/43 leads.',
    '[bloodhound] Brave website resolution: 43 searches, 34 resolved a candidate site, '
      + '7 answered with only social/third-party hits, 2 hit a key refusal, 0 errored.',
    '',
  ].join('\n'));
  assert.equal(lastCollectPassSearchDead(p), false);

  // A genuinely spent plan still rewinds: most of the pass's searches refused.
  writeFileSync(p, [
    '',
    'Bloodhound: 43 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded',
    ...leads(43),
    'Collected 0 contact points from 0/43 leads.',
    '[bloodhound] Brave website resolution: 43 searches, 0 resolved a candidate site, '
      + '0 answered with only social/third-party hits, 41 hit a key refusal, 0 errored.',
    '',
  ].join('\n'));
  assert.equal(lastCollectPassSearchDead(p), true);

  // A pass too short for the alarm's 30-lead sample is still judged: a rewind
  // asks about THE LAST PASS, whatever size it was.
  writeFileSync(p, [
    '',
    'Bloodhound: 6 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 429 Too Many Requests',
    ...leads(6),
    'Collected 1 contact points from 1/6 leads.',
    '[bloodhound] Brave website resolution: 6 searches, 5 resolved a candidate site, '
      + '0 answered with only social/third-party hits, 1 hit a key refusal, 0 errored.',
    '',
  ].join('\n'));
  assert.equal(lastCollectPassSearchDead(p), false);

  // No footer at all (a pass logged before 2026-10-05): the latched line is the
  // only evidence there is, so it still counts.
  writeFileSync(p, [
    '',
    'Bloodhound: 43 leads',
    '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded',
    ...leads(43),
    'Collected 0 contact points from 0/43 leads.',
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

// --- collectYield: has the lane's own hit rate fallen, and does the baseline
// --- survive a slow slide?  Added 2026-09-21 (see the function's own comment).

/** A pass of `of` leads where `hit` of them produced a contact point. */
function yieldPass(hit: number, of: number): string {
  const lines: string[] = [];
  for (let i = 0; i < of; i++) {
    lines.push(i < hit
      ? `[rec${i}] "X" site=https://example.com/ +3 pts, 1 skipped, 0 err`
      : `[rec${i}] "X" site=(none) +0 pts, 9 skipped, 0 err`);
  }
  lines.push(`Collected ${hit * 3} contact points from ${hit}/${of} leads.`);
  return lines.join('\n');
}
const yieldLog = (...passes: Array<[number, number]>) =>
  passes.map(([h, o]) => yieldPass(h, o)).join('\n');

test('collectYield: a healthy pass is not a drop', () => {
  const y = collectYield(yieldLog([75, 150], [72, 150], [78, 150], [74, 150]));
  assert.equal(y?.current.hit, 74);
  assert.ok(y!.dropPct < 10, `expected a small drop, got ${y!.dropPct}`);
});

test('collectYield: a cliff is caught by the short window', () => {
  const y = collectYield(yieldLog([75, 150], [72, 150], [78, 150], [20, 150]));
  assert.ok(y!.dropPct >= 40, `expected an alarm-sized fall, got ${y!.dropPct}`);
  assert.equal(y?.baselineSource, 'short');
});

test('collectYield: a short batch is too noisy to judge and is skipped', () => {
  // The tail of a lap: 12 leads. It must not become the "current" pass.
  const y = collectYield(yieldLog([75, 150], [72, 150], [78, 150], [74, 150], [1, 12]));
  assert.equal(y?.current.of, 150);
  assert.equal(collectPasses(yieldLog([1, 12])).length, 0);
});

test('collectYield: too few passes to compare is null, not a clean reading', () => {
  assert.equal(collectYield(yieldLog([75, 150], [72, 150])), null);
  assert.equal(collectYield(''), null);
});

// THE REGRESSION THIS FUNCTION EXISTS FOR. Under the old rule (median of the 8
// passes behind the newest) a lane pinned at ~60% of normal read as a 0% fall
// within five passes, because the degraded passes became the baseline. The long
// window has to hold the memory of the healthy regime.
test('collectYield: a sustained slide cannot erase its own baseline', () => {
  const healthy: Array<[number, number]> = Array.from({ length: 20 }, () => [105, 150]);
  const slid: Array<[number, number]> = Array.from({ length: 8 }, () => [39, 150]);
  const y = collectYield(yieldLog(...healthy, ...slid));
  // Eight degraded passes have completely taken over the 8-pass short window...
  assert.equal(Number((y!.baselineShort! * 100).toFixed(0)), 26);
  // ...so the long window is what keeps the reading honest.
  assert.equal(y?.baselineSource, 'long');
  assert.ok(y!.dropPct >= 40, `slide must still alarm, got ${y!.dropPct.toFixed(0)}%`);
});

test('collectYield: a permanently changed regime ages out instead of alarming forever', () => {
  // Same slide, but now it IS the lane's normal — nothing healthy left in the
  // long window either. Self-healing: the alarm goes quiet on its own.
  const y = collectYield(yieldLog(...Array.from({ length: 40 }, () => [39, 150] as [number, number])));
  assert.ok(y!.dropPct < 40, `a settled regime must not alarm, got ${y!.dropPct.toFixed(0)}%`);
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

// --- collectPassAttribution: is the search plan really the constraint, or is
// --- the lane re-reading a book it has already mined?  Added 2026-09-22.

/** A pass of `of` leads. `hit` of them score; `none` of them resolve no site. */
function attPass(ids: string[], opts: { hit: number; none: number }): string {
  const lines = ids.map((id, i) => {
    const site = i < opts.none ? '(none)' : 'https://example.com/';
    const pts = i >= opts.none && i < opts.none + opts.hit ? 3 : 0;
    return `[${id}] "X" site=${site} +${pts} pts, 1 skipped, 0 err`;
  });
  lines.push(`Collected ${opts.hit * 3} contact points from ${opts.hit}/${ids.length} leads.`);
  return lines.join('\n');
}
const attIds = (start: number, n: number) =>
  Array.from({ length: n }, (_, i) => `rec${String(start + i).padStart(6, 'a')}`);

test('collectPassAttribution: sites resolving means resolution is not the cause', () => {
  // The 2026-09-21 shape: 79% of leads resolved a site, and almost none scored.
  const log = [
    attPass(attIds(0, 40), { hit: 20, none: 4 }),
    attPass(attIds(100, 40), { hit: 1, none: 8 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.sampled, 40);
  assert.equal(a.noSite, 8);
  assert.equal(Number(a.noSitePct.toFixed(0)), 20);
  assert.equal(a.resolvedSampled, 32);
  assert.equal(a.resolvedHit, 1);
});

// THE REGRESSION THIS EXISTS FOR. Three alarms on 2026-09-21 told Casey to raise
// the Brave cap about passes that had resolved sites for 79-93% of their leads,
// because the only test was "does the log tail mention Brave". The pass's own
// leads have to be the evidence.
test('collectPassAttribution: a fully re-walked pass is named as a re-walk', () => {
  const ids = attIds(0, 40);
  const log = [
    attPass(ids, { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 22, none: 2 }),
    attPass(ids, { hit: 1, none: 2 }), // lap 2 over the same leads
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.seenBefore, 40);
  assert.equal(a.rewalkPct, 100);
  assert.ok(a.noSitePct < 70, 'resolution is healthy, so spend is not the remedy');
});

test('collectPassAttribution: a fresh lap is not a re-walk', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 22, none: 2 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.seenBefore, 0);
  assert.equal(a.rewalkPct, 0);
});

test('collectPassAttribution: a real resolution outage still reads as one', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 2, none: 36 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.ok(a.noSitePct >= 70, `expected an outage reading, got ${a.noSitePct}`);
});

test('collectPassAttribution: judges the same pass collectYield judges', () => {
  // A 12-lead lap tail must not become the judged pass for either function.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 1, none: 2 }),
    attPass(attIds(900, 12), { hit: 0, none: 1 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.sampled, 40);
  assert.equal(a.resolvedHit, 1);
});

test('collectPassAttribution: too small a sample is null, not a clean reading', () => {
  assert.equal(collectPassAttribution(''), null);
  assert.equal(collectPassAttribution(attPass(attIds(0, 12), { hit: 1, none: 1 })), null);
});

// --- newerPassesSkipped: is the judged pass actually the newest?  2026-10-25 ---
// THE REGRESSION THIS EXISTS FOR. The floor above is right, but it was silent, so
// the snapshot note, the hourly alarm and every debrief called the judged pass "the
// newest completed collect pass". On 2026-10-25 the lane closed lap 11 with an
// 11-lead tail at 03:01Z and the reading described the 150-lead pass from 21:00Z
// the evening before — one pass and ten hours back, with nothing saying so.

test('collectPassAttribution: a lap tail newer than the judged pass is counted, not hidden', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 150), { hit: 0, none: 139 }), // the judged pass
    attPass(attIds(900, 11), { hit: 0, none: 11 }),   // the 10-25 lap tail
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.sampled, 150, 'still judges the newest pass big enough to read');
  assert.equal(a.newerPassesSkipped, 1);
  assert.equal(a.newerPassesSkippedLeads, 11);
});

test('collectPassAttribution: the newest pass reports zero skipped', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 1, none: 2 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.newerPassesSkipped, 0);
  assert.equal(a.newerPassesSkippedLeads, 0);
});

test('collectPassAttribution: several short passes stack up rather than cancel out', () => {
  // The freeze shape: the collect batch is set under the floor, so every pass
  // after the last big one is skipped and `cause` silently stops moving.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(100, 20), { hit: 0, none: 20 }),
    attPass(attIds(200, 20), { hit: 0, none: 20 }),
    attPass(attIds(300, 20), { hit: 0, none: 20 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.sampled, 40, 'the stale big pass is still what gets read');
  assert.equal(a.newerPassesSkipped, 3);
  assert.equal(a.newerPassesSkippedLeads, 60);
  assert.ok(a.noSitePct < 70, 'and it reads healthy while three live passes resolved nothing');
});

// --- braveRefusals: could this pass search at all?  Added 2026-09-27 ---------
// THE REGRESSION THIS EXISTS FOR (the mirror image of the one above). The 09-22
// fix assumed the all-keys-refused line prints on every pass, so it hard-coded
// "raising the cap would not have changed it" into the alarm text. It prints
// only when EVERY key refuses. On 2026-09-26 both keys hit their monthly cap,
// the lane rewound the cursor twice for `previous_pass_search_dead`, and the
// check-in an hour later was still telling Casey the line was not evidence.
const REFUSAL = '[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded';

test('collectPassAttribution: a pass with no refusal line counts zero', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 20, none: 2 }),
  ].join('\n');
  assert.equal(collectPassAttribution(log)!.braveRefusals, 0);
});

test('collectPassAttribution: refusals are counted from the judged pass only', () => {
  // Two refusals in the pass BEFORE the judged one, one inside it. A tail read
  // cannot tell these apart; that is the whole bug.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    REFUSAL, REFUSAL,
    attPass(attIds(500, 40), { hit: 1, none: 2 }),
    REFUSAL,
    attPass(attIds(900, 40), { hit: 1, none: 2 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 1, 'only the refusal inside the judged pass');
  assert.ok(a.noSitePct < 70, 'a capped plan and healthy resolution can coexist');
  assert.equal(a.rewalkPct, 0);
});

test('collectPassAttribution: refusals do not disturb the lead readings', () => {
  const ids = attIds(0, 40);
  const log = [
    attPass(ids, { hit: 25, none: 2 }),
    [REFUSAL, attPass(ids, { hit: 1, none: 2 })].join('\n'),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 1);
  assert.equal(a.sampled, 40);
  assert.equal(a.rewalkPct, 100, 'still reads as the re-walk it also is');
  assert.equal(a.resolvedHit, 1);
});

test('collectPassAttribution: the refusal line matches the rewind detector', () => {
  // Same regex, so the alarm and lastCollectPassSearchDead() cannot disagree.
  for (const status of ['402 Usage limit exceeded', 'no key answered (network or timeout)']) {
    const line = `[bloodhound] All 2 Brave Search API key(s) refused: ${status}`;
    const log = [attPass(attIds(0, 40), { hit: 25, none: 2 }), line,
      attPass(attIds(500, 40), { hit: 1, none: 2 })].join('\n');
    assert.equal(collectPassAttribution(log)!.braveRefusals, 1, status);
  }
});

// --- what a refused plan COST the pass.  Added 2026-09-28 -------------------
// THE REGRESSION THIS EXISTS FOR. `searchBrave()` latches its all-keys-refused
// warning once per process, and a pass is one process, so braveRefusals can
// never exceed 1 no matter how many lookups died. The day the count shipped the
// alarm read it as a volume: a pass that resolved no website for 141 of its 150
// leads was reported as having "lost 1 lookup ... the smaller half of this
// pass". The leads behind the line are the measurement, not the line count.

test('collectPassAttribution: a latched refusal still measures the whole pass it cost', () => {
  // 40 leads, 36 of them resolving nothing, one refusal line before any of them.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 40), { hit: 2, none: 36 })].join('\n'),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 1, 'the latch caps the line count at one');
  assert.equal(a.braveRefusedAfterLeads, 0, 'refused before the first lead');
  assert.equal(a.leadsAfterRefusal, 40, 'every lead in the pass ran with search dead');
  assert.equal(a.noSiteAfterRefusal, 36);
});

test('collectPassAttribution: a refusal part-way through costs only the leads behind it', () => {
  const ids = attIds(500, 40);
  // attPass puts the site-less leads first, so splicing the refusal in after
  // lead 10 leaves 26 of the 30 remaining leads without a site.
  const pass = attPass(ids, { hit: 2, none: 36 }).split('\n');
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [...pass.slice(0, 10), REFUSAL, ...pass.slice(10)].join('\n'),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusedAfterLeads, 10);
  assert.equal(a.leadsAfterRefusal, 30);
  assert.equal(a.noSiteAfterRefusal, 26);
  assert.equal(a.noSite, 36, 'the whole-pass readings are unchanged');
});

test('collectPassAttribution: a pass that could search reports no cost at all', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 20, none: 2 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 0);
  assert.equal(a.braveRefusedAfterLeads, null);
  assert.equal(a.leadsAfterRefusal, 0);
  assert.equal(a.noSiteAfterRefusal, 0);
});

test('collectPassAttribution: a refusal in the PREVIOUS pass costs this one nothing', () => {
  // The site-collapse alarm used to read past its own pass boundary, so a
  // refusal logged by the next pass was evidence about the one before it.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    REFUSAL,
    attPass(attIds(500, 40), { hit: 2, none: 36 }),
    attPass(attIds(900, 40), { hit: 2, none: 36 }),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 0, 'the refusal belongs to an earlier pass');
  assert.equal(a.leadsAfterRefusal, 0);
  assert.ok(a.noSitePct >= 70, 'and the collapse is still reported');
});

// --- collectRewalkCause: WHY the walk is repeating ---------------------------
// Added 2026-09-23. The walking-in-place alarm asserted "the cursor is failing
// to advance" in its own text and said it twelve times on 2026-09-22 while the
// lane state held collectRewinds: 0, collectSearchDeadRewinds: 0 and a cursor
// that had moved. Fourth outing of the misattribution class, so the cause is
// now read off the state rather than asserted.

const cursorAt = (id: string) => ({ tier: 0, disc: '2026-07-15T17:00:14.391Z', id });

test('collectRewalkCause: the real 2026-09-22 state reads as a lap re-walk, not a pinned cursor', () => {
  const state = {
    collectLaps: 6, collectRewinds: 0, collectSearchDeadRewinds: 0,
    collectCursor: cursorAt('rec8z9sksO5QPOnCI'),
  };
  const prev = {
    collect_rewinds: 0, collect_search_dead_rewinds: 0,
    collect_cursor: '0:2026-07-15T17:00:14.391Z:recEARLIER',
  };
  const a = collectRewalkCause(state, prev);
  assert.equal(a.cause, 'lap_rewalk');
  assert.equal(a.cursorMoved, true);
  assert.equal(a.laps, 6);
});

test('collectRewalkCause: a cursor that did not move across a pass is still a pinned walk', () => {
  // The alarm this function serves is keyed on the pass window, so a second
  // firing means a new pass completed. Same cursor across one = genuinely pinned.
  const cursor = cursorAt('recSAME');
  const a = collectRewalkCause(
    { collectLaps: 6, collectRewinds: 0, collectSearchDeadRewinds: 0, collectCursor: cursor },
    { collect_rewinds: 0, collect_search_dead_rewinds: 0, collect_cursor: '0:2026-07-15T17:00:14.391Z:recSAME' },
  );
  assert.equal(a.cause, 'cursor_pinned');
  assert.equal(a.cursorMoved, false);
});

test('collectRewalkCause: a RISE in a rewind counter is a rewind loop', () => {
  const a = collectRewalkCause(
    { collectLaps: 6, collectRewinds: 3, collectSearchDeadRewinds: 0, collectCursor: cursorAt('recB') },
    { collect_rewinds: 2, collect_search_dead_rewinds: 0, collect_cursor: '0:2026-07-15T17:00:14.391Z:recA' },
  );
  assert.equal(a.cause, 'rewind_loop');
});

test('collectRewalkCause: a STANDING rewind count from history is not a live loop', () => {
  // The counters are lifetime totals. Without this, one historical rewind would
  // read as a rewind loop forever — the same "always true, so not a test" shape
  // the 2026-09-22 Brave attribution had.
  const a = collectRewalkCause(
    { collectLaps: 6, collectRewinds: 3, collectSearchDeadRewinds: 1, collectCursor: cursorAt('recB') },
    { collect_rewinds: 3, collect_search_dead_rewinds: 1, collect_cursor: '0:2026-07-15T17:00:14.391Z:recA' },
  );
  assert.equal(a.cause, 'lap_rewalk');
});

test('collectRewalkCause: with no previous firing, any nonzero counter still alarms as a loop', () => {
  // First firing has nothing to diff against, so fall back to the standing
  // count. Better to name a fault that is not live than to miss a live one.
  const a = collectRewalkCause(
    { collectLaps: 6, collectRewinds: 2, collectSearchDeadRewinds: 0, collectCursor: cursorAt('recB') },
    null,
  );
  assert.equal(a.cause, 'rewind_loop');
  assert.equal(a.cursorMoved, null);
});

test('collectRewalkCause: repetition before the first lap closes is unexplained, not blamed', () => {
  const a = collectRewalkCause(
    { collectLaps: 0, collectRewinds: 0, collectSearchDeadRewinds: 0, collectCursor: cursorAt('recB') },
    { collect_rewinds: 0, collect_search_dead_rewinds: 0, collect_cursor: '0:2026-07-15T17:00:14.391Z:recA' },
  );
  assert.equal(a.cause, 'unexplained');
});

test('collectCursorKey: a lane holding no cursor keys as null', () => {
  assert.equal(collectCursorKey({}), null);
  assert.equal(collectCursorKey({ collectCursor: cursorAt('recX') }), '0:2026-07-15T17:00:14.391Z:recX');
});

// --- The top cause can be a deliberate content outcome (2026-10-15) --------------
//
// The real 2026-10-15 03:01Z pass. `34-channel-page: page rendered with no outbound
// links` held 60% of the errors, which the snapshot's own guidance reads as "one fault
// holding most of a pass, chase it" — and it is not a fault at all: that method tests
// for the rendered channel markers first and emits a different message when they are
// missing, so this one means the creator genuinely has no links. The real fault was #2,
// `17-podcast: iTunes N` (Apple refusing a rate-limited burst), and reading it took a
// hand grep of the collect log.
const CAUSE_LOG = [
  'Collected 0 contact points from 0/102 leads.',
  '[bloodhound] Methods found 76 point(s) on 41/102 leads; 76 were already on file.',
  '[bloodhound] Method errors: 85 across 8 shape(s) — 51x 34-channel-page: page rendered with no outbound links | 28x 17-podcast: iTunes N; and 2 rarer shape(s)',
  '[bloodhound] Method error causes: 85 across 6 cause(s), top 60% — 51x 34-channel-page: page rendered with no outbound links | 28x 17-podcast: iTunes N | 3x 28-sitemap: This operation was aborted | 1x 01-mailto: This operation was aborted; and 2 rarer cause(s)',
].join('\n');

test('collectPasses: the whole named cause list is kept, not just the top row', () => {
  const p = collectPasses(CAUSE_LOG)[0]!;
  assert.equal(p.causeList?.length, 4);
  assert.deepEqual(p.causeList?.[1], { count: 28, cause: '17-podcast: iTunes N' });
  // The existing top-cause fields must not change meaning.
  assert.equal(p.topErrorCause, '34-channel-page: page rendered with no outbound links');
  assert.equal(p.topErrorCauseCount, 51);
  assert.equal(p.topErrorCausePct, 60);
});

test('collectPasses: the top FAULT cause skips a deliberate content outcome', () => {
  const p = collectPasses(CAUSE_LOG)[0]!;
  assert.equal(p.topFaultCause, '17-podcast: iTunes N');
  assert.equal(p.topFaultCauseCount, 28);
  // Share of the pass's errors, so it is comparable with topErrorCausePct.
  assert.equal(p.topFaultCausePct, 33);
});

test('collectPasses: a pass whose only causes are benign reports no fault', () => {
  const log = [
    'Collected 0 contact points from 0/150 leads.',
    '[bloodhound] Method error causes: 68 across 1 cause(s), top 100% — 68x 34-channel-page: page rendered with no outbound links',
  ].join('\n');
  const p = collectPasses(log)[0]!;
  assert.equal(p.topErrorCause, '34-channel-page: page rendered with no outbound links');
  assert.equal(p.topFaultCause, null);
  assert.equal(p.topFaultCausePct, null);
});

test('collectPasses: a pass with no cause line leaves every cause field null, not zero', () => {
  const p = collectPasses('Collected 4 contact points from 3/150 leads.')[0]!;
  assert.equal(p.causeList, null);
  assert.equal(p.topFaultCause, null);
  assert.equal(p.topFaultCauseCount, null);
  assert.equal(p.topErrorCause, null);
});

// 2026-10-22: the cause key keeps the method name, and it has to — but a condition that
// stops every method on the same lead then arrives as one row per method, each looking
// small. The live 10-21 23:00Z pass, verbatim: `cross-domain redirect` is 101 of 209 errors
// under five method names while the largest single row is 32, which is 15%.
const CONDITION_LOG = [
  'Collected 1 contact points from 1/150 leads.',
  '[bloodhound] Method error causes: 209 across 27 cause(s), top 15% — 32x 14-external-links: cross-domain redirect | 22x 18-rdap: RDAP N not-found | 21x 28-sitemap: cross-domain redirect | 16x 01-mailto: cross-domain redirect | 16x 02-subpages: cross-domain redirect | 16x 16-jsonld: cross-domain redirect; and 21 rarer cause(s)',
].join('\n');

test('collectPasses: one condition under five method names is rolled up into one row', () => {
  const p = collectPasses(CONDITION_LOG)[0]!;
  assert.deepEqual(p.conditionList?.[0], { condition: 'cross-domain redirect', count: 101 });
  assert.equal(p.topFaultCondition, 'cross-domain redirect');
  assert.equal(p.topFaultConditionCount, 101);
  // 101 of 209, against the 15% the per-method row reported for the same condition.
  assert.equal(p.topFaultConditionPct, 48);
  assert.equal(p.topFaultCausePct, 15);
  // The line named 123 of 209 errors, so every count above is a lower bound and says so.
  assert.equal(p.conditionCoveragePct, 59);
});

test('collectPasses: a condition is benign only when every method reporting it is', () => {
  const p = collectPasses(CAUSE_LOG)[0]!;
  // Two methods report the same abort; it becomes one row of 4.
  assert.deepEqual(p.conditionList, [
    { condition: 'page rendered with no outbound links', count: 51 },
    { condition: 'iTunes N', count: 28 },
    { condition: 'This operation was aborted', count: 4 },
  ]);
  // The 60% content outcome is still skipped at the condition level.
  assert.equal(p.topFaultCondition, 'iTunes N');
  assert.equal(p.topFaultConditionCount, 28);
});

test('collectPasses: a pass with no cause line has no condition roll-up either', () => {
  const p = collectPasses('Collected 4 contact points from 3/150 leads.')[0]!;
  assert.equal(p.conditionList, null);
  assert.equal(p.topFaultCondition, null);
  assert.equal(p.conditionCoveragePct, null);
});

test('causeCondition: an unrecognised prefix is kept whole rather than guessed at', () => {
  assert.equal(causeCondition('28-sitemap: /sitemap_index.xml: fetch failed'),
    '/sitemap_index.xml: fetch failed');
  assert.equal(causeCondition('apify:endspec/youtube-instant-email-scraper: run failed'),
    'run failed');
  assert.equal(causeCondition('something nobody prefixed'), 'something nobody prefixed');
  assert.equal(causeCondition('Error: connect ETIMEDOUT'), 'Error: connect ETIMEDOUT');
});

test('rollUpConditions: benignness is the message\'s, and a group keeps it only if all of it is', () => {
  // Same benign message under two methods: still a content outcome, now counted once.
  const benign = rollUpConditions([
    { cause: '34-channel-page: page rendered with no outbound links', count: 9 },
    { cause: '02-subpages: page rendered with no outbound links', count: 1 },
  ]);
  assert.deepEqual(benign, [
    { condition: 'page rendered with no outbound links', count: 10, benign: true },
  ]);
  // A condition is a group key, not a message, so one real fault sharing it makes the
  // whole group worth reading. Guards against a future benign entry that is generic
  // enough to land on a condition a broken method also reports.
  const mixed = rollUpConditions([
    { cause: '34-channel-page: page rendered with no outbound links', count: 9 },
    { cause: '18-rdap: page rendered with no outbound links / 403', count: 1 },
  ]);
  assert.equal(mixed[0]!.condition, 'page rendered with no outbound links');
  assert.equal(mixed[0]!.benign, true);
  assert.equal(mixed[1]!.benign, true);
  const fault = rollUpConditions([
    { cause: '28-sitemap: cross-domain redirect', count: 7 },
    { cause: '01-mailto: cross-domain redirect', count: 3 },
  ]);
  assert.deepEqual(fault, [
    { condition: 'cross-domain redirect', count: 10, benign: false },
  ]);
});

test('parseCauseEntries: the rarer-cause tail is not mistaken for a cause', () => {
  // The `; and N rarer cause(s)` tail is cut by the regex, so only named rows arrive.
  assert.deepEqual(parseCauseEntries('5x a: b | 2x c'), [
    { count: 5, cause: 'a: b' },
    { count: 2, cause: 'c' },
  ]);
  assert.deepEqual(parseCauseEntries(''), []);
  assert.deepEqual(parseCauseEntries('and 2 rarer cause(s)'), []);
});

// --- searchDied / noSiteCause: a refusal is not a spent plan.  2026-10-20 ----
// THE REGRESSION THIS EXISTS FOR. `noSiteCause()` returned `search_dead` whenever
// the latched all-keys-refused line appeared at all, and the latch fires the first
// time every key refuses ONE lookup — a transient 429 against a funded plan does
// it. The 2026-10-20 collect pass printed the line before its first lead, so the
// cycle snapshot read `cause: search_dead` ("costs money to fix") and the alarm
// text read "raise the cap or add keys", while the pass's own footer on the very
// next line of the same log counted 2 refused searches out of 43 and 34 candidate
// sites found. The ownership gate threw out 33 of those 34. Brave credit could not
// have bought a single extra site, and `ownership_gate` existed to say so.
const braveLine = (s: number, cand: number, social: number, refused: number, err = 0) =>
  `[bloodhound] Brave website resolution: ${s} searches, ${cand} resolved a candidate site, ${social} answered with only social/third-party hits, ${refused} hit a key refusal, ${err} errored.`;

test('collectPassAttribution: the footer refusal and error counts are read', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 43), { hit: 0, none: 42 })].join('\n'),
    braveLine(43, 34, 7, 2, 0),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusals, 1, 'the latch still caps the line count at one');
  assert.equal(a.braveRefusedSearches, 2, 'and the footer carries the real volume');
  assert.equal(a.braveErroredSearches, 0);
});

test('searchDied: two refused searches of 43 is not a dead plan', () => {
  // The 2026-10-20 pass, to the number.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 43), { hit: 0, none: 42 })].join('\n'),
    braveLine(43, 34, 7, 2, 0),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(searchDied(a), false, 'search answered 41 of its 43 lookups');
  assert.ok(a.noSitePct >= 70, 'the pass did collapse');
  assert.equal(noSiteCause(a), 'ownership_gate',
    'and the gate that threw out 33 of 34 candidates is the cause, not the plan');
});

test('searchDied: a plan that caps mid-pass is still named', () => {
  // Refused from search 50 onward: the shape the 09-27 fix was written for, and
  // the one this must not stop reporting.
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 150), { hit: 0, none: 140 })].join('\n'),
    braveLine(150, 38, 5, 100, 0),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(searchDied(a), true);
  assert.equal(noSiteCause(a), 'search_dead');
});

test('searchDied: no footer means the latched line is the only evidence', () => {
  // Every pass logged before 2026-10-05. Unknowable must not quietly become "fine".
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 40), { hit: 0, none: 38 })].join('\n'),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(a.braveRefusedSearches, null);
  assert.equal(searchDied(a), true);
  assert.equal(noSiteCause(a), 'search_dead');
});

test('searchDied: no refusal line at all is never a dead plan', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    attPass(attIds(500, 40), { hit: 0, none: 38 }),
    braveLine(40, 30, 8, 0, 2),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(searchDied(a), false);
  assert.equal(noSiteCause(a), 'ownership_gate');
});

test('noSiteCause: search_off still outranks everything', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 40), { hit: 0, none: 38 })].join('\n'),
    '[bloodhound] Brave website resolution was OFF: no BRAVE_SEARCH_API_KEY is set in this process, so 38 lead(s) that needed a lookup got none.',
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(noSiteCause(a), 'search_off');
  assert.equal(a.braveRefusedSearches, 0, 'an OFF pass refused nothing, it asked nothing');
});

test('noSiteCause: a healthy pass under the alarm bar reads resolution_ok', () => {
  const log = [
    attPass(attIds(0, 40), { hit: 25, none: 2 }),
    [REFUSAL, attPass(attIds(500, 40), { hit: 20, none: 4 })].join('\n'),
    braveLine(40, 30, 6, 1, 0),
  ].join('\n');
  const a = collectPassAttribution(log)!;
  assert.equal(searchDied(a), false);
  assert.equal(noSiteCause(a), 'resolution_ok');
});

// --- A note that says "this cycle" must mean this cycle (2026-10-23) -----------------
//
// The first_touch note froze 2026-10-17's own pair into its wording and re-stated it
// every cycle after as "1.3% this cycle against 68.7% over the prior week". On
// 2026-10-23 the live pair was 0% against 0.3% and the note still printed the old
// numbers inside a clause naming the current cycle.

test('firstTouchReadingText: prints the live pair, not a frozen one', () => {
  // The real 2026-10-23 cycle: 117 people, 0 first touches, 2 of 651 the week before.
  assert.equal(
    firstTouchReadingText({ first_touch_pct: 0, first_touch_pct_prev_7d: 0.3 }),
    '0% this cycle against 0.3% over the prior week',
  );
  // And the 2026-10-17 cycle the old wording was frozen from, which it still renders.
  assert.equal(
    firstTouchReadingText({ first_touch_pct: 1.3, first_touch_pct_prev_7d: 68.7 }),
    '1.3% this cycle against 68.7% over the prior week',
  );
});

test('firstTouchReadingText: a missing denominator is not 0%', () => {
  // A zero-send day (10-18 and 10-19 were both weekend cycles) has no denominator, so
  // "0%" would be a claim the data cannot make.
  assert.equal(
    firstTouchReadingText({ first_touch_pct: null, first_touch_pct_prev_7d: 0.3 }),
    'no emails to measure this cycle against 0.3% over the prior week',
  );
  assert.equal(
    firstTouchReadingText({ first_touch_pct: 0, first_touch_pct_prev_7d: null }),
    '0% this cycle against no emails over the prior week either',
  );
  // And a failed query is unknown, which is not the same as zero.
  assert.match(firstTouchReadingText(null), /unavailable this cycle .* not the same as zero/);
});
