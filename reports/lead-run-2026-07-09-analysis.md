---
title: Lead Run Technical Analysis — 2026-07-09
type: run-analysis
run_date: 2026-07-09
companion_html: runs/lead-run-2026-07-09.html
audience: LLM operator / engineer
status: final
tags: [lead-gen, youtube, campaign-driver, discovery, analysis]
---

# Lead Run Technical Analysis — 2026-07-09 (debut of the autonomous campaign driver)

This is the deep companion to `runs/lead-run-2026-07-09.html`. It exists so a future
LLM operator can (a) reconstruct exactly what happened, (b) act on the engineering
findings, and (c) reason correctly about the "are we running dry" question. Numbers
are from the campaign JSONL (`youtube-outreach-orchestrator-v1/logs/campaign-*.jsonl`),
the per-run finder logs (`youtube-lead-finder-v1/logs/run-2026-07-*.log`), and live
Airtable counts at run end.

## 0. Headline numbers

| Metric | Value |
|---|---|
| `approved_hold` start → end | **1,060 → 1,540 (+480)** |
| `needs_contact` start → end | ~1,634 → **2,173 (+539)** |
| Pitchable creators found + processed today | **~1,020** (480 verified + 539 dead-email + a few in-flight) |
| Blended email-verify rate | **~47%** (480 / ~1,019) |
| Campaign cycles | 6 (1 manual recovery + 5 autonomous pushes) |
| Finder passes | ~20, wall-clock 35–74 min each (avg ~47 min) |
| Probe veins generated (discovery) | ~1,200 across 6 restock rounds |
| Probe "winners" (qr ≥ 10%) | 12 of 240 tested = **5%** |
| Target | 500 (stopped at 480 by operator; "close enough") |

Context: this is the SAME output as the 2026-07-08 run (500 parked) — but 07-08 was
**fully manual** and 07-09 was **driven by `npm run campaign`** end-to-end. The headline
story is not the count; it's that the machine ran itself (after one bug fix).

## 1. The pipeline as run today

`npm run campaign` (in `youtube-outreach-orchestrator-v1`, driver
`src/drivers/campaign.ts`) is a thin coordination loop:

1. **Pre-flight reservoir gate** — shells `youtube-lead-finder-v1/scripts/reservoir-check.ts`;
   if `STOCK-UP`, calls `discover-veins.ts` once to stock up.
