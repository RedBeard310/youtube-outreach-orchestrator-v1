# youtube-outreach-orchestrator-v1

Thin coordination loop. Polls Airtable on a cron, advances leads through whichever stage they're ready for by shelling out to existing repos. Owns no business logic of its own.

Full spec: [orchestrator-spec.md](orchestrator-spec.md). Read it before making non-trivial changes.

## Core rules

- **No business logic here.** Don't find emails, enrich channels, or compose copy in this repo. If a stage needs new logic, it belongs in the underlying repo (`youtube-email-outreach-v1`, deep-research repo, etc.), not the orchestrator.
- **No direct skill calls.** The orchestrator calls `youtube-email-outreach-v1`; that repo routes compose to `5-ideas-email` / `nick-saraev-cold-email` via its own A/B variant system.
- **Airtable is the state store.** The orchestrator reads `review_status` and `outreach_status` from the lead base (`appenY7r5jlZMRpJ0`) and writes nothing directly — underlying repos write their own state.
- **Don't retry inside a tick.** Failed leads get picked up on the next tick automatically. Log non-zero exits, continue, don't stop the world.
- **`failed` and `deep_research_failed` are non-terminal** (since 2026-05-24). The orchestrator auto-retries them on the next tick because most failures here are transient (YouTube quota, Airtable timeouts). No failure-count bounding in v1 — genuinely broken leads will loop until manually fixed. This is an intentional simplification, not an oversight.
- **Single-instance.** No concurrent ticks. Use a lockfile at `logs/.tick-lock`; if held, the new tick no-ops.
- **Polling only.** No webhook server, queue, or event bus.

## Three branches per tick

Lead-finder (interval-driven, runs LAST in the tick), plus two lead-driven branches:

- **Lead-finder branch** — shells out to `youtube-lead-finder-v1`'s `npm run agent`. Default: **paused** (`LEAD_FINDER_AUTO=false`). When auto is on, fires only if `LEAD_FINDER_INTERVAL_HOURS` (default 24) has elapsed since its last successful run. State tracked in `logs/lead-finder-state.json`. Manual on-demand trigger via `npm run finder` (always runs, bypasses both gates, acquires the same lockfile as `npm run tick`).

Branched on `review_status` (case-sensitive — Airtable values are `approved` lowercase, `D100` uppercase):

- `approved` → shell out to `youtube-email-outreach-v1` for find → verify → enrich (Quick research) → compose → push to SmartLead (paused). Terminal: `outreach_status = "sent_to_smartlead"`.
- `D100` → step A: `youtube-email-outreach-v1 --stop-after verify`; step B: per-lead invocation of `youtube-deep-research-v1`'s `scripts/run-channel.ts` (with auto-bootstrap via `scripts/setup-airtable.ts` if the slug is new to `clients.json`). Each d100 lead gets its own Airtable base. **No compose, no SmartLead in v1.** Terminal: `outreach_status = "deep_research_complete"`.

All other `review_status` values (`unreviewed`, `rejected`, `sent`, `below_threshold`, `scoring_failed`, `demo_niche_excluded`) are ignored.

### `outreach_status` values

