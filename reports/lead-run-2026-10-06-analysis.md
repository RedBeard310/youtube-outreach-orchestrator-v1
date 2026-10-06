# Lead run analysis, cycle 2026-10-05

Companion to [lead-run-2026-10-06.html](lead-run-2026-10-06.html). Cycle window
2026-10-05T07:00Z to 2026-10-06T07:00Z, which is Monday 2026-10-05 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-06.json`,
regenerated at 07:34Z to carry the new `send_plan.push_outcome` block.

## Headline

**The push finished for the first time in a week, and then lost 60 of 129 planned
emails to a rate limit on the SmartLead account that nothing in the pipeline waits
for.**

Two results, pointing opposite ways.

The 10-03 pool-leak fix (`7fd02b6fd`) worked. `siege-plan.service` reported
`success` and the whole push ran 10:19Z to 10:36Z, 17 minutes. On 10-01 and 10-02
the same work ran past the unit's one-hour timeout and was killed mid-batch. That
failure shape is closed.

Then a different wall. SmartLead meters the **whole account** at 200 requests a
minute. **53 leads were refused one at a time, 4 batches exited having pushed
nothing, and 7 leads inside those batches were never tried at all.** 69 emails
went out against a plan of 129. The accounting closes exactly: 69 + 53 + 7 = 129.

Separately, the parked pool was **flat at 7,592**, the eighth zero-growth cycle of
the run and the first since 29 September. That number matters more than it looks,
because yesterday's Brave fix is confirmed working: the lane ran at full reach and
still recovered nobody.

Zero fatal signatures, zero halts, zero crashes, twenty-third consecutive day of
$0 Anthropic spend.

## Finding 1: the SmartLead account rate limit, and two jobs spending it at once

**Shipped: `eedbbff87`, youtube-email-outreach-v1.**

SmartLead's limit is 200 requests per minute **for the account**. Not per campaign,
not per API caller, not per process. Two unrelated jobs were drawing on it inside
the same 17 minutes.

| Consumer | Rate | Lives in |
|---|---|---|
| Siege push | a few requests per email, ~90 short-lived processes, sequential | `automator` driving `youtube-email-outreach-v1/scripts/push-batch.ts` |
| Reply poller | 71 campaigns in ~43 seconds, every ~2 minutes, so ~99/min in bursts | `automator`, `smartlead-reply-sync` |

The poller ran **nine times inside the push window** (10:20, 10:22, 10:24, 10:26,
10:28, 10:30, 10:32, 10:34, 10:36) and reported **0 new replies on every one of
those nine runs**. So the push was sharing a 200-request minute with a job using
about half of it to learn nothing had changed.

Three refusal shapes, all from the same cause:

1. **Three leads got an outright `429 Too Many Requests`**, quoting the 200-a-minute
   rule by name, on campaign 4010801.
2. **Three batches died on `listCampaignMailboxes`** at 10:21:08, 10:21:11 and
   10:21:15 on campaign 4010851. `push-batch.ts` calls that before its first lead,
   to learn which sender names the email body is allowed to claim, so a 429 there
   takes the whole batch and every lead in it. Each escalated with `rc: 1,
   pushed: 0`.
3. **One campaign could not be started** at 10:30:54 while holding a lead, `http
   429`, escalating as `siege could not start a campaign that has leads in it`.
   The batch behind it also exited with `pushed: 0`, giving 4 dead batches in all.

Nothing retried any of it. Every SmartLead call in the email repo threw on the
first non-2xx, so a refusal lasting a few seconds became a lead waiting a day.

### Why a retry and not a rate limiter

A token bucket is the textbook answer and it would govern nothing here. The push
runs as about 90 separate short-lived processes, the poller is a different program
in a different language on its own timer, and neither can see the other's request
count. Pacing inside one process does not reserve anything from the other. A
cross-process bucket on disk would, and it is a lot of machinery to coordinate two
jobs that could simply be scheduled apart.

So the fix is to survive the refusal rather than prevent it.

`src/smartlead/http.ts` wraps every SmartLead call:

- **429, every call.** A rate limit is refused before the request is processed, so
  asking again cannot duplicate anything.
- **5xx, reads only.** A 500 after `add-lead` may mean the lead was imported and
  the email is queued. Repeating a GET is free; repeating that POST could mail
  somebody twice, which is the one error this pipeline must not make. Writes get
  429 handling and nothing else.
- **Everything else is returned untouched.** 401, 404, 422, a malformed body: those
  are faults to fix, not waits to sit through.
- **Delays are long on purpose.** The limit is a rolling one-minute window, so a
  1-second retry just spends another request inside the same full window.
  SmartLead's own `Retry-After` first (capped at 60s), otherwise 8s, 20s, 45s, then
  give up and hand the refusal to the caller. Worst case ~73 seconds on a call that
  would otherwise have thrown away a finished, researched, email-verified lead.

Call sites now covered: `addLeadToCampaign`, `getLeadIdByEmail`,
`listCampaignMailboxes`, `listMailboxes`, and the campaign mailbox attach/detach
writes.

**Verified:** `npm run typecheck` and `npm run typecheck:scripts` both clean, all
273 existing tests pass, and 6 new cases in `tests/smartlead-retry.test.ts` drive
each branch against a stubbed `fetch`, so no request left the machine and nothing
was sent.

**Not fixed here:** the campaign-start 429 lives in `automator`, which the autopilot
does not edit. It needs the same treatment, and it is the one that escalated.

## Finding 2: the other 50 refusals, where SmartLead answered 200 and imported nobody

**Instrumented in the same commit. Still unexplained.**

Only 3 of the 53 per-lead refusals were an honest 429. The other **50** came back
HTTP 200, with `total_leads: 0` and none of SmartLead's named reason counters set
(`block_count`, `duplicate_count`, `already_added_to_campaign`,
`invalid_email_count`, `bounce_count`, `unsubscribed_leads`,
`is_lead_limit_exhausted`). `assertLeadAdded` in `push-batch.ts` catches that and
fails the lead, which is right: a lead that was never imported will never be
mailed.

Why SmartLead did it is unknown, and it was **unknowable**, because the response
body was discarded one line after the check read its counters. Fifty leads in a
row logged the words `no reason given`.

Two candidate causes, neither proven:

- **A throttle.** The 50 cluster in the back half of the push, from 10:26 onward,
  interleaved with the proven 429s and with the poller's bursts. Per minute:
  10:26 two, 10:27 eight, 10:28 three, 10:29 three, 10:30 fourteen, 10:33 one,
  10:34 two, 10:35 seven, 10:36 seven. The first seven minutes loaded 24 emails and
  lost one. Suggestive, not conclusive.
- **The duplicate rule.** SmartLead declines a lead already sitting in another
  campaign unless told otherwise. Siege runs one campaign per sending inbox, so a
  lead worked through a second or third offer does collide. The
  `ignoreDuplicateLeadsInOtherCampaign` setting was being dropped before reaching
  the live POST until 10-03, and `already_added_to_campaign` would normally name
  this, but a count SmartLead chooses not to set would look exactly like this.

The fix is instrumentation rather than a guess. `assertLeadAdded` now puts
SmartLead's whole reply into the error when it names no reason, and the `FAIL` log
line was widened from 160 characters to 500 so that reply survives the printing.
The body is SmartLead's own counters, so it carries no address and nothing secret,
and it is capped at 400 characters.

### The duplicate-send risk inside those 50

`push-batch.ts` records the send in Postgres **first**, pushes **second**, and
deletes its own record if the push throws. The ordering is deliberate: a crash
between the two must not lose the record of an email that went out.

If SmartLead actually imported any of those 50 while reporting `total_leads: 0`,
then the record was deleted for an email it will send, the lead stayed at its old
`outreach_status`, and Siege will re-plan it and write to that person again.

**Nothing proves this happened.** It costs one query against the SmartLead campaign
lists to rule out, and it is the money path, so it belongs on the list.

## Finding 3: `partial_push` named a 60-email hole and could not say what made it

**Shipped: `8c50b1d`, youtube-outreach-orchestrator-v1.**

The authoritative snapshot read `binding_constraint: partial_push` and
`unpushed_planned: 60`, and stopped. That label reads as a soft shortfall, a few
leads a writer could not finish. It was covering a rate limit, three batches dead
at their first API call, and seven leads nobody ever attempted. Telling those apart
meant reading `automator/logs/siege.log` by hand and counting, which is the manual
step the 10-03, 10-04 and 10-05 debriefs were each about removing.

`send_plan.push_outcome` now carries the push's own tally:

```json
"push_outcome": {
  "log_found": true,
  "sent": 69,
  "failed": 53,
  "batches_failed_before_first_lead": 4,
  "escalations": 5,
  "reasons": [
    { "reason": "SmartLead did not add the lead (no reason given)", "leads": 50 },
    { "reason": "SmartLead add-lead 429 Too Many Requests on campaign <id>: Account rate limit exceeded. You have exceeded the 200 reques", "leads": 3 }
  ]
}
```

Same rules as the rest of `debrief-data.ts`: filesystem only, no import from
`automator`, a missing or unreadable log degrades to `log_found: false` with nulls
rather than to zeros, only the log tail is read so it cannot get slower every day,
and campaign and lead ids are generalised out of the reason text so 53 identical
refusals count as one row instead of 53.

**Verified** against this cycle's live log: 69 sent, 53 failed, 50 silent and 3
outright 429s, matching the hand count line for line. Six selftest cases added, ALL
PASS, typecheck clean.

One of those cases pins a bug caught during verification. The first run read
**54** failures, not 53. The extra one was `| <channel name> FAIL 236w fails
2->2->2->2`, printed by a batch **writer** for a lead whose copy failed checking.
That lead was never pushed at all, so counting it would have overstated the push's
losses and invented a reason that has nothing to do with SmartLead. Both tallies
now require the `rec...` lead id the push prints after its verdict.

## Finding 4: yesterday's Brave fixes, confirmed, and its cost estimate corrected

**No new code. Recorded because a fix nobody checks is a guess.**

Both halves of `27dbbb246` are working on live data.

| Measure | 10-04 cycle | This cycle |
|---|---|---|
| Leads with no website found | 405 of 600, **67.5%** | 24 of 150, **16%** |
| Brave key refusals | 0, because Brave was never called | 0, out of 78 real searches |
| Brave errors | not counted | 0 |
| Per-pass resolution line | did not exist | printed on all 3 passes |

The three passes read `24 searches, 19 resolved`, `24 searches, 18 resolved` and
`30 searches, 25 resolved`, each with 0 key refusals and 0 errors. Yesterday three
alarms fired and could only record `attributed_to: "unexplained"`.

**The spend estimate in yesterday's report was about five times too high.** It
projected roughly 405 searches a cycle, near $2 a day, by assuming every walked
lead needs a search. Only leads with no site already on file do, which is 24 to 30
of 150. Real cost: **78 searches, under $0.40.** Brave is too small to be a
decision, which retires yesterday's number one recommendation.

**One loose end, small.** In the newest pass the two measures do not reconcile: 24
of 150 leads finished with no website, while that pass's Brave line reports 30
searches of which only 5 came back with social or third-party hits only. They are
counting slightly different populations. It is a question about the instrument, not
a fault in the lane, and one cycle of watching will say which.

## What the zero-growth cycle actually tells us

This is the part worth carrying forward.

For two cycles a quiet recovery lane has been ambiguous. A picked-over book and a
dead website search produce the same silence, and on 10-04 it turned out to be the
dead search. That ambiguity is now gone:

- The search is on, measured, and refusing nothing.
- **126 of 150 leads had a website to work from**, so nine of the thirteen
  collection methods had their input.
- **3 of those 126 produced anything at all.**
- Every lead in the pass was a re-walk, on the **eighth lap** of a 2,524-lead book.
- `collect_book_stranded` held at 3 for the twenty-third day, so no selector gap
  has reopened and nothing is hidden from the cursor.

The free lane is working as designed and the book is empty. That moves the open
question from "why is the lane quiet" to "what refills the bank", which is a
budget and scheduling question rather than an engineering one.

Arithmetic worth stating plainly: **6,965 leads left to write**, drawn down by
roughly 800 a week across four delivery days, with the paid lane out of allowance
until 31 October and the free lane adding between 0 and 2 a day.

## Standing items, unchanged

- **Discovery paused** since 2026-09-08 on Casey's instruction. Thirteenth debrief.
  0 new channels, 0 campaign sessions, flag untouched. The podcast-crossover timer
  fired once and logged its halt message, which is correct behaviour.
- **9 of Siege's 16 offers blocked**, same named reasons for nine debriefs. With
  6,965 leads and 35 live inboxes, message variety is the live ceiling.
- **15 of 66 YouTube keys working**, 50 still exhausted coming out of the midnight
  reset. Settled on 09-16: quota was cut on those projects. Constrained nothing,
  because keyword search is off and the running lanes use 1-unit calls.
- **Enrichment has nothing to do.** 0 batches, 0 leads, at 99.9% bundled
  (7,582 of 7,592). Not a fault.
- **Six debriefs still owed** with grounded metrics on disk: 09-19, 09-18, 09-17,
  08-18, 08-17, 07-11.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00**, 23rd consecutive zero | $0.00 |
| OpenRouter | **$2.39/day**, $106.74 left, **~45 days** | $1.78/day, ~62 days |
| Apify | $0 spent, $10 left, **$0 spendable** until 31 Oct | $0 spent, $0 spendable |
| Brave | **78 searches, under $0.40** | $0, because nothing called it |
| Per recovered lead | not measurable, 0 recovered | not measurable, 1 lead and no spend |
| Per enriched lead | not measurable, 0 enriched | $1.78 on 1 lead |

The OpenRouter day rate rose and the runway fell from 62 days to 45. Both are a
24-hour sample of a pipeline doing almost nothing, so a small absolute change
swings the projection hard. The lead finder's own log accounts for 17 cents and 398
calls to the cheap scoring model. Nothing needs topping up.

## Ranked next

1. **Keep the reply poller out of the push's minute.** Cheapest lever on the board,
   and the only one needing a human, because the poller lives in `automator`. It
   scans 71 campaigns every 2 minutes and found 0 new replies on all nine runs
   inside the push. Lengthen the interval, or stand it down while
   `siege-plan.service` is active. The retries make the push survive the collision;
   they do not stop it costing time.
2. **Read tomorrow's `push_outcome` first.** One block, whole verdict. Empty
   `reasons` means the retries closed it. The 50 still present means SmartLead's own
   reply is now printed beside them and will name the cause.
3. **Check whether any of those 50 leads reached a SmartLead campaign.** One query.
   It is the money path, and a false "not imported" means that person gets written
   to twice.
4. **Decide October's recovery budget.** The $100 Apify allowance bought 472 leads
   at thirteen cents. Doing nothing is a real answer with a sharper price now: this
   cycle proved the free lane cannot slow the drawdown.
5. **Unblock a few Siege offers.** Nine of sixteen, ninth debrief.
6. **Decide the discovery pause.** Thirteenth debrief. The work it funded finished at
   99.9% four days ago, and the lane it left running walked at full strength this
   cycle and recovered nobody.
7. **Give the campaign-start call in `automator` the same 429 handling.** It is the
   one refusal this cycle that escalated, and it is outside the five repos the
   autopilot may edit.
