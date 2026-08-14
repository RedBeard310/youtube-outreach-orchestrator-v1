# Lead Run Debrief — 2026-08-14 (analysis companion)

**Headline: +52 parked, and all 38 campaign sessions stopped for want of search
terms while 3,318 terms that have already proven they convert sat unavailable.
None of them was blocked for being bad. Every one was blocked for having been
used recently. The 21-day cooldown had quietly become a wall, in exactly the way
the conversion-rate bar did two days ago. Fixed. A second fix corrects a funnel
number that started reporting zero on a working day.**

Cycle window: 2026-08-13 07:00Z → 2026-08-14 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-14.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+52** | pool 2,113 → 2,165. Was +149 |
| `needs_contact` pool | **2,606** | up 98 |
| **Total parked, none sent** | **4,771** | |
| Channels found | **4,407** | was 8,482 |
| Worth contacting (score ≥ 6) | **170** | 3.9% of intake, was 4.6% |
| Emails verified | **53** | 31% of pitchable. Snapshot said 0, corrected below |
| Of today's cohort | 53 → `approved_hold`, 100 → `needs_contact` | 4,016 below threshold, 206 niche-excluded, 32 unreviewed |
| `scoring_failed` | **0** | rate 0.0%, ninth clean day |
| Campaign sessions | **38** | all completed, none dry-run |
| Finder passes | **64** | |
| **Hard stops** | **38** | all `term_supply_exhausted`, one per session |
| Quota stops | **0** | third clean day |
| Net-new channels, keyword lane | **48** | across 16 passes that wrote anything |
| Fresh pitchable per pass | **0.19** | was 0.44 |
| Anthropic spend | **$0** | |
| OpenRouter spend | **$2.21** | 3,245 calls, first full day measured |
| `fatal_signatures` | **[] empty** | fifteenth straight cycle |

## The shape of the day

Eleven strong hours, then a long tail of almost nothing.

86% of the day's intake landed before 18:00Z, which is 11am Pacific. Intake
peaked at 566 channels in the 16:00Z hour and never dropped below 162 until
then. After 18:00Z the peer-network sweep kept running but stopped writing much:
it had walked into a stretch of seed channels whose commenters are already in the
database. Three hours wrote nothing at all.

Nothing crashed. No session stopped for quota. No hourly check-in raised an
anomaly, so no fix-agent was spent.

## What actually happened

### 1. Every session hard-stopped, and the terms were sitting right there

All 38 campaign sessions ended on `term_supply_exhausted`. The finder logged 19
starvation warnings and aborted in under a second each time.

The term book holds 16,770 rows. **Zero were active.** The finder has two ways to
refill an empty pool and both came back with nothing.

Tier 1 revives terms that have never been run. That reserve drains permanently,
because every term eventually gets run, and it has been empty since around 08-07.
That is known and expected.

Tier 2 is the one that failed. It revives terms that already proved they convert
and have since cooled for 21 days. It works in a loop: revive a term, run it
once, and if the results come back all duplicates the fast-pause rule retires it
again. It is then ineligible for three weeks. Run that loop hard enough for long
enough and the whole reserve ends up inside its own cooling window at the same
time.

Measured against the live book this morning, using the finder's own exported
filter:

| Cooldown | Conversion bar | Terms eligible |
|---|---|---:|
| 21 days | ≥ 3.5% | **0** |
| 21 days | ≥ 2% | **0** |
| 14 days | ≥ 3.5% | 27 |
| 14 days | ≥ 2% | 267 |
| 7 days | ≥ 3.5% | **221** (20 categories, best at 15.2%) |
| 7 days | ≥ 2% | 500+ |

The oldest last-run date anywhere in the proven-at-2% reserve was 2026-07-27, 18
days back. Tier 2 was arithmetically guaranteed to return zero and stay there
until 08-17.

**This is the same failure shape as the 08-12 fix, one level up.** That fix
noticed the conversion-rate bar had turned from a preference into a wall and
added a lower fallback bar. The cooldown had done the identical thing and nothing
was watching it.

### 2. With the reserve locked out, the discovery loop ran on fumes

Every session fell back to asking a cheap model to invent new search phrases,
writing them as probes and running each once. That loop ran 64 times and is no
longer paying for itself:

| Probe batch | Terms | Searches | Channels returned | New to us |
|---|---:|---:|---:|---:|
| 2026-08-01 | 1,436 | 943 | 35,825 | **978** |
| 2026-08-07 | 271 | 362 | 9,668 | 154 |
| 2026-08-13 | 199 | 280 | 7,068 | **24** |
| 2026-08-14 | 73 | 87 | 3,758 | **6** |

3,758 channels came back yesterday and 6 were new. That is 0.2% novelty, and each
of those 87 searches costs 100 units of YouTube quota. The invented phrases
aren't wrong. They land on the same slice of YouTube the book already covers.

Discovery's own dry-guard noticed and suppressed the model call 38 times, which
is the guard working correctly. It just left the sessions with nothing to run.

The 221 terms today's fix unlocks are measurably better than anything that loop
is producing.

### 3. The sweeps carried the day, as they have all week

| Method | Found | Worth contacting | Rate |
|---|---:|---:|---:|
| Peer-network comments | 3,914 | 113 | 2.9% |
| Recommended-videos feed | 328 | 44 | **13.4%** |
| Keyword search | 133 | 12 | 9.0% |
| Guest-link mining | 10 | 1 | 10% |
| Comment sweep | 22 | 0 | — |
| Podcast crossover | 0 | 0 | — |

Peer-network was 89% of intake and 66% of the good leads at a 2.9% hit rate. The
recommended-videos feed got 13.4% from a twelfth of the volume, which is what a
good seed list looks like.

