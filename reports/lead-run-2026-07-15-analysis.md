# Lead Run — 2026-07-15 — Technical Analysis

**Cycle:** 2026-07-14T07:00:00Z → 2026-07-15T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** A low day (+78 vs 07-14's +166) with a clean split — the first ~8h ran *before* the keyword-harvest refuel was wired into the loop (deployed 15:06Z, `b588572`), so the finder ground a saturated table for nothing; the moment it deployed, supply refilled and yield returned modestly. Both 07-14 self-healing fixes held ($0 spend, 0 fatal signatures). One new fix shipped: term-starvation is now visible to the hourly health signal.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **78** | in-cycle leads now parked |
| `approved_hold` pool | 2,107 → **2,185** | net **+78** |
| Pitchable found (score ≥6 + host) | **168** | across 127 finder passes = **1.32/pass** (07-14 ≈ 1.69, 07-13 ≈ 0.71) |
| Verified email (of pitchable) | **78 (~46%)** | verify rate held |
| Swept → `needs_contact` (this cycle) | **84** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **2,981** | up ~84 on the cycle |
| Total channels discovered | **789** | 488 below-threshold, 115 unreviewed, 24 demo-niche-excluded |
| Finder passes | **127** | 64 zero-yield (~50%); the first ~31 are the pre-deploy dead stretch |
| Sessions started / done | 29 / 28 | 22 hard-stops, 5 time-budget-stops, 0 quota-stops |
| Discovery fades / discovers / promotes | 89 / 113 / 86 | verify+promote lane kept draining |
| Discovery generations (this cycle) | **11** | **105** suppressed by the dry-guard; 9 of the 11 still came back dry |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable: Real Estate & Property **82** · Financial Planning & Investing **43** · Legal 12 · Tax & Accounting 11 · Relocation 8 · SaaS 4 · Coaching 4 · Health/Marketing/Wealth/Other 1 each. **RE + Financial Planning = 75%** — the two verticals the fresh harvest terms land in.

---

## Primary finding — the term-refuel wasn't wired until 15:06Z, so a third of the cycle had no working supply

`harvestKeywords()` — the Keyword Layer refuel that pulls demand-verified autocomplete tails into the term pool — landed in `campaign.ts` at commit **`b588572` (auto-sync 2026-07-14T15:06:01Z)**, the cycle's HEAD. The cycle window opens at 07-14T07:00:00Z. So for the first **~8h (07:00 → 15:06Z)** the running loop had only its LLM `discover()` fallback for refuel — and 07-13/07-14 already established that fallback yields **~0 net-new** against the saturated ~5,000-term table (the dry-guard skips it precisely because nothing new comes out).

The consequence is unambiguous in the pass sequence: the first **31 finder passes were near-dead** (0–0–0…, sum ≈ 5). Then at 15:06Z the harvest deployed, the term table grew +200 in the next window, and yield recovered into a burst (peak ~13/pass) before decaying to a long modest tail.

| Window (UTC) | Passes | Fresh pitchable | Behaviour |
|---|---|---|---|
| 07:00 → 15:06Z (pre-deploy) | ~31 | ~5 | no working refuel; LLM fallback = 0 net-new |
| 15:06 → 19:00Z (recovery) | ~35 | ~90 | harvest live → table +200 → burst, RE + Financial Planning |
| 19:00Z → 07:00Z (tail) | ~61 | ~71 | steady modest trickle, dips at 19:00Z & 04:00Z |

**This is a deploy-timing story, structurally identical to 07-14's** (a committed improvement only taking effect mid-cycle). The self-reload fix from 07-14 (`401d62b`) is what let `b588572` take effect at all without a manual restart — it worked. The residual loss is simply that the harvest existed for only ~16 of the cycle's 24h. **Next full cycle runs it from 00:00, so this specific gap is one-time.**

The verify rate held at ~46% (78/168) — the loss was entirely upstream in *finding*, not in *verifying*, exactly as on every term-supply-limited day since 07-09.

---

## Secondary finding — both 07-14 self-healing fixes held

**① Discovery-dry guard (finder, `31c208b`).** Within the 28 in-cycle sessions: **105 dry-skips** vs only **11 actual `claude-sonnet-5` generations** (9 of those still returned "nothing to write"). That is the 07-14 waste (168/212 = 79%) now **largely eliminated** — the guard suppresses the call whenever the term table hasn't grown since the mode last went dry, and self-re-arms on growth (plus a 3h safety re-arm, which accounts for the ~9 residual dry generations — minor, ~cents).

**② Hard-wall back-off + self-reload (orchestrator, `92ee26f` + `401d62b`).** Sessions dropped from **98 (07-14) → 28** this cycle, and relaunch gaps are back to proper resting intervals instead of the 2.6-min thrash. `0 fatal signatures`, `$0` spend, `0 quota stops` — the hourly check-in fired no fix-agent the entire cycle.

---

## The residual drag (two items, one fixed this cycle)

**A) Between-harvest supply dips.** The harvest is cadence-gated (`KEYWORD_HARVEST_INTERVAL_HOURS`, default 4h) and fires only at a *session's pre-flight* (inside the `STOCK-UP && discovery` branch). Between harvests the loop falls through to the dead LLM `discover()`, which fills the gap with nothing. So after the 15:06Z recovery burst, yield sagged at **19:00Z** (2/pass) and **04:00Z** (0/pass) as supply drained faster than the next scheduled refill. Reservoir verdicts confirm chronic shortage: **4 of 5** pre-flight checks returned `STOCK-UP`. → **Recommended lever #3** (adaptive cadence under supply pressure, or fade-triggered mid-session harvest). Left unshipped this cycle: it's a real-but-modest gap and halving the default interval is a tunable operator decision with a genuine (quota/prefilter) cost — not a slam-dunk self-healing fix. Flagged for evidence next cycle.

