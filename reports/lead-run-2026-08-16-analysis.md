# Lead run analysis — 2026-08-16

Cycle window 2026-08-15T07:00Z to 2026-08-16T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-16.json`.
HTML debrief: [lead-run-2026-08-16.html](lead-run-2026-08-16.html).

## Headline

**+146 parked** (`approved_hold` 2,286 → 2,432), the largest single-day gain since the
move to Postgres, on **29% fewer channels** than yesterday. The hit rate went 4.4% →
**7.0%** and cost per parked lead fell 6.3¢ → **4.1¢**.

Two things sit under that. The recommended-videos feed finished its entire 9,099-seed
book at 07:11Z and now has nowhere to go. And the script that measures how well that
lane is doing reported this lap running **85% better** than the last one when it in fact
ran **86% worse**.

## The numbers

| Metric | Value | Prior day |
|---|---:|---|
| Parked into `approved_hold` | **+146** | +119 |
| `approved_hold` pool | 2,432 | 2,286 |
| `needs_contact` pool | 3,028 | 2,809 |
| **Total parked, none sent** | **5,460** | 5,093 |
| Channels found | 5,570 | 7,832 |
| Worth contacting (score ≥ 6) | **389 (7.0%)** | 348 (4.4%) |
| Emails verified | 149 | 118 |
| `scoring_failed` | 0 | 0 (11th clean day) |
| Campaign sessions | 17 | 17 |
| Finder passes | 346 | 348 |
| Stopped for want of terms | 18 | 4 |
| Quota stops | 0 | 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $6.02 (8,958 calls) | $7.45 (11,208) |
| `fatal_signatures` | `[]` (17th cycle) | `[]` |

Cost per lead worth contacting **1.5¢**; per lead parked **4.1¢**.

### Shape of the day

Second cycle with no dead hours; the quietest still found 13 channels and 3 good ones.
Peak 776 at 12:00Z.

The tail matters: **236 channels in the last five hours against 5,334 in the nineteen
before**. Nothing crashed. That is the recommended-videos feed running out of book in
real time.

### By discovery method

| Lane | Found | Worth contacting | Rate | Spend | Cost/lead |
|---|---:|---:|---:|---:|---:|
| Recommended-videos feed | 2,458 | **287** | **11.7%** | $3.96 | 1.4¢ |
| Keyword search | 514 | 63 | **12.3%** | $0.49 | **0.8¢** |
| Peer-network comments | 935 | 29 | 3.1% | $0.62 | 2.1¢ |
| Comment sweep | 1,654 | 9 | **0.54%** | $0.86 | **9.6¢** |
| Guest-link mining | 9 | 1 | 11% | — | — |

The feed produced **74% of the day's good leads**. Keyword search had the best rate and
cheapest leads of anything we run and only found 514 channels, because it has almost no
terms left. Every lane that works is supply-limited; the lane with unlimited supply
doesn't work.

Per-niche pitchable leaders: Coaching & Consulting 115, Real Estate 74, Transformation &
Performance Coaching 50, Health & Wellness Clinics 33, Financial Planning 18, Relocation
& Lifestyle Design 18, Business Growth Coaching 16, Legal 10.

## Q1 — Did the comment-sweep seed fix move the rate?

**No.** 0.52% → **0.54%**. Yesterday's debrief set exactly this test and said that if the
rate didn't move, the lane is the problem rather than its seed picker.

The picker itself worked. It ran once (09:12Z), sorted 34 candidates into tiers, and
appended 9 business-audience seeds, 6 general-creator-education, and **zero** from the
YouTube-hustle tier. The tiers then came out in the predicted order:

| Tier assigned | Seeds walked | Found | Pitchable | Rate |
|---|---:|---:|---:|---:|
| Business audience | 5 | 426 | 5 | **1.17%** |
| General creator education | 6 | 897 | 0 | **0%** |
| YouTube hustle | 0 | — | — | — |

Ranking is genuinely predictive and it refused to queue the worst seeds. It just doesn't
matter much: ranking perfectly still tops out at 1.17%, against 11.7% for the feed. Four
of the nine business seeds are still unwalked, so 1.17% may move, but it needs a factor
of ten.

Volume dropped the right way (3,648 → 1,654), so waste roughly halved. The lane still
costs **9.6¢ per lead against 1.4¢**. Whether to keep running it is Casey's call and
nothing was touched.

## Q2 — The primary lane finished

At 07:11Z the feed printed `Sweep COMPLETE. The backlog is drained.` after walking all
9,099 seeds.

The hourly keep-alive adds whatever newly-qualified leads have become seeds, then
restarts. Overnight:

```
20:10Z  549 seeds
01:12Z   98
03:10Z   25
04:11Z    6
05:12Z    6
06:11Z    3
07:10Z    3
```

Engine to drip. The feed self-feeds off qualified leads, so once the backlog is eaten its
speed is capped by how fast the *other* lanes produce good leads — about three an hour.
Standing orders say an idle primary lane is a problem to fix. Fixed today.

## Q3 — What a re-walk is actually worth

The open question from 08-14, blocking the auto-relap decision. There is now an answer,
and it is not what the tooling said.

Lap 3 ran 08-14 07:55Z to yesterday evening: a genuine full re-walk of 8,341 seeds plus
758 fresh ones. This morning the progress script said:

```
lap2: 694 seeds | 479 qualified | 0.690/seed (lap1 0.373 → +85%)
```

Fiction. The truth:

```
lap3: 9099 seeds | 479 qualified | 0.053/seed (lap 2 0.373 → -86%)
      | 3487 scored | $7.62 ($0.016/lead)
