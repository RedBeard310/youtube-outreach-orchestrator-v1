# Lead run analysis — 2026-08-15

Cycle window 2026-08-14T07:00Z to 2026-08-15T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-15.json`.
HTML debrief: [lead-run-2026-08-15.html](lead-run-2026-08-15.html).

## Headline

**+119 parked** (`approved_hold` 2,165 → 2,284), the best gain since 08-11, and
**hard stops fell from 38 of 38 sessions to 4 of 17**. Yesterday's cooldown-ladder
fix landed. The keyword lane went from 133 channels and 12 usable leads to 1,252 and
85. Total pitchable doubled, 170 → 348.

The bad news is a new lane. **Comment sweep found 3,648 channels and 19 were worth
contacting (0.52%)**, because the self-refilling seed engine that shipped yesterday
ranks candidate seed channels by comment volume, which selects for YouTube-hustle
channels whose commenters are aspiring creators rather than business owners.

## The numbers

| Metric | Value | Prior day |
|---|---:|---|
| Parked into `approved_hold` | **+119** | +52 |
| `approved_hold` pool | 2,284 | 2,165 |
| `needs_contact` pool | 2,809 | 2,606 |
| **Total parked, none sent** | **5,093** | 4,771 |
| Channels found | 7,832 | 4,407 |
| Worth contacting (score ≥ 6) | 348 (4.4%) | 170 (3.9%) |
| Emails verified | 118 | 53 |
| `scoring_failed` | 0 | 0 (10th clean day) |
| Campaign sessions | 17 (16 done) | 38 |
| Finder passes | 348 | 64 |
| Hard stops | **4** | 38 |
| Stopped on the 90-min clock | 12 | 0 |
| Quota stops | 0 | 0 |
| Fresh pitchable per pass | 0.24 | 0.19 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $7.45 (11,208 calls) | $2.21 (3,245) |
| `fatal_signatures` | `[]` (16th cycle) | `[]` |

### Shape of the day

First cycle this month with **no dead hours**. The quietest hour still found 84
channels. Peak 787 at 14:00Z, 67% of intake before 17:00Z.

### By discovery method

| Method | Found | Worth contacting | Rate | Cost/lead |
|---|---:|---:|---:|---:|
| Recommended-videos feed | 2,421 | **225** | **9.3%** | 1.6¢ |
| Keyword search | 1,252 | 85 | 6.8% | 1.4¢ |
| Peer-network comments | 506 | 19 | 3.8% | 1.7¢ |
| Comment sweep | 3,648 | 19 | **0.5%** | **11.3¢** |
| Guest-link mining | 4 | 0 | — | — |
| Podcast crossover | 1 | 0 | — | — |

The recommended-videos feed produced **65% of the day's good leads off 31% of the
intake** and only ran twice. Peer-network fell from 3,914 channels to 506 on its own
and its rate rose from 2.9% to 3.8% as it did.

Per-niche pitchable leaders: Real Estate 69, Coaching & Consulting 56, Health &
Wellness Clinics 45, Transformation & Performance Coaching 37, Legal 20, Financial
Planning 20.

## Q1 — Did the 08-14 fix work?

Yes, on the metric that was named as the test. But the sizing prediction was wrong in
a way that matters.

- The cooldown ladder fired **303 times** and revived **1,990 terms**.
- **Rungs 1 and 2 never fired.** Rung 3 fired 140 times, rung 4 fired 163. Every
  revival all cycle came from the relaxed cooldown added yesterday.
- Predicted ~24 terms per revival. Actual average **6.6**.
- The active term pool measured **zero** this morning, where it sat all cycle.

So the keyword lane isn't restocked, it's on a drip. A pass drains the pool, the next
pass revives seven more terms. It works, but nothing has refilled the book.

## Q2 — Where the leads came from

See the method table above. One line summary: the recommended-videos feed is the
whole game right now and it runs twice a day.

## Q3 — Comment sweep at 0.52%

The self-refilling seed engine (finder commit `fb6b8b6`, shipped 08-14) added 30
seeds. Nearly all of the day's 3,648 channels came from those 30; the 39 hand-picked
seeds are exhausted and produced 14 channels between them.

Per-seed yields, from the live DB joined to `seeds.json`:

| Seed | Found | Pitchable | Self-description |
|---|---:|---:|---|
| Marcus Jones | 439 | 2 | "help 10,000 people become fulltime YouTubers" |
| vidIQ | 387 | **0** | "get more views, more subscribers, and get monetized" |
| Adam Ivy | 313 | 2 | "help coaches, consultants, and business owners use YouTube to get leads" |
| Aprilynne Alter | 207 | **6** | "deep-dive YouTube breakdowns" |
| Nataleh Nicole | 199 | 4 | "helping experts and entrepreneurs" |
| Felixy AI | 165 | 0 | "make money online, grow your YouTube channel" |
| Saad Rashid | 67 | 0 | "YouTube Automation Expert... Building Faceless Channels" |

Grouped by audience:

| Tier | Seeds | Found | Pitchable | Rate |
|---|---:|---:|---:|---:|
| Business audience | 4 | 572 | 6 | **1.05%** |
| General creator education | 17 | 2,325 | 12 | 0.52% |
| YouTube hustle | 9 | 720 | 1 | **0.14%** |

The original 39 hand-picked seeds averaged 2.1 pitchable each on their first walk
(2026-08-09). The auto-discovered set averaged 0.63.

The engine's accept gate asks "does this channel teach YouTube?". What predicts a good
seed is "do this channel's commenters own a business?". Those aren't the same question,
and sorting by comment volume actively selects for the wrong answer.

## What broke

### The keyword harvest is mined out

11 runs, 48,150 raw autocomplete phrases, **72 new terms written**, 65 of them from the
first two runs. About 99% of each run's candidates were already in the reject cache. It
walks the same 42 seed phrases every time and that list hasn't grown since 2026-07-13.

The low-yield backoff caught this correctly and skipped 355 of 361 harvest attempts. The
guard works. The supply doesn't. The backoff message itself names the remedy: new seeds.

### Three quarters of the term book is guesswork

| Kind | Paused terms | Mean qualified_rate |
|---|---:|---:|
| Probes (LLM-invented + autocomplete) | 10,772 | **0.23%** |
| Real book terms | 3,979 | **2.25%** |

The campaign wrote ~40 fresh probes after nearly every one of its 348 passes. The fade
check fires below 12 fresh pitchable per pass and no pass all cycle exceeded 3, so
`fade_detected` fired 344 times and `discover` 361 times.

### Not a fault

OpenRouter rose $2.21 → $7.45 because intake rose 4,407 → 7,832 and every channel gets
scored. That's 2.1¢ per pitchable lead and 6.3¢ per parked lead. Anthropic $0.

## Yesterday's fixes, verified

| Prediction | Outcome | Verdict |
|---|---|---|
| Cooldown ladder turns 38 hard stops into a working keyword lane | 4 hard stops, 348 passes, 85 keyword-lane leads vs 12 | confirmed |
| ~24 proven terms per revival | 303 revivals, 1,990 terms, avg 6.6 | **wrong** |
| Emails-verified counts leads past verification | Reported 118, not 0 | confirmed |

## Shipped today

**`youtube-lead-finder-v1` `71d235c`** — one commit, two changes. Typecheck clean, 193
unit tests pass, both regex sets verified in node against the 30 real seed channels
fetched from the live API. No `.env` touched.

1. **`scripts/discover-comment-seeds.ts` ranks seeds by audience tier, then comment
   volume.** Three tiers: business audience, general creator education, YouTube hustle.
   Verified monotonic against realized yield on the 30 real seeds (1.05% / 0.52% /
   0.14%). Hustle is tested *before* business, because half the hustle channels carry a
   business word in the bio ("YouTube Automation Expert", "Coach Yotz") and checking
   business first put two of the worst seeds at the very top.

   **Ranking only, nothing is rejected.** Over-cap seeds stay eligible for later runs.
   Aprilynne Alter is the reason for that restraint: she came out of "start a faceless
   youtube channel", the most hustle-flavoured query in the bank, and returned the best
   yield of the cycle. A hard filter would have cost real leads.

   The tier is written into each seed's `source` string and into the run JSONL
   (`accepted_by_tier` / `appended_by_tier`), so next cycle can measure whether the
   ranking earned anything.

2. **`PROVEN_REVIVE_PRIORITY` raised 30 → 72, and made env-tunable.** Revived proven
   terms were ranked below the probes `discover-veins` writes at 70 and the harvest
   writes at 65, so a term with a measured conversion rate sat under a phrase a cheap
   model had just invented. Survivable while the never-run reserve had stock; it has
   been empty since ~08-07, so the revival is now the only thing refilling the pool and
   all 1,990 revived terms landed underneath fresh probes. 72 sits above both probe
   tiers and below hand-curated at 75. If a revived term really is mined out, the
   fast-pause rule retires it again after one run, so being wrong costs one search.

## Recommended next, ranked

1. **Run the recommended-videos feed harder.** Best lane on every measure, ran twice.
   9.3%, 65% of the day's good leads, 1.6¢ each. Find out what governs its cadence
   before touching it.
2. **Reconcile the two parked pools.** Open three days, needs a person. The Airtable
   token on this box returns 401, so the parity script can't run without a working
   credential.
3. **Give the keyword harvest new seeds.** 42 phrases unchanged since 07-13, 72 new
   terms from 48,150 candidates. The obvious source is the term book itself: seed
   autocomplete from terms that have proven they convert, so the list refreshes as new
   terms prove out. That replaces the drip with actual restocking.
4. **Decide the outlet for `approved_hold`.** 2,284 prepped, none emailed. Total parked
   crossed 5,000 today.
5. **Check the comment-sweep tier split next cycle.** Today's fix changes which seeds
   get picked, not how many channels get scored, so watch the hit rate, not the volume.
   If it doesn't move off 0.5%, the lane is the problem rather than its seed picker, and
   the honest call then is to stop running it.
6. **Build the `needs_contact` recovery engine.** 2,809 creators found, scored and
   unreachable, up 203 today.

## Status

Everything parked, nothing sent. `approved_hold` 2,284 + `needs_contact` 2,809 =
**5,093 creators found and never contacted**, subject to the reconciliation question.
$0 Anthropic, $7.45 OpenRouter. Zero crashes, zero scoring failures, zero quota stops,
no fatal signatures for the sixteenth cycle. The campaign is still running and was left
that way.
