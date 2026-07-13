# Lead Run Debrief — 2026-07-10 (technical / LLM-oriented)

> Companion to the HTML debrief. This is the deep version: full funnel decomposition,
> the three post-mortem questions answered from log evidence, and the mechanism behind
> each. Read the HTML first for the shape; read this for the *why* and the fixes.

## TL;DR

Today produced **+124 parked** (`approved_hold` 1,540 → 1,664) — roughly **26% of a normal
day** (07-09 = +480) — while **burning far more YouTube API quota than any prior run**
(86,993 channels fetched; 268 direct-key exhaustions; RapidAPI at **99.9%** of its daily
request cap). The two facts are the *same event* seen from two sides: **the finder spent
the afternoon re-mining saturated terms — full API cost per term, ~zero new output.**

There was a single dominant root cause (**term-starvation**), plus three aggravators (a
thinner starting supply, a network-crash that wasn't handled gracefully, and restart
churn). All four are now fixed or have a fix staged.

The morning ran *well* (yields of 64/46/73/54/59…). The day "sucked" because the **middle
of the day collapsed into 17 consecutive zero-yield finder passes** and never fully
recovered until a manual intervention.

---

## Funnel — full day (00:56 → 23:31, 87 finder passes)

| Stage | Count | Notes |
|---|---:|---|
| Channels **fetched** (YouTube API cost) | **86,993** | ~322–400 per pass, every pass |
| New channels **written** | **2,662** | **3.06% write rate** — 97% were dupes or hard-filtered |
| Fresh **pitchable** found (score ≥6 + host) | ~1,247 | summed `fresh_pitchable` across passes |
| **Verified-through** (reached a verify verdict) | ~304 | 124 valid-email + 180 dead-email |
| → `approved_hold` (**valid email**) | **+124** | the headline number |
| → `needs_contact` (**no valid email**) | **+180** | 2,173 → 2,353 |
| Still `unreviewed` (found, not yet verified) | +166 | 2,408 → 2,574 (left in the pool when stopped) |

**Efficiency markers (all abnormal):**
- **32.7 channels fetched per new lead written** (healthy day: far lower).
- **~700 channels fetched per parked lead** (86,993 / 124).
- **Email-valid rate 40.8%** (124 / 304) — below the ~47% baseline; frontier niches drag it.

**Operational counters:**
- Finder passes: **87** (campaign JSONL) / 74 logged run-files.
- Discovery cycles: **43**; fades: **38**.
- Campaign **restarts (start events): 10**.
- Direct YouTube key exhaustion/rotation events: **268**.
- RapidAPI peak: **234,755 / 235,000 requests (99.9%)**, **4,938 / 5,000 search (98.8%)**.
- Hard crash: **1** (ENOTFOUND, ~22:28).

**`fresh_pitchable` per pass (chronological) — the shape of the day:**
```
64 46 73 46 54 59 59 59 50 42 36 17 26 30 52 19   ← morning: strong
 0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  0  ← ★ 17 dead passes (term-starvation)
 6  6 13  6  6  4  5  5  7  7  5  2  8  6  6  3     ← weak recovery (marginal probes)
15  5 11 22  8 11  4 22 22  6 13  8 10 10 10  4 2 3 0   ← choppy
29 24 11 16  2 45  6 14  2  4  0  0  0             ← my session: frontier + the crash
26  8 18  5 12 12                                  ← post-fix: reactivated terms
```

---

## Q1 — Why did today suck so much? (+124 vs +480)

**Dominant cause: term-starvation.** The finder mines only `status=active` search terms,
ranked by `priority_score`. By mid-day the **entire active pool had decayed to negative
priority** — every active term was one that had already been mined once, yielded 2–4%
qualified, and been auto-demoted to ~−10. Meanwhile the good supply was all `paused`:
- **274 never-run terms** (`runs_executed=0`) sitting at priority 40–50, never mined.
- Every fresh discovery **probe**, which gets written `active@70` but is auto-paused after
  1–3 low-yield frontier passes (`overlap_warning`).

So `listActiveTerms()` had nothing left but exhausted negatives to hand the finder →
**17 consecutive passes at 0 fresh pitchable.** That dead stretch is most of why the day's
parked total is a quarter of normal.

**Aggravators (each real, each smaller):**
1. **Thinner starting supply.** Yesterday's +480 run drained the fresh proven-niche terms;
   today opened closer to the wall (the 07-09 "term-supply-limited" finding, one day later).
2. **Frontier verifies worse (~38% vs 47%).** Frontier niches (clinics, HOA/again-niche
   attorneys, fractional execs) surface reachable creators but with lower email
   deliverability → **+180 to `needs_contact` vs +124 to `approved_hold`.** Not wasted —
   parked for the recovery engine — but it means the day's *finding* under-converts to the
   headline metric.
3. **A mid-day network crash.** A transient `getaddrinfo ENOTFOUND api.airtable.com` (DNS
   blip, likely post-restart) threw inside the driver's own Airtable call. `ENOTFOUND` was
   **not** in the retry regex, and the floating `pendingVerify` promise had no `.catch`, so
   the rejection went unhandled and **hard-crashed the whole run** — bypassing the hard-wall
   resilience logic entirely. Cost: lost time + a from-scratch restart.
