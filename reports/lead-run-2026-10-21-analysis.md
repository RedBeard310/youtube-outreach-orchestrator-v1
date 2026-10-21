# Lead Run Analysis — 2026-10-21

Cycle window: 2026-10-20T07:00Z to 2026-10-21T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-21.json`.
Companion: [lead-run-2026-10-21.html](lead-run-2026-10-21.html).

## Headline

**The shelf did not move in either direction.** 115 emails went out, nothing failed at
SmartLead, and for the second cycle running **not one reached somebody new**: first touches
**0 of 115**, against 810 of 1,247 people (65%) over the prior seven days. Nothing was added
either: the free recovery lane found **0 email addresses**, so **0 people were parked** and
`approved_hold` read 6,817 at both ends of the cycle. The two figures that measure the shelf,
**5,144 never written to and 1,663 already written to**, have now printed unchanged for three
mornings while 290 emails went out. The waiting queue grew **1,427 to 1,596**. Two reporting
faults turned up and both are fixed: the push's counters logged 118 per-lead events for 116
planned people and hid the one person actually lost, and the recovery lane re-walked 150
leads because its own rewind was still judging a dead search plan off the signal yesterday's
fix retired.

## The numbers

| | |
|---|---|
| Emails loaded | **115** (`sent_by_this_repo` 0, `sent_elsewhere` 115). Siege planned 116, **0 failed**, 3 per-lead skips, `binding_constraint: partial_push` |
| First touches | **0 of 115 people.** Prior 7 days: 810 of 1,247, **65%**. `shelf_first_touch` 0. Second consecutive zero |
| People lost | **1 of 116 planned**, `reckjbAvfyqs7jSeD` (whale tier, short-save-time). No `SENT`, `FAIL`, `SKIP` or escalation anywhere in the log |
| Push skips | 3, all "is absent from this batch's Siege manifest" (2 voice-objection-proof, 1 short-save-time). **All three were written again in another batch and sent in the same run**, so they cost 0 people |
| Waiting for a slot | **1,596**, up 169 (whale 382, strong7 396, other7 818) against 116 slots |
| Push span | 10:19:13Z plan, pushing done by 10:31:08Z, about 12 minutes. `push_unit_result: success`, 0 escalations |
| Fleet at plan time | **31 live inboxes**, 465 msg/day capacity, **0 follow-ups due**, 116 free slots, `day_cap` 870, `inboxes_full` 2 |
| Band gate at 07:05Z | **27 normal / 6 watch / 25 stop** of 58; was **31 / 3 / 24** at the same hour a day earlier, `band_delta_comparable: true`, 24.0h apart |
| Moves inside the cycle | **0 to normal, 7 to watch, 3 to stop.** `band_returned` empty. Old health gate ran 09:46Z and paused nobody (the band gate owns 25) |
| People parked | **0**; `approved_hold` 6,817 at both ends; `needs_contact` 3,437 |
| Shelf, never emailed | **5,144** (unchanged). `already_sent` **1,663, unmoved for the third morning**; 6,807 of 6,817 bundled, **99.9%** |
| Recovery lane | 3 collect passes. Newest: **150 leads, 2 with no site (1.3%)**, **637 points found and 634 already on file**, lap **11** of a 2,409 book, `stranded` 3 |
| Brave this pass | **5 searches** only (148 of 150 leads already held a site), 4 candidates, 3 accepted, 1 refused by the ownership gate, 1 social-only, **0 refused, 0 errored**, `cause: resolution_ok` |
| Free collection | **5 points, 0 addresses, 4 people**, against 252 points / 103 addresses over the prior 7 days. Sole producer: 34-channel-page |
| Method errors | 141 across 21 causes, top 16% (`18-rdap: RDAP N not-found`). A flat spread, which is the web being the web, not one fault |
| Enrichment | **0 batches, 0 leads, 0 in flight.** Nothing left to take at 99.9% |
| Apify | 0 batches. **$9.9998 left against a $10 reserve**, `spendable: -$0.0002`, dry to 31 Oct, 0 price strikes |
| Spend | **$0 billed to the Anthropic API.** OpenRouter $1.64 account-wide, $74.83 left, 45.6 days of runway; finder log $0, 0 calls |
| YouTube keys | 15 working of 66 probed, 50 quota-exhausted after the reset, 1 blocked. Settled 09-16, not an incident |
| Clean-run | **0 fatal signatures, 0 halts, 0 crashes** |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched, 0 campaign sessions |

## What the day actually was

**One real send event, twelve minutes long, and two lanes idling.** Siege wrote its plan at
10:19:13Z and finished pushing at 10:31:08Z. The recovery lane ran three collect passes and
got 5 contact points out of them. Enrichment had nothing to take. The band gate moved ten
mailboxes, seven of them out of the clear half. This repo's own session-start `npm run send`
fired at 07:20Z and found 0 parked leads, which is correct: the shelf is fired by Siege, not
from here.

### Both ends of the shelf were closed at once

This is the first cycle where nothing went on and nothing new came off.

**Off the shelf:** 115 people got an email and all 115 had been emailed before. Over the
prior seven days 810 of 1,247 were first touches, so 65% of that week was new people and 0%
of the last two days was. `siege.fill_slots` orders slots by tier, then score, then
subscriber count, and nothing in that sort asks whether a person has heard from us. The
whale tier's never-emailed supply ran out on the 776-person push of 10-13, so its re-offer
queue has had first call on every slot since. **1,596 ready people got no slot**, up from
1,427, and 1,214 of them sit in the two lower tiers where the never-written-to people are.

**Onto the shelf:** the free recovery lane wrote 5 contact points for 4 people and **not one
email address**, which is the only point kind that can park anybody. Apify sits at its $10
reserve until the calendar flips. Discovery is off by the 09-08 order. The weekly floor sweep
produced 149 people on 10-19 and next fires on 10-26.

The arithmetic is why the shelf's two figures printed identically three mornings running:
5,144 never written to, 1,663 already written to. Sending does not move a lead out of
`approved_hold`, so a repeat offer leaves both halves exactly where they were, and nothing
added to either.

### The push counters count log lines, and the question is about people

116 planned, 115 emailed, 3 skipped, 0 failed. That is 118 per-lead events for 116 people,
which cannot be reconciled by reading it, and two cycles running it has been misread.

All three skips were written again in another batch and sent in the same run, so they cost
writer time and nothing else. Yesterday's new skip line made that visible: each one named
which of the two manifest faults it was, then printed the manifest's offer, size, sending
inbox and the exact draft file on the line beneath. That fix worked exactly as intended.

The person actually lost is **`reckjbAvfyqs7jSeD`**, a whale-tier lead assigned the
short-save-time offer, last emailed on 10-08. The log holds no `SENT`, `FAIL`, `SKIP` or
escalation for them in this cycle. The push never reached them, and the only trace in the
whole snapshot was `unpushed_planned: 1`, an arithmetic remainder that a re-sent skip can
cancel out.

**Yesterday's answer to this same question was wrong, and the fix settles that too.** The
10-20 debrief said two people were lost to the manifest gate and named them
(`recNhh1UrOv8rRuPA`, `reckFPU6owC7hUeDB`). Neither was in that day's plan at all, so no
planned person was lost that way. That cycle's three real losses were planned leads whose
drafts our own writer refused, which the debrief filed as a separate story about the quality
gate rather than as the day's shortfall:

```
10-19 cycle   176 planned   173 emailed   3 lost
              15 skips: 10 re-sent, 2 never planned, 3 real losses (all quality gate)
