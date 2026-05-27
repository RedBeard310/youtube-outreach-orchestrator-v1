# How the system works — direct version

## In one sentence

Every 4h, the orchestrator wakes up and advances any reviewed leads through either the full email pipeline into SmartLead (`approved`) or find/verify + deep research into a per-prospect Airtable base (`D100`). The lead-finder is part of the system but paused by default — you trigger discovery runs manually with `npm run finder` when you want new leads to review.

## What the orchestrator (this repo) does

Nothing fancy. Every 4h via `launchd` it:

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
| **`youtube-outreach-orchestrator-v1`** | Polls Airtable, dispatches stages | macOS `launchd`, every 4h at `:17` | `npm run tick` |
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
     (currently 72 terms; pulls top 8 by priority_score per run)
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
| **YouTube Data API v3** | Channel/video/search lookups in finder + both enrichment pipelines | Free up to 10,000 units/day/project, 10 searches/min/project | **Yes — the binding constraint.** You currently have 20 keys in `youtube-deep-research-v1/.env` across 20 projects, plus 4 more validated and ready to add. Spec for `youtube-key-collector-v1` exists to scale to ~300. |
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
| Enrichment scratch base intermediate rows (videos, transcripts, comments, etc.) | **Yes** | 24h after `outreach_status=sent_to_smartlead` | `youtube-email-outreach-v1/scripts/airtable-cleanup.ts --auto` |
| Enrichment scratch base `channels` table | **No** (preserved for dedup) | Never — but marked `data_removed=true` + `last_enriched_at` | Same cleanup script |
| Local enrichment markdown bundles | **No** (kept on disk) | Never | (nothing) |
| Per-prospect D100 Airtable bases | **No** | Never | (nothing) |

So your `lead_candidates` table grows monotonically — but only when the lead-finder runs. Currently at **525 rows**, and **zero growth** until you trigger `npm run finder` (since auto-mode is off). When you do run it, growth = whatever the finder writes that session (depends on `--top-n` × `--max-channels-per-term` × scoring threshold). Plenty of room before the 10K per-base cap on the $25/mo Team plan.

## Other costs / constraints worth knowing

- **YouTube quota is the only hard rate limit.** Money is not the wall — YouTube searches/min is. Adding keys = adding throughput. Per-project, not per-account or per-key (we verified this empirically).
- **Airtable base count.** Your workspace has a base-count limit by plan. The D100 path creates one new base per prospect. Worth checking your plan's base ceiling if you're driving toward hundreds of D100 prospects.
- **Anthropic spend scales linearly with leads processed.** The Opus 4.7 compose call is the single heaviest line item per-lead on the approved path. If you ever need to cut cost, swapping compose to Sonnet 4.6 would be the highest-leverage knob (~5× cheaper, modest quality drop).
