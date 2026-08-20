# Lead run analysis — 2026-08-20

Cycle window 2026-08-19T07:00Z to 2026-08-20T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-20.json`.
HTML debrief: [lead-run-2026-08-20.html](lead-run-2026-08-20.html).

## Headline

**+149 parked** (`approved_hold` 2,758 → 2,907), the best day since 08-16, and good leads
went **188 → 446**.

Yesterday's fix is why. The video-graph sweep, frozen nine hours on Shorts when the last
debrief was written, walked **5,718 seeds** today and finished as the pipeline's biggest
and cheapest producer: 3,040 channels, 247 good leads, **8.1%**, 2.0¢ a lead.

That lane has **2,934 seeds left**. At today's rate it finishes this evening, its loop
exits 0 on purpose, and its service is set to restart only on failure. A clean finish is
the one thing that keeps it down for good. It was the only sweep with no keep-alive timer,
and the refill script it would have called turned out to be broken in two further ways.
All three fixed and installed today.

## The numbers

| Metric | Today | 08-19 |
|---|---:|---:|
| Parked into `approved_hold` | **+149** | +105 |
| `approved_hold` pool | 2,907 | 2,758 |
| `needs_contact` pool | 3,769 | 3,495 |
| **Total parked, none sent** | **6,676** | 6,253 |
| Channels found | 7,483 | 4,735 |
| Worth contacting (score ≥ 6) | **446 (5.96%)** | 188 (4.0%) |
| Emails verified | 147 | 58 |
| Dropped by niche exclusions | 247 | — |
| `scoring_failed` | 0 | 0 |
| Campaign sessions | 23 | 34 |
| Keyword finder passes | 237 | 77 |
| Stopped for want of terms | 17 of 23 | 33 of 34 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $10.81 (14,878 calls) | $5.46 |
| `fatal_signatures` | `[]` (21st cycle) | `[]` |

Cost per lead worth contacting **2.4¢**, down from 2.9¢. Cost per lead parked **7.3¢**, up
from 5.2¢, because yesterday's parks came partly from draining a verify backlog while
today's came almost entirely from today's finding.

### Shape of the day

Channels found per hour, 07:00Z through 06:00Z:

```
165  239  231  210  325  232  179  546  407  420  323  280
289  365  495  381  300  334  479  187  254  309  340  193
```

The flattest day in weeks. Low 165, high 546, no hour below 165. Yesterday had a cliff at
21:00Z where the top lane froze; today has none, and the overnight hours ran as strong as
the afternoon.

## Where the leads came from

| Lane | Channels | Worth contacting | Rate | Spend | Cost per lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 3,040 | **247** | **8.1%** | $5.01 | **2.0¢** |
| Recommended-videos feed | 2,716 | 170 | 6.3% | $3.90 | 2.3¢ |
| Keyword search | 389 | 14 | 3.6% | $1.16 | 8.3¢ |
| Peer-network comments | 755 | 13 | 1.7% | $0.44 | 3.4¢ |
| Comment sweep | 575 | 1 | 0.2% | $0.30 | 29.6¢ |
| Guest-link mining | 8 | 1 | 12.5% | — | — |

The two rail-walking lanes are **93% of the day's good leads** and the two cheapest per
lead. The keyword lane's $1.16 includes **79¢ on inventing new search terms** (186 calls),
which contributed to 14 leads across 237 passes.

Best niches: Other 103, Real Estate 73, Coaching & Consulting 64, Health & Wellness Clinics
52, Transformation & Performance Coaching 39, Relocation & Lifestyle Design 33, Business
Growth Coaching 13, Luxury Asset Brokerage 12.

## Q1 — did yesterday's Shorts fix hold?

Yes, decisively. The lane went from nine hours of retrying twenty unusable seeds to 5,718
seeds walked, `idle_run_streak: 0`, and the best lead rate in the pipeline.

The new `railless` counter, which records a watch page that loaded perfectly and simply has
no recommendation rail on it, reads **88**. So the failure class yesterday's fix invented is
real, and the lane now consumes those seeds and walks past them rather than deadlocking.

Yesterday's worry that the remaining book was heavily Shorts, and therefore thinner than
8,552 seeds suggested, did not play out. 88 railless pages in 5,718 seeds is 1.5%.

## Q2 — what happens to that lane tomorrow?

It stops, and nothing restarts it. Three separate faults, each sufficient on its own.

**① No timer.** The book is 13,784 of 16,718 walked, leaving 2,934 against a demonstrated
5,718 a day. `video-graph-sweep.service` runs `video-graph-sweep-loop.sh`, which exits 0
when every seed is drained, and the unit is `Restart=on-failure`. Both other sweeps have an
hourly keep-alive; this one had none. `refresh-video-seeds.sh` exists and is documented as
"safe to run on any schedule", and nothing in `/etc/systemd/system` referenced it.

**② The seed query has never worked.** `rebuild-video-seeds.sql` selects `c.channel_name`
from `enrichment.channels`. That table has never had such a column:

```
ERROR:  column c.channel_name does not exist
HINT:  Perhaps you meant to reference the column "c.channel_type".
```

Every run wrote an empty seed file, and the shell script then aborted on its own
empty-output guard. It failed safe and silent, which is why it went unnoticed. The correct
column is `channel_title`; fixed, the query returns **14,993 seeds**.

**③ Even fixed, the refresh deleted the lane's memory.** The old script removed the state
file so a new seed list would take effect, discarding both the walked-seed list and the
lifetime stats. Of the 14,993 seeds the fixed query returns, **9,743 are already walked**
and only **2,949 are new ground**. A refresh would have spent roughly two days re-fetching
rails the lane had already seen.

This is the same shape that took the recommended-videos feed down from 08-01 to 08-09.

## Q3 — is the lane health monitor telling the truth yet?

No. Yesterday it called a frozen lane productive. Today it called a working lane dead.

Peer-network comments reported `productive: false`, `seeds_advanced: 0`,
`idle_run_streak: 5`, `idle_since: 2026-08-19T14:20:59Z`. It actually walked about 405
seeds this cycle and produced **755 channels and 13 good leads**.

The cause is a split between where the work happens and where the monitor looks.
`peer-sweep.ts --extend` does not only extend the book, it walks the new seeds in the same
process, inside `refill-peer-sweep.sh`. From the journal for the 05:35Z run:

```
[peer-sweep] --extend: +75 never-seeded channels (10107 → 10182).
[peer-sweep] 10182 seeds total | 10107 done | 75 remaining
[chunk 1/8]  seeds 10108-10117 of 10182
...
PEER SWEEP — 10182/10182 seeds walked
```

The refill then restarts `peer-sweep.service`, which finds an empty book and writes a
fifteen-line session log saying `0 remaining`. `sweepWorkInCycle` grades a lane off
`logs/peer-sweep-sessions/*.log`, so it only ever saw the no-op. The real walk went to
journald, where nothing reads it.

This matters beyond one wrong field. A monitor that reports a healthy lane as idle every
cycle cannot flag the cycle a lane genuinely stalls, which is the job it was built for two
days ago.

## What broke

1. **The biggest lane had no keep-alive, and the refill it would have used was broken
   twice over.** Q2.
2. **The health monitor inverted.** Q3. Yesterday's false positive and today's false
   negative both fixed at the source rather than by patching the reader.
3. **The comment sweep was re-seeded automatically, and yesterday's debrief said nothing
   would do that.** `comment-sweep-daily.timer` handed it 137 fresh seeds at 13:53Z. It
   walked all 137, scanned 1,969 videos, raised 99,300 raw candidates, scored 154 and
   qualified **one**, at 30¢ a lead against 2.0¢ from the top lane. The recommendation to
   leave it alone stands, and now has a mechanism attached to it.

**Not a fault:** the keyword lane stopping for want of terms in 17 of 23 sessions with 23
starvation heartbeats, its documented state since being demoted to opportunistic on 08-14;
six sessions ending on their time budget; $0 Anthropic for the twenty-first cycle; zero
crashes, quota stops, scoring failures or fatal signatures; 66 working YouTube keys.

## Yesterday's fixes, checked

| Prediction | Outcome | Verdict |
|---|---|---|
| The video sweep stops deadlocking on railless pages | 5,718 seeds walked, idle streak 0, 88 railless pages consumed rather than retried, best lead rate in the pipeline | confirmed |
| A blocked lane rests instead of hammering | Never exercised. No blocked-rail stops all cycle | untested |
| A frozen lane can no longer report itself productive | True, and it now reports a working lane as idle instead | half right, fixed today |
| Count how many recommended-feed seeds are just Shorts | **1 railless latest video in roughly 10,300 seed-walks** | answered, no fallback needed |

That last row saves building something. Yesterday's recommendation #3 was to read the
Shorts number, then decide on a previous-video fallback. The number came back at
essentially zero, so the feed lane's halving per-seed yield is lap fatigue, not Shorts, and
the fallback should not be built.

## Shipped today

One commit in the finder, `e44989f`. Every change verified against live data or a copy of
live state before committing. No `.env` touched.

### 1. The biggest lane can no longer go dormant when its book drains

- **The seed query runs.** `c.channel_name` → `c.channel_title`, with a comment recording
  why it never worked. Returns 14,993 seeds.
- **The refresh merges instead of resetting.** It keeps `processed` and `stats`, adds only
  genuinely new seeds, upgrades pre-08-17 seed rows that are missing `channelName` (absent,
  that field disables the same-owner drop in triage), re-sorts views-ascending to match the
  policy the query encodes, and writes through a temp file and rename. A failed merge leaves
  state untouched.
  **Verified on a copy of live state:** 16,718 → 19,667 seeds, `processed` 13,784 and
  `qualified` 548 both intact, remaining 2,934 → **5,883**, ordering correct, 12,044 rows
  upgraded with a channel name.
- **A timer runs it.** `scripts/systemd/video-graph-sweep-refill.{service,timer}`, hourly at
  :30 so it does not collide with `graph-sweep-refill` (:10) or `peer-sweep-refill`.
  Installed, enabled, smoke-tested: while the sweep is live the tick exits in a second with
  `[refresh] sweep still running — skipping (let it drain)`.

### 2. A working lane can no longer report itself idle

`refill-peer-sweep.sh` now tees its own output into `logs/peer-sweep-sessions/` under a
`refill-<stamp>.log` name that `sessionStartMs()` parses. Verified by running the monitor's
own parser over the real journal output of the 05:35Z run: **75 seeds advanced**, where it
previously read 0.

## Recommended next, ranked

1. **Check the top lane is still walking tomorrow.** Two numbers settle it: seeds remaining
   in its summary should be thousands rather than zero, and `video-graph-sweep-refill`
   should log at least one tick reading `merged +N new seeds`. If both hold, the pipeline's
   best lead source is self-feeding for the first time.
2. **Email verification is the binding constraint now, not finding.** 446 good leads
   produced 147 verified emails and 149 parks; 274 went to `needs_contact`. Finding roughly
   doubled in two days and the reachable share has not moved off about a third.
3. **Stop re-seeding the comment sweep.** Daily timer, 30¢ a lead against 2.0¢ elsewhere,
   rate down from 5.48% to under 0.5% across nine laps. Disabling
   `comment-sweep-daily.timer` is one line, deliberately not done: switching a discovery
   lane off is Casey's call.
4. **Decide the outlet for `approved_hold`.** 2,907 prepped and ready to write, none
   emailed. The pool has grown every day for six weeks.
5. **Build the `needs_contact` recovery engine.** 3,769 creators found, scored and
   unreachable, up 274 today, the lane's largest single-day rise. Operation Bloodhound was
   built 08-18 and its audit is in the brain.
6. **Give the keyword harvest new seed phrases.** Unchanged since 07-13, carried on this
   list since 08-16. It found 389 channels because it has almost nothing left to search
   with.

## Status

Everything parked, nothing sent. `approved_hold` 2,907 + `needs_contact` 3,769 = **6,676
creators found and never contacted**. $0 Anthropic, $10.81 OpenRouter. Zero crashes, zero
scoring failures, zero quota stops, no fatal signatures for the twenty-first cycle. The
campaign loop and all five discovery lanes were left running.

## Provenance

Per-lane spend from `youtube-lead-finder-v1/logs/llm-spend-2026-08-1{9,20}.jsonl`,
restricted to the cycle window and grouped by the `task`/`job` fields. Hourly discovery
counts and the pool totals queried live from `leads.lead_candidates`. Lane book states from
`logs/video-graph-sweep-state.json`, `logs/graph-sweep-state.json`,
`logs/peer-sweep-state.json` and `logs/comment-sweep-state.json`. The broken seed query was
reproduced against the live database, and the merge was tested on a copy of live state, not
on the live file. Peer-sweep's hidden walk read from
`journalctl -u peer-sweep-refill.service`.
