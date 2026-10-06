import { apifyBatchFacts, apifyLedgerLine, normalizePushReason, siegePushOutcome, classifyKeyProbe, cyclePacificDay, enrichmentChainFacts, isSendingDay, projectRecoveryBudget, MAX_MISSING_DEBRIEFS, missingDebriefs, pushRunVerdict, sendPlanHealth, siegePlanFacts, summarizeSendLines, isVerifiedOrBeyond, laneYield, priorAdvanceSource, priorSeedsAdvanced, priorSeedsWalked, reconcileAdvanced, sessionSeedsAdvanced, sessionStartMs, walkRateTrend } from './debrief-data.ts';
let fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fail++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

// sessionSeedsAdvanced
ok('long session, many chunks',
  sessionSeedsAdvanced('[peer-sweep] 7587 seeds total | 2470 done | 5117 remaining\n[chunk 1/512]  seeds 2471-2480 of 7587\n[chunk 445/512]  seeds 6911-6920 of 7587\n'),
  4450);
ok('startup only, no progress -> unknown',
  sessionSeedsAdvanced('[comment-sweep] 39 seeds total | 0 done | 39 remaining\n'), null);
ok('no startup line -> unknown', sessionSeedsAdvanced('[podcast] 452 feeds known (+7 new this run)\n'), null);
ok('finished sweep', sessionSeedsAdvanced('[sweep] 8200 seeds total | 8142 done | 58 remaining\n[chunk 3/3]  seeds 8183-8200 of 8200\n'), 58);
ok('refill reset clamps at 0',
  sessionSeedsAdvanced('[sweep] 900 seeds total | 800 done | 100 remaining\n[chunk 1/1]  seeds 1-10 of 900\n'), 0);
ok('crash-on-first-chunk still counts what it walked',
  sessionSeedsAdvanced('[peer-sweep] 7587 seeds total | 2440 done | 5147 remaining\n[chunk 1/515]  seeds 2441-2450 of 7587\nReferenceError: boom\n'), 10);

// sessionStartMs
ok('sweep- name', sessionStartMs('/x/sweep-20260812-120629.log', 999), Date.parse('2026-08-12T12:06:29Z'));
ok('daily- name', sessionStartMs('/x/daily-20260812-165034.log', 999), Date.parse('2026-08-12T16:50:34Z'));
ok('unstamped name falls back to mtime', sessionStartMs('/x/peer-sweep-smoketest.log', 999), 999);

// isVerifiedOrBeyond — a verified lead still counts after it advances past verification
ok('email_verified', isVerifiedOrBeyond('email_verified'), true);
ok('ready_data_scraped counts (the 08-14 zero)', isVerifiedOrBeyond('ready_data_scraped'), true);
ok('enriched legacy alias counts', isVerifiedOrBeyond('enriched'), true);
ok('email_drafted counts', isVerifiedOrBeyond('email_drafted'), true);
ok('sent_to_smartlead counts', isVerifiedOrBeyond('sent_to_smartlead'), true);
ok('no_email_found does not', isVerifiedOrBeyond('no_email_found'), false);
ok('email_invalid does not', isVerifiedOrBeyond('email_invalid'), false);
ok('ready_no_data is a manual label, not evidence', isVerifiedOrBeyond('ready_no_data'), false);
ok('pending does not', isVerifiedOrBeyond('pending'), false);
ok('null does not', isVerifiedOrBeyond(null), false);
ok('undefined does not', isVerifiedOrBeyond(undefined), false);

// walkRateTrend — a lane with road left that slowed down is throughput-bound, not dry
const ROAD = { book_drained: false, days_of_road: 4.5 };
const DRY = { book_drained: true, days_of_road: 0 };
ok('the 08-22 video-graph shape: road left, walked 27% less',
  walkRateTrend(8303, 11455, ROAD),
  { seeds_advanced_prev: 11455, walk_rate_change_pct: -27.5, throughput_bound: true });
ok('a drained book explains its own slowdown — book_drained owns that',
  walkRateTrend(223, 10300, DRY),
  { seeds_advanced_prev: 10300, walk_rate_change_pct: -97.8, throughput_bound: false });
ok('under a day of road is about to be supply-bound whatever the rate did',
  walkRateTrend(300, 11455, { book_drained: false, days_of_road: 0.4 }),
  { seeds_advanced_prev: 11455, walk_rate_change_pct: -97.4, throughput_bound: false });
