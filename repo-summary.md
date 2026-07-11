# repo-summary — youtube-outreach-orchestrator-v1

## What it is

A thin polling **coordinator** (orchestrator = a loop that decides what runs next, but does no real work itself) that reads a lead database, figures out which stage each lead is ready for, and shells out to *other* repos to do the actual work. It owns no business logic — no email-finding, no enrichment, no copywriting live here.

## What it accomplishes

It turns a pile of scored YouTube-creator leads into either (a) cold outreach emails loaded into a sending tool, or (b) deep research dossiers on high-value prospects — automatically, without a human hand-walking each lead through five separate tools. In business terms: it's the conveyor belt connecting "we found some creators worth contacting" to "the pitch is queued / the homework is done."

## Vocabulary (read this first)

The whole system is a state machine over two Airtable fields. Everything below refers back to these.

- **tick** — one run of the orchestrator. Reads the DB, advances eligible leads one stage, logs, exits.
- **branch** — one of three independent work paths a tick runs (approved, D100, lead-finder).
- **`review_status`** — the *human/AI verdict* on a lead. The orchestrator only acts on two values: `approved` (lowercase) and `D100` (uppercase). All others (`unreviewed`, `rejected`, `sent`, `below_threshold`, `scoring_failed`, `demo_niche_excluded`, `no_host_identified`) are ignored.
- **`outreach_status`** — *how far down the pipeline* a lead has gotten. This is the field the orchestrator writes (D100 branch only).
- **terminal status** — a lead the orchestrator will *not* pick up again. Approved-terminal: `sent_to_smartlead`, `no_email_found`, `email_invalid`. D100-terminal: `deep_research_complete`, `deep_research_in_progress`, `no_email_found`, `email_invalid`.
- **D100** — a tier of high-value leads that get deep research instead of an email. (No compose, no send in v1.)
- **approved** — standard leads that get the full find→email→queue pipeline.

`outreach_status` lifecycle (single field, shared across both branches — disambiguate by `review_status`):

```
pending → email_found → email_verified ─┬─(approved)→ enriched → email_drafted → sent_to_smartlead
                                        └─(D100)→ deep_research_in_progress → deep_research_complete
  off-ramps: no_email_found · email_invalid · failed · deep_research_failed
```

## How it works

Each tick does four things ([src/cli/orchestrate.ts](src/cli/orchestrate.ts)):

1. **Query** the lead base for `review_status in (approved, D100)` AND not-yet-terminal for that branch. *(deterministic Airtable read)*
2. **Bucket** leads into the approved branch vs. the D100 branch. *(deterministic)*
3. **Drive each branch** by spawning the relevant downstream repo with `--lead-ids` for that batch, and waiting for it to finish. *(spawns child processes — all real work, including every AI/LLM call, happens inside those child repos, never here)*
4. **Log** one JSONL line to `logs/orchestrator-<date>.jsonl`. *(deterministic)*

```
        ┌─────────────── tick ───────────────┐
        │  read Airtable → bucket leads        │
        ▼                                      │
  approved branch          D100 branch         │   lead-finder branch
  (driveApproved)          (driveD100)         │   (driveLeadFinder)
        │                      │               │        │ runs LAST
  shell → email-outreach   step A: email-      │   shell → lead-finder
  full pipeline,           outreach --stop-    │   `npm run agent`
  --concurrency 4          after verify        │   (gated; default OFF)
        │                  step B (per lead):  │        │
        ▼                  setup-airtable.ts?  │        ▼
  sent_to_smartlead        + run-channel.ts    │   new leads land in
                           60s sleep between   │   Airtable for a
                                │              │   future tick
                                ▼              │
                      deep_research_complete   │
```

The three branches:

