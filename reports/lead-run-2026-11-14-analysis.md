# Lead Run Analysis — 2026-11-14

Cycle: 2026-11-13T08:00:00Z to 2026-11-14T08:00:00Z (the 24h ending at midnight PT, so all
of Friday 13 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-14.json`.
Companion to [lead-run-2026-11-14.html](lead-run-2026-11-14.html).

## Headline

**The OpenRouter account was funded overnight and reply reading came back.** Checked live
against the credits endpoint: $1,910 bought, $1,610.21 used, **$299.79 left**. Yesterday the
same check read minus nineteen cents, and funding it had been the number one recommendation
in this report for seven mornings.

**The recovery is visible to the second.** Refusals ran `2026-11-12T22:27:55Z` to
`2026-11-14T00:48:12Z`, about twenty-six hours, and **301 of them fell inside this cycle
across 53 failed runs**. The 00:48:12Z run closed `failed 16`. The 02:38:01Z run closed
`failed 0, escalated 16`. All sixteen queued replies were read in one pass and the queue has
been 0 since. Nothing was lost, which is exactly what the pause was built to guarantee.

**The first thing the recovered lane did was read three creators agreeing to talk.** Of 18
people whose replies were read, 3 are currently a yes: `leigh@leighbrown.com` and
`facemetrics1@gmail.com` as `simple-yes/high`, `ovais@senatorwerunads.com` as
`yes-plus-personal-note`. **None of them appeared in a single generated field**, because this
report had never read the reply lane at all. Fixed below.

**170 emails went out and reached nobody new.** 2 first touches at 1.2% against 30.6% across
the prior week, and both were `first_touch_recovered`. `first_touch_new` is **0**.

**The fleet gained five clear mailboxes at 08:06:05Z, six minutes after the cycle ended.**
Real, and it belongs to the next push rather than this one.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **170** | 1,107 people, about 158 a day |
| People reached for the first time | **2** (1.2%) | 339 (30.6%) |
| ...of those, never planned before | **0** | 328 |
| People the push lost | **14** | 5, 5, 8, 9, 9, 11, 16, 18, 21 on the sending days from 11-03 |
| ...of those, lost before | **13**, one on an 11-day streak | — |
| Replies read | **18 people** | unmeasured until today |
| Creators whose reply is a yes | **3** | unmeasured until today |
| Replies auto-answered | **0** | 0 since 2026-08-05, by the pause |
| Parked into `approved_hold` | **0** | 1 on 11-13, 3 on 11-12 |
| Recovery lane contact points (its own) | **5** | 56 |
| Recovery lane people with a new address (its own) | **0** | 10 |
| Paid Apify people recovered | **0** | 0 |
| Enrichment leads done | **0** | 0 on 11-13 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf held at `ready_to_write` **4,849** for the third morning. People with a real send
row went 2,521 to **2,523**. Bundling holds at 99.8% of the 7,385-lead pool, which is why the
enrichment chain ran no batches: it has no book left.

## Q1. Did the money problem actually get fixed?

Yes, and it is the only thing that fixed itself this cycle.

The live credits read is `{"total_credits":1910,"total_usage":1610.206971559}`. Casey put $300
on the account inside the window. At the measured account rate of about two cents a day that
is not a concern again soon, with one caveat worth keeping: that rate describes a pipeline
whose discovery and enrichment lanes are both idle. It will rise the moment either restarts,
so the runway figure in the snapshot is not a forecast of a working pipeline.

The outage's shape, read off `automator/logs/smartlead-auto-reply.log`:

- 7 refusal lines on 11-12 (it began at 22:27:55Z, late in that cycle)
- **292 on 11-13**, with 82 classifier runs ending `failed`
- **96 on 11-14**, the last at 00:48:12Z
- 301 of the refusals and 53 of the failed runs sit inside this cycle's window
- `recovered_at` 02:38:01Z, the first clean run after the last refusal

The queue peaked at 17 replies and ended the cycle at 0.

## Q2. What did the recovered lane find, and why can't it answer?

Three creators saying yes, and two of them blocked by something re-arming the sender would
not fix.

The 18 people read this cycle break down as 8 not interested, 5 filed as `other`, 1
unsubscribe, 1 auto-responder, and the 3 agreements.

**Nothing auto-sent, by Casey's own instruction.** The drop-in at
`/etc/systemd/system/smartlead-auto-reply.service.d/outbound-paused.conf`, dated 2026-09-17,
reads: *"All outbound sending is paused until further notice."* It runs the lane in dry run,
and its own comment states the design: replies are still classified and logged, nothing is
sent, nothing is marked processed, so each one stays queued for when sending resumes. That is
why the outage cost hours and not replies.

Two scoping facts matter here, because both are easy to get wrong:

1. **The pause covers that one unit.** Siege's first touches were unaffected and pushed 170
   emails the same cycle. `send_plan.email_paused` is false.
2. **Casey answers these by hand.** `reply-drafts-doc.timer` builds an "Email Draft Replies"
   doc each morning around 7 AM Pacific and `positive-reply-to-board.timer` puts clear
   positives on the Notion board every ten minutes. Neither leaves a line in the log this
   report reads, so the report **cannot see an answer and must never claim one did not
   happen.** The last line in the log is the last thing the *automation* did, not the last
   thing anybody did.

**The real defect sits underneath the pause.** Both `leigh@leighbrown.com` and
`facemetrics1@gmail.com` were held with `cannot tell which mailbox this thread sends from, so
cannot sign it`. The drafter cannot resolve which address the thread goes out from, so it will
not compose a signature, so it holds a confident yes. That shape has fired **11 times since
2026-10-07 and 8 of them were `simple-yes/high`**: `bravedeencontact@gmail.com` (10-07),
`kosisoumenne@gmail.com` (10-09 and again 10-13), `michael@michaelfranzese.com` (10-14),
`sarah@dgtransports.com` (10-21), `dirk@dirkgermon.com` (11-05), and this cycle's two. The
repair is in `automator`, which owns the reply path and is not one of the five repos this
agent may edit.

## Q3. Why did 170 emails reach nobody new?

Because the slots are full of repeat offers, and the ready people are queued in a tier that
isn't being served.

The push itself ran correctly. Siege planned at 11:31:08Z, the unit started 11:59:23Z and
reported success. 184 planned, 184 approved, 0 deferred, 170 sent.

**Reach, which is the number that matters:** 2 first touches, 1.2% of the day, against 30.6%
across the prior week. Both were `first_touch_recovered`, already credited by a push on an
earlier day, the oldest 2026-11-05. `first_touch_new` is **0**.

**The ceiling is slots, not the ramp.** 184 mailbox slots against a day cap of 870, with 267
follow-ups already owed and 5 inboxes full. Slots are a remainder, a mailbox's allowance minus
what it already owes, so the small number is structural and not a sick fleet. Behind it,
**1,263 ready people are waiting**: 560 whale, 625 strong-7, **78 other-7**. The whale tier ran
out of never-emailed people on the 10-13 push, so its re-offer queue takes the slots while the
78 people nobody has ever emailed keep waiting.

**14 people got no email and 13 had been lost before**, the worst on an eleven-day streak.
Ranked by the people each cause really cost:

| Cause | Leads named | People lost |
|---|---|---|
| Absent from this batch's Siege manifest | 58 | 6 |
| SmartLead refused it, `bounce_count=1` | 5 | 5 |
| Already unsubscribed (3 separate addresses) | 3 | 3 |
| No draft written: no clean job title exists | 1 | 1 |

58 leads were skipped and **52 of them were written again and sent in the same run**, so the
manifest row cost 6 people rather than 58. Two of the recurring thirteen have channels that no
longer exist on YouTube. This is a fixed cohort being planned, refused and re-counted every
sending day, taking about 8% of a 184-slot day.

One caution on the arithmetic: `lost_history_capped_days` is 3, so **`lost_new: 1` is a lower
bound, not a count.** The 11-11 and 11-12 snapshots each capped their own loss list below
their own loss, so recurrence cannot be fully checked against them.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 44 | **49** |
| Watch band (follow-ups only) | 13 | **8** |
| Stopped band | 37 | 37 |
| Live inboxes in Siege's plan | 42 | 44 |
| Daily allowance | 630 | 660 |
| Not live | — | 80 of 124 |
| Held but already healthy | — | 6, all on the clock, closest due in 2h |

**The gain arrived six minutes after the cycle ended.** The hourly gate log shows 44 clear from
08:05Z, a slip to 43 at 23:06Z, flat all night, and then the 08:06:05Z run moving six mailboxes
back to normal at once. The gate runs at about five past the hour and the debrief fires at 00:20
PT, so the reading `band_normal` comes from is always just past the boundary. Those six were
clear for none of the sending day described here. All six still hold the band, there were no
round trips, and no run read a short fleet, so the move counts can be trusted.

The arithmetic closes, which is worth stating because it did not yesterday: 44 clear, plus 6
back to normal, minus 1 that left the band, gives 49.

**The one recoverable block is 34 mailboxes suspended in SmartLead and nothing else**, down 2.
Everything else in the not-live list is a passenger: 30 mailboxes are missing from the warmup
list, and every one of them is blocked by something else as well, so repairing that record
would free nobody. And 49 clear is not 44 live. The health gate and Siege's plan are different
instruments read at different hours; only the smaller one describes what can send.

## Every producer is dry, and almost all of it is intended

| Lane | State | Is money the answer? |
|---|---|---|
| Discovery, all sweeps | 0 new channels | No. Paused by Casey 2026-09-08 |
| Recovery lane collect | Lap 17 of a 1,782 book; 1,714 methods found, **1,709 already on file** | No. Picked over. Site resolution is healthy: 2.7% no-site, zero search refusals, cause `resolution_ok` |
| Apify endspec | **34 consecutive dry ticks** since 2026-11-09T10:20Z, $31.06 unspent and unspendable | No. It finished its book; the shortage is candidates |
| Enrichment chain | 0 batches, bundling 99.8% | No. Nothing left to enrich |
| YouTube key pool | 15 working of 66, 50 still exhausted after the reset | No. Settled 2026-09-16; it mainly costs 100-unit keyword search, which is paused |

The recovery lane's own output was 5 contact points on 4 people and **zero addresses**, against
56 and 10 the prior week. Across the cycle's four collect passes: 592 leads walked, 1,714
methods found, 1,709 already on file, 5 points written. Its top fault condition was
cross-domain redirect at 148 of 594 errors, 25%, spread across passes as `[0, 63, 63, 22]`,
which is a reminder to read the cycle rather than any single pass.

**$0 Anthropic. 0 fatal signatures. 0 halt flags.** The shelf carries one standing
marked-sent-never-emailed lead, `recPSkSNP2HeR6CCV`, stamped 2026-10-07, the one genuine case
of that shape.

## Fix shipped this cycle

**`youtube-outreach-orchestrator-v1` `80a00fe`** — a `reply_lane` block in the debrief data.

Every block in `debrief-data.ts` measured outbound work. A creator writing back to say yes is
the point of all of it, and the file never read the lane that handles one. It cost two mornings:
yesterday's report had to hand-grep a log in another repo to discover reply reading had stopped,
because the snapshot's own `openrouter_today` reads the *lead finder's* spend log and the finder
is paused, so it published $299 and 14,990 days of runway beside an account that had gone past
zero. This morning the lane recovered and read three creators agreeing to talk, and not one of
them was in a generated field.

`replyLaneFacts()` is a pure parse of a log the report already opens for the push: no network,
no database, no model call. Two traps closed in the writing:

- **It reads the whole log, not a tail.** `armed_last_at` and `last_auto_sent_at` are lifetime
  stamps and the whole point of them is that they can be months old. A 20,000-line tail of that
  8 MB file reaches only 2026-10-12, so it would have published null for both and read as
  "never armed, never sent" rather than "paused 58 days ago". That is a silent cap used as a
  measurement, the fault this file has now closed five times in other blocks.
- **Counts are distinct people, and the newest reading wins.** The classifier re-reads whatever
  is still queued every two minutes, and the pause deliberately leaves replies queued, so one
  creator collects a verdict line per run. `leigh@leighbrown.com` was read as `simple-yes/high`
  **seven times on 2026-11-12 alone**. Counting lines would have reported a flood of warm
  replies on a day with one person in it.

The note on the block states plainly that an unarmed sender is Casey's own order and that his
answering lanes leave no trace in this log, so a future reader cannot file `armed: false` as a
backlog of ignored creators. `cannot_sign_people` is published separately because it is the one
shape in the block that is a defect rather than a decision.

Typecheck clean. 17 new self-test assertions, all passing. Verified against the live log for
this cycle: 66 runs, 18 people, 3 warm, 301 refusals, recovered 02:38:01Z. The live read also
caught a warm reply a hand-grep had missed, `ovais@senatorwerunads.com`.

Nothing else was changed. The three repairs most worth making this morning all sit in
`automator`, which owns the send and reply paths and is not one of the five repos this agent
may edit.

## What to do next

1. **Answer the three creators who said yes.** `leigh@leighbrown.com`,
   `ovais@senatorwerunads.com`, `facemetrics1@gmail.com`. Leigh has read as a yes since
   2026-11-12. The only item here that touches revenue rather than volume, and it needs a
   person, because the auto-sender is paused on purpose.
2. **Fix the mailbox the reply drafter cannot resolve.** 11 held replies since 2026-10-07, 8 of
   them a confident `simple-yes`. Re-arming the sender will not clear them. In `automator`'s
   reply path, sitting directly on the warmest leads the pipeline produces.
3. **Stop planning the thirteen people the push loses every day.** 2 channels gone from
   YouTube, 5 with a bounce on SmartLead's file, 3 unsubscribed, one on an eleven-day streak.
   About 8% of every slot, and no push will ever send them. Belongs in Siege's selector.
4. **Recover the 34 suspended mailboxes, or accept 184 slots as the ceiling.** The whole
   recoverable block, with 1,263 ready people behind it. Six more held mailboxes are already
   healthy and lift themselves, the closest within two hours.
5. **Decide whether the whale re-offer queue should keep every slot.** `first_touch_new` was 0,
   and 78 other-7 people have never been emailed. A judgment call, not a bug.
6. **Nothing buys new leads except lifting the discovery pause.** Every other producer is
   finished rather than broken, including a paid lane sitting on $31 it cannot spend. Casey's
   call alone.

## Checked rather than assumed

- The OpenRouter balance, against a live read of the credits endpoint.
- The outage window, its 301 refusals, the 53 failed runs and the 02:38:01Z recovery, against
  `automator/logs/smartlead-auto-reply.log`.
- The 58-day sender pause and its wording, against the systemd drop-in itself.
- The hourly clear-band readings and the 08:06:05Z move, against
  `automator/logs/inbox-health.log`.
- The new `reply_lane` reader, against both a fixture and the live log.

**Assumed:** that the three warm creators have had no reply by hand. This report cannot see
that either way, because Casey's own answering lanes leave no trace in the log it reads.
