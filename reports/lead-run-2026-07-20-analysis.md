# Lead Run — 2026-07-20 — Technical Analysis

**Cycle:** 2026-07-19T07:00:00Z → 2026-07-20T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** Day 4 of the autocomplete IP-block — the harvest refuel was still dead — yet parked volume **rose again to +151 (vs +129 on 07-19), the best day since the block began**. The recovery ran, as on 07-19, entirely through the **second discovery lane** (LLM-invented frontier probes mined in-session), pivoting into Real Estate (159) + Health clinics (61) = 75% of pitchable. The block is a **degrade, not a halt**. $0 spend, 0 crashes, 0 quota stops. **The distinct finding of the day:** the campaign's block-aware harvest guard was **oscillating** — re-storming the blocked endpoint 18× because a correct *skip* erases the block evidence it reads. One durable self-healing fix shipped to the orchestrator to close it.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **+151** | net cycle gain (`done_parked_gain_sum` = 151, `parked_today` = 151); **best day since the block began** (07-19 +129, 07-18 +51) |
| `approved_hold` pool | 2,526 → **2,677** | net **+151** |
| Pitchable found (score ≥6 + host) | **294** | of 967 discovered — up 17% on 07-19 (252) |
| Verified email (of pitchable) | **151 (~51%)** | 151 verified + 137 swept to `needs_contact` ≈ 288 of 294 pitchable resolved; verify holds the week band |
| Swept → `needs_contact` (this cycle) | **137** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **3,469** | up +137 on the cycle (3,332 → 3,469) |
| Total channels discovered | **967** | 501 below-threshold, 142 unreviewed, 36 demo-niche-excluded, 137 needs_contact, 151 approved_hold |
| Finder-reported fresh pitchable (sum) | **10** | across 63 runs = 0.16/pass — **undercounts DB yield ~29×** (DB truth 294; see Q3). Even more decorrelated than 07-19 (45 vs 252) because more sessions instant-hard-walled without emitting the counter |
| Finder runs | **63** | most exited nonzero (abort on "No active terms") or exit-0 with 0 fresh; only ~6 sessions logged any exit-0 pass |
| Sessions started / done | 35 / 35 | **35 hard-stops (100%)**, 0 time-budget-stops, **0 quota-stops** |
| Discovery fades / discovers / promotes | 28 / 63 / 36 | the LLM discover lane carried the day, as on 07-19 |
| `evaluate_probes` runs | 13 | **promoted 0 winners** (4th straight cycle — all probes below the promote bar) |
| Keyword harvest (campaign) | **18 fired / 45 skipped** (`autocomplete_blocked`) | the 18 that fired stocked ~nothing (prefilter kept 0/853); **fired at all only because the guard oscillates** — see Q2 |
| Reservoir verdicts | **35 STOCK-UP / 0 GO** | chronic measured supply shortage, all cycle |
| Autocomplete block | live | `AUTOCOMPLETE_ENDPOINT_BLOCKED` marker in session logs; each futile harvest hits ~8 HTTP 403s before the finder circuit breaker bails |
| YouTube direct keys | **0 available** | all exhausted/blocked; verify runs on RapidAPI fallback (per VPS-migration latent item) |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **`finder_hard_wall`** | fired but **benign** — no fix-agent paged (the `086affb` term-supply no-page rule held) |

Per-niche pitchable: Real Estate & Property **159** · Health & Wellness Clinics **61** · Coaching & Consulting **25** · Relocation & Lifestyle **15** · Financial Planning & Investing **9** · Business-Growth Coaching **8** · Legal **7** · AI Automation & Agents **3** · SaaS **2** · Practice-Growth Coaching **2** · Other **1** · No-Code **1** · Sales Training **1**. **RE + Health clinics = 220/294 (75%)** — the same routing-around signature as 07-19 (80%).

---

## Primary finding — Day 4, and the pipeline is still routing around the block

The 07-17 debrief isolated the cause: Google's public suggest endpoint (`suggestqueries.google.com/complete/search`) — the finder's **harvest**-based term refuel — IP-blocked the VPS egress with sustained HTTP 403s. It has now held for **four cycles**. This cycle: reservoir read **STOCK-UP on all 35 sessions**, and **35/35 sessions hard-stopped** on the term wall.