**B) Term-supply wall was invisible to the health signal — FIXED.** A dry finder is neither a crash (no fatal signature) nor a broken verify path (the `find_no_park` detector requires `finder.ok >= 3`, and a starving finder either exits nonzero or yields 0 while `approved_hold` is legitimately flat). So the 8h stall was only knowable *at this debrief*. This gap was flagged as **07-13 rec #4** and **07-14 lever #4**, twice deferred. Fixed this cycle — see below.

---

## Fix shipped this cycle — term-starvation heartbeat (orchestrator, `4e8946a`)

`scripts/autopilot/checkin.ts` gains a fifth, **observability-only** check. Each hour it reads the last `AUTOPILOT_STARVATION_WINDOW` (default 6) finder passes and computes their failure/zero-yield/pitchable profile:

```ts
const starving = fstats.total >= STARVATION_WINDOW &&
  (fstats.pitchable <= STARVATION_MAX_PITCHABLE || fstats.failed >= fstats.total - 1);
```

When true it appends a `term_starvation` heartbeat to a **separate** `logs/autopilot-observations.jsonl` and **stays exit 0**. Two deliberate design choices, both load-bearing:

1. **Never exit 7 (never spawn the paid fix-agent).** A term-supply wall is *not code-fixable* — the remedy is an ICP/term-supply decision (run the harvest, widen the ICP, advance the `needs_contact` engine). A `claude -p` agent dispatched at it would burn money it can't recover and would re-fire on every genuine dry spell. So this is a signal, not a trigger.
2. **Separate file, not the attention log.** The fix-agent reads `autopilot-attention.jsonl` for its evidence and archives it when done. Writing starvation notes there would pollute that channel and could misdirect a *later* real fix-agent. The observations file keeps the two channels cleanly separated.

**Verification:** loads and runs live via `tsx` (exit 0, `parked=2185` — matches the grounded snapshot). Replaying the detector against this cycle's real pass sequence: it flags the all-dead pre-deploy morning window (6/6 failed, 0 pitchable → `starving=true`), and does **not** flag the healthy recovery peak (26 pitchable → false) or the slow-but-alive tail (6 pitchable, 1 zero → false). Purely additive — the existing exit-7 anomaly path (fatal signatures, find-no-park) is untouched.

---

## Shape of the day

127 finder passes, `fresh_pitchable` per pass, chronological:

```
07:00 → 15:06Z (pre-deploy, dead):   0 0 0 0 0 0 … 0   (31 passes, sum ≈ 5)
15:06 → 19:00Z (harvest live, burst): 5 4 13 2 2 2 2 5 2 0 6 1 3 4 4 2 1 5 1 3 8 …  (peak 13)
19:00Z → 07:00Z (declining tail):    … 2 1 0 1 0 3 1 4 2 0 … 1 1 2 0 0 1   (dips at 19:00Z, 04:00Z)
```

- avg **1.32 pitchable/pass**; max single pass **13**; **only one** pass all cycle cleared the "healthy" ≥12 bar.
- 64 zero passes — but the front 31 are the pre-deploy stall, not a mid-run regression.

---

## Constraints (updated)

1. **Term supply is still the governing input** — and this cycle proved it costs ~half a day when the refuel is absent for 8h. Feeding the pool (Keyword Layer harvest, wider ICP) is the lever; the LLM discovery fallback yields ~0 net-new.
2. **Deploy timing** cost the morning — but the self-reload fix (07-14) is what let the harvest deploy at all without a manual restart. Working as intended; the gap is one-time (next cycle runs the harvest from 00:00).
3. **Email verify ~46% held** — a throttle, not the binding constraint this cycle.
4. **`needs_contact` = 2,981 (+84/cycle)** — the single largest unbuilt lever; fully sidesteps the term-supply wall. Deferred pending greenlight.

---

## Ranked next levers

1. **Keep the harvest wired and feed the term pool.** Supply → parked is near-linear; 8 dry hours cost ~half the day. #1 volume lever.
2. **Build the `needs_contact` recovery engine** (`youtube-email-outreach-v1`) — 2,981 parked creators; recovering a third out-yields a week of fresh finding. Biggest lever, deferred.
3. **Close the between-harvest gaps** — adaptive harvest cadence while the reservoir is `STOCK-UP`, or fire the harvest on fade mid-session (not only at pre-flight). Quota-safe; addresses the 19:00Z / 04:00Z sags.
4. **Watch the new `term_starvation` heartbeat next cycle** — confirm it fires during dry windows, stays $0 (out of the fix-agent path), and gives a same-hour operator signal.

---

## Changes shipped this cycle

| Repo | Change | Commit |
|---|---|---|
| youtube-outreach-orchestrator-v1 | `checkin.ts`: term-supply-wall heartbeat — hourly `term_starvation` observation (separate observations file, never exit 7 / never a paid fix-agent) so a dry finder is visible same-hour instead of only at the daily debrief. Closes 07-13 rec #4 / 07-14 lever #4 | `autopilot-improve: term-supply-wall heartbeat in checkin.ts` (`4e8946a`) |

No changes to the finder, email-outreach, deep-research, or quick-research repos: the cycle's structural driver (the harvest deploying 8h into the window) is already resolved by the wiring being live, and the residual between-harvest gap is a tuning decision better made on next cycle's evidence than churned now. The one shipped fix targets the concrete, twice-deferred observability gap without touching business logic.
