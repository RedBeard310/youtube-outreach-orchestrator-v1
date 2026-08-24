# Standing Orders — the living priority document

**Read this at the start of every session before deciding what to work on.**
This file exists because day-to-day instructions were slipping through the
cracks between sessions (Casey, 2026-08-14). When Casey changes a priority in
chat, UPDATE THIS FILE in the same session — that is what "living" means.
Keep the change log at the bottom.

## The mission (never changes)

More qualified leads. Every discovery method runs permanently and overnight.
Never stop a producing lane. Sending email stays MANUAL (`npm run send`) —
everything up to "parked, ready to write" is automatic.

## Discovery lane priority (updated 2026-08-14)

1. **Recommended-videos feed (graph-sweep) — PRIMARY. Pound it hard.**
   Casey 2026-08-14: this is the new #1, hit it as hard as we can every day.
   It self-feeds (every qualified lead becomes a seed) and re-walking the
   whole seed book (a new "lap") is proven at ~80% of first-lap precision —
   0.45 qualified/seed lap 1. Standing authorization: always-on, OpenRouter
   spend included, no per-run approval. If this lane is idle, that is a
   PROBLEM to fix, not a normal state.
2. **Comment-sweep — PAUSED by Casey 2026-08-20. Never run it again unless he
   says so.** `comment-sweep-daily.timer` is stopped + disabled on purpose, and
   its row was removed from the autopilot check-in's staleness watch so no
   fix-agent resurrects it. A stale `comment-sweep-state.json` is EXPECTED, not
   an incident. (Context: 0.54% qualified rate at 9.6¢/lead vs the feed's
   1.4¢ — the keep-or-kill call landed on kill-for-now.) Seed discovery
   (`discover-comment-seeds.ts`) ran as part of the same daily unit, so it is
   paused with it.
3. **Keyword/term search — opportunistic, not primary.** The fresh-term
   reserve drained 2026-08-12. The lane runs on whatever the autocomplete
   harvest + probe discovery refill; do NOT treat "no active terms" (finder
   exit 3) as an incident, and do NOT lean on this lane for volume.
4. **Peer-comment + guest-link lanes** — keep running on their timers.
5. **Podcast crossover** — NOT built; waiting on Casey's data-source call.

## Enrichment / prep (steady state since 2026-08-13)

- Transcripts: **Decodo** primary (~$0.50/1k, key `Decodo_API_KEY` mixed case),
  Postgres cache checked first, Supadata CANCELLED (keys may vanish; code
  treats it as optional fallback). Never filter on `captions_exist`.
- The backfill chain (`scripts/backfill/chain.sh`) self-drains the
  approved_hold pool; VPS handles unclaimed + inflow, the Mac owns its frozen
  claim file. Leads run ~3-6 min each now.
- The store is **Postgres** (`pipeline` db, via `/home/casey/.pipeline-db.env`).
  Anything that reads Airtable is dead code. Whole-table reads are forbidden —
  enrichment.videos is 2.5M rows and killed every export once (2026-08-13).

## Parked pools waiting on Casey (don't touch without his word)

- `needs_contact` (4,345): recovery engine **BUILT AND RUNNING** since Casey
  merged it 2026-08-23 (`1bea933`). No longer the biggest unbuilt lever — it is
  now a live lane inside the campaign's finish block. It parks recovered leads
  into `approved_hold` like any other, so it feeds the pool below, not a new one.
- `approved_hold` (3,394): fires only via manual `npm run send`.
## Session checklist (every session, ~2 minutes)

1. Is graph-sweep.service actively walking? (`systemctl status graph-sweep`;
   idle + seeds available = fix it.)
2. Comment-sweep must be OFF (`systemctl is-enabled comment-sweep-daily.timer`
   → `disabled`). If anything re-enabled it, stop it and find what did.
3. Is the backfill chain alive and past its gates? (`logs/backfill-2026-07/chain.log`)
4. Radar fresh? (youtube-ingest.timer, every 6h; manual: `python3 scripts/youtube_ingest.py` in automator)
5. Anything in this file contradicted by what Casey said today? → update it.

## Change log

- 2026-08-24: **The `needs_contact` recovery lane is live, and it made the day.**
  Casey merged it 08-23 21:27Z (`1bea933`). Its first night produced roughly
  **77 of the 189 parked leads** — the best parking day since 07-09 — off a pool
  nobody had worked since 08-18. Recovered parks cost no LLM at all, which is why
  cost per park fell to **4.2c** from 7.5c. **Read `verified = false` on a contact
  point carefully: it is also the resting state of an address already checked and
  found dead.** The lane's own selector read it as "still to check", so pass two
  re-selected 84 of the same 91 leads three hours later, spent 34 ZeroBounce
  credits and flipped nothing — ~270 wasted credits a day left alone, plus a
  duplicate ownership note on 83 rows. **Fixed** in orchestrator `d6af815` (skip
  anything carrying `verified_at` or an `[ownership:` note; live pool 85 → 2, no
  backfill needed) and email-repo `5efd7a7` (an ownership rejection now stamps
  `verified_at` and appends its note once). The lane's engine is the FREE collect
  pass, not the paid verify pass — 2,996 untouched leads at 40 per 6h is about 19
  days of road, and raising that batch is the next lever on this lane.
  Full detail: `brain/lead-gen/runs/lead-run-2026-08-24.html`.