10-20 cycle   116 planned   115 emailed   1 lost
               3 skips: 3 re-sent, 0 never planned, 0 real losses (1 lost silently)
```

Both lines are output of the shipped code, run against both live cycles.

### The recovery lane: a picked-over book, and a re-walk that was a real fault

The book is genuinely mined out, and this time the snapshot says so cleanly. The lane is on
lap 11 of 2,409 leads. The newest pass found **637 contact points on 148 of 150 leads and
634 of them were already stored**. It only needed 5 Brave searches all pass, because 148 of
those 150 creators already had a website on file. Site resolution read 1.3% no-site with
`cause: resolution_ok`, zero refusals and zero errors, which is the first clean reading in
weeks and the opposite of what the same field claimed yesterday.

The re-walk was not fine. At 00:00:56Z the lane put its cursor back and walked 150 leads a
second time, logging `reason: previous_pass_search_dead`. The pass it was judging is the one
yesterday's debrief took apart: 43 searches, 2 refused, 34 real candidate sites found. A
funded plan. **Yesterday's fix corrected the report of that pass and left the lane reading
the old signal**, a latched warning line that prints at most once per pass and fires on one
transient 429. So the lane acted against its own report. `rewindWaiver`'s
`rewalk_produced_nothing` is the only reason the episode stopped at one re-walk rather than
pinning the cursor.

### The fleet is eroding again

27 of 58 clear, down 4. Seven mailboxes moved to watch inside the cycle, three to stop, and
**none back to clear**. Saturday's cohort of ten returners has given back seven in two days.
Daily capacity fell 495 to 465. Both readings are the band gate's own run history, 24.0 hours
apart, so this is one instrument against itself.

Two pieces of good news on the fleet side: `followups_due` was **0**, so the whole 116-slot
allowance went to new sends rather than to the follow-up bill, and **both campaigns stalled
yesterday are running again**. 4010851 was started at 10:21:04Z with 2 leads and 4010806 at
10:29:51Z with 4, so the 6 leads sitting in them are no longer stranded.

## Fixes shipped this cycle

**1. The push's shortfall is counted in people, not log lines.** Orchestrator `da23c25`,
`scripts/autopilot/debrief-data.ts`. `push_outcome` now joins the plan's own lead list
against the push log: `planned_leads`, `people_emailed`, `people_lost`, with the loss split
into `lost_to_fail` (SmartLead refused), `lost_to_skip` (our quality gate declined) and
`lost_silently` (the log said nothing at all), plus `skipped_then_sent` and
`skipped_unplanned` to explain a skip count larger than the loss, and `lost_ids` naming the
people. Null throughout when the plan is unreadable, which is unknown and not a clean push.
12 regression cases over both live cycles' shapes, 193 tests green, typecheck clean.

**2. The recovery lane's rewind reads the same judgement its report does.** Orchestrator
`55375a8`, `src/recovery/bloodhound-lane.ts`. `lastCollectPassSearchDead()` now calls
`searchDied()` over `collectPassAttribution()` instead of testing for the latched warning
line, at a 1-lead sample floor because a rewind asks about *the last pass* whatever size it
was (a 43-lead lap-closer is the pass that triggered this), while the alarm's 30-lead floor
is about sampling the lane. A pass with no completed footer still falls back to the warning
line, which is then all the evidence there is. 4 regression cases over the live 10-20 shapes,
113 tests green. The stale comment in `checkin.ts` that said the two shared only a regex now
says they share the whole judgement.

Neither fix changes what the pipeline does. Both stop a number that reads as "nothing
happened" from being published when something did, which is the same class as every
self-improvement commit since 10-05.

## Reading notes

- **`burn_today: 0` is the calendar day, not the cycle.** The burn ledger is keyed to a daily
  ceiling, so the field reads 2026-10-21 and is empty this early. Yesterday's debrief agent
  was charged $9.76 of Max-subscription usage at 07:36Z on 10-20, which falls inside this
  cycle's window. Nothing was billed to the Anthropic API either way, and the pipeline itself
  spent nothing on that tier.
- **`site_resolution` describes the newest pass only**, and the lane ran three. The 5
  addresses-free points and the 0 parks are cycle-wide; the 637 / 634 split and the 5 Brave
  searches are that one pass.

## Recommended next, ranked

1. **Give Siege's slot order a first-touch term.** Two sending days, 290 emails, 0 people who
   had never heard from us, and the waiting queue grew 1,427 to 1,596 while it happened. This
   turns inventory already owned into conversations and costs nothing. It lives in
   `siege.fill_slots` in `automator`, which this agent does not modify. A per-day floor on
   first touches would be enough.
2. **Decide about the shelf-refill lanes.** Nothing refilled the shelf yesterday and the
   pause's stated job is finished: enrichment is at 99.9% with ten leads left in the whole
   pool and ran 0 batches. The free lane is on lap 11 of a book returning 634 of 637 points
   already on file. Apify cost about 19 cents a person in October and reopens 31 October.
   Lifting the discovery pause is Casey's call; the flag stays untouched.
3. **Watch the clear band.** 27 of 58, down 4, seven moved to watch in one day and none moved
   back. The made-up-name domain decision from 10-17 is still open and still the ceiling on
   how large the fleet can ever be.
4. **Chase the silent drop in Siege.** One planned person a day is going missing with no line
   in the log. Small, but it is the one failure shape with no counter behind it, and
   `lost_silently` will now name the person every morning it happens. The assignment itself
   is in `automator`.
5. **Leave the ownership gate alone this week.** Yesterday it was the lane's ceiling, refusing
   33 of 34 candidate sites. This cycle the lane ran 5 searches and the gate refused 1 of 4,
   because nearly every lead in the batch already had a stored website. The ceiling right now
   is the picked-over book, so loosening the gate would buy nothing and would cost the
   protection the 2026-08-18 audit built it for.
