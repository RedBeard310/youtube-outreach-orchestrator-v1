import { isVerifiedOrBeyond, priorSeedsAdvanced, sessionSeedsAdvanced, sessionStartMs, walkRateTrend } from './debrief-data.ts';
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

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
