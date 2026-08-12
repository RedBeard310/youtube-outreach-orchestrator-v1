# Lead Run Debrief — 2026-08-12 (analysis companion)

**Headline: +18 parked. Yesterday's key fix landed and is verified, but the same
bug it fixed was living in three more copies, and those copies kept all four
background search methods paused for the entire 24 hours. Keyword search
produced 100% of the day's 212 finds on its own. Then at 20:09Z the campaign
stopped on a hand-written migration freeze, which is deliberate and which I left
in place. Four fixes shipped.**

Cycle window: 2026-08-11 07:00Z → 2026-08-12 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-12.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+18** | pool 4,642 → 4,660. Was +29 |
| `needs_contact` pool | **5,783** | +28. Grew faster than the parked pool |
| **Total parked, 0 sent** | **10,443** | 4,660 + 5,783 |
| Discovered | **212** | was 930. Down 77% |
| Pitchable (score ≥ 6) | **46** | **21.7%** of intake, up from 11.0% |
| Of today's cohort | 18 → `approved_hold`, 28 → `needs_contact` | 139 below threshold, 5 niche-excluded, 22 unreviewed |
| Emails verified | **18** | was 3 |
| `scoring_failed` | **0** | rate 0.0%, seventh clean day |
| Campaign sessions | **14 real** | the snapshot says 16; 2 were `campaign:dry` |
| Finder passes | **50 real** | the snapshot says 80; 30 were dry-run phantoms |
| Keyword-engine pitchable | **48** | **0.96/pass**, identical to yesterday |
| Fades / discovers / promotes | 37 / 51 / 39 | |
| **Hard stops** | **13** | all `term_supply_exhausted` |
| **Quota stops** | **0** | was 6. Yesterday's governor fix, confirmed |
| Time-budget stops | **1 of 14** | |
| Net-new channels written | 223 | across 28 passes that wrote anything |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 13th straight cycle, and misleading again |

Two of those rows are corrections rather than readings. The grounded snapshot
counts 16 sessions and 80 finder passes; 2 of those sessions were `campaign:dry`
verification runs that walk their whole plan instantly and do no work, and they
contributed 30 empty passes. Left in, they drag the reported yield from 0.96 per
pass to 0.60. Excluding them shipped today.

## The shape of the day

Thin all the way through, then a hard stop that nobody needs to fix.

Fourteen real sessions ran between 07:00Z and 19:39Z. Two of them carried the
day: the 13:10 close (9 passes, 18 pitchable, 99 minutes) and the 17:30 close
(11 passes, 13 pitchable, 74 minutes). Those two are also the only two that got a
meaningful amount of wall-clock. Nine of the fourteen ran under 12 minutes
against a 90-minute budget, because they ran out of search terms and quit.

28 of 50 passes returned zero.

At 20:09:28Z the loop read the halt flag and stopped. Nothing has run since.

## What actually happened

### 1. Four search methods were paused all day, on a service that no longer exists

Every one of the day's 212 finds came from keyword search. The four background
sweeps contributed nothing, and only one of them even tried.

| Method | Runs today | Seeds walked | Found | Why |
|---|---:|---:|---:|---|
| Recommended-videos feed | 96 | **0** | 0 | false quota pause |
| Peer-network comments | 95 | **0** | 0 | false quota pause |
| Comment sweep | 1 | **0** | 0 | false quota pause |
| Podcast crossover | 1 | 1,317 feeds | 2 | ran fine, has no quota gate |
| Keyword search | 50 passes | — | **212** | the only working lane |

Yesterday's fix taught the campaign governor that a negative `remaining` means
the RapidAPI mirror is retired, not that quota is low, so the guard goes inert
instead of stopping the run. That worked: **0 quota stops today, down from 6.**

What went unchecked is that `graph-sweep.ts`, `peer-sweep.ts` and
`comment-sweep.ts` each carry their **own private copy** of `quotaUsedPct()`,
copy-pasted, and none of them got the fix. Same stale file, same phantom 100.1%,
same pause, 192 times:

```
[sweep] PAUSE: quota at 100.1% >= 70% cap. Leaving headroom for the campaign.
```

