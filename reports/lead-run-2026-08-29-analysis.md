# Lead Run Analysis — 2026-08-29

Cycle: 2026-08-28 07:00Z → 2026-08-29 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-29.json`.
HTML debrief: [lead-run-2026-08-29.html](lead-run-2026-08-29.html).

**Headline:** the best parking day in five days, and it happened with the
cheapest lane switched off for 21 of the 24 hours. The video-graph sweep crossed
a lifetime spending cap at 10:31Z yesterday and has not run since. Nothing
caught it, because a lane that relaunches and quits in two seconds still
rewrites its state file, so every freshness check reads green. Separately, the
feed lane's seed count in today's snapshot was wrong by a factor of 2.2, which
moved its yield, its remaining road and its walk rate. All three numbers are
corrected below and the arithmetic that produced them is fixed.

---

## 1. The numbers

| Metric | 2026-08-29 | 2026-08-28 |
|---|---:|---:|
| Parked into `approved_hold` | **+78** | +65 |
| `approved_hold` pool | 3,735 | 3,659 |
| `needs_contact` pool | 4,881 | 4,796 |
| **Total found, never contacted** | **8,616** | 8,455 |
| Contact points recovered | **131** | 112 |
| Channels found | 3,540 | 3,500 |
| Worth contacting (score ≥ 6) | **163 (4.6%)** | 134 (3.8%) |
| Emails verified | 58 | 46 |
| Share of good leads reachable | 36% | 34% |
| `scoring_failed` | **0 (0.0%)** | 0 (0.0%) |
| Campaign sessions | 15 started / 15 finished | 15 / 14 |
| Keyword finder passes | 675 | 591 |
| Fresh pitchable per pass | 0.052 | 0.056 |
| Hard stops · time-budget stops | 0 · 15 | 0 · 14 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | **$5.30** (7,741 calls) | $4.62 (6,794) |
| OpenRouter balance | $395.78 (~75 days) | $432.49 (~94 days) |
| `fatal_signatures` | **`[]`** | `[]` |

Cost per lead worth contacting **3.3¢** (was 3.4¢). Cost per lead parked
**6.8¢** (was 7.1¢).

---

## 2. The video-graph lane has been off since yesterday lunchtime

`[video-sweep] STOP: spent $50.00 >= $50 cumulative cap.` fired at
**2026-08-28T10:31:23Z**. The lane has not walked a seed since.

State: `logs/video-graph-sweep-state.json` carries `usd: 50.0021` against a
default `VIDEO_SWEEP_MAX_USD` of 50, and `seeds_done: 71,757` of **73,181**, so
**1,424 seeds are still unwalked**.

Three things make this worse than an ordinary stop.

**The cap is lifetime, not per-run or per-day.** It counts every dollar recorded
in the state file since 2026-08-17. Waiting does not release it. The sibling
feed lane caps **per lap** (`lapUsd(state) >= maxUsd` in `graph-sweep.ts`), so
its budget refreshes at every lap boundary and it cannot lock itself out this
way. Nothing principled explains the difference; the two lanes were written at
different times.

**The stop shares an exit code with success.** `EXIT_DONE` means both "every
seed walked" and "cap spent", and `video-graph-sweep-loop.sh` logged both as
`SWEEP COMPLETE (or cost cap reached). Stopping for good.` systemd correctly
does not restart a clean exit.

**Every health signal read green.** Something restarted the service hourly, and
each restart re-read the cap and exited in about 2 seconds, rewriting the state
file each time. So:

| Signal | Reading | Truth |
|---|---|---|
| `hours_since_update` | 0.8 | file touched by a run that did nothing |
| `service_active` | not checked for this lane | inactive |
| `productive` | `true` | it worked for 3.5h, then died for 21 |
| `yield_dead` | `false` | 8 leads, all before 10:31Z |
| `idle_run_streak` | **23** | correct, and the only field that was |

The lane is not expensive. **$50 for 1,877 qualified leads is 2.7¢ each**, the
cheapest per-lead figure in the pipeline. The cap that fired measures the lane's
age, not its efficiency.

**Raising it is Casey's call** (LLM Spend Guard), so nothing was changed. What
shipped is detection and diagnosis, in section 5.

---

## 3. Today's feed-lane seed count was over-reported 2.2×

The snapshot says `seeds_advanced: 13199, seeds_advanced_source: "session_logs"`.
The true figure is **6,019**.

`reconcileAdvanced` prefers the difference between two daily seed-book
snapshots and falls back to summing session logs when that difference goes
negative. A negative difference is exactly what a lap rollover produces: lap 6
closed and lap 7 opened, so `seeds_walked` went 6,898 → 979. The fallback is the
log sum, which the 08-23 fix already established over-counts a long daemon
session.

| Field | Reported | True |
|---|---:|---:|
| `seeds_advanced` | 13,199 | **6,019** |
| `pitchable_per_seed` | 0.0088 | **0.0193** |
| `days_of_road` | 0.8 | **1.9** |
| `walk_rate_change_pct` | +89.3% | **−12.7%** |

The exact answer was already on disk: the lane walked the rest of the old book
and then started the new one, so it is `(prev_total − prev_walked) + walked_now`
= `(11,938 − 6,898) + 979`. Both terms have been written into the debrief JSON
since 08-22.

**Fixed** in `scripts/autopilot/debrief-data.ts`: a third source,
`lap_rollover`, computes it. A book that *shrank* (a refill dropping merged
rows, the other way `walked` goes backwards) fails the `total_now >= total_prev`
test and still falls back to the log sum, which is the right answer for a case
that cannot be computed. Six new cases in the selftest; all 44 pass.

Stated limit: it assumes one rollover per cycle. At ~6k seeds a day against a
~12k book that cannot happen today.

---

## 4. Lap 6 closed, and it closed higher than yesterday's reading

Yesterday's debrief and `docs/standing-orders.md` both carry lap 6 at
**0.0078/seed**. That was a mid-lap reading. The sweep's own counter closed it at:

```
THIS LAP (6):  167 qualified / 12180 seeds = 0.014/seed  (lap 5 ran at 0.021/seed)
lap cost:        $5.74 = $0.034/qualified lead
```

So **0.014/seed, 3.4¢ per lead, 67% of lap 5 and 3.1% of lap 1** (0.45). The lap
nearly doubled its rate in its second half, which means a half-finished lap is
not the lap's rate. The standing-orders figure has been corrected in place.

Per-lane, on corrected seeds:

| Lane | Channels | Score ≥ 6 | Seeds | Per seed | Model spend | ¢/lead |
|---|---:|---:|---:|---:|---:|---:|
| Recommended-videos feed | 2,507 | 116 | 6,019 | 0.0193 | $3.83 | 3.3 |
| Keyword search | 596 | 35 | 675 passes | 0.052/pass | $0.89 | 2.6 |
| Peer network | 255 | 4 | 173 | 0.0231 | $0.13 | 3.3 |
| Video-graph sweep (off 21h) | 181 | 8 | 497 | 0.0161 | $0.28 | 3.5 |
| Guest-link mining | 1 | 0 | — | — | — | — |

**The three graph lanes now cost within a penny of each other per lead.**
Yesterday's finding that the feed lane is 2.4× less efficient per seed than
video-graph was correct for yesterday (0.0077 vs 0.0187, and 08-28's own seed
count checks out at 6,898 against the 6,974 reported) and does not hold today.

---

## 5. The recovery lane, second cycle

Collection is holding at roughly the rate it found on day one.

| Day | Contact points | Distinct leads |
|---|---:|---:|
| 2026-08-27 (from 07:00Z) | 71 | 27 |
| 2026-08-28 | 129 | 63 |
| 2026-08-29 (to 07:00Z) | 43 | 16 |
| **This cycle** | **131** | **62** |

Four collect passes of 40 leads each. **62 of the 160 produced something.** The
keyset cursor has walked from leads first discovered on 2026-07-12 out to
**2026-08-04**, `lap_complete` is still false and `laps` is still 0, so nothing
is being re-run.

**Verification is still where the lane stalls.** `needs_contact` went 4,796 →
**4,881** while **105** newly discovered leads arrived in it, so about **20**
left. Yesterday's figure was about 16. Two cycles now say the same thing:
collecting candidate addresses works, converting them does not. More collection
throughput will not help.

---

## 6. What was fixed this cycle

Four commits, all durable, none of them spending decisions.

**A stopped lane must not read as a finished one**
(`youtube-lead-finder-v1` `9242901`). The cap stop in `video-graph-sweep.ts` now
prints its scope (lifetime, and since when), what releases it
(`VIDEO_SWEEP_MAX_USD`), how many seeds are still unwalked, and the cost per
qualified lead the decision actually turns on. Both sweep loops now branch their
exit-0 log line so "book finished" and "cap spent" are distinguishable, and the
feed lane's line says its cap is per-lap and self-releasing. Verified by running
the sweep with `--max-usd 1` (no LLM calls, state restored afterwards).

**An hourly stall detector** (`youtube-outreach-orchestrator-v1`, section 7b of
`checkin.ts`). Section 7 asked "is the state file being touched", which is
liveness, and liveness is not work. The new check compares each lane's own
`seeds_done` against itself over a 4-hour window and reports a stall when it
hasn't moved and the book still has seeds. It names the cause from the lane's
last stop line. **Observation only, never exit 7**: every stall cause seen so
far is a spend or infra call, and a paid fix-agent cannot make those. Verified
against a back-dated baseline; it correctly produced
`sweep_stalled … Last stop line: [video-sweep] STOP: spent $50.00 >= $50
cumulative cap.`

**Lap rollovers are computed, not guessed** (`debrief-data.ts`). Section 3
above. Six new selftest cases.

**A three-seed trickle is a finished lap** (`youtube-lead-finder-v1` `1e9ffe5`).
`refill-graph-sweep.sh` only started a new lap when `extend-seeds.ts` printed
"nothing to add", and the hourly refill adds the two or three channels the ICP
newly qualified, so a finished book gets chased down a handful of seeds at a
time. Measured this cycle: **232, then 17, then 4, then 3 seeds across four
hourly restarts** (00:11Z to 04:14Z), about **23 seeds in four hours** against a
normal ~250 an hour, escaping only at 05:11Z when the trickle happened to be
empty. Worth about 1,250 seeds and 24 good leads, and it recurs at every lap
boundary. Anything under 50 fresh seeds now counts as drained and relaps;
`RELAP_UNWALKED_TOLERANCE` lets the relap step over the trickle, which is safe
because a relap re-opens the whole book including it. The cooldown and the
cost-per-lead gate are untouched, and the cooldown-hold branch now still
restarts the walker so a held relap cannot strand the seeds it just appended.
Verified: mid-lap, with 11,061 seeds unwalked, `--relap` still refuses with exit
3 and the refill restarts the walker instead.

**And one confirmation.** Yesterday's `PROBE_EVAL_MIN_INTERVAL_MINUTES` floor
worked: **180 of 235** triggers were skipped on the floor and 55 ran, about 28
minutes of scanning against 1h 46m the day before. Roughly **78 minutes** of
loop wall-clock returned to finder passes.

---

## 7. Health

Clean cycle. `fatal_signatures_today` is empty, 0 crashes, 0 quota stops, 0 hard
stops, $0 Anthropic. All 15 sessions started and finished, every one on its time
budget.

| Lane | Status |
|---|---|
| Recommended-videos feed | Running, lap 7, 11,201 seeds remaining |
| Video-graph sweep | **STOPPED on its lifetime cost cap**, 1,424 seeds unwalked |
| Peer network | Running, book drained (12,087/12,087), walks refill only |
| Keyword search | Running, starved, backoffs holding |
| Guest-link mining | Trickle, 1 channel |
| Podcast crossover | Ran once, found nothing, as usual |
| Comment sweep | Off since Casey paused it 08-20. Stale state is expected, not an incident |

Term drought unchanged: all 15 sessions opened `STOCK-UP`, 23 starvation
readings, and all 689 term-invention and 689 keyword-harvest calls were skipped
by their low-yield backoffs.

---

## 8. Recommended next, ranked

1. **Decide whether to raise the video-graph lane's $50 cap.** The only item
   here that changes tomorrow's numbers, and it needs Casey's word because it is
   a spending decision. The lane is off with 1,424 seeds in its book, at 2.7¢
   per qualified lead, the cheapest in the pipeline. One environment variable
   and a service start brings it back. The better version is to make its cap
   per-lap like `graph-sweep.ts`, so it can never lock itself out again.
2. **Decide whether the feed lane should keep re-walking the same book.**
   Carried from yesterday, and today's correction makes it less urgent rather
   than settled. Lap 6 closed at 0.014/seed against 0.45 on lap 1, so the decay
   is real, but the lane ran at 0.0193/seed today at 3.3¢ a lead, within a penny
   of every other graph lane. The decay argument stands; the "much worse than
   the alternatives" argument does not.
3. **Watch the recovery lane's verification step, not its collection step.** Two
   cycles agree: collection works (131 points from 62 of 160 leads), the pool
   barely moves (~20 out against 105 in). Collecting more will not help.
4. **Find a seed source that is not our own output.** Carried eight days. All
   three graph lanes are fed only by the leads the pipeline itself finds.
   Dropping the feed lane's view floor from 20k to 5k still buys about a week of
   road.
5. **Decide the outlet for the parked pools.** 3,735 in `approved_hold` and
   4,881 in `needs_contact` is **8,616 creators found and never contacted**, up
   161 today. Carried since 08-20. Money is not the constraint: $395.78 left,
   about 75 days at today's rate.
