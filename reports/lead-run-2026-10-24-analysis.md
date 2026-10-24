# Lead Run Analysis — 2026-10-24

Cycle window: 2026-10-23T07:00Z to 2026-10-24T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-24.json`.
Companion: [lead-run-2026-10-24.html](lead-run-2026-10-24.html).

## Headline

**Nine new people, and the fleet's worst morning yet.** 148 emails went out, nobody was
lost, and **9 of them reached a creator who had never heard from us**, against 2 across the
whole prior week. The shelf's `already_sent` counter moved off 1,663 for the first time in
nine mornings. Five of the nine came off `approved_hold`, which is the only kind that drains
the shelf. In the same cycle the sending fleet reached its lowest clear count since the band
gate took over health pauses on 2026-10-15: **17 clear, 7 on watch, 34 stopped of 58.** The
constraint has moved. It is no longer finding people or enriching them. It is having enough
healthy mailboxes to email them.

## The numbers

| | |
|---|---|
| Emails loaded | **148** (`sent_by_this_repo` 0, `sent_elsewhere` 148). 157 approved, 150 planned, 0 failed, 17 per-lead skips |
| People lost | **0.** 2 planned rows were held by the approval gate for the next day (`deferred_unapproved: 2`, agreeing with Siege's own logged 2); `lost_to_fail` 0, `lost_to_skip` 0, `lost_silently` 0 |
| First touches | **9 of 148 people, 6.1%.** Prior 7 days: 2 of 611, **0.3%**. `shelf_first_touch` **5**, the first non-zero in the series |
| Push skips | 17, all "is absent from this batch's Siege manifest" (9 short-save-time, 8 voice-objection-proof). **All seventeen were re-written in another batch and sent in the same run**, so they cost 0 people. Was 16 on 10-23, 3 on 10-21, 12 on 10-20 |
| Plan tier mix | **146 `strong7`, 4 `whale`.** Third day running that `strong7` owns the plan (134 of 149 on 10-21, 118 of 119 on 10-22) |
| Offers | voice-objection-proof 80, short-save-time 70 |
| Waiting for a slot | **1,723**, up 31 (whale 617, strong7 278, other7 828) against 150 slots |
| Push span | Plan written 10:20:10Z, `siege-plan.service` started 10:37:54Z, `push_unit_result: success`, 1 escalation, `binding_constraint: nothing_lost` (new, see below) |
| Fleet at plan time | **23 live inboxes**, **345 msg/day** (was 285), 80 follow-ups due, 150 free slots, `day_cap` 870, `inboxes_full` 0, `delta_comparable: true` at 24.0h |
| Band gate at 07:05Z | **17 normal / 7 watch / 34 stop** of 58; was **22 / 6 / 30** at the same hour a day earlier, `band_delta_comparable: true`, 24.0h apart |
| Moves inside the cycle | **2 to normal, 5 to watch, 5 to stop.** `band_returned` names both returners, on `bookcontentgetsclients.com`. Old health gate ran 09:45Z and paused nobody (the band gate owns all 34) |
| People parked | **1**; `approved_hold` 6,820 → 6,821; `needs_contact` 3,433 |
| Shelf, never emailed | **5,145** (down 2). `already_sent` **1,666, up from 1,663 after nine static mornings**; 6,811 of 6,821 bundled, **99.9%** |
| Recovery lane | 4 collect passes, newest 01:01Z, verify 06:01Z. Newest pass: **150 leads, 6 with no site (4%)**, **634 points found on them and 629 already on file**, lap **11** of a 2,403 book, `stranded` 3 |
| Brave this pass | **7 searches**, 7 candidates, **1 accepted, 6 refused by the ownership gate**, 0 social-only, **0 refused, 0 errored**, `cause: resolution_ok` |
| Free collection | **11 points, 2 addresses, 2 people with a new address**, against 113 points / 22 addresses over the prior 7 days. Producers: `34-channel-page` (8 points / 1 address / 6 people), `02-subpages` (3 / 1 / 2) |
| Method errors | 160 across 24 causes. Rolled up by condition, **`cross-domain redirect` is 66 of 160 (41%)** across five method names, coverage 61%. Largest single cause row `28-sitemap: cross-domain redirect` at 15% |
| Enrichment | **1 batch, 1 lead done, 0 failed, 0 in flight.** Ten leads left in the whole pool at 99.9% |
| Apify | 0 batches. **$9.9998 left against a $10 reserve**, `spendable: -$0.0002`, dry to 31 Oct, 0 price strikes, `halted: false` |
| Spend | **$0 billed to the Anthropic API.** OpenRouter $1.67 account-wide, $70.01 left, 41.9 days of runway; finder log $0, 0 calls |
| YouTube keys | 15 working of 66 probed, 50 quota-exhausted after the reset, 1 blocked. Settled 09-16, not an incident |
| Clean-run | **0 fatal signatures, 0 halts, 0 crashes** |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched, 0 campaign sessions; the podcast timer fired once and logged that it was halted |

## What the day actually was

### The first-touch drought broke, and not because anybody changed a setting

Yesterday's debrief ranked "give Siege's slot order a first-touch floor" as the number one
lever. That change was not made. The 9 first touches happened anyway, and the reason is
worth getting right, because it decides whether the lever is still needed.

The plan's tier mix tells it:

```
10-19   176 planned   whale 176 · strong7   0     first touches 0   (Sunday, no sends)
10-20   116 planned   whale 116 · strong7   0     first touches 0
10-21   149 planned   whale  15 · strong7 134     first touches 0
10-22   119 planned   whale   1 · strong7 118     first touches 1
10-23   150 planned   whale   4 · strong7 146     first touches 9
```

The whale tier stopped filling the plan on 10-21, three days ago, and `strong7` has owned it
since. First touches did not respond for two of those days. They went 0, then 1, then 9. So
this is a tier working through its own backlog of repeat offers and arriving at the people it
has never written to, not a switch somebody flipped. The shelf agrees: `already_sent` had
printed exactly 1,663 on nine consecutive mornings and this morning prints 1,666, and
`shelf_first_touch` is 5 after a run of zeros.

**One cycle is a trend worth watching, not a turn worth banking.** If the next sending day
holds near 9 or climbs, the logjam is genuinely clearing and the ordering lever can stay on
the shelf. If it falls back to 0, the 9 was a pocket of never-emailed people inside one tier
and the queue order is still the problem.

A second fact sits oddly beside this and is worth a look rather than a theory: **617 whale
people are queued for a slot while the plan takes 4 of them.** Queue depth and plan
composition are being decided by different rules. That gap should be understood before
anybody reorders the tiers, because the tier currently producing first touches is already
the one being favoured.

### The push itself was clean, and the snapshot said otherwise

Every figure in the push chain agrees with the one next to it:

```
157   people this morning's approval covered
150   rows the push run's rebuild wrote      (free mailbox slots: 150)
  2   of those 150 were not on the approved list, held for the next day