The d100 path extends `outreach_status` rather than introducing a separate field (Casey's call — filter by `review_status=D100` in Airtable to disambiguate visually).

Persisted on the singleSelect:

- Shared first stages: `pending`, `email_found`, `email_verified`, `no_email_found`, `email_invalid`
- Approved-only: `enriched`, `email_drafted`, `sent_to_smartlead`
- D100-only (orchestrator writes these): `deep_research_in_progress`, `deep_research_complete`, `deep_research_failed`
- Generic: `failed`

`stopped_early` is **not** persisted — it's only an in-process return value from `youtube-email-outreach-v1`'s `--stop-after`. After `--stop-after verify` on a verified lead, the persisted status is `email_verified`.

`deep_research_in_progress` is the only mid-pipeline status that is terminal — once set, the orchestrator does not auto-restart mid-flight runs. Manual intervention required for stuck-in-progress leads. `failed` and `deep_research_failed` are explicitly NOT terminal (see "Core rules").

## What the orchestrator does each tick

1. Query lead base for `review_status in (approved, d100)` AND not terminal for that branch.
2. Bucket by branch.
3. For each branch, shell out to the next-stage repo with `--lead-ids` for that batch. Wait for completion.
4. Write one JSONL line to `logs/orchestrator-<date>.jsonl`.

Pseudo-code in spec §"Sequential stage handoffs".

## Repos / skills this depends on

| Component | How we call it |
|---|---|
| `youtube-email-outreach-v1` | Shell out. Needs `--stop-after <stage>` and bulk `--lead-ids` flags added (small additive changes). |
| `quick-youtube-channel-research-v1` | Not called directly — invoked transitively by email-outreach during enrichment. Locked, don't touch. |
| Deep-research repo (TBN, likely `youtube-deep-research-v1`) | Shell out for d100 enrichment. Doesn't exist yet. |
| `youtube-lead-finder-v1` | Not called. Writes leads independently; orchestrator only reads its output. |

## Airtable architecture

- **Lead base `appenY7r5jlZMRpJ0`** — being renamed in the Airtable UI to "Scraped YouTube Leads" (base ID unchanged). Holds `lead_candidates`. The orchestrator reads everything, and writes `outreach_status` transitions for the d100 path only (since no other agent updates `lead_candidates` for d100).
- **Per-prospect d100 bases** — one Airtable base per d100 lead, created by `youtube-deep-research-v1/scripts/setup-airtable.ts` on first encounter. The slug is derived deterministically by the orchestrator from `channel_name` (must match `youtube-deep-research-v1`'s `slugify`); the resulting base ID is recorded in `clients.json` in that repo.
- **Quick enrichment scratch base `appTvzwOiTLmqC5Mw`** — unchanged. Still used by `quick-youtube-channel-research-v1` for the approved path; still cleaned 24h after send.

For the schema fields the orchestrator reads/writes, see [LEAD_CANDIDATES_SCHEMA.md](LEAD_CANDIDATES_SCHEMA.md) (paste from the email-outreach repo).

### D100 step B per-lead flow

For each verified-email d100 lead:

1. Derive slug = `slugify(channel_name)` (must match `youtube-deep-research-v1/src/lib/clients.ts`).
2. Read `<DEEP_RESEARCH_REPO_PATH>/clients.json`. If the slug isn't there, shell out to `npx tsx scripts/setup-airtable.ts --client <slug> --name "<channel_name>"`.
3. Set `outreach_status = deep_research_in_progress` on the lead row.
4. Shell out to `npx tsx scripts/run-channel.ts <channel_url> --client <slug> --business-model $D100_BUSINESS_MODEL --research-purpose research_target`.
5. On exit-0 → set `deep_research_complete`. On non-zero → set `deep_research_failed`.

Defaults: `--business-model = high_ticket_service` (env-overridable via `D100_BUSINESS_MODEL`), `--research-purpose = research_target` (hard-coded for d100 outreach context). `lead_candidates` has no per-lead `business_model` field.

Between consecutive step-B invocations, the driver sleeps `D100_STEP_B_DELAY_SECONDS` (default 60s) to stay under per-minute YouTube rate limits. Google's direct backend caps at 10 searches/min/project; the RapidAPI backend has its own tier-dependent limit (see [system-overview.md](system-overview.md) "Why RapidAPI, not direct keys"). Set to 0 to disable.

## Out of scope for v1

- d100 outreach composition (future separate agent).
- Webhooks, Slack/email alerts, Notion sync.
- Concurrent ticks, retry loops, spend caps.
- Triggering the lead-finder.

## Scaffolding target

Estimated ~200–300 lines TS across `src/cli/orchestrate.ts` + a lead-query helper + branch drivers + logger. Keep it lean.

## Default cron

`17 */4 * * *` (every 4h, off-zero minute per skill-cron-best-practices). Subject to change — see open questions.

## How to write replies to me

Keep your replies short and sweet. Don't cut any necessary information or important details, but aim for brevity when explaining them.

Lead with what changed and what it means for me — not what you did step by step.
Plain language, no unnecessary technical jargon. Explain a term only if I need it
to make a decision.

Keep it short and spaced out: brief paragraphs, bold labels, a table when
comparing two or more things. No walls of text, no filler openers.

Include, briefly, anything that changes my picture of the work:
- what you actually verified vs. assumed
- anything surprising you found along the way
- decisions I still need to make, as a short list at the end

Cut everything else.
