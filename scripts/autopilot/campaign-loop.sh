#!/usr/bin/env bash
# Autopilot campaign driver — relentless relaunch loop (component A).
#
# Runs `npm run campaign` over and over, around the clock, so leads keep flowing past
# the 500/day goal. The campaign engine self-limits each session (target / --max-runs /
# --max-minutes / quota hard-stop / consecutive-failure wall); this wrapper just relaunches
# it, and — crucially — SLEEPS instead of grinding when YouTube quota is drained, so an
# unattended run never burns a reset quota for zero yield.
#
# Safe to run under systemd `Restart=always`. It relies on the campaign's stale-safe PID
# lock (src/lock.ts): if another campaign/tick is already running, npm exits 0 with
# "tick in progress" and we back off rather than busy-loop.
#
# Stops only on: the halt flag (written by the check-in on a critical breach) or the
# Anthropic hard $ ceiling. Everything else is shrugged off and retried.
#
# Tunables (env, with defaults):
#   AUTOPILOT_MAX_MINUTES   90     per-session wall-clock cap handed to --max-minutes
#   AUTOPILOT_CLEAN_PAUSE   20     seconds to pause after a clean/target/time stop
#   AUTOPILOT_QUOTA_WAIT    1800   seconds to sleep when quota-blocked (30 min)
#   AUTOPILOT_LOCK_WAIT     300    seconds to wait when another instance holds the lock
#   AUTOPILOT_RAPID_SECS    120    a nonzero exit faster than this counts as a "rapid fail"
#   AUTOPILOT_MAX_RAPID     5      consecutive rapid fails ⇒ write halt flag and stop
#   YT_QUOTA_HARD_PCT       95     quota % at/above which we sleep instead of launching
#   QUOTA_STALE_MINUTES     90     ignore a quota snapshot older than this (may have reset)

set -uo pipefail

REPO="/home/casey/repos/youtube-outreach-orchestrator-v1"
cd "$REPO" || { echo "cannot cd $REPO"; exit 1; }

HALT_FLAG="$REPO/logs/autopilot-halt.flag"
SESS_LOG_DIR="$REPO/logs/autopilot-sessions"
mkdir -p "$SESS_LOG_DIR"

MAX_MINUTES="${AUTOPILOT_MAX_MINUTES:-90}"
CLEAN_PAUSE="${AUTOPILOT_CLEAN_PAUSE:-20}"
QUOTA_WAIT="${AUTOPILOT_QUOTA_WAIT:-1800}"
LOCK_WAIT="${AUTOPILOT_LOCK_WAIT:-300}"
RAPID_SECS="${AUTOPILOT_RAPID_SECS:-120}"
MAX_RAPID="${AUTOPILOT_MAX_RAPID:-5}"
HARD_PCT="${YT_QUOTA_HARD_PCT:-95}"
STALE_MIN="${QUOTA_STALE_MINUTES:-90}"
FINDER_REPO="${LEAD_FINDER_REPO_PATH:-/home/casey/repos/youtube-lead-finder-v1}"

log() { echo "[campaign-loop $(date -u +%FT%TZ)] $*"; }

# Worst fresh quota used_pct across buckets, or -1 if missing/stale/unreadable.
quota_used_pct() {
  node -e '
    const fs=require("fs");
    const f=process.argv[1], staleMin=Number(process.argv[2]);
    try {
      const q=JSON.parse(fs.readFileSync(f,"utf8"));
      const ageMin=(Date.now()-Date.parse(q.ts))/60000;
      if (!isFinite(ageMin) || ageMin>staleMin) { console.log("-1"); process.exit(0); }
      let m=-1;
      for (const k of Object.keys(q)) if (q[k] && typeof q[k]==="object" && "used_pct" in q[k]) m=Math.max(m,Number(q[k].used_pct)||0);
      console.log(String(m));
    } catch { console.log("-1"); }
  ' "$FINDER_REPO/logs/quota-state.json" "$STALE_MIN" 2>/dev/null || echo "-1"
}

# Newest campaign jsonl (UTC-dated file; pick most-recently-modified to be robust).
newest_campaign_jsonl() { ls -t "$REPO"/logs/campaign-*.jsonl 2>/dev/null | head -1; }

