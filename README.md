# youtube-outreach-orchestrator-v1

Thin polling coordinator. Reads the lead Airtable base on a cron and shells out to the appropriate next-stage repo. Owns no business logic.

See [CLAUDE.md](CLAUDE.md) for the operational contract and [orchestrator-spec.md](orchestrator-spec.md) for the full design.

## Setup

```bash
npm install
cp .env.example .env
# Fill in AIRTABLE_API_KEY, EMAIL_OUTREACH_REPO_PATH, DEEP_RESEARCH_REPO_PATH
```

## Run a tick (prep)

The tick **preps** approved leads — find → verify → enrich — and parks each at
`outreach_status = "ready_data_scraped"`. It never composes or sends.

```bash
npm run tick:dry      # log what it would do, don't shell out
npm run tick          # real run
```

## Send (write + push) — on demand

Writing and sending email is decoupled from the tick (2026-07-17). Fire the parked
`ready_data_scraped` leads through compose → push to SmartLead (paused) whenever you want:

```bash
npm run send:dry                 # preview the shell-out, send nothing
npm run send                     # fire all ready leads
npm run send -- --lead-ids a,b   # fire only these (must be ready)
npm run send -- --limit 25       # cap the batch
```

`send` acquires the same `logs/.tick-lock` as the tick, so the two can't overlap. See
[CLAUDE.md](CLAUDE.md) → "Writing/sending is decoupled from the tick."

## Cron

Schedule: every 4h at `:17` past the hour (`0:17, 4:17, 8:17, 12:17, 16:17, 20:17`).

A ready-to-use launchd plist lives at [launchd/com.caseybrown.youtube-outreach-orchestrator.plist](launchd/com.caseybrown.youtube-outreach-orchestrator.plist). To load it:

```bash
cp launchd/com.caseybrown.youtube-outreach-orchestrator.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.caseybrown.youtube-outreach-orchestrator.plist
```

To stop / reload:

```bash
launchctl unload ~/Library/LaunchAgents/com.caseybrown.youtube-outreach-orchestrator.plist
```

The orchestrator self-handles re-entry via `logs/.tick-lock` — if a previous tick is still running, the next invocation no-ops. launchd logs go to `logs/launchd.std{out,err}.log`; per-tick JSONL goes to `logs/orchestrator-YYYY-MM-DD.jsonl`.

## Schema prerequisite

Before running for real, add these singleSelect options to the `outreach_status` field on `lead_candidates` in Airtable (the orchestrator's d100 driver writes them):

- `deep_research_in_progress`
- `deep_research_complete`
- `deep_research_failed`

Without them, Airtable will reject the orchestrator's status writes and d100 leads will stay stuck at `email_verified`.

The approved-path parked statuses `ready_data_scraped` / `ready_no_data` do **not** need manual pre-creation — they're written by `youtube-email-outreach-v1` with `typecast: true`, so Airtable auto-creates the options on first write.
