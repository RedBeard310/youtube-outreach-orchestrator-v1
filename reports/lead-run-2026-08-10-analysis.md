# Lead Run Debrief — 2026-08-10 (analysis companion)

**Headline: +350 parked, the best day since 08-01 and the fourth-best on record, and the keyword engine produced 19% of it. Five other discovery methods now write into the same lead base, which also means the finder has been grading itself on their work: 132 passes claimed 762 fresh pitchable while the keyword engine's whole-day total was 255. Fixed today.**

Cycle window: 2026-08-09 07:00Z → 2026-08-10 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-10.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+350** | pool 4,267 → 4,617. Best since 08-01 (+404); prior days +93, +70, +32 |
| `needs_contact` pool | **5,705** | roughly +490 since yesterday's debrief, still the larger lane |
| **Total parked, 0 sent** | **10,322** | 4,617 + 5,705. Past ten thousand for the first time |
| Discovered | **5,332** | vs 3,600 yesterday, same measurement, +48% |
| Pitchable (score ≥ 6) | **901** | 16.9% of discoveries, down from 24.1% |
| Of today's cohort | 363 → `approved_hold`, 492 → `needs_contact` | **42.5% verify rate**, best in weeks, but measured ~1h after cycle close so still settling |
| `scoring_failed` | **0** | rate 0.0%, fifth clean day |
| Campaign sessions | 16 / 16 done | vs 14 yesterday |
| Finder passes | **132** | up from 120. Reported fresh-pitchable sum 762 = 5.77/pass (see caveat below) |
| Keyword-engine pitchable, true | **255** | 1.93/pass. Yesterday's true figure was 450 = 3.75/pass |
| Fades / discovers / promotes | 123 / 138 / 131 | |
| Keyword harvests | **6 ran, 106 skipped on backoff**, 26 on cadence | was 14 forced harvests yesterday |
| Terms written by those harvests | **4** | yields 0, 1, 2, 0, 1 and one unmeasured |
| Session startup | **13.7 min avg** | was 21.5. Cycle total 218 min, was 301 |
| **Hard stops** | **0** | third clean day |
| Time-budget stops | **16 of 16** | every session ran out the clock, none ran out of work |
| Quota stops / crashes | 0 / 0 | |
| `term_starvation` observations | **0** | |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 11th straight cycle |

## Discovery by method

Six methods now write into `lead_candidates`. The attribution comes from each row's
`discovered_via` prefix (`graph:` feed, `peer-comment:` / `peer-guest:` peer-sweep,
`comment:` comment-sweep, `podcast:` crossover, bare term = keyword engine).

| Method | Creators | Pitchable | Hit rate | Share of intake | Share of pitchable |
|---|---|---|---|---|---|
| Recommended-videos feed | 2,028 | 482 | 23.8% | 38.0% | 53.5% |
| Peer-network comments | 1,280 | 41 | **3.2%** | 24.0% | 4.6% |
| Keyword search (original finder) | 1,017 | 255 | 25.1% | 19.1% | 28.3% |
| Comment sweep | 986 | 117 | 11.9% | 18.5% | 13.0% |
| Guest-link mining | 11 | 4 | 36.4% | 0.2% | 0.4% |
| Podcast crossover | 10 | 2 | 20.0% | 0.2% | 0.2% |

Two readings:

1. **Volume is no longer the constraint; precision is.** Intake rose 48% and the pitchable
   rate fell from 24.1% to 16.9%, because the growth came from the two lowest-precision
   methods. Peer-network alone took a quarter of the day's intake for 4.6% of the value.
2. **The feed is the workhorse.** It now supplies more than half the pitchable creators,
   at a hit rate matching the keyword engine's.

All four background services reported fresh state at snapshot time (feed 0.3h, comment
sweep 10.9h and inside its daily cadence, peer sweep 0h, podcast crossover 0h).

## The measurement bug (today's fix)

A finder pass records what it produced by querying the lead base for rows created since
the pass started (`getLeadsDiscoveredSince(runStartedAt)` in `src/drivers/lead-finder.ts`).
That was exact when the keyword engine was the only writer. It stopped being exact on
08-08 when the sweep daemons went continuous, and peer-sweep landing on 08-09 pushed it
past the point of being ignorable.

