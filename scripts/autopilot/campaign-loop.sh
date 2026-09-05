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


# HARD GUARD (Casey, 2026-08-01): the Anthropic API key is off-limits to the
# pipeline. Even if a future edit sources env-storage here, any `claude -p`
# below must bill the Max-subscription OAuth login, never the API key.
unset ANTHROPIC_API_KEY

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
#
# This is the THIRD copy of the same read (campaign.ts and the finder's
# src/lib/run-gate.ts hold the other two) and it was the weakest: it carried only
# the staleness guard, never the retired-backend guard, and none of the three had
# the free-tier guard until 2026-08-30. All three must agree about what "out of
# quota" means, because they govern the same YouTube pool.
#
# RETIRED-BACKEND GUARD: a negative `remaining` means the plan is GONE, not low.
# FREE-TIER GUARD: the snapshot meters RapidAPI, which has lapsed onto a free tier
# of 1,000 requests / 100 searches a day. One stray fallback run spends 950 of them
# and reports 95% used, which stopped the campaign and all five sweeps on
# 2026-08-30 while the direct key pool sat at 65 of 66 keys live. A plan whose
# largest bucket is under MIN_PLAN (5,000) is not metering this pipeline's day.
quota_used_pct() {
  node -e '
    const fs=require("fs");
    const f=process.argv[1], staleMin=Number(process.argv[2]);
    const minPlan=Number(process.env.QUOTA_MIN_PLAN_LIMIT||5000);
    try {
      const q=JSON.parse(fs.readFileSync(f,"utf8"));
      const ageMin=(Date.now()-Date.parse(q.ts))/60000;
      if (!isFinite(ageMin) || ageMin>staleMin) { console.log("-1"); process.exit(0); }
      const b=Object.keys(q).map(k=>q[k]).filter(v=>v&&typeof v==="object");
      if (b.some(v=>typeof v.remaining==="number"&&v.remaining<0)) { console.log("-1"); process.exit(0); }
      const lim=b.map(v=>Number(v.limit)).filter(n=>isFinite(n)&&n>0);
      if (lim.length && Math.max(...lim)<minPlan) { console.log("-1"); process.exit(0); }
      let m=-1;
      for (const v of b) if ("used_pct" in v) m=Math.max(m,Number(v.used_pct)||0);
      console.log(String(m));
    } catch { console.log("-1"); }
  ' "$FINDER_REPO/logs/quota-state.json" "$STALE_MIN" 2>/dev/null || echo "-1"
}

# SLEEP TO THE MIDNIGHT-PT REFILL, don't retry every 30 minutes (2026-09-04).
#
# quota_used_pct() above reads a snapshot that meters RAPIDAPI, retired 2026-08-10.
# It correctly returns -1 now, which means "no signal", so this loop has no idea
# whether the DIRECT key pool is drained. With no signal it launches, the finder
# hard-walls, and the hard_stop branch sleeps a flat QUOTA_WAIT.
#
# A YouTube key's allowance is DAILY and refills at midnight Pacific and at no other
# moment. On 2026-09-04 the pool drained at ~13:00Z and this loop hard-walled 32
# times, one or two EVERY hour through to 06:51Z — 18 hours of sessions that each
# paid for a reservoir check, a keyword harvest and a discovery model call before
# the finder told them what the previous 31 already had.
#
# Yesterday's fix taught the two SWEEP loops to sleep to the refill and to write a
# rest marker while they do. Read THEIR marker rather than re-deriving exhaustion a
# fourth time: this file already notes it holds the third copy of the quota read,
# and all copies must agree about what "out of quota" means because they govern the
# same pool. Reusing the marker makes agreement structural instead of hoped-for.
#
# Honoured only while its own `until` is still ahead, so a marker left behind by a
# killed sweep cannot park this loop indefinitely. No marker (no sweep running) =>
# unchanged 30-minute behaviour, which is the safe direction to fail.
sweep_rest_until_epoch() {
  local f until_iso best=0 e
  for f in "$FINDER_REPO"/logs/graph-sweep-quota-rest.json \
           "$FINDER_REPO"/logs/video-graph-sweep-quota-rest.json; do
    [ -f "$f" ] || continue
    until_iso="$(sed -n 's/.*"until"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$f" | head -1)"
    [ -z "$until_iso" ] && continue
    e="$(date -u -d "$until_iso" +%s 2>/dev/null)" || continue
    # Only a marker whose wake time is still in the future describes a live rest.
    [ "$e" -gt "$(date -u +%s)" ] && [ "$e" -gt "$best" ] && best="$e"
  done
  echo "$best"
}

