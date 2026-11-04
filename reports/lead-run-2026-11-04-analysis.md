# Lead Run Analysis — 2026-11-04

Cycle: 2026-11-03T08:00:00Z to 2026-11-04T08:00:00Z (the 24h ending at midnight PT, so all
of Tuesday 3 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-04.json`.
Companion to [lead-run-2026-11-04.html](lead-run-2026-11-04.html).

## Headline

**Monday's turn did not hold. Nine people heard from us for the first time, against 107 the
day before.** The shelf is unchanged, the research is unchanged, and nothing broke. Half of
the drop is capacity (67 slots instead of 123) and half is the tier queue going back to
repeat offers (40 of 54 people emailed had already heard from us).

**Yesterday's number-two recommendation was wrong, and this report caused it.** It said 36
warmup mailboxes would lift themselves "around 11-06". They are on warmup day 9 against a
floor of day **14**, so they clear on Sunday 2026-11-08 and the first email they can carry
goes out on **Monday 2026-11-09**.

**The stranded cohort closed itself.** Five of the six people stamped as sent who had never
been emailed were emailed in this cycle. No stamp had to be reverted.

## The reach fell back

| | Mon 11-02 | Tue 11-03 |
|---|---|---|
| Slots the fleet could offer | 123 | 67 |
| People emailed | 115 | 54 |
| First touches | 107 | 14 |
| **Genuinely new people** (`first_touch_new`) | **107** | **9** |
| Repeat offers | 8 | 40 |
| First-touch share | 93% | 25.9% |

The push sent 55 emails of 67 planned and lost 5 people: 3 SmartLead refused for a bounce
already on file (`bounce_count=1`) and 2 the log said nothing about. Twelve more were
skipped for being absent from another batch's Siege manifest and **all twelve were written
again and sent in the same run**, so they cost nobody. Seven planned people were deferred by
the approval gate for the next day, correctly, and are excluded from the loss.

`waiting_for_a_slot` reads **2,370** (983 whale, 524 strong-7, 863 other-7). Monday was the
first day in three weeks the top tier's re-offer queue let new people through at scale.
Tuesday it mostly stopped again.

The honest two-day reading: **116 new people across 11-02 and 11-03**, after a prior week
that reached two. There is no evidence yet which of the two days is the normal one.

## Why the slots halved

`live_inboxes` went 12 to 10 and `mailbox_capacity` 180 to 150. Those two have been
published since 10-15 and cannot say what caused it. The reasons underneath moved much more:

| Mailboxes | Why they could not send | Day before |
|---|---|---|
| 90 | suspended in SmartLead | 77 |
| 60 | no Siege campaign yet | 60 |
| 36 | on warmup day 9, and the floor is day 14 | 36 |
| **30** | **not in the InboxKit warmup list, so its age is unknown** | **6** |
| 6 | health watch, follow-ups only, 27 of 48 hours clean | 5 |
| 6 | on hold until 2036-09-17 | 6 |
| 2 | health watch, follow-ups only, score 83.8 against a floor of 90 | 0 |

(A mailbox can carry several reasons, so these sum above the 114 that sat out.)

**Twenty-four mailboxes dropped out of the InboxKit warmup list in one day.** A mailbox whose
age cannot be read is refused on purpose, so that row is 24 slots lost to a missing record
rather than to a sick mailbox. It is the only line in the table that moved for a reason
nobody chose, and it is unexplained.

**The warmup floor is day 14, not day 12.** Casey raised it on 2026-11-02 after the 36
mailboxes arrived: "only the ones that have been warmed up for at least 14 days"
(`automator/config/siege.json`, `warmup_wait.min_day`). The 36 are on day 9. Day 14 lands
2026-11-08, a Sunday, and SmartLead sends Monday to Thursday, so **Monday 2026-11-09** is
the first day they can carry an email.

The reason the published date was wrong is this report's own instrument. Both mornings
printed the identical condensed row `on warmup day N, and the floor is day N`. Fixed below.

## The stranded cohort drained itself

`shelf.marked_sent_never_emailed` went **6 to 1**. Five of the six were emailed in this
cycle, inside a push that ran 11:21:14Z to 11:28:29Z:

| Lead | First real send |
|---|---|
| `recfZgvMI3UFEO2GH` | 2026-11-03T11:24:00Z |
| `recWmP6gDPOLzHK1K` | 2026-11-03T11:24:35Z |
| `rectQuC1Y8R24T1w7` | 2026-11-03T11:25:54Z |
| `reckl59GwKZc3zk4I` | 2026-11-03T11:26:37Z |
| `recGlwYlWTpP1HeDX` | 2026-11-03T11:28:14Z |

No stamp was reverted and nothing was built. They were planned, approved and pushed like
anybody else. That closes the thread opened on 10-28, when 54 leads were found carrying a
`sent_to_smartlead` stamp with no send behind it. The published note said nothing would ever
reach them; it was wrong twice, and yesterday's report corrected the first half (Siege does
keep planning them).

Two counters agree on the day's first touches, which is worth more than either alone:

| Counter | Move | Reading |
|---|---|---|
| people with a send row (`shelf.emailed`) | 1,769 to 1,783 | 14 people written to for the first time |
| people carrying the sent stamp (`already_sent`) | 1,775 to 1,784 | 9 had never been stamped either, which is `first_touch_new` |
| stamped but never emailed | 6 to 1 | the other 5 were the stranded cohort |

`first_touch_recovered` is 5 and `first_touch_recovered_oldest_day` is 2026-10-08, which
agrees. One lead is left, `recPSkSNP2HeR6CCV`, stamped 2026-10-07, with a verified address
and finished research.

## What else the cycle did

**Parked 1 person.** `approved_hold` 7,370 to 7,371. The paid Apify lane has answered *no
candidates* on **24 consecutive ticks** since 11-02T10:22Z, with **$31.20 of November's $100
unspent** and $21.20 spendable. It scraped nothing and cost nothing. `projected_leads` 0,
`binding_constraint: candidate_supply`. More allowance buys nothing.

**The free recovery lane is picked over, not broken.** Lap 14 of an 1,804-lead book; 6 email
points across 3 people, against 22 points for the whole prior week, so it is running slightly
warm. The newest full pass found **579 contact points and all 579 were already on file**,
which is what a complete re-walk looks like. 1 lead in 150 had no website, 0 Brave refusals,
`cause: resolution_ok`. Largest fault condition is `cross-domain redirect` at 70 of 157
method errors (45%, coverage 65%), which is the web being the web.

**Enrichment is finished in all but name:** 2 batches, 2 leads, 0 failures, with **99.8% of
the pool bundled**. OpenRouter burn is **$1.72/day** against $14.26, so **8.3 days** of
runway at $0.09 per enriched lead. No reason to buy credit.

**The health gate moved six mailboxes the wrong way.** Clear 63 to 56, watch 8 to 14, stopped
23 to 24, `band_moved_to_normal` 0. Nine held mailboxes are healthy enough to come back:
seven waiting out the 48-hour clock (closest due now) and two held only because other
addresses on their domain are sick.

**Quiet elsewhere.** $0 Anthropic, no fatal signatures, no halt flag. Discovery stayed at
zero, which is Casey's standing instruction since 2026-09-08. The YouTube key pool reads 15
working of 66, expected and irrelevant while discovery is off.

## Shipped this cycle

**A condensed fleet reason keeps one raw example, stops splitting inside a parenthesis, and
names which gate moved** (orchestrator `140c61f`, `scripts/autopilot/debrief-data.ts`).

1. **Each `not_live_reasons` row now carries an untouched `example`.** The condenser exists
   for the 10-12 reason (a key holding a per-row number splits one fact into many), and it
   is still right, but it throws away the numbers a reader decides on. Two identical rows
   on two mornings were "day 8, floor 12" and "day 9, floor 14", and this report published
   the wrong clearing date off them.
2. **`splitInboxReasons()` splits the reason list only at bracket depth zero.** The send path
   joins reasons with `"; "` and the health gate carries another `"; "` inside its
   parenthetical, so `health stop: ... (score 37.8 under 80; 7 of 11 warmup emails in spam
   in 3 days); SmartLead did not say` published three rows instead of two. One of them was
   the fragment `N of N warmup emails in spam in N days)`, which names no gate, had its own
   row of 2 in yesterday's snapshot, double-counted that mailbox, and spent a row of the
   display cap.
3. **`fleet.not_live_reasons_change`** names which gate's grip grew or eased, largest move
   first, only for rows that moved, and only when `delta_comparable` is true (the 10-16 rule:
   `plan.json` is overwritten in place, so a delta across two incomparable hours is unknown,
   not steady). The 77-to-90 and 6-to-30 moves above took opening two plan files by hand.

Verified against the live cycle: the warmup row's example reads `on warmup day 9, and the
floor is day 14`, the two fragment rows are gone, and the moves block names the InboxKit row
at +24 and SmartLead suspensions at +13. 7 new assertions, all 302 selftests pass, typecheck
clean. The snapshot was regenerated after the fix, so the published fleet figures are the
corrected ones.

**Yesterday's send-ledger join earned its keep on day one.** The push log dropped a line
again: `emailed_unlogged` is 1 (`recdbhRURl5hBiD7x`), so the loss reads 5 instead of 6 and
that id is named as a logging fault rather than as a person to chase.

## Ranked levers

1. **Find out why 24 mailboxes fell out of the InboxKit warmup list in one day.** Fastest
   moving number in the fleet, and the only one that moved for a reason nobody chose. Each
   is refused by design while its age is unknown, so it is 24 slots. Start at
   `automator/scripts/inbox-warmup-sync.py` and whether InboxKit answered it in full.
2. **Attach Siege campaigns to the 22 otherwise-fit mailboxes.** Unchanged from yesterday,
   one fewer than yesterday. Twenty minutes of setup, not code, and the only capacity
   available this week.
3. **Expect the 36 warmup mailboxes on Monday 2026-11-09, not Friday.** They reach day 14 on
   Sunday 11-08 and lift themselves. Nothing to spend; just do not plan around Friday.
4. **Decide whether a 9-new-people day or a 107 day is the one to plan for.** Same question
   as the tier order: 2,370 ready people are waiting and 40 of 54 slots went to repeat
   offers. If repeat offers are worth that, the shelf lasts months. If not, the tier order is
   the lever and it lives in the send path.
5. **Ship the two `automator` repairs** (the `why_no_email()` coercion that cost 10-30, the
   `list_campaigns()` guard that cost 10-29). Now five days old, and a fourth single-step
   failure shape has appeared since.

## Grounding and caveats

Numbers from `logs/autopilot-debrief-2026-11-04.json`, regenerated after the fix above so the
fleet figures are the corrected ones. Read directly rather than inferred: the warmup floor
and its history (`automator/config/siege.json` and the 11-02 and 11-03 plan files); the five
recovered leads and the push's send window (`leads.outreach_sends` by hand); the hourly send
shape (same table, 54 rows all inside the 11:00Z hour).

**Not verified:** why 24 mailboxes left the InboxKit warmup list, which is lever 1 precisely
because nothing explains it; why the push log keeps dropping lines (two cycles running, and
it lives in `automator`); and whether the tier queue behaves like Monday or like Tuesday next
week, which is the whole question about reach.
