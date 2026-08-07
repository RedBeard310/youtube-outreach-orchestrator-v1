# Lead Run Debrief — 2026-08-07 (analysis companion)

**Headline: +32 parked, the lowest of the run. The hourly fix agent correctly retired 2,101 junk search terms at 13:00Z, which left the active pool at 28 terms out of a book of 15,397, and the anti-starvation reserve built for exactly this moment turned out to have been empty for some time. Seven of fourteen sessions hard-stopped with nothing to search.**

Cycle window: 2026-08-06 07:00Z → 2026-08-07 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-07.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+32** | pool 4,069 → 4,101 (was +173 on 08-06, +105 on 08-04) |
| `needs_contact` pool | 4,878 | +70 swept this cycle |
| **Total parked, 0 sent** | **8,979** | 4,101 + 4,878 |
| Discovered | 571 | vs 710 yesterday |
| Pitchable (score ≥6) | 110 | **19.3% of discoveries**, vs 20.1% yesterday |
| Email-verified | 34 | 32 parked + 66 swept to `needs_contact` |
| `scoring_failed` | **0** | rate 0.0%, second clean day |
| Net-new channels written | 616 | across 72 productive passes = **8.6/pass**, up from 7.1 |
| Campaign sessions | 14 / 14 done | |
| Finder passes | 93 | fresh-pitchable sum 102 = 1.10/pass |
| Fades / discovers / promotes | 86 / 96 / 78 | |
| **Hard stops** | **7** | all `term_supply_exhausted`. 0 yesterday |
| Time-budget stops | 7 | the other half of the day |
| Quota stops / crashes | 0 / 0 | |
| `term_starvation` observations | 6 | |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 8th straight cycle |

## The day splits at 15:25Z

Per session, from `start` / `reservoir` / `done` events in `logs/campaign-2026-08-0{6,7}.jsonl`:

| Session start (UTC) | Reservoir | Ended | Parked |
|---|---|---|---|
| (pre-window tail) | — | time budget | 1 |
| 08-06 07:14 | GO | time budget, 83 min | 3 |
| 08-06 08:40 | GO | time budget, 117 min | 2 |
| 08-06 10:38 | GO | time budget, 83 min | 9 |
| 08-06 12:03 | GO | time budget, 114 min | 0 |
| 08-06 13:59 | GO | time budget, 83 min | 6 |
| 08-06 15:24 | **STOCK-UP** | hard stop, run 21 | 1 |
| 08-06 18:02 | STOCK-UP | hard stop, run 7 | 1 |
| 08-06 19:56 | STOCK-UP | **hard stop, run 2** | 0 |
| 08-06 20:28 | STOCK-UP | time budget, 85 min | 5 |
| 08-06 23:11 | STOCK-UP | hard stop, run 5 | 0 |
| 08-07 00:51 | STOCK-UP | **hard stop, run 2** | 0 |
| 08-07 01:23 | STOCK-UP | hard stop, run 6 | 3 |
| 08-07 03:34 | STOCK-UP | hard stop, run 9 | 2 |
| **Sum** | | | **33** (Airtable net +32) |

Six stocked sessions parked 21. Eight starved sessions parked 12. Two of the starved
sessions gave up after **two passes**, roughly 90 seconds of work, then went back to
the 30-minute back-off.

## Root cause: the safety net had been empty for a while and nobody noticed

At **13:00Z** the hourly check-in agent shipped `youtube-lead-finder-v1@2726d90` after a
`pitchable_rate_collapse` alarm (7.0% against a 20.7% baseline). Diagnosis: the ICP
keyword prefilter was mass-keeping consumer and hobbyist searches. **93% of the active
pool (2,077 of 2,233) sat in five niches** and was almost entirely personal-asset
curiosity ("cessna 150 cost of ownership", "yacht running costs") plus generic industry
explainers. Root cause was inside the skill file: the flight-school golden example
contradicted the skill's own hands-on-delivery test, and the model generalized it into
"keep everything in this niche". It retired 2,101 terms.

**That was the right call.** The evidence is in the day's own quality numbers: on the
terms that survived, pitchable rate held at 19.3% against 20.1% yesterday, and net-new
channels per productive pass went **up**, 7.1 to 8.6.

What should have happened next is the 2026-07-10 anti-starvation floor pulling good
paused terms back into the pool. Instead the finder logged this **30 times**:

```
[anti-starvation] active pool exhausted and NO never-run paused terms remain
  — relying on discovery to invent fresh veins.
```

That message is truthful and that is the problem. `reactivateUntappedTerms` filters on
`AND({status} = 'paused', {runs_executed} = 0)`. It only ever revives terms that have
**never been run**, and that reserve drains permanently, because every term eventually
gets a run. It emptied at some point and silently stopped being a safety net.

Counted directly against the live term book (read-only audit, not inferred from logs):

| Status | Terms |
|---|---|
| active | **28** |
| paused | 13,251 |
| dead (retired) | 2,118 |
| **total** | **15,397** |

The 2,101 rows `evaluate-probes` was reporting all cycle as "untested probes" are not a
reserve. They are the terms retired at 13:00Z, now `status = 'dead'`, correctly excluded
from revival.

Inside the 13,251 paused terms, filtered for ones that already proved they convert and
have since cooled off (`runs_executed >= 1`, `channels_qualified >= 1`,
`channels_returned >= 20`, last run 21+ days ago):

