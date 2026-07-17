# Lead Run — 2026-07-17 — Technical Analysis

**Cycle:** 2026-07-16T07:00:00Z → 2026-07-17T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** The lowest-volume day of the run — and the cause was new. Google's public autocomplete endpoint (the finder's only working term-refuel) **IP-blocked us with 22,105 HTTP 403s**, so the keyword harvest fired but stocked nothing, the reservoir read `STOCK-UP` on every session, and the term pool bled dry. Everything downstream stayed healthy (verify ~47%, $0 spend, 0 crashes, 0 quota stops). This is a **network block, not term exhaustion**. Two durable self-healing fixes shipped; the actual unblock is an infra call.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **75** | in-cycle leads now parked (per-session `parked_gain` sum ≈ 79) |
| `approved_hold` pool | 2,271 → **2,346** | net **+75** |
| Pitchable found (score ≥6 + host) | **159** | of 883 discovered |
| Finder-reported fresh pitchable (sum) | **71** | finder's own per-pass tally across 65 passes = **1.09/pass** (07-16 ≈ 1.74, 07-15 ≈ 1.32, 07-14 ≈ 1.69, 07-13 ≈ 0.71). **Lowest raw total & fewest passes of the run.** |
| Verified email (of pitchable) | **75 (~47%)** | ~51% of email-attempted — verify held on trend; the loss was upstream in *finding* |
| Swept → `needs_contact` (this cycle) | **72** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **3,156** | up ~77 on the cycle |
| Total channels discovered | **883** | 591 below-threshold, 116 unreviewed, 29 demo-niche-excluded, 72 needs_contact, 75 approved_hold |
| Finder passes | **65** | **41 zero-yield (63%)**; 24 weak (1–11); **0 healthy (≥12)** — tallest pass all day was **9** |
| Sessions started / done | 29 / 28 | **27 hard-stops**, 1 time-budget-stop, **0 quota-stops** |
| Discovery fades / discovers / promotes | 38 / 66 / 52 | verify+promote lane kept draining what little arrived |
| Keyword harvest | **6 fired / 60 skipped** (66 attempts) | and the 6 that fired hit the 403 wall — stocked ~nothing |
| Reservoir verdicts | **29 STOCK-UP / 0 GO** (of 29) | chronic measured supply shortage, all cycle |
| **Autocomplete HTTP 403s** | **22,105** | across the cycle's session logs — both `youtube` and `google` engines |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable: Legal **30** · Health & Wellness Clinics **26** · Financial Planning & Investing **25** · Coaching & Consulting **22** · Real Estate & Property **18** · Relocation & Lifestyle 10 · Business-Growth Coaching 7 · Other 4 · SaaS 4 · Wealth 3 · Tax & Accounting 3 · Sales Training 2 · AI Automation 1 · Practice-Growth 1 · No-Code 1 · Marketing Agencies 1 · Graphic Design 1. **Legal + Clinics + Financial Planning + Coaching + RE = 121/159 (76%)**. Notable shift vs 07-16: **Real Estate collapsed from #1 (95) to #5 (18)** and Legal/Clinics led — consistent with a starved pool serving only its residual, already-mined terms rather than fresh RE veins.

---

## Primary finding — the term engine was IP-blocked at the network layer

Every prior low day (07-13, 07-15, 07-16) was some flavor of **term-supply drought**: the active pool mined out and the refuel couldn't keep pace. Today looks the same in the funnel (starved pool, `STOCK-UP` reservoir, hard-stops) but the **mechanism is different and more fundamental**: the refuel endpoint itself refused us.

The finder's keyword harvest (`youtube-lead-finder-v1/scripts/keyword-harvest.ts` → `src/discovery/external/autocomplete.ts`) hits Google's public suggest box (`suggestqueries.google.com/complete/search`) with an a–z expansion per seed (~287 requests/seed at depth 2). This cycle **nearly every one of those requests returned HTTP 403** — an access/IP-reputation block, not a rate-limit-to-empty. Evidence from the session logs:

- **22,105** `failed: HTTP 403` lines across the cycle window, ~3,000 per session that ran a harvest.
- **Both** engines blocked in lockstep — `[youtube]` and `[google]` autocomplete both 403 (e.g. `"residential treatment for teens m" [youtube] failed: HTTP 403`, `"...superannuation in australia z" [google] failed: HTTP 403`). Two independent term corpora do not dry up on the same minute; a shared-host IP block does.

Because the harvest stocked nothing, the reservoir gate (`reservoir-check.ts`) read `STOCK-UP` on **all 29** sessions, and the finder — with no fresh terms to mine — hard-stopped **27 of 28** sessions. The per-pass yield tells the story: **65 passes, 71 fresh pitchable, 41 of them dead zeros, zero healthy passes**.

**The loss was 100% upstream in *finding*.** Verify held at ~47% (75/159), right on the 42–47% band of the last week. Nothing downstream broke.

---

## Why this wasn't caught as "just another drought"

The pre-existing detectors treated the symptom, not this cause:

- The harvest's own guard is a **`0 net-new = throttling`** check that assumes the endpoint returns *empty* under stress. Under a **403 block** the requests *throw*, are caught per-request, and the loop grinds all ~287/seed anyway — so the guard only trips at the very end (after the waste), and the block hides under 22k identical failure lines.
- The check-in's `term_starvation` heartbeat (07-15) correctly fires on a dry finder — but its 07-17 "break the wall" action **kicks a keyword harvest**, which into a blocked endpoint just hammers the block harder.

So the block was both **invisible** (buried in noise, mislabelled "drought") and **self-aggravating** (every backstop response deepened it).

---

## Fixes shipped this cycle

### 1. Circuit breaker on the autocomplete adapter — `youtube-lead-finder-v1` `68f1896`

`src/discovery/external/autocomplete.ts` `expand()` now counts **consecutive** request failures. A single bad query is tolerated (any success resets the counter), but **8 back-to-back failures** means the endpoint has blocked us — it aborts the expansion for that seed, emits `onBlocked(engine)`, and returns what it has. `scripts/keyword-harvest.ts` wires `onBlocked` to break the whole seed loop and print one greppable marker: **`AUTOCOMPLETE_ENDPOINT_BLOCKED`**.

Effect: a blocked harvest now costs ~8 requests instead of ~287/seed × N seeds — **collapsing ~22k wasted requests/cycle to a few dozen**, no longer hammering (and deepening) the block, and naming the real cause in one line instead of burying it. Verified with a mocked-`fetch` unit test:

- always-403 → bails at **8 requests** (not 287), fires `onBlocked` once, 0 terms;
- healthy endpoint → full 27-request depth-1 run, breaker never trips, 54 terms;
- single transient 500 mid-run → full run continues, breaker does **not** trip.

`tsc --noEmit` clean on both changed files.

### 2. Check-in detects the block and stops feeding it — `youtube-outreach-orchestrator-v1` `8d53f3f`

`scripts/autopilot/checkin.ts` gains `autocompleteBlocked()` — scans the 2 most-recent session logs for the `AUTOCOMPLETE_ENDPOINT_BLOCKED` marker or a dense run (≥50) of autocomplete 403s. In the `term_starvation` branch, if the endpoint is blocked it now **logs a distinct `autocomplete_blocked` observation** (free, out of the paid fix-agent path — an IP block is infra, not a code bug a `claude -p` agent can fix) and **skips the harvest kick** entirely (which would only hammer the block). Validated against real logs: fires on today's blocked sessions (2,911–3,799 × 403), quiet on clean sessions. `tsc --noEmit` clean.

---

## Shape of the day

65 finder passes, 07:24Z → 06:49Z. `fresh_pitchable` per pass:

```
0 0 0 0 0 0 2 1 1 1 1 7 1 7 1 2 1 0 0 0 0 0 0 8 9 0 4 0 0 0 0 0 0
0 0 0 0 2 2 0 5 0 3 0 0 0 0 0 0 0 0 0 3 0 4 1 0 0 1 2 2 0 0 0 0
```

A brief, weak early cluster (the residual terms), a tiny spike (8, 9) mid-morning, then a long, flat, mostly-dead tail. **No pass all cycle cleared 12**; the maximum was 9. This is what a starved supply valve looks like — not a stall that recovers when unblocked (07-10) but a flatline that never had fuel because the fuel line was cut.

---

## Constraints (updated)

- **Binding constraint: the term-refuel endpoint is IP-blocked.** New this cycle and now the top of the stack. The whole discovery engine rides one free host (`suggestqueries.google.com`); when it 403s, term supply → 0 regardless of ICP, quota, or verify.
- **Verify (~47%)** — unchanged, healthy, not the throttle today.
- **`needs_contact` (3,156)** — still the largest unbuilt lever, and uniquely immune to the term-supply block (it's a recovery problem over already-found creators).
- **Quota** — a non-factor (0 stops); the block, not the cap, was the ceiling.

---

## Ranked next levers

1. **Unblock the term engine (infra, needs Casey).** Rotate the VPS egress IP or proxy the autocomplete calls. Nothing in-code can lift a 403 IP-block; the breaker only stops the bleeding and surfaces it.
2. **Watch the two fixes next cycle.** Expect the 22k requests to collapse and `AUTOCOMPLETE_ENDPOINT_BLOCKED` / `autocomplete_blocked` to appear in the logs/observations. If the block has lifted, yield should snap back toward 07-16's ~1.7/pass.
3. **Build a second, independent term source** (DataForSEO / Google Ads API — already name-checked as future adapters). Removes the single point of failure this block exposed.
4. **The `needs_contact` recovery engine (3,156).** Biggest volume lever, and it sidesteps the term-supply block entirely. Awaiting greenlight.

---

## Changes shipped this cycle

| Repo | Commit | Change |
|---|---|---|
| `youtube-lead-finder-v1` | `68f1896` | Circuit breaker on the autocomplete adapter: bail after 8 consecutive 403s, emit `AUTOCOMPLETE_ENDPOINT_BLOCKED`, stop the seed loop — kills ~22k wasted req/cycle and surfaces the real cause. |
| `youtube-outreach-orchestrator-v1` | `8d53f3f` | Check-in detects the autocomplete IP-block, logs a free `autocomplete_blocked` observation, and skips the counterproductive starvation harvest-kick. |

> **Status caveat:** everything is *parked*, nothing sent — `approved_hold` holds until the new email process is ready.
