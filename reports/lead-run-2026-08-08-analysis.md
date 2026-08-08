# Lead Run Debrief — 2026-08-08 (analysis companion)

**Headline: 246 pitchable creators found, 2.2× yesterday and the best hit rate of the month, because yesterday's proven-term revive fired nine times and killed term starvation outright. Only 70 could be parked, and roughly a third of the machine's day went into re-classifying 38,869 search terms it had already rejected before.**

Cycle window: 2026-08-07 07:00Z → 2026-08-08 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-08.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+70** | pool 4,103 → 4,173 (was +32 on 08-07, +173 on 08-06) |
| `needs_contact` pool | **5,040** | +162 this cycle, now the larger of the two lanes |
| **Total parked, 0 sent** | **9,213** | 4,173 + 5,040 |
| Discovered | 771 | vs 571 yesterday |
| Pitchable (score ≥ 6) | **246** | **31.9% of discoveries**, vs 19.3% yesterday. Best rate of the 08-01→08-08 block |
| Of those pitchable | 72 → `approved_hold`, 161 → `needs_contact` | 31% verify rate, in the usual band |
| Currently at `email_verified` | 39 | still moving through the lane at snapshot time |
| `scoring_failed` | **0** | rate 0.0%, third clean day |
| Net-new channels written | 779 | across 84 productive passes = **9.3/pass**, up from 8.6 |
| Campaign sessions | 9 / 9 done | fewer, longer sessions than yesterday's 14 |
| Finder passes | 87 | fresh-pitchable sum 241 = **2.77/pass**, up from 1.10 |
| Fades / discovers / promotes | 86 / 95 / 80 | |
| **Hard stops** | **0** | 7 yesterday, all `term_supply_exhausted` |
| Time-budget stops | **9 of 9** | every session ran out the clock, none ran out of work |
| Quota stops / crashes | 0 / 0 | |
| `term_starvation` observations | **0** | 6 yesterday, 19 on 08-05 |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 9th straight cycle |

## Per session

From `start` / `reservoir` / `time_budget_stop` / `done` events in
`logs/campaign-2026-08-0{7,8}.jsonl`.

| Session closed (UTC) | Reservoir at open | Passes | Elapsed | Parked |
|---|---|---|---|---|
| 08-07 08:19 | STOCK-UP | 12 | 92 min | 6 |
| 08-07 11:00 | STOCK-UP | 9 | 86 min | 9 |
| 08-07 13:49 | STOCK-UP | 9 | 95 min | 9 |
| 08-07 16:22 | STOCK-UP | 12 | 86 min | 4 |
| 08-07 18:56 | STOCK-UP | 10 | 84 min | 6 |
| 08-07 21:26 | STOCK-UP | 13 | 83 min | 5 |
| 08-08 00:08 | STOCK-UP | 10 | 90 min | 12 |
| 08-08 02:40 | STOCK-UP | 7 | 82 min | 9 |
| 08-08 05:08 | STOCK-UP | 10 | 77 min | 11 |
| **Sum** | | **87** (2 pre-window) | | **71** (Airtable net +70) |

Two things to read off this table. First, **every session ended on its time budget**,
where yesterday seven of fourteen gave up early with nothing left to search. Second,
**every session opened STOCK-UP**, which means every session began by running a full
keyword harvest before it could search. That second fact is the whole of Q3 below.

## Q1 — why the finder suddenly did twice as well

Yesterday's debrief diagnosed the anti-starvation floor as an empty net. It only revived
search terms with `runs_executed = 0`, and that reserve drains permanently because every
term eventually gets a run. The fix shipped at **07:28Z on 08-07** as
`youtube-lead-finder-v1@5089090`: a second tier that revives the best **proven** terms
instead, meaning `runs ≥ 1`, `qualified ≥ 1`, `returned ≥ 20`, cooled at least
`PROVEN_REVIVE_COOLDOWN_DAYS` (21), ranked by measured qualified rate and lifted to
priority 30.

Yesterday it had not yet fired in production. **This cycle it fired nine times**, once per
session, logging the same line each time:

```
[anti-starvation] active pool exhausted (top rank -9.4 < 1) and no never-run terms
remain; reactivated N proven terms cooled >= 21d (best qualified_rate first).
```

