# Lead run analysis, 2026-11-25

Cycle: 2026-11-25T08:00Z to 2026-11-26T08:00Z (the Pacific day of Tuesday 2026-11-25).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-26.json`.
Companion report: [lead-run-2026-11-26.html](lead-run-2026-11-26.html).

## The one-line version

Four live mailboxes gave Siege 25 slots, the smallest plan in weeks, and 17 of those slots
went to people an earlier push had already refused. Eight emails went out, all of them repeat
offers, so nobody new was reached for the fifth sending day running. The loss count fell for
the fourth morning in a row while the day got worse, which is the fault that shipped as a fix.

## Headline numbers

| Reading | This cycle | Prior | Note |
|---|---|---|---|
| Emails loaded | **8** | 72 | All by the send program, 0 by this repo |
| Approved people who got no email | 17 of 25 | 18 of 90 | Split complete |
| ...as a share of what the push drove | **68.0%** | 20.0% | The count fell, the share tripled |
| ...of which already lost on an earlier day | **17** | 18 | `lost_new` 0, and a lower bound |
| Longest unbroken loss streak | 10 snapshot days | 10 | Same person |
| People reached for the first time ever | **0** of 7 | 0 of 69 | Fifth day running |
| First touches over the prior 7 days | 5 of 666 people (0.8%) | | 4 of the 5 arrived on 11-18 |
| Live inboxes at plan time | **4** of 124 | 16 of 124 | Allowance 870, capacity 60, slots 25 |
| People the approval covered | 36 | 85 | 11 approved people never got a slot |
| Mailboxes clear to send | 5 | 5 | Roster 28 on both mornings, so flat is real |
| Mailboxes on watch / stopped | 6 / 17 | 11 / 12 | 5 arrived in stop inside the cycle |
| Held but healthy | 7 | 7 | All on clock, soonest 1h, 0 sick-sibling |
| Gate-owned suspensions outside the roster | 67 | 67 | Nothing can resume them |
| People waiting for a slot | **1,797** | 1,724 | whale 326 / strong7 725 / other7 746 |
| Parked into `approved_hold` | 1 | 0 | Pool 7,392 to 7,393 |
| Recovery lane's own half | 9 points, 0 addresses, 7 people | 91 points, 10 addresses over 7 days | Lap 20 of a 1,768 book |
| Site resolution | 91.3% no site | 3.3% | Cause `ownership_gate`, not search credit |
| Shelf ready to write | 4,855 | 4,854 | 7,381 bundled, 99.8% |
| Replies | 1 person, 0 yes | 5 people, 3 yes | 0 classifier failures |
| Apify email recovery | 335.6h with no work | 311.6h | Token refused on 82 ticks running |
| Fatal error signatures | 0 | 0 | No halt flag |
| Anthropic spend | $0 | $0 | OpenRouter $297.87, 8 cents/day |

## What the day was

The machinery was clean. Siege wrote its plan at 11:26:11Z, the push unit reported success,
eight emails reached SmartLead, the reply reader ran 22 times with no failures, there were no
fatal signatures and no halt flag. This repo's own send command fired once, found nothing
ready, and exited 0.

Three things define the cycle.

**The fleet is now the whole ceiling.** Four of 124 mailboxes were live when Siege looked,
worth 60 messages against an 870-message allowance. The plan carried 25 people while 1,797
wait for a slot. The approval that morning covered 36 people, eleven more than the plan could
hold, so the slot ceiling bit inside the approved set and not just outside it.

**Two thirds of that tiny plan went to people we already knew we could not email.** Seventeen
of the 25 ended the run with no email and every one of them had been lost on an earlier push.
Nobody was new. One has been dropped on ten consecutive snapshot days.

**The fleet itself did not get worse.** The clear band held flat at five mailboxes on a roster
that read 28 on both mornings, so that reading is checked rather than two different fleets
subtracted. The plan's fall from 16 live mailboxes to 4 is the same collapse yesterday's
debrief already reported, arriving in the plan a day late.

## The plan's fleet count lags the gate by a day

Worth being explicit, because the two numbers invite a wrong conclusion. The health gate moved
mailboxes out of the clear band at 08:05Z on 11-25, which yesterday's debrief published as 16
clear going to 5. Siege wrote this cycle's plan at 11:26Z, three hours after that run, so it
is the first plan written on the far side of the collapse. Yesterday's plan was written at
11:26Z on 11-24, before it.

So `live_inboxes` 16 to 4 and `band_normal` 16 to 5 are one event seen twice, on two
consecutive mornings, by two instruments reading at different hours. The fleet did not halve
twice. Today's gate reading is flat.

Inside the cycle the gate moved one mailbox back to clear, one to watch and five to stop. The
one that returned went down again in the same cycle, so the clear band peaked at 6 at 12:05Z
and finished at 5. `band_left_normal` is 1 with none unplaceable, and 5 + 1 - 1 = 5 closes
exactly, so the move counts and the band change agree.

Two standing facts about capacity:

- **Seven held mailboxes are healthy and lift themselves**, the nearest within the hour, all
  on the recovery clock and none held by a sick sibling. Leave them alone.
- **67 mailboxes the gate suspended in its own name have left its roster**, third morning
  running. The resume walk only iterates mailboxes with a warmup record, so these can never
  earn a resume. That repair lives in the send-path repo.

Of the 120 mailboxes not live, the most common named reason is a missing warmup record, on 96
of them, but only 22 carry it alone. The 22 are what the day really lost; the 96 include
mailboxes already blocked by something else. The second recoverable block is 12 suspended in
SmartLead with nothing else wrong, up 5 on yesterday.

## Why a falling loss count describes a worsening day

Across the last four sending cycles the published figures were:

| Cycle | Driven | Lost | Lost share | Recurring | Recurring share |
|---|---|---|---|---|---|
| 11-21 | 286 | 40 | 14.0% | 32 | 11.2% |
| 11-24 | 85 | 23 | 27.1% | 21 | 24.7% |
| 11-25 | 90 | 18 | 20.0% | 18 | 20.0% |
| 11-26 | 25 | 17 | **68.0%** | 17 | **68.0%** |

The count fell every morning. The share tripled. Nothing about the cohort changed: they are
planned, written and refused on a loop, for conditions that do not improve overnight. Two have
channels that no longer exist on YouTube, several carry a bounce already on SmartLead's file,
and seven have run out of offers. What changed is the denominator.

This is the same shape as the 10-16 and 11-23 lessons, a numerator read without the thing it
is a share of, sitting in the field a reader opens to see whether the loss is growing. The
11-07 note that introduced `lost_recurring` priced the then-cohort of nine at "about 9% of a
101-slot day" by hand, and no generated field has carried that arithmetic since.

One honesty note: today's split covered all 17 losses, but one prior day inside the 14-day
window named fewer people than it lost, so `lost_new` 0 is a lower bound.

## What took the seventeen

Five were refused by SmartLead, ten never reached the push at all, and two left no trace in
the log.

| Cause | People lost |
|---|---|
| Every offer that can run has already been made to them | 7 |
| YouTube no longer has their channel | 2 |
| SmartLead has them as unsubscribed | 2 |
| No draft written: business owner, no clean job title exists | 1 |
| Absent from the batch's Siege manifest | 1 |
| No line in the log at all | 2 |

Six push skips cost nobody: two were rewritten and sent in the same run, and two were never in
the plan. By offer, the skips were `voice-objection-proof` 4, `love-your-channel-short` 1 and
`short-save-time` 1.

The seven offer-exhausted were all turned down by `love-your-channel-short` for the same
precondition, no safe enemy in the research bank. Yesterday's fix published the exact wording
per variant, so this needed no hand-reading of bundle files: **9 of the 10 leads hold a bank
with zero enemies in it** and 1 holds enemies the skill's safety filter ruled out. Those are
opposite repairs. An empty bank means another research pass or stop planning that person. A
filtered bank is a question about the enemy bar, and that is Casey's call.

None of the 17 is fixable in this repo. The dead channels, the unsubscribes and the offer
rotation live in the send path; the empty banks are a research decision.

## The quiet lanes, briefly

- **Recovery lane.** Its own half produced 9 contact points and no email addresses across 600
  lead slots in four passes, against 91 points and 10 addresses the prior week. Lap 20 of a
  1,768-lead book with 1,733 of 1,745 findings already on file. That is what a picked-over book
  pays, not a fault. Stranded flat at 3.
- **Site resolution read 91.3% no-site, and the cause is the ownership gate.** Of 150 Brave
  searches only 2 were refused, 117 candidates came back, and the gate threw out 104 of them
  with 31 social-only. More search credit buys nothing. The cycle's biggest method fault was
  `cross-domain redirect` at 161 of 513, running 72, 66, 23, 0 across the four passes.
- **Apify.** The token has been rejected as "user or token not found" on 82 consecutive ticks,
  163 hours. $21.06 of the November allowance expires on 11-30, so four days remain. Credentials
  are operator-only.
- **Enrichment** reads `idling_no_inflow`, which is correct with discovery off. One lead
  finished. 12 cents per enriched lead over the last 566.
- **Discovery** produced zero new channels by Casey's standing order of 2026-09-08. The podcast
  lane woke, read the flag and halted, which is the flag doing its job.
- **Replies.** One person read, classified not-interested, so nobody agreed to talk. Zero
  classifier failures. The auto-sender stays paused by order since 09-17.

## Fix shipped this cycle

`youtube-outreach-orchestrator-v1` `841772a`.

`push_outcome` now carries `people_lost_pct` and `lost_recurring_pct`. Both are measured over
`people_emailed + people_lost`, which is the plan minus anybody the approval gate held for
tomorrow, so a person deferred on purpose cannot size a loss and the denominator is checkable
from the two fields printed beside it. `lost_recurring_pct` inherits `lost_split_complete`, so
a truncated split makes it a lower bound rather than a confident number. Both read null, never
0, when the loss is unknown or the push drove nobody, because 0% of nothing is the one reading
that would make a collapsed plan look clean.

The reader-facing note in the snapshot carries the four-day table above, so the next session
reads the lesson beside the data.

Verified against the live send log and Siege's plan file: 25 planned, 8 emailed, 17 lost, a
10-day streak and `lost_split_complete` true all reproduce exactly, and the two new shares read
68.0 and 68.0. Six new assertions, the important one being the same cohort reading 36% of a
25-person plan and 9.2% of a 98-person one. Suite 446 all pass, `tsc --noEmit` clean. No send,
research or filter behaviour was touched.

## Confirmed working: yesterday's offer-exhaustion variants

`precondition_variants`, shipped 11-25, worked on its first real morning. The split came out
9 empty banks to 1 filtered one, with both untouched wordings published and the complete flag
true, so the section above needed no bundle files opened. The 11-24 debrief needed eleven
opened by hand to state the same thing.

## Ranked levers

1. **The fleet is the whole ceiling, and 22 slots of it are recoverable.** Four live mailboxes
   against 1,797 waiting. Leave the 7 held-but-healthy alone; they lift themselves, the nearest
   within the hour. Restore the warmup records for the **22 mailboxes blocked by nothing else**.
   Read the 22, never the 96: on 11-04 the bigger number was chased and would have freed nobody.
2. **Stop planning the people no push will ever send.** Seventeen of 25 slots, one of them for
   the tenth day. Dead channels and standing bounces do not improve by being re-planned. While
   the fleet offers 25 slots, this one change roughly triples what the day delivers. The gate is
   in the send path.
3. **Decide what happens to the seven offer-exhausted.** Nine of their ten leads have a research
   file with no enemies in it, so another research pass or they leave the queue. One is the
   filter question. They have cost a slot every sending day since 11-11.
4. **Replace the Apify token.** Fourteenth morning, 163 hours of refusals. $21.06 expires
   11-30, four days left. Operator-only.
5. **Ask again why the slots go to repeat offers.** Eight emails reached nobody new while 4,855
   finished emails sit on the shelf for people never contacted. One day of slots aimed at that
   shelf beats the last five sending days combined. The ordering is a send-path setting,
   unchanged for over three weeks.
6. **Leave the recovery lane alone.** Lap 20, 99% of findings already on file, and the 91%
   no-site rate is the ownership gate refusing candidates rather than a search problem.

## What was verified, not assumed

- The send numbers were recomputed from the live send log and Siege's own plan file and
  reproduce the snapshot exactly: 25 planned, 8 emailed, 17 lost, 10-day streak, and the two
  new shares at 68.0.
- The four-day table of counts against shares was computed from the snapshots this pipeline
  wrote on each of those days, not from memory.
- The fleet comparison is sound because both gate readings covered the same 28 mailboxes,
  which the snapshot checks rather than assumes.
- The lag between the gate reading and the plan's live count was read off the two timestamps,
  08:05:21Z for the gate and 11:26:11Z for the plan.

Not established: whether the gate's own suspensions were correct, which lives in the send-path
repo; whether the nine empty research files are empty because transcripts were never mined or
because those creators argue with nothing; and whether "nobody new was lost" is exactly true,
since one prior day in the window named fewer people than it lost.

Untouched by design: discovery stayed off per the standing order of 2026-09-08, and no
credential, send-path behaviour, research rule or filter rule was changed.
