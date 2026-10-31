import { bulkRewriteShape, bandGateFacts, fleetFacts, inboxGateFacts, apifyBatchFacts, apifyLedgerLine, NO_PUSH_OUTCOME, normalizePushReason, offerFromBatchId, siegeApprovedLeadIds, siegePlanLeadIds, siegePushOutcome, classifyKeyProbe, cyclePacificDay, costWindows, enrichmentChainFacts, isSendingDay, perEnrichedLeadCost, PER_LEAD_SAMPLE_FLOOR, projectRecoveryBudget, MAX_MISSING_DEBRIEFS, missingDebriefs, NO_UNIT, pushRunVerdict, siegeRunAlarm, unitStartedAt, sendPlanHealth, siegePlanFacts, summarizeSendLines, isVerifiedOrBeyond, laneYield, priorAdvanceSource, priorSeedsAdvanced, priorSeedsWalked, reconcileAdvanced, sessionSeedsAdvanced, sessionStartMs, walkRateTrend } from './debrief-data.ts';
import { MAX_SHELF_STRANDED_IDS, recoveredTally, shelfTally, type ShelfRow } from '../../src/db.ts';

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
      { live: true, free_before_fill: 8, message_per_day: 15, followups_due: 7 },
      { live: true, free_before_fill: 8, message_per_day: 15, followups_due: 7 },
      { live: false, free_before_fill: 0, message_per_day: 15, followups_due: 99 },
    ],
  },
  assignments: new Array(150).fill({ lead_id: 'x' }),
};
ok('plan facts read off the real shape',
  siegePlanFacts(PLAN_29),
  { plan_found: true, plan_day: '2026-09-29', email_paused: false, day_cap: 150,
    planned: 150, mailbox_slots: 16, live_inboxes: 2, offers_blocked: 2,
    mailbox_capacity: 30, followups_due: 14, inboxes_full: 0,
    waiting_for_a_slot: null, waiting_by_tier: null,
    inboxes_total: 3, inboxes_no_campaign: 0, inboxes_only_no_campaign: 0,
    plan_generated_at: null });
ok('blocked offers count as an array too',
  siegePlanFacts({ summary: { offer_problems: [{ offer: 'a' }] } }).offers_blocked, 1);
ok('a dead inbox contributes no slots',
  siegePlanFacts({ summary: { inboxes: [{ live: false, free_before_fill: 12 }] } }).mailbox_slots, 0);
ok('a dead inbox owes no follow-ups we can act on either',
  siegePlanFacts({ summary: { inboxes: [{ live: false, message_per_day: 15, followups_due: 40 }] } }),
  { plan_found: true, plan_day: null, email_paused: null, day_cap: null, planned: null,
    mailbox_slots: 0, live_inboxes: 0, offers_blocked: null,
    mailbox_capacity: 0, followups_due: 0, inboxes_full: 0,
    waiting_for_a_slot: null, waiting_by_tier: null,
    inboxes_total: 1, inboxes_no_campaign: 0, inboxes_only_no_campaign: 0,
    plan_generated_at: null });
// THE 2026-10-12 SHAPE: the healthiest fleet of the week and the worst new-person
// volume of the week, because follow-ups outran the whole allowance. The slot count
// alone reads identically to a suspension wave, which is why the three fields exist.
ok('follow-ups eating the fleet is readable, not just the small slot count',
  siegePlanFacts({
    summary: {
      day: '2026-10-12', day_cap: 870,
      inboxes: [
        { live: true, message_per_day: 15, followups_due: 23, free_before_fill: 0 },
        { live: true, message_per_day: 15, followups_due: 30, free_before_fill: 0 },
        { live: true, message_per_day: 15, followups_due: 2, free_before_fill: 13 },
      ],
    },
    assignments: new Array(13).fill({ lead_id: 'x' }),
  }),
  { plan_found: true, plan_day: '2026-10-12', email_paused: null, day_cap: 870,
    planned: 13, mailbox_slots: 13, live_inboxes: 3, offers_blocked: null,
    mailbox_capacity: 45, followups_due: 55, inboxes_full: 2,
    waiting_for_a_slot: null, waiting_by_tier: null,
    inboxes_total: 3, inboxes_no_campaign: 0, inboxes_only_no_campaign: 0,
    plan_generated_at: null });
ok('a renamed key costs one null, not the block',
  siegePlanFacts({ summary: { day_cap: 'oops' }, assignments: [1] }),
  { plan_found: true, plan_day: null, email_paused: null, day_cap: null,
    planned: 1, mailbox_slots: null, live_inboxes: null, offers_blocked: null,
    mailbox_capacity: null, followups_due: null, inboxes_full: null,
    waiting_for_a_slot: null, waiting_by_tier: null,
    inboxes_total: null, inboxes_no_campaign: null, inboxes_only_no_campaign: null,
    plan_generated_at: null });
// THE 2026-10-16 SHAPE: every slot went to the tier that had already heard from us,
// and 949 ready people below it waited. The plan carried that all along.
ok('the queue behind a 1% first-touch day is summed and kept per tier',
  (() => {
    const f = siegePlanFacts({
      summary: {
        day: '2026-10-16',
        new_offers_starting: { whale: 82, strong7: 0, other7: 0 },
        waiting_for_a_slot: { whale: 63, strong7: 141, other7: 808 },
      },
    });
    return [f.waiting_for_a_slot, f.waiting_by_tier];
  })(),
  [1012, { whale: 63, strong7: 141, other7: 808 }]);
ok('a renamed or non-numeric waiting tier costs that tier, not the sum',
  (() => {
    const f = siegePlanFacts({ summary: { waiting_for_a_slot: { whale: 5, strong7: 'oops' } } });
    return [f.waiting_for_a_slot, f.waiting_by_tier];
  })(),
  [5, { whale: 5 }]);
ok('a plan with no waiting block costs nulls, not the plan',
  (() => {
    const f = siegePlanFacts({ summary: { day: '2026-09-29' } });
    return [f.waiting_for_a_slot, f.waiting_by_tier, f.plan_found];
  })(),
  [null, null, true]);
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
// THE 2026-10-29 SHAPE: SmartLead's campaign list came back empty on the live pass, so
// all 58 mailboxes read "no Siege campaign yet", 12 of them with no other reason. The
// day planned nobody, refused to push, and printed binding_constraint:null.
const PLAN_29_OCT = {
  summary: {
    day: '2026-10-29', email_paused: false, day_cap: 870,
    inboxes: [
      ...new Array(45).fill(null).map(() => ({
        live: false, free_before_fill: 0, campaign_id: null,
        why_not: 'suspended in SmartLead; no Siege campaign yet',
      })),
      ...new Array(12).fill(null).map(() => ({
        live: false, free_before_fill: 0, campaign_id: null,
        why_not: 'no Siege campaign yet',
      })),
      { live: false, free_before_fill: 0, campaign_id: null,
        why_not: 'health watch: follow-ups only (recovering, 3h of 48h at 90+); no Siege campaign yet' },
    ],
  },
  assignments: [],
};
ok('a blanked campaign list is counted, and only the mailboxes it alone stopped',
  (() => { const f = siegePlanFacts(PLAN_29_OCT);
    return [f.inboxes_total, f.inboxes_no_campaign, f.inboxes_only_no_campaign, f.planned]; })(),
  [58, 58, 12, 0]);
ok('10-29: a plan that planned nobody names the blanked campaign list',
  sendPlanHealth(siegePlanFacts(PLAN_29_OCT), 0, 0, 'exit-code',
    { ...NO_UNIT, sending_day: true }).binding_constraint,
  'campaign_list_empty');
ok('a fleet that genuinely had no room is not blamed on the campaign list',
  sendPlanHealth(
    siegePlanFacts({
      summary: { day: '2026-10-29', email_paused: false, day_cap: 870,
        inboxes: [{ live: false, free_before_fill: 0, why_not: 'suspended in SmartLead' }] },
      assignments: [],
    }), 0, 0, null, { ...NO_UNIT, sending_day: true }).binding_constraint,
  'no_mailbox_slots');
ok('a plan with slots that still planned nobody wants a human, not a guess',
  sendPlanHealth(
    siegePlanFacts({
      summary: { day: '2026-10-29', email_paused: false, day_cap: 870,
        inboxes: [{ live: true, free_before_fill: 40 }] },
      assignments: [],
    }), 0, 0, null, { ...NO_UNIT, sending_day: true }).binding_constraint,
  'planned_nobody');
// One new mailbox awaiting its campaign is a real per-mailbox state, not a blanked list.
ok('a single campaign-less mailbox is not the whole list going dark',
  sendPlanHealth(
    siegePlanFacts({
      summary: { day: '2026-10-29', email_paused: false, day_cap: 870,
        inboxes: [
          { live: false, free_before_fill: 0, why_not: 'no Siege campaign yet' },
          { live: true, free_before_fill: 0, why_not: '' },
        ] },
      assignments: [],
    }), 0, 0, null, { ...NO_UNIT, sending_day: true }).binding_constraint,
  'no_mailbox_slots');
