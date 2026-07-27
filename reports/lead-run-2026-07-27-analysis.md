---
title: Lead Run Analysis — 2026-07-27
type: run-analysis
source: youtube
status: final
cycle_start: 2026-07-26T07:00:00Z
cycle_end: 2026-07-27T07:00:00Z
---

# Lead Run Analysis — 2026-07-27

**Headline: +2 parked — a faint flicker off the emptiest day, still effectively
dead.** Day 11 of the autocomplete IP-block. `approved_hold` crept **2,904 →
2,906**; `needs_contact` at **3,685**. Fresh finding twitched back on just enough
to matter — **17 net-new channels written**, 4 scored ≥6, 2 had verifiable emails
→ parked — but that's noise, not recovery. The machine idled correctly: **$0
Claude spend, 44 clean sessions, 0 crashes, 0 quota stops, no fix-agent page, no
halt flag.** One code candidate was drafted, checked against the logs, found to be
churn, and reverted — net **no code shipped**.

## Grounded numbers (from `logs/autopilot-debrief-2026-07-27.json`)

| Metric | Value |
|---|---|
| `approved_hold` start → now | 2,904 → **2,906** (net **+2**) |
| `parked_today` / `done_parked_gain_sum` | 2 / 2 |
| `needs_contact` | **3,685** |
| Discovered today (total / pitchable ≥6 / verified) | 17 / **4** / 2 |
| Pitchable by niche | Financial Planning 2, Real Estate 1, Legal 1 |
| Discovered by review_status | `below_threshold: 12`, `approved_hold: 2`, `needs_contact: 2`, `unreviewed: 1` |
| Campaign sessions started / done | 44 / 44 |
| Finder runs / hard-stops | 50 / **44** |
| Fresh pitchable (sum) | **4** |
| Fades / discovers / promotes | 6 / 50 / 3 |
| Quota stops / time-budget stops | 0 / 0 |
| Net-new channels written | **17** (`fresh_finding_dead=true`) |
| Autocomplete blocked since | 2026-07-17 (**9.9 days** elapsed; **Day 11** of the block) |
| Block observations / term-starvation observations this cycle | 3 / 19 |
| Discovery calls: sonnet gen / finder dry-skip | **10 / 40** (from session-log ground truth) |
| Claude burn | **$0** (soft 75 / hard 150) |
| Fatal signatures | **[ ] (empty)** |

## What happened

Two independent paths can add a lead to `approved_hold`:

1. **Fresh finding** — the finder discovers a net-new creator, scores it ≥6, and
   verify recovers a deliverable email.
2. **Backlog recovery** — the verify lane recovers an email for a creator already
   sitting in the standing found-but-unverified pile.

Since the **07-17 autocomplete IP-block**, path (1) has been ~dead and path (2)
carried days 2–9 (**+151 → +86 → +67 → +7 → +1**) before emptying to **+0** on
07-26. Today's **+2** is a small return of path (1): the endpoint behaved more
like *rate-limiting* than a hard block (the 07-24 pattern), so the finder wrote
**17 net-new channels** across the cycle instead of 07-26's 1. Of those, 4 cleared
the ≥6 bar (2 Financial Planning, 1 Real Estate, 1 Legal) and 2 had verifiable
emails → **+2 parked**. The other 12 landed `below_threshold`, 2 swept to
`needs_contact`, 1 `unreviewed`.

That flicker didn't change the shape of the day. The reservoir returned
**STOCK-UP · fresh 0 · need 48** on essentially every session, both refuel paths
dead-ended — the **harvest correctly skipped** (autocomplete 403, would only
deepen the block; skipped 47×) and the **LLM discovery** reconverged on the
saturated **7,054-term** table (every frontier batch dedupes to 0 novel) — so the
active pool ran empty, the finder aborted `No active terms to process` in ~0.8s
(zero YouTube searches spent), two aborts tripped the hard-wall, and the session
parked whatever verify had recovered. **44/44 sessions hard-stopped**, all benign,
resting a clean ~30 min apart (00:14 → 06:55).

**This is a graceful idle, not a stall.** A near-flat day resembles a failure but
is the opposite: the loop is resting against a wall it cannot move from code.

## Why nothing broke (and the prior fixes are confirmed)