# ASK OUR OWN SESSION, don't wait for a sweep to be asleep too (2026-09-05).
#
# The marker read above shipped yesterday and never fired once: this loop hard-walled
# 21 more times on 2026-09-04/05, one every ~34 minutes from 19:37Z to 06:53Z, and no
# *-quota-rest.json ever existed on disk. The dependency is structurally wrong, not
# merely unlucky. A finder pass spends 100 quota units per `search.list`; the sweeps
# spend 1 per `channels.list` and get their edges by scraping watch pages, which costs
# no quota at all. So THIS loop hits the daily wall many hours before a sweep does —
# on 09-05 the sweeps walked 10,244 seeds and wrote channels in 23 of 24 hours while
# this loop could not buy a single search. Waiting for a sweep to fall asleep means
# waiting for a lane that is still working.
#
# The session log answers the question directly. When the pool cannot serve a search,
# the finder rotates every key and aborts with a fixed line, and that line is a clean
# discriminator: present in all 21 walled sessions of this cycle, absent from all 7
# productive ones. Gating on it matters, because the OTHER thing that hard-walls this
# loop is term-supply exhaustion (25 starvation notices this cycle), and terms do not
# refill at midnight — parking a term wall until morning would be a new bug.
#
# Same clock math as the sweeps' sleep_until_quota_reset(), deliberately: a YouTube
# allowance is DAILY and refills at midnight Pacific, `date -d 'tomorrow 00:05'` under
# TZ=America/Los_Angeles survives the November DST change, and being clock-derived
# makes it self-clearing — adding keys mid-day costs at most one extra sleep.
session_hit_key_pool_wall() {
  grep -qE '^\[runner\] All YouTube API keys exhausted' "$1" 2>/dev/null
}

quota_refill_epoch() {
  TZ=America/Los_Angeles date -d 'tomorrow 00:05' +%s 2>/dev/null || echo 0
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
# mtime of THIS script at process start — used for self-reload (see loop top).
SELF_MTIME="$(stat -c %Y "$0" 2>/dev/null || echo 0)"
log "starting (max-minutes=$MAX_MINUTES, quota-wait=${QUOTA_WAIT}s, hard-pct=$HARD_PCT)"

while true; do
  if [ -f "$HALT_FLAG" ]; then
    log "HALT flag present ($HALT_FLAG) — stopping loop"
    exit 0
  fi

  # Self-reload. A committed fix to THIS script does nothing until the long-running loop
  # process restarts — bash doesn't re-read an edited script mid-run. That's why the
  # 2026-07-13 back-off fix sat DORMANT for ~9h of continued thrash until an incidental
  # 16:03Z restart happened to load it (2026-07-14 debrief). Re-exec when the file changes
  # on disk (and still parses) so autopilot-improve commits self-deploy within one iteration
  # instead of waiting for a manual `systemctl restart`. exec keeps the same PID, so systemd
  # sees no restart. (autopilot-improve 2026-07-14)
  now_mtime="$(stat -c %Y "$0" 2>/dev/null || echo 0)"
  if [ "$now_mtime" != "$SELF_MTIME" ] && bash -n "$0" 2>/dev/null; then
    log "campaign-loop.sh updated on disk (mtime $SELF_MTIME → $now_mtime) — re-exec'ing to load it"
    exec "$0" "$@"
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
      # First ask our own session whether the key pool is what stopped it. That is the
      # direct evidence; the sweep marker below is only a second-hand signal, and it
      # never once fired in the 21 walls it was written for.
      rest_until=0
      if session_hit_key_pool_wall "$sess"; then
        rest_until="$(quota_refill_epoch)"
        [ "$rest_until" -le "$(date -u +%s)" ] && rest_until=0
      fi
      # If a sweep loop is already asleep on a drained key pool, this loop faces the
      # same locked door and the same clock. Wait for the refill, not 30 minutes.
      [ "$rest_until" -eq 0 ] && rest_until="$(sweep_rest_until_epoch)"
      if [ "$rest_until" -gt 0 ]; then
        wait=$(( rest_until - $(date -u +%s) ))
        [ "$wait" -lt "$QUOTA_WAIT" ] && wait="$QUOTA_WAIT"
        [ "$wait" -gt 86400 ] && wait=86400
        log "quota/hard-wall stop on a drained YouTube key pool — sleeping ${wait}s until the midnight-PT refill at $(date -u -d "@$rest_until" +%FT%TZ) instead of retrying every ${QUOTA_WAIT}s"
        sleep "$wait"
      else
        log "quota/hard-wall stop — sleeping ${QUOTA_WAIT}s before retry"
        sleep "$QUOTA_WAIT"
      fi ;;
    *)
      sleep "$CLEAN_PAUSE" ;;
  esac
done
