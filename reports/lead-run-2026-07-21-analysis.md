---
title: Lead Run Analysis — 2026-07-21
type: run-analysis
source: youtube-outreach-orchestrator-v1 (autopilot debrief)
cycle: 2026-07-20T07:00:00Z → 2026-07-21T07:00:00Z
status: parked (nothing sent)
---

# 2026-07-21 — the workaround ran out of road

**Headline:** **+86 parked** in `approved_hold` (pool 2,677 → **2,763**), +87 → `needs_contact`
(→ **3,556**). **207 pitchable** of **737 discovered**, verify holding **~50%**. The finder's
frontier-discovery lane — which had carried the whole pipeline through four days of the
autocomplete IP-block by having Claude *invent* fresh veins — **saturated**: it generated 40
candidates a pass and **every one deduped to already-known** against the 6,983-term table,
**0 net-new all cycle**. With both independent term sources dry at once, the finder hard-stopped
on **44/44 sessions** — but every self-healing guardrail held: **$0 Claude spend, 0 crashes,
0 quota stops, no fix-agent page, no halt flag.** A supply problem, not a bug.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-21.json`)

| Metric | Value | Prior day (07-20) |
|---|---|---|
| Parked → `approved_hold` | **+86** (2,677 → 2,763) | +151 |
| → `needs_contact` | +87 (→ 3,556) | +137 (→ 3,469) |
| Discovered today | 737 | 967 |
| Pitchable (score ≥ 6) | 207 | 294 |
| Email-verified / parked | 86 | 151 |
| Verify rate (parked ÷ parked+needs_contact) | ~49.7% | ~52% |
| Campaign sessions / all hard-stopped | 44 / **44** | 35 / 35 |
| Finder runs / `fresh_pitchable` sum | 49 / **0** | — / ~10 |
| Discover calls / fades / promotes | 49 / 5 / 28 | — |
| Keyword harvests / futile (ran into block) | 49 / **4** | — / 18 |
| Claude burn (autopilot fix-agent + debrief) | **$0** | $0 |
| Fatal signatures | `finder_hard_wall` (benign, no page) | `finder_hard_wall` (benign) |

### Pitchable by niche (discovered today) — the saturation fingerprint

Real Estate **45** (was 159 on 07-20), Coaching & Consulting 34, Health & Wellness Clinics **27**
(was 61), Business Growth Coaching 19, Marketing Agencies 17, Financial Planning 14, SaaS 14,
AI Automation 9, Relocation 9, Other 5, Sales Training 4, Video/Photo 3, Coding 2, Practice
Growth 2, Legal 1, Tax 1, Wealth 1.

The two 07-10 flagship frontier veins (Real Estate, Health clinics) **both roughly halved** — the
direct fingerprint of frontier saturation. The remaining pitchable is more diffuse (the LLM
casting wider but shallower over already-mined ground).

## The three questions

**Q1 — Why half of yesterday?** The frontier-discovery lane enumerated its own ground. Its 07-10
veins are mined out (RE 159→45, Health 61→27 pitchable), and every discovery pass this cycle
produced **0 unique in-ICP candidates** against the 6,983-term table. The loss is entirely in
*finding*; verify held ~50%.

**Q2 — Why hard-stop every session?** Both independent term sources were dry simultaneously for
the first time: the autocomplete harvest is IP-blocked (skipped 45/49) and the LLM frontier
produced 0 net-new. The active pool drained to empty — every run logged `[anti-starvation] active
pool exhausted and NO never-run paused terms remain` → `No active terms to process`, aborting in
0.8s. Two aborts = hard wall → session stops. `fresh_pitchable` summed to 0 across 49 runs.

**Q3 — Is it broken? No.** Every guardrail from the last 8 days held under the first real
dual-source wall: block-backoff cut futile harvests **18→4**; the discovery dry-guard suppressed
**51/65** sonnet calls; the check-in classified all **47** hard-walls benign and never paged;
the loop rested ~30 min between sessions (no thrash). $0, 0 crashes, no halt flag. The new fact is
only that the invent-a-vein workaround has a floor, and we reached it.

## What broke → what's fixed

- **07-10 frontier veins saturated (un-grown 11 days)** → **FIXED this cycle.** Shipped `f2250e7`
  in `youtube-lead-finder-v1`: **+19 in-ICP frontier verticals** — two whole categories were
  absent: (a) insurance / lending / mortgage FIRMS (publish emails, verify well), and (b) the
  biggest home-service TRADES coaching (roofing / HVAC / solar / plumbing / custom home builder /
  landscaping / pool / pest — only restoration/cleaning/epoxy/turf/lighting/foundation were
  listed). Module load-checked (91 entries, no dupes). The list's own comment invites exactly this
  ("grow this list as veins prove/saturate — the single highest-leverage knob on sustained
  volume"), and it hadn't grown since 07-10.
- **Both term sources dry at once** → OPEN. Harvest needs infra (rotate egress IP); no second
  independent source yet.
- **`fresh_pitchable` per-pass reads flat 0** → OPEN (reporting-debt, harmless). Every session
  instant-hard-walls before the counter accrues; `parked_gain` is the honest signal and
  fade→discover is guard-skipped anyway.
- **Discovery doesn't compound** → OPEN. `evaluate-probes` promoted 0 winners (3,700 probes all
  < 3.5% qr). The +19 verticals attack the *input* (net-new candidates), not the promotion side.
- **Block-backoff · dry-guard · benign-hardwall no-page** → CONFIRMED working under a real wall.

## Ranked next levers

1. **Rotate the VPS egress IP / proxy (infra, 5 days running, still #1).** Unblocks the
   autocomplete harvest — the proven-vein refuel. Not code-fixable.
2. **Watch the +19 frontier verticals next cycle (this cycle's shipped fix).** Confirm discovery
   writes net-new probes and the finder gets veins to mine while the harvest stays blocked.
3. **A second independent term source (DataForSEO).** Decouple supply from the one blockable
   endpoint + one saturating LLM — the structural fix behind #1 and #2.
4. **Make discovery compound.** Cumulative / lower probe-promotion so validated veins persist in
   the active pool instead of being re-invented and re-deduped to zero nightly.
5. **The `needs_contact` recovery engine (deferred).** 3,556 found-and-scored creators with no
   verified email (+87 today). Recovering even a third dwarfs a day of fresh finding and sidesteps
   the term-supply ceiling. Awaiting greenlight.

## Self-improvement shipped this cycle

- `youtube-lead-finder-v1` `f2250e7` — **autopilot-improve: widen `FRONTIER_VERTICALS` (+19).**
  Insurance/lending/mortgage firms + the big home-service trades coaching niches. Directly attacks
  today's binding constraint: gives the (unblocked) LLM discovery lane fresh ground so probes get
  written and the finder has active veins to mine even while the autocomplete harvest is
  IP-blocked. Load-verified before commit.

## Standing caveat

Everything is **parked**, nothing sent. `approved_hold` holds until the intended email process is
ready. The loop is **still running** for the next cycle — no human action required beyond the
standing infra ask (rotate the egress IP).
