# Lead Run Analysis, 2026-11-19

Cycle: 2026-11-18T08:00:00Z to 2026-11-19T08:00:00Z (the 24h ending at midnight PT, so all of
Wednesday 18 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-19.json`.
Companion to [lead-run-2026-11-19.html](lead-run-2026-11-19.html).

## Headline

**314 emails went out on Wednesday and not one of them reached a new person.** Four people were
credited with a first touch and all four are `first_touch_recovered`, meaning an earlier day's
push had already credited them, the oldest on 2026-11-06. `first_touch_new`, people who had
never been planned at all, is **0**. New people reached, by Pacific day:

```
11-11: 7   11-12: 3   11-13: 2   11-14: 0   11-15: 0   11-16: 1   11-17: 3   11-18: 4
```

Eight single-digit days in a row, and Wednesday is the highest of the eight. The 210-person day
that used to set the weekly baseline has now aged out of the window, so the published pair
reads 1.3% against 1.5% and for once is honest. Both numbers are the floor.

**The day's useful finding is that the push loses the same people every day because SmartLead
knew their addresses were dead and nothing on our side wrote it down.** Twelve of the 38 losses
were refused with `bounce_count=1`. Over the 44 days of retained log that is **188 refusals
across 116 distinct leads**, three of them re-attempted 13 times each. Fixed this cycle, and
the existing 116 retire themselves on their next refusal.

**Five more losses were two whole batches that died on SmartLead's account rate limit before
their first lead**, which is the 2026-10-05 cause recurring past the retries built for it. The
other eleven silent losses sit in a gap this report could not close: 24 of the day's 149 batch
directories hold finished drafts and have no `push-batch` line in the log at all.

**The Apify lane has now done no work for 167.6 hours, seven days.** A live probe of
`/v2/users/me/limits` this morning still answers HTTP 401 `user-or-token-not-found`.
Operator-only.

**0 leads parked. The pool is flat at 7,388.** $0 Anthropic, 0 fatal signatures, no halt flag.

## What actually moved

| Reading | Tue 11-17 | Wed 11-18 |
|---|---|---|
| Emails loaded | 290 | 314 |
| People emailed | 289 | 314 |
| People reached for the first time ever | 3 | 4 |
| Of those, never planned before (`first_touch_new`) | 0 | **0** |
| People who ended the run with no email | 21 | 38 |
| Of those, lost on an earlier day | 17 | 24 |
| Leads parked into `approved_hold` | 0 | 0 |
| Clear band / watch / stopped | 53 / 7 / 34 | 49 / 10 / 35 |
| Live inboxes, allowance | 51, 765 | 53, 795 |
| Mailbox slots the plan was given | 315 | 352 |
| Ready people refused a slot | 1,299 | 1,211 |
| Recovery lane: its own points / addresses | 5 / 3 | 7 / **0** |
| Apify hours with no work | 143.6 | 167.6 |

Shelf: 4,851 ready to write, 99.8% bundled, 2,524 people emailed to date. `needs_contact` is
2,877. OpenRouter balance $298.93 against account spend of $0.16/day, which is what an idling
enrichment chain costs.

## Q1. Why does the push lose the same people every day?

Because SmartLead told us the address was dead and we never recorded it.

`bounce_count=1` is SmartLead saying it already holds a hard bounce for that mailbox. It refuses
the add, and it refuses it again tomorrow, because nothing about a dead mailbox changes.

The pipeline already has the machinery for this and it was never fed:

- `automator/scripts/dnc-sync.py` runs hourly. Its `feed_db_bounces()` selects
  `WHERE email_bounced AND email_address IS NOT NULL` and files a `bounced` entry on the
  do-not-contact registry, which is permanent by Operation Siege's own list.
- **The only writer of `lead_candidates.email_bounced` is
  `youtube-email-outreach-v1/scripts/sync-smartlead-replies.ts`**, and it reads bounces off
  leads SmartLead *accepted* into a campaign. A lead refused at the door never gets a campaign
  membership for it to read.

So nothing ever set the flag. Queried live, all 24 of Wednesday's recurring losses sit at:

```
email_bounced = false | do_not_contact = false | email_verification_result = valid
17 at outreach_status sent_to_smartlead, 5 at ready_data_scraped, 2 at failed
```

Siege's `load_people()` does not filter on `outreach_status` at all, and `load_addresses()`
takes the main address whenever `email_verification_result = 'valid'`. So these people were
planned, written, offered and refused, every sending day, with nothing in the system able to
stop it. That is how a 24-person cohort got reported as a fresh loss on eleven consecutive
mornings, and why one of them now carries an 11-day streak.

Each attempt costs a plan slot, a written personalised email (OpenRouter spend), and one more
person in `people_lost`.

**One correction to carry forward.** `lost_new` reads 14 and `lost_history_capped_days` is 2, so
two earlier days inside the window had loss lists shorter than their own loss. Recurrence cannot
be checked against a loss a past snapshot never named, so **14 is a lower bound**, not the day's
damage.

## Q2. What happened to the 16 people the log never mentioned?

The loss splits 18 refused by SmartLead, 3 drafts we declined to offer, 1 that never got a
draft, and 16 the push log does not mention at all. `emailed_unlogged` is 0, so the send ledger
agrees they were never written to, and `deferred_unapproved` is 0, so none is waiting on
tomorrow's approval.

**Five are two dead batches.** Both raised
`listCampaignMailboxes 429: Account rate limit exceeded` and escalated with `pushed: 0`:

```
11:34:09Z  siege-2026-11-18-22824593-voice-objection-proof-e73e82   1 lead
12:04:34Z  siege-2026-11-18-25787189-short-save-time-3b2be2         4 leads
```

A batch that dies before its first lead prints no SENT, no FAIL and no SKIP, which is exactly
how it lands in this counter. **This is the 2026-10-05 shape back past its own retries.** 17 of
these refusals fired in the push window and twice the guard spent all four attempts and still
got a 429. The backoff genuinely sleeps (`src/smartlead/http.ts` does `await sleep(wait)` with
60s delays; the four attempts logging in the same second is the log wrapper buffering), so the
account was saturated for three minutes straight. SmartLead meters the whole account at 200
requests a minute and the reply poller walks 71 campaigns every two minutes alongside the push.

**The remaining eleven are a different shape, and this is a lead rather than a finding.** 24 of
the day's 149 batch directories have no `push-batch` block in the log. One opened by hand:

```
state/siege/2026-11-18/siege-2026-11-18-25787206-short-save-time-3b2be2/
  leads.json  manifest.json  report.json  + 5 finished draft .txt files   (written 12:15-12:16Z)
  one line in siege.log: the build-batch invocation. No push-batch block.
```

Those 24 batches hold about 66 leads between them while only 16 people were lost silently, so
**most of those leads were emailed through another batch** and the gap mostly cancels out. That
is the 2026-10-20 lesson (a counter is not a person) and it is why the join was not claimed.
The batch loop lives in `automator`, which is the send path and not this repo's to edit.

## Q3. Did anything new get into the pipeline?

No, and every lane can say why. None of these needs repairing.

**Discovery: 0 new channels, by Casey's order of 2026-09-08.** Not a fault, not to be repaired,
not to be reported as one.

**The recovery lane's own half found 7 contact points on 3 people and not one address**, against
41 points and 8 addresses the prior week. Read `lane_*`, not `free_*`: the cycle totals of 9
points also hold automator's contact-lookup timer, which wrote 2. Everything the lane found came
from `34-channel-page`. Across three collect passes it walked 450 leads, found 1,768 contact
methods, and **1,761 were already on file**. The newest pass: "Collected 0 contact points from
0/150 leads" after finding 591 methods, all 591 already stored.

This is **lap 18 of a 1,780-lead book**, so a re-walk finding nothing new is the expected answer.
`collect_book_stranded` is 3, so the September selector gap has stayed closed.

Site resolution is the healthiest in weeks:

```
cause resolution_ok | no-site 2% (3 of 150) | 5 Brave searches on 150 leads
of those 5: 1 refused, 4 found a candidate, the ownership gate kept 2
```

Only 5 searches were needed because 147 of 150 leads resolved from a declared or stored link,
which is the 2026-09-13 stored-website read earning its keep. **Cross-domain redirect is 235 of
469 faults across the cycle, 50%, running 79, 94, 62 over the three passes.** Read as a cycle
rather than a single pass (the 11-09 rule), that is in line with where it has sat since the
11-08 fix, and the destinations still failing are the ones the gate exists to refuse.

**The enrichment chain did no batches, correctly.** `chain_state` is `idling_no_inflow` and its
log was writing 3 minutes before the snapshot. A 99.8% bundled pool has a one-lead trickle to
drain and then nothing. Read `chain_state`, never `batches`.

**The Apify lane is seven days dead.** `lane_no_work_hours` 167.6, which is the age of the
newest run log and so exactly how long since a tick reached a batch, on a run of 12 consecutive
refusals with the same reason. Probed live this morning:

```
GET /v2/users/me/limits -> HTTP 401 {"type":"user-or-token-not-found"}
```

$31.06 of the November allowance on the books, $21.06 spendable, cycle closes 2026-11-30.
Secrets are operator-managed, so nothing in the pipeline can repair it.

**Nobody said yes.** The reply lane ran 14 times with no classifier failures and read 3 distinct
people: 2 `other`, 1 `not-interested`. All 3 held, which is the instruction (the auto-reply
sender has been paused since 2026-09-17) and not a fault. This report cannot see Casey's inbox,
so Tuesday's two agreements may already have been answered by hand.

**The YouTube key pool reads 15 of 66 working, 50 still exhausted after the midnight reset.**
This is the settled 2026-09-16 finding that the quota was cut on 50 of 66 projects, not a new
fault. Keys mainly buy 100-unit keyword search, which is switched off.

## The push itself

352 planned, 367 approved, **314 sent, 18 failed, 13 skipped, 314 people emailed, 38 lost**. Two
escalations, two batches dead before their first lead, nine skipped drafts rewritten and sent in
the same run so they cost nobody.

| Why a person was lost | Leads | Lost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 12 | **12** |
| SmartLead did not add the lead (unsubscribed, 3 distinct addresses) | 3 | 3 |
| Absent from this batch's Siege manifest | 13 | 3 |
| No draft was written: business owner, no clean job title exists | 1 | 1 |
| No line in the log at all (5 of them two batches dead on a 429) | — | 16 |
| **People who ended the run with no email** | | **38** |

The manifest row is the one to read and then ignore: 13 leads named it and it cost 3 people,
because the other ten were written again in another batch and sent in the same run. The bounce
row is the opposite, 12 named and 12 lost, which is why it earned the fix. Skips by offer:
voice-objection-proof 5, love-your-channel-short 4, short-save-time 4.

The standing set of people stamped `sent_to_smartlead` who were never emailed is down to one,
`recPSkSNP2HeR6CCV`, stamped 2026-10-07. Nobody joined it this cycle.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 53 | 49 |
| Watch band (follow-ups only) | 7 | 10 |
| Stopped band | 34 | 35 |
| Peak clear inside the cycle | 57 | 55, at 11-18T11:05:22Z |
| Returned to clear, and still clear | 3 of 3 | 2 of 2 |
| Round trips | 0 | 0 |
| Held but already healthy | 3 | 5 |
| Live inboxes, allowance | 51, 765 | 53, 795 |

**The arithmetic closes, but only once the unplaceable mover is counted.** 53 + 2 returning - 5
that left normal gives 50 against a clear band of 49. `band_left_normal_unknown` is 1: one
mailbox moved and no retained gate run can say which band it came from, which makes
`band_left_normal` a lower bound. Count it and 53 + 2 - 6 = 49 exactly.
`band_moves_comparable` is true and `band_short_readings` is 0, so no gate run read a short
fleet.

**The fleet grew while the band gate shrank**, which is two instruments at two different hours
and the 10-18 rule says not to subtract them. The clean reading is the slot arithmetic:

```
mailbox_capacity 795  -  queue_load 443  =  mailbox_slots 352       slots_explained: true
queue_load = queued_firsts 52 + followups_reserved 391 (0.5 x 753 mid-sequence)
```

**Nothing was wasted.** 352 is Siege's own figure and it reproduces mailbox by mailbox. Note
`followups_due` reads 303 here, which is the known blind spot carried "for comparison" since
2026-10-13 and is not what sizes slots.

Of the 71 mailboxes that could not send, 60 are suspended in SmartLead and **32 carry that as
their only reason**, which is the standing shape and the largest recoverable block. Five were
held while already healthy: four on a recovery clock with the soonest owing 25 more hours, one
held by a sick sibling on its domain. The biggest mover underneath was "SmartLead did not return
its suspension status", whose exclusive count fell 5 to 2 (read `only_change`, not `change`).

## Fixes shipped this cycle

### SmartLead knew the address was dead and we asked it again every day (`0d6987cc2`, email repo)

A bounce is the only refusal reason SmartLead gives that is permanent, and it was the only one
the push could not act on, because every reason reached the caller as prose inside an error
message. Enough to explain a lost email, not enough to retire the address behind it.

**What changed.** `assertLeadAdded` now throws a `LeadNotAddedError` carrying the counters
SmartLead set, and `scripts/push-batch.ts` acts on one of them:

- Main address: write `email_bounced = true`, `email_bounced_at`, `bounce_reason`, and set
  `email_verification_result = 'invalid'`.
- A rotated address from `contact_points`: set that point `verified = false` with `verified_at`
  stamped and a `[smartlead:bounce]` note appended once, which is the verify pass's own wording
  for a permanent rejection (verify.ts, 2026-08-24).

**It retires nothing by itself.** The existing permanent machinery does that: `dnc-sync.py`
files the `bounced` registry entry on its next hourly run. Clearing the verification result is
what stops the next plan the *same day* rather than an hour later, because Siege takes the main
address only when that column reads `valid`.

**Deliberately only `bounce_count`.** Retiring an address is not reversible by this pipeline, so
the one counter that acts on it is the one that cannot mean anything else. The repeat-offer skip
is Casey's call from 2026-10-07, `duplicate_count` and `already_added_to_campaign` are this
campaign's own state, `is_lead_limit_exhausted` is the account, and `unsubscribed_leads` is a
decision SmartLead's own block list already carries into the registry. Six of the eight new
assertions pin which reasons must **not** trigger it, including the `bounce_count: 0` SmartLead
sends on every reply.

**`outreach_status` is left alone on purpose.** Seventeen of the recurring cohort sit at
`sent_to_smartlead`, which is a true thing that happened before the address died. Overwriting it
would move them out of the shelf's `already_sent` count and claim they were never emailed.

**Best-effort on purpose.** The push has already failed and rolled its send row back by the time
this runs, so a database hiccup must change nothing about the batch. The write is wrapped,
logged and dropped.

**It self-heals the existing 116 without a bulk data write.** Each records its bounce the next
time it is refused, which costs one more wasted email each and then stops, rather than eleven
more days of them. A bulk update of 116 live money-path rows was deliberately not done.

Verified: typecheck clean, 13 of 13 in the outcome suite (8 new), full suite 311 of 311 across
25 files. The 44-day refusal count and the state of all 24 recurring leads were read out of the
live log and live database before the fix was written.

## Ranked levers

1. **Decide what the slots are for.** Unchanged for ten days and still the biggest outbound
   lever by a wide margin. 314 emails reached **zero** never-planned people. Over the eight days
   charted, 20 people were reached for the first time, while 4,851 written-and-ready people sit
   on the shelf and 1,211 were refused a slot (364 whale, 706 strong7, 141 other7). The whale
   tier finished its never-emailed book on 2026-10-13 and its re-offer queue still takes slots
   ahead of ready lower-tier people. Lever: `siege.fill_slots` and its `priority_key`, in
   `automator`, which carries nothing about whether a person has heard from us. Repeat offers
   were Casey's call on 2026-10-07, so the mix is his to set.
2. **Replace the Apify token.** Seven days, 12 refused ticks on the current run, $21.06
   spendable, cycle closes 2026-11-30. Probed live and still HTTP 401. Operator-only. Unchanged
   from the last five mornings.
3. **Look at why 24 written batches never reached the push.** New this cycle and the only
   unresolved part of the day's loss. Finished drafts on disk with no `push-batch` line against
   them. Most of those leads were emailed through another batch, so the cost is small and
   uncertain rather than large, but it is where the eleven unexplained losses live. In
   `automator`.
4. **Consider moving the reply poller off the push hour.** Two batches and five people died on
   SmartLead's account-wide 200/min limit with all four retries spent and 60s between them, so
   the account was saturated for three minutes straight. Raising the retry budget in the email
   repo would only lengthen a run that already takes an hour; the cheaper change is the poller's
   cadence, in `automator`.
5. **Nothing needs doing about the recovery lane, the enrichment chain or the fleet.** Lap 18
   with 1,761 of 1,768 found methods already on file and the best site-resolution reading in
   weeks. The chain is idle because the pool is bundled out. The fleet gave two readings back,
   the slot arithmetic reproduces exactly, and the allowance went up 30.

## Checked rather than assumed

- **The bounce diagnosis end to end.** 188 refusals across 116 distinct leads counted out of
  `automator/logs/siege.log`. All 24 recurring lost leads queried live and found at
  `email_bounced = false`, `do_not_contact = false`, verification `valid`.
- **That `sync-smartlead-replies.ts` is the only writer of that flag**, by grepping the repo
  rather than inferring it.
- **That `dnc-sync.py`'s `feed_db_bounces()` would pick the flag up**, and that Siege's
  `load_people()` does not filter on `outreach_status` at all, by reading both files. That is
  why the fix writes the verification result and not just a status: a status write alone would
  have changed nothing.
- **The Apify token**, against a live call to `/v2/users/me/limits` returning HTTP 401
  `user-or-token-not-found`.
- **The two dead batches and their lead counts**, from the escalation lines and their own
  `leads.json`.
- **That the 429 backoff really sleeps**, by reading `src/smartlead/http.ts`, because all four
  attempts logged in the same second and that looked like a bug.
- **The 24 unpushed batches**, by checking every batch directory against the log and opening one
  of them.
- **The fix**, typechecked and run against the full suite before committing.

**Assumed:** that the eleven losses outside the two dead batches are in the unpushed-batch gap.
That is where they fit and it is not proven, because those batches hold about 66 leads while
only 16 people were lost silently, so the join between the two was not reconstructed. Also
assumed, as on the last three mornings, that the slots went to repeat offers because of the tier
ordering rather than something else: the waiting queue by tier and the whale tier's exhausted
supply are measured, but `fill_slots` lives in another repo and was not read this cycle.
