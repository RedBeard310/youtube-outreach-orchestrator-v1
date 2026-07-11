# Enrichment Phase — Anthropic Token Cost Analysis

**Date:** 2026-07-08
**Scope:** Anthropic (Claude) API spend *only* during the **enrichment phase** of the approved cold-email pipeline. Excludes YouTube Data API quota and Supadata transcript costs (tracked separately).
**Repo analyzed:** `quick-youtube-channel-research-v1` (the "Quick mode" research pipeline), invoked by `youtube-email-outreach-v1` during the `enrich` stage.
**Purpose:** Understand exactly what burns tokens, attribute the cost, and find levers to reduce it.

---

## 1. Headline number (measured, not estimated)

The pipeline **records `total_cost_usd` to Airtable on every run** (`runs` table in the shared Quick-mode base `appTvzwOiTLmqC5Mw`). Pulled from **70 completed runs**:

| Metric | Per lead | Per 100 leads |
|---|---|---|
| **Average** | **$0.090** | **~$9** |
| Median | $0.095 | ~$9.50 |
| p10 (small channels) | $0.014 | ~$1.40 |
| p90 (big channels) | $0.141 | ~$14 |
| Min / Max seen | $0.005 / $0.188 | — |

**Reference points:**
- 100 leads ≈ **$9** (realistically **$9–14** depending on channel size).
- The full current `approved_hold` pool (**563 leads**) would cost **~$50** to fully enrich.

The spread is driven almost entirely by **how much transcript + comment text a channel has** — bigger channels = more Sonnet input tokens = more cost.

---

## 2. How the approved path reaches enrichment

```
orchestrator (approved branch)
  └─ shells: youtube-email-outreach-v1  npm run outreach
       └─ enrich stage → src/enrichment/runner.ts
            └─ shells: quick-youtube-channel-research-v1  scripts/run-channel.ts   ← "Quick mode"
                 └─ runs 8 stages, writes total_cost_usd to the Quick base
```

Everything below is about **Quick mode** (`run-channel.ts`) — that is what the approved path actually executes. (The d100 path uses the same `run-channel.ts` entry into per-lead bases, so this analysis applies there too.)

---

## 3. What actually runs in Quick mode — and what does NOT

`run-channel.ts` header (lines 4–9, 30–31) is explicit: it runs **8 stages** and **intentionally skips Stages 5, 6, 7, 11**. The `examples-bank` generator is **not imported/called** either.

### Stages that run (8)

| # | Stage | Anthropic? | Model | Calls/run | Cost role |
|---|---|---|---|---|---|
| 01 | harvest (video metadata, ≤150 videos) | ❌ | — | 0 | YouTube quota only |
| 02 | transcripts (**top 15** videos via Supadata) | ❌ | — | 0 | Supadata only |
| 03 | pinned-comments (top 10 videos) | ❌ | — | 0 | YouTube quota only |
| 04 | top-comments (top 10 videos × ~20 by likes → ~30–40 rows) | ❌ | — | 0 | YouTube quota only |
| 08 | **profile** synthesis | ✅ | **Sonnet 4.6** | **1** | ~20% of cost |
| 09 | **competitor-discovery** | ✅ | **Sonnet 4.6** | **2** | ~15–20% of cost |
| 10 | competitor-harvest (≤10 competitors × top 50 videos) | ❌ | — | 0 | YouTube quota only |
| 12 | **ICP** synthesis | ✅ | **Sonnet 4.6** | **1** | **~50–65% of cost (the hotspot)** |

**Total Anthropic calls per lead: 4 — all Sonnet 4.6. Zero Haiku calls.**

### Stages that are SKIPPED in Quick mode (do NOT cost anything here)

These source files exist and were analyzed, but **do not run** in the approved path — worth knowing so we don't "optimize" something that's already off:

| Stage | Model (if it ran) | Why it's off |
|---|---|---|
| 05 outbound-links | Haiku | Skipped per SPEC §1 |
| 06 page-scraping | Haiku | Skipped per SPEC §1 |
| 07 classifier (per-video content typing) | Haiku | Skipped per SPEC §1 |
| 11 competitor-classify (**~40 Haiku calls** if on) | Haiku | Skipped per SPEC §1 |
| examples-bank (1 Haiku call **per transcript**, uncapped) | Haiku | Not called by `run-channel.ts` |

> ⚠️ If anyone ever flips Quick mode to a "deep" mode, **Stage 11 (~40 Haiku calls) and examples-bank (1 call per transcript, full uncapped transcript each)** would become the new cost centers. Today they are dormant.

---

## 4. The 3 cost-bearing stages, in detail

### 🔴 Stage 12 — ICP synthesis (`stage-12-icp.ts`) — the cost hotspot

