# Lead Run Debrief — 2026-08-04 (analysis companion)

**Headline: the fifth clean, boring day in a row — +105 parked, $0 Anthropic, nothing broke, and the only story is still the outlet gap.**

Cycle window: 2026-08-03 07:00Z → 2026-08-04 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-04.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+105** | pool 3,781 → 3,886 |
| Swept → `needs_contact` | +71 | pool → 4,499 |
| **Total parked, 0 sent** | **8,385** | 3,886 + 4,499 |
| Pitchable (score ≥6) | 184 | of 817 net-new discovered |
| Net-new channels written | 749 | across 114 productive passes |
| Email-verified | 65 | **35% verify rate** (down from 58% / 64%) |
| Campaign sessions | 16 / 16 done | all ended on 90-min time budget |
| Finder passes | 116 | fresh-pitchable sum 182 (~1.57/pass), peak 9, 47 zeros |
| Fades / discovers / promotes | 116 / 117 / 105 | discovery loop fires every pass |
| Hard stops / quota stops / crashes | 0 / 0 / 0 | — |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 5th straight cycle |

Pitchable by niche: Real Estate 53, Health & Wellness Clinics 49, Legal 26,
Coaching 18, Financial Planning 11, Other 7, Tax 5, then a long thin tail.
**Top 3 = 70% of pitchable; top 5 = 85%** — the same three-niche concentration
as the rest of the week.

## The three questions

**Q1 — Did anything break? No.** 16 sessions clean, 0 hard/quota stops, 0 crashes,
no fix-agent page, no halt flag. Supply health green: 749 net-new channels written,
`fresh_finding_dead=false`, autocomplete **not blocked**, **zero** term-starvation
observations. The only real finding was small: the OpenRouter prefilter
(`qwen3.7-flash`) hit a transient **HTTP 429** three times and each time the
fail-closed handler **silently dropped a 100-term batch** — ~300 candidate keywords
discarded on a supply-constrained day. Fixed this cycle.

**Q2 — Why did verify fall to 35%?** Niche mix, not a regression. Pitchable were
70% Real Estate + Health-clinic + Legal; solo realtors and clinic channels verify
weakest (personal Gmail / contact-form-only), while the firm-heavy verticals that
lift the rate (Financial, Tax) were a smaller slice than on 08-03. The verify lane
ran clean (ZeroBounce healthy, overlapped every pass). Day-to-day verify swings
±25pts on which veins discovery catches — 35% is back inside July's 38–47% band.
Variance, not a defect.

**Q3 — So what's the story?** The **outlet gap**, fifth day running. Intake is fine;
nothing leaves. `approved_hold` 3,886 + `needs_contact` 4,499 = **8,385 parked, 0
sent**. approved_hold has more than doubled since 07-10 (1,664 → 3,886). Parking is
also decelerating off the 08-01 block-break spike — **+404 → +185 → +162 → +105** —
which is just the frontier thinning back to its steady ~1.6 pitchable/pass trickle,
not a fault. The lever isn't "find harder"; it's the two things that convert the
8,385 already in hand.

## Self-improvement shipped

**`youtube-lead-finder-v1` — prefilter now retries a rate-limited batch on the
fallback model instead of dropping it.** (`src/discovery/external/icp-prefilter.ts`
+ `src/llm/models.ts`, commit `a374c48`.)

- **Defect:** a transient OpenRouter 429 (`qwen3.7-flash` "temporarily
  rate-limited") that outlives the client's 4 internal retries reached the
  prefilter's `catch`, which fail-closed-drops the whole 100-term batch. Fail-closed
  is correct for a *malformed* reply (never leak un-judged noise into probes — a
  malformed reply returns partial verdicts and does **not** throw), but wrong for a
  *transport* failure: those terms were never judged, and on a supply-limited day
  dropping them is lost yield (3 bursts = ~300 terms on 2026-08-04).
- **Fix:** `classifyBatch` now retries the batch once on the sanctioned built-in
  fallback model (`deepseek-v3.2` — a different OpenRouter route that doesn't share
  qwen's rate-limit window) before falling closed. A new `resolveTaskFallbackModel`
  in the model registry exposes the existing `FALLBACK` map and returns `undefined`
  when it would equal the primary (so discovery, whose primary already *is*
  deepseek-v3.2, gets no redundant retry).
- **Why safe:** deepseek-v3.2 is already the registry's sanctioned prefilter
  fallback; the extra call only fires on a real primary failure; model choice stays
  in `models.json` (config-as-code). `tsc` clean; fallback resolution runtime-verified
  (prefilter primary = qwen3.7-flash, fallback = deepseek-v3.2; discovery fallback =
  undefined). No live skill-eval run — it would spend OpenRouter credits and the
  change is logic-verified.

This is the same resilience pattern as the 08-01 RapidAPI backoff and the 08-02
429-false-pause guard: a transient rate-limit is a wait-and-retry signal, never a
real signal to act on.

## Ranked next levers

1. **Build the `needs_contact` recovery engine** (4,499 — dwarfs a day of finding;
   has out-capped finding for two weeks). Deferred by Casey.
2. **Decide the send outlet for `approved_hold`** (3,886 prepped, 0 sent). A
   decision, not a build.
3. **Broaden the frontier** against the 70% three-niche concentration (new verticals
   or the parked comment-scraping source) — raises volume *and* verify rate.
4. **Meter OpenRouter spend as first-class cost** — the burn ledger is Anthropic-only,
   so `total_usd:0` hides real pipeline LLM behavior (today's 300-term 429 drop is a
   reminder that side has cost and failure modes worth watching).
