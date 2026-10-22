# Lead Run Analysis — 2026-10-22

Cycle window: 2026-10-21T07:00Z to 2026-10-22T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-22.json`.
Companion: [lead-run-2026-10-22.html](lead-run-2026-10-22.html).

## Headline

**Nobody was lost, and nobody new was reached.** 131 emails went out and the snapshot
reported 18 of 149 planned people lost in silence. They were not lost: Siege's approval gate
held them for today on purpose and wrote one line saying so, which nothing was reading. The
real count is **131 of 131 asked for, 0 failed, 0 people lost**. The same fix settles
yesterday's answer — the one person the 10-21 debrief named as lost without a trace was held
the same way, approved the next morning, and emailed at 10:39:02Z. What is actually wrong is
quieter: **1 of the 131 emails reached somebody who had never heard from us**, the third day
running near zero, and the sending fleet lost another **7 clear mailboxes**, leaving **20 of
58** able to start a new person and **405 messages a day** against 5,145 people sitting
ready. The recovery lane added **1** of them.

## The numbers

| | |
|---|---|
| Emails loaded | **131** (`sent_by_this_repo` 0, `sent_elsewhere` 131). Plan on disk held 149, **131 approved**, 0 failed, 12 per-lead skips |
| People lost | **0 of the 131 the push was asked for.** 18 planned rows were held by the approval gate for today (`deferred_unapproved: 18`, agreeing with Siege's own logged 18) |
| First touches | **1 of 131 people**, 0.8%. Prior 7 days: 43 of 586, **7.3%**. `shelf_first_touch` 0. Third consecutive near-zero day |
| Push skips | 12, all "is absent from this batch's Siege manifest" (7 voice-objection-proof, 5 short-save-time). **All twelve were written again in another batch and sent in the same run**, so they cost 0 people |
| Waiting for a slot | **1,575**, down 21 (whale 383, strong7 366, other7 826) against 149 slots |
| Push span | 10:17:35Z sample plan + approval, 10:20:34Z re-plan + trim, pushing done by 10:40:32Z. `push_unit_result: success`, 0 escalations |
| Fleet at plan time | **27 live inboxes** (was 31), **405 msg/day** (was 465), 162 follow-ups due, 149 free slots, `day_cap` 870, `inboxes_full` 0 |
| Band gate at 07:05Z | **20 normal / 12 watch / 26 stop** of 58; was **27 / 6 / 25** at the same hour a day earlier, `band_delta_comparable: true`, 24.0h apart |
| Moves inside the cycle | **0 to normal, 7 to watch, 1 to stop.** `band_returned` empty. Old health gate ran 09:46Z and paused nobody (the band gate owns 26) |
| People parked | **1**; `approved_hold` 6,817 → 6,818; `needs_contact` 3,436 |
| Shelf, never emailed | **5,145** (+1). `already_sent` **1,663, unmoved for the fourth morning**; 6,808 of 6,818 bundled, **99.9%** |
| Recovery lane | 4 collect passes. Newest: **150 leads, 4 with no site (2.7%)**, **589 points found on 148 of them and 588 already on file**, lap **11** of a 2,408 book, `stranded` 3 |
| Brave this pass | **5 searches** only (146 of 150 leads already held a site), 3 candidates, 1 accepted, 2 refused by the ownership gate, 2 social-only, **0 refused, 0 errored**, `cause: resolution_ok` |
| Free collection | **14 points, 7 addresses, 3 people with a new address**, against 186 points / 50 addresses over the prior 7 days. Producers: 34-channel-page (12 points / 6 addresses / 5 people), 02-subpages, 16-jsonld |
| Method errors | 209 across 27 causes. Top single cause 15%; **rolled up by condition, `cross-domain redirect` is 101 of 209 (48%)** under five method names |
| Cursor rewinds | **0 leads re-walked** (150 the day before). The 07:00Z pass waived one on the old signal; the three passes after the 10-21 fix deployed logged no rewind decision at all |
| Enrichment | **1 batch, 1 lead done, 0 failed, 0 in flight.** Ten leads left in the whole pool at 99.9% |
| Apify | 0 batches. **$9.9998 left against a $10 reserve**, `spendable: -$0.0002`, dry to 31 Oct, 0 price strikes |
| Spend | **$0 billed to the Anthropic API.** OpenRouter $1.43 account-wide, $73.40 left, 51.3 days of runway; finder log $0, 0 calls |
| YouTube keys | 15 working of 66 probed, 50 quota-exhausted after the reset, 1 blocked. Settled 09-16, not an incident |
| Clean-run | **0 fatal signatures, 0 halts, 0 crashes** |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched, 0 campaign sessions |

## What the day actually was

**Two Siege passes, one twenty-minute push, and three lanes with nothing left to do.** The
sample run planned 131 people at 10:17:35Z and recorded them as approved. The push run
rebuilt the plan at 10:20:34Z, got 149, trimmed 18 back out, and pushed the 131 by 10:40:32Z.
The recovery lane ran four collect passes and found one point it had never seen. Enrichment
took its last-but-ten lead. The band gate moved eight mailboxes and brought none back. This
repo's own session-start `npm run send` fired at 07:20Z and found 0 parked leads, which is
correct: the shelf is fired by Siege, not from here.

### The 18 "lost" people were held for today, on purpose

Siege runs twice each morning, and this is the part the snapshot had never modelled. A sample
run builds a plan and records exactly which people it covers. The push run then **rebuilds
the plan from scratch**, so that a block added during the morning is honoured. That rebuild
can also pull somebody new into the day, and nobody approved them, so `approval_is_current()`
trims the day back to the approved list:

```
10:17:35Z  sample run   offers starting: voice 71 + short 60 = 131
                        with a research bundle on disk: 131