ok('a small dip is not a regression',
  walkRateTrend(10000, 11455, ROAD),
  { seeds_advanced_prev: 11455, walk_rate_change_pct: -12.7, throughput_bound: false });
ok('speeding up is never throughput-bound',
  walkRateTrend(14000, 11455, ROAD),
  { seeds_advanced_prev: 11455, walk_rate_change_pct: 22.2, throughput_bound: false });
ok('no baseline (first run after deploy) reports nulls, not an alarm',
  walkRateTrend(8303, null, ROAD),
  { seeds_advanced_prev: null, walk_rate_change_pct: null, throughput_bound: null });
ok('a lane that was stopped last cycle has no rate to compare',
  walkRateTrend(8303, 0, ROAD),
  { seeds_advanced_prev: 0, walk_rate_change_pct: null, throughput_bound: null });
ok('unknown seeds this cycle stays unknown',
  walkRateTrend(null, 11455, ROAD),
  { seeds_advanced_prev: 11455, walk_rate_change_pct: null, throughput_bound: null });

// priorSeedsAdvanced — a missing baseline file must be silent, not fatal
ok('missing prior snapshot -> empty map', priorSeedsAdvanced('1999-01-01'), {});
ok('real prior snapshot carries the lanes',
  priorSeedsAdvanced('2026-08-21')['video_graph_sweep'], 11415);
ok('prior seeds_walked read from the same snapshot',
  priorSeedsWalked('2026-08-22')['video_graph_sweep'], 24963);
ok('a pre-08-23 snapshot names no source, so its baseline is not comparable',
  priorAdvanceSource('2026-08-22')['video_graph_sweep'], null);

// reconcileAdvanced — the seed-book delta is exact; the log sum double-counts long sessions
ok('book delta wins over the inflated log sum (the 08-23 video-graph case)',
  reconcileAdvanced(12647, 32486, 24963),
  { seeds_advanced: 7523, seeds_advanced_source: 'book_delta' });
ok('short contained sessions agree either way (peer-sweep 08-23)',
  reconcileAdvanced(264, 10937, 10673),
  { seeds_advanced: 264, seeds_advanced_source: 'book_delta' });
ok('no baseline falls back to the session logs',
  reconcileAdvanced(8303, 24963, null),
  { seeds_advanced: 8303, seeds_advanced_source: 'session_logs' });
ok('a re-lap with no book totals still falls back (pre-08-29 snapshots)',
  reconcileAdvanced(9100, 300, 10779),
  { seeds_advanced: 9100, seeds_advanced_source: 'session_logs' });
// lap rollover — the exact answer for the case the fallback used to guess at
ok('lap rollover is computed, not guessed (the 08-29 feed case: 6019, not 13199)',
  reconcileAdvanced(13199, 979, 6898, 12180, 11938),
  { seeds_advanced: 6019, seeds_advanced_source: 'lap_rollover' });
ok('a rollover off a fully-walked book is just the new lap',
  reconcileAdvanced(9999, 202, 11892, 11990, 11892),
  { seeds_advanced: 202, seeds_advanced_source: 'lap_rollover' });
ok('a SHRUNKEN book is not a rollover and still falls back',
  reconcileAdvanced(9100, 300, 10779, 9000, 10800),
  { seeds_advanced: 9100, seeds_advanced_source: 'session_logs' });
ok('a rollover with no session-log sum still answers',
  reconcileAdvanced(null, 500, 6898, 12180, 11938),
  { seeds_advanced: 5540, seeds_advanced_source: 'lap_rollover' });
ok('book delta still wins when the walk counter moved forward',
  reconcileAdvanced(12647, 32486, 24963, 40000, 39000),
  { seeds_advanced: 7523, seeds_advanced_source: 'book_delta' });
ok('an unreadable state file with no logs either reports nothing',
  reconcileAdvanced(null, null, null),
  { seeds_advanced: null, seeds_advanced_source: 'none' });
ok('a lane that walked nothing reports zero, not a fallback',
  reconcileAdvanced(0, 10937, 10937),
  { seeds_advanced: 0, seeds_advanced_source: 'book_delta' });

