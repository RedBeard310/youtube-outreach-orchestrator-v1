---
title: Lead Run Analysis — 2026-07-28
type: run-analysis
source: youtube
status: final
cycle_start: 2026-07-27T07:00:00Z
cycle_end: 2026-07-28T07:00:00Z
---

# Lead Run Analysis — 2026-07-28

**Headline: +0 parked — back to the floor.** Day 12 of the autocomplete
IP-block. `approved_hold` never moved from **2,906**; `needs_contact` flat at
**3,685**. Yesterday the IP-throttled endpoint leaked enough for a faint **+2**;
today the discovery lane again invented a trickle of fresh probe veins — the term
table crept **7,050 → 7,069** and the finder wrote **13 net-new channels** — but
**all 13 scored below the ≥6 pitch bar** (12 `below_threshold`, 1 `unreviewed`).
0 pitchable → 0 verified → **+0 parked**. The machine idled correctly: **$0
Claude spend, 44 clean sessions, 0 crashes, 0 quota stops, no fix-agent page, no
halt flag.** No code shipped — deliberately.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-28.json`)

| Metric | Value |
|---|---|
| `approved_hold` start → now | 2,906 → **2,906** (net **+0**) |
| `parked_today` / `done_parked_gain_sum` | 0 / 0 |
| `needs_contact` | **3,685** (flat) |
| Discovered today (total / pitchable ≥6 / verified) | 13 / **0** / 0 |
| Discovered by review_status | `below_threshold: 12`, `unreviewed: 1` |
| Campaign sessions started / done | 44 / 44 |
| Finder runs / hard-stops | 51 / **44** |
| Fresh pitchable (sum) | **0** |
| Fades / discovers / promotes | 7 / 51 / **0** |
| Quota stops / time-budget stops | 0 / 0 |
| Net-new channels written / passes with writes | **13** / 3 (`fresh_finding_dead=true`) |
| Autocomplete blocked since | 2026-07-17 (**10.9 days** elapsed; **Day 12** of the block) |
| Block observations / term-starvation observations this cycle | 2 / 22 |
| Claude burn | **$0** (soft 75 / hard 150) |
| Fatal signatures | **[ ] (empty)** |

## What happened

Two independent paths can add a lead to `approved_hold`:

1. **Fresh finding** — the finder discovers a net-new creator, scores it ≥6, and
   verify recovers a deliverable email.
2. **Backlog recovery** — the verify lane recovers an email for a creator already
   sitting in the standing found-but-unverified pile.

Path (2)'s backlog was fully spent on 07-26. Path (1) has been ~dead since the
**07-17 autocomplete IP-block**, but the endpoint now **rate-limits rather than
hard-blocks**, so a trickle still leaks through. That trickle is the whole story
of the last three days:

- **07-26:** table frozen at 7,048, 1 net-new channel, below threshold → **+0**.
- **07-27:** endpoint leaked ~17 channels, 4 cleared ≥6, 2 had verifiable emails
  → **+2** (a verify-path flicker).
- **07-28:** discovery dry-guard re-armed every ~3h and leaked enough to move the
  term table **7,050 → 7,069** (+19) and write **13 net-new channels across 3
  passes** — but every one scored **below the ≥6 bar**. 0 pitchable → 0 to verify
  → **+0**.

The difference between +2 and +0 is which saturated-vein creators the throttle
let through on a given day, **not** a change in the machine. Ground truth from the
authoritative feed: `fresh_pitchable_sum = 0`, `fresh_finding_dead = true`. The
active term pool is exhausted with **no never-run paused terms left** ("active
pool exhausted and NO never-run paused terms remain" — the 07-10 anti-starvation
floor has nothing to reactivate), so the finder aborts `No active terms to
process` in ~0.8s on **44/44 sessions**, spending zero YouTube searches. The
harvest correctly skips every session (block-backoff `1d5d1f9`).

**This is a graceful idle, not a stall.** A +0 day resembles a failure but is the
opposite: the loop is resting against a wall it cannot move from code.

## Why the leaked terms don't help

With the harvest IP-blocked, the LLM frontier-discovery lane is the only term
source still firing. Its dry-guard re-arms every ~3h and leaked enough this cycle
to grow the table by 19 and write 13 channels — but that is the **same ground the
finder has mined for weeks**. The ICP-prefilter and the ≥6 score gate strip
essentially all of it (as on 07-21→07-24, verify on leaked-vein channels ran
~26% vs the backlog's ~47%). Discovery is producing **motion, not leads** —
`evaluate-probes` promoted **0 winners** again (qr < 4%; 3,875 probes already
paused, re-wrote 0, 07-19 fix holding), so the table crept but never compounded
into keepable veins.

## Why nothing broke (and the 07-25 fix is confirmed, 4th straight cycle)

- **`fatal_signatures` came back empty.** The 07-25 fix (orchestrator `b007173`)
  suppresses the benign drought hard-stop so it stops masquerading as a fatal
  `finder_hard_wall`. Today's authoritative JSON shows `[]` — the fix works and
  the fix-agent correctly never paged on a known-benign drought.
- **Every self-healing guard is holding:** harvest skipped every session
  (block-backoff), discovery dry-guard suppressed the sonnet call on passes where
  the table hadn't grown, `evaluate-probes` promoted 0 and re-wrote 0
  already-paused losers ("3875 already paused, skipped"), 44 sessions rested a
  clean **~31 min apart** (00:12 → 07:12) with no thrash.
- **$0 spend, 0 crashes, 0 unhandled rejections, 0 quota stops, no halt flag.** A
  full grep of the cycle's session logs for `ENOTFOUND` / `ECONN` / `unhandled` /
  `exception` / `429` / crash signatures came back clean.

## Self-improvement this cycle: none — deliberately

I verified end-to-end that the loop is **idle-optimal** and could not find a
high-confidence, high-value code change:

- No fatal signatures (the 07-25 fix confirmed working, `[]`, 4th cycle).
- No thrash, no crash, no wasted tokens ($0) — the discovery dry-guard,
  block-backoff, anti-starvation floor, and probe-pause skip are all firing
  correctly; 0 wasted Airtable writes, 0 wasted YouTube searches.
- Debrief data + HTML generated cleanly (empty stderr on both).
- Auto-resume path is intact: the block-backoff is self-clearing, so when the
  egress IP rotates the harvest fires on the first clean session, the term table
  grows, discovery re-arms, and the finder mines again — no intervention.

Every cheap durable fix has already landed across the 12-day block (circuit
breaker → block-aware harvest → block-backoff → dry-guard → `+19` verticals →
`supply_health` feed → `fresh_finding_dead` grounding → `fatal_signatures`
suppression), each buying less. **07-27 proved the churn risk directly:** a
drafted campaign-layer discovery-backoff guard was committed then **reverted**
(`4154971`) once the logs showed it was redundant with the finder's existing
07-14 TTL dry-guard and would fail-open on ~80% of sessions. The binding
constraint is now **100% infra** (egress-IP rotation + no YouTube API headroom)
plus the **unbuilt `needs_contact` engine** — neither a safe autonomous code
change. Per the debrief-agent rule ("If you have no high-confidence improvement,
say so — do NOT invent churn"), I shipped nothing.

## Ranked levers (all outside the code I can touch)

1. **Rotate the VPS egress IP / proxy** (infra, 12 days). The one action that
   reopens fresh finding at volume — harvest, LLM discovery, and the
   anti-starvation floor all sit downstream of a term refuel this endpoint gates.
   The block has now outlived every cheap code workaround; the gap is an operator
   action, not an engineering one.
2. **Build the `needs_contact` recovery engine (3,685).** With fresh finding
   reduced to sub-threshold noise, this is the *only* lever that can add a parked
   lead reliably, and it bypasses both the block and the API ceiling. Recovering
   ~30% (~1,100) dwarfs a month of fresh finding at current supply. Build in
   `youtube-email-outreach-v1` when greenlit.
3. **A non-halting escalation channel for a persistent supply block.** Twelve
   days is a long time for a benign-but-total finding outage whose only signal is
   a human reading this debrief. The autopilot's sole escalation is the halt flag
   — too blunt for "still running, still $0, still finding nothing." A durable,
   low-noise operator ping after N days of `fresh_finding_dead &&
   autocomplete_blocked` would close the loop without stopping it. Deferred: the
   rules keep the loop notify-silent, so noting it as the standing structural gap
   rather than shipping it unilaterally.
4. **Second independent term source (DataForSEO).** Removes the single point of
   failure the last twelve days have proven — a paid keyed source can't be
   IP-blackholed like the free endpoint.

## Status caveat

Everything is **parked**, nothing sent. `approved_hold` holds at **2,906**,
`needs_contact` at **3,685** (both flat). The loop is left running for the next
cycle.