10:18:32Z               SAMPLE RUN: nothing pushed. approval.json records 131
10:20:34Z  push run     offers starting: voice 81 + short 68 = 149
10:20:34Z               recorded 149 plan rows
10:20:34Z               18 planned today were not in the approved list;
                        they wait for tomorrow
10:20:34Z               Casey approved today's plan; writing the rest and pushing
```

Why the rebuild found 18 more people is itself in the log: the sample run abandoned 30
running offers across five mailboxes suspended past the 5-sending-day limit, which frees
those people to be re-pitched from another inbox. They became plannable in the three minutes
between the two passes.

All 18 are `strong7`, each assigned to a different mailbox, and all 18 sit in the plan for
today. The reason they read as lost is that **a person held by the gate prints exactly what a
person the push never reached prints: nothing.** No `SENT`, no `FAIL`, no `SKIP`, no
`ESCALATE`, and no batch directory — they appear in no manifest, no `leads.json`, no draft
file and no writer report. `leads.siege_plan` agrees with the overstatement, because the
rebuild writes its rows before the trim: 131 rows `pushed`, 18 still at `planned`.

**Yesterday's answer was wrong the same way, at a size small enough to believe.** The 10-21
debrief named `reckjbAvfyqs7jSeD` as a whale-tier person lost with no line anywhere in the
log, and asked for the silent drop to be chased in `automator`. That lead was held by this
gate on 10-20 (`approved 115, plan.json 116`, and the log line said 1), approved the next
morning, and emailed at **2026-10-21T10:39:02Z**. A one-day wait, reported as a
disappearance. 10-19 shows the trim can run the other way too: 183 approved against 176
planned, with 7 approved people no longer plannable by push time.

### First touches, day three

| Cycle | Emails | People emailed | First touches |
|---|---|---|---|
| 2026-10-19 | 175 | 169 | 0 |
| 2026-10-20 | 115 | 115 | 0 |
| 2026-10-21 | 131 | 131 | 1 |

Of the 6,818 people parked and ready, **5,145 have never been written to and 1,663 have**,
and that second figure has now printed 1,663 for the fourth morning while 421 emails went
out. Sending does not move a lead out of `approved_hold`, so a day of repeat offers leaves
both numbers exactly where they were.

The mechanism is the slot order. Siege fills mailbox slots by tier, then score, then
subscriber count, and nothing in that sort asks whether a person has heard from us. 1,575
ready people got no slot: 383 whales, whose never-emailed supply ran out on 10-13, 366
`strong7`, 826 `other7`. The never-written-to people are in the lower two tiers. The queue
fell 21 yesterday, its first fall in a week, and only because the fleet shrank faster than the
queue grew.

### The fleet is now the volume ceiling

| Morning | Clear | Watch | Stopped | Capacity |
|---|---|---|---|---|
| 2026-10-20 07:05Z | 31 | 3 | 24 | 495/day |
| 2026-10-21 07:05Z | 27 | 6 | 25 | 465/day |
| 2026-10-22 07:05Z | **20** | **12** | 26 | **405/day** |

Eleven of 31 clear mailboxes gone in three days, and 90 messages a day. Nothing has returned
to clear since Saturday's cohort of ten. Watch is worth separating out: those twelve can
finish conversations but cannot start one, and the 48-hour clean-time clock in
`automator/config/inbox-health.json` will lift some of them without anything being done.
Stopped rose by only one.

Siege's plan was limited by its 149 free mailbox slots and not by the `day_cap` of 870, so
the warmup ramp has not been the ceiling for over a week. Follow-ups were light (162 due, 0
inboxes full), so this fall is the band gate's health judgement and not a follow-up wave
crowding slots out.

Beside the inventory that is the real arithmetic. 5,145 researched people are ready. At 131
emails a day across SmartLead's four sending days, the bank is about ten weeks of sending —
if the slots went to people who have never heard from us. At one first touch a day it is
years. Capacity and ordering are two separate ceilings and both are pressing.

### The free recovery lane is picked over, not broken or short of credit

The newest pass asked Brave **5 times across 150 leads**, because 146 of those creators
already had a website on file. Site resolution read `cause: resolution_ok` with 4 leads
site-less out of 150, 0 refused searches and 0 errored. The methods found **589 contact
points on 148 of the 150 leads and 588 were already stored.** That is lap 11 of a 2,408-lead
book, and no amount of Brave credit changes it. `stranded` is 3 and not climbing, so the
selector gap closed on 09-13 is still closed.

Three people did get a new address and one of them cleared verification, which is the single
park. 34-channel-page carried most of it (12 points, 6 addresses, 5 people).

**Yesterday's rewind fix held.** The 07:00Z pass still waived a rewind on the old signal
because the fix deployed about half an hour later; every pass after it logged no rewind
decision at all and the cursor advanced normally (2,411 → 2,409 → 2,408 remaining). 0 leads
re-walked, against 150 the day before.

### A condition that stops every method on one lead was reading as a flat spread

The pass logged 209 method errors across 27 causes with a top single cause of 15%, which the
snapshot's own guidance since 10-12 reads as the web being the web rather than one fault. It
was one fault. A cause key is `<method>: <condition>`, so a condition that stops every method
on the same lead arrives as one row per method:

```
32x 14-external-links: cross-domain redirect
21x 28-sitemap: cross-domain redirect
16x 01-mailto: cross-domain redirect
16x 02-subpages: cross-domain redirect
16x 16-jsonld: cross-domain redirect
---
101 of 209 errors (48%), reported as a 15% top row
```

This is the 10-12 lesson one level up: that fix dropped every per-lead token from the cause
key so `fetch failed` became one row with a real count, and the method name survived — as it
must — but the method name is per-method and the condition is not.

## What shipped

Both fixes are in `youtube-outreach-orchestrator-v1` `6370ee5`. 17 new regression cases; 118
tests and 201 self-test assertions green; typecheck clean; both verified against the live
cycle's own files.

1. **`push_outcome` reads the approved list, not just the plan on disk.** `approved_leads` is
   what the push was asked for; `deferred_unapproved` and `deferred_ids` count and name the
   people the approval gate held for tomorrow and exclude them from every `lost_*` figure;
   `deferred_logged` carries Siege's own count of the trim so the file read and the run cannot
   silently disagree. The approved list is taken from `samples.json` and only when the
   approval on file matches both its day and its sample fingerprint — the same two conditions
   automator checks before trimming. Null, not zero, when no approval applies: the trim's size
   is then unknowable, and the old arithmetic is all there is. Reproduces the live cycle
   exactly (149 planned / 131 approved / 18 held / 0 lost) and the 10-20 cycle (1 held, 0
   lost).

2. **Collect-pass causes are rolled up by condition.** `method_condition_list` sums the named
   causes with the method name dropped, `top_method_fault_condition` is the largest one that is
   not a known content outcome, and a group counts as benign only when every message in it
   does. `condition_coverage_pct` states how much of the pass the roll-up could see, because
   the collect CLI names six causes and summarises the rest, so every count is a lower bound.
   The live pass reads 101 at 48% with 59% coverage.

## Recommended next, ranked

1. **Give Siege's slot order a first-touch floor.** Three sending days, 421 emails, 1 person
   who had never heard from us, 1,575 ready people with no slot. It costs nothing but the
   ordering. It lives in `siege.fill_slots` in `automator`, which this agent does not modify. A
   per-day minimum number of first touches would be enough.
2. **Deal with the fleet, because it is the volume ceiling now and not the ramp.** 20 clear of
   58, down 11 in three days, 405 messages a day against 870 allowed. Twelve are on watch and
   may lift themselves, so the question this week is whether anything is pushing health down
   beyond normal churn. The made-up-name domain decision from 10-17 sets the ceiling above all
   of it.
3. **Decide about the shelf-refill lanes.** Enrichment is finished: ten leads left of 6,818.
   The free lane is on lap 11 of a book whose newest pass found 588 of 589 points already
   stored. Apify reopens 31 October at about 19 cents a person. The pause's stated job is
   complete; lifting it is Casey's call and nothing here touches the flag.
4. **Sample `cross-domain redirect` once, now that it is readable.** Half the collect pass's
   errors. It means a stored creator website redirects to another domain and the identity gate
   will not follow it. Some of that is correct (a parked domain pointing at its registrar) and
   some may be a creator who moved host and could be re-resolved. Cheap to check now that the
   roll-up names it.
5. **Leave the ownership gate alone.** The lane ran 5 searches all pass because almost every
   lead already had a site on file, and the gate refused 2 of 3 candidates. The ceiling is the
   picked-over book, not the gate.