// walkRateTrend — a baseline measured the other way must not arm the alarm
ok('mixed-source baseline reports the percentage but never escalates',
  walkRateTrend(7523, 12647, ROAD, false),
  { seeds_advanced_prev: 12647, walk_rate_change_pct: -40.5, throughput_bound: null });
ok('same-source baseline arms the alarm again',
  walkRateTrend(7523, 12647, ROAD, true),
  { seeds_advanced_prev: 12647, walk_rate_change_pct: -40.5, throughput_bound: true });

// laneYield — what a lane PRODUCED, beside what it consumed
ok('the 08-26 peer-sweep case: real work, one lead, near-dead but not dead',
  laneYield(198, 1, 219),
  { channels_in_cycle: 198, pitchable_in_cycle: 1, pitchable_rate_pct: 0.5, pitchable_per_seed: 0.0046, yield_dead: false });
ok('the 08-25 shape: thousands of channels, nothing above the bar -> the alarm fires',
  laneYield(3223, 0, 7200),
  { channels_in_cycle: 3223, pitchable_in_cycle: 0, pitchable_rate_pct: 0, pitchable_per_seed: 0, yield_dead: true });
ok('a healthy lane never trips it',
  laneYield(3135, 168, 6222),
  { channels_in_cycle: 3135, pitchable_in_cycle: 168, pitchable_rate_pct: 5.4, pitchable_per_seed: 0.027, yield_dead: false });
ok('a quiet lane is not accused — below the work floor, zero is just quiet',
  laneYield(3, 0, 10),
  { channels_in_cycle: 3, pitchable_in_cycle: 0, pitchable_rate_pct: 0, pitchable_per_seed: 0, yield_dead: false });
ok('a lane that wrote nothing at all reports nothing, not a divide-by-zero',
  laneYield(undefined, undefined, null),
  { channels_in_cycle: 0, pitchable_in_cycle: 0, pitchable_rate_pct: null, pitchable_per_seed: null, yield_dead: false });
ok('unknown seed advance still gives the channel-side rate',
  laneYield(106, 6, null),
  { channels_in_cycle: 106, pitchable_in_cycle: 6, pitchable_rate_pct: 5.7, pitchable_per_seed: null, yield_dead: false });

// classifyKeyProbe — a spent key and a dead project both answer 403, and they need
// different answers (wait for midnight vs replace the key), so the split matters.
ok('200 is the only healthy answer', classifyKeyProbe(200, ''), 'working');
ok('quotaExceeded is spent-for-today',
  classifyKeyProbe(403, '{"error":{"errors":[{"reason":"quotaExceeded"}],"message":"The request cannot be completed because you have exceeded your quota."}}'),
  'quota_exhausted');
ok('a suspended project is not a spent key',
  classifyKeyProbe(403, '{"error":{"errors":[{"reason":"accessNotConfigured"}],"message":"YouTube Data API v3 has not been used in project 123"}}'),
  'blocked');
ok('a burst limit is transient, never a retirement', classifyKeyProbe(429, 'rateLimitExceeded'), 'rate_limited');
ok('a bad key string is its own verdict',
  classifyKeyProbe(400, '{"error":{"errors":[{"reason":"keyInvalid"}],"message":"Bad Request"}}'), 'invalid');
ok('anything unrecognised stays unrecognised', classifyKeyProbe(500, 'backend error'), 'other');

// missingDebriefs — the window, not the contents. A far-future date has no report
// for any of its seven prior days, so the whole window comes back, which pins the
// two things that can silently go wrong: the count, and today never appearing in
// its own missing list (the agent reading this is the one about to write it).
const future = missingDebriefs('2099-01-08');
ok('a cycle is never listed as missing its own report', future.some((m) => m.date === '2099-01-08'), false);
ok('seven completed cycles, newest first',
  future.map((m) => m.date).slice(0, 7),
  ['2099-01-07', '2099-01-06', '2099-01-05', '2099-01-04', '2099-01-03', '2099-01-02', '2099-01-01']);
ok('no metrics and no flag for a cycle that never ran',
  future[0], { date: '2099-01-07', has_metrics: false, reason: null });
// THE REGRESSION (2026-09-27). The 7-day window forgot the gap it was written for:
// 2026-09-17/18/19 aged out of it by 09-25 and the field read `[]` for two cycles
// while six reports were owed. A date with grounded metrics on disk is still
// writable however old it is, so it must still be listed.
const liveMissing = missingDebriefs(new Date().toISOString().slice(0, 10));
ok('an old gap that still has its metrics file is not forgotten',
  liveMissing.some((m) => m.has_metrics && m.date < new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)),
  true);