- **What it does:** Builds an 8-field Ideal Customer Profile of the channel's *audience* (pain points, goals, objections, etc.) — the richest asset for cold-email personalization.
- **Model / calls:** Sonnet 4.6, **1 call** (`:234–235`).
- **Input — this is the biggest prompt in the whole pipeline (~10–20k+ tokens):**
  - Stage-08 profile + channel About — small.
  - **Transcripts: top 20 videos, each capped at 3,000 chars** (`TRANSCRIPT_CAP`, `:105`, `:194–204`) → up to 60,000 chars; realistically ~30–45k chars (~8–12k tokens) since only ~10–15 transcripts exist.
  - **ALL pinned comments** (≤600 chars each, `:205–215`) — **uncapped count**.
  - **ALL substantive top-comments from the top 20 videos** (≤600 chars each, `:216–226`) — **uncapped count**.
- **Output:** `maxTokens: 8192` (`:295`); realistic output ~1–1.5k tokens (8 prose fields).
- **Primary driver:** Input tokens — the 20-transcript concatenation + two *uncapped* comment lists, billed at Sonnet **$3/M input**.
- **Tail risk:** The comment lists have **no upper bound** — a large, comment-heavy channel can balloon this prompt well past typical.

### 🟠 Stage 08 — Profile synthesis (`stage-08-profile.ts`)

- **What it does:** Distills channel into niche / audience / 4 content pillars / tone. Feeds Stage 12.
- **Model / calls:** Sonnet 4.6, **1 call** (`:206–207`).
- **Input (~4–6k tokens):** title + About; **top 50 video titles** w/ view counts; 10 recent uploads (desc capped 200 chars); **top 3 transcripts × 5,000 chars** (`TRANSCRIPT_CAP`, `:87`, `:199`) ≈ the dominant chunk (~3.5–4k tokens). No comments, no scraped pages.
- **Output:** `maxTokens: 4096` (`:228`); actual output tiny (4 short fields).
- **Primary driver:** The 3 transcript excerpts + 50 titles on Sonnet. Cheaper than Stage 12.

### 🟡 Stage 09 — Competitor discovery (`stage-09-competitor-discovery.ts`)

- **What it does:** Generates search queries, finds candidate channels, ranks the **top 10** as competitors (`TARGET_COMPETITORS = 10`, `:72`).
- **Model / calls:** Sonnet 4.6, **exactly 2 calls** (query-gen `:202–225`, ranking `:283–313`) — does **not** scale with competitor count.
- **Input:** Small — niche/pillars + candidate list of *names + 5 titles each* (no transcripts/comments).
- **Output:** query-gen `maxTokens: 1024`; ranking `maxTokens: 16384` (`:312`) but realistic output is ≤10 objects (a few hundred–low-thousand tokens).
- **Primary driver:** The ranking call (Sonnet **output at $15/M**) + candidate-list input.
- **⚠️ Note:** Stage 09 discovers competitors and Stage 10 harvests their videos, but **Stage 11 (which consumes them) is SKIPPED in Quick mode.** See §6, Lever 1.

---

## 5. Pricing reference (from `anthropic.ts` PRICING table, lines 44–47)

USD per **million tokens**:

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| **Sonnet 4.6** (`claude-sonnet-4-6`) | $3.00 | $15.00 | $0.30 | $3.75 |
| Haiku 4.5 (`claude-haiku-4-5`) | $1.00 | $5.00 | $0.10 | $1.25 |

The pipeline uses **list pricing** to compute `total_cost_usd`, so the measured $0.09 is at list rates (no batch/committed-use discount applied).

**Estimated per-lead attribution** (no per-stage logging exists, so this is inferred from token magnitudes; sums to ≈ the measured $0.09):

| Stage | Est. share | Est. $/lead |
|---|---|---|
| 12 ICP (Sonnet) | ~55% | ~$0.050 |
| 08 profile (Sonnet) | ~22% | ~$0.020 |
| 09 competitor-discovery (Sonnet ×2) | ~18% | ~$0.016 |
| rounding / small | ~5% | ~$0.004 |

---

## 6. Optimization opportunities (ranked by $ impact)

### Lever 1 — 🥇 Cut the competitor sub-pipeline (Stages 09 + 10) for cold email
- **Why:** Stage 11 (the consumer of competitor data) is **already skipped** in Quick mode. So Stage 09 discovers + Stage 10 harvests competitors, but **nothing downstream classifies or uses them** in the cold-email path. This looks vestigial.
- **Saves:** ~2 Sonnet calls (**~15–20% of Anthropic cost, ~$0.016/lead → ~$9 across 563**) **plus** meaningful YouTube quota (10 competitors × top-50-video harvest per lead).
- **Action:** Confirm the email compose (`youtube-email-outreach-v1`) reads **nothing** from the competitor rows / competitor stats. If confirmed, gate Stages 09+10 off in `run-channel.ts` for `research_purpose` = cold-email/quick.
- **Risk:** Low, *if* nothing consumes it. **Verify first.**