Two lanes are alive and producing nothing. Comment sweep ran once, walked 39
seeds, wrote 22 channels and none cleared the bar. Podcast crossover ran once and
wrote nothing; it prints no progress lines either, so the health block can only
report it as unknown rather than idle. That distinction is deliberate and stays.

### 4. The funnel reported zero emails verified on a day it verified 53

The metric counted rows whose status is exactly `email_verified`. That is a
snapshot of where a lead is standing right now, not a count of what the verifier
did. Since the Postgres cutover a verified lead advances to `ready_data_scraped`
within the same cycle, so it stops being counted the moment the pipeline works
properly.

Today it finally hit zero. All 53 of the day's newly-parked leads had a verified
email and had already moved on, so the funnel read 0 verified out of 170 worth
contacting. That reads exactly like the verifier broke.

Recomputed with the fix, the figure is 53. No other number in the snapshot
changed.

### 5. Two things worth knowing that are not faults

**The 2,101 never-run terms sitting in `dead` are meant to be there.** They were
killed on purpose as consumer-intent phrasings, the kind that find people
researching a career rather than people running a business. They look like a bug
in the term-book counts and they are not. Do not revive them.

**OpenRouter cost $2.21 across 3,245 calls**, the first full day it has been
measured: peer-network $1.38, recommended-videos feed $0.62, finder $0.11,
comment sweep half a cent. That is about 1.3 cents per lead worth contacting and
4 cents per lead parked. Cost is not a constraint on this pipeline right now.

## Yesterday's fixes, checked

| Prediction | What happened | Verdict |
|---|---|---|
| Sweep productivity counts a still-running session | peer-network reported 5,117 seeds advanced across 5 runs instead of 0; all four daemons reported honestly | confirmed |
| The cycle window closes at the cycle end | Snapshot generated 07:20Z with no rows past 07:00Z | confirmed |
| The pitchable-rate check recognises full term exhaustion | Logged `pitchable_rate_term_supply_degraded` 6 times and correctly declined to page a fix-agent | confirmed |

## What shipped

Two commits. Both typecheck clean, the orchestrator's 20 unit cases pass, and
both were verified against today's real data before committing. No `.env` file
was touched.

| Repo | Commit | Change |
|---|---|---|
| `youtube-lead-finder-v1` | `7ea99ab` | Tier-2 term revival relaxes its cooldown instead of hard-stopping while the whole proven reserve is inside its own cooling window |
| `youtube-outreach-orchestrator-v1` | `06e675e` | Emails-verified counts leads that advanced past verification, not just those parked on it |

**The cooldown ladder.** Tier 2 now tries four rungs and stops at the first that
yields anything: full cooldown at the preferred conversion bar, full cooldown at
the fallback bar, then the shortened 7-day cooldown at each of the same two bars.
Cooling is treated as worth more than the rate bar, so both rate floors are
exhausted before the cooldown gives way. Rung 1 is byte-for-byte the old
behaviour, so on any day the old code would have found terms, today's code
behaves identically. Every rung below it spreads the batch across niche
categories at most two apiece, which is the guard that actually stopped the
08-07 collapse when eight near-identical consultant terms landed in one pass.
Retune with `PROVEN_REVIVE_FALLBACK_COOLDOWN_DAYS`. Simulated read-only against
the live book before shipping: rungs 1 and 2 return nothing, rung 3 fires with 24
terms across 16 categories converting between 5.6% and 15.2%.

The self-limiting property is unchanged and is why this is safe. A revived term
that is still saturated gets re-paused after one run, costing one 100-unit
search, and is ineligible again until it re-cools.

**The verified count.** A shared set now defines which statuses mean an email was
verified at some point: `email_verified`, `ready_data_scraped`, its legacy alias
`enriched`, `email_drafted` and `sent_to_smartlead`. `ready_no_data` is
deliberately left out. It is a hand-applied holding label nothing in the pipeline
writes, and counting it would mean treating a manual label as evidence the
verifier ran. Eleven test cases cover it in
`scripts/autopilot/debrief-data.selftest.ts`.

## Ranked next

1. **Watch tomorrow's hard-stop count.** Today's fix should turn 38 hard stops
   into a working keyword lane with roughly 24 proven terms per revival. If it
   stays at 38, the wall is somewhere else and today's diagnosis was incomplete.
   This is the single check that tells you whether the fix landed.
2. **Reconcile the two parked pools.** Still open from yesterday, still the only
   item that needs a person. 4,661 → 1,964 and 5,783 → 2,508 across the cutover
   with the row count saying nothing was lost. The Airtable token on this box
   returns 401, so the parity script can't run until someone supplies a working
   credential, and the read-only rollback week is nearly up.
3. **Fix peer-network's seed list.** 89% of intake at 2.9%, and it went quiet for
   the last 13 hours because it walked into seeds whose commenters we already
   have. The problem is which channels it walks, not how fast.
4. **Decide the outlet for `approved_hold`.** 2,165 prepped, none emailed. Third
   week at or near the top of this list.
5. **Retire or re-seed comment sweep and podcast crossover.** Between them, 22
   channels and 0 usable leads this cycle. Both alive, both cheap, neither
   earning its slot. Podcast crossover also needs to print progress lines before
   the health check can say anything true about it.
6. **Build the `needs_contact` recovery engine.** 2,606 creators found, scored
   and unreachable, up 98 today. It grows every cycle.

## Status

Everything is parked, nothing sent. `approved_hold` 2,165 plus `needs_contact`
2,606 is **4,771 creators found and never contacted**, subject to the
reconciliation question above. $0 on Anthropic, $2.21 on OpenRouter. Zero
crashes, zero scoring failures, zero quota stops, no fatal signatures for the
fifteenth cycle running.

The campaign is running and I have left it that way. Tomorrow is the read on
whether the keyword lane comes back.
