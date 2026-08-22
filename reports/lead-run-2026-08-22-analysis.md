# Lead run analysis — 2026-08-22

Cycle window 2026-08-21T07:00Z to 2026-08-22T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-22.json`.
HTML debrief: [lead-run-2026-08-22.html](lead-run-2026-08-22.html).

## Headline

**+87 parked** (`approved_hold` 3,015 → 3,102), and good leads went **265 → 231**.
Yesterday's seed fix landed exactly as promised. The bottleneck moved.

The video-graph sweep got its 42,077 new seeds. It now has **37,012 seeds left**, about a
week of road, and the newly opened low-view band converts **26% better per seed** than the
band it replaced. Seed supply is no longer the problem for the lane that produces 80% of
our leads.

What limits it now is hours. The lane walks about **240 seeds an hour**, one process, one
seed at a time, and 8,303 seeds is what a day at that rate buys. It walked 11,415
yesterday, so with five times more material available it did **27% less walking**.

## The numbers

| Metric | Today | 08-21 |
|---|---:|---:|
| Parked into `approved_hold` | **+87** | +105 |
| `approved_hold` pool | 3,102 | 3,015 |
| `needs_contact` pool | 4,066 | 3,921 |
| **Total parked, none sent** | **7,168** | 6,936 |
| Channels found | 3,901 | 4,584 |
| Worth contacting (score ≥ 6) | **231 (5.9%)** | 265 (5.8%) |
| Emails verified | 86 | 106 |
| Share of good leads reachable | 37% | 40% |
| Dropped by niche exclusions | 0 | 19 |
| `scoring_failed` | 0 | 0 |
| Campaign sessions | 11 | 14 |
| Keyword finder passes | 274 | 301 |
| Stopped for want of terms | 0 hard stops, 11 on time budget | 3 hard, 11 time |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $5.93 (7,804 calls) | $7.48 |
| `fatal_signatures` | `[]` (23rd cycle) | `[]` |

Cost per lead worth contacting **2.6¢**, down from 2.8¢. Cost per lead parked **6.8¢**,
down from 7.1¢. Both the cheapest of the week. The pipeline got more efficient and still
produced less, which is the whole story of the day in two numbers.

### Shape of the day

Channels found per hour, 07:00Z through 06:00Z:

```
169  109   58  148  184  157  173  201  195  125  243  168
203  156  110  199  158  136  189  131  183  184  181  141
```

Flat again, low 58 at 09:00Z, high 243. No cliff, no hour where anything fell over. The
09:00Z dip is the video-graph sweep restarting onto the merged seed book.

## Where the leads came from

| Lane | Channels | Worth contacting | Rate | Spend | Cost per lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 3,016 | **184** | 6.1% | $4.30 | **2.3¢** |
| Keyword search | 575 | 35 | 6.1% | $1.36 | 3.9¢ |
| Recommended-videos feed | 144 | 9 | 6.3% | $0.18 | 2.0¢ |
| Peer-network comments | 164 | 2 | 1.2% | $0.09 | 4.3¢ |
| Podcast crossover | 1 | 1 | — | $0.00 | — |
| Guest-link mining | 1 | 0 | 0% | — | — |
| Comment sweep (paused) | 0 | 0 | — | — | — |

The video-graph sweep is **80% of the day's good leads**, up from 76%. Keyword spend
breaks down as $0.77 on inventing new terms (`discover-veins`), $0.56 on the finder agent
and $0.03 on the autocomplete harvest.

**Best niches:** Real Estate 49, Coaching & Consulting 41, Other 34, Health & Wellness
Clinics 26, Transformation & Performance Coaching 23, Relocation & Lifestyle Design 17,
Marketing & Growth Agencies 10, Financial Planning 9, Legal Services 8, Business Growth
Coaching 8, Manufacturing 3, Wealth & Asset Protection 2, Tax & Accounting 1.

## Seed books at the end of the cycle

| Lane | Seeds | Walked | Remaining | Walked today | vs yesterday | Road left |
|---|---:|---:|---:|---:|---:|---:|
| **Video-graph sweep** | **61,975** | 24,963 | **37,012** | 8,303 | **−27%** | 4.5 days |
| Recommended-videos feed | 10,779 | 10,779 | 0 | 223 | −13% | drained |
| Peer-network comments | 10,673 | 10,673 | 0 | 229 | −13% | drained |
| Comment sweep (off) | 139 | 80 | 59 | 0 | — | n/a, off |

## Q1 — did the widened seed book merge?

Yes. The sweep restarted at 09:30Z onto a book of **61,975 seeds with 42,096 remaining**,
against 417 remaining the night before. That is **+42,077 new seeds**, within 3 of the
dry-run estimate, and the merge kept the walked list intact so nothing was re-walked.

The quality question the fix left open is also answered, and the answer is good. Compared
against the old 100k-view band it replaced:

| | Today (20k floor) | 08-21 (100k floor) |
|---|---:|---:|
| Channels per seed | 0.363 | 0.274 |
| Good leads per seed | **0.0222** | 0.0176 |

The low-view band is **26% denser in good leads** per seed walked. The lane's own written
policy said low-view rails are the most ICP-dense, seeds walk in ascending view order, and
the measurement now backs both. Dropping the floor to 5,000 views (another 46,000 seeds)
is justified on this evidence.

## Q2 — then why did the day fall again?

**Because the constraint moved off seed supply and onto walk rate, and nothing was
measuring walk rate.**

The sweep is one process. Its current session did **260 chunks of 20 seeds in 21.8 hours**,
which is 5.0 minutes per chunk. Of that, 40 seconds is the deliberate 2-second pause
between watch-page fetches that protects the shared proxy pool. The other 4 minutes and 20
seconds is a sequential loop over the candidate channels that chunk turned up: fetch the
channel and its recent videos, score it, then name the host. That is two LLM round trips
per candidate, taken one candidate at a time, about seven candidates a chunk.

At 240 seeds an hour the arithmetic is fixed:

- 37,012 seeds remaining is **about 7 days**, not the 4.5 the snapshot reports (the
  snapshot divides by today's 8,303, which included the fast tail of the old book).
- The lane's ceiling is roughly **5,700 seeds a day**, so at today's 0.0222 good leads per
  seed it tops out near **125 leads a day** from its best lane.

More seeds cannot fix that. Yesterday's fix bought a week of road for a lane that can only
drive it at one speed.

## Q3 — was anything watching for this?

No, and it is the mirror image of yesterday's miss. Yesterday the monitor could not see an
**empty** book. Today every field on the video-graph lane was green: `productive: true`,
`book_drained: false`, `days_of_road: 4.5`, `idle_run_streak: 0`. All correct, and all of
them measuring seed supply, which had stopped being the thing that mattered. A 27% drop in
throughput on the pipeline's biggest lane passed with nothing to point at.

Fixed today, in the same place as yesterday's fix.

## Shipped today

One commit. Verified against live state before committing. Nothing in any `.env`.

### `youtube-outreach-orchestrator-v1` — flag a lane that has road left but walked slower

`scripts/autopilot/debrief-data.ts`, commit `eabce38`. Lane health gains
`seeds_advanced_prev`, `walk_rate_change_pct` and `throughput_bound`.

The baseline is the previous cycle's own debrief snapshot, which this same script wrote 24
hours earlier and which is already on disk, so the comparison costs one file read and no
network. A missing baseline reports nulls rather than a false alarm.

`throughput_bound` fires only when a lane has **road left** (`book_drained: false` and at
least a day of `days_of_road`) and still walked 20% less than last cycle. A drained book
explains its own slowdown, and `book_drained` already owns that case, so the two flags
never double-report the same finding.

Verified by running the real generator against live state:

| Lane | walked | prev | change | `throughput_bound` |
|---|---:|---:|---:|---|
| **video_graph_sweep** | 8,343 | 11,415 | **−26.9%** | **true** |
| recommended_videos_feed | 223 | 257 | −13.2% | false (drained) |
| peer_sweep | 229 | 262 | −12.6% | false (drained) |

It flags the right lane and stays quiet on the two whose slowdown is already explained.
Eight new cases in `debrief-data.selftest.ts` cover the regression shape, the drained
lane, the sub-one-day lane, a small dip, a speed-up, a missing baseline and a lane that
was stopped last cycle. All pass. The authoritative 08-22 snapshot was restored after the
test run, so the numbers in this debrief are the ones the timer generated at 07:20Z.

## Looked at and deliberately left alone

**The keyword lane's vein discovery is nearly always dry, and the guard meant to catch
that never fires.** `discover-veins` ran **101 times** this cycle, asked for 4,040 terms
and wrote **246**, of which 42 were new ideas rather than variations. **55 of the 101 calls
wrote exactly one term.** The discovery-dry guard built on 07-14 exists to skip these, but
it re-arms on any single candidate, and a call that writes one term both clears the mark
and grows the term table past it. So it suppressed nothing.

Left alone on purpose. The lane returned **35 good leads at 3.9¢ each**, YouTube quota is
not scarce (0 quota stops, 66 keys), and the whole loop costs $0.77 a day. Tightening the
guard would cut the lane's term supply to buy back less than a dollar. Worth knowing it is
running open, not worth closing.

## Not a fault

- 21 term-starvation heartbeats and 0 hard stops in the keyword lane. Documented state
  since the lane was demoted to opportunistic on 08-14, and better than yesterday's 3.
- 11 sessions ending on their time budget.
- The two drained rail lanes restarting 24 and 12 times to walk 223 and 229 seeds. That is
  the refill correctly supplying the handful of channels we newly qualify each hour.
- The comment sweep at 0 runs and a 45-hour-old state file. It is off by your order, and
  `comment-sweep-daily.timer` stays `disabled`.
- $0 Anthropic for the twenty-third consecutive cycle. Zero crashes, quota stops, scoring
  failures and fatal signatures.

## Recommended next, ranked

1. **Make the video-graph sweep walk more than one candidate at a time.** This is the
   ceiling now, and it is measured, not guessed: 5 minutes per 20 seeds, of which 40
   seconds is protective pacing and the rest is a sequential per-candidate loop doing two
   LLM round trips each. Running four candidates concurrently inside a chunk would roughly
   triple the lane, and it touches OpenRouter and the channel-details endpoint, not the
   watch-page walk that the proxy pacing protects. **Not shipped tonight on purpose:** it
   restructures the money and quota path of a service that runs 24/7, and that deserves
   your eyes before it goes live.
2. **The recommended-videos feed still needs a decision, not a repair.** Carried from
   yesterday, unchanged. It converts at 6.3% on 144 channels and its book is finished. The
   ranking in `standing-orders.md` is untouched, because re-ranking a lane is your call.
3. **Decide the outlet for `approved_hold`.** 3,102 leads prepped and ready to write, none
   emailed. Eight straight weeks of growth.
4. **Build the `needs_contact` recovery engine.** 4,066 creators found, scored and
   unreachable, up 145 today. It crossed 4,000 this cycle. Operation Bloodhound was built
   on 08-18 and its audit is in the brain.
5. **Drop the video-graph seed floor to 5,000 views.** Q1 measured the widened band at 26%
   better per seed, which removes the reason to hold the floor at 20,000. Adds roughly
   46,000 seeds. Worth doing only after item 1, since road is no longer what is short.
6. **Give the keyword harvest new seed phrases.** Carried since 08-16, unchanged since
   07-13. It converts at 6.1%, level with the best lane, and spent $0.77 of the day's
   $5.93 inventing terms to make up for having none.

## Status

Everything parked, nothing sent. `approved_hold` 3,102 plus `needs_contact` 4,066 is
**7,168 creators found and never contacted**. $0 Anthropic, $5.93 OpenRouter. The campaign
loop and all live discovery lanes were left running. The comment sweep stays off.
