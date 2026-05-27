# youtube-outreach-orchestrator-v1

Thin polling coordinator. Reads the lead Airtable base on a cron and shells out to the appropriate next-stage repo. Owns no business logic.

See [CLAUDE.md](CLAUDE.md) for the operational contract and [orchestrator-spec.md](orchestrator-spec.md) for the full design.

## Setup

```bash
npm install
cp .env.example .env
# Fill in AIRTABLE_API_KEY, EMAIL_OUTREACH_REPO_PATH, DEEP_RESEARCH_REPO_PATH
```

## Run a tick

```bash
npm run tick:dry      # log what it would do, don't shell out
npm run tick          # real run
```

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
