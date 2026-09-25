---
title: Lead Run Analysis, 2026-09-25
type: analysis
status: maintained
updated: 2026-09-25
tags: [lead-gen, youtube, outreach, autopilot, debrief]
---

# 2026-09-25: the biggest send day on record, and it emptied the only lane the send command can reach

Companion to [lead-run-2026-09-25.html](lead-run-2026-09-25.html). Cycle window
2026-09-24T07:00Z to 2026-09-25T07:00Z. Every figure here is either from
`logs/autopilot-debrief-2026-09-25.json` or from a Postgres query run while writing
this, and the queries are named where they matter.

## Headline

**55 emails were loaded into SmartLead**, the most in one cycle in this pipeline's
history, against 47 the day before and 40 on 09-10. **The ten finished emails a
network wobble stranded yesterday all went out at 07:20 this morning**, so
`ce5abf1` proved itself in twenty-two hours.

Two things sit behind that number and both matter more than the number:

1. **Only 8 of the 55 went through `npm run send`.** The other 47 were driven by
   hand from the email repo with a list of lead ids. No line in this repo records
   them.
2. **The lane `npm run send` reads is now completely empty.** `review_status =
   approved` holds 1,827 leads and every one is at `sent_to_smartlead`. Zero
   ready, zero drafted, zero failed. This morning's send took the last ten.

So the send command is a no-op from here. The 6,649 finished emails sit at
`approved_hold`, which that selector does not look at, by design.

## Pools

| Pool | Now | Yesterday | Note |
|---|---|---|---|
| `approved_hold` | 6,860 | 6,858 | +2, both from the recovery lane |
| of which ready to write | 6,649 | 6,675 | Fell because 40 shipped out of it |
| of which carrying a bundle | 6,852 of 6,860 | n/a | 99.9%. Eight leads of enrichment left |
| `needs_contact` | 4,236 | 4,238 | Falls only by what the lane recovers |
| `approved` (the send lane) | 1,827, all sent | 1,827, 10 fireable | Drained |

## What produced the 55

Counted from `leads.lead_candidates.outreach_processed_at`, which the email repo
stamps on the push. Not `last_contacted_at`, which a historical backfill polluted.

| When (UTC) | Count | Lane | Driver |
|---|---|---|---|
| 09-24 07:00 | 8 | `approved` | the automatic session-start send (18 attempted) |
| 09-24 19:00–20:00 | 47 | 37 `approved_hold` + 10 `approved` | hand-driven from the email repo |
| 09-25 07:20 | 10 | `approved` | session-start send, the ten recovered ids |

Per-day totals since the pause: 09-09 **14**, 09-10 **40**, 09-11 to 09-22 **0**,
09-23 **47**, 09-24 **55**, 09-25 **10** so far.

**Loaded is not delivered.** SmartLead's own scheduler sends Monday to Thursday,
09:00 to 15:00 Eastern. For real delivered volume use
`youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`, never the SmartLead UI.

## Why nobody knew

The grounded metrics file the daily report is written from had **no field for
emails sent**. It carried parked counts, discovery counts, five sweep health
blocks, campaign counters, two spend blocks and a YouTube key probe. For thirteen
days that was harmless because the answer was zero. It stopped being harmless on
09-23, and yesterday's report quoted "47 emails" for a day whose own orchestrator
log read `send_attempted=18`.

Fixed this cycle. See "Shipped" below.

## The recovery lane

Four collect passes since yesterday's report, **600 lead slots**, **43 contact
points from 21 leads**. Hit rates **4.7%, 3.3%, 1.3%, 4.7%** against a lane median
near 42%. Book **3,331 → 3,326**, so 600 readings bought **5 leads**: about 120
readings per lead, against 150 yesterday and 46 on 09-20.

**Brave is not the cause, and for the first time in a week no pass said it was.**
Zero passes opened on a `402 Usage limit exceeded` refusal, and only 2 to 6 leads
of each 150 failed to resolve a website. The cause is the one established 09-22:
the lane is on **lap 6**, re-reading leads it already emptied. All three
`bloodhound_collect_yield_degraded` firings landed on three distinct passes with no
hourly repeats, so both the 09-21 per-pass keying and the 09-22 attribution hold.

Verify tested **5 addresses across 3 passes** and was handed nothing in the other
three (`no_pending_email_points` at 17:00, 01:00 and 05:00). Those 5 are the whole
**+2**. `stranded` held at 3 for the twelfth day, so no selector gap reopened.

**Watch, do not fix: the yield alarm's long baseline is eroding.** It read 33%,
then 30%, then 28% across the cycle's three firings, against 42% a day earlier. The
09-21 fix gave the alarm an eight-day memory of normal so a slow slide could not
erase it, and eight days of degraded passes are now inside that window. The alarm
will go quiet within a few days. For a regime that is understood and correctly
attributed that is the designed behaviour, not a regression. It does mean the
lane's decline stops announcing itself.

## Enrichment

**The unscheduled 132-lead run finished and exited.** Yesterday flagged the real
risk that nothing owned it. It did not die: **122 of the 132 are parked with a
bundle on disk**, 6 had no valid email, 1 failed, and its own retries cleared 10 of
yesterday's 11 failures. The process is gone because the work is done.

