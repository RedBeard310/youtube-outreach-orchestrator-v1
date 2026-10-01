# Lead run analysis, cycle 2026-09-30

Companion to [lead-run-2026-10-01.html](lead-run-2026-10-01.html). Cycle window
2026-09-30T07:00Z to 2026-10-01T07:00Z, which is Wednesday 2026-09-30 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-01.json`.

## Headline

**A billing month reset, and that was the whole day.**

Apify is the one paid service that can read the email address hidden behind
YouTube's "View email address" button. It bills monthly, we spend the allowance
until it runs out, and then the lane rests. It ran out on 20 September. The new
month started at midnight, the lane ran four batches before the cycle closed,
and the pipeline parked **203 leads** (6,867 to 7,070). The three days before
that parked +2, 0 and +2.

Separately, somebody approved Siege's batch, so **151 emails** were loaded
against a ramp that allowed 150. The day before, 150 were written and none were
pushed.

Those two facts produce the third. Every newly parked lead has to have its
channel researched before an email can be written, so the enrichment chain went
from batches of one or two leads to batches of **66 and 67**. Research is what
spends money on OpenRouter, so the account rate went **$4.61/day to $19.52/day**
and the runway went **40 days to 8.5**.

## The paid lane, batch by batch

Logs: `youtube-email-outreach-v1/logs/apify-endspec-20261001T*.log`.

| Batch | Channels | Addresses | Really parked | Lane reported | Real $/lead |
|---|---|---|---|---|---|
| 00:21 | 100 | 70 | 66 | 66 | $0.106 |
| 02:22 | 100 | 87 | 67 | 67 | $0.105 |
| 04:20 | 100 | 74 | **59** | **19** | **$0.119** |
| 06:20 | 100 | 80 | 52 | 52 | $0.135 |
| | **400** | **311** | **244** | 204 | **$0.115** |

"Really parked" is counted live from `leads.lead_candidates.review_status` over
each ledger's lead ids. 244 is the running total now; 203 is the net gain inside
the cycle, because the 06:20 batch was still flipping leads when the cycle closed
at 07:00Z and finished at 07:21Z.

Apify's own ledger, off the top of the 06:20 run log: plan STARTER, **$21.06 of
$100 used at that point, cycle ends 2026-10-31**. After the fourth batch that is
$28.08 spent and $78.94 left.

## Free searching is finished on this pool, paid searching is not

The free recovery lane (Bloodhound) ran four collect passes at 08:01, 14:01,
21:01 and 04:00, covering **491 lead slots**, and produced **10 contact points**.
Counted off `bloodhound-collect.log`, the no-website rate per pass was 98%, 10%,
19% and 18%: the first pass was the tail of a lap, the other three landed on
leads whose websites were already stored, so Brave being capped barely cost
anything this cycle.

Both Brave keys still answer `402 Usage limit exceeded`. That stays true and
stays cheap to fix, but it was not this cycle's constraint.

The comparison is the point:

| | Leads read | Contact points | Parked |
|---|---|---|---|
| Free lane | 491 | 10 | 0 |
| Paid lane | 400 | 311 | 244 |

The free lane is on its seventh full walk of a 3,061-lead book, so most of what
it reads it has already emptied. That is not a fault and no money fixes it.
Stranded held at **3** for the eighteenth day, so no selector gap has reopened.

One detail worth keeping: `contact_points_prev_7d` was 223 points and **35
addresses**. This single cycle found **286 addresses**, eight times the previous
week.

## The send

Siege's plan for the day held 150 assignments, the warmup ramp allowed 150, and
the live mailboxes (36 of them) would have taken 185. The push ran: **95
`push-batch` invocations between 22:58:06Z and 00:00:54Z**, 150 `SENT` lines,
`sent=N skipped=0 failed=0 blocked=0` throughout. The 151st email is this repo's
own send at 07:20Z on the prior boundary.

So `binding_constraint` for the cycle is **`day_cap`**, the warmup ramp. First
time in this series the pipeline hit the ceiling it is meant to hit, rather than
mailbox capacity (09-28) or a missing approval (09-29).

Two notes:

- The push is still a separate manual step. The `send_plan` block reads
  `approval_pending: false` today and read `true` yesterday, same plan, same
  pipeline. The only variable is whether a person ran it.
- 95 invocations for 150 emails means batches of one to three, each paying a
  fresh `npx tsx` start of about 35 seconds. That is the whole hour the push
  took. It works and it is not a fault, just slow.
- **9 of Siege's 16 offers still cannot run.** Reasons unchanged and all small:
  a subject line that is a note rather than a line in Notion, a Paused status, no
  batch writer in the skill folder, zero follow-up bodies, an `email_type` absent
  from `leads.vocab_outreach_email_type`. `time-offer` is gated on an unrecorded
  breakdown video. `super-fan`'s writer imports `/Users/caseybrown/...`.

## Finding 1: the paid lane was charged for leads the free lane parked

**Shipped: `ed5aeddb0`, youtube-email-outreach-v1.**

The lane has a price brake. Each batch is scored on cost per recovered lead, and
two batches in a row above `MAX_COST_PER_LEAD` (20 cents) write
`logs/apify-endspec-halt.flag` and stop the lane for the rest of the month. The
brake is correct. It was about to fire for a reason that is not about price.

A batch is two halves with a wall between them. The paid half scrapes 100
channels one at a time with a gap, which takes about an hour, writing each
address as a contact point as it goes. The free half then runs `verifyLedger`,
which asks ZeroBounce about every address and parks the good ones.

`verifyLedger` deliberately skips any lead that no longer has an unjudged
address, to avoid spending a fresh ZeroBounce credit on a verdict that already
exists. That skip is right. What it did not account for is that
`recovery-lane.timer` runs its own verify on a three-hourly schedule and knows
nothing about a live scrape.

Timeline for the 04:20 batch:

```
04:20:21Z  batch starts scraping 100 channels
05:03:43Z  recovery-lane verify fires, leads=48, exit=0   <-- takes the batch's work
05:19Z     batch reaches its own verify: 26 still unjudged, flips 19
           reported: "19 leads flipped", $0.369 per lead, strike 1 of 2
