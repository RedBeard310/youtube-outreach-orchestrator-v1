<!--
  Companion analysis for lead-run-2026-07-23.html
  Grounded in logs/autopilot-debrief-2026-07-23.json + campaign-2026-07-2{2,3}.jsonl
  + autopilot-sessions/*.log + autopilot-observations.jsonl.
-->

# 2026-07-23 — Day 7 of the block: finding flat, the backlog carried it

**Headline:** **+67 parked** in `approved_hold` (pool 2,824 → **2,891**), +62 → `needs_contact`
(→ **3,666**); 833 discovered / **148 pitchable** / 70 email-verified; **$0 Claude spend**,
**44/45 sessions hard-stopped**, no fix-agent page, no halt flag. But the real number is the
finder's own RUN SUMMARY: **7 net-new channels written across 122 passes** (119 wrote 0). Net-new
*finding* is dead; the +67 is **backlog-drain**.

The autocomplete IP-block that began **2026-07-17** is into its **seventh day** (~5.9d). This is
a near-carbon-copy of 07-22: all three term-supply lanes are dead at once — the keyword harvest
is IP-blocked (correctly skipped every session), the LLM frontier-discovery lane is dry-locked at
**~7,006 terms** (the 07-21 `FRONTIER_VERTICALS +19` bet still hasn't converted), and the
anti-starvation reserve is spent (`NO never-run paused terms remain` on every run). The +67 that
parked is the verify lane draining the standing found-but-unverified pool. The code workarounds
remain exhausted; the remedy is infra Casey owns.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-23.json`)

| Metric | Value | Prior day (07-22) |
|---|---|---|
| Parked → `approved_hold` | **+67** (2,824 → 2,891) | +52 |
| → `needs_contact` | +62 (→ 3,666) | +49 (→ 3,605) |
| Discovered today | 833 | 619 |
| Pitchable (score ≥ 6) | 148 | 119 |
| Email-verified | 70 | 58 |
| Verify rate (verified ÷ pitchable) | ~47% | ~49% |
| **Net-new channels written (finder RUN SUMMARY)** | **7** (3 passes > 0) | ~7 (est.) |
| Campaign sessions / hard-stopped | 45 / **44** | 43 / 43 |
| Finder runs / `fresh_pitchable` sum | 51 / **0** | 50 / 1 |
| Discover calls / fades / promotes | 50 / 7 / 21 | 50 / 7 / 19 |
| Quota stops / time-budget stops | 0 / 0 | 0 / 0 |
| Claude burn (fix-agent + debrief) | **$0** | $0 |
| Fatal signatures | `finder_hard_wall` (benign, no page) | `finder_hard_wall` (benign) |
| Autocomplete block age (`supply_health`) | **~5.9 days** (since 07-17 09:42Z) | ~4.9 days |

**Fresh-finding vs. discovered:** `discovered_today = 833` is dominated by **status churn** —
verify→promote transitions plus `needs_contact` sweeps of the standing pool — not new channels.
The finder's own count is the ground truth: **119 of 122 passes logged "New channels written: 0"**
and the other three wrote 3 + 2 + 2 = **7**. `Terms processed` was 0 on **112 of 122 passes**.
So `pitchable = 148` is re-surfaced/re-scored backlog, not 148 freshly-found creators.

## What actually happened, hour by hour

- **44 clean sessions, ~31 min apart** (00:07Z → 06:59Z), each: reservoir `STOCK-UP`
  (short-by-48) → harvest **skipped** (block-aware) → discovery **dry-guard-skipped** (`went dry
  at 7,006 terms … skipping the claude-sonnet-5 call`) → finder run 1 + run 2 both abort
  `No active terms to process` in ~0.8s → two-consecutive-failure **hard_stop** → overlapped
  verify sweep (the productive part) → `evaluate-probes` (0 winners, all 3,814 already paused) →
  `done`. No relaunch storm, no thrash.
- **The verify lane did all the real work.** Representative session (04:53Z): 19 pitchable →
  10 STOPPED_EARLY (found + verified valid) → 10 promoted to `approved_hold`; 9 `no_email`/
  `invalid` swept to `needs_contact`. Per-session parked gain across the cycle:
  `[3,3,1,0,0,3,0,0,5,0,0,0,0,5,3,0,0,2,0,2,2,0,…,4,2,8,9,10,4,0,0]` — a modest trickle with a
  PT-morning cluster (the last easily-emailable backlog leads).
- **Term table essentially flat:** 6,998 (07-22) → 7,006 → 7,021 (+~23 all cycle, all from a
  single late discovery that produced ~0 pitchable). The `+19` frontier verticals have not moved
  the needle two cycles running.
- **YouTube capacity nearly gone:** 0 working direct keys, RapidAPI at **229,966/235,000
  requests (~98%)** and **4,980/5,000 search (~99.6%)** — a standing risk that a term refuel
  couldn't even be mined against.

## Why nothing bigger shipped (and what did)

The cheap code workarounds have been exhausted for days (circuit-breaker → block-aware harvest →
block-state backoff → discovery dry-guard → `FRONTIER_VERTICALS +19` → `supply_health` in the
feed — each buying less). There is **no high-confidence code fix that reopens finding**; that
lever is infra (rotate the VPS egress IP / proxy) and, secondarily, YT API capacity and a second
term source — none of which this agent may touch (`.env`/secrets/infra are operator-owned).
Inventing more frontier verticals against a saturated 7,006-term table would be churn, not a fix.

**One durable fix shipped — orchestrator `345a17f`:** ground `fresh_finding_dead` on the finder's
own net-new-channel count instead of the flaky per-pass `fresh_pitchable` counter, and add
`net_new_channels_written` / `net_new_passes_with_writes` to the authoritative debrief JSON.

- **Why it matters.** Two figures already in the snapshot mislead about finding: `discovered_today`
  is churn-inflated (833 vs 7 real), and the per-pass `fresh_pitchable` counter is known to
  *undercount* DB yield (07-19/07-20: ~10 logged vs ~294 real). Keying `fresh_finding_dead` off
  that counter risks a **false "dead"** on a healthy day whose counter simply under-reported — and
  leaves a reader (or a future automated decision) able to read a churn-inflated day as healthy.
- **What it does.** Sums `New channels written: N` from the finder RUN SUMMARY across the cycle's
  session logs (mirrors the existing `fatalSignaturesToday` mtime-windowed scan) — the exact manual
  grep every block-era debrief has done by hand — and flags dead at `< 30` net-new (a working
  finder writes hundreds+; block-era dead days sit at 7–19).
- **Verified.** `npm run typecheck` clean; logic run against the live 07-23 logs returns
  `{ total: 7, passes_with_writes: 3 }`, `fresh_finding_dead = true`. Observability, not a cure.

## Ranked levers (unchanged priority; all above the code line)

1. **Rotate the VPS egress IP / proxy** — the only lever that reopens net-new finding; 7 days
   running, no code path can lift it.
2. **Restore YouTube API capacity** — 0 direct keys + RapidAPI ~98%; must land alongside the IP
   fix or a refuel can't be mined.
3. **A second independent term source (DataForSEO)** — kills the single-point-of-failure that took
   the finder down for a week. Needs credentials (operator).
4. **The `needs_contact` recovery engine (3,666)** — sidesteps both ceilings; biggest unbuilt
   lever, deferred by Casey.
5. **(Shipped) grounded finding-visibility** in the debrief feed (`net_new_channels_written`).

## Status caveat

Everything is **parked**, nothing sent — `approved_hold` holds until the email process is ready.
Today's +67 → **2,891 parked**; `needs_contact` → **3,666**. The loop was left running for the
next cycle: guardrails all held, and no halt flag is warranted — the block is a supply degrade,
not a money-path, git-state, or auth/quota failure.