### Lever 2 — 🥈 Shrink Stage 12 ICP input (the biggest single call)
- **Why:** Stage 12's own prompt says **comments are the "HIGHEST signal"** (`:86`, `:90`); transcripts are secondary tone signal. Yet it feeds up to **20 transcripts** and **uncapped comment lists**.
- **Actions (compounding):**
  - Cut transcript fan-in **20 → 8–10** and/or char cap **3,000 → 1,500**. Roughly **halves** the dominant input chunk.
  - **Cap the comment lists** (e.g. top ~40 by likes). Removes tail-risk blow-ups on comment-heavy channels.
- **Saves:** ~30–50% of Stage 12 input → **~$0.02–0.03/lead → ~$11–17 across 563.**
- **Risk:** Low–moderate; A/B the ICP output quality before/after.

### Lever 3 — 🥉 Pre-digest Stage 12 input with Haiku, keep Sonnet for the synthesis
- **Why:** Move the bulk transcript/comment tokens off Sonnet ($3/$15) onto Haiku ($1/$5). Run a cheap Haiku pass to compress 20 transcripts + comment dump into a bulleted "audience-language" digest, then feed only the digest to Sonnet for the final 8-field synthesis.
- **Saves:** Plausibly **2–3× reduction on Stage 12** while preserving the comment-derived signal.
- **Risk:** Moderate; adds a stage and some latency. Best combined with Lever 2 (or as an alternative to it).

### Lever 4 — Try Stage 08 profile on Haiku
- **Why:** It's structured extraction (niche/audience/4 pillars/tone), not deep synthesis. Haiku input $1/M vs Sonnet $3/M.
- **Saves:** ~$0.010–0.013/lead (~$6–7 across 563) if quality holds.
- **Risk:** Moderate — tone/niche specificity is the point of this stage. A/B a Haiku variant first.

### Lever 5 — Caching is essentially useless here (don't rely on it)
- Only **4 calls/run, 1 per stage, each with unique per-channel input.** There's no repeated system-prefix within a run to amortize, and `cacheSystem` defaults to `true`, so we even pay a small **cache-write premium** (1.25×/3.75×) on the system prompts for no reuse benefit.
- **Action:** Set `cacheSystem: false` on the 3 Sonnet calls (marginal saving), or ignore — caching is not a real lever at this call volume.

### Housekeeping (not cost, but noted)
- `anthropic.ts` `maxTokens` doc-comment says "Default 8192" (`:59`) but the real default is **16384** (`:99`, `:121`). Not a cost issue (output billed on actual tokens), just a stale comment.

---

## 7. Cost projections

| Scenario | Est. $/lead | 100 leads | 563 leads |
|---|---|---|---|
| **Current (measured)** | **$0.090** | **$9** | **~$50** |
| + Lever 1 (cut competitors 09/10) | ~$0.074 | ~$7 | ~$42 |
| + Lever 2 (trim ICP input) | ~$0.050 | ~$5 | ~$28 |
| + Levers 1+2+4 (Haiku profile) | ~$0.038 | ~$4 | ~$21 |
| Aggressive (1+2+3+4) | ~$0.030 | ~$3 | ~$17 |

**Realistic target: roughly halve it to ~$0.04–0.05/lead** with Levers 1 + 2 alone (low-risk), before touching model swaps.

---

## 8. Open questions to verify before cutting

1. **Does the cold-email compose consume ANY competitor data** (competitor channel names, stats) from the Quick base? If no → Lever 1 is free money. *(Check `youtube-email-outreach-v1` compose/enrichment-bundle reads.)*
2. **Does the compose use the full Stage-12 ICP, or only a few fields?** If only a couple fields, Stage 12 input can be trimmed harder (Lever 2).
3. **Is the Stage-08 profile consumed directly by the email, or only as Stage-12 input?** If only internal, a Haiku profile (Lever 4) is lower-risk.
4. Would Anthropic **batch API (50% off)** be viable for enrichment? It's async/non-interactive per lead, so possibly — a flat ~50% cut with no quality change.

---

## Appendix — source map

| Thing | File |
|---|---|
| Quick-mode entry / stage sequence | `quick-youtube-channel-research-v1/scripts/run-channel.ts` |
| Cost accounting + pricing table | `.../src/lib/anthropic.ts` (`PRICING` L44–47, `priceUsage` L128) |
| ICP (hotspot) | `.../src/lib/pipeline/stage-12-icp.ts` |
| Profile | `.../src/lib/pipeline/stage-08-profile.ts` |
| Competitor discovery | `.../src/lib/pipeline/stage-09-competitor-discovery.ts` |
| Transcripts (top 15) | `.../src/lib/pipeline/stage-02-transcripts.ts` |
| Top comments | `.../src/lib/pipeline/stage-04-top-comments.ts` |
| Enrichment invocation | `youtube-email-outreach-v1/src/enrichment/runner.ts` |
| Recorded costs | Airtable base `appTvzwOiTLmqC5Mw`, `runs.total_cost_usd` |
