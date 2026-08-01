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

## YouTube API keys: we ROTATE direct keys, and RapidAPI credits back them up

This keeps getting forgotten, so it lives at the top: no repo in this pipeline runs on a single
YouTube key, and "direct quota exhausted" is NOT a dead end.

- **Every YouTube-calling repo rotates through a pool of direct keys** — `YOUTUBE_API_KEY` +
  `YOUTUBE_API_KEY_1..N` from the shared env bank (`~/env-storage/.env`; `_1..7` as of 2026-07-31).
  Rotation is automatic and failure-specific: 403 quota/blocked marks a key sticky-dead and moves
  on; 429 rotates but keeps the key eligible; any other 403 (e.g. `commentsDisabled`) propagates
  and never burns a key.
- **When every direct key is dead, `auto` mode falls through to the RapidAPI YouTube mirror** —
  a separate paid credit pool (`RAPIDAPI_KEY` + `RAPIDAPI_YOUTUBE_HOST`, host
  `youtube-data-api-v33.p.rapidapi.com`) returning identical JSON. All repos default to
  `YOUTUBE_API_BACKEND=auto` (the var is unset everywhere = auto). A run should degrade to
  RapidAPI, not halt, when direct keys drain. Don't forget these credits exist when planning
  or debugging quota problems.
- **Canonical doc: `youtube-deep-research-v1/docs/youtube-api-key-rotation.md`** — the portable
  spec for the whole scheme (env contract, rotation rules, reference implementation, quota
  costs). Read it before touching or re-implementing any key handling anywhere.
- **Check the pool, don't guess:** `npm run youtube-key-health` (email-outreach),
  `npm run keys:health` (deep-research), `npx tsx scripts/test-youtube-keys.ts` (lead-finder,
  quick-research). Re-run every ~2 days — appealed suspensions flip BLOCKED→WORKING.
- **This repo makes no YouTube calls itself; it only governs usage.** The campaign driver reads
  `youtube-lead-finder-v1/logs/quota-state.json` (RapidAPI headroom, written by the finder's
  quota guard) and throttles at `YT_QUOTA_SOFT_PCT` (80) / hard-stops at `YT_QUOTA_HARD_PCT`
  (95). Keep key handling downstream — it's business logic.
- **Gotcha:** `quick-youtube-channel-research-v1` also falls back to RapidAPI but has NO quota
  guard — it ignores `RAPIDAPI_MIN_REMAINING_PCT` and never writes `quota-state.json`, so
  enrichment can spend RapidAPI credits invisibly to the campaign governor.

## Three branches per tick

Lead-finder (interval-driven, runs LAST in the tick), plus two lead-driven branches:

- **Lead-finder branch** — shells out to `youtube-lead-finder-v1`'s `npm run agent`. Default: **paused** (`LEAD_FINDER_AUTO=false`). When auto is on, fires only if `LEAD_FINDER_INTERVAL_HOURS` (default 24) has elapsed since its last successful run. State tracked in `logs/lead-finder-state.json`. Manual on-demand trigger via `npm run finder` (always runs, bypasses both gates, acquires the same lockfile as `npm run tick`).

Branched on `review_status` (case-sensitive — Airtable values are `approved` lowercase, `D100` uppercase):

