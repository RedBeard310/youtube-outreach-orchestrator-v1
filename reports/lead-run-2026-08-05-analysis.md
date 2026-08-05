# Lead Run Debrief — 2026-08-05 (analysis companion)

**Headline: the finder worked all day and the scorer threw away 72% of what it found. +8 parked, down from +105, with no crash, no quota stop and $0 Anthropic. One number in one file caused all of it.**

Cycle window: 2026-08-04 07:00Z → 2026-08-05 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-05.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+8** | pool 3,888 → 3,896 (was +105 on 08-04) |
| `needs_contact` pool | 4,510 | +11 |
| **Total parked, 0 sent** | **8,406** | 3,896 + 4,510 |
| Discovered | 802 | |
| **`scoring_failed`** | **580** | **72% of everything discovered** |
| Pitchable (score ≥6) | 48 | vs 184 on 08-04. A floor, not a reading |
| Net-new channels written | 184 | across 59 productive passes. The finder was fine |
| Email-verified | 6 | too few pitchable to read a rate from |
| Campaign sessions | 13 / 13 done | all ended on the 90-min time budget |
| Finder passes | 86 | fresh-pitchable sum 22, 72 zeros |
| Fades / discovers / promotes | 86 / 85 / 23 | |
| Hard stops / quota stops / crashes | 0 / 0 / 0 | |
| `term_starvation` observations | **19** | all of them wrong about the cause |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 6th straight cycle, and useless today |