ok('newest first', liveMissing.map((m) => m.date).join() ===
  [...liveMissing.map((m) => m.date)].sort().reverse().join(), true);
ok('the list is capped so a backlog cannot crowd out the cycle',
  liveMissing.length <= MAX_MISSING_DEBRIEFS, true);
console.log(`     (live: ${JSON.stringify(liveMissing.map((m) => m.date))})`);

// summarizeSendLines (2026-09-25) — what this repo's OWN log knows about sending.
const SINCE = '2026-09-24T07:00:00.000Z';
const UNTIL = '2026-09-25T07:00:00.000Z';
// The real 09-24 line: a send that predates the send_sent field entirely.
ok('pre-ce5abf1 line counts the run but leaves the tally unknown',
  summarizeSendLines(
    [{ ts: '2026-09-24T07:20:32.262Z', dry_run: false, manual_send_run: true, send_attempted: 18, send_exit: 0 }],
    SINCE, UNTIL),
  { runs: 1, attempted_sum: 18, sent_sum: null, failed_sum: null, dry_runs_excluded: 0 });
// A clean send reports zero failures as zero, not as "no idea".
ok('a measured clean send sums failed to 0, not null',
  summarizeSendLines(
    [{ ts: '2026-09-25T06:00:00.000Z', dry_run: false, manual_send_run: true, send_attempted: 10, send_sent: 10, send_failed: 0 }],
    SINCE, UNTIL),
  { runs: 1, attempted_sum: 10, sent_sum: 10, failed_sum: 0, dry_runs_excluded: 0 });
ok('dry runs are excluded and counted separately',
  summarizeSendLines(
    [{ ts: '2026-09-24T07:36:10.839Z', dry_run: true, manual_send_run: true, send_attempted: 10 }],
    SINCE, UNTIL),
  { runs: 0, attempted_sum: 0, sent_sum: null, failed_sum: null, dry_runs_excluded: 1 });
ok('lines outside the cycle window are ignored',
  summarizeSendLines(
    [{ ts: '2026-09-25T07:20:33.098Z', dry_run: false, manual_send_run: true, send_attempted: 10, send_sent: 10 }],
    SINCE, UNTIL),
  { runs: 0, attempted_sum: 0, sent_sum: null, failed_sum: null, dry_runs_excluded: 0 });
ok('a tick line is not a send',
  summarizeSendLines([{ ts: '2026-09-24T09:00:00.000Z', dry_run: false, approved_prepped: 4 }], SINCE, UNTIL),
  { runs: 0, attempted_sum: 0, sent_sum: null, failed_sum: null, dry_runs_excluded: 0 });
// The whole point: two real sends, only one of which this repo launched. The gap between
// attempted_sum and the database count is what says work ran outside the loop.
ok('two runs sum, and a partly-measured cycle keeps the measured part',
  summarizeSendLines([
    { ts: '2026-09-24T07:20:32.262Z', dry_run: false, manual_send_run: true, send_attempted: 18, send_exit: 0 },
    { ts: '2026-09-24T19:00:00.000Z', dry_run: false, manual_send_run: true, send_attempted: 8, send_sent: 8, send_failed: 0 },
  ], SINCE, UNTIL),
  { runs: 2, attempted_sum: 26, sent_sum: 8, failed_sum: 0, dry_runs_excluded: 0 });

// sendPlanHealth / siegePlanFacts / cyclePacificDay — telling "nobody approved the
// batch" apart from "nothing to send". The 2026-09-29 shape is the first case.
const PLAN_29 = {
  summary: {
    day: '2026-09-29', email_paused: false, day_cap: 150,
    offer_problems: { 'super-fan': ['paused'], 'time-offer': ['no video'] },
    inboxes: [
      { live: true, free_before_fill: 8 },
      { live: true, free_before_fill: 8 },
      { live: false, free_before_fill: 0 },
    ],
  },
  assignments: new Array(150).fill({ lead_id: 'x' }),
};
ok('plan facts read off the real shape',
  siegePlanFacts(PLAN_29),
  { plan_found: true, plan_day: '2026-09-29', email_paused: false, day_cap: 150,
    planned: 150, mailbox_slots: 16, live_inboxes: 2, offers_blocked: 2 });
