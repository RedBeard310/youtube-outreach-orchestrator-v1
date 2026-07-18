# Lead Run — 2026-07-18 — Technical Analysis

**Cycle:** 2026-07-17T07:00:00Z → 2026-07-18T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** Day 2 of the autocomplete IP-block. It never lifted, so the term engine stayed dry and this became the **lowest-volume day of the run** (22 fresh pitchable across 47 passes, 0.47/pass). The headline isn't the low number — it's that **yesterday's two self-healing fixes worked exactly as designed under a real sustained fault**: the day's autocomplete 403s collapsed from **22,105 → ~90**, Claude spend stayed **$0**, and nothing crashed. A persistent infra fault, absorbed gracefully. The unblock remains an infra call (rotate egress IP / proxy).

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **+51** | net cycle gain (`done_parked_gain_sum` = 51) |
| `approved_hold` pool | 2,346 → **2,397** | net **+51** — lowest daily gain of the run |
| Pitchable found (score ≥6 + host) | **108** | of 685 discovered |
| Finder-reported fresh pitchable (sum) | **22** | per-pass tally across 47 passes = **0.47/pass** (07-17 ≈ 1.09, 07-16 ≈ 1.74, 07-15 ≈ 1.32). **Lowest raw total AND lowest per-pass of the run.** |
| Verified email (of pitchable) | **49 (~45%)** | verify held on trend (07-17 ~47%, week band 42–47%) — the loss was upstream in *finding* |
| Swept → `needs_contact` (this cycle) | **49** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **3,208** | up ~52 on the cycle (3,156 → 3,208) |
| Total channels discovered | **685** | 446 below-threshold, 111 unreviewed, 30 demo-niche-excluded, 49 needs_contact, 49 approved_hold |
| Finder passes | **47** | **37 zero-yield (79%)**; 10 weak (1–11); **0 healthy (≥12)** — tallest pass all day was **5** |
| Sessions started / done | 20 / 19 | **19 hard-stops**, 0 time-budget-stops, **0 quota-stops** |
| Discovery fades / discovers / promotes | 28 / 47 / 36 | verify+promote lane kept draining the trickle |
| Keyword harvest (campaign) | **14 fired / 55 skipped** (69 attempts) | and the 14 that fired hit the 403 wall — stocked ~nothing (**not yet block-aware — fixed today**) |
| Reservoir verdicts | **20 STOCK-UP / 0 GO** | chronic measured supply shortage, all cycle |
| Autocomplete `AUTOCOMPLETE_ENDPOINT_BLOCKED` markers | **10** | finder circuit breaker tripped 10× |
| **Autocomplete HTTP 403s** | **~90** | vs **22,105** on 07-17 — the breaker caps each harvest at ~8 before bailing |
| Check-in `autocomplete_blocked` observations | **6** | + 14 `term_starvation` — correctly diagnosed, correctly skipped the harvest kick |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable: Financial Planning & Investing **35** · Real Estate & Property **15** · Coaching & Consulting **14** · Health & Wellness Clinics **9** · Business-Growth Coaching **6** · Relocation & Lifestyle 5 · Legal 4 · SaaS 4 · Other 4 · AI Automation 3 · Tax & Accounting 3 · Sales Training 2 · Marketing 1 · Coding 1 · Practice-Growth 1 · Wealth 1. **Financial Planning + RE + Coaching = 64/108 (59%)**; Financial Planning alone is 32% — a starved pool serving its residual, already-mined high-value terms rather than fresh veins.

---

## Primary finding — same block, one day deeper, absorbed cleanly

The 07-17 debrief isolated the cause: Google's public suggest endpoint (`suggestqueries.google.com/complete/search`) — the finder's only working term-refuel — **IP-blocked the VPS egress with sustained HTTP 403s**. This cycle it **stayed blocked**. That is the expected shape of an IP-reputation block: it does not self-heal on our side; it clears when the egress IP moves (or after the block operator ages it out).

With the refuel dead, the term pool could not grow, and the funnel repeats 07-17 one notch lower:

- Reservoir read `STOCK-UP` on **all 20** sessions; the finder aborted "No active terms" and **19 of 20 sessions hard-stopped** on the term wall.
- **47 passes, 22 fresh pitchable, 37 dead zeros, 0 healthy passes**, tallest pass 5.
- Yield fell **below** 07-17 (0.47 vs 1.09/pass) — each additional block-day drains the residual already-active terms a little further, with nothing entering to replace them.

**The loss was 100% upstream in *finding*.** Verify held ~45% (49/108), on trend. Nothing downstream broke.

---

## Why this degraded gracefully instead of thrashing

This is the important half. On 07-17 the same block produced 22,105 wasted 403s, mislabelled "drought", with the starvation backstop actively *feeding* the block. This cycle, the two fixes shipped that day did their job:

1. **Finder circuit breaker held (`68f1896`).** The autocomplete adapter bails after 8 consecutive 403s and the harvest emits `AUTOCOMPLETE_ENDPOINT_BLOCKED` and stops the seed loop. It fired **10×**. Effect: the day's total 403s were **~90, not ~22,000** — the breaker turns a ~287-request-per-seed grind into an ~8-request early exit. ~99.6% of the wasted request volume eliminated.

2. **Check-in detection held (`8d53f3f`).** The hourly check-in recognised the block (via the marker / dense-403 signal in recent session logs), logged **6** free `autocomplete_blocked` observations, and **skipped the futile/counterproductive harvest kick** every time. No `claude -p` fix-agent was spent on an infra fault it can't fix. Autopilot spend: **$0.00**.

Result: a low day, but a *calm* one — 0 fatal signatures, 0 quota stops, 0 crashes, $0 spend. The pipeline rested against an unfixable wall instead of grinding into it.

---

## The one gap that remained — and today's fix

There were **two** places that fire a keyword harvest, and only one was block-aware:

- **Component B, the hourly check-in** — skipped correctly (above).
- **Component A, the always-on campaign loop** (`src/drivers/campaign.ts` → `harvestKeywords`, called at the STOCK-UP pre-flight, on fade, and end-of-loop) — **was NOT block-aware.** It fired the harvest **14×** into the live block this cycle. The only existing mitigation was a blunt "floor the starved cadence at 1h" (campaign.ts comment lines 277–283), which still storms a multi-day block ~24×/day.

Each of those 14 harvests was capped at ~8 requests by the finder breaker, so the damage was bounded — but it still hammered a blocked endpoint on every session, exactly the behavior the breaker and check-in were built to stop, and exactly the thing that risks deepening the block.

### Fix shipped — `youtube-outreach-orchestrator-v1` `4f3a282`

Gave the campaign the **same block-detector the check-in uses**. `harvestKeywords` now checks `autocompleteBlocked()` (scans the 1–2 newest session logs for the `AUTOCOMPLETE_ENDPOINT_BLOCKED` marker or a dense run of `failed: HTTP 403`) *before* running a harvest. When a live block is present it **skips and logs** `{ event: 'keyword_harvest', skipped: true, reason: 'autocomplete_blocked' }` instead of firing. Because it reads only the newest logs, it is **self-clearing**: the first clean session after the block lifts reads as unblocked and harvesting resumes automatically. Components A and B now agree.

Verified before commit: `tsc --noEmit` clean on the file; `npm run campaign:dry` loads and runs the module end-to-end (exit 0); the detector returns `true` against the current live session logs (marker present) — i.e. it correctly identifies the block that's happening right now. This is the precise replacement for the blunt 1h floor: skip while blocked, resume when clear.

---

## Shape of the day

47 finder passes, near-flat: `[0,0,5,0,1,0,0,0,0,2,0,0,0,0,0,0,0,0,0,2,0,0,0,0,2,0,1,0,0,3,1,4,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0]`. 37 dead zeros, 10 weak (max 5), **0 healthy**. No stall-then-recovery inflection like 07-14/07-15 — there was no refill event to recover on, because the endpoint that produces refills was blocked the entire cycle.

---

## Constraints (updated)

1. **The term engine is IP-blocked (day 2) — the single binding throttle.** Not code-fixable. Everything else is healthy and idle behind it.
2. **Discovery is a single point of failure.** One free, blockable endpoint feeds the whole term engine. A second source (lever #2) converts "halt" into "degrade".
3. **`needs_contact` = 3,208** and immune to the block — the biggest lever that needs zero finding. Still deferred.
4. Verify (~45%) is healthy and is *not* the constraint on a block day — it's starved of input, not underperforming.

---

## Ranked next levers

1. **Rotate the VPS egress IP / proxy the autocomplete calls (operator, infra).** The only action that lifts the cap; clears the 403 with zero code changes. #1 lever two days running.
2. **Second independent term source** (DataForSEO / Google Ads API). Removes the single-point-of-failure so a future block degrades supply instead of halting it.
3. **The `needs_contact` recovery engine** (3,208). Needs no finding → fully immune to the term block; would have carried volume straight through both block days. Awaiting greenlight.
4. **Watch the new campaign block-skip next cycle** — confirm it stops firing into the block and resumes cleanly the first session after it lifts (the self-clearing half is the part worth production-verifying).

---

## Changes shipped this cycle

- `youtube-outreach-orchestrator-v1` `4f3a282` — campaign `harvestKeywords` skips a live autocomplete IP-block (block-aware, self-clearing), aligning the always-on loop with the check-in; replaces the blunt 1h-floor mitigation. Verified: typecheck clean, dry-run loads, detector fires on live logs.

Carried forward and validated in production this cycle (shipped 07-17): finder circuit breaker `68f1896` (403s 22,105 → ~90) and check-in block detection `8d53f3f` ($0, 6 skips).