- **Approved** ([src/drivers/approved.ts](src/drivers/approved.ts)) — one shell-out: `npm run outreach -- --lead-ids <csv> --concurrency 4` in the email-outreach repo. That repo runs find → verify → enrich (Quick research) → compose → push to SmartLead. Terminal: `sent_to_smartlead`.
- **D100** ([src/drivers/d100.ts](src/drivers/d100.ts)) — two steps. **Step A:** email-outreach `--stop-after verify` (find + verify only). **Step B**, per verified lead: derive a `slug` from `channel_name`; if the slug is new, bootstrap a per-prospect Airtable base via `setup-airtable.ts`; set `deep_research_in_progress`; run `run-channel.ts`; set `deep_research_complete` or `deep_research_failed`. Sleeps 60s between leads to respect YouTube's per-minute quota. This is the only branch that writes `outreach_status`.
- **Lead-finder** ([src/drivers/lead-finder.ts](src/drivers/lead-finder.ts)) — runs **last** so a long discovery run can't delay per-lead work. Default **paused**; see Modes.

## Modes

| Mode / toggle | What it changes | Default | How to switch |
|---|---|---|---|
| `--dry-run` | Logs what each branch *would* shell out, writes/sends nothing | off (real run) | `npm run tick:dry` / `npm run finder:dry` |
| Lead-finder auto-run | Whether the tick fires the finder on a timer | **off** (`LEAD_FINDER_AUTO=false`) | set `LEAD_FINDER_AUTO=true`; then it fires once per `LEAD_FINDER_INTERVAL_HOURS` (default 24) |
| Lead-finder manual | Always runs the finder, bypassing both gates | n/a | `npm run finder` (optionally `--top-n N --llm-cap N --max-channels-per-term N`) |
| `D100_BUSINESS_MODEL` | `--business-model` passed to deep research | `high_ticket_service` | env var (allowed: `saas`, `info_product`, `coaching`, `agency`, `other`) |
| `APPROVED_CONCURRENCY` | Parallelism of the approved pipeline | `4` | env var |
| `D100_STEP_B_DELAY_SECONDS` | Sleep between deep-research leads | `60` | env var; `0` disables |

There is no "quick vs deep" mode *within* a tick — the branch a lead takes is decided entirely by its `review_status` (`approved` = light/email, `D100` = deep research).

## Operational behavior, safety, and verification