The VPS chain ran **2 batches of 1 lead** beside it (09:27Z and 13:19Z) and logged
`no pending inflow, idling` after each. Its pool reads 3 with 2 permanently
excluded, so the real queue is one lead. That is correct and not a collapse: the
approved_hold pool is 99.9% bundled. Nothing creates enrichment work now except new
arrivals.

## Money

**OpenRouter runway went 20 days back to 81.** Spend fell from $10.18/day to
**$2.44/day**, balance **$197.54**. Nothing was fixed and nothing broke: the run
that was spending finished its list. Yesterday's three-week runway was a true
reading of a temporary rate. Treat both as "runway at the current rate", and the
current rate depends entirely on whether anything is enriching.

**Anthropic: $0.00** against a $150 ceiling, as every cycle since the zero-Anthropic
order.

**What composing an email costs is still unmeasured and this cycle could not answer
it**, because most of the 55 pushes resumed from drafts already written and paid
for. The shelf is 6,649 emails that each need one. One send with the per-task cost
log on settles it, and doing that before a large batch is cheaper than after.

## Shipped

**Orchestrator `1340a4b`.** Typecheck clean, **91 tests pass (4 new)**, 10 new
selftest cases, both new queries run live against Postgres and match hand-written
SQL exactly (55 = 15 `approved` + 40 `approved_hold`; shelf 6,649 ready / 6,852
bundled of 6,860), and `debrief-data.ts` re-run end to end exit 0.

1. **`sent_today` and `shelf` in the debrief data feed.** `sent_today` counts
   emails loaded into a SmartLead campaign inside the cycle, tallied by lane,
   **beside** what this repo's own log recorded rather than reconciled with it. The
   gap between the two is the signal: it says how much of the money path ran
   outside the coordination loop that owns it. This cycle it says 47 of 55.
   `shelf` counts the parked pool ready / bundled / total, a number quoted by hand
   in every report since 09-16. Both fail soft, because a debrief missing its send
   numbers is bad and one that crashes and writes nothing is worse.
2. **`tallyCount()` reads a parsed tally as a complete statement.** A status the
   tally omits happened zero times; only a missing tally is unknown. Both collapsed
   to null before, so this morning's flawless 10-of-10 send printed `failed=?` and
   logged `send_failed: null`, which is exactly what an unmeasured send looks like,
   one day after that confusion cost ten emails. The consequence bigger than the
   cosmetics: run-send's more-failed-than-sent warning tested `sent !== null`, so
   **a batch where every lead failed was the one case that printed no warning.**
   There is a test for that.

## Nothing faulted

0 fatal signatures, 0 halts, 0 quota stops, $0.00 Anthropic. `stranded` held at 3
for the twelfth day. The YouTube key pool read **15 working of 66** for the twelfth
identical morning, the settled state, and costs nothing while nothing is searching.
Apify logged its `resting` line twelve times, correctly, with $0.0053 spendable
against a $10 reserve until the billing cycle rolls 30 Sep. Every timer fired.
Discovery produced zero new channels, which is the instruction.

## Recommended next, ranked

1. **Decide what fires the next send.** `npm run send` has nothing left and will
   not get anything back by itself. The 6,649 finished emails are behind the
   `approved_hold` gate, which exists to stop exactly this from being automatic.
   Either keep driving batches by hand from the email repo with a list of ids
   (which produced 94 of the last 112 emails), or open the selector to
   `approved_hold` and accept that a deliberate hold gate becomes an automatic one.
   **Casey's call. No agent should make it.**
2. **Measure what composing an email costs before a large batch.** One send with
   the per-task cost log on. The shelf is 6,649 emails.
3. **Give enrichment a queue it owns, or accept that it has no work.** The chain's
   real queue is one lead. The run that did almost all of this week's enrichment
   took its list from a chat session's temporary folder and has finished. Nothing
   is broken and nothing is scheduled to enrich the next hand-made batch either.
4. **Decide on the discovery pause.** Unchanged. The recovery lane spends 600
   readings a day to gain 5 leads, down from 13 yesterday and 62 five days ago. The
   only three ways new leads arrive are lifting the pause, Apify on 30 September,
   and funding Brave. **Casey's word alone.**
5. **Watch Apify on 30 September.** Five days out, resting correctly, needs
   nothing. Last run recovered 62 leads in 52 minutes at $0.099 each.
6. **Expect the recovery lane's yield alarm to go quiet, and do not read that as
   recovery.** Its memory of normal has fallen 42% to 28% as degraded passes age
   into it.
7. **The 09-17, 09-18 and 09-19 debriefs are still unwritten.** Writing them needs
   a human re-login on the VPS. No Anthropic API key may be used instead.

## The lesson

The pipeline had its best sending day ever and the number was not written down
anywhere. Thirteen days of zeroes had taught every part of this system to stop
asking, and the file the daily report is built from carried no send count at all,
so the headline figure came out of a hand-typed database query. The fix was four
lines of counting. A measurement nobody needs while the answer is zero is exactly
the measurement that goes missing on the day the answer changes.

## Deliberately not done

No email sent by this agent. No discovery lane touched, restarted or repaired
(`logs/discovery-paused.flag` read first, as instructed). No `.env` or secret read
or written. No alarm threshold moved. No halt flag written. The send selector was
left reading `approved` only rather than quietly widened to the hold pool. The loop
is left running for the next cycle.
