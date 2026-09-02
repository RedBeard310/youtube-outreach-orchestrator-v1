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
   It self-feeds (every qualified lead becomes a seed). Standing authorization:
   always-on, OpenRouter spend included, no per-run approval. If this lane is
   idle, that is a PROBLEM to fix, not a normal state.
   **The "~80% of first-lap precision" claim written here on 08-14 is dead.**
   CLOSED lap yields from the sweep's own counter: lap 1 **0.45**/seed,
   lap 4 **0.033**, lap 5 **0.021**, lap 6 **0.014** at **$0.034/lead** =
   **3.1% of lap 1**. Lap 7 opened 08-29 05:11Z.
   **Only quote a CLOSED lap.** Lap 6 read 0.0078 mid-lap and closed at 0.014,
   so it nearly doubled in its second half; a half-finished lap is not the lap's
   rate, and the 0.0078 figure that stood here on 08-28 was that mistake.
   Do NOT quote the 80% figure and do NOT treat a low-yield lap as a bug to
   debug. **Whether to keep starting full new laps is Casey's call** (this entry
   is why the autopilot has not changed it); the proposed rule is to walk only
   seeds added since the last lap once a finished lap falls below a yield floor.
   Carried as debrief rec #2.
   **The "2.4x less efficient than video-graph" line does not survive 08-29.**
   On corrected seeds the feed ran at 0.0193/seed (3.3c/lead) against
   video-graph's 0.0161 (3.5c) and peer's 0.0231 (3.3c). All three graph lanes
   now cost within a penny of each other per lead. The decay argument stands on
   its own; the "much worse than the alternatives" argument does not.
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

- `needs_contact` (4,951 at 2026-09-02): recovery engine **BUILT AND RUNNING**
  since Casey merged it 2026-08-23 (`1bea933`). Live lane inside the campaign's
  finish block; recovered leads park into `approved_hold`, so it feeds the pool
  below rather than a new one. **The pool grew because arrivals outrun the lane,
  not because the lane is broken.** Its verify half is drained (queue depth 1 of
  a 200 batch) and 374 leads are already recovered. Collect throughput is the
  whole bottleneck, and it was widened on 2026-09-02 (entry in the change log).
  **It FELL for the first time on the cycle ending 2026-09-02T07:00Z**, 4,980 to
  **4,888**, taking in 37 and still ending 92 smaller. That is the first fall on
  record and it put more leads into `approved_hold` than a whole day of fresh
  finding did. Treat it as one observation, not a trend: the 92 is arithmetic on
  two pool sizes, and the lane's own logs show seven verify passes of 1 to 10
  leads that cannot account for it. If it falls again, recovery is the bigger
  lever than discovery and the collect batch is worth widening a second time.
- `approved_hold` (**4,036** at 2026-09-02, was 3,394): fires only via manual
  `npm run send`. **3,835 of them already carry an enrichment bundle**, so only
  201 are waiting on enrichment. That backlog is nearly clear.
## BLOCKING as of 2026-08-30: the shared key bank is empty

**`~/env-storage/.env` was overwritten with 0 bytes at 2026-08-30T04:58:11Z and
the whole pipeline is stopped on it.** Check this FIRST, before anything else in
the checklist below:

```
stat -c '%s %y' ~/env-storage/.env      # 0 bytes = still broken
grep -c '^YOUTUBE_API_KEY' ~/env-storage/.env
```

- **The keys themselves are fine.** `youtube-lead-finder-v1/logs/youtube-dead-keys.json`
  held 1 live entry of 27 on the morning of 08-30, and that one was a `blocked`
  (suspended project), not a quota death. 65 of 66 keys were alive.
- **Restoring it is Casey's, on the Mac.** The Mac's copy is the master and it
  overwrites the VPS copy every two minutes, so a VPS-side edit is pointless and
  no agent may touch a `.env` anyway. When a good copy lands, everything resumes
  by itself — no service needs restarting.
