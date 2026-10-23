# Lead Run Analysis — 2026-10-23

Cycle window: 2026-10-22T07:00Z to 2026-10-23T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-23.json`.
Companion: [lead-run-2026-10-23.html](lead-run-2026-10-23.html).

## Headline

**A clean push, nobody new, and half the fleet stopped.** 117 emails went out and not one
person was lost, which is the first fully clean reading from the fix that shipped yesterday:
130 people approved, 119 planned, 2 held for today on purpose, 117 loaded, 0 failed, and 16
per-lead skips that were all written again in another batch and sent in the same run. Both
quiet problems got worse. **None of the 117 reached somebody who had never heard from us**,
making it 620 emails and 2 new people across five sending days, and the sending fleet crossed
a line: **30 of 58 mailboxes are now stopped**, the first time more than half the fleet cannot
send. One piece of good news sits in the same reading. The clear band rose by 2, its first
rise in four days, because the twelve mailboxes on watch resolved into five recovered and five
stopped.

## The numbers

| | |
|---|---|
| Emails loaded | **117** (`sent_by_this_repo` 0, `sent_elsewhere` 117). 130 approved, 119 planned, 0 failed, 16 per-lead skips |
| People lost | **0.** 2 planned rows were held by the approval gate for today (`deferred_unapproved: 2`, agreeing with Siege's own logged 2); `lost_to_fail` 0, `lost_to_skip` 0, `lost_silently` 0 |
| First touches | **0 of 117 people.** Prior 7 days: 2 of 651, **0.3%**. `shelf_first_touch` 0. Fifth sending day at or near zero |
| Push skips | 16, all "is absent from this batch's Siege manifest" (9 voice-objection-proof, 7 short-save-time). **All sixteen were re-written in another batch and sent in the same run**, so they cost 0 people. Was 12 on 10-20, 3 on 10-21 |
| Approved but unplanned | **11.** The rebuild planned 119 against 130 approved because free mailbox slots were 119, so the fleet trimmed the day, not the approval gate |
| Waiting for a slot | **1,692**, up 117 (whale 510, strong7 355, other7 827) against 119 slots |
| Push span | Plan written 10:19:58Z, `siege-plan.service` started 10:34:49Z, `push_unit_result: success`, 0 escalations, `binding_constraint: partial_push` |
| Fleet at plan time | **19 live inboxes**, **285 msg/day** (was 405), 130 follow-ups due, 119 free slots, `day_cap` 870, `inboxes_full` 0 |
| Band gate at 07:05Z | **22 normal / 6 watch / 30 stop** of 58; was **20 / 12 / 26** at the same hour a day earlier, `band_delta_comparable: true`, 24.0h apart |
| Moves inside the cycle | **5 to normal, 2 to watch, 5 to stop.** `band_returned` names all five. Old health gate ran 09:46Z and paused nobody (the band gate owns 30) |
| People parked | **2**; `approved_hold` 6,818 → 6,820; `needs_contact` 3,436 → 3,434 |
| Shelf, never emailed | **5,147** (+2). `already_sent` **1,663, unmoved for the eighth morning**; 6,810 of 6,820 bundled, **99.9%** |
| Recovery lane | 5 collect passes (01:01Z, 08:01Z, 15:00Z, 21:01Z, 04:01Z), 150 leads each. Newest: **150 leads, 2 with no site (1.3%)**, **586 points found on 148 of them and 585 already on file**, lap **11** of a 2,405 book, `stranded` 3 |
| Brave this pass | **3 searches** only (148 of 150 leads already held a site), 2 candidates, 1 accepted, 1 refused by the ownership gate, 1 social-only, **0 refused, 0 errored**, `cause: resolution_ok` |
| Free collection | **19 points, 3 addresses, 3 people with a new address**, against 156 points / 49 addresses over the prior 7 days. Producers: 01-mailto (2 points / 2 addresses / 2 people), 28-sitemap (1/1/1), 34-channel-page (8 points, 0 addresses, 3 people) |
| Method errors | 158 across 19 causes. `top_method_fault_cause` named `18-rdap: RDAP N not-found` at 20%, which is an answer and not a fault (fixed below). Rolled up by condition, **`cross-domain redirect` is 68 of 158 (43%)**, coverage 73% |
| Enrichment | **2 batches, 2 leads done, 0 failed, 0 in flight.** Ten leads left in the whole pool at 99.9% |
| Apify | 0 batches. **$9.9998 left against a $10 reserve**, `spendable: -$0.0002`, dry to 31 Oct, 0 price strikes |
| Spend | **$0 billed to the Anthropic API.** OpenRouter $1.72 account-wide, $71.68 left, 41.7 days of runway; finder log $0, 0 calls |
| YouTube keys | 15 working of 66 probed, 50 quota-exhausted after the reset, 1 blocked. Settled 09-16, not an incident |
| Clean-run | **0 fatal signatures, 0 halts, 0 crashes** |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched, 0 campaign sessions; the podcast timer fired once and logged that it was halted |

## What the day actually was

### Yesterday's fix produced its first clean reading

Every figure in the push chain agrees with the one next to it:

```
130   people this morning's approval covered
119   rows the push run's rebuild wrote      (free mailbox slots: 119)
  2   of those 119 were not on the approved list, held for today