Evidence, all from this cycle:

- 132 passes summed **762** reported fresh pitchable.
- The keyword engine's **entire 24-hour** pitchable output was **255**.
- So **at least 507 of the 762 (66%) cannot have been the passes' own work.** The real
  share is higher, because passes only cover part of the day.

The metric moved opposite to reality. Reported per-pass yield rose 2.40 → 5.77; true
keyword-engine per-pass yield fell 3.75 → 1.93. Yesterday the same counter read *low*
(288 reported against 450 true) because the counter also misses everything found between
passes. Until peer-sweep arrived, that undercount was larger than the over-credit and the
two errors cancelled, which is why this never surfaced before.

**Operational cost so far: small, and pointed the wrong way.** `fresh_pitchable` is the
input to the fade check (`freshPitchable < fadeThreshold`, default 12), the rule that
pivots a mined-out term slice into vein discovery. **Eight passes read ≥ 12 today**; at the
keyword engine's real rate of 1.93/pass none plausibly earned it, so eight discovery
pivots were skipped. Eight is not much. The trend is: the daemons are days old, their
volume is climbing, and left alone this switches off the mechanism that keeps term supply
alive. Left alone in the other direction it would also have masked a dead finder from the
hourly check-in, which reads the same field.

### What shipped

`youtube-outreach-orchestrator-v1` @ `bc3945a`:

- **`src/discovery-method.ts` (new).** The `discovered_via` classifier, previously a
  private function inside `debrief-data.ts`, is now shared. Two copies would have drifted
  the moment a seventh method landed.
- **`buildBreakdown` now emits both views.** `yield_breakdown` keeps its base-wide totals
  (the scoring-health checks want the biggest sample they can get; the scorer is shared by
  all six methods) and gains `keyword_engine.{new_leads, score_6_plus,
  score_6_plus_AND_host_identified}` plus `sweep_leads`.
- **The fade signal reads the keyword-engine figure.** `finder_run` log lines now carry
  `fresh_pitchable` (keyword-only), `fresh_pitchable_base_wide` and `keyword_new_leads`,
  so the trend line stays readable across the change.
- **Fail-soft by design.** Anything the classifier does not recognise counts as keyword
  engine. If attribution ever breaks, the finder over-counts exactly as it does today
  rather than reading zero every pass, which would make every pass fade and put the
  campaign into permanent discovery churn. That is the worse failure, so the fallback
  points away from it.

Verified before commit: `npm run typecheck` clean; 13 classifier cases green (all six
prefixes, bare untagged term, null, empty string, malformed JSON, two-entry arrays in both
orders); 3 yield-split cases green (mixed pass, `no_host_identified` gate, empty pass);
`npm run campaign:dry` loaded the new module and correctly no-opped on the live lockfile.
No API calls, so it cost nothing.

## Yesterday's harvest backoff: verified, at about half the predicted size

| | Predicted 08-09 | Actual 08-10 |
|---|---|---|
| Harvests per cycle | ~4 | **6** (106 backoff skips, 26 cadence skips) |
| Session startup | "toward a few minutes" | **13.7 min avg** (was 21.5) |
| Finder passes | > 140 | **132** (was 120) |

It works and the skip line appears in the session logs as designed. The shortfall is that
the harvest was never the only thing in the opening stretch: the reservoir check, verify
kickoff, promotion and probe evaluation live there too, so removing the harvest cannot
take startup to zero.

The source is confirmed dry: six harvests wrote **4 usable terms**. Term supply held
anyway on the other leg, 138 discovery runs and 131 promotions, with 0 quota stops.

## Per session

`start` / `finder_run` / `done` events in `logs/campaign-2026-08-{09,10}.jsonl`. "Wall" is
elapsed `start` → `done`; "startup" is `start` → first `finder_run`, the pre-flight the
backoff targets. Passes count only those inside the cycle window, so the boundary session
shows fewer than it ran.

