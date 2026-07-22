<!--
  Companion analysis for lead-run-2026-07-22.html
  Grounded in logs/autopilot-debrief-2026-07-22.json + campaign-2026-07-2{1,2}.jsonl
  + autopilot-sessions/*.log + autopilot-observations.jsonl.
-->

# 2026-07-22 — Day 6 of the block: fresh finding flatlined, the backlog carried it

**Headline:** **+52 parked** in `approved_hold` (pool 2,769 → **2,821**), +49 → `needs_contact`
(→ **3,605**); 619 discovered / **119 pitchable** / 58 email-verified; **$0 Claude spend**,
**43/43 sessions hard-stopped**, no fix-agent page, no halt flag. But the real number is the
finder's own counter: **1 fresh pitchable across 50 passes** — net-new *finding* is dead.

The autocomplete IP-block that began **2026-07-17** is into its **sixth day**. Days 2–5 were
carried by the finder's independent LLM **frontier-discovery** lane; that lane **saturated on
07-21**, and yesterday's durable fix (`FRONTIER_VERTICALS +19`) was staked on it converting
this cycle. It **didn't**: the term table moved only **6,983 → 6,998**, discovery stayed
dry-locked all cycle, and fresh finding stayed at zero. The +52 that parked is **backlog-drain**
(verify/promote of the standing found-but-unverified pool), not finding. The code workarounds
are now exhausted; the remedy is infra Casey owns.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-22.json`)

| Metric | Value | Prior day (07-21) |
|---|---|---|
| Parked → `approved_hold` | **+52** (2,769 → 2,821) | +86 |
| → `needs_contact` | +49 (→ 3,605) | +87 (→ 3,556) |
| Discovered today | 619 | 737 |
| Pitchable (score ≥ 6) | 119 | 207 |
| Email-verified / parked | 58 | 86 |
| Verify rate (parked ÷ parked+needs_contact) | ~51% | ~50% |
| Campaign sessions / all hard-stopped | 43 / **43** | 44 / 44 |
| Finder runs / `fresh_pitchable` sum | 50 / **1** | 49 / 0 |
| Discover calls / fades / promotes | 50 / 7 / 19 | 49 / 5 / 28 |
| Quota stops / time-budget stops | 0 / 0 | 0 / 0 |
| Claude burn (fix-agent + debrief) | **$0** | $0 |
| Fatal signatures | `finder_hard_wall` (benign, no page) | `finder_hard_wall` (benign) |
| Autocomplete block age (`supply_health`) | **~4.9 days** (since 07-17 09:42Z) | ~4 days |

**Fresh-finding vs. discovered:** `discovered_today = 619` is dominated by **status churn** —
verify→promote into `approved_hold`, dead-email sweeps into `needs_contact`, and re-scores of
the standing backlog. The finder wrote **new channels on only 3 of ~120 passes** across the
whole cycle (≈19 channels total); every other pass logged `New channels written: 0`. The honest
net-new-*finding* signal is `fresh_pitchable_sum = 1`.

### Pitchable by niche (discovered today) — still coaching-heavy
Coaching & Consulting **49**, Business Growth Coaching **24**, Sales Training **12**, Health &
Wellness Clinics 6, Relocation 5, Real Estate 5, SaaS 5, AI Automation 4 — the 07-19/07-20
Real-Estate + clinics frontier surge is gone; what's left skews to the always-on coaching core,
consistent with backlog-drain rather than fresh frontier finding.

## The three questions

**Q1 — Why did fresh finding flatline to zero?** A term-supply refuel deadlock with *both*
independent sources dead. (1) The autocomplete/suggest endpoint is IP-blocked (sustained HTTP
403 since 07-17); the one harvest that got through this cycle hit the circuit-breaker at 8/42
seeds, and the ICP-prefilter kept **1 of 808** candidates. (2) The LLM frontier-discovery lane
saturated 07-21 — generations now dedupe to ~0 net-new. Yesterday's `+19 verticals` didn't move
it (table 6,983 → 6,998, still dry-locked). No new terms enter the table → the finder mines a
0–1-term saturated pool → aborts `No active terms` → two-strikes hard wall on **43/43 sessions**.

**Q2 — Then why did +52 still park?** Because parking is downstream of *verifying*, not
*finding*. The verify/promote lane pulls from the standing found-but-unverified pool
independently of the finder: 5, 6, 3… promoted per session → `approved_hold`, with dead-email
score-≥6 leads swept → `needs_contact`. That's a finite reservoir being drained, not new supply.

**Q3 — Is it broken? No — but the workarounds are spent.** Every guardrail held: $0 spend,
clean ~30-min rests (no thrash), all `finder_hard_wall`s classified benign, no page, no halt.
The block's remedy is infra (rotate egress IP / proxy) — no code path or fix-agent can perform
it. And the cheap code levers are now exhausted across five debriefs (circuit-breaker →
block-aware harvest → block-backoff → discovery dry-guard → +19 verticals), the frontier lane
being the last. Compounding it: **0 working direct YT keys** and **RapidAPI at 98.9%** all cycle
— two infra axes pinned at once — so even a term refuel couldn't be mined right now.

## What broke → what's fixed

| Issue | Mechanism | Status |
|---|---|---|
| Autocomplete IP-block (6 days) | Egress IP → sustained HTTP 403 from the suggest endpoint | **OPEN** — infra only (rotate egress IP / proxy) |
| Frontier LLM discovery exhausted | Saturated 07-21; dedupes to ~0 net-new against a static table | **OPEN** — 07-21's `+19 verticals` did not convert (6,983 → 6,998) |
| Outage invisible in the "authoritative" debrief JSON | Feed emitted only `fatal_signatures`; churn-inflated `discovered_today` could read as health | **FIXED** — `effbd54` adds `supply_health` |
| 0 direct YT keys / RapidAPI ~99% | Direct keys exhausted/suspended; on RapidAPI fallback near cap | **OPEN** — infra (keys / daily reset) |

## Ranked next levers

1. **Rotate the VPS egress IP / add a proxy** — the one binding constraint, 6 days. A ~5-minute
   operator action that ends the whole outage. No code substitute exists.
2. **Restore YouTube API capacity** — ≥1 working direct key (0 today) or RapidAPI headroom after
   reset (ran 98.9%). Gates the payoff of lever 1: unblocked terms still need quota to mine.
3. **Stand up the `needs_contact` recovery engine (3,605)** — now the *only* growth lever that
   sidesteps both the term-supply and API-capacity ceilings. Six days into an infra wall this is
   the primary path, not a deferred nice-to-have.
4. **A second, independent term source (DataForSEO)** — recommended daily since 07-17. Today
   proves the single-point-of-failure risk: the LLM lane was only a few-day bridge before it
   saturated too.
5. **(Shipped) `supply_health` in the debrief feed** — so a persistent infra outage is
   machine-visible with its true age and can't be misread as a healthy day.

## Self-improvement shipped this cycle

**`effbd54` (orchestrator) — `supply_health` in the debrief data feed.** `debrief-data.ts`
previously emitted only `fatal_signatures`, so the 6-day fresh-finding outage was invisible in
the "authoritative" JSON the debrief agent is told to trust. Because `discovered_today` is
inflated by status churn, a future agent reading only the JSON could misread a churn-inflated
"619 discovered / 119 pitchable" as a healthy day. The new block adds `fresh_pitchable_sum`,
`fresh_finding_dead`, and the autocomplete-block episode age (days) + starvation-observation
counts — read from the hourly check-in observations log. Pure reporting, additive key,
typecheck-clean, logic unit-verified against the live observations log (`blocked_since`
2026-07-17, ~4.9 days continuous). This is the same class of fix as 07-12's debrief-window bug:
it hardens the debrief loop's own inputs, not the pipeline. No other high-confidence code fix was
available — the binding constraints are all infra, and the cheap code workarounds are exhausted;
shipping another doomed workaround would be churn.

## Standing caveat

Everything is **parked**, nothing sent. `approved_hold` is a deliberate holding lane; the pool
is now **2,821**, `needs_contact` **3,605**. The loop was left running (correct — $0 spend, clean
rests, nothing money-path or auth-critical at risk). Sixth consecutive debrief to name egress-IP
rotation as lever #1.