// A plan with no inbox list cannot answer the question — unknown, not a clean fleet.
ok('no inbox list costs three nulls, not three zeros',
  (() => { const f = siegePlanFacts({ summary: { day: '2026-10-29' } });
    return [f.inboxes_total, f.inboxes_no_campaign, f.inboxes_only_no_campaign]; })(),
  [null, null, null]);
// A hand-driven batch means the day moved; the branches below describe it better.
ok('a zero plan beside real sends is not the day\'s constraint',
  sendPlanHealth(siegePlanFacts(PLAN_29_OCT), 40, 0, 'success',
    { ...NO_UNIT, sending_day: true }).binding_constraint !== 'campaign_list_empty', true);
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

// --- the unit that crashed and sent nothing (2026-10-30) ---
// The live Friday 2026-10-30 shape: 69 planned, 69 mailbox slots, a whole plan on disk,
// and the oneshot died in its `--samples 20` step on a TypeError inside why_no_email().
// Steps 3-5 (siege-approve, the live push, the report) never ran, so no approval.json
// was written and 69 people with written subjects got no email. The old ladder printed
// `awaiting_approval` — a cause that cannot exist under the 2026-09-30 standing approval.
const PLAN_1030 = {
  summary: {
    day: '2026-10-30', email_paused: false, day_cap: 870,
    inboxes: new Array(9).fill({ live: true, free_before_fill: 8 }),
  },
  assignments: new Array(69).fill({ lead_id: 'x' }),
};
const UNIT_1030 = { ...NO_UNIT, sending_day: true };
ok('10-30: a crashed unit that never reached the push names the step, not an approval',
  (() => { const h = sendPlanHealth(
    siegePlanFacts(PLAN_1030), 0, 0, 'exit-code', UNIT_1030, NO_PUSH_OUTCOME, false);
    return [h.approval_pending, h.approval_recorded, h.unpushed_planned, h.binding_constraint]; })(),
  [true, false, 69, 'unit_died_before_push']);
// Same crash, but the approve step DID run, so the push itself is what to look at.
ok('an approval on disk moves the blame to the push step',
  sendPlanHealth(siegePlanFacts(PLAN_1030), 0, 0, 'exit-code', UNIT_1030, NO_PUSH_OUTCOME, true)
    .binding_constraint, 'push_unit_failed');
// Unmeasured must not borrow the more specific name: it stays the generic failure.
ok('an unreadable approval record stays generic, never unit_died_before_push',
  (() => { const h = sendPlanHealth(
    siegePlanFacts(PLAN_1030), 0, 0, 'exit-code', UNIT_1030);
    return [h.approval_recorded, h.binding_constraint]; })(),
  [null, 'push_unit_failed']);
// A unit that reported success and sent nothing is a different question, and the one
// branch this fix must not swallow: the 09-29 assertion above still holds.
ok('a successful unit that sent nothing is still an approval question',
  sendPlanHealth(siegePlanFacts(PLAN_1030), 0, 0, 'success', UNIT_1030, NO_PUSH_OUTCOME, false)
    .binding_constraint, 'awaiting_approval');
// No verdict measured is not a crash. Guards the 2026-10-01 rule one branch over.
ok('no unit verdict -> no crash claimed',
  sendPlanHealth(siegePlanFacts(PLAN_1030), 0, 0, null, UNIT_1030, NO_PUSH_OUTCOME, false)
    .binding_constraint, 'awaiting_approval');
// A deliberate pause outranks it: nothing crashed the day that was switched off.
ok('an email pause outranks a crashed unit',
  sendPlanHealth(
    siegePlanFacts({ ...PLAN_1030, summary: { ...PLAN_1030.summary, email_paused: true } }),
    0, 0, 'exit-code', UNIT_1030, NO_PUSH_OUTCOME, false).binding_constraint, 'email_paused');
// THE 10-29 SHAPE MUST NOT BE RENAMED BY THIS FIX. That day the unit also exited
// non-zero, but its plan held nobody and it refused on purpose, which is a different
// repair. planned:0 is ranked above this branch and keeps its own name.
ok('a crashed unit does not steal campaign_list_empty from a plan that held nobody',
  sendPlanHealth(siegePlanFacts(PLAN_29_OCT), 0, 0, 'exit-code', UNIT_1030, NO_PUSH_OUTCOME, true)
    .binding_constraint, 'campaign_list_empty');
// A day that moved emails and then died keeps push_killed: it says what stopped the day
// after it had already sent, which is the 2026-10-01 question, not this one.
ok('a push that sent something before dying stays push_killed',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'timeout', NO_UNIT, NO_PUSH_OUTCOME, false)
    .binding_constraint, 'push_killed');

// --- the hourly send-path alarm (2026-10-30) ---
// Nothing watched the send path hourly, so 10-29 and 10-30 both failed before 10:21Z and
// neither was visible until the next midnight. These assert the step-attribution ladder
// and, more importantly, every way it must stay SILENT.
const ALARM = {
  sendingDay: true as boolean | null,
  lastResult: 'exit-code' as string | null,
  lastStartedISO: '2026-10-30T10:15:12.000Z' as string | null,
  startedPacificDay: '2026-10-30' as string | null,
  today: '2026-10-30',
  samplesRecorded: false as boolean | null,
  approvalRecorded: false as boolean | null,
};
ok('10-30: no samples.json puts the failure at the sample step',
  (() => { const a = siegeRunAlarm(ALARM);
    return [a?.step, a?.run_key]; })(),
  ['samples', '2026-10-30T10:15:12.000Z']);
ok('samples written but no approval blames the approve step',
  siegeRunAlarm({ ...ALARM, samplesRecorded: true })?.step, 'approve');
ok('both files written puts it in the push or the report',
  siegeRunAlarm({ ...ALARM, samplesRecorded: true, approvalRecorded: true })?.step,
  'push_or_report');
ok('no state directory leaves the step unknown, never guessed',
  siegeRunAlarm({ ...ALARM, samplesRecorded: null, approvalRecorded: null })?.step, 'unknown');
// Silence, every way. A success is never second-guessed off the step files, which outlive
// the run that wrote them and would re-accuse a clean day.
ok('a successful run is never an alarm',
  siegeRunAlarm({ ...ALARM, lastResult: 'success' }), null);
ok('no verdict at all is not a failure',
  siegeRunAlarm({ ...ALARM, lastResult: null }), null);
ok('a weekend is not a failed sending day',
  siegeRunAlarm({ ...ALARM, sendingDay: false }), null);
ok('an unknown calendar makes no claim',
  siegeRunAlarm({ ...ALARM, sendingDay: null }), null);
// THE ONE THAT MATTERS FOR A WEEKEND: Friday's failed verdict is what the unit still
// reports on Saturday and Sunday, and re-raising it all weekend is noise.
ok('yesterday\'s failure is not today\'s',
  siegeRunAlarm({ ...ALARM, today: '2026-10-31' }), null);
ok('a verdict with no start stamp cannot be placed on a day',
  siegeRunAlarm({ ...ALARM, lastStartedISO: null, startedPacificDay: null }), null);
// The 10-29 run reached the push and refused on purpose; it still deserves the line, but
// pointed at the push rather than at a crash in a reporting helper.
ok('the 10-29 shape is reported against the push, not the sample step',
  siegeRunAlarm({
    ...ALARM, lastStartedISO: '2026-10-29T10:16:50.000Z',
    startedPacificDay: '2026-10-29', today: '2026-10-29',
    samplesRecorded: true, approvalRecorded: true,
  })?.step, 'push_or_report');

// --- a plan that moved and lost nobody is not a shortfall (2026-10-24) ---
// The live 10-23 shape: 150 planned, 148 sent, the two missing held for the next day by
// the approval gate, and the push's own per-person join reading people_lost 0.
const LOSSLESS = {
  ...NO_PUSH_OUTCOME,
  log_found: true, sent: 148, failed: 0, skipped: 17,
  planned_leads: 150, approved_leads: 157, people_emailed: 148,
  people_lost: 0, lost_to_fail: 0, lost_to_skip: 0, lost_silently: 0,
  skipped_then_sent: 17, skipped_unplanned: 0,
  deferred_unapproved: 2, deferred_logged: 2,
};
ok('10-23: a 2-email gap the approval gate deferred is not partial_push',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_1001), 148, 0, 'success', NO_UNIT, LOSSLESS);
    return [h.unpushed_planned, h.push_outcome.people_lost, h.binding_constraint]; })(),
  [2, 0, 'nothing_lost']);
// The point of the field: a real loss still gets named.
ok('one person really lost is still partial_push',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'success', NO_UNIT,
    { ...LOSSLESS, sent: 135, people_emailed: 149, people_lost: 1, lost_to_skip: 1 },
  ).binding_constraint, 'partial_push');
// An unreadable plan cannot clear the day. Unknown is not zero.
ok('no per-person join -> the old conservative answer',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 148, 0, 'success', NO_UNIT, NO_PUSH_OUTCOME)
    .binding_constraint, 'partial_push');
// A lossless push does not excuse a kill or a ceiling: those size or stop the day.
ok('a kill still outranks a lossless join',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 148, 0, 'timeout', NO_UNIT, LOSSLESS)
    .binding_constraint, 'push_killed');
