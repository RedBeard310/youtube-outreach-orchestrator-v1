# Orchestrator spec — `youtube-outreach-orchestrator-v1`

Working name. Coordinates the existing repos and skills into one continuous workflow: discover → review → find email → enrich → draft → push.

The orchestrator owns almost no business logic. Each repo/skill already runs end-to-end on its own. The orchestrator's job is to call them in the right order, in response to state changes in Airtable, and make sure nothing falls through the cracks.

---

## What this is, what it isn't

**Is:**
- A standalone repo (`youtube-outreach-orchestrator-v1`) with a thin coordination loop.
- Cron-triggered (every N hours) to poll Airtable and advance leads through whatever stage they're ready for.
- Two routing paths: `approved` (standard outreach) and `d100` (deep research, no automated email yet).
- A logger of what ran when, so debugging across repos is one place.

**Isn't:**
- A re-implementation of any existing logic. Doesn't find emails, enrich channels, or compose emails on its own.
- A webhook server, queue, or event bus. Pure polling.
- A code-level dependency for the repos it calls — they remain independently runnable.
- Responsible for retries or backoff inside a repo's own stages. Each repo handles its own internal failures; the orchestrator only triggers and observes.

---

## High-level workflow

```
                  ┌─────────────────────────────────────┐
                  │   youtube-lead-finder-v1            │
                  │   discovers channels                 │
                  │   writes to Airtable                 │
                  │   review_status = "unreviewed"       │
                  └─────────────────┬───────────────────┘
                                    │
                          [Casey manually reviews]
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
       review_status = "approved"            review_status = "d100"
                │                                       │
                │  ──── orchestrator picks up ────      │
                │                                       │
                ▼                                       ▼
  ┌──────────────────────────────┐       ┌──────────────────────────────┐
  │ youtube-email-outreach-v1    │       │ youtube-email-outreach-v1    │
  │ find email + verify          │       │ find email + verify          │
  │ (same finder both paths)     │       │ (same finder both paths)     │
  └──────────────────────────────┘       └──────────────────────────────┘
                │                                       │
        [email found?]                          [email found?]
                │ yes                                   │ yes
                ▼                                       ▼
  ┌──────────────────────────────┐       ┌──────────────────────────────┐
  │ Quick YouTube Channel        │       │ <Deep-Research repo, TBN>    │
  │ Research v1                  │       │ writes to a separate, perm-  │
  │ writes to scratch base       │       │ anent Airtable base          │
  │ (cleaned 24h after sent)     │       │ (never auto-cleaned)         │
  └──────────────────────────────┘       └──────────────────────────────┘
                │                                       │
                ▼                                       ▼
  ┌──────────────────────────────┐       ┌──────────────────────────────┐
  │ Compose email (Opus 4.7)     │       │ [future: d100 outreach       │
  │ A/B 50/50 between:           │       │  agent. Out of scope for v1  │
  │   - 5-ideas-email skill      │       │  of this orchestrator.]      │
  │   - nick-saraev-cold-email   │       │                              │
  │     skill                    │       │ Currently terminal at        │
  └──────────────────────────────┘       │ enrichment complete.         │
                │                        └──────────────────────────────┘
                ▼
  ┌──────────────────────────────┐
  │ Push to SmartLead, paused    │
  │ Niche + variant routing      │
  └──────────────────────────────┘
                │
                ▼
       review_status = "approved"
       outreach_status = "sent_to_smartlead"
       [Casey clicks Start in SmartLead UI when ready]
```

---

> **Updated 2026-07-17 — the approved path is now split.** The tick only *preps*: find → verify → enrich, then parks at `outreach_status = "ready_data_scraped"` (via `--stop-after enrich`). It **no longer composes or pushes.** The "Compose email" and "Push to SmartLead" boxes above are now a separate, on-demand step — **`npm run send`** — that you trigger whenever ("everything lying in wait, ready to write"). `ready_no_data` is a reserved sibling status (ready to email, no enrichment data) that nothing produces or sends yet. Full detail: orchestrator `CLAUDE.md` → "Writing/sending is decoupled from the tick."

## Repos and skills the orchestrator calls