- **Check the slot numbering when it comes back.** Slots must run `_1` upward
  with no gap of five or more, because several key loaders stop scanning there
  and the only symptom is a silently smaller pool.
- **Do not diagnose this as "the lanes are broken".** The sweeps pausing and the
  finder finding nothing are both downstream of the empty file.

## RapidAPI is NOT gone — it lapsed onto a free tier (found 2026-08-30)

CLAUDE.md says RapidAPI was retired on 2026-08-10 and that a keyless run simply
halts. **Both halves are wrong and the correction matters.** The account answers
normally on a **free tier of 1,000 requests and 100 searches per day**, so a run
with no direct keys falls through to it, spends ~950 of the 1,000, and
`quota-guard.ts` writes `used_pct: 95.2` into `logs/quota-state.json`.

**All five sweeps and both campaign governors read that file as the YouTube
quota and pause above 70%.** So a 1,000-request free plan can shut down the
entire pipeline while the real 66-key pool sits untouched. That is what happened
on 08-30. Both pre-existing guards passed it: staleness passed because a
fallback run had just rewritten the file, and the 08-11 retired-backend guard
only catches `remaining < 0` while a live free tier answers `remaining: 48`.

Fixed the same day in all three copies of that read (finder `19e7dd6`,
orchestrator in `bdd675d`): a snapshot whose largest bucket limit is under
`QUOTA_MIN_PLAN_LIMIT` (5,000) no longer governs, and `auto` with zero direct
keys now refuses to start at all rather than burn the free tier silently.
**If you ever see a lane paused at ~95% quota while the key pool is healthy,
this is the shape to check first.**

## Session checklist (every session, ~2 minutes)

0. **Is `~/env-storage/.env` non-empty?** See the blocking entry above. Nothing
   else on this list can pass while it is 0 bytes.
1. Is graph-sweep.service actively walking? (`systemctl status graph-sweep`;
   idle + seeds available = fix it.)
2. Comment-sweep must be OFF (`systemctl is-enabled comment-sweep-daily.timer`
   → `disabled`). If anything re-enabled it, stop it and find what did.
3. Is the backfill chain alive and past its gates? (`logs/backfill-2026-07/chain.log`)
4. Radar fresh? (youtube-ingest.timer, every 6h; manual: `python3 scripts/youtube_ingest.py` in automator)
5. Anything in this file contradicted by what Casey said today? → update it.

## Change log

- 2026-09-02 (debrief): **A guard written in absolute leads cannot see an outage
  on a machine that works inflow.** The enrichment chain's mass-failure guard
  fires above 100 failed leads. The VPS side works new arrivals, so its batches
  are 2 to 55, and the 09-01/02 `ENRICHMENT_REPO_PATH` outage produced **28
  zero-work batches out of 48** that the guard was structurally incapable of
  seeing. Every batch exited 0, so the hard-wall guard missed it too. **The
  damage was not lost time, it was the retry accounting:** each launched ids file
  counts against `MAX_ATTEMPTS=3` and the chain relaunched instantly, so a lead
  could burn all three attempts in 90 seconds and be permanently dropped from the
  pool. Excluded ran 67 to 105. Fixed in `53a6950`: `done=0` with two or more
  failures is infrastructure by definition, because this pool is ordered
  best-first out of leads that already passed find and verify, so "every one
  failed" is never a statement about the leads. Refunds attempts, backs off 10
  min per repeat to a 1h ceiling, self-clears on any batch that completes work.
  The 22 outage ids files were refunded: excluded **105 back to 30**, 75 leads
  returned to the pool. **Watch line stays the same** (`grep "batch finished"
  logs/backfill-2026-07/chain.log | tail`), plus `grep "ZERO PROGRESS"` on the
  same file, which is now the loud version of it.

