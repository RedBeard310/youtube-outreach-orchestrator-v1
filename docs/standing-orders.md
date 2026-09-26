# Standing Orders — the living priority document

**Read this at the start of every session before deciding what to work on.**
This file exists because day-to-day instructions were slipping through the
cracks between sessions (Casey, 2026-08-14). When Casey changes a priority in
chat, UPDATE THIS FILE in the same session — that is what "living" means.
Keep the change log at the bottom.

## ACTIVE as of 2026-09-13: score and work the 5,395 under-rated 10k+ leads

**Casey, 2026-09-13.** 5,395 channels with 10k+ subscribers in a named niche had
never had a Signal Score v2, because `automator/scripts/rescore-v2.py` only
scored leads whose old `signal_score` was 6 or more, and the old score's view
counts were unreliable. **This is not discovery.** The leads are already in the
database, which fits the 09-08 order to put everything into the leads we have,
so the discovery pause below stays on.

- **The ids:** `automator/state/v2-batch-2026-09-13.ids`, finance and coaching
  first. Score or re-score them with
  `python3 scripts/rescore-v2.py --stage all --ids-file state/v2-batch-2026-09-13.ids`
  (`--stage assemble` alone is free and re-counts newly found contacts). Use the
  file, not `signal_score_v2 IS NULL`, which is empty for these leads now.
- **Order of work:** finance and coaching first (whales, then strong 7s, then
  other 7+, then 6s), then every other niche in the same order. When these leads
  reach the recovery lane, their finance and coaching leads go to the front.
- **New gate rules (Casey):** a lead may be worked for a contact at old score 6+
  or v2 6+. A lead may enter `approved_hold` at old score 6+, or v2 7+ once the
  score has been re-run with the verified email. Everyone who passed before still
  passes. Built once, as Postgres functions (`leads.may_seek_contact`,
  `leads.may_enter_hold`). **Live since 2026-09-14 in both repos, with Casey's word.**
- **Done:** the 18 pilot leads are in `approved_hold`. Email finding ran on 637
  finance and coaching leads, and the 315 without a working email went to the
  recovery lane's front.
- **Casey, 2026-09-14, three yeses:** the run's 290 valid-email leads went to
  `approved_hold` at 12:06 (enrichment spend approved, about $50 estimated), email
  finding started on the other 990 leads at 12:06, and the recovery lane now
  re-scores its own verified leads.
- **The lane re-scores verified leads by itself** (live 2026-09-14, orchestrator
  `737bcd2`, automator `807acac`). Each hourly `recovery-lane` run picks
  `needs_contact` leads whose email verified `valid` while their v2 score still has
  contact = 0 and `leads.may_enter_hold` refuses them. It runs `rescore-v2.py
  --stage assemble` on those (free, no model call), then
  `promote-verified-to-hold.ts --no-sweep`, and logs `bloodhound_rescore` with
  `leads` and `parked`. This closes the 09-14 gap where the lane verified 40 good
  emails in a day and parked 6. Assemble now skips a lead that was classified before
  but has no cached verdict, where it used to write "outside" over the real
  category. So the same leads returning every hour with 0 parked means the verdict
  cache went stale (prompt or model changed). `--stage classify` on those ids fixes
  it, and that stage spends OpenRouter.
- **Casey, 2026-09-15:** the 990 run's 423 valid-email leads went to
  `approved_hold` at 02:59 UTC (enrichment spend approved, about $72 estimated).
  Leads verified outside the lane, like these, still need the re-score by hand.
- **RESOLVED 2026-09-15: Casey added $300 of OpenRouter credit** (balance $299.81 at
  14:34 UTC). The 14:34 batch was the first to run with the credit in place: 0
  failures after 10 minutes and $0.33 spent. The 13:07 batch still failed 499 of
  499, because its credit probe errored, the gate let it through, and it ran before
  the top-up. One key (`OPENROUTER_API_KEY`, no per-key limit) feeds every repo, so
  the credit reaches enrichment. History of the outage follows.
