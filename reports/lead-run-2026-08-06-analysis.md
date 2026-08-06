# Lead Run Debrief — 2026-08-06 (analysis companion)

**Headline: +173 parked, the best day since 08-03, but roughly two thirds of it is the 733 rescued rows clearing rather than new supply. Scoring is fully healed (1 failure in 706). The collapse alarm built yesterday fired for the first time, correctly, and was fixed inside five minutes.**

Cycle window: 2026-08-05 07:00Z → 2026-08-06 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-06.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+173** | pool 3,896 → 4,069 (was +8 on 08-05, +105 on 08-04) |
| `needs_contact` pool | 4,808 | +270 swept this cycle |
| **Total parked, 0 sent** | **8,877** | 4,069 + 4,808 |
| Discovered | 710 | lowest of the week |
| Pitchable (score ≥6) | 143 | vs 48 broken, 184 on 08-04 |
| **`scoring_failed`** | **0** | rate 0.0%. Was 580 / 72% yesterday |
| Email-verified | 56 | 42% of today's own pitchable that resolved |
| Net-new channels written | 718 | across 101 productive passes = 7.1/pass |
| Campaign sessions | 14 / 14 done | all ended on the wall-clock budget |
| Finder passes | 104 | fresh-pitchable sum 142 = 1.37/pass |
| Fades / discovers / promotes | 104 / 104 / 102 | every pass faded, see below |
| Hard stops / quota stops / crashes | 0 / 0 / 0 | |
| `term_starvation` observations | 1 | |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 7th straight cycle |

## Where the +173 actually came from

Leads parked per session, from the `done` events in `logs/campaign-2026-08-0{5,6}.jsonl`:

| Session end (UTC) | Parked | |
|---|---|---|
| 08-05 08:09 | 35 | rescue running |
| 08-05 09:37 | 20 | rescue running |
| 08-05 11:42 | 23 | rescue running |
| 08-05 13:12 | 21 | rescue running |
| 08-05 15:00 | 30 | rescue running |
| 08-05 16:25 | 8 | rescue finished 15:20Z |
| 08-05 18:16 | 6 | |
| 08-05 19:45 | 4 | |
| 08-05 21:24 | 2 | |
| 08-05 22:47 | 7 | |
| 08-06 00:44 | 2 | |
| 08-06 02:05 | 7 | |
| 08-06 04:02 | 4 | |
| 08-06 05:14 | 7 | |
| **Sum** | **176** | Airtable net +173 |

**129 of 176 (73%) landed in the five sessions that overlapped the rescue pass.** After it drained, the rate settled at about 5 per session. That is the real ongoing figure and it should be the baseline expectation for tomorrow, not 173.

Corroborating arithmetic: the campaign resolved **412** pitchable leads through verify this cycle (142 promoted to `approved_hold`, 270 swept to `needs_contact`) while finding only **143** new ones. Of today's own discoveries, **56** reached `approved_hold`.

## The rescue, in full

`youtube-lead-finder-v1/scripts/rescore-failed.ts`, launched by hand 08-05 06:44Z, finished 15:20Z.

```
Attempted:       733
Fetch failed:    0
Still failing:   0
Rescored ok:     733
By new status:   unreviewed:484  below_threshold:215  demo_niche_excluded:34
LLM calls used:  1229
```

Score distribution of the rescued rows: **188 sevens, 99 nines, 47 sixes, 3 eights = 337 pitchable creators** that had been found, paid for, and discarded. (`unreviewed` is the normal finder status for anything scoring 4 or above; the downstream verify lane selects on score, not on review status, so these entered the lane correctly.)

Verify rate on the rescued cohort worked out to roughly **31%**, against **42%** for leads found today. Older rows are a colder sample. Recovery is worth doing and it is not free money.

**Live `scoring_failed` backlog verified at 0** with a direct Airtable count, not inferred from logs.

## Scoring health

705 scored, 1 failed, across today's 14 sessions. The single failure was an OpenRouter HTTP 429 on `qwen3.7-flash` ("temporarily rate-limited upstream") that outlived all five retry attempts in `src/llm/client.ts`. The channel was skipped rather than written as broken, so it left no stranded row. One transient provider failure in 706 calls needs no fix.

| Session (UTC) | Scored OK | Failed |
|---|---|---|
| 08-05 08:09 | 64 | 0 |
| 08-05 09:37 | 20 | 0 |
| 08-05 11:42 | 77 | 0 |
| 08-05 13:13 | 26 | 0 |
| 08-05 15:01 | 57 | 0 |
| 08-05 16:26 | 28 | 0 |
| 08-05 18:17 | 71 | 1 |
| 08-05 19:45 | 22 | 0 |
| 08-05 21:25 | 76 | 0 |
| 08-05 22:47 | 24 | 0 |
| 08-06 00:44 | 66 | 0 |
| 08-06 02:06 | 46 | 0 |
| 08-06 04:02 | 82 | 0 |
| 08-06 05:14 | 46 | 0 |

## The alarm fired, and it was right

Yesterday's rec #2 was "watch the new alarms actually fire." One did, 22 hours after it was built.

`logs/autopilot-attention-handled-20260806T055248Z.jsonl`:

```
2026-08-06T05:47:05Z  pitchable_rate_collapse
score>=6 rate is 7.5% over the last 67 new leads, vs a 23.0% trailing baseline
(20 prior check-ins) — less than half. scoring_failed rate is normal (0%), so
this isn't the token-budget bug; likely a scoring-rubric, prefilter, or term-mix
regression worth a look.
```

