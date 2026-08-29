import { isVerifiedOrBeyond, laneYield, priorAdvanceSource, priorSeedsAdvanced, priorSeedsWalked, reconcileAdvanced, sessionSeedsAdvanced, sessionStartMs, walkRateTrend } from './debrief-data.ts';
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

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
