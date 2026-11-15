# Lead Run Analysis — 2026-11-15

Cycle: 2026-11-14T08:00:00Z to 2026-11-15T08:00:00Z (the 24h ending at midnight PT, so all
of Saturday 14 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-15.json`.
Companion to [lead-run-2026-11-15.html](lead-run-2026-11-15.html).

## Headline

**The paid recovery lane has been dead for three days, and yesterday's report told you the
problem was a shortage of leads.** The Apify token stopped authenticating. A live probe this
morning returns `user-or-token-not-found`, so the loop's first step, asking Apify how much
of the monthly allowance is left, has failed on every tick since 2026-11-12T10:20Z. That is
about 36 ticks over 71.6 hours.

**Nothing on disk said so.** Five of the six early exits in the loop script wrote their
reason to the systemd journal and nothing to the logs folder, and the logs folder is what
this report reads. So the newest run log stayed at 2026-11-12T08:21:48Z and the snapshot
went on publishing its answer: `candidate_pool_dry: true`, a 34-tick dry streak, `$31.06
left`, `binding_constraint: candidate_supply`. Yesterday's lane table printed "No. It
finished its book; the shortage is candidates" about a lane that had not asked the question
since Thursday. Both halves of that are fixed below.

**It was a Saturday, so no email went out, and that is correct.** `siege-plan.timer` runs
Monday to Friday. `binding_constraint` reads `not_a_sending_day` and nothing is wrong.

**One creator said yes, and the reply drafter could not sign it.**
`danielwangwe7@gmail.com` was read `simple-yes/high` 29 times from 19:40:01Z, then
escalated at 02:23:40Z with a drafted reply and the hold `cannot tell which mailbox this
thread sends from, so cannot sign it`. That hold has now fired **12 times since
2026-09-27 across 11 people, and every single one was `simple-yes/high`** (yesterday's
report said 11 since 10-07 with 8 of them a yes; the first was 09-27 and the share is all
of them).

**2 leads parked.** The pool went 7,385 to 7,387. The enrichment chain did both.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Emails loaded into SmartLead | **0** (not a sending day) | 1,189 people, about 170 a day |
| People reached for the first time | **0** | 256 (21.5%), of which 243 never planned before |
| Replies read | **5 people** | 18 on 11-13 |
| Creators whose reply is a yes | **1** | 3 on 11-13 |
| Replies auto-answered | **0** | 0 since 2026-08-05, by Casey's pause |
| Parked into `approved_hold` | **2** | 0 on 11-14, 1 on 11-13 |
| Recovery lane contact points (its own) | **3** | 58 |
| Recovery lane people with a new address (its own) | **0** | 9 |
| Paid Apify batches | **0**, and no tick even asked | 0 |
| Enrichment leads done | **2** | 0 on 11-14 |
| New channels discovered | **0** | 0, by Casey's order of 2026-09-08 |

The shelf holds **4,851** ready to write. People with a real send row went 2,521 to
**2,523**. Bundling sits at 99.8% of the 7,387-lead pool, which is why the enrichment chain
ran only two batches: it has no book left beyond what arrives.

## Q1. What happened to the Apify lane, and why did two reports miss it?

The token stopped working, and the lane's refusal left no trace a reader opens.

Probed live this morning:

```
GET https://api.apify.com/v2/users/me/limits
{"error":{"type":"user-or-token-not-found","message":"User was not found or authentication token is not valid"}}
```

The token is 46 characters and present in the shared env bank, so this is not a missing
variable. It is a credential Apify no longer recognises. **Replacing it is operator work
and nothing here will fix itself.**

Run logs per UTC day, counted off the logs folder, beside the refusals in the journal:

| Day | Ticks that reached a batch | Ticks that refused on the ledger read |
|---|---|---|
| 11-08 | 12 | 0 |
| 11-09 | 10 | 0 |
| 11-10 | 12 | 0 |
| 11-11 | 12 | 0 |
| 11-12 | 5 | 7 |
| 11-13 | **0** | 12 |
| 11-14 | **0** | 12 |
| 11-15 (to 08:20Z) | **0** | 5 |

The cliff is inside 11-12. The last log is 08:21:48Z that morning and the first refusal is
10:20Z.

**Why the snapshot could not see it.** The 2026-11-02 note on that block rests on a
sentence that was true then: *a tick that scrapes nothing still writes a run log*. It is
only true of a tick that gets as far as the batch. The halt flag, a live batch, the lock,
a missing token and an unreadable ledger all exited before anything was written, and the
sixth exit (resting under the minimum batch size) was the only one that left a stamp. So
the reader kept the 11-12 answer and had no field that could contradict it.

The 11-13 snapshot still had one real log inside its window, so that morning's reading was
honest. **The 11-14 snapshot was the first stale one and today's would have been the
second.**

What it cost: 71.6 hours of a paid lane doing nothing, with $31.06 of the November
allowance on the books and $21.06 of it spendable, against a billing cycle that ends
2026-11-30. At the lane's measured rate that is roughly 300 channels unscraped.

## Q2. What happened to the one creator who said yes?

He reached Casey with a drafted reply. What the machine cannot do is send it.

The sequence, off `automator/logs/smartlead-auto-reply.log`:

- 19:40:01Z: first read, `simple-yes/high`, `WOULD-SEND`
- 28 more `WOULD-SEND` readings over the next seven hours, one per classifier pass
- 02:23:40Z: `HOLD +draft`, `escalated 1`, reason `cannot tell which mailbox this thread
  sends from, so cannot sign it`
- every run after that read 0 replies

**Correcting yesterday's framing on one point.** That report described these yeses as
sitting in a queue because the pause leaves replies unprocessed. The escalation is the
exception: it marks the reply processed and writes a row into
`automator/state/escalations.jsonl`, which is why the queue dropped to 0 and stayed there.
Across the whole file, **16 people have been escalated with this hold since 2026-09-27 and
15 of those escalations carry a drafted reply.** Casey has them. They are in the approval
queue, not lost.

**The cause is named in the code, not inferred here.** `scripts/smartlead-auto-reply.py`,
in the comment above the check: *"The usual cause is a thread whose mailbox has since been
deleted, which is also a thread SmartLead could not reply through anyway."* SmartLead
threads a reply through the same mailbox that sent the original, so when that mailbox is
gone there is no address to sign as and no route to reply on. Given the fleet's churn (37
mailboxes in the stopped band this morning, 71 paused by the older gate over its lifetime),
a warm reply landing on a mailbox that no longer exists is going to keep happening.

That makes the repair two separate things, and only one of them is a bug:

1. **Answer these people from a live address by hand.** 11 people, every one a confident
   yes. The drafts already exist.
2. **Decide what the drafter should do when the original mailbox is gone.** Right now it
   refuses rather than signing under a name the prospect never heard from, which is the
   right default. The alternative is sending from a live mailbox with an explicit line
   about the change. That lives in `automator`, which owns the reply path and is not one of
   the five repos this agent may edit.

## Q3. Did anything produce?

Two leads, both through enrichment, and the free recovery lane had its quietest day of the
week.

**The recovery lane's own half: 3 contact points on 3 people, zero addresses**, against 58
points and 9 people with a new address over the prior week. Across the cycle's three collect
passes: 450 leads walked, 1,764 methods found, **1,757 of them already on file**, 7 points
written. That is a full re-walk of a picked-over book on lap 17 of a 1,780-lead pool, which
is not a fault. Site resolution is healthy: 3.3% no-site, zero Brave refusals, cause
`resolution_ok`.

**The other 4 points and all 3 addresses were not this lane.** They were `contact-lookup`,
automator's own 30-minute timer, which shells the same CLI against leads already on the
shelf. `lane_*` is this lane; the totals are two callers.

**Its top fault condition held at cross-domain redirect, 204 of 606 method errors, 34%**,
spread across the three passes as 76, 68 and 60. The spread is tight, so unlike the 11-08
reading this one is not a sampling artifact. Condition coverage is 53%, so treat 34% as a
lower bound.

`collect_book_stranded` is 3, so the selector gap closed in September has stayed closed.

## The fleet

| Reading | Yesterday | Today |
|---|---|---|
| Clear band | 49 | **48** |
| Watch band (follow-ups only) | 8 | **9** |
| Stopped band | 37 | 37 |
| Peak clear inside the cycle | — | 51, at 11-14T11:05:18Z |
| Held but already healthy | 6 | **9** (8 on the clock, 1 held by a sick sibling) |
| Soonest self-lift | 2h | **3h** |

The arithmetic closes: 49 clear, plus 2 back to normal, minus the 3 that left the band,
gives 48. No run read a short fleet, so the move counts can be trusted.

**One of the two returners went straight back down.** `casey_brown@viewsgetclients.com`
returned to normal and was re-stopped inside the same cycle; `casey.brown@tubegetssales.com`
still holds the band. A round trip and a recovery are different things, and this was one of
each.

Nine held mailboxes are already scoring above the recovery bar. Eight of them are waiting
out the 48-hour clock and lift themselves, the closest within three hours. The ninth is
held only because two addresses on its domain are sick, which is somebody else's
deliverability charged to a well mailbox.

## Everything else, and almost all of it is intended

| Lane | State | Is money the answer? |
|---|---|---|
| Discovery, all sweeps | 0 new channels | No. Paused by Casey 2026-09-08 |
| Recovery lane collect | Lap 17 of a 1,780 book, 1,757 of 1,764 methods already on file | No. Picked over, and resolution is healthy |
| Apify endspec | **Dead 71.6 hours on a rejected token** | No. It needs a working credential, not credit |
| Enrichment chain | 2 batches, 2 leads, bundling 99.8% | No. Nothing left to enrich |
| YouTube key pool | 15 working of 66, 50 still exhausted after the reset | No. Settled 2026-09-16, and keyword search is paused anyway |
| Reply classifier | 101 runs, 0 failures, queue 0 | No. It recovered on 11-14 and stayed clean |

**$0 Anthropic. OpenRouter balance $299.63 against an account rate of 16 cents a day. 0
fatal signatures. No halt flag.** The shelf still carries the single standing
marked-sent-never-emailed lead, `recPSkSNP2HeR6CCV`, stamped 2026-10-07.

## Fixes shipped this cycle

### 1. `youtube-email-outreach-v1` — every tick leaves a stamp, including one that refuses

`scripts/apify-endspec-loop.sh` now writes `logs/apify-endspec-tick.json` on all six early
exits and once more when a batch launches:

```json
{"at":"2026-11-15T08:20:54Z","outcome":"skipped","reason":"could not read the Apify monthly ledger"}
```

One line, written before the exit, never a reason the tick fails. It is the difference
between "asked and got no" and "never asked", which is exactly what three days of this
outage turned into a published number. Syntax-checked, and the emitted line parses as JSON.

(Committed by the auto-sync timer under its own message, `b7e71c4aa`, before the
`autopilot-improve:` commit could land. The change is on the branch and will push; the
message is the timer's, not a missing commit.)

### 2. `youtube-outreach-orchestrator-v1` `a888e20` / `d490973` — a silent lane now says so

`recovery_budget.apify` gained `lane_answered_in_cycle`, which is whether any run log falls
inside the window, the only evidence the lane got as far as counting candidates. When it is
false:

- `candidate_pool_dry` reads **null**, not true. Unknown, and not a finished book.
- `projection.binding_constraint` reads **`lane_silent`** and `projected_leads` is null,
  because neither money nor supply is the wall when nobody asked.
- `candidate_dry_streak` and `candidate_dry_since` stay, because they are real history up to
  that last log, now read beside `lane_silent_hours`.

Also published: `newest_run_log_at`, `lane_silent_hours` (71.6 this morning), and
`lane_last_tick_at` / `_outcome` / `_reason` off the new stamp. Verified against the live
files: `lane_answered_in_cycle` false, newest evidence 2026-11-12T08:21:48Z. Two new
selftest assertions, typecheck clean.

### 3. `youtube-outreach-orchestrator-v1` `be584a4` — the report generator is typechecked, and it was hiding a real defect

Yesterday's report found that `tsconfig.json` included only `src/**`, so `npm run
typecheck` had never read `scripts/autopilot/`, the directory that generates the metrics
this whole series is grounded in. It left the three pre-existing errors for a deliberate
pass. This was the quiet cycle for it.

`include` now covers `scripts/**/*.ts` and the three errors are closed. **One of them was
not cosmetic.** `bandGateFacts()` builds the band gate's per-mailbox reason ledger and then
left it out of its success return; only the blank early return carried it. The caller does
`inboxGateFacts(gateState, band.reasons)`, so on every real run that argument was
`undefined` and fell back to the empty default. The band gate adopts health-only pauses out
of the old gate's registry and deletes them there, so for those mailboxes its ledger is the
only place the reason still exists, and the last fallback in the health/warmup split never
fired. A pause explained only by the band gate counted as `gate_paused_unexplained`, which
is the one answer the 2026-10-15 split was built so it could never give.

It cost nothing this cycle (`gate_paused` was 0) and would cost a wrong reason on any cycle
where the older gate pulls a mailbox the band gate has already adopted. The other two were
declaration-level: a fixture array inferring as `never[]`, and `siegePushOutcome` promising
three `lost_split_*` fields it does not set itself (they arrive from `lostCohort` at the
assembly site, which is why the JSON has always been right). Both now say what they mean.
Two new selftest assertions lock the ledger wiring, 19 in total added this cycle, all
passing.

## What to do next

1. **Replace the Apify token.** A live probe returns `user-or-token-not-found`. The lane has
   been dead 71.6 hours with $21.06 spendable and a billing cycle that closes 2026-11-30,
   which is roughly 300 channels it will not get to. Secrets are operator-managed, so
   nothing in the pipeline can do this.
2. **Answer `danielwangwe7@gmail.com`, and decide what the drafter does when a mailbox is
   gone.** 11 people since 09-27, every one a confident yes, all with drafts already in the
   approval queue. The only item here that touches revenue rather than volume.
3. **Stop planning the people the push loses every sending day.** No push this cycle, so the
   cohort is unchanged from 11-14: nine people, two with channels gone from YouTube, five
   with a bounce on SmartLead's file. Belongs in Siege's selector.
4. **37 stopped mailboxes are the sending ceiling.** Nine held mailboxes already score above
   the recovery bar and eight of those lift themselves, the closest within three hours, so
   the real recoverable block is smaller than 37. Monday's plan will say how much smaller.
5. **Nothing buys new leads except lifting the discovery pause.** Every other producer is
   finished rather than broken. Casey's call alone.

## Checked rather than assumed

- The Apify token's rejection, against a live call to `/v2/users/me/limits`.
- The 36 refused ticks and their timestamps, against `journalctl -u apify-endspec.service`.
- The per-day tick counts, against the run logs in `youtube-email-outreach-v1/logs/`.
- That the 11-13 snapshot was the last honest reading, by reading its own `apify` block.
- The warm reply's full sequence and its escalation row, against
  `automator/logs/smartlead-auto-reply.log` and `automator/state/escalations.jsonl`.
- The 12 cannot-sign holds and their categories, by grepping the whole 91,861-line log
  rather than a tail.
- The dropped reason ledger, by reading the call site and then asserting it in a selftest.
- The new reader fields, against the live files, before committing.

**Assumed:** that the deleted-mailbox explanation in the reply script's own comment is the
cause for these 11 specific threads. Confirming it per thread needs a SmartLead lookup this
report does not make. Also assumed, as every morning, that Casey's own answering lanes have
or have not replied by hand; this report cannot see either way.
