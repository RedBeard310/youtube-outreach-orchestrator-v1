# Lead Run Debrief — 2026-08-11 (analysis companion)

**Headline: +29 parked, the worst day on record, and it was self-inflicted. Every repo in the pipeline was rotating 7 YouTube keys while the shared key bank held 39. When those 7 hit their per-minute limit the runs fell through to the RapidAPI mirror we retired on 08-10, which answered "daily quota exceeded" and killed them. That dead answer then convinced the campaign its quota was gone, so the last 8 hours ran one finder pass per session and stopped. Nothing was actually out of quota. Fixed in four repos.**

Cycle window: 2026-08-10 07:00Z → 2026-08-11 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-11.json`.

## The numbers

| Metric | Value | Note |
|---|---|---|
| Parked → `approved_hold` | **+29** | pool 4,613 → 4,642. Was +350 yesterday. Lowest on record |
| `needs_contact` pool | **5,755** | +50. Both lanes stalled together |
| **Total parked, 0 sent** | **10,397** | 4,642 + 5,755 |
| Discovered | **930** | was 5,332. Down **83%** |
| Pitchable (score ≥ 6) | **102** | 11.0% of intake, down from 16.9% |
| Of today's cohort | 34 → `approved_hold`, 62 → `needs_contact` | 719 below threshold, 45 niche-excluded, 70 unreviewed |
| Emails verified | **3** | |
| `scoring_failed` | **0** | rate 0.0%, sixth clean day |
| Campaign sessions | 21 started / 22 done | was 16 |
| Finder passes | **72** | was 132. Down 45% |
| Keyword-engine pitchable | **69** | **0.96/pass** |
| Fades / discovers / promotes | 54 / 76 / 58 | 54 fades against 72 passes |
| **Hard stops** | **14** | all `term_supply_exhausted`. Was 0 |
| **Quota stops** | **6** | all false. See below |
| Time-budget stops | **2 of 21** | was 16 of 16 |
| `term_starvation` observations | **6** | was 0 |
| Net-new channels written | 282 | across 46 passes that wrote anything |
| Anthropic spend | **$0** | pipeline runs on OpenRouter (unmetered here) |
| `fatal_signatures` | **[] empty** | 12th straight cycle, and badly misleading today |

The empty fatal-signature list is the thing to notice. Nothing crashed. Every
component reported success while the pipeline delivered 8% of yesterday's output.

## The shape of the day

One healthy session, then eight hours of decay, then eight hours of near-silence.

The first session (closed 09:01Z) ran 14 passes, found 35 pitchable and parked 16.
That single session produced **half the day's keyword-engine pitchable**. Every
session after it was worse than the one before. From 22:44Z onward, six consecutive
sessions ran exactly **one finder pass each** and stopped.

38 of 72 passes returned zero. The final 22 passes were all zero.

## What actually happened

Three failures stacked. The first two are the same root cause and are now fixed.

### 1. Every repo was running 7 keys against a 39-key bank

The pool was rebuilt on 08-10 from the Notion database, going from 9 keys to 39,
and every key was tested live before it landed. That work went into the shared env
bank at `~/env-storage/.env`.

No repo read it. The finder, the email repo and the deep-research repo each load
keys with `dotenv/config`, which reads that repo's own `.env` file and nothing
else. Those files were last written on 08-07 and hold 7 keys each. So the 39-key
pool existed, was verified working, and reached nothing.

Measured, not inferred: the finder's own startup line said
`YouTube backend: auto (7 direct keys, RapidAPI fallback available)`. After the
fix it resolves 39, and a live 1-unit API call on the new pool succeeds.

**This hit every discovery method at once, not just the keyword engine.** All five
sweep daemons (recommended-videos feed, peer-network, comment sweep, podcast
crossover, guest-link mining) live in the finder repo and share the same client and
the same key loader. That is why intake fell 83% across the board rather than in
one lane:

| Method | Creators (yesterday) | Creators (today) | Change | Pitchable | Hit rate |
|---|---|---|---|---|---|
| Recommended-videos feed | 2,028 | **381** | −81% | 47 | 12.3% |
| Peer-network comments | 1,280 | **269** | −79% | 7 | **2.6%** |
| Keyword search | 1,017 | **250** | −75% | 43 | 17.2% |
| Comment sweep | 986 | **16** | −98% | 2 | 12.5% |
| Podcast crossover | 10 | 10 | flat | 2 | 20.0% |
| Guest-link mining | 11 | 4 | −64% | 1 | 25.0% |

All four background services still reported fresh, healthy state at snapshot time.
They were running. They just had almost no key capacity to run on.

### 2. A burst of rate limits looked identical to a dead pool

With only 7 keys, a single pass would rotate through all of them inside about
three seconds and get a per-minute rate limit from each. The rotation code treated
"every key is currently rate-limited" the same as "every key is permanently dead",
threw `AllKeysExhaustedError`, and auto mode did what it is designed to do: it fell
through to the RapidAPI mirror.

The mirror was retired on 08-10. It answered:

```
YouTube API error 429: You have exceeded the DAILY quota for Requests
on your current plan, BASIC.
```

and the run aborted. A per-minute limit clears in under 60 seconds. Nothing here
needed to fail; it needed to wait.

### 3. The retired mirror then convinced the campaign it was out of quota

This is the part that cost the last eight hours.

The finder's quota guard writes a snapshot of RapidAPI's rate-limit headers to
`logs/quota-state.json`. A dead RapidAPI plan reports `remaining: -1`, which the
guard turns into `used_pct: 100.1`. The campaign governor reads that file before
every pass and hard-stops the whole session above 95%.

So from 22:44Z the log reads, once per session:

```
[campaign] YouTube quota at 100.1% (>= hard floor 95%) — stopping to preserve remaining credits.
```

There were no credits to preserve. The governor was protecting a backend we had
deliberately switched off, while the real backend sat idle and healthy. Six
sessions, one pass each, zero leads.

### 4. Term supply is a separate, real wall

The 14 `term_supply_exhausted` hard stops are not part of the key story. They are
genuine, and they were the whole first half of the day.

The finder reported `active pool exhausted (only 8 active terms < 12); NO
never-run and NO cooled proven terms remain`. Vein discovery ran 76 times and
generated **0 unique in-ICP candidates** against a 16,134-term table. The keyword
harvest is in its low-yield backoff because the autocomplete seed set is mined out.
All three term sources are dry at the same time, which has not happened before.

**One thing worth knowing: the term table was not poisoned by the famine.** I
checked whether failed searches could get healthy terms auto-paused as saturated.
They can't. `term_stats.ts` excludes fetch failures from the saturation signal
specifically so a 429 storm can't retire a good term. The 08-11 terms are dry
because they're genuinely mined out, not because the keys died.

## What shipped

Four repos. Every change was typechecked and functionally tested before commit,
and no `.env` file was touched.

| Repo | Commit | Change |
|---|---|---|
| `youtube-lead-finder-v1` | `d1a9a5b` (diff in `82119b2`/`ba8de79`) | Reads the shared key bank; a 429 burst no longer reads as a dead pool |
| `youtube-outreach-orchestrator-v1` | `fabefa9` (diff in `690e47d`) | A retired RapidAPI can't hard-stop the campaign |
| `youtube-email-outreach-v1` | `353be16a` | Reads the shared key bank |
| `youtube-deep-research-v1` | `6be528f` | Reads the shared key bank |

**The key-bank merge.** Each repo's key loader now also reads
`YOUTUBE_API_KEY[_n]` slots from the shared bank (`$SHARED_ENV_FILE`, then
`~/Claude/env-storage/.env`, then `~/env-storage/.env`), matching the pattern
`quick-youtube-channel-research-v1` has used all along. That repo has no local
`.env` at all, which is exactly why it was the only one not affected.

Two design details that matter:

- **It merges by value, not by layering.** The obvious approach is
  `dotenv.config({path: bank})`, but dotenv's `override: false` means a stale
  local slot *name* wins, and the bank's key sitting in that same slot is thrown
  away. Here that would have silently discarded 7 of the 39 keys. Parsing the bank
  and merging on key value keeps every distinct key from both files.
- **It only merges on the ambient process env.** Pass an explicit env object and
  you get exactly what you passed. Without that, 9 of the finder's tests broke and
  one leaked a real API key into test output. Tests stay hermetic.

An unreadable bank degrades to the smaller pool. It never fails a run.

**The rate-limit backoff.** A sweep that ends with every eligible key merely
rate-limited now waits out the per-minute window and sweeps again, twice, at 20s
then 40s (`YT_RATE_LIMIT_WAIT_MS`, `YT_RATE_LIMIT_MAX_WAITS`). A genuinely dead
pool, meaning quota-exhausted or project-suspended keys, still fails fast with no
waiting at all. Verified all three ways: a burst recovers, a dead pool throws in
1ms, and a permanent storm gives up after a bounded 1 + 2 sweeps rather than
hanging.

**The governor fix.** A negative `remaining` means the backend is gone, not that
quota is low, so the governor now goes inactive on it. Buckets reporting real
headroom still govern normally, so the 80% throttle and 95% stop stay correct if
RapidAPI is ever revived. Verified against five snapshot shapes including today's
real file. `npm run campaign:dry` now walks past run 2 instead of stopping there.

## Yesterday's fix: verified, exactly as predicted

Yesterday shipped the yield-attribution fix and predicted reported per-pass
fresh-pitchable would fall to about 2 and nearly every pass would fade.

Actual: **0.96 per pass**, and **54 fades across 72 passes**. The metric is now
measuring the keyword engine's own work instead of crediting it with the daemons'.
Both predictions landed. The low number is correct reporting, not a regression,
though today it is also genuinely low.

## Per session

| Session closed (UTC) | Passes | Pitchable | Wall | Harvest ran/skipped | Parked | Stopped on |
|---|---|---|---|---|---|---|
| 08-10 09:01 | 14 | 35 | 91m | 0/15 | 16 | time budget |
| 08-10 10:28 | 11 | 11 | 85m | 1/10 | 6 | term supply |
| 08-10 11:17 | 3 | 0 | 18m | 1/2 | 1 | term supply |
| 08-10 11:49 | 1 | 0 | 2m | 0/1 | 0 | term supply |
| 08-10 13:19 | 7 | 10 | 60m | 1/6 | 1 | term supply |
| 08-10 14:16 | 4 | 2 | 27m | 1/3 | 1 | term supply |
| 08-10 14:49 | 1 | 0 | 2m | 0/1 | 0 | term supply |
| 08-10 16:00 | 7 | 4 | 41m | 1/6 | 0 | term supply |
| 08-10 17:02 | 3 | 0 | 31m | 1/2 | 0 | term supply |
| 08-10 17:34 | 1 | 0 | 2m | 0/1 | 0 | term supply |
| 08-10 19:26 | 8 | 7 | 81m | 1/7 | 4 | term supply |
| 08-10 20:18 | 1 | 0 | 22m | 1/0 | 0 | term supply |
| 08-10 20:50 | 1 | 0 | 2m | 0/1 | 0 | term supply |
| 08-10 21:30 | 1 | 0 | 10m | 1/0 | 0 | term supply |
| 08-10 22:03 | 1 | 0 | 2m | 0/1 | 0 | term supply |
| 08-10 22:44 | 1 | 0 | 11m | 1/1 | 0 | **quota (false)** |
| 08-11 00:17 | 1 | 0 | 2m | 0/2 | 0 | **quota (false)** |
| 08-11 01:50 | 1 | 0 | 3m | 0/1 | 0 | **quota (false)** |
| 08-11 03:26 | 1 | 0 | 5m | 0/1 | 0 | **quota (false)** |
| 08-11 05:08 | 1 | 0 | 11m | 1/0 | 0 | **quota (false)** |
| 08-11 06:41 | 1 | 0 | 3m | 0/1 | 0 | **quota (false)** |
| **Total** | **72** | **69** | | **11/62** | **29** | |

Sessions got shorter as the day went on because they were failing earlier, not
because they were working faster. Fourteen of 21 ran under 30 minutes against a
90-minute budget.

## Niche mix

Real Estate & Property fell from 39.8% of pitchable to **6.9%** (7 of 102). That
tracks the recommended-videos feed collapsing, since the feed is what compounds
into Real Estate. Today's top niches are Coaching & Consulting 18, Legal Services
17, Other 16, Transformation & Performance Coaching 12, Real Estate 7, Health &
Wellness Clinics 7. The mix is more even than yesterday, but only because the
dominant source stopped working.

`demo_niche_excluded` caught 45 rows. Three excluded categories still show single
counts in the niche tally (Dating & Relationships 2, Interior Design 1), which is
the scored-but-excluded rows appearing in the breakdown, same as yesterday.

## Ranked next

1. **Term supply is now the binding constraint, and all three sources are dry
   at once.** The active pool is down to 8 terms, there are no never-run or cooled
   proven terms left in reserve, 76 discovery runs produced 0 usable candidates
   against a 16,134-term table, and the autocomplete harvest is backed off because
   its seed set is mined out. The key fix restores capacity to search, but there is
   very little left to search for. This needs new seed material or a wider ICP, and
   it's the first thing that will cap tomorrow.
2. **Watch tomorrow's first session to confirm the key fix lands.** Expect the
   finder's startup line to read 39 direct keys instead of 7, zero quota stops, and
   the sweep daemons back near their 08-10 volumes. If intake recovers but parked
   stays low, the constraint is term supply alone and item 1 is the whole story.
3. **Decide the outlet for `approved_hold`.** 4,642 creators prepped, none
   emailed. This has led the list for over a week. It's still the only item that
   needs a decision from you rather than code.
4. **Build the `needs_contact` recovery engine.** 5,755 creators, still the larger
   lane.
5. **Peer-network comments is still the weakest method.** 2.6% hit rate today
   against 12% to 25% for everything else, and second-largest intake. Yesterday's
   recommendation to cap or tighten it stands, and now there's a second day of
   evidence.
6. **Consider retiring the RapidAPI quota guard entirely.** Today it did active
   harm and provided no benefit, because the backend it governs is gone. The fix
   makes it inert rather than harmful, which is the safe minimum. Deleting the
   mirror path outright would remove a whole class of this failure, but that's a
   larger change than an autopilot cycle should make unattended.
7. **Meter OpenRouter as a real cost.** Still unmetered. The ledger reads $0
   because it only counts Anthropic.

## Status

Everything is parked, nothing sent. `approved_hold` 4,642 plus `needs_contact`
5,755 is **10,397 creators found and never contacted**. $0 on Anthropic. Zero
crashes, zero scoring failures, no fatal signatures.

The loop is still running and has not been paused. Nothing here was unsafe to
leave running: the failure mode was doing too little, not spending too much, and
the three fixes are in place for the next cycle.