| Component | Type | Role | Owned state |
|---|---|---|---|
| `youtube-lead-finder-v1` | Agent (repo) | Discovers YouTube channels matching ICP, writes to lead Airtable base with `review_status="unreviewed"`. **No orchestrator involvement** — runs on its own schedule, possibly Casey-triggered. | Lead candidates table |
| `youtube-email-outreach-v1` | Agent (repo) | The current repo. Find email → verify → enrich (calls Quick research) → compose → push — **but the tick stops after enrich (parks at `ready_data_scraped`); compose + push are the decoupled on-demand `npm run send`.** Handles its own state machine via `outreach_status`. Already supports `--lead-id`, `--variant`, `--concurrency` flags. | Outreach status fields + email vars |
| `quick-youtube-channel-research-v1` | Agent (repo, locked) | Quick enrichment. Called by email-outreach-v1 today; will continue to be called the same way. Writes to scratch Airtable base, exports local markdown bundle. | Scratch Airtable base (cleaned by `airtable-cleanup.ts`) |
| **Deep-research agent (TBN)** | Agent (future repo) | For `d100` leads only. Likely a rename/fork of `quick-youtube-channel-research-v1` with deeper extraction passes. Writes to a separate, permanent Airtable base. Casey will name this. | Dedicated permanent Airtable base |
| `5-ideas-email` | Skill (`~/.claude/skills/5-ideas-email/`) | Email writer variant A. Read by `youtube-email-outreach-v1` at compose time. | — |
| `nick-saraev-cold-email` | Skill (`~/.claude/skills/nick-saraev-cold-email/`) | Email writer variant B. A/B split with variant A via SHA-256 hash of lead ID. | — |

The orchestrator does **not** call the skills directly. It only calls `youtube-email-outreach-v1`, which already knows how to route compose to the right skill via the existing variant system.

---

## Branching: `approved` vs `d100`

Both paths share the first two stages (find email + verify). They diverge at enrichment.

| Stage | `approved` path | `d100` path |
|---|---|---|
| Find email | `youtube-email-outreach-v1` LLM finder | Same |
| Verify email | ZeroBounce (same) | Same |
| If no email found / verified invalid | Terminal: `no_email_found` or `email_invalid`. Skip enrichment. | Same |
| Enrichment | `quick-youtube-channel-research-v1` → scratch base, cleanup eligible after 24h post-send | Deep-research agent → permanent base, never auto-cleaned |
| Compose email | A/B variant from the two skills | None for v1 |
| Push to SmartLead | Yes, paused, niche + variant routing | None for v1 |
| Terminal state | `outreach_status = "sent_to_smartlead"` | `outreach_status = "deep_research_complete"` (new value to add) |

The lead's `review_status` field on the lead Airtable base is what the orchestrator reads to branch. The orchestrator never sets `review_status` — that's Casey's manual review action.

---

## Data flow / where state lives

| Lives at | What | Touched by |
|---|---|---|
| Lead Airtable base (`appenY7r5jlZMRpJ0`) | One row per lead (`lead_candidates` table). `review_status`, `outreach_status`, `email_address`, `email_variant`, `smartlead_*`, `enrichment_run_id`. | Lead-finder writes rows. Casey edits `review_status`. Email-outreach updates outreach fields. Orchestrator reads everything, writes nothing directly (delegates to email-outreach). |
| Quick enrichment Airtable base (`appTvzwOiTLmqC5Mw`) | Scratch — videos, transcripts, comments, etc. Channels table kept as dedup index. | `quick-youtube-channel-research-v1` writes. `airtable-cleanup.ts` deletes scratch 24h after send. |
| **D100 deep-research Airtable base (TBC base id)** | Permanent — same shape as scratch base but never auto-cleaned. Used for Casey's manual review + future d100 outreach agent. | Deep-research agent writes. No automated cleanup. |
| Local file system, this repo's `enrichment-bundles/<recId>/` | Markdown bundle for quick enrichments. Source of truth for the compose stage. | `quick-youtube-channel-research-v1` exports. Email-outreach reads at compose. |
| Local file system, deep-research repo's bundles dir | Markdown bundle for d100 deep enrichments. | Deep-research agent. |
| SmartLead | Per-niche-per-variant campaigns, leads added in PAUSED state. | Email-outreach pushes. Casey clicks Start. |

The orchestrator itself has **no persistent state of its own** beyond a log file.

---

## State model — the Airtable fields the orchestrator reads

Existing fields on `lead_candidates` (lead Airtable base) that drive orchestration:

| Field | Values | Read by orchestrator? |
|---|---|---|
| `review_status` | `unreviewed`, `approved`, `d100`, `rejected`, `sent`, `below threshold`, `scoring failed`, `demo`, `niche excluded` | YES — branches on `approved` and `d100`; ignores the rest |
| `outreach_status` | `pending`, `email_found`, `email_verified`, `ready_data_scraped` (parked/enriched, ready for `npm run send`), `ready_no_data` (reserved — ready to email, no enrichment data; unused for now), `enriched` (legacy alias for `ready_data_scraped`), `email_drafted`, `sent_to_smartlead`, `no_email_found`, `email_invalid`, `failed` | YES — to determine which stage to advance |
| `email_address`, `email_verification_result`, `enrichment_bundle_path`, etc. | (various) | NO directly — but the orchestrator may use them to decide "this lead is ready for stage X" |

New field (proposed):

| Field | Type | Purpose |
|---|---|---|
| `orchestrator_last_seen_at` | dateTime | Updated each tick when the orchestrator considers this lead. Useful for "what did the orchestrator do in the last run." |
| `deep_research_status` | singleSelect: `pending`, `in_progress`, `complete`, `failed` | Mirrors `outreach_status` but for the d100 branch. Optional — could also reuse `outreach_status` with new values. |

(Open question: do we want a `deep_research_status` field, or extend `outreach_status` with `deep_research_*` values? Lean toward extending — fewer fields, but mixes two slightly different state spaces.)

---

## Trigger / scheduling

**Cron-driven, polling Airtable.**

- Default cadence: every 4 hours (`17 */4 * * *` — off-zero minute per the [[skill-cron-best-practices]] rule).
- On each tick, the orchestrator:
  1. Queries the lead Airtable base for leads with `review_status` in (`approved`, `d100`) AND `outreach_status` NOT in terminal-success state for that branch.
  2. Buckets them by branch.
  3. For each branch, calls the appropriate next-stage repo to advance the batch.

**Why polling and not webhooks:**
- No public URL to host a webhook on (orchestrator runs locally).
- Polling is simpler and the cadence latency (≤4h) is acceptable for this workflow — Casey reviews leads in batches, not continuously.

**Default cron expression:** `17 */4 * * *` (every 4 hours at the 17-minute mark).

---

## Sequential stage handoffs (pseudo-code)

```typescript
async function orchestratorTick() {
  const leads = await getCandidatesForOrchestration();

  // Branch 1: approved leads
  const approved = leads.filter(l => l.review_status === "approved" && needsOutreachAdvance(l));
  if (approved.length > 0) {
    log(`Driving outreach for ${approved.length} approved leads`);
    await runRepo("youtube-email-outreach-v1", "outreach", {
      leadIds: approved.map(l => l.id),
      concurrency: 4,
    });
    // Wait for full completion. Each lead inside that repo runs:
    //   find -> verify -> enrich (Quick research) -> compose -> push
  }

  // Branch 2: d100 leads
  const d100 = leads.filter(l => l.review_status === "d100" && needsD100Advance(l));
  if (d100.length > 0) {
    log(`Driving d100 path for ${d100.length} leads`);
    // Step a: same email finder
    await runRepo("youtube-email-outreach-v1", "find-and-verify-only", {
      leadIds: d100.map(l => l.id),
    });
    // Step b: for any d100 lead that found an email, run deep enrichment
    const d100WithEmail = await refreshLeads(d100.map(l => l.id))
      .then(rows => rows.filter(r => r.email_verification_result === "valid" || r.email_verification_result === "risky"));
    if (d100WithEmail.length > 0) {
      await runRepo("deep-research-agent", "enrich", {
        leadIds: d100WithEmail.map(l => l.id),
      });
    }
    // No compose / push for d100. Done.
  }

  await writeOrchestratorLog();
}
```

The orchestrator drives each stage to completion before moving on. Each `runRepo` call is a child process that doesn't return until the underlying batch completes. The existing email-outreach repo already exposes `--lead-id` arrays via `outreach.ts`, so this just means shelling out to `npm run outreach -- --lead-ids ...` with the right args.

A `find-and-verify-only` flag would be a new addition to email-outreach-v1 — currently it runs all the way through compose. (Open question: easier to add `--stop-after verify` flag than to fork the entry point.)

---

## Failure handling

