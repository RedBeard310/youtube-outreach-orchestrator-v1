# Lead run analysis, 2026-11-20

Cycle: 2026-11-20T08:00Z to 2026-11-21T08:00Z (the Pacific day of Friday 2026-11-20).
Companion to [lead-run-2026-11-21.html](lead-run-2026-11-21.html). Every figure comes
from `logs/autopilot-debrief-2026-11-21.json` in the orchestrator repo unless it says
otherwise.

## The one-line version

The send program ran clean and loaded 246 people into a campaign. One of them had never
heard from us before. Forty of the 288 people the plan named got no email, and the biggest
single reason, ten people, was the writer having no offer left to make them. That reason
was in no published field. It is now.

## Headline numbers

| Thing | Reading |
|---|---|
| Emails loaded | 246 (288 planned, 286 approved, 2 held for the next day) |
| People reached for the first time ever | 1 |
| Planned people who got no email | 40 |
| Of those, lost on an earlier day too | 32 (longest streak 10 days) |
| Parked onto the shelf | 0 (pool flat at 7,390) |
| Shelf ready to write | 4,852 |
| Waiting for a sending slot | 1,330 (whale 249, strong7 710, other7 371) |
| Mailboxes clear to send | 35, from 39 |
| New addresses recovered | 8 on 8 people (4 in the whole prior week) |
| Fatal errors | 0, no halt |
| Spend | $0 Anthropic; OpenRouter balance $298.68 at 18 cents a day |

## What the day was

A working day. The send program got through all six of its sequential steps, wrote a plan,
and pushed. That is worth stating because the two days before it did not: 11-19 died on a
missing settings line and 11-18 on a crash in step one. No crash here, no approval wait, no
missing credential. The hourly health check raised nothing all cycle.

So the day is judged on reach, and on reach it looks like its neighbours. People reached for
the first time ever, by Pacific day, oldest first:

```
11-13  2
11-14  0
11-15  0
11-16  1
11-17  3
11-18  4
11-19  0
11-20  1
```

Eleven single-digit days in a row. The weekly-average field reads 0.4% against 21.4%, which
suggests today collapsed off a healthy week; it did not. One big day on 11-09 (210 people)
still sets that denominator, which is why the day-by-day series is the only honest reading.

243 of the 244 people written to were repeat offers. That is deliberate since 2026-10-07 and
is not a fault. It is also the mechanism behind the one-new-person number, and it connects
directly to the day's new finding.

## The loss, diagnosed

The snapshot published `people_lost: 40`, split as 18 refused by SmartLead, 0 declined by us,
1 explained before the push, and **21 `lost_silently`** which means the log said nothing about
them. Seven more people were emailed without the log recording it, which the send-ledger join
correctly credits back.

I classified all 40 by hand against `automator/logs/siege.log` and
`automator/state/siege/2026-11-20/plan.json`. The log explained twelve of the 21:

| Shape in the log | People | Why no counter could read it |
|---|---|---|
| `<id>: <offer> wrote nothing and there is no other offer for them today (every offer that can run has already been made to them)` | 10 | A third pre-push shape nobody had matched |
| `\| [CHANNEL_GONE      ] <channel> -> <id>__<channel>.md` | 2 | The matcher was pinned to the literal word `FAILED` |
| `\| [ALREADY_DONE      ] ...` | 2 | Correctly silent: these leads had a finished bundle and were lost by something else |
| `review` / `ready` job-title verdicts, or no line at all | 7 | Genuinely unexplained |

So the day really reads:

| Reason | People lost | Lines printed |
|---|---|---|
| SmartLead already had a bounce on the address | 12 | 12 |
| **Every offer that can run has already been made to them** | **10** | 10 |
| They had unsubscribed | 3 | 3 |
| **YouTube no longer has their channel** | **2** | 2 |
| No clean job title, so no draft | 1 | 1 |
| Absent from this batch's manifest | 1 | 16 |
| Still unexplained | 9 | none |

The manifest row is the standing lesson about this table: most lines, one person, because 15
of its 16 leads were written again in another batch and sent in the same run.

### Why the ten matter more than the twelve

The twelve bounces are a plumbing problem with a fix already deployed. The ten are a business
wall. Every one of the fourteen offers in the library has already been sent to those people,
so there is nothing left to say to them, and 1,330 people are queued behind them for a slot.
That is the same wall as the one-new-person number seen from the other side: the pool is being
re-offered rather than extended. Either a new offer enters the library or those people leave
the queue. It is Casey's call, and it is now a number on a page rather than a silence.

## Is the loss growing?

No. It is a cohort. 32 of the 40 had been lost on an earlier snapshot day, 8 were new, and the
worst is now on a ten-day streak. `lost_split_complete` is true and the split covered all 40,
so this is the whole picture and not a capped sample (it was truncated on 11-11 and 11-12).

Two pieces of that cohort behave differently:

- **The bounces are healing.** The 11-19 fix (`youtube-email-outreach-v1` `0d6987cc2`) makes
  the push record a bounce on the lead row, setting `email_verification_result = 'invalid'`,
  which is a field the send program's address loader already gates on. I checked three of
  Friday's twelve back out of Postgres: all three now read `email_bounced = true` and
  `invalid`, stamped 2026-11-20. That group should drain from here.
- **The dead channels will not heal.** `recYIzI1wmtvWAfyc` and `recztuJgfiqZFBpQC` still read
  `valid` and not bounced. Their channels are gone from YouTube. The 11-07 dead-channel gate
  in `youtube-email-outreach-v1/src/cli/stage-gate.ts` deliberately "writes nothing, parks
  nothing and changes no status", so it saves the enrichment cost and does not stop the
  planning. The send program's `load_people()` gates on `signal_score_v2`, `review_status`,
  verified addresses and the do-not-contact registry, and a dead channel sets none of those.
  So they take a slot every day forever. The repair is a gate in `automator`, which owns the
  send path and is not this pipeline's to edit.

