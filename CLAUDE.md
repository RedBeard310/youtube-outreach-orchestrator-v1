# youtube-outreach-orchestrator-v1

> **⚡ FIRST: read [docs/standing-orders.md](docs/standing-orders.md) — the
> living priority document.** It says which discovery lanes are primary TODAY
> and what Casey most recently ordered. It outranks any stale priority
> implied elsewhere in this file, and it must be updated in-session whenever
> Casey changes a priority in chat. (Created 2026-08-14 because day-to-day
> instructions kept slipping between sessions.)

Thin coordination loop. Polls Airtable on a cron, advances leads through whichever stage they're ready for by shelling out to existing repos. Owns no business logic of its own.

Full spec: [orchestrator-spec.md](orchestrator-spec.md). Read it before making non-trivial changes.

## Core rules

- **No business logic here.** Don't find emails, enrich channels, or compose copy in this repo. If a stage needs new logic, it belongs in the underlying repo (`youtube-email-outreach-v1`, deep-research repo, etc.), not the orchestrator.
- **No direct skill calls.** The orchestrator calls `youtube-email-outreach-v1`; that repo routes compose to `5-ideas-email` / `nick-saraev-cold-email` via its own A/B variant system.
- **Postgres is the state store** (since 2026-08-12; Airtable before that). The orchestrator reads `review_status` and `outreach_status` from `leads.lead_candidates` in the `pipeline` database and writes nothing directly — underlying repos write their own state. Access goes through the `pipeline-db` package, which presents the same interface the Airtable SDK did, so call sites read the same as they always did.
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
- **RapidAPI is being retired (2026-08-10) — see the YouTube API Key Pool block at the bottom
  of this file.** Historically, when every direct key died, `auto` mode fell through to the
  RapidAPI YouTube mirror (`RAPIDAPI_KEY` + `RAPIDAPI_YOUTUBE_HOST`, host
  `youtube-data-api-v33.p.rapidapi.com`), a separate paid credit pool returning identical JSON.
  Those credits stop working within days of 2026-08-10. All repos still default to
  `YOUTUBE_API_BACKEND=auto` (the var is unset everywhere = auto), and `auto` behaves as
  direct-only once RapidAPI is gone, so no config change is needed. What changes: when the
  direct pool drains, a run now halts instead of degrading. That's expected. The answer is more
  direct keys, and the pool went from 9 to 39 on 2026-08-10 for exactly that reason.
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
- `D100` → step A: `youtube-email-outreach-v1 --stop-after verify`; step B: per-lead invocation of `youtube-deep-research-v1`'s `scripts/run-channel.ts` (with auto-bootstrap via `scripts/register-client.ts` if the slug is new to `clients.json`). Each d100 lead is a `client_id` in the shared `research` schema; it used to be a whole Airtable base of its own. **No compose, no SmartLead in v1.** Terminal: `outreach_status = "deep_research_complete"`.

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

