# Lead Run Analysis — 2026-07-25 (Day 9 of the autocomplete IP-block)

**Headline: +1 parked — the emptiest day of the entire run.** Two independent supply
engines emptied on the same cycle. Fresh finding stayed dead behind the 9-day autocomplete
IP-block (old news), and the **backlog verify-drain that carried days 2–8 finally ran out**
(new). Nothing to find, nothing left to promote → +1. Not a failure — a machine idling
correctly against an unfixable wall. **$0 Claude spend, 0 crashes, 0 quota stops.**

## Grounded numbers (from `logs/autopilot-debrief-2026-07-25.json`)

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+1** | 2,903 → 2,904; lowest daily gain of the run |
| `needs_contact` pool | **3,683** | where the drained backlog has been landing all week |
| Net-new channels found (finder RUN SUMMARY) | **3** | was 52 on Day 8 → `fresh_finding_dead = true` |
| `discovered_today` | 3 total · **1 pitchable (≥6)** · 1 email-verified | the lone pitchable is Real Estate |
| Campaign sessions | 45 started / 45 done | reservoir **STOCK-UP on all 45** |
| Finder passes | 49 | fresh_pitchable_sum = **1** (one lone pass) |
| Hard stops | **45 / 45** | all benign ("No active terms to process") |
| Keyword harvest | fired **3×**, skipped **46×** | 6h block-backoff (`1d5d1f9`) holding |
| Quota stops / time-budget stops | 0 / 0 | finder aborts in ~0.8s, spends no searches |
| Claude burn | **$0** | soft $75 / hard $150 — untouched |
| Fatal signatures | `finder_hard_wall` (benign) | **fixed this cycle** — see below |
| Autocomplete block age | **7.9 days** (since 2026-07-17) | infra, not code-fixable |

## The three questions

**Q1 — Why did the day park almost nothing (+1)?** For days 2–8, finding was dead but the
**verify lane was draining a standing backlog** of found-but-unverified creators into
`approved_hold` (+151 → +86 → +67 → … → +7). That backlog is now exhausted. Today both taps
are dry simultaneously: nothing new found, nothing left to promote. The +1 is a single Real
Estate creator that surfaced and verified — noise. The drained backlog has been landing in
`needs_contact` (now **3,683**), a parking lot that drives no sends until the recovery engine
exists.

**Q2 — Why did fresh finding collapse from 52 net-new (Day 8) to 3 (Day 9)?** Same block, but
the reservoir hit **true zero**. Day 8 the endpoint was rate-limiting (a harvest leaked ~8
seeds / ~890 terms before the breaker tripped, so channels trickled in). Today the harvest
fired 3× and again leaked terms (862 net-new across 8 seeds at 02:17Z) — **but the ICP
prefilter kept 0 of 862**. Every leaked term is now a saturated vein. Downstream the finder
has an empty active pool **and** no never-run paused terms — the 07-10 anti-starvation floor
has nothing to reactivate (`"active pool exhausted and NO never-run paused terms remain"`) —
so it aborts in 0.8s with zero searches. That's why burn and quota are untouched: it's
resting, not grinding.

**Q3 — Is anything broken?** No. This is the self-healing design working: STOCK-UP → harvest
attempted → block-backoff skips it 46× / probes 3× → finder finds no terms → two clean aborts
→ benign hard-wall → loop rests 30 min → retries. 45×, $0, 0 crashes. The only genuine bug
was in reporting (fixed below).

## What I shipped (self-improvement)

**One fix — orchestrator `b007173`** (`scripts/autopilot/debrief-data.ts`,
`fatalSignaturesToday`): the debrief's authoritative `fatal_signatures_today` was matching
campaign.ts's `"two consecutive finder failures"` string even when the same session showed
`"No active terms to process"` — i.e. the routine, self-healing term-drought stop. On a
drought day **every** session logs it, so `finder_hard_wall` lit in the feed all 9 block-era
days. Two harms: (1) it cried wolf, forcing every debrief to hand-reason "is this benign?";
(2) worse, it **masked a genuine hard wall** — a real quota/keys/Airtable failure prints the
same "two consecutive finder failures" but *not* "No active terms," so it read identically to
the benign drought it was buried in. The fix mirrors the guard already living in `checkin.ts`
(086affb, 2026-07-19): suppress `finder_hard_wall` when the benign cause is present; still
surface it (and every other fatal pattern) otherwise.

**Verified** against the live cycle logs with a standalone harness before committing: today's
real session logs now yield `fatal_signatures = []` (all benign), while a synthetic quota-wall
tail with no "No active terms" line still surfaces `finder_hard_wall`. Typecheck clean.

Nothing else shipped. The pipeline is infra-bound and machine-optimized for this exact fault
(9 days of $0, crash-free graceful degradation prove it) — a forced pipeline change would be
churn, per the same reasoning as 07-24.

## Ranked next levers

1. **Rotate the VPS egress IP / proxy the harvest (infra, Day 9).** The only real unblock. The
   entire term engine rides one free, blockable endpoint. Code has made the outage graceful;
   only IP rotation makes it disappear. Everything below is downstream.
2. **Build the `needs_contact` recovery engine (3,683) — now the ONLY lever that adds parks.**
   Status changed today: for a week it was the "biggest future lever." With the verify-drain
   empty, it's the sole remaining source of new parks while finding is blocked. Recovering
   ~30% (~1,100) dwarfs a day of fresh finding. Deferred — but now urgent, not aspirational.
3. **Second independent term source (DataForSEO / Google Ads API).** Durable fix for #1: the
   discovery engine has a single point of failure. A second adapter means no single endpoint
   block can zero out finding for nine days. Named since 07-17; unbuilt.
4. **Make discovery compound (lower/cumulative promote bar).** `evaluate-probes` promoted 0
   winners for a 5th+ straight cycle (3,848 probes, none clear the qr bar). Discovery never
   accumulates. Only pays off once #1 lifts.

## Status caveat

Everything is **parked**, nothing sent. `approved_hold` 2,903 → **2,904**; `needs_contact`
**3,683**. Autopilot ran clean all cycle. One reporting-fidelity fix shipped and verified. The
lever that matters lives outside this repo: rotate the egress IP.