- 2026-09-02 (debrief): **A contact point nobody can rule on is immortal.** Lead
  `rec0kCDPB850ZLDV2` had been in every single Bloodhound verify batch since
  08-18. It carries a `business_email` whose value is the literal string
  `REDACTED FOR PRIVACY`, scraped off a privacy-protected WHOIS record. ZeroBounce
  never returns a verdict on a value like that, so `verified_at` stays null, and
  `VERIFIABLE_IDS_SQL` selects on exactly that null. On a verify queue only 38
  leads deep, one such row is 3% of it, forever. Individual methods do screen
  their emails (RDAP calls `isJunkEmail`) but a screen per method is a screen the
  next method forgets. The guard now sits at `saveContactPoints`, the single
  insert point (email repo `e8d0858`), and tests **shape rather than a blocklist
  of bad words**, so `Data Protected`, `not disclosed` and the next registrar's
  wording all fail it. Orchestrator `7900f17` adds the matching SQL predicate,
  which retires the rows already stored with no backfill. Queue 38 to 37.

- 2026-09-02: **The YouTube keys are not being banned. Many of them share a
  Google Cloud project, so they share one 10,000-unit quota.** The 09-02 handoff
  read `logs/youtube-dead-keys.json`, saw 39 keys rejected within minutes of the
  07:00 UTC quota reset, reasoned that no key can spend 10,000 units in a
  fraction of a second, and concluded Google had zeroed them, leaving ~26 usable
  keys. The first half of that reasoning is right and the conclusion is wrong.
  **Map the dead keys back to their slot numbers and they die in contiguous
  blocks:** 24-30 together, 31-40 together, 13-16, 46-49, 42-43, and 54-66 all in
  the same instant. Slot order is our own bookkeeping from the order the Notion
  sync appends them, so it is invisible to Google and no ban wave could align to
  it. What it does align to is the account each batch was created under. When a
  project's 10,000 units are gone, every key in that project answers
  `quotaExceeded` on its very first call, and the rotation walks the whole block
  in about a second. That is the pattern, exactly.
  **The number to plan against is projects, not keys.** 39 of the 66 keys sit in
  6 project groups, so they supply about 60,000 units a day between them, not
  390,000. Whole-pool daily quota is roughly 270,000 units. **So buying more keys
  the same way buys nothing** and this is the thing to check before spending: a
  new key adds quota only if it comes from a Google Cloud project we do not
  already have. Verify a batch by watching whether its slots die together.

- 2026-09-02: **ENRICHMENT WAS DEAD AND NOTHING SAID SO. Check this first if the
  approved_hold pool stops growing.** Every backfill batch was failing instantly
  on `ENRICHMENT_REPO_PATH is not set`. The variable lived only in
  `youtube-email-outreach-v1`'s `.env`, which Casey deleted on 2026-09-01, and
  the shared bank carries keys only, so it resolved to nothing. **The chain
  looked completely healthy while completing zero work**, because the error
  throws once per lead, the chain counts that as a failed lead, and the batch
  still exits 0. Last good batch was 2026-09-01T23:13Z; by 04:00Z on 09-02 every
  batch read `done=0 failed=24`. Fixed by giving the variable a committed default
  in `src/env.ts`, which is what the file already does for `AIRTABLE_BASE_ID` and
  `AIRTABLE_ENRICHMENT_BASE_ID` after the same deletion broke those. **A path is
  configuration, not a secret, so it belongs in code**, and a repo `.env` is not
  a durable home for anything. Verified by enriching one real lead end to end.
  This is the fourth time in a fortnight a liveness signal was mistaken for a
  work signal (08-12, 08-27, 08-29, now this): **read a lane's OUTPUT, not its
  heartbeat.** Watch: `grep "batch finished" logs/backfill-2026-07/chain.log | tail`,
  and treat a run of `done=0` as an outage no matter what the chain says.
  **This, not the recovery lane, is the binding gate on the backlog.** A lead the
  recovery lane recovers lands in `approved_hold` with no enrichment bundle, and
  the ABC test requires one. 145 `approved_hold` leads with a valid email have no
  bundle, which is why the eligible count sat at exactly 2,800 all session while
  leads were being recovered. Expect ~$0.14 of OpenRouter per lead (DeepSeek
  v3.2, measured across eight 08-31 batches at $0.05 to $0.25), so roughly $20 to
  clear the 145, plus the recovery lane's ongoing inflow.

