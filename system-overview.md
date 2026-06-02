# How the system works — direct version

## In one sentence

The orchestrator advances any reviewed leads through either the full email pipeline into SmartLead (`approved`) or find/verify + deep research into a per-prospect Airtable base (`D100`). The lead-finder is part of the system but paused by default — you trigger discovery runs manually with `npm run finder` when you want new leads to review.

> **⚠️ Ticks are MANUAL-ONLY (since 2026-06-01).** The 4-hour `launchd` cron is **unloaded and disabled** (plist renamed `.disabled`) because the Mac is usually asleep or the repo closed at scheduled tick times, so scheduled ticks silently no-fired. Run ticks by hand with `npm run tick`. **Do not re-enable the cron unless Casey explicitly says so.** The nightly enrichment-cleanup cron (`com.caseybrown.airtable-cleanup`) is likewise disabled — cleanup is manual too (see [Cleanup behavior](#cleanup-behavior--what-gets-deleted-and-what-doesnt)).

## What the orchestrator (this repo) does

Nothing fancy. When you run `npm run tick` (formerly every 4h via `launchd`, now manual) it:

1. Queries Airtable for non-terminal `approved`/`D100` leads
2. Partitions them by review status and what step each needs next
3. Shells out to the appropriate downstream repo (with `--lead-ids`, `--stop-after`, etc.)
4. Optionally fires the lead-finder (default: off; can be enabled via `LEAD_FINDER_AUTO=true`)
5. Writes one JSONL line to `logs/`
6. Exits

No business logic, no retries inside a tick, no state of its own beyond a tick lockfile, a JSONL log, and a tiny `lead-finder-state.json` for "when did the finder last run."

## Repos in the pipeline

| Repo | Role | Called by | How |
|---|---|---|---|
| `youtube-lead-finder-v1` | Discovers channels via ICP search terms; writes raw rows to `lead_candidates` with `review_status=unreviewed` | **Default: manual only** via `npm run finder` in the orchestrator repo. Auto-mode (every 24h) is available by setting `LEAD_FINDER_AUTO=true`. | `npm run agent` |
| **`youtube-outreach-orchestrator-v1`** | Polls Airtable, dispatches stages | **Manual only** — `npm run tick` (the every-4h `launchd` cron is disabled, see warning above) | `npm run tick` |
| `youtube-email-outreach-v1` | Find email → verify → enrich (quick) → compose → push to SmartLead | Orchestrator | `npm run outreach -- --lead-ids ... [--stop-after verify]` |
| `quick-youtube-channel-research-v1` | 9-stage quick enrichment, writes to shared scratch base | email-outreach (transitively) | Internal call |
| `youtube-deep-research-v1` | 12-stage deep research, creates a new Airtable base per prospect | Orchestrator (D100 only) | `npx tsx scripts/setup-airtable.ts` then `npx tsx scripts/run-channel.ts` |
| `5-ideas-email` skill | Compose variant A | email-outreach at compose time | Claude skill |
| `nick-saraev-cold-email` skill | Compose variant B | email-outreach at compose time | Claude skill |

A/B between the two compose skills is decided by SHA-256 hash of lead ID — deterministic, persisted on the row.

## Manual gate in the middle

You're the gate between discovery and outreach. The lead-finder writes `review_status=unreviewed`. Nothing moves until you flip it to `approved`, `D100`, or some terminal value (`rejected`, `below_threshold`, etc.). The orchestrator only acts on `approved` and `D100`.

## Full pipeline order

**Approved path** (one shell-out, full pipeline in one child process):

```
[lead-finder writes row] → [you set review_status=approved]
  ↓
orchestrator → email-outreach (no --stop-after, runs all stages):
  find email      (Firecrawl + Haiku)
  verify email    (ZeroBounce)
  enrich          (calls Quick research → 9 stages → markdown bundle)
  compose         (Opus 4.7 + variant skill, reads bundle)
  push            (SmartLead, paused, niche+variant routing)
  ↓
outreach_status = sent_to_smartlead
  ↓
[you click Start in SmartLead when ready]
```

**D100 path** (two shell-outs per tick; step B loops per lead):

```
[lead-finder writes row] → [you set review_status=D100]
  ↓
orchestrator step A → email-outreach with --stop-after verify
  find email + verify only
  ↓
orchestrator step B → for each verified-email lead, sequentially with 60s spacing:
  slugify(channel_name) → check deep-research/clients.json
  if new slug: setup-airtable.ts creates a fresh Airtable base + registers slug
  run-channel.ts <url> --client <slug> --business-model high_ticket_service
                       --research-purpose research_target
  → 12 stages: harvest → transcripts → comments → links → pages → classify
              → profile → competitor discovery → competitor harvest
              → competitor classify → ICP
  ↓
outreach_status = deep_research_complete
  ↓
[data sits in the per-prospect base for your manual outreach later — no auto-compose in v1]
```

**Lead-finder branch** (default: paused; runs only when you manually trigger it):

```
you → npm run finder (in the orchestrator repo)
  → shells out to npm run agent in youtube-lead-finder-v1
  → reads "active" terms from the search_terms table in Airtable
     (~617 active terms as of 2026-06-01; pulls top N by priority_score per run, default 8)
  → searches YouTube for each, scores results, writes rows to
     lead_candidates with review_status=unreviewed
  → updates logs/lead-finder-state.json on success
  ↓
[you review the new rows in Airtable and tag approved/D100/rejected/etc.]
```

**Mode summary:**

| `LEAD_FINDER_AUTO` | Tick behavior | Manual trigger |
|---|---|---|
| `false` (default) | Skips the finder every tick | `npm run finder` runs it on demand |
| `true` | Fires the finder on the first tick that's ≥`LEAD_FINDER_INTERVAL_HOURS` (default 24) since the last run | Still works — `npm run finder` forces a run regardless of interval |

`npm run finder` always acquires the same lockfile as `npm run tick`, so it won't overlap with an in-progress tick.

## APIs used

| API | What it's for | Cost shape | Bottleneck? |
|---|---|---|---|
| **Airtable** | All lead state; per-prospect D100 bases; enrichment scratch base | $25/mo Team plan, 10,000 records per base | No on records; **base count** could become one (D100 path creates one base per prospect) |
| **YouTube Data API v3** | Channel/video/search lookups in finder + both enrichment pipelines | **`YOUTUBE_API_BACKEND=auto` (default since 2026-06-01): direct Google `YOUTUBE_API_KEY[_N]` keys first, RapidAPI mirror only as fallback when every direct key is dead.** Modes: `auto`/`direct`/`rapidapi`. | Direct keys: ~10k units/day each, pooled across ~20 keys. As of 2026-06-01 only **6 of 20 keys were live** (14 suspended after the multi-project ban — Google reinstates over time; re-check every ~2 days with `youtube-email-outreach-v1/scripts/youtube-key-health.ts`). RapidAPI's 2000/window search bucket is the fallback ceiling. See the [backend history](#why-rapidapi-not-direct-keys) note. |
| **Anthropic API** | Haiku for finder + classifiers; **Opus 4.7** for compose | Per-token. Opus ~60× Haiku | No, but compose is the priciest single call per lead |
| **ZeroBounce** | Email verification | ~$0.001–0.003 per verification depending on tier | No |
| **Firecrawl** | Web scraping in finder + page-scraping enrichment stage | Subscription or ~$0.005–0.01 per scrape | No |
| **Supadata** | YouTube transcript fetching | ~$0.001–0.01 per transcript | Sometimes slow, but not a hard cap |
| **SmartLead** | Cold-email sender / sequencer | Per-lead plan pricing | No |

## Approximate per-lead cost

Rough orders of magnitude — your actual plan tiers determine exact numbers. Don't quote these without sanity-checking against your bills.

| Stage | Cost per lead |
|---|---|
| Find email | $0.005 – $0.02 |
| Verify email | $0.003 – $0.01 |
| Quick enrichment (9 stages) | $0.05 – $0.20 |
| Compose (Opus 4.7, ~10–20K input tokens) | $0.05 – $0.15 |
| Deep enrichment (12 stages) | $0.30 – $1.50 |

**Per-lead totals:**

- Approved path: **~$0.15 – $0.50** (mostly compose + enrichment)
- D100 path: **~$0.30 – $1.50** (deep enrichment dominates)

## Per-tick cost (typical)

- Steady state, ~5–30 approved leads + a few D100: **$1 – $20 per tick**
- Pathological tick (large backlog of `failed` leads all retrying — happened once with 119): **$20 – $100 per tick**

Current retry semantics (`failed` and `deep_research_failed` are non-terminal) trade money for self-healing. Worth revisiting if ticks regularly exceed $30 — the cheap fix is a `failure_count` field that caps retries at N.

Lead-finder is currently paused (`LEAD_FINDER_AUTO=false`) and runs only when you trigger `npm run finder`. Its cost profile per run is dominated by Haiku scoring calls + YouTube searches.

## Cleanup behavior — what gets deleted and what doesn't

| Data | Cleaned? | When | By |
|---|---|---|---|
| `lead_candidates` rows | **No** — kept forever | Never | (nothing) |
| Enrichment scratch base intermediate rows (videos, transcripts, comments, etc.) | **Yes — but MANUAL now** | 24h after `outreach_status=sent_to_smartlead`, run by hand | `youtube-email-outreach-v1/scripts/airtable-cleanup.ts --auto` (nightly cron DISABLED — laptop asleep at 23:00; run it manually after each send batch, then roll up with `rollup-archived-runs.ts`) |
| Enrichment scratch base `channels` table | **No** (preserved for dedup) | Never — but marked `data_removed=true` + `last_enriched_at` | Same cleanup script |
| Local enrichment markdown bundles | **No** (kept on disk) | Never | (nothing) |
| Per-prospect D100 Airtable bases | **No** | Never | (nothing) |

So your `lead_candidates` table grows monotonically — but only when the lead-finder runs. **~3,139 rows as of 2026-06-01** (777 approved, ~503 of those loaded to SmartLead and essentially drained). **Zero growth** until you trigger `npm run finder` (auto-mode off). NOTE: the 268 "unreviewed" leads are NOT untapped volume — all 268 score 4–5 (below the ≥6 approval bar); everything ≥6 is already triaged. Real new volume comes from a fresh `npm run finder` run, not from the unreviewed queue (which is just below-threshold leftovers to reject or ignore). Airtable record cap was raised **50k→125k on 2026-05-30**, so plenty of headroom. NOTE: this is the *lead* base (`appenY7r5jlZMRpJ0`) — distinct from the *enrichment scratch* base (`appTvzwOiTLmqC5Mw`), which is the one that fills fast and needs the manual cleanup above.

## Other costs / constraints worth knowing

- **YouTube backend is `auto` (direct-keys-first) again as of 2026-06-01.** After Google restored access, all three downstream repos run `YOUTUBE_API_BACKEND=auto`: rotate through the ~20 direct Google keys first (skipping both quota-exhausted and project-suspended keys), fall back to the RapidAPI mirror only when every direct key is dead. The `auto`-aware code lives on `main` in `youtube-email-outreach-v1/src/youtube/backend.ts` (the old "`auto` only exists on a branch" landmine is **resolved** — it's merged). Each downstream repo has its OWN backend config; the enrichment repo (`quick-youtube-channel-research-v1`) is separate and could still hit RapidAPI quota independently. The orchestrator itself never calls YouTube.

## Verifying SmartLead sends (don't trust the UI)

**"sent_to_smartlead" in our pipeline means LOADED INTO a campaign, not emailed.** Our push (`POST /campaigns/{id}/leads`) just adds the lead; SmartLead's own scheduler decides when to actually send. So our send count ≠ emails delivered.

- **Send schedule (all campaigns):** Mon–Thu, 09:00–15:00 America/New_York (`days_of_the_week=[1,2,3,4]`). **Fri/Sat/Sun send ZERO by design** — a quiet weekend is not a malfunction. (Friday's exclusion may be unintentional; changing the schedule is an open decision — see below.)
- **Throughput ceiling:** 6-hour window × Mon–Thu only, `max_leads_per_day≈25`/campaign, mailbox `message_per_day≈15`, ~12 mailboxes/campaign. A big import dump queues for days — **import ≠ send**.
- **The SmartLead UI lies about send volume.** The master "Sent" inbox is an IMAP sync that lags 1–2h (and has been stuck on stale dates); the in-app "Ask AI" reads a cached, non-real-time `analytics_summary`. On 2026-06-01 both showed "nothing sent" while **180 emails actually went out** that day.
- **To check REAL send volume:** run `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts` (buckets actual `sent_time` per day across campaigns), or per-lead `message-history` (`type=SENT`). Never diagnose "is it sending?" from the UI or Ask-AI.

## `last_contacted_at` is polluted — do not trust it as a "we contacted them" signal

Historically `last_contacted_at` was backfilled from `outreach_processed_at` (which updates on *every* Airtable write), which could leave never-sent leads carrying a bogus value. **The outreach pipeline selects leads by `review_status` + `outreach_status` only and never reads `last_contacted_at`** — so even when polluted it had zero effect on sending.

**Verified clean 2026-06-01:** all 531 rows with `last_contacted_at` are `sent_to_smartlead`; **zero** never-sent leads carry the field. The redrive the earlier handoff flagged is effectively already done — no action needed. Going-forward stamping on push-success (one `sentAt` for both `outreach_processed_at` and `last_contacted_at`) is correct.
- **Airtable base count.** Your workspace has a base-count limit by plan. The D100 path creates one new base per prospect. Worth checking your plan's base ceiling if you're driving toward hundreds of D100 prospects.
- **Anthropic spend scales linearly with leads processed.** The Opus 4.7 compose call is the single heaviest line item per-lead on the approved path. If you ever need to cut cost, swapping compose to Sonnet 4.6 would be the highest-leverage knob (~5× cheaper, modest quality drop).

### Why RapidAPI, not direct keys

Google's free YouTube Data API v3 tier gives each Google Cloud project 10,000 quota units/day and 10 searches/min — modest, but multipliable by spinning up additional projects, each with its own key. The pipeline ran that pattern with ~225 keys across separate projects.

Google noticed. They began emailing warnings about keys being discontinued for "circumventing quotas via multiple Google Cloud projects" — which is exactly what the multi-project rotation does. Continuing on that pattern risked losing all the keys at once and stalling the pipeline.

The switch to a paid RapidAPI mirror (`youtube-data-api-v33.p.rapidapi.com`) puts every request on a legitimate paid contract, with no per-project sleight of hand. The direct keys aren't deleted — they stay parked so the system can flip back via `YOUTUBE_API_BACKEND=direct` per-repo if free quota replenishes or for A/B testing.

Backend swap implemented in each downstream repo individually; the orchestrator itself doesn't talk to YouTube and needs no changes.
