# Lead Run Analysis — 2026-11-09

Cycle: 2026-11-08T08:00:00Z to 2026-11-09T08:00:00Z (the 24h ending at midnight PT, so all
of Sunday 8 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-09.json`.
Companion to [lead-run-2026-11-09.html](lead-run-2026-11-09.html).

## Headline

**The fleet walks into Monday with 54 mailboxes in the clear band, its best reading since
11-04, and all nine that came back are still clear.** 48 to 54 across the cycle, nine moved
to clear, three to watch, nothing stopped, and no mailbox did a round trip. That is the
opposite of 10-27, when six came back and five were re-stopped inside hours.

**Two people were parked, both found by the free recovery lane.** `approved_hold` 7,376 to
7,378 and the shelf 5,052 to 5,054. `28-sitemap` found two addresses and `18-rdap` one, one
person each.

**No email went out, and that is the schedule.** Sunday. Siege's timer is Monday to Friday,
`sending_day` is false and `binding_constraint` reads `not_a_sending_day`. There is no plan
on disk, so nothing about what the fleet can actually send was measured today.

**The fix shipped yesterday for the recovery lane's biggest fault has followed exactly one
redirect, and the snapshot made it look like it was working.** The field a reader checks went
from 83 of 150 method faults (55%) to 33 of 121 (27%) overnight, which reads as the fix
converting by half. It is an artefact. That field describes ONE collect pass and the cycle
ran FOUR, all four of them with the fix already deployed, and across them the condition was
**237 of 575 errors, 41%**. Both fixes below come out of this.

**OpenRouter has 3.9 days of credit, Monday is a sending day, and the cold-email writer runs
on that account.** Balance $6.19, down from $7.77. This was yesterday's number-one item and
it is now one day shorter.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Parked into `approved_hold` | **2** | 4 on 11-08, 0 on 11-06 and 11-07 |
| Free lane contact points | **18** | 64, about 9 a day |
| Free lane addresses | **3** | 22, about 3 a day |
| Free lane people with a new address | **2** | — |
| Paid Apify batches | 0 | 0 since 11-02 |
| Enrichment leads done | 3 | 3 on 11-08, 343 on 11-02 |
| Emails sent | **0** | 0 Saturday, 92 Friday, 199 Thursday |

Read the `free_*` figures, not the totals: the totals also carry the paid Apify lane, which
writes into the same table and has found nobody since 11-02. On that basis this was an
ordinary free day, slightly above its own weekly rate on points and exactly on it for
addresses.

The shelf agrees with itself to the person. `ready_to_write` 5,052 to **5,054**, up exactly
the 2 parked, with nobody emailed to draw it down. People with a real send row held flat at
**2,310**, and `marked_sent_never_emailed` is still **1**, `recPSkSNP2HeR6CCV`, unchanged.

### Which methods paid

| Method | Addresses | People |
|---|---|---|
| `28-sitemap` | 2 | 1 |
| `18-rdap` | 1 | 1 |

`16-jsonld` found 8 points on 1 lead, `02-subpages` 4 on 3 and `34-channel-page` 3 on 3, and
not one of those was an address. Three methods are quiet: `04-holehe` (82 days),
`19-github` (22), `26-instagram` (18).

### The paid lane is still out of people, and money still does not fix it

Dry on **83 consecutive ticks** since 2026-11-02T10:22:57Z, 12 idle batches this cycle,
`$31.20` of November's allowance unspent and `$21.20` spendable. `projected_leads` is a
measured **0** and `binding_constraint` reads `candidate_supply`. The allowance runs to
11-30. The lane restarts only on new arrivals.

## The snapshot was reporting a quarter of the lane's day and calling it the day

This is the cycle's real finding, and it cost yesterday's number-five lever.

The recovery lane collects every six hours. It ran **four passes of 150 leads** this cycle,
at 11:01Z, 18:00Z, 00:01Z and 07:00Z, which is **600 lead-walks**. Every method-fault figure
published in `site_resolution` is read off `passes[passes.length - 1]`, the newest pass
alone, and is published under the cycle's date.

| Pass | Method errors | `cross-domain redirect` |
|---|---|---|
| 11:01Z | 209 | 44 |
| 18:00Z | 114 | 85 |
| 00:01Z | 131 | 75 |
| 07:00Z (the one published) | 121 | **33** |
| **Cycle** | **575** | **237, 41%** |

The published figure was the smallest of the four. The condition swings two-fold from pass to
pass because it depends on which slice of the book the cursor is sitting on, so **no single
pass can carry a day-over-day comparison at all**. That is the 2026-10-16 lesson (two
instruments read at different hours) and the 11-08 one (moves and a change spanning different
windows) sitting in the one block a reader opens to decide what to fix in the only lane still
parking anybody.

**The single-pass window also hid a whole fault.** `19-github: The operation was aborted due
to timeout` was **62 errors, 30% of the 11:01Z pass**, and it appears in no published field,
in a cycle where `19-github` is already one of the three methods that has produced nothing
for three weeks.

### So the redirect fix did not convert

Yesterday's commit (`09a5d097b` in the email repo) lets the lane follow a creator's own
website through a redirect when the destination reads like them. All four of this cycle's
passes ran with it deployed, and across the whole collect log it has followed **one** hop:
`https://www.satyahairsolutions.com/ -> https://satyahairsolution.com/`, a creator whose two
domains differ by one letter. Meanwhile the cases the 11-08 debrief named by hand are still
being refused: `ltrp.xyz -> linguatrip.com` still logs as a cross-domain-redirect fault.

The gate asks two things of a destination: the domain has to read like the creator's name,
and the rendered page has to name them. The plausible reading is that a creator's branded
shortener usually points at their **company**, whose name is not their channel name, so the
first test refuses it. Which of the two tests does the refusing was **not** isolated per
lead, so that is a measurement to take rather than a conclusion.

### The re-walk, measured over the whole cycle

2,218 method hits across 600 lead-walks, and **2,200 of them were already on file (99.2%)**.
18 points, 8 leads, 3 addresses, 2 people with a first usable address, 2 parked. The lane is
on **lap 15** of a 1,796-lead book. That is a picked-over book, not a fault, and `stranded`
is 3 and flat, so no selector gap has reopened.

### Website resolution is healthy, and the ownership gate is the bigger lever

On the newest pass (one of four, so read it as a sample): 45 of 150 leads had no site on file
(30%), **zero** Brave refusals and zero Brave errors, `cause` is `resolution_ok`. **No reason
to buy Brave credit.**

What the same pass says underneath is larger than the redirect. Brave ran 48 searches and
returned a candidate site for **42** of them, and the ownership gate accepted **3**. It
refused **39**, 93%. Those 39 leads end the pass with no website, and nine of the lane's
thirteen methods start from one. That is roughly **a quarter of the pass** against the
redirect's tenth, and it is the same kind of decision: how much evidence ties a site to a
creator. The 2026-10-10 note already established that this shape is not buyable.

## The fleet, as far as a Sunday can read it

No plan on disk, so `live_inboxes`, `mailbox_slots` and Friday's sole-reason rows are all
null. Only the band gate ran, 25 hourly readings.

| | 11-08 08:05Z | 11-09 08:05Z |
|---|---|---|
| clear (`band_normal`) | 48 | **54** |
| watch | 12 | 9 |
| stop | 34 | 31 |

`band_delta_comparable` is true at 24.0h apart. The clear band climbed 48 to 51 at 09:06Z to
52 at 10:06Z to a **peak of 54 at 12:05Z**, held 53 through the afternoon and evening, eased
to 52 overnight, and returned to 54 at the 08:05Z reading. Nine mailboxes moved to clear,
three to watch, **nothing was stopped, and no mailbox did a round trip.** All nine returners
hold the clear band at the final reading.

`band_held_but_healthy` is **7**: six waiting out the 48-hour clean clock with the closest due
in **4 hours**, one held only because a sibling on its domain is sick. So about seven more
mailboxes return for free. The older warmup gate in the email repo paused **2** on health and
resumed none, 99 lifetime.

**54 clear is not 54 able to send.** The band gate bands on health; the warmup floor and
SmartLead's own suspensions are separate instruments, and reading one as the other is the
11-03 lesson. Friday's plan read 12 live inboxes against 77 suspended in SmartLead and 36 on
"warmup day 12, and the floor is day 14". That floor clears Sunday 11-08, so those 36 can
first carry an email **today**, and Monday's plan is the first readable measure of capacity in
three days.

## Money and quiet

- **OpenRouter: balance $6.19, 3.9 days of runway.** Account burn $1.58 a day and flat
  whatever the pipeline does. The finder's own log accounts for $0.20 of it across 450
  `qwen3.7-flash` calls; three enriched leads at the measured $0.110 each account for about
  $0.33. What spends the rest was not established, same as yesterday.
- Anthropic: **$0**, against a $75 soft ceiling.
- **0 fatal error signatures, no halt flag, no escalations.**
- YouTube key pool: 15 working of 66 probed, 50 still quota-exhausted after the midnight
  reset. Settled since 2026-09-16, and irrelevant while discovery is off.
- Discovery: **0 new channels**, Casey's standing order of 2026-09-08. Every sweep idle by
  design, the campaign block all zeros.
- A `below_threshold` sweep rewrote **35,380 rows in 153 seconds** at 06:40Z, 147 clusters.
  The population moved 130,009 to 129,964, a net **45**, and `moved` reads `restamp` with
  **0** of them already emailed. That is the weekly 3,000-subscriber floor sweep re-stamping,
  not a demotion.
- **The session-start send fired four leads at 08:20:32Z**, twenty minutes after the cycle
  closed, and all four reached SmartLead: Sai CPA Services, WA Building Guide, Southern
  California Apartment Group, Longyu Machinery Manufacturer. They land in tomorrow's numbers,
  and they are sending that did not come from Siege.

## Fixes shipped this cycle

**`cdb6e4e` (orchestrator) — the recovery lane's fault figures describe the whole cycle, not
one of its four passes.**

`aggregateCollectPasses()` in `src/recovery/bloodhound-lane.ts` sums every pass inside the
cycle, and `site_resolution.cycle` publishes it. The per-pass fields are untouched on
purpose: the hourly alarm reads them, a pass is the right unit for "is the lane working right
now", and the new `newest_pass_error_share_pct` says how much of the cycle they cover. It
read **21%** this morning.

`top_fault_condition_by_pass` carries the same condition in each pass, oldest first, so two
passes disagreeing is visible instead of invisible. `passes_dispatched` is what the lane's own
dispatch log recorded in the window and `passes_measured` is how many of those the collect
log could supply, so a pass that died or ran under the 30-lead floor shows as a gap between
the two rather than silently shrinking the window. `methods_found` and `already_on_file` are
null unless every measured pass carried the line, because a partial sum understates a re-walk
without saying so.

Verified: typecheck clean, 340 selftest assertions pass with 11 new ones built on the real
pass shapes, and run against the live log it returns 4 passes, 600 leads, 2,218 found against
2,200 on file, 575 errors, `cross-domain redirect` 237 at 41%, by-pass 44, 85, 75, 33, and the
newest pass holding 21% of the cycle.

**`05f2dab` (orchestrator) — the band moves end at the reading `band_normal` comes from, so
the subtraction closes every day.**

Yesterday's fix closed the start of that span and left the end open, and the gap is
structural rather than occasional. The gate runs hourly at about :05 and the debrief fires at
00:20 PT, so the run `band_normal` is read off is **always** the 08:05Z one, five minutes past
the cycle end, while the moves stopped at 08:00Z. On 11-08 that run moved nobody and the
arithmetic closed by luck. This morning it moved two mailboxes back to clear, and the
published figures were 48 + 7 − 3 = 52 beside a `band_normal` of **54**.

The move walk and `band_peak_normal` now both run to the newest reading inclusive, which is
exactly the span `band_normal_change` describes. The peak comes along for a second reason: one
that stopped at the boundary could print below the `band_normal` published next to it.

Verified: typecheck clean, 340 assertions pass with 3 new ones on the real 11-08/11-09 gate
history, and re-run against the live state file it returns 9 to clear, 3 to watch, 0 to stop,
peak 54, nine named returners all still clear, and 48 + 9 − 3 = 54.

## Still open

- **OpenRouter runway, 3.9 days.** Carried from yesterday, one day shorter, and today is a
  sending day.
- **Which half of the redirect gate refuses the rest.** New. The fix is live and has followed
  one hop in four passes.
- **The ownership gate refusing 93% of Brave's website guesses**, 39 leads of 150 on the
  newest pass. Bigger than the redirect and the same kind of decision.
- **Why SmartLead suspends whole domains.** Carried unchanged, not re-measurable on a Sunday.
- **Why nine mailboxes are failing SMTP or IMAP** on `tubegrowthagency.com`,
  `ytgrowthagency.com` and `contentgetsleads.com`. Carried.
- **The five bounce refusals.** Five people with a bounce already on SmartLead's file are
  planned, written to and refused every sending day. Lives in `automator`.
- **One writer-blocked person**, `recYZCjHSZnKslfkq`.
- **`recPSkSNP2HeR6CCV`** is still stamped as sent and has never been emailed.
- **The two `automator` repairs, now ten days unshipped**: `why_no_email()` joining its `fails`
  list with no coercion, and `list_campaigns()` returning `[]` on any failed SmartLead read
  while `list_accounts()` below it is guarded. Not re-read this morning.
- **`19-github` costs 62 timeouts a pass and has produced nothing in 22 days**, 18 points in
  its life. Give it a timeout or retire it.

## Ranked levers

1. **Put $10 to $20 on OpenRouter today.** Balance $6.19, 3.9 days, today is a sending day and
   the cold-email writer runs on that account. A dry balance does not announce itself: the
   2026-09-14 lesson is that a 402 shows up as exit 0 and done 0. Cheapest item on this list
   and the only one with a date on it.
2. **Read today's plan for what the fleet can actually send, and do not read 54 clear as the
   answer.** The band gate bands on health; the 36 mailboxes on Friday's warmup floor clear
   today and are worth roughly 540 messages a day, and two days without sending means the
   follow-ups owed today will be the highest of the run. Today's plan is the first readable
   capacity measure since Friday.
3. **Measure which half of the redirect gate refuses a creator's own site.** Either the
   evidence rule loosens for a destination the creator's own declared link points at, which is
   Casey's ownership call, or the condition stops being named as the lane's biggest fault. It
   is currently both deployed and inert.
4. **Then decide the same question about Brave's website guesses.** The gate refuses 93% of
   them, which leaves roughly a quarter of each pass with no website and so no access to nine
   of thirteen methods. Larger than the redirect, and not a money problem.
5. **Find out why SmartLead suspends whole domains.** Unchanged and still the largest block on
   Friday's reading, with every one arriving as a complete domain.
6. **Fix SMTP or IMAP on the three domains before un-suspending anything there.** Nine
   mailboxes would come off suspension and still not send.
7. **Stop planning the five bounced people**, and ship the two `automator` repairs. Ten days
   now, and each has already cost a whole sending day.