- 2026-09-02: **A quarter of the recovery backlog was invisible to the lane, and
  the fix that let it in had to land first.** Both selectors in
  `src/recovery/bloodhound-lane.ts` read `outreach_status = 'no_email_found'`
  alone, so the 1,181 `needs_contact` leads sitting at `email_invalid` were never
  handed to the collector at all. Nothing downstream required that: the email
  repo's hold-guard gates on `review_status` and the score bar, never on
  `outreach_status`. Both selectors now work both lanes.
  **The blocker was a silent one.** `verifyAndFlip` wrote
  `email_address = COALESCE(NULLIF(email_address, ''), $1)`, which is harmless on
  a `no_email_found` row (the column is empty) and a guaranteed bounce on an
  `email_invalid` one: it keeps the address ZeroBounce already called
  undeliverable, stamps `email_verification_result = 'valid'` over the top, and
  flips the lead into `approved_hold`, which is the pool the ABC test selects
  from on `email_address`. Fixed in the email repo as `promoteVerifiedEmailSql`.
  Verified live on three real leads that each carried a dead address: all three
  came out carrying the newly recovered address, not the dead one.
  **Measured, not assumed: `email_invalid` leads are the BETTER half of the
  backlog.** A 20-lead probe returned 31 contact points from 9 leads, 1.55 per
  lead against the 0.95 the `no_email_found` pool has averaged over 17 logged
  passes. Somebody already found a scrapeable site on those leads.
  **Collect batch 40 -> 150.** "Raising that batch is the next lever" has been
  the note on this lane since 08-24. Sized off the measured 18.5s per lead at
  concurrency 8, so 150 leads is about 46 minutes of detached child. Four passes
  a day becomes 600 leads instead of 160, which walks the widened 4,444-lead book
  in about a week instead of a month. The stale-PID guard was a flat 2h written
  against the 40-lead batch, so it now scales with the batch (`staleCollectAfterMs`);
  a flat number there goes wrong in the dangerous direction, spawning a second
  child on top of a live one.
  **Found by running it: the collector harvests suppression and legal desks.**
  The probe verified `removalrequest@noellerandall.com` and flipped that lead into
  `approved_hold` on it, one `npm run send` from mailing an opt-out mailbox. These
  come off a site's `/privacy-policy/` and `/terms-and-conditions/` pages, which
  is where the scraper reliably finds an address when the rest of the site
  publishes none, and they sit on the creator's own domain so the ownership gate
  waves them through. `isJunkEmail` now rejects the suppression shape and the
  legal desks (`dmca`, `copyright`, `infringe`, `takedown`, `compliance`). The
  rule is narrow on purpose: `removals@` and `remove@` stay legal, because a
  removals firm is a real lead in this book. A scan of the whole book found
  exactly one affected row, the probe's own, uncontacted; it was reverted.
  **Two things in the 09-02 handoff do not survive measurement.** Its item 2
  calls the 613 non-`valid` `approved_hold` rows cheap re-verify wins. 587 of
  them are `risky`, which is not an unverified state: `normalizeStatus` maps
  ZeroBounce's role-based `do_not_mail` and `catch-all` onto it deliberately, as
  a documented last-resort tier. A 10-address re-check returned 8 role-based
  `do_not_mail`, 1 catch-all and 1 valid, so the honest estimate is ~59 leads for
  ~587 credits, and the real question is whether to mail role addresses at all.
  **That is Casey's deliverability call, not an engineering task.** Its item 3
  says the 410 rows with no `host_first_name` are blocked. They are not blocked
  here: `src/writer/host-name.ts` already resolves a missing host to a business
  greeting ("Hey to the good folks at ..."), and many of those 410 are companies
  with no host to find. The constraint is the ABC test's own templates in
  `automator`, and the cheap fix is a business-greeting fallback there, not a
  host-ID run over this pipeline.

