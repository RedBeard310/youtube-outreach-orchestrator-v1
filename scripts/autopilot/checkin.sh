#!/usr/bin/env bash
# Autopilot hourly check-in wrapper (systemd ExecStart for checkin.timer).
#
# Runs the code-only health check (free). Only if it reports an anomaly (exit 7) does it
# spend a `claude -p` fix-agent to diagnose and repair the pipeline, then records that
# agent's exact cost to the burn ledger. Healthy hours cost nothing.

set -uo pipefail

REPO="/home/casey/repos/youtube-outreach-orchestrator-v1"
cd "$REPO" || exit 1

FIX_MODEL="${AUTOPILOT_FIX_MODEL:-sonnet}"
ATTENTION="$REPO/logs/autopilot-attention.jsonl"
TS="$(date -u +%Y%m%dT%H%M%SZ)"

npx tsx "$REPO/scripts/autopilot/checkin.ts"
rc=$?

if [ "$rc" -ne 7 ]; then
  exit 0   # 0 healthy / 5 halting — nothing to spend an agent on
fi

echo "[checkin.sh] anomaly detected — spending a $FIX_MODEL fix-agent"
OUT="$REPO/logs/autopilot-sessions/fix-$TS.json"
mkdir -p "$REPO/logs/autopilot-sessions"

read -r -d '' FIX_PROMPT <<'PROMPT'
You are the autopilot's self-healing fix-agent for a YouTube lead-gen pipeline running
unattended on a Linux VPS. An hourly health check flagged an anomaly. Your job: find the
root cause and FIX it so the campaign resumes parking leads, then stop. Be efficient —
you are spending real money per token.

Steps:
1. Read the newest entries in logs/autopilot-attention.jsonl (repo:
   /home/casey/repos/youtube-outreach-orchestrator-v1) — they describe what's wrong with
   evidence (a fatal error signature, or "find but don't park").
2. Investigate the real cause. The pipeline spans 5 repos you MAY modify and commit:
   youtube-outreach-orchestrator-v1, youtube-lead-finder-v1, youtube-email-outreach-v1,
   youtube-deep-research-v1, quick-youtube-channel-research-v1 (all under /home/casey/repos).
   The failures we've actually hit are migration-class: a repo on the wrong git branch, a
   missing npm dependency, a missing ~/.claude/skills install, or a dead hardcoded path.
   Check those first.
3. Apply the smallest fix that restores function. Verify it (load the entrypoint / run the
   failing step) before declaring success. Then `git add -A && git commit -m "autopilot-fix: <what>"`
   in each repo you changed (the auto-sync timer pushes within ~2 min; you do not need to push).
4. Do NOT touch any .env file or secrets — those are managed by the operator.
5. When done, archive the handled attention file:
   `mv logs/autopilot-attention.jsonl logs/autopilot-attention-handled-<UTC-timestamp>.jsonl`
   so the next check-in starts clean.
6. If the problem is genuinely NOT safely fixable, or is critical (money-path risk, a git
   state needing a human like a rebase conflict, or total auth/quota failure), do NOT guess —
   write a clear explanation to logs/autopilot-halt.flag (this stops the whole loop) and stop.

Report a one-paragraph summary of what you found and did.
PROMPT

timeout 1800 claude -p "$FIX_PROMPT" \
  --model "$FIX_MODEL" \
  --permission-mode bypassPermissions \
  --output-format json > "$OUT" 2>>"$REPO/logs/autopilot-sessions/fix-$TS.stderr"
agent_rc=$?

# Record the agent's exact cost regardless of how it exited.
if [ -s "$OUT" ]; then
  npx tsx "$REPO/scripts/autopilot/burn-ledger.ts" from-claude "$OUT" --source checkin \
    --note "hourly fix-agent" || true
fi

echo "[checkin.sh] fix-agent finished (rc=$agent_rc); cost recorded from $OUT"
exit 0