## Fleet

35 clear, from 39. Four left the clear band and none returned. The band gate ran every hour
with no short readings, so `band_moves_comparable` is true and the arithmetic closes:
39 + 0 back - 4 left = 35. The cycle peak equals yesterday's reading, so there was no
rise-and-fall hidden inside the flat-looking move either.

**12 held mailboxes are healthy** and lift themselves without a config change: 8 waiting out
the 48-hour recovery clock with the nearest 4 hours away, 4 held only because other addresses
on their domain are sick. Capacity returning for free.

At plan time 38 of 124 were live. Of the 86 that sat out, 69 named a SmartLead suspension and
**39 carry it alone**, which is the figure that means real lost slots. The plan wrote 288 slots
against 570 of capacity because 282 is reserved against the 541 people mid-sequence
(`slots_explained` true, so that arithmetic reproduces per mailbox).

## Other lanes

- **Recovery lane**, its own half: 23 contact points, **8 email addresses on 8 people**,
  against 59 points and 4 addresses in the prior week. All 8 addresses came from the
  domain-registration method (`18-rdap`), quiet for most of a month. Lap 19 of a 1,770-lead
  book, 3 stranded. Site resolution healthy: 1 no-site of 150 sampled, 0 search refusals,
  cause `resolution_ok`. 579 of 579 methods found were already on file, which is a complete
  re-walk of a picked-over book and not a fault. Cycle-wide the top fault condition was
  `fetch failed` at 224 of 640 errors (35%), spread 109/85/30 across the three passes.
- **Enrichment chain**: `idling_no_inflow`, not blocked. Correct at 99.8% bundled.
- **Apify email recovery**: `lane_no_work_hours` 215.6, so nine days with no work. The token
  has answered `user-or-token-not-found` since 2026-11-12T10:20Z. $21.06 spendable and the
  allowance expires 11-30. Seventh morning on this. Operator-only, the token is in the
  settings bank.
- **Replies**: 4 people read, 0 agreements (2 not interested, 2 unclear), 0 classifier
  failures. The auto-sender is paused by Casey since 2026-09-17 and that is deliberate.
- **Discovery**: 0 new channels, by Casey's 2026-09-08 order. Every idle sweep is the intended
  state, not an anomaly.
- **YouTube keys**: 15 working of 66. Settled 2026-09-16: quota was cut on 50 projects, so
  more keys do not help those accounts.

## Fix shipped

`youtube-outreach-orchestrator-v1`, `scripts/autopilot/debrief-data.ts`, landed as `2ea45b1`
(the two-minute sync timer committed it before the agent could, which is the known race).

**The reader stopped matching labels.** Both pre-push checks installed on 11-07 were pinned to
the exact wording of the 11-06 log. The research-verdict line is
`[<finalStatus>.toUpperCase().padEnd(18)] <channel> -> <id>__<channel>.md`, built in
`youtube-email-outreach-v1/src/cli/outreach.ts`, and a dead-channel lead stopped reporting
`failed` once it got a `channel_gone` status of its own. One word moved and the matcher went
blind on the very lead the old comment cites by id. That is the 2026-10-12 lesson, a key pinned
to a token that changes, inside the field built to end a mystery.

The status is now read off the line and judged against a deny list of the four statuses that
mean the lead is fine (`sent_to_smartlead`, `already_done`, `find_only_complete`,
`stopped_early`). A status nobody has seen earns a row naming itself rather than vanishing,
which is safe because the claim only ever applies to people the join already found lost, so it
can never invent a loss. The next relabelling cannot blind it.

The second half reads the offer-exhaustion line, matching only the terminal wording. The same
writer prints `wrote nothing; trying <other> instead` while it still has an offer to try, and
that person is not lost yet.

Verified by re-running the fixed reader against the real 11-20 log and plan:
`lost_before_push` 1 to 13, `lost_silently` 21 to 9, and the reasons table now ranks offer
exhaustion at 10 people, second only to the bounces. Four new self-test assertions, full suite
passing, `npm run typecheck` clean.

## Ranked next levers

1. **Decide what to say to the people we have run out of things to say to.** Ten lost a slot
   on Friday to an exhausted offer library with 1,330 queued behind them. A new offer, or
   those people leave the queue. Casey's call.
2. **Stop planning the two dead channels.** A gate in `automator`'s `load_people()`, the same
   shape as the bounce fix that demonstrably worked. Not this pipeline's to edit.
3. **Replace the Apify token.** Seventh morning, 215 hours of no work, $21.06 expires 11-30.
   Operator-only.
4. **Leave the fleet alone today.** Four left the clear band, 12 held mailboxes are healthy
   with the nearest 4 hours from lifting itself. Read Monday's plan first.

## What was verified rather than assumed

- All 40 lost people classified individually against the real send log and plan file.
- The corrected 12-and-9 split produced by re-running the fixed reader over that log, not
  projected. The published snapshot still carries the old 1-and-21 split because it was
  written before the fix.
- The 11-19 bounce fix confirmed working by reading three of Friday's bounced leads back out
  of Postgres.
- The dead-channel gap confirmed by reading `load_people()` and `load_addresses()` in
  `automator/scripts/siege-plan.py` and the two leads' rows, so "nothing marks them" is a
  read and not an inference.
- The fleet move arithmetic closes with `band_moves_comparable` true, so the 39 to 35 is a
  real move and not a partial reading.
