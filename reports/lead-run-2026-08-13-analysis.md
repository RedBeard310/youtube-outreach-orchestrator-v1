# Lead Run Debrief — 2026-08-13 (analysis companion)

**Headline: +149 parked, the best day since 08-10, and the pipeline is running on
Postgres. Two things need your attention. The parked pools read less than half
what they read in Airtable, and the row count says nothing was lost, so those
labels need reconciling by hand. And the health check built yesterday to catch a
dead daemon reported the day's biggest producer as dead. Both are covered below.
Two fixes shipped.**

Cycle window: 2026-08-12 07:00Z → 2026-08-13 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-13.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+149** | pool 1,964 → 2,113. Was +18 |
| `needs_contact` pool | **2,508** | |
| **Total parked, 0 sent** | **4,621** | see the pool caveat below |
| Discovered | **8,482** | was 212. 40× |
| Pitchable (score ≥ 6) | **391** | 4.6% of intake, down from 21.7% |
| Of today's cohort | 148 → `approved_hold`, 229 → `needs_contact` | 7,719 below threshold, 278 niche-excluded, 108 unreviewed |
| Emails verified | **148** | 37.8% of pitchable |
| `scoring_failed` | **0** | rate 0.0%, eighth clean day |
| Campaign sessions | **15 real** | 1 more was `campaign:dry`, excluded |
| Finder passes | **173 real** | 3 more belonged to the dry run |
| Keyword-engine pitchable | **77** | **0.44/pass**, down from 0.96 |
| Fades / discovers / promotes | 165 / 179 / 173 | |
| **Hard stops** | **8** | all `term_supply_exhausted` |
| Quota stops | **0** | second clean day |
| Time-budget stops | **6 of 15** | |
| Net-new channels written | 344 | across 118 passes that wrote anything |
| YouTube key pool | **52** | was 39 on 08-11 |
| Anthropic spend | **$0** | |
| OpenRouter spend | **$0.64** | 794 calls. First day it was measured at all |
| `fatal_signatures` | **[] empty** | 14th straight cycle |

One row is a correction. The snapshot counts 8,513 discovered, 396 pitchable and
149 verified. Its lead query had no upper bound, so 31 rows the sweeps wrote
between the cycle closing at 07:00Z and the debrief running at 07:20Z counted as
part of the day. Closing that window shipped today, and the corrected figures are
the ones above.

## The shape of the day

Five hours of nothing, then nineteen hours of the strongest finding in three days.

The migration freeze held until 11:45Z. From 12:00Z on, all five discovery
methods ran together for the first time since 08-10, and intake never dropped
below 278 channels in an hour. Fifteen campaign sessions ran, six of them to
their full time budget, which is the highest count of full-length sessions in a
week. Pitchable finds peaked at 20:00Z (37) and 17:00Z (35), and the overnight
hours held steady rather than dying off the way they did on 07-16.

Nothing crashed. No session stopped for quota. Eight stopped when they ran out of
search terms, which is the same wall as the last three days and is discussed below.

## What actually happened

### 1. The Postgres cutover is live and working, and the two parked pools do not reconcile

The campaign resumed on the new store and ran a clean 19 hours against it. That
part is settled. But the two numbers that matter most came across at under half
their Airtable values, in one jump:

| Pool | Last Airtable reading (08-11 19:47Z) | First Postgres reading (08-12 12:48Z) |
|---|---:|---:|
| `approved_hold` | 4,661 | 1,964 |
| `needs_contact` | 5,783 | 2,508 |

The hourly parked sampler has no readings between those two, because it stopped
when the halt flag went up and resumed after the cutover. So the drop is exactly
the cutover, with nothing else in the window.

**The rows themselves reconcile, which is the important part.** Postgres holds
53,913 lead rows, every one a distinct channel, with history back to 2026-05-13.
Subtracting the 8,482 found this cycle leaves 45,431 rows that predate it. The
migration plan recorded the Airtable lead base at 44,541 rows on 08-10, and two
days of finding sit between those two counts. That lines up. Nothing was dropped.

So this is a labelling difference, not a data loss, and it needs a person. Two
candidates I could not separate from here: either about 2,700 rows arrived
carrying a different `review_status` than they had in Airtable, or the Airtable-era
counts were reading something the Postgres counts are not. There are no case
variants in the new store to explain it away. `approved_hold` appears exactly
once, at 2,113.

**The check that would settle it cannot run from this box.** The migration plan
says to keep Airtable in place read-only for a week as the rollback path, and
`pipeline-db/scripts/verify-against-airtable.ts` exists to do exactly this
comparison. The Airtable token in the shared env now returns
`401 AUTHENTICATION_REQUIRED` on that base, so neither the parity script nor the
rollback path is reachable. Worth knowing before the week is up.

