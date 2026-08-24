# Lead Run Analysis — 2026-08-24

Cycle: 2026-08-23 07:00Z → 2026-08-24 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-24.json`.
HTML debrief: [lead-run-2026-08-24.html](lead-run-2026-08-24.html).

**Headline:** the best parking day in six weeks, and finding had almost nothing to
do with it. 189 leads parked, roughly 77 of them recovered from creators we had
already found and written off, by the lane Casey merged at 21:27Z the night
before. The lane also spent credits re-checking addresses it had already ruled
dead, on night one. That is fixed.

---

## 1. The numbers

| Metric | 2026-08-24 | 2026-08-23 |
|---|---:|---:|
| Parked into `approved_hold` | **+189** | +99 |
| `approved_hold` pool | 3,394 | 3,203 |
| `needs_contact` pool | 4,345 | 4,241 |
| **Total found, never contacted** | **7,739** | 7,444 |
| Channels found | **5,101** | 4,788 |
| Worth contacting (score ≥ 6) | **285 (5.6%)** | 276 (5.8%) |
| Emails verified | 109 | 97 |
| Share of good leads reachable | 38% | 35% |
| `scoring_failed` | 0 (0.0%) | 0 |
| Campaign sessions | 16 started / 15 finished | 13 / 14 |
| Keyword finder passes | 334 | 324 |
| Hard stops · time-budget stops | 1 · 14 | 0 · 14 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | $7.95 (10,688 calls) | $7.42 (9,600) |
| `fatal_signatures` | `[]` (25th cycle) | `[]` |

Cost per lead worth contacting **2.8¢** (was 2.7¢). Cost per lead parked **4.2¢**
(was 7.5¢), the cheapest of the run. The park figure fell because recovered leads
carry no LLM cost at all: the finding was paid for weeks ago.

Hourly channel discovery: low 159, high 279, no hour at zero. Flat, in a slightly
wider band than yesterday.

## 2. Where the leads came from

| Lane | Channels | Score ≥ 6 | Rate | Spend | ¢/lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 3,815 | **218** | 5.7% | $5.72 | **2.6¢** |
| Keyword search | 841 | 55 | 6.5% | $1.88 | 3.4¢ |
| Recommended-videos feed | 173 | 11 | **6.4%** | $0.25 | **2.3¢** |
| Peer-network comments | 269 | 1 | 0.4% | $0.11 | 11¢ |
| Guest-link mining | 3 | 0 | 0% | — | — |
| Podcast crossover | 0 | 0 | — | — | — |
| Comment sweep (paused) | 0 | 0 | — | — | — |

Video-graph is 76% of the day's good leads, down from 80%. Keyword spend splits
$0.93 on the finder agent and $0.95 on inventing terms.

Two lanes moved hard in opposite directions. The **recommended-videos feed jumped
back to 6.4%** after yesterday's 2.3%, which softens the case for retiring it.
**Peer-network comments produced 1 good lead from 269 channels**, against 5 from
298 yesterday and 13 the day before.

**Niches (pitchable):** Other 69, Real Estate & Property 46, Coaching & Consulting
44, Health & Wellness Clinics 40, Transformation & Performance Coaching 21,
Business Growth Coaching 18, Relocation & Lifestyle Design 14, Marketing & Growth
Agencies 9, Legal Services 8, Financial Planning & Investing 6, Luxury Asset
Brokerage 3, Sales Training 2, Tax & Accounting 2, Manufacturing 2, Practice
Growth Coaching 1.

## 3. Seed books

| Lane | Seeds | Walked | Remaining | Walked today | Road left |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | **61,975** | 41,196 | **20,779** | **8,710** | 2.4 days |
| Recommended-videos feed | 11,335 | 11,335 | 0 | 287 | drained |
| Peer-network comments | 11,215 | 11,215 | 0 | 278 | drained |
| Comment sweep (off) | 139 | 80 | 59 | 0 | n/a, off |

Every "walked today" is a seed-book delta, the method that shipped last night.
`seeds_advanced_source` reads `book_delta` on all four lanes.

## 4. Where the 189 parked leads came from (the day's finding)

Casey merged the `needs_contact` recovery lane at 21:27Z on 08-23 (`1bea933`). It
works the pool of creators who clearly fit, who we located and scored, but whose
email we could never confirm. Nothing had touched that pool since a single
hand-run on 08-18.

Three independent counts agree:

| Source | Count |
|---|---:|
| `approved_hold` rows carrying a recovery-collected email, touched this cycle | 84 |
| Flips recorded in the merge commit's own live-evidence note (hand-run) | 70 |
| Flips by the scheduled lane's first pass (23:30Z) | 7 |

So roughly **77 to 84 of the 189** are recovered, and the remaining ~110 came from
the normal find-then-verify path, which is an ordinary day on its own.

**Why this matters more than the raw number:** recovered leads cost nothing to
find. That is the entire reason cost per parked lead fell 7.5¢ → **4.2¢** while
cost per lead *found* barely moved. Recovery is a second pass over supply already
bought, not new supply.

**One number to keep honest:** `needs_contact` still grew, 4,241 → 4,345, because
the day's finding swept 172 fresh unreachable creators in while recovery pulled
fewer out. The pool is not shrinking yet.

## 5. The top lane sped up; the snapshot's −31% is a stale baseline

The snapshot reports `walk_rate_change_pct: -31.1` for video-graph, comparing
today's **8,710** against yesterday's stored **12,647**. That stored figure is the
old double-counted log sum, written before last night's fix. The true 08-23 walk
was **7,523**, so today is **+15.8%**.

**The guard shipped last night worked.** `throughput_bound` came back `null`, not
`true`: it reports the percentage but refuses to escalate when the two sides were
measured differently. Without it this debrief would be leading with a second
phantom regression in three days. Tomorrow both sides are book deltas and the flag
arms itself again.

Checked independently against the sweep's own session log:

| | Today's session | Yesterday's session |
|---|---:|---:|
| Chunks of 20 seeds | 416 | 394 |
| Hours running | 22.9 | 24.9 |
| **Seeds per hour** | **364** | 316 |
| LLM calls per chunk | 6.81 | 7.07 |
| Channels per seed | 0.438 | 0.449 |
| **Good leads per seed** | **0.0250** | 0.0292 |

+15.2% by session log against +15.8% by seed book. Two methods sharing no code
agree, so the reading is safe.

The pattern named yesterday continues: **faster because thinner.** Good leads per
seed fell another 14%. Road left is now 2.4 days.

## 6. The recovery lane was paying to re-check dead addresses

Both scheduled verify passes ran:

| | Pass 1 (23:30Z) | Pass 2 (02:40Z) |
|---|---:|---:|
| Leads selected | 91 | 84 |
| Addresses rejected as somebody else's | 83 | 83 |
| Addresses checked (credits spent) | 42 | 34 |
| No deliverable address | 33 | 33 |
| **Flipped to ready-to-write** | **7** | **0** |

The three identical numbers are the tell. Pass two re-selected 84 of the same 91
leads, re-rejected the same 83 addresses, re-checked the same 33 dead ones, and
flipped nobody.

**Cause: `verified = false` means two different things.** Bloodhound writes it
when an address has not been checked yet, when ZeroBounce says undeliverable, and
when the identity gate rejects the address as a stranger's. The lane's selector
read all three as work waiting.

**Cost if left alone:** 8 passes a day × ~34 wasted credits ≈ **270 credits a day,
indefinitely**, for a guaranteed zero, plus an ownership note re-appended to the
same rows every pass.

Measured on the live database this morning:

| | Count |
|---|---:|
| Leads the old selector returned | 85 |
| ...already ruled on | 83 |
| Address records with a duplicate ownership note after 2 passes | 83 |
| Email points already checked and dead | 144 |
| **Leads the fixed selector returns** | **2** |

98% of the lane's paid work was repeat work, on night one.

## 7. What broke

**Nothing fatal.** Zero crashes, zero quota stops, zero scoring failures, no fatal
signatures for the 25th consecutive cycle, $0 Anthropic API. No escalation, no
fix-agent, no halt flag. Every service ran and every timer fired.

**Not faults:** one hard stop at 06:08Z reading `term_supply_exhausted`, the
keyword lane's documented state since it was demoted to opportunistic on 08-14,
alongside 15 starvation heartbeats (down from 17); 14 sessions ending on time
budget; the two drained rail lanes restarting to walk 287 and 278 seeds, which is
the hourly refill correctly supplying the handful of channels we newly qualify;
the comment sweep at 0 runs with a 93-hour-old state file, off by order and still
`disabled`.

**Worth watching:** peer-network comments at 1 lead from 269 channels. Drained
since 08-21 and now walking its own tail. One day is not a trend.

## 8. Shipped

Four commits, three repos. Each verified against live state before committing.
Nothing in any `.env`.

### 1. `d6af815` (orchestrator) — the recovery lane stops re-checking dead addresses

`src/recovery/bloodhound-lane.ts`. `selectVerifiableIds` now excludes any contact
point carrying either mark the tool already writes: `verified_at` (ZeroBounce
returned a verdict) or an `[ownership:` note (the identity gate rejected it before
a credit was spent). Both marks were already on disk and unread.

Live check: the selector goes **85 → 2**. The free collection selector is
untouched and still returns its full 40. The note test is what removes the need
for a backfill, since ownership-rejected rows carry no `verified_at` yet. The SQL
is now an exported constant with a regression test locking both new clauses and
the two original guards. 8/8 tests pass, typecheck clean.

### 2. `5efd7a7` (email repo) — an ownership rejection is recorded as permanent

`src/bloodhound/verify.ts`. The ownership branch now stamps `verified_at` the way
the paid branch does, so "already ruled on" is a single column for any future
caller, and appends its note only once. Safe: `verified_at` is written in exactly
one other place and read nowhere in either repo. Typecheck clean.

### 3. `c347c21` (finder) — the sweep's cost line names its scopes

`scripts/video-graph-sweep.ts`. The line read
`+1366 qualified so far | 2835 llm calls | $34.1729`: three numbers, three scopes,
no labels. `qualified` and `usd` accumulate across every session ever run on this
book; `llm_calls` resets each run. Dividing gives 1.2¢ a call when the run really
spent **$5.44 at 0.07¢**, off 17×. Nothing is computed differently; the scopes are
named in both the per-chunk line and the summary. Same class of error as the
withdrawn 08-22 throughput finding.

### 4. `a077ff9` (orchestrator) — standing orders stop calling the engine unbuilt

`docs/standing-orders.md` described `needs_contact` as an unbuilt lever awaiting
Casey's green light at a pool of ~2,600. It is built, running, and the pool is
4,345. The change-log entry carries the "false means two things" trap.

## 9. Looked at and left alone

**The recovery lane's free half is the one worth tuning.** Collection spends no
credits and no LLM. It runs 40 leads per 6h = 160/day against **2,996 untouched
leads**, about 19 days for one pass. At ~0.3 emails found per lead it feeds verify
roughly 48 new addresses a day, which is now exactly what verify looks at.
Raising the batch is the obvious lever and is left for Casey: it decides how hard
we hit other people's websites, which is a judgment call, not a bug.

**Term invention held steady rather than tripling again.** 406 discovery calls for
$0.95, against 337 for $1.02 yesterday. Inventing still costs slightly more than
running ($0.95 vs $0.93), the ratio flagged yesterday. The lane returned 55 leads
at 3.4¢, its best count and rate of the week. Probe pool: 18,187 total, 10,875
tested, 2,107 never run.

## 10. Recommended next, ranked

1. **Turn the recovery lane up.** Day's headline, running at a fraction of
   capacity: 40 leads/6h against 2,996 untouched. The expensive half is now
   correctly bounded, so raising the free collection batch raises output without
   raising the credit bill. Needs Casey's call only because it sets scraping
   intensity.
2. **Make the video-graph sweep walk more than one candidate at a time.** Carried
   since 08-22, case unchanged. ~3× the lane. Not shipped: it restructures the
   money and quota path of a 24/7 service. Road left down to 2.4 days raises this
   against item 4.
3. **Decide the outlet for `approved_hold`.** 3,394 prepped, none emailed, now
   filling from two sources instead of one.
4. **Drop the video-graph seed floor to 5,000 views.** Measured 08-22 at 26%
   better per seed, adds ~46,000 seeds. The "only after item 2" caveat is close
   to expiring.
5. **Watch peer-network comments.** 1 lead from 269 channels, against 5 and 13 the
   two prior days. Drained since 08-21. Two more days like this and it needs the
   same decision as the feed lane.
6. **Give the keyword harvest new seed phrases.** Carried since 08-16, unchanged
   since 07-13. Converted at 6.5% today, purely volume-starved.

---

**Status:** everything parked, nothing sent. `approved_hold` 3,394 + `needs_contact`
4,345 = **7,739 creators found and never contacted**. $0 Anthropic API, $7.95
OpenRouter. The campaign loop and all live discovery lanes were left running; the
comment sweep stays off, as ordered.
