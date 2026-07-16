# Lead Run — 2026-07-16 — Technical Analysis

**Cycle:** 2026-07-15T07:00:00Z → 2026-07-16T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** A clean, modest day that was the mirror image of 07-15 — supply was freshly harvested *early*, so the PT morning ran strong, then the pool drained through the evening and the 4h harvest cadence couldn't refuel fast enough, leaving a dead second half. Per-pass yield was the best in a week; the cap was throughput, driven by correct resting under a term wall. $0 spend, 0 fatal signatures, 0 quota stops, every prior self-healing fix held. One durable fix shipped: the keyword harvest now fires on fade (mid-session), not only at pre-flight.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **82** | in-cycle leads now parked |
| `approved_hold` pool | 2,185 → **2,267** | net **+82** |
| Pitchable found (score ≥6 + host) | **195** | across 112 finder passes = **1.74/pass** (07-15 ≈ 1.32, 07-14 ≈ 1.69, 07-13 ≈ 0.71) — **best per-pass rate in a week** |
| Verified email (of pitchable) | **82 (~42%)** | all 82 verified → parked; verify rate a touch below 07-15's ~46% |
| Swept → `needs_contact` (this cycle) | **~97** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **3,079** | up ~98 on the cycle |
| Total channels discovered | **1,070** | 727 below-threshold, 131 unreviewed, 33 demo-niche-excluded, 97 needs_contact, 82 approved_hold |
| Finder passes | **112** | 56 zero-yield (~50%), clustered in the back half; **fewest passes of the recent stretch** (07-15: 127, 07-14: 217, 07-13: 375) |
| Finder-reported fresh pitchable (sum) | **141** | finder's own per-pass tally (used for the shape-of-day bars); the 195 headline is the Airtable score-≥6 count over the window — the two counters diverged more than usual this cycle |
| Sessions started / done | 24 / 25 | **20 hard-stops**, 5 time-budget-stops, 0 quota-stops |
| Discovery fades / discovers / promotes | 91 / 112 / 99 | verify+promote lane kept draining |
| Keyword harvest | **5 fired / 16 skipped** | cadence-gated at 4h — the binding limiter this cycle |
| Reservoir verdicts | **20 STOCK-UP / 4 GO** (of 24) | chronic measured supply shortage |
| `term_starvation` heartbeat (07-15 fix) | **fired 7×** | 18:42Z → 06:42Z, across the dead tail; $0, out of the fix-agent path |
| YouTube quota stops | **0** | quota never a factor, big headroom |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable: Real Estate & Property **95** · Legal **32** · Financial Planning & Investing **26** · Tax & Accounting 9 · Coaching & Consulting 8 · Relocation 8 · Health Clinics 6 · SaaS 5 · AI Automation 2 · Wealth 1 · Business-Growth Coaching 1 · Other 2. **RE + Legal + Financial Planning = 153/195 (78%)**; RE alone is **49%**. Notable shift vs 07-15: **Legal jumped to #2** (32 vs 12) — the harvest surfaced a fresh batch of legal-services autocomplete tails.

---

## Primary finding — the between-harvest drain: strong first half, dead second half

This cycle is structurally the *inverse* of 07-15. On 07-15 the harvest wiring deployed 8h into the window, so the morning was dead and the afternoon recovered. This cycle the harvest was live from the start and fired early, so the **PT morning/midday ran strong** — then supply drained and the **PT evening/overnight went dead**.

The hourly profile makes it unambiguous (UTC hour → passes, pitchable; PT = UTC−7):

| UTC hour | PT | Passes | Pitchable | Behaviour |
|---|---|---|---|---|
| 07–13Z | 00:00–06:00 | ~46 | ~86 | strong — freshly-harvested terms (peaks 23, 21, 16, 14) |
| 14–17Z | 07:00–10:00 | ~19 | ~16 | fading — early refill draining |
| 20–22Z | 13:00–15:00 | ~23 | ~33 | a late spike (one 14-pitchable pass) then decay |
| 23Z–06Z | 16:00–23:00 | ~24 | ~7 | **near-dead** — no refuel; 20:00–23:00 PT completely 0 |