- `approved` → **the tick preps only.** Shell out to `youtube-email-outreach-v1` for find → verify → enrich (Quick research) with `--stop-after enrich`, then **park the lead at `outreach_status = "ready_data_scraped"`** (enriched, ready to write). Writing and sending the email are **deliberately decoupled from the tick** (since 2026-07-17) — see [Writing/sending is decoupled from the tick](#writingsending-is-decoupled-from-the-tick-since-2026-07-17). Fire the parked leads on demand with **`npm run send`** (compose → push to SmartLead, paused). Tick-terminal: `ready_data_scraped`. Overall-terminal: `outreach_status = "sent_to_smartlead"`.
- `D100` → step A: `youtube-email-outreach-v1 --stop-after verify`; step B: per-lead invocation of `youtube-deep-research-v1`'s `scripts/run-channel.ts` (with auto-bootstrap via `scripts/setup-airtable.ts` if the slug is new to `clients.json`). Each d100 lead gets its own Airtable base. **No compose, no SmartLead in v1.** Terminal: `outreach_status = "deep_research_complete"`.

All other `review_status` values (`unreviewed`, `rejected`, `sent`, `below_threshold`, `scoring_failed`, `demo_niche_excluded`, `approved_hold`, `needs_contact`) are ignored.

`approved_hold` (added 2026-07-07) is a **deliberate parking status**: leads that are approved and validated (email found/verified) but must NOT be auto-composed/sent yet — e.g. awaiting a different email process. The tick ignores it. Park/release via `youtube-email-outreach-v1/scripts/hold-batch.ts` (`<ids-file>` to hold, `--release` to flip all `approved_hold` → `approved`). Release only when the intended email process is ready.

`needs_contact` (added 2026-07-09) is a **recovery-lane parking status**, parallel to `approved_hold`: score-≥6 leads that are found + host-identified but have **no verified email yet** (`outreach_status` = `no_email_found` / `email_invalid`). Not discarded — held for a future contact-recovery process; on obtaining a valid email they flip to `approved_hold`. The tick ignores it. Sweep failures into it after each `approved_hold` push via `youtube-email-outreach-v1/scripts/demote-failed-to-needs-contact.ts --apply`. Full context: `casey-assistant/brain/lead-gen/youtube-run-playbook.md` §8b.

### `outreach_status` values

The d100 path extends `outreach_status` rather than introducing a separate field (Casey's call — filter by `review_status=D100` in Airtable to disambiguate visually).

Persisted on the singleSelect:

- Shared first stages: `pending`, `email_found`, `email_verified`, `no_email_found`, `email_invalid`
- Approved-only: `ready_data_scraped` (parked & enriched, ready for `npm run send`), `ready_no_data` (**reserved** — ready to email but no enrichment data; nothing produces or sends it yet, a manual holding label for later), `enriched` (**legacy alias** for `ready_data_scraped`, still recognised on read), `email_drafted`, `sent_to_smartlead`

> **`review_status` vs `outreach_status` — different fields, no collision.** `approved` / `approved_hold` are `review_status`; `ready_data_scraped` / `ready_no_data` are `outreach_status`. They coexist on the same row: a prepped lead is `review_status=approved` **and** `outreach_status=ready_data_scraped`. Re-labelling one field never touches the other.
- D100-only (orchestrator writes these): `deep_research_in_progress`, `deep_research_complete`, `deep_research_failed`
- Generic: `failed`

`stopped_early` is **not** persisted — it's only an in-process return value from `youtube-email-outreach-v1`'s `--stop-after`. After `--stop-after verify` on a verified lead, the persisted status is `email_verified`.

`deep_research_in_progress` is the only mid-pipeline status that is terminal — once set, the orchestrator does not auto-restart mid-flight runs. Manual intervention required for stuck-in-progress leads. `failed` and `deep_research_failed` are explicitly NOT terminal (see "Core rules").

## Writing/sending is decoupled from the tick (since 2026-07-17)

**The act of writing/sending an email is disconnected from everything else.** The tick preps leads and parks them; a separate, manually-triggered command writes and sends. Nothing about writing an email finds contacts, cleans a database, or blocks any other work.

- **Prep (on the tick, `npm run tick`):** `approved` leads go find → verify → enrich (`--stop-after enrich` inside `youtube-email-outreach-v1`) and **park at `outreach_status = "ready_data_scraped"`**. The tick **never composes or pushes**. Every approved lead ends the tick "lying in wait, ready to write." Prep is idempotent — a lead already at `ready_data_scraped`/`email_drafted`/`sent_to_smartlead` is skipped by the prep query (`APPROVED_PREP_DONE` in `src/airtable.ts`), so re-ticking never re-drives a parked lead.
- **Send (on demand, `npm run send`):** drives the parked leads (`ready_data_scraped`, or `email_drafted` from a partial prior send — `APPROVED_FIRE_READY`) through compose → push to SmartLead. This is the **only** path that sends, and it runs exactly when you trigger it. `npm run send:dry` previews the shell-out and sends nothing; `--lead-ids a,b` fires a subset; `--limit N` caps the batch. It acquires the same `logs/.tick-lock` as the tick, so a send and a tick can't overlap. Driver: `driveApprovedSend` in `src/drivers/approved.ts`; the inbox-health gate still fires here (at send time), not during prep.

**Why: the enrichment-DB cleanup can never strand a ready-to-write lead.** The cleanup (`youtube-email-outreach-v1/scripts/airtable-cleanup.ts`) runs on its own systemd timer (see [Enrichment cleanup is automated](#enrichment-cleanup-is-automated-since-2026-07-30)) — nothing in the tick, campaign, or autopilot triggers it, and it is age-driven, never send-driven. Its `--auto` mode only targets leads already at `sent_to_smartlead` (i.e. it follows a *send*, and never touches a `ready_data_scraped` parked lead), and it is non-destructive to what compose needs: it always exports a re-importable JSON and keeps the on-disk research bundle (`enrichment-bundles/<recId>/`), and compose reads its input from that **on-disk bundle**, not from the Airtable enrichment base. So even a fully-cleaned lead can still be (re)composed. Composing an email cannot arm the cleanup; only a send can, and the send is now yours to trigger.

## What the orchestrator does each tick

1. Query lead base for `review_status in (approved, d100)` AND not terminal for that branch.
2. Bucket by branch.
3. For each branch, shell out to the next-stage repo with `--lead-ids` for that batch. Wait for completion.
4. Write one JSONL line to `logs/orchestrator-<date>.jsonl`.

Pseudo-code in spec §"Sequential stage handoffs".

## Inbox health gate (lives in youtube-email-outreach-v1, not here)

Since 2026-06-16 the `approved` path self-protects against sending from bad inboxes. When the orchestrator shells out `npm run outreach`, `youtube-email-outreach-v1` first runs a staleness-gated **inbox health gate** (`ensureInboxHealthFresh()`): it reads per-mailbox warmup health from InboxKit and pauses/resumes the matching SmartLead inbox via `is_suspended`. Pause rules: health_score < 90, OR warmup day < 14, OR landing rate < 90 with real volume. It runs at most once per 24h, never on `--dry-run`, and never blocks sending if it errors.

Implications for the orchestrator (no code changes needed here — keep it that way per "No business logic"):

- **Sending capacity floats automatically.** Inboxes drop out when InboxKit health dips and come back when they recover, so live send volume can change tick-to-tick without anyone touching SmartLead. Expected, not a bug.
- **Don't reach for SmartLead inbox suspend/resume from the orchestrator.** That lever is owned by the gate in `youtube-email-outreach-v1`; doing it here would fight the gate's state file.
- **Manual check:** `cd $EMAIL_OUTREACH_REPO_PATH && npm run inbox-health -- --status` shows current per-inbox assessment without changing anything.
- A local SessionStart hook (in this repo's gitignored `.claude/settings.local.json`) also runs the gate when you open the orchestrator, so health is refreshed at your usual entry point.

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

## Run debriefs go to the second brain

When a session produces a run debrief (the HTML "Lead Run Debrief" report), its canonical home is
**`/home/casey/repos/casey-assistant/brain/lead-gen/runs/lead-run-<YYYY-MM-DD>.html`** — and add a row to the
run log table in `/home/casey/repos/casey-assistant/brain/lead-gen/INDEX.md`. Do not invent a new location
(the 2026-07-08 debrief originally landed in `brain/infrastructure/lead-gen-runs/`, since moved).
(Path corrected 2026-07-12 for the Linux VPS: the old `~/Claude/...` home was a Mac path and does not exist here;
the lead-gen brain was fast-forward-merged into `casey-assistant` `main` during the migration sweep.)

## Out of scope for v1

- d100 outreach composition (future separate agent).
- Webhooks, Slack/email alerts, Notion sync.
- Concurrent ticks, retry loops, spend caps.
- Triggering the lead-finder.

## Scaffolding target

Estimated ~200–300 lines TS across `src/cli/orchestrate.ts` + a lead-query helper + branch drivers + logger. Keep it lean.

## Ticks are manual-only (since 2026-06-01)

**The 4-hour `launchd` cron is DISABLED** — agent unloaded, plist renamed `com.caseybrown.youtube-outreach-orchestrator.plist.disabled`. Reason: the Mac is usually asleep or the repo closed at scheduled tick times, so scheduled ticks silently no-fired (a stale `ENRICHMENT_REPO_PATH` had also been killing them — now fixed). **Run ticks by hand: `npm run tick`. Do NOT re-enable the cron unless Casey explicitly says so.** Note the tick now only **preps** leads to `ready_data_scraped` — writing/sending is the separate `npm run send` step (see [Writing/sending is decoupled from the tick](#writingsending-is-decoupled-from-the-tick-since-2026-07-17)). The enrichment-DB cleanup is **no longer manual** — see [Enrichment cleanup is automated](#enrichment-cleanup-is-automated-since-2026-07-30) below. The tick itself stays manual.

Former cron (for reference if ever re-enabled): `17 */4 * * *` (every 4h, off-zero minute).

## Autonomous campaign runs (`approved_hold` pushes) — added 2026-07-09

`npm run campaign -- --target 500` drives a whole `approved_hold` push end-to-end without hand-holding. It is a **thin coordination loop** (still no business logic here — all intelligence lives in the finder + email repos); it just sequences their scripts and logs decisions to `logs/campaign-<date>.jsonl`. Always sanity-check with `npm run campaign:dry` first — dry-run prints every shell command and touches nothing.

What each pass does (`src/drivers/campaign.ts`):

1. **Pre-flight reservoir gate (#2).** Shells `youtube-lead-finder-v1/scripts/reservoir-check.ts --json`. If the fresh-term reservoir can't cover the target runs (verdict `STOCK-UP`), it first runs discovery to stock up. **Standing rule: never start a big run under-stocked** — the 2026-07-08 run proved net conversion HALVES (32%→15%) once fresh terms drain and passes re-hit overlapping terms.
2. **Finder pass**, then **overlapped verify (#1)** — verification of the accumulating pitchable pool runs *concurrently* with the next finder pass; they never wait on each other. (Locked-in change: verify overlaps the finder from the start of the session.)
3. **Adaptive discovery on fade (#3).** If a pass yields few fresh pitchable leads (`--fade-threshold`, default 12), the driver does NOT stop or grind — it shells `discover-veins.ts`, which asks Claude (grounded in the ICP + live term-performance table) to invent the next professions / sub-niches / phrasings, writes them as low-priority **probes** (`parent_term=probe:<date>`), and runs them. `evaluate-probes.ts` then promotes winners to the fresh tier and retires losers. Relentless by pivoting, not by brute force. Every choice logs to `logs/discovery-decisions.jsonl`. Fully autonomous; review the log after.
4. **Finish:** final verify sweep → `promote-verified-to-hold.ts` (which now **auto-sweeps** dead-email score-≥6 leads into `needs_contact`, #5 — no separate manual step).

Stops only on: target hit, `--max-runs` cap, or a **hard wall** (finder exits nonzero twice in a row → quota/keys exhausted or Airtable down). Transient single failures are shrugged off.

**Firm-tilt (#4)** lives in the finder (`src/scoring/firm_tilt.ts`): while the send path needs a verified email, firm-heavy niches (legal/tax/financial/RE/clinics) are run *slightly sooner* — a non-persisted selection nudge, NOT a filter. Coaches & personal brands keep **full eligibility** and still flow in (they pile into `needs_contact` for the future recovery engine — a coach who invests hours in YouTube is obviously reachable, we just can't auto-verify their email yet). Disable with `FIRM_TILT=false` once contact-recovery makes those emails reachable.

The interactive playbook path (`casey-assistant/brain/lead-gen/youtube-run-playbook.md`) still works and stays the reference for what the campaign automates. New env: `EMAIL_OUTREACH_REPO_PATH` must be set for `npm run campaign`.

**2026-07-10 improvements (from the 07-09 debut-run debrief):**
- **`--frontier`** — discovery explores the un-mined edge (`youtube-lead-finder-v1/src/discovery/icp.ts` → `FRONTIER_VERTICALS`) instead of re-mining the saturated core. **This is the #1 volume lever**: the 07-09 run proved we're *term-supply-limited, not channel-supply-limited* (every fresh term still yields ~0.9 pitchable, but re-mining the same ~10 niches yields ~0 net-new terms). Use `--frontier` once the proven niches stop producing net-new terms.
- **`--concurrent N`** (default 1) — runs N finder passes in parallel over **disjoint** term slices (`--term-offset`), ~N× throughput against the ~45-min/pass wall-clock. Caveat: concurrency can create rare duplicate lead rows (same channel under terms in two slices) — run `youtube-lead-finder-v1/scripts/dedupe-leads.ts --apply` after a concurrent session. Default 1 = sequential/safe.
- **`--llm-cap` defaults to 500** — the proven-best throughput (llm-cap 800 was ~60% slower for only ~35% more yield; don't raise it).
- **Auto `evaluate-probes`** — the campaign now promotes probe winners (qr≥10%)→fresh tier and retires losers at the end of every run (was a manual step on 07-09).
- **firm-tilt firstPage bug fixed** — `listActiveTerms` now pages the full active set (`.all()`), not the 100-row `firstPage()` cap that silently hid terms ranked 101+.
- **Cut:** llm-cap >500, unfocused/broad discovery calls (always 0 net-new — always `--focus` or `--frontier`), and re-mining fully-saturated niches.

**2026-07-10 self-healing fixes (from the 07-10 debrief — a term-starvation + quota-blowout day):**
- **Anti-starvation floor (finder).** When the active term pool decays to all-negative priority, `listActiveTerms` auto-reactivates the best never-run paused terms so the finder never grinds mined-out terms while good untapped supply sits idle. This was the day's root cause: the active pool went all-negative while 274 good terms sat paused → 17 consecutive 0-yield passes. Tune with `STARVATION_FLOOR` (default 1). Manual equivalent: `youtube-lead-finder-v1/scripts/reactivate-untapped.ts --apply`.
- **Fast dead-term pause (finder).** A fully-overlapping term (≥10 seen, 0 new) auto-pauses after **one** run (was two) — stops paying a second 100-unit `search.list` on a term already proven saturated. The dominant YouTube cost is the search (100 units) not the channel fetch (1 unit), so this is the main quota-efficiency lever.
- **Quota governor (campaign).** The finder persists its RapidAPI quota to `logs/quota-state.json`; the campaign reads it before each pass and **throttles concurrent→1 at `YT_QUOTA_SOFT_PCT` (80%)**, **hard-stops at `YT_QUOTA_HARD_PCT` (95%)**. Prevents an unattended run from draining the day's quota (07-10 hit 99.9%).
- **Mid-run probe promotion (campaign).** `evaluate-probes` now runs every `PROBE_EVAL_EVERY_FADES` fades (default 3), not just at run-end, so validated veins re-enter the active pool the same session.
- **Crash resilience (orchestrator).** DNS/network errors (`ENOTFOUND` etc.) are retryable in `withRetry`; the floating verify promise has a `.catch` + a global `unhandledRejection` guard — a network blip can no longer hard-crash a multi-hour run (it did on 07-10).
- **Verify concurrency default 4 → 8** (`APPROVED_CONCURRENCY`): keeps the verify lane ahead of 2 concurrent finders so the pitchable pool doesn't back up.

**Biggest remaining lever (not built): the `needs_contact` recovery engine.** 2,173 found-and-scored creators with no verifiable email are parked there; recovering even 40% (~870 leads) likely out-yields a day of fresh finding. Deferred by Casey — a separate build in `youtube-email-outreach-v1` when greenlit.

## Autopilot — the daily autonomous loop (since 2026-07-12)

On the always-on Linux VPS the campaign no longer needs hand-running. `scripts/autopilot/`
drives it around the clock via **system-level systemd units** (mirroring the `auto-sync`
pattern; install with `scripts/autopilot/install.sh`):

- **`autopilot-campaign.service`** (always-on) — `campaign-loop.sh` relaunches
  `npm run campaign --frontier` relentlessly, sleeps through quota exhaustion instead of
  grinding, and stops only on the halt flag or the Anthropic hard-$ ceiling. Zero Claude tokens.
- **`autopilot-checkin.timer`** (hourly) — `checkin.ts` is a code-only health check (free);
  it spends a `claude -p` fix-agent (cheap model) ONLY on a real anomaly (fatal error
  signatures, or approved_hold flat while the finder keeps producing — the 2026-07-11
  missing-skill shape).
- **`autopilot-debrief.timer`** (00:20 PT, the midnight-PT cycle boundary) — writes the HTML
  debrief + analysis.md + INDEX row into the casey-assistant brain, and ships self-improvement
  fixes across the 5 pipeline repos.

Cost is governed by `burn-ledger.ts` (soft `ANTHROPIC_SOFT_USD`=75 / hard=150, model tiering).
Escalation = write `logs/autopilot-halt.flag` and stop (no external notify). Self-improvement
agents may edit + commit any of the 5 repos but NEVER `.env`. Full detail:
[scripts/autopilot/README.md](scripts/autopilot/README.md). This supersedes "manual-only"
below for the campaign; `npm run campaign` by hand still works and shares the same lock.

## Enrichment cleanup is automated (since 2026-07-30)

The enrichment scratch base (`appTvzwOiTLmqC5Mw`) empties itself on the VPS. Nothing
here needs running by hand, and the old "run it manually after each send batch"
instruction was Mac-era text that stopped being true at the migration.

`enrichment-db-cleanup.timer` fires **every 15 minutes** (`OnCalendar=*:0/15`) and runs
`automator/scripts/enrichment-db-cleanup.py --live`, which:

1. Sweeps runs older than `CLEANUP_ROUTINE_AGE_DAYS` (default **7d**) via
   `airtable-cleanup.ts --older-than`. **Age-driven, not send-driven** — it does not
   care whether a lead was ever emailed, so it can never be armed by composing.
2. Opens a capacity valve if the base crosses 80% of the 125,000-record cap.
3. Archives each purged run to `Exported Leads in JSON/`, then auto-rolls those
   staging files into one dated `YYYY-MM-DD.json`. **Consolidation defaults ON**
   (`runRollup` → `consolidate: true`) — without it, a 15-minute timer mints a new
   same-day file every firing, which is exactly how 2026-07-24 ended up as 30 files.
4. Syncs the archive folder to Google Drive (folder `1OjW2Qa29MxKb0E3qaX2WseSWhNFaedyl`,
   set via `ENRICHMENT_DRIVE_FOLDER_ID` in the unit). **Run the sync only through the
   service or with that env var set** — invoking `enrichment_drive_sync.py` bare makes
   it create a *second* folder of the same name and rewrite the saved folder id.

Bundles are **never** touched: the cleanup keeps `enrichment-bundles/<recId>/` on disk,
which is where compose reads from, so a fully-cleaned lead is still composable.

Manual equivalents, if you ever need them: `npx tsx scripts/airtable-cleanup.ts
--older-than 7d --dry-run` to preview, `npx tsx scripts/rollup-archived-runs.ts
--consolidate --dry-run` to preview a rollup.

### The archive is now a complete record of a run

Until 2026-07-30 the generated banks (enemies / insights / insights_analysis / offer /
examples / bio) lived **only** as `researched/*.md` inside a bundle. Every other bundle
file is a rendering of rows that already sit in the enrichment base, so it reached the
JSON archive for free; the banks did not. "Is my research safe?" was a two-place question.

Now the base has a **`banks` table** (`tblk9gbzjkiymX1fJ`) — an 11th table in the same
base, not a new base. `export-run.ts` writes each bank into it after generation, and the
cleanup exports and purges it like every other table.

- **It is rows, not columns on `channels`.** Airtable caps a long-text cell at 100,000
  chars and 224 banks in the 2026-07 corpus exceed it (examples-bank peaks at 1.23 MB),
  so a field-per-bank layout silently truncates ~7% of the corpus. Long banks split
  across rows via `chunk_index`/`chunk_count`; `bank-rows.ts` does the split and rebuild.
- **No `bank_kind` select.** Airtable's field PATCH refuses to add a choice to a live
  singleSelect (bare 422), so every new bank type would have needed hand-editing, and
  writing an unlisted value fails outright. `source_filename` determines the kind.
- The 16 pre-existing archives were backfilled with 10,133 bank rows by
  `youtube-email-outreach-v1/scripts/inject_banks_into_archives.py` (streaming, so it
  survives 315 MB files; write-verify-swap, so originals are never mutated in place).
  Injected rows carry a `recbf` id prefix plus `backfilled_at`/`backfilled_from` so
  reconstructed rows are distinguishable from exported ones.
- **`_full-base-purge-*.json` are a different schema** (`{kind, baseId, rowCounts,
  tables}` — a flat dump of the whole base, no `runs` array). The injector detects and
  skips them; treating one as a per-run archive would rewrite it as an empty shell.

## Operational gotchas (verified 2026-06-01)

- **SmartLead "sent" ≠ emailed.** Our push only LOADS leads into a campaign; SmartLead's scheduler sends on Mon–Thu 09:00–15:00 ET (Fri/Sat/Sun = 0 by design). The SmartLead UI/Ask-AI lag and lie about volume — verify real sends with `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`, never the UI. See `system-overview.md` → "Verifying SmartLead sends".
- **YouTube backend is `auto` (direct-keys-first), merged to `main`.** No active branch landmine. Each downstream repo configures its own backend; enrichment repo is separate.
- **`last_contacted_at` is polluted** (historical backfill from `outreach_processed_at`); the pipeline never reads it, so it doesn't affect sending, but don't trust it as a "contacted" signal.
- **New email volume comes from a fresh `npm run finder` run**, not re-running outreach — the approved pipeline is essentially drained. (The 268 "unreviewed" leads are NOT untapped volume: all score 4–5, below the ≥6 bar; everything ≥6 is already triaged. Reject or ignore them.)

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

---

## Voice Firewall (house law, wired 2026-07-23 — read before writing any prose)

Every reader-facing sentence this repo produces must pass the Voice Firewall. Before writing, read the canonical file:

- Mac: `~/Claude/casey-assistant/brain/content-strategy/voice-firewall.md`
- VPS: `/home/casey/repos/casey-assistant/brain/content-strategy/voice-firewall.md`

Default cleverness = **level 2 (Dry)** unless the task names a level. The 1-5 levels and their golden examples live in `casey-assistant/brain/content-strategy/cleverness-scale.md` (same folder). Where this skill's own voice rules are stricter, the stricter rule wins.

Fallback (ONLY if the canonical file is unreachable): zero em dashes; level-2 dry style (plain, direct, no ornament, no imagery); every line passes the read-aloud listener gate; and state in your output that the full firewall was not loaded.

<!-- LLM-SPEND-GUARD v1 — managed block; keep identical in every repo -->
## LLM Spend Guard (house law — applies in every repo)

**Subscription chat is fine.** Work billed to a subscription plan (Claude Code on the Max plan, Codex on a ChatGPT plan, whatever the tool) needs no disclosure — just do the task.

**LLM API credits require disclosure BEFORE starting.** If a task will spend metered LLM API credits from ANY provider (Anthropic, OpenAI, OpenRouter, Gemini, Groq, etc.) — including launching a script, pipeline, or service that makes LLM SDK/API calls — the output must state, before the task begins:

- that it will spend API credits, and which provider/key (key by NAME only, never the value)
- a rough dollar estimate

**Estimated ≥ $1 → hard stop.** Do not start the task until Casey explicitly approves the spend.

**Scope: LLM usage only.** Non-LLM paid APIs (Deepgram, Apify, SmartLead, YouTube, etc.) are exempt from this rule.

**Limitation:** this governs chat-initiated work. Headless automation that is already running doesn't re-read this file mid-run; the rule applies at the moment a session starts, modifies, restarts, or triggers that automation.
<!-- /LLM-SPEND-GUARD -->