```

Checked against lead state: **59 of that batch's 74 addresses are in
`approved_hold`**, so the real figure is $0.119 and the batch was comfortably
inside the ceiling. The 06:20 batch came in at $0.135 and cleared the strike,
which is timing luck. Two overlaps in a row on a fresh $100 allowance would have
halted the best recovery method in the pipeline for the month, and the halt note
would have blamed a thinning pool.

The fix scores the ceiling on what the money bought rather than on which process
wrote it. `countRecovered()` counts how many of the batch's leads hold
`review_status = 'approved_hold'`, whoever put them there, and a new line goes
into the run log:

```
Recovered: 59 of 74 scraped addresses now in approved_hold (19 flipped here, 40 already parked by the recovery lane).
```

`apify-endspec-loop.sh` reads that line for the ceiling and falls back to the old
`leads flipped` number only for a log written before today, logging one line when
it does so. A batch that recovered nothing is still scored as infinitely
expensive, so the brake still fires on a genuinely dead pool.

Deliberately not fixed: the overlap itself. It is a good thing. The leads were
parked an hour sooner than the batch would have managed, which is the outcome we
want. Only the accounting was wrong.

*Verified:* `tsc --noEmit` clean; **270/270** tests pass; the new count replayed
against the real `2026-10-01-0420-endspec.json` ledger returns 59 and $0.119
where the old path returned 19 and $0.369; the ceiling parser tested on all three
log shapes (new format reads 59, old format falls back to 19 and says so, a
zero-recovery batch still scores 999 and halts); `--dry-run --batch 3` runs clean
end to end.

## Finding 2: Apify's money and OpenRouter's money are one budget

**Shipped: `9325b36`, youtube-outreach-orchestrator-v1.**

Today's three big numbers are one chain, and no report connected them. The daily
snapshot carried the OpenRouter runway and nothing else: Apify's allowance
appeared nowhere, the enrichment chain appeared nowhere. So what reached a reader
was a runway dropping 40 days to 8.5 with no cause attached. That is the fifth
outing of one shape in this series, a figure with the cause stripped out.

They are the same decision, and the arithmetic is simple once the pieces sit
together. Measured on this cycle:

- **$68.94** Apify spendable (after its $10 reserve), buying **982 channels**
- at **0.51 recoveries per channel**, about **500 more parked leads**
- at **$0.147** of OpenRouter research per lead, about **$74**
- against a **$165** balance

It fits, but only just, and nobody would have found out until enrichment stopped
halfway through the pool.

A new `recovery_budget` block in `debrief-data.ts` reports:

- `apify`: batches, channels scraped, addresses found, real recoveries, cost per
  recovered lead, allowance left, cap, cycle end, how stale the allowance reading
  is, the reserve, what is spendable, and the lane's own halt flag and strike
  count
- `enrichment`: chain batches, leads enriched, failed, and **in flight** (a launch
  with no matching finish is a batch still running at cycle close, not zero work)
- `projection`: channels affordable, recoveries per channel, projected leads,
  OpenRouter dollars per enriched lead, what the projection will cost, and whether
  the balance covers it

Two design calls:

- **Filesystem-only, like `sendPlanHealth`.** Every endspec run log opens with
  Apify's own ledger line, so the allowance needs no token and no network call.
  This can never be the reason a debrief fails to be written. The figure is as of
  the last batch and `budget_read_at` says how old that is.
- **`openrouter_usd_per_enriched_lead` charges all account spend to enrichment.**
  That is an upper bound, near-exact on a cycle where the backfill is the only
  heavy caller, and erring high is the safe direction for a runway.

Everything returns null rather than a guess when a rate could not be measured. A
drained allowance affords 0 channels and prices 0 dollars; an unmeasured recovery
rate projects `null`, never "0 leads".

*Verified:* `tsc --noEmit` clean; selftest **ALL PASS** with 11 new cases,
including the real 04:20 log in both formats, a crashed verify leaving recovery
unknown rather than zero, a window that excludes a later batch, the in-flight
batch, and a balance that does not cover the projection; gatherer run end to end
on live data and the block returns the figures quoted above.

## Finding 3: re-running the gatherer inflated the headline number

**Shipped in the same commit.**

Found by doing it. `parked_today` is `approved_hold_now` minus the count at cycle
start, and "now" is whenever the snapshot was taken. The scheduled 07:20Z run read
**203**. A re-run at 07:52Z read **247**, because the 06:20 Apify batch was still
parking leads. `needs_contact` moved 4,034 to 3,990 in the same window.

Same shape as the OpenRouter double-run repaired on 09-30, and the comment there
invites a re-run for fresh numbers, so this was waiting to mislead somebody.

The snapshot now carries `measured_minutes_after_cycle_end` and
`counts_post_cycle_arrivals`, flagged above 30 minutes, which is just above the
timer's normal 20. A scheduled run reads exactly as before and any other run
labels itself. The authoritative snapshot for this cycle was restored to the
07:20Z reading, so every figure in this debrief and the HTML is the real cycle.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00** (18th zero) | $0.00 |
| OpenRouter | **$19.52/day**, $165.28 left, ~8.5 days | $4.61/day, ~40 days |
| Apify | **$28.08** spent, $78.94 left of $100 | $0.00, resting |
| Brave | $0, both keys at their cap | $0, both keys at their cap |

The OpenRouter jump was yesterday's lever #3, "explain the OpenRouter jump." It
is explained: enrichment. The finder's own spend log still shows 0 calls and
$0.00, which is correct and is why the account-wide meter exists.

## What did not happen, and is fine

- **0 new channels.** Discovery paused since 2026-09-08 on Casey's order. Every
  sweep stopped, flag untouched, eighth debrief carrying it.
- **0 fatal signatures, 0 halts.** No lane wrote a halt flag.
- **15 of 66 YouTube keys working.** Settled: the quota on 50 projects was cut.
  Nothing in this cycle needed them.
- **The orchestrator's own send found 0 ready leads** at the 07:20Z boundary,
  because Siege had drawn 29 leads from the `approved` lane during the push.

## Open decisions for Casey

1. **Top up OpenRouter.** $165 at $19.52/day is about 8.5 days, and finishing the
   Apify month adds roughly $74 on top. The account hit zero without warning once
   before, on 08-25, and took every lane down with it.
2. **Spend the rest of the Apify allowance on purpose.** $68.94, about 500 leads
   at eleven cents, expires 31 October either way. The lane front-loads by design
   and will spend it in a day or two if left alone.
3. **Make the Siege push independent of somebody being awake.** Two consecutive
   days, identical plans, 4 emails and 150 emails. The only variable was a human.
4. **Raise the Brave cap or add a key.** Still under $3. Demoted today because
   the paid lane overtook the free one, and because this cycle's passes mostly did
   not need Brave. It returns as the binding limit when the cursor re-enters the
   leads with no stored website.
5. **Decide the discovery pause.** The case has changed in its favour: the free
   recovery lane produced 10 points from 491 leads, and the paid one has a hard
   monthly ceiling. Once Apify's $100 is gone, nothing is adding leads.
6. **Unblock a few Siege offers.** 9 of 16 down, reasons small and named. Matters
   more now that volume is actually flowing, because variety is what lets a
   6,600-lead shelf be worked without emailing anyone twice.

## Still owed

Six debriefs have grounded metrics on disk and no report: 09-19, 09-18, 09-17,
08-18, 08-17, 07-11.