2. **Loop** (until `--target` gain, `--max-runs`, `--max-minutes` reserve, or hard wall):
   - finder pass (`npm run agent --top-n N --llm-cap C`)
   - **fade check**: if fresh pitchable `< --fade-threshold`, shell `discover-veins.ts` (adaptive restock)
   - **overlap verify** (#1): `await` prior pass's verify, then **promote per-pass**
     (`promote-verified-to-hold.ts`, which auto-sweeps `needs_contact`), then kick this
     pass's verify async so it runs during the next finder pass.
3. **Finish**: final verify sweep + promote.

Key config used today: `--top-n 70`, `--llm-cap 500` (after push 1), `--max-runs 5–8`,
`--max-minutes 130–240`, `--fade-threshold 15`, `--discovery-count 50–70`.

## 2. Cycle decomposition

| Cycle | Mode | Passes | Parked | Cum. `approved_hold` | Notes |
|---|---|---|---|---|---|
| Morning | manual recovery (post bug-fix) | — | +106 | 1,166 | salvaged the 219 pitchable the path bug stranded (4 proof + 102 bg) |
| Push 1 | auto, llm-cap **800** | 2 | +49 | 1,215 | cap-800 = ~50–74 min/pass, poor trade → reverted |
| Push 2 | auto, llm-cap 500 | 4 | +109 | 1,324 | best cycle |
| Push 3 | auto, llm-cap 500 | 4 | +96 | 1,420 | |
| Push 4 | auto, llm-cap 500 | 5 | +82 | 1,502 | per-pass yield thinning (22→18→19→11→12) |
| Push 5 | auto (cut at 480) | 2+ | +38 | 1,540 | operator stopped; 9 then 29 parked |

Per-pass parked sequence (chronological-ish): 32, 17, 19, 23, 27, 27, 27, 17, 39, 26,
22, 18, 19, 11, 12, 9, 29. Per-pass pitchable ranged 17–74, clustering 40–60 early and
30–45 late.

## 3. Throughput analysis

- **Finder pass wall-clock** (from `Elapsed:` in finder logs): 2,114–4,452 s, i.e.
  **35–74 min/pass**, avg ~47 min. Passes are LLM-bound: the finder scores each new
  channel with Haiku (score + host-find ≈ 2 calls), capped by `--llm-cap`.
- **llm-cap 800 vs 500**: cap-800 (push 1) ran passes ~50–74 min for ~37 parked/2 passes;
  cap-500 (push 2–5) ran ~35–50 min for ~20–27 parked/pass. **Net: cap-800 was ~60%
  slower per pass for ~35% more raw pitchable — a bad trade.** Diminishing returns kick in
  because after ~250 channels scored, additional candidates are increasingly dups /
  below-threshold. **Standing setting: `--llm-cap 500`.**
- **Effective throughput: ~30–40 parked/hour** regardless of cap. This is the wall-clock
  bottleneck; the only structural fix is **running finder passes concurrently** (2 parallel
  processes on disjoint term slices) — currently the campaign is strictly sequential.

## 4. Discovery engine analysis (the crux)

The LLM vein-generator (`src/discovery/generate.ts`, model `claude-sonnet-5`) is grounded
on `src/discovery/icp.ts` + live term-performance (`src/discovery/performance.ts`) and
dedupes candidates against the entire `search_terms` table.

### 4a. Net-new yield decayed hard across the day
Per focused `discover-veins --count 40/45` call:

| Restock round | net-new usable terms / call | signal |
|---|---|---|
| 1 (AM) | ~25–41 | healthy |
| 2–3 | ~16–30 | thinning |
| 4–5 | ~5–23 | strained |
| 6 (late) | **0 on Health&Wellness + all unfocused calls** | niche saturated |

Cause: the table grew ~2,486 → ~2,900 terms; dedupe rejection rose monotonically. The
generator keeps re-proposing already-present terms in mined niches. **Unfocused/broad
calls returned 0 every time** — without a niche anchor the model defaults to the most
obvious (already-present) terms.

### 4b. Probe quality: fat low-converting tail
`evaluate-probes.ts` on the morning's 240 tested probes: **12 winners (qr ≥ 10%)**, 228
retired. So the "strong winner" rate is only **5%**. BUT — the 228 sub-10% probes still
produced most of the ~219 raw pitchable that cycle (a 4% qr on 50 channels = 2 qualified;
across 200+ terms that dominates volume). **Implication:** don't judge discovery by winner
rate alone; the low-qr tail is the volume engine. Winners matter for *re-runnable* veins.

### 4c. What the winners tell us about ICP frontier
Top discovered winners: `how to scale a med spa without an md` (29%), luxury real-estate
marketing (14%), functional-medicine practice scaling (10–12%), sales-team-building (16%),
sales-leadership coaching (14%). Pattern: **"how to scale a [specialized practice] without
[constraint]"** and **profession-specific practice-growth** — these are *new sub-niches*,
not the mined core. This is direct evidence that the frontier (unmined sub-niches) is where
the yield is, and re-mining the core is where the saturation is.

## 5. Email deliverability (bottleneck #2)

Blended verify ~47% (480 / 1,019), stable all day — no scraper/ZeroBounce degradation under
load (ZB credits ended ~4,900). Consistent with the funnel constant (~54% firm-heavy, lower
on trade/coach tail). **539 leads → `needs_contact` today.** The `needs_contact` lane now
holds **2,173** found-and-scored creators with no verifiable email. This is the single
largest latent asset in the pipeline and the highest-ROI thing to build next (see §8).

## 6. Bugs & defects

| Defect | Root cause | Status | Fix location |
|---|---|---|---|
| **Path bug (critical)** — morning run parked 0 | IDs files written to orchestrator `logs/` but passed as **relative** `logs/...` paths to verify/promote children whose cwd is the EMAIL repo → ENOENT | **FIXED** | `campaign.ts` now `resolve()`s to absolute paths |
| **Time-box overrun** — first run finished ~26 min late | budget checked between passes but a pass starting just-under-budget overran | **FIXED** | reserve `lastPassMin*1.15` against `--max-minutes` |
| **firm-tilt firstPage 100-cap** | Airtable `.firstPage()` returns ≤100 rows; over-fetch of `limit*3` (210) is silently capped at 100, so firm-tilt only re-ranks the top-100 active terms by priority | **OPEN** | `src/airtable/search_terms.ts listActiveTerms` — page with `eachPage`/`pageSize`, or fetch all active then rank |
| **llm-cap 800 bad trade** | diminishing channel yield past ~250 scored | **REVERTED** | standing `--llm-cap 500` |
| **Orphaned relaunch** | launched `npm run campaign` with `&` *inside* a `run_in_background` Bash call → detached from harness task tracking | operator error, **avoid** | use `run_in_background: true` alone, or `exec npm run ...` |

## 7. "Are we running dry?" — the model

**Distinguish two supplies:**
- **Channel supply** = how many good creators exist to be found. Measured proxy: pitchable
  yield *per fresh term* ≈ **0.9**, and it did NOT decay across the day. Healthy.
- **Term supply** = how many *novel* search queries we can generate that surface un-seen
  creators. Measured proxy: discovery net-new/call, which **decayed to 0** on mined niches.

**Conclusion: we are term-supply-limited, not channel-supply-limited.** The good-creator
pool is large and far from exhausted — we've deeply mined ~10 niches out of an ICP defined
as "any high-ticket, service-based business that wins clients on YouTube," which spans
dozens of unmined verticals and hundreds of sub-niches. The wall we keep hitting is our
own term generator re-proposing mined terms, not YouTube running out of creators.

**Therefore the growth lever is frontier expansion, not more finding effort.** Concretely,
the discovery generator needs to be pushed OFF the saturated core and ONTO new surface.

## 8. Prioritized next actions (highest leverage first)

1. **Widen the discovery frontier (biggest volume lever).** Feed `generate.ts` an explicit
   "saturated niches — avoid" list and an "explore these frontiers" seed (adjacent
   professions, sub-specialties, new verticals: aesthetics beyond med-spa, dental/ortho,
   vet, home-services *coaching*, B2B consulting sub-fields, franchise/agency niches,
   private-practice healthcare, etc.). Add a `--avoid-niche` / frontier-seed input. Without
   this, every future run repeats today's saturation curve.
2. **Build the contact-recovery engine for `needs_contact` (2,173 leads).** Cheapest-first:
   YouTube About-tab business email (CAPTCHA-gated — likely the biggest single miss),
   channel/booking links, contact-form scrape, then pattern-guess+verify. Even 40% recovery
   ≈ ~870 reachable creators with ZERO new finding. Belongs in `youtube-email-outreach-v1`.
3. **Fix firm-tilt `firstPage` cap** (`search_terms.ts`) — it's silently limiting sequencing.
4. **Concurrent finder passes** to break the ~45-min/pass wall-clock (throughput 2×).
5. **Auto-run `evaluate-probes` at each cycle end** inside the campaign (promote winners /
   retire losers without a human) — today it was manual.
6. **Keep `--llm-cap 500`; drop unfocused discovery calls and re-mining saturated niches.**

## 9. Open questions / anomalies

- **1,821 leads at `review_status = approved`.** Large pool outside today's `approved_hold`
  work; tick-eligible if the (manual/disabled) tick ran. Are they stuck/unprocessed or
  intentionally parked? Investigate — could be another latent batch or a state leak.
- **Winner re-run value unmeasured.** The 12 promoted winners went back to priority 75 but
  we didn't measure their 2nd-run yield vs. fresh probes. Do proven-winner re-runs beat new
  discovery once the frontier saturates?
- **Frontier sizing.** We don't have an estimate of how many *unmined* ICP niches remain.
  A one-time "enumerate the ICP niche tree" pass would let us forecast the ceiling.
- **Deliverability by niche.** We use a firm-vs-coach intuition; a per-niche verify-rate
  table would let firm-tilt weights (`firm_tilt.ts`) be data-driven rather than hand-set.

## 10. One-line takeaways

- The autonomous campaign driver **works** — debut shook out one critical bug (fixed) and
  ran 5 cycles hands-off to 480 parked.
- **Term supply, not channel supply, is the ceiling.** Widen the discovery frontier or every
  run repeats the same saturation curve.
- **`needs_contact` (2,173) is the biggest untapped asset** — recovery likely out-yields
  more finding.
- Settings that stick: `--llm-cap 500`, focused-only discovery, per-pass promote, time-box
  with pass reserve. Cut: llm-cap >500, unfocused discovery, re-mining saturated niches.