This is not a reason to stop the pipeline. The campaign only adds rows, so
running does not make the question harder to answer.

### 2. The day's biggest producer was reported as dead

Yesterday's fix added productivity measurement to the health block, so that a
daemon which is alive but doing nothing stops looking healthy. Today it reported
this:

```
"peer_sweep": { "runs_in_cycle": 24, "seeds_advanced": 0, "productive": false }
```

Peer-network comments wrote **6,664 channels today, 79% of all intake**, and
walked 4,610 seeds doing it. The measurement was wrong in two ways at once, and
both come from the same assumption: that a daemon's session log is a finished
thing by the time the debrief reads it.

- **The one log that mattered was excluded.** The filter kept logs whose last
  write landed inside the cycle. Peer-sweep has been running a single session
  since 08-12 12:06 and is still writing to it, so its modification time sits
  after the cycle end and the file was dropped. What was left were the four
  crashed one-minute restarts from 12:01 to 12:04.
- **Even included, it would have measured zero.** The seeds-advanced figure came
  from the startup line (`| 2470 done |`), first log against last log. A session
  that has not restarted still prints its original startup number, so nineteen
  hours of work reads as no movement.

Both are fixed. Sessions are now matched by interval overlap using the timestamp
in the filename as the start, and each session's advance is read from its last
chunk line minus its startup line, then summed. Against today's real logs:

| Method | Reported | Actual |
|---|---:|---:|
| Peer-network comments | 0, idle | **4,610** |
| Recommended-videos feed | 423 | **481** |
| Comment sweep | unknown | **10** |
| Podcast crossover | unknown | unknown, correctly |

Podcast crossover prints no chunk lines at all, so it still reports unknown
rather than zero. That distinction is deliberate. An unknown is a gap in
measurement, and calling it zero is how a working daemon gets reported as broken,
which is the whole bug.

This is the third time in four days that the reporting was wrong before the
pipeline was. It is worth saying plainly: the finding machinery has been more
reliable than the instruments watching it.

### 3. Volume is up, precision is down, and one method is responsible for both

All five methods ran. Here is what each was worth:

| Method | Found | Pitchable | Rate | Parked |
|---|---:|---:|---:|---:|
| Peer-network comments | 6,664 | 200 | **3.0%** | 67 |
| Recommended-videos feed | 867 | 111 | **12.8%** | 54 |
| Keyword search | 931 | 77 | 8.3% | 26 |
| Guest-link mining | 17 | 3 | 17.6% | 1 |
| Podcast crossover | 3 | 0 | — | 0 |

Peer-network is 79% of intake and 51% of pitchable at a 3.0% hit rate. It is the
reason the day's overall pitchable rate reads 4.6% against yesterday's 21.7%,
and it is also why the day parked 149 instead of 18. Both statements are true.

The cost is not free, though. That one daemon exhausted the daily quota on **20
of the 52 YouTube keys** in a single session. The seeds it is walking explain the
hit rate: the biggest contributors this cycle were channels named "Rob the
Maritimer" (135 channels, 1 pitchable), "Asian Dad Energy" (43 channels, 1) and
"Ty Myers" (183 channels, 4). It is mining the comment sections of creators well
outside the ICP.

This has been lever #2 or #5 for four days running. It now has a number attached:
it spends 38% of the key pool to supply half the pitchable leads, and its seed
list is the thing to fix, not its throughput.

### 4. The niche mix reopened

Yesterday Legal Services was 59% of pitchable and the mix was the narrowest on
record. Today Legal Services is 7 of 391, and the top of the list is Coaching &
Consulting (123), Transformation & Performance Coaching (63) and Real Estate (48).

That is the sweeps' mix rather than the keyword engine's. When the sweeps stopped
on 08-12 the keyword engine's single remaining vein became the whole picture.
Nothing was fixed about term supply. The other methods came back.

### 5. Term supply is still the wall for the keyword engine

Eight sessions hard-stopped, all on `term_supply_exhausted`, and the finder
logged 10 starvation observations. 118 of 173 passes returned zero fresh
pitchable, and per-pass yield fell to 0.44 from 0.96.

The keyword harvest ran 9 times out of 179 chances and wrote 137 probes,
57 and 66 of them in two good runs. The other 170 were skipped: 76 under the
low-yield backoff, 94 under the 4-hour cadence gate. Both gates are working as
designed. The question is whether a 6-hour backoff is right on a day when eight
sessions stopped for want of terms, and that is a tuning call worth making
deliberately rather than in an unattended cycle.