4. **Restart churn.** 10 campaign starts today; each re-runs the reservoir pre-flight +
   a discovery pass (API + wall-clock) and resets the in-memory `seen` set used for promote.

## Q2 — Why did it burn way more YouTube API than normal?

**Same root cause, cost side.** A *saturated* term is not cheap to discover it's saturated:
the finder still pays the **full** YouTube quota for it — a `search.list` call (100 units on
the direct API) plus channel-detail fetches for ~50 candidates — and only *then* finds that
every candidate is a dupe (already in our 40k+ DB) or fails a hard filter. Evidence:

- **86,993 channels fetched → 2,662 new (3.1%).** ~97% of the API spend bought nothing.
- Representative pass: `seen=400, filtered=318, dup=81, new=1`. Full cost, one lead.
- **268 direct-key exhaustions/rotations** — the 7 keys' daily 10k-unit budgets churned
  through repeatedly.
- **RapidAPI fallback hit 99.9% of its daily request cap (234,755/235,000)** and 98.8% of
  search — the safety net was itself nearly drained.

**Amplifiers stacked on top of the waste:**
- `--concurrent 2` **doubled the burn rate** (two passes hammering YouTube at once).
- **43 discovery cycles**, each running probe-validation mining = more `search.list` calls.
- **10 restarts**, each re-running the reservoir/discovery pre-flight.

The mining-saturated-terms behaviour makes API-burn and low-yield the *same* pathology:
paying full price to re-scan ground we've already stripped.

## Q3 — Why did it find way fewer leads than normal?

Because **the fresh-lead engine was starved of minable fresh terms**, not because the
channel universe ran out. Two proofs it was starvation, not true exhaustion:

1. **The instant it was unblocked, yield returned.** Manually reactivating the 274 never-run
   paused terms (→ `active@80`) produced **26 fresh pitchable on the very next pass** (then
   8, 18, 5, 12) — right back to healthy-run levels.
2. **The channel supply was never the limit** — the finder kept *seeing* 322–400 channels
   per pass; they were just overwhelmingly already-known or off-ICP for the exhausted terms
   it was forced to mine.

The fresh terms we *did* have weren't reaching the miner: discovery writes probes but they
auto-pause after a few low-yield frontier passes, `evaluate-probes` only promotes winners at
**campaign end**, and the 274 genuinely-untapped terms were paused and invisible. So supply
existed but was administratively locked out of the active pool.

---

## Fixes shipped today (staged in the orchestrator repo, not yet committed)

1. **Anti-crash: `ENOTFOUND`/`EAI_AGAIN`/`getaddrinfo`/`fetch failed` added to the retry
   regex** in `src/airtable.ts` — DNS/network blips now retry with backoff instead of
   throwing straight through `withRetry`.
2. **Floating-promise guard:** `pendingVerify = verifyPending(...).catch(...)` in
   `campaign.ts` — a failed verify can no longer become an unhandled rejection.
3. **Global net:** `process.on('unhandledRejection', …)` in `run-campaign.ts` logs loudly
   instead of hard-exiting a multi-hour autonomous run.
4. **Verify throughput:** ran at `APPROVED_CONCURRENCY=8` (was 4). Drained the pitchable
   pool fast enough that verify stopped being the bottleneck (pool stayed at 9–13).
5. **Manual unblock:** `scripts/reactivate-untapped.ts` (new, finder repo) — reactivates
   never-run paused terms at top priority. Used live to restore yield.

## Recommended next (ranked)

1. **Anti-starvation guard in the finder (highest leverage, cheap).** When the top
   `priority_score` in the active pool drops below a floor (e.g. ≤ 0), automatically
   reactivate the highest-priority never-run paused terms (or promote paused probe winners)
   *before* selecting the pass. This would have entirely prevented today's 17 dead passes.
   Put it in `listActiveTerms()` or a pre-pass hook.
2. **Cheap saturation detection.** Detect `overlap_warning` from the *search* result set
   before paying for 50 channel-detail fetches — bail a term early once its candidates are
   mostly known IDs. Directly cuts the API-burn-for-nothing.
3. **Promote probe winners mid-run,** not just at campaign end — run `evaluate-probes` every
   N fades so discovered veins that convert re-enter the active pool the same session.
4. **Per-run / per-session YouTube-quota budget guard** in the campaign — stop starting
   concurrent passes once RapidAPI search crosses e.g. 80%, to preserve quota for other tasks
   (today it hit 99.9% unattended).
5. **`needs_contact` recovery engine (biggest volume lever, deferred).** 2,353 found-and-
   scored creators with no verified email. Recovering 30% (~700) dwarfs a day of fresh
   finding and sidesteps the whole term-supply ceiling. Still awaiting greenlight.

## Standing-truth updates

- The 07-09 conclusion ("**term-supply-limited, not channel-supply-limited**") is
  **reconfirmed and sharpened**: not only is fresh-term supply the ceiling, but our tooling
  can **silently lock the fresh terms we have out of the active pool**, turning a
  supply-limit into a total stall. The anti-starvation guard is now the #1 finder fix.
- Frontier expansion works but **converts lower** (~38% email-valid) — good for
  `needs_contact` accumulation, weaker for `approved_hold`. Weight expectations accordingly.
- Unattended autonomous runs **must be quota-aware.** Today burned a near-full day of
  YouTube quota without a governor; add the budget guard before the next long run.
