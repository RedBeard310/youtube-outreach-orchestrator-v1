# Lead run analysis — 2026-08-19

Cycle window 2026-08-18T07:00Z to 2026-08-19T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-19.json`.
HTML debrief: [lead-run-2026-08-19.html](lead-run-2026-08-19.html).

## Headline

**+105 parked** (`approved_hold` 2,653 → 2,758), the smallest gain in four days, and the
day's good leads halved from 379 to **188**.

Most of that has one cause. At 22:17Z the video-graph sweep, which produced 77% of
yesterday's good leads, stopped and stayed stopped. It relaunched **33 times across nine
hours**, each run announcing "likely IP block or dead proxy pool", each run retrying the
identical twenty seeds, and it was still stopped when this debrief started.

**Nothing was blocked.** Those twenty videos are Shorts and age-gated uploads, and a
logged-out watch page for one of those renders in full with no recommendation rail on it.
The lane could not use the seeds and could not get past them either, because its outage
guard refuses to consume a seed it thinks failed for network reasons. Fixed, deployed and
verified: the lane restarted at 07:37Z, cleared the poisoned chunk in under two minutes,
and returned 91 candidate channels on the next one.

## The numbers

| Metric | Value | Prior day |
|---|---:|---|
| Parked into `approved_hold` | **+105** | +131 |
| `approved_hold` pool | 2,758 | 2,649 |
| `needs_contact` pool | 3,495 | 3,428 |
| **Total parked, none sent** | **6,253** | 6,077 |
| Channels found | 4,735 | 6,741 |
| Worth contacting (score ≥ 6) | **188 (4.0%)** | 379 (5.6%) |
| Emails verified | 58 | 129 |
| `scoring_failed` | 0 | 0 |
| Campaign sessions | 34 | 33 |
| Finder passes | 77 | — |
| Stopped for want of terms | 33 of 34 | 33 of 33 |
| Quota stops | 0 | 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $5.46 (7,885 calls) | $10.03 |
| `fatal_signatures` | `[]` (20th cycle) | `[]` |

Cost per lead worth contacting **2.9¢**; per lead parked **5.2¢**. Both worse than
yesterday, on a day the cheapest lane was switched off for nine hours by a bug.

### Shape of the day

Channels found per hour, 07:00Z through 06:00Z:

```
149  158  431  286  843  703  104  150  156  176  239  169
178  158  184   19    2   58   73   92  104   91   91  121
```

The cliff is the freeze, visible to the hour: 184 channels in the 21:00Z hour, then 19,
then 2. Everything after that is the other lanes carrying the night alone at roughly 90
channels an hour. The 11:00Z peak of 843 channels yielded only 11 good leads, which is
what a sweep looks like walking the low-quality part of its book.

## Where the leads came from

| Lane | Channels | Worth contacting | Rate | Scoring spend | Cost per lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 2,089 | **144** | **6.9%** | $3.61 | 2.5¢ |
| Recommended-videos feed | 687 | 39 | 5.7% | $0.91 | **2.3¢** |
| Keyword search | 83 | 4 | 4.8% | $0.09 | **2.2¢** |
| Peer-network comments | 238 | 1 | 0.4% | $0.13 | 12.8¢ |
| Comment sweep | 1,637 | **0** | **0%** | $0.61 | no leads at all |
| Guest-link mining | 1 | 0 | — | — | — |

A further **$0.12** went on inventing new search terms (30 calls), the machinery the 08-16
debrief measured at a 0.23% qualified rate against the real term book's 2.25%.

Best niches: Other 39, Health & Wellness Clinics 32, Real Estate 29, Coaching &
Consulting 24, Transformation & Performance Coaching 18, Business Growth Coaching 9,
Legal 7, Relocation & Lifestyle Design 6.

## Q1 — was the biggest lane really IP-blocked?

No. The lane printed this 33 times:

```
[video-sweep] STOP: 20 consecutive seeds returned empty/blocked rails
              — likely IP block or dead proxy pool. Nothing consumed
              from this chunk; resuming later.
