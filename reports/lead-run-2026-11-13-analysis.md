# Lead Run Analysis — 2026-11-13

Cycle: 2026-11-12T08:00:00Z to 2026-11-13T08:00:00Z (the 24h ending at midnight PT, so all
of Thursday 12 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-13.json`.
Companion to [lead-run-2026-11-13.html](lead-run-2026-11-13.html).

## Headline

**The OpenRouter account ran out of money at 2026-11-12T22:27:55Z.** The balance is
**minus nineteen cents**, checked live this morning against the credits endpoint: $1,610
bought, $1,610.188 used. It has been the number one recommendation in this report for six
mornings.

**Last night it cost something countable for the first time.** From 22:27:55Z every attempt
to read a creator's reply was refused with a `402 Payment Required`. There are **94 of them
in `automator/logs/smartlead-auto-reply.log` and not one anywhere earlier in that file**.
Forty-two classifier runs ended `failed`, and the queue of replies it could not read grew
from one to **three** over the night. Two hours before the money ran out, the same
classifier was reading `leigh@leighbrown.com` as a **simple-yes**, a creator agreeing to
talk. Nothing is lost permanently. The replies stay in the queue and get read the moment
credit lands. What is lost is the hours, and today's push writes on an empty account.

**180 emails went out and three people heard from us for the first time.** All three were
genuinely new, with `first_touch_recovered` at 0, which is a cleaner reading than either of
the last two mornings gave. Three is 1.7% of the day against 46.5% across the prior week.

**One lead parked.** The recovery lane's own output was 3 contact points and **zero**
addresses, against 65 and 11 the week before. No lane is short of money: the collect book is
99.7% already on file, the newest pass lost 113 of its 122 candidate websites to the
ownership gate with zero search refusals, and Apify has $21 it cannot spend for want of
candidates.

**The fleet arithmetic the last two reports printed as proof broke today, and nothing was
wrong with the fleet.** Fixed below.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **180** | 1,128 people, about 161 a day |
| People reached for the first time | **3** (1.7%) | 525 (46.5%) |
| ...of those, never planned before | **3** | 514 |
| People the push lost | **21** | 5, 5, 8, 9, 9, 11, 16, 18 on the sending days from 11-03 |
| ...of those, lost before | **15**, one on a ten-day streak | — |
| Parked into `approved_hold` | **1** | 3 on 11-12, 1 on 11-11 |
| Recovery lane contact points (its own) | **3** | 65 |
| Recovery lane people with a new address (its own) | **0** | 11 |
| Paid Apify people recovered | **0** | 0 |
| Enrichment leads done | **0** | 3 on 11-12 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf went `ready_to_write` 4,851 to **4,849**. People with a real send row went 2,513
to **2,521**. Bundling holds at 99.8%, which is why the backfill chain ran no batches at all.

## Q1. What did running out of money actually stop?

**Reading replies.**

The classifier runs every couple of minutes against whatever replies are in the queue. From
22:27:55Z it stopped being able to:

| | |
|---|---|
| First `402 Payment Required` in the log, ever | 2026-11-12T22:27:55Z |
| 402s since, all inside this cycle | **94** |
| Classifier runs that ended `failed` | **42** |
| Replies unread this morning | **3** |

That is the most valuable output the pipeline has. The emails exist to produce replies.

**The push itself was not hit, and that is timing rather than safety.** It ran 11:54:53Z to
13:40:17Z, about nine hours before the account emptied. Today's push does not have that
luxury. Most live Siege offers are template writers that make no model call, so part of the
day will still go out; the offers that pick a job title or write a personalised line will
not. The shape that failure takes is already in this cycle's own loss table, one lead lost
to `no draft was written: business owner (no clean job title exists)`. The 2026-09-14 lesson
is that a dry account does not announce itself, so expect a quiet shortfall rather than an
error.

| OpenRouter, morning by morning | 11-11 | 11-12 | 11-13 |
|---|---|---|---|
| Balance | $2.60 | $0.82 | **−$0.19** |
| Days of credit left | 1.5 | 0.5 | **none** |
| Rank in this report's recommendations | #1 | #1 | #1 |

**What burns the roughly $1 a day is still not established.** The classifier is not the bulk
of it: it made at most a few dozen paid calls before the account emptied, which is cents.
Enrichment ran zero batches this cycle and the finder logged zero calls. Fourth morning
unanswered.

## Q2. 180 emails. How many reached somebody new?

**Three, and all three are genuinely new.**

| | This cycle | Prior 7 days |
|---|---|---|
| People emailed | 180 | 1,128 |
| First touches | **3** (1.7%) | 525 (46.5%) |
| Already credited on an earlier day | **0** | 11 |
| Genuinely new | **3** | 514 |

The last two mornings both had to separate a backlog finally flying from a person really
reached. This one does not: every first touch came off the shelf and none had been planned
before.

**The plan filled every slot the fleet had.** Siege planned 206 people against exactly 206
mailbox slots. The ceiling was the fleet, not the ramp: the warmup cap allows 870 a day and
the live inboxes would take 206, because 42 mailboxes with a 630-message allowance already
owed **447 follow-ups**. Behind the plan **1,184 ready people waited** — 556 whale tier, 614
strong-7, 14 other-7 — and slots go out by tier, so the whale queue's re-offers take them
first. Third morning this recommendation has appeared.

**The push lost 21 people, 15 of whom it had lost before.**

| What happened to the 21 | People lost |
|---|---|
| SmartLead refused the lead, `bounce_count=1` | 8 |
| No line about them in the log at all | 7 |
| SmartLead refused the lead, already unsubscribed | 2 |
| Absent from the batch's Siege manifest | 1 |
| SmartLead answered 502 Bad Gateway | 1 |
| No draft written: business owner, no clean job title | 1 |
| Lost before the push could reach them | 1 |

One lead has now been refused on **ten consecutive sending days**. The repair has not changed
since 11-07 and it lives in `automator`: stop planning them.

**Yesterday's cap fix is working, with one caveat the field states itself.** The split
examined **all 21** losses rather than 12 of 18, and `lost_split_complete` reads true. But
recurrence is checked against earlier snapshots, and `lost_history_capped_days` is **3**:
three days inside that window were written under the old 12-name cap, so their own loss
lists were shorter than their own losses. **Read the 6 new losses as a floor.** The first
window with no truncation anywhere in it arrives around 11-16.

The writer's quality gate skipped 11 planned emails, led by short-save-time and
voice-objection-proof at 5 each, and **10 of the 11 were written again and sent in the same
run**, so the gate cost one person. The push log dropped one person's send line, which the
send ledger caught (`emailed_unlogged: 1`).

## Q3. What is still producing people we can email?

**One a day, and money is not the constraint on any of the three lanes.**

| Lane | This cycle | Prior 7 days |
|---|---|---|
| Recovery lane, its own contact points | 3 | 65 |
| Recovery lane, people with a new address | **0** | 11 |
| Apify endspec, people recovered | 0 | 0 |
| New channels found | 0 | 0 |
| **Parked into `approved_hold`** | **1** | — |

A second caller of the same tool, automator's contact-lookup timer, wrote 7 more points and
both of the cycle's new addresses on people already on the shelf. Those cannot park anybody,
because they were never lost. Without the 11-11 split this report would read 10 points and
two recovered addresses.

**The book is read out.** Three collect passes walked 450 leads, the methods found **1,173**
contact methods, and **1,170 were already on file (99.7%)**. Lap 16 of a 1,782-lead book.
`stranded` is 3 and flat, so no selector gap has reopened.

**The newest pass left 94% of its leads with no website, and Brave credit changes none of
it.** The cause reads `ownership_gate`:

| The newest collect pass, 150 leads | |
|---|---|
| Brave searches run | 150 |
| Searches refused or errored | **0** |
| Candidate sites found | 122 |
| Thrown out by the ownership gate | **113** (28 of them social profiles) |
| Sites accepted | 9 |

The gate is working to the bar the 2026-08-18 audit set. This is an evidence problem.

**Apify has money and nothing to buy.** It answered "no candidates" on **34 consecutive
ticks** since 2026-11-09T10:20Z, with $31.06 of November's allowance unspent, $21.06 of it
spendable, and the cycle rolling 11-30. `projected_leads` is a measured 0 and
`binding_constraint` reads `candidate_supply`.

**On the method faults.** The cycle's largest named condition was "cross-domain redirect" at
102 of 382 errors (27%), swinging 69, 33, 0 across the three passes — mostly the same
ownership gate refusing a link whose destination does not read like the creator. The second,
"iTunes refused-or-throttled" at 33, is the podcast method's own rate gate reporting that
Apple's per-IP budget is spent, which is the behaviour the 2026-10-15 fix installed rather
than a fault it left behind. That method still found one address this cycle.

## The fleet

| | 11-12 08:05Z | 11-13 08:05Z |
|---|---|---|
| clear (`band_normal`) | 44 | **44** |
| watch | 14 | 13 |
| stop | 36 | 37 |

Live inboxes 42 and allowance 630, both unchanged day over day.

**The subtraction the last two reports printed as proof does not close today, and nothing
was wrong.** Two mailboxes came back to normal, two went to watch, one went to stop, which
reads 44 + 2 − 2 − 1 = 43 against a clear band of 44. The mailbox that stopped came out of
**watch**: at 00:06Z the watch band went 15 to 14, the stopped band 36 to 37, and the clear
count did not move. No gate run read a short fleet, so the 11-10 explanation for a
non-closing subtraction genuinely did not apply, and the reader had nothing left to conclude
but that the instrument was broken. Fixed below.

Both returners still hold normal, no round trips. **Ten held mailboxes are already healthy**:
seven waiting out the 48-hour clean clock with the closest due in 24 hours, three held only
because a sibling on their domain is sick. The older warmup gate paused two mailboxes, both
on health score.

| Why a mailbox sat out (82 of 124) | Naming it | Carrying it alone | 11-12 (alone) |
|---|---|---|---|
| suspended in SmartLead | 66 | **36** | 34 |
| not in the InboxKit warmup list | 30 | 0 | 0 |
| SMTP or IMAP failing | 12 | 0 | 0 |
| health watch, follow-ups only (recovering) | 8 | **6** | 3 |
| on hold until a date | 6 | 0 | 0 |
| no Siege campaign yet | 5 | 0 | 0 |
| SmartLead did not return its status | 4 | **3** | 0 |
| health watch, follow-ups only (score under 90) | 3 | 0 | 4 |
| domain watch, businessgrowthvideo.com | 1 | 1 | 0 |

The 36 SmartLead suspensions are the entire recoverable block and they grew by two.

## Money and quiet

| | |
|---|---|
| OpenRouter | **−$0.19**, dry since 22:27:55Z. Burn was $1.01 a day. |
| Anthropic | **$0**, against a $75 soft ceiling. |
| Faults | 0 fatal signatures, no halt flag, 3 escalations inside the push. |
| Enrichment | 0 batches. The shelf is 99.8% bundled. |
| Shelf | 4,849 written-ready, 7,373 of 7,385 bundled, 2,521 people really emailed. |
| Stranded sent stamps | 3, all standing from earlier cycles, oldest 2026-10-07, none new. |
| YouTube keys | 15 working of 66, 50 still exhausted after the reset. Settled, and irrelevant while discovery is off. |
| Discovery | 0 new channels, by standing order. |
| This repo's own sends | The 08:20Z session-start send found 0 ready leads. All 180 emails came from Siege. |

Six debriefs are still unwritten: 09-19, 09-18, 09-17, 08-18, 08-17, 07-11.

## Fix shipped this cycle

**`debrief-data.ts` (orchestrator): a mailbox sliding from watch to stop stops being charged
against the clear band.**

`band_moved_to_normal`, `band_moved_to_watch` and `band_moved_to_stop` are *arrivals*: how
many mailboxes the gate handed each band. The subtraction the 11-09 fix installed assumes
every arrival in watch or stop came *out of* normal. One did not, today, and the identity
went short by exactly one.

That matters because of what it leaves the reader to conclude. The only documented shape
that breaks the subtraction is the 11-10 short read, and `band_moves_comparable` truthfully
reported that as absent. So a day on which the fleet behaved perfectly read as a day on
which the instrument could not be trusted — the 10-29 rule (a figure counting the wrong
population, sitting in the field a decision turns on) one level up.

`band_left_normal` is now the arrivals in watch or stop whose band immediately before the
move really was normal, so

    band_normal_prev + band_moved_to_normal − band_left_normal = band_normal

closes by construction. A run names the mailboxes it moved and never the band it moved them
from, so the prior band is reconstructed by walking every retained run in order, including
the ones behind the window. A mailbox no run can place falls back on that run's own band
deltas: a run with no returners whose clear count fell by exactly the number of demotions
took all of them out of normal, and one whose clear count did not move took none. Anything
else stays in `band_left_normal_unknown`, which makes the figure a lower bound rather than a
guess.

*Verified:* typecheck clean, **365 selftest assertions** with 5 new ones built on the real
11-12/11-13 gate history, including a run that promoted and demoted at the same time and
therefore must refuse to settle. Run against the live gate state it returns 2 departures, 0
unknown, and 44 + 2 − 2 = 44 exactly.

The snapshot behind this report was written before the fix, so it carries the three arrival
counts and not the new fields. The 2 and the closing arithmetic above come from running the
fixed function against the gate's own state file. Tomorrow's snapshot carries them.

## What to do next

1. **Put money on OpenRouter. It is past zero and it has now cost something.** 94 refused
   reply reads since 22:27Z, three creator replies unread this morning, and today's push
   writes on an empty account. Six mornings at the top of this list, still the cheapest item
   on it, and the only one with a clock.
2. **Decide what share of the day's slots should reach somebody new.** 180 emails reached
   three new people, the plan filled all 206 slots the fleet had, 1,184 ready people waited
   behind the whale tier's re-offer queue, and 4,849 written-ready sit on the shelf behind
   them. Repeat offers are deliberate and worth sending. 177 to 3 is a mix nobody has chosen
   out loud. The tier order lives in `automator`.
3. **Stop planning the 15-person lost cohort.** One refused on ten consecutive sending days,
   eight carrying a bounce on SmartLead's own file, two unsubscribed. About 7% of a 206-slot
   day plus a writer's time every morning. The repair is in `automator`.
4. **The 36 SmartLead suspensions are the whole recoverable block**, up by two. Ten more held
   mailboxes are already healthy and seven lift themselves, the closest within 24 hours.
   Nothing else on the fleet is repairable, and the fleet is what caps the day at 206 against
   the 870 the ramp allows.
5. **Net-new supply is one person a day and no lane is short of money.** Collect book 99.7%
   already on file at lap 16, 113 of 122 candidate sites refused by the ownership gate with
   zero search refusals, Apify holding $21 it cannot spend. Nothing here is broken.

## Grounding

Read directly rather than inferred:

- the OpenRouter balance, by calling the credits endpoint this morning ($1,610 bought,
  $1,610.188322 used);
- the depletion time and its cost, by counting every `402 Payment Required` in
  `automator/logs/smartlead-auto-reply.log` (94, all inside this cycle, first at
  22:27:55Z), the 42 runs that ended `failed` after it, and the unread queue going from one
  reply to three;
- the positive reply being read two hours earlier, from the `WOULD-SEND` lines in that file;
- the push window and its 179 logged sends, counted in `automator/logs/siege.log`, first at
  11:54:53Z and last at 13:40:17Z;
- the hourly band readings and every move behind them, from the `bands:` lines in
  `automator/logs/inbox-health.log`, which put the 00:06Z mover's departure in the watch band;
- the fix, by running the selftests and the changed function against that same live state.

**Not verified:** what spends the roughly $1 a day, which neither enrichment nor the finder
accounts for; how much of today's push a dry account will really stop, since most live
offers write from templates; why SmartLead suspends whole domains; whether the whale tier's
re-offer queue holds any never-emailed people, which decides whether recommendation 2 is a
config change or a tier that has run out; and whether the seven silent losses are the 11-07
shape, since the split can only say the log never mentioned them.