**Mechanism.** The keyword harvest — the only refuel that produces genuine net-new terms (the LLM `discover()` reconverges on its own priors → ≈0 net-new against the saturated ~5,000-term table) — could previously fire **only at a session's pre-flight**, inside the `STOCK-UP && discovery` branch. It's cadence-gated to `KEYWORD_HARVEST_INTERVAL_HOURS` (4h). So across 24 sessions and 20/24 `STOCK-UP` pre-flights, it actually harvested only **5 times** (16 cadence-skipped). Once the early refill drained mid-window, **every fade fell through to the dead `discover()`**, and the pool bled out until the next session's pre-flight happened to coincide with the 4h gate. That is the dead evening tail, mechanically — and the `term_starvation` heartbeat fired 7× across exactly that window, confirming it live.

**The loss was throughput, not efficiency.** Per-pass yield was the *best in a week* (1.74 pitchable/pass) — the finder is excellent when it has terms. But it ran the **fewest passes** (112) because it kept hitting the term wall and **correctly resting**: 20 of 24 sessions hard-stopped (finder exited nonzero twice → back-off), rather than grinding saturated ground at full API cost. That resting behaviour is the 07-13/07-14 fix working as intended; the cost is simply fewer passes when supply is thin. Verify held ~42% — the loss was upstream in *finding*, as on every term-supply-limited day since 07-09.

---

## Secondary finding — the cleanest cycle yet; every self-healing fix held

- **`term_starvation` heartbeat (07-15, `4e8946a`) — validated in production.** Fired **7×** (18:42Z → 06:42Z), precisely across the dead evening/overnight tail, and stayed **$0 / exit-0 / out of the fix-agent path** — exactly the design intent (a signal, not a paid trigger, because a term wall is not code-fixable). A dry finder is now visible same-hour instead of only at this debrief. First real-world confirmation the detector fires on genuine drought and doesn't false-positive on healthy passes.
- **Discovery-dry guard (07-14, `31c208b`) held.** No wasted `claude-sonnet-5` generations; $0 spend.
- **Hard-wall back-off + self-reload (07-13/07-14, `92ee26f` + `401d62b`) held.** 24 sessions with proper resting gaps — no 2.6-minute relaunch thrash. `0 fatal signatures`, `0 quota stops`; the hourly check-in fired no fix-agent the entire cycle.

The machine behaved perfectly around a well it had emptied.

---

## Fix shipped this cycle — fade-triggered keyword harvest (orchestrator, `8debc58`)

`src/drivers/campaign.ts`. Previously, on a fade the loop called **only** the LLM `discover()` (≈0 net-new). Now it **also fires the cadence-gated keyword harvest first**, at a shorter floor:

```ts
// A fade is direct evidence the active vein just drained MID-SESSION — a stronger
// supply-pressure signal than a pre-flight reservoir verdict. Refill with REAL
// autocomplete terms first, at a shorter cadence floor (default 2h vs the pre-flight 4h),
// then still run the LLM discover() as a complement.
await harvestKeywords(opts, Number(process.env.KEYWORD_HARVEST_MIN_INTERVAL_HOURS ?? 2));
await discover(opts);
```

`harvestKeywords()` gains an optional `intervalOverrideH` parameter; when omitted it uses the existing 4h pre-flight gate, so **pre-flight behaviour is unchanged**. Three load-bearing design choices:

1. **Fade, not a pre-flight verdict, is the trigger.** A fade is *measured* evidence the active vein drained this pass — a stronger, later signal than a pre-flight `STOCK-UP` (which can be a transient blip the 4h gate deliberately ignores). So it justifies a shorter (2h) floor without blindly cutting the base cadence — the thing 07-15 explicitly declined to churn.
2. **Additive and cadence-gated → cannot over-fire or blow quota.** When not due, the harvest no-ops (a `skipped` log) and the loop proceeds to `discover()` exactly as before. The harvest itself is ≈free (autocomplete + a few cents of Haiku prefilter); only probe-*testing* costs YouTube quota, and that's already bounded by the quota governor. This cycle had 0 quota stops with large headroom, so the risk is empirically near-zero.
3. **Effect is a faster refill precisely under drain.** Under sustained fading the effective harvest cadence drops from 4h → 2h, roughly doubling refills when the pool is emptying, and auto-backs-off (no fade / well-stocked → no extra harvest). That directly targets today's dead evening tail.