The effect is unambiguous across every measure that touches term supply:

| | 08-07 | 08-08 |
|---|---|---|
| Hard stops (`term_supply_exhausted`) | 7 | **0** |
| `term_starvation` observations | 6 | **0** |
| Pitchable found | 110 | **246** |
| Pitchable rate | 19.3% | **31.9%** |
| Fresh pitchable per pass | 1.10 | **2.77** |
| Net-new channels per productive pass | 8.6 | **9.3** |

The rate moving matters more than the volume. Revived proven terms are terms already
measured against real conversions, so they arrive with better odds than a freshly invented
phrase. 31.9% is the highest pitchable rate of the whole 08-01 to 08-08 block, above
08-03's 28.8% and well above the 17% to 22% band of the days between.

**Caveat worth holding:** this cycle also ran fewer, longer sessions (9 against 14), so
per-session figures are not directly comparable with yesterday's. The per-pass and
per-discovery rates above are, and they move the same way.

## Q2 — why only 70 got parked

Email is still the gate, exactly as it has been since July. Of 246 pitchable creators:

- **72** reached `approved_hold` (found, scored, host identified, email verified)
- **161** went to `needs_contact` (worth contacting, no verifiable email)
- 39 were sitting at `email_verified` when the snapshot ran, still moving through

That is a **31% verify rate**, in the normal band and not a regression. Doubling the
intake doubled both piles.

One genuine improvement over 08-06: that day's +173 was mostly recovered backlog rather
than new supply, which flattered the number. Today the pool gain (+70) matches this
cycle's own promotions (72) almost exactly, so the parking is real same-day work.

The counterweight is that `needs_contact` grew **+162 against `approved_hold`'s +70**.
It now sits at 5,040 and is the larger lane. Nine thousand two hundred and thirteen
creators have been found, scored, and never contacted.

## Q3 — the day's real cost: 38,869 classifications for 79 keeps

Every session opens with a reservoir check, and all nine returned STOCK-UP, so all nine
ran `keyword-harvest`. That script scrapes YouTube and Google autocomplete for candidate
search phrases, then sends each one to a cheap OpenRouter model
(`qwen/qwen3.7-flash`, task `prefilter` in `models.json`) to ask whether searching it on
YouTube would surface a creator who sells a high-ticket service.

Nine harvests this cycle, from the session logs:

| Harvest | Candidates | Kept |
|---|---|---|
| 08-07 08:19 session | 4,530 | 1 |
| 08-07 11:00 session | 4,435 | 10 |
| 08-07 13:49 session | 4,295 | 48 |
| 08-07 16:23 session | 4,094 | 5 |
| 08-07 18:56 session | 4,100 | 10 |
| 08-07 21:26 session | 4,867 | 2 |
| 08-08 00:08 session | 4,317 | 0 |
| 08-08 02:40 session | 4,514 | 0 |
| 08-08 05:08 session | 3,717 | 3 |
| **Total** | **38,869** | **79 (0.20%)** |

Each pass is 46 to 59 minutes of back-to-back model calls, measured from the file
timestamps in `youtube-lead-finder-v1/logs/keyword-harvest/<date>/`
(`flat-new.txt` written at harvest, `prefilter-verdicts.json` written at the end).

**The mechanism is a bookkeeping gap, not a bad classifier.** `keyword-harvest.ts` only
prefilters terms that are net-new **relative to the terms table**. A kept term is written
into that table as a probe, so it never comes back as new. A rejected term is written
nowhere at all. Autocomplete offers it again on the next run, the code sees a string it
does not have, and pays to judge it a second time, then a third, indefinitely.

Measured overlap between consecutive days' candidate sets (`flat-new.txt`):

- 08-08 candidates already seen on 08-07: **2,593 of 3,717 (69.8%)**
- 08-08 candidates already seen on 08-06 or 08-07: **2,811 of 3,717 (75.6%)**

Those are separate days with different seed-rotation offsets, so within-day repeats
should run higher still. And because every session ended on its time budget, this is not
idle capacity being spent. It comes straight out of finding.

## Shipped

### `youtube-lead-finder-v1@fd9773a` — persistent reject cache for the keyword prefilter

