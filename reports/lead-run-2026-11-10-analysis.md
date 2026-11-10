# Lead Run Analysis — 2026-11-10

Cycle: 2026-11-09T08:00:00Z to 2026-11-10T08:00:00Z (the 24h ending at midnight PT, so all
of Monday 9 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-10.json`.
Companion to [lead-run-2026-11-10.html](lead-run-2026-11-10.html).

## Headline

**213 people heard from us for the first time, and every one of them was genuinely new.**
231 emails, 227 people, 213 first touches, `first_touch_recovered` zero. 189 of those came
off the `approved_hold` shelf, which is the only thing that drains it. The prior seven days
reached 700 new people, about 100 a day, so Monday ran at roughly twice the recent rate and
nothing about it was a backlog finally flying.

**The push lost 11 people and 9 of them have been lost before.** One has now been refused on
nine consecutive pushes and four more on six. The snapshot published
`lost_longest_streak: 1`, which reads as "nobody has been lost twice in a row". That field is
wrong and the first fix below is why.

**The fleet's own headline figure is wrong too, in the other direction.** The snapshot says
13 mailboxes moved to the stopped band. Two did. Eleven of the thirteen were recorded by the
run after a gate reading that saw only 80 of the fleet's 94 mailboxes, and the stopped band
finished the cycle at 33 against 31. The arithmetic the 11-09 fix installed said so on its
own: 54 + 2 − 8 − 13 = 35, beside a clear count of 49.

**The recovery lane found 4 people, and one of its three collect passes ran with website
resolution switched off without saying a word.** Zero Brave searches across 150 leads, 149 of
them ending with no website, nine of thirteen collection methods skipping, and no line
anywhere in the log naming the cause. The snapshot filed it `unmeasured`, which means
unknowable, about the one cause that is free to fix.

**Nearly half the push's own narration went missing.** 68 push-batch processes ran and 41
printed a header. 204 sends are in the log and the send ledger holds 227 people, so 23 of
them exist only in the ledger. This is the 11-02 logging fault at four times the size, and
the only reason the loss count reads 11 instead of 34 is that the join reads the ledger too.

**OpenRouter has 2.3 days of credit.** Balance $4.29, down from $6.19. This was the number
one item yesterday and the day before, and the cold-email writer that wrote Monday's 231
emails runs on that account.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **231** | 807 people, about 115 a day |
| People reached for the first time | **213** | 706 |
| ...of those, never planned before | **213** | 700 |
| First touches off the shelf | **189** | — |
| People the push lost | **11** | 5, 5, 8, 9, 9 on the five sending days from 11-03 |
| Parked into `approved_hold` | **2** | 4 on 11-08, 2 on 11-09 |
| Free lane contact points | **7** | 74, about 11 a day |
| Free lane people with a new address | **2** | — |
| Paid Apify people recovered | **2** | 2 |
| Enrichment leads done | 2 | 3 on 11-09 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf moved the way a real sending day moves it. `ready_to_write` 5,054 to **4,868**,
down 186 against 189 shelf first touches and 2 parked. People with a real send row 2,310 to
**2,494**. `already_sent` reads 2,500, and the gap between those two is
`marked_sent_never_emailed`, which went **1 to 6**: five people were stamped
`sent_to_smartlead` this cycle with no send row behind it. That is the withdrawal shape from
the 10-28 debrief, where a lead pulled before delivery keeps the stamp, and the stamp keeps
them out of every future plan. Which batch withdrew them was not isolated.

## Q1. 231 emails. How many of them reached somebody new?

**213, and all 213 were new people rather than a credited backlog.** The distinction is the
one the 10-29 cycle taught: a first touch can be somebody a push already credited on an
earlier day and never actually emailed. Not here. `first_touch_recovered` is 0,
`first_touch_new` is 213, and `first_touch_recovered_oldest_day` is null because there is no
backlog in the number.

| | This cycle | Prior 7 days |
|---|---|---|
| People emailed | 227 | 807 |
| First touches | 213 (93.8%) | 706 (87.5%) |
| Recovered (already credited earlier) | **0** | 6 |
| Genuinely new | **213** | 700 |

**Reach is capacity-bound, not supply-bound.** The plan carried 238 people because the live
mailboxes had exactly 238 slots, and **1,573 ready people waited for a slot**: 988 whale
tier, 552 strong-7, 33 other-7. Behind them sit 4,868 written-ready people on the shelf. So
the thing that sets tomorrow's reach is mailboxes, not leads.

Of 124 mailboxes, 34 were live. The reasons the other 90 sat out, read as slots the day
really lost (the reason a mailbox carries **alone**, never the count of mailboxes naming it):

| Reason | Mailboxes naming it | Carrying it alone |
|---|---|---|
| suspended in SmartLead | 60 | **31** |
| no Siege campaign yet | 26 | **17** |
| not in the InboxKit warmup list | 30 | 0 |
| SMTP or IMAP failing | 9 | 0 |
| SmartLead did not return its suspension status | 4 | 2 |
| health watch, follow-ups only (score under 90) | 3 | 1 |

So 48 mailboxes are blocked by two things that are both repairable, and the other rows are
passengers. The warmup-list row is the one the 11-04 debrief chased and the 11-05 one
corrected: 30 mailboxes name it, none of them is held by it alone, and repairing it frees
nobody.

## Q2. The push lost 11 people. Is that new damage?

**No. Nine of the eleven have been lost before, and one of them on nine consecutive
pushes.** Two were new. The published `lost_longest_streak` read **1**, which is exactly the
reading the field exists to prevent.

The cause is a weekend. The streak walk steps over a day with no push, and it looked for one
by its loss list being unreadable. A weekend snapshot does not have that shape: it carries an
empty `lost_ids` beside a null `people_lost`, which passed the array check and entered the
history as a day on which nobody was lost. Siege's timer is Monday to Friday, so **every
Monday cycle would have reset this figure to 1** whatever the cohort was doing. Recomputed
against the snapshots themselves, skipping only the days whose join never ran:

| Lead | Consecutive pushes lost |
|---|---|
| `rec4pF59htOiO9TDi` | **9** |
| `rec6xTBGohaDqD6hZ`, `recYIzI1wmtvWAfyc`, `recbTk8oiIV9YFFSE`, `recztuJgfiqZFBpQC` | 6 |
| `recqTEuhx6XnmaKB4`, `rec1c1JQlMsCrvC7b`, `recYZCjHSZnKslfkq` | 4 |
| `rec7rVifyKuWiSaFP` | 3 |
| `rec1tRb905TNC3CoW`, `recSnvwDP2TG0GTGG` | 1 (new today) |

What refused them:

| Reason | Leads | People it cost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 6 | **6** |
| absent from this batch's Siege manifest | 11 | 1 |
| no draft written: business owner, no clean job title | 1 | 1 |
| (no line in the log at all) | — | 4 |

The 11-07 debrief already established what this cohort is: two of them have channels that no
longer exist on YouTube and five carry a bounce on SmartLead's file. The plan re-plans them
every morning, a writer writes them again, and SmartLead refuses them again. The repair is to
stop planning them, which lives in `automator`.

### The push log dropped 27 of its 68 batches

68 `push-batch.ts` processes ran between 12:03:08Z and 13:40:33Z. **41 printed a header.**
The log holds 204 SENT lines, matching `push_outcome.sent`, while the send ledger holds
**227 people**. So 23 people were emailed and the log never mentions them
(`emailed_unlogged: 23`).

This is the 11-02 fault at four times the scale, and it is the reason the ledger join exists:
without it the per-person join would have called those 23 lost and published a shortfall of
34 on a day that lost 11. The fault is in the send path's logging, in `automator`, not in the
leads.

## Q3. The recovery lane found 4 people. What is holding it back?

Three things, and only one of them is new.

**One of the cycle's three collect passes ran with website resolution off, silently.** The
20:01Z pass walked 150 leads, made **zero** Brave searches, and left **149** of them with no
website. Nine of the lane's thirteen methods start from a website, so they skipped. Nothing
in the collect log said why, and the snapshot filed `cause: unmeasured`.

The code had a loud warning built for exactly this, added on 2026-10-05, and a guard at the
call site stopped it firing. The call read "if there is no website **and a Brave key is
configured**, search", and the function it guarded is the one that counts a keyless lead and
prints the warning. With no key the call never happened, so there was no search, no warning
and no per-pass Brave summary. Second fix below.

Be careful what that cost. The pass before it had Brave working and resolved 10 websites out
of 150, so the keyless pass lost on the order of **nine websites**, not 150. This is a fix
for being able to see the fault, not a recovered yield.

**The ownership gate is the larger bottleneck, and it is deliberate.** On the 13:01Z pass
Brave ran 150 searches and returned a candidate site for 125 of them. **Ten leads ended the
pass with a website.** So the gate refused about 115 of 125 candidates, 92%, which matches
the 93% measured on 11-09. The 2026-10-10 note already settled that this shape is not
buyable: Brave credit changes nothing.

**The book is picked over.** Over the cycle's 450 lead-walks the methods found **687** contact
methods and **680 were already on file, 99%**. The lane is on lap 16 of a 1,792-lead book,
and `stranded` is 3 and flat, so no selector gap has reopened.

The paid Apify lane recovered 2 people for $0.07 each and then stopped for want of
candidates: dry on **9 consecutive ticks** since 2026-11-09T10:20:45Z, with $31.06 of
November's allowance unspent and $21.06 spendable to 11-30. `projected_leads` is a measured
0 and the binding constraint reads `candidate_supply`. More money buys nothing there.

Three methods remain quiet: `04-holehe` 83 days, `19-github` 23, `26-instagram` 19.

## The fleet

| | 11-09 08:05Z | 11-10 08:05Z |
|---|---|---|
| clear (`band_normal`) | 54 | **49** |
| watch | 9 | 12 |
| stop | 31 | 33 |

**Read the band counts, not the move counts, for this cycle.** `band_moves_comparable` is now
false and names why: the 16:05:22Z gate run read **80 of 94** mailboxes, printing 20 stopped
against the 31 it had read an hour earlier, and the 17:05:26Z run read all 94 again and
recorded **11 mailboxes moving to stop**, which put the stopped band back on exactly the 31
it held at 15:05Z. Nothing moved. The day's real new stops are **2**, one at 22:05Z and one
at 03:05Z, and both came out of the watch band rather than the clear one.

The gate also skipped four hourly runs entirely, 18:05Z through 21:05Z. Nothing in this repo
reads those, and the gate lives in `automator`.

**Nine held mailboxes are already healthy**, eight waiting out the 48-hour clean clock with
the closest due in **1 hour**, and one held only because a sibling on its domain is sick. So
about nine come back for free without anyone touching a config.

**49 clear is not 49 able to send.** The band gate bands on health; SmartLead's own
suspensions and the warmup floor are separate instruments, and reading one as the other is
the 11-03 lesson. Monday's plan read 34 live inboxes against 49 clear.

## Money and quiet

| | |
|---|---|
| **OpenRouter** | Balance **$4.29**, **2.3 days** of runway at $1.90 a day. The finder's own log accounts for $0.0028 of it across 6 `qwen3.7-flash` calls. The rest is the cold-email writer and the enrichment backfill, neither of which writes a spend log. |
| **Anthropic** | **$0**, against a $75 soft ceiling. |
| **Faults** | **0** fatal error signatures, no halt flag, 1 escalation inside the push. |
| **YouTube keys** | **15** working of 66 probed, 50 still quota-exhausted after the midnight reset. Settled since 2026-09-16 and irrelevant while discovery is off. |
| **Discovery** | **0** new channels, Casey's standing order of 2026-09-08. Every sweep idle by design, the campaign block all zeros. |
| **This repo's own sends** | 4 emails at 2026-11-09T08:20Z from the session-start send, which yesterday's debrief flagged as landing in today's numbers. They did. Today's 08:20Z run found 0 ready leads. |

## Fixes shipped this cycle

**`87568f2` (orchestrator) a weekend no longer resets the push-loss streak.** `lostCohort()`
now skips a prior snapshot whose `people_lost` is null, which is the no-push shape, and counts
a day as clear only when the join really ran and found nobody. A weekend wrote an empty
`lost_ids` beside a null `people_lost`, and the array check let it through as a clear day.
Verified: typecheck clean, 348 selftest assertions pass with 3 new ones built on the real
weekend shape, and recomputed against the live snapshots the streak reads 9 where the
published field read 1.

**`ff283728a` (email repo) a keyless Brave pool names itself again.** `buildContext()` no
longer short-circuits on `braveKeys().length > 0`, so `searchBrave()`'s own first branch runs:
it counts the lead, prints the one loud "website resolution is OFF" line, and makes the
per-pass Brave summary say so, which the orchestrator's `attributeNoSite()` already maps to
`search_off` (a configuration fault, free to fix) rather than `unmeasured`. No network call
happens without a key, so the call costs nothing. Verified: typecheck clean, and run with
every Brave key stripped from the environment it prints both lines and resolves no site.

**`8aab5dd` (orchestrator) a short gate reading no longer publishes moves that never
happened.** `bandGateFacts()` flags any run inside the move span that read a smaller fleet
than the run before it. `band_short_readings`, `band_short_reading_at` and
`band_moves_comparable` are the new fields, and a short run can no longer set
`band_peak_normal`. Which catch-up entries are real cannot be recovered from the gate's state
file, which keeps counts and move lists but never the roster, so this says so instead of
guessing. Verified: typecheck clean, 348 assertions pass with 4 new ones built on the real
11-09/11-10 gate history, and re-run against the live state file it returns 1 short reading
at 16:05:22Z, `band_moves_comparable: false`, and the subtraction still landing on 35 against
a clear count of 49.

## What to do next

1. **Put $20 on OpenRouter today.** Balance $4.29, 2.3 days, and Tuesday is a sending day.
   Monday's 231 emails were written on that account. A dry balance does not announce itself:
   the 2026-09-14 lesson is that a 402 shows up as exit 0 and done 0. Cheapest item here and
   the only one with a date on it. Third morning running.
2. **Reach is mailbox-bound now, so repair the 48 mailboxes blocked by one thing each.** 31
   suspended in SmartLead and 17 with no Siege campaign, against 1,573 ready people waiting
   for a slot and 4,868 written-ready on the shelf. Nine more held mailboxes come back for
   free within hours. Nothing upstream needs doing for reach to roughly double.
3. **Stop planning the nine-person lost cohort.** One of them has been refused on nine
   consecutive pushes, five carry a bounce already on SmartLead's file and two have channels
   that no longer exist. They cost about 4% of a 238-slot day and a writer's time every
   morning. The repair is in `automator`.
4. **Fix the push log dropping batches.** 27 of 68 batches printed nothing on Monday and 23
   people's sends exist only in the ledger. The sending is fine; the record of it is not, and
   every loss figure in this report depends on a join that has to work around it.
5. **Find out why five people got a sent stamp with no send behind it.** `marked_sent_never_emailed`
   went 1 to 6 this cycle. Each one is a written, verified, deliverable person who will never
   be offered again, because the stamp keeps them out of every plan.
6. **Decide the ownership-gate question for Brave's website guesses.** The gate refuses 92% of
   the candidates it is handed, which leaves most of each pass with no website and so no
   access to nine of thirteen collection methods. It is the recovery lane's real ceiling and
   it is a judgment call about evidence, not a spend.
7. **Find out why SmartLead suspends whole domains.** Unchanged, and still the largest single
   block on the fleet, with 31 mailboxes held by nothing else.

## Grounding

Numbers come from `logs/autopilot-debrief-2026-11-10.json` for the 24 hours to
2026-11-10T08:00Z. Read directly rather than inferred: the per-lead and per-pass site
resolution figures, by parsing the three in-cycle collect passes out of
`logs/bloodhound-collect.log` and the dispatch times out of the `bloodhound_collect` events
in `logs/campaign-2026-11-09.jsonl` and `-11-10.jsonl`; the keyless pass having made no Brave
search, from the absence of its per-pass summary line and the presence of every other pass's;
the 68 push-batch invocations against 41 headers and 204 SENT lines, by counting them in
`automator/logs/siege.log`; the hourly band readings, the short 80-mailbox run and the
catch-up run, from `automator/logs/inbox-health.log` and the per-run move lists in
`automator/state/inbox-health.json`; the real loss streaks, by recomputing the cohort join
over the fourteen prior snapshots this script wrote; and all three fixes, by running the
selftests and re-running each changed function against the live log and state file.

**Not verified:** which batch withdrew the five newly stranded people, or whether they can be
restored; what spends the roughly $1.90 a day of OpenRouter credit that the finder's log and
two enriched leads do not account for; whether the 48 recoverable mailboxes would clear on
request, since neither SmartLead nor the Siege campaign list was re-read this morning; which
half of the Brave ownership gate refuses each candidate, which is recommendation 6 and is a
measurement still to take; and why SmartLead suspends whole domains, which stays on the list
precisely because it is unexplained.