ok('blocked offers count as an array too',
  siegePlanFacts({ summary: { offer_problems: [{ offer: 'a' }] } }).offers_blocked, 1);
ok('a dead inbox contributes no slots',
  siegePlanFacts({ summary: { inboxes: [{ live: false, free_before_fill: 12 }] } }).mailbox_slots, 0);
ok('a renamed key costs one null, not the block',
  siegePlanFacts({ summary: { day_cap: 'oops' }, assignments: [1] }),
  { plan_found: true, plan_day: null, email_paused: null, day_cap: null,
    planned: 1, mailbox_slots: null, live_inboxes: null, offers_blocked: null });
ok('garbage is no plan', siegePlanFacts('nope').plan_found, false);
ok('null is no plan', siegePlanFacts(null).plan_found, false);

const h29 = sendPlanHealth(siegePlanFacts(PLAN_29), 4, 4);
ok('09-29: 150 planned, all 4 sends were ours -> awaiting approval',
  [h29.sent_elsewhere, h29.unpushed_planned, h29.approval_pending, h29.binding_constraint],
  [0, 150, true, 'awaiting_approval']);
// The real Monday 2026-09-28: 100-email ramp, 33 free slots, 34 loaded of which this
// repo pushed 2. It stopped one short of the mailbox ceiling, so no ceiling is claimed.
const PLAN_28 = {
  summary: {
    day: '2026-09-28', email_paused: false, day_cap: 100,
    inboxes: [{ live: true, free_before_fill: 33 }],
  },
  assignments: new Array(100).fill({ lead_id: 'x' }),
};
ok('09-28: 34 loaded, 2 of them ours -> the batch moved, no ceiling reached',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_28), 34, 2);
    return [h.sent_elsewhere, h.approval_pending, h.binding_constraint]; })(),
  [32, false, 'partial_push']);
ok('one more email and the mailbox ceiling is the honest answer',
  sendPlanHealth(siegePlanFacts(PLAN_28), 35, 2).binding_constraint, 'mailbox_slots');
ok('a day that filled the ramp names the ramp',
  sendPlanHealth(
    siegePlanFacts({ ...PLAN_29, summary: { ...PLAN_29.summary, day_cap: 10 } }), 12, 2,
  ).binding_constraint, 'day_cap');
ok('a deliberate email pause is not a missing approval',
  (() => { const h = sendPlanHealth(
    siegePlanFacts({ ...PLAN_29, summary: { ...PLAN_29.summary, email_paused: true } }), 0, 0);
    return [h.approval_pending, h.binding_constraint]; })(),
  [false, 'email_paused']);
// An unmeasured cycle must not read as a quiet one — the same rule summarizeSendLines keeps.
ok('no send count -> no verdict',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_29), null, 4);
    return [h.sent_elsewhere, h.approval_pending, h.binding_constraint]; })(),
  [null, null, null]);
ok('Siege never ran -> no plan, and no approval claim',
  (() => { const h = sendPlanHealth(siegePlanFacts(null), 4, 4);
    return [h.plan_found, h.approval_pending, h.binding_constraint]; })(),
  [false, null, null]);
// --- the push that was killed rather than finished (2026-10-01) ---
// Real numbers: a 150-email plan, 135 reached SmartLead, none of them ours, and
// siege-plan.service ended `timeout` after systemd SIGTERMed the push mid-batch.
const PLAN_1001 = {
  summary: {
    day: '2026-10-01', email_paused: false, day_cap: 150,
    inboxes: new Array(36).fill({ live: true, free_before_fill: 5 }),
  },
  assignments: new Array(150).fill({ lead_id: 'x' }),
};
ok('10-01: a 150-email plan cut off 15 short names the kill, not a soft shortfall',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'timeout');
    return [h.sent_elsewhere, h.unpushed_planned, h.push_unit_result, h.binding_constraint]; })(),
  [135, 15, 'timeout', 'push_killed']);
ok('the same shortfall with the unit reporting success stays partial_push',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'success').binding_constraint, 'partial_push');
ok('no unit verdict measured -> the old answer, never an invented one',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0);
    return [h.push_unit_result, h.binding_constraint]; })(),
  [null, 'partial_push']);