Scoring, per session, across the cycle (from the finder's own RUN SUMMARY blocks):

| Session (UTC) | Scored OK | Failed | Fail rate |
|---|---|---|---|
| 08-04 08:14 | 14 | 20 | 59% |
| 08-04 11:16 | 33 | 77 | 70% |
| 08-04 12:53 | 4 | 24 | 86% |
| 08-04 15:22 | 4 | 74 | 95% |
| 08-04 16:23 | 3 | 82 | **96%** |
| 08-04 18:50 | 9 | 84 | 90% |
| 08-04 19:56 | 4 | 57 | 93% |
| 08-04 21:58 | 27 | 54 | 67% |
| 08-04 23:31 | 9 | 16 | 64% |
| 08-05 01:23 | 10 | 48 | 83% |
| 08-05 02:53 | 2 | 25 | 93% |
| 08-05 04:37 | 28 | 19 | 40% (fix landed 04:58 mid-session) |
| 08-05 06:03 | 13 | **0** | **0%** |
| **Total** | **160** | **580** | **78%** |

The 580 in the logs matches the 580 `scoring_failed` rows in Airtable exactly, so the log and the database agree on the damage.

Pitchable by niche (of the 48 that got through): Health & Wellness Clinics 12, Legal 8, Real Estate 7, Transformation & Performance Coaching 7, Coaching & Consulting 6, Marketing Agencies 3, then singles. The mix is not meaningful at this sample size.

## The three questions

**Q1 — What broke?** The scoring call, on a token budget too small to hold its own answer. The scorer runs `qwen3.7-flash`, a reasoning model whose invisible thinking is billed and counted against the *same* ceiling as the visible reply. That ceiling was 2,048. Confirmed live on real production channels: about 1,850 tokens went to reasoning, the JSON got cut mid-string, the parser reported "no JSON object found", and the channel was written as `scoring_failed` with no score. Host extraction had the identical flaw on a 600-token budget.

Latent since the 2026-08-01 move off Anthropic to OpenRouter. The 08-04 rubric expansion did not create it, but a longer rubric invites more thinking, which plausibly tipped it over. Damage across two cycles: 128 rows on 08-04 plus 580 today, **733 total**.

Fixed at 04:58Z by the hourly check-in agent: scoring 2,048 → 8,192, host 600 → 2,048. The keyword prefilter already ran at 8,192 for exactly this reason.

**Q2 — Why did 30 hours of hourly health checks see nothing?** The check-in only read `fresh_pitchable`. Zero pitchable is identical whether the finder found nothing or found plenty and the scorer dropped it. So it fired 19 `term_starvation` observations, each asserting "term-supply wall, not a code bug", and each kicking a keyword harvest that could not help. Every hour the system told itself there was nothing to fix.

The evidence was in the same files. Finder run summaries printed `Channels scored: 4` next to `scoring_failed: 14`, pass after pass. Nothing read that line. Yesterday's debrief also walked past `scoring_failed: 128` sitting in its own snapshot and called it a clean day.

**Q3 — Is it recoverable?** Yes, and recovery is running. `scoring_failed` rows are real prospect rows that never got a score, so nothing was deleted. `youtube-lead-finder-v1/scripts/rescore-failed.ts` started at 06:44Z: refetch from YouTube, rescore on the fixed budget, update the row in place. It re-queries for whatever is still stuck on each start, so it resumes by itself.

Early returns confirm real leads were being discarded. Of the first 56 rescored, scores include a run of 7s and 9s across legal, clinics and coaching. Measured live 40 minutes after the cycle snapshot: `scoring_failed` 580 → 572, pitchable 48 → 52. At about 40 seconds a row the full pass takes roughly 8 hours.

**So today's 48 pitchable and +8 parked are floor numbers.** The real yield for the day is unknown until the rescue finishes.

## What shipped this cycle

Three durable fixes, on top of the 04:58Z and 06:22Z hotfixes from the check-in agent.

| Repo | Change | Why it is durable |
|---|---|---|
| `youtube-lead-finder-v1` | A failed parse now retries with **double** the token cap (32k limit), in both `score.ts` and `host_extractor.ts` | The 04:58Z fix is a hard-coded constant, so a longer rubric or a chattier model quietly reopens the same hole. `max_tokens` is a ceiling and not a spend, so a bigger cap on a call that already failed costs nothing. This removes the class of bug instead of one instance |
| `youtube-outreach-orchestrator-v1` | The starvation heartbeat no longer claims "term-supply wall" when the scoring alarm is live, and skips the harvest kick in that case | The wrong label is most of why this survived 30 hours. Also stops paying for a prefilter call that cannot help |
| `youtube-outreach-orchestrator-v1` | `scoring_failed` and `scoring_failed_rate_pct` are first-class fields in the daily snapshot | 128 failed rows were already in yesterday's snapshot and the report missed them because they were buried in the status breakdown |

Verification: both repos typecheck clean; the scoring path was run end-to-end on a live one-vote call (returned score 3, niche Legal Services, 1 attempt); the host retry path was exercised with an injected client (2 attempts, low-confidence fallback); `debrief-data.ts` was run for real and produced `scoring_failed: 572, scoring_failed_rate_pct: 71.3`, after which the authoritative snapshot was restored.

One thing to watch: the check-in's new scoring-rate detector reads `new_leads` / `scoring_failed` / `score_6_plus` fields that the campaign driver only started writing at 06:22Z. The campaign process running through the end of the cycle predates that code, so no `finder_run` event in this cycle carries them. The detector is correct but untested in production until the loop relaunches.

## Ranked next

1. **Let the rescue finish, then confirm the number.** 733 rows, about 8 hours, running now. Log: `youtube-lead-finder-v1/logs/rescore-failed-2026-08-05.log`. Re-running resumes it. This is the only work that recovers leads already paid for.
2. **Watch the new alarms fire.** Tomorrow is the first real test of whether a repeat is caught in an hour instead of 30.
3. **Build the `needs_contact` recovery engine.** 4,510 scored creators with no verifiable email. Recovering 30% beats several days of fresh finding and sidesteps the term-supply ceiling. Still deferred.
4. **Decide the send outlet for `approved_hold`.** 3,896 prepped leads idle. Today is a reminder that a reservoir with no drain also hides what anything upstream is worth.
5. **Meter OpenRouter spend as a first-class cost.** The burn ledger is Anthropic-only by design, so `$0` reads as "the pipeline is free". Today it also meant 580 scoring calls that produced nothing cost real money, invisibly.

## Status caveat

Everything is parked, nothing sent. `approved_hold` 3,896 plus `needs_contact` 4,510 is 8,406 leads parked with no send process. The loop ran 13 sessions, all finished on the 90-minute budget, 0 hard stops, 0 quota stops, 0 crashes, $0 Anthropic, and it is still running for the next cycle.
