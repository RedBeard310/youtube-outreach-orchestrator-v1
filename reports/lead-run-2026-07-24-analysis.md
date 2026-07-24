<!--
  Companion analysis for lead-run-2026-07-24.html
  Grounded in logs/autopilot-debrief-2026-07-24.json + campaign-2026-07-2{3,4}.jsonl
  + autopilot-sessions/*.log + autopilot-parked-history.jsonl.
-->

# 2026-07-24 — Day 8 of the block: the backlog ran dry

**Headline:** **+7 parked** in `approved_hold` (pool 2,896 → **2,903**) — the **lowest daily gain of
the entire autonomous run** — plus +17 → `needs_contact` (→ **3,683**); 280 discovered / **46
pitchable** / **12 email-verified**; **$0 Claude spend**, **43/43 sessions hard-stopped** (all
benign), no fix-agent page, no halt flag. The loop is healthy; the **supply** is not.

For seven days the pattern held: fresh finding ~dead, the verify lane draining the standing
found-but-unverified backlog carried parking (+151 → +86 → +52 → +67). **Today that inverted.**
Fresh finding flickered back — the finder wrote **52 net-new channels** (`fresh_finding_dead =
false`) — but the easily-emailable backlog is **spent**, so parking cratered anyway. For the first
time in the block, **both engines are sputtering at once.**

## Grounded numbers (from `logs/autopilot-debrief-2026-07-24.json`)

| Metric | Value | Prior day (07-23) |
|---|---|---|
| Parked → `approved_hold` | **+7** (2,896 → 2,903) | +67 |
| → `needs_contact` | +17 (→ 3,683) | +62 (→ 3,666) |
| Discovered today | **280** | 833 |
| Pitchable (score ≥ 6) | **46** | 148 |
| Email-verified | **12** | 70 |
| Verify rate (verified ÷ pitchable) | **~26%** | ~47% |
| **Net-new channels written (finder RUN SUMMARY)** | **52** (7 passes > 0) | 7 (3 passes) |
| `fresh_finding_dead` (shipped 07-23) | **false** (52 ≥ 30) | true (7 < 30) |
| Campaign sessions / hard-stopped | 43 / **43** | 45 / 44 |
| Finder runs / `fresh_pitchable` sum | 51 / **17** | 51 / 0 |
| Discover calls / fades / promotes | 51 / 8 / 13 | 50 / 7 / 21 |
| Quota stops / time-budget stops | 0 / 0 | 0 / 0 |
| Claude burn (fix-agent + debrief) | **$0** | $0 |
| Fatal signatures | `finder_hard_wall` (benign, no page) | `finder_hard_wall` (benign) |
| Autocomplete block age (`supply_health`) | **~6.9 days** (since 07-17 09:42Z) | ~5.9 days |

**The inversion, precisely.** Two ground-truth series drive the story:

- **Net-new channels per pass** (from RUN SUMMARY, chronological): `2, 7, 5, 0×26, 19, 14, 2,
  0×52, 3, 0×5` — two small clusters (a harvest squeaking through the rate-limit) then a flat sea.
  Sum **52** across **7** productive passes of ~90; `fresh_finding_dead = 52 < 30 = false`.
- **Parked gain per session**: `5, 0, 2, 0, 0, 0, 3, 0, …, 2, 0, [all zeros]` — **front-loaded**
  into the PT-morning hours (sum 12; net +7 after churn-out), then **zero for the entire back
  half**. `approved_hold` sat flat at **2,903 from 04:44Z onward** (parked-history confirms).

So finding is *not-dead-but-weak* and parking is *exhausted*. `discovered_today = 280` (down from
833/619 the prior two days) shows even the status-churn that inflated recent "discovered" counts
has thinned — the standing pool has less left to re-surface.

## What actually happened, hour by hour

- **43 clean sessions, ~31 min apart** (00:06Z → 07:11Z on the 07-24 file; the cycle also spans
  the 07-23 PT-evening sessions). Each: reservoir `STOCK-UP` (short-by-48) → harvest **skipped**
  (block-aware, `reason: autocomplete_blocked`) → discovery **dry-guard-skipped** (`went dry at
  7,038 terms … skipping the claude-sonnet-5 call`) → finder run 1 aborts `No active terms` →
  run 2 same → two-consecutive-failure **hard_stop** → overlapped verify sweep → `evaluate-probes`
  (0 winners; 3,844 already paused, skipped) → `done`. No relaunch storm, no thrash.
- **One session (04:47Z) let the harvest through.** The block-state backoff
  (`AUTOCOMPLETE_BLOCK_BACKOFF_HOURS`=6) expired, so the campaign re-probed with a full harvest.
  It served **8 of 42 seeds (~2,000 requests, 891 net-new terms)** before the a–z expansion began
  returning `HTTP 403`; the circuit breaker tripped at **8 consecutive 403s**, emitted
  `AUTOCOMPLETE_ENDPOINT_BLOCKED`, and re-stamped the block. The Haiku ICP-prefilter kept **3 of
  891** (saturated veins), wrote 3 probes, the finder mined them → **3 net-new, 0 pitchable**.
  This confirms the endpoint is **rate-limiting, not hard-blocking** — it answers a burst, then
  throttles.
- **Term table essentially flat:** ~7,035 → 7,038 across the cycle. The `+19 FRONTIER_VERTICALS`
  bet (07-21) still hasn't converted — three cycles running.
- **YouTube capacity nearly gone:** 0 working direct keys; RapidAPI at **234,999/235,000 requests
  (~99.99%)**, **4,999/5,000 search**. Even a refilled term pool couldn't be mined.

## Why nothing shipped to the pipeline today (deliberate)

The rules for this agent are explicit: prefer durable self-healing fixes, but **if there is no
high-confidence improvement, say so — do not invent churn.** Today there is none, and I verified
that rather than assumed it:

1. **The harvest is not futile — so don't gate it.** The obvious candidate was "stop the full
   harvest re-firing into the block." But the logs show it served ~2,000 requests and extracted
   **891 net-new terms** before the rate-limit tripped. Gating it harder would throw away the
   small real term yield *and* risk slowing the 6-hour auto-resume that will restart the pipeline
   the moment Casey rotates the IP. Net-negative.
2. **The 891→3 keep rate is a supply fact, not a bug.** The ICP-prefilter is correctly rejecting
   out-of-ICP terms off veins we've mined for weeks. No code fixes vein saturation.
3. **Yesterday's `fresh_finding_dead` metric was verified correct** against the live logs (52
   net-new, 7 passes > 0, `false`). It is doing exactly its job — separating "finding is nonzero"
   from "parking is healthy," which is precisely the distinction today needed. Re-touching a
   one-day-old metric on a single gray-zone data point (52 net-new but only +7 parked) would be
   the churn the rules warn against; the two signals are correctly surfaced *separately*
   (`net_new_channels_written` vs `parked_today`).
4. **The structural levers are all above the code line** — rotate egress IP, restore YT keys, add
   a second term source, build the `needs_contact` engine. None are things this agent may touch
   (infra/secrets are operator-owned), and inventing more frontier verticals against a saturated
   7,038-term table is proven churn (07-23 said the same).

Every cheap code workaround has already shipped over the last week (circuit-breaker → block-aware
harvest → block-state backoff → discovery dry-guard → `FRONTIER_VERTICALS +19` → `supply_health`
in the feed → `fresh_finding_dead` grounding), each buying less. The disciplined move today is to
report the diagnosis and hold.

## Ranked levers (priority shift: `needs_contact` is now #2, not #4)

1. **Rotate the VPS egress IP / proxy** — the only lever that reopens full net-new finding; 8 days
   running, no code path can lift it.
2. **The `needs_contact` recovery engine (3,683).** With the backlog-drain exhausted, this is no
   longer just the biggest *future* lever — it is the **only** lever that still adds parked leads
   at all. 3,683 found-and-scored creators with no verifiable email. Deferred by Casey; a build in
   `youtube-email-outreach-v1` when greenlit.
3. **Restore YouTube API capacity** — 0 direct keys + RapidAPI ~99.99%; must land with the IP fix.
4. **A second independent term source (DataForSEO)** — kills the single-point-of-failure that took
   finding down for eight days. Needs credentials (operator).
5. **(Held) no pipeline code shipped** — the constraint is infra; a forced change would be churn.

## Status caveat

Everything is **parked**, nothing sent — `approved_hold` holds until the email process is ready.
Today's +7 → **2,903 parked**; `needs_contact` → **3,683**. The loop was left running for the next
cycle: guardrails all held ($0, 0 crashes, benign hard-walls, no page), and no halt flag is
warranted — an 8-day supply degrade is not a money-path, git-state, or auth/quota failure. The cure
is infra Casey owns.
