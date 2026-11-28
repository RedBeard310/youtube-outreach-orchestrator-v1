# Lead run analysis, 2026-11-27

Cycle: 2026-11-27T08:00Z to 2026-11-28T08:00Z (the Pacific day of Friday 2026-11-27).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-28.json`.
Companion report: [lead-run-2026-11-28.html](lead-run-2026-11-28.html).

## The one-line version

The fleet held still, the plan held at 46, and 21 of the 46 people the push drove ended the
day with no email. That's 45.7% of the day, the second-worst share on record, and for the
first time in five sending cycles the losses weren't all the same people: three were new. The
seventh sending day in a row reached nobody who had never heard from us.

## Headline numbers

| Reading | This cycle | Prior | Note |
|---|---|---|---|
| Emails loaded | **25** | 44 | All by the send program, 0 by this repo |
| People emailed | 25 | 44 | 24 inside the reach window, every one a repeat |
| Approved people who got no email | 21 of 46 | 17 of 61 | Split complete, no capped prior days |
| ...as a share of what the push drove | **45.7%** | 27.9% | Second-highest of the six readings on record |
| ...of which already lost on an earlier day | 18 (**39.1%**) | 17 | `lost_new` **3**, and exact |
| Longest unbroken loss streak | 10 snapshot days | 10 | Same person |
| People reached for the first time ever | **0** of 24 | 0 of 43 | Seventh sending day running |
| First touches over the prior 7 days | 1 of 409 people (0.2%) | 1 of 380 (0.3%) | Read the by-day series, not this |
| Live inboxes at plan time | **6** of 124 | 6 of 124 | Flat. Allowance 870, capacity 90, slots 46 |
| People the approval covered | 56 | 61 | Nobody deferred; the re-plan drove 46 of them |
| Mailboxes clear to send | **9** | 7 | Roster 28 on both mornings, so the rise is real |
| Mailboxes on watch / stopped | 0 / 19 | 0 / 21 | Move counts not comparable (one short reading) |
| Biggest block carried alone | **21** suspended in SmartLead | 20 missing a warmup record | The lever changed hands |
| Gate-owned suspensions outside the roster | 67 of 84 | 67 of 86 | Nothing can resume them, 6th morning |
| People waiting for a slot | **1,967** | 1,857 | whale 463 / strong7 728 / other7 776 |
| Offer-exhausted | **9 people**, 10 leads | 7 | 8 empty enemies banks, 2 filtered |
| Parked into `approved_hold` | 2 | 0 | Pool 7,393 to 7,395 |
| Recovery lane's own half | 5 points, 0 addresses, 5 people | 5 points, 2 addresses | Lap 21 of a 1,764 book |
| Points from automator's own lookup timer | 5 points, 2 addresses, 3 people | 17 points | Not the lane's, don't credit it |
| Site resolution | 4.7% no site, `resolution_ok` | 2.7% | 0 Brave refusals, 100% re-walk |
| Shelf ready to write | 4,857 | 4,855 | 7,383 bundled, 99.8% |
| Replies | 2 people, **0 yes** | 7 people, 2 yes | 0 classifier failures, auto-send paused |
| Enrichment | 2 batches, 2 leads | 0 | Idling with no inflow; unit active since 11-14 |
| Apify email recovery | **383.6h** with no work | 359.6h | Token refused, 18-tick streak, $21.06 expires 11-30 |
| Fatal error signatures | 0 | 0 | No halt flag |
| Anthropic spend | $0 | $0 | OpenRouter $297.74, 12 cents a day |

## What the day was

Friday after Thanksgiving, and the machinery ran. Siege wrote its plan at 11:27:18Z, the push
unit reported success, the reply reader ran 13 times with no classifier failures, there were no
fatal error signatures and no halt flag. This repo's own send command fired once, found nothing
parked and ready, and sent nothing, so all 25 emails came from the send program.

**The fleet did not move and the plan did not move with it.** Six live inboxes of 124 on both
mornings, 90 messages of capacity on both, 46 slots against an 870 allowance. The health gate's
clear band rose 7 to 9 on a roster covering 28 mailboxes on both readings, so that comparison is
checked rather than two different fleets subtracted. One mailbox came back and held its band to
the end of the cycle, with no round trips. The move counts are the one part of the fleet reading
that can't be trusted this morning: one of the hourly runs at 14:05:19Z read a smaller fleet than
the run before it, so `band_moves_comparable` is false and the band counts are the honest number.

**Then the push lost nearly half of what it drove.** Twenty-five people were emailed and 21 got
nothing, which is 45.7% of the 46 the push really drove. Eighteen of the 21 had already been
refused by an earlier push, one of them for the tenth consecutive snapshot day. The other three
are new, and that figure is exact rather than a floor: the split covered all 21 and no earlier
day in the window under-reported its own loss. That ends four mornings in a row where the whole
loss was the same standing cohort.

**Twelve of the 21 never reached the push at all.** Nine ran out of offers, two have channels
YouTube no longer has, and one got no draft because the writer couldn't find a clean job title
for a plain business owner. SmartLead itself refused six, we declined one, and two left no trace
in the log. One whole batch also died before its first lead, and the run logged one escalation.

**Reach is now seven sending days at zero.** Twenty-four of the 25 emails fall inside the reach
window and every one went to somebody who had heard from us before. People reached for the first
time ever, by Pacific day, reads 1, 0, 0, 0, 0, 0, 0, 0 over the eight days ending with this one.
Meanwhile 4,857 finished emails sit on the shelf addressed to people nobody has ever written to,
and 1,967 people are waiting for a slot (whale 463, strong7 728, other7 776).

Quiet by design: two leads parked, enrichment ran two batches and is otherwise idling because
nothing is arriving, and discovery stayed off per the standing order of 2026-09-08, so zero new
channels. The podcast lane woke, read the flag and halted, which is the flag working.

## The three questions

### Q1. The loss share nearly doubled. Is the leak actually growing?

**Yes, by three people, and that's the first real growth in five cycles.** The honest reading is
in two parts and they say different things.

The share moved for two reasons at once. The cohort grew (18 recurring plus 3 new against 17 all
recurring), and the denominator shrank (46 driven against 61). Priced as shares, the recurring
half alone reads 39.1% of the day against 27.9% yesterday, so even holding the cohort fixed the
day got worse. The three new losses are what makes this different from the last four mornings:
`lost_new` read 0 on each of those, and the pair of fields that say whether that 0 was exact
both pass this morning, so 3 is a real count.

What hasn't changed is that none of the 18 repeats will improve by being planned again. Two have
deleted YouTube channels. One is unsubscribed at SmartLead. Nine have run out of offers. Those
conditions are permanent until somebody writes them down or stops planning those people.

### Q2. Fifty-six people were approved and the push drove 46. Where did ten go?

**They're waiting for Monday, and that's correct.** Siege plans twice each morning: a sample run
records the people it covers, then the push run rebuilds the plan from scratch so a block added
during the morning is honoured. Here the approval covered 56 and the re-plan drove 46, with
`deferred_unapproved` at 0, so nobody was trimmed by the approval gate. Ten approved people
simply didn't make the smaller re-plan.

This matters because a plan row is not an instruction and never has been. Reading those ten as
losses is the 10-22 fault, and it has misreported this pipeline twice before. They are excluded
from every loss figure in this report by construction.

### Q3. What took the 21, and what is fixable where?

By cause: **9 ran out of offers**, 2 have channels YouTube no longer has, 1 got no clean job
title, 1 is unsubscribed at SmartLead, 1 was already in the campaign, 2 came out of a manifest
gap, and 2 left no trace at all. Seven push skips cost only one person, because three of the
seven were rewritten and sent inside the same run and one was never planned.

The nine offer-exhausted all failed on the same precondition, and the per-variant field reads it
without opening a bundle file: **eight of the ten leads hold an enemies bank with zero enemies in
it**, and two hold enemies the skill's safety filter ruled out. Those are opposite repairs. An
empty bank is a research pass or a decision to stop planning that person. A filtered bank is a
question about how strict the enemy bar should be, and that one is Casey's.

The single unsubscribe is the one cause this cycle that got a code fix, below. Dead channels and
the offer rotation live in the send path, which this repo doesn't own.

## Fix shipped this cycle

**`youtube-email-outreach-v1` `2c02b28`: SmartLead had six addresses unsubscribed and we offered
them again every sending day, so the push now writes the unsubscribe down.**

On 2026-11-19 this block shipped the same repair for bounces, and the note it left behind
deliberately excluded the unsubscribe counter on the grounds that "SmartLead's own block list
already carries it into the registry." That reasoning was wrong, and the evidence was already in
the log.

It doesn't carry it. `automator/scripts/dnc-sync.py` refuses on purpose to read an unsubscribe as
a reason: its `feed_suppressed()` calls one "a STATE fact, not a reason," because a stopped
sequence is equally what happens when a client is pulled out of a cold campaign. And the only
reason it would file, `opted_out`, blocks nobody under Operation Siege. So nothing anywhere wrote
the refusal down.

Measured in `automator/logs/siege.log` over the 74 days to 2026-11-27: **65 unsubscribe refusals
across six distinct addresses, four of them re-offered 13 times each.** All six still read
`email_verification_result = 'valid'`, `review_status = 'approved_hold'` and
`do_not_contact = false`. This is the identical blind spot the bounce fix closed, one door along:
`scripts/sync-smartlead-replies.ts` is also the only writer of
`lead_candidates.unsubscribe_received`, and it also reads only leads SmartLead accepted into a
campaign, so a lead refused at the door can never reach it.

**This blocks nobody and it files nobody as blocked.** Casey's policy is that an unsubscribe
answers the one offer it answered, and he still emails these people by hand. The fact being
recorded is narrower and purely mechanical: SmartLead will refuse that address from this pipeline
every time it's offered, so every plan that offers it spends a slot and a written personalised
email on a send that cannot happen.

What it writes, and what it deliberately doesn't:

- `unsubscribe_received` and `unsubscribed_at` on the lead row. The column the pipeline already
  has for this state, in the vocabulary the reply sync already writes.
- `verified = false` plus a one-time note on a **rotated** address. This is the write that takes
  effect today: Siege's `load_addresses()` reads contact points `WHERE verified`, so the address
  leaves the rotation and a person whose only address this was leaves the plan. Two of the six are
  rotated addresses.
- Not `email_bounced`, `bounce_reason` or `email_verification_result`. The address is live and the
  mailbox answers. Claiming otherwise would put a bounce on somebody who never bounced, and
  `dnc-sync.py`'s `feed_db_bounces()` would read it and file `bounced`, which is permanent.
- Not `review_status` or `outreach_status`. Both are true records of what happened, the shelf
  counts read them, and one unsendable address isn't a reason to rewrite either.

The refusal is matched **by address**, never by the counter alone. SmartLead names the
unsubscribed leads in its reply, and acting on a row belonging to somebody else would retire the
wrong address.

That leaves the four main addresses still planned until Siege reads the column, which is a
one-line `AND NOT COALESCE(lc.unsubscribe_received, false)` in its `load_people()`. Siege is
automator's and the send path isn't this repo's to edit, so that half is named here rather than
shipped. Recording the state is what makes that gate possible at all.

Verified: 22 assertions on the new getter including the live 2026-11-27 reply shape, the
address-mismatch case, the empty list SmartLead sends on every other refusal, and the
both-counters case; typecheck clean; the full suite 320 tests green. No send, research, filter or
rotation behaviour was changed, and the push's own counters are untouched, so this cannot move a
person between `failed` and `skipped` in tomorrow's reading.

## Everything else

- **The biggest recoverable block changed hands.** Yesterday the reason carried alone by the most
  mailboxes was a missing warmup record, at 20. This morning it's **suspension in SmartLead, at
  21**, while the warmup row fell to 19. Read the `only` counts, never the raw ones: 96 mailboxes
  name the warmup record and 91 name the suspension, and most of those carry something else as
  well. A health-watch row that held four mailboxes alone yesterday emptied completely.
- **67 of 84 gate-owned suspensions still sit outside the roster**, sixth morning. The gate
  suspended them in its own name and they've since left the warmup list it reads, so nothing can
  ever resume them. That repair is in automator.
- **The recovery lane is walking a picked-over book.** Lap 21 of 1,764 leads, 600 leads walked
  across four passes, 2,457 findings, and 2,449 of them already on file. Eight new points, five of
  them the lane's own. Site resolution is clean at 4.7% no-site with zero Brave refusals, and the
  sample was a 100% re-walk, so the clean reading is an easier slice rather than a repair. Nothing
  here is broken; the book is simply nearly empty.
- **Apify has now been idle for 383.6 hours** and has refused for 35.7 of them on an 18-tick
  streak, still "user or token not found." **$21.06 of the November allowance expires on 11-30**,
  so two days are left to spend it. Operator-only.
- **Enrichment ran two batches and is idling with no inflow**, which is correct against a shelf
  that is 99.8% bundled. The unit has been active and unrestarted since 11-14.
- **Two replies, no agreements.** Both were classified `other`, which isn't approved for
  auto-send, and the auto-sender has been paused by order since 09-17 anyway. Zero classifier
  failures.
- **Spend is nothing.** $0 Anthropic. OpenRouter ran 12 cents in 24 hours against a $297.74
  balance, at 12 cents per enriched lead over the last 565.
- **YouTube keys read 15 of 66 working**, which was settled on 09-16: the quota on 50 projects was
  cut. Not an incident, and more keys aren't the answer for those accounts.

## What to do next

1. **Point one day of slots at the shelf.** Seven sending days have now reached nobody new while
   4,857 finished emails sit addressed to people who've never been contacted and 1,967 wait for a
   slot. The tier queue sends none of them while the whale re-offer queue has anybody left in it,
   and that ordering is a setting in the send path. One day of first touches would beat the last
   seven sending days combined.
2. **Add the unsubscribe gate to Siege.** One line in `load_people()`:
   `AND NOT COALESCE(lc.unsubscribe_received, false)`. The push now records the state, so the gate
   has something to read. Four of the six addresses are main addresses and only that gate removes
   them; the two rotated ones already left the rotation this cycle.
3. **Stop planning the two deleted channels.** Both are refused on every push and will be forever.
   Neither improves by being re-planned.
4. **Replace the Apify token.** Sixteenth morning, 383.6 hours with no work, **$21.06 expires in
   two days**. Operator-only; no repo can fix a credential.
5. **Decide what happens to the nine offer-exhausted.** Eight of their ten leads hold a research
   file with no enemies in it, so they need another research pass or they should leave the queue.
   Two hold enemies the safety filter refused, which is the enemy-bar question. They've cost a
   slot every sending day since 11-11, and the cohort grew from seven to nine this cycle.
6. **Release the 67 stranded suspensions, and keep repairing the fleet for volume rather than
   reach.** Suspension-in-SmartLead-alone is now the largest single block at 21 mailboxes, and 67
   gate-owned suspensions can never resume themselves. That's real capacity. This week has already
   shown that capacity on its own reaches nobody new.
7. **Leave the recovery lane and enrichment alone.** Lap 21 with 99.7% of findings already on
   file, and an idle chain against a 99.8%-bundled shelf. Neither is broken.

## What was verified, not assumed

- The unsubscribe finding was counted out of `automator/logs/siege.log` (65 refusals, six
  addresses, four at 13 attempts) and the six leads' state was read live from Postgres: all six
  `valid`, `approved_hold`, `do_not_contact` false, and two of the six are rotated contact points
  with `verified` true. Siege's own gates were read in `scripts/siege-plan.py`
  (`load_people`, `load_addresses`), and the policy reasoning was read in `dnc-sync.py`'s header
  and `feed_suppressed()`. The fix was typechecked and run against the full 320-test suite.
- The fleet comparison is sound for the band counts: both gate readings covered the same 28
  mailboxes and the plans were written 24 hours apart at the same hour, with no re-plan after the
  push. The move counts are **not** sound, and the snapshot says so: one hourly run inside the
  span read a smaller fleet than the run before it.
- The loss reading is complete. The split covered all 21 and no prior day in the window named
  fewer people than it lost, so `lost_new: 3` is exact rather than a floor.
- The reach series is by Pacific day, dense and oldest-first, so a day that reached nobody appears
  as a 0 and not as a gap.

**Not established.** Why the tier queue still has no first touches to give out, which is a
send-path question nothing here can read. Whether the eight empty research banks are empty because
transcripts were never mined or because those creators argue with nothing. Whether the 4.7%
no-site reading means resolution is good or simply that this pass re-walked an easy slice; the
100% re-walk rate supports the second and can't rule out the first. Which of the band moves this
cycle were real, given the short reading.

**Untouched by design.** Discovery stayed off, per Casey's standing order of 2026-09-08. No
credential, no send-path behaviour, and no research, filter or rotation rule was changed.