**Why it was decoupled: the enrichment-DB cleanup could never be allowed to strand a ready-to-write lead.** That cleanup is now retired (see [Enrichment cleanup is retired](#enrichment-cleanup-is-retired-since-2026-08-12)) because it only ever existed to stay under Airtable's record cap, so the hazard is gone entirely. The decoupling stays: it is a good property on its own, and compose still reads from the **on-disk bundle** (`enrichment-bundles/<recId>/`) rather than the database, so a lead is composable regardless of what the store holds.

## What the orchestrator does each tick

1. Query lead base for `review_status in (approved, d100)` AND not terminal for that branch.
2. Bucket by branch.
3. For each branch, shell out to the next-stage repo with `--lead-ids` for that batch. Wait for completion.
4. Write one JSONL line to `logs/orchestrator-<date>.jsonl`.

Pseudo-code in spec §"Sequential stage handoffs".

## Do-not-contact is enforced, and the reason matters (since 2026-08-13)

`leads.do_not_contact` is the registry of everyone we have already spoken to, and
`lead_candidates.do_not_contact` is the flag every lead-selection query filters on.
It is maintained by `automator/scripts/dnc-sync.py` (hourly, `dnc-sync.timer`).
Full detail: [automator/docs/dnc-sync.md](../automator/docs/dnc-sync.md).

- **Every query here already carries `NOT({do_not_contact})`** — the tick queue, the
  send queue, the campaign verify lane, and `isApprovedFireReady`. If you add a new
  lead-selection query, add it there too.
- **A bulk filter is not the guard.** This repo always shells out with `--lead-ids`,
  and the email repo fetches those by id with no filter at all. The check that
  actually stops a send is per-lead in `youtube-email-outreach-v1/src/cli/outreach.ts`,
  once at the top of `runLead` and once more immediately before the SmartLead POST.
  Never remove either.
- **Reasons are not interchangeable.** `opted_out` is permanent and legally load-
  bearing. `not_interested` is a 45-day cooldown that releases itself, because
  someone who said "not right now" never asked to be removed. `client`, `free_work`
  and `in_conversation` are people we still talk to, just never by cold sequence, so
  they are NOT pushed to SmartLead's block list.
- **Suppressing someone by hand** means an entry in `automator/config/dnc-manual.json`,
  not a status change here. Releasing them means deleting the config entry AND the
  registry row; deleting only the config does nothing, on purpose.

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

## Database architecture (Postgres, since 2026-08-12)

One database, `pipeline`, on a private box reachable at `10.0.0.3`. Three schemas, because Postgres cannot join across databases and these do need joining:

- **`leads`** — `lead_candidates` and `search_terms`, the old lead base `appenY7r5jlZMRpJ0`. The orchestrator reads everything and writes `outreach_status` transitions for the d100 path only (no other agent updates `lead_candidates` for d100).
- **`enrichment`** — the old quick-research scratch base `appTvzwOiTLmqC5Mw`. **No longer a scratch base**: there is no record cap, so nothing is purged and nothing needs exporting.
- **`research`** — deep research. The 52 per-client Airtable bases collapsed into one set of tables with a `client_id` column. Isolation is a query filter now rather than a separate base, so it lives inside `pipeline-db` and cannot be forgotten at a call site.

**Nothing here talks to Airtable.** The `pipeline-db` package presents the same interface the Airtable SDK did — `base('table').select({ filterByFormula }).all()` and the rest — so existing call sites were unchanged. Its filter translator refuses any expression it cannot render exactly rather than approximating, because a wrong filter does not crash, it selects the wrong leads and emails them.

Connection string: `/home/casey/.pipeline-db.env`. Deliberately not in the shared env bank, which the Mac overwrites every couple of minutes.

Browse the data in NocoDB at `db.contentgetsclients.com`.

**What went away with the cap:** the 15-minute cleanup timer, the export-and-purge cycle, bank chunking at 100,000 characters per cell, the 10-records-per-request batching, and the 5-requests-per-second token bucket. All of it was tax paid to Airtable's limits.

For the schema fields the orchestrator reads/writes, see [LEAD_CANDIDATES_SCHEMA.md](LEAD_CANDIDATES_SCHEMA.md) (paste from the email-outreach repo).

### D100 step B per-lead flow

For each verified-email d100 lead:

1. Derive slug = `slugify(channel_name)` (must match `youtube-deep-research-v1/src/lib/clients.ts`).
2. Read `<DEEP_RESEARCH_REPO_PATH>/clients.json`. If the slug isn't there, shell out to `npx tsx scripts/register-client.ts --client <slug> --name "<channel_name>"`. That inserts one row; it used to provision an entire Airtable base in three phases.
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

**The 4-hour `launchd` cron is DISABLED** — agent unloaded, plist renamed `com.caseybrown.youtube-outreach-orchestrator.plist.disabled`. Reason: the Mac is usually asleep or the repo closed at scheduled tick times, so scheduled ticks silently no-fired (a stale `ENRICHMENT_REPO_PATH` had also been killing them — now fixed). **Run ticks by hand: `npm run tick`. Do NOT re-enable the cron unless Casey explicitly says so.** Note the tick now only **preps** leads to `ready_data_scraped` — writing/sending is the separate `npm run send` step (see [Writing/sending is decoupled from the tick](#writingsending-is-decoupled-from-the-tick-since-2026-07-17)). The enrichment-DB cleanup is **retired** — see [Enrichment cleanup is retired](#enrichment-cleanup-is-retired-since-2026-08-12) below. The tick itself stays manual.

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

**The `needs_contact` recovery engine is BUILT AND RUNNING.** Casey merged it 2026-08-23
(`1bea933`). It is the Bloodhound lane in `src/recovery/bloodhound-lane.ts`, dispatched from
the campaign's finish block: a free collect pass that walks the parked pool looking for
contact points, and a ZeroBounce verify pass that flips whatever it can into
`approved_hold`. The line that used to sit here said the engine was unbuilt and the pool
held 2,173. Both were out of date, and a session reading it on 2026-09-02 planned a rebuild
of something that already existed. Read the lane's own state (`logs/bloodhound-lane-state.json`,
`logs/bloodhound-collect.log`) before believing any number written down about it.

The pool is 4,951 at 2026-09-02, up from 3,290 when the lane shipped, because arrivals have
outrun the lane's throughput, not because the lane is broken. Its verify half is fully
drained (queue depth 1 of a 200 batch) and 374 leads have already been recovered into
`approved_hold`. The bottleneck is entirely the collect pass, which is why its batch went
from 40 to 150 on 2026-09-02.

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

## Enrichment cleanup is retired (since 2026-08-12)

`enrichment-db-cleanup.timer` is **stopped and disabled**. Do not re-enable it.

It existed for one reason: Airtable capped a base at 125,000 records, so the enrichment
base had to be emptied on a schedule and its contents exported to JSON to avoid hitting
the ceiling. Postgres has no such cap, so there is nothing to purge and nothing to
export. Running it now would purge a database nothing writes to.

Everything it did is either unnecessary or already done:

- **Purging runs older than 7 days** — unnecessary. Data accumulates; that was the point.
- **The capacity valve at 80% of the cap** — no cap exists.
- **Exporting purged runs to `Exported Leads in JSON/`** — the archive is now history, not
  a live dependency. It has been loaded into Postgres and stays on disk.
- **Syncing that folder to Google Drive** — stopped with the timer.

**The archives it produced were lossy, which is worth knowing.** `2026-06-08.json` holds
97 runs and zero transcripts; across all archives 53,024 transcripts were captured while
67,491 transcript files sit on disk. Roughly 14,500 transcripts were purged from Airtable
and never archived. The research itself is safe -- the on-disk bundles are complete, and
compose reads from the bundle -- but a run whose rows were lost cannot be re-exported
from the database. Nothing is purged now, so this stops here.

## The archive is now a complete record of a run

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

- **The store is Postgres, not Airtable** (2026-08-12). Anything below that describes an Airtable base, an export, or a purge is history. `pipeline-db` is the only way in.

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

## Zero-Anthropic pipeline (house law since 2026-08-01)

**Nothing in this pipeline bills the Anthropic API.** Casey's standing order after the
2026-08-01 ~$80/day incident: the Anthropic key is off-limits to every pipeline repo
unless he explicitly says otherwise for a named task. What replaced it:

- **Every LLM task runs a cheap OpenRouter model driven by a committed skill file**
  (instructions + golden examples) with the model choice in that repo's `models.json`
  (config-as-code — env is Mac-clobbered and can't be trusted for this).
- **Finder** (`youtube-lead-finder-v1`): scoring (qwen3.7-flash, self-consistency
  vote-of-3), host-ID, keyword prefilter, vein discovery (DeepSeek v3.2). Skills in
  `skills/*.md`, eval harnesses in `scripts/skill-eval-*.ts`, frozen fixtures +
  results in `logs/skill-eval/`. Validated at parity with the old Haiku scorer's own
  self-consistency ceiling before the swap.
- **Email repo**: compose, emailFinder, hostName — all OpenRouter via `models.json`.
- **Quick + deep research repos**: all bank/stage tasks → DeepSeek v3.2 via `models.json`.
- **Autopilot `claude -p` agents** (check-in fix, debrief) bill the **Max-subscription
  OAuth login**, never the API key — the systemd units carry no key and the scripts
  `unset ANTHROPIC_API_KEY` as a hard guard. Subscription usage is allowed (see LLM
  Spend Guard below); API-key usage is not.
- `anthropic:`-prefixed model strings still exist in the transports as an EXPLICIT
  opt-in escape hatch. Never set one as a default or in a models.json without Casey's
  word.

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

## Model Policy (house law — wired 2026-08-01)

**Which LLM this repo uses for any task is set in `models.json` at the repo root — never in code, never in env.** Read the house standard before changing a model or adding an LLM call:

- Mac: `~/Claude/casey-assistant/brain/infrastructure/model-policy.md`
- VPS: `/home/casey/repos/casey-assistant/brain/infrastructure/model-policy.md`

House default for research / mining / synthesis work is `openrouter:deepseek/deepseek-v3.2`. Model ids are configuration and are committed; API keys stay in the shared env. Env-based model selection is banned — the Mac clobbers the VPS env file every ~2 minutes, which silently reverted a swap and burned ~$22 of unplanned Sonnet on 2026-07-31.

To change a model: edit `models.json` and commit. Do not hard-code a model id in any module.

<!-- SUBSCRIPTION-NOT-API v1 — managed block; keep identical in every repo -->
## Subscription, not API (house law — wired 2026-08-05)

**Headless `claude -p` in automation bills Casey's Max subscription. It must never bill the Anthropic API.**

Claude Code *prefers* `ANTHROPIC_API_KEY` over the subscription login whenever that variable is in its environment. So any script that loads the shared env and then spawns `claude` silently moves its spend off the already-paid plan onto metered credit. That leak ran **~$10–16/day** through 2026-08-03/04. The 2026-08-01 attempt to fix it failed because it patched only interactive shells (`~/.bashrc`) and three shell scripts, and missed seven copy-pasted `load_env()` functions — which is why the fix now lives *below* the scripts.

**Three layers. Do not remove any of them:**

1. **`ANTHROPIC_API_KEY` is stripped at the env-storage sync boundary** (`sync-to-vps.sh`, `MAC_ONLY`), so the key does not exist on the VPS at all. Automations that don't exist yet inherit the fix.
2. **`/usr/bin/claude` on the VPS is a shim** that unsets the key and execs the real binary. It sits at `/usr/bin/claude` rather than `/usr/local/bin` because some scripts hard-code that path. `claude-shim-guard.timer` re-asserts it every 15 min, because `npm update -g` restores the original symlink.
3. **This rule**, so no future script re-opens it.

**Choosing where a new LLM call goes:**

- **Judgment, tool use, writing → the Claude Code CLI.** It is free on the plan. Do not move work onto a paid API to "save money" — that costs more, not less.
- **High-volume mechanical work (classification, extraction, tagging) → OpenRouter.** Not for cost; for **rate limits**. A burst of CLI agents draws on the same Max limit as Casey's own interactive sessions. Route it with an `openrouter:` prefix in `models.json`.

**Ops footgun:** never `cp` a file over `/usr/bin/claude` without `rm`-ing it first. It may be a symlink, and `cp` writes straight through it and destroys the ~275MB real binary. Recovery is `sudo npm install -g @anthropic-ai/claude-code@<version>`.
<!-- /SUBSCRIPTION-NOT-API -->

<!-- CLEAR-WRITING v1 — managed block; keep identical in every repo -->
## Clear Writing (house law — wired 2026-08-06)

**Every piece of prose a person will read passes through Clear Writing.** Chat replies, emails, docs, reports, READMEs, notes, commit messages, slide text, Notion pages, client deliverables. No exceptions, in any repo.

**The one bar:** *if a smart high-schooler couldn't follow the idea on the first pass, rewrite it.* Assume the reader knows nothing about the business, hasn't read your other work, and won't read the sentence twice.

The rules, short version:

1. **Read it cold as the person who'll read it.** If a line needs the thinking behind it explained, it fails.
2. **Define at first use, then restate simpler.** The definition can't contain the confusion. Defining jargon with jargon fails.
3. **Bridge anything unfamiliar** to something they already know ("it's kinda like..."), then retire the bridge. One analogy per idea, taught in full sentences, connected back once, then back to literal words.
4. **Zero em dashes.** Commas for asides, periods for full thoughts. Carve-outs: the "— Casey" sign-off and structural separators in a locked template.
5. **No corporate filler** (unlock, leverage, elevate, move the needle), **no strategist vocabulary** in reader-facing text (funnel, ICP, pain point, install a belief), **no LLM dialect** ("here's the kicker"), **no hedging** (maybe, I think, sort of).
6. **No "not X, it's Y" as decoration.** Legal only when swapping an old belief the reader actually holds.
7. **Unpack compressed phrasing.** "A see-it-coming cost" becomes "a cost you can see coming." If a phrase squeezes an action into a metaphor or a hyphen stack, say the action.
8. **No bumper-sticker closers.** End on the actual mechanic in literal words, never an aphorism.
9. **Two links is the ceiling on a causal chain.** State the conclusion and trust the reader.
10. **Contractions on.** Talk TO the reader. Contraction-free essay prose is its own AI tell.
11. **Concrete beats abstract.** Specifics over adjectives, a worked example over an elegant abstraction, the believable number over the impressive one.
12. **Never present an invented specific as a real fact.** Ask for it instead.

**Cleverness runs at level 2 (Dry) by default**, everywhere. Plain and direct, no ornament. A format skill may name a different default for its own format (long-form scripts run at 3).

**Full standard** (read it before any substantial writing or rewrite job):

- Mac: `~/Claude/casey-assistant/brain/content-strategy/clear-writing.md`
- VPS: `/home/casey/repos/casey-assistant/brain/content-strategy/clear-writing.md`
- Skill: `clear-writing` (invoke it for rewrite jobs; it carries the linter at `scripts/lint.mjs`)

**Scope note.** Clear Writing is a clarity standard, not a persuasion standard. It carries none of the YouTube machinery: no proof stacking, no multiple analogies per idea, no Give Then Gap hook, no CTA rules, and no abrupt ending. **A normal conclusion is allowed.** That machinery stays in `script-writing-long-form-writing-skill-v3`. For writing another person will read, the Voice Firewall still outranks this block, and format skills add structure on top. Neither may loosen the bar above.
<!-- /CLEAR-WRITING -->

<!-- NOTION-ACCESS v1 — managed block; keep identical in every repo -->
## Notion Access (house law — wired 2026-08-10)

**There is a Notion API token in the shared env: `NOTION_API_TOKEN`.** It works from any repo, on the Mac and on the VPS, in any session, including headless ones.

**Never report that you can't reach Notion because a connector isn't signed in.** The claude.ai Notion connector has to be authorized per session and doesn't exist in automation. It is a convenience, not the way in. If it isn't there, use the API and carry on with the task.

```bash
curl -s -X POST "https://api.notion.com/v1/databases/<DATABASE_ID>/query" \
  -H "Authorization: Bearer $NOTION_API_TOKEN" \
  -H "Notion-Version: 2022-06-28" \
  -H "Content-Type: application/json" \
  -d '{"page_size":100}'
```

The four things that trip this up:

1. **Pin `Notion-Version: 2022-06-28`.** Notion changes response shapes between versions.
2. **Paginate.** One request returns 100 rows at most. If the reply says `"has_more": true`, send it again with `"start_cursor"` set to the `next_cursor` you got back. Skip this and a 115-row database silently looks like a 100-row one.
3. **Read the ID off the URL correctly.** In `app.notion.com/p/<workspace>/<32-char-id>?v=<other-id>`, the chunk in the path is the ID. The one after `?v=` is a saved view and the API rejects it.
4. **A 404 usually means "not shared," not "missing."** Notion integrations only see what someone hands them. Ask Casey to open the page, click `...`, go to Connections, and add "API For Claude?".

Key values must never be printed, echoed, logged, or committed. That applies to the token itself and to any secret stored inside a Notion database. Pull those into a file, redact before displaying, delete the file after.

**Full standard** (which databases are reachable, the endpoint table, working code to copy):

- Mac: `~/Claude/casey-assistant/brain/infrastructure/notion-access.md`
- VPS: `/home/casey/repos/casey-assistant/brain/infrastructure/notion-access.md`
<!-- /NOTION-ACCESS -->

<!-- YOUTUBE-KEY-POOL v1 — managed block; keep identical in every repo -->
## YouTube API Key Pool (house law — updated 2026-08-19)

**Count the pool, don't quote it.** It went 9 keys, then 39, then 52, then 66, all inside ten days, and Casey is still adding Google Cloud accounts. Any number written down here would be wrong within the week, so this block deliberately doesn't carry one. Read `YOUTUBE_API_KEY_1..N` out of the env and use however many are there. Never hard-code a key count, a slot ceiling, or a "we have N keys" assumption. Each key is worth roughly 10,000 quota units a day.

**Adding keys is one command, run on the Mac.** `casey-assistant/tools/sync-youtube-keys-from-notion.py` reads Notion, skips the Suspended rows, diffs by key value, tests each new key live, and appends the working ones with contiguous slots. Dry run by default, `--apply` writes. The Mac is the master copy of env-storage and overwrites the VPS copy every two minutes, so a VPS-only run gets silently reverted.

**RapidAPI is retired.** `RAPIDAPI_KEY` stopped working after 2026-08-10. That was planned, not a fault, and it needed no config change: nothing anywhere pins `YOUTUBE_API_BACKEND`, so every repo runs `auto`, and `auto` behaves as direct-keys-only when RapidAPI is missing. Don't build anything new on the mirror, and don't debug its absence as a bug. If a run dies with every direct key exhausted, the answer is more keys, not reviving RapidAPI.

**Keep the slot numbering contiguous, starting at `_1`.** Several key loaders stop scanning after 5 empty slots in a row. If you retire a dead key from the middle of the pool, renumber the rest. A gap of 5 or more silently hides every key past it, and the only symptom is a smaller pool than you expected with no error raised.

**A repo's own `.env` can freeze the pool.** If a repo keeps a local copy of the keys, it runs on whatever count that file was frozen at, which is how one repo ran 7 keys against a 39-key bank. The fix is to merge the shared bank by key value at load time, the way `youtube-deep-research-v1`, `youtube-lead-finder-v1`, and `youtube-email-outreach-v1` do. Copy that, don't hand-sync the file.

**A dead key is normal, not an incident.** Keys go over daily quota or get their Google Cloud project suspended. Rotate past them. Match failures specifically: `quotaExceeded` and `keyInvalid` retire a key for the run, `403 forbidden` means suspended, a plain 429 rotates but keeps the key eligible, and anything else (like `commentsDisabled`) must propagate without burning a key.

**Source of truth is the Notion "YouTube API Key Database."** New keys land there before they reach `.env`, so re-read it rather than assuming the pool is current. It needs no Notion connector, only the API token (see the Notion Access block). The `Select` column carries Working / Suspended, and a blank status means nobody has checked yet, not that the key is bad.

**Full detail:**

- Rotation spec: `youtube-deep-research-v1/docs/youtube-api-key-rotation.md`
- Pool history and audit method: `casey-assistant/brain/infrastructure/youtube-api-key-pool.md`
<!-- /YOUTUBE-KEY-POOL -->
