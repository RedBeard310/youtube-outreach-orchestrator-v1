#!/usr/bin/env bash
# Backfill chain (2026-08-01, Casey-approved): runs approved_hold enrichment
# batches back-to-back until the pool is empty, so no idle time between the
# daily ~500-id batches. Temporary blitz infra — delete with the backfill.
#
#   nohup bash scripts/backfill/chain.sh >/dev/null 2>&1 &
#
# Stop cleanly: touch logs/backfill-2026-07/halt.flag (takes effect at the
# next batch boundary; kill the outreach process too if you want it NOW).
#
# Enrichment-base capacity is handled by the enrichment-db-cleanup.timer
# (15-min cadence, CLEANUP_MIN_AGE_HOURS=2 blitz drop-in) — no manual drain.
# Two consecutive nonzero batch exits = hard wall (quota/Airtable down): stop
# and leave hard-wall.flag rather than grind.

set -u
ORCH=/home/casey/repos/youtube-outreach-orchestrator-v1
EMAIL=/home/casey/repos/youtube-email-outreach-v1
DIR=$ORCH/logs/backfill-2026-07
HALT=$DIR/halt.flag
CHAINLOG=$DIR/chain.log

log() { echo "[$(date -u +%FT%TZ)] $*" >>"$CHAINLOG"; }

# Supadata preflight (added 2026-08-07, fixed same day): enrichment dies at the
# transcript stage when the Supadata plan quota is exhausted (the 2026-08-05
# incident burned 187 leads' retry budget in ~70 min). Probe before every batch;
# while EVERY configured key is limited, WAIT instead of launching. This also
# makes the chain safe against well-meaning restarts from other sessions —
# relaunching it while Supadata is down just waits.
#
# Fix (same day): the first version of this probe only ever checked the bare
# SUPADATA_API_KEY via a plain `dotenv/config` — which finds nothing (this repo
# has no local .env by design) and never sees the SUPADATA_API_KEY_1/_2 rotation
# pool added that morning. It always reported "limited" even with a fresh key 2
# sitting right there. Now it loads the real shared env file (same lookup order
# as src/lib/load-env.ts) and succeeds if ANY configured key returns 200.
supadata_ok() {
  local code
  code=$(node -e '
const { existsSync } = require("fs");
const { homedir } = require("os");
const { join } = require("path");
const dotenv = require("/home/casey/repos/quick-youtube-channel-research-v1/node_modules/dotenv");
const candidates = [
  process.env.SHARED_ENV_FILE,
  join(homedir(), "Claude", "env-storage", ".env"),
  join(homedir(), "env-storage", ".env"),
].filter(Boolean);
const shared = candidates.find((p) => existsSync(p));
if (shared) dotenv.config({ path: shared });

const keys = [];
const seen = new Set();
const add = (v) => { v = (v || "").trim(); if (v && !seen.has(v)) { seen.add(v); keys.push(v); } };
add(process.env.SUPADATA_API_KEY);
let gap = 0;
for (let i = 1; i <= 50; i++) {
  const v = process.env[`SUPADATA_API_KEY_${i}`];
  if (v) { gap = 0; add(v); } else if (++gap >= 5) break;
}

(async () => {
  for (const key of keys) {
    try {
      const r = await fetch("https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ", { headers: { "x-api-key": key } });
      if (r.status === 200) { console.log("200"); return; }
    } catch {}
  }
  console.log(keys.length === 0 ? "NOKEYS" : "ERR");
})();
' 2>/dev/null)
  [ "$code" = "200" ]
}

log "chain started (pid $$, batch size ${BACKFILL_BATCH_SIZE:-500})"

# Let any already-running batch finish before taking over.
while pgrep -f "outreach.ts --lead-ids-file" >/dev/null 2>&1; do
  sleep 120
done
log "no batch running — chain taking over"

consec_fail=0
while true; do
  if [ -f "$HALT" ]; then
    log "halt flag present — stopping"
    exit 0
  fi

  if ! supadata_ok; then
    log "supadata limit still active — waiting (probe every 30m, silent until it clears)"
    while ! supadata_ok; do
      [ -f "$HALT" ] && { log "halt flag present — stopping"; exit 0; }
      sleep 1800
    done
    log "supadata is back — resuming batches"
  fi

  fetch_out=$(cd "$EMAIL" && node "$ORCH/scripts/backfill/next-batch-ids.cjs" 2>&1)
  if [ $? -ne 0 ]; then
    log "id fetch failed, retrying in 10m: $fetch_out"
    sleep 600
    continue
  fi
  count=$(echo "$fetch_out" | sed -n 's/^COUNT=//p')
  file=$(echo "$fetch_out" | sed -n 's/^FILE=//p')
  pool=$(echo "$fetch_out" | sed -n 's/^POOL=//p')
  excluded=$(echo "$fetch_out" | sed -n 's/^EXCLUDED=//p')

  if [ "${count:-0}" -eq 0 ]; then
    log "pool drained (pool=$pool, permanently excluded=$excluded) — DONE"
    touch "$DIR/chain-done.flag"
    exit 0
  fi

  runlog=$DIR/$(basename "$file" -ids.txt)-run.log
  log "launching batch: count=$count pool=$pool excluded=$excluded file=$file"
  (cd "$EMAIL" && YOUTUBE_API_BACKEND=rapidapi npm run outreach -- \
    --lead-ids-file "$file" --stop-after enrich --concurrency "${BACKFILL_CONCURRENCY:-12}") \
    >"$runlog" 2>&1
  rc=$?
  done_n=$(grep -c "enrich run done" "$runlog" 2>/dev/null || echo 0)
  failed_n=$(grep -c "\] FAILED:" "$runlog" 2>/dev/null || echo 0)
  log "batch finished: exit=$rc done=$done_n failed=$failed_n log=$runlog"

  if [ "$rc" -ne 0 ]; then
    consec_fail=$((consec_fail + 1))
    if [ "$consec_fail" -ge 2 ]; then
      log "HARD WALL: two consecutive nonzero batch exits — stopping"
      touch "$DIR/hard-wall.flag"
      exit 1
    fi
    sleep 600
  else
    consec_fail=0
  fi
done
