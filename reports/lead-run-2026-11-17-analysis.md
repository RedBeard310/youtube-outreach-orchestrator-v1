# Lead Run Analysis, 2026-11-17

Cycle: 2026-11-16T08:00:00Z to 2026-11-17T08:00:00Z (the 24h ending at midnight PT, so all of
Monday 16 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-17.json`.
Companion to [lead-run-2026-11-17.html](lead-run-2026-11-17.html).

## Headline

**227 emails went out on Monday and reached one person who had never heard from us.** The
push was close to clean: 247 planned, 225 people emailed, 22 lost. Of the 223 people with a
send row, **222 were repeat offers** to someone already written to.

**That is the sixth day of it, not a bad Monday.** People reached for the first time ever, by
Pacific day, ran:

```
11-09: 210   11-10: 31   11-11: 7   11-12: 3   11-13: 2   11-14: 0   11-15: 0   11-16: 1
```

Two hundred and ten of the 254 people reached across those eight days arrived on one Monday.
Since then, **1,193 emails over five sending days have reached 44 new people.** Every morning
in that run read its own number as a one-day dip against a healthy week, because the baseline
is `first_touch_pct_prev_7d`, a ratio over seven days, and one big day sets it for the next
seven. This cycle published **0.4% against 21.4%**, and the 21.4% was almost all 11-09.

**The Apify lane has done no work for 119.6 hours, and the field that sizes that read 23.6.**
Third morning running that one gauge got this outage wrong. A live probe of
`/v2/users/me/limits` still returns HTTP 401 and `user-or-token-not-found`.

**The fleet had its best day in three weeks.** The clear band went 48 to 55, the stopped band
38 to 34, seven mailboxes returned and all seven held it, no round trips.

**0 leads parked.** The pool is flat at 7,388. **0 replies were a yes.**

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **227** | 1,183 people, about 170 a sending day |
| People reached for the first time | **1** (0.4%) | 253 (21.4%), of which 240 never planned before |
| People the push lost | **22** (19 lost before, 3 new) | 14 on 11-14, 21 on 11-13 |
| Ready people refused a slot | **1,160** (485 whale, 650 strong7, 25 other7) | 1,263 on 11-14 |
| Follow-ups owed vs daily allowance | **945 against 735** | 267 against 660 on 11-14 |
| Replies read | **6 people** | 2 on 11-16, 5 on 11-15 |
| Creators whose reply is a yes | **0** | 1 on 11-16, 1 on 11-15 |
| Parked into `approved_hold` | **0** | 1 on 11-16, 2 on 11-15 |
| Recovery lane contact points (its own) | **9** | 47 |
| Recovery lane people with a new address (its own) | **1** | 8 |
| Paid Apify batches | **0**, and no tick reached the batch | 0 |
| Enrichment leads done | **0**, chain idling for want of work | 1 on 11-16 |
| New channels discovered | **0**, by Casey's order of 2026-09-08 | 0 |

The shelf holds **4,851** people written and ready. People with a real send row sit at
**2,524**. Bundling is 99.8% of the 7,388-lead pool, which is why the enrichment chain ran no
batches: it has no book left beyond what arrives.

$0 Anthropic. OpenRouter balance $299.30 against an account rate of 11 cents a day. 0 fatal
signatures. No halt flag.

## Q1. Where are the new people going?

Nowhere. They are waiting.

Monday had a ceiling before it planned anybody. The fleet's daily allowance was **735**
messages and it already owed **945** follow-ups, so what was left to hand out was **247**
slots. That is the documented weekend effect: every offer is a three-email sequence on days 0,
4 and 10, SmartLead sends Monday to Thursday, so a weekend of due follow-ups lands on Monday
on top of Monday's own.

Then Siege filled those 247 slots by tier. The waiting queue is 485 whale, 650 strong7 and 25
other7, and the whale tier ran out of never-emailed people on 2026-10-13, so its re-offer
queue takes the slots while lower tiers wait.

**This is a priority decision, not a fault.** Repeat offers are deliberate since 2026-10-07.
What is new is that the running total was invisible: each day's own figure looked like noise
against a weekly ratio that one day had set.

| Pacific day | Emails loaded | New people reached |
|---|---|---|
| 11-09 | 231 | **about 210** |
| 11-10 | 374 | 31 |
| 11-11 | 242 | 7 |
| 11-12 | 180 | 3 |
| 11-13 | 170 | 2 |
| 11-14, 11-15 (weekend) | 0 | 0 |
| **11-16** | **227** | **1** |

The two columns come from different instruments. Emails loaded is each cycle's own snapshot;
new people is one query run this morning over `leads.outreach_sends`. They disagree by 3 on
11-09, where the snapshot taken that morning read 213, so the single-digit days are exact and
the 210 is about 210.

### The push itself

247 planned, 256 approved, 217 sent, 14 failed, 23 skipped, **225 people emailed, 22 lost**.
Nothing deferred. Two escalations and one batch that died before its first lead.

Eight people were emailed with no `SENT` line in the log at all, caught by the send ledger
rather than the narration, which is the 11-03 fix doing its job. Twenty-one skipped drafts
were rewritten and sent in the same run, so they cost nobody.

The loss splits into 14 refused by SmartLead, 1 the push never reached, and 7 the log never
mentions. Reasons ranked by people actually lost:

| Reason | Leads | Lost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 9 | 9 |
| SmartLead did not add the lead (unsubscribed, 4 distinct addresses) | 4 | 4 |
| No draft was written: business owner, no clean job title exists | 1 | 1 |

**19 of the 22 were lost before.** One has now been lost on 11 consecutive sending days.
`lost_split_complete` is true, so that 19 is a real count rather than a truncated list, though
`lost_history_capped_days` is 2, which makes the 3 new a lower bound. Nine of them carry a
bounce already on SmartLead's file and four an unsubscribe, so no push will ever send them.
They took about 9% of a 247-slot day.

## Q2. How long has the Apify lane really been dead?

**119.6 hours, five days.** The gauge published this morning read 23.6.

The token is still rejected. A live probe of `/v2/users/me/limits` with the 46-character token
from the shared env bank returns HTTP 401 and `user-or-token-not-found`. Apify no longer
recognises the credential. Secrets are operator-managed, so nothing in the pipeline can repair
it.

**This is the third morning in a row that one field got the size of this outage wrong, and
each time it was the field a reader opens first.**

| Morning | Real outage | Field read | Which field |
|---|---|---|---|
| 11-15 | about 72 hours | 71.6 | `lane_silent_hours`, correct |
| 11-16 | about 96 hours | **1.6** | `lane_silent_hours`, inverted by the new stamp |
| 11-17 | about 118 hours | **23.6** | `lane_refusing_hours`, counting from the stamp's own birth |

The 11-16 fix taught every exit path to stamp how long the same answer has run, and
`lane_refusing_hours` reads that stamp. The stamp has only existed since yesterday, so the
first tick after it deployed started a fresh run. The live file says so directly:

```json
{"at": "2026-11-17T08:20:43Z", "outcome": "skipped",
 "reason": "could not read the Apify monthly ledger",
 "since": "2026-11-16T08:22:09Z", "consecutive": 13}
```

Counted off the journal, the refusals run **7** on 11-12 from 10:20Z, then **12, 12, 12, 12**,
then **5** by 08:00Z this morning. Sixty ticks, unbroken, all on `could not read the Apify
monthly ledger`, all exiting 0, so systemd keeps reporting success.

**$31.06** of the November allowance is on the books and **$21.06** of it spendable, against a
billing cycle that closes **2026-11-30**. Everything else in the block is honest:
`lane_answered_in_cycle` is false, `candidate_pool_dry` is correctly null rather than true, and
`projection.binding_constraint` reads `lane_silent`.

## Q3. Did anything produce?

Almost nothing, and for once every lane can say why in its own words.

**The recovery lane's own half: 9 contact points on 4 people, and 1 address on 1 person**,
against 47 points and 8 addresses over the prior week. Read `lane_*`, not `free_*`: the totals
also hold automator's own contact-lookup timer, which contributed 2 points this cycle.

Across the cycle's four collect passes it walked 584 leads, found 1,273 methods, and **1,264 of
them were already on file**. On the newest pass that was 591 of 591, every single one. This is
lap 18 of a 1,783-lead book, so a re-walk is expected rather than a fault.
`collect_book_stranded` is 3, so the selector gap closed in September has stayed closed.

Both producing methods were page readers: `34-channel-page` wrote 10 points across 4 leads
including the one address, and `02-subpages` wrote 1.

**Site resolution is healthy and the ownership gate is still the ceiling.** Cause reads
`resolution_ok`, the no-site rate is 4.7%, and the pass ran 10 Brave searches with one refusal,
found 8 candidate sites and kept 3. No amount of Brave credit changes a gate declining to tie a
page to a creator on purpose.

**One shape to watch rather than diagnose.** The cycle's top fault condition was cross-domain
redirect at **128 of 486** method errors, 26%, and across the four passes oldest first it ran
**0, 0, 62, 66**. These counts swing on which slice of the book the cursor sits on, so two
passes at zero and two in the sixties is either a different slice or something that changed
mid-cycle. One look next cycle, not a repair today.

**The enrichment chain did no batches, and that is correct.** It is idling for want of work:
the pool is 99.8% bundled, so it drains a one-lead trickle and waits. Until this morning that
was indistinguishable in the snapshot from a chain frozen on a gate.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 48 | **55** |
| Watch band (follow-ups only) | 8 | **5** |
| Stopped band | 38 | **34** |
| Peak clear inside the cycle | 49 | 55, at 11-16T13:05:09Z |
| Returned to clear, and still clear | 1 of 1 | **7 of 7** |
| Round trips | 0 | 0 |
| Held but already healthy | 10 | 5, all on the clock |
| Soonest self-lift | 0h | 2h |

**The arithmetic closes.** 48 clear plus 7 returning minus 0 leaving gives 55, which is the
clear band. `band_moves_comparable` is true and `band_short_readings` is 0, so no gate run read
a short fleet and the move counts stand. `band_left_normal_unknown` is 1, which makes
`band_left_normal` a lower bound, but the subtraction closes exactly anyway.

The seven returners are two on `clientsfromvideo.com`, two on `viewsgetsales.com`, and one each
on `businessgrowthvideo.com`, `viewsgetleads.com` and a third `viewsgetsales.com` address. The
older warmup gate paused 2 on health and resumed 1 in the same window.

Seven mailboxes off the stopped band in a day with no revolving door behind it is the healthiest
fleet move since the band gate took over on 2026-10-15. **It did not help this cycle**, because
capacity was never Monday's binding constraint: the ceiling was 945 owed follow-ups against a
735-message allowance.

## The reply lane

27 runs, **6 people read**, zero classifier failures, queue empty at the end. Categories: 2
not-interested, 2 unsubscribe, 2 other. **No yes.**

`cannot_sign_people` is 0 this cycle, so the standing count of creators held because the drafter
cannot work out which mailbox the thread sends from is unchanged at **11 people** across 12 log
lines, eight of them read as a plain yes. The sender itself has been paused by Casey since
2026-09-17, so nothing was auto-sent and nothing was meant to be.

## Fixes shipped this cycle

All three in `youtube-outreach-orchestrator-v1`. Typecheck clean and the full selftest passing
after each.

### 1. Four zeros could not tell an idle enrichment chain from a frozen one (`86efc81`)

The enrichment block published `batches: 0, leads_done: 0, leads_failed: 0, in_flight: 0`,
which is the honest answer for a quiet trickle, for a chain frozen on a gate, and for a chain
that is not running at all. Three different mornings, one published shape. This is the 11-15
`lane_answered_in_cycle` fault in the other lane the standing order keeps alive, and the one
that matters more: with discovery paused, enrichment is the only thing that turns a recovered
address into a lead anybody can write to.

**It had already cost two mornings.** The chain hit `openrouter account out of credits (DRY
0.94 1.00)` at 2026-11-12T05:43:13Z and did not clear until 2026-11-14T00:59:58Z. Forty-three
hours frozen, spanning two whole cycles that each published those same four zeros. Nothing
generated saw it, because `openrouter_today` reads the finder's spend log and the finder is
paused, so that block printed a balance and five figures of runway beside an account past zero.
The chain had been saying it in plain words in its own log the whole time.

A new `enrichmentChainState()` reads the chain's newest state and publishes it beside the
counters: `chain_state`, `chain_blocked`, `chain_blocked_since`, `chain_blocked_hours`,
`chain_last_line_at`, `chain_silent_hours`, `log_found`. Blocked means a gate (no credit, no
transcripts, no YouTube quota, a cool-down) or a state that exits the process (the halt flag,
the hard wall). `chain_blocked_hours` sizes the outage from when the gate began, which is the
11-16 lesson: a chain re-logging its gate every 30 minutes is never silent, so
`chain_silent_hours` only answers whether the process is writing at all.

Two details that matter:

- **A restart is transparent.** The chain re-execs itself when its script changes on disk and
  systemd restarts it besides, so a restart inside a gate is ordinary. Counting it as a state
  ended the gate's run and reset the clock, which published 1.5 hours for a freeze then 26
  hours old. `chain started (pid ...)` is deliberately not a state, and a log holding only a
  restart reads as unknown rather than healthy.
- **The halt matcher is anchored to exact wording.** A once-a-day note in the same log says
  *halt.flag exists and is NOT the halt flag, nothing is halted*, and a matcher loose enough to
  catch the word "halt" reads that note as an outage.

Verified against the live chain log at three real cycle boundaries. The 11-13 close now reports
`gate_openrouter_credits` blocked for **26.3 hours** where it published four zeros; the 11-14
close correctly reports idling, because credit was back by then; this cycle reports
`idling_no_inflow`, not blocked. Seven new assertions.

### 2. A stamp cannot remember an outage older than itself (`a8fc221`)

One new field, `lane_no_work_hours`: the age of the newest Apify run log. A tick only writes a
run log when it reaches a batch, so that age is exactly how long the lane has done no work. No
stamp, no threshold, no judgement about which exit path ran.

On today's files it reads **119.6** where `lane_refusing_hours` read 23.6. The block note now
says to quote it whenever the two disagree, because the stamp only ever covers the part of an
outage it witnessed.

**It is deliberately not called refusing-hours.** A lane can be quiet without refusing, and the
two differ here by the gap between the last good run at 08:21:48Z and the first journal refusal
at 10:20Z. So 119.6 brackets a refusal run of about 117.7 hours. Two hours of slack, stated in
the note, is the better error than a gauge reading 23.6.

A first attempt tried to flag the stamp as incomplete by comparing the newest run log against
the stamp's start, and a selftest killed it: that comparison cannot tell a four-day gap from a
one-tick gap, so it would have flagged every honest outage as well. The field that shipped
makes no such judgement.

### 3. A week carried by one day read as a steady week (`a7fbf70`)

`src/db.ts`. `first_touch_pct_prev_7d` is the baseline every morning compares against, and it
is a ratio over a whole week, so one big day sets it for the next seven. This cycle it published
0.4% against 21.4%, which says today collapsed off a healthy week.

The new `first_touch_by_day` publishes the series instead, oldest first. It buckets by each
person's own earliest send, so it cannot disagree with `first_touch` one level up, and it fills
a day that reached nobody in as a **0** rather than leaving it out, because a gap a reader has
to notice is how a slide reads as noise.

```
first_touch_by_day: 11-09: 210  11-10: 31  11-11: 7  11-12: 3
                    11-13: 2    11-14: 0   11-15: 0  11-16: 1
```

Verified by running the real query against Postgres. The whole six-day slide in this report came
out of it, and finding it before the fix took a hand query of `leads.outreach_sends`.

## Ranked levers

1. **Decide what the slots are for.** First item, ahead of the dead lane. Since 11-09, 1,193
   emails over five sending days have reached 44 new people, 4,851 written-ready people sit on
   the shelf, and 1,160 were refused a slot on Monday while the whale tier re-offered to a book
   it has already finished. The lever is `siege.fill_slots` and its `priority_key`, in
   `automator`, which carries nothing about whether a person has heard from us. Repeat offers
   were Casey's call on 2026-10-07, so the mix is his to set. What is new is that the cost is
   now measurable.
2. **Replace the Apify token.** Five days, 60 refused ticks, $21.06 spendable, billing cycle
   closes 2026-11-30. A live probe still answers `user-or-token-not-found`. Secrets are
   operator-managed, so nothing in the pipeline can do this. Unchanged from the last three
   mornings.
3. **Stop planning the people the push loses every sending day.** 19 of the 22 lost on Monday
   had been lost before, one on 11 consecutive sending days. Nine carry a bounce already on
   SmartLead's file and four an unsubscribe, so no push will ever send them. About 9% of a
   247-slot day. The repair is in Siege's selector, in `automator`.
4. **Answer the 11 creators held because their reply cannot be signed.** None joined this
   cycle and no reply was a yes, so the count is unchanged. Eight of the 11 were read as a plain
   yes. The drafter cannot resolve which mailbox the thread sends from, so it holds the reply
   even on a confident one. The repair is in `automator`, which owns the reply path.
5. **Nothing needs doing about the fleet, the enrichment chain or the recovery lane.** Seven
   mailboxes came back to clear and held, the chain is idle because the pool is bundled out, and
   the recovery book is on lap 18 with 99.3% of what it finds already stored. Watch the
   cross-domain redirect split (0, 0, 62, 66 across the four passes) for one more cycle before
   treating it as anything.

## Checked rather than assumed

- The Apify token's rejection, against a live call to `/v2/users/me/limits` returning HTTP 401.
- The 60 refused ticks and their per-day counts, against `journalctl -u apify-endspec.service`.
- The stamp's own contents, by reading `apify-endspec-tick.json`, which carries
  `since: 2026-11-16T08:22:09Z` and proves the gauge counts from its own birth.
- The six-day reach slide, by querying each person's earliest row in `leads.outreach_sends` and
  bucketing by Pacific day, which is also how the new field computes it.
- The 43-hour enrichment freeze and this cycle's idling, by reading the chain log directly and
  running the new reader against three real cycle boundaries.
- The chain's log vocabulary, by reading `scripts/backfill/chain.sh` rather than guessing at the
  strings, which is how the decoy-halt-flag note was caught.
- The standing cannot-sign count, by grepping the whole reply log for distinct addresses rather
  than a tail.
- All three fixes typechecked and selftested before committing.

**Assumed:** that the 247 slots went to repeat offers because of the tier ordering rather than
something else. The waiting queue by tier, the whale tier's exhausted first-touch supply and the
222 repeats are all measured, and the documented behaviour of `siege.fill_slots` explains them,
but that code is in another repo and this report did not read it this cycle. Also assumed, as
every morning, that Casey's own answering lanes may have replied by hand; this report cannot see
either way.