- **`fatal_signatures` came back empty.** The 07-25 orchestrator fix (`b007173`)
  suppresses the benign drought hard-stop so it stops masquerading as a fatal
  `finder_hard_wall`. Today's authoritative JSON shows `[]` — the fix holds and
  the fix-agent correctly never paged on a known-benign drought.
- **Every self-healing guard is holding:** harvest skipped 47× (block-backoff
  `1d5d1f9`); the finder's **07-14 TTL dry-guard suppressed 40 of 50 discovery
  calls** (only 10 sonnet generations leaked, one per ~3h re-arm probe — the
  deliberate anti-deadlock behaviour); `evaluate-probes` promoted 3 and re-wrote 0
  already-paused losers; quota preserved (`quota_stops: 0`).
- **$0 spend, 0 crashes, 0 unhandled rejections, 0 quota stops, no halt flag.**

## Self-improvement this cycle: none — deliberately

I drafted **one** candidate and killed it on evidence rather than shipping it:

- **Candidate:** a campaign-layer *discovery dry-streak backoff* — persist a
  streak and skip the `claude-sonnet-5` discovery generation after N consecutive
  0-novel results while the term table is saturated. Committed (`e332f71`),
  type-checked, import-smoke-tested.
- **Why I reverted it (`4154971`):** ground truth from the session logs contradicted
  the premise. The waste I imagined ("~50 futile generations/cycle") isn't real —
  the finder's **existing 07-14 TTL dry-guard already suppressed 40 of 50**
  discovery calls; only **10** sonnet generations actually fired, by design (the
  3h TTL re-arm exists so a frozen table can't deadlock the finder permanently).
  Worse, my guard's fail-open parse treats a finder `[discover] skip … went dry`
  line (which prints no `N unique, in-ICP candidates`) as *productive*, so its
  streak would reset on ~80% of sessions and it would **almost never engage**. A
  redundant second dry-guard at the wrong layer, with real interaction risk, for
  pennies/day of saved LLM calls. If the finder's 3h re-probe were ever judged too
  eager under a confirmed multi-day block, the correct fix is to make *its* TTL
  adaptive — not to bolt a second guard onto the campaign.

Every cheap durable fix has already landed across the block (circuit-breaker →
block-aware harvest → block-backoff → dry-guard → `+19` verticals → `supply_health`
feed → `fresh_finding_dead` grounding → benign-hard-wall suppression), each buying
less. The binding constraint is **100% infra** (IP block + no YouTube API
headroom) plus the **unbuilt `needs_contact` engine**. Per the debrief-agent rule
("If you have no high-confidence improvement, say so — do NOT invent churn"), I
shipped nothing.

## The gap this exposed (not code, worth flagging)

The block is **11 days old** and has surfaced only in these daily debriefs. The
autopilot's only escalation is the **halt flag**, which stops everything — wrong
for a supply block where the parked inventory is fine and should keep being worked.
So there is **no non-halting "supply blocked N days — rotate the IP" nudge**. That
gap is a design task (the loop has no external notify path today), not a quick code
drop, so I did not force one this cycle — but it's why a 100%-infra blocker has run
unremediated for a week and a half.

## Ranked levers (all outside the code I can touch)

1. **Rotate the VPS egress IP / proxy** (infra, 11 days). The one action that
   reopens fresh finding — harvest, LLM discovery, and the anti-starvation floor
   all sit downstream of a term refuel this endpoint gates.
2. **Build the `needs_contact` recovery engine (3,685).** Now the highest-value
   *unblocked* lever — it needs no new finding, so it bypasses both the block and
   the API ceiling. Recovering ~30% (~1,100) dwarfs weeks of fresh finding at
   current supply. Build in `youtube-email-outreach-v1` when greenlit.
3. **A non-halting escalation channel** for the "fresh_finding_dead ≥ N cycles"
   shape — distinct from the halt flag, wired to something Casey actually watches.
4. **Second independent term source (DataForSEO).** A paid keyed source can't be
   IP-blackholed like the free autocomplete endpoint — removes the single point of
   failure entirely.

## Status caveat

Everything is **parked**, nothing sent. `approved_hold` at **2,906** (+2),
`needs_contact` at **3,685**. The loop is left running for the next cycle (no halt
flag — correct: the block is a supply issue, not a safety issue).