- 2026-08-30: **The shared env bank went to 0 bytes at 04:58:11Z and stopped the
  whole pipeline.** Full entry above, under "BLOCKING". The cycle's final hour
  found **zero channels**, the first empty hour since the lanes went always-on.
  Two durable fixes shipped so this shape degrades instead of stopping: the
  free-tier quota guard (all three governor copies) and an empty-key-pool guard
  that throws `YOUTUBE_KEY_POOL_EMPTY` instead of silently running on the
  fallback. Neither can restore the file; that is Casey's, on the Mac.
  **Also learned: RapidAPI is not retired, it is on a free tier** — see the
  section above, and treat the CLAUDE.md line saying a keyless run "halts" as
  out of date.
  **Lap 7 of the feed lane is tracking 0.006/seed** (mid-lap, 855 seeds left)
  against lap 6's CLOSED 0.014 and lap 1's 0.45. Quote the close, not this.
  Video-graph produced nothing for a second straight cycle, still on the $50
  lifetime cap, now **1,933 seeds unwalked** at 2.7¢/lead.
- 2026-08-29: **The video-graph sweep is STOPPED on a lifetime cost cap and
  needs Casey's word to come back. Do NOT debug it as a broken lane.** It
  crossed `VIDEO_SWEEP_MAX_USD` (default $50) at 2026-08-28T10:31Z, exited with
  the success code, and its loop treats that as "book finished" and stops for
  good. Something relaunched it hourly for 21 hours; every run died in ~2s.
  **1,424 of 73,181 seeds are still unwalked**, on the lane with the cheapest
  lead in the pipeline (**$50 / 1,877 qualified = 2.7c**). The cap counts
  LIFETIME dollars out of `logs/video-graph-sweep-state.json`, so waiting never
  releases it; the sibling feed lane caps PER LAP (`lapUsd()` in
  `graph-sweep.ts`) and therefore self-releases. To restart: raise
  `VIDEO_SWEEP_MAX_USD` in `video-graph-sweep-loop.sh`'s environment, then
  `sudo systemctl start video-graph-sweep`. The durable version is to make its
  cap per-lap like the feed lane's. Nothing was changed unattended because it is
  a spend decision. Carried as debrief rec #1.
- 2026-08-29: **"Recently updated" is not "working" — read a lane's own progress
  counter.** The stall above was invisible for 21 hours because a sweep that
  starts and quits in two seconds still rewrites its state file:
  `hours_since_update` read 0.8, `productive` read `true` (it had worked earlier
  in the window), and only `idle_run_streak: 23` was honest. `checkin.ts` now
  has a **`sweep_stalled`** heartbeat (section 7b) that diffs each lane's own
  `seeds_done` against itself over `AUTOPILOT_SWEEP_STALL_HOURS` (4) and names
  the cause from the lane's last stop line. **Observation only, never the paid
  fix-agent** — every stall cause seen so far is a spend or infra call. This is
  the third time in a fortnight a liveness signal was mistaken for a work
  signal (after 08-12 and 08-27): **read a lane's OUTPUT, not its heartbeat.**
- 2026-08-29: **A lap rollover no longer falls back to the inflating log sum.**
  `reconcileAdvanced` in `scripts/autopilot/debrief-data.ts` differences two
  daily seed-book snapshots and fell back to summing session logs whenever that
  delta went negative — which is exactly what closing one lap and opening the
  next does. On 08-29 that reported **13,199 seeds against a true 6,019** on the
  lane that made 116 of the day's 163 leads, and it fed `pitchable_per_seed`
  (0.0088 reported, **0.0193** true), `days_of_road` (0.8, true **1.9**) and
  `walk_rate_change_pct` (+89%, true **-12.7%**). A rollover is now computed
  exactly as `(prev_total - prev_walked) + walked_now`, named
  `seeds_advanced_source: "lap_rollover"`; a book that SHRANK still falls back,
  because that case cannot be computed. Same bug class as the 08-23 double-count
  it was written to replace.
