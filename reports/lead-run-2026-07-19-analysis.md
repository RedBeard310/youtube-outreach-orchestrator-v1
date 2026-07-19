# Lead Run — 2026-07-19 — Technical Analysis

**Cycle:** 2026-07-18T07:00:00Z → 2026-07-19T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** Day 3 of the autocomplete IP-block — the harvest refuel was still dead — yet parked volume **more than doubled off yesterday (+129 vs +51)**. The recovery ran entirely through the **second discovery lane**: LLM-invented frontier probes the finder mined in-session, pivoting hard into Real Estate (149) + Health clinics (54) = 80% of pitchable. The block is now a **degrade, not a halt**. $0 spend, 0 crashes, 0 quota stops, 0 fatal signatures. One durable efficiency fix shipped to the finder.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **+129** | net cycle gain (`done_parked_gain_sum` = 129); **2.5× of 07-18 (+51)**, best day since 07-16 (+82) |
| `approved_hold` pool | 2,397 → **2,526** | net **+129** |
| Pitchable found (score ≥6 + host) | **252** | of 951 discovered — **2.3× of 07-18 (108)** |
| Verified email (of pitchable) | **129 (~51%)** | 129 verified + 122 swept to `needs_contact` ≈ 251 of 252 pitchable resolved; verify a touch above the week band (42–47%) |
| Swept → `needs_contact` (this cycle) | **122** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **3,332** | up ~124 on the cycle (3,208 → 3,332) |
| Total channels discovered | **951** | 535 below-threshold, 150 unreviewed, 15 demo-niche-excluded, 122 needs_contact, 129 approved_hold |
| Finder-reported fresh pitchable (sum) | **45** | across 68 passes = 0.66/pass — **but this undercounts DB yield ~5.6×** (see Q3); DB truth is 252 |
| Finder passes | **68** | **54 zero-yield (79%)**, 14 weak (1–11), **0 healthy (≥12)**, tallest = 11; 32/68 exited nonzero (hard-stop) |
| Sessions started / done | 32 / 33 | **32 hard-stops**, 0 time-budget-stops, **0 quota-stops** |
| Discovery fades / discovers / promotes | 34 / 66 / 48 | the LLM discover lane fired on essentially every pass (66/68) and carried the day |
| `evaluate_probes` runs | ~10 (39 events cycle-wide) | **promoted 0 winners** (all 3,706 probes qr < 3.5%), re-paused ~3,700 losers each run |
| Keyword harvest (campaign) | **16 fired / 47 skipped** (`autocomplete_blocked`) | the 16 that fired stocked ~nothing (reservoir stayed STOCK-UP) |
| Reservoir verdicts | **31 STOCK-UP / 0 GO** | chronic measured supply shortage, all cycle |
| Autocomplete HTTP 403s | **~57** | block marker in 5/10 session logs — down from ~90 (07-18) / 22,105 (07-17); breaker capping it |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable: Real Estate & Property **149** · Health & Wellness Clinics **54** · Coaching & Consulting **23** · Financial Planning **7** · Relocation & Lifestyle **5** · Other **4** · Tax & Accounting **3** · Business-Growth Coaching **2** · Sales Training **2** · Marketing **1** · Legal **1** · SaaS **1**. **RE + Health clinics = 203/252 (80%)** — a near-total pivot from 07-18's Financial-Planning-heavy mix.

---

## Primary finding — the pipeline routed around a 3-day block via its second lane

The 07-17 debrief isolated the cause: Google's public suggest endpoint (`suggestqueries.google.com/complete/search`) — the finder's **harvest**-based term refuel — IP-blocked the VPS egress with sustained HTTP 403s. It held through 07-18 and **into 07-19 (day 3)**: 47 of 66 campaign harvests skipped on the live block, reservoir read STOCK-UP on all 31 sessions, and 32/32 sessions hard-stopped on the term wall.

**And yet the cycle recovered to +129 — 2.5× the prior day.** The reason: the harvest is only *one* of two refuel lanes. The finder's **LLM frontier-discovery** path (`discover-veins.ts`) is fully independent of the blocked endpoint — it asks Claude to invent professions/sub-niches/phrasings, writes them as low-priority `probe:<date>` terms, and the finder mines them **the same session**. That lane fired **66×** this cycle and pivoted into Real Estate + health-clinic veins that converted, producing 252 pitchable and 129 parked.

**This is the important structural proof of the cycle:** a multi-day infra block on the harvest endpoint is survivable — it degrades supply rather than halting it — as long as the LLM discovery lane keeps producing. The block's severity also keeps easing on our side (403s 22,105 → ~90 → ~57; marker now in only half the session logs), because the finder circuit breaker and the campaign block-skip (shipped 07-17/07-18) are working exactly as designed.

`discovered_today` is grounded on `IS_AFTER({first_discovered_at}, cycleStart)`, so the 951/252/129 are **genuinely newly-discovered** leads this cycle — not a drained backlog. The recovery is real finding.

---

## Q2 — why discovery carried the day but `evaluate-probes` still promoted 0 winners