**And yet the cycle rose to +151 — a fresh post-block high.** The mechanism is unchanged from 07-19: the harvest is only one of two refuel lanes, and the finder's **LLM frontier-discovery** path (`discover-veins.ts`) is fully independent of the blocked endpoint. It invents `probe:<date>` veins the finder mines the same session, and it pivoted into Real Estate + health-clinic veins that converted — 294 pitchable, 151 parked.

`discovered_today` is grounded on `first_discovered_at ≥ cycleStart`, so the 967/294/151 are **genuinely newly-discovered** leads this cycle, not a drained backlog. The recovery is real finding. The structural proof from 07-19 holds a day longer: **a multi-day infra block on the harvest endpoint is survivable — it degrades supply rather than halting it — as long as the LLM discovery lane keeps producing.**

The one place the block still costs us is the topic of Q2.

---

## Q2 (the day's distinct finding) — the block-aware harvest guard oscillates

Since 07-18 the always-on campaign loop has a block-aware guard (`4f3a282`): before harvesting it calls `autocompleteBlocked()`, which scans the **1–2 newest session logs** for the finder's `AUTOCOMPLETE_ENDPOINT_BLOCKED` marker (or ≥50 `failed: HTTP 403` lines) and skips the harvest if present. The intent is "skip while blocked, resume the first clean session after it lifts (self-clearing)."

**The bug: the self-clearing signal is also self-*erasing*.** The only session logs that contain a 403 marker are the ones that **actually harvested**. A session that *correctly skips* logs a clean `keyword harvest skipped — autocomplete_blocked` line with **no** 403 marker. So the sequence is:

1. Session A harvests → hits the 403 wall → writes the marker to log A.
2. Session B reads `[B(empty), A(marker)]` → detects block → **skips** (clean log B).
3. Session C reads `[C(empty), B(clean skip)]` → **no marker in the window** → concludes "not blocked" → **harvests again** → 403 → writes the marker → back to step 1.

Verified directly against the live logs: session `…185947Z` (a correct skip) contains **0** `AUTOCOMPLETE_ENDPOINT_BLOCKED` and **0** `failed: HTTP 403`; the very next session `…193143Z` then harvested and hit the block afresh. Across the cycle this oscillation ran the harvest **18×** into a known-blocked endpoint (vs 45 correct skips). Each futile run fires **~853 autocomplete requests** at the blocked IP (deepening the block / IP-reputation damage) **and** a wasted **Haiku ICP-prefilter of 853 poisoned tails that keeps 0**. The prior two debriefs noted the symptom ("16 fired / 47 skipped" on 07-19) but not the root cause.

**Fix shipped this cycle** (see below): a persisted block-state stamp with a backoff window, so a run of correct skips can no longer re-open the endpoint.

---

## Q3 — telemetry undercount (now ~29×) and discovery still doesn't compound

Two carried-forward issues, both worse or unchanged today:

- **Per-pass `fresh_pitchable` undercounts DB yield ~29×.** The campaign logged **10** fresh pitchable across 63 runs; Airtable recorded **294**. The ratio blew out from 07-19's ~5.6× because more sessions this cycle **instant-hard-walled** (exit-1 on run 1, before the counter is emitted). Read literally, the counter says "dead day"; the ledger says "best day since the block." This debrief's shape-of-day therefore uses **net parked-gain per session**, which tracks the real +151. Reporting-debt only — it isn't gating any decision — but it is why the `finder_hard_wall` dashboard signature looks catastrophic against a healthy funnel.
- **`evaluate-probes` promoted 0 winners for a 4th straight cycle.** Every invented vein converts below the promote bar, so validated ground is never kept — the finder re-invents veins nightly instead of accumulating a compounding proven-term base. With the harvest 4 days dead, this is the structural cap on the LLM lane. It's a business-logic tuning call (the `PROBE_PROMOTE_RATE` bar), so it was **not** changed here — it's lever #2.

---

## Change shipped this cycle

