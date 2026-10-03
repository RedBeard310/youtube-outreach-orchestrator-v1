# Lead run analysis, cycle 2026-10-02

Companion to [lead-run-2026-10-03.html](lead-run-2026-10-03.html). Cycle window
2026-10-02T07:00Z to 2026-10-03T07:00Z, which is Friday 2026-10-02 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-03.json`.

## Headline

**The research shelf is finished, nothing is adding leads, and the send path got
cut short by a timer for the second day running.**

The parked pool went 7,587 to **7,589**. A gain of **2**, the smallest this
series has recorded, one day after the third-largest (525). Both reasons are
known and neither is a fault: Apify's $100 monthly allowance was spent on 10-01,
and the free collect pass is on lap seven of a 2,524-lead book.

What did finish is the research. The enrichment chain ran **two batches, did two
leads and went idle**, because it had caught up with everything yesterday's paid
lane bought. **7,579 of 7,589 parked leads have a bundle (99.9%), and 7,031 are
ready to write.**

So the pipeline now has one job: email the shelf. It loaded **132 emails against
a plan of 200**, because `siege-plan.service` was killed on its one-hour limit at
11:17:09Z with 68 emails unsent.

## Why the push ran out of time, measured rather than inferred

Yesterday's debrief wrote: *"The push ran 86 small batches of one to three
emails, each paying roughly 35 seconds to start a fresh `npx tsx` process, and 86
startups is the hour."* The shape was right and the cause was wrong, which sent
the recommended fix to a root-owned systemd unit instead of to a repo an agent
can change.

Today's cycle, counted off `automator/logs/siege.log`:

| | |
|---|---|
| push-batch processes, 10:17:38Z to 11:16:36Z | **90** |
| median gap between process starts | **37s** (min 33, max 69) |
| emails sent | **131** (60 batches of 1, 17 of 2, 11 of 3, 1 of 4) |
| emails per process | 1.46 |

Then the 37 seconds, broken apart by wrapping `fetch` and logging when the
process actually exits:

| Step | Time |
|---|---|
| Load the code (`npx tsx`, whole module graph) | **0.78s** |
| `GET /campaigns/<id>/email-accounts` | 0.53s |
| `GET /campaigns/<id>/sequences` | 0.41s |
| Postgres round trip | 0.018s |
| **All real work complete** | **+1.1s** |
| **Process actually exits** | **+30.2s** |

Nothing in the job is slow. The process spends **29 seconds doing nothing at
all** before Node lets it exit.

`pipeline-db` creates one shared `pg` Pool with `idleTimeoutMillis: 30_000` and
`keepAlive: true`. For a long-running service those are correct. For a script
that runs for a second and quits they are fatal: the idle socket and its
keepalive timer are live handles, so the event loop stays busy until the idle
timer fires. The script has to call `closePool()` to exit promptly, and it never
did.

90 processes times 29 seconds is **43 minutes of a 61-minute window**. That is
why a one-hour limit was reached at all, and it is the whole of the shortfall:
the ramp allowed 200, the mailboxes would have taken 380, and Casey's standing
approval from 09-30 means nothing was waiting on a person.

## Finding 1: close the pool and the hour becomes three minutes

**Shipped: `7fd02b6fd`, youtube-email-outreach-v1.**

New file `src/db/cli-exit.ts` exports `runCli(main)`: run the command, close the
pool, preserve the exit code. `scripts/push-batch.ts` now ends with
`await runCli(main)` instead of `main().catch(...)`.

Three design calls:

- **Never `process.exit()` on the success path.** That truncates pending writes
  to a pipe, and every caller of this script reads its output through one.
  Closing the pool is enough: with no live handles left the loop drains and Node
  exits on its own.
- **`process.exitCode`, not `process.exit`, on failure.** The script signals
  blocked placeholders with `exitCode = 3`, and that has to survive.
- **Close after `main()` returns, and swallow a failure to close.** There is no
  query left to cut off at that point, and a pool that will not close must not
  turn a successful send into a failed run.

*Verified:* measured on all three paths against a real 10-02 batch directory.
A clean dry run **31s to 1.88s**, exit 0, full output flushed through a pipe. A
Siege inbox-mismatch refusal **30.9s to 1.93s**, exit 1, message intact. A bad
`--email-type` 0.82s, exit 1, message intact. Full suite 273 tests pass, both
typechecks clean.

On yesterday's shape this turns a 57-minute push into roughly three minutes,
which means **`TimeoutStartSec=3600` stops being the binding constraint** and
yesterday's open decision 3 should need no root change. Monday's run is the
confirmation.

The same leak sits in **62 other entrypoints** across the five repos (12 in the
email repo, 31 in the orchestrator, 11 in the finder, 6 in deep-research, 2 in
quick-research). Only this one runs inside a timed loop, so only this one was
costing anything. The rest are named in the recommendations rather than churned.

## Finding 2: the live send dropped a setting, and the compiler had never read the file

**Shipped: same commit.**

The email repo's `tsconfig.json` has `"include": ["src/**/*.ts",
"tests/**/*.ts"]`. `scripts/` holds **100 entrypoints**, including
`push-batch.ts`, the last door before SmartLead. tsc had never read a line of
it, so every "tsc clean" reported for a change under `scripts/` was true and
meaningless. Several of those reports are in this series.

Pointing the compiler at the directory found this immediately:

```
scripts/push-batch.ts(591,65): error TS2554: Expected 2 arguments, but got 3.
```

`previewAddLead(campaignId, input, settings)` forwards its settings.
`addLeadToCampaign`, the function that actually sends, **had no `settings`
parameter at all**, so push-batch's third argument was discarded.

The setting is `ignore_duplicate_leads_in_other_campaign`. It reached SmartLead
on the dry-run preview and never on the live POST, so the preview showed a
request the real send didn't make.

**Why it hasn't bitten.** Siege runs one campaign per sending inbox, so a lead
worked through several offers moves between campaigns, and SmartLead's default
declines a lead already in another one. `assertLeadAdded()` turns that into a
thrown error and a rolled-back send row, so it fails loudly: no day has hidden
one, and `failed=0 blocked=0` on every day since 09-23 is real. It hasn't
happened because nearly every email sent to date is a lead's first. With 7,031
leads ready and 16 offers it was a matter of time rather than chance.

Three things shipped:

- `addLeadToCampaign` takes `settings` and passes it to the request builder.
- `tests/smartlead-add-lead-settings.test.ts` pins the live POST body to equal
  the preview's exactly. **Checked both ways:** reverted against the old code it
  fails 2 of 3, restored it passes 3 of 3.
- `tsconfig.scripts.json` plus `npm run typecheck:scripts` covers the directory.
  12 older scripts carry 28 pre-existing errors (nearly all `string | undefined`
  under `noUncheckedIndexedAccess`) and are **listed by name** in the exclude
  block, so the gap is visible and shrinking it is a known job rather than a
  silent hole in a glob. `scripts/probe-render.ts` was one line and is fixed, so
  the list is 12 rather than 13. A new script has to be clean.

## Finding 3: the recovery lane counted mailto links where it meant people

**Shipped: `08bd8a5`, youtube-outreach-orchestrator-v1.**

The snapshot reported `free_email_points_added: 32` beside
`free_leads_with_new_points: 12`. Read together that is 32 addresses across 12
leads. The truth, by query:

| Lead | Email points | Outcome |
|---|---|---|
| `recbNKuDBbiYHuW4a` | **31** | verified, flipped to `approved_hold` 08:01Z |
| `recFoetlMCeIM3Z61` | 1 | verified, flipped to `approved_hold` 22:00Z |

**Two leads, and 31 of the 32 addresses from one creator** whose website repeats
a `mailto:` link on nearly every page. The 12 counts leads with any kind of new
contact point, so it is the wrong denominator for addresses. The number that
predicts parking was 2, and `parked_today` was 2.

This is yesterday's fix one layer down. That one separated the free lane's work
from the paid lane's. This one separates *addresses* from *people*, and it
matters more this week than last: for the next 28 days the free pass is the only
lane adding leads, so its yield is the figure Casey reads to decide whether to
fund the paid one again. An address count flatters it, because a lane finding 30
addresses on one person looks ten times healthier than a lane finding three on
three.

`collectYieldBetween()` now also returns `leads_with_email_points`,
`free_leads_with_email_points` and `paid_leads_with_email_points`, surfaced as
`free_leads_with_new_email` and friends, and the block's note says which one to
read.

*Verified:* `tsc` clean, `debrief-data.selftest.ts` ALL PASS, and run on live
data for both cycles. This cycle returns 32 points / **2 leads**, matching a
hand-written SQL count. The 10-01 cycle returns **701 paid points / 701 paid
leads**, one address per lead, which is why this only ever distorted the free
lane and why it went unnoticed on the days the paid lane dominated.

## Finding 4: the snapshot's own note carried the wrong diagnosis

**Shipped: `b45a91b`, youtube-outreach-orchestrator-v1.**

The `send_plan` note explained `push_killed` with "the push alone needs about an
hour." That sentence is the 10-02 conclusion, it is wrong, and it sits in the
file the next debrief is written from. Left there it would have produced the same
recommendation every Monday. It now records the measurement (1.1s of work, ~29s
of waiting, 90 batches, fix commit) and tells a future reader that a
`push_killed` after 2026-10-03 means to check the fix is deployed before blaming
the unit.

## What worked, and should not be re-examined

- **The paid lane's brake held.** `price_strikes: 0`, `halted: false`, and three
  resting ticks logging `$10.0 left, $0.0 spendable`. It is asleep by design
  until 31 October, not stuck.
- **Yesterday's budget-freshness fix earned its keep immediately.** The snapshot
  reports `budget_read_from: "loop_tick"` and the correct `$0.00 spendable`. Read
  off the old run-log path it would have shown a stale $5.69 and projected leads
  that cannot be bought.
- **`collect_book_stranded` held at 3** for the twentieth day. No selector gap
  has reopened.
- **Both Brave keys are still at their 402 cap and it cost nothing again.** Only
  the part of the book with no stored website needs Brave, and the cursor isn't
  in it.
- **OpenRouter's runway fixed itself.** It was lever 1 yesterday at 2.2 days and
  $50.91/day. The research queue emptied, the rate fell to $1.80/day, and the
  same $112.57 is now ~62 days. Nothing to do.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00** (20th zero) | $0.00 |
| OpenRouter | **$1.80/day**, $112.57 left, **~62 days** | $50.91/day, ~2.2 days |
| Apify | **$0 spent**, $10 left, **$0 spendable** | $61.85 spent |
| Brave | $0, both keys at their cap | $0, both keys at their cap |
| Per recovered lead | not measurable (2 leads, no spend) | $0.131 |
| Per enriched lead | $0.8983 on 2 leads | $0.0876 on 582 |

`openrouter_usd_per_enriched_lead` charges all account spend to enrichment. On a
582-lead day that is near-exact. On a two-lead day it divides the account's fixed
daily traffic by two and means nothing. Read the $1.80/day.

## What did not happen, and is fine

- **0 new channels, 0 campaign sessions.** Discovery paused since 2026-09-08 on
  Casey's order. Every sweep stopped, flag untouched, tenth debrief carrying it.
- **0 fatal signatures, 0 halts, 0 crashes.**
- **15 of 66 YouTube keys working.** Settled on 09-16: quota was cut on 50
  projects. It constrained nothing, because 100-unit keyword search is off and
  enrichment runs on 1-unit calls.
- **The orchestrator's own send found 0 ready leads** at the 07:20Z boundary.
  Siege sends from the `approved_hold` shelf; this repo's lane covers the small
  `approved` path.
- **`scripts/backfill/halt.flag`** still logs its "this is not the halt flag"
  note every 30 minutes. Decoy artefact, warned about since 09-30, left alone.

## Open decisions for Casey

1. **Decide what October's recovery budget is.** Now the only decision that
   changes how many leads exist. $100 bought 472 leads at 13 cents on 10-01, the
   best price per lead anything here has achieved. The free pass found two
   yesterday. Doing nothing is a real answer: the shelf then shrinks by roughly
   150 emails a week with nothing refilling it until 1 November.
2. **Confirm the push fix on Monday, then close the `TimeoutStartSec`
   question.** One look at `systemctl status siege-plan.service` after Monday's
   run. If it is killed again the cause is not slowness and the unit is next.
3. **Unblock a few Siege offers.** Nine of sixteen down, same named reasons for
   six debriefs. Moved up: with 7,031 researched leads, 36 inboxes and a ramp at
   200/day, the shelf is no longer the limit and the number of distinct things we
   can say to people is.
4. **Decide the discovery pause.** Tenth debrief. The case is now as strong as it
   gets: both recovery lanes are spent and the enrichment work the pause was
   meant to fund has run out.
5. **Raise the Brave cap or add a key.** Under $3, cheap, not urgent, cost
   nothing again.
6. **Eventually close the other 62 pool leaks.** 30 seconds each per run. Nothing
   else runs in a timed loop, so nothing else costs a send today. Pattern to copy
   is `src/db/cli-exit.ts`.

## Still owed

Six debriefs have grounded metrics on disk and no report: 09-19, 09-18, 09-17,
08-18, 08-17, 07-11.

## Note on the snapshot

`logs/autopilot-debrief-2026-10-03.json` is the scheduled 07:20Z reading
(`measured_minutes_after_cycle_end: 20`). Every figure quoted above is from it,
except the four things measured directly for this report and named where they
appear: the per-batch push timings (from `automator/logs/siege.log` and from
re-running `push-batch.ts` against a 10-02 batch directory), the per-lead
breakdown of the 32 free email points (one SQL query), the 62-entrypoint leak
count (a grep across the five repos), and the `siege-plan.timer` Mon-Fri
schedule. The `recovery_lane` block's new `*_leads_with_new_email` fields were
added today and verified against the same window, so a rerun of the gatherer will
include them.
