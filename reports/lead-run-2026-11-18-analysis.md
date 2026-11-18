# Lead Run Analysis, 2026-11-18

Cycle: 2026-11-17T08:00:00Z to 2026-11-18T08:00:00Z (the 24h ending at midnight PT, so all of
Tuesday 17 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-18.json`.
Companion to [lead-run-2026-11-18.html](lead-run-2026-11-18.html).

## Headline

**Two creators wrote back to say yes, and nothing in the pipeline is going to answer them.**
The reply lane read 7 people on Tuesday and 2 of them agreed to talk: `drtubio@gmail.com` and
`jessie@innercircleprints.com`. Casey paused the auto-reply sender on 2026-09-17, so the lane
classified both, logged both, and sent nothing. That is the pause working as ordered, not a
fault. It does mean the only two people who said yes this week are sitting in a log file.

**Outbound was an ordinary Tuesday. 290 emails reached 289 people, 3 of whom had never heard
from us.** All 3 came off the written-and-ready shelf. Zero were people the pipeline found
itself. New people reached, by Pacific day:

```
11-10: 31   11-11: 7   11-12: 3   11-13: 2   11-14: 0   11-15: 0   11-16: 1   11-17: 3
```

That series is the field shipped yesterday, and this is the seventh day of the slide it
exposed.

**The gauge that sized the fleet was wrong, and it was ours.** This cycle's plan published a
765-message allowance, **0 follow-ups owed** and **315 slots**. Read with this block's own
instruction, "capacity against followups_due is what sizes the fleet", that says 450 slots went
begging while 1,299 ready people waited. It says no such thing. Siege stopped sizing slots with
that count on 2026-10-13. Fixed this cycle, and it also corrects yesterday's explanation of
Monday.

**The Apify lane has now done no work for 143.6 hours, six days, and its refusal finally says
why.** A live probe of `/v2/users/me/limits` still answers HTTP 401 `user-or-token-not-found`.
Fixed this cycle so the next morning does not have to probe by hand for the seventh time.

**0 leads parked. The pool is flat at 7,388.** $0 Anthropic, 0 fatal signatures, no halt flag.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **290** | 1,185 people, about 237 a sending day |
| People reached for the first time | **3** (1%), all off the shelf | 44, of which 31 never planned before |
| **Creators whose reply is a yes** | **2** | 0 on 11-17, 0 on 11-16 |
| Replies read | **7 people** | 6 on 11-17, 2 on 11-16 |
| People the push lost | **21** (17 lost before, 4 new) | 22 on 11-17, 14 on 11-14 |
| Ready people refused a slot | **1,299** (532 whale, 685 strong7, 82 other7) | 1,160 on 11-17 |
| Mailbox allowance vs what the queue had claimed | **765 against 450** | 735 against 488 on 11-16 |
| Parked into `approved_hold` | **0** | 0 on 11-17, 1 on 11-16 |
| Recovery lane contact points (its own) | **5**, 3 of them addresses | 49 points, 7 addresses |
| Paid Apify batches | **0**, and no tick reached the batch | 0 |
| Enrichment leads done | **0**, chain idling for want of work | 0 on 11-17 |
| New channels discovered | **0**, by Casey's order of 2026-09-08 | 0 |

The shelf holds **4,851** people written and ready, unchanged. People this pipeline has really
emailed sit at **2,521**. Bundling is 99.8% of the 7,388-lead pool, which is why the enrichment
chain ran no batches: it has no book left beyond what arrives.

OpenRouter balance $299.09 against an account rate of 21 cents a day. 15 of 66 YouTube keys
answered after the midnight reset, which is the settled 2026-09-16 reading and not news.

## Q1. Did anybody say yes?

**Yes. Two creators, and this is the first time this report has been able to say so.**

| Creator | Current category | What happens next |
|---|---|---|
| `drtubio@gmail.com` | `yes-plus-questions` | Nothing automatic. Held. |
| `jessie@innercircleprints.com` | `yes-plus-questions` | Nothing automatic. Held. |

The lane ran 5 times, read **7 distinct people**, and classified every one without a single
failure. The queue was 7 deep at its worst and 2 deep at the end. Categories by person: 3
other, **2 yes-plus-questions**, 1 not-interested, 1 unsubscribe.

All 7 are held, each on its own reason, and every reason is the same shape: that category is
not approved for auto-send. `cannot_sign_people` is **0** this cycle, so the standing count of
creators held because the drafter cannot work out which mailbox a thread sends from is unchanged
at 11 people.

**The sender is paused on purpose.** Casey stopped it on 2026-09-17
(`smartlead-auto-reply.service.d/outbound-paused.conf`, "All outbound sending is paused until
further notice"), which runs the lane in dry-run: replies are still read and filed, nothing goes
out. So "nothing will answer them" is the instruction, not a breakage. This report cannot see
Casey's own inbox, so he may already have answered both by hand.

What is worth knowing: 290 emails bought 2 yeses in a day when 3 people heard from us for the
first time. Both yeses came out of the repeat-offer stream.

## Q2. Were 450 mailbox slots really going unused?

**No. Every one of them was already spoken for, and the gauge that said otherwise was this
repo's.**

The plan published this:

```
mailbox_capacity: 765    followups_due: 0    mailbox_slots: 315    waiting_for_a_slot: 1,299
```

Read with the rule this block has carried since 2026-10-13, capacity against follow-ups owed,
that is a fleet with 765 messages of room, owing nothing, handing out 315 slots while 1,299
people wait. Four hundred and fifty slots thrown away on a Tuesday.

**That reading is wrong because `followups_due` stopped being the number that sizes slots on
2026-10-13.** Siege says so in its own code, beside the call:

```python
due = siege.followups_due(histories, day)
# What SmartLead is already holding per mailbox. This, not the schedule, sets today's
# free slots: on 10-13 the schedule saw 0 follow-ups due while SmartLead held 572 unsent
# first emails and 1,703 people mid-sequence, and the planner pushed 782 more on top.
...
i.followups_due = due.get(i.email, 0)   # the schedule's own count, shown for comparison
```

What really sets a mailbox's free slots is its ladder, less every first email already pushed
and not yet sent, less half a send a day for each person mid-sequence
(`followups_per_mid_sequence_lead`, 0.5 in `automator/config/siege.json`: two follow-ups over
about four sending days). Tuesday, summed over the 51 live mailboxes:

| | Tuesday 11-17 | Monday 11-16 |
|---|---|---|
| Allowance | 765 | 735 |
| First emails pushed and not yet sent | 128 | 22 |
| People mid-sequence | 620 | 917 |
| Reserved for their follow-ups | 322 | 466 |
| **Claimed before anybody new** | **450** | **488** |
| Slots left for new people | **315** | **247** |

765 less 450 is 315, mailbox by mailbox, exactly Siege's own figure. Nothing was wasted. The
fleet was running about 59% full on other people's follow-ups, which is the designed steady
state.

**It also corrects yesterday's report.** That one explained Monday's 247 slots as "945 owed
follow-ups against a 735-message allowance". Monday's real claim was 22 unsent firsts plus 466
reserved. Same direction, wrong instrument, and the 945 came from the count Siege had already
stopped using.

A zero in that field is not a reading failure either. It is the known blind spot, the exact
shape the 10-13 comment names, and it will read 0 again.

## Q3. Did anything new get into the pipeline?

Almost nothing, and every lane can say why in its own words.

**Discovery: 0 new channels, by Casey's order of 2026-09-08.** Not a fault, not to be repaired.

**The recovery lane's own half: 5 contact points on 5 people, 3 of them real addresses.**
Against 49 points and 7 addresses over the prior week. Read `lane_*`, not `free_*`: the cycle
totals (14 points, 5 addresses) also hold automator's own contact-lookup timer, which found 9
of them.

Three methods produced for the lane: `18-rdap` wrote 3 points and all 3 were addresses,
`33-about-text` 2 points including 1 address, `02-subpages` 1 address. `34-channel-page` wrote 7
points across 3 leads and none was an address.

The newest collect pass summed up its own work: **"Collected 0 contact points from 0/150
leads."** It walked 150 leads, found **629 contact methods, and all 629 were already on file.**
This is lap 18 of a 1,780-lead book, so a re-walk is the expected shape rather than a fault.
`collect_book_stranded` is 3, so the selector gap closed in September has stayed closed.

**Site resolution is healthy and the ownership gate is still the ceiling.** Cause reads
`resolution_ok`, the no-site rate is 5.3% (8 of 150), and the pass ran 8 Brave searches with
**zero refusals**, found 6 candidate sites and kept none. No amount of Brave credit changes a
gate declining to tie a page to a creator on purpose.

**The cross-domain redirect split settled down.** Yesterday it was 128 of 486 method faults
(26%) running 0, 0, 62, 66 across four passes, flagged to watch for one cycle. This cycle it is
50 of 216 (23%), in line rather than climbing, and the repo already carries redirect-ownership
handling with its own selftest. Nothing to repair. The top fault is plainer: `28-sitemap: fetch
failed`, 41 of 216 (19%), inside a `fetch failed` condition that is 61 of 216 (28%).

**The enrichment chain did no batches, and that is correct.** `chain_state` reads
`idling_no_inflow` and its log was writing 6 minutes before the snapshot. The pool is 99.8%
bundled, so the chain drains a one-lead trickle and waits. That field shipped yesterday; before
it, this was indistinguishable from a chain frozen on a gate.

**The Apify lane is six days dead.** `lane_no_work_hours` reads **143.6**, which is the age of
the newest run log and so exactly how long since a tick reached a batch.
`lane_last_tick_streak` is 24 consecutive refusals on one reason. $31.06 of the November
allowance is on the books, $21.06 of it spendable, against a billing cycle that closes
**2026-11-30**. A live probe of `/v2/users/me/limits` with the 46-character token from the
shared env bank answers HTTP 401 `user-or-token-not-found`. Secrets are operator-managed, so
nothing in the pipeline can repair it.

## The push itself

315 planned, 334 approved, **285 sent, 12 failed, 22 skipped, 290 people emailed, 21 lost**. Two
escalations, no batch died before its first lead. 21 skipped drafts were rewritten and sent in
the same run, so they cost nobody.

Five people were emailed with no `SENT` line in the log at all, caught by the send ledger rather
than the narration, which is the 11-03 fix doing its job. The loss splits into 12 refused by
SmartLead, 1 the push never reached, and 8 the log never mentions. `lost_split_complete` is
true, so the 21 is a real count rather than a truncated list.

| Reason | Leads | Lost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 6 | 6 |
| SmartLead did not add the lead (unsubscribed, 4 distinct addresses) | 4 | 4 |
| No draft was written: business owner, no clean job title exists | 1 | 1 |

**17 of the 21 were lost before, and one has now been lost on 11 consecutive sending days.**
Six carry a bounce already on SmartLead's file and four an unsubscribe, so no push will ever
send them. They took about 7% of a 315-slot day. Same finding as yesterday, same repair, still
in `automator`.

Four leads were deferred as unapproved, and three of them are the standing set that has been
stamped `sent_to_smartlead` without ever being emailed (oldest stamp 2026-10-07). That count is
4 and nothing joined it this cycle.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 55 | **53** |
| Watch band (follow-ups only) | 5 | **7** |
| Stopped band | 34 | **34** |
| Peak clear inside the cycle | 55 | 57, at 11-17T12:05:18Z |
| Returned to clear, and still clear | 7 of 7 | **3 of 3** |
| Round trips | 0 | 0 |
| Held but already healthy | 5 | 3 (2 on the clock, 1 held by a sick sibling) |
| Soonest self-lift | 2h | 2h |

**The arithmetic closes.** 55 clear, plus 3 returning, minus 5 that left, gives 53.
`band_moves_comparable` is true and `band_short_readings` is 0, so no gate run read a short
fleet. Five mailboxes moved to watch, which is follow-ups-only rather than stopped, and the
stopped band did not move at all.

Live inboxes went 49 to 51 and the allowance 735 to 765, so the fleet grew while the band gate
gave back two clear readings. Of the 73 mailboxes that could not send, 61 are suspended in
SmartLead and 32 of those carry that as their only reason, which is the standing shape and the
largest recoverable block.

## Fixes shipped this cycle

### 1. The follow-up count this report sizes the fleet with stopped sizing the fleet on 10-13 (`b11a3be`, orchestrator)

Described in full in Q2. The send block published `followups_due` and told the reader, in its
own note, to size the fleet with it. Siege had stopped using that count five weeks earlier and
carries it "for comparison". On Tuesday it read 0 on all 124 mailboxes beside 620 people
mid-sequence, which under the old rule turns a full queue into 450 wasted slots.

Six new fields in `siegePlanFacts()` publish what Siege really subtracts: `queued_firsts`,
`mid_sequence`, `followups_reserved`, `queue_load`, `followups_rate` with its source, and
`slots_explained`. The rate is read out of `automator/config/siege.json` so a change there
follows without an edit here, and anything unreadable degrades to the documented 0.5.

Two details that matter:

- **`slots_explained` is the guard on the whole story.** It checks, mailbox by mailbox, that
  capacity minus the load reproduces Siege's own slot count. True means a reader may subtract.
  False means automator changed the formula, so quote `mailbox_slots` and derive nothing. It
  reads true on the 11-13, 11-16 and 11-17 plans, which is three real files.
- **Missing means unknown, not empty.** A plan that stops carrying the queue keys nulls the
  derived fields rather than publishing a load of zero, because a load of zero makes an occupied
  fleet look idle, which is the fault being fixed.

`followups_due_schedule_blind` names the shape outright: every mailbox reporting 0 follow-ups
while people really are mid-sequence. It is true for 11-17 and false for 11-13 and 11-16.

Verified against the three real plan files. Nine new assertions, selftest all-pass, typecheck
clean.

### 2. Six mornings of hand-probing Apify, because one refusal covered four different repairs (`9f5b76c4d`, email repo)

The ledger read in `scripts/apify-endspec-loop.sh` had one failure message, "could not read the
Apify monthly ledger", for a rejected token, an unreachable Apify, a server error and a changed
response shape. Those are four different repairs: an operator replacing a credential, nothing,
waiting, and an edit to that file. The lane has refused on that line since 2026-11-12, and every
morning since has had to probe `/v2/users/me/limits` by hand to learn it is HTTP 401
`user-or-token-not-found`.

The status and Apify's own error type now go into the refusal, so the stamp a reader opens
first says `Apify rejected the token (HTTP 401 user-or-token-not-found)`. Apify's prose is
deliberately dropped and only the type is kept: the message can carry an account name, and
varying text would also break the `since`/`consecutive` run counter that sizes an outage.

Six cases exercised against the real parser (401, unreachable, 429, 500, a healthy 200, and a
200 in an unreadable shape; the healthy one returns $31.06, which matches the known allowance),
then the live script run end to end. It logged the new line, wrote the new stamp and exited 0.

## Ranked levers

1. **Answer the two creators who said yes.** `drtubio@gmail.com` and
   `jessie@innercircleprints.com`, both read as `yes-plus-questions`, both held because the
   auto-reply sender is paused by Casey's own order of 2026-09-17. 290 emails bought those two.
   Nothing downstream will touch them.
2. **Decide what the slots are for.** Unchanged from yesterday and still the biggest outbound
   lever. Since 11-09, 1,483 emails over six sending days have reached 47 new people, 4,851
   written-ready people sit on the shelf, and 1,299 were refused a slot on Tuesday while the
   whale tier re-offered to a book it finished on 2026-10-13. The lever is
   `siege.fill_slots` and its `priority_key`, in `automator`, which carries nothing about
   whether a person has heard from us. Repeat offers were Casey's call on 2026-10-07, so the mix
   is his to set. Worth noting against that: both of this cycle's yeses came out of the repeat
   stream.
3. **Replace the Apify token.** Six days, 24 refused ticks on the newest run alone, $21.06
   spendable, billing cycle closes 2026-11-30. Operator-only. Unchanged from the last four
   mornings, and from today the lane says so itself.
4. **Stop planning the people the push loses every sending day.** 17 of the 21 lost on Tuesday
   had been lost before, one on 11 consecutive sending days. Six carry a bounce on SmartLead's
   file and four an unsubscribe, so no push will ever send them. About 7% of a 315-slot day. The
   repair is in Siege's selector, in `automator`.
5. **Nothing needs doing about the fleet, the enrichment chain or the recovery lane.** The
   fleet gave back two clear readings to the watch band with the stopped band unmoved and the
   allowance up 30, the chain is idle because the pool is bundled out, and the recovery book is
   on lap 18 with 100% of what it found already stored. The cross-domain redirect split that was
   flagged yesterday came back in line, so it needs nothing.

## Checked rather than assumed

- The Apify token's rejection, against a live call to `/v2/users/me/limits` returning HTTP 401
  `user-or-token-not-found`.
- That `followups_due` no longer sizes slots, by reading `automator/scripts/siege-plan.py`,
  `siege.inbox_load()` and `config/siege.json` rather than inferring it from the numbers.
- The slot arithmetic, by running the new reader over the real 11-13, 11-16 and 11-17 plan
  files and confirming capacity minus load reproduces each day's published slot count exactly
  (184, 247, 315).
- That the zero follow-up count is fleet-wide and not a live-mailbox artifact, by summing the
  field over all 124 mailboxes in the plan.
- The two warm replies and their current categories, from the reply lane block, which counts
  distinct addresses and takes the newest reading per person.
- The new Apify refusal, by exercising the parser on six response shapes and then running the
  live script, which refused, logged and stamped correctly at exit 0.
- Both fixes typechecked and selftested before committing.

**Assumed:** that Casey has not already answered the two creators by hand. This report cannot
see his inbox either way. Also assumed, as yesterday, that the slots went to repeat offers
because of the tier ordering rather than something else: the waiting queue by tier and the
whale tier's exhausted first-touch supply are measured, but `fill_slots` lives in another repo
and this report did not read it this cycle.
