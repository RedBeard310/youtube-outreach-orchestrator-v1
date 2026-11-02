# Lead Run Analysis — 2026-11-02

Cycle: 2026-11-01T08:00:00Z to 2026-11-02T08:00:00Z (the 24h ending at midnight PT, so all
of Sunday 1 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-02.json`.
Companion to [lead-run-2026-11-02.html](lead-run-2026-11-02.html).

## Headline

**288 people parked in `approved_hold`, a new record, and 343 leads enriched with nothing
failing.** The pool went 7,077 to 7,365 and the shelf of people ready to write reached 5,684
at 99.8% bundled.

Then the paid lane finished its book. From 20:20Z onward it answered *no qualified lead
without an email that this lane has not already tried* on six consecutive ticks across twelve
hours, with **$31.34 of November's allowance unspent and $21.34 spendable**.

**The wall stopped being money.** It is supply now, and supply is not buyable.

## Where the 288 came from

Six batches scraping already-known channels for the business email YouTube publishes on the
channel page, then ZeroBounce verifying it:

| Batch (UTC) | Channels | Addresses | Parked | Cost per recovered |
|---|---|---|---|---|
| 08:20Z | 100 | 74 | 49 | $0.143 |
| 10:22Z | 100 | 76 | 50 | $0.140 |
| 12:22Z | 100 | 64 | 50 | $0.140 |
| 14:20Z | 100 | 70 | 45 | $0.156 |
| 16:20Z | 100 | 71 | 55 | $0.128 |
| 18:20Z | 78 | 49 | 37 | $0.148 |
| **total** | **578** | **404** | **286** | **$0.142 avg** |

Spend: **$40.58**. The free half of the lane found the other **2**, which makes 288, exactly
what the lead table gained. Two independent instruments agreeing matters here, because a shelf
drop and a park are easy to confuse (the 10-13 ICP audit).

**The sixth batch is the tell.** It asked for 100 channels and could only fill 78, charging
$5.48 instead of $7.02. That is the bottom of a book. Two hours later the next tick found zero.

Cost per person climbed **$0.112 to $0.142**, the thinning the 11-01 debrief predicted. It got
the mechanism wrong: it expected the lane's own price brake to stop things (two batches above
$0.20 halts it for the month). The brake never fired, `price_strikes` is still 0, and the lane
ran out of candidates first.

### The free lane is picked over, not broken

Lap **13** of an 1,813-lead book, `stranded` flat at 3 so no selector gap:

- methods found **432** contact points, of which **428** were already on file
- **0** Brave refusals across 60 searches, so nothing was refused for want of credit
- the strict ownership gate threw out **47 of the 50** candidate sites found, `cause: resolution_ok`
- `no_site_pct` read 38%, up from 1.3%, with zero refusals: a thin slice, not a dead search plan

Paid beat free **143 to 1** on the same day. Nobody should buy Brave credit or widen the collect
batch on the strength of this.

## The finding: a projection with no supply term

This is what the cycle is actually about, and it contradicts yesterday's top recommendation.

**The 11-01 debrief said to put $60 on OpenRouter because November's remaining Apify allowance
was projected to deliver about 614 more people.** That figure was dollars divided by a price per
channel, multiplied by a measured recovery rate. It had no term for whether anybody was left to
look up.

Nobody was. The published projection read `channels_affordable: 303, projected_leads: 150` on a
morning when the lane had been idle for twelve hours, and the hourly runway alarm quoted it to
argue that lane "will keep parking people this one cannot turn into anything writable", about a
lane that had stopped parking anybody.

The reason it was invisible: a tick that scrapes nothing still writes a run log, and
`apifyBatchFacts()` returns null for it. So the six idle ticks counted as no batch, and nothing
published anywhere distinguished *stopped for want of candidates* from *stopped for want of
money*. Those are opposite decisions and only one of them is answered by buying allowance.

Fixed below. The honest projection from that allowance is **0 more people** until new leads
arrive.

### The lane is finished, not dead

At **08:20Z this morning**, twenty minutes after the cycle closed, a batch found **2** new
channels and parked both at $0.070 each. So the lane now lives on new arrivals.

With channel discovery paused since 2026-09-08, the only producer of arrivals is the weekly
sweep that re-scores channels crossing 3,000 subscribers. It ran at 06:48Z inside this cycle,
restamped **36,208 rows** across 151 clusters, and moved the `below_threshold` population by
**42**. That is the whole inbound supply right now.

## The money, re-sized

OpenRouter is at **$17.96** and the account spent **$24.17** over 25 hours, which reads as
**0.7 days of runway**. The alarm that shipped yesterday fired at 08:11Z reading 1.1 days.

Before treating that as urgent, look at what the $24 bought:

| | Yesterday's reading | This cycle |
|---|---|---|
| Leads enriched | 193 | **343** |
| Account spend | $15.77 | **$24.17** |
| Cost per enriched lead | $0.082 | **$0.064** |
| Balance | $43.14 | **$17.96** |

343 leads at $0.064 is about **$22** of the $24. **The burn was the record night**, and it does
not continue on its own: the pool is now **99.8% bundled**, so roughly 15 of 7,365 parked people
still need enriching. At $0.064 each, $17.96 buys about **280 more people**, and the lane can
supply a handful a day.

So the credit lasts weeks, not hours. Yesterday's $60 ask was sized for leads that are not
coming. This becomes urgent again the moment supply restarts, and the alarm will say so.

**One caveat on the alarm, deliberately left alone.** It quotes a burn rate up to a day old, so
it read 1.1 days off yesterday's $15.77 while the fresh reading is 0.7 days. The gap is
optimistic, which is the wrong direction for a warning. It is by design: the alarm reuses the
debrief's measured rate rather than sampling itself, because an hourly sample would hand the
debrief a six-hour spend labelled as a cycle and understate the per-lead cost by four, which is
the multiplier the whole budget projection runs on. The tier was right and the error is small.
Worth revisiting only if a burn rate jumps like this again.

## The fleet doubled

The biggest change in the snapshot, and nothing in the published fields flags it as new.

InboxKit now reports **118 warmup mailboxes, all 118 of them SmartLead sending accounts**, where
it reported 58 all last week. **64 mailboxes were handed a band on or after 11-01 and 58 of them
landed clear.** Mailboxes clear to send went **12 to 67**; watch went 0 to 6; stop held at 45.

They are not day-zero inboxes. Each carries **32 to 34 warmup emails**, so they are past the
fourteen-day warmup bar that pauses young mailboxes, and they sit three to a domain across a
dozen new domains.

On paper that is roughly five times the sending capacity, arriving the day before the first
sending day since two consecutive zero-email weekdays.

**The risk is specific.** On 10-29 every mailbox in Siege's plan came back with `campaign_id:
null` and the reason "no Siege campaign yet", because `list_campaigns()` returns `[]` for any
failed SmartLead read with no retry and no error, and 62 approved people got no email. A mailbox
that genuinely has no campaign attached yet picks up the same reason. Fifty-eight mailboxes
nobody has planned with before is the highest-risk case for both shapes at once, and they are
indistinguishable in the plan. Read `inboxes_only_no_campaign` on Monday.

**Neither send-path repair has shipped.** Read directly out of `automator/scripts/` this morning
rather than inferred from the commit log:

- `siege-plan.py` `why_no_email()` still does `"; ".join(row.get("fails") or [])` with no
  coercion. That is the TypeError that killed Friday 10-30, costing 69 planned people their
  email, from a function whose only job is to write a human-readable sentence into a sample
  report.
- `smartlead_api.py` `list_campaigns()` still returns `[]` on any non-list, non-dict response,
  while `list_accounts()` directly below it is guarded.

Both live in `automator`, which this loop may not edit.

## What else the cycle did

**No email sent, correctly.** `binding_constraint: not_a_sending_day`. Sunday, and the snapshot
names it rather than inventing a fault. The `unit_state: failed` beside it is Friday 10-30's
crash, two days back, and does not block the next timer firing.

**The enrichment chain had its best day of the series:** 10 batches, 343 leads, **0 failures**,
no transcript gate holds at all. Two days ago three batches failed on one lead because a
cancelled provider's exhausted plan was treated as fatal. Yesterday's two fixes both held.

**Quiet elsewhere.** $0 Anthropic spend, no fatal signatures, no halt flag. The stranded cohort
holds at 4 people marked sent who were never emailed, down from 54 on 10-28. Discovery stayed at
zero, which is Casey's standing instruction. The YouTube key pool reads 15 working of 66,
expected and irrelevant while discovery is off.

## Shipped this cycle

**A paid lane with money left and no candidates left stops projecting leads** (orchestrator
`4e93f53`).

`apifyIdleCause()` separates the batch script's `no_candidates` refusal from the loop's budget
`resting`, which the allowance fields already describe. The snapshot gains
`candidate_pool_dry`, `candidate_dry_streak`, `candidate_dry_since` and
`idle_batches_in_cycle`; when the pool is dry the projection reports **0 leads** and
`binding_constraint: candidate_supply`.

Three decisions worth recording:

1. **0, not null.** A dry pool is measured, because the lane said so itself on its newest tick.
   Null would re-open the hole where unknown reads as a long runway.
2. **One real scrape resets the streak,** so this morning's 2-channel batch correctly clears it
   and a single trickle arrival cannot leave a twelve-hour streak standing behind it. The streak
   count is what separates a flicker from a finished book.
3. **An unrecognised log shape stays null** and never reads as dry, which would zero the
   projection on a healthy lane. That is the opposite of the fault being fixed.

The alarm needed no change: it reads the snapshot's projection, so a $0 projected cost drops the
false clause by itself.

Verified against the live logs: dry, streak 6, since 2026-11-01T20:20:54Z as of the 08:20:01Z
debrief, and correctly not dry after the 08:20:49Z batch scraped 2. 11 new assertions, all
selftests pass, typecheck clean.

## Ranked levers

1. **Decide about supply, because money can no longer buy leads.** The paid lane has tried
   every qualified lead it has, $21.34 sits unspendable, and the only feed is a weekly sweep
   that moved 42 rows. Two ways forward: lift the discovery pause (Casey's call alone, on since
   2026-09-08), or accept the recovery lane is done for November and live off the 5,684 people
   on the shelf. That shelf is about seven weeks of sending at 200 a day.
2. **Watch Monday's plan for mailboxes with no campaign.** Clear capacity went 12 to 67, the
   first real chance to send at volume in two weeks. Read `inboxes_only_no_campaign`. A large
   number is either SmartLead's campaign read failing again (a code fix) or 58 mailboxes
   genuinely needing a campaign attached (five minutes of setup), and the two look identical.
3. **Ship the two automator repairs.** Both unchanged since Friday. Coerce the non-string
   entries before the join in `why_no_email()`, guard the empty campaign list in
   `list_campaigns()`, and stop the sample and report steps being able to block the push. Two
   unrelated faults in 48 hours says the next one will be unrelated too, and all three cost a
   whole sending day.
4. **Don't buy OpenRouter credit yet.** The $24-a-day burn was the record night and stops with
   it. 99.8% of the pool is bundled, about 15 people still need enriching, and $17.96 covers
   roughly 280 at the measured $0.064. Revisit the moment supply restarts.

## Grounding and caveats

Numbers from `logs/autopilot-debrief-2026-11-02.json`, except: the per-batch figures and the six
idle ticks (the `apify-endspec-*.log` run logs in youtube-email-outreach-v1), the fleet readings
(`automator/logs/inbox-health.log` and `state/inbox-health.json`), and the two unshipped repairs,
read out of `automator/scripts/` directly rather than inferred from the commit log.

**One measurement gap.** The clocks went back inside this cycle, so the window moved from 07:00Z
to 08:00Z and the hour from 2026-11-01T07:00Z to 08:00Z belongs to neither this debrief nor
yesterday's. No Apify batch and no verify pass ran in it, so nothing measurable was lost, but a
future DST boundary could drop a real batch into that seam.

**Not verified:** whether the 58 new mailboxes have campaigns attached, which only Monday's plan
answers; whether the arrival trickle stays as thin as 2 a day; and whether the 288 record holds
as the high-water mark, which depends entirely on lever 1.