ok('a ceiling the day pressed still outranks a lossless join',
  sendPlanHealth(siegePlanFacts(PLAN_1001), 150, 0, 'success', NO_UNIT, LOSSLESS)
    .binding_constraint, 'day_cap');
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

// Dollars per enriched lead, measured over a window instead of one cycle (2026-10-26).
const PER_LEAD_133 = perEnrichedLeadCost(
  [{ days: 1, spend_usd: 19.5239, leads: 133, days_measured: 1 }]);
ok('a single busy cycle carries the rate on its own',
  [PER_LEAD_133.usd, PER_LEAD_133.window_days, PER_LEAD_133.sample_leads],
  [0.1468, 1, 133]);
// The live 10-26 shape: the pool is bundled out, so the chain trickles and only the
// 30-day window holds enough leads to price one.
const LIVE_WINDOWS = [
  { days: 1, spend_usd: 1.4884, leads: 1, days_measured: 1 },
  { days: 7, spend_usd: 11.83, leads: 8, days_measured: 7 },
  { days: 14, spend_usd: 23.5, leads: 33, days_measured: 14 },
  { days: 30, spend_usd: 128.9, leads: 770, days_measured: 30 },
];
ok('an idle cycle no longer prices a lead at the whole account bill',
  perEnrichedLeadCost(LIVE_WINDOWS),
  { usd: 0.1674, window_days: 30, sample_leads: 770, sample_spend_usd: 128.9, unmeasured: null });
ok('the tightest bound wins, so a hot cycle prices itself and not the month',
  perEnrichedLeadCost([
    { days: 1, spend_usd: 2, leads: 40, days_measured: 1 },
    { days: 30, spend_usd: 100, leads: 900, days_measured: 30 },
  ]),
  { usd: 0.05, window_days: 1, sample_leads: 40, sample_spend_usd: 2, unmeasured: null });
ok('a tie keeps the fresher window',
  perEnrichedLeadCost([
    { days: 1, spend_usd: 4, leads: 40, days_measured: 1 },
    { days: 30, spend_usd: 90, leads: 900, days_measured: 30 },
  ]).window_days,
  1);
ok('too few leads anywhere is unmeasured and says how short it fell',
  perEnrichedLeadCost([
    { days: 1, spend_usd: 1.5, leads: 1, days_measured: 1 },
    { days: 30, spend_usd: 40, leads: 12, days_measured: 30 },
  ]),
  { usd: null, window_days: null, sample_leads: 12, sample_spend_usd: 40, unmeasured: 'sample_below_floor' });
ok('a $0 bill over a real sample is a missing meter, not free enrichment',
  (() => { const p = perEnrichedLeadCost([{ days: 1, spend_usd: 0, leads: 133, days_measured: 1 }]);
    return [p.usd, p.unmeasured]; })(),
  [null, 'spend_reading_zero']);
ok('leads but no spend reading is unknown, not zero cost',
  (() => { const p = perEnrichedLeadCost([{ days: 1, spend_usd: null, leads: 133, days_measured: 0 }]);
    return [p.usd, p.unmeasured]; })(),
  [null, 'no_spend_reading']);

// costWindows: a window is only usable when every day in it was really measured.
const COST_DAYS = [
  { date: '2026-10-26', spend_usd: 1.4884, leads: 1 },
  { date: '2026-10-25', spend_usd: 1.6791, leads: 2 },
  { date: '2026-10-24', spend_usd: 1.7304, leads: 40 },
];
ok('windows fold newest-first and sum both columns',
  costWindows(COST_DAYS, [1, 3]),
  [{ days: 1, spend_usd: 1.4884, leads: 1, days_measured: 1 },
   { days: 3, spend_usd: 4.8979, leads: 43, days_measured: 3 }]);
ok('a window longer than the history is not measurable',
  costWindows(COST_DAYS, [7])[0],
  { days: 7, spend_usd: null, leads: 43, days_measured: 3 });
ok('one missing day nulls the window spend rather than understating it',
  costWindows([COST_DAYS[0]!, { date: '2026-10-25', spend_usd: null, leads: 2 }], [2])[0],
  { days: 2, spend_usd: null, leads: 3, days_measured: 1 });

// The projection. $71.92 left, $10 reserved -> 882 channels at $0.0702.
ok('remaining allowance priced in leads and then in OpenRouter dollars',
  projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702,
    recoveredInCycle: 244, channelsInCycle: 400,
    perLead: PER_LEAD_133, balanceUsd: 165.28,
  }),
  { channels_affordable: 882, recovered_per_channel: 0.61, projected_leads: 538,
    openrouter_usd_per_enriched_lead: 0.1468, per_lead_window_days: 1,
    per_lead_sample_leads: 133, per_lead_sample_spend_usd: 19.5239,
    per_lead_sample_floor: PER_LEAD_SAMPLE_FLOOR, per_lead_unmeasured: null,
    openrouter_cost_of_projected_leads_usd: 78.98,
    openrouter_balance_usd: 165.28, balance_covers_projected: true });
ok('a balance that does not cover the projection says so',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702, recoveredInCycle: 244, channelsInCycle: 400,
    perLead: PER_LEAD_133, balanceUsd: 40,
  }); return p.balance_covers_projected; })(),
  false);
ok('an unmeasured recovery rate projects null, never 0 leads',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: 61.92, pricePerRun: 0.0702, recoveredInCycle: null, channelsInCycle: 0,
    perLead: perEnrichedLeadCost([{ days: 1, spend_usd: null, leads: 0, days_measured: 0 }]),
    balanceUsd: 165.28,
  }); return [p.projected_leads, p.openrouter_usd_per_enriched_lead, p.balance_covers_projected]; })(),
  [null, null, null]);
// The freeze this guards: the allowance resets, channels_affordable jumps, and an
// unpriceable lead must leave the cost unknown instead of multiplying a bad rate.
ok('a reset allowance with an unmeasurable rate leaves the cost unknown, not wrong',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: 90, pricePerRun: 0.0702, recoveredInCycle: 244, channelsInCycle: 400,
    perLead: perEnrichedLeadCost(LIVE_WINDOWS.slice(0, 2)), balanceUsd: 66.86,
  }); return [p.channels_affordable, p.projected_leads, p.openrouter_usd_per_enriched_lead,
    p.openrouter_cost_of_projected_leads_usd, p.balance_covers_projected]; })(),
  [1282, 782, null, null, null]);
