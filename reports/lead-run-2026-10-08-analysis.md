# Lead run analysis, cycle 2026-10-07

Companion to [lead-run-2026-10-08.html](lead-run-2026-10-08.html). Cycle window
2026-10-07T07:00Z to 2026-10-08T07:00Z, which is Wednesday 2026-10-07 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-08.json`.
Per-minute push detail counted from `automator/logs/siege.log`; batch state counted
from `automator/state/siege/2026-10-07/`; the unit's own verdict read from systemd.

## Headline

**Systemd killed the day's push at exactly sixty minutes, mid-batch, after 216 of
a 503-email plan had loaded. A hand re-run recovered 120 more. The day closed at
337 loaded and 167 planned emails never pushed.**

Casey raised the unit's ceiling from one hour to six at 16:08Z the same day, so
this was the last cycle that could end this way.

The quieter number is the one that changes the picture: **6,557 people on the
shelf have never been emailed, and the push spends them faster than anything
refills them.** At the measured rate that is 3.9 weeks of email. At the full
503-email plan the new ceiling is meant to deliver, it is 2.6 weeks.

Zero fatal signatures, zero halts, zero crashes, twenty-fifth consecutive cycle
of $0 Anthropic spend.

## Finding 1: the clock ran out on the unit, not on the push

`siege-plan.service` is a `Type=oneshot` with five `ExecStart` steps, and
`TimeoutStartSec` bounds all five together. It was 3600.

| | |
|---|---|
| Unit started | 10:25:34Z |
| First email loaded | 10:34Z (19 min of inbox sync, sampling, batch building) |
| Killed | 11:25:34Z, to the second, mid push-batch |
| Loaded before the kill | **216** |
| Hand re-run | 15:28Z to 16:00Z, loaded **120**, ended on its own |
| Day total | **337** (336 Siege + 1 this repo) against a plan of 503 |

The on-disk state says the same thing from the other side: **239 batch
directories were written for the day and only 110 ever reached their email
builder.** 129 batches had no email to push because the process that would have
written it was killed first.

Nothing degraded before the kill. The run was still loading 8 emails in its final
minute. This is not the 10-01 and 10-02 slowness: the pool-leak fix that took a
batch from 31s to 1.9s (`7fd02b6fd`) is deployed and holding.

### Six hours is enough

336 emails loaded across 84 minutes of actual pushing, which is **4.0 emails a
minute** (4.24 in the morning run, 3.64 in the afternoon). A 503-email plan needs
about two hours at that rate, plus the ~19 minutes of pre-push steps. The live
unit now reads `TimeoutStartUSec=6h` with no daemon-reload pending.

**Today's 10:15Z run is the test**, and it settles two things at once: whether six
hours is the right number, and whether yesterday's duplicate-flag fix
(`becf7fd1a`) holds across a full plan rather than a partial one.

If `push_killed` appears again after this cycle, the ceiling is no longer the
explanation.

## Finding 2: the recovery lane looked dead and was not

The newest collect pass logged `Collected 0 contact points from 0/150 leads.`
That reads as an outage. It was a full re-walk of a picked-over book.

The proof is direct. Dry-running five of the exact leads from that pass turned up
**21 contact points, every one of them already stored**:

```
[recPjh25Lcrf2ZaiQ] "Phinity Therapy"  site=https://phinitytherapy.com/  +0 pts, 1 skipped, 1 err, 6 already on file
```

`saveContactPoints` inserts `ON CONFLICT (lead_id, kind, lower(value)) DO NOTHING
RETURNING 1` and returns only rows it really wrote. So a lead whose points are all
on file scores zero, and in the log it was **indistinguishable from a lead the
methods found nothing on**.

Everything else about the pass was healthy, which is why "picked-over book" is the
right reading and not a guess:

- **3 no-site in 150** (2%), against 67.5% two days earlier
- **0 Brave refusals**, so no spent search plan
- lap **8** of a 2,520-lead book at **100% re-walk**
- `collect_book_stranded` held at **3** for a 25th day, so no selector gap reopened

Output for the cycle: 11 contact points, 3 addresses on 3 people, **1 lead
parked** (7,593 to 7,594).

### Both blind spots fixed

The collect pass used to do `row.errors += result.errors.length` and drop every
message. A pass could log 450 errors across 150 leads and the log held only the
count. Fixed in `youtube-email-outreach-v1` **`fb371d267`**:

- the per-lead line names the already-on-file count, so a re-walk no longer reads
  as a dead pass
- a footer line says what the methods found, what was new, and which of the three
  shapes the pass was
- a second footer line names the top error shapes, with messages condensed to a
  shape (host instead of full URL, `N` instead of digits) so hundreds of unique
  strings collapse into the handful of real causes

Verified live on a real re-walk before committing, not just typechecked. On the
five-lead sample the errors turned out to be ordinary method noise: FINRA lookups,
cross-domain redirects (`www.umm.edu -> www.umms.org`), a channel page with no
outbound links. None of them were the reason the pass scored zero.

The grounded snapshot had the same blind spot one layer up: `pass_summary` quoted
the zero line and nothing else, which is how a healthy lane reaches a debrief
looking like an outage. Fixed in the orchestrator **`1e43b08`**: `methods_found`
and `already_on_file` now sit in `site_resolution`, parsed by the same
`collectPasses()` the hourly alarm uses rather than a private copy. They are
**null** for passes logged before 2026-10-08, which means unknowable, not zero.

## Finding 3: the pause has nothing left to fund, and the shelf is draining

Enrichment is **done**: 7,584 of 7,594 bundled, 99.9%. The chain launched two
single-lead batches all cycle and spent the rest of the day writing
`no pending inflow — idling`. One of the two failed at stage 08 with
`could not parse a JSON object from model output`; the chain moved on and the next
lead passed. One failure in two leads is too little volume to call a pattern, so
it is a watch item, not a patch.

The paid Apify lane added nothing for a 25th day. $10 of its $100 month remains
and all $10 is the untouchable reserve, so **$0 is spendable until 31 October**.

### The shelf, stated the way it should be read

| | |
|---|---|
| Never emailed, ready to write | **6,557** |
| Already sent (still sitting in `approved_hold`) | 1,027 |
| Parked total | 7,594 |
| Enriched | 7,584 (99.9%) |

Quote **6,557**, not 7,594. A sent lead stays in `approved_hold`, so the total
counts 1,027 people who must never be written to again, and the gap widens by
every email the push sends.

Outflow against inflow:

| | per week |
|---|---|
| Push, at the measured 336/day over 5 sending days | ~1,680 |
| Push, at the full 503-email plan | ~2,515 |
| Free recovery lane | ~7 (1 parked yesterday) |
| Paid Apify lane | 0 until 31 October |
| Discovery | 0, by Casey's order |

**6,557 / 1,680 = 3.9 weeks. 6,557 / 2,515 = 2.6 weeks.**

Fixing the push makes the pipeline better at emptying the bank. Nothing is putting
anything back in.

## The volume ceiling flipped

Yesterday the plan capped at 250 while the live inboxes would have accepted 533,
so the warmup ramp was the constraint and raising the day cap looked like a lever.
This cycle it is the other way round: the ramp allows **870** and the 51 live
inboxes allow **503**. The mailboxes are the binding constraint now, and raising
the day cap buys nothing until more inboxes land.

## Money

- **Anthropic: $0.00.** 25th straight cycle. Soft 75, hard 150, untouched.
- **OpenRouter: $2.87/day, $101.49 left, ~35 days of runway.** Account-wide, so it
  includes the enrichment chain, which keeps no log of its own.
- **Apify: $0 spendable until 31 October.** Allowance spent, reserve intact, lane
  not halted and no price strikes.

## Standing items, unchanged

- **Discovery is paused** (Casey, 2026-09-08). Nothing here touched the flag, the
  sweeps, the refill timers or `autopilot-campaign.service`. 0 new channels is the
  intended state, not a fault.
- **15 of 66 YouTube keys** came back working after the midnight reset, 50 were
  still exhausted after it. Irrelevant while discovery is off.
- **Six cycles have metrics on disk and no debrief**: 09-17, 09-18, 09-19, 08-17,
  08-18, 07-11. Backfillable at no risk.

## Ranked next

1. **Watch today's push clear its whole plan under the six-hour ceiling.** Expect
   ~503 loaded in about two hours and a unit result of `success`, not `timeout`.
2. **Decide what refills the shelf, because nothing currently does.** The pause was
   ordered so every resource could go into enriching what we already had. That is
   done at 99.9% and the chain idled through the cycle. The trade the pause was
   making no longer exists: it is not buying enrichment any more, only costing
   supply. Casey's call alone.
3. **Decide the Apify allowance.** 23 more quiet days otherwise. Its best month
   recovered 244 leads for $28.08, about 11.5 cents each, which is the cheapest new
   sendable lead available without lifting the pause.
4. **Note that the day cap is no longer the lever.** 870 allowed against 503
   mailbox slots. More inboxes, not a higher cap.
5. **Backfill the six missing debriefs** when convenient.