# Classify why the last session stopped by scanning its tail for stop events.
last_stop_reason() {
  local f tail8; f="$(newest_campaign_jsonl)"
  [ -z "$f" ] && { echo "unknown"; return; }
  # A session logs its stop CAUSE (quota_stop / hard_stop / time_budget_stop) and THEN a
  # `done` checkpoint — the final verify+promote always runs and logs `done` before exit.
  # So classify by the CAUSE, not the chronologically-last event: the old `... | tail -1`
  # always saw the trailing `done` and masked every hard wall, dropping us into the 20s
  # CLEAN_PAUSE instead of the 30-min QUOTA_WAIT back-off. That dead back-off is exactly
  # what let term-supply exhaustion ("No active terms to process" → finder exit 1 → hard_stop)
  # thrash 168× at ~2.5-min intervals on 2026-07-13, re-burning a discovery LLM call each
  # relaunch. Prefer the cause event so the intended back-off actually fires. (autopilot-improve 2026-07-13)
  tail8="$(tail -8 "$f")"
  if grep -q '"event":"quota_stop"'       <<<"$tail8"; then echo "quota_stop";       return; fi
  if grep -q '"event":"hard_stop"'        <<<"$tail8"; then echo "hard_stop";        return; fi
  if grep -q '"event":"time_budget_stop"' <<<"$tail8"; then echo "time_budget_stop"; return; fi
  echo "done"
}

rapid_fails=0
log "starting (max-minutes=$MAX_MINUTES, quota-wait=${QUOTA_WAIT}s, hard-pct=$HARD_PCT)"

while true; do
  if [ -f "$HALT_FLAG" ]; then
    log "HALT flag present ($HALT_FLAG) — stopping loop"
    exit 0
  fi

  # Anthropic hard ceiling — belt-and-suspenders (the check-in is the primary guard).
  npx tsx "$REPO/scripts/autopilot/burn-ledger.ts" today --json >/dev/null 2>&1
  if [ $? -eq 20 ]; then
    log "Anthropic HARD ceiling hit — writing halt flag and stopping"
    echo "hard Anthropic \$ ceiling breached at $(date -u +%FT%TZ)" > "$HALT_FLAG"
    exit 0
  fi

  # Quota gate: if fresh quota is at/above hard %, sleep instead of grinding.
  used="$(quota_used_pct)"
  if awk "BEGIN{exit !($used >= $HARD_PCT)}"; then
    log "quota used ${used}% >= ${HARD_PCT}% (fresh) — sleeping ${QUOTA_WAIT}s for reset"
    sleep "$QUOTA_WAIT"
    continue
  fi

  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  sess="$SESS_LOG_DIR/session-$ts.log"
  start=$(date +%s)
  log "launching campaign session → $sess"
  npm run campaign -- --frontier --max-runs 100 --max-minutes "$MAX_MINUTES" >"$sess" 2>&1
  rc=$?
  dur=$(( $(date +%s) - start ))

  # Another instance owns the lock → not our turn; wait longer.
  if grep -q "tick in progress" "$sess" 2>/dev/null; then
    log "another instance holds the lock — waiting ${LOCK_WAIT}s"
    sleep "$LOCK_WAIT"
    continue
  fi

  # Rapid repeated failure ⇒ something is genuinely broken; escalate after MAX_RAPID.
  if [ "$rc" -ne 0 ] && [ "$dur" -lt "$RAPID_SECS" ]; then
    rapid_fails=$(( rapid_fails + 1 ))
    log "rapid failure #$rapid_fails (rc=$rc, ${dur}s)"
    if [ "$rapid_fails" -ge "$MAX_RAPID" ]; then
      log "$rapid_fails rapid failures in a row — writing halt flag (needs a human/check-in fix)"
      { echo "campaign failed to start $rapid_fails times in a row (last rc=$rc) at $(date -u +%FT%TZ)";
        echo "last session log: $sess"; } > "$HALT_FLAG"
      exit 0
    fi
    sleep $(( rapid_fails * 60 ))
    continue
  fi
  rapid_fails=0

  reason="$(last_stop_reason)"
  log "session done (rc=$rc, ${dur}s, stop=$reason)"
  case "$reason" in
    quota_stop|hard_stop)
      log "quota/hard-wall stop — sleeping ${QUOTA_WAIT}s before retry"
      sleep "$QUOTA_WAIT" ;;
    *)
      sleep "$CLEAN_PAUSE" ;;
  esac
done
