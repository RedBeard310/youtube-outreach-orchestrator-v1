---
title: Lead Run Analysis — 2026-07-31
type: run-analysis
date: 2026-07-31
source: youtube-outreach-orchestrator-v1 (autopilot debrief)
cycle_window_utc: 2026-07-30T07:00:00Z → 2026-07-31T07:00:00Z (the 2026-07-30 PT calendar day)
---

# Lead Run Analysis — 2026-07-31

**Headline: +72 parked in `approved_hold` (pool 2,947 → 3,019) — the biggest
single-cycle gain in 10 days (since 07-21's +86), the *second* straight rising day
(07-30 +41 → 07-31 +72), carried entirely by 1,053 net-new channels written — the
strongest genuine finding of the entire 14-day autocomplete IP-block. $0 Claude spend,
0 crashes, 0 quota stops, 0 fatal signatures, no fix-agent page, no halt flag.**

## Grounded numbers (from `logs/autopilot-debrief-2026-07-31.json`)

| Metric | Value |
|---|---|
| `approved_hold` now / at cycle start | **3,019 / 2,947** → **+72** |
| `needs_contact` now | **3,845** (+93) |
| Discovered today (net-new channels written) | **1,053** |
| Pitchable (score ≥6) | **178** |
| Email-verified → parked | **72** (~40% verify) |
| `net_new_passes_with_writes` | 65 |
| `fresh_finding_dead` | **false** |
| `autocomplete_blocked` / days | **true** / **13.9** (since 2026-07-17) |
| Campaign sessions started / done | 36 / 35 |
| Finder runs / with fresh pitchable | 103 / 55 (sum 178, peak 11) |
| Fades / discovers / promotes | 70 / 103 / 71 |
| Hard stops / quota stops / time-budget stops | 33 / **0** / 2 |
| Burn (Claude) today | **$0.00** (soft 75 / hard 150) |
| Fatal signatures | **[] empty** |

Cross-checks reconcile: `approved_hold` delta (3,019−2,947 = 72) = `parked_today` (72)
= `done_parked_gain_sum` (72) = `email_verified` (72). Not churn — the verify backlog
was fully spent on 07-25, so every park is a freshly-written channel.

## Shape of the day — three bursts, three droughts

`fresh_pitchable` per finder pass (103 passes, 00:21→23:59 PT). Peak pass = 11; no pass
cleared the old ≥12 "healthy" bar, yet the day parked +72 because finding arrived in
**dense clusters**, each right after a harvest leaked through the block:

| Window (PT) | Event | Parked |
|---|---|---|
| 00:21 → ~05:00 | dead start (first 9 passes all 0); harvest RAN 04:25 | — |
| **06:00** | reservoir **GO**, session ended on 90-min **time budget** | **+28** |
| **06:51** | | **+8** |
| ~07:00 → 12:00 | drought; harvest RAN 12:26 | — |
| **13:53** | reservoir **GO**, session ended on 90-min **time budget** | **+18** |
| **14:57** | | **+10** |
| ~15:00 → 20:00 | drought; harvest RAN 20:30 | — |
| **20:52** | | **+8** |
| ~21:00 → 23:59 | dead tail | — |

The three harvest punch-throughs (04:25 / 12:26 / 20:30 PT) each seeded a burst;
`reservoir` flipped `STOCK-UP → GO` twice. The two biggest sessions (+28, +18) ended on
the time budget, not a term wall — they had real work to do. 100/103 harvests still
correctly skipped on block-backoff.

## The three questions

**Q1 — Is +72 real finding or backlog churn?** Real. The found-but-unverified backlog
that carried days 2–8 of the block was spent on 07-25, so the verify lane has nothing
left to drain — every park must come from a new row. `net_new_channels_written = 1,053`
across 65 writing passes, `fresh_finding_dead = false`, and the 72 verified emails
exactly match the +72 gain. This confirms and amplifies 07-30's read; two rising days is
a trend.

**Q2 — Why is finding recovering on Day 14?** Two independent supply lines returned at
once. (1) The autocomplete endpoint keeps degrading from hard-block toward rate-limiting
— the harvest punched through 3× (vs skip-every-session for most of the block). (2)
Direct YouTube-key capacity is restored: keys #1–#7 back in live rotation (many
per-minute 429 rotations, one daily-quota exhaustion on key #5), versus "0 working direct
keys" a week ago. So the finder had both terms and quota. But `autocomplete_blocked` is
still true (1 block obs) — the block is leaking wider, not lifted.

**Q3 — Why only +72; what's the ceiling?** Email-verifiability. 72 of 178 pitchable
(~40%) had a verifiable email → parked; 93 swept to `needs_contact` (→ 3,845). More
pitchable creators fell out for lack of an email (106) than were parked (72). On a
leak-day, finding is no longer the binding constraint — email is. Niche mix broadened off
the flat-week Real-Estate/Health duopoly (Health 36, RE 28, Agencies 19, Coaching 16,
Financial Planning 15, + a long tail = 178) — Health+RE now 36% of pitchable vs ~70%
during the flat week.

## What held / what's fixed

Nothing broke. The 07-25 (`b007173`) + 07-30 (`eca0fa2`) benign-hard-wall carve-outs
both held: 16 benign "two consecutive finder failures" drought-stops this cycle, and
`fatal_signatures_today` came back `[]`. Full session-log grep clean (no `ENOTFOUND`,
unhandled rejection, or crash). Block-backoff, discovery dry-guard, and burn ledger all
firing as designed → $0.

## Self-improvement: no code shipped — deliberately, with evidence

I reviewed the cycle for systemic issues (repeated fatal signatures, low verify rate,
quota waste, fade thrash, term starvation). The loop ran optimally on every axis:
`fatal_signatures = []`, verify ~40% (healthy for fresh finding), 0 quota stops, harvest
correctly skipped 100/103, 70 fades each correctly triggering discover (no thrash), and
though the check-in logged 11 `term_starvation` observations the finder still wrote 1,053
channels — the anti-starvation floor + discovery kept it fed, not a stall.

**The one real inefficiency found — and why it was declined:**

- **Dead-key re-probe.** `YouTubeClient.deadKeys` is a per-process `Set`
  (`youtube-lead-finder-v1/src/youtube/client.ts:135`, comment: "one client per run").
  It correctly skips a quota-dead key *within* a process, but does not persist across
  finder passes — so each fresh pass re-probes the genuinely quota-exhausted key #5,
  hitting `quotaExceeded`, re-marking it dead, and rotating (16× this cycle, all in the
  two big sessions).
- **Why declined:** a `quotaExceeded` request is **not billed** by YouTube (you cannot
  exceed a cap already hit), so the entire "waste" is ~16 failed HTTP round-trips/day at
  **zero quota cost**. Persisting dead-key state across processes would introduce a real
  regression risk — a key whose daily quota **resets at PT-midnight** could be skipped by
  a fresh process reading a stale "dead" flag, *losing* real capacity. Getting the
  PT-reset boundary right is fiddly, and this is the money-path finder. Net-negative
  trade for no quota saving. The current per-process stickiness is the documented,
  intended design.

This mirrors the 07-24 / 07-26 / 07-27 / 07-28 precedent: under an infra-only constraint,
with the loop running optimally, a forced change on a correctly-running money-path loop is
churn. Every cheap durable fix has already shipped across the block, each buying less.

## Ranked next levers

1. **Rotate the VPS egress IP / proxy** (infra, Day 14) — +72 is the block leaking, not
   lifting; removing it ends the drought-burst rhythm and restores steady supply.
2. **Build the `needs_contact` recovery engine** (3,845) — the biggest *unblocked* lever;
   on leak-days it already out-caps finding (106 of 178 pitchable had no verifiable email).
3. **A 2nd independent term source (DataForSEO)** — the durable answer to the block class;
   turns leak-days into every-day.
4. **Make discovery compound** — lower/cumulative `evaluate-probes` promote bar so a good
   leak-day's veins persist rather than being re-invented next cycle.

> **Status caveat:** everything is *parked*, nothing sent — `approved_hold` holds until
> the new email process is ready.
