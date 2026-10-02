# Lead run analysis, cycle 2026-10-01

Companion to [lead-run-2026-10-02.html](lead-run-2026-10-02.html). Cycle window
2026-10-01T07:00Z to 2026-10-02T07:00Z, which is Thursday 2026-10-01 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-02.json`.

## Headline

**The best parking day in three weeks, and October's paid budget is already gone.**

The paid recovery lane ran nine batches, scraped **881 channels**, found **672
email addresses** and recovered **472 leads** at **13.1 cents** each. The parked
pool went 7,062 to **7,587**, a gain of **525**, which is the third-largest daily
gain on record (789 on 09-15, 627 on 09-03).

Then it ran out. Apify's $100 monthly allowance stood at **$90.00 used, $10.00
left** when the last batch finished at 01:09Z, and the $10 is a reserve the lane
refuses to spend. It has logged `resting: $10.0 left, $10 reserved, $0.0
spendable` at 02:22, 04:22 and 06:22Z. **29 days of October remain with nothing
to spend on them.**

Two numbers follow from that. Researching 525 new leads cost real money, so the
OpenRouter rate went **$19.52/day to $50.91/day** and the runway **8.5 days to
2.2**. And the free half of the recovery lane, which is the only lane left for the
rest of the month, found **six** addresses.

## The paid lane, batch by batch

Logs: `youtube-email-outreach-v1/logs/apify-endspec-2026100*.log`. Nine batches
fell inside the window (08:22Z through 00:22Z).

| Batch | Channels | Addresses | Recovered | $/recovered |
|---|---|---|---|---|
| 08:22 | 100 | 81 | 58 | $0.121 |
| 10:22 → 22:21 (7 batches) | 700 | 536 | 376 | $0.131 avg |
| 00:22 | 81 | 55 | 38 | $0.150 |
| **Total** | **881** | **672** | **472** | **$0.131** |

The 00:22 batch is the last of the month: the loop sized it to 81 channels
because that is what $5.69 of spendable allowance buys, which is also why its
unit cost is the highest of the nine.

Ledger readings off the top of the run logs: **$28.15 used at 08:22Z**, **$90.00
used after 00:22Z**. So the cycle spent **$61.85** and the month is **90% gone on
day two**.

## Free searching is finished on this book

| | Points | Email addresses | Leads touched |
|---|---|---|---|
| Paid lane, this cycle | 701 | 701 | 701 |
| Free pass, this cycle | 41 | **6** | 19 |
| Free pass, prior 7 days | 160 | 25 | — |

Counted from `leads.contact_points` by `source` prefix. The free pass is on lap 7
of a 2,525-lead book, so most of what it reads it has already emptied. That is a
picked-over book, not a fault, and no money fixes it.

Two things that look like faults and are not:

- **Both Brave keys still answer `402 Usage limit exceeded`**, and this cycle it
  cost almost nothing. Only **2%** of the leads the cursor read lacked a stored
  website (8 of the last 500 lead lines in `bloodhound-collect.log`). Brave
  matters when the cursor re-enters the part of the book with no stored site.
- **`collect_book_stranded` held at 3** for the nineteenth day, so no selector gap
  has reopened.

## The send: 135 of 150, because a timer killed it

Siege's plan held 150 assignments, the warmup ramp allowed 150, and 36 live
mailboxes would have taken 178. The plan, the sample, the approval and the push
all ran off one timer starting 10:15Z, and **nobody approved anything**, because
Casey put a standing approval in place on 2026-09-30:

```
"note": "standing approval, Casey 2026-09-30: Siege no longer requires approvals"
```

That closes yesterday's lever #3 outright. What stopped the day was different and
smaller:

```
siege-plan.service: Active: failed (Result: timeout) since Thu 2026-10-01 11:17:22 UTC
Process: siege-plan.py --live --approved (code=killed, signal=TERM)
```

`siege.log` ends mid-batch at 11:16:57Z with a `push-batch` command that never
printed a result, and nothing has been written to it in the 20 hours since. 132
`SENT` lines inside the window, 1 skipped, 0 failed, 0 blocked; the database
counts 135 by `outreach_processed_at`, the small difference being leads the push
had already flipped either side of the boundary.

**Why it ran out of time.** The unit is a `Type=oneshot` with five sequential
`ExecStart` steps and a single `TimeoutStartSec=3600` covering all of them. Steps
one to three took about two minutes. The push ran 86 small batches of one to
three emails, each paying roughly 35 seconds to start a fresh `npx tsx` process,
and 86 startups is the hour. Yesterday's debrief measured exactly this and wrote
"it works and it is not a fault, just slow." It became the fault the first day the
plan was big enough to cross the line. The fifth step, `siege-report.py`, never
ran at all.

One detail worth not mis-reading: 23 leads were flagged `review   business owner
(no clean job title exists)` by the `owner-or-youtuber` builder, and **21 of them
were sent anyway** on the fallback title. The review flag is not what cost the 15.

Six of Siege's 16 offers ran (`short-work-with-me-video` 40,
`joke-ai-slop` 30, `attack-enemy-propose-5-ideas` 25, `short-save-time` 19,
`owner-or-youtuber` 18, `voice-objection-proof` 18). Nine still cannot run, for
the same small named reasons as the last four debriefs.

## Enrichment kept up, and that is the OpenRouter bill

Eight batches, **582 leads enriched, 23 failed**, nothing in flight at cycle
close, and at 06:35Z on 10-02 the chain logged `no pending inflow — idling`. The
shelf is caught up: **7,577 of 7,587** parked leads have a research bundle
(99.9%), **7,113 ready to write**.

Batch sizes went 66, 67, 59, 52, 61, 60, 104, 129, 101, 39 as the paid lane fed
it. The unit cost of research fell with the batch size, from **$0.1468 per lead
yesterday to $0.0876** today, which is the one piece of good news in the money
section.

## Finding 1: systemd killed the send and the snapshot called it a partial push

**Shipped: `da7a159`, youtube-outreach-orchestrator-v1. The real repair is one
line in a root-owned unit and needs Casey.**

`binding_constraint: partial_push` is the snapshot's way of saying a plan moved
some of its emails and not the rest. It reads as a soft shortfall, a few leads a
writer could not finish. Yesterday it was exactly that. Today it was a process
killed by a timer, 15 emails dropped and never retried, a service left in a
`failed` state for 20 hours, and not one line anywhere in the pipeline saying so.

The snapshot now reads the unit's own verdict:

```json
"push_unit_result": "timeout",
"binding_constraint": "push_killed"
```

Three design calls:

- **Only a run that started inside the cycle window may speak for that cycle.**
  The timer runs Mon-Fri, so on a Monday debrief covering Sunday the unit's result
  belongs to Friday. `pushRunVerdict()` returns null rather than reporting the
  wrong day's outcome.
- **A real ceiling outranks a late kill.** A push killed after it had already sent
  everything the ramp allowed cost nothing, so `day_cap` and `mailbox_slots` still
  win. `push_killed` only fires on a day that fell short.
- **Local systemd only**, no network and no token, the same rule every other probe
  in that file follows. An unprobeable unit reports null, never a guess.

The note on the block was also corrected: it still told readers that
`approval_pending` means a person left a batch standing, which stopped being true
on 2026-09-30.

*Verified:* `tsc --noEmit` clean; selftest **ALL PASS** with 9 new cases (the real
10-01 shape, the same shortfall with the unit reporting success staying
`partial_push`, an unmeasured verdict falling back, a late kill losing to the
ramp, and a Friday verdict refusing to describe Sunday); gatherer run end to end
on live data returns `push_unit_result: "timeout"` and `binding_constraint:
"push_killed"`.

**What Casey needs to do:** `TimeoutStartSec=3600` to `TimeoutStartSec=4h` in
`/etc/systemd/system/siege-plan.service`, then `systemctl daemon-reload`. Root
owns it, so an agent cannot. Worth doing alongside: the push spends most of its
hour starting a new process for every one to three emails, so pushing in batches
of twenty would turn the hour into minutes and make the limit irrelevant.

## Finding 2: the free lane was credited with the paid lane's 701 addresses

**Shipped: `fd88b5a`, youtube-outreach-orchestrator-v1.**

`leads.contact_points` is a shared table. The free collect pass writes under its
method name (`01-mailto`, `34-channel-page`, `16-jsonld`), and the paid lane
writes under `apify:endspec/youtube-instant-email-scraper`. The snapshot counted
one total, so the day reported **742 contact points, 707 emails**, which reads as
the best day the free lane has ever had. It found six addresses.

The comment on `collectYieldBetween()` says the function exists so a debrief "can
tell a picked-over book from a broken lane." It could not, because the number it
produced was mostly somebody else's work.

This was caught **by hand** in yesterday's debrief (282 paid against 10 free),
which is precisely why it belongs in code: a hand-count does not survive the
author's attention moving elsewhere. The block now carries `free_*` and `paid_*`
beside the unchanged totals, and the note names which pair is the lane.

It mattered the same day rather than in principle. Apify's month ended at 02:22Z
and the next 29 days belong to the free pass alone, so a reader who believed the
lane had just produced 707 addresses would draw the opposite conclusion about what
happens next.

The discriminator is the `source` prefix, held in one list. A new free method
needs no change here; a new paid writer adds itself to
`PAID_POINT_SOURCE_PREFIXES`. A NULL source predates the column and counts as
free, which is why the test is written for the paid prefix rather than against it.

*Verified:* `tsc` clean; gatherer run on live data returns 41 free / 6 free
addresses / 701 paid, matching a hand-written SQL count of the same window.

## Finding 3: a YouTube outage charged ten good leads an enrichment attempt

**Shipped: `fd88b5a`, same commit.**

A lead gets three enrichment attempts and is then dropped from the pool
permanently, which is what stops one genuinely broken channel looping forever.
`chain.sh` already refunds a **whole batch** when the batch obviously died of
infrastructure: the mass-failure guard above 100 failures, and the zero-progress
guard at 0 done with 2+ failed. Neither can see a batch that worked.

The 15:35 batch enriched 92 and failed 12, and ten of the twelve died on this:

```
endpoint: 'videos', status: 503, "reason": "backendError"
"The service is currently unavailable."
```

Google being briefly unavailable. Nothing to do with the channel. The batch looked
healthy, so each of those ten quietly spent a third of its lifetime, with no log
line naming why.

**Nothing was lost this cycle.** All ten are now `ready_data_scraped`: the pool
was large enough to re-offer them and they enriched fine later in the day. The
leak is cumulative rather than immediate, and it scales with volume. 23 attempts
were charged this cycle, and inflow is now 500 leads a day whenever the paid lane
runs.

The fix refunds **per lead** by striking the transiently-failed ids out of the
batch's own ids file, which is exactly what `next-batch-ids.cjs` counts attempts
from. Safe by construction: an enriched lead leaves the pool through its
`outreach_status` flip, never through its attempt count, so editing the attempt
record cannot resurrect finished work.

Three guards keep it honest:

- **Narrow matching.** Only known-transient signatures qualify (upstream 5xx,
  `backendError`, dropped connections, rate limits). An unrecognised failure pays,
  so a genuinely broken lead still ages out. A bad pattern here can only
  under-refund.
- **A lifetime cap.** `transient-refunds.json` caps each lead at three refunds
  ever, so nothing becomes immortal by failing transiently forever.
- **Idempotent.** An id already struck from the file is neither re-reported nor
  charged another slot of its cap, so a replay cannot double-spend.

*Verified:* replayed against all four of this cycle's run logs. The 15:35 batch
refunds exactly 10 and charges the other 2, which are a deleted video (404), a bad
`commentThreads` request (400), a channel that no longer resolves, and a Postgres
`22021` encoding error, every one of them genuinely about that lead. The 12:57
batch refunds 2 of 6, the 08:58 batch 1 of 3, a clean batch 0. Re-running the same
log returns `REFUND=0`; with the ledger pre-loaded at the cap the ids file is left
untouched and the run prints `capped=10`. `bash -n` clean on `chain.sh`.

## Finding 4: the allowance on disk was always one batch stale

**Shipped: `0208785b8` (youtube-email-outreach-v1) and the orchestrator change
beside it.**

Found by writing this debrief, which is the second time in two days that the act
of reading the snapshot found the bug in it. The snapshot said **$15.69 left,
$5.69 spendable**, and the `projection` block priced **43 more recoverable
leads**. The lane had been resting on **$10.00 left, $0.00 spendable** since
02:22Z.

Every tick of `apify-endspec-loop.sh` asks Apify for the live ledger, but only a
tick that **launches a batch** leaves that figure on disk, inside the batch's run
log, and it writes it **before** the batch spends. The snapshot reads those logs,
so once the lane goes to sleep the freshest figure available is the one taken at
the start of the last batch of the month, which is exactly $5.69 short.

The remaining paid allowance is the top budget decision in this pipeline today, so
it should not lag a batch. The lane now writes
`logs/apify-endspec-budget.json` on every tick, resting or not, and the gatherer
prefers it when it is newer than the newest run log's line, falling back
otherwise and reporting which source it used via `budget_read_from`. The write
cannot fail the tick.

The snapshot for this cycle now reads:

```json
"budget_left_usd": 10, "spendable_usd": 0, "budget_read_from": "loop_tick",
"channels_affordable": 0, "projected_leads": 0
```

*Verified:* `tsc` clean, selftest ALL PASS, `bash -n` clean on the loop, and the
gatherer re-run against the lane's real 06:22Z resting reading returns the figures
above.

## What worked, and should not be re-examined

- **Yesterday's price-brake fix earned its keep on day one.** The lane stops
  itself for the month after two consecutive batches above 20 cents a recovered
  lead. The 00:22 batch flipped only 8 addresses itself, because
  `recovery-lane.timer` had already parked 30 of them mid-scrape. Under the old
  accounting that is **$0.71 a lead and strike 1 of 2**. With `countRecovered()`
  it reads **38 recovered at $0.150**, inside the ceiling. `price_strikes: 0`, lane
  still running.
- **Yesterday's budget projection was close.** It predicted the remaining
  allowance would buy about 982 channels and park about 500 leads. It bought 881
  and parked 472.
- **The paid lane stopped itself cleanly**, three resting ticks and counting. It is
  asleep, not broken.
- **The enrichment chain reached the end of its queue**, which has not happened on
  a day with real inflow before.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00** (19th zero) | $0.00 |
| OpenRouter | **$50.91/day**, $114.37 left, **~2.2 days** | $19.52/day, ~8.5 days |
| Apify | **$61.85** spent, **$10.00 left, $0.00 spendable** | $28.08, $78.94 left |
| Brave | $0, both keys at their cap | $0, both keys at their cap |
| Per recovered lead | $0.131 | $0.115 |
| Per enriched lead | $0.0876 | $0.1468 |

The OpenRouter per-lead figure charges every dollar on the account to enrichment,
which is an upper bound and near-exact on a cycle where the research chain is the
only heavy caller. One mitigating fact: the rate falls on its own from here,
because the research queue emptied at 06:35Z and the lane that fills it has no
money left.

## What did not happen, and is fine

- **0 new channels.** Discovery paused since 2026-09-08 on Casey's order. Every
  sweep stopped, flag untouched, ninth debrief carrying it.
- **0 fatal signatures, 0 halts.** No lane wrote a halt flag.
- **15 of 66 YouTube keys working.** Settled: quota was cut on 50 projects.
  Enrichment's ten 503s were Google being unavailable, not the pool.
- **The orchestrator's own send found 0 ready leads** at the 07:20Z boundary.
- **`scripts/backfill/halt.flag`** still logs its "this is not the halt flag" note
  every 30 minutes. It is a decoy artefact, warned about on purpose since 09-30,
  and left alone.

## Open decisions for Casey

1. **Top up OpenRouter today.** $114.37 at $50.91/day is 2.2 days. It was lever #1
   yesterday at 8.5 days and the rate tripled, because research volume follows the
   paid lane. The account hit zero without warning on 08-25 and took every lane
   with it.
2. **Decide what October's recovery budget is.** $90 of $100 spent on day two, and
   the $10 still showing is reserve. At 13 cents a parked lead this is the best
   price per lead anything here has achieved. Doing nothing is a real answer; it
   means nothing adds leads until 1 November.
3. **Raise `TimeoutStartSec` on `siege-plan.service`** to 4h and
   `daemon-reload`. It cost 15 emails and will cost more every day the plan is
   this size. Batching the push twenty at a time would remove the problem rather
   than widen the window.
4. **Decide the discovery pause.** Ninth debrief. The free lane is nearly empty on
   this book and the paid lane has now hit its monthly ceiling, so from today
   nothing in the pipeline adds a new lead.
5. **Raise the Brave cap or add a key.** Still under $3, still not urgent, only 2%
   of reads needed it this cycle. Returns as a real limit when the cursor
   re-enters the no-website part of the book.
6. **Unblock a few Siege offers.** Nine of sixteen down. Variety is what lets a
   7,100-lead shelf be worked without emailing anyone twice.

## Still owed

Six debriefs have grounded metrics on disk and no report: 09-19, 09-18, 09-17,
08-18, 08-17, 07-11.

## Note on the snapshot

`logs/autopilot-debrief-2026-10-02.json` is the scheduled 07:20Z reading
(`measured_minutes_after_cycle_end: 20`), with the `recovery_lane`, `send_plan`
and `recovery_budget` blocks replaced by the versions today's fixes produce. All
three are bounded by the cycle window or by a window-gated probe, so they read the
same whenever they are computed. Every other figure is untouched, as on 10-01.