- **Idempotent / safe to re-run.** Yes by design. The query excludes terminal leads, so re-running a tick only re-drives unfinished ones. This is also the entire retry strategy: there is **no in-tick retry** — a failed lead just gets picked up next tick.
- **Failure handling.** `failed` and `deep_research_failed` are **non-terminal on purpose** — most failures here are transient (YouTube quota, Airtable timeouts), so they auto-retry forever. There's no failure-count cap in v1, so a genuinely broken lead loops indefinitely until fixed by hand. `deep_research_in_progress` *is* terminal — once set, a mid-flight run is never auto-restarted (stuck-in-progress leads need manual intervention).
- **Concurrency / locking.** Single-instance via a PID lockfile at `logs/.tick-lock` ([src/lock.ts](src/lock.ts)). If a tick (or manual finder) is already running, the new invocation no-ops. Stale locks (dead PID) are reclaimed automatically.
- **Ordering.** Within a tick: approved → D100 → finder (finder last on purpose).
- **Blast radius.** The orchestrator itself only **writes `outreach_status` on D100 leads** and **spawns child processes**. The expensive/irreversible effects live downstream: the approved branch causes real emails to be *loaded* into SmartLead (then sent on SmartLead's own schedule), and every branch spends API money. A newcomer's easiest mistakes: running a real `npm run tick` against a fat backlog (cost spike — see Cost), or running the one destructive helper script (`purge-host-gate-failed.ts`, which deletes Airtable rows).
- **How to tell it worked.** Watch stdout, then read the JSONL line in `logs/orchestrator-<date>.jsonl` (fields: `approved_processed`, `d100_step_b_succeeded/_failed`, `finder_yield`, exit codes). **Do not** trust SmartLead's UI to confirm sends — it lags and over-reports; verify real sends with `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`. "Loaded into a campaign" ≠ "emailed."

## Running it / first-timer guide

**Warm-up (first time on a new machine):** `npm install`, then `cp .env.example .env` and fill it (see Credentials). Confirm all three downstream repos are cloned, `npm install`'d, and runnable on their own — the orchestrator cannot drive a repo that can't run itself.

**Happy path — always start here:**

```bash
npm run tick:dry    # prints what each branch would do; writes/sends nothing
npm run tick        # real run
```

Read the dry-run output, sanity-check the lead counts, then do the real tick.

**Variations:**

```bash
npm run finder           # manually run lead discovery (bypasses the auto gates)
npm run finder:dry       # preview a finder run
npm run finder -- --top-n 200 --llm-cap 500   # tune a finder run
npm run typecheck        # tsc --noEmit
```

**Helper scripts** ([scripts/](scripts/)) — an ad-hoc operational toolkit, *not* part of a tick. Run with `npx tsx scripts/<name>.ts`. All read-only diagnostics **except one**:

| Script | Purpose | Mutates? |
|---|---|---|
| `pipeline-state.ts`, `diagnose-failed.ts`, `check-ready-for-email.ts`, `quality-check-ready.ts`, `check-today.ts`, `check-recent.ts`, `count-recent-loaded.ts` | Count / categorize leads by status (pipeline health, stuck-`failed` triage) | read-only |
| `airtable-email-lookup.ts`, `sample-email.ts`, `check-bundle-coverage.ts` | Look up emails / sample composed copy / check enrichment coverage | read-only |
| `pick-pilot.ts`, `pick-batch2.ts`, `verify-batch2.ts`, `check-pilot-status.ts` | Select & verify ad-hoc lead batches for pilot sends | read-only |
| `verify-singleselect.mjs` | Confirm the `outreach_status` Airtable options exist | read-only |
| **`purge-host-gate-failed.ts`** | **Export-then-DELETE** `host_name_low_confidence` failures (writes a verified JSON backup to `backups/` first) | **DESTRUCTIVE** |

**Onboarding a new D100 prospect** is automatic — the D100 driver bootstraps the per-prospect base on first encounter. No manual step.

**Non-obvious things you'd learn the hard way:** (1) the schema prerequisite below; (2) the finder is paused by default — `npm run tick` will *not* find new leads; (3) `npm run tick` blocks until the downstream repos finish, which can be many minutes.

**Schema prerequisite:** the `outreach_status` single-select on `lead_candidates` must already include `deep_research_in_progress`, `deep_research_complete`, `deep_research_failed`, or Airtable rejects the D100 writes and those leads stall at `email_verified`.

## External services

The orchestrator's *own* surface is tiny: it talks to exactly one external service directly and spawns local processes. Everything else is reached **transitively** by the downstream repos it launches.

| Service | What it's for | Direction | Direct or transitive |
|---|---|---|---|
| **Airtable** | Reads all lead state; writes `outreach_status` for D100 leads | two-way | **direct** (only direct dependency) |
| YouTube Data API v3 | Channel/video/search lookups in finder + enrichment | read | transitive (downstream repos) |
| Anthropic API | Haiku scoring/classifiers; Opus compose | two-way | transitive |
| ZeroBounce | Email verification | two-way | transitive |
| Firecrawl | Web/page scraping | read | transitive |
| Supadata | YouTube transcript fetching | read | transitive |
| SmartLead | Destination campaign that emails the leads | one-way (we load in) | transitive (via email-outreach) |

**No AI agents are chained from here.** The orchestrator makes **zero LLM calls itself** — it is pure coordination. All AI/agentic work happens inside the child repos.

## Related repos and dependencies

| Repo | Relationship | How it connects |
|---|---|---|
| `youtube-email-outreach-v1` | **hard dependency** | shell-out: approved full pipeline, and D100 step A (`--stop-after verify`) |
| `youtube-deep-research-v1` | **hard dependency** (D100 only) | shell-out: `setup-airtable.ts` (bootstrap) + `run-channel.ts` (deep research) |
| `youtube-lead-finder-v1` | **hard dependency** (finder branch) | shell-out: `npm run agent` |
| `quick-youtube-channel-research-v1` | indirect | invoked *by* email-outreach during enrichment; orchestrator never calls it |

Path to each is configured via env (`EMAIL_OUTREACH_REPO_PATH`, `DEEP_RESEARCH_REPO_PATH`, `LEAD_FINDER_REPO_PATH`). The D100 `slugify` ([src/drivers/d100.ts:23](src/drivers/d100.ts#L23)) must stay byte-for-byte identical to `youtube-deep-research-v1`'s slugify or `clients.json` lookups silently miss.

**Non-code artifacts in this repo:** seven `*-prompt.md` files (e.g. [upstream-prompt.md](upstream-prompt.md), [smartlead-investigation-handoff-prompt.md](smartlead-investigation-handoff-prompt.md)) are **handoff prompts** — written to be pasted into a Claude Code session opened in *another* repo to make a cross-repo change. [reminders.md](reminders.md) is a parked-ideas log; `backups/` holds safety dumps from the purge script; `launchd/` holds the (now-disabled) cron plist.

## Cost and time per run

The orchestrator spends ~nothing itself; cost is incurred by the downstream repos. Figures below are from [system-overview.md](system-overview.md) (as of 2026-06-01):

| Item | Cost |
|---|---|
| Per approved lead | ~$0.15 – $0.50 (compose + enrichment dominate) |
| Per D100 lead | ~$0.30 – $1.50 (deep enrichment dominates) |
| Typical tick (~5–30 approved + a few D100) | $1 – $20 |
| Pathological tick (large `failed` backlog all retrying — happened once at 119 leads) | $20 – $100 |

Time: a tick blocks until downstream finishes; D100 adds 60s/lead of deliberate sleep. To pull current live numbers, run `npx tsx scripts/pipeline-state.ts`.

## What downstream consumes the output

- **Approved path →** SmartLead campaigns (emails loaded, sent on SmartLead's Mon–Thu 09:00–15:00 ET schedule). A human reviews replies.
- **D100 path →** the per-prospect Airtable base populated by `youtube-deep-research-v1`; consumed by a human (and, eventually, a not-yet-built D100 compose agent).
- The orchestrator's own JSONL logs are consumed only by humans / the helper scripts.

## Files, config, and credentials

| Location | What's there |
|---|---|
| [src/cli/orchestrate.ts](src/cli/orchestrate.ts) | tick entry point (`npm run tick`) |
| [src/cli/run-finder.ts](src/cli/run-finder.ts) | manual finder entry point (`npm run finder`) |
| [src/drivers/](src/drivers/) | the three branch drivers |
| [src/airtable.ts](src/airtable.ts) | lead query + status writes; the `ReviewStatus`/`OutreachStatus` enums |
| [src/lock.ts](src/lock.ts), [src/logger.ts](src/logger.ts), [src/run.ts](src/run.ts) | lockfile, JSONL logger, child-process spawner |
| [.env](.env) / [.env.example](.env.example) | config & secrets (gitignored) |
| `logs/orchestrator-*.jsonl` | per-tick structured logs |
| `logs/lead-finder-state.json` | finder's last-run timestamp |
| `logs/.tick-lock` | single-instance lockfile |
| [scripts/](scripts/) | operational/diagnostic toolkit (see Running it) |
| [orchestrator-spec.md](orchestrator-spec.md), [system-overview.md](system-overview.md), [CLAUDE.md](CLAUDE.md) | full spec / system context / operating contract |

**Credentials required:** `AIRTABLE_PAT` (Airtable personal access token) + `LEAD_BASE_ID` (`appenY7r5jlZMRpJ0`). That's all the *orchestrator* needs. To actually run a tick end-to-end, the three downstream repos each need their own keys configured (Anthropic, YouTube/RapidAPI, ZeroBounce, Firecrawl, Supadata, SmartLead). Secrets load via `dotenv` from `.env`; on Casey's setup the real source of truth is `~/Claude/env-storage/.env`, exported through `~/.zshenv`.

## What's off vs. not built

**Turned off (exists, flip to enable):**
- **The 4-hour cron is disabled** — the `launchd` agent was unloaded and the plist renamed `.plist.disabled` (the Mac is usually asleep/closed at tick time). Re-enable only with explicit say-so by reinstalling the plist (see README's launchd steps). Run ticks by hand instead.
- **Lead-finder auto-run** — off via `LEAD_FINDER_AUTO=false`; set `true` to arm the timer.

**Not built on purpose (v1 scope):**
- D100 outreach composition / sending (deep research stops at the dossier).
- Webhooks, queues, event bus, Slack/email alerts, Notion sync.
- Concurrent ticks, in-tick retry loops, spend caps, failure-count bounding.
- The orchestrator never *triggers* business logic it owns — it only coordinates.

## Major decisions and recent changes

| Decision | Why |
|---|---|
| Orchestrator owns **zero business logic**; only shells out | keeps it a ~thin, swappable coordinator; logic stays where it's tested |
| **Polling, not webhooks** | simplicity for v1; Airtable is the single source of truth |
| `failed`/`deep_research_failed` made **non-terminal** (2026-05-24) | most failures are transient; auto-retry buys self-healing at the cost of unbounded retries on truly-broken leads |
| D100 reuses `outreach_status` rather than a new field | Casey's call — filter by `review_status=D100` to disambiguate visually |
| **Ticks made manual-only** (2026-06-01) | scheduled ticks silently no-fired (asleep Mac) and a stale env path was killing them; durable fix needs an always-on host |
| YouTube backend → `auto` (direct-keys-first), merged to `main` | Google suspended keys for multi-project quota circumvention; `auto` falls back to a paid RapidAPI mirror. Configured per-downstream-repo, not here |
| Host gate removed + no-host scoring penalty zeroed (≈2026-06-07) | let no-host leads reach approval; made `signal_score ≥ 6` the *real* approval bar |
| Auto-approve at `signal_score ≥ 6` became standing policy (2026-06-11) | bulk runs may set `approved` programmatically, but never below 6 |

## Watch-outs and open questions

- **Doc contradictions (code wins).** Two stale spots in [README.md](README.md): it describes a live 4-hour cron (actually disabled — [CLAUDE.md](CLAUDE.md) is authoritative), and its setup block names `AIRTABLE_API_KEY` + two repo paths, but the code reads **`AIRTABLE_PAT`** ([src/airtable.ts:65](src/airtable.ts#L65)) and `.env.example` defines **three** repo paths. Trust the code and `.env.example`.
- **Unbounded retries = cost risk.** A backlog of `failed` leads re-drives every tick; one 119-lead backlog cost an estimated $20–100 in a single tick. No cap exists.
- **`slugify` drift.** If `youtube-deep-research-v1` ever changes its slugify, D100 bootstrap lookups silently mismatch and re-create bases. They must stay identical.
- **Synchronous & blocking.** A tick holds the lockfile and blocks until every child finishes; a hung downstream repo hangs the tick.
- **Defined-but-unwritten statuses.** The `OutreachStatus` enum includes `deep_research_pending`, which nothing in the drivers ever sets — likely vestigial. Open question: intended future use, or dead?
- **SmartLead reporting lies** — never confirm sends from its UI (see Verification).

## Improvement ideas worth remembering

From [reminders.md](reminders.md) (parked, not built):
- **Rank host-found channels above no-host** as a review tiebreaker — but *not* via a negative score (that re-breaks the ≥6 bar). Prefer a host *bonus* or a presentation-only sort key.
- **Mega-creator (whale) exclusion** smarter than the current blunt >800k-subscriber cap — e.g. a "media brand vs. service practitioner" Haiku check, or a soft sub-count penalty (must stay well above ~250k; Casey has real clients there).
- A `failure_count` field to cap retries at N — the cheap fix if ticks regularly exceed ~$30.

## Live state snapshot (as of 2026-06-15)

- **Last orchestrator tick logged:** 2026-06-04 (`approved_processed=13`). No tick JSONL since — consistent with manual-only operation; recent send/finder activity ran via ad-hoc `.log` runs, not the tick logger.
- **Last lead-finder run:** 2026-06-04, which discovered **1,079** new leads — 187 at `signal_score ≥ 6`, 170 of those with an identified host.
- **Approved pipeline:** essentially drained (per CLAUDE.md); the ~268 `unreviewed` leads all score 4–5, below the ≥6 bar — *not* untapped volume. New volume comes from a fresh `npm run finder` run.
- **Cron status:** both the 4-hour tick cron and the nightly enrichment-cleanup cron are **disabled**; both must be run by hand.
- To refresh these numbers: `npx tsx scripts/pipeline-state.ts` (pipeline counts) and the most recent `logs/orchestrator-*.jsonl`.