| Cooldown | Revivable |
|---|---|
| 7 days | 3,685 |
| 14 days | 3,404 |
| **21 days** | **3,348** |
| 30 days | 87 |

Top of that list, by measured qualified rate:

| Rate | Last run | Term |
|---|---|---|
| 19.3% | 2026-07-08 | how to get clients for group home |
| 19.0% | 2026-07-15 | real estate agent arizona |
| 18.0% | 2026-07-08 | how to get clients for real estate |
| 16.0% | 2026-07-12 | how to get patients for a plastic surgery practice |
| 16.0% | 2026-07-08 | tax planning for real estate agents and realtors |
| 15.3% | 2026-05-26 | real estate tax strategist |

Those were paused because the fast dead-term rule retires a term after one fully
overlapping run. That rule is correct at the moment it fires and stops being correct a
month later, because saturation decays as new channels get published and indexed.

## The second alarm, 00:03Z

The same detector fired again about ten hours after the first fix recovered the rate,
this time at 7.3% against a 19.6% baseline, with a completely different cause. The
keyword harvest deduplicates on the **exact string only**, so autocomplete's expansion of
one popular branch, "solicitor for defamation of character", produced about 32
respellings of the same query ("lawyer for defamation lawsuit", "civil attorney for
defamation of character", "lawyers for defamation of character and slander"), most
returning 0 to 7 channels each. By 23:47Z **12 of the pool's 18 active terms were
respellings of one branch**. This had recurred on 07-29, 07-31, 08-05 and 08-06 without
being caught, because the existing cross-check has no concept of "already tried this
shape". Fixed in `f8bbdb5` with a phrase-signature cap that collapses role-word synonyms.

## The auto-rescue built yesterday: trigger proven, recovery still untested

It evaluated itself **12 times**. Ran on 5 (exit 0, measured failure rate 0% each time),
declined 7 with `insufficient_sample` at 0, 0, 0, 0, 5, 17 and 24 new leads against a
threshold of 25. The two near misses at 17 and 24 were on sessions cut short by the dry
term pool, which is the guard working correctly: a session that barely ran is exactly the
session whose scoring health you shouldn't trust. Nothing was actually stranded all
cycle, so the recovery path itself still has not run against real damage.

## Term refuel is now running below burn

Eleven harvest runs mined thousands of net-new autocomplete phrases and wrote **199
probes** between them: 5, 76, 10, 19, 50, 0, 3, 0, 12, 23, 1. Two runs wrote nothing at
all. Before the prefilter correction, harvest was writing up to its 200-per-run cap.
The prefilter has swung from keeping too much to keeping roughly 1 to 2%, and that is now
the real ceiling on supply. Today's fix buys time against it rather than solving it, and
calibrating it properly needs an eval against labeled terms, not another live swing.

## Self-improvement shipped

**`youtube-lead-finder-v1@5089090`** — give the anti-starvation floor a proven-term
second tier (`src/airtable/search_terms.ts`).

1. **Tier 2 (`reactivateProvenTerms`).** When tier 1 comes up empty, revive the best
   proven cooled paused terms instead of giving up: `status='paused'`,
   `runs_executed >= 1`, `channels_qualified >= 1`, `channels_returned >= 20`, last run
   `PROVEN_REVIVE_COOLDOWN_DAYS` (default 21) or more ago, ranked by measured
   qualified rate. Self-cleaning by the existing mechanism: a still-saturated revival is
   re-paused after one run by the hard-overlap rule, costing a single search, and is
   ineligible again until it re-cools. Batch is deliberately smaller than tier 1
   (`max(limit*2, 24)` against `max(limit*6, 60)`) because each revived term costs a
   100-unit `search.list`. The campaign quota governor still bounds the total.
2. **Revived terms are lifted to priority 30** if lower. The hard-overlap pause docks 20
   and zeroes `last_run_new_channels`, so proven terms carry decayed and often negative
   priority; left alone they would sit below the starvation floor and re-trigger it every
   pass. The update's returned records are used for the in-pass pool, so a stale negative
   value can't sort a just-revived term to the bottom of the pool it was revived to fill.
   Real stats are untouched and the next run recomputes priority normally.
3. **Starvation now also trips on pool size** (`STARVATION_MIN_POOL`, default 12). The
   rank test alone read the 28-term pool as healthy right up until it emptied and the
   finder aborted "No active terms".

`provenReviveFilter()` is exported so the exact production formula can be audited
read-only without triggering a revive.

**Verified:** `tsc --noEmit` clean. The filter, sort and priority lift were run live
against the term book read-only (24-row batch returned, top hit qr 19.3%, priority
-0.7 lifted to 30). The revive itself has **not** fired in production, because it only
triggers on a starved pool and the next session has to reach that state on its own.

## Recommended next, ranked

1. **Decide the send outlet for `approved_hold`** (4,101 prepped, 0 sent). Eighth day at
   the top of this list.
2. **Build the `needs_contact` recovery engine** (4,878, up 70 today). Now the larger of
   the two piles, and it grew on a day when finding barely worked.
3. **Watch the second-chance revive next cycle.** Judge it on whether the revived cohort
   converts, not just on the hard-stop count falling.
4. **Fix the term refuel rate**, now the real ceiling. Needs an eval against labeled
   terms rather than another live swing at the prefilter.
5. **Meter OpenRouter spend as a first-class cost.** The ledger is Anthropic-only, so `$0`
   still reads as "the pipeline is free".
