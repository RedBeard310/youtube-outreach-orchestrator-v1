---
title: Lead Run Analysis — 2026-08-01
type: run-analysis
date: 2026-08-01
source: youtube-outreach-orchestrator-v1 (autopilot debrief)
cycle_window_utc: 2026-07-31T07:00:00Z → 2026-08-01T07:00:00Z (the 2026-07-31 PT calendar day)
---

# Lead Run Analysis — 2026-08-01

**Headline: +404 parked in `approved_hold` (pool 3,019 → 3,423) — 5.6× the prior day's
+72 and by far the largest single-cycle gain of the entire 15-day autocomplete IP-block.
The block *ended* this cycle: the 07-31 proxy fix restored keyword harvest (first clean
run in two weeks at 05:41Z), the term pool refilled, and the finder went from flat-lining
all morning to cresting at 27 fresh pitchable in a single pass. $0 Claude spend, 0 quota
stops, 0 crashes, 0 fatal signatures, no fix-agent page, no halt flag.**

## Grounded numbers (from `logs/autopilot-debrief-2026-08-01.json`)

| Metric | Value |
|---|---|
| `approved_hold` now / at cycle start | **3,423 / 3,019** → **+404** |
| `parked_today` / `done_parked_gain_sum` | 404 / 382 |
| `needs_contact` now | **4,231** (+386 this cycle) |
| Discovered today (total new rows) | **3,619** |
| Pitchable (score ≥6) | **843** |
| Email-verified | **391** |
| `net_new_channels_written` | **1,396** |
| `net_new_passes_with_writes` | 109 |
| `fresh_finding_dead` | **false** |
| `autocomplete_blocked` (flag) / days | true / 14.9 — **STALE** (see below) |
| `autocomplete_block_obs_this_cycle` | **1** |
| `term_starvation_obs_this_cycle` | 12 |
| Campaign sessions started / done | 29 / 29 |
| Finder runs / fresh-pitchable sum | 136 / **629** (peak 27) |
| Fades / discovers / promotes | 96 / 121 / 110 |
| Hard stops / quota stops / time-budget stops | **23** / **0** / 6 |
| Burn (Claude) today | **$0.00** (soft 75 / hard 150) |
| Fatal signatures | **[] empty** |

Cross-checks: `approved_hold` delta (3,423−3,019 = 404) = `parked_today` (404).
`needs_contact` +386 matches `by_review_status.needs_contact` (386). Of 843 pitchable,
404 had a verifiable email (→ hold) and 386 did not (→ `needs_contact`) — a ~51% verify
split on host-identified pitchable leads, in line with the firm-heavy frontier.

## The `autocomplete_blocked: true` flag is stale — the block actually broke

The debrief JSON still reports `autocomplete_blocked: true` / `14.9 days`, but this is a
**stale marker**, not live state. Direct evidence it lifted:

- `logs/campaign-2026-08-01.jsonl` at **05:41:13Z**: `{"event":"keyword_harvest","skipped":false,"exit":0,"cap":"200"}` — the first successful harvest in two weeks.
- Every `keyword_harvest` line *after* 05:41Z is `skipped:true` with `since_hours` < the 4h staleness cadence — i.e. skipped by the **normal cooldown**, not the 403 circuit-breaker.
- `autocomplete_block_obs_this_cycle: 1` — only a single block observation across the whole cycle, early, before the fix took hold.

Root cause of the 15-day outage was the autocomplete endpoint IP-blocking our egress
(sustained HTTP 403). The fix — routing the harvest through a **US Webshare egress-proxy
pool** (per the finder's 07-31 graph-sweep proxy commits + the `autocomplete-ip-block`
memory) — is infra, and lives *outside* the 5 pipeline repos, so no code change here was
needed to end the outage.

## Shape of the day — dead morning → climbing night

136 finder passes, chronological fresh-pitchable (from the two `campaign-*.jsonl`):

- **First ~14h (outage tail):** 48 of 136 passes returned 0; the term pool was still
  drained from the block. The finder repeatedly aborted on *"No active terms to process,"*
  two consecutive aborts tripped the two-strikes wall → **23 `hard_stop` back-offs**, each
  followed by the loop's correct 30-min `QUOTA_WAIT` sleep. **No thrash** (the 07-13-era
  2.5-min relaunch loop is fixed), no quota burned, no Claude spent.
