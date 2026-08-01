#!/usr/bin/env bash
# Autopilot daily debrief + self-improve (systemd ExecStart for debrief.timer, ~00:20 PT).
#
# Gathers the cycle's real numbers, then spends ONE capable `claude -p` agent to (1) write
# the HTML "Lead Run Debrief" + analysis.md + INDEX row into the casey-assistant brain and
# (2) ship self-improvement fixes across the pipeline. Records the agent's exact cost.

set -uo pipefail


# HARD GUARD (Casey, 2026-08-01): the Anthropic API key is off-limits to the
# pipeline. Even if a future edit sources env-storage here, any `claude -p`
# below must bill the Max-subscription OAuth login, never the API key.
unset ANTHROPIC_API_KEY

REPO="/home/casey/repos/youtube-outreach-orchestrator-v1"
BRAIN="/home/casey/repos/casey-assistant"
cd "$REPO" || exit 1

MODEL="${AUTOPILOT_DEBRIEF_MODEL:-opus}"
DATE="$(TZ=America/Los_Angeles date +%F)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$REPO/logs/autopilot-sessions"

# 1) Gather grounded data (also writes logs/autopilot-debrief-<date>.json).
DATA_FILE="$REPO/logs/autopilot-debrief-$DATE.json"
npx tsx "$REPO/scripts/autopilot/debrief-data.ts" > "$DATA_FILE.tmp" 2>"$REPO/logs/autopilot-sessions/debrief-data-$TS.stderr" \
  && mv "$DATA_FILE.tmp" "$DATA_FILE" || echo "[debrief.sh] WARN: data gather had issues; agent will work from logs"

OUT="$REPO/logs/autopilot-sessions/debrief-$TS.json"

read -r -d '' PROMPT <<PROMPT_EOF
You are the autopilot's end-of-cycle debrief + self-improvement agent for a YouTube
lead-gen pipeline running unattended on a Linux VPS. A 24h cycle just ended (midnight PT).
Do these tasks for cycle date ${DATE}, then stop. Be thorough but not wasteful.

DATA: Read the grounded metrics at ${DATA_FILE} (parked, funnel, per-niche, campaign
sessions, burn, fatal signatures). These numbers are authoritative — use them; do not
invent figures. For narrative detail, you may also read logs/campaign-*.jsonl and
logs/autopilot-sessions/*.log in ${REPO}.

TASK 1 — Write the debrief. Follow the structure of the prior example
${BRAIN}/brain/lead-gen/runs/lead-run-2026-07-10.html (shape-of-day → the three questions
→ what broke / what's fixed → ranked next levers). Self-contained HTML, inline CSS,
light+dark. Write:
  - ${BRAIN}/brain/lead-gen/runs/lead-run-${DATE}.html
  - ${BRAIN}/brain/lead-gen/runs/lead-run-${DATE}-analysis.md  (the markdown companion)
Then append ONE row to the run-log table in ${BRAIN}/brain/lead-gen/INDEX.md
(| Date | Debrief links | Result | Headline |). Match the existing table format exactly.

TASK 2 — Commit + PUSH the brain. casey-assistant is a pull-only mirror for the auto-sync
watcher, so you MUST push it yourself:
  cd ${BRAIN} && git add -A && git commit -m "lead-run debrief ${DATE}" && git push

TASK 3 — Self-improvement. Review the cycle for systemic issues (repeated fatal signatures,
low verify rate, quota waste, fade thrash, term starvation). Ship the smallest high-value
fix(es) across the 5 repos you may modify (all under /home/casey/repos):
youtube-outreach-orchestrator-v1, youtube-lead-finder-v1, youtube-email-outreach-v1,
youtube-deep-research-v1, quick-youtube-channel-research-v1. In each repo you change:
\`git add -A && git commit -m "autopilot-improve: <what>"\` (the auto-sync timer pushes those
within ~2 min; no manual push needed for the 5 repos). Prefer durable, self-healing fixes
(the CLAUDE.md "self-healing fixes" entries are the model). Verify a change loads/runs before
committing. If you have no high-confidence improvement, say so — do NOT invent churn.

RULES:
- NEVER touch any .env file or secrets (operator-managed).
- Do NOT stop the campaign or write logs/autopilot-halt.flag unless something is genuinely
  critical and unsafe to leave running (money-path risk, a git state needing a human, total
  auth/quota failure). Otherwise leave the loop running for the next cycle.
- Keep spend reasonable; you are one capable agent run, not an open-ended session.

Report a short summary: the headline number for the cycle, what you wrote, and what you
improved (or why nothing).
PROMPT_EOF

echo "[debrief.sh] spending a $MODEL debrief agent for $DATE"
timeout 3600 claude -p "$PROMPT" \
  --model "$MODEL" \
  --permission-mode bypassPermissions \
  --output-format json > "$OUT" 2>>"$REPO/logs/autopilot-sessions/debrief-$TS.stderr"
agent_rc=$?

if [ -s "$OUT" ]; then
  npx tsx "$REPO/scripts/autopilot/burn-ledger.ts" from-claude "$OUT" --source debrief \
    --note "daily debrief+improve $DATE" || true
fi

# Mirror the debrief into the repo's reports/ folder (canonical home stays the brain;
# Casey wants all reports gathered under reports/ too — 2026-07-13).
mkdir -p "$REPO/reports"
cp "$BRAIN/brain/lead-gen/runs/lead-run-$DATE.html" "$REPO/reports/" 2>/dev/null || true
cp "$BRAIN/brain/lead-gen/runs/lead-run-$DATE-analysis.md" "$REPO/reports/" 2>/dev/null || true

echo "[debrief.sh] debrief agent finished (rc=$agent_rc); cost recorded from $OUT"
exit 0