The hourly fix agent found the cause and shipped `youtube-lead-finder-v1@066640e` at 05:52Z. Probe terms were winning promotion on samples of one or two channels: a term that returned 2 candidates and qualified 1 read as a 0.5 qualified rate and outranked terms proven over hundreds of runs. Off-target terms (addiction and rehab intervention, dual diagnosis, aviation licensing, Whop course selling) had climbed into the active pool on noise alone.

The fix floors the qualified-rate denominator at 20 channels in `term_stats.ts` (priority scoring) and requires `channels_returned >= 20` for a winner or loser verdict in `evaluate-probes.ts`; smaller probes now sit in a "building sample" bucket. The agent then ran `evaluate-probes --apply` and confirmed the noisy terms were demoted rather than promoted.

Free detector, cheap agent, no page, $0 Anthropic. This is the loop doing what it was built for.

The scoring-failure-rate alarm did not fire, correctly, at 0.14%.

## Supply, in context

Per productive pass the finder wrote **7.1 net-new channels** today: 3.1 on the broken day, 6.6 on 08-04, 7.1 on 08-03. Fresh pitchable per pass was **1.37**: 1.57 on 08-04, 2.13 on 08-03, 2.05 on 08-02. Recovered to the 08-03 level, not beyond it.

The slower trend is a gentle slide in daily pitchable across the clean days: **313, 259, 184, 143**, roughly a fifth lost per day. This is happening while the term table *grows* (14,609 → 15,067 across the cycle, so the keyword harvest is working). New terms are converting worse than the ones they replace. Worth two more cycles of observation before treating it as a wall; if it holds, the answer is term quality (frontier verticals) rather than term count.

Niche mix, pitchable: Real Estate 37, Legal 31, Health clinics 16, Financial planning 10. Those four are 66% of the day.

## Left alone on purpose

**Every one of the 104 passes registered a `fade_detected`.** The threshold is 12 fresh pitchable per pass and the best pass all cycle hit 6, so the fade signal is permanently on and `fades: 104` in the snapshot carries no information. It is not currently costing anything: both actions a fade triggers are separately gated, and those gates work. The keyword harvest skipped 97 times on its 2h floor, and the discovery dry-guard skipped 73 of 104 LLM calls with "went dry at 15,062 terms, table still 15,062, no new ground." Re-tuning the threshold would disturb gates that are tuned and healthy in exchange for a cleaner log line. Noted, not changed.

**The single OpenRouter 429.** One in 706, after five retries with exponential backoff. Nothing to fix.

## Fixes shipped

**`youtube-outreach-orchestrator-v1` — auto-rescue stranded `scoring_failed` rows.**
`src/drivers/campaign.ts` gains `rescueScoringFailed()`, called at the end of every session after the final verify, promote and probe evaluation. Yesterday's recovery worked but depended on a human noticing; the leads sat stranded for 30 hours first. Now any future scoring outage self-heals on the next session.

It only fires when the session's *own* passes prove scoring currently works, because rescoring into a broken scorer just re-fails every row and pays for the calls:

- at least `RESCUE_MIN_SAMPLE` (25) newly-discovered leads in the session, and
- a session scoring-failure rate under `RESCUE_MAX_FAIL_RATE_PCT` (20%).

Both gates log a skip reason to `logs/campaign-<date>.jsonl` as `rescue_scoring_failed`.

**`youtube-lead-finder-v1` — make `rescore-failed.ts` safe to run unattended.**

- `--max-minutes N` (the campaign passes 20, via `RESCUE_MAX_MINUTES`) stops the pass cleanly at a wall-clock budget. The script is naturally resumable because it re-queries whatever is still `scoring_failed` on each start, so a bounded slice per session drains a large backlog over a few sessions instead of blocking one session for hours. At the measured 42s per row, a 733-row backlog clears in about 3 days of normal sessions without anyone touching it.
- Circuit breaker: 8 consecutive still-failing rows aborts with exit 4, so a genuinely broken scorer stops the pass instead of grinding the whole backlog into re-failure. The campaign logs the exit and moves on.
- Early return with no work when the backlog is empty, and a `Remaining:` line in the result block.

Both repos typecheck clean. `rescore-failed.ts` was run live to confirm it loads and exits cleanly. The auto-rescue trigger itself has **not** fired in production yet, because the backlog is currently 0 and there is nothing for it to find. First real test is the next time scoring has a bad hour.

**Cost note:** the rescue spends OpenRouter credits (`OPENROUTER_API_KEY`), roughly 1.7 model calls per row on cheap models. Bounded at 20 minutes per session, that is on the order of a cent or two per session and only when something is actually stranded. The full 733-row rescue yesterday used 1,229 calls.

## Ranked next

1. **Decide the send outlet for `approved_hold`** (4,069 prepped leads, seventh day open).
2. **Build the `needs_contact` recovery engine** (4,808, grew 270 today, now larger than `approved_hold`).
3. **Watch the pitchable slide** for two more cycles: 313, 259, 184, 143 on a growing term table.
4. **Confirm the auto-rescue fires** the first time something is actually stranded.
5. **Meter OpenRouter spend** as a first-class cost. The burn ledger is Anthropic-only, so `$0` still reads as "free."

## Status caveat

Everything is parked, nothing sent. 8,877 leads held, 0 emailed. The loop is still running for the next cycle: 14 of 14 sessions completed on the wall-clock budget, 0 hard stops, 0 quota stops, 0 fatal signatures, $0 Anthropic.
