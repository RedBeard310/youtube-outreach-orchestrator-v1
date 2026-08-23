# Lead Run Analysis — 2026-08-23

Cycle: 2026-08-22 07:00Z → 2026-08-23 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-23.json`.
HTML debrief: [lead-run-2026-08-23.html](lead-run-2026-08-23.html).

**Headline:** the best day of the week on every number, and the metric both of
yesterday's findings rested on turns out to double-count long sessions. 4,788
channels found, 276 worth contacting, 99 parked. The top lane walked 7,523 seeds,
not the 12,647 the snapshot reported.

---

## 1. The numbers

| Metric | 2026-08-23 | 2026-08-22 |
|---|---:|---:|
| Parked into `approved_hold` | **+99** | +87 |
| `approved_hold` pool | 3,203 | 3,104 |
| `needs_contact` pool | 4,241 | 4,066 |
| **Total found, never contacted** | **7,444** | 7,170 |
| Channels found | **4,788** | 3,901 |
| Worth contacting (score ≥ 6) | **276 (5.8%)** | 231 (5.9%) |
| Emails verified | 97 | 86 |
| Share of good leads reachable | 35% | 37% |
| `scoring_failed` | 0 (0.0%) | 0 |
| Campaign sessions | 13 started / 14 finished | 11 |
| Keyword finder passes | 324 | 274 |
| Hard stops · time-budget stops | 0 · 14 | 0 · 11 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | $7.42 (9,600 calls) | $5.93 |
| `fatal_signatures` | `[]` (24th cycle) | `[]` |

Cost per lead worth contacting **2.7¢** (was 2.6¢). Cost per lead parked **7.5¢**
(was 6.8¢). Spend rose 25% while good leads rose 19%, so efficiency slipped
slightly even though volume improved.

Hourly channel discovery was the flattest on record: low 150, high 252, no hour
below 150 and none above 252 across all 24 hours.

## 2. Where the leads came from

| Lane | Channels | Score ≥ 6 | Rate | Spend | ¢/lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 3,377 | **220** | 6.5% | $5.13 | **2.3¢** |
| Keyword search | 939 | 47 | 5.0% | $1.88 | 4.0¢ |
| Peer-network comments | 298 | 5 | 1.7% | $0.16 | 3.2¢ |
| Recommended-videos feed | 171 | 4 | 2.3% | $0.25 | 6.3¢ |
| Guest-link mining | 3 | 0 | 0% | — | — |
| Podcast crossover | 0 | 0 | — | — | — |
| Comment sweep (paused) | 0 | 0 | — | — | — |

The video-graph sweep is 80% of the day's good leads for the second day running.
Keyword spend splits $1.02 on inventing terms, $0.86 on the finder agent, and
under a cent on the autocomplete harvest.

**Niches (pitchable):** Coaching & Consulting 50, Other 50, Real Estate & Property
41, Transformation & Performance Coaching 35, Health & Wellness Clinics 24,
Relocation & Lifestyle Design 23, Business Growth Coaching 20, Financial Planning
& Investing 10, Legal Services 9, Marketing & Growth Agencies 5, Manufacturing 3,
Practice Growth Coaching 2, Luxury Asset Brokerage 2, Wealth & Asset Protection 1,
Business Brokerage & M&A 1.

## 3. Seed books

| Lane | Seeds | Walked | Remaining | Walked this cycle | Snapshot said | Road left |
|---|---:|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 61,975 | 32,486 | **29,489** | **7,523** | 12,647 | 3.9 days |
| Recommended-videos feed | 11,048 | 11,048 | 0 | 269 | 367 | drained |
| Peer-network comments | 10,937 | 10,937 | 0 | 264 | 264 | drained |
| Comment sweep (off) | 139 | 80 | 59 | 0 | — | n/a, off |

"Walked this cycle" is the change in each lane's own seed book between the 08-22
and 08-23 snapshots, which is exact. See §5.

## 4. Why the top lane walked 36% more

Not a speed-up in any useful sense. The sweep walks 20 seeds per chunk, gathers
the channels those seeds link to, and pays two LLM round trips per channel it has
not seen. Fewer new channels per chunk means a shorter chunk.

Session ending in today's cycle vs. the session ending in yesterday's:

| | Today | Yesterday |
|---|---:|---:|
| New channels per chunk | 61.6 | 69.0 |
| LLM calls per chunk | 7.08 | 7.97 |
| Seeds per hour | **315** | 235 |
| Channels per seed | 0.449 | 0.547 |
| Good leads per seed | **0.0292** | 0.0334 |

The lane got 34% faster and 13% thinner per seed, and the faster part won on
volume. That trade is fine with 29,489 seeds left, but the two numbers move in
opposite directions: **a rising walk rate on this lane is evidence the book is
thinning, not evidence anything improved.**

Casey's 07:54Z commit (`fa58f12`, finder) restoring the 1k–200k subscriber seed
band and dropping the 200k–1m expansion tail did **not** affect this cycle. The
sweep works from a frozen snapshot of its book and ignores the seed file until a
reset, so that commit changes the next refill, not this walk.

## 5. The measurement bug (the day's real finding)

`sweepWorkInCycle` in `debrief-data.ts` finds every session log that *overlaps*
the 24h window and sums each one's **whole** advance, not the part inside the
window.

Exact for lanes with short, contained sessions. Wrong for a daemon that runs one
22–24h session. Today's window caught the tail of a session that started at 09:30
the previous morning and counted that session's entire 5,204-seed history as work
done in the last 38 minutes.

| Lane | Reported | Actual | Inflation |
|---|---:|---:|---:|
| **Video-graph sweep** | 12,647 | **7,523** | **+68%** |
| Recommended-videos feed | 367 | 269 | +36% |
| Peer-network comments | 264 | 264 | exact |

Peer-network agreeing exactly is the tell: short sessions, no drift.

**Consequences.** `days_of_road` divides by this number, so the top lane was
reported with 2.3 days of road against a true 3.9. `walk_rate_change_pct` divides
by it twice, and that is what produced yesterday's headline — a 27% throughput
regression on the lane that makes 80% of our leads. Today's honest reading is
that the lane sped up. **Yesterday's underlying ceiling argument still stands on
its own evidence** (one process, one candidate at a time, 5 minutes per 20 seeds);
the number that raised the alarm did not.

## 6. What broke

Nothing. Zero crashes, zero quota stops, zero scoring failures, no fatal
signatures for the 24th consecutive cycle, $0 on the Anthropic API.

**One escalation, already closed.** At 09:50Z the hourly check-in paged a
fix-agent over a `pitchable_rate_collapse` alert. False alarm: the keyword lane
was in its documented degraded state, and the check-in detects that by grepping
one log line inside a two-file window that the line had scrolled out of. The
agent taught the check-in to also trust its own structured starvation signal, and
committed it (`283a4e4`, orchestrator). It held — no further escalation in the
remaining 21 hours. The agent bills the Max subscription, not the API.

**Not faults:** 17 term-starvation heartbeats and 0 hard stops in the keyword
lane (documented state since 08-14, down from 21); 14 sessions ending on time
budget; the two drained rail lanes restarting 25 and 12 times to walk 269 and 264
seeds, which is the refill correctly supplying the handful of channels the ICP
newly qualifies each hour; comment sweep at 0 runs with a 69-hour-old state file,
which is off by Casey's order and stays `disabled`.

## 7. Shipped

**`autopilot-improve: measure a cycle's seed walk from the seed book, not from
whole overlapping session logs`** — `21b3f84`, orchestrator,
`scripts/autopilot/debrief-data.ts`.

The exact number was already on disk and unused. Each lane's state file carries
how much of its book is walked; this generator has written that into the daily
snapshot since 08-22; the difference between two consecutive snapshots is
precisely the work done between them.

- `reconcileAdvanced(loggedAdvance, walkedNow, walkedPrev)` prefers the book
  delta and falls back to the log sum only when the book cannot answer: no
  baseline snapshot (fresh deploy, skipped cycle) or a **negative** delta, which
  is how a re-lap or a refill that drops merged rows shows up.
- New `seeds_advanced_source` field (`book_delta` / `session_logs` / `none`)
  names which method produced each number, so the two are never silently mixed.
- `walkRateTrend` gained a `comparableBaseline` argument. A baseline written
  before tonight is a log sum by definition, so comparing today's corrected
  number against it would manufacture a drop. It reports the percentage but will
  not escalate to `throughput_bound` across a mixed comparison. Self-heals from
  the next cycle.
- `seedBook` split into `seedCounts` (pure counts) plus a `days_of_road`
  composition step, because the advance now has to be settled before the road
  that divides by it.

Verified by running the real generator against live state:

| Lane | Now reports | Would have reported | Source | Road |
|---|---:|---:|---|---:|
| `video_graph_sweep` | **7,563** | 12,647 | `book_delta` | 3.9 days |
| `recommended_videos_feed` | 269 | 367 | `book_delta` | drained |
| `peer_sweep` | 264 | 264 | `book_delta` | drained |
| `comment_sweep` (off) | 0 | null | `book_delta` | n/a |

Peer-network landing on 264 either way is the check that the new path is not a
different kind of wrong. Ten new selftest cases; all 40 pass. The authoritative
08-23 snapshot was restored after the test run, so every number in §1–§4 is the
one the timer generated at 07:20Z. Nothing in any `.env`.

## 8. Looked at and left alone

**The keyword lane's term treadmill tripled overnight.** Vein discovery ran 337
times and wrote 1,578 new terms (1,525 of them probes). Those terms ran 2,090
times, returned 57,444 channel results, qualified 73 channels, and **all 1,578
are already paused** — invented, run once, auto-retired as saturated. Yesterday:
101 calls, 246 terms.

Left alone for the same reason as yesterday. The lane returned 47 good leads at
4.0¢ each, its best count in days; YouTube quota is nowhere near scarce; the loop
costs $1.88/day. The one thing worth recording: **inventing terms ($1.02) now
costs more than running them ($0.86).** When that ratio worsens, this becomes a
decision.

**The scorer's own number is discarded on roughly one call in four.** 597 of
2,639 scoring calls in today's sweep session logged `Model reported score=0,
signal-weight sum=2. Using recomputed value`, and 518 of those were a reported
zero. The recompute is a guardrail working as designed and the lane hit 6.5%, its
best of the week, so nothing is broken. It does mean the model frequently omits
the score field and the fallback carries the lane. Not worth touching while the
output is this good.

## 9. Recommended next, ranked

1. **Make the video-graph sweep walk more than one candidate at a time.** Carried
   from 08-22 and still the top lever, but re-scoped: the case is cleaner, not
   more urgent. 5 min per 20 seeds, of which 40 s is protective proxy pacing and
   the rest is a sequential per-candidate loop doing two LLM round trips each.
   Four concurrent candidates would roughly triple the lane, and it touches
   OpenRouter and the channel-details endpoint, not the watch-page walk the
   pacing protects. **Not shipped:** it restructures the money and quota path of
   an around-the-clock service and needs Casey's eyes.
2. **The recommended-videos feed needs a decision, and it got easier.** Fell to
   2.3% today on 171 channels, from 6.3% yesterday and 7.5% at its peak. Book
   finished, sixth lap, no longer the cheapest lead in the pipeline. Still ranked
   #1 in `standing-orders.md` because re-ranking is Casey's call.
3. **Decide the outlet for `approved_hold`.** 3,203 prepped, none emailed. Nine
   straight weeks of growth.
4. **Build the `needs_contact` recovery engine.** 4,241 creators found, scored,
   unreachable, up 175 today. Operation Bloodhound built 08-18; audit in brain.
5. **Drop the video-graph seed floor to 5,000 views.** Measured 08-22 at 26%
   better per seed. Adds ~46,000 seeds. Only after item 1 — road is not the short
   thing.
6. **Give the keyword harvest new seed phrases.** Carried since 08-16, unchanged
   since 07-13. Converts at 5.0% and now spends more inventing terms than running
   them.

---

**Status:** everything parked, nothing sent. `approved_hold` 3,203 + `needs_contact`
4,241 = **7,444 creators found and never contacted**. $0 Anthropic API, $7.42
OpenRouter. The campaign loop and all live discovery lanes were left running; the
comment sweep stays off, as ordered.