ok('a drained allowance affords nothing and prices nothing',
  (() => { const p = projectRecoveryBudget({
    spendableUsd: -3.89, pricePerRun: 0.0702, recoveredInCycle: 244, channelsInCycle: 400,
    perLead: PER_LEAD_133, balanceUsd: 165.28,
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
// 2026-10-07: the 120-char cap landed 4 characters before the only field that answered the
// question, so 106 dropped emails read as unexplained. A quoted reply keeps what it set.
ok('a quoted SmartLead reply keeps the field it actually set',
  normalizePushReason('SmartLead did not add the lead (no reason given; its whole reply was ' +
    '{"ok":true,"upload_count":1,"total_leads":0,"skipped_in_other_campaign_count":1,' +
    '"block_count":0,"duplicate_count":0,"invalid_email_count":0,"invalid_emails":[],' +
    '"already_added_to_campaign":0,"unsubscribed_leads":[],"is_lead_limit_exhausted":false,' +
    '"lead_import_stopped_count":0,"bounce_count":0})'),
  'SmartLead did not add the lead (no reason given; its whole reply was ' +
    'skipped_in_other_campaign_count=1)');
ok('a reply that set nothing says so instead of pasting zeros',
  normalizePushReason('refused; reply was {"ok":true,"upload_count":1,"total_leads":0}'),
  'refused; reply was nothing set');
ok('a reason with no quoted object is left alone',
  normalizePushReason('SmartLead did not add the lead (skipped_in_other_campaign_count=1)'),
  'SmartLead did not add the lead (skipped_in_other_campaign_count=1)');
ok('a truncated body is left exactly as logged rather than guessed at',
  normalizePushReason('reply was {"ok":true,"total_leads":0,"skippe'),
  'reply was {"ok":true,"total_leads":0,"skippe');
ok('a log with nothing in the window reports zeros, not nulls — it was measured',
  (() => { const p = siegePushOutcome(PUSH_LOG, '2026-10-01T07:00:00.000Z', '2026-10-02T07:00:00.000Z');
    return [p.log_found, p.sent, p.failed, p.reasons.length]; })(),
  [true, 0, 0, 0]);
ok('push_outcome defaults to not-measured so an unreadable log never reads as a clean push',
  (() => { const h = sendPlanHealth(siegePlanFacts(PLAN_1001), 135, 0, 'success');
    return [h.push_outcome.log_found, h.push_outcome.sent, h.binding_constraint]; })(),
  [false, null, 'partial_push']);

// 2026-10-09: five of the six emails a 567-plan did not push were SKIPs the parser never
// counted, so five sixths of the shortfall had no counter and no reason. Verbatim shapes.
const SKIP_LOG = [
  '[2026-10-08T10:36:03Z]   |   SKIP  recIUDe7gmSe4yYZ7    batch report marked it failed',
  '[2026-10-08T10:36:03Z]   |   SENT  recnhfAv4wUJgjXm2    a@b.com  smartlead_lead=4714363803',
  '[2026-10-08T10:45:25Z]   |   FAIL  recExVtKOSsDlDFNU    SmartLead did not add the lead (already_added_to_campaign=1)',
  '[2026-10-08T11:26:18Z]   |   SKIP  recfa2yYgXeZzTzgO    batch report marked it failed',
  '[2026-10-08T11:30:39Z]   |     still broken: em dash — 1 em dash(es) outside the sign-off',
  '[2026-10-08T11:43:40Z]   | BiggerPockets Money        FAIL  ethos 125  fails 1->1->1',
].join('\n');
const SKIPS = siegePushOutcome(SKIP_LOG, '2026-10-08T07:00:00.000Z', '2026-10-09T07:00:00.000Z');
ok('a skipped lead is counted apart from a SmartLead refusal',
  [SKIPS.sent, SKIPS.failed, SKIPS.skipped], [1, 1, 2]);
ok('a skip carries its reason alongside the refusals',
  SKIPS.reasons,
  [{ reason: 'batch report marked it failed', leads: 2 },
   { reason: 'SmartLead did not add the lead (already_added_to_campaign=1)', leads: 1 }]);
ok('a writer\'s own gate line is still not a push loss (no lead id on it)',
  (() => { const p = siegePushOutcome(
    '[2026-10-08T11:43:40Z]   | BiggerPockets Money        FAIL  ethos 125  fails 1->1->1\n'
    + '[2026-10-08T11:43:40Z]   |     still broken: em-dash — em or en dash outside the sign-off',
    '2026-10-08T07:00:00.000Z', '2026-10-09T07:00:00.000Z');
    return [p.sent, p.failed, p.skipped, p.reasons.length]; })(),
  [0, 0, 0, 0]);

// 2026-10-10: the SKIP line says only `batch report marked it failed`, which names no rule
// and no remedy. The writer's verdict a few lines up does. Verbatim shapes from the cycle,
// including the interleaved SENT that defeated a rolling buffer and made per-batch keying
// necessary.
const GATE_LOG = [
  '[2026-10-09T10:24:44Z] $ node /home/casey/.claude/skills/cold-email-attack-enemy-propose-5-ideas-v1/scripts/run-batch.mjs --leads /home/casey/repos/automator/state/siege/2026-10-09/siege-2026-10-09-22824615-attack-enemy-propose-5-ideas-e8e54c/leads.json ...',
  '[2026-10-09T10:24:44Z]   | Griff & Alyssa             FAIL  242w  fails 2->1->1->1',
  '[2026-10-09T10:24:44Z]   |     still broken: em dash — 1 em dash(es) outside the sign-off',
  '[2026-10-09T10:24:46Z]   |   batch_id   = siege-2026-10-09-22824615-attack-enemy-propose-5-ideas-e8e54c',
  '[2026-10-09T10:24:46Z]   |   SENT  rec4f871yMuUE1zhO    oscar@detailgroove.co  smartlead_lead=4721059495',
  '[2026-10-09T10:24:46Z]   |   SKIP  recIUDe7gmSe4yYZ7    batch report marked it failed',
  '[2026-10-09T12:00:22Z] $ node /home/casey/.claude/skills/cold-email-joke-AI-slop-v1/scripts/run-batch.mjs --leads /home/casey/repos/automator/state/siege/2026-10-09/siege-2026-10-09-23650563-joke-ai-slop-1484cc/leads.json ...',
  '[2026-10-09T12:00:22Z]   |     still broken: say-the-action — consultant abstraction "Streamline": name what actually happens',
  '[2026-10-09T12:00:24Z]   |   batch_id   = siege-2026-10-09-23650563-joke-ai-slop-1484cc',
  '[2026-10-09T12:00:24Z]   |   SKIP  rec7lROlWkJgP64Zf    batch report marked it failed',
].join('\n');
const GATED = siegePushOutcome(GATE_LOG, '2026-10-09T07:00:00.000Z', '2026-10-10T07:00:00.000Z');
ok('a skip reports the rule the writer\'s gate broke, not the push\'s placeholder',
  GATED.reasons,
  [{ reason: 'quality gate: em dash — 1 em dash(es) outside the sign-off', leads: 1 },
   { reason: 'quality gate: say-the-action — consultant abstraction "Streamline": name what actually happens', leads: 1 }]);
ok('a skip is attributed to the offer whose writer made the draft',
  GATED.skipped_by_offer,
  [{ offer: 'attack-enemy-propose-5-ideas', leads: 1 }, { offer: 'joke-ai-slop', leads: 1 }]);
ok('an interleaved SENT does not consume the batch\'s gate reason',
  [GATED.sent, GATED.skipped], [1, 2]);
ok('a skip with no writer verdict in the log keeps the push\'s own string',
  (() => { const p = siegePushOutcome(
    '[2026-10-09T10:24:46Z]   |   batch_id   = siege-2026-10-09-22824615-attack-enemy-propose-5-ideas-e8e54c\n'
    + '[2026-10-09T10:24:46Z]   |   SKIP  recIUDe7gmSe4yYZ7    batch report marked it failed',
    '2026-10-09T07:00:00.000Z', '2026-10-10T07:00:00.000Z');
    return p.reasons; })(),
  [{ reason: 'batch report marked it failed', leads: 1 }]);
ok('a second skip in one batch takes the second verdict, not the first again',
  (() => { const p = siegePushOutcome([
    '[2026-10-09T11:28:35Z] $ node /x/scripts/run-batch.mjs --leads /s/siege-2026-10-09-23650470-attack-enemy-propose-5-ideas-e8e54c/leads.json',
    '[2026-10-09T11:28:35Z]   |     still broken: opener — must start "Hey <First name>,"',
    '[2026-10-09T11:28:35Z]   |     still broken: closing block — the locked closing block is missing or reworded',
    '[2026-10-09T11:28:37Z]   |   batch_id   = siege-2026-10-09-23650470-attack-enemy-propose-5-ideas-e8e54c',
    '[2026-10-09T11:28:37Z]   |   SKIP  reckQDgAvSDDTT2yH    batch report marked it failed',
    '[2026-10-09T11:28:37Z]   |   SKIP  recd8rH73DWjHpjsn    batch report marked it failed',
  ].join('\n'), '2026-10-09T07:00:00.000Z', '2026-10-10T07:00:00.000Z');
    return [p.reasons.map((r) => r.reason), p.skipped_by_offer]; })(),
  [['quality gate: closing block — the locked closing block is missing or reworded',
    'quality gate: opener — must start "Hey <First name>,"'],
   [{ offer: 'attack-enemy-propose-5-ideas', leads: 2 }]]);
// 2026-10-21: the counters above count log lines, and the question is about people. Two
// cycles running the arithmetic read as a shortfall that wasn't one, and the real loss on
// 10-21 printed no line at all. Verbatim shapes from both cycles.
const JOIN_LOG = [
  // recRESENT1 is skipped in one batch and sent in another, same run — the 10-20 shape.
  '[2026-10-20T10:27:33Z]   |   SENT  recRESENT1AAAAAAA    a@b.com  smartlead_lead=1',
  '[2026-10-20T10:29:02Z]   |   batch_id   = siege-2026-10-20-22824591-voice-objection-proof-e73e82',
  '[2026-10-20T10:29:02Z]   |   SKIP  recRESENT1AAAAAAA    is absent from this batch\'s Siege manifest',
  // recGONE2 is skipped and never sent — a person really lost.
  '[2026-10-20T10:29:10Z]   |   SKIP  recGONE2BBBBBBBBB    batch report marked it failed',
  // recREFUSED3 is SmartLead's refusal, which outranks any skip on the same lead.
  '[2026-10-20T10:30:18Z]   |   FAIL  recREFUSED3CCCCCC    SmartLead did not add the lead (no reason given)',
  '[2026-10-20T10:30:18Z]   |   SKIP  recREFUSED3CCCCCC    batch report marked it failed',
  // recSILENT4 is in the plan and appears nowhere above. The 10-21 shape.
].join('\n');
const PLANNED = ['recRESENT1AAAAAAA', 'recGONE2BBBBBBBBB', 'recREFUSED3CCCCCC', 'recSILENT4DDDDDD'];
const JOINED = siegePushOutcome(JOIN_LOG, '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z', PLANNED);
ok('the shortfall is counted per person, not per log line',
  [JOINED.planned_leads, JOINED.people_emailed, JOINED.people_lost], [4, 1, 3]);
ok('a skip that was re-sent in another batch cost a draft and not a person',
  [JOINED.skipped, JOINED.skipped_then_sent], [3, 1]);
// The 10-20 debrief named two leads as lost to the manifest gate. Neither was in the plan.
ok('a skip for somebody the plan never carried cost a draft and not a person either',
  (() => { const p = siegePushOutcome(
    '[2026-10-19T10:28:11Z]   |   SKIP  recNEVERPLANNEDAA    not in the Siege manifest\n'
    + '[2026-10-19T10:28:12Z]   |   SKIP  recPLANNEDLOSTBBB    batch report marked it failed',
    '2026-10-19T07:00:00.000Z', '2026-10-20T07:00:00.000Z', ['recPLANNEDLOSTBBB']);
    return [p.skipped, p.skipped_unplanned, p.people_lost, p.lost_to_skip]; })(),
  [2, 1, 1, 1]);
ok('the loss splits by what the log said, and a FAIL outranks a SKIP on the same lead',
  [JOINED.lost_to_fail, JOINED.lost_to_skip, JOINED.lost_silently], [1, 1, 1]);
ok('a planned lead the push never mentioned is named, which is the only trace it leaves',
  JOINED.lost_ids.includes('recSILENT4DDDDDD'), true);
ok('the 10-21 shape exactly: every skip re-sent, one planned person lost silently',
  (() => { const p = siegePushOutcome(
    '[2026-10-20T10:27:33Z]   |   SENT  recRESENT1AAAAAAA    a@b.com  smartlead_lead=1\n'
    + '[2026-10-20T10:29:02Z]   |   SKIP  recRESENT1AAAAAAA    is absent from this batch\'s Siege manifest',
    '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z',
    ['recRESENT1AAAAAAA', 'recSILENT4DDDDDD']);
    return [p.skipped, p.people_lost, p.lost_silently, p.lost_ids]; })(),
  [1, 1, 1, ['recSILENT4DDDDDD']]);
ok('no plan to join against reports nulls, never a clean push',
  (() => { const p = siegePushOutcome(JOIN_LOG, '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z');
    return [p.sent, p.planned_leads, p.people_lost, p.lost_silently, p.lost_ids]; })(),
  [1, null, null, null, []]);
ok('a plan whose shape changed reads as unknown, not as everyone lost',
  [siegePlanLeadIds({ assignments: [{ nope: 1 }] }), siegePlanLeadIds({ summary: {} }),
    siegePlanLeadIds(null)],
  [null, null, null]);
ok('lead ids are read off the plan under any of the three keys automator has used',
  siegePlanLeadIds({ assignments: [{ lead_id: 'recA' }, { id: 'recB' }, { record_id: 'recC' }] }),
  ['recA', 'recB', 'recC']);
ok('a lead planned into two batches is one person, counted once',
  (() => { const p = siegePushOutcome(
    '[2026-10-20T10:27:33Z]   |   SENT  recDUPE1AAAAAAAAA    a@b.com  smartlead_lead=1',
    '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z',
    ['recDUPE1AAAAAAAAA', 'recDUPE1AAAAAAAAA']);
    return [p.planned_leads, p.people_emailed, p.people_lost]; })(),
  [1, 1, 0]);
ok('NO_PUSH_OUTCOME carries the join as unmeasured too',
  [NO_PUSH_OUTCOME.planned_leads, NO_PUSH_OUTCOME.people_lost, NO_PUSH_OUTCOME.lost_ids],
  [null, null, []]);

// 2026-10-22: the approval trim. The push run rebuilds the plan, so plan.json can hold
// people the morning's approval never covered; Siege holds those for tomorrow and they
// print no line at all, which read as lost_silently. Live 10-21 shape: 149 on disk, 131
// approved, 131 sent, nobody lost.
const TRIM_LOG = [
  '[2026-10-21T10:20:34Z]   18 planned today were not in the approved list; they wait for tomorrow',
  '[2026-10-21T10:20:34Z] Casey approved today\'s plan; writing the rest and pushing',
  '[2026-10-21T10:24:01Z]   |   SENT  recAPPROVED1AAAAA    a@b.com  smartlead_lead=1',
  '[2026-10-21T10:24:11Z]   |   SENT  recAPPROVED2BBBBB    c@d.com  smartlead_lead=2',
].join('\n');
const TRIMMED = siegePushOutcome(TRIM_LOG, '2026-10-21T07:00:00.000Z', '2026-10-22T07:00:00.000Z',
  ['recAPPROVED1AAAAA', 'recAPPROVED2BBBBB', 'recDEFERRED3CCCC'],
  ['recAPPROVED1AAAAA', 'recAPPROVED2BBBBB']);
ok('a planned person the approval does not cover is deferred, not lost',
  [TRIMMED.planned_leads, TRIMMED.approved_leads, TRIMMED.deferred_unapproved,
    TRIMMED.people_emailed, TRIMMED.people_lost, TRIMMED.lost_silently],
  [3, 2, 1, 2, 0, 0]);
ok('the deferred people are named, so tomorrow\'s plan can be checked for them',
  [TRIMMED.deferred_ids, TRIMMED.lost_ids], [['recDEFERRED3CCCC'], []]);
ok('Siege\'s own count of the trim is carried beside the file read',
  TRIMMED.deferred_logged, 18);
ok('a cycle whose log never mentions the trim reports null, not zero',
  siegePushOutcome('[2026-10-21T10:24:01Z]   |   SENT  recA1AAAAAAAAAAAA    a@b.com',
    '2026-10-21T07:00:00.000Z', '2026-10-22T07:00:00.000Z', ['recA1AAAAAAAAAAAA'], null).deferred_logged,
  null);
ok('with no approval on file the trim is unknown and the whole plan is the denominator',
  (() => { const p = siegePushOutcome(TRIM_LOG, '2026-10-21T07:00:00.000Z', '2026-10-22T07:00:00.000Z',
    ['recAPPROVED1AAAAA', 'recAPPROVED2BBBBB', 'recDEFERRED3CCCC'], null);
    return [p.approved_leads, p.deferred_unapproved, p.people_lost, p.lost_silently]; })(),
  [null, null, 1, 1]);
// The two conditions automator checks before trimming. Either one failing means the
// approval authorises nobody, so the trim's size is unknowable rather than zero.
ok('an approval for another day, or for a sample that changed, authorises nobody',
  [siegeApprovedLeadIds({ fingerprint: 'f1', planned_lead_ids: ['recA'] },
    { day: '2026-10-20', fingerprint: 'f1' }, '2026-10-21'),
    siegeApprovedLeadIds({ fingerprint: 'f2', planned_lead_ids: ['recA'] },
      { day: '2026-10-21', fingerprint: 'f1' }, '2026-10-21'),
    siegeApprovedLeadIds({ fingerprint: 'f1', planned_lead_ids: [] },
      { day: '2026-10-21', fingerprint: 'f1' }, '2026-10-21'),
    siegeApprovedLeadIds(null, null, '2026-10-21')],
  [null, null, null, null]);
ok('a matching approval hands back the sample\'s own list',
  siegeApprovedLeadIds({ fingerprint: 'ef1700f27e56', planned_lead_ids: ['recA', 'recB'] },
    { day: '2026-10-21', fingerprint: 'ef1700f27e56', approved_lead_count: 2 }, '2026-10-21'),
  ['recA', 'recB']);
// The 10-20 cycle, which the 10-21 debrief read as a person lost with no line anywhere.
// That lead was deferred, approved the next morning, and sent at 10-21T10:39:02Z.
ok('the 10-20 answer is settled: one deferred person, nobody lost',
  (() => { const p = siegePushOutcome(
    '[2026-10-20T10:19:13Z]   1 planned today were not in the approved list; they wait for tomorrow\n'
    + '[2026-10-20T10:27:33Z]   |   SENT  recRESENT1AAAAAAA    a@b.com  smartlead_lead=1\n'
    + '[2026-10-20T10:29:02Z]   |   SKIP  recRESENT1AAAAAAA    is absent from this batch\'s Siege manifest',
    '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z',
    ['recRESENT1AAAAAAA', 'reckjbAvfyqs7jSeD'], ['recRESENT1AAAAAAA']);
    return [p.people_lost, p.lost_silently, p.deferred_unapproved, p.deferred_logged,
      p.skipped, p.skipped_then_sent]; })(),
  [0, 0, 1, 1, 1, 1]);
ok('a reason is still the reason now the lead id is its own capture group',
  (() => { const p = siegePushOutcome(
    '[2026-10-20T10:30:18Z]   |   FAIL  recREFUSED3CCCCCC    SmartLead did not add the lead (bounce_count=1)',
    '2026-10-20T07:00:00.000Z', '2026-10-21T07:00:00.000Z', null);
    return p.reasons; })(),
  [{ reason: 'SmartLead did not add the lead (bounce_count=1)', leads: 1 }]);

ok('a batch id of an unreadable shape names no offer rather than guessing one',
  [offerFromBatchId('siege-2026-10-09-23650563-joke-ai-slop-1484cc'),
    offerFromBatchId('siege-nonsense'), offerFromBatchId('siege-2026-10-09-23650563-joke-ai-slop')],
  ['joke-ai-slop', null, null]);

// unitStartedAt — a daemon-reload must not blind the verdict on the run it followed.
ok('the service\'s own stamp wins when it has one',
  unitStartedAt('Thu 2026-10-08 10:15:34 UTC', 'Thu 2026-10-08 10:15:31 UTC'),
  '2026-10-08T10:15:34.000Z');
ok('a stamp cleared by daemon-reload falls back to the timer',
  unitStartedAt('', 'Thu 2026-10-08 10:15:31 UTC'), '2026-10-08T10:15:31.000Z');
ok('a timer that never fired claims nothing', unitStartedAt('', 'n/a'), null);
ok('neither stamp claims nothing', unitStartedAt(undefined, undefined), null);
// The fallback cannot invent a verdict for a cycle: the window check still decides.
ok('a fallback stamp outside the window still yields no verdict',
  pushRunVerdict('success', unitStartedAt('', 'Thu 2026-10-08 10:15:31 UTC'),
    '2026-10-09T07:00:00.000Z', '2026-10-10T07:00:00.000Z'),
  null);
ok('a fallback stamp inside the window carries the verdict the reload hid',
  pushRunVerdict('success', unitStartedAt('', 'Thu 2026-10-08 10:15:31 UTC'),
    '2026-10-08T07:00:00.000Z', '2026-10-09T07:00:00.000Z'),
  'success');


// --- send_plan.fleet: the fleet's own day-over-day move (2026-10-15) ---------------
// The real numbers from the three cycles after the record push.
ok('a shrinking fleet is reported as a fall, not as three fine mornings',
  (() => {
    const f = fleetFacts(
      { ...siegePlanFacts({ summary: { inboxes: [{ live: true, message_per_day: 645, followups_due: 0, free_before_fill: 67 }] } }) },
      { live_inboxes: 53, mailbox_capacity: 795 },
      null,
    );
    return [f.live_inboxes_change, f.mailbox_capacity_change, f.live_inboxes_prev];
  })(),
  [-52, -150, 53]);
ok('a missing prior snapshot reports unknown, never "no change"',
  (() => {
    const f = fleetFacts(siegePlanFacts({ summary: { inboxes: [{ live: true, message_per_day: 15 }] } }), null, null);
    return [f.live_inboxes_change, f.mailbox_capacity_change, f.live_inboxes_prev];
  })(),
  [null, null, null]);

// inboxGateFacts — the split that decides whether a pull costs two weeks of warmup.
const GATE_STATE = {
  lastRunAt: '2026-10-14T09:45:53.239Z',
  pausedByGate: {
    'a@x.com': { since: '2026-10-14T09:45:53.239Z', reasons: ['health 53.5<90'] },
    'b@x.com': { since: '2026-10-14T09:45:53.239Z', reasons: ['inbox_rate 81<90'] },
    'c@x.com': { since: '2026-10-14T09:45:53.239Z', reasons: ['warmup day 8<14'] },
    'd@x.com': { since: '2026-07-22T18:24:35.406Z', reasons: ['health 60<90', 'warmup day 1<14'] },
  },
  history: [
    { at: '2026-10-13T09:45:32.967Z', paused: ['e@x.com', 'f@x.com'], resumed: [] },
    { at: '2026-10-14T09:45:53.239Z', paused: ['a@x.com', 'b@x.com', 'c@x.com'], resumed: ['g@x.com'] },
  ],
};
ok('the newest run is counted, not the whole history',
  (() => { const g = inboxGateFacts(GATE_STATE); return [g.gate_paused, g.gate_resumed, g.gate_last_run]; })(),
  [3, 1, '2026-10-14T09:45:53.239Z']);
ok('a landing-rate pause counts as health, not as a young mailbox',
  (() => { const g = inboxGateFacts(GATE_STATE); return [g.gate_paused_on_health, g.gate_paused_on_warmup]; })(),
  [2, 1]);
ok('the standing paused count is every cause, all time',
  inboxGateFacts(GATE_STATE).gate_paused_total, 4);
ok('the biggest pull is named for scale',
  (() => { const g = inboxGateFacts(GATE_STATE); return [g.gate_biggest_pull, g.gate_biggest_pull_at]; })(),
  [3, '2026-10-14T09:45:53.239Z']);
ok('a missing or renamed state file costs nulls, not the block',
  (() => { const g = inboxGateFacts(null); return [g.gate_paused, g.gate_paused_on_health, g.gate_paused_total]; })(),
  [null, null, null]);
ok('a state file with no history yet reports no run rather than zero pauses',
  (() => { const g = inboxGateFacts({ lastRunAt: 'x', pausedByGate: {} }); return [g.gate_paused, g.gate_paused_total]; })(),
  [null, 0]);

// The 2026-10-16 shape: the band gate adopted the health pauses out of the old registry,
// so the old registry knows nothing about the mailboxes its own history says it paused.
const ADOPTED_STATE = {
  lastRunAt: '2026-10-15T09:46:38.753Z',
  pausedByGate: { 'old@x.com': { since: '2026-07-22T18:24:35.406Z', reasons: ['health 85<90'] } },
  history: [{ at: '2026-10-15T09:46:38.753Z', paused: ['p@x.com', 'q@x.com'], resumed: ['r@x.com'] }],
};
ok('four pauses with no reasons left in the old registry read as unexplained, not as neither',
  (() => {
    const g = inboxGateFacts(ADOPTED_STATE);
    return [g.gate_paused, g.gate_paused_on_health, g.gate_paused_on_warmup, g.gate_paused_unexplained];
  })(),
  [2, 0, 0, 2]);
ok('the band gate\'s ledger supplies the reasons the old registry gave away',
  (() => {
    const g = inboxGateFacts(ADOPTED_STATE, { 'p@x.com': ['health 73.4<90'], 'q@x.com': ['warmup day 9<14'] });
    return [g.gate_paused_on_health, g.gate_paused_on_warmup, g.gate_paused_unexplained];
  })(),
  [1, 1, 0]);
ok('a run that recorded its own reasons needs neither ledger (the 10-16 email-repo fix)',
  (() => {
    const g = inboxGateFacts({
      ...ADOPTED_STATE,
      history: [{
        at: '2026-10-15T09:46:38.753Z',
        paused: ['p@x.com', 'q@x.com'],
        resumed: [],
        pausedReasons: { 'p@x.com': ['health 73.4<90'], 'q@x.com': ['warmup day 9<14'] },
      }],
    });
    return [g.gate_paused_on_health, g.gate_paused_on_warmup, g.gate_paused_unexplained];
  })(),
  [1, 1, 0]);
ok('the split always adds up to the pull',
  (() => {
    const g = inboxGateFacts(ADOPTED_STATE, { 'p@x.com': ['2 of 31 warmup emails in spam in 3 days'] });
    return (g.gate_paused_on_health! + g.gate_paused_on_warmup! + g.gate_paused_unexplained!) === g.gate_paused;
  })(),
  true);

// bandGateFacts — the gate that owns the fleet since 2026-10-15T22:57Z.
const BAND_STATE = {
  generated_at: '2026-10-16T07:05:14Z',
  owned: { 'p@x.com': { reasons: ['health 73.4<90'] }, 'q@x.com': { reasons: [] } },
  runs: [
    { at: '2026-10-15T22:57:06Z', counts: { normal: 21, watch: 20, stop: 17 } },
    { at: '2026-10-16T07:05:14Z', counts: { normal: 18, watch: 18, stop: 22 } },
  ],
};
ok('the newest band run is the fleet, and owned is counted whole',
  (() => {
    const b = bandGateFacts(BAND_STATE);
    return [b.band_gate_run_at, b.band_normal, b.band_watch, b.band_stop, b.band_gate_owned];
  })(),
  ['2026-10-16T07:05:14Z', 18, 18, 22, 2]);
ok('a missing band state costs nulls, not the block',
  (() => { const b = bandGateFacts(null); return [b.band_stop, b.band_gate_owned, b.reasons]; })(),
  [null, null, {}]);

// The 2026-10-18 fault: on a non-sending day band_normal (28) sat beside live_inboxes_prev
// (18, Siege's plan-time count from Friday) and subtracting them read as +10. The prior
// band reading has to come from the band gate's own history. Shape and numbers are real:
// ten mailboxes returned to normal in the 23:05Z run and one more at 00:05Z.
const BAND_HISTORY = {
  generated_at: '2026-10-18T07:05:07Z',
  owned: {},
  runs: [
    // An hour-over-hour neighbour must NOT be chosen as the day's baseline.
    { at: '2026-10-16T22:05:59Z', counts: { normal: 18, watch: 14, stop: 26 }, to_normal: [], to_watch: [], to_stop: [] },
    { at: '2026-10-17T06:05:35Z', counts: { normal: 18, watch: 14, stop: 26 }, to_normal: [], to_watch: [], to_stop: [] },
    { at: '2026-10-17T07:05:44Z', counts: { normal: 18, watch: 14, stop: 26 }, to_normal: [], to_watch: [], to_stop: [] },
    { at: '2026-10-17T23:05:19Z', counts: { normal: 27, watch: 5, stop: 26 }, to_normal: ['a@x.com', 'b@x.com'], to_watch: [], to_stop: [] },
    { at: '2026-10-18T00:05:12Z', counts: { normal: 28, watch: 4, stop: 26 }, to_normal: ['c@x.com'], to_watch: [], to_stop: ['d@x.com'] },
    { at: '2026-10-18T07:05:07Z', counts: { normal: 28, watch: 4, stop: 26 }, to_normal: [], to_watch: [], to_stop: [] },
  ],
};
ok('the band baseline is the gate\'s own run nearest 24h back, not the one before it',
  (() => {
    const b = bandGateFacts(BAND_HISTORY);
    return [b.band_prev_at, b.band_normal_prev, b.band_normal_change, b.band_gap_hours, b.band_delta_comparable];
  })(),
  ['2026-10-17T07:05:44Z', 18, 10, 24.0, true]);
ok('band moves are counted by direction inside the cycle window, and the returners named',
  (() => {
    const b = bandGateFacts(BAND_HISTORY, { sinceISO: '2026-10-17T07:00:00.000Z', untilISO: '2026-10-18T07:00:00.000Z' });
    return [b.band_moved_to_normal, b.band_moved_to_stop, b.band_moved_to_watch, b.band_returned];
  })(),
  [3, 1, 0, ['a@x.com', 'b@x.com', 'c@x.com']]);
ok('no window means the moves are unknown, not zero',
  (() => {
    const b = bandGateFacts(BAND_HISTORY);
    return [b.band_moved_to_normal, b.band_moved_to_stop, b.band_returned];
  })(),
  [null, null, []]);
// The 2026-10-27 fault: band_moved_to_normal:6 beside band_normal_change:0 read as "six
// came back, six unrelated ones fell". Five of the six that came back were the ones that
// fell, and the fleet peaked at 19 clear mid-cycle before finishing back at 13. Shape and
// numbers are real, trimmed to the runs that moved.
const BAND_ROUNDTRIP = {
  generated_at: '2026-10-27T07:05:21Z',
  config: { recover: { hours: 48, score_at_least: 90 } },
  owned: {},
  mailboxes: {
    // Five returned and were re-stopped; one held its band.
    'ask.a@x.com': { band: 'stop', score: 55.0, reasons: ['score 55 under 80', '4 of 29 warmup emails in spam in 3 days'] },
    'ask.b@x.com': { band: 'stop', score: 55.0, reasons: ['score 55 under 80'] },
    'ask.c@x.com': { band: 'stop', score: 64.4, reasons: ['score 64.4 under 80'] },
    'start.a@x.com': { band: 'stop', score: 48.7, reasons: ['score 48.7 under 80'] },
    'start.b@x.com': { band: 'stop', score: 48.7, reasons: ['score 48.7 under 80'] },
    'hi.a@x.com': { band: 'normal', score: 96.7, reasons: [] },
    // Held but well: two on the recovery clock, one paying for its siblings, and one
    // genuinely sick so it must not be counted as either.
    'clock.a@x.com': { band: 'watch', score: 96.7, reasons: ['recovering: clean reading, 47h of 48h at 90+'] },
    'clock.b@x.com': { band: 'stop', score: 92.2, reasons: ['recovering: clean reading, 22h of 48h at 90+'] },
    'sib.a@x.com': { band: 'watch', score: 96.7, reasons: ['domain watch: 2 of 3 mailboxes on x.com are in watch or stop'] },
    'sick.a@x.com': { band: 'stop', score: 38.5, reasons: ['score 38.5 under 80'] },
  },
  runs: [
    { at: '2026-10-26T07:05:15Z', counts: { normal: 13, watch: 11, stop: 34 }, to_normal: [], to_watch: [], to_stop: [] },
    { at: '2026-10-26T09:05:16Z', counts: { normal: 17, watch: 7, stop: 34 }, to_normal: ['ask.a@x.com', 'ask.b@x.com', 'hi.a@x.com', 'ask.c@x.com'], to_watch: [], to_stop: [] },
    { at: '2026-10-26T15:05:15Z', counts: { normal: 19, watch: 6, stop: 33 }, to_normal: ['start.a@x.com', 'start.b@x.com'], to_watch: [], to_stop: [] },
    { at: '2026-10-26T17:05:09Z', counts: { normal: 15, watch: 10, stop: 33 }, to_normal: [], to_watch: ['ask.a@x.com', 'ask.b@x.com', 'ask.c@x.com', 'other@x.com'], to_stop: [] },
    { at: '2026-10-26T18:05:18Z', counts: { normal: 13, watch: 11, stop: 34 }, to_normal: [], to_watch: ['start.a@x.com'], to_stop: ['start.b@x.com'] },
    { at: '2026-10-27T03:05:12Z', counts: { normal: 13, watch: 8, stop: 37 }, to_normal: [], to_watch: [], to_stop: ['start.a@x.com'] },
    { at: '2026-10-27T04:05:02Z', counts: { normal: 13, watch: 6, stop: 39 }, to_normal: [], to_watch: [], to_stop: ['ask.a@x.com', 'ask.b@x.com'] },
    { at: '2026-10-27T07:05:21Z', counts: { normal: 13, watch: 6, stop: 39 }, to_normal: [], to_watch: [], to_stop: [] },
  ],
};
const RT_WINDOW = { sinceISO: '2026-10-26T07:00:00.000Z', untilISO: '2026-10-27T07:00:00.000Z' };
ok('a flat clear count hides the peak the fleet actually reached',
  (() => {
    const b = bandGateFacts(BAND_ROUNDTRIP, RT_WINDOW);
    return [b.band_normal, b.band_normal_prev, b.band_normal_change, b.band_peak_normal, b.band_peak_normal_at];
  })(),
  [13, 13, 0, 19, '2026-10-26T15:05:15Z']);
ok('five of the six returners went back down inside the same cycle',
  (() => {
    const b = bandGateFacts(BAND_ROUNDTRIP, RT_WINDOW);
    return [b.band_moved_to_normal, b.band_round_trips, b.band_returned_still_normal, b.band_round_trip_ids.length];
  })(),
  [6, 5, 1, 5]);
ok('a demotion before the mailbox was ever handed normal is not a round trip',
  bandGateFacts(BAND_ROUNDTRIP, RT_WINDOW).band_round_trip_ids.includes('other@x.com'),
  false);
ok('held but healthy, split into the one that lifts itself and the one paying for siblings',
  (() => {
    const b = bandGateFacts(BAND_ROUNDTRIP, RT_WINDOW);
    return [b.band_held_but_healthy, b.band_held_but_healthy_on_clock,
      b.band_held_but_healthy_sibling, b.band_held_healthy_soonest_hours];
  })(),
  [3, 2, 1, 1]);
ok('no window: the moves and the round trips are unknown, but the held-but-well count is not',
  (() => {
    const b = bandGateFacts(BAND_ROUNDTRIP);
    return [b.band_peak_normal, b.band_round_trips, b.band_returned_still_normal, b.band_held_but_healthy];
  })(),
  [null, null, null, 3]);
ok('no per-mailbox map costs the outcome fields, not the move counts (the 10-18 shape)',
  (() => {
    const b = bandGateFacts(BAND_HISTORY, { sinceISO: '2026-10-17T07:00:00.000Z', untilISO: '2026-10-18T07:00:00.000Z' });
    return [b.band_moved_to_normal, b.band_returned_still_normal, b.band_held_but_healthy, b.band_peak_normal];
  })(),
  [3, null, null, 28]);
ok('a history with no run 12-36h back reports the baseline as not comparable',
  (() => {
    const b = bandGateFacts({ runs: [
      { at: '2026-10-18T06:05:13Z', counts: { normal: 28, watch: 4, stop: 26 } },
      { at: '2026-10-18T07:05:07Z', counts: { normal: 28, watch: 4, stop: 26 } },
    ] });
    return [b.band_normal_prev, b.band_normal_change, b.band_gap_hours, b.band_delta_comparable];
  })(),
  [null, null, null, false]);

// The 2026-10-16 fault itself: a delta across a 12-hour gap, on a plan written after the
// push. The numbers are real.
const REPLAN = siegePlanFacts({
  summary: {
    day: '2026-10-15',
    generated_at: '2026-10-15T23:00:43Z',
    inboxes: Array.from({ length: 21 }, () => ({ live: true, message_per_day: 15, followups_due: 0, free_before_fill: 5 })),
  },
  assignments: new Array(100).fill(0),
});
ok('a plan written after the push is named as such, and its delta is not comparable',
  (() => {
    const f = fleetFacts(
      REPLAN,
      { live_inboxes: 43, mailbox_capacity: 645, plan_generated_at: '2026-10-14T10:36:16Z' },
      null, null, '2026-10-15T11:28:18Z',
    );
    return [f.live_inboxes_change, f.snapshot_gap_hours, f.replanned_after_push, f.delta_comparable];
  })(),
  [-22, 36.4, true, false]);
ok('two morning snapshots a day apart ARE comparable',
  (() => {
    const f = fleetFacts(
      siegePlanFacts({ summary: { generated_at: '2026-10-14T10:36:16Z', inboxes: [{ live: true, message_per_day: 15 }] } }),
      { live_inboxes: 43, mailbox_capacity: 645, plan_generated_at: '2026-10-13T10:20:00Z' },
      null, null, '2026-10-14T11:28:18Z',
    );
    return [f.snapshot_gap_hours, f.replanned_after_push, f.delta_comparable];
  })(),
  [24.3, false, true]);
ok('an older snapshot with no stamp makes comparability unknown, not true',
  (() => {
    const f = fleetFacts(REPLAN, { live_inboxes: 43, mailbox_capacity: 645 }, null, null, '2026-10-15T11:28:18Z');
    return [f.snapshot_gap_hours, f.delta_comparable, f.plan_generated_at];
  })(),
  [null, null, '2026-10-15T23:00:43Z']);
ok('no push in the cycle leaves replanned_after_push unknown',
  fleetFacts(REPLAN, { live_inboxes: 43, mailbox_capacity: 645, plan_generated_at: '2026-10-14T10:36:16Z' }, null, null, null)
    .replanned_after_push,
  null);


// bulkRewriteShape — the 2026-10-19 sweep that reported 6.7% of itself as a demotion
const SWEEP_ROLL = [{
  review_status: 'below_threshold', rows_in_window: 38492, clusters: 155,
  rows_in_clusters: 38466, first_at: '2026-10-19T06:41:02Z',
  last_at: '2026-10-19T06:43:36Z', span_seconds: 154,
}];
const SWEEP_CLUSTERS = [340, 334, 332, 319, 316, 315, 312, 310].map((leads, i) => ({
  at: `2026-10-19T06:42:0${i}Z`, review_status: 'below_threshold', leads,
  already_emailed: 0, with_email: 15, stamp: null, left_the_send_queue: true,
}));
ok('155 clusters is a paged sweep, and the printed list is a sample',
  (() => {
    const f = bulkRewriteShape(SWEEP_ROLL, SWEEP_CLUSTERS, { below_threshold: 130102 }, null)![0];
    return [f.shape, f.truncated, f.clusters_reported, f.rows_reported, f.rows_in_window];
  })(),
  ['batched_sweep', true, 8, 2578, 38492]);
ok('no prior population leaves `moved` unknown, never restamp',
  bulkRewriteShape(SWEEP_ROLL, SWEEP_CLUSTERS, { below_threshold: 130102 }, null)![0].moved,
  'unknown');
ok('a flat population beside 38k writes is a re-stamp',
  (() => {
    const f = bulkRewriteShape(SWEEP_ROLL, SWEEP_CLUSTERS,
      { below_threshold: 130102 }, { below_threshold: 130100 })![0];
    return [f.population_change, f.moved];
  })(),
  [2, 'restamp']);
// The 2026-10-13 ICP audit: one statement, and the destination grew by what it wrote
const AUDIT_ROLL = [{
  review_status: 'rejected', rows_in_window: 881, clusters: 1, rows_in_clusters: 881,
  first_at: '2026-10-13T16:26:11Z', last_at: '2026-10-13T16:26:11Z', span_seconds: 0,
}];
const AUDIT_CLUSTERS = [{
  at: '2026-10-13T16:26:11Z', review_status: 'rejected', leads: 881,
  already_emailed: 720, with_email: 881, stamp: '[NOT ICP 2026-10-13]',
  left_the_send_queue: true,
}];
ok('one UPDATE whose destination grew by 881 is a real migration',
  (() => {
    const f = bulkRewriteShape(AUDIT_ROLL, AUDIT_CLUSTERS, { rejected: 1063 }, { rejected: 182 })![0];
    return [f.shape, f.truncated, f.population_change, f.moved];
  })(),
  ['one_statement', false, 881, 'migration']);
ok('a half-and-half rewrite is mixed, not forced into one verdict',
  bulkRewriteShape(AUDIT_ROLL, AUDIT_CLUSTERS, { rejected: 1063 }, { rejected: 800 })![0].moved,
  'mixed');
ok('a failed rollup query is null, not an empty day',
  bulkRewriteShape(null, SWEEP_CLUSTERS, { below_threshold: 1 }, null), null);
ok('a status the prior snapshot never listed is unknown, not zero',
  (() => {
    const f = bulkRewriteShape(AUDIT_ROLL, AUDIT_CLUSTERS, { rejected: 1063 }, { approved: 5 })![0];
    return [f.population_prev, f.population_change, f.moved];
  })(),
  [null, null, 'unknown']);
ok('3 to 9 clusters is a handful of statements, not a sweep',
  bulkRewriteShape([{ ...SWEEP_ROLL[0], clusters: 4 }], SWEEP_CLUSTERS, null, null)![0].shape,
  'few_statements');

// shelfTally — the stamp is not an email. See countShelf() in src/db.ts for the 54 leads
// stamped sent_to_smartlead on 2026-10-13 that no lane will ever write to.
const shelfRow = (over: Partial<ShelfRow>): ShelfRow =>
  ({ id: 'rec1', outreach_status: 'ready_data_scraped', bundled: true, emailed: false, ...over });
ok('a stamped lead with no send row is stranded, not sent',
  (() => {
    const t = shelfTally([
      shelfRow({ id: 'a' }),
      shelfRow({ id: 'b', outreach_status: 'sent_to_smartlead', emailed: true }),
      shelfRow({ id: 'c', outreach_status: 'sent_to_smartlead', emailed: false }),
    ]);
    return [t.ready_to_write, t.already_sent, t.emailed, t.marked_sent_never_emailed, t.marked_sent_never_emailed_ids];
  })(),
  [1, 2, 1, 1, ['c']]);
ok('the live 2026-10-28 shape: 1,667 stamped, 1,613 emailed, 54 stranded',
  (() => {
    const rows: ShelfRow[] = [];
    for (let i = 0; i < 5147; i++) rows.push(shelfRow({ id: `r${i}` }));
    for (let i = 0; i < 1613; i++) rows.push(shelfRow({ id: `s${i}`, outreach_status: 'sent_to_smartlead', emailed: true }));
    for (let i = 0; i < 54; i++) rows.push(shelfRow({ id: `g${i}`, outreach_status: 'sent_to_smartlead', emailed: false }));
    const t = shelfTally(rows);
    return [t.total, t.ready_to_write, t.already_sent, t.emailed, t.marked_sent_never_emailed,
      t.marked_sent_never_emailed_ids!.length];
  })(),
  [6814, 5147, 1667, 1613, 54, MAX_SHELF_STRANDED_IDS]);
ok('an emailed lead that is not stamped does not count as stranded',
  (() => {
    const t = shelfTally([shelfRow({ id: 'a', outreach_status: 'email_drafted', emailed: true })]);
    return [t.already_sent, t.emailed, t.marked_sent_never_emailed];
  })(),
  [0, 1, 0]);
ok('the legacy enriched alias still counts as ready to write',
  shelfTally([shelfRow({ outreach_status: 'enriched' })]).ready_to_write, 1);
ok('an unreadable ledger is unknown, not a clean shelf',
  (() => {
    const t = shelfTally([
      shelfRow({ id: 'a', outreach_status: 'sent_to_smartlead', emailed: null }),
      shelfRow({ id: 'b', outreach_status: 'sent_to_smartlead', emailed: false }),
    ]);
    return [t.already_sent, t.emailed, t.marked_sent_never_emailed, t.marked_sent_never_emailed_ids];
  })(),
  [2, null, null, null]);
ok('an empty shelf is zero, not unknown',
  (() => {
    const t = shelfTally([]);
    return [t.total, t.emailed, t.marked_sent_never_emailed];
  })(),
  [0, 0, 0]);

// recoveredTally — a backlog finally flying is not a new person reached. See
// countFirstTouchRecovered() in src/db.ts for the 51 of 52 first touches on 2026-10-29
// that were the 10-13 stranded cohort, published as a nine-fold jump in reach.
ok('the live 2026-10-29 shape: 52 first touches, 51 a 10-13 backlog, 1 new',
  (() => {
    const rows = [{ lead_id: 'new', oldest_pushed_day: null as string | null }];
    for (let i = 0; i < 51; i++) rows.push({ lead_id: `r${i}`, oldest_pushed_day: '2026-10-13' });
    const t = recoveredTally(rows);
    return [t.recovered, t.fresh, t.oldestDay];
  })(),
  [51, 1, '2026-10-13']);
ok('the oldest day is the oldest backlog, not the newest',
  recoveredTally([
    { lead_id: 'a', oldest_pushed_day: '2026-10-21' },
    { lead_id: 'b', oldest_pushed_day: '2026-10-07' },
    { lead_id: 'c', oldest_pushed_day: '2026-10-13' },
  ]).oldestDay,
  '2026-10-07');
ok('a cycle that reached only new people carries no backlog day',
  (() => {
    const t = recoveredTally([
      { lead_id: 'a', oldest_pushed_day: null },
      { lead_id: 'b', oldest_pushed_day: null },
    ]);
    return [t.recovered, t.fresh, t.oldestDay];
  })(),
  [0, 2, null]);
ok('a cycle with no first touches is zero, not unknown',
  (() => {
    const t = recoveredTally([]);
    return [t.recovered, t.fresh, t.oldestDay];
  })(),
  [0, 0, null]);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