There was no campaign to leave headroom for. The file they read
(`logs/quota-state.json`) was last written at **2026-08-11T06:41:02Z** and has
not been touched since, because nothing writes it once RapidAPI is gone. Its
contents are `{"requests":{"remaining":-1,...,"used_pct":100.1}}`. They were
pausing on a snapshot of a world that stopped existing two days ago.

Causality is clean: that file was written 19 minutes before the cycle opened, and
the first sweep run of the cycle (07:12Z) is the first one to pause.

### 2. The health check reported all four as healthy the whole time

`discovery_methods_health` said every daemon was `service_active: true`,
`refill_timer_active: true`, and updated within the last 0.1 hours. All true, and
all useless. It measures whether the progress file is being touched, and a sweep
that bails in its first second still rewrites its progress file on the way out.

Liveness was green. The work was not happening. This is the second time an idle
daemon has hidden in plain sight (graph-sweep sat idle for 8 days in
2026-08-01 → 08-09), and it is why one of today's fixes is about measurement.

### 3. The 20:09Z stop is deliberate, and I left it alone

```
migration freeze: Airtable -> Postgres code swap in progress (2026-08-11T20:09:19Z)
Written by the migration work, not by an autopilot breach.
Remove this file to resume: rm logs/autopilot-halt.flag
```

The migration plan (`youtube-outreach-orchestrator-v1/airtable-to-postgres-migration.md`,
risk table) calls for doing the cutover during a halt-flag pause, so this is the
plan working as written. The commits in that window back it up: the email repo
pointed its lead store at Postgres (`7b923ce48`) and the deep-research repo
collapsed its 52 per-client bases into one schema (`ab05329`).

**Removing that flag is Casey's call, not an unattended agent's.** It stays.

**But the freeze exposed a real gap.** The halt flag is meant to be the
pipeline's one stop-everything switch, and the four sweeps have never honoured
it. They run independently of the campaign and would have gone on writing leads
into a lead store being swapped underneath them. Today that was masked, because
the false quota reading happened to be holding them still for the wrong reason.
Fixing the quota bug alone would have converted a silent problem into a live one
during a migration window, so both fixes went in together.

### 4. Term supply is unchanged and now concentrated in one niche

13 of 14 sessions stopped on `term_supply_exhausted`. The finder's own line:

```
[anti-starvation] active pool exhausted (top rank none < 1); NO never-run and
NO cooled proven terms remain — relying on discovery to invent fresh veins.
```

The probe table holds 12,307 terms, 7,418 already tried, and **0 were promoted**
as winners this cycle. Discovery ran 51 times.

The niche mix is the narrowest on record. **Legal Services was 27 of the 46
pitchable, 59% of the day.** Health & Wellness Clinics 7, Real Estate 4, and
single digits for everything else. That is what the last un-mined vein looks like
when the others are dry, and it will not hold for long.

One caveat on the quality numbers, since they look better than they are: the
21.7% hit rate is up from 11.0%, but the low-precision lane (peer-network
comments, running at 2.6%) contributed nothing today. The average rose because
the weak method went quiet, not because the strong one improved. Per-pass
keyword yield was 0.96, exactly yesterday's.

## Yesterday's fixes, checked

| Prediction | What happened | Verdict |
|---|---|---|
| Finder startup should read 39 keys, not 7 | Flipped at 07:27Z, held all cycle: `auto (39 direct keys, RapidAPI fallback available)` | confirmed |
| Zero false quota stops | 0, down from 6 | confirmed |
| Sweeps back near 08-10 volumes | Still zero, for the separate reason above | no |
| If intake recovers but parked stays low, term supply is the whole story | Intake never recovered, so still untested | pending |

## What shipped

Three commits across two repos. Everything typechecked, the finder's suite passes
at 176 tests (8 of them new), and all four sweeps were run live to confirm the
new behaviour. No `.env` file was touched.

| Repo | Commit | Change |
|---|---|---|
| `youtube-lead-finder-v1` | `4329d0a` | Sweeps share one quota check with the campaign, and honour the halt flag |
| `youtube-outreach-orchestrator-v1` | `43508d6` | The debrief measures whether each sweep did work, not just whether it's alive |
| `youtube-outreach-orchestrator-v1` | `9829e9c` | Dry-run sessions no longer count as cycle work |

