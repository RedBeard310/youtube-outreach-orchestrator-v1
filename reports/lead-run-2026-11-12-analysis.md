# Lead Run Analysis — 2026-11-12

Cycle: 2026-11-11T08:00:00Z to 2026-11-12T08:00:00Z (the 24h ending at midnight PT, so all
of Wednesday 11 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-12.json`.
Companion to [lead-run-2026-11-12.html](lead-run-2026-11-12.html).

## Headline

**242 emails went out and one person heard from us for the first time.** Six more first
touches were people an earlier push had already credited, and the other 234 emails were
repeat offers to creators we have written to before. First touches were 2.9% of the day
against 70.5% over the prior week, which reached 828 new people. Yesterday the same figure
was 26. The day before that, 213.

**The six credited-again first touches are a thing yesterday's debrief asked us to watch,
and they resolved the right way.** Six leads had carried a sent stamp since 2026-11-02 with
no email behind them, their send rows deleted by a withdrawal. Every one of them was really
emailed inside this cycle, between 12:49:54Z and 13:00:33Z. The stranded count went 7 to
**1**, and the one left is `recPSkSNP2HeR6CCV`, stamped 2026-10-07, 36 days with no send row
and no plan. That shape needs no work. The one lead does.

**The push lost 18 people and reported zero new damage, which it could not know.** The
split that answers "is this a standing cohort or a fresh leak" is measured over the day's
named loss list, and that list was capped at 12. All 12 it examined were people an earlier
push had already lost, one of them for the tenth consecutive time. Six people were never
looked at. The cap had already truncated the same figure on 11-11, where it published 4 new
losses out of 16. Fixed below.

**Net-new sendable people are down to three.** The recovery lane's own output was 12 contact
points and 4 people with a new address, against 65 points the prior week. Three leads parked
into `approved_hold`. Its book is 99.2% already on file at lap 16, Apify has answered "no
candidates" on 33 consecutive ticks with $21 it cannot spend, and discovery is off by
standing order.

**OpenRouter has half a day of credit.** Balance **$0.82**, down from $2.60. This is the
fifth morning it has led the list. Every cold email the pipeline writes runs on that
account, including the 242 that went out yesterday, and today is a sending day.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **242** | 1,183 people, about 169 a day |
| People reached for the first time | **7** (2.9%) | 834 (70.5%) |
| ...of those, never planned before | **1** | 828 |
| First touches off the shelf | 7 | — |
| People the push lost | **18** | 5, 5, 8, 9, 9, 11, 16 on the sending days from 11-03 |
| ...of those, new damage | **0 of the 12 examined** | — |
| Parked into `approved_hold` | **3** | 1 on 11-11, 2 on 11-10 |
| Recovery lane contact points (its own) | **12** | 65 |
| Recovery lane people with a new address (its own) | **4** | — |
| Paid Apify people recovered | **0** | 0 |
| Enrichment leads done | 3 | 1 on 11-11 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf is flat: `ready_to_write` 4,849 to **4,851**, which is 3 parked minus 7 shelf first
touches plus a little churn. People with a real send row went 2,513 to **2,520**. Enrichment
sits at 99.8% of the shelf, which is why the backfill chain ran three leads all day.

## Q1. 242 emails. How many reached somebody new?

**One.**

| | This cycle | Prior 7 days |
|---|---|---|
| People emailed | 241 | 1,183 |
| First touches | **7** (2.9%) | 834 (70.5%) |
| Already credited on an earlier day | 6 | 6 |
| Genuinely new | **1** | 828 |

Those six are the stranded cohort, confirmed one by one against the send ledger. Taking them
out, the day reached one new creator. Across the eight days ending with this cycle the total
is five.

**The capacity was spent on re-offers again, and this time the queue was the whole plan.**
The plan carried 277 people against exactly 277 mailbox slots, so every slot the fleet had
was filled. Behind them **1,240 ready people waited**: 623 whale tier, 606 strong-7, 11
other-7. Slots go out by tier, and the whale tier's re-offer queue takes them before a
never-emailed person below it gets one.

This is deliberate. Repeat offers were switched on 2026-10-07 and a second offer to a
researched creator costs less than finding a new one. But the mix is 234 to 1, and 4,851
written-ready people sit on the shelf behind the 1,240. The tier order lives in `automator`.
This is the second morning the recommendation has been to decide the split on purpose.

**The fleet shrank while the health gate improved.** Live inboxes went 47 to **42** and the
day's allowance 705 to **630**, which is 75 fewer messages. Underneath that the band gate's
clear count actually rose, 43 to 44. The two instruments disagree because they measure
different things, which is the 10-18 lesson: the band gate bands on health, SmartLead's own
suspensions and the warmup floor are separate gates, and a mailbox can be clear on health
and still unable to send.

Read the reasons the other 82 mailboxes sat out as the slots each one really costs, which is
the mailboxes carrying that reason and nothing else:

| Why a mailbox sat out | Mailboxes naming it | Carrying it alone | 11-11 (alone) |
|---|---|---|---|
| suspended in SmartLead | 62 | **34** | 33 |
| not in the InboxKit warmup list | 30 | 0 | 0 |
| SMTP or IMAP failing | 12 | 0 | 0 |
| health watch, follow-ups only (recovering) | 7 | 3 | 2 |
| no Siege campaign yet | 7 | **0** | 2 |
| health watch, follow-ups only (score under 90) | 6 | **4** | 1 |
| on hold until a date | 6 | 0 | 0 |
| health stop by inbox-health.py | 2 | 0 | 0 |
| SmartLead did not return its status | 2 | 0 | 1 |

The Siege-campaign block is finished: it held 17 mailboxes alone on 11-10, 2 on 11-11, and
**0** now. Nothing else was repaired. The 34 SmartLead suspensions are the entire recoverable
block, up by one, and the only row that moved against us is the health-watch score row, which
went from 1 mailbox alone to 4.

## Q2. The push lost 18 people and said none of it was new. Could it know that?

**No. It looked at 12 of them.**

The field that answers whether the loss is growing is measured over the day's named loss
list, and that list was capped at 12. This cycle lost 18 people. All 12 it examined had been
lost by an earlier push, one of them on **ten consecutive pushes**, so the figure published
was `lost_new: 0`, which reads as "nobody new was lost today" about a day with six people
nobody had checked.

It had already gone wrong once. On 11-11 the push lost 16, the list held 12, and the snapshot
published 4 new losses as the whole day's damage. This is the 2026-10-29 lesson, a capped
display list used as a denominator, in the one field built to decide whether the repair is to
stop planning a standing cohort or to chase a new leak. First fix below.

What the push did report about the 18:

| What happened | People |
|---|---|
| SmartLead refused the lead, `bounce_count=1` | 8 |
| SmartLead refused the lead, already unsubscribed | 3 |
| Absent from the batch's Siege manifest | 2 |
| No draft written: business owner, no clean job title | 1 |
| Lost before the push could reach them | 1 |
| No line about them in the log at all | 5 |

The repair for the recurring cohort has not changed since 11-07. They carry a bounce on
SmartLead's own file, or they unsubscribed, or their channels no longer exist. The plan
re-plans them every morning, a writer writes them again, and SmartLead refuses them again.
That lives in `automator`.

Two things went better than they have in a week. Thirty-two planned emails were skipped by
the writer's own quality gate, led by the voice-objection offer at 16, and **30 of the 32
were written again and sent in the same run**, so they cost two people. And the push log
dropped only **5** people's sends against 47 on 11-11 and 23 on 11-10. Nothing was changed to
make that happen, so do not call it fixed, but the join had much less to work around.

The push ran 11:36:06Z to 13:00:44Z, logged 237 sends, and the ledger credits 242 people.

## Q3. What is still producing people we can email?

**Three a day, and two of the three lanes have stopped for reasons money cannot fix.**

| Lane | This cycle | Prior 7 days |
|---|---|---|
| Recovery lane, its own contact points | 12 | 65 |
| Recovery lane, people with a new address | 4 | — |
| Apify endspec, people recovered | 0 | 0 |
| Parked into `approved_hold` | **3** | — |
| New channels found | 0 | 0 |

A second caller of the same tool wrote 17 more points and 9 more addresses on people already
sitting on the shelf. That split shipped yesterday and it is doing its job: without it this
report would read 29 points and claim the lane held steady.

**The lane is finishing a picked-over book.** Across four collect passes it walked 600 leads,
the methods found **2,403** contact methods, and **2,384 were already on file (99.2%)**. It is
on lap 16 of a 1,782-lead book. `stranded` is 3 and flat, so no selector gap has reopened.
Website resolution is healthy: the newest pass left 2% of leads without a site, needed only 5
Brave searches because 147 of 150 leads already had one, and logged no key refusals.

`02-subpages` carried the day on its own: 10 points, 9 of them addresses, across 6 leads.
`18-rdap`, `01-mailto`, `17-podcast` and `28-sitemap` each found one address.
`34-channel-page` found 11 points and no addresses. Two methods remain quiet, `04-holehe` at
85 days and `19-github` at 25.

**The paid lane has money and nothing to buy with it.** Apify ran 0 batches and answered "no
candidates" on **33 consecutive ticks** since 2026-11-09T10:20Z, with $31.06 of November's
allowance unspent and $21.06 of it spendable until 11-30. `projected_leads` is a measured 0
and the binding constraint reads `candidate_supply`.

### The lane's largest fault was a 404 wearing a costume

The cycle logged 748 method errors. The biggest named condition is "cross-domain redirect" at
**231 (31%)**, and most of that is the ownership gate refusing by design: `aba.link` goes to
`andersonadvisors.com` on a lead whose creator is Clint Coons, `ltrp.xyz` goes to
`linguatrip.com` on a channel called LinguaTOEFL. The destination has to read like the
creator's own name, and these do not. The gate is working to the bar Casey's 2026-08-18 audit
set, so this is an evidence decision and not a bug.

The next one down was a real misreport. "non-HTML content-type" has 92 entries in the collect
log, **60 of them with an empty type**, and the other 32 all name a type the 2026-10-12 fix
went on to allow. Measured against the live sites: `http://subjectline.com/` answers 200 with
58 KB of HTML, while `/contact` and `/about` answer **404 with no body and no Content-Type
header**, which is a server saying the page is not there. The fetch gate reached its
content-type line before anything looked at the status, so a guessed subpage that simply does
not exist was arriving in the pass's fault roll-up as a broken fetch gate. Second fix below.

## The fleet

| | 11-11 08:05Z | 11-12 08:05Z |
|---|---|---|
| clear (`band_normal`) | 43 | **44** |
| watch | 15 | 14 |
| stop | 36 | 36 |

**The arithmetic closes exactly for the second day running.** 43 clear, plus 5 back to
normal, minus 4 to watch, minus 0 to stop, is 44. `band_moves_comparable` is true and
`band_short_readings` is 0, so no gate run read a short fleet this cycle.

The fleet dipped to 41 clear at 10:06Z, climbed to a peak of **46 at 13:06Z** as the push ran,
held 46 for thirteen straight hours, then drifted to 44 overnight. Five mailboxes came back to
normal and all five still hold it, with no round trips. **Eight held mailboxes are already
healthy**: six waiting out the 48-hour clean clock with the closest due in **3 hours**, and two
held only because a sibling on their domain is sick. So eight come back for free.

The older warmup gate paused 3 mailboxes, all on health score, none on warmup day.

## Money and quiet

| | |
|---|---|
| **OpenRouter** | Balance **$0.82**, **0.5 days** of runway at $1.78 a day. At the measured $0.11 an enriched lead that is about seven leads, and it also pays for every cold email written. |
| **Anthropic** | **$0**, against a $75 soft ceiling. |
| **Faults** | **0** fatal error signatures, no halt flag, 1 escalation inside the push. |
| **YouTube keys** | **15** working of 66 probed, 50 still quota-exhausted after the midnight reset. Settled since 2026-09-16 and irrelevant while discovery is off. |
| **Discovery** | **0** new channels, Casey's standing order of 2026-09-08. Every sweep idle by design, the campaign block all zeros. |
| **This repo's own sends** | The 08:20Z session-start send found 0 ready leads and sent nothing. All 242 emails came from Siege. |

## Fixes shipped this cycle

**`91c4e94` (orchestrator) the day's new push damage says how much of the loss it actually
examined.** `lost_ids` is capped at 60 now rather than 12, so the cohort split is complete on
any real day against a roughly 300-slot plan, and the coverage is published either way:
`lost_split_covered` is how many of `people_lost` the split examined, `lost_split_complete` is
whether that was all of them, and `lost_history_capped_days` counts prior days inside the
14-day window whose own list was shorter than their own loss, because recurrence cannot be
checked against a loss a past snapshot never wrote down. The 11-11 and 11-12 snapshots are
both such days, so the first fully comparable window starts 11-13, and until then `lost_new`
is a lower bound and says so. A second fault in the same function went with it: a loss nobody
computed was reading as a loss of nobody, because `people_lost` is null when the plan cannot
be read and the loss list is then empty beside it. That is the shape the 11-10 fix taught the
history walk to step over while today's side kept answering 0, which is why the 11-08 and
11-09 snapshots carry three zeros for cycles whose loss was never computed. Those read null
now. *Verified: typecheck clean, 360 selftest assertions pass with 6 new ones over the live
11-11 and 11-12 shapes, and run against this cycle's real snapshots it returns 12 recurring,
0 new, a streak of 10, 12 of 18 examined, `complete: false` and 2 capped prior days, matching
a hand count of the same files.* The commit landed under an `auto-sync` message because the
2-minute sync timer committed the working tree first, which is the known race; the change is
in `scripts/autopilot/debrief-data.ts` and pushed.

**`8c169d3ef` (email repo) a guessed subpage that is simply not there stops reporting as a
fetch-gate fault.** `fetchRaw` reads the status before its content-type line, so a 404 with no
body now throws `HTTP 404 with no body` instead of `non-HTML content-type ""`. What is left
after that is a real 2xx with no declared type, and for those the body is asked rather than
guessed at, the way a browser does it: `looksLikeMarkup()` tests the first 2 KB against a list
of document openings, so a PDF, a PNG, a zip or plain prose still fails and the gate keeps
doing the job it exists for. Both refusals still throw, so every caller's control flow and the
per-lead failure cache behave exactly as before. *Verified: typecheck clean, 305 vitest tests
green, all three existing bloodhound selftests green, and 27 new assertions in
`src/bloodhound/web-content-type.selftest.ts` over the real openings and the real binaries.
Run live, subjectline.com, advancedmarketers.co, rsa.pro and www.fencebrothers.com all fetch
through it at 58 KB, 46 KB, 143 KB and 98 KB, while two 404 subpage probes now name their
status. One of those four opens on an HTML comment rather than a doctype, which caught a real
defect on the way in: the word boundary the named tags need cannot follow a run of dashes, so
the first draft silently never matched a CMS banner.*

The yield half of the second fix is honestly unmeasured. The log never distinguished a 2xx
with no type from a 404 with no type, so how many pages come back readable now cannot be
counted from it. What is measured is that the condition stops pointing at a gate that was not
broken.

## What to do next

1. **Put $20 on OpenRouter today, before the push runs.** Balance **$0.82**, half a day, and
   today is a sending day. Every cold email the pipeline writes runs on that account. A dry
   balance does not announce itself: the 2026-09-14 lesson is that a 402 shows up as exit 0
   and done 0, so the first sign would be a push that writes nothing and says it worked.
   Cheapest item on this list, the only one with a clock on it, and the fifth morning running.
2. **Decide what share of the day's slots should reach somebody new.** 242 emails reached one
   new person. The plan filled all 277 slots the fleet had, 1,240 ready people waited behind
   the whale tier's re-offer queue, and 4,851 written-ready sit on the shelf. Repeat offers are
   deliberate and worth sending; 234 to 1 is a mix nobody has chosen out loud. The tier order
   lives in `automator`.
3. **The 34 SmartLead suspensions are now the whole recoverable block.** The Siege-campaign
   block you cleared over the last two days is at zero, which is what bought the 46-mailbox
   peak. Eight more held mailboxes come back for free within hours. Nothing else on the fleet
   is repairable from here.
4. **Stop planning the 12-person lost cohort.** One has been refused on ten consecutive
   pushes, eight carry a bounce on SmartLead's own file and three have unsubscribed. They cost
   about 4% of a 277-slot day plus a writer's time every morning. The repair is in `automator`.
5. **Revert one stamp.** `recPSkSNP2HeR6CCV` has been marked sent since 2026-10-07 with no send
   row and no plan, so nothing will ever offer them again. The other six in that gap flew
   yesterday, exactly as the 11-11 report hoped, so this is now a one-lead job.
6. **Net-new supply is three people a day. Accept it or lift something.** The recovery book is
   99.2% already on file at lap 16, Apify has $21 it cannot spend for want of candidates, and
   discovery is off by order. Nothing here is broken. The shelf is 4,851 deep, which at this
   cycle's first-touch rate is effectively forever and at Monday's is about three weeks.

## Grounding

Numbers come from `logs/autopilot-debrief-2026-11-12.json` for the 24 hours to
2026-11-12T08:00Z. Read directly rather than inferred: the six credited-again first touches,
by querying `outreach_processed_at` and `leads.outreach_sends` in Postgres for all seven ids
the 11-11 snapshot named as stranded, which returned a fresh send row for six of them between
12:49:54Z and 13:00:33Z on 11-11 and nothing at all for `recPSkSNP2HeR6CCV`; the push window
and its 237 logged sends, by counting them in `automator/logs/siege.log`; the hourly band
readings, the 13:06Z peak and the overnight drift, from the `bands:` lines in
`automator/logs/inbox-health.log`; the ownership-gate refusals behind "cross-domain redirect",
by reading the redirect targets out of `logs/bloodhound-collect.log` against each lead's
channel name; the empty-content-type shape, by counting all 92 refusals in that log and then
fetching the four live sites behind the largest shapes and their 404 subpages; the cohort
split's own truncation, by comparing `people_lost` against the length of `lost_ids` in every
snapshot back to 11-03; and both fixes, by running the selftests, the email repo's vitest
suite, and each changed function against the live data.

**Not verified:** why SmartLead suspends whole domains, which is the only recoverable block
left on the fleet and stays on this list because it is unexplained; what spends the $1.78 a
day of OpenRouter credit that three enriched leads and zero finder calls do not account for;
how many pages the content-type fix really recovers, since the log never separated a 2xx with
no type from a 404 with no type; whether the whale tier's re-offer queue has any
never-emailed people left in it, which decides whether recommendation 2 is a config change or
a tier that has run out; and why the push log dropped 5 people this cycle against 47 the day
before, since nothing was changed to improve it.
