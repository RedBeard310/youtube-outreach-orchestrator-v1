# Lead Run Analysis — 2026-08-28

Cycle: 2026-08-27 07:00Z → 2026-08-28 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-28.json`.
HTML debrief: [lead-run-2026-08-28.html](lead-run-2026-08-28.html).

**Headline:** yesterday's recovery-lane fix worked, and it worked at exactly the
size the sample predicted. 112 contact points came off creators we already
found, against zero the day before. Discovery went the other way and fell 38%,
for one reason: the recommended-videos feed finished the fifth walk of its seed
list at lunchtime and started a sixth, which is running at a third of the
fifth's yield while eating three quarters of the day's seeds.

---

## 1. The numbers

| Metric | 2026-08-28 | 2026-08-27 |
|---|---:|---:|
| Parked into `approved_hold` | **+65** | +74 |
| `approved_hold` pool | 3,659 | 3,594 |
| `needs_contact` pool | 4,796 | 4,724 |
| **Total found, never contacted** | **8,455** | 8,318 |
| Contact points recovered | **112** | 0 |
| Channels found | 3,500 | 5,122 |
| Worth contacting (score ≥ 6) | 134 (3.8%) | 215 (4.2%) |
| Emails verified | 46 | 71 |
| Share of good leads reachable | 34% | 33% |
| `scoring_failed` | **0 (0.0%)** | 0 (0.0%) |
| Campaign sessions | 15 started / 14 finished | 16 / 16 |
| Keyword finder passes | 591 | 565 |
| Fresh pitchable per pass | **0.056** | 0.083 |
| Hard stops · time-budget stops | 0 · 14 | 1 · 15 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | **$4.62** (6,794 calls) | $7.44 (10,984) |
| OpenRouter balance | $432.49 (~94 days) | $465.26 (~62 days) |
| `fatal_signatures` | **`[]`** | `[]` |

Cost per lead worth contacting **3.4¢** (was 3.5¢). Cost per lead parked
**7.1¢** (was 10.1¢). Both improved, because spend fell faster than output did.
The runway reading improved for the same reason and should not be read as good
news on its own.

---

## 2. The recovery lane fix is confirmed

Yesterday's debrief predicted roughly 0.9 contact points per dispatched lead
from a hand-run sample of the workable part of the pool. The measured result
across a full cycle is **0.93**.

`leads.contact_points` rows written, by day:

| Day | Rows | Distinct leads |
|---|---:|---:|
| 2026-08-23 | 46 | 19 |
| 2026-08-24 | 2 | 2 |
| 2026-08-25 | 0 | 0 |
| 2026-08-26 | 1 | 1 |
| 2026-08-27 (from 07:00Z) | 71 | 27 |
| 2026-08-28 (to 07:00Z) | 41 | 17 |

Three collect passes ran in the cycle, 40 leads each. **44 of the 120**
produced at least one contact point, for **112 points** total.

The queue is moving. `logs/bloodhound-lane-state.json` carries a keyset cursor
(`tier`, `disc`, `id`), and it has advanced from the forty oldest leads out to
leads first discovered on **2026-07-12**. `lap_complete` is still false and
`laps` is still 0, so the lane has not yet re-visited anything. Before the fix
the cursor did not exist and the same batch came back every six hours.

**What is not yet proven is the step after collection.** A contact point is a
candidate email or form, not a verified address. Seven `bloodhound_verify`
passes picked up **32** recovered leads over the cycle (1, 1, 6, 1, 12, 1, 10).
Meanwhile the `needs_contact` pool went 4,724 → 4,796 while **88** newly
discovered leads arrived in it, which implies about **16** leads left the pool.
That is real movement and it is the first the numbers show, but it is small
against 4,796. One more cycle decides whether the bottleneck has simply moved
from the queue to verification.

---

## 3. The feed lane's sixth lap is the reason the day was down

The recommended-videos feed (`graph-sweep`) walks a book of 11,938 seeds. It has
now walked it six times. Its own loop prints the lap yield at each completion:

| Lap | Good leads per seed | Share of lap 1 |
|---|---:|---:|
| 1 (July) | 0.45 | 100% |
| 4 | 0.033 | 7.3% |
| 5 | 0.021 | 4.7% |
| 6 (in progress) | **0.0078** | **1.7%** |

Lap 5 finished at 15:12Z on 08-27. Lap 6 started at 16:10Z and has walked 6,898
of the 11,938 seeds since, finding 54 good creators by the sweep's own counter
and 53 by the database. The 58-minute gap between laps is visible in the hourly
chart as two hours at 50 channels against a typical 150.

The lane is not cheap to run at that yield:

| Lane | Seeds walked | Share of seeds | Model spend | Share of spend | Good leads | Share of leads | Per seed | ¢/lead |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Recommended-videos feed | 6,974 | 73% | $2.09 | 45% | 53 | 40% | 0.0076 | 3.9 |
| Video-graph sweep | 2,402 | 25% | $1.55 | 34% | 45 | 34% | 0.0187 | 3.4 |
| Peer network | 134 | 1% | $0.07 | 1% | 3 | 2% | 0.0224 | 2.3 |
| Keyword search | 591 passes | — | $0.84 | 18% | 33 | 25% | 0.056/pass | 2.6 |

The comparison that matters is the first two rows. Video-graph walks fresh seeds
that its own refill produced; the feed re-walks a book it has already finished
five times. Video-graph is **2.4× more efficient per seed**.

This was left alone. `docs/standing-orders.md` makes the feed lane the primary
discovery method with Casey's standing authorization, and the mission line says
never stop a producing lane. Changing its lap policy unattended would be exactly
the kind of decision the standing orders reserve. It is recommendation 1 instead.

---

## 4. The keyword lane, re-judged on cost

Yesterday's recommendation 4 framed this lane as a keep-or-kill call, on the
evidence that doubling its run time changed nothing (0.083 fresh good leads per
pass on both days). Today its per-pass yield fell further, to **0.056**.

On cost it looks completely different. 591 passes produced **33 of the day's 134**
good leads, which is **25% of the output for 18% of the model bill**, at **2.6¢**
per good lead. That is cheaper than the feed lane (3.9¢) and cheaper than
video-graph (3.4¢).

The two measures disagree because a finder pass is cheap and a graph seed is
not. Per-pass yield is the right measure when the constraint is time; per-dollar
yield is the right one when the constraint is money. Right now every session
ends on its time budget, so time is the binding constraint, which is what makes
recommendation 4 "keep it" rather than "expand it."

The drought behind it is unchanged and the backoffs are handling it correctly:
all 15 sessions opened `STOCK-UP`, the starvation reading fired 22 times, and
**all 604** term-invention calls and **all 604** keyword-harvest calls were
skipped by their low-yield backoffs. Those backoffs cost nothing now and are
working as designed. The supply behind them is still empty.

---

## 5. What was fixed this cycle

**Probe evaluation was eating 8.6% of the campaign's wall-clock.**

The mid-run `evaluate-probes` step (added 2026-07-10 so that validated veins
re-enter the active tier in the same session rather than at run-end) is
triggered by a fade count: every 3 fades. This cycle **589 of 591 finder passes
faded**, so it fired **205 times**.

Each invocation is a full scan of the probe set. Measured directly:

```
$ time npx tsx scripts/evaluate-probes.ts
Probes: 22945 total | 13436 tested | 2106 untested
DRY RUN — pass --apply to promote 0 and pause 0.
real    0m31.165s
```

205 × 31s = **1h 46m** out of a 20.49h pass loop, in a cycle where all 14
finished sessions ended on their 90-minute time budget. It came straight out of
finder passes.

It bought almost nothing, and could not have. Across the 205 runs it promoted
**4** terms and paused **71**; **140 of the 205 changed nothing at all**. Nor was
there anything for it to find: `discover()` is now backed off on every fade, so
no new probes are being written, and a probe only becomes judgeable when it
crosses the 20-candidate sample floor, which happens on finder-pass timescales.

Fixed in `youtube-outreach-orchestrator-v1/src/drivers/campaign.ts` with the same
guard `harvestKeywords()` got on 08-09 and `discover()` got on 08-26: the trigger
is now gated on time as well as fades, default 30 minutes
(`PROBE_EVAL_MIN_INTERVAL_MINUTES`, 0 restores the old behaviour). Sessions run
~1.5h, so 2 to 3 mid-run evaluations per session still happen, comfortably inside
the 2026-07-10 intent. The finish-block call passes no floor and always runs, so
every session still ends with a full evaluation.

The gate fails open by construction. A missing or unreadable timestamp reads as
DUE, including `NaN`: a bare `NaN >= interval` is `false`, which would skip the
evaluation forever on a corrupt state file. That is the same fail-closed shape
that stalled the recovery lane on 08-27, so it is covered by a test
(`tests/probe-eval-cadence.test.ts`, 6 cases; full suite 23 pass).

---

## 6. Health

Clean cycle. `fatal_signatures_today` is empty, 0 crashes, 0 quota stops, 0 hard
stops, $0 Anthropic. 14 of 15 sessions finished (the 15th was still live at the
cycle boundary), all 14 on their time budget.

Lane state:

| Lane | Status |
|---|---|
| Recommended-videos feed | Running, lap 6, 5,040 seeds remaining in the book |
| Video-graph sweep | Running, book drained, walks refill only (2,402 seeds, down from 8,084) |
| Peer network | Running, book drained, walks refill only (134 seeds) |
| Keyword search | Running, starved, backoffs holding |
| Guest-link mining | Trickle, 2 channels |
| Podcast crossover | Ran once, found nothing, as usual |
| Comment sweep | Off since Casey paused it 08-20. Stale state is expected, not an incident |

---

## 7. Recommended next, ranked

1. **Decide whether the feed lane should keep re-walking the same book.** Lap 6
   is at 0.0078 per seed, 1.7% of lap 1, and it is spending 73% of our seeds and
   45% of our model bill. The cheapest change is a rule: when a finished lap
   yields below a floor, walk only the seeds added since the last lap instead of
   starting a full new one. That keeps the lane running, which the standing
   orders require, and stops it re-asking 11,938 creators a settled question.
   This is Casey's call because the standing orders make the lane primary.
2. **Watch whether recovered contact points become parked leads.** Collection is
   fixed and proven at 0.93 points per lead. Verification is unproven: 32 leads
   verified, about 16 left `needs_contact`. One more cycle settles it.
3. **Find a seed source that is not our own output.** Carried seven days. All
   three graph lanes are fed only by the leads the pipeline itself finds, so
   supply shrinks whenever yield does. Dropping the feed lane's view floor from
   20k to 5k still buys about a week of road.
4. **Keep the keyword lane.** Yesterday's open question resolves against
   retiring it: 25% of the output for 18% of the bill, at the second-lowest cost
   per lead of any lane.
5. **Decide the outlet for the parked pools.** 3,659 in `approved_hold` and
   4,796 in `needs_contact` is **8,455 creators found and never contacted**, up
   137 today. Carried since 08-20. Money is not the constraint: $432.49 left,
   about 94 days at today's rate.