- 2026-08-23: **The 08-22 "video-graph sweep is throughput-bound, down 27%" finding
  is WITHDRAWN as a regression — the number was double-counted.** `seeds_advanced`
  in `scripts/autopilot/debrief-data.ts` summed every session log that *overlapped*
  the 24h window, but summed each session's WHOLE advance. Fine for short sessions
  (peer-sweep reported 264 against a true 264); wrong for a daemon running one
  22-24h session, which is why video-graph reported **12,647 against a true 7,523**.
  It also fed `days_of_road` (**2.3 reported, 3.9 true**). The lane actually walked
  ~36% MORE than the day before. **Fixed** in orchestrator `21b3f84`: a cycle's walk
  is now the seed-book delta between two consecutive daily snapshots, with the log
  sum kept only as a fallback, and `seeds_advanced_source` names which was used.
  **The ceiling argument still stands** on its own evidence (one process, one
  candidate at a time, 5 min per 20 seeds) — recommendation #1 is unchanged, just
  less urgent. Same day: the lane sped up because each seed hands it LESS work
  (new channels per chunk 69.0 → 61.6), and good leads per seed fell 13%, so
  **treat a rising walk rate on this lane as evidence the book is thinning.**
  Full detail: `brain/lead-gen/runs/lead-run-2026-08-23.html`.
- 2026-08-21: **Measurement note on lane #1, ranking left alone pending Casey.**
  The recommended-videos feed is not idle and not broken, it is out of road:
  `10,555 / 10,555` seeds walked, and its hourly refill correctly supplies only
  the 7-10 channels an hour the ICP newly qualifies, so it restarted 25 times in
  the cycle to walk 257 seeds and fell from 2,716 channels to 228 in one day. Its
  own summary reads lap 5 at 0.019 qualified/seed against 0.033 on lap 4 and 0.45
  on lap 1, so re-walking that book is no longer worth the walk. It still has the
  best conversion rate (7.5%) and the cheapest lead (1.9¢) in the pipeline, just
  at 17 leads a day. **Do NOT treat this lane's low volume as a bug to fix** — the
  plumbing is working. Whether it stays ranked #1 is Casey's call; the ranking
  above is unchanged. Same day: the peer lane is also fully walked
  (`10,444 / 10,444`), and the video-graph seed floor was widened from 100k to
  20k views (top-40 per channel) so the biggest lane has ~42,000 fresh seeds
  instead of 417. Full detail: `brain/lead-gen/runs/lead-run-2026-08-21.html`.
- 2026-08-20: **Comment-sweep PAUSED until further notice (Casey: "never run it
  again unless I say").** In-flight run killed, `comment-sweep-daily.timer`
  stopped + disabled, autopilot check-in watch row removed (it would have told
  a fix-agent to re-enable the timer). Lane #2 above updated.
- 2026-08-14: File created. Graph-sweep promoted to explicit #1 ("pound it"),
  refill cadence tightened 4h→1h, next lap queued; comment-sweep seed
  discovery engine commissioned; keyword lane demoted to opportunistic.
  (Casey's instruction after a thin overnight: don't let exhausted lanes
  masquerade as primary ones.)
- 2026-08-14 (later): Lap 3 re-walk LIVE — 8,409 seeds queued, ~3 days of
  continuous walking, watch `npx tsx scripts/lap2-progress.ts` (finder repo).
  Lap 2 closed at 0.373 qualified/seed (82% of lap 1 — compounding holds).
  OPEN DECISION for Casey: auto-`--relap` on drain (extend-seeds.ts) once
  this re-walk's rate is measured, so the lane never idles again.
- 2026-08-16: **The lap-3 re-walk measurement came in, and the OPEN DECISION above
  is closed: auto-relap SHIPPED, but the "compounding holds at ~80%" premise is
  dead.** The re-walk ran at **0.053 qualified/seed** (lap 1 0.453, lap 2 0.373).
  It had looked like +85% because `lap2-progress.ts` divided all-time `qualified`
  by one lap's `seeds_done` — that counter resets at every relap while the others
  accumulate. Fixed in finder `673a8a6` (`src/discovery/graph/lap.ts`); the sweep's
  own "/seed" summary line was wrong the same way. **Judge a lap in dollars, not
  seeds:** a lap costs ~$7.60 for ~480 leads = **1.6¢/lead**, cheaper than every
  lane but keyword search, over wall-clock the lane would otherwise spend idle.
  `refill-graph-sweep.sh` now closes and re-opens a drained book by itself, gated on
  `RELAP_MAX_USD_PER_LEAD` (25¢) and `RELAP_COOLDOWN_HOURS` (12). Expect **~$5/day
  OpenRouter** from this lane while it has nothing fresher to walk. **Still true and
  unsolved: relapping is a holding pattern.** The lane only grows on first-time
  seeds, which come from the other lanes' qualified output (~3/hour right now).
- 2026-08-16: Comment-sweep's seed picker is proven to rank correctly (business tier
  1.17% vs creator-ed 0%) and the lane still ran at **0.54%** for a second cycle, at
  9.6¢/lead against the feed's 1.4¢. Per the 08-15 rule this is now Casey's
  keep-or-kill call. **Left running** — nothing was changed.
- 2026-08-14 (later): Comment-seed discovery engine LIVE
  (finder scripts/discover-comment-seeds.ts + 40-query bank, runs before the
  09:11 UTC daily sweep, cursor rotates queries daily). First run: 15 new
  seeds (vidIQ, TubeBuddy tier); first chunk surfaced 4,546 net-new
  commenters. Expect elevated OpenRouter scoring spend on rich days; the
  --max-llm 4000 cap pausing a walk mid-day (exit 10) is normal, it resumes
  next day.