// A kill that lands after the ramp was already full cost nothing, so the ramp is still
// the honest answer.
ok('a real ceiling outranks a late kill',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 150, 0, 'timeout').binding_constraint, 'day_cap');
// pushRunVerdict — only this cycle's run may speak for this cycle.
ok('a run inside the window speaks for it',
  pushRunVerdict('timeout', '2026-10-01T10:17:22.000Z', '2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z'),
  'timeout');
ok('Friday\'s verdict does not describe Sunday',
  pushRunVerdict('timeout', '2026-10-01T10:17:22.000Z', '2026-10-04T07:00:00.000Z', '2026-10-05T07:00:00.000Z'),
  null);
ok('no result -> no verdict', pushRunVerdict(null, '2026-10-01T10:17:22.000Z', '2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z'), null);
ok('unreadable timestamp -> no verdict', pushRunVerdict('timeout', null, '2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z'), null);

// --- a weekend with no plan is not a Monday with no plan (2026-10-04) ---
// The live line, verbatim from `systemctl show siege-plan.timer -p TimersCalendar`.
const CAL = '{ OnCalendar=Mon..Fri *-*-* 06:15:00 America/New_York ; next_elapse=Mon 2026-10-05 10:15:00 UTC }';
ok('Mon..Fri includes Friday 10-02', isSendingDay(CAL, '2026-10-02'), true);
ok('Mon..Fri excludes Saturday 10-03', isSendingDay(CAL, '2026-10-03'), false);
ok('Mon..Fri excludes Sunday 10-04', isSendingDay(CAL, '2026-10-04'), false);
ok('Mon..Fri includes Monday 10-05', isSendingDay(CAL, '2026-10-05'), true);
ok('a comma list is read', isSendingDay('{ OnCalendar=Mon,Wed,Sat *-*-* 06:15:00 ; next_elapse=x }', '2026-10-03'), true);
ok('a comma list excludes what it omits', isSendingDay('{ OnCalendar=Mon,Wed,Sat *-*-* 06:15:00 ; next_elapse=x }', '2026-10-02'), false);
// A range that wraps past Sunday: Sat..Tue covers Sat, Sun, Mon, Tue.
ok('a wrapping range covers Sunday', isSendingDay('OnCalendar=Sat..Tue 06:15:00', '2026-10-04'), true);
ok('a wrapping range still excludes Thursday', isSendingDay('OnCalendar=Sat..Tue 06:15:00', '2026-10-01'), false);
ok('no weekday field means every day', isSendingDay('{ OnCalendar=*-*-* 06:15:00 ; next_elapse=x }', '2026-10-03'), true);
ok('daily means every day', isSendingDay('{ OnCalendar=daily ; next_elapse=x }', '2026-10-03'), true);
ok('an unreadable schedule claims nothing', isSendingDay(null, '2026-10-03'), null);
ok('an abbreviation we do not know claims nothing',
  isSendingDay('OnCalendar=Mon..Zzz 06:15:00', '2026-10-03'), null);

const SAT = { sending_day: false, unit_state: 'failed', unit_last_result: 'timeout', unit_last_started: '2026-10-02T10:17:09.000Z' };
ok('a weekend with no plan names the weekend, and carries the unit it last ran',
  (() => { const h = sendPlanHealth(siegePlanFacts(null), 0, 0, null, SAT);
    return [h.plan_found, h.sending_day, h.binding_constraint, h.push_unit_result, h.unit_last_result]; })(),
  [false, false, 'not_a_sending_day', null, 'timeout']);
ok('a sending day with no plan is the loud one',
  sendPlanHealth(siegePlanFacts(null), 0, 0, null, { ...SAT, sending_day: true }).binding_constraint,
  'plan_missing_on_sending_day');
// A hand-driven batch does not excuse a missing plan: before this the day read
// `partial_push`, which says a plan moved part of itself.
ok('a hand-driven batch does not excuse a missing plan',
  sendPlanHealth(siegePlanFacts(null), 12, 0, null, { ...SAT, sending_day: true }).binding_constraint,
  'plan_missing_on_sending_day');
ok('an unknown schedule leaves the old answer alone',
  sendPlanHealth(siegePlanFacts(null), 4, 4, null,
    { sending_day: null, unit_state: null, unit_last_result: null, unit_last_started: null },
  ).binding_constraint, null);
