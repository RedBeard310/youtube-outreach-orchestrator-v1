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

All other `review_status` values (`unreviewed`, `rejected`, `sent`, `below_threshold`, `scoring_failed`, `demo_niche_excluded`, `approved_hold`, `needs_contact`) are ignored.

`approved_hold` (added 2026-07-07) is a **deliberate parking status**: leads that are approved and validated (email found/verified) but must NOT be auto-composed/sent yet — e.g. awaiting a different email process. The tick ignores it. Park/release via `youtube-email-outreach-v1/scripts/hold-batch.ts` (`<ids-file>` to hold, `--release` to flip all `approved_hold` → `approved`). Release only when the intended email process is ready.

`needs_contact` (added 2026-07-09) is a **recovery-lane parking status**, parallel to `approved_hold`: score-≥6 leads that are found + host-identified but have **no verified email yet** (`outreach_status` = `no_email_found` / `email_invalid`). Not discarded — held for a future contact-recovery process; on obtaining a valid email they flip to `approved_hold`. The tick ignores it. Sweep failures into it after each `approved_hold` push via `youtube-email-outreach-v1/scripts/demote-failed-to-needs-contact.ts --apply`. Full context: `casey-assistant/brain/lead-gen/youtube-run-playbook.md` §8b.

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

**The 4-hour `launchd` cron is DISABLED** — agent unloaded, plist renamed `com.caseybrown.youtube-outreach-orchestrator.plist.disabled`. Reason: the Mac is usually asleep or the repo closed at scheduled tick times, so scheduled ticks silently no-fired (a stale `ENRICHMENT_REPO_PATH` had also been killing them — now fixed). **Run ticks by hand: `npm run tick`. Do NOT re-enable the cron unless Casey explicitly says so.** The nightly enrichment-cleanup cron (`com.caseybrown.airtable-cleanup`) is likewise disabled — run `airtable-cleanup.ts --auto` manually after each send batch, then `rollup-archived-runs.ts`. The durable fix for both is an always-on host (VPS / trigger.dev); until then, everything is manual.

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

## Operational gotchas (verified 2026-06-01)

- **SmartLead "sent" ≠ emailed.** Our push only LOADS leads into a campaign; SmartLead's scheduler sends on Mon–Thu 09:00–15:00 ET (Fri/Sat/Sun = 0 by design). The SmartLead UI/Ask-AI lag and lie about volume — verify real sends with `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`, never the UI. See `system-overview.md` → "Verifying SmartLead sends".
- **YouTube backend is `auto` (direct-keys-first), merged to `main`.** No active branch landmine. Each downstream repo configures its own backend; enrichment repo is separate.
- **`last_contacted_at` is polluted** (historical backfill from `outreach_processed_at`); the pipeline never reads it, so it doesn't affect sending, but don't trust it as a "contacted" signal.
- **New email volume comes from a fresh `npm run finder` run**, not re-running outreach — the approved pipeline is essentially drained. (The 268 "unreviewed" leads are NOT untapped volume: all score 4–5, below the ≥6 bar; everything ≥6 is already triaged. Reject or ignore them.)
