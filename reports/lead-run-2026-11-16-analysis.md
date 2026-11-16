# Lead Run Analysis — 2026-11-16

Cycle: 2026-11-15T08:00:00Z to 2026-11-16T08:00:00Z (the 24h ending at midnight PT, so all
of Sunday 15 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-16.json`.
Companion to [lead-run-2026-11-16.html](lead-run-2026-11-16.html).

## Headline

**The Apify lane is still dead, and yesterday's fix for it reset the number that measured
it.** The token still answers `user-or-token-not-found` on a live probe this morning. The
loop has now refused **48 consecutive ticks over 93.7 hours**, every one on the same line,
`could not read the Apify monthly ledger`.

Yesterday's report sized that outage with `lane_silent_hours`, which read **71.6**. This
morning, with the lane a full day deader, the same field reads **1.6**. Nothing recovered.
The 11-15 fix made every exit path write a stamp to disk, and `lane_silent_hours` is the age
of the newest trace the lane leaves on *any* instrument, so the stamp a refusing tick now
writes every hour keeps that number small forever. A lane that refuses hourly is never
silent, so silence stopped being able to measure it. Fixed below.

**It was a Sunday, so no email went out, and that is correct.** `siege-plan.timer` runs
Monday to Friday. `binding_constraint` reads `not_a_sending_day`.

**The weekly floor sweep ran and found nobody sendable.** It restamped 35,086 rows between
06:40:49Z and 06:43:15Z and moved **36 leads out of `below_threshold`**: 18 into `unreviewed`,
which are unscored, and 18 into `approved` that are **every one already `sent_to_smartlead`**.
This sweep is the lane the notes call the only producer left while discovery is paused. It
produced zero new people this week.

**One creator said yes.** `synergywellnessny@gmail.com`, read `yes-plus-questions/high` at
17:50:53Z, escalated the same second with a drafted reply.

**1 lead parked.** The pool went 7,387 to 7,388.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **0** (not a sending day) | 1,189 people, about 170 a day |
| People reached for the first time | **0** | 256 (21.5%), of which 243 never planned before |
| Replies read | **2 people** | 5 on 11-15, 18 on 11-13 |
| Creators whose reply is a yes | **1** | 1 on 11-15, 3 on 11-14 |
| Replies auto-answered | **0** | 0 since 2026-08-05, by Casey's pause |
| Parked into `approved_hold` | **1** | 2 on 11-15, 0 on 11-14 |
| Recovery lane contact points (its own) | **9** | 54 |
| Recovery lane people with a new address (its own) | **0** | 9 |
| Paid Apify batches | **0**, and no tick got as far as asking | 0 |
| Enrichment leads done | **1** | 2 on 11-15 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf holds **4,852** ready to write. People with a real send row sit at **2,523**.
Bundling is 99.8% of the 7,388-lead pool, which is why the enrichment chain ran one batch:
it has no book left beyond what arrives.

Twenty minutes after the cycle closed, `npm run send` fired two parked leads and SmartLead
accepted both. That is tomorrow's number, not this one. It cost two 60-second waits on
SmartLead's account-wide 200-requests-a-minute meter, which the retry absorbed.

## Q1. Why does a lane that is four days dead read as 1.6 hours quiet?

Because the fix that made it visible became one of the instruments that measure its silence.

`lane_silent_hours` is defined as the age of the newest trace the lane leaves on disk, taken
across every file it writes. Until 11-15 those were two files, both written only by a tick
that reached the batch, so a lane refusing early left nothing and the number grew. That is
how it reported 71.6 hours yesterday and sized the outage honestly.

The 11-15 fix added a third file, `apify-endspec-tick.json`, written by **every** exit path
including the refusal. The refusals happen hourly. So from the moment that fix deployed, the
newest trace is never more than an hour old, whatever the lane is doing:

| Morning | Lane state | `lane_silent_hours` |
|---|---|---|
| 11-15 | Dead ~71 hours on a rejected token | **71.6** |
| 11-16 | Dead ~94 hours on the same rejected token | **1.6** |

Nothing else about the block misled. `lane_answered_in_cycle` is false, `candidate_pool_dry`
is correctly null rather than true, and `projection.binding_constraint` reads `lane_silent`.
The newest tick names its own cause in `lane_last_tick_reason`. But the one field a reader
opens to ask *how bad is this* had inverted, and it pointed the reassuring way.

**The outage itself, counted off the journal:**

| Day (UTC) | Ticks that refused on the ledger read |
|---|---|
| 11-12 | 7 (from 10:20Z) |
| 11-13 | 12 |
| 11-14 | 12 |
| 11-15 | 12 |
| 11-16 (to 08:22Z) | 5 |

48 ticks, unbroken, 93.7 hours at the cycle end. A live call to `/v2/users/me/limits` with
the 46-character token from the shared env bank still answers:

```
{"error":{"type":"user-or-token-not-found","message":"User was not found or authentication token is not valid"}}
```

$31.06 of the November allowance is on the books, $21.06 spendable, against a billing cycle
that closes 2026-11-30. **Secrets are operator-managed, so nothing in the pipeline will fix
this.**

## Q2. The weekly floor sweep ran. Did it find anybody?

It graduated 36 channels and not one of them is a person we can email.

The sweep is the 3,000-subscriber floor re-check: channels that were parked below the bar get
re-measured and the ones that have grown past it come back. It is the lane the standing notes
name as the only source of net-new sendable people while discovery is paused (149 of them on
2026-10-19). It ran at 06:40:49Z to 06:43:15Z, restamping 35,086 rows in 147 batches.

What came out, counted off `leads.lead_candidates` by `updated_at` inside the cycle:

| Landed in | Leads | Already emailed? |
|---|---|---|
| `unreviewed` | 18 | Unscored, so not yet eligible either way |
| `approved` | 18 | **All 18 are `sent_to_smartlead`** |
| `needs_contact` | 5 | No verified address |
| `approved_hold` | 2 | 1 of the 2 is already `sent_to_smartlead` |

The `below_threshold` population fell by exactly 36, which is the 18 plus 18.

So the week's whole graduate class is 18 people this pipeline has already written to and 18
nobody has scored yet. The 18 unreviewed are the only ones that could still become supply,
and the standing note on that status is that the backlog there scores 4 to 5, below the bar.

This is worth saying plainly because the pipeline's supply story has been resting on this
sweep since September. **It is not broken, and it is no longer producing.**

## Q3. Did anything produce?

One lead parked, and the free recovery lane had another near-zero day.

**The lane's own half: 9 contact points on 7 people, zero addresses**, against 54 points and
9 people with a new address over the prior week. Across the cycle's four collect passes: 600
leads walked, 2,186 methods found, **2,176 of them already on file**, 10 points written.
That is a 99.5% re-walk of a picked-over book on lap 17 of a 1,784-lead pool, which is not a
fault.

**The one address of the day was not this lane.** It came from `contact-lookup`, automator's
own 30-minute timer, which shells the same CLI against leads already on the shelf, and it
came through `17-podcast`.

**Site resolution is healthy and the ownership gate is the ceiling, as it has been since
October.** The newest pass: 63 Brave searches, **zero refusals**, 55 candidate sites found,
**52 refused by the ownership gate**, 3 accepted. Cause reads `resolution_ok`. No amount of
Brave credit changes that number. The 40% no-site rate on that pass is the gate declining to
tie a site to a creator, not a search that failed.

**The cycle's top fault condition is cross-domain redirect at 240 of 605 method errors
(40%)**, spread across the four passes as 60, 87, 62 and 31. Measured on 2026-11-12 and
still true: most of that is the ownership gate refusing by design, so it is an evidence
decision for Casey rather than a repair.

`collect_book_stranded` is 3, so the selector gap closed in September has stayed closed.

## The one creator who said yes

`synergywellnessny@gmail.com`, read `yes-plus-questions/high` at 17:50:53Z, escalated in the
same second as `HOLD +draft`. The hold reads `category=yes-plus-questions is not approved for
auto-send`.

Two things about that hold, and neither is a defect:

1. **The category rule is moot.** Casey paused the auto-reply sender on 2026-09-17, so the
   lane runs in dry run and would not have sent whatever the category said. The reply was
   drafted and filed into the approval queue, which is where Casey wants it.
2. **This is not the cannot-sign shape.** That hold, the one that has blocked 12 confident
   yeses since 09-27 because the originating mailbox is gone, did not fire this cycle. Its
   count is unchanged at 12.

The classifier ran 86 times, read 2 people (one yes, one not-interested), failed zero times
and ended with an empty queue.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 48 | **48** |
| Watch band (follow-ups only) | 9 | **8** |
| Stopped band | 37 | **38** |
| Peak clear inside the cycle | 51 | 49, at 11-15T11:05:19Z |
| Held but already healthy | 9 | **10** (9 on the clock, 1 sick sibling) |
| Soonest self-lift | 3h | **0h** |

One mailbox returned to normal, `casey_brown@askcontentgetsclients.com`, and it is still
holding the band. No round trips. No gate run read a short fleet, so the move counts stand.

**The arithmetic does not close this morning, and the data says why.** 48 clear plus 1
returning minus 0 leaving gives 49 against a clear band of 48. `band_left_normal_unknown` is
1: one mover's previous band could not be reconstructed from any retained run, which makes
`band_left_normal` a lower bound by its own definition. This is the field behaving as
designed, not a new fault.

Ten held mailboxes already score above the recovery bar, nine of them waiting out the
48-hour clock with the closest due now. The real recoverable block is smaller than 38.

## Everything else, and almost all of it is intended

| Lane | State | Is money the answer? |
|---|---|---|
| Discovery, all sweeps | 0 new channels | No. Paused by Casey 2026-09-08 |
| Weekly floor sweep | 36 graduated, 0 of them sendable | No. It has stopped producing people |
| Recovery lane collect | Lap 17, 2,176 of 2,186 methods already on file | No. Picked over, resolution healthy, gate-bound |
| Apify endspec | **Dead 93.7 hours on a rejected token** | No. It needs a working credential, not credit |
| Enrichment chain | 1 batch, 1 lead, bundling 99.8% | No. Nothing left to enrich |
| YouTube key pool | 15 working of 66, 50 still exhausted after the reset | No. Settled 2026-09-16, and keyword search is paused |
| Reply classifier | 86 runs, 0 failures, queue 0 | No. Clean since it recovered on 11-14 |

**$0 Anthropic. OpenRouter balance $299.41 against an account rate of 23 cents a day. 0 fatal
signatures. No halt flag.** The shelf still carries the single standing
marked-sent-never-emailed lead, `recPSkSNP2HeR6CCV`, stamped 2026-10-07.

## Fixes shipped this cycle

Both halves of one fix: a refusing lane can now be sized, instead of being measured by a
silence it no longer has.

### 1. `youtube-email-outreach-v1` — the tick stamp carries how long the same answer has run

`scripts/apify-endspec-loop.sh`. `tick_note()` now reads the previous stamp before writing.
Identical outcome **and** reason carries the start forward and counts up; anything different
starts over:

```json
{"at":"2026-11-16T09:22:09Z","outcome":"skipped",
 "reason":"could not read the Apify monthly ledger",
 "since":"2026-11-12T10:20:12Z","consecutive":48}
```

One unbroken run of refusals is then one readable fact rather than a stamp that always looks
a few minutes old. Written through a temp file and `os.replace`, so a reader never sees a
half-written stamp, and it still can never be a reason the tick fails.

Verified by running the function against a scratch copy of the live stamp: it carries forward
from a pre-fix stamp that has no `since` (it falls back to that stamp's own `at`), increments
across repeats, resets when the answer changes, and starts a fresh run from an unreadable
prior file. `bash -n` clean.

(Committed by the auto-sync timer under its own message, `7b8f76e10`, before the
`autopilot-improve:` commit could land. The change is on the branch and will push; the
message is the timer's, not a missing commit.)

### 2. `youtube-outreach-orchestrator-v1` `a230365` — silence stopped measuring a dead lane

New exported `apifyTickFacts()` reads the stamp and publishes three fields beside the
existing ones:

- `lane_last_tick_since` — when the current answer began.
- `lane_last_tick_streak` — how many consecutive ticks have given it.
- `lane_refusing_hours` — how long an unbroken run of refusals has lasted at the cycle end.
  **This is the field that sizes an outage now.**

Anything but `ran` counts as a refusal, including an outcome this reader has never heard of,
so a new exit path added to the loop script later cannot read as a healthy lane without an
edit here. All three are null on a stamp written before today, which carries no `since`:
unknown, and explicitly **not** a run that started this tick. Defaulting that to "started
now" would publish the reassuring answer on exactly the lane this is built to catch.

`lane_silent_hours` stays, with its meaning narrowed in the block note: it now only answers
"has this lane stopped running at all", which is a different and rarer question.

Verified against the live stamp before committing (it is the pre-fix shape, so it correctly
reports unknown and will start carrying from the next tick) and against the shape the next
tick will write. Typecheck clean. Five new selftest assertions, all passing.

## What to do next

1. **Replace the Apify token.** Four days, 48 refused ticks, $21.06 spendable and a billing
   cycle that closes 2026-11-30. A live probe still answers `user-or-token-not-found`.
   Secrets are operator-managed, so nothing in the pipeline can do this. Unchanged from
   yesterday and the day before.
2. **Answer `synergywellnessny@gmail.com`.** One creator agreed to talk and the draft is in
   the approval queue. Behind it sit the 12 escalations since 09-27 that were blocked by the
   missing-mailbox hold, every one a confident yes. The only item on this list that touches
   revenue rather than volume.
3. **Decide what happens now the floor sweep has stopped producing.** It graduated 36 leads
   this week and not one is a person we can email. With discovery paused, the recovery book
   on lap 17 at 99.5% already on file, and Apify dead, there is no lane left that adds a new
   sendable person. The pipeline is living entirely off the 4,852 written-ready people on the
   shelf. Lifting the discovery pause is Casey's call alone.
4. **38 stopped mailboxes are the sending ceiling.** Ten of the held ones already score above
   the recovery bar and nine of those lift themselves, the closest now. Monday's plan will
   say how much of the block is real.
5. **Stop planning the people the push loses every sending day.** No push this cycle, so the
   cohort is unchanged from 11-14: nine people, two with channels gone from YouTube, five
   with a bounce on SmartLead's file. It belongs in Siege's selector, in `automator`.

## Checked rather than assumed

- The Apify token's rejection, against a live call to `/v2/users/me/limits`.
- The 48 refused ticks and their per-day counts, against `journalctl -u apify-endspec.service`.
- The `lane_silent_hours` inversion, by reading the field's own computation against the three
  files it takes its maximum over, and the two published snapshots side by side.
- The floor sweep's output, by querying `leads.lead_candidates` on `updated_at` inside the
  cycle and grouping by both status fields. The 18 approved graduates carrying
  `sent_to_smartlead` is a direct count, not an inference.
- The warm reply and the cannot-sign count, by grepping the whole reply log rather than a tail.
- The new stamp logic, by running `tick_note()` against a scratch copy of the live file
  through four transitions.
- The new reader fields, against the live stamp and the next tick's shape, before committing.

**Assumed:** that the 36 leads which left `below_threshold` are the floor sweep's own work.
The timing matches its window to the second and nothing else wrote that status in the cycle,
but the table keeps no per-row history that could prove it. Also assumed, as every morning,
that Casey's own answering lanes may have replied by hand; this report cannot see either way.