**The shared gate** (`src/lib/run-gate.ts`). Three copy-pasted `quotaUsedPct()`
functions are gone, replaced by one that mirrors the campaign governor exactly:
a negative `remaining` means the backend is retired and the governor goes inert,
and a snapshot older than `QUOTA_STALE_MINUTES` (90) is ignored outright. Today's
file trips both guards, so it would have failed twice over. Verified across five
snapshot shapes: a genuinely exhausted plan still pauses at 99.8%, a healthy one
still reports its worst bucket, and retired, stale, missing and corrupt all go
inert.

**The halt-flag gate**, in the same module. Resolution is
`AUTOPILOT_HALT_FLAG`, then `ORCHESTRATOR_REPO_PATH`, then the default sibling
path. Run live against the real flag, all four sweeps print the freeze reason and
stop. The three loop-driven ones return the **resumable** code (10), not the
finished code (0), which matters: their loop treats 0 as "this sweep is complete,
stop for good". So they sleep 15 minutes and re-check, and pick straight back up
when the flag is removed, with nothing to restart by hand. The timer-driven
podcast sweep returns 0, so systemd doesn't mark a deliberate pause as a failed
unit. An unreadable flag file fails open, so a stat error can never block
discovery.

**The productivity measurement.** The health block now carries `runs_in_cycle`,
`seeds_advanced`, `productive` and `idle_reason` per method, read from each
daemon's own session logs. Against today's real logs it reports
`{"runs_in_cycle":96,"seeds_advanced":0,"productive":false,"idle_reason":"[sweep]
PAUSE: quota at 100.1% >= 70% cap..."}`. That one line would have named this
outage on the first hour instead of the second day. Local files only, no network,
so the check can't itself be the broken thing.

**The dry-run exclusion.** Attribution is positional: a `start` event carrying
`opts.dryRun` opens a dry session, and everything through its `done` belongs to
it. Sessions never interleave (single-instance lockfile), so it's exact. Measured
against today's log: 16 sessions and 80 passes at 0.60/pass becomes 14 and 50 at
0.96/pass, and the real event counts (13 hard stops, 37 fades) are byte-identical
before and after, so nothing real was dropped. The count is still reported, as
`dry_run_sessions_excluded`, rather than silently vanishing.

## Ranked next

1. **Decide when to lift the migration freeze, and expect a burst.** Both sweep
   backlogs are frozen a day deep. The recommended-videos feed has 126 seeds left
   in its lap, peer-network has 5,147. When the flag comes off all four resume at
   once against a 39-key pool, which is correct but a much heavier first hour
   than the last two days have looked like.
2. **Term supply is still the binding constraint, and now it's a one-niche
   problem.** Legal Services was 59% of pitchable. No never-run terms, no cooled
   proven terms, 7,418 probes tried, 0 promoted. New seed material or a wider ICP
   is the only way past it, and it caps every day until it changes.
3. **Decide the outlet for `approved_hold`.** 4,660 prepped, none emailed. Over a
   week at the top of this list, and still the only item needing a decision from
   you rather than code.
4. **Build the `needs_contact` recovery engine.** 5,783 creators, and it grew
   faster than the parked pool did today.
5. **Consider removing the RapidAPI path outright.** Its retirement has now
   caused two separate outages on consecutive days across four copies of the same
   check. Every copy is inert now, but the mirror is still wired in and still
   writes the stale file everything reads. Deleting it removes the class of
   failure; it's also a bigger change than an unattended cycle should make alone.
6. **Have the hourly check-in watch sweep productivity too.** Today's fix makes
   an idle daemon visible in the daily report, which is a day late. The same
   measurement hourly would have caught this inside an hour.
7. **Meter OpenRouter as a real cost.** Still unmetered. The ledger reads $0
   because it only counts Anthropic.

## Status

Everything is parked, nothing sent. `approved_hold` 4,660 plus `needs_contact`
5,783 is **10,443 creators found and never contacted**. $0 on Anthropic. Zero
crashes, zero scoring failures, no fatal signatures for the 13th straight cycle,
which for the second day running says less than it sounds like.

The campaign is paused under a hand-written migration freeze and I have left it
that way. That was a person's decision about a database swap, and resuming it is
Casey's call. The four fixes are in place for whenever it comes back.