```

**The bug.** The sweep keeps one stats object whose fields don't all mean the same thing.
`qualified`, `scored` and `usd` accumulate for the life of the state file. `seeds_done`
does not — `graph-sweep.ts` sets it to `processed.length` after every chunk, and
`extend-seeds.ts --relap` empties `processed`. So `seeds_done` silently resets to 0 at
each lap boundary while everything beside it keeps climbing.

Three readers divided one by the other:

- `graph-sweep.ts`'s summary printed all-time `qualified` over this-lap `seeds_done` and
  called it "/seed" — 0.44 for a lap that ran at 0.053.
- `lap2-progress.ts` subtracted the boundary's `seeds_done` from the live one. That goes
  negative for most of a lap, so it printed "no seeds walked yet" and hid the lap
  entirely, then crossed zero near the end and divided by the leftover.
- `extend-seeds.ts` wrote that same subtraction into `lap-boundary.json`, making the
  error the next lap's baseline.

**Consequence for the decision.** Per seed, re-walking has collapsed: 0.453 (lap 1) →
0.373 (lap 2) → **0.053** (lap 3). The "compounding holds at ~80%" finding does not
survive a third lap. Per dollar it is still excellent, because cost scales with channels
*scored*, not seeds walked, and a re-walk mostly re-finds known channels and drops them
for free. A lap costs about **$7.60 and returns ~480 leads at 1.6¢ each** — cheaper than
every lane but keyword search, over wall-clock when the lane would otherwise be idle.

So: yes to auto-relap, at **~480 leads a lap, not ~3,400**.

**Caveat worth recording.** Lap 2's published 0.373 was computed by the same broken
subtraction, so it is also overstated by an unknown amount. The lap-1 boundary it was
derived from has been overwritten and cannot be recovered. The direction of the error is
known (too high); the magnitude is not. Treat 0.453 and 0.373 as soft, and 0.053 as the
first cleanly measured lap.

## What broke

### A measurement with the wrong sign

Not merely noisy. A lap that fell 86% was reported as a lap that rose 85%. Acting on it —
including by tomorrow's version of this agent — would have produced "re-walking compounds
beautifully, do much more of it": half-right for the wrong reason, with an expected yield
eight times too high.

### 18 of 18 sessions stopped for want of terms

Yesterday this was 4 of 17 and was called a win. It looks like a regression and isn't:
standing orders demoted the keyword lane to opportunistic on 08-14 and say explicitly not
to treat an empty term pool as an incident. The lane ran 346 passes, found 514 channels,
and posted the best hit rate and cheapest leads of any lane. It stops because it runs
out, not because it fails.

Between stops it detected a fade 321 times and asked a cheap model to invent terms 338
times — machinery that (per yesterday's measurement) produces terms converting at 0.23%
against the real book's 2.25%.

### Not a fault

OpenRouter fell $7.45 → $6.02 on 29% fewer channels scored. Anthropic $0, seventeenth
cycle. Zero crashes, quota stops, scoring failures or fatal signatures. 52 working direct
YouTube keys all cycle.

## Yesterday's fixes, checked

| Prediction | Outcome | Verdict |
|---|---|---|
| Tier-ranked seeds lift the comment-sweep hit rate | 0.52% → 0.54%; tiers ranked correctly (1.17% / 0% / not queued) but the lane's ceiling is the problem | picker right, lane wrong |
| Watch the hit rate, not the volume | Correct instruction — volume halved, rate flat; reading volume alone would have called this a success | confirmed |
| Proven terms at priority 72 stop sitting under invented probes | Keyword lane hit 12.3%, best rate of any lane | confirmed |

## Shipped today

**`youtube-lead-finder-v1` `673a8a6`** — one commit. Typecheck clean, 193 unit tests
pass, both new paths exercised against the live state file. No `.env` touched.

1. **Lap arithmetic knows which counters reset.** New `src/discovery/graph/lap.ts` holds
   the single rule the three call sites kept getting wrong: because `processed` is
   cleared at each re-walk, `seeds_done` *is* the current lap's seed count and must never
   have a boundary subtracted from it, while cumulative fields must. The sweep summary,
   `lap2-progress.ts` and the boundary writer all read it from there.

   The boundary file now also records the lap's own seeds, leads, spend and
   cost-per-lead outright, so no future reader needs to know the rule. Verified: the
   progress script prints `lap3: 9099 seeds | 479 qualified | 0.053/seed (lap 2 0.373 →
   -86%)`.

2. **A drained book re-opens itself, and stops when it stops paying.**
   `refill-graph-sweep.sh` used to end at "no fresh seeds, nothing to do", which is how
   the lane died quietly this morning. It now closes the lap and re-opens the whole book.
   Guards in order: nothing unwalked, service stopped, and the closing lap must have cost
   under **25¢ per qualified lead** (`RELAP_MAX_USD_PER_LEAD`, exit code 2 = refused on
   economics, logged as a normal outcome). A 12-hour cooldown
   (`RELAP_COOLDOWN_HOURS`) stops a fast-finishing lap from shredding the boundary
   bookkeeping into micro-laps.

   The gate is priced in dollars deliberately. Lap 3 reads as a disaster per seed and a
   bargain per lead; a per-seed gate would have switched off one of the cheapest lead
   sources we have. Verified both ways — forced to a fraction of a cent it refuses with a
   reason and exits 2; at the real ceiling lap 3 passes at 1.6¢.

   **Cost:** ~$7.60 of OpenRouter per lap, a lap taking ~35 hours, so on the order of
   **$5/day** while the lane has nothing fresher to walk. Inside Casey's standing
   authorization for this lane. First auto-relap fires on the next hourly tick.

## Recommended next, ranked

1. **Feed the recommended-videos lane something new.** 74% of output at 1.4¢ a lead, and
   it has eaten everything it can reach. Auto-relap holds it at ~480 leads a lap; that is
   a holding pattern, not growth. Real growth needs more *first-time* seeds, which means
   other lanes producing more qualified leads — the same problem one step back.
2. **Decide on comment sweep.** Two cycles at 0.5% with a seed picker now proven to rank
   correctly. 9.6¢ a lead against 1.4¢. Keeping it costs ~$0.90/day for ~9 leads. Left
   running.
3. **Give the keyword harvest new seed phrases.** Unchanged since 07-13. Best hit rate
   (12.3%) and cheapest leads (0.8¢) of anything we run, idle 18 sessions out of 18 for
   lack of input. Highest-leverage unbuilt item on this list.
4. **Turn off invented-term discovery, or aim it.** 338 calls producing terms converting
   at 0.23% against the real book's 2.25%. Fires on every fade regardless of whether it
   has anywhere useful to look.
5. **Decide the outlet for `approved_hold`.** 2,432 prepped, none emailed.
6. **Build the `needs_contact` recovery engine.** 3,028 found, scored and unreachable, up
   219 today. Crossed 3,000 this cycle.

## Status

Everything parked, nothing sent. `approved_hold` 2,432 + `needs_contact` 3,028 =
**5,460 creators found and never contacted**. $0 Anthropic, $6.02 OpenRouter. Zero
crashes, zero scoring failures, zero quota stops, no fatal signatures for the seventeenth
cycle. The campaign is still running and was left that way.
