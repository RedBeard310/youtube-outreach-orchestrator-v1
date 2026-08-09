# Lead Run Debrief — 2026-08-09 (analysis companion)

**Headline: yesterday's reject cache worked on the first day and gave the loop back 6 hours. Session startup fell 74 min → 21 min, the day ran 120 finder passes instead of 87, and parking rose to +93. The reclaimed time also made the next problem obvious: 14 keyword harvests were offered 58,746 candidate phrases and kept 15.**

Cycle window: 2026-08-08 07:00Z → 2026-08-09 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-09.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+93** | pool 4,173 → 4,266 (was +70 on 08-08, +32 on 08-07) |
| `needs_contact` pool | **5,221** | +181 this cycle, still the larger lane |
| **Total parked, 0 sent** | **9,487** | 4,266 + 5,221 |
| Discovered | 1,080 | vs 771 yesterday |
| Pitchable (score ≥ 6) | **294** | 27.2% of discoveries, vs 31.9% yesterday |
| Of those pitchable | 93 → `approved_hold`, 180 → `needs_contact` | **34% verify rate**, in the usual band |
| Currently at `email_verified` | 37 | still moving through the lane at snapshot time |
| `scoring_failed` | **0** | rate 0.0%, fourth clean day |
| Net-new channels written | 1,128 | across 123 productive passes = **9.2/pass** |
| Campaign sessions | 14 / 14 done | vs 9 yesterday, and each one shorter |
| Finder passes | **120** | up from 87. Fresh-pitchable sum 288 = 2.40/pass |
| New leads written | **1,046** | up from 757 |
| Fades / discovers / promotes | 119 / 133 / 117 | |
| **Hard stops** | **0** | second clean day |
| Time-budget stops | **14 of 14** | every session ran out the clock, none ran out of work |
| Quota stops / crashes | 0 / 0 | |
| `term_starvation` observations | **0** | |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 10th straight cycle |

## Per session

From `start` / `reservoir` / `time_budget_stop` / `done` events in
`logs/campaign-2026-08-0{8,9}.jsonl`. "Wall" is real elapsed time from `start` to `done`;
"loop clock" is what the campaign's own 90-minute budget measured. The gap between the two
is the pre-flight harvest, which runs before the clock starts.

| Session closed (UTC) | Reservoir at open | Passes | Wall | Loop clock | Parked |
|---|---|---|---|---|---|
| 08-08 09:24 | STOCK-UP | 7 | 103 min | 83 min | 7 |
| 08-08 11:07 | STOCK-UP | 11 | 102 min | 87 min | 5 |
| 08-08 12:42 | STOCK-UP | 8 | 95 min | 78 min | 12 |
| 08-08 14:26 | STOCK-UP | 9 | 103 min | 87 min | 5 |
| 08-08 16:09 | STOCK-UP | 9 | 103 min | 87 min | 8 |
| 08-08 18:02 | STOCK-UP | 11 | 113 min | 89 min | 5 |
| 08-08 19:40 | STOCK-UP | 11 | 98 min | 82 min | 7 |
| 08-08 21:19 | STOCK-UP | 8 | 98 min | 86 min | 12 |
| 08-08 23:03 | STOCK-UP | 8 | 103 min | 92 min | 10 |
| 08-09 00:33 | STOCK-UP | 7 | 91 min | 78 min | 5 |
| 08-09 02:17 | STOCK-UP | 9 | 104 min | 92 min | 2 |
| 08-09 03:58 | STOCK-UP | 7 | 100 min | 89 min | 11 |
| 08-09 05:32 | STOCK-UP | 6 | 94 min | 83 min | 4 |
| 08-09 07:07 (spans the boundary) | STOCK-UP | 9 in-window | — | — | counted next cycle |
| **Sum** | | **120** | | | **93** |

Compare the wall column with yesterday's: 08-08's nine sessions ran 147 to 168 minutes each
for the same 90-minute loop clock. Today they run 91 to 113. Nothing about the budget
changed. The pre-flight got short.

## Q1 — did the reject cache pay off

Yes, and the measurement is unusually clean because nothing else changed.

The fix (`youtube-lead-finder-v1@fd9773a`, shipped 08-08 07:28Z) makes the keyword
prefilter remember the terms it rejected, so autocomplete can't keep re-offering them as
new. Day one, across 14 harvests:

| | 08-08 | 08-09 |
|---|---|---|
| Candidates offered | 38,869 | **58,746** |
| Skipped from cache | 0 | **54,129 (92.1%)** |
| Sent to a model | 38,869 | **4,617** |
| Startup per session (start → first pass) | 74 min avg | **21 min avg** |
| Startup, cycle total | 668 min (9 sessions) | **301 min (14 sessions)** |
| Finder passes | 87 | **120** |
| Passes per hour of session time | 3.47 | **5.10** |
| New leads written | 757 | **1,046** |
| Parked | +70 | **+93** |

The finder did not get better today. It got more of the day. Per-pass yield actually eased
slightly (fresh pitchable 2.77/pass → 2.40/pass, pitchable rate 31.9% → 27.2%), which is
what you'd expect from running further down the same term pool. The volume gain came from
pass count, not pass quality.

Cache lines in the session logs, one per harvest, e.g.
`[prefilter] skipped 4611/4674 already-rejected term(s) from cache — 63 to classify.`

## Q2 — why parking is still only +93

Email, unchanged. Of 294 pitchable, **93 verified into `approved_hold` and 180 swept to
`needs_contact`**, a 34% verify rate that sits in the same band as every recent cycle.
Doubling intake doubles both piles.

`needs_contact` is now **5,221** and grew by 181 against the parked pool's 93. Combined:
**9,487 creators found, scored, and never contacted.**

