---
title: Lead Run Analysis — 2026-07-29
type: run-analysis
source: youtube
status: final
cycle_start: 2026-07-28T07:00:00Z
cycle_end: 2026-07-29T07:00:00Z
---

# Lead Run Analysis — 2026-07-29

**Headline: +0 parked — Day 13 of the block, but the "no code" streak
broke.** `approved_hold` never moved from **2,906**; `needs_contact` flat at
**3,685**. Both supply taps are empty at once (fresh finding dead since 07-17,
backlog verify-drain spent 07-26), so parking flatlines. The rate-limited
endpoint leaked enough to write **23 net-new channels** and **2 cleared the ≥6
bar** (1 Financial Planning, 1 Legal, up from 07-28's 0) — but **neither had a
verifiable email**, so 0 verified → **+0 parked**. The machine idled correctly:
**$0 Claude spend, 44 clean sessions, 0 crashes, 0 quota stops, no fix-agent
page, no halt flag, `fatal_signatures = []`.** **Unlike the last five days, I
shipped a real code fix** — a durable seed-rotation for the keyword harvest.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-29.json`)

| Metric | Value |
|---|---|
| `approved_hold` start → now | 2,906 → **2,906** (net **+0**) |
| `parked_today` / `done_parked_gain_sum` | 0 / 0 |
| `needs_contact` | **3,685** (flat) |
| Discovered today (total / pitchable ≥6 / verified) | 23 / **2** / 0 |
| Pitchable by niche | Financial Planning 1, Legal 1 |
| Discovered by review_status | `below_threshold: 20`, `unreviewed: 3` |
| Campaign sessions started / done | 44 / 44 |
| Finder runs / hard-stops | 52 / **44** |
| Fresh pitchable (sum) | **2** |
| Fades / discovers / promotes | 8 / 52 / 6 |
| Quota stops / time-budget stops | 0 / 0 |
| Net-new channels written / passes with writes | **23** / 5 (`fresh_finding_dead=true`) |
| Autocomplete blocked since | 2026-07-17 (**11.9 days** elapsed; **Day 13** of the block) |
| Block observations / term-starvation observations this cycle | 4 / 21 |
| Claude burn | **$0** (soft 75 / hard 150) |
| Fatal signatures | **[ ] (empty)** |

## What happened

Two independent paths can add a lead to `approved_hold`:

1. **Fresh finding** — the finder discovers a net-new creator, scores it ≥6,
   and verify recovers a deliverable email.
2. **Backlog recovery** — the verify lane recovers an email for a creator
   already sitting in the standing found-but-unverified pile.

Path (2)'s backlog was fully spent on 07-26. Path (1) has been ~dead since the
**07-17 autocomplete IP-block**, but the endpoint now **rate-limits rather than
hard-blocks**, so a trickle still leaks through. This cycle the leak was a touch
wider than 07-28: **23 net-new channels across 5 passes**, and **2 cleared the
≥6 bar** (07-28 cleared 0). But neither of the two pitchable creators had a
verifiable email, so **0 verified → +0 parked**. The remaining 21 scored below
the bar. The difference between +2 and +0 on any given day is *which*
saturated-vein creators the throttle lets through — **not** a change in the
machine. Ground truth from the authoritative feed: `fresh_pitchable_sum = 2`,
`fresh_finding_dead = true`.

The active term pool is exhausted with **no never-run paused terms left** ("active
pool exhausted and NO never-run paused terms remain" — the 07-10 anti-starvation
floor has nothing to reactivate), so the finder aborts `No active terms to
process` in ~0.8s on **44/44 sessions**, spending zero YouTube searches. 52
finder runs across the cycle, **50 of them at 0 fresh pitchable** — a dead supply
line with two lone flecks of 1.

**This is a graceful idle, not a stall.** A +0 day resembles a failure but is the
opposite: the loop is resting against a wall it cannot move from code, and doing
so cleanly.

## The one harvest that fired — and the waste it exposed

15 of 16 pre-flight harvests correctly **skipped** (6h block-backoff, `1d5d1f9`).
The 16th, at **05:13**, fired because the backoff window had expired and re-probed
the endpoint. It served **840 net-new terms — but from only 8 of 42 seeds** before
the circuit breaker tripped on sustained 403s, and the ICP-prefilter kept **1 of
840**.

Those 8 seeds are the **same front seeds** — UK property tax, inheritance tax UK,
cross-border tax, buyers-agent AU, estate-agent UK, SMSF, pension UK, super AU —
that the harvest re-mines on **every** re-probe. The breaker trips at the same
position in the seed list every time, so the **34 verticals behind the block
point** (aviation, regenerative medicine, manufacturing, M&A, public adjusters,
luxury assets) are **never reached** while blocked. Re-storming the same saturated
head extracts nothing new and only deepens the rate-limit. **That is the systemic
waste I fixed this cycle.**

## Self-improvement shipped this cycle: seed-rotation for the harvest

**finder `04b88fa` — `scripts/keyword-harvest.ts`: rotate the seed start offset so
blocked re-probes mine fresh slices.**

- **Mechanism.** Persist a start-offset in `logs/keyword-harvest/.seed-rotation.json`
  and **walk it forward by the number of seeds actually harvested each run**. So a
  block-truncated re-probe that stopped at seed 8 makes the next re-probe *start* at
  seed 8 — consecutive blocked runs cover the whole 42-seed list across ~6 runs
  instead of re-mining the same 8 forever.
- **Safe by construction.** No-op when unblocked: a full 42-seed harvest advances a
  full lap and wraps back to the same start, so the normal cadence is unchanged.
  Best-effort state file (missing/corrupt → offset 0); a `--seed-offset N` manual
  override is honoured. Only the built-in seed sets rotate; custom `--seeds` keep
  the caller's order.
- **Verified before commit.** Project typecheck clean (the repo's own config; bare
  `tsc` flags only pre-existing Map/Set-iteration target warnings, none on the new
  lines). Runtime simulation: 6 blocked re-probes now cover **42/42 unique seeds**
  (vs. ~8 re-mined forever), and an unblocked full lap wraps with **zero drift**.
- **Why this and not "nothing" like the last five days.** This isn't gating or
  observability churn — it's the first change in ~5 days that gives the one
  autonomous refill lever (the leak) **new ground to reach**. It's aligned with the
  07-24 finding: *the leak extracts real terms; don't gate it, make it reach more
  ground.* It's durable and self-clearing — when the egress IP rotates, the full
  cadence resumes and the rotation quietly wraps to a no-op.

**Honest scope.** The high-confidence win is efficiency + reach: stop re-mining 8
saturated seeds, spread the leak across all 42, ease pressure on the rate-limit.
Whether the 34 unreached verticals still hold keepable ICP terms is uncertain — but
they are the only untried ground an autonomous refill can come from, and this is
what lets the machine try them. I judged that a real, safe, targeted fix, not
invented churn.

## Why nothing else shipped

Every other guard is holding and I could not find a second high-confidence change:

- **`fatal_signatures` empty** for a 5th straight cycle — the 07-25 fix
  (`b007173`) correctly suppresses the benign drought hard-stop so it can't
  masquerade as a fatal `finder_hard_wall`, and the fix-agent correctly never
  paged.
- **Every self-healing guard firing:** harvest skipped 15/16 (block-backoff),
  discovery dry-guard suppressed the sonnet call on frozen-table passes,
  `evaluate-probes` re-wrote 0 already-paused losers, 44 sessions rested ~31 min
  apart with no thrash.
- **$0 spend, 0 crashes, 0 unhandled rejections, 0 quota stops, no halt flag.**
- **Auto-resume intact:** the block-backoff is self-clearing, so when the egress
  IP rotates the harvest fires on the first clean session and normal supply
  resumes with no intervention — now walking through all 42 seeds as it goes.

The `evaluate-probes` "promoted 0 winners" pattern persists (3,888 probes already
paused, qr < 4%) — but that is the correct behaviour on saturated ground, and the
open lever there (a lower/cumulative `PROBE_PROMOTE_RATE`) is a tuning call for
Casey, not a safe autonomous change. The 07-27 revert (`4154971`) is the standing
proof that forcing a marginal campaign-layer change here is net-negative churn.

## Ranked levers (all but the shipped fix are outside the code I can touch)

1. **Rotate the VPS egress IP / proxy** (infra, Day 13). The one action that
   reopens fresh finding at volume — harvest, LLM discovery, and the
   anti-starvation floor all sit downstream of a term refuel this endpoint gates.
   Today's fix helps the machine *use* the leak better; only an IP rotation removes
   the ceiling.
2. **Build the `needs_contact` recovery engine (3,685).** With fresh finding
   reduced to sub-threshold noise and the backlog spent, this is the *only* lever
   that can reliably add a parked lead, and it bypasses both the block and the API
   ceiling. Recovering ~30% (~1,100) dwarfs a month of fresh finding at current
   supply. Build in `youtube-email-outreach-v1` when greenlit.
3. **Second independent term source (DataForSEO / Google Ads API).** Removes the
   single point of failure thirteen days have proven — a paid keyed source can't be
   IP-blackholed like the free endpoint.
4. **A non-halting escalation channel for a persistent supply block.** Thirteen
   days is a long time for a benign-but-total finding outage whose only signal is a
   human reading this debrief. A durable, low-noise operator ping after N days of
   `fresh_finding_dead && autocomplete_blocked` would close the loop without
   stopping it. Deferred — the rules keep the loop notify-silent; noted as the
   standing structural gap.

## Status caveat

Everything is **parked**, nothing sent. `approved_hold` holds at **2,906**,
`needs_contact` at **3,685** (both flat). The loop is left running for the next
cycle. One durable fix shipped to the finder (`04b88fa`, auto-syncs within ~2 min).
