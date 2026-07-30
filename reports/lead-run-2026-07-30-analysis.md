---
title: Lead Run Analysis — 2026-07-30
type: run-analysis
source: youtube
status: final
cycle_start: 2026-07-29T07:00:00Z
cycle_end: 2026-07-30T07:00:00Z
---

# Lead Run Analysis — 2026-07-30

**Headline: +41 parked — the flat week broke, fresh finding came back to life.**
`approved_hold` **2,906 → 2,947** (net **+41**), the biggest daily gain since
07-23's +67 and a step-change off six straight near-`+0` days;
`needs_contact` grew **3,685 → 3,752** (+67). This is **genuine fresh finding**,
not backlog churn: the verify-drain backlog was spent on 07-25, so with
`fresh_finding_dead=false` the **592 net-new channels written** are the only
possible source of the +41. The autocomplete IP-block is still up (**Day 14**),
but it eased from hard-wall back toward rate-limiting and the harvest breaker
punched a few seed-batches through in two windows. The machine ran clean:
**$0 Claude spend, 0 crashes, no fix-agent page, no halt flag.** **One durable
fix shipped** (orchestrator `eca0fa2`) — the debrief's fatal-signature scan now
mirrors the check-in, so a self-healed transient hard wall stops crying wolf.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-30.json`)

| Metric | Value |
|---|---|
| `approved_hold` start → now | 2,906 → **2,947** (net **+41**) |
| `parked_today` / `done_parked_gain_sum` | 41 / 41 |
| `needs_contact` | **3,752** (+67) |
| Discovered today (total / pitchable ≥6 / verified) | 592 / **111** / 41 |
| Pitchable by niche | Health & Wellness Clinics 39, Real Estate 31, Financial Planning 19, SaaS 5, Coaching 5, Legal 5, others 6 |
| Discovered by review_status | `below_threshold: 376`, `unreviewed: 90`, `needs_contact: 65`, `approved_hold: 41`, `demo_niche_excluded: 20` |
| Campaign sessions started / done | 37 / 37 |
| Finder runs / hard-stops | 98 / **36** |
| Fresh pitchable (sum) | **110** |
| Fades / discovers / promotes | 62 / 98 / 58 |
| Quota stops / time-budget stops | 0 / **1** |
| Net-new channels written / passes with writes | **592** / 60 (`fresh_finding_dead=false`) |
| Autocomplete blocked since | 2026-07-17 (**12.9 days** elapsed; **Day 14** of the block) |
| Block observations / term-starvation observations this cycle | 2 / 17 |
| Claude burn | **$0** (soft 75 / hard 150) |
| Fatal signatures | **`finder_hard_wall`** — a **false alarm** (see below); flips to **[ ]** with today's fix |

## What happened

Two independent paths can add a lead to `approved_hold`:

1. **Fresh finding** — the finder discovers a net-new creator, scores it ≥6, and
   verify recovers a deliverable email.
2. **Backlog recovery** — the verify lane recovers an email for a creator already
   sitting in the standing found-but-unverified pile.

Path (2)'s backlog was spent on 07-25, so for six days both taps ran dry and
parking flatlined near +0. **Today path (1) returned at real volume.** The
autocomplete endpoint is still IP-blocked (Day 14), so the keyword harvest still
can't refill cleanly — but the block behaves as *rate-limiting*, and the finder's
circuit breaker got **~8 of 42 seeds through** before tripping in two separate
windows. Those partial refills gave the finder terms to mine: **592 net-new
channels across 60 passes-with-writes**, **111 cleared the ≥6 bar**, **41 had a
verifiable email → +41 parked**. Verify held **~37%** (41/111) — the frontier
mix's usual rate. Niche mix was the classic frontier trio: **Health clinics 39 ·
Real Estate 31 · Financial Planning 19 = 80% of pitchable.**

**Shape of the day (98 passes, PT):**

- **00:19 → 11:34 PT — dead.** 22 single-pass drought sessions. The active pool
  drained overnight with **no never-run paused terms left** to reactivate (the
  07-10 anti-starvation floor is empty), and discovery is dry-locked at 7,283
  terms. Finder aborts `No active terms` in ~0.8s, 0 searches — a graceful idle.
- **12:06 → 14:01 PT — burst #1.** Two productive sessions (14 + 17 passes),
  **+28 parked**, ~298 channels. This is where the breaker won its seed-batches.
- **15:34 → 18:42 PT — dead again.** Pool re-drained; back to single-pass idles.
- **19:51 → 21:56 PT — burst #2.** The cycle's biggest session (23 passes, 250
  channels, ended on the **time budget**, not a wall) plus a 7-pass tail,
  **+13 parked**.
- **22:47 → 23:49 PT — dead.** Drought closes the cycle.

The drought-burst-drought-burst pattern *is* the block's signature: the machine
rests correctly (no grind, no thrash) whenever the throttle closes, and mines
whenever it opens. **+41 is real finding, but it's throttle-timed luck — it could
narrow back to +0 tomorrow.** Nothing here is a code cure; the cure is infra.

## The lone "fatal" signature was a false alarm — and it's what I fixed

`fatal_signatures_today = ["finder_hard_wall"]` looked alarming against an
otherwise-clean day. It isn't real. Traced to one session (`190626Z`, the
**+18-parked, 118-channel** noon burst): after 13 productive passes, runs 14 and
15 both aborted on a **transient Airtable 503**:

```
[runner] Unhandled error: The service is temporarily unavailable. Please retry shortly.
... AirtableError { error: 'SERVICE_UNAVAILABLE', statusCode: 503 }
```

Two nonzero finder exits in a row trip the campaign's hard-wall stop
(`two consecutive finder failures — likely a hard wall`). But Airtable just had a
~2-minute wobble: the session still finalized to `[campaign] DONE — parked 18
new`, and the **very next session (210130Z) wrote 180 channels**. The loop
self-healed exactly as designed.

The **hourly check-in already knew this**: its `benignFinalized` guard (added
07-29) skips the paid fix-agent when a hard-wall session still reaches
`[campaign] DONE`. It fired — logging `finder_hard_wall_benign` at 21:47 and
spending **$0**. The gap was that the **debrief's** `fatalSignaturesToday()`
scanner (`scripts/autopilot/debrief-data.ts`) had never been taught the same
carve-out — it only suppressed the `No active terms` drought case, so this
transient (which lacks that marker) lit `finder_hard_wall` in the authoritative
JSON. An inconsistency between the two scanners, not a pipeline fault.

## Self-improvement shipped this cycle (orchestrator `eca0fa2`)

`debrief-data.ts` — the fatal-signature scan now mirrors the check-in's benign
carve-outs for `finder_hard_wall`: a `two consecutive finder failures` stop is
benign not only on `No active terms to process` (07-19 logic) **but also when the
session reaches `[campaign] DONE`** after the stop (07-29 `benignFinalized`
logic). campaign.ts always runs its finalization sequence after a hard-wall stop,
so reaching DONE proves the session completed and the loop already retried — it
is definitionally not stuck. A genuine crash (module error, OOM, unhandled
campaign exception) never reaches DONE, so it is still surfaced; genuine
supply/quota walls are still visible via `supply_health` +
`hard_stops`/`quota_stops`.

**Verification:** `npx tsc --noEmit` clean; re-running `debrief-data.ts` against
the live 07-30 session logs flips `fatal_signatures_today` from
`["finder_hard_wall"]` → `[]`, with every other field unchanged (parked_today 41,
approved_hold_now 2947). Durable and self-healing — it makes the two scanners
agree so the feed can't cry wolf on a self-healed transient again.

## Why nothing else shipped — one candidate considered and declined

The tempting root-cause fix is finder-side: a transient Airtable 503 shouldn't
abort a whole productive run. Investigated it
(`youtube-lead-finder-v1`, branch `youtube-backend-auto-direct-first`): the
per-channel Airtable writes (`findByChannelId`, `appendDiscoveryTerm`,
`upsertProspect`) all sit under one loop-wide try/catch in
`src/runner/orchestrator.ts:183-428`, and `withRetry`
(`src/airtable/client.ts`) retries every error but gives up after only ~3.5s
(3 retries × 500ms base). So a 503 lasting longer than that rethrows → the
top-level catch aborts the run.

**Declined** as churn/net-negative: the observed outage spanned ~2 minutes across
both runs — **no sane retry budget rides that out** without making the finder
hang and masking a genuine Airtable death. The campaign's 30-min back-off-and-retry
**is** the correct recovery for a multi-minute infra wobble, and it worked (next
session wrote 180 channels). Bumping the retry constants would add hang-risk to
the money-path finder for a case the loop already handles well. The real defect
was purely the misclassification in the feed — which the shipped fix addresses at
zero risk. (Noted here so a future cycle doesn't re-discover the retry knob as if
it were untried.)

## Ranked levers (all but the shipped fix are outside the code I can safely touch)

1. **Rotate the VPS egress IP / proxy — Day 14.** Still the only lever that
   removes the ceiling. Today's +41 was the block *leaking*, not lifting; a clean
   IP restores the harvest and ends the drought-then-burst lottery.
2. **Build the `needs_contact` recovery engine (3,752).** The biggest *unblocked*
   lever — recovering ~30% (~1,100) dwarfs a throttle-fed finding day and
   sidesteps the term-supply ceiling entirely. Deferred by Casey; increasingly
   the highest-value build.
3. **A second, independent term source (DataForSEO).** The durable answer to the
   block *class* — one blockable free endpoint should not be the sole refuel.
4. **Make discovery compound.** The term table stayed ~7,283 all cycle; the LLM
   re-invents veins nightly instead of accreting them. A cumulative/lower promote
   bar would let discovery route around the block on its own.
5. **(Shipped)** Debrief ⟷ check-in fatal-signature consistency.

## Status caveat

Everything is **parked**, nothing sent — `approved_hold` holds until the intended
email process is ready. Today's **+41** brings the pool to **2,947**;
`needs_contact` is **3,752**. The loop ran unattended all cycle: **$0 Claude
spend, 0 crashes, no fix-agent page, no halt flag**, 37 self-healing sessions on
~31-min rests. Left running for the next cycle.