One thing genuinely improved: **niche concentration eased.** Top three niches supplied 37%
of pitchable, down from 49% yesterday, and no single niche dominated.

| Niche | Pitchable |
|---|---|
| Real Estate & Property | 43 |
| Coaching & Consulting | 34 |
| Financial Planning & Investing | 33 |
| Health & Wellness Clinics | 32 |
| Legal Services | 27 |
| Transformation & Performance Coaching | 25 |
| Business Growth Coaching | 25 |
| Marketing & Growth Agencies | 21 |
| Other / 12 smaller niches | 54 |

## Q3 — what the reclaimed time revealed

**The autocomplete source is mined out against the current 42 seeds, and the loop had no
way to notice.** With the re-judging removed, what's left is an honest reading of how much
new material the source still holds:

- 14 harvests wrote **15 usable terms total** (`prefilter kept` per run: 5, 4, 2, 1, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 0).
- **7 of 14 wrote nothing at all** (`[harvest] nothing to write.`).
- Even among the 4,617 genuinely unjudged phrases, the keep rate was **0.32%**.

**And the gate that fires the harvest cannot be satisfied.** All 14 sessions opened with
the same reservoir verdict:

```
{ "verdict": "STOCK-UP", "target_runs": 6, "fresh": 0,
  "capacity_runs": 0, "need_fresh": 48, "short_by": 48, "proven_repeaters": 0 }
```

`STOCK-UP` force-harvests at a one-hour floor, deliberately overriding the normal four-hour
cadence (the 2026-07-17 term-starvation stall is why that override exists). The one or two
terms a harvest writes are consumed within a few passes, so the next pre-flight reads
`fresh: 0` again and fires another. Fourteen sessions, fourteen forced harvests, fifteen
terms, about five hours of the cycle.

**Term supply itself is fine, which is what makes this pure waste.** The other two legs
carried the pool: the 08-07 proven-term revive fired **31 times**
(`[starvation] active pool exhausted ... reactivated N proven terms`) and LLM discovery ran
133 times with 117 promotions. Result: **0 hard stops, 0 quota stops, 0 starvation
observations**, and `pool_size` visibly rebuilding inside every session (a typical session
climbs from 2 to 25 active terms).

## Self-improvement shipped

**`youtube-outreach-orchestrator-v1@44233a0` — low-yield backoff for the keyword harvest.**

The campaign now reads how many probes a harvest actually wrote (parsing
`[harvest] done. N probes written` / `[harvest] nothing to write.`) and keeps the last 20
samples in `logs/keyword-harvest-yield-state.json`. When the last three harvests each wrote
fewer than three probes and the newest is under six hours old, the harvest is skipped and
logged as `keyword_harvest { skipped: true, reason: "low_yield_backoff" }`.

Design notes, in the same shape as the existing autocomplete-block guard directly above it:

- **The check sits before the cadence gate**, because the `STOCK-UP` pre-flight overrides
  that gate down to one hour, and that pre-flight is the exact caller that was force-firing
  an exhausted source every session.
- **Self-clearing.** After the six-hour window one harvest always runs, and a single yield
  of three or more clears the streak and restores normal cadence. This matters: harvest
  yield is not permanently dead. Editing `skills/keyword-icp-prefilter.md` or repointing
  `models.json` invalidates the reject-cache fingerprint and makes everything judgeable
  again, and new seeds do the same.
- **Fail-open on supply.** A harvest whose output can't be parsed (crash, changed output)
  records no sample at all, so it neither starts nor extends a streak. The worst case of an
  unreadable harvest is today's behaviour, never a silently disabled one.
- **Escape hatch** `HARVEST_LOW_YIELD_BACKOFF_HOURS=0`; thresholds tunable via
  `HARVEST_LOW_YIELD_SAMPLES` (3) and `HARVEST_LOW_YIELD_MIN_PROBES` (3).
- The harvest call moved from `runChild` to `runChildCapture`, which tees to the terminal,
  so session logs stay byte-identical.

**Verified before commit:** `tsc --noEmit` clean; 14 behaviour checks green (streak fires,
window expiry releases, a good yield clears the streak including mid-streak, cold start
runs, fewer-than-N samples runs, disable switch, fail-open on unparseable output, boundary
at exactly `minProbes`); and the parser was run against the real harvest text extracted
from two live 08-09 session logs and read both correctly. No API calls, so $0.

**Deliberately not shipped:** new autocomplete seeds. That is the real supply-side answer
to Q3, but choosing which niches to seed is a targeting decision, not a plumbing one, and
inventing 20 seeds unattended would push the frontier wherever a model felt like at 07:00Z.
It belongs in `expertise-based-niche-taxonomy.md` with Casey's eye on it.

## Watch tomorrow

- The backoff should cut harvests from ~14 to ~4, with
  `keyword harvest skipped — last 3 harvests each wrote < 3 probes` in the session logs.
- Startup should fall from 21 minutes toward a few, and passes should clear 140.
- Watch that per-pass pitchable doesn't keep sliding (2.77 → 2.40). If more passes over the
  same terms just mines them out faster, the seed problem gets urgent rather than merely
  wasteful.

## Priority

1. **Decide the send outlet for `approved_hold`** (4,266 prepped, 0 sent). Still the only
   item needing a decision rather than code.
2. **Build the `needs_contact` recovery engine** (5,221, growing at twice the parked rate).
3. **Feed the harvest new seeds.** Today's fix stops the waste; it does not restore supply.
4. **Confirm the backoff fires and the time converts into passes.**
5. **Meter OpenRouter spend.** Two days of fixes cut the largest unmetered consumer by ~99%,
   which makes now a good moment to start counting.