```

I fetched those exact seeds live through the same proxy pool the lane uses. Every one came
back **HTTP 200, about 845KB**, carrying `isShortsEligible`, `Sign in to confirm your age`
and `LOGIN_REQUIRED`, with exactly **one** distinct channel link on the page: the seed's
own channel. Those seeds are Shorts and age-gated videos. They have no rail to walk.

The bug is the handling, not the seeds. The code had two categories for a failed fetch,
"worked" and "the network is against us", and reality has a third: a page that rendered
perfectly and simply has nothing on it. Filed under the second category, each railless
page counted toward an outage streak, and an outage means "keep the seed, something is
wrong out there." Twenty of those stopped the run with nothing consumed, so the next launch
drew the same twenty seeds from the same state file and hit the same wall.

Two things let it hide:

- **The proxy pool really is load-bearing here**, so "proxy problem" read as plausible. A
  direct fetch from this box gets **HTTP 429 and a 3,242-byte bot-check page**; the same
  request through the pool gets a real 800KB page. That size gap is now the discriminator
  the code uses.
- **The lane discarded the reason for every empty page.** Nine hours of failure left no
  record of a single HTTP status, which is why this had to be re-probed live a cycle later.

How poisoned is that stretch? Of the first 40 seeds after the restart, **34 had no rail**.
The frontier is sorted by view count and sits around 2 million views, which is exactly
where Shorts dominate.

## Q2 — where did the other half of the leads go?

Four lanes fell, and none of it was a crash:

| Lane | 08-18 | 08-19 | Why |
|---|---:|---:|---|
| Recommended-videos feed | 140 | 39 | Lap fatigue and a thinner book. Rows 1,929 → 687 |
| Video-graph sweep | 206 | 144 | The nine-hour freeze |
| Peer-network comments | 13 | 1 | Book finished: 9,777 of 9,777 walked |
| Comment sweep | 7 | 0 | Book finished at zero yield |
| Keyword search | 13 | 4 | No terms left, 33 of 34 sessions |

Under the freeze sits a structural fact: **three of the five lanes have now walked
everything they can reach.** The recommended-videos feed drained on 08-16 and lives on
re-laps. Peer-network comments finished 9,777 seeds and has advanced nothing since 09:28Z
yesterday, six runs in a row, each printing "Backlog drained. Run `--extend` to pick up
newly-qualified seeds." Nothing runs that `--extend`.

The only lane with virgin seeds is the video-graph sweep: **8,552 of 16,718 left**, and the
part it is walking now is heavily Shorts.

## Q3 — is the comment sweep worth anything?

It finished its book this cycle and returned zero. From its own state file:

```
129 of 129 seeds walked | 1,862 videos scanned
96,614 candidates raw → 84,965 net-new → 23,032 past triage
334 scored → 0 qualified
20,825 hard-filtered, 1,303 below the 3,000-subscriber floor
```

Since 08-14 the lane has found **9,175 channels and 45 good leads, 0.49%**, against 5.48%
on its debut lap on 08-09. It cost **61¢ this cycle for nothing**.

What died is legible: the lane mines people who comment on competitor channels. On lap one
those commenters included real business owners. Nine laps down it is reaching the audience
underneath, and 71% of what it finds is a channel under 3,000 subscribers, thrown out by
the subscriber floor before it costs a scoring call.

Nothing is running now, because the book is empty and no timer re-seeds it. There is no
bleeding to stop and I changed nothing. The live decision is whether to give it new seeds,
and on this evidence I would not.

## What broke

1. **A lane that could not use a seed and could not skip it.** Q1. The general shape will
   recur elsewhere: anything that refuses to consume work on failure must be certain which
   kind of failure it is looking at, or it retries forever.
2. **The health monitor graded the frozen lane `productive: true`.** Yesterday's fix gave
   this lane its first health entry precisely so a stall could not be silent, and this
   morning it reported `productive: true, seeds_advanced: 7,486` for a lane frozen nine
   hours and still frozen. Two errors: the progress number read the chunk header, which
   prints the range a chunk is *about* to walk, so each dead relaunch claimed 20 seeds it
   never touched; and "productive" summed the whole 24 hours, so a strong first hour hides
   a dead ending. Both fixed. Corrected figure 6,826, and the lane now reports
   `idle_run_streak: 33` since `2026-08-18T22:17:56Z`.
3. **Nine hours of hammering at a flat 15-minute interval.** Roughly **660 watch-page
   fetches into a dead end**. No money, no quota, but the same mistake as the 07-17
   autocomplete block, where hammering a refusing endpoint kept the refusal alive.

**Not a fault:** the keyword lane stopping for want of terms in 33 of 34 sessions with 21
starvation heartbeats (demoted to opportunistic on 08-14, and still joint-cheapest leads of
the day at 2.2¢); $0 Anthropic for the twentieth cycle; no crashes, quota stops, scoring
failures or fatal signatures; 52 working YouTube keys all cycle.

## Yesterday's fixes, checked

| Prediction | Outcome | Verdict |
|---|---|---|
| `video-graph:` rows stop being credited to the keyword engine | Correct all cycle: 2,089 rows and 144 leads filed to the right lane, keyword search at its real 83 and 4 | confirmed |
| Health-monitoring the biggest lane makes a stall visible | Surfaced the stop reason, which is how the freeze was found, but called the lane productive for nine dead hours | half right, fixed today |
| Let the video sweep finish its book, ~450 more leads for free | Advanced 6,826 seeds, then deadlocked at 8,066 of 16,718 | on track once unstuck |

## Shipped today

Four commits. Typecheck clean in both repos, **226 unit tests pass** (up from 223), every
change verified against live data or live YouTube before committing. No `.env` touched.

### 1. The video sweep can no longer deadlock on a Short — finder `71fe206`

A watch page is now classified instead of guessed at:

- **Railless** (200, 200KB or more, has `ytInitialData`, no usable rail) is a fact about
  the video. The seed is consumed, counted in a new `railless` stat, and the lane walks on.
- **Refusal** (small body, non-2xx, 429, transport error) is a fact about the exit. The
  seed is kept and the outage streak counts it.

The live bot-check page is 3,242 bytes against a real page's 800KB, so the size gap draws
the line reliably.

Two smaller things shipped with it. The fetch now rotates to a different exit on a soft
block (a 200 that is really a consent wall) and on a non-2xx status, where before it only
rotated on a 429; one poisoned exit at the front of the rotation used to be enough to
condemn a seed. And it names what every exit did, which the sweep prints along with its
proxy-pool size at startup.

**Verified live.** Restarted 07:37Z: the startup line reads `rails leave via 100 rotating
exits`, the poisoned chunk cleared in under two minutes with all 20 seeds consumed, the
next chunk returned 91 candidates, and 80 seeds were walked in the first five minutes
against zero in the previous nine hours.

### 2. A blocked lane rests instead of hammering — finder `71fe206`

The relaunch loop backs off 15 minutes, then 30, then 60, capped at 2 hours, whenever a run
stops on blocked rails or edge errors, and resets the moment a run gets through.
Self-clearing. Ceiling is `VIDEO_SWEEP_BLOCK_MAX_SLEEP`.

### 3. A frozen lane can no longer report itself productive — orchestrator `8c7b2b5`

Seed progress now reads a run's summary line, which only moves when seeds are actually
checkpointed, instead of the chunk header's intended range. Every lane gained
`idle_run_streak` and `idle_since`.

This immediately surfaced something unmeasured: peer-network comments used to report
`seeds_advanced: null`, which reads as "unknown". It now reads **0 across six runs, idle
since 09:28Z yesterday**, which is the truth.

### 4. Measure how many recommended-feed seeds are just Shorts — finder `8420568`

That lane walks each seed's *latest* upload; if the latest upload is a Short there is no
rail and the seed is spent for nothing. Its per-seed yield has halved four laps running and
nobody has checked how much of that is Shorts rather than exhaustion. Counts it, changes
nothing else. If the number is large the fix is free: the RSS feed already carries the 15
most recent uploads, so a railless latest video can fall back to the previous one at zero
quota.

## Recommended next, ranked

1. **Watch the video-graph sweep for one cycle.** 8,552 seeds left and the only virgin
   ground in the pipeline. Two numbers say whether the fix held: the `railless` count in its
   summary, and whether `idle_run_streak` stays at 0. If a third of the remaining book is
   Shorts, the lane is thinner than 8,552 suggests.
2. **Give peer-network comments the auto-extend the feed already has.** Six runs advancing
   nothing while printing the exact command that would fix it. Lifetime rate 7.3% of
   channels scored, runs on the abundant quota bucket, cost 13¢ this cycle. Same shape of
   work the feed got on 08-16.
3. **Read the Shorts number, then decide the latest-video fallback.** Commit 4 starts
   counting today.
4. **Do not re-seed the comment sweep.** 96,614 channels, zero leads, rate down from 5.48%
   to 0.49% across nine laps. Already stopped; leave it stopped.
5. **Give the keyword harvest new seed phrases.** Unchanged since 07-13, carried on this
   list since 08-16. Joint-cheapest leads of the day, and it found 83 channels because it
   has nothing to search with.
6. **Decide the outlet for `approved_hold`.** 2,758 prepped and ready to write, none
   emailed.
7. **Build the `needs_contact` recovery engine.** 3,495 creators found, scored and
   unreachable, up 67 today. Operation Bloodhound was built 08-18 and its audit is in the
   brain.

## Status

Everything parked, nothing sent. `approved_hold` 2,758 + `needs_contact` 3,495 = **6,253
creators found and never contacted**. $0 Anthropic, $5.46 OpenRouter. Zero crashes, zero
scoring failures, zero quota stops, no fatal signatures for the twentieth cycle. The
video-graph sweep was restarted at 07:37Z and is walking again. The campaign loop was left
running.

## Provenance

Per-lane spend from `youtube-lead-finder-v1/logs/llm-spend-2026-08-1{8,9}.jsonl`, restricted
to the cycle window. Hourly and per-lane lead counts queried live from
`leads.lead_candidates`. Rail diagnosis from live fetches of the stuck seeds through the
live proxy pool, plus `logs/video-graph-sweep-sessions/`. Lane book states from
`logs/video-graph-sweep-state.json`, `logs/peer-sweep-state.json` and
`logs/comment-sweep-state.json`.
