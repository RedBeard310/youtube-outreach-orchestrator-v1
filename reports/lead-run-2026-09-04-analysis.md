# Lead Run Analysis — 2026-09-04

Cycle: 2026-09-03 07:00Z → 2026-09-04 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-04.json`.
HTML debrief: [lead-run-2026-09-04.html](lead-run-2026-09-04.html).

**Headline:** the ready-to-write pool gained **+71**, against yesterday's record
+627. Two independent failures caused the drop, and both are the same shape as the
last three days: a step reported success while doing no work.

**The recovery lane lost its website search, silently.** Both Brave Search API keys
are capped at **$5/month** and now return `402 Usage limit exceeded` (verified live
this morning). The lane resolves a creator's own website before nine of its ten
collection methods can do anything, so site-resolution failure went **9% → 93%**
across six passes, collect yield went **70/150 → 28/150**, and the verify half
starved down to batches of 14, 11 and 17 (from 200-lead batches yesterday), skipping
two scheduled passes on `no_pending_email_points`. That arithmetic lands on today's
71. Nothing warned, because `searchBrave` rotated keys only on a 429 and returned
empty on every other status.

**Discovery was dark for 17 of 24 hours.** The direct YouTube key pool drained at
~13:00Z, six hours into the cycle. Last channel written at 14:00Z; nothing for the
remaining 17 hours. Cause is benign: the video-graph lane sprinted 8,509 seeds
(vs 2,176 the day before, +291%) to **finish its book**. Cost is not: the campaign
loop then hard-walled **32 times, one or two every hour**, on a flat 30-minute
back-off, against a daily allowance that only refills at midnight PT.

**Structural news: two of three self-directed seed books are now empty.**
Video-graph 82,442/82,442 (`Video sweep COMPLETE. The video backlog is drained.`),
peer network 12,529/12,529, recommended-videos 9,769/12,622 with ~0.6 days of road.
The lanes refill each other's books; only one produced this cycle and it is nearly out.

Four fixes shipped across two repos, all verified. Zero fatal signatures, zero
scoring failures, zero hours halted. Anthropic spend $2.04, the first non-zero day
in eight, entirely on false pages that fix 4 removes.

---

## 1. The numbers

| Metric | 09-04 | 09-03 | 09-02 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+71** | +627 | +177 |
| `approved_hold` pool | **4,734** | 4,663 | 4,036 |
| `needs_contact` pool | 4,344 | 4,350 | 4,888 |
| Total found, never contacted | **9,078** | 9,013 | 8,924 |
| New channels found | 1,581 | 2,817 | 2,524 |
| Pitchable (score ≥ 6) | 64 | 90 | 85 |
| Emails verified | 37 (58%) | 56 (62%) | 31 (36%) |
| Hours with zero channels written | **17** | 5 | 0 |
| Campaign sessions | 35 / 36 | 21 / 21 | 31 / 30 |
| Finder runs | 151 | 314 | 256 |
| Fresh pitchable (campaign lane) | 18 | 10 | 13 |
| Fades · discovers · promotes | 119 · 154 · 152 | 298 · 319 · 313 | 231 · 262 · 256 |
| Hard stops · quota stops · time-budget stops | **32** · 0 · 3 | 13 · 1 · 8 | 25 · 0 · 5 |
| Term-starvation observations | 26 | 25 | 24 |
| Hours halted | 0 | 0 | 0 |
| Anthropic API spend | **$2.04** | $0.00 | $0.00 |
| OpenRouter, account meter | $29.32/day | $82.05/day | $16.73/day |
| OpenRouter balance | **$193.76 (6.6 days)** | $223.07 (2.7 days) | $305.13 (18.2 days) |

The runway improvement is an artefact, not a win. Spend fell because the pipeline
was dark for 17 hours. On a working day this reads closer to 3 days, not 6.6.

Per-lane discovery this cycle:

| Lane | Channels | Score ≥ 6 | Hit rate | Book |
|---|---:|---:|---:|---|
| Video-graph sweep | 889 | 32 | 3.6% | **82,442 / 82,442 — DRAINED** |
| Recommended-videos feed | 480 | 14 | 2.9% | 9,769 / 12,622 — 2,913 left (~0.6 d) |
| Keyword search | 199 | 18 | **9.0%** | n/a (term-supply bound, 26 starvation notices) |
| Peer network | 13 | 0 | 0% | **12,529 / 12,529 — DRAINED** |
| Podcast crossover | 0 | 0 | — | ran once, 0 as usual |
| Comment sweep | 0 | 0 | — | paused by Casey 08-20 |

Hourly channel writes (07:00Z → 07:00Z): 168, 304, 254, 209, 240, 227, 176, 3, then
**zero for sixteen straight hours**. All 1,581 channels were written before 14:00Z.

Niche mix of the 64 pitchable: Other 15, Coaching & Consulting 13, Real Estate 8,
Health & Wellness Clinics 8, Transformation Coaching 7, Legal 3, Manufacturing 3,
Financial Planning 2, plus singles. Tarot/astrology/manifestation-adjacent: **3 of
64 (~5%)**, in line with the last three days. Casey has not ruled on the exclusion
question; nothing changed.

---

## 2. Q1 — the recovery lane's website search died on a spending cap

The dominant producer of leads in this pipeline is no longer finding. It is the
Bloodhound recovery lane walking the `needs_contact` backlog. Yesterday it produced
591 of 627 parks. Today it produced almost nothing, and the cause is one HTTP status
the code did not handle.

**Measured:** both `BRAVE_SEARCH_API_KEY_1` and `_2` return

```
HTTP 402  {"detail":"Usage limit exceeded","meta":{"plan":"Search",
           "current_spend":5.0,"usage_limit":5.0}}