148   loaded into SmartLead, 0 failed
  0   people lost
```

17 skips all got written again in another batch and sent in the same run, so they cost
nobody. `lost_to_fail`, `lost_to_skip` and `lost_silently` are all 0. And yet
`binding_constraint`, the one field a reader looks at before any other, read `partial_push`.
That is fixed below.

### The fleet is now the whole constraint

The band gate moved **5 mailboxes to stop and 5 to watch against 2 back to normal**, leaving
**17 clear of 58**. The clear count across six mornings, all read at 07:05Z off the gate's
own retained history, so this is one instrument against itself:

```
10-19  34 normal ·  0 watch · 24 stop
10-20  31 normal ·  3 watch · 24 stop
10-21  27 normal ·  6 watch · 25 stop
10-22  20 normal · 12 watch · 26 stop
10-23  22 normal ·  6 watch · 30 stop
10-24  17 normal ·  7 watch · 34 stop
```

Half the clear fleet is gone in five days, and every single morning's move looked small. This
is the 2026-10-15 lesson repeating: the day-over-day delta is what makes it visible, and no
individual reading argues for anything.

The size of the loss, stated in the only terms that matter: **the warmup ramp allows 870
emails a day and the live mailboxes would accept 150.** Six sevenths of the permitted volume
sits behind mailboxes that cannot send. 1,723 people are queued for those 150 slots.

One reading needs care, and it is the 2026-10-16 caveat in a new place. At plan time the
fleet looked *better* than the day before: **23 live inboxes and 345 messages a day against
19 and 285**, both snapshots about 10:20Z and `delta_comparable: true`. The band gate's worse
reading was taken at 07:05Z *today*, after this cycle's push ran at 10:37Z yesterday. So the
push got a bigger fleet than the previous day, sent 148, and then five more mailboxes were
stopped. Tomorrow's plan is the one that pays for it. A large pull sitting beside a large push
is a question worth asking the same morning and not a proof that one caused the other, which
is exactly how the note phrases it after the 10-14 pull.

Nothing in the five pipeline repos can move this number. `automator/scripts/inbox-health.py`
owns it, a health band is deliverability, and the recovery clock in
`automator/config/inbox-health.json` is what lets a mailbox back.

### Enrichment and recovery did almost nothing, and that is correct

Enrichment did **1 batch and 1 lead**, because **6,811 of 6,821 parked leads are already
enriched, 99.9%**. Ten leads remain in the entire pool. One person parked in the cycle and
one lead got enriched. A near-zero reading is the right one here, and would only be a fault
if there were work waiting.

The recovery lane is the same shape at **lap 11** of a 2,403-lead book. The newest pass walked
150 leads, **found 634 contact points and 629 were already on file**, keeping 5. That is a
full re-walk of picked-over ground, which the snapshot distinguishes from a fault on purpose
after the 2026-10-08 miss: `methods_found` above zero with almost no new points is a drained
book, while `methods_found: 0` would be the shape to chase.

Nothing suggests a fault underneath it. Site resolution was healthy at **4% with no site, 0
Brave refusals, 0 errored searches**, `cause: resolution_ok`. Of 7 Brave searches, 7 returned
a candidate and the ownership gate kept 1, which is the gate doing its job rather than a
spent plan. `stranded` held at **3**, so the selector gap closed on 09-13 is still closed. The
cycle recovered **2 addresses from 2 people**, against 22 over the prior week.

`cross-domain redirect` is the largest fault condition at **66 of 160 errors, 41%**, across
five method names. It was checked rather than assumed: `sameSite()` in the email repo compares
*registrable* domains, so a bare-to-`www` or http-to-https redirect is not counted, and these
really are redirects that leave the creator's site. That makes them the ownership gate from
the 2026-08-18 audit refusing to file a stranger's contact details under a creator.
**Deliberately left alone.** Loosening an identity gate on a hunch is the one change in this
lane that can quietly poison the data, and the 2026-10-10 reading is already on record that
the gate is not buyable with Brave credit.

## What shipped

One fix, verified before committing.

1. **The one field a reader looks at first said a lossless push fell short.** Orchestrator
   `cb9130b`. `binding_constraint`'s fallback was plan.json arithmetic: `planned` minus what
   reached SmartLead, and anything left over was called `partial_push`. That is the 2026-10-22
   fault one level up. **plan.json is not the push's instruction.** Siege plans twice each
   morning, a sample run and then a push run that rebuilds the plan from scratch, and
   `approval_is_current()` trims the rebuild back to the approved list, so a planned person can
   be held for tomorrow on purpose and leave a gap here that nobody lost.

   This cycle is exactly that day: 150 planned, 148 sent, and the two missing were
   `deferred_unapproved`, named in `deferred_ids` and agreeing with Siege's own
   `deferred_logged: 2`. `push_outcome`'s per-person join, built four cycles ago to answer
   precisely this question, read `people_lost: 0`, `lost_to_fail: 0`, `lost_to_skip: 0`,
   `lost_silently: 0` on the same snapshot, while the headline field contradicted it.

   `binding_constraint: nothing_lost` now covers a plan that moved and cost nobody.
   `partial_push` means `people_lost` is genuinely above zero, **or null**, and null is an
   unreadable plan, which is unknown and not a clean day, so it keeps the old conservative
   answer and every prior assertion holds unchanged. The two real ceilings (`mailbox_slots`,
   `day_cap`) and `push_killed` still outrank it, because what sized or stopped a day is a
   different question from whether it lost anybody. 6 regression assertions over the live
   10-23 shape and both outranking cases, 206 assertions green, selftest all pass, typecheck
   clean, live snapshot renders `nothing_lost`.

Nothing else was shipped on purpose. The fleet contraction is the cycle's real problem and it
lives outside the five repos this agent may modify. The other low readings (enrichment,
recovery, Apify) were each checked and each has a correct explanation that is not a bug, so
changing code for them would be churn.

## Recommended next, ranked

1. **Decide what to do about the fleet. Nothing else in this report competes with it.** 34 of
   58 mailboxes are stopped, the clear count has halved in five days, and the ramp allows 870
   emails a day against the 150 the fleet will take. Two choices, both yours: let the banded
   mailboxes sit on follow-ups only and wait out the recovery clock in
   `automator/config/inbox-health.json`, or add warmed capacity. Every number downstream is
   gated on this one, and no pipeline repo can move it.

2. **Watch whether `strong7` keeps producing first touches.** 0, then 1, then 9 across the
   three days it has owned the plan. One more sending day decides whether the repeat-offer
   logjam is clearing on its own or whether the 9 was a pocket inside one tier. Holding near 9
   or climbing means the ordering lever from yesterday's report can stay unused. Falling back
   to 0 means it is still the right fix, and it lives in `siege.fill_slots` in `automator`.

3. **Find out why 617 whale-tier people wait while the plan takes 4 of them.** Queue depth and
   plan composition are being set by different rules and the gap is large. Worth understanding
   before touching the tier order, not after.

4. **Leave enrichment and recovery alone.** Enrichment is 99.9% complete with 10 leads left in
   the pool. The recovery lane is at lap 11 of a book where 629 of 634 points found are already
   on file. Both are drained, not broken, and both read as near-zero for that reason. Apify
   refills on 11-01 with $100, which at the measured $0.115 a lead is roughly 700 leads and
   about $100 of OpenRouter enrichment behind them. OpenRouter has $70.01 and 42 days of
   runway, so that refill is the next spend decision worth planning for.

5. **The shelf is the asset and it is aging.** 5,145 creators enriched and written to nobody,
   roughly 35 weekday pushes at the current size, with discovery paused so nothing replaces
   them. No action needed while the fleet is the constraint. Worth remembering the week it
   stops being one.