### 6. Two things quietly got better

The peer-sweep crash that killed every run at 12:01, 12:02, 12:03 and 12:04
(`ReferenceError: Cannot access 'info' before initialization`) was fixed during
the migration window by finder commit `70d364e`, which also put `scripts/` under
typecheck so the next one gets caught before it ships. The session that started
at 12:06 has run 19 hours without incident.

And OpenRouter spend is now measured per call (finder `d38731a`), which closes a
standing item that has been on this list since 08-10. Today's figure is $0.64
across 794 calls. It is a partial day, since the meter only started when the
commit landed.

## Yesterday's fixes, checked

| Prediction | What happened | Verdict |
|---|---|---|
| The shared quota gate stops the sweeps pausing on a retired backend | 0 quota stops, all five methods ran | confirmed |
| The sweeps honour the halt flag and self-resume when it lifts | All resumed within 15 minutes of the freeze lifting, nothing restarted by hand | confirmed |
| Dry-run sessions stop counting as cycle work | 1 excluded, real event counts unchanged | confirmed |
| Sweep productivity makes an idle daemon visible | It made a working daemon look idle instead. Fixed today | no |

## What shipped

One commit in the orchestrator. Typecheck clean, nine unit cases green, and the
whole snapshot regenerated against today's real logs before committing. No `.env`
file was touched.

| Repo | Commit | Change |
|---|---|---|
| `youtube-outreach-orchestrator-v1` | `4fa0f51` | Sweep productivity counts a still-running session, and the cycle window closes at the cycle end |

**The session measure.** `sessionStartMs` reads a log's start from the timestamp
in its filename and falls back to modification time when there isn't one, so a
session is matched to the cycle by overlap rather than by where its last write
landed. `sessionSeedsAdvanced` takes each session's last chunk line minus its own
startup line, clamped at zero so a mid-cycle seed refill can't push the total
negative, and returns unknown when a session printed no progress at all. The
per-session totals are summed. Both are exported and covered by
`scripts/autopilot/debrief-data.selftest.ts`: a long unfinished session, a
startup-only session, a log with no startup line, a finished sweep, a refill
reset, a crash on the first chunk, and three filename shapes.

**The window bound.** The lead query is open-ended and gets everything since
midnight PT, so rows written while the debrief itself runs used to count as part
of the day. They are now trimmed at the cycle end in TypeScript rather than in
the filter formula, because the Postgres translator refuses any expression it
can't render exactly and a debrief that returns nothing is worse than one that
returns 0.2% too much. The comparison parses both timestamps rather than
comparing strings: Postgres returns `2026-08-13 07:23:19.265+00`, and lexically
that sorts before `2026-08-13T07:00:00.000Z`, so a string compare would have kept
every row it was meant to drop.

## Ranked next

1. **Reconcile the two parked pools, and do it before the Airtable week runs
   out.** 4,661 → 1,964 and 5,783 → 2,508 across the cutover, with the row count
   saying nothing was lost. The Airtable token on this box returns 401, so the
   parity script and the rollback path both need a working credential first.
   This is the only item that needs you rather than code.
2. **Fix peer-network's seed list.** 79% of intake, 3.0% hit rate, and 20 of 52
   keys exhausted in one session. The problem is which channels it walks, not how
   fast it walks them. Half the day's pitchable leads come from it, so tighten the
   seeds rather than capping the daemon.
3. **Decide the outlet for `approved_hold`.** 2,113 prepped, none emailed. Second
   week at the top of this list.
4. **Term supply for the keyword engine.** 8 hard stops, 0.44 pitchable per pass,
   and the harvest skipped 170 of 179 chances under two gates that are each
   individually correct. Worth retuning the 6-hour low-yield backoff on purpose.
5. **Build the `needs_contact` recovery engine.** 2,508 creators found, scored and
   unreachable.
6. **Give the hourly check-in the sweep productivity numbers.** Today's fix makes
   a broken daemon visible once a day. Hourly would have caught the 08-12 outage
   in an hour instead of two days, and would have caught today's false alarm
   before it reached a report.

## Status

Everything is parked, nothing sent. `approved_hold` 2,113 plus `needs_contact`
2,508 is **4,621 creators found and never contacted**, subject to the
reconciliation question above. $0 on Anthropic, $0.64 on OpenRouter. Zero
crashes, zero scoring failures, zero quota stops, no fatal signatures for the
14th straight cycle.

The campaign is running and I have left it that way. The next cycle should be the
first full 24 hours with all five methods live on Postgres, which makes it the
first clean read on what this pipeline actually produces.