The orchestrator does **not** retry failures from inside a stage. Each repo has its own state machine that already handles partial failures and resumability (see `effectiveStatus()` in email-outreach-v1's `src/cli/outreach.ts`).

The orchestrator's only failure handling:
- If a child process exits non-zero, log it and mark the orchestrator run as partial in the log file.
- Continue with the next branch / next tick. Don't stop the world.
- Surface a single-line per-tick summary so Casey can spot crashes when checking logs.

The orchestrator does NOT:
- Retry leads that stay at `failed` after a tick — that's a manual decision (e.g., quota exhausted, Casey waits for reset).
- Skip leads that are stuck — they'll be picked up again next tick automatically.

---

## Visibility / logging

Each orchestrator tick writes to a single log line (or short structured entry) under `logs/orchestrator-<date>.jsonl`:

```jsonl
{"ts":"2026-05-25T08:17:13Z","approved_processed":12,"approved_sent":9,"approved_failed":3,"d100_processed":2,"d100_enriched":2,"errors":[]}
```

That's it. The underlying repos already write their own detailed per-lead logs. The orchestrator log is the cross-repo "what fired in the last 4 hours" view.

---

## Out of scope for v1

- **d100 outreach composition.** The orchestrator stops d100 leads at "deep research complete." A future agent will pick up from there and craft a manual-quality Dream 100 message. Casey will scope and build that separately.
- **Webhook triggering.** Polling only.
- **Concurrent ticks.** Single-instance only; no locking. If a tick is still running when the next cron fires, the next one no-ops via a simple lock file at `logs/.tick-lock`.
- **Slack / email notifications.** Logs only.
- **Lead-finder triggering.** Lead-finder runs on its own schedule; orchestrator never calls it.

---

## Build order

1. **Scaffold the repo.** `youtube-outreach-orchestrator-v1`. Just `package.json`, `tsconfig.json`, `.env.example`, `README.md`, `src/cli/orchestrate.ts`.
2. **Lead query helper.** Reads the lead Airtable base, returns leads in scope for each branch.
3. **Approved-path driver.** Shells out to `youtube-email-outreach-v1`'s outreach CLI with the right `--lead-ids` list. Pipes stdout, captures exit code.
4. **D100-path driver.** Same shape, but needs the find-and-verify-only flag added to email-outreach-v1, then the deep-research repo's CLI.
5. **Logger.** Writes one JSONL line per tick.
6. **Cron registration.** Use CronCreate at session start (one-shot) OR a real OS cron / launchctl entry for durability (recommended for production).

Estimated total code: ~200-300 lines TypeScript across 4-5 files. Most of the work is in the shell-out plumbing and the lead querying.

---

## Small changes required in existing repos

To make the orchestrator's job clean, two small additions to `youtube-email-outreach-v1`:

1. **`--stop-after <stage>` flag** on `src/cli/outreach.ts`. Stops after `find`, `verify`, `enrich`, `compose`, or `push`. Lets the orchestrator run "find + verify only" for d100 leads. ~20 lines.
2. **Bulk `--lead-ids` from a file**. Currently `outreach.ts` supports `--lead-id <id>` (singular). For batches of 20-50 leads at a tick, accepting a list is cleaner than spawning N processes. ~15 lines.

Both are additive and don't change existing behavior.

Nothing required in `quick-youtube-channel-research-v1` (locked, called as today).

Nothing required in `youtube-lead-finder-v1` (orchestrator just reads its output, never invokes it).

---

## Open questions for Casey

1. **Deep-research repo name.** You mentioned renaming `quick-youtube-channel-research-v1` or forking it. Lean toward a fresh repo (`youtube-deep-research-v1`?) so the quick research one stays stable for the orchestrator's hot path.
2. **D100 Airtable base.** Will you provision it manually (matching the schema of `appTvzwOiTLmqC5Mw`), or should the deep-research repo seed it programmatically on first run?
3. **`deep_research_status` field vs extending `outreach_status`.** Slight preference toward extending `outreach_status` with `deep_research_*` values to keep one state column, but it does mix two slightly different state spaces. Your call.
4. **Cron interval.** Default 4h. If your typical batch cadence is daily, every 24h might be enough. If you'd want faster response to new approvals, every 1h.
5. **Where does the orchestrator log live?** Inside its own repo (`logs/`) or written into the lead Airtable base as orchestrator-tick rows in a new table? Files are simpler.
6. **Do we need d100 leads to also get the email-find step at all?** You said yes earlier ("find an email first"), but for some elite d100 leads you might have the email already (your network, referrals). Worth allowing manual email override on the lead row that skips find/verify.

---

## What this spec does NOT specify

- Concrete repo URL / package name (Casey picks).
- Concrete cron schedule expression (Casey picks).
- Notion sync (out of scope).
- Cost budgeting / spend caps (each underlying repo already has its own cost reporting; orchestrator just aggregates).
- d100 outreach agent (separate spec, future).
