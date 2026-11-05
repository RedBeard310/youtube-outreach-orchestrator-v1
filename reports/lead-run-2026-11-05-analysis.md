# Lead Run Analysis — 2026-11-05

Cycle: 2026-11-04T08:00:00Z to 2026-11-05T08:00:00Z (the 24h ending at midnight PT, so all
of Wednesday 4 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-05.json`.
Companion to [lead-run-2026-11-05.html](lead-run-2026-11-05.html).

## Headline

**313 people heard from us for the first time ever, against 9 the day before and 117 across
the whole prior week.** It is the biggest reach day this pipeline has had, by roughly three
times the previous best. 352 emails went out of 360 asked for.

**Nothing was found and nothing was bought.** Twenty mailboxes started sending, all 20
blocked the day before by one thing only (`no Siege campaign yet`), and once there were more
slots than the re-offer queue could spend, every extra slot went to a person off the shelf.

**That was yesterday's number-two recommendation. Its number one was wrong**, and the fault
was in this report's own instrument: a fleet reason row published how many mailboxes *name*
each reason and not how many are held by it *alone*. Both fixed, both committed, both
verified against the plan files.

**Nobody was parked.** `approved_hold` finished exactly where it started, 7,371, for the
first time since the recovery lane shipped. Both recovery lanes are out of people and
enrichment has nothing left to enrich. That makes the supply decision urgent rather than
theoretical.

## The reach

| | Tue 11-03 | Wed 11-04 |
|---|---|---|
| Mailboxes live | 10 | 30 |
| Messages a day the fleet would accept | 150 | 450 |
| Slots the plan could offer | 67 | 360 |
| People emailed | 54 | 352 |
| First touches | 14 | 314 |
| **Genuinely new people** (`first_touch_new`) | **9** | **313** |
| Repeat offers | 40 | 38 |
| First-touch share | 25.9% | 89.2% |

`first_touch_recovered` is **1**, so this is almost entirely people who had never been
planned at all rather than backlog finally flying. `shelf_first_touch` is **275**, meaning
275 of the 314 came off `approved_hold` and the other 39 came through the `approved` lane
(41 of the 352 emails were `review_status=approved`).

Three counters agree with each other, which is worth more than any one of them:

| Counter | Move | Reading |
|---|---|---|
| `shelf.ready_to_write` | 5,574 to **5,299** | 275 fewer ready people |
| `shelf.emailed` (people with a send row) | 1,783 to **2,058** | 275 more people written to |
| `shelf.already_sent` (the stamp) | 1,784 to **2,059** | the stamp kept pace, no new stranding |

## Why the slots went to new people and not to re-offers

Siege fills slots by tier, top tier first. The plan's own `new_offers_starting` line:

| Tier | Tue 11-03 | Wed 11-04 |
|---|---|---|
| Whale | 3 | 2 |
| Strong 7 | 64 | 27 |
| Other 7+ | 0 | **331** |

The top two tiers wanted **29** slots out of 360. Yesterday they wanted 67 out of 67.

So the re-offer queue was never a policy crowding new people out. It is a roughly fixed
daily cost that happened to be larger than the entire day's capacity, and it does not grow
to fill extra slots. That answers the question the last three debriefs left open about
whether repeat offers are worth their slots: above about 70 slots a day the question does
not arise, because they are not competing for anything.

`waiting_for_a_slot` fell 2,370 to **2,037** (983 whale, 522 strong-7, 532 other-7). At 360
slots a day that queue is under a week deep, which is the first time it has been small
relative to capacity.

## What made the twenty mailboxes live

Read directly out of the two plan files rather than inferred. All 20 newly live mailboxes
carried `no Siege campaign yet` in the 11-03 plan, **19 of them with no other reason at
all**, which matches the `inboxes_only_no_campaign: 22` that report published.

Casey shipped the automation himself: `automator` commit `197e81c` at 2026-11-04T00:04:28Z,
adding `smartlead_campaigns.py enroll --live` as a step in `siege-plan.service` and 146
lines to that script. `automator/logs/smartlead-campaigns.log` records the result:

```
[2026-11-04T00:12:20Z] === enroll: 13 joined, 6 failed ===
[2026-11-04T00:18:09Z] === enroll: 5 joined, 0 failed ===
[2026-11-04T11:18:30Z] === enroll: 2 joined, 0 failed ===
```

Its own wording for each join is "it passes every check (Casey, 2026-11-03: qualified
inboxes join on their own)". The 11-04 debrief could not see any of this: 18 of the 20 had
joined eight hours before it ran, and the plan snapshot it was reading was written at
11:20Z on 11-03, before any of them.

## Yesterday's number-one recommendation was wrong

It said to find out why 30 mailboxes had dropped out of the InboxKit warmup list, because
"it is 24 slots the day lost to a missing record".

Re-run the fixed tally over the same 11-03 plan file that report was reading, and **not one
of those 30 mailboxes was held by the warmup list alone**. Every one was also suspended in
SmartLead, or on a warmup timer, or both. Repairing the warmup sync would have freed nobody.

The fleet this cycle, with the column that decides:

| Mailboxes | Held by it alone | Why they could not send |
|---|---|---|
| 90 | **24** | suspended in SmartLead |
| 39 | 0 | no Siege campaign yet (was 60, 22 alone) |
| 36 | 0 | `on warmup day 10, and the floor is day 14` |
| 30 | 0 | not in the InboxKit warmup list, so its age is unknown |
| 6 | 1 | health watch, follow-ups only, `score 86.8 under 90` |
| 6 | 0 | health watch, follow-ups only, `2h of 48h at 90+` |
| 6 | 0 | on hold until at least 2036-09-17 |
| 1 | 0 | domain watch, 2 of 3 on `leadsfromyoutube.com` sick |

A mailbox can carry several reasons, so the first column sums above the 94 that sat out. The
second cannot.

**The only recoverable block in the fleet is 24 mailboxes suspended in SmartLead with
nothing else against them.** On the 11-03 plan the same column named the missing-campaign
row at 22, which is yesterday's number two and the lever that actually worked.

`fleet.not_live_reasons_change` named the move correctly: `no Siege campaign yet` 60 to 39
(-21), `health watch (score N under N)` 2 to 6 (+4), domain watch 0 to 1. The three large
rows did not move.

### The warmup clock

`on warmup day 10, and the floor is day 14`, one day on from yesterday's raw example. They
clear Sunday **2026-11-08**, and SmartLead sends Monday to Thursday, so the first email they
can carry goes **Monday 2026-11-09**. That is the date yesterday's report published after
correcting itself, and it holds.

## The push

| | |
|---|---|
| Planned | 360 |
| Approved (what the push was asked for) | 360 |
| People emailed | **352** |
| People lost | **8** |
| Lost to a SmartLead refusal | 3 (`bounce_count=1`) |
| Lost with no line anywhere | 5 |
| Lost to a skip | 0 |
| Skips, all re-sent in the same run | 25 |
| Sends the log never recorded | **34** |

Ran 11:34:59Z to 13:14:46Z, an hour and forty minutes. `TimeoutStartSec` on the unit is
21,600 seconds, so the 10-01 timeout shape is nowhere near.

The 25 skips were all "absent from this batch's Siege manifest" and all 25 were written
again and sent in the same run, so they cost nobody. The wasted writing was 18
voice-objection-proof drafts and 7 short-save-time drafts.

**The push log dropped 34 of the 352 sends.** That is the third cycle running (6 people on
11-02, 1 on 11-03, 34 now) and this time it is a tenth of the day. Counting is safe, because
the join reads `leads.outreach_sends` as well, so all 34 are correctly credited as emailed
rather than published as lost. The audit trail is not safe: for those 34 people the only
record of what they were sent is a database row with no log line beside it.

## Supply: both lanes are out of people

| Lane | This cycle | Reading |
|---|---|---|
| Paid Apify | 0 batches, 12 idle ticks | `candidate_pool_dry`, **35 consecutive ticks** since 2026-11-02T10:22:57Z |
| Free Bloodhound | 8 points, 1 address, 1 person | lap 14 of 1,803; **612 methods found, 606 already on file** |
| Enrichment | 0 batches, 0 leads | **99.8% bundled**, nothing left |

The paid lane has **$31.20 of November's $100 unspent** and $21.20 spendable, and would
afford 301 more channels. `projection.binding_constraint` reads `candidate_supply` and
`projected_leads` is a measured **0**, because the lane said so itself. More Apify money
buys nothing.

The free lane's newest pass walked 150 leads: 2 with no site, 0 Brave refusals, 4 Brave
searches, 3 candidates, 2 accepted, 1 thrown out by the ownership gate, `cause:
resolution_ok`. The largest fault condition is `cross-domain redirect` at 81 of 122 method
errors (66%, coverage 73%), which is the web being the web. `collect_book_stranded` is 3, so
no selector gap has reopened.

So the inventory is a fixed **5,299 researched people**, draining for the first time. At 275
a day that is about four weeks; with the 36 warmup mailboxes arriving 11-09 it is less.

## The fleet health gate

Clear 56 to **53**, watch 8 to **16**, stopped 24 to **25**, `band_delta_comparable: true`,
peak 59 at 09:05Z. Five returned to clear, four still clear at the final reading, and
`casey_brown@tubegetssales.com` made a round trip inside the cycle.

**13 held mailboxes are healthy enough to return**: 9 waiting out the 48-hour clock with the
closest due within the hour, 3 held only because other addresses on their domain are sick.
The old warmup gate paused 4, all on health, none on warmup.

## Money and quiet

- OpenRouter **$1.68/day**, balance **$12.64**, **7.5 days** of runway, $0.0913 per enriched
  lead over a 7-day window of 542 leads. Nothing left to enrich, so the burn should fall.
  No reason to buy credit.
- **$0 Anthropic**, 0 fatal signatures, no halt flag.
- Discovery **0 new channels**, which is Casey's standing instruction since 2026-09-08.
- YouTube key pool 15 working of 66 after the midnight reset. Expected, and irrelevant while
  discovery is off.

## Fixes shipped this cycle

**1. A fleet reason row carries how many mailboxes it holds alone** (orchestrator
`959e535`).

`not_live_reasons` published a `count` per row, which is how many mailboxes *name* that
reason. A mailbox already blocked picks up every other reason that applies to it, so a count
can climb for a row that costs nothing. This is the 10-29 rule, written down then as "read
`inboxes_only_no_campaign`, never `inboxes_no_campaign`", and it did not travel with the
rows that replaced those two fields on 11-03.

Each row now carries `only`, and `not_live_only_top_reason` / `_count` is the largest across
every row rather than the ten published ones, so a row that falls off the display cap cannot
hide the fleet's one recoverable block. Sole-reason is counted after de-duplication, so a
mailbox naming one condensed reason twice (the shape the 11-04 bracket fix was about) is not
denied its credit.

Verified by re-running the tally over both live plan files. On 11-03: InboxKit row 30 / only
0, missing-campaign row 60 / only 22, suspended 90 / only 24. On 11-04: suspended 90 / only
24 is the only recoverable block. 5 new assertions, all selftests pass, typecheck clean.

**2. A refusal reason carries the people it really cost, and the list ranks by that**
(orchestrator `bdae9c3`).

`push_outcome.reasons` was ordered by how many log lines named each reason, which is the
10-21 lesson (every counter beside `people_lost` counts log lines) sitting in the one field a
reader opens to decide what to fix. This cycle the top row was "absent from this batch's
Siege manifest" at 25 leads and the second was the bounce refusal at 3. All 25 of the first
cost nobody; all 3 of the second were people who got no email.

Every row now carries `lost`, read off the same ledger-aware per-person join the counters
use, so a dropped SENT line cannot charge a reason with a loss that did not happen. Rows
rank by `lost` first. Null, not 0, when the plan cannot be read, and the rows then keep the
old order because that is all there is.

Verified against the live 11-04 log and plan: 360 planned, 360 approved, 352 emailed, 8 lost
(3 fail, 0 skip, 5 silent), 25 skips all re-sent, which is the published snapshot exactly,
with the bounce row now first at `lost: 3` and the manifest row at `lost: 0`. 3 new
assertions, all selftests pass, typecheck clean.

## Still open

- **The push log keeps dropping batches**, now a tenth of a day. `automator`, not editable
  from here.
- **One lead stamped as sent and never emailed**, `recPSkSNP2HeR6CCV`, stamped 2026-10-07.
  Yesterday's report expected it to fly on its own and it did not, through a 352-email day,
  so something keeps it out of every plan. Last of the cohort of 54.
- **The two `automator` repairs**, six days unshipped: the coercion that cost 10-30 and the
  empty-campaign-list guard that cost 10-29. Each has cost a whole sending day once, and a
  sending day is now worth three hundred people rather than fifty.

## Ranked levers

1. **Un-suspend the 24 mailboxes SmartLead is holding and nothing else is.** The whole of
   the fleet's recoverable capacity, worth roughly 360 more slots at 15 messages a mailbox.
   Everything else in the fleet table is a passenger or a timer. 90 are suspended in total
   and 66 of those are blocked by something else anyway.
2. **Decide about supply, urgently now.** Both recovery lanes are out of people, enrichment
   is finished, and the shelf is a fixed 5,299 draining at 275 a day. More Apify money buys
   nothing. Lifting the 2026-09-08 discovery pause is Casey's call alone.
3. **Expect the 36 warmup mailboxes on Monday 2026-11-09**, day 10 of 14 today. About
   another 540 messages a day, on top of whatever the 24 suspended ones return. Nothing to
   spend and nothing to fix.
4. **Find out why the push log is losing whole batches.** Three cycles and growing: 6, 1,
   34. Counting is safe; the record of what each person was sent is not.
5. **Ship the two `automator` repairs.**