**Verification:** `npm run typecheck` passes (exit 0); the module imports clean through `tsx` (`campaign.ts loaded ok; exports: driveCampaign`). The change is confined to the fade branch and the `harvestKeywords` signature; no other call site or business logic touched. New env knob `KEYWORD_HARVEST_MIN_INTERVAL_HOURS` (default 2) — a code default, no `.env` change.

This closes **07-15 rec #3** ("fire the harvest on fade mid-session, not only at pre-flight"), which was deliberately deferred last cycle pending evidence. The evidence arrived: 20/24 `STOCK-UP`, harvest capped at 5 fires by the 4h gate, a dead evening tail, and the heartbeat firing 7×.

---

## Shape of the day

112 finder passes, `fresh_pitchable` per pass, chronological (sum 141):

```
07:00 → 13:00Z (strong, harvested):  1 1 0 0 1 4 3 1 2 1 9 3 1 3 1 0 6 …  (peaks 9, then hourly 14/23/16/12/21)
13:00 → 20:00Z (fading):             … 4 2 1 2 0 2 0 5 3 0 2 1 0 1 4 1 0 1 0 0 4 7 7 2 0 …
20:00 → 07:00Z (dead tail):          … 14(one spike) 0 0 1 2 1 0 4 1 2 0 0 0 0 0 1 2 0 0 1 1 0 0 0 0 0 1 0 0 0 0 0 0
```

- avg **1.26 fresh/pass** (finder tally) — **1.74/pass** on the Airtable score-≥6 count (195); max single pass **14**; **only one** pass all cycle cleared the ≥12 "healthy" bar.
- 56 zero passes — but unlike 07-15 (front-loaded stall) these cluster in the **back half**: the pool drained after the early harvest and never got refueled.

---

## Constraints (updated)

1. **Term supply is still the governing input** — and this cycle isolated the *between-harvest* failure mode specifically: pre-flight-only harvest + a 4h cadence = a pool that bleeds out mid-window. The fix shipped this cycle targets exactly that.
2. **Throughput, not efficiency, capped the day.** Per-pass yield was the best in a week; the loop simply ran fewer passes because it correctly rested under the term wall (20 hard-stops). More supply → more passes → more parked; the relationship is near-linear.
3. **Email verify ~42% held** — a throttle, not the binding constraint.
4. **`needs_contact` = 3,079 (+98/cycle)** — the single largest unbuilt lever; fully sidesteps the term-supply wall. Deferred pending greenlight.

---

## Ranked next levers

1. **Watch the fade-triggered harvest next cycle (shipped today).** Confirm it lifts the PT-evening/overnight yield that died today and stays quota-safe. If insufficient, the next dial is lowering the base `KEYWORD_HARVEST_INTERVAL_HOURS` or raising the cap — but on evidence, not blindly.
2. **Build the `needs_contact` recovery engine** (`youtube-email-outreach-v1`) — 3,079 parked creators; recovering a third out-yields a week of fresh finding. Biggest lever, deferred.
3. **Keep widening the ICP / frontier.** RE + Legal + Financial Planning = 78% of yield; the harvest refuels those tails, but net-new *verticals* are what break the supply ceiling durably.
4. **Resist adding machinery the loop doesn't need.** It's healthy, self-healing, and cheap.

---

## Changes shipped this cycle

| Repo | Change | Commit |
|---|---|---|
| youtube-outreach-orchestrator-v1 | `campaign.ts`: keyword harvest now fires **on fade** (mid-session), not only at session pre-flight, at a shorter cadence floor (`KEYWORD_HARVEST_MIN_INTERVAL_HOURS`, default 2h). Additive + cadence-gated (no over-fire, no quota risk); refills the term pool with real autocomplete terms precisely when the active vein drains, closing the between-harvest drain (07-15 rec #3). | `autopilot-improve: fire keyword harvest on fade (mid-session refill at shorter cadence floor)` (`8debc58`) |

No changes to the finder, email-outreach, deep-research, or quick-research repos: the cycle's one structural gap (between-harvest drain) is now addressed in the orchestrator, and every other subsystem behaved correctly ($0, 0 fatal, 0 quota, all prior fixes held). No invented churn.