These look contradictory but aren't. A probe **yields leads the moment the finder mines it** (that's the +129, produced in-session), but it almost never clears the bar to be **kept**. All **3,706 probes** in the book measured a qualified rate **below the 3.5% promote threshold**, so `evaluate-probes` promoted **0 winners** to the persistent "fresh tier" — for a third straight cycle. The finder is therefore **100% dependent on re-inventing fresh probes every night** instead of accumulating proven veins that compound.

The 07-15 recalibration (10% → 3.5%, `PROBE_PROMOTE_RATE`) was meant to fix precisely this, but the bar is *still* above what a single-run probe reaches against the real book (blended qr ~2–4%). This is the day's real structural weakness (lever #3). It's a business-logic tuning call for Casey, so it was **not** changed here — but the *waste* half of it was (below).

---

## Q3 — the finder's per-pass telemetry undercounts DB yield ~5.6×

The finder logged **45** fresh pitchable across 68 passes; Airtable recorded **252** pitchable discovered — a **~5.6× undercount** (07-18 was 22 vs 108, ~5×; the ratio is stable). Read literally, the per-pass counter says "dead day" (54/68 zeros, 0 healthy); the ledger says "productive." Consequences:

- The shape-of-day is unreliable if built on `fresh_pitchable` — this debrief's strip uses **net parked-gain per session** instead, which tracks the real +129.
- The fade signal (`< 12 fresh_pitchable` → fade → discover) fires on **essentially every pass** (66 of 68) because the counter reads so low. That over-discovery is *currently helping* (it's what produced the recovery), so this is reporting-debt, not an urgent bug — but the fade logic is running on a number disconnected from truth.

---

## Change shipped this cycle

**`youtube-lead-finder-v1` `7116731`** — `evaluate-probes` skips already-paused losers.

- **Problem:** a retired loser keeps its `probe:` tag + `runs≥1` + sub-threshold `qr`, so it re-matches the loser filter on **every** invocation and gets `status='paused'` re-written even though it's already paused. With all 3,706 probes paused and `evaluate-probes` firing 10+×/cycle in the campaign, that was tens of thousands of no-op Airtable writes/day (~minutes/run of redundant write traffic against the 5 req/s base limit). Winners self-clear (promotion clears the probe tag); losers didn't.
- **Fix:** only write losers whose `status !== 'paused'`. The pause is now self-clearing, exactly like winner-promotion already was. A re-activated loser (`status != 'paused'`) is still correctly re-paused — no change to the decision logic, only the write set.
- **Verified before commit:** dry-run against the live book prints `LOSERS → pause 0 (3,706 already paused, skipped)` — i.e. the old code was doing 3,706 redundant writes each run; the new code does 0. Loads and runs clean.

This is an efficiency / self-healing fix in the spirit of the CLAUDE.md "self-healing fixes" ledger — it removes wasted work under a known steady-state (a fully-paused probe book) without touching what the step decides.

---

## Shape of the day

Net parked gain per campaign session (33 sessions): `[0,0,1,0,0,0,4,12,6,9,17,1,15,12,0,2,0,6,0,4,0,9,6,2,2,0,2,1,4,0,14,0,0]`. A slow start, a strong productive middle (the `12·6·9·17·1·15·12` block — the frontier-discovery recovery), a softer but never-dead tail (a late `14`). Unlike 07-18 (flat-dead), this cycle had a genuine productive core carried by the LLM discovery lane.

---

## Constraints (updated)

1. **The harvest term-refuel is IP-blocked (day 3) — but no longer the binding *halt*.** The LLM discovery lane routes around it; supply degraded, it did not stop. Unblock is still infra (rotate egress IP / proxy), now re-prioritised from "restore the pipeline" to "restore full supply."
2. **Discovery does not compound.** 0 probes promoted for 3 cycles → proven veins (RE, clinics) are re-invented nightly instead of accumulated. The single biggest fixable weakness inside the finder.
3. **`needs_contact` = 3,332** and immune to the block — the biggest lever that needs zero finding. Still deferred.
4. Verify (~51%) is healthy and not the constraint.

---

## Ranked next levers

1. **Rotate the VPS egress IP / proxy the autocomplete calls (operator, infra).** Only action that lifts the block — #1 three days running, but urgency softened: the pipeline now survives the block, so this is "restore full supply," not "unblock a halt."
2. **Second independent term source** (DataForSEO / Google Ads API). Removes the single point of failure so the harvest lane degrades gracefully rather than leaning entirely on the LLM lane through a multi-day block.
3. **Make discovery compound.** Lower the promote bar again, evaluate on *cumulative* runs rather than one, or promote by niche-relative rate — so an RE vein that just delivered 149 leads persists to the fresh tier instead of being paused. Biggest structural fix inside the finder.
4. **The `needs_contact` recovery engine (3,332).** Immune to the term block; larger than three good finding days combined. Awaiting greenlight.
5. **Reconcile the finder's `fresh_pitchable` telemetry with DB yield** so fade logic and debriefs run on the real number, not a ~5.6× undercount.

---

## Carried forward and validated in production this cycle

- Finder circuit breaker `68f1896` (07-17) + check-in block detection `8d53f3f` (07-17) + campaign block-skip `4f3a282` (07-18): the block stayed absorbed — 403s ~57, harvest skipped 47×, $0 spend, 0 crashes. The self-healing block handling is holding across three cycles.