`src/discovery/external/icp-prefilter.ts` now remembers what it has already rejected, in
`logs/prefilter-reject-cache.json`, and skips those terms before spending a model call.

Four design choices, each guarding a specific way this could go wrong:

1. **Only rejections are cached, never keeps.** A kept term enters the terms table and
   cannot recur, so caching it buys nothing. More importantly, a stale reject entry can
   only drop a term, never let an unjudged one into probes. That is the same direction
   the classifier already fails in, so the cache cannot make output worse than the
   existing fail-closed rule already allows.
2. **The cache is fingerprinted.** The stamp is a SHA-256 of the prefilter skill text
   (`skills/keyword-icp-prefilter.md`) plus the primary and fallback model ids. Edit the
   skill or repoint `models.json` and the fingerprint changes, the old cache is discarded
   whole, and every term is re-judged under the new rules. No manual invalidation step
   for a future agent to forget, which matters because the skill has been edited twice in
   the last three days.
3. **A fingerprint mismatch starts genuinely empty.** It does not re-seed from the
   on-disk verdict files, because those hold exactly the stale verdicts being thrown out.
   Only a completely absent cache warms itself from the last three days of
   `prefilter-verdicts.json`, so the fix pays off on run one rather than run two. Those
   three days are all post-dating the 08-06 skill rewrite, so the seed is valid under the
   current fingerprint.
4. **Transport failures are not cached.** A batch that failed on the network comes back
   marked `no verdict returned`, meaning it was never actually judged. Caching that would
   make one bad network minute permanent, so those are excluded.

Escape hatches: `PREFILTER_REJECT_CACHE=0` in the environment, or
`useRejectCache: false` per call.

**Verified before commit.** `tsc --noEmit` clean. A live run with the OpenRouter key
unset (so it cost nothing) confirmed all four behaviours: cold start seeded from verdict
files and skipped 5 of 6 known rejects; order and length preserved; the novel term was
not served from cache; a deliberately corrupted fingerprint discarded the cache and
re-judged all 6. The failed batch in that run was correctly **not** written to the cache.

### `youtube-lead-finder-v1@01c328e` — keep the smoke test honest

`scripts/smoke-llm-tasks.ts` passes `useRejectCache: false`. Its four sample terms are
fixed, so with the cache on it would have started passing on cached answers without ever
touching OpenRouter, which is the opposite of what a smoke test is for.

### What to expect next cycle

The first harvest after this ships still pays close to full price (the seed only covers
three days of verdicts). From the second onward, candidates should drop from roughly
4,300 to the low hundreds and the pass should finish in minutes. Watch for the new log
line:

```
[prefilter] skipped N/M already-rejected term(s) from cache — K to classify.
```

If the reclaimed time converts, sessions should fit more finder passes into the same
90-minute budget. That is the number to check on 08-09.

## Considered and deliberately not shipped

**Fade thrash.** 86 of 87 passes registered a fade. The threshold is 12 fresh pitchable
and the best pass today was 12, so effectively every pass trips it and the discovery
machinery runs every time. This looks wrong and has looked wrong since 08-06. It is being
left alone on purpose: both fade actions are separately gated (the harvest by its own
cadence, discovery by the dry-guard), and this was the best discovery day of the block.
Retuning the threshold on the strength of one good day would be changing a working
system on a hunch. Revisit if pitchable rate falls back under 20%.

**Niche concentration.** Real Estate (44), Health and Wellness clinics (42) and
Transformation coaching (35) supplied 121 of 246 pitchable, and the top five niches
supplied 165 of 246. This is a real limit but it needs a supply decision, not a code fix,
and the proven-term revive that rescued today actively deepens it, since the proven terms
are concentrated in exactly those niches.

## Priorities

1. **Decide the outlet for `approved_hold`** (4,173 prepped, 0 sent). Top item for a
   week. Needs a decision from Casey, not code.
2. **Build the `needs_contact` recovery engine** (5,040, now the bigger pile, growing
   +162/day against the parked lane's +70).
3. **Measure what the reject cache bought.** Harvest duration and passes per session on
   08-09.
4. **Meter OpenRouter as a first-class cost.** The burn ledger reads $0 because it counts
   only Anthropic; today's 38,869 classifications were invisible to it.
5. **Widen the niche mix** against the two-thirds-from-five-niches concentration.