ok('a plan that exists is judged on the plan, not the calendar',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'timeout', { ...SAT, sending_day: true })
    .binding_constraint, 'push_killed');

// The plan directory is named for the day the cycle covers, not the day the debrief runs.
ok('cycle day is the PT day that just ended', cyclePacificDay('2026-09-29T07:00:00.000Z'), '2026-09-29');
ok('cycle day across a PT month boundary', cyclePacificDay('2026-09-30T07:00:00.000Z'), '2026-09-30');

// --- recovery_budget: the paid lane and the enrichment bill as one budget ---

// Apify's own ledger line, off the top of a real 2026-10-01 run log.
ok('apify ledger line',
  apifyLedgerLine('Apify: plan STARTER, month $21.06 of $100.00 used, $78.94 left (cycle ends 2026-10-31)\n'),
  { used: 21.06, cap: 100, left: 78.94, cycleEnds: '2026-10-31' });
ok('no ledger line (lane rested, log is one line)', apifyLedgerLine('[apify-loop] resting: $16.11 left\n'), null);

// THE CASE THIS BLOCK EXISTS FOR. The 04:20 batch on 2026-10-01 flipped 19 itself
// and really recovered 59, because recovery-lane.timer parked 40 mid-scrape.
const BATCH_0420 = 'Scrape done: 74 found, 26 no email, 0 failed. Estimated Apify charge $7.02.\n'
  + 'Verify done: 26 ZeroBounce checks, 19 leads flipped to approved_hold.\n'
  + 'Recovered: 59 of 74 scraped addresses now in approved_hold (19 flipped here, 40 already parked by the recovery lane).\n';
ok('batch facts prefer Recovered: over flipped',
  apifyBatchFacts(BATCH_0420), { scraped: 100, found: 74, recovered: 59 });
ok('pre-2026-10-01 log falls back to flipped (and so undercounts, by design)',
  apifyBatchFacts('Scrape done: 74 found, 26 no email, 0 failed.\nVerify done: 26 ZeroBounce checks, 19 leads flipped to approved_hold.\n'),
  { scraped: 100, found: 74, recovered: 19 });
ok('a crashed verify leaves recovery unknown, not zero',
  apifyBatchFacts('Scrape done: 74 found, 26 no email, 0 failed.\nfetch failed\n'),
  { scraped: 100, found: 74, recovered: null });
ok('no scrape line at all', apifyBatchFacts('Apify: plan STARTER, month $0.00 of $100.00 used\n'), null);

// Enrichment chain: the 2026-10-01 shape, two finished batches and one still running.
const CHAIN = '[2026-09-30T06:59:00Z] batch finished: exit=0 done=9 failed=0 log=x\n'
  + '[2026-09-30T18:13:29Z] launching batch: count=2 pool=4 excluded=2 file=x\n'
  + '[2026-09-30T18:41:34Z] batch finished: exit=0 done=2 failed=0 log=x\n'
  + '[2026-10-01T01:24:32Z] launching batch: count=66 pool=67 excluded=1 file=x\n'
  + '[2026-10-01T04:09:04Z] batch finished: exit=0 done=66 failed=1 log=x\n'
  + '[2026-10-01T06:36:46Z] launching batch: count=59 pool=60 excluded=1 file=x\n'
  + '[2026-10-01T09:00:00Z] batch finished: exit=0 done=59 failed=0 log=x\n';
ok('chain facts inside the window only, with the in-flight batch counted',
  enrichmentChainFacts(CHAIN, '2026-09-30T07:00:00Z', '2026-10-01T07:00:00Z'),
  { batches: 2, leads_done: 68, leads_failed: 1, in_flight: 1 });
ok('a quiet cycle is zeros, not a crash',
  enrichmentChainFacts(CHAIN, '2026-09-28T07:00:00Z', '2026-09-29T07:00:00Z'),
  { batches: 0, leads_done: 0, leads_failed: 0, in_flight: 0 });

// The projection. $71.92 left, $10 reserved -> 882 channels at $0.0702.
ok('remaining allowance priced in leads and then in OpenRouter dollars',
  projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702,
    recoveredInCycle: 244, channelsInCycle: 400,
    enrichedInCycle: 133, accountSpendUsd: 19.5239, balanceUsd: 165.28,
  }),
  { channels_affordable: 882, recovered_per_channel: 0.61, projected_leads: 538,
    openrouter_usd_per_enriched_lead: 0.1468, openrouter_cost_of_projected_leads_usd: 78.98,
    openrouter_balance_usd: 165.28, balance_covers_projected: true });