- 2026-08-29: **A three-seed trickle is a finished lap.** `refill-graph-sweep.sh`
  only started a new lap when `extend-seeds.ts` printed the literal "nothing to
  add", and the hourly refill adds the two or three channels the ICP newly
  qualified, so a finished book gets chased down a handful of seeds at a time.
  Measured: **232, 17, 4, 3 seeds across four hourly restarts** (00:11Z-04:14Z)
  = ~23 seeds in four hours against a normal ~250/h, escaping only at 05:11Z
  when the trickle happened to be empty. Anything under `RELAP_DRAIN_FLOOR` (50)
  fresh seeds now counts as drained and relaps; `RELAP_UNWALKED_TOLERANCE` lets
  the relap step over the trickle (safe: a relap re-opens the whole book,
  including it). Cooldown and economic gates untouched, and the cooldown-hold
  branch now still restarts the walker so a held relap cannot strand seeds.
- 2026-08-28: **The 08-27 recovery-lane fix is CONFIRMED WORKING. Do not
  re-debug it.** Three collect passes dispatched 40 leads each; 44 of the 120
  produced something, for **112 contact points = 0.93/lead**, against the ~0.9 a
  hand-run sample predicted and against 46/2/0/1 on the four days before. The
  keyset cursor has walked out from the forty oldest leads to 2026-07-12
  discoveries and `laps` is still 0, so nothing is being re-run. **The open
  question has moved one step downstream:** a contact point is a candidate
  address, not a verified one. 32 recovered leads reached email verification in
  the cycle and `needs_contact` shed only ~16 against 88 arrivals. Watch the
  collect → verify → `approved_hold` conversion for one more cycle before
  spending anything on the collector itself.
- 2026-08-28: **The graph-sweep lap-precision figure in lane priority #1 was
  corrected in place** (it said ~80% of first lap; lap 6 measures 1.7%). Nothing
  about the lane's priority or its standing authorization changed.
- 2026-08-28: **The mid-run `evaluate-probes` step is now time-gated as well as
  fade-gated.** It fired 205× in the cycle (589 of 591 passes faded) at a
  measured 31s per 22,945-row scan = 1h46m of a 20.49h loop, and 140 of those
  205 runs changed nothing. `PROBE_EVAL_MIN_INTERVAL_MINUTES` defaults to 30; 0
  restores fade-only. The end-of-session evaluation still always runs, so no
  session ends without a full one.
- 2026-08-27: **The `needs_contact` recovery lane was live but stalled, and the
  entry above ("BUILT AND RUNNING") was true only of the first night.** It
  dispatched 4 collect passes a day at 40 leads each from 08-23 onward and wrote
  46 contact points on 08-23, 2 on 08-24, 0 on 08-25, 1 on 08-26 and 0 on 08-27.
  The untouched pool sat at 3,315 the whole time. The collect selector released a
  lead only by succeeding, so every lead the collector failed on stayed at the
  head of the queue: it re-ran one fixed batch of the 40 oldest leads about
  sixteen times, and 27 of that forty carry no website for 9 of the 11 methods to
  use. Nobody saw it because the detached child ran on `stdio: 'ignore'`. **Fixed**
  in orchestrator `f74bf4f`: the queue carries a cursor, walks the whole book,
  puts website-carrying leads first, and logs to `logs/bloodhound-collect.log`.
  **Read a lane's OUTPUT, not its dispatch count** — this is the second selector
  in a week (after `d6af815`) that read "no result yet" as "not tried yet".

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