- **Back half (post-harvest recovery):** once the term table grew, discovery re-armed and
  yield ramped **steadily** — crests of 23 / 24 / 26 / 27 fresh pitchable per pass, the
  healthiest passes of the entire block. This is a *sustained ramp*, not the isolated
  bursts of 07-30/07-31 — the signature of the block lifting, not leaking.

Peak single pass: **27** fresh pitchable. Sum: **629** across all passes.

## Niche mix (pitchable, score ≥6)

Real Estate & Property **327** · Health & Wellness Clinics **153** · Coaching & Consulting
**133** · Legal Services 36 · Relocation & Lifestyle Design 35 · Financial Planning 32 ·
Other 28 · SaaS demos 24 · Business Growth Coaching 18 · Marketing Agencies 14 · rest ≤9.

Firm-heavy verticals (real estate, clinics, legal, financial) dominate — the frontier
veins seeded in prior cycles finally paying out now that terms can flow to them.

## What broke → what's fixed

| Issue | Mechanism | Status |
|---|---|---|
| 15-day term-refuel outage | Autocomplete 403-blocked since 07-17 → no new terms → pool starves | **Fixed 07-31** (US Webshare proxy; harvest exit-0 at 05:41Z) |
| Morning flat-line (48 dead passes) | Outage tail — pool drained until first clean harvest mid-cycle | Self-resolved as harvest refilled the table |
| `hard_stop` mislabels supply-exhaustion as infra wall | Finder exits 1 for both empty-pool and quota/keys/Airtable | **Fixed this cycle** (see below) |
| Proxy pool = single point of failure for fresh supply | All new terms flow through one egress-IP pool | Open — monitor pool health (rec #2) |
| Email is the ceiling, not finding | 386 score-≥6 → `needs_contact` (no verifiable email) | Open — deferred recovery engine (rec #1) |

## Self-improvement shipped this cycle

**Accurate `term_supply_exhausted` labeling** (finder + orchestrator). The systemic issue
the cycle exposed was diagnostic, not behavioral: all 23 `hard_stop` events logged as an
indistinguishable *"hard wall (quota/keys/Airtable)"* when the real cause was a dry term
pool. Every software defense for term-starvation already exists from prior cycles
(anti-starvation floor, discovery 3h TTL re-arm, frontier expansion, checkin
`benignNoActiveTerms` + auto harvest-kick, 30-min loop back-off) and all behaved
correctly — so the right fix is to make the failure *self-describing*:

- `youtube-lead-finder-v1/src/cli/agent.ts` — the finder now exits **3** (not 1) when it
  aborts specifically on *"No active terms to process."* Exit 3 stays nonzero, so every
  existing `!== 0` caller is unaffected (verified: no caller checks `=== 1`).
- `youtube-outreach-orchestrator-v1/src/drivers/campaign.ts` — the hard-wall detector now
  reads exit 3 as benign supply-exhaustion and logs `{event:hard_stop, reason:"term_supply_exhausted"}`
  with an accurate message, vs `reason:"hard_wall"` for genuine quota/keys/Airtable failures.

Zero behavioral change to mining or quota (no 07-10 regression risk); both repos typecheck
clean. This makes the next term-refuel incident instantly diagnosable in the logs and lets
the debrief harness stop counting benign morning back-offs as infra alarms.

## Recommended next — ranked

1. **The `needs_contact` recovery engine (biggest lever, still deferred).** Pool now
   **4,231**, grew +386 today alone — nearly matching the +404 that parked. With finding
   restored this is unambiguously the ceiling; recovering ~30% (~1,270) dwarfs a day of
   fresh finding. Awaiting greenlight (build lives in `youtube-email-outreach-v1`).
2. **Monitor the egress-proxy pool as first-class infra.** Fresh supply now depends
   entirely on the US Webshare pool staying un-blocked. Add a harvest-exit / 403-rate
   signal to the hourly check-in so a re-block is caught in an hour, not after another
   15-day silent starve.
3. **Split `hard_stop` by the new `reason` field in the debrief harness** — so
   `term_supply_exhausted` back-offs never again read as an infra alarm.
4. **Ride the firm-heavy frontier while terms flow** — keep `--frontier` on; let
   anti-starvation + probe-promotion compound now that the term engine is the thing that
   works, not the bottleneck.

## Status caveat

Everything is **parked**, nothing sent — `approved_hold` is a deliberate holding lane.
Pool now **3,423** (`needs_contact` 4,231). Campaign ran clean all cycle: $0 Claude spend,
0 quota stops, 0 crashes, no fix-agent page, no halt flag. Loop left running.