**Orchestrator `1d5d1f9` — persisted autocomplete-block backoff (fixes the Q2 oscillation).** `src/drivers/campaign.ts`:

- New `logs/autocomplete-block-state.json` stamp (`markAutocompleteBlocked()`), written whenever a live 403 marker is observed (inside `autocompleteBlocked()`, and belt-and-suspenders right after a harvest run).
- New `blockedRecently()`: returns true if the stamp is within `AUTOCOMPLETE_BLOCK_BACKOFF_HOURS` (default **6**). `autocompleteBlocked()` now falls back to it when the newest logs hold no fresh marker — so a run of correct skips carries the block forward instead of erasing it.
- Still self-clearing: after the backoff window with no fresh marker, the next session probes once; if still blocked the probe re-stamps, if clear the harvest succeeds and normal cadence resumes. Env-tunable; set to 0 to disable.

**Expected effect:** futile harvests drop from ~18/cycle to ~1 probe per 6h window (≈4/day at most) — cutting the wasted Haiku prefilter spend and the endpoint-storming that may be prolonging the block itself. Verified: `npm run typecheck` clean; the backoff date-math + JSON round-trip unit-checked (fresh stamp → blocked; 7h-old stamp → self-clears; garbage/missing → fail-open safe).

Nothing else was changed — the two open structural items (promote bar, telemetry) are tuning/reporting calls left for Casey, per "no invented churn."

---

## Shape of the day

Bars = net parked-gain per session (35 sessions). No "big find pass": a steady drip punctuated by verify-lane flushes (31 / 21 / 19 / 16) as verify drains batches from the pitchable pool. 16 sessions parked 0 (finder hard-walled with nothing verified-ready that window); the rest trickled 1–8. Every session's reservoir was STOCK-UP; every session hard-walled. The output signal (parking cadence) is decoupled from the finder's per-pass state, which is why the day reads healthy on parked-gain and dead on `fresh_pitchable`.

---

## Constraints (updated)

- **Binding throttle: durable term supply.** The compounding source (autocomplete harvest) is 4 days IP-blocked; the LLM frontier lane is doing all the finding but doesn't compound (0 promotes ×4). Fresh-term supply is the ceiling, exactly as since 07-13 — now with the harvest specifically offline.
- **Verify (~51%) is healthy** and not the constraint; it runs on the RapidAPI fallback since the direct YouTube keys are all exhausted (`0 available`).
- **Cost + safety green:** $0 Claude spend, 0 quota stops, 0 crashes, git clean, no halt flag. `finder_hard_wall` fires but is correctly benign.
- **`needs_contact` = 3,469** and growing ~130/day — the largest untapped asset, still unbuilt.

---

## Ranked next levers

1. **Rotate the VPS egress IP / add a proxy (infra — #1, 4 days running).** The only compounding term source stays dead until this lifts. Everything else is coping.
2. **Make discovery compound — lower / make cumulative the `evaluate-probes` promote bar.** 0 winners ×4 cycles → the finder re-invents ground nightly. Let good probes graduate so the proven-term base grows even while the harvest is blocked.
3. **Second independent term source (DataForSEO).** Removes the single-free-endpoint-on-one-IP fragility the harvest guard is only dodging.
4. **The `needs_contact` recovery engine (biggest unbuilt lever).** 3,469 found-and-scored, no-email creators; recovering a fraction dwarfs a day of fresh finding and sidesteps the term ceiling. Awaiting greenlight.
5. **Reconcile the `fresh_pitchable` telemetry (low value)** so the per-pass counter and the dashboard stop reading catastrophic against a healthy funnel.

---

## Carried forward and validated in production this cycle

- **The 07-18 campaign block-skip works — but had a hole (now closed).** It correctly skipped 45 harvests; the oscillation that let 18 through is fixed by this cycle's backoff.
- **The `086affb` benign-hard-wall no-page rule held:** 35 hard-walls, `finder_hard_wall` fatal signature raised, **0 fix-agent pages, $0 spend.**
- **The second-lane resilience thesis (07-19) held a day longer:** a multi-day harvest-endpoint block is a degrade, not a halt, as long as LLM frontier discovery keeps producing. +151 is the proof.
