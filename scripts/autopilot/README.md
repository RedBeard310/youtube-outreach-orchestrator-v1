# Autopilot — daily autonomous lead-gen loop

Runs the lead-gen campaign around the clock, reports on each cycle, and self-improves —
the human "run campaign → write debrief → ship fixes" loop, made autonomous. Built
2026-07-12. Design decisions and rationale: the approved plan (in `~/.claude/plans/`) and
`CLAUDE.md` "Autonomous campaign runs".

## Shape

Three systemd units, mirroring the existing system-level `auto-sync` pattern:

| Unit | Cadence | What it does |
|---|---|---|
| `autopilot-campaign.service` | always-on (`Restart=on-failure`) | `campaign-loop.sh` — relaunches `npm run campaign --frontier` relentlessly; sleeps through quota exhaustion instead of grinding; stops only on the halt flag or hard $ ceiling. **Zero Claude tokens.** |
| `autopilot-checkin.timer` | hourly | `checkin.sh` → `checkin.ts` (code-only health check, free). Spends a `claude -p` **fix-agent** (cheap model) ONLY on a real anomaly. |
| `autopilot-debrief.timer` | daily 00:20 PT | `debrief.sh` → gathers data, spends one capable `claude -p` agent to write the HTML debrief + analysis.md + INDEX row into the casey-assistant brain, and ship self-improvement fixes. |

Cycle boundary = **midnight America/Los_Angeles** (direct-YouTube-key quota reset).
Goal = **500 leads parked to `approved_hold`/day** (keep going past it).

## Cost control (the burn guardrail)

There was no Anthropic cost signal in the pipeline, so `burn-ledger.ts` was built. Every
headless `claude -p` run reports `total_cost_usd`; the wrappers append it to
`logs/burn-<pacific-date>.jsonl`. `burn-ledger.ts today` sums it and exit-codes
0/10/20 for under-soft / over-soft / over-hard.

- Ceilings (env, `.env`-tunable): `ANTHROPIC_SOFT_USD` (75), `ANTHROPIC_HARD_USD` (150).
- **Model tiering is the primary lever** — a default Opus `claude -p` costs ~$0.25 even
  for a trivial turn. So: hourly check-in is **code-only** (free) and only escalates to a
  `sonnet` fix-agent on anomaly (`AUTOPILOT_FIX_MODEL`); the daily debrief uses `opus`
  once/day (`AUTOPILOT_DEBRIEF_MODEL`).
- Over hard ceiling → the check-in (and the loop) write `logs/autopilot-halt.flag` and stop.

## Guardrails & escalation

- **Halt flag** `logs/autopilot-halt.flag`: written on a critical condition (hard $ ceiling,
  repeated un-startable campaign, or an agent deciding something is unsafe). The loop stops
  and stays stopped; Casey sees the file next session. No external notifications by design.
- **Anomaly detection** (`checkin.ts`): fatal error signatures in session logs
  (module-not-found / missing-skill / bad-backend / finder hard-wall / find-ENOENT) and
  "finding-but-not-parking" (approved_hold flat ≥100min while the finder keeps exiting 0 —
  the exact shape of the 2026-07-11 missing-skill outage). Either raises an attention record
  (`logs/autopilot-attention.jsonl`) and spends the fix-agent.
- **Self-improvement scope**: the fix-agent and debrief-agent may modify + commit any of the
  5 pipeline repos (auto-sync pushes within ~2 min). They must NEVER touch `.env`/secrets.
  `casey-assistant` is a pull-only mirror, so the debrief agent pushes it explicitly.

## Install / operate

```bash
scripts/autopilot/install.sh            # install units, enable + start (sudo)
scripts/autopilot/install.sh --status   # unit + timer status
scripts/autopilot/install.sh --stop     # stop + disable

journalctl -u autopilot-campaign -f     # watch the driver
tsx scripts/autopilot/burn-ledger.ts today   # today's Anthropic spend

touch logs/autopilot-halt.flag          # emergency stop (after current session)
rm logs/autopilot-halt.flag && sudo systemctl restart autopilot-campaign   # resume
```

## Files

- `campaign-loop.sh` — relentless relaunch + quota-wait driver (no LLM)
- `checkin.ts` / `checkin.sh` — hourly code health check + on-anomaly fix-agent
- `debrief-data.ts` — grounded cycle metrics (Airtable + campaign JSONL)
- `debrief.sh` — daily report + self-improve agent
- `burn-ledger.ts` — Anthropic cost accounting
- `systemd/*` — the five unit files; `install.sh` deploys them

## Tunables (env)

`ANTHROPIC_SOFT_USD`, `ANTHROPIC_HARD_USD`, `AUTOPILOT_FIX_MODEL`, `AUTOPILOT_DEBRIEF_MODEL`,
`AUTOPILOT_MAX_MINUTES` (per-session cap), `AUTOPILOT_QUOTA_WAIT`, `AUTOPILOT_FLAT_PARK_MINUTES`,
`YT_QUOTA_HARD_PCT`, `QUOTA_STALE_MINUTES`.