```

**Counted from `logs/bloodhound-collect.log`**, last eight 150-lead passes:

| Pass | site=(none) | contact points | leads yielding |
|---|---:|---:|---:|
| 1 | 14 (9%) | 260 | 70 / 150 |
| 2 | 16 (11%) | 239 | 71 / 150 |
| 3 | 78 (52%) | 263 | 90 / 150 |
| 4 | 123 (82%) | 95 | 37 / 150 |
| 5 | 130 (87%) | 92 | 37 / 150 |
| 6 | 133 (89%) | 86 | 31 / 150 |
| 7 | 137 (91%) | 51 | 23 / 150 |
| 8 | **139 (93%)** | 75 | **28 / 150** |

Verify passes followed exactly: `{"event":"bloodhound_verify","leads":14}`, `11`,
`17`, and two `{"skipped":"no_pending_email_points"}`. Against 200-lead batches at
~65% conversion yesterday.

**Why it was invisible.** `youtube-email-outreach-v1/src/bloodhound/db.ts`,
`searchBrave()`:

```ts
if (res.status === 429) continue;   // rate-limited, try next key
if (!res.ok) return [];             // <- 402 lands here: no rotation, no warning
```

The file already carries a `"All Brave Search API keys exhausted or rate-limited"`
warning. It was unreachable for a spent plan, because the function returned before
the loop could exhaust. Two keys, both 402, zero log lines.

**Caveat on the causal link.** The 402 is measured and the failure rates are counted.
Joining them is inference. It is strong inference: the curves match pass for pass,
the code path that hides a 402 is explicit, and the batch widening from 40 to 150
on 09-02 (the change that produced the record) is exactly what would burn a $5
monthly cap inside two days.

**Fix 1** (`youtube-email-outreach-v1`): rotate on any key-level refusal (401, 402,
403, 429), not just 429; report the last status code in the exhaustion warning.

**Fix 2** (`youtube-outreach-orchestrator-v1`): the hourly check-in now parses the
last completed collect pass and records a `bloodhound_site_resolution_collapsed`
observation above a 70% no-site rate. Observation only, never an escalation, on the
same doctrine as the term-supply wall: the remedy is a spend decision and a `claude -p`
agent cannot make it.

---

## 3. Q2 — 32 hard walls against a door that opens at midnight PT

First hard stop `2026-09-03T13:07:38Z`, last `2026-09-04T06:51:00Z`, with one or two
in **every intervening hour**. Thirty-two total, against 13 yesterday.

The quota gate in `scripts/autopilot/campaign-loop.sh` reads
`youtube-lead-finder-v1/logs/quota-state.json`, which meters **RapidAPI** — retired
2026-08-10. It correctly returns `-1` (no signal). With no signal the loop launches,
the finder hard-walls on a dead direct-key pool, and the `hard_stop` branch sleeps a
flat `AUTOPILOT_QUOTA_WAIT` of 1800s. A daily YouTube allowance refills at midnight
Pacific and at no other moment, so all 32 attempts were guaranteed to fail. Each one
paid for a reservoir check, a keyword harvest and a discovery model call first.

Yesterday's fix (`49bd1d0`) taught the two **sweep** loops to sleep to the refill and
to write a rest marker while they do. The campaign loop never got it.

**Fix 3:** on a `quota_stop`/`hard_stop`, if a sweep rest marker is live (present and
its own `until` still in the future), sleep to that `until` instead of 1800s. This
deliberately reuses the sweeps' marker rather than adding a fourth opinion about what
"out of quota" means — the file already carries a comment noting it holds the third
copy of that read. Degrades safely: no marker, old behaviour.

**Why the pool drained six hours early.** Not a fault. The video-graph lane walked
8,509 seeds against 2,176 the day before to finish its book. That sprint does not
repeat, because the book is now empty.

---

## 4. Q3 — the seed circuit is running down

| Lane | Walked | Left | Lifetime economics |
|---|---:|---:|---|
| Video-graph sweep | 82,442 / 82,442 | **0** | 1,943 qualified for $52.47 = **2.7¢/lead** |
| Peer network | 12,529 / 12,529 | **0** | 458 qualified lifetime |
| Recommended-videos feed | 9,769 / 12,622 | 2,913 | 4,984 qualified for $40.18 = 0.8¢/lead |

The books refill from each other: a lane qualifies a score≥6 creator, that creator
becomes a seed for the next lane. That circuit has carried three weeks. It needs at
least one lane producing to sustain itself, and today only one was, with ~0.6 days
of material left.

Within about a day, self-directed finding stops and the pipeline is down to keyword
search (term-supply bound, 26 starvation notices this cycle, though a 9.0% hit rate
on a small sample — the best of any lane) and the 4,344-lead recovery backlog.

**Not fixable in code.** The three levers are all Casey's: more YouTube quota so the
surviving lane walks faster, wider niches for keyword search, or a new discovery
method. Worth flagging that the lane that just finished did so at 2.7¢ per qualified
lead, the cheapest measured rate in the pipeline's history, which argues for refilling
that book specifically.

---

## 5. Q4 — an empty book is not a stalled daemon

`peer_sweep` paged the fix-agent three times (07:30Z 09-03, 02:11Z and 07:11Z 09-04)
for a state file 8.8h and 13.8h old, costing **$2.04** — the first non-zero Anthropic
day in eight.

The state file is stale because the book is **empty**: `seeds_done` 12,529 of 12,529
seeds. A lane with no work legitimately stops writing progress. `checkin.ts` section 7
already excuses a resting quota, a recently-cleared halt, and a near-dry finder. It
had no excuse for "there is nothing left to do."

This was about to become a permanent hourly charge, because two books are now drained
rather than one, and no fix-agent can refill a seed book.

**Fix 4:** before escalating `sweep_daemon_stale`, check the lane's own progress
counter. `seeds_done >= seeds.length` records a `sweep_daemon_book_drained`
observation and continues. It reuses `sweepProgress()`, already defined a few lines
above for section 7b, so it reads the same state the progress-stall check reads.

---

## 6. Fixes shipped

| # | Repo | Change |
|---|---|---|
| 1 | `youtube-email-outreach-v1` | `searchBrave` rotates keys on any key-level refusal (401/402/403/429), not only 429, and names the status code when every key refuses. A spent plan is now one loud line, not a silent 93% failure |
| 2 | `youtube-outreach-orchestrator-v1` | Check-in reads the last collect pass and observes `bloodhound_site_resolution_collapsed` above a 70% no-site rate. Observation only |
| 3 | `youtube-outreach-orchestrator-v1` | Campaign loop sleeps to the midnight-PT refill (via the sweeps' live rest marker) instead of a flat 30 min after a quota/hard wall |
| 4 | `youtube-outreach-orchestrator-v1` | A lane whose seed book is fully walked is observed as drained, not escalated as a stalled daemon |

All four verified to parse and load before commit. Nothing was stopped; no halt flag
written; the loop was left running.

---

## 7. Recommended next — ranked

1. **Raise the Brave Search cap, or add keys.** Both keys stopped at $5 for the
   month. That single ceiling is the difference between 627 and 71. Cheapest lever on
   the board, and it unblocks the pipeline's biggest producer with 4,344 leads still
   in its backlog. The fix makes the failure loud; loud is not working.
2. **Decide how the seed books refill.** Two of three empty, third at ~0.6 days. More
   YouTube quota, wider niches, or a new discovery method. The video-graph book is the
   one worth refilling first at 2.7¢/lead.
3. **Add YouTube keys.** Allowance gone six hours into the cycle. Quota has been the
   binding constraint on finding for three days. Fix 3 stops the waste; it creates no
   quota.
4. **Top up OpenRouter within the week.** $193.76. The 6.6-day reading is flattered by
   17 dark hours; a working day puts it near 3. Everything bills this account — an
   empty balance stopped the whole pipeline on 08-25.
5. **Enrichment needs nothing.** 4,629 of 4,734 parked leads have their research file;
   only 105 outstanding, down from 279. The queue cleared itself.

---

**Status caveat:** everything is *parked*, nothing sent. `approved_hold` holds until
`npm run send` is run by hand.