ok('a balance that does not cover the projection says so',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702, recoveredInCycle: 244, channelsInCycle: 400,
    enrichedInCycle: 133, accountSpendUsd: 19.5239, balanceUsd: 40,
  }); return p.balance_covers_projected; })(),
  false);
ok('an unmeasured recovery rate projects null, never 0 leads',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702, recoveredInCycle: null, channelsInCycle: 0,
    enrichedInCycle: 0, accountSpendUsd: null, balanceUsd: 165.28,
  }); return [p.projected_leads, p.openrouter_usd_per_enriched_lead, p.balance_covers_projected]; })(),
  [null, null, null]);
ok('a drained allowance affords nothing and prices nothing',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: -3.89, pricePerRun: 0.0702, recoveredInCycle: 244, channelsInCycle: 400,
    enrichedInCycle: 133, accountSpendUsd: 19.5239, balanceUsd: 165.28,
  }); return [p.channels_affordable, p.projected_leads, p.openrouter_cost_of_projected_leads_usd]; })(),
  [0, 0, 0]);

// siegePushOutcome — `partial_push` has to say what it dropped and why (2026-10-06).
const PUSH_LOG = [
  '[2026-10-05T10:19:43Z]   |   SENT  rec4aKcJEpS5qMJes    a@b.com  smartlead_lead=4687801266',
  '[2026-10-05T10:21:08Z]   ! listCampaignMailboxes 429 on 4010851: Account rate limit exceeded.',
  '[2026-10-05T10:21:08Z] ESCALATE siege push did not finish cleanly {"batch_id": "x", "rc": 1, "pushed": 0}',
  '[2026-10-05T10:23:38Z]   |   FAIL  recLvxmU118ICzpjS    SmartLead did not add the lead (no reason given)',
  '[2026-10-05T10:23:45Z]   |   FAIL  rec1tBuxupmUrjDI5    SmartLead did not add the lead (no reason given)',
  '[2026-10-05T10:30:54Z]   |   FAIL  rec65GgJhvRkI5T92    SmartLead add-lead 429 Too Many Requests on campaign 4010801: Account rate limit exceeded.',
  '[2026-10-05T10:30:54Z] ESCALATE siege could not start a campaign that has leads in it {"campaign": "4010801", "leads": 1, "http": 429}',
  '[2026-10-05T10:32:33Z]   | Some Channel Name FAIL  236w  fails 2->2->2->2',
  '[2026-10-06T10:19:43Z]   |   SENT  recNextCycleLeadId9    c@d.com  smartlead_lead=1',
].join('\n');
const PUSH = siegePushOutcome(PUSH_LOG, '2026-10-05T07:00:00.000Z', '2026-10-06T07:00:00.000Z');
ok('counts per-lead sends and failures inside the window only, ignoring a writer\'s own FAIL',
  [PUSH.sent, PUSH.failed], [1, 3]);
ok('a batch that escalated having pushed nothing is counted apart from the leads',
  [PUSH.batches_failed_before_first_lead, PUSH.escalations], [1, 2]);
ok('identical refusals collapse to one counted reason, campaign id generalised',
  PUSH.reasons,
  [{ reason: 'SmartLead did not add the lead (no reason given)', leads: 2 },
   { reason: 'SmartLead add-lead 429 Too Many Requests on campaign <id>: Account rate limit exceeded.', leads: 1 }]);
ok('a lead id inside a reason is not kept',
  normalizePushReason('could not roll back send row recLvxmU118ICzpjS'),
  'could not roll back send row <lead>');
ok('a log with nothing in the window reports zeros, not nulls — it was measured',
  (() => { const p = siegePushOutcome(PUSH_LOG, '2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z');
    return [p.log_found, p.sent, p.failed, p.reasons.length]; })(),
  [true, 0, 0, 0]);
ok('push_outcome defaults to not-measured so an unreadable log never reads as a clean push',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'success');
    return [h.push_outcome.log_found, h.push_outcome.sent, h.binding_constraint]; })(),
  [false, null, 'partial_push']);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