- **Was BLOCKED from 2026-09-14 ~22:10 UTC: the OpenRouter account was empty.** Read
  from `GET /api/v1/credits`: $1,310 bought, $1,310.19 used. Enrichment has failed
  every lead since 22:26, yet `chain.log` records each batch as `exit=0 done=0
  failed=88` (98 later). The failing retries also run the YouTube key pool to its
  daily quota. The backlog is about 590 leads (the chain's pool of 167 plus the 423),
  roughly $95 at an estimated 16 to 17 cents a lead. **Adding credits is Casey's
  call. The chain picks the failed leads back up by itself once credits land.**
  **Update 2026-09-15 (debrief): the chain no longer grinds while the account is
  empty.** By 07:06 UTC it had launched nine doomed batches over nine hours,
  1,635 lead attempts, and finished off all 66 YouTube keys, because each lead
  pays for its YouTube harvest and its Decodo transcripts before dying at stage 4
  on the 402. It had a preflight gate for Supadata/Decodo and one for the YouTube
  pool, and none for the third paid dependency. Orchestrator `78b1284` adds
  `openrouter_ok()` to `scripts/backfill/chain.sh`: it probes the credits endpoint
  before every batch and waits below `BACKFILL_MIN_OPENROUTER_USD` (default $1).
  It fails open, so only OpenRouter itself saying the balance is low stops it. The
  same commit gives the hourly check-in a `backfill_chain_stalled` observation,
  because twelve check-ins ran through the outage printing `healthy` (nothing
  watched the chain at all). **Nothing about the remedy changed: credits are still
  Casey's call, and the backlog is still about 642 leads.** What changed is that
  waiting for him now costs nothing. Full detail:
  `brain/lead-gen/runs/lead-run-2026-09-15.html`.
- **Never, for this work:** email anyone, run `npm run send`, release the hold
  pool, touch `automator/config/email-pause.json`, lift the discovery pause, score
  the "Other" niche (41,000+ more 10k+ channels, a separate decision), write to
  Notion, or work do_not_contact or bounced leads.

## PAUSED as of 2026-09-08: we are not looking for new channels

**Casey, 2026-09-08: "Stop the process of the outreach orchestrator looking for
new channels. We're just doing enrichment on the ones that we have and putting
all of our resources into that. Discovery is hereby paused until further
notice."** He also asked for **no notifications about it** from any agent until
he says to turn it back on.

The off switch is `logs/discovery-paused.flag` in this repo, plus disabled
systemd units. Nothing was deleted.

**Off (stopped AND `systemctl disable`d):** `graph-sweep.service`,
`graph-sweep-refill.timer`, `video-graph-sweep.service`,
`video-graph-sweep-refill.timer`, `peer-sweep.service`,
`peer-sweep-refill.timer`, `autopilot-campaign.service`. `comment-sweep-daily.timer`
was already off from 08-20.

**Still on, deliberately — this is where the resources went:**
`backfill-chain.service` (enrichment), `recovery-lane.timer` (Bloodhound
needs_contact → approved_hold), `apify-endspec.timer`, `dnc-sync.timer`,
`autopilot-checkin.timer`, `autopilot-debrief.timer`, and manual `npm run send`.

**The flag is belt-and-braces, because this pipeline has a long history of lanes
resurrecting themselves.** It is read by:
- `discoveryPausedReason()` in `youtube-lead-finder-v1/src/lib/run-gate.ts`, wired
  into all six sweep scripts, so a hand-started sweep exits RESUMABLE instead of
  walking seeds. It is deliberately separate from `haltReason()`: a halt means
  something is broken, gets reported as a breach, and the check-in can auto-clear
  it. This is a standing instruction and nothing clears it but Casey.
- `campaign-loop.sh`, so a restarted campaign unit exits without a pass.
- `checkin.ts`, which skips every sweep check, drops discovery anomalies and
  refuses to fire the keyword-harvest backstop — otherwise it would page a paid
  fix-agent every hour to re-enable exactly what Casey turned off.
- The check-in and debrief agent prompts, and the Hermes side (below).

**Hermes is paused too, on the same instruction.** Its three lead-gen cron jobs
are `hermes cron pause`d, not deleted: `7f83cf90222c` (refresh video seeds +
restart sweep), `ea79cb32e046` (weekly discovery yield report), `76ced4a203e6`
(12-hourly lead-gen continuous improvement, which had standing permission to
scale discovery methods). The pause is also written into Hermes' own
`~/.hermes/memories/MEMORY.md` and the top of its
`youtube-lead-gen-pipeline` skill, so a fresh Hermes session reads it before it
diagnoses anything.

**Do not read a stopped sweep, a stale sweep state file, a dry term pool or a day
of zero new channels as an incident.** That is the intended state now.

**To resume (Casey's word only):** `rm logs/discovery-paused.flag`, then
`sudo systemctl enable --now graph-sweep-refill.timer video-graph-sweep-refill.timer
autopilot-campaign.service` (add `peer-sweep-refill.timer` if that lane is wanted
back — its book drained 09-08), then `hermes cron resume <id>` for the three jobs.

**Everything under "Discovery lane priority" below is frozen, not deleted.** It
is the state to return to.

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

> **Numbers below are from 2026-09-02 and are stale. Live at 2026-09-25T07:30Z:
> `needs_contact` **4,236**, `approved_hold` **6,860** of which **6,649** are
> `ready_data_scraped` and **6,852 carry a bundle (99.9%)**, and **the loading door is
> OPEN**: 47 emails went to SmartLead on 09-23, **55 on 09-24 (a record)** and 10 on
> 09-25. **But `npm run send` can no longer fire any of them** — its selector reads
> `review_status='approved'` only and that lane is drained (1,827 leads, all sent). The
> shelf sits at `approved_hold`, which the selector deliberately does not read, so every
> send now has to be hand-driven from the email repo by lead id. Widening the selector is
> Casey's call alone. See the 09-25 change-log entry.**
>
> **Older reading, 2026-09-22T07:00Z:
> `needs_contact` 4,243 and now FLAT, `approved_hold` 6,853 of which 6,586 already
> carry an enrichment bundle (96%) — the enrichment backlog is finished, not
> "nearly clear". The 09-02 reasoning about collect throughput being the
> bottleneck no longer holds: as of 2026-09-22 the collect BOOK is the
> bottleneck. 3,016 of its 3,347 leads have already been worked and emptied and
> only 331 have never been touched, so widening the batch buys nothing. See the
> 09-22 change-log entry.**

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

- 2026-09-26 (debrief): **107 EMAILS, NEARLY DOUBLE THE RECORD, AND 97 OF THEM CAME FROM SIEGE, NOT
  FROM THIS REPO.** Ten at 00:20 PT from the session-start send, then **97 between 09:25 and 10:22 PT
  from one LIVE Siege run**: board of **4,737 people in 3 tiers**, **513 DNC blocks honoured**, **22
  live mailboxes of 37** at 15/day for **185 offered slots**, and it took **100** because the ramp cap
  on sending day 3 is 100. Wrote 100, **sent 97, skipped 1, failed 0**, and paid **$0** — all six live
  offers are template writers ("No model calls, $0") drawing on bundles paid for weeks ago.
  **THE VOLUME CEILING IS NOW OFFER VARIETY, NOT LEADS: 10 of 16 Siege offers cannot run**, each for a
  small named reason it prints at the top of every run (no Notion subject line, no batch-writer script,
  0 of the 2 required follow-up bodies, `email_type` missing from `leads.vocab_outreach_email_type`, a
  Notion Working Status left on Paused, one writer importing a dead `/Users/caseybrown/...` Mac path).
  One is blocked on purpose: the 80% time offer's gate says the breakdown video does not exist yet.
  Unblocking offers is what lets one board absorb more volume without emailing anybody twice.
  **ENRICHMENT IS FINISHED.** The chain launched **0 batches** this cycle, its pool is **3 leads (2
  permanently excluded)**, and it logged one line all day: a transcript-provider limit at 12:40:34Z that
  cleared **19 seconds later** on its own. Casey's 09-08 order to put every resource into the leads we
  already have is complete at **99.9% bundled**, leaving a **6,570-lead shelf**, about 60 days of
  sending at this rate. **Do not read the idle chain as a fault.**
  **NEW FINDING, WHERE OPENROUTER IS ACTUALLY GOING:** spend held flat at **$2.52/day** on a cycle when
  enrichment did nothing and the finder logged zero calls, so the old rule ("the burn is enrichment") no
  longer explains it. `automator/scripts/smartlead-auto-reply.py` ran **683 times in 24h, always in dry
  run, and 401 of those runs paid `openrouter:deepseek/deepseek-v3.2` to classify the SAME address**
  (`tara@rehab-hq.com`): dry run never sends, so the reply never leaves the queue, so the next run
  re-buys the same verdict. Fix is a result held against the reply id, or a slower timer while in dry
  run. **It lives outside the five repos the autopilot may edit**, so it is recorded here, not shipped.
  Runway is **77 days on $194.99**, so this is waste, not a threat.
  **THE RECOVERY LANE PARKED NOBODY FOR A SECOND DAY:** 4 passes, **600 readings → 26 contact points, 6
  of them emails, 20 leads, 5 leads off the book** (3,326 → 3,321), hit rates **4.7/2.7/2.0/4.0%**,
  **100% re-walks on every pass**, website resolution **98-99%**, **Brave refused nothing**. Its verify
  half is genuinely drained rather than gapped: of 913 `needs_contact` leads holding 1,215 email points,
  **only 4 have never been checked** (542 carry a ZeroBounce verdict, the rest are held by the ownership
  gate), and `stranded` held at **3** for the 13th day. **The alarm saying all this is one day from
  going quiet** — its long baseline fell **27.7 → 17.3 → 8.3 → 7.3%** across four firings and today's
  drop read 45.5% against a 40% threshold. Whether the hourly collect pass keeps its slot is a judgement
  call for Casey: it costs no money and is not broken, but 1,200 readings over two days moved 5 leads,
  and the 4,236-lead pool needs a method it does not have rather than another lap of the ones it does.
  **SHIPPED (`5eb5581`): THE METRICS FILE COULD NOT SEE THE ONLY LANE STILL PRODUCING LEADS.**
  `parked_today` is the parked-pool delta, which the Siege send path also moves, so its **0** was
  ambiguous on a day the lane's yield was down 98%. New `recovery_lane` block: contact points and email
  addresses this cycle **against the prior 7 days** (26 and 6, versus **3,672 and 405**), book depth,
  `stranded`, lap number. The query (`collectYieldBetween`) sits next to the two selectors it derives
  from, so widening one cannot leave the number describing a pool that no longer exists. Same commit:
  **an empty send batch now reports 0 sent / 0 failed** instead of `null`, because both session-start
  sends since the `approved` lane drained printed `sent=? failed=?`, which is the shape of a send that
  crashed before its tally. *Verified:* tsc clean, **86 tests pass** (1 new), both new queries run live
  against Postgres. Full detail: `brain/lead-gen/runs/lead-run-2026-09-26.html`.
- 2026-09-25 (debrief): **THE BIGGEST SEND DAY ON RECORD, 55 EMAILS, AND IT EMPTIED THE ONLY LANE
  `npm run send` CAN REACH.** 55 loaded into SmartLead (47 on 09-23, 40 on 09-10), and **yesterday's
  `ce5abf1` proved itself in 22 hours**: the 07:20 send picked exactly the ten stranded `failed` leads,
  resumed all ten at push off their own written subject+body, and pushed **10 of 10 in 12.5s**.
  **`npm run send` IS NOW STRUCTURALLY A NO-OP. Its selector reads `review_status='approved'` only and
  that lane holds 1,827 leads ALL at `sent_to_smartlead`** (0 ready, 0 drafted, 0 failed) because this
  morning took the last ten. The **6,649** finished emails are at `approved_hold`, which the selector
  deliberately does not read. **94 of the last 112 emails were hand-driven from the email repo by lead
  id**, bypassing the selector: 47 at 19:00-20:00Z this cycle (37 `approved_hold` + 10 `approved`) plus
  47 on 09-23. **Opening the selector to `approved_hold` converts a deliberate hold gate into an
  automatic one and is CASEY'S CALL ALONE — no agent may widen it.** Side effect: the unexplained
  session-start send now finds nothing, so it stops being a hazard by itself; the trigger is still
  unfound.
  **SHIPPED (`1340a4b`): THE GROUNDED-METRICS FILE HAD NO FIELD FOR EMAILS SENT.** Parked counts, five
  sweep health blocks, campaign counters, two spend blocks, a key probe, and nothing for the one thing
  the pipeline exists to do. Harmless through thirteen days of zeroes; from 09-23 it meant the 09-24
  report quoted "47 emails" for a day whose own log read `send_attempted=18`, and today's 55 came out of
  a hand-typed SQL query. `sent_today` counts pushes from `outreach_processed_at` (**not** the
  backfill-polluted `last_contacted_at`), tallied by lane, **beside** what this repo's log recorded
  rather than reconciled with it — the gap is the signal and it says 47 of 55 ran outside the loop that
  owns the money path. `shelf` counts ready/bundled/total (hand-quoted in every report since 09-16):
  **6,649 ready, 6,852 bundled of 6,860 (99.9%)**, so enrichment has eight leads of work left in that
  pool. Both fail soft. Same commit: **`tallyCount()`** reads a parsed tally as a complete statement (an
  omitted status happened zero times; only a MISSING tally is unknown), because this morning's flawless
  send printed `failed=?` and logged `send_failed: null`, identical to an unmeasured send, one day after
  that exact confusion cost ten emails. Bigger consequence: run-send's more-failed-than-sent warning
  tested `sent !== null`, so **a batch where EVERY lead failed was the one case that printed no
  warning.** *Verified:* tsc clean, **91/91** tests (4 new) + 10 new selftest cases, both queries run
  live against Postgres matching hand SQL exactly, `debrief-data.ts` re-run end to end exit 0.
  **THE UNSCHEDULED /tmp ENRICHMENT RUN FINISHED AND EXITED** — yesterday's risk did not land. **122 of
  its 132 parked with bundles**, 6 invalid, 1 failed, its own retries clearing 10 of 11. The chain did
  **2 batches of 1 lead** beside it and idled, correctly, because the pool is 99.9% bundled.
  **RECOVERY LANE THINNER AGAIN:** 4 passes, 600 slots, book 3,331 → **3,326** (**5 leads**, ~120
  readings each, against 13 on 09-24 and 62 on 09-20), **43 contact points**, hit rates **4.7, 3.3, 1.3,
  4.7%** against a 42% median. **Brave was NOT the cause and for the first time in a week no pass said it
  was** (0 `402` refusals at pass open, 2-6 of 150 leads unresolved). All 3
  `bloodhound_collect_yield_degraded` firings hit 3 distinct passes, so the 09-21 per-pass keying and the
  09-22 attribution both hold. **WATCH, DO NOT FIX: that alarm's 8-day memory of normal has eroded 42% →
  33 → 30 → 28%** as degraded passes age into it, so within days it will go quiet on a book problem that
  is still there. Verify tested 5 addresses in 3 passes and was handed nothing in the other 3; those 5
  are the whole **+2** (6,858 → **6,860**). `needs_contact` **4,236**. 0 fatal signatures, 0 halts,
  $0.00 Anthropic, 15/66 keys for the twelfth morning, Apify resting until 30 Sep.
  **OPENROUTER RUNWAY WENT 20 DAYS BACK TO 81** ($2.44/day, $197.54 left) because the run that was
  spending finished. Both readings were true; runway tracks whether anything is enriching. **Composing
  an email is still unmeasured and this cycle could not answer it** (most pushes resumed from drafts
  already written). **The lesson: a measurement nobody needs while the answer is zero is exactly the one
  that goes missing on the day the answer changes.** Full detail:
  `brain/lead-gen/runs/lead-run-2026-09-25.html`.

- 2026-09-24 (debrief): **THE EMAIL PAUSE IS LIFTED AND EMAILS ARE GOING OUT AGAIN. 47 LOADED INTO
  SMARTLEAD ON 09-23, THE FIRST SINCE 09-10.** Casey lifted it on 09-23 (`automator/config/email-pause.json`
  now reads `paused: false`). **The lift is CONDITIONAL and the condition is enforced in code:**
  `warmup_wait.min_day` in `automator/config/siege.json` holds a floor at **warmup day 12**, read per
  mailbox from `state/inbox-warmup.json`. A mailbox under day 12, one whose warmup subscription is not
  active, and one missing from the snapshot are each refused. The fleet is **58 mailboxes on 20 fresh
  domains**; the **18 bought 09-19 reach day 12 on 30 Sep and may first send 1 Oct**. The 47 were driven
  **by hand from the email repo, not `npm run send`** (nothing in the orchestrator log records them),
  31 from `approved_hold` and 16 from `approved`.
  **THE 09-20 PREDICTION CAME TRUE: the session-start `npm run send` is no longer harmless.** It fired
  at 07:20 today and actually sent, for the first time. Nobody has found what triggers it. **Anyone
  opening an agent session in this repo now sends real email.**
  **SHIPPED (`ce5abf1`): A NETWORK BLIP ON THE LAST STEP DELETED TEN FINISHED EMAILS FROM THE PIPELINE.**
  That 07:20 send composed 18, pushed 8, and wrote 10 as `failed`: **nine lost both attempts to
  `fetch failed`** inside one two-minute wobble (four pushes landed in <2.5s, four more on the 60s
  retry), one correctly refused by the placeholder guard. All ten hold a written subject and body, a
  bundle and a verified address, and **no query in this repo would ever have looked at them again** —
  `failed` is in neither `APPROVED_FIRE_READY` nor the tick's `APPROVED_PREP_DONE`, ticks have been
  manual-only since 06-01, and **nothing alarms on a send at all**. The approved lane read **0 ready,
  0 drafted, 10 failed**, which is also exactly what a genuinely finished lane reads.
  `fireResumeStage()` now backs both the bulk query and the per-id check: it widens to `failed` and
  then qualifies each lead on its OWN fields — written subject+body resumes at push (same as
  `email_drafted`), a bundle alone resumes at compose (same as `ready_data_scraped`), **neither is
  refused** so a send can never silently become a prep run (the 2026-07-17 decoupling). It mirrors
  `effectiveStatus()` in `youtube-email-outreach-v1/src/cli/outreach.ts`, which already knew how to
  resume a failed lead while this repo would never hand it one; **if that function's reading changes,
  change this one with it.** Same commit reads the child's `=== Final tally ===` into `send_sent` /
  `send_failed` in the JSONL and warns when failures outnumber sends, because the child exits 0 either
  way and `send_attempted=18 send_exit=0` was the entire record of a batch that lost ten emails.
  *Verified:* tsc clean, **87/87** tests (11 new), and **live: `npm run send:dry` returned 0 before the
  change and exactly the ten stranded ids after** — the fix is retroactive, not just preventive.
  **DELIBERATELY NOT SHIPPED: more push retries.** A `fetch failed` can also be a response lost after
  SmartLead accepted the lead, SmartLead's de-dup behaviour on a re-POST is not verified here, and with
  the selector fixed a failure simply goes out on the next send. Confirm the de-dup before raising it.
  **ENRICHMENT RESTARTED FROM A PROCESS NOBODY SCHEDULED.** The VPS chain did **5 leads in 3 batches**
  and idled after each (its pool is 40, 39 permanently excluded). Beside it, a run started **21:28Z on
  09-23** is working a **132-lead list from a chat session's `/tmp` scratchpad** at ~11 leads/hour
  (`outreach.ts --lead-ids-file .../scratchpad/backfill-ids.txt --stop-after enrich`): **115 parked, 11
  failed, 6 invalid.** It is the right work and it explains the money, but **no systemd unit owns it and
  nothing restarts it if it dies** — and the chain's log will go on saying "idling" while it does.
  Shelf **6,586 → 6,675 ready to write**; **+5 parked** (6,853 → **6,858**), all five from the recovery
  lane's verify half plus one re-score.
  **OPENROUTER RUNWAY WENT 191 DAYS → 20.** $210.16 → **$199.98**, $10.18 in a day against $1.10.
  Nothing is wrong: 119 enrichments at ~9¢ each, matching the 10¢/lead measured 09-16. **But composing
  an email is a separate model call and has never been measured, and the shelf is 6,675 emails. Get
  that number from one send with the per-task cost log before any large batch.**
  **RECOVERY LANE UNCHANGED:** 4 passes, 600 slots, book 3,344 → **3,331** (13 leads), **73 contact
  points**, hit rates **7, 9, 5, 3%** against a 42% median, `stranded` held at 3. All four
  `bloodhound_collect_yield_degraded` firings said `book_rewalk`; resolution ran 96-99% so none blamed
  Brave. **Yesterday's `0874d8a` held: walking-in-place went 13 → 0.** 0 fatal signatures, 0 halts,
  $0.00 Anthropic, 15/66 keys for the eleventh morning, Apify still resting until 30 Sep.
  **The lesson: a status that describes what happened is not the same as a status something acts on,
  and the gap between those two is where work goes to die quietly.** Full detail:
  `brain/lead-gen/runs/lead-run-2026-09-24.html`.

- 2026-09-23 (debrief): **THE FIRST DAY THE PIPELINE PRODUCED NOTHING, AND NOTHING WAS BROKEN.**
  **+0 parked** (6,853 → **6,853**), the first zero on record. Every pool ended exactly the size it
  started: `needs_contact` **4,243 flat**, shelf **6,586 flat** (all three queried against Postgres,
  not read off a log). **0 fatal signatures, 0 halts, 0 quota stops, $0.00 Anthropic**, OpenRouter
  $1.10/day with $210.16 left. Every timer fired on schedule and found nothing in front of it.
  **THE RECOVERY LANE SPENT 600 LEAD SLOTS TO MOVE 4 LEADS OUT OF ITS BOOK** (3,348 → 3,344), which
  is 150 readings per lead gained. It is on **lap 6**, and a lap is a second reading: a lead that
  gives up a phone or a social handle but no email **stays in the book by definition**, so the next
  lap re-reads it and gets the same answer. Hit rates **0, 3, 4, 4%** against a 32-pass median of
  45%; **29 contact points** all cycle against 47 on 09-22 and 1,063 on 09-20. `stranded` held at
  **3**, so no gap reopened. **Verify tested 6 addresses in 24h** and four of its eight passes were
  handed nothing at all — that is a SYMPTOM, not the problem: verify can only test what collect
  finds, so fixing verify changes nothing. **ENRICHMENT RAN 0 BATCHES** because its real queue is
  one lead (pool 70, 69 permanently excluded); **do not read that as a collapse from 09-16's 410.**
  **BRAVE DID NOT CAUSE THIS.** Resolution ran **79, 98, 99, 98%** across the four passes and yield
  collapsed anyway: on the worst pass **0 of the 119 leads with a working website produced a single
  contact point**. **YESTERDAY'S `9dc4eb6` PROVED ITSELF WITHIN A DAY:** all **4**
  `bloodhound_collect_yield_degraded` firings attributed to `book_rewalk` and **none blamed Brave**,
  against three wrong spend recommendations the day before. **SHIPPED (`0874d8a`): A THIRD ALARM
  FIRED 13 IDENTICAL TIMES AND BLAMED A FAULT ITS OWN STATE FILE REFUTED.**
  `bloodhound_collect_walking_in_place` reported ONE window **13 times** between 08:11 and 20:11
  (600 slots / 305 distinct / 0.508, byte-identical) and asserted *"the cursor is failing to
  advance"* while the lane state read `collectRewinds: 0`, `collectSearchDeadRewinds: 0` and a
  cursor that had moved. The real cause was the lap boundary and **it cleared itself** two passes
  later, back to a clean 1.00, with nobody touching anything. Two faults in one alarm: it was left
  out of the 09-21 per-pass keying fix (`da4b849`), and it named a remedy without testing whether
  that remedy was the constraint — **fourth outing of that class** (09-12, 09-13, 09-22). It is now
  keyed on the window it judges, and `collectRewalkCause()` reads the cause off
  `logs/bloodhound-lane-state.json`, picking between `cursor_pinned` / `rewind_loop` / `lap_rewalk`
  / `unexplained` and recording the readings behind the choice in the observation. A **rise** in a
  rewind counter counts, not a standing one, because the counters are lifetime totals and one
  historical rewind would otherwise read as a live loop forever (the same "always true, so not a
  test" shape as the Brave line). *Verified:* tsc clean, **70/70** tests (7 new, incl. a
  genuinely-pinned-cursor case that must STILL alarm so the fix cannot silence the fault it came
  from, and a standing-vs-rising counter case), run against the real lane state and the real 09-22
  window (now reads `lap_rewalk`), check-in run end to end on live logs, exited `healthy`.
  **#1 AND #2 LEVERS ARE BOTH CASEY'S CALL AND NEITHER IS CODE: decide what happens to the 6,586
  finished leads (14 days behind a shut door), and decide the discovery pause — about half a day of
  unread leads remains, after which zero days are the NORMAL state, not an anomaly.** Then Apify
  rolls 30 Sep (62 parks at $0.099 last run). **Brave ranks 4th: it buys attempts at the 620 book
  leads with no site on file, most already read once.** The session-start `npm run send` fired again
  at **18 leads, 0 sent** (14 on 09-20, 15 on 09-21, 18 on 09-22 and again today), and 09-17/18/19
  remain unwritten. **The lesson: a pipeline with nothing left to do and a broken one look identical
  from outside. The only numbers that told them apart were the size of the book and how much of it
  had been read before, and nobody alarms on those.** Full detail:
  `brain/lead-gen/runs/lead-run-2026-09-23.html`.

- 2026-09-22 (debrief): **THE RECOVERY LANE HAS READ ITS WHOLE BOOK AND STARTED IT AGAIN, AND THE
  ALARM BLAMED BRAVE FOR IT.** **+7 parked** (6,846 → **6,853**), the weakest ordinary day of the
  pause. Lap 5 closed 06:01Z on 09-21; lap 6 opened at the top of the book and **every lead in the
  last two passes had been read before (150 of 150, twice over)**. Hit rate **8, 5, 1%**; the lane
  collected **47 contact points against 1,063 the day before**, 15 of them emails. **The book is
  3,347 leads of which 3,016 already hold a non-email contact point** — worked on an earlier lap
  and already emptied — **and only 331 have never yielded anything**, about half a day of walking.
  The 09-13 widening's argument ("the expensive half is already paid for") was right for the FIRST
  walk and says nothing about the second. **WEBSITE RESOLUTION ACTUALLY RECOVERED THIS CYCLE**
  (failures **7, 21, 21%** against 09-21's 61-78%, because the top of the book has sites stored
  from an earlier lap and `storedWebsite()` reads them back free) **and yield collapsed anyway:
  1 of the 119 leads with a working site produced anything** on the final pass. **Yet all three
  `bloodhound_collect_yield_degraded` firings told Casey to raise the Brave cap.** The only test
  behind that sentence was whether `Brave Search API key` appeared in the log tail, and one key has
  sat at its $5 cap since early September, so that line prints at the top of EVERY pass. A test
  that is always true is not a test. **Third outing of one bug class** (09-12's 24 firings blaming
  Brave for a drained book; 09-13's `collectBookDepth` keeping a private copy of a predicate it was
  meant to track). The 09-12 suppressor could not fire: it needs the day's passes to cover the book
  more than once, and a day covers **0.18** of 3,347. The guard was written against the instance,
  not the class. **SHIPPED (`9dc4eb6`): `collectPassAttribution()`** reads the judged pass's OWN
  no-site rate and its re-read share (whole-log, so it is a lap-scale reading and not a restatement
  of `collectRewalk`, which sat correctly silent at 1.36× while this read 100%). The alarm now
  picks between `site_resolution` / `book_rewalk` / `unexplained`, records the readings in the
  observation, and stops naming a spend when spending would not help. *Verified:* tsc clean,
  **69/69** tests (6 new, incl. a real-outage case that must STILL alarm so the fix cannot silence
  the alarm it came from), check-in run end to end on live logs, exited `healthy`.
  **YESTERDAY'S `da4b849` PROVED ITSELF THE NEXT DAY:** the 02:11Z firing used the 32-pass baseline
  (45%) because the short 8-pass one had already sagged to **37%**, and per-pass keying held
  (3 alarms, 3 distinct passes, no hourly repeats against 7 + 9 the day before).
  **CORRECT THE 09-21 ENTRY BELOW: "expect ~19/day, not 95, until Brave is funded" was wrong in its
  reasoning.** The lane fell to 7 and funding Brave would not have prevented it. Brave still
  matters but is smaller than it looked: of the 3,347 book leads, **620 need a paid search** for a
  website and 2,727 already have one stored or linked. Rank it BELOW the book problem and the shelf
  decision. **#1 LEVER IS CASEY'S CALL, AND NO CODE CHANGE TOUCHES IT: lift the discovery pause,
  fund Apify when its billing cycle rolls 30 Sep, or accept single-digit days.** Enrichment took
  15 leads in 4 batches with 0 failures and idled after every one; shelf **6,586 ready to write**
  (96%). The session-start `npm run send` fired again at **18 leads, 0 sent** (14 on 09-20, 15 on
  09-21 — the number is climbing), and 09-17/18/19 remain unwritten. Full detail:
  `brain/lead-gen/runs/lead-run-2026-09-22.html`.

- 2026-09-21 (debrief): **THE BEST DAY OF THE PAUSE (+95 PARKED, 6,751 → 6,846) IS ONE BATCH
  OF MONEY, AND IT HID THE DAILY LANE FALLING BY TWO THIRDS.** **62 of the 95 came from a
  single Apify batch** — yesterday's batch-sizing fix (`30f0bedce`) woke the lane after 14
  days and paid for itself in 52 minutes: 87 channels, 78 emails found, 80 ZeroBounce checks,
  **62 parked at $0.099 a recovered lead** (half the $0.20 self-halt ceiling; the 09-20
  prediction was ~51). **It is now back at its $10 reserve with $0.0054 spendable and CANNOT
  run again until the Apify billing cycle rolls 30 Sep.** Enrichment took the 62 as inflow 27
  minutes later and finished them by 12:32Z: **86 leads, 4 batches, 0 failures**, shelf
  6,484 → **6,570 ready to write (96%)**. **BLOODHOUND FELL 55 → 19 PARKS** and the batch
  masked it: verify tested **43 leads over 3 passes** against yesterday's 103 over 4, and
  **three more verify passes were handed nothing at all** (`no_pending_email_points` at
  08:00, 15:01, 23:01Z). That is not a verify problem — the collect half's hit rate went
  **45, 44, 26, 30%** across four passes against a lane normal near 46%. **BRAVE CROSSED BOTH
  ALARM THRESHOLDS**: website resolution failed **61, 60, 74, 78%**, every pass opening on
  `All 2 Brave Search API key(s) refused: 402`. `bloodhound_site_resolution_collapsed` fired
  from 23:11Z (70% bar) and `bloodhound_collect_yield_degraded` on the 26% pass (48% fall
  against a 50% baseline). **Nothing in the alarms needs fixing for that — the remedy is a
  spend call** ($5 per 1,000 searches, ~150 a pass; key `_1` funded 09-13, key `_2` still at
  its $5 cap) **and it now has a price on it: expect ~19/day, not 95, until Brave is funded.**
  Lap 5 of the collect book CLOSED at 06:01Z (104-lead short batch), lap 6 open, book 3,360,
  stranded 3. **SHIPPED (`da4b849`): THE ALARM BUILT TO CATCH A SLIDE WAS BEING SILENCED BY
  THE SLIDE.** The 09-10 relative alarm baselines on the median of the 8 passes behind the
  newest, so a slide walks into its own baseline: simulated on the real collect log, a lane
  pinned at 28% (≈60% of normal) reads **37% fall → 24% by pass 3 → 0% by pass 5**, about
  thirty hours from degraded to invisible. It was already happening (7 firings on the 26%
  pass, then silence for the 30% pass behind it). The baseline is now the **higher of the
  short-window median and a 32-pass (≈8-day) median** — a cliff still fires instantly, a slow
  slide cannot erase the memory of normal, and a genuinely changed regime still ages out by
  itself. Same commit keys both lane alarms on the pass they judge, ending the hourly
  re-report (**9 + 7 firings about exactly 2 passes** this cycle; same class as the 09-16
  `finder_hard_wall_benign` noise, one layer up). *Verified:* tsc clean, **63/63** tests (7
  new, incl. the erosion regression and a settled-regime case that must NOT alarm), check-in
  run twice end to end on live logs (fired once, then silent, exited `healthy`).
  **STILL OPEN:** the 09-17/18/19 debriefs remain unwritten (the new `missing_debriefs` field
  named all three correctly — the fix works; today's agent authenticated fine, so the fault
  was the expired login), and the unexplained session-start `npm run send` fired again at
  **15 leads, 0 sent** (confirmed in Postgres: nothing reached `sent_to_smartlead` all cycle).
  Full detail: `brain/lead-gen/runs/lead-run-2026-09-21.html`.

- 2026-09-20 (debrief): **THE ENRICHMENT BACKLOG IS FINISHED. 6,484 OF THE 6,751 PARKED
  LEADS (96%) ARE RESEARCHED AND READY TO WRITE.** The chain now works **2h42m out of every
  24h** — four batches, 64 leads, 0 failures, `no pending inflow — idling` after every one.
  Its pool reads 84 of which **69 are permanently excluded**, so the real queue is about
  fifteen leads. **Do not read "64 enriched" as a collapse from 09-16's 410:** same chain,
  same speed, no backlog. The only things that create work for it now are new arrivals (the
  recovery lane, Apify, or lifting the discovery pause). **The shelf is the whole story and
  it is waiting on a decision, not on work** — it grows ~64/day against a loading door that
  has been shut eleven days (`automator/config/email-pause.json`, fleet-wide spam placement
  since 09-10; the 07:20 send attempted 14 and sent 0, refused before composing).
  **+64 parked** (6,687 → **6,751**), the best ordinary day of the pause and 2.5× the 25/day
  of the preceding week; **55 of it the recovery lane**, whose verify half roughly doubled
  (8/32/38/25 addresses a pass against 8–19 earlier in the week, flip rate ~53%). No repo
  shipped code between 09-16 and now, so that is the collect cursor reaching a better slice
  of its book — watch it rather than explain it. **BRAVE IS CAPPING OUT AND BOTH ALARMS ARE
  CORRECTLY SILENT:** website resolution failures went **1–4% → 42% across five collect
  passes**, every one opening on `All 2 Brave Search API key(s) refused: 402`. The collapse
  alarm needs 70% and the yield alarm needs a 40% yield fall, and yield actually held (99 and
  114 of 150) because the other methods carry it. **Nothing was changed in code for this — it
  is a spend decision** ($5 per 1,000 searches, ~150 a pass; key `_1` got $50 on 09-13, key
  `_2` is still capped at $5). **THREE DEBRIEFS WERE NEVER WRITTEN AND THE TIMER REPORTED
  SUCCESS:** 09-17, 09-18 and 09-19 each returned in ~130ms with `Failed to authenticate:
  OAuth session expired and could not be refreshed`; `debrief.sh` ends in an unconditional
  `exit 0`, so systemd logged three clean runs. Fixed (`ea28451`): the script now checks its
  own work, writes `logs/autopilot-debrief-missing-<date>.flag` plus an
  `autopilot_debrief_failed` observation, says so loudly, and `debrief-data.ts` emits
  **`missing_debriefs`** for the last 7 cycles so the next working agent is handed the gap.
  A failed login still needs a human re-login on the VPS; no Anthropic API key may be used
  instead. **THE APIFY LANE HAD BEEN RESTING ON MONEY IT COULD SPEND FOR 14 DAYS** — twelve
  log lines a day since 09-06 reading `resting: $16.1132 left, $10 reserved, batch of 100
  needs $7.02`, arithmetic that could never pass before the billing cycle rolls on 30 Sep.
  The $10 reserve was right; the fixed batch of 100 was the bug. Fixed (email repo
  `30f0bedce`): the loop sizes its batch to the spendable balance, floored at 25 so the
  price-ceiling strike logic keeps an honest sample. On today's ledger that is **87 channels,
  ~51 expected recoveries**, without touching the reserve. **UNRESOLVED, WORTH KNOWING:
  something fires a live `npm run send` every time an agent opens this repo** — not a timer,
  not a cron; it runs inside the debrief unit's process tree the moment the agent starts, 14
  leads a day since 09-15, its output spliced into the agent's own prompt (the signature of a
  session-start hook), and **no hook exists in any settings file that could be read**. Harmless
  only because the pause refuses it. **If the email pause lifts, the next debrief agent sends
  14 leads at 07:20 without being asked.** Find the trigger before lifting the pause.

- 2026-09-16 (debrief): **THE TOP-UP WORKED AND ENRICHMENT IS NEARLY FINISHED. 410 LEADS
  THROUGH IN 17 HOURS WITH ZERO FAILURES, AT 10 CENTS A LEAD.** The 14:34Z batch settled at
  about 24 leads an hour and held it all night. **Correct three cost numbers in the ACTIVE
  section above:** measured against the OpenRouter account meter ($41.10 for the day ÷ 410
  leads) the real price is **$0.100 a lead**, not the 16 to 17 cents estimated on 09-15. So
  the remaining **278 leads cost about $28**, and the whole 603-lead backlog was going to be
  about **$60, not $97**. Balance $258.71. Do not sum the run log's own per-stage dollar
  markers ($56.55) — a bank's cost is printed twice, per stage and again in the export summary.
  **The output is a shelf of 6,192 leads at `approved_hold` + `ready_data_scraped`**: researched,
  bundled, one command from a written email, held on Casey's word and nothing else. The send
  path fires ~14/day because it only draws from the small `review_status = approved` lane
  (11 `ready_data_scraped` + 3 `email_drafted` = exactly the 14 pushed at 07:20Z). **That shelf
  is now the largest thing in the pipeline and it is waiting on a decision, not on work.**

  **Yesterday's credit gate held for five free hours and then lost a 500-lead batch to its own
  probe.** It waited correctly from 08:07Z on a definite `DRY -0.19`. At 13:07Z the probe
  errored, the fail-open rule returned OK, and 499 of 500 leads died after paying for their
  YouTube harvest and Decodo transcripts. Credits did not land until ~14:34Z. **Fail-open is
  right for ENTERING the wait and wrong for LEAVING it:** before the wait there is no evidence,
  so run; inside it you hold OpenRouter's own word that the balance is under the floor, and a
  probe you could not finish is not evidence against that word. Fixed in `d7c75bc` — only a
  confirmed balance resumes the chain; `OK probe-error`, `OK probe-http-*`, `OK probe-unparseable`
  and `OK nokey` keep waiting, which costs nothing because the leads never leave the pool.

  **THE RECOVERY LANE'S VERIFY HALF WAS JAMMED ON FOUR DEAD ADDRESSES AND HAD BEEN FOR WEEKS.**
  All six verify passes this cycle were handed the same four ids, and `VERIFIABLE_IDS_SQL` run by
  hand returned **those four and nothing else** — the whole queue was four immortal rows. Third
  instance of one bug class (08-24, 09-02, now): **the marks that say "already ruled on" are
  written per ROW, but ZeroBounce rules per ADDRESS.** A lead routinely holds the same address
  twice under two kinds, because two methods found it — the About-tab button writes
  `youtube_email`, the website scrape writes `business_email`. One row gets stamped, the twin
  stays blank forever, the lead re-selects every pass and buys another credit.
  `rec8xHAFcSVZNKs1N` has been re-buying the verdict on `info@shanesmithlaw.com` **since
  24 August**; three others were re-stamped at 07:00:36-38 this morning over yesterday's stamps,
  which is the direct proof a credit is spent every pass. Fixed in `d7c75bc` with an
  address-level exclusion. *Verified live:* 966 unruled email rows table-wide, **exactly 16 newly
  excluded**, all duplicates of an already-ruled address; a rolled-back transaction test covering
  fresh-selects / ruled-duplicate-stops / second-unruled-address-returns; 51/51 tests, tsc clean.
  **No new gap** — a lead whose every address is ruled on already satisfied neither selector,
  which is the intended retired state. **A drained queue and a jammed queue read identically from
  outside; the tell is the same ids in every pass.**

  **THE KEY-POOL QUESTION IS ANSWERED. STOP ASKING FOR THE 6-HOUR PROBE.** Ninth consecutive
  morning at **15 working / 50 exhausted / 1 blocked of 66**. The last nine days ran the
  experiment from the other side: 09-11 through 09-13 nothing of ours spent a single unit
  overnight, and this cycle we spent heavily (410 enrichment leads plus ~1,500 doomed attempts,
  every one paying a YouTube harvest). **The reading did not move by one key.** That kills both
  explanations: not our spending, which swung a hundredfold; and not a late refill, because 50
  keys carry ~500,000 units and the probe sits 20 minutes past the reset, a window in which the
  chain runs about eight leads. **The quota on those 50 projects was cut, and more keys from those
  accounts buy nothing.** Harmless while discovery is paused (enrichment runs on 1-unit calls);
  binding the moment it resumes (a keyword search costs 100). Settle which projects with
  `youtube-lead-finder-v1/scripts/audit-key-projects.sh` before Casey lifts the pause, not after.

  **Third fix, noise that would have outlived its cause:** the hourly check-in wrote
  `finder_hard_wall_benign` **24 times a day for eight days** about `session-20260908T152322Z.log`,
  a campaign log frozen since the pause. `recentSessionLogs()` took whatever sorted newest with no
  age test, while all three callers ask what is happening *now*. That pattern is carved out as
  benign before the paid fix-agent is reached, but **any other pattern in the same frozen file
  would page that agent hourly, forever, about a campaign that is not running.** Fixed in
  `d7c75bc`: logs untouched for `MAX_SESSION_LOG_AGE_HOURS` (48) are ignored, which never excludes
  a live campaign and self-heals when discovery resumes.

  Full detail: `brain/lead-gen/runs/lead-run-2026-09-16.html`.

- 2026-09-13 (Casey, in chat): **TAVILY IS OUT. BRAVE IS THE ONLY WEB SEARCH.** The email
  finder searched Tavily when a channel links no website, and Tavily's plan was capped (the
  432s in the pilot entry below). Casey's call: both are plain web search and Brave is
  cheaper ($5 per 1,000 searches against Tavily's $8), so drop Tavily and use Brave. The
  finder and the recovery lane now share `youtube-email-outreach-v1/src/search/brave.ts`,
  which retires a key once its plan limit is spent. **Brave headroom now pays for email
  finding too**, so a big finder run spends the same plan the recovery lane depends on.
  Casey also put $50 on key _1 today, which answers again. Key _2 is still stuck at its $5
  limit, and Brave's API never reports a balance.
  *Verified:* typecheck clean, 153/153 tests (3 new), and a live run on 5 pilot leads whose
  channels link no website and that had ended `no_email_found`: **all 5 now return an email
  candidate** (none checked by ZeroBounce). Two needed a fix first. Brave ranks contact-data
  broker pages (contactout.com, ninjaoutreach.com) first for "<name> email", those pages
  block scraping, and the finder gave up, so brokers are now on the finder's skip list.
  **Open risk, older than this change:** when search supplies the website, the finder takes
  the top result with no check that the creator owns it. "Grow with Betty" (an Ethiopian
  public-speaking trainer) came back as `linda@gardenbetty.com`, a stranger's gardening
  site, and ZeroBounce would pass that address. The recovery lane already has the right
  check (`websiteCandidateLooksOwned`) and the finder doesn't use it. Adding it before
  finding emails past the pilot is Casey's call.
  **Built twice, read this before merging v2:** a parallel session made the same swap on
  `feat/v2-score-gates` (`fe6d3752d`) minutes before this one landed on the live branch
  `recovery-retry-no-email` (`8979990fd`). A trial merge conflicts in 4 files
  (`src/search/brave.ts`, `tests/brave-search.test.ts`, `src/email/finder-llm.ts`,
  `src/bloodhound/db.ts`). Keep ONE Brave module when merging. The live one deletes
  `tavily.ts`, carries the broker skip list and ran live on 5 leads. The v2 one carries the
  null-email crash fix and a one-retry on a pure rate limit, both worth keeping.

- 2026-09-13 (Casey order): **Score and work the 5,395 under-rated 10k+ leads.**
  New order at the top. Scored all 5,395 with the new `--ids-file` flag for
  **$0.66** of OpenRouter. Finance and coaching hold **176 whales, 171 strong 7s,
  29 other 7+ and 311 sixes** (of 2,490). Gate change is on `feat/v2-score-gates`
  in both repos, tested, unmerged. A rolled-back dry run shows **1,671 leads
  newly pass the contact gate, 0 newly pass the hold gate** (none has a contact
  counted yet) and **nobody who passed before is refused**.
  **Pilot, 50 finance and coaching whales** (`--stop-after verify`, run from the
  branch worktree for its opt-in cost logs): **18 verified, 26 no email, 4
  invalid, 2 failed**, at **$0.0015/lead OpenRouter** plus **0.48 ZeroBounce
  checks/lead**. The free re-score gave all 18 the contact point (15 went 8 to 9,
  3 went 9 to 10), and the new hold gate would admit exactly those 18. None moved
  to `approved_hold`; that waits on Casey.
  **Brave does not touch this path. Tavily does, and it is capped:** it answers
  `432 exceeds your plan's set usage limit`, so the finder's "no linked website"
  fallback search is dead. 25 of 48 traced finds hit the cap and 11 came up with
  no website at all. ~~Raising Tavily is Casey's spend call.~~ **Superseded the same day:
  Casey dropped Tavily for Brave. See the entry above.**
  **Casey's calls, later the same day:** merge the gates, promote the 18 pilot
  leads, run email finding on finance and coaching only (635 leads in tier order,
  the 170 out-of-category 6s last, plus the 2 pilot leads that crashed), and hold
  the other 990 and all enrichment spend until that batch reports. "Risky" emails
  do NOT earn v2's contact point for now, because sending is paused on inbox
  placement. The finder's Brave swap and the null-email crash fix are on
  `feat/v2-score-gates` (`fe6d3752d`); a live test found a site through Brave for
  3 of 3 pilot leads that had none under Tavily.
- 2026-09-14 (with Casey's explicit permission): **the v2 gates are LIVE.**
  Migration 002 applied to `pipeline` (0 previously passing leads refused). Email
  repo merged at `520c9dd48`; a parallel session had already shipped its own Brave
  switch on the live branch, so that version was kept and mine was dropped, leaving
  only the gates, the null-email crash fix and the two opt-in cost logs. Orchestrator
  merged too. **The 18 verified pilot leads are in `approved_hold`.** The 637-lead
  finance and coaching email run started 02:03Z from the tested branch copy.
- 2026-09-14 ~03:00: **the 637-lead run finished at 02:50 with 0 crashes.** 322
  verified (290 valid, 32 risky), 228 no email, 87 invalid. Cost: $1.08 OpenRouter
  ($0.0017 per lead), 486 ZeroBounce checks, 907 Brave searches (about $4.50 of key
  _1's $50). 42 searches came back "refused by both keys: 402". The run's copy of
  `brave.ts` reports only the last key's status, so these are probably key _1 rate
  limits hidden behind key _2's cap (assumed, not verified). A live search from the
  live checkout answered fine at 02:55.
  **Re-scored (`--stage assemble`, free): all 290 valid-email leads now pass
  `leads.may_enter_hold`** (193 finance, coaching or consultant, 96 outside, 1
  doctor). **Not promoted.** Promotion starts enrichment spend, so it waits on Casey.
  The 32 risky ones stay out, per his call.
  **Recovery lane:** at 02:53 the sweep moved 346 leads to `needs_contact`. 315 came
  from this run, and 31 are older leads the new v2 gate admits. The lane had no
  collect cursor and its lap was complete, so the 03:00 pass starts from the top,
  where the priority list puts these leads.
  **Incident, fixed:** the email-repo merge sat unpushed, so auto-sync's `git pull
  --rebase` re-applied it every run. It hit the same conflict each time, which left
  conflict markers in the live files about half the time from ~02:05 to 02:54. One
  backfill batch crashed on it at 02:27, and the chain retried the same 18 ids at
  02:37, so nothing was lost. Fixed by aborting the rebase and pushing `520c9dd48`,
  which leaves origin and the live branch identical. Rule: push right after merging
  into any live checkout.
- 2026-09-14 ~12:30, **Casey said yes to all three calls.** (1) 290 valid-email
  leads from the 637 run moved to `approved_hold` at 12:06 (290 of 290, none
  skipped), so enrichment picks them up. The 32 risky ones stay out. (2) Email
  finding started at 12:06 on the other 990 leads of the 5,395 batch, in tier
  order (191 whales, 204 strong 7s, 49 other 7+, 546 sixes). All 990 had a blank
  `outreach_status` and none were DNC. Logs are in the session scratchpad. (3) The
  recovery lane now re-scores its own verified leads hourly (see the ACTIVE section).
  Orchestrator `737bcd2` and automator `807acac` are pushed with origin identical;
  lane tests 50/50, tsc clean, scorer tests 6/6. A dry run from the branch picked
  exactly the 34 stuck leads, and all 34 have cached verdicts in the live file.
  **First live run, 13:02:** verify checked 43 leads, then the re-score pass took 57
  (the 34 plus 23 verified in that same run), assembled 57 with 0 kept, and parked
  **57 of 57**. Checked in the database: all 57 are `approved_hold` with v2 7 to 9,
  contact 1, a `valid` email, not DNC, and none cleared the old score bar.
- 2026-09-14 13:15: **the 990-lead email run finished** (13:10, plus a retry of 12
  network "fetch failed" errors). Final: **423 valid**, 69 risky, 337 no email, 160
  invalid, 1 still failed. Cost: $2.28 OpenRouter ($0.0023 per lead, above the
  $1.70 estimate), 830 ZeroBounce checks, 1,363 Brave searches (about $6.80 of key
  _1), 0 Brave refusals. Re-scored (free, 0 kept by the new guard): **all 423
  valid-email leads pass `leads.may_enter_hold`**, split 198 outside a client
  category, 144 doctor, 32 coach, 22 legal, 19 agency, 5 financial, 3 consultant.
  **Not promoted: waiting on Casey** (enrichment spend). The 497 no-email or invalid
  leads went to `needs_contact` in normal book order, not the priority list (that
  was for finance and coaching only).
  **Enrichment is the slow step.** `backfill-chain` took the 290 as one batch at
  12:20 and runs about 20 leads an hour, so they finish around 02:00 UTC 09-15. The
  57 lane parks are queued behind them.
- 2026-09-15 03:00 UTC: **Casey said yes, so the 423 are in `approved_hold`**
  (dry run 423 of 423 first, none skipped, none DNC after the Operation Siege merge).
  The same check found **enrichment dead since 22:26 UTC 09-14: OpenRouter is out
  of credits** ($1,310 bought, $1,310.19 used). The 290 batch finished 264 and lost
  its last 26 to the empty account. Every batch since has logged `exit=0 done=0
  failed=88` or `98`. Nothing is lost: failed leads stay in the chain's pool and
  retry by themselves. The lane's hourly re-score kept working (57 parked at 13:02,
  2 at 17:02, 1 at 01:01) because it makes no model call. Waiting on Casey to add
  credits. The backlog is about 590 leads, roughly $95 (estimate).
- 2026-09-15 ~14:50 UTC: **Casey added $300 of OpenRouter credit, and enrichment is
  running again.** Balance was $299.81 at 14:34. The 14:34 batch (500 of a pool of
  603) had 0 failures and $0.33 spent after 13 minutes, with 10 bundle folders
  started. Checked while confirming: only one OpenRouter key exists across the
  pipeline and it has no per-key limit, and last night's second 402 wording ("would
  exceed your available credits given your current in-flight requests") was the same
  empty account. The "(Haiku)" in the quick repo's export log is a stale label, since
  `models.json` sends the examples bank to `openrouter:deepseek/deepseek-v3.2`. At the
  290 batch's pace (about 29 leads an hour) the pool takes about 20 hours, which puts
  the finish around 11:00 UTC 09-16. Rough cost is $97 (estimate).

- 2026-09-13 (debrief): **THE GAP IS CLOSED. The recovery lane's book went 251 → 3,028,
  and the 09-12 recommendation to "build a second collect mode" is DONE — but NOT by
  building a second mode, so don't build one.** The day itself parked **0**, the first zero
  on record, which is exactly what the 09-12 entry predicted. Its last six collect passes
  spent **903 lead-slots on 253 distinct leads** (a 3.6× re-read) and produced **6 contact
  points across 2 leads** in 24h.

  **The fix was one clause, not a new lane.** `COLLECT_IDS_SQL` now excludes on the absence
  of an **EMAIL** contact point instead of ANY contact point, which makes it the exact
  complement of `VERIFIABLE_IDS_SQL` and leaves nowhere to fall between them. A second
  collect mode would have been a parallel selector to keep in sync forever; this is the same
  selector with the bug removed. Orchestrator **`e2d7b81`**. Verified live: **251 → 3,028**
  (= 251 + 2,777 exactly), cursor paging contiguous with 0 overlap and no skips, 38/38 tests.

  **Companion fix, and the reason this shipped while Brave is still dead:** the collector was
  resolving a website, storing it, and never reading it back, so it re-bought the same answer
  from Brave every pass and read the lead as siteless whenever Brave refused. `storedWebsite()`
  in `youtube-email-outreach-v1/src/bloodhound/db.ts` (**`aa66cd69d`**) reads it back first.
  **2,282 of the 2,780 recovered leads already have a website stored and only 950 have a link
  in `external_links`**, so 1,332 workable leads looked barren purely because nobody re-read
  the table. Tested with **both Brave keys blanked: 8/8 sites recovered, zero Brave calls.**
  Tier is now "has a site to work with FOR FREE" (declared link **or** stored website), so
  each lap spends its early passes on the leads that need no Brave at all.

  **Third fix, an alarm that would have outlived its bug:** `collectBookDepth()` kept its own
  copy of the old predicate, so it would have reported pool 251 against a real book of 3,028
  forever, kept `bloodhound_collect_book_drained` firing, and kept suppressing the two
  site-resolution alarms while naming a bug that had just been fixed. Both counts now derive
  from the selector's own exclusion (**`8301c6d`**). Live: pool **3,028**, stranded **2,780 →
  3**, alarm correctly silent. `stranded` keeps its job under an honest definition — leads
  holding a non-email point that STILL cannot be collected — so **if it climbs again, a gap
  has reopened and that is the number that says so.**

  **BRAVE IS NOW WORTH PAYING FOR, and it was not this morning.** Same facts, flipped
  ranking: a top-up bought **251** leads before the fix and buys the ~**1,332** leads in the
  widened book with no stored site and no declared link after it. The $5/month cap is still
  refusing (402 on every pass, **825 of 903 leads = 91%** resolved no website, resets
  1 October). Still Casey's spend call.

  **Quote 3,028 now, not 251 and not 3,735.** And the clock changed shape: with discovery
  paused nothing replenishes `needs_contact`, so the widened book is about **five days** of
  walking at 600 lead-slots a day. When it closes the recovery lane has genuinely finished
  and enrichment plus Apify is all that is left. Lifting the discovery pause is Casey's word
  alone, but that decision now has roughly a week on it rather than being open-ended.

  **The lesson worth keeping: nothing faulted.** Every guard held, every process ran on
  schedule, spend stayed at $0, and the day produced zero. A lane repeating itself is
  indistinguishable from a lane working, from the outside, and the number that exposed it
  (lead-slots ÷ distinct leads) is watched by no alarm. Building that alarm is ranked #5 and
  was deliberately left for after the fix is observed working, so it is calibrated against a
  lane in its normal state.
  Full detail: `brain/lead-gen/runs/lead-run-2026-09-13.html`.

- 2026-09-12 (debrief): **THE RECOVERY LANE HAS FINISHED ITS BOOK, AND 2,778 LEADS ARE
  STRANDED IN A GAP BETWEEN ITS TWO SELECTORS. STOP PLANNING AGAINST THE 3,735.** Parking
  fell **8 to 2**, the worst on record. The collect half selects `needs_contact` leads with
  **no contact point of any kind**, and that pool is now **253** (19 tier-0, 234 tier-1)
  while the lane walks **600 lead-slots a day**. So it re-reads its whole remaining book
  ~2.4x daily: four passes covered **571 lead-slots over 271 distinct leads**, and passes
  three and four were a **byte-identical 150-lead batch** returning `0 contact points from
  0/150` both times. The verify half is done from the other end — **30 lead-slots used of
  1,200** across 6 passes, queue **4 deep**.

  **The gap is the finding.** `COLLECT_IDS_SQL` excludes any lead that has ANY contact
  point; `VERIFIABLE_IDS_SQL` only takes leads with an EMAIL-kind point. A lead the
  collector worked and came away from holding a website, a phone or a social handle but no
  email satisfies **neither**, so nothing looks at it again. That is **2,778 of 3,735**
  (74%): website 2,281, social 1,101, domain_info 1,056, phone 785. Another 704 were ruled
  on and failed and are correctly retired. Same shape as the 09-06 Apify double-billing bug,
  inverted: there a never-checked channel looked like a checked-and-empty one; here a
  checked-and-useless lead looks like a finished one.

  **`needs_contact` = 3,735 is NOT the recovery lane's runway and never was.** Quote 253.

  **We spent a day recommending the wrong spend.** Both lane alarms blame the search plan
  whenever a Brave refusal is in the log, and that line now prints at the top of EVERY pass,
  so the attribution had gone unconditional — **24 firings** telling Casey to raise the cap.
  Brave IS refusing (402, $5 monthly cap, resets **1 October**), but raising it buys **253**
  leads, not 3,735. An alarm that names a remedy costing money must be sure the remedy is
  the constraint.

  **Yesterday's `lap_complete` waiver worked** — it fired at 21:02Z, released the 58-lead
  tail and batches went back to a full 150 — **and then the lane re-pinned at the TOP of the
  book.** A rewind with `resume.from = null` restarts the same lap, and the top of the book
  is a stable set that yields zero while search is down.

  Fixed in `075e3b3`: `collectBookDepth()` counts the pool and the stranded set in one query
  beside the two selectors it derives from, logged on every dispatch as `pool_remaining` /
  `stranded_no_email` / `book_drained`; a new `bloodhound_collect_book_drained` observation
  fires when a day's passes cover the book more than once and **suppresses** the two
  misattributing alarms; `rewindWaiver` waives the **second** consecutive zero re-walk (the
  first still rewinds, which keeps the killed-child case the rewind exists for) — the
  48-deep budget had 46 more identical passes queued, about twelve days. *Verified*: tsc
  clean, 36/36 tests (2 new), the depth query run live against Postgres, the check-in re-run
  end to end with the new alarm firing and the old two silent.

  **#1 OPEN LEVER, NO SPEND: a second collect mode over the 2,778 stranded leads.** 2,281
  already carry a stored `website` contact point, which is the expensive step Brave's cap
  blocks, already paid for. A selector for leads holding a non-email contact point plus a
  collect path that uses the stored site instead of resolving one makes **zero Brave calls**
  and is roughly 9x the collector's entire remaining book. Code change, not a spend call.

  **Key pool: fifth identical morning** (15 working / 50 exhausted / 1 blocked of 66) and a
  fourth straight cycle with nothing of ours spending a unit overnight. All five readings
  sat ~20 min past the reset, so per the 09-08 rule they remain **one measurement repeated**.
  The untried discriminator is unchanged: **one probe 6+ hours after the reset**, 66 units.

- 2026-09-11 (debrief): **A REWIND EXISTS TO RESCUE LEADS STRANDED BEHIND AN ADVANCED
  CURSOR. A BATCH THAT CLOSED ITS LAP STRANDED NOBODY.** Parking fell **44 to 8**, the
  second-worst day on record, because three of the cycle's four collect passes were handed
  the same 58 leads. The 07:02Z pass reached the end of the book and came up **short** (111,
  not 150), which is the queue's signal that the lap is done: the cursor is cleared, not
  stepped over, so the next pass restarts from the top and re-selects those leads anyway.
  Yesterday's search-dead rewind put the cursor back instead. 53 of the 111 gained a contact
  point and left the pool by definition, leaving exactly **58** tier-1 leads with no
  resolvable site, re-read at 14:00Z, 20:01Z and 02:01Z for **0 contact points from 0 of 58**
  each time, while **3,737** leads waited. The 48-deep budget shipped the day before meant
  **twelve more days** of it. Verify starved behind it: 7 passes, 40 leads, against 129.

  **And the reasoning written into that budget does not survive its own logs.** It said that
  with search dead *"every lead ahead of the cursor is just as unsearchable as the one under
  it"*, so holding costs nothing. Nine of ten methods need a website, but **Brave is not the
  only route to one** — the free channel-page route never touches Brave. Measured through
  this outage with every key answering 402, the lane still collected from **148/150, 143/150,
  40/150 and 53/111**. **Brave-dead is roughly 48% of healthy, not zero.** Holding the cursor
  therefore costs the rest of the book against a cap that does not reset until **1 October**.
  Correct the "$5 plan is the entire top of the funnel" line in the 09-10 entry accordingly:
  it is about half of it.

  Fixed in `2e86c06` (content in the `e01c242` auto-sync commit — check `git show`, not the
  message): `rewindWaiver()` skips a rewind when the batch closed its lap, and a search-dead
  pass that still collected from **≥10%** of its batch advances. A pass that truly collects
  nothing still rewinds, which is the case the rule was written for. The live state file's
  pinned `collectResume` was cleared by hand so the next pass starts a fresh lap; backup at
  `logs/bloodhound-lane-state.json.bak-20260911`. *Verified* 150 leads select from a fresh lap
  against 58 from the pinned tail, tsc clean, 34/34 tests, 8 new.

  **Second fix, a different permanent-loss class: one invisible byte kills a lead forever.**
  Three enrichment runs failed on one lead with `invalid byte sequence for encoding "UTF8":
  0x00`. Postgres cannot hold a NUL byte in text at all, and Stage 4 saves YouTube comment
  bodies verbatim. Because it fails **identically every time**, the backfill chain relaunched
  the lead and **burned all three `MAX_ATTEMPTS` in five minutes**, dropping it from the pool
  for good, and it produced the `done=0` batches the 09-02 guard exists to catch.
  `recvP5IA0vHjvMvrf` died the same way on 08-25. Fixed in `quick-youtube-channel-research-v1`
  `04fa62d` (`src/lib/pg-safe.ts`, applied in stages 3 and 4). **The 67 permanently excluded
  enrichment leads are infrastructure casualties, not bad leads, and nothing reopens them by
  itself.**

  **Key pool: fourth identical morning** (15 working / 50 exhausted / 1 blocked of 66) and a
  third straight cycle with nothing of ours spending a unit overnight. Still **one
  measurement repeated** — all four readings sat ~20 minutes past the reset. The untried
  discriminator is unchanged: **one probe 6+ hours after the reset**, 66 units, on a quiet day.

- 2026-09-10 (debrief): **THE SEND REPAIR HELD (11 of 11 to SmartLead), AND A $5/MONTH
  SEARCH PLAN IS NOW THE ENTIRE TOP OF THE FUNNEL.** With discovery paused, every new lead
  comes from the Bloodhound recovery lane, nine of its ten collection methods need a website
  first, and both `BRAVE_SEARCH_API_KEY` slots are answering `402 Usage limit exceeded`
  against a **$5 monthly cap**. Parking fell **133 to 44**, the lowest since 08-31. The
  no-website share slid **9.3, 10.7, 18.0, 16.7, 24.7, 20.7, 33.3, 28.0, 59.7, 55.9%** across
  ten passes while output fell from **885 contact points off 148/150 leads to 186 off 40/150**.
  **Third time in a fortnight** (08-31 parked 5, 09-04 parked 71, today 44) and the first with
  no discovery cushioning it. **Raising that cap is the #1 lever in the pipeline and it is
  Casey's call.**

  **Yesterday's rewind fix hit its own cap and reopened the hole it closed.** It shared the
  3-deep budget with the truncated-pass case, so it rewound three times, logged
  `rewind_cap_reached`, reset the counter and **advanced 150 leads blind**, then repeated. A
  full lap closed with its tail walked at a 27% hit rate. Brave's cap is **monthly**, so a
  re-run can never fix search-dead. Fixed in `f92e022`: separate budgets, truncated keeps 3,
  search-dead gets **48** (~12 days at the 6h cadence), counters reset each other so
  alternating failures cannot add to a cap neither reached alone. While resolution is down the
  bookmark **holds**, which costs nothing (every lead ahead of the cursor is as unsearchable as
  the one under it) and the re-walk doubles as the probe that notices Brave returning. Still
  finite: a misfiring detector must not park the lane silently.

  **The 70% no-website alarm is calibrated to a total outage and slept through the whole
  slide**, including the two worst passes at 60% and 56%, while the lane's output fell 87%.
  The check-in now judges the lane against **its own trailing median hit rate**
  (`bloodhound_collect_yield_degraded`, 40% relative fall). Verified on the real log: silent
  on every healthy pass, fires on both damaged ones. Observation-only.

  **Enrichment is NOT the constraint and has nothing to eat.** 4 batches, 65 leads, **zero
  failures**, and `no pending inflow — idling` for roughly **20 of 24 hours**. The 09-08
  redirect of all resources into enrichment is currently buying idle time, because what feeds
  enrichment is gated behind the $5 plan above.

  **The key pool question narrowed but is still NOT settled.** Third identical morning
  (**15 working / 50 exhausted / 1 blocked of 66**), and now the second consecutive cycle in
  which nothing of ours spent a single unit overnight, so our own spending is ruled out twice.
  But both readings sat ~20 minutes past the reset, so per the 09-08 rule they remain **one
  measurement repeated**. **The untried discriminator: one probe 6+ hours after the reset on a
  quiet day** (66 units total). Still 50 exhausted means the quota was cut and more keys from
  those accounts buy nothing. Do it before discovery resumes, not after.

- 2026-09-09 (debrief): **THE SEND PATH WAS DEAD AND IS NOW REPAIRED. A REPO
  CANNOT SEE ITS OWN CONFIG UNLESS THE LOADER READS THE FRAGMENT.** The 07:20Z
  `npm run send` failed on all 11 leads. `env-storage` holds a shared key bank
  AND `fragments/<repo>.env` for repo-specific config, `build-envs.sh` glues them
  into each repo's generated `.env`, and the email repo's generated `.env` was
  deleted 2026-09-01 while `shared-env.ts` only ever read the shared bank. That
  is the **second** outage from it: `ENRICHMENT_REPO_PATH` on 09-02 (patched with
  a code default), all **16 `SMARTLEAD_CAMPAIGN_*` ids** today. Fixed at the
  loader, so the class is closed rather than one more variable. Two more faults
  rode along: `compose-nick-saraev.ts` still pointed at the pre-08-06 skill folder
  name, and a config fault wrote `outreach_status=failed`, which is outside
  `APPROVED_FIRE_READY` and inside the prep queue, so 11 enriched leads fell out
  of the send queue and were priced at a full re-enrichment. Campaign ids are now
  preflighted **before** compose and a config fault never writes a status. **If a
  send ever reports every lead failed, read the first line of the failure before
  anything else: a config gap now aborts in seconds and names the missing
  variables.** Also shipped: the Bloodhound collect pass rewinds its bookmark when
  Brave Search is refusing, instead of stepping the cursor over 150 unsearched
  leads (the 09-02 shape that parked 71 instead of 627). Brave is capped again,
  19 refusals in the current log, ~25% `site=(none)`.

- 2026-09-08 (Casey, in chat): **DISCOVERY OF NEW CHANNELS PAUSED UNTIL FURTHER
  NOTICE.** See the banner at the top of this file for the full switch list. All
  resources go to enriching the leads we already have. Seven systemd units
  stopped + disabled, three Hermes cron jobs paused, one flag file
  (`logs/discovery-paused.flag`) gating six sweep scripts, the campaign loop, the
  hourly check-in and the keyword-harvest backstop. No code was deleted and
  nothing was reconfigured beyond the off switch. Casey does not want
  notifications about the paused lanes from any agent until he lifts it.

- 2026-09-08 (debrief): **WE WERE WRITING OFF GOOD YOUTUBE KEYS OURSELVES, ELEVEN
  MINUTES INTO THE DAY.** `expiryFor('quota')` in the finder's
  `src/youtube/dead-keys.ts` pinned a quota death until the NEXT Pacific midnight.
  That is right at 3pm and badly wrong at 00:11, because the always-on sweeps sleep
  to the reset and then touch every key within seconds of waking, so a refill that
  has not landed yet reads as "out of quota". Measured live this morning: **11 keys
  retired between 07:11:28Z and 07:19:12Z, every one inside the first twenty minutes,
  every one locked for 23h49m off a single early answer.** 09-07 had the same shape
  (12 keys in 270ms at 07:05Z). The client already refuses to believe a store that
  condemns the WHOLE pool, and had no defence against one condemning **50 of 66**,
  which is the case that actually happens.
  Fixed in finder `24bfacc`: inside `YT_RESET_GRACE_MINUTES` (180) a quota death
  expires after `YT_QUOTA_RETRY_MINUTES` (30), clamped so it never outlives the next
  reset. Defaults in code, not env. Safe in both directions with no diagnosis needed
  — a genuinely spent key is re-retired on its next turn for one HTTP round trip and
  **no quota** (an exhausted key rejects the request rather than charging for it).

  **This retires yesterday's decision rule.** "If tomorrow reads 15 of 66 again, the
  quota was cut" does not hold: both readings were taken at the same point in the
  morning, 20 and 35 minutes past the reset, so they are one measurement repeated. A
  refill that is consistently more than 35 minutes late produces exactly that pair.
  **The new rule needs no extra probe.** Read `logs/youtube-dead-keys.json` in the
  finder: a fingerprint refused early that then stops reappearing was a late refill;
  one refused repeatedly all morning belongs to a project whose quota was cut.
  Today's pool still probed **15 working / 50 quota-exhausted / 1 suspended of 66**,
  and 22 quota deaths landed in the first 29 minutes.

  **All three graph lanes finished their seed books on the same day.** Video-graph
  **53 seeds left of 90,139**, recommended-videos feed **57 of 12,970**, peer network
  **0 of 12,876** and already yield-dead (142 channels, zero pitchable). They made
  2,759 of the day's 3,046 channels at ~3c/lead, and only video-graph refills itself
  hourly from newly qualified channels. Re-walking pays less each lap (feed lap 1
  0.45/seed, lap 6 0.014). **Nothing was changed: this is Casey's spend call**, and
  it is now the structural limit on finding while the key pool is capped.

  **Not done, flagged only: keyword search is spending the scarce quota.** A keyword
  search costs 100 units; the sweeps run on 1-unit calls plus free scraping. Today it
  bought 13 of 99 good leads and the pool ran out at 22:32Z. Throttling it under a
  thin pool would likely buy the sweeps hours, but it is a producing lane and the
  standing rule is not to stop one.

  **The 09-07 parking record was a backlog drain and the backlog is now empty.** The
  risky-address reopen is finished (0 left) and Apify made **zero attempts** this
  cycle, resting until 30 September. Parking fell 488 to 142, but the ordinary path
  improved: **52 of 142 parks were found the same day, against 31 of 488.**
  OpenRouter is at **3.5 days** ($88.21 at $25.09/day); the rate halved only because
  Apify and the enrichment backfill went quiet, so it is a reprieve, not a fix.

- 2026-09-07 (debrief): **The YouTube key pool did not refill at midnight PT, and
  that is now the ceiling on finding.** The video-graph sweep stopped 19:29Z on an
  exhausted pool and correctly slept 11.6h to the refill, taking every other
  YouTube lane with it: **11 of 24 hours produced zero channels**. It woke at
  07:05Z, five minutes past the reset, and retired 12 keys in 270ms. A hand-run of
  `youtube-lead-finder-v1/scripts/test-youtube-keys.ts` at 07:35Z, **35 minutes
  past the reset**, found **15 working / 50 quota-exhausted / 1 suspended of 66** —
  including keys the rotation had never touched that day, so this is not the
  rotation mislabelling its own spending.

  **Do not assume it is a slow reset and do not assume the quota was cut.** One
  reading cannot tell them apart. `debrief-data.ts` now emits `youtube_key_pool`
  every morning at ~00:20 PT (one quota unit per key, values never logged), so the
  answer arrives by itself: a second 15-of-66 morning means the projects' quota was
  cut and buying more keys from those accounts buys nothing. Check the projects
  with `audit-key-projects.sh`, which costs no YouTube quota.

  Also settled today: **yesterday's rec to checkpoint the video-graph chunk is not
  worth doing.** A chunk is 20 seeds, judged channels are remembered in a persisted
  `evaluated` set, and the re-walk is free watch-page scraping. The code's comment
  explains why the seeds are deliberately not consumed. Leave it alone.

  **The Apify lane is out of money for the month** ($83.89 of $100; the wrapper
  holds $10 back so it cannot fit a $7.02 batch) and rests until 30 September.
  Post-fix economics, which are much better than the 09-06 figures: 83.4% of
  distinct channels publish an email, the first clean batch parked 60 of 100 at
  **$0.117/lead**, and the 3,644 leads it has never touched would cost about **$256
  for roughly 2,100 parks**. Raising the cap is Casey's spend call; the lane halts
  itself above $0.20/lead either way.

  **OpenRouter is at 2.5 days** ($113.30 against $45.26/day account meter). Every
  lane scores through it, so a zero balance stops finding exactly the way the empty
  key pool did.

- 2026-09-06 (evening): **The Apify lane's "collapsing hit rate" was a
  double-billing bug, not a thinning pool — and the price ceiling is now
  enforced by the lane itself.** Casey saw $1.00 per recovered lead and said
  stop immediately; his limit is $0.15-$0.20 against a $0.10 target.

  What was actually happening: a channel that publishes no email writes no
  contact point, and the cohort selector only excluded channels that HAD one.
  So a miss looked exactly like a channel nobody had checked, and the ordering
  is deterministic, so the same 82 misses sat at the top of every batch and were
  billed again. 485 channels cost 825 scrapes; $23.87 of $57.92 bought nothing.
  The apparent 89% → 17% decay was each batch filling up with those known
  misses.

  **There is no "bad channel" pattern to filter on, and you should stop looking
  for one.** On distinct channels the hit rate is 83% flat. Subscribers move it
  67-93%, niche 77-100%, channel age 75-86% — every bucket is worth scraping, so
  a predictor would only cost yield. The lever was never targeting.

  Fixed by `leads.apify_endspec_attempts` (one row per settled outcome; the
  selector skips anything in it) plus a self-enforcing ceiling: two consecutive
  batches over `MAX_COST_PER_LEAD` write `logs/apify-endspec-halt.flag` and the
  wrapper checks it before spending. **The brake cannot be `systemctl disable`**
  — the unit runs as `casey` with no passwordless sudo, so it fails silently and
  the lane keeps spending while looking stopped. Resume with `rm` on the flag.

  Projected cost after the fix: about $0.15/lead. Watch the first two batches;
  if the ceiling trips twice, the pool really has thinned and it is Casey's call.

- 2026-09-06 (evening): **Role addresses (info@, contact@, bookings@) are
  acceptable now — Casey: "as long as they're real, valid emails that don't
  bounce."** But role_based and catch-all both arrive from ZeroBounce as
  "risky", and only the first is a proved mailbox: catch-all means the domain
  accepts everything and nothing about that mailbox was checked. Accept
  role_based only, by reading `rawSubStatus`. Never widen this to a bare
  `status === "risky"` test.

  A personal mailbox still wins; the role address is a fallback used only after
  every candidate is checked, and it lands at confidence 70, not 95.
  `scripts/recheck-risky-role.ts` reopens leads already parked on a risky
  verdict — it costs one credit each because the stored note says only "risky",
  and it recovered 76% of the first 25.


- 2026-09-06 (debrief): **A `Type=oneshot` timer unit KILLS the background job it
  launched, and that is what the recovery lane's new timer had been doing all day.**
  The collect pass runs ~46 minutes as a detached child. systemd's default
  `KillMode=control-group` kills everything left in the cgroup the moment the unit
  deactivates, and `detached: true` makes a process-group leader, not a cgroup
  escapee. Both scheduled passes died ~30s in: **6 of 150 leads walked, then 13 of
  150**, while the lane's cursor had already stepped past all 300. **281 leads were
  recorded as walked with nobody looking at them.** The campaign-dispatched pass of
  09-05 12:03Z walked all 150, because `autopilot-campaign.service` stays active.
  Proven with a controlled `systemd-run` pair: default KillMode left 0 survivors,
  `KillMode=process` left 1.
  **This corrects the entry below**, which records that a detached child holds the
  unit in `activating`. It does not; the unit goes `inactive (dead)` and takes the
  child with it. The wall-clock timer schedules in `2aec64b` are still right, for
  their own separate reason, and both checks are worth running on any new lane unit:
  `systemctl show <unit>.timer -p NextElapseUSecRealtime --value` must be a date, and
  `systemctl show <unit>.service -p KillMode --value` must be `process` wherever
  ExecStart leaves a child behind.
  Fixed in `08238bb`: the unit carries `KillMode=process` and now lives in
  `scripts/autopilot/systemd/` wired into `install.sh`, so a reinstall cannot lose
  it. **And the lane no longer trusts its own dispatch** — it remembers where each
  batch started and rewinds the cursor when the collect log shows the previous pass
  never printed its completion line, capped at 3 consecutive rewinds so a child that
  always dies cannot pin the walk on one batch. A kill is not special: an OOM, a
  reboot or a `systemctl stop` does the same damage, silently. Today's cursor was
  rewound by hand and a full pass verified live.
  Same day, same shape, pre-emptively: **`autopilot-checkin.timer` could have parked
  the pipeline's only watchdog forever.** It ran on `OnUnitActiveSec` with
  `TimeoutStartUSec=infinity` on a service that can spawn a `claude -p` fix agent.
  Now `OnCalendar=*-*-* *:11:00` plus `TimeoutStartSec=45min` (`2fc4f79`).

- 2026-09-06 (debrief): **The Apify endspec figures below are PILOT numbers off the
  best-ordered 52 channels. Do not plan against them.** Four live batches of 100 on
  09-06 measured emails found per 100 channels of **89, 75, 67, 54** and parked leads
  of **11, 35, 24, 22**, at **$0.638, $0.201, $0.292, $0.319** per recovered lead. The
  honest planning number after 400 channels is ~25 parked per 100 channels at ~$0.30,
  still drifting down, so a full 3,164-lead sweep buys roughly 790 leads for $222
  rather than the ~1,870 the 92%/59% figures imply. **The lane also stops by itself
  around midday Tuesday**: $28.08 spent since midnight, ~$53 left of the $100 monthly
  cap after the $10 reserve, and the wrapper exits 0 quietly when short, by design, so
  nothing will announce it. Raising the cap is Casey's spend call; it is still the
  only route to an address hidden behind the "View email address" button.
  **Brave is capped again** (both keys answered 402 on today's passes) and it no
  longer matters much: the free channel-page route resolved 119 of 150 sites on the
  last full collect pass.

- 2026-09-06: **The two best recovery lanes now run on their own timers instead of
  waiting for a person or for YouTube quota.** Both installed and verified live.
  - **`apify-endspec.timer`** (every 2h) -> `youtube-email-outreach-v1/scripts/apify-endspec-loop.sh`.
    The endspec actor solves the reCAPTCHA behind YouTube's "View email address"
    button, which is the one address no free HTTP can reach. Measured on the live
    09-06 batch: **92% of channels returned an email** (48 of the first 52), and
    after ZeroBounce roughly **59% of every channel run becomes a usable lead**.
    **3,164 leads qualify**; a full sweep is ~$222 at $0.0702/run against a $100
    monthly Apify cap.
    **The wrapper checks the monthly ledger ITSELF and exits 0 quietly when short,
    rather than letting the script's preflight throw.** Under a timer a throw means
    a failed unit every two hours for the rest of the billing cycle, which trains
    you to ignore the lane. It also reserves `BUDGET_RESERVE_USD` (10) so an ad-hoc
    run always has room — burning a cap to the last cent is exactly how Brave took
    the recovery engine down for two days on 09-02. And it `pgrep`s for a live
    batch before taking its flock, because flock cannot see a manual
    `npm run apify-endspec` and the actor MUST be serialised (38 of 50 parallel
    runs came back overloaded on 09-02, every one reporting SUCCEEDED).
  - **`recovery-lane.timer`** (hourly) -> `npm run recovery` (`src/cli/run-recovery.ts`).
    Fixes the throttle recorded earlier today: `runBloodhoundLane` was dispatched
    only from the campaign's finish block, so the 09-04 midnight-PT sleep took its
    collect passes from 4/day to 2/day on a lane that spends **no YouTube quota at
    all**. The timer fires hourly and lets the lane's own state file decide what is
    due (collect 6h, verify 3h) — the schedule stays in ONE place. It takes no tick
    lock on purpose; collect is detached HTTP against creators' sites and verify
    only spends ZeroBounce, so neither touches the send path.
  - **They compound, which is the point.** First run: Apify scraped addresses, the
    recovery lane verified 63 of them and flipped **10 straight into approved_hold**
    (`brian@moneyguy.com`, `louise@louisebrogan.com`, ...). `needs_contact` 4,334 ->
    4,324 in under a minute. Those land WITHOUT an enrichment bundle, so the
    backfill chain (idling on "no pending inflow") picks them up next.
  - **ZeroBounce credits replenish on their own** (Casey, 09-06), so the 2,718
    balance is not a wall. The lane still breaks its verify loop cleanly on a
    momentary dry spell and keeps the scrape.
  - **BOTH TIMERS USE `OnCalendar`, NOT `OnUnitActiveSec`, AND THAT IS LOAD-BEARING.**
    Caught on install: the collect pass is a detached child that stays in the
    service's cgroup for the ~46 minutes a 150-lead batch runs, so the unit sits in
    `activating` long after ExecStart exits 0. `OnUnitActiveSec` only schedules the
    next run once the unit goes inactive, so `NextElapseUSecMonotonic` read
    **`infinity`** — the timer would not have fired again until the collector
    finished, and a hung collector would have parked the lane forever with no
    error. That is the same silent-stall shape as 08-12, 08-27, 08-29 and 09-02.
    A wall-clock schedule cannot be stopped by a long or stuck run; systemd just
    skips a trigger while the service is still active. **Any future timer wrapping
    a lane that detaches a child must do the same, and the check is one command:**
    `systemctl show <unit>.timer -p NextElapseUSecRealtime --value` must return a
    date, never `infinity`.


- 2026-09-06: **THE 09-02 SHARED-PROJECT FINDING BELOW IS WRONG. Every key has its
  own Google Cloud project, so more keys DO buy more quota.** Measured twice with
  `youtube-lead-finder-v1/scripts/audit-key-projects.sh` (written for this, costs
  no YouTube quota): 66 keys, **64 distinct project numbers**, 2 more whose API
  restrictions are locked to YouTube so they answer opaquely, and **zero projects
  hosting two keys**. Daily pool is therefore ~660,000 units, not the ~270,000 the
  09-02 entry claimed.
  **The test that produced the wrong answer was inference from contiguous slot
  deaths, and that test cannot work.** `nextLiveIndex()` in the finder's
  `src/youtube/client.ts` walks the pool as `(this.index + i) % n`, a plain
  round-robin cursor, so consecutive slots are SPENT consecutively and therefore
  DIE consecutively no matter which project funds them. The 09-02 reasoning saw a
  real pattern and attributed it to the wrong cause. **Ask Google instead of
  inferring:** the audit script reads the project number straight out of a Cloud
  Translation 403, which names the calling project.
  **What this changes for spend:** buying keys is back on the table as the way to
  add keyword-search capacity, at ~10,000 units per key per day. Remember the
  quota asymmetry though — only the 100-unit `search.list` calls are constrained,
  and the graph sweeps run on 1-unit calls plus free scraping, so more keys buys
  keyword search and buys the sweeps almost nothing.
  **Pool health today:** 65 of 66 keys are fine. Exactly one is genuinely dead,
  slot 38, which answers `Consumer ... has been suspended`. Slots 3 and 10 read
  `forbidden` on the audit probe and serve YouTube normally; that is a correctly
  restricted key, not a broken one.

- 2026-09-06: **Video-graph cap raised $53 -> $100 on Casey's explicit approval**
  ("let's give it up to $100"). The lane had stopped at $53.0093 with 264 of
  83,338 seeds unwalked, roughly $0.20 short of finishing its book, and had been
  relaunching and dying in two seconds every hour since 08-28. Restarted and
  confirmed walking. The jump is deliberately large because the two previous
  raises each bought a few dollars and stranded the lane again within the week;
  at 2.7c per qualified lead this is the cheapest source in the pipeline. The
  durable fix is still to make its cap per-lap like the feed lane's, since this
  one counts LIFETIME dollars and waiting never releases it.

- 2026-09-06: **Brave key 1 is live again, key 2 is still capped.** Casey raised
  one of the two plans. `BRAVE_SEARCH_API_KEY_1` answers 200;
  `BRAVE_SEARCH_API_KEY_2` answers 402 at `current_spend 5.0 / usage_limit 5.0`.
  The recovery lane's collect pass recovered with it: the 09-05 12:03Z pass took
  686 contact points off **135 of 150 leads**, against the ~0.93/lead this lane
  averaged before. Raise key 2's cap as well when convenient; collect throughput
  and Brave headroom are the same lever.

- 2026-09-06: **The recovery lane is throttled by a YouTube quota sleep it has no
  reason to obey.** `runBloodhoundLane` is dispatched only from the campaign's
  finish block (`src/drivers/campaign.ts:872`), plus an OpenRouter-halt branch in
  `checkin.ts`. Since the 09-04 change that sleeps the campaign loop to the
  midnight-PT refill instead of retrying every 30 minutes, the campaign is down
  ~14h a day, and the lane sleeps with it: collect passes went 4, 3, 4, 4, **2**
  across 09-01..09-05, on a 6h interval that should give 4. The lane spends ZERO
  YouTube quota. Giving it its own timer is free throughput and is the highest-
  value open item. Not done yet: it is a change to how a producing lane is
  scheduled, so it is Casey's call.

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

- 2026-09-02: **SUPERSEDED 2026-09-06 — the shared-project half of this entry was
  measured false; see the top of this log. Its first paragraph (keys are not being
  banned) still stands; everything about projects and about buying keys does not.**
  ~~The YouTube keys are not being banned. Many of them share a
  Google Cloud project, so they share one 10,000-unit quota.~~ The 09-02 handoff
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
