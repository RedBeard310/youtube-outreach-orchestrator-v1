# Lead Run Analysis — 2026-11-11

Cycle: 2026-11-10T08:00:00Z to 2026-11-11T08:00:00Z (the 24h ending at midnight PT, so all
of Tuesday 10 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-11.json`.
Companion to [lead-run-2026-11-11.html](lead-run-2026-11-11.html).

## Headline

**374 emails went out, the biggest day since 2026-10-13, and 26 people heard from us for the
first time.** The other 340 were repeat offers to people we have already written to. First
touches were 8.4% of the day against 88.4% over the prior week, which reached 811 new people.
The emails are not wasted (repeat offers have been deliberate since 2026-10-07) but this was
a different kind of day from the one the headline number describes, and the difference is
187 new people.

**The fleet repair from yesterday's recommendation landed, and it worked.** The "no Siege
campaign yet" block went from 17 mailboxes held by nothing else to 2. Live inboxes went 34 to
**47** and the day's message allowance 510 to **705**. That is where the extra 143 emails came
from.

**The recovery lane looks like it tripled its output and it actually collapsed.** The snapshot
published 173 contact points and 19 people with a new address against 73 and 23 the prior
week. Thirteen of those points were this lane's, on 11 people, and **two** of the addresses.
The other 160 belong to a different caller of the same tool, on people already sitting on the
shelf. The lane's own week ran 59 points down to 13. First fix below.

**Seven people carry a sent stamp with no email behind it, and none of them was stamped this
cycle.** Six were stamped on 2026-11-02 and had send rows yesterday, so those rows were
deleted inside this cycle, which is a withdrawal. The same cycle's push planned all six again
and the approval gate held them for the next morning. One has carried the stamp since
2026-10-07. Yesterday's five, by contrast, were stamped that cycle and every one of them was
really emailed inside this one. Second fix below.

**The push lost 16 people and 4 of them are new damage.** Eight have been lost before, one on
ten consecutive pushes. Seven of the sixteen carry a bounce already on SmartLead's file.

**OpenRouter has 1.5 days of credit.** Balance $2.60, down from $4.29. This is the fourth
morning it has led the list, and the 374 emails that went out yesterday were written on that
account.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **374** | 924 people, about 132 a day |
| People reached for the first time | **31** (8.4%) | 817 (88.4%) |
| ...of those, never planned before | **26** | 811 |
| First touches off the shelf | 25 | — |
| People the push lost | **16** | 5, 5, 8, 9, 9, 11 on the sending days from 11-03 |
| ...of those, new damage | **4** | — |
| Parked into `approved_hold` | **1** | 2 on 11-09, 2 on 11-10 |
| Recovery lane contact points (its own) | **13** | 59 |
| Recovery lane people with a new address (its own) | **2** | — |
| Paid Apify people recovered | **0** | 2 |
| Enrichment leads done | 1 | 2 on 11-10 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf barely moved: `ready_to_write` 4,868 to **4,849**, down 19 against 25 shelf first
touches and 1 parked. People with a real send row 2,494 to **2,513**. Enrichment is at 99.8%
of the shelf, which is why the backfill chain ran one lead all day: there is almost nothing
left to enrich.

## Q1. 374 emails. How many reached somebody new?

**Twenty-six.** Thirty-one first touches, five of which were people an earlier push had
already credited, so 26 had never been planned before.

| | This cycle | Prior 7 days |
|---|---|---|
| People emailed | 371 | 924 |
| First touches | **31** (8.4%) | 817 (88.4%) |
| Already credited on an earlier day | 5 | 6 |
| Genuinely new | **26** | 811 |

**The capacity was there and the tier queue spent it on re-offers.** The plan carried 396
people against 396 mailbox slots, a 705-message allowance and zero follow-ups owed, which is
the roomiest fleet in weeks. Meanwhile **1,358 ready people waited for a slot**: 774 whale
tier, 573 strong-7, 11 other-7. Slots are handed out by tier, and the whale tier's re-offer
queue takes them before any never-emailed person below it gets one. The whale queue drained
by 214 across the cycle, which is roughly the 340 repeat offers that went out.

This is not a fault. Repeat offers were switched on deliberately on 2026-10-07 and a second
offer to a researched creator is cheaper than finding a new one. But the mix is now 9 to 1
against new people, and the thing deciding it is the tier order in `automator`, not a
shortage of leads: 4,849 written-ready people sit on the shelf behind those 1,358.

**The fleet is the one thing that genuinely improved.** Of 124 mailboxes, 47 were live
against 34 on Monday. Read the reasons the other 77 sat out as the slots each one really
costs, which is the mailboxes carrying that reason and nothing else:

| Why a mailbox sat out | Mailboxes naming it | Carrying it alone | Monday |
|---|---|---|---|
| suspended in SmartLead | 63 | **33** | 31 |
| not in the InboxKit warmup list | 30 | 0 | 0 |
| SMTP or IMAP failing | 12 | 0 | 0 |
| no Siege campaign yet | 10 | **2** | **17** |
| health watch, follow-ups only (recovering) | 9 | 2 | 0 |
| on hold until a date | 6 | 0 | — |
| SmartLead did not return its status | 3 | 1 | 2 |

The Siege-campaign row is yesterday's recommendation 2, half done. Fifteen mailboxes came off
that block and the fleet gained 13 live inboxes and 195 messages a day. The other half, the
33 mailboxes SmartLead has suspended and nothing else is holding, is unchanged and is now the
whole recoverable block.

## Q2. The recovery lane published its best week. Did it have one?

**No. It had its worst week in a month, and the number said the opposite.**

`leads.contact_points` is a shared table. The 2026-10-02 fix split it by who paid, because
the Apify lane writes there too under an `apify:` source prefix. That fix assumed one free
writer. There are two: `automator/scripts/contact-lookup.py` runs on a 30-minute timer and
shells out to the **same** `npm run bloodhound -- --lead-ids` command to research one lead at
a time, so its points land under the identical method names (`33-about-text`,
`34-channel-page`, and the rest) and nothing in the row says which caller wrote it.

| Contact points this cycle | Points | Addresses | People with an address |
|---|---|---|---|
| Published as this lane (`free_*`) | 173 | 20 | 19 |
| Really this lane's | **13** | **2** | **2** |
| `contact-lookup`'s, on shelf leads | 160 | 18 | 17 |

Those 160 points landed on 30 `approved_hold` and 7 `approved` leads: people already on the
shelf, who cannot be recovered because they were never lost. The lane's own trend reverses
once they are taken out. Published: 173 this cycle against 73 the prior week, a tripling.
Real: **59 points down to 13**, with addresses 11 down to 2.

The lane said so itself in the same snapshot. Its four collect passes reported 14 points in
`site_resolution.cycle.points`, twelve times below the field a reader is told to read.

**What the lane is actually doing is finishing a picked-over book.** Across the cycle's four
passes it walked 600 leads, the methods found **2,292** contact methods, and **2,278 were
already on file (99.4%)**. It is on lap 16 of a 1,789-lead book and `stranded` is 3 and flat,
so no selector gap has reopened. Website resolution is healthy: the newest pass left 2% of
leads without a site, needed only 5 Brave searches because 147 of 150 leads already had one,
and logged zero key refusals.

The largest remaining fault is network, not logic: **"fetch failed" was 216 of the cycle's
744 method errors, 29%**, and it swung from 0 to 115 across the four passes, so it is not a
property of the book. Next after it are cross-domain redirect at 192 and non-HTML
content-type at 65. Three methods remain quiet: `04-holehe` 84 days, `19-github` 24,
`26-instagram` 20.

**The paid lane has money and nothing to spend it on.** Apify ran 0 batches and answered "no
candidates" on **21 consecutive ticks** since 2026-11-09T10:20Z, with $31.06 of November's
allowance unspent and $21.06 of it spendable until 11-30. `projected_leads` is a measured 0
and the binding constraint reads `candidate_supply`. More money buys nothing there.

Put plainly: with discovery paused by standing order, the recovery book picked over at lap 16
and the Apify lane out of candidates, net-new sendable people are running at one or two a
day. The pipeline is living off the 4,849-person shelf. That is the expected consequence of
the 09-08 order, not a fault, but it is the reason Q1's mix question matters.

## Q3. The push lost 16 people. Is that new damage?

**Four of it is.** Eight of the sixteen were already named by an earlier snapshot and one has
now been lost on **ten consecutive pushes**. Four more were lost before the push could reach
them or after it, with no reason line at all.

| What happened | People |
|---|---|
| SmartLead refused the lead, `bounce_count=1` | 7 |
| SmartLead refused the lead, already unsubscribed | 4 |
| No draft written: business owner, no clean job title | 1 |
| No line about them in the log at all | 4 |

The repair for the recurring eight has not changed since 11-07: they carry a bounce on
SmartLead's own file or their channels no longer exist, the plan re-plans them every morning,
a writer writes them again, and SmartLead refuses them again. Stopping that lives in
`automator`.

Twenty-eight planned emails were also skipped by the writer's own quality gate, led by the
voice-objection offer at 18. **Twenty-six of the 28 were written again and sent in the same
run, so they cost nobody.** That is the 10-21 lesson holding: a skip count is not a loss.

### The push log dropped twice as much as yesterday

109 `push-batch` processes ran between 11:43:57Z and 13:09:50Z. The log holds **327** SENT
lines, matching `push_outcome.sent`, while the send ledger holds **47 more people the log
never mentions** (`emailed_unlogged: 47`, with the ids capped at 12 in the snapshot). Monday
was 23. Without the ledger join added on 11-03, this report would have published 63 people
lost on a cycle that lost 16. The sending works; the record of it does not, and the fault is
in the send path's logging in `automator`.

### Seven people stamped as sent who were never emailed

`marked_sent_never_emailed` went 6 to **7**, and until this morning the number could not say
whether a newly stranded person flies tomorrow or never flies. It is now split by the age of
the stamp, and the three shapes inside it are different:

| | Count | What it is |
|---|---|---|
| Stamped inside this cycle | **0** | a stamp one day ahead of its send. All five of Monday's flew. |
| Stamped before it, still unsent | **7** | six from 2026-11-02, one from 2026-10-07 |

The six from 11-02 were **not** in yesterday's gap, so their send rows were deleted inside
this cycle, which is `siege_live.py` withdrawing them from a campaign. The same cycle's push
planned all six again and the approval gate held them for the next morning, so the send path
is already re-driving them. Monday's five went exactly that way and are this cycle's five
`first_touch_recovered`. The one standing exception is `recPSkSNP2HeR6CCV`, stamped
2026-10-07, 35 days with no send row and no plan. That one needs a stamp reverted, which is
the send path's call.

## The fleet

| | 11-10 08:05Z | 11-11 08:05Z |
|---|---|---|
| clear (`band_normal`) | 49 | **43** |
| watch | 12 | 15 |
| stop | 33 | 36 |

**The arithmetic closes exactly, for the first time since the move counts shipped.** 49 clear,
plus 3 back to normal, minus 6 to watch, minus 3 to stop, is 43. `band_moves_comparable` is
true and `band_short_readings` is 0, so yesterday's two fixes (the span end and the short-read
guard) are both doing their job on a clean day.

The fleet rose through the working day to a peak of **52 clear at 15:05Z** and then eroded
after midnight UTC: one to stop at 01:06Z, two more plus two to watch at 02:06Z, two to watch
at 03:06Z and two at 06:06Z. Everything that went wrong went wrong after the push, not
during it.

**Twelve held mailboxes are already healthy**, eight waiting out the 48-hour clean clock with
the closest due in **2 hours**, and four held only because a sibling on their domain is sick.
So about twelve come back for free without anyone touching a config. Note that 43 clear is not
43 able to send: the band gate bands on health, SmartLead's own suspensions and the warmup
floor are separate instruments, and Tuesday's plan read 47 live against 49 clear.

## Money and quiet

| | |
|---|---|
| **OpenRouter** | Balance **$2.60**, **1.5 days** of runway at $1.69 a day. The finder's own log accounts for $0 of it across 0 calls, so all of it is the cold-email writer and the enrichment backfill, neither of which writes a spend log. |
| **Anthropic** | **$0**, against a $75 soft ceiling. |
| **Faults** | **0** fatal error signatures, no halt flag, 1 escalation inside the push. |
| **YouTube keys** | **15** working of 66 probed, 50 still quota-exhausted after the midnight reset. Settled since 2026-09-16 and irrelevant while discovery is off. |
| **Discovery** | **0** new channels, Casey's standing order of 2026-09-08. Every sweep idle by design, the campaign block all zeros. |
| **This repo's own sends** | The 08:20Z session-start send found 0 ready leads and sent nothing. All 374 emails came from Siege. |

## Fixes shipped this cycle

**`7d38b2d` (orchestrator) the recovery lane's own output is split out from the other caller
of its CLI.** `collectYieldBetween()` now groups free contact points by whether the lead sits
in this lane's own book (`review_status = 'needs_contact'`, the same book `collectBookDepth()`
measures) and publishes `lane_*` beside `other_lane_*`. The discriminator is the lead rather
than the source, so it needs no maintenance when a new free method or a third caller appears.
`free_*` and the totals are left alone so nothing that already reads them shifts meaning, and
the note now says to read `lane_*`. One edge is stated because it cuts the safe way: a lead
the lane recovers inside the cycle has already flipped to `approved_hold` by measurement time,
so `lane_*` understates by at most that cycle's own parks, which `parked_today` publishes
beside it. *Verified: typecheck clean, and run against the live database for this cycle it
returns 13 lane points and 160 other-lane points, 2 lane addresses and 18 other, with both
splits summing exactly to the published `free_*` figures in the window and in the prior seven
days.*

**`84bb8f2` (orchestrator) a stranded lead that flies the next morning stops reading like one
nobody will ever email.** `shelfTally()` now takes the cycle start and splits
`marked_sent_never_emailed` into `_stamped_in_cycle` (a stamp ahead of its send, which has
resolved itself in a day) and `_standing` (a stamp that outlived the cycle that wrote it),
with `_oldest_stamp_day` for the age. Both are null, not zero, when the ledger is unreadable
or any stranded lead carries no stamp date, because a partial split reads as a complete one.
The selftest fixtures are built from the live column, which caught a real defect on the way
in: Postgres renders a whole-hour offset as `+00`, which `Date.parse` rejects outright, so the
first draft answered "unknown" for every lead on a perfectly readable stamp. *Verified:
typecheck clean, 355 selftest assertions pass with 7 new ones built on the real 11-10 and
11-11 shapes, and run against the live database it returns 7 stranded, 0 stamped in cycle, 7
standing, oldest 2026-10-07, matching a hand query of the same rows.*

## What to do next

1. **Put $20 on OpenRouter today.** Balance $2.60, 1.5 days, and today is a sending day.
   Yesterday's 374 emails were written on that account. A dry balance does not announce
   itself: the 2026-09-14 lesson is that a 402 shows up as exit 0 and done 0. Cheapest item
   here, the only one with a date on it, and the fourth morning running.
2. **Decide what share of the day's slots should reach somebody new.** 374 emails reached 26
   new people. The whale tier's re-offer queue takes the slots first, 1,358 ready people are
   waiting behind it and 4,849 written-ready sit on the shelf. Repeat offers are deliberate
   and worth sending; a 9-to-1 mix is a choice nobody has made out loud. The tier order lives
   in `automator`.
3. **Finish the fleet repair you started.** The Siege-campaign block went from 17 mailboxes to
   2 and bought 13 live inboxes and 195 messages a day inside one cycle. The 33 mailboxes
   SmartLead has suspended, with nothing else holding them, are now the entire recoverable
   block. Twelve more held mailboxes come back for free within hours.
4. **Stop planning the eight-person lost cohort.** One has now been refused on ten consecutive
   pushes, seven of the day's sixteen losses carry a bounce already on SmartLead's file. They
   cost about 4% of a 396-slot day plus a writer's time every morning. The repair is in
   `automator`.
5. **Fix the push log dropping batches.** 47 people's sends exist only in the ledger this
   cycle against 23 on Monday, so it is getting worse. Every loss figure in this report
   depends on a join that has to work around it.
6. **Revert one stamp and watch six.** `recPSkSNP2HeR6CCV` has been marked sent since
   2026-10-07 with no send row and no plan, so nothing will ever offer them again. The six
   withdrawn on 11-02 were re-planned yesterday and deferred to today; if they fly, that shape
   needs no work at all.
7. **Accept that net-new supply is one or two people a day, or lift something.** The recovery
   book is 99.4% already on file at lap 16, Apify has $21 it cannot spend for want of
   candidates, and discovery is off by order. Nothing here is broken. The shelf is 4,849 deep,
   which at Tuesday's first-touch rate is a very long time and at Monday's is about three
   weeks.

## Grounding

Numbers come from `logs/autopilot-debrief-2026-11-11.json` for the 24 hours to
2026-11-11T08:00Z. Read directly rather than inferred: the split of this cycle's contact
points by lane, by joining `leads.contact_points` against `leads.lead_candidates` in Postgres
and separately by checking that the 160 other-lane points belong to leads that appear nowhere
in `logs/bloodhound-collect.log`; the second writer's identity, from
`automator/scripts/contact-lookup.py`, its `contact-lookup.timer` and
`automator/state/contact-lookup.json`; the stranded cohort's stamps and send rows, by querying
`outreach_processed_at` and `leads.outreach_sends` for all twelve ids named across the 11-10
and 11-11 snapshots, which is how Monday's five were confirmed emailed and this cycle's six
confirmed withdrawn; the push window, the 109 batch processes and the 327 logged sends, by
counting them in `automator/logs/siege.log`; the hourly band readings and the overnight
erosion, from the `bands:` lines in `automator/logs/inbox-health.log`; the day being the
biggest since 10-13, by counting stamps per Pacific day back to 2026-10-01; and both fixes, by
running the selftests and re-running each changed function against the live database.

**Not verified:** why SmartLead suspends whole domains, which is now the only recoverable
block on the fleet and stays on the list because it is unexplained; what spends the $1.69 a
day of OpenRouter credit that one enriched lead and zero finder calls do not account for;
whether the six withdrawn leads fly today; what withdrew them in the first place; whether the
"fetch failed" errors in the collect pass are a provider rate limit, a DNS problem or dead
sites, since only the condition and not the host was read; and whether the whale tier's
re-offer queue has any never-emailed people left in it, which would decide whether
recommendation 2 is a config change or a tier that has simply run out.