| Session closed (UTC) | Passes | Wall | Startup | Harvest ran / skipped | Reported pitchable |
|---|---|---|---|---|---|
| 08-09 08:38 | 8 | 91 min | 18 min | 1 / 8 | 26 |
| 08-09 10:26 | 8 | 108 min | 20 min | 1 / 8 | 49 |
| 08-09 12:04 | 10 | 98 min | 18 min | 1 / 9 | 62 |
| 08-09 13:49 | 11 | 104 min | 27 min | 1 / 10 | 76 |
| 08-09 15:22 | 11 | 93 min | 10 min | 0 / 10 | 95 |
| 08-09 16:50 | 11 | 88 min | 6 min | 0 / 11 | 70 |
| 08-09 18:16 | 9 | 86 min | 14 min | 0 / 10 | 45 |
| 08-09 19:34 | 6 | 77 min | 8 min | 1 / 4 | 49 |
| 08-09 21:07 | 9 | 93 min | 5 min | 0 / 9 | 56 |
| 08-09 22:33 | 6 | 86 min | 18 min | 0 / 7 | 42 |
| 08-10 00:01 | 6 | 88 min | 16 min | 0 / 7 | 39 |
| 08-10 01:24 | 6 | 83 min | 8 min | 1 / 6 | 22 |
| 08-10 03:00 | 9 | 95 min | 14 min | 0 / 10 | 22 |
| 08-10 04:33 | 9 | 93 min | 9 min | 0 / 10 | 18 |
| 08-10 05:55 | 6 | 81 min | 13 min | 0 / 7 | 48 |
| 08-10 07:30 (spans boundary) | 6 in-window | 94 min | 14 min | 1 / 7 | 41 |
| **Sum** | **131 in-window** | | **218 min** | **6 / 133** | **760** |

Every session ended on its time budget. Wall time is now 77 to 108 minutes against a
90-minute loop clock, versus 91 to 113 yesterday and 147 to 168 on 08-08.

## Niche mix

Real Estate & Property took **359 of 901** pitchable (39.8%), up from 34.9% yesterday and
the most concentrated single niche of the run so far. Next: Transformation & Performance
Coaching 78, Coaching & Consulting 74, Other 71, Health & Wellness Clinics 60, Business
Growth Coaching 56, Legal Services 41, Financial Planning 37. Top three = 56% of pitchable,
versus 37% yesterday. The recommended-videos feed compounds whatever it is already seeing,
so concentration rising as the feed's share rises is expected, not a fault, but it is worth
watching if the mix matters to the eventual outreach.

Three niches Casey excluded on 08-09 still show small counts (Dating & Relationships 3,
Interior Design 2, and 3D/Animation 1). Those are scored-but-excluded rows appearing in the
niche tally; `demo_niche_excluded` caught 198 rows this cycle.

## Ranked next

1. **Decide the outlet for `approved_hold`.** 4,617 waiting, 0 emailed. Leading this list
   for over a week, and today it grew faster than any day since 08-01.
2. **Look at peer-network comments before it settles in.** 24% of intake, 4.6% of the
   value, 3.2% hit rate against 12-36% for everything else. One day old, so this is the
   cheap moment to tighten which channels it mines or cap its share. It also spends
   YouTube quota the higher-precision methods could use.
3. **Build the `needs_contact` recovery engine.** 5,705 creators, still the larger lane,
   still growing faster than the parked pool even on the best verify day in weeks.
4. **Check tomorrow that the corrected yield reads right.** Expect reported per-pass
   fresh-pitchable near 2, and nearly every pass fading into discovery. Both are correct
   at the true rate. The session logs now print both numbers on adjacent lines.
5. **Feed the harvest new seeds.** Six harvests, four terms. The backoff stops the waste,
   it does not restore supply, and a single good yield clears the backoff by itself.
6. **Meter OpenRouter as a real cost.** Six discovery methods and a scorer run on it and
   nothing counts the spend. The ledger reads $0 because it only meters Anthropic.

## Status

Everything is parked, nothing sent. `approved_hold` 4,617 plus `needs_contact` 5,705 is
**10,322 creators found and never contacted**. Zero quota stops, zero hard stops, zero
crashes, zero scoring failures, no fatal signatures, eleven clean cycles running. $0 on
Anthropic. The loop is still running and has not been paused.
