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
# Enrichment storage needs no drain: the store is Postgres and has no record cap.
# Two consecutive nonzero batch exits = hard wall (quota exhausted, or the database
# unreachable): stop and leave hard-wall.flag rather than grind.

set -u
ORCH=/home/casey/repos/youtube-outreach-orchestrator-v1
EMAIL=/home/casey/repos/youtube-email-outreach-v1
DIR=$ORCH/logs/backfill-2026-07
HALT=$DIR/halt.flag
CHAINLOG=$DIR/chain.log

log() { echo "[$(date -u +%FT%TZ)] $*" >>"$CHAINLOG"; }

# Single-instance guard (2026-08-09): multiple sessions (this one, the automator
# session's own relauncher) all restart this script and have raced each other
# into duplicate chains — two chains double-process the same leads. flock makes
# the winner exclusive; every later launch exits here quietly. The lock dies
# with the process, so a crashed chain never wedges the next launch.
exec 9>"$DIR/.chain-lock"
if ! flock -n 9; then
  log "another chain instance already holds the lock — exiting (pid $$)"
  exit 0
fi

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

// Decodo (2026-08-13) is now the PRIMARY transcript provider in the quick/deep
// repos, so the gate passes if a live Decodo probe returns a transcript, even
// with every Supadata key exhausted. Probe = one real youtube_subtitles request
// (~$0.0005) against a stable video, tried twice (their 613 scrape-failure is
// transient); Supadata keys are only probed if Decodo cannot answer.
let decodoKey = null;
for (const [name, value] of Object.entries(process.env)) {
  if (name.toLowerCase() === "decodo_api_key" && (value || "").trim()) { decodoKey = value.trim(); break; }
}