117   loaded into SmartLead, 0 failed
  0   people lost
```

The 2 held people are `rectQuC1Y8R24T1w7` and `reckl59GwKZc3zk4I`, and `deferred_logged`
carries Siege's own count of 2, so the file read and the run cannot silently disagree.
**Under the old join both would have printed as `lost_silently`**, because a person the
approval gate holds prints exactly what a person the push never reached prints: no `SENT`,
no `FAIL`, no `SKIP`. That is the fault the 10-21 and 10-22 debriefs each got wrong in
opposite directions, and it is now settled from both ends.

**One new shape, and it is the fleet talking.** The rebuild planned 119 against 130 approved,
so 11 approved people got no slot at all. Yesterday ran the other way (149 planned against
131 approved). Free slots are now below the size of the approved list, which means the
fleet is what trims the day.

### First touches: five sending days, two people

| Cycle | Emails | People emailed | First touches | Off the shelf |
|---|---|---|---|---|
| 2026-10-17 | 82 | 82 | 1 | 1 |
| 2026-10-20 | 175 | 169 | 0 | 0 |
| 2026-10-21 | 115 | 115 | 0 | 0 |
| 2026-10-22 | 131 | 131 | 1 | 0 |
| 2026-10-23 | 117 | 117 | **0** | 0 |
| **Total** | **620** | | **2** | **1** |

The inventory says the same thing from the other side, and it is the clearest number in the
snapshot. Of the 6,820 people parked and ready, 5,147 have never been written to and 1,663
have. **`already_sent` has printed 1,663 on eight consecutive mornings**, 10-16 through
10-23, across those 620 emails. Only a first touch off the shelf moves it, and there has been
one in that span. The other half grew every morning, 5,138 to 5,147.

The ordering is the mechanism and it has not changed. `siege.fill_slots` hands out slots by
tier, then score, then subscriber count, and nothing in that sort asks whether a person has
heard from us. The queue of ready people with no slot has gone **1,012, 1,427, 1,596, 1,575,
1,692** across those five days. The whale tier holds 510 of them, up from 383 yesterday, and
its never-emailed supply ran out on the 10-13 push, so all 510 are repeat offers with first
call on a slot. Below it sit 355 in `strong7` and 827 in `other7`, which is where the
never-written-to people are.

Repeat offers are deliberate (Casey, 10-07) and five lossless pushes in a row is real work.
The only claim is that total emails and first touches measure different things.

### The fleet crossed half stopped, and the clear band went up

| Morning | Clear | Watch | Stopped | Capacity |
|---|---|---|---|---|
| 2026-10-19 07:05Z | 34 | 0 | 24 | — |
| 2026-10-20 07:05Z | 31 | 3 | 24 | 495/day |
| 2026-10-21 07:05Z | 27 | 6 | 25 | 465/day |
| 2026-10-22 07:05Z | 20 | 12 | 26 | 405/day |
| 2026-10-23 07:05Z | **22** | 6 | **30** | **285/day** |

Both things are true because the watch band resolved. Of the twelve on watch yesterday
morning, **five came back to clear and five were stopped**, with two more arriving on watch.
So clear went 20 to 22 (its first rise in four days) and stopped went 26 to 30, which is past
half the fleet for the first time.

**Those two bands are not worth the same.** Watch means follow-ups only and runs on the
48-hour clean-time clock in `automator/config/inbox-health.json`, so a mailbox on watch can
lift itself. A stop is a health judgement and costs about two weeks of warmup to undo. Five
recoveries for five stops is not a flat trade, and the stopped band has not fallen once this
month. The five that returned were `casey_brown@callcontentgetsclients.com`,
`casey_brown@contentgetsclientsdigital.com`, and three on `contentgetsleads.com`.

Capacity fell for the fourth straight day, 495 to 285. Free slots were 119 against a
`day_cap` of 870, so the warmup ramp has not been the ceiling for over a week. Follow-ups
were light (130 due, 0 inboxes full), so this is the band gate's own health judgement and not
a follow-up wave crowding new sends out.

**On the apparent contradiction:** the plan-time count of live inboxes fell 27 to 19 over its
own 24 hours, which looks like it argues against the band gate's +2. It does not. The plan was
written at 10:19Z yesterday and the band readings are 07:05Z on both mornings, so the
plan-time figure is the older of the two, and the sequence across all three readings is 20,
then 19, then 22. The newest instrument is the one that went up. This is exactly what
`delta_comparable` and `band_delta_comparable` exist to keep separate.

### Two ceilings, and fixing either one alone buys very little

5,147 researched people are ready, 99.9% with a finished bundle. Two things stand between
that bank and a conversation, and they multiply rather than add.

**Fix the ordering alone** and the fleet caps you at 285 messages a day across SmartLead's
four delivery days, minus the 130 follow-ups already owed, so roughly 150 first touches a day
at best. That still drains the bank in about ten weeks, which is a real answer.

**Fix the fleet alone** and nothing changes, because the extra slots go to the same whale
re-offer queue that took all 117 today. Capacity fell 495 to 285 over four days and first
touches sat at zero through every one of them. That is the proof the two are independent.

Every lane that could refill the shelf is also at its end state, which bounds the other side
of the arithmetic: the free lane is on lap 11 of a mined-out book, Apify sits at its reserve
until 31 October, enrichment has ten leads left of 6,820, and discovery is off by the 09-08
order.

### The free recovery lane is picked over, not broken and not short of credit

Five collect passes walked 150 leads each. The newest asked Brave **3 times across 150
leads**, because 148 of those creators already had a website on file. Site resolution read
`cause: resolution_ok` with 2 leads site-less, 0 refused searches and 0 errored. The methods
found **586 contact points on 148 of the 150 leads and 585 were already stored.** That is lap
11 of a 2,405-lead book, and no amount of Brave credit changes it. `stranded` is 3 and not
climbing, so the selector gap closed on 09-13 is still closed.

Three people did get a new address and two of them cleared verification, which is the two
parks. `01-mailto` and `28-sitemap` carried both addresses between them.

## What shipped

Two fixes, both verified before committing.

1. **An RDAP 404 is an answer, not a failure.** Email repo `e52cb61c9`. `rdap.org`'s bootstrap
   replies `404 {"title":"No RDAP service is available for this resource"}` when the registry
   for a whole top-level domain offers no RDAP at all. Probed live the same minute: `lin.ee`
   and `linktr.ee` both 404, while `google.com`, `carnivoretoday.com`, `smpaus.com.au` and
   `beacons.ai` all redirect through to their registry. It is permanent per domain ending and
   no retry changes it, but `18-rdap` counted it as an error, so on this cycle's 03:01Z pass
   `18-rdap: RDAP N not-found` was 31 of 158 errors and the snapshot named it
   `top_method_fault_cause`, the one field whose whole job is to point past deliberate content
   outcomes at the thing that might really be broken. The real fault that pass was
   `cross-domain redirect` at 68 of 158 across five method names, which yesterday's condition
   roll-up had already named correctly while the cause row contradicted it. **Third outing of
   the 10-15 lesson** (the largest cause can be a deliberate content outcome), after
   `34-channel-page: page rendered with no outbound links` on 10-15 and the condition split on
   10-22.

   A 404 now returns `skipped: "no RDAP service for this TLD"`, so it stays counted and named
   in `cli.ts`'s skip histogram, leaves the error total, and leaves the breaker's arming test.
   That last part is right on its own merits: tripping the method over endings that have no
   RDAP would also take it away from the leads whose ending has it. The reason carries no
   domain, because it is the histogram's key and a per-lead token would fragment the tally the
   same way the error shape fragments per hostname. 403 (the 10-12 Cloudflare fault), 429 and
   5xx all stay errors. 3 regression cases, 291 tests green, typecheck clean.

2. **A note that says "this cycle" must mean this cycle.** Orchestrator `4a5fe3c`. The
   `first_touch` note froze 2026-10-17's own figures into its wording and re-stated them every
   cycle after as "1.3% this cycle against 68.7% over the prior week". Six days later the live
   pair was **0% against 0.3%** and the note still printed the old numbers inside a clause that
   names the current cycle, in the one field whose entire purpose is to stop a reader quoting a
   figure that describes another day. These notes are what the debrief agent reads as its
   instructions, so a stale figure there becomes a figure in a report.

   `firstTouchReadingText()` computes it from the live pair. Neither half prints as a number
   unless it is one: a cycle that emailed nobody has no denominator (the 10-18 and 10-19
   weekend cycles were both that shape), a prior week that emailed nobody is the same, and a
   failed query is unknown. Flattening any of those to "0%" would be the same class of fault as
   the frozen figures it replaces. It was the only "N% this cycle" left in any note; the rest
   name their dates. 5 assertions, 120 tests green, selftest all pass, typecheck clean, live
   snapshot renders "0% this cycle against 0.3% over the prior week".

## Recommended next, ranked

1. **Give Siege's slot order a first-touch floor.** Five sending days, 620 emails, 2 people
   who had never heard from us, 1 of them off the shelf, and `already_sent` frozen at 1,663 for
   eight mornings. 1,692 ready people got no slot today and 1,182 of them sit in the two lower
   tiers where the never-written-to people are. This is the only lever that turns inventory
   already paid for into conversations this week, it costs nothing but the ordering, and it
   lives in `siege.fill_slots` in `automator`, which this agent does not modify. A per-day
   minimum number of first touches would be enough.
2. **Deal with the fleet, knowing it will not help until the ordering does.** 30 of 58 stopped
   is past half for the first time, capacity has gone 495 to 285 in four days, and free slots
   (119) are now below the approved list (130). The five returns this cycle were all mailboxes
   that had only reached watch, and the stopped band has not fallen once this month, so the
   question worth asking is what keeps pushing health down past normal churn. The
   made-up-name domain decision from 10-17 sets the ceiling above all of it.
3. **Fix the batch crossover in Siege.** 16 drafts this cycle, 12 on 10-20, 3 on 10-21, all
   caught by the manifest gate and all re-written. It costs no people, which is why it is
   third, but it pays the compose model twice for the same person and the count is trending up.
4. **Sample `cross-domain redirect` once.** 68 of 158 collect errors, 43% of the pass, and now
   the clear top fault with the RDAP row correctly out of the way. It means a stored creator
   website redirects to another domain and the identity gate will not follow. Some of that is
   right (a link-in-bio shortener pointing at its host, which is what the top example is).
   Some may be a creator who moved host and could be re-resolved. Cheap to check now that it is
   named, worthless to guess at.
5. **Decide about the shelf-refill lanes.** Unchanged and still Casey's: enrichment is finished
   with ten leads left of 6,820, the free lane is on lap 11 of a picked-over book, and Apify
   reopens on 31 October at roughly 19 cents a person. The pause's stated job (put every
   resource into enriching what we already have) is complete, and nothing here touches
   `logs/discovery-paused.flag`.