(async () => {
  if (decodoKey) {
    const auth = decodoKey.includes(":") ? `Basic ${Buffer.from(decodoKey).toString("base64")}` : `Basic ${decodoKey}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch("https://scraper-api.decodo.com/v2/scrape", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: auth },
          body: JSON.stringify({ target: "youtube_subtitles", query: "dQw4w9WgXcQ" }),
          signal: AbortSignal.timeout(60000),
        });
        if (r.status === 200) {
          const body = await r.json();
          if (body?.results?.[0]?.content) { console.log("200"); return; }
        }
      } catch {}
    }
  }
  for (const key of keys) {
    try {
      const r = await fetch("https://api.supadata.ai/v1/transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ", { headers: { "x-api-key": key } });
      if (r.status === 200) { console.log("200"); return; }
    } catch {}
  }
  console.log(keys.length === 0 && !decodoKey ? "NOKEYS" : "ERR");
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
zero_streak=0
while true; do
  if [ -f "$HALT" ]; then
    log "halt flag present — stopping"
    exit 0
  fi

  # Orphan sweep (2026-08-08): a killed batch strands npm-exec'd enrichment
  # children (run-channel/export-run). They hang at ~1 GB RSS each and starved
  # the box before the 08-08 batch. Only kill TRUE orphans — ppid 1 (reparented
  # to init) — so a live d100/deep-research run or manual tick, whose processes
  # keep a real parent, is never touched. A hung node whose npm wrapper dies
  # first reparents to init and gets caught on the next pass of this loop.
  for pat in "scripts/run-channel[.]ts" "scripts/export-run[.]ts"; do
    for p in $(pgrep -f "$pat"); do
      ppid=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
      if [ "$ppid" = "1" ]; then
        kill "$p" 2>/dev/null && log "orphan sweep: killed stray enrichment pid $p"
      fi
    done
  done

  if ! supadata_ok; then
    log "supadata limit still active — waiting (probe every 30m, silent until it clears)"
    while ! supadata_ok; do
      [ -f "$HALT" ] && { log "halt flag present — stopping"; exit 0; }
      sleep 1800
    done
    log "supadata is back — resuming batches"
  fi

  # YouTube quota gate (2026-08-10, generalized same day for backend=auto):
  # the batch runs with YOUTUBE_API_BACKEND=auto — direct-key rotation first
  # (pool grew 7 → 39 keys on 08-10), RapidAPI fallback. So only wait when
  # BOTH pools are dead: every direct key exhausted/blocked AND RapidAPI 429.
  # A pure RapidAPI-429 wait would idle the chain while 39 healthy direct
  # keys sit unused (the 08-10 outage shape). Direct probe = 1 unit/key max;
  # rejected 429 RapidAPI calls don't consume quota.
  youtube_quota_ok() {
    local out
    out=$(node -e '
const { existsSync } = require("fs");
const { homedir } = require("os");
const { join } = require("path");
const dotenv = require("/home/casey/repos/quick-youtube-channel-research-v1/node_modules/dotenv");
const shared = [process.env.SHARED_ENV_FILE, join(homedir(),"Claude","env-storage",".env"), join(homedir(),"env-storage",".env")].filter(Boolean).find((p)=>existsSync(p));
if (shared) dotenv.config({ path: shared });
const keys=[]; const seen=new Set();
const add=(v)=>{v=(v||"").trim(); if(v&&!seen.has(v)){seen.add(v);keys.push(v);}};
add(process.env.YOUTUBE_API_KEY);
let gap=0;
for(let i=1;i<=500;i++){const v=process.env[`YOUTUBE_API_KEY_${i}`]; if(v){gap=0;add(v);} else if(++gap>=5) break;}  // 500 = safety bound, not a target; the gap>=5 break ends the scan. Was 60, which silently hid slots 61+ once the bank passed 60 keys (2026-08-19).
(async()=>{
  for(const k of keys){
    try{
      const r=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${k}`);
      if(r.status===200){console.log("OK direct");return;}
    }catch{}
  }
  const key=(process.env.RAPIDAPI_KEY||"").trim(), host=(process.env.RAPIDAPI_YOUTUBE_HOST||"").trim();
  if(key&&host){
    try{
      const r=await fetch(`https://${host}/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw`,{headers:{"x-rapidapi-key":key,"x-rapidapi-host":host}});
      if(r.status!==429){console.log("OK rapidapi "+r.status);return;}
    }catch{}
  }
  console.log(keys.length===0&&!key?"NOKEYS":"DRAINED");
})();
' 2>/dev/null)
    case "$out" in OK*|NOKEYS) return 0 ;; *) return 1 ;; esac
  }
  if ! youtube_quota_ok; then
    log "youtube quota exhausted on BOTH pools (direct + rapidapi) — waiting (probe every 30m, silent until it clears)"
    while ! youtube_quota_ok; do
      [ -f "$HALT" ] && { log "halt flag present — stopping"; exit 0; }
      sleep 1800
    done
    log "youtube quota is back — resuming batches"
  fi

  # The enrichment-base capacity gate was removed on 2026-08-12. It waited while
  # the Airtable enrichment base sat above 70% of its 125,000-record cap, reading
  # the fill percentage out of enrichment-db-cleanup.service's journal. The store
  # is Postgres now: there is no cap, the cleanup timer is stopped and disabled,
  # and the journal it read has no new entries — so the gate could only ever find
  # no reading and proceed. It went out with the thing it was protecting against.
  # The mass-failure guard below still backstops a batch that fails wholesale.

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
    # Role-aware empty-pool handling (2026-08-09): on the Mac the claimed list
    # genuinely finishes — exit DONE. On the VPS an empty pool just means "no
    # new approved_hold inflow right now" — idle and re-poll, else the chain
    # exits and relaunchers thrash it forever.
    if [ "${BACKFILL_CLAIM_ROLE:-vps}" = "mac" ]; then
      log "pool drained (pool=$pool, permanently excluded=$excluded) — DONE"
      touch "$DIR/chain-done.flag"
      exit 0
    fi
    if [ "${idle_logged:-0}" != "1" ]; then
      log "no pending inflow — idling (re-poll every 30m, silent until work arrives)"
      idle_logged=1
    fi
    sleep 1800
    continue
  fi
  idle_logged=0

  runlog=$DIR/$(basename "$file" -ids.txt)-run.log
  log "launching batch: count=$count pool=$pool excluded=$excluded file=$file"
  # Backend switched rapidapi → auto 2026-08-10 (Casey): RapidAPI is 429-dead
  # and the direct pool grew 7 → 39 keys. auto = direct rotation first, RapidAPI
  # fallback when the pool drains.
  (cd "$EMAIL" && YOUTUBE_API_BACKEND=auto npm run outreach -- \
    --lead-ids-file "$file" --stop-after enrich --concurrency "${BACKFILL_CONCURRENCY:-8}") \
    >"$runlog" 2>&1
  rc=$?
  # `grep -c` prints "0" AND exits 1 on zero matches — the old `|| echo 0`
  # fallback then ran too, appending a second "0" on its own line ("0\n0"),
  # which broke the `-gt` comparisons below with "integer expected" (found
  # 2026-08-09 via journalctl -u backfill-chain). This script has no `set -e`,
  # so grep's exit code was never fatal — just drop the `||` and default via
  # `${var:-0}` instead of adding a second producer of the value.
  done_n=$(grep -c "enrich run done" "$runlog" 2>/dev/null)
  failed_n=$(grep -c "\] FAILED:" "$runlog" 2>/dev/null)
  done_n=${done_n:-0}
  failed_n=${failed_n:-0}
  log "batch finished: exit=$rc done=$done_n failed=$failed_n log=$runlog"

  # Mass-failure guard (2026-08-09): a batch where failures dominate is an
  # infrastructure outage (full base, dead transcript quota, stripped env),
  # never 250+ individually-bad leads. Refund the attempt (rename the ids
  # file out of the *-ids.txt attempt-count glob) and cool down before the
  # next batch instead of burning the pool's retry budget at full speed.
  if [ "$failed_n" -gt 100 ] && [ "$failed_n" -gt "$done_n" ]; then
    mv "$file" "${file%.txt}.infra" 2>/dev/null
    log "MASS FAILURE ($failed_n failed vs $done_n done) — infra outage assumed: attempts refunded, cooling down 1h"
    sleep 3600
    continue
  fi

  # Zero-progress guard (2026-09-02): the mass-failure guard above is written in
  # absolute leads and only fires above 100, so it is blind to the shape this
  # chain actually fails in. The VPS side works INFLOW — batches of 2 to 55 — so
  # a total outage produces batches of 24 that fail 24 and the guard never sees
  # them. On 2026-09-01/02 that let a dead ENRICHMENT_REPO_PATH run 28 zero-work
  # batches back-to-back (58% of the cycle's batches, 290 lead-attempts burned in
  # bursts of ~30 seconds), and because each launched ids file counts as an
  # attempt and MAX_ATTEMPTS is 3, leads were PERMANENTLY excluded from the pool
  # for an outage that had nothing to do with them (excluded went 67 -> 105).
  # Every batch exited 0, so the hard-wall guard never saw it either.
  #
  # done=0 with two or more failures is an infrastructure statement, not a lead
  # statement: this pool is ordered best-first out of leads that already passed
  # find and verify, so "every single one failed" is never about the leads. Both
  # failure texts in that cycle confirm it (`ENRICHMENT_REPO_PATH is not set`,
  # `Enrichment exited with code 1`). Refund the attempts and back off, escalating
  # 10m per consecutive trip to a 1h ceiling. Self-clearing: one batch that
  # completes any work at all resets the streak, so the fix needs no intervention
  # when the cause is repaired (on 09-02 that was 04:32Z).
  #
  # Batches of one are exempt so a single genuinely-broken lead still ages out of
  # the pool normally, and the refund stops after BACKFILL_ZERO_REFUND_MAX
  # consecutive trips so a small pool of poison leads cannot refund itself into
  # an immortal loop -- past that point the cooldown continues but attempts count.
  if [ "$done_n" -eq 0 ] && [ "$failed_n" -ge 2 ]; then
    zero_streak=$((zero_streak + 1))
    if [ "$zero_streak" -le "${BACKFILL_ZERO_REFUND_MAX:-6}" ]; then
      mv "$file" "${file%.txt}.infra" 2>/dev/null
      refund_note="attempts refunded"
    else
      refund_note="attempts NOT refunded (streak past ${BACKFILL_ZERO_REFUND_MAX:-6}; leads may be genuinely broken)"
    fi
    backoff=$((zero_streak * 600))
    [ "$backoff" -gt 3600 ] && backoff=3600
    log "ZERO PROGRESS ($failed_n failed, 0 done, streak $zero_streak) — infra outage assumed: $refund_note, cooling down ${backoff}s"
    sleep "$backoff"
    continue
  fi
  zero_streak=0

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
