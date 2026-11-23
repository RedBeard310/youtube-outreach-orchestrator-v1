# Lead run analysis, 2026-11-22

Cycle: 2026-11-22T08:00Z to 2026-11-23T08:00Z (the Pacific day of Sunday 2026-11-22).
Companion to [lead-run-2026-11-23.html](lead-run-2026-11-23.html). Every figure comes
from `logs/autopilot-debrief-2026-11-23.json` in the orchestrator repo unless it says
otherwise.

## The one-line version

A Sunday, so nothing was sent and that is correct. At 14:05 UTC the warmup service the
inbox health gate reads went from returning 94 subscriptions to returning 28 and stayed
there for nineteen hourly runs. The gate only bands mailboxes it has a warmup record for,
so 66 mailboxes left the count, and this morning's report published clear down 24 and
stopped down 40 as if most of a suspended fleet had recovered overnight. Nothing recovered.
Underneath it, 67 of the 72 mailboxes the gate suspended in its own name are now outside
the roster it can read, and the code that issues resumes walks that roster, so no run of it
will ever release them.

## Headline numbers

| Thing | Reading |
|---|---|
| Emails loaded | 0 (no plan written; the send timer is Mon-Fri) |
| People reached for the first time ever | 0 |
| Parked onto the shelf | 1 (pool 7,390 to 7,391) |
| Shelf ready to write | 4,853 (7,379 bundled, 99.8%; 2,525 really emailed) |
| Mailboxes the gate banded | 28, against 94 the morning before |
| Bands | 19 clear, 3 watch, 6 stopped (not comparable to 43 / 5 / 46) |
| Gate-owned suspensions it cannot reach | 67 of 72 |
| Recovery lane, its own half | 1 contact point, 0 email addresses, 1 person |
| Same, prior 7 days | 85 points, 13 email addresses |
| Collect passes | 4, covering 578 lead-slots, lap 20 of a 1,771-lead book |
| Site resolution, newest pass | 120 no-site of 128; cause `ownership_gate` |
| Method errors | 427 across the cycle; 1,226 of 1,227 findings already on file |
| Replies read | 2 people, 0 a yes, 0 classifier failures |
| Apify email recovery | 263.6h with no work, 401 bad token since 2026-11-19 |
| Fatal errors | 0, no halt |
| Spend | $0 Anthropic; OpenRouter balance $298.11 at 43 cents a day |

## What the day was

A Sunday. `siege-plan.timer` is Monday to Friday, so no plan exists, nobody was emailed,
and the snapshot names the cause itself (`binding_constraint: not_a_sending_day`). A zero
in the send column needs no further explanation and is not a shortfall.

Everything mechanical was clean. Zero fatal signatures, no halt flag, $0 of Anthropic
spend, nine reply-reader runs with no classifier failures, and the enrichment chain
correctly reporting `idling_no_inflow` against a pool that is 99.8% bundled.

People reached for the first time ever, by Pacific day, oldest first:

```
11-15  0
11-16  1
11-17  3
11-18  4
11-19  0
11-20  1
11-21  0
11-22  0   <- this cycle, a Sunday
```

Two weekend zeros are by design. The weekday series in front of them is the slide, and it
is unchanged from yesterday's reading.

The weekly floor sweep ran at 06:49 to 06:52 UTC: 34,835 rows restamped `below_threshold`
across 145 batches, population 129,928 to 129,897. That is the 3,000-subscriber graduate
check doing its weekly pass and re-stamping everybody who still fails it, not a demotion
event. It produced nobody sendable, which is the same answer it gave on 11-16.

## The fleet: an instrument that halved, reported as a fleet that improved

### What the log says

`automator/logs/inbox-health.log`, the gate's own line, once an hour:

```
[2026-11-22T13:05:18Z] InboxKit: 94 warmup subscriptions, 94 of them SmartLead sending accounts (30 SmartLead accounts have no warmup record)
[2026-11-22T14:05:07Z] InboxKit: 28 warmup subscriptions, 28 of them SmartLead sending accounts (96 SmartLead accounts have no warmup record)
...
[2026-11-23T08:05:07Z] InboxKit: 28 warmup subscriptions, 28 of them SmartLead sending accounts (96 SmartLead accounts have no warmup record)
```

Nineteen consecutive runs at 28. The gate builds its judgements from the warmup readings
alone, so a mailbox with no reading gets no band. The band counts this morning cover 28
mailboxes; yesterday's covered 94.

### Why the published change figures were wrong

The snapshot subtracted them anyway:

| Field | Reading |
|---|---|
| `band_normal` | 19, from `band_normal_prev` 43 |
| `band_stop` | 6, from `band_stop_prev` 46 |
| `band_normal_change` | -24 |
| `band_stop_change` | -40 |
| `band_delta_comparable` | true |

Read straight, that says 40 mailboxes came off suspension on the night before a sending
Monday. Not one did. They left the instrument while staying exactly as suspended as they
already were.

This is the 2026-10-16 lesson (two readings taken of two different things are not a move)
in the one block that is supposed to be immune to it, because both readings come from the
same gate. They do, and they still cover different fleets.

### Why the existing guard could not catch it

`band_moves_comparable` shipped on 2026-11-10 for a short read, and that day the roster
came back an hour later. It marks a run that read fewer mailboxes than the run before it.
A roster that drops and stays down is short exactly once. This cycle it caught the 14:05Z
run and reported `band_moves_comparable: false`, which is correct but covers only the move
counts. The two change figures were never in its scope at all, and tomorrow, with the
step-down aged out of the window, the whole thing goes quiet with a 28-mailbox fleet
reading as steady.

### The part that costs capacity

The gate keeps a ledger, `owned`, of mailboxes it suspended in its own name, so it knows
which ones are its to release. Counted from `automator/state/inbox-health.json`:

```
owned                                   72
roster (state.mailboxes)                28
owned and still in the roster            5   (all 5 banded stop)
owned and NOT in the roster             67
```

`actions()` in `automator/scripts/inbox_health.py` iterates `records`, which is built from
the warmup readings. A mailbox that is not in `records` can never produce a `resume`
entry. So those 67 are suspended in SmartLead, by this gate, with nothing watching them
and no clock running out. Either the warmup records come back, which fixes it for free, or
the resume path has to handle a mailbox it owns and cannot read. That code is in automator,
which owns the send path and is not this repo's to edit.

### What the drop looks like

Counted from the same state file, the 67 are domain-shaped: nineteen sending domains lost
all three of their mailboxes at the same moment (`ytgetsclients.com`, `videoleadsagency.com`,
`youtubegetsclients.com`, `ytleadsagency.com` and fifteen more), with about ten singles
alongside. The fetch asks for live subscriptions only (`include_cancelled: false`), so a
cancelled or lapsed subscription stops being returned and nothing raises an error.

That pattern reads like a plan or billing event at the warmup provider rather than a flaky
read. **It is not established here.** This file cannot see the provider's account, and the
separate warmup snapshot that could corroborate it (`automator/state/inbox-warmup.json`)
still holds all 94 as active but was last written on 2026-11-20, before the drop, because
its sync is Mon-Fri and it was the step that failed on 11-19.

### What to expect in Monday's plan

Siege's plan already carries a per-mailbox reason for a mailbox missing from the warmup
list: its age is unknown. Expect that row to jump in this morning's plan, which was written
after this cycle closed. Read its `only` count and not its `count`: a mailbox blocked by
something else as well picks the reason up and proves nothing. That exact mistake cost the
11-04 debrief its number-one recommendation, when a row that went 6 to 30 in a day turned
out to free nobody.

## The recovery lane: lap 20, and a slice of the book with no websites

The lane's own half of the work (`lane_*`, which excludes the contact-lookup timer that
writes into the same table):

| Thing | This cycle | Prior 7 days |
|---|---|---|
| Contact points | 1 | 85 |
| Email addresses | 0 | 13 |
| People with a new point | 1 | n/a |

Four passes, 578 lead-slots, lap 20 of a 1,771-lead book, 3 stranded (flat, so the selector
gap closed on 09-13 has not reopened). The methods turned up 1,227 things and 1,226 were
already on file. That is a full re-walk of a picked-over book, which is the expected shape
past lap 1 and not a fault.

The newest pass is a different story from yesterday's:

| Field | This cycle | 11-21 cycle |
|---|---|---|
| `no_site_pct` | 93.75 (120 of 128) | 2 (3 of 150) |
| `brave_searches` | 128 | 150 |
| `brave_refused_searches` | 2 | 0 |
| `brave_candidates` | 110 | 114 |
| `brave_accepted` | 8 | n/a |
| `gate_rejected` | 102 | n/a |
| `social_only` | 16 | n/a |
| `cause` | `ownership_gate` | `resolution_ok` |

The search is alive and finding sites. The ownership rule is throwing them out: 102 of 110
candidates could not be tied to the creator. Nine of the lane's collection methods need a
website first, so those 120 leads lost their page half before any method ran. A swing this
size between two consecutive days is the cursor reaching a different slice of the book, not
a change in the rule.

**More search credit buys nothing here**, which is the 2026-10-10 lesson and the reason
`cause` exists. The open question is the same one the 11-22 debrief left with Casey: whether
a website the creator declared themselves can stand on page evidence alone. The per-lead
counters that shipped that day will have a week of readings by Friday.

One consequence worth naming so it is not misread later: `cross-domain redirect`, the
condition that led the last two debriefs, ran 62, 33, 0, 0 across this cycle's four passes.
It did not get fixed. The two newest passes resolved almost no sites, and a lead with no
site has no link to redirect.

## Everything else

- **Shelf.** 4,853 ready to write, 7,379 bundled (99.8% of 7,391), 2,525 people really
  emailed. One lead still carries a sent stamp with no send behind it, standing since
  2026-10-07, the same single lead as the last three mornings.
- **Apify.** Ninth morning dead. 401 `user-or-token-not-found` since 2026-11-19T12:21:30Z,
  46 refused ticks, 263.6 hours with no work. $31.06 of allowance left, $21.06 spendable
  after the reserve, and it expires 2026-11-30 without carrying over. The token is in the
  settings bank, so this is operator-only.
- **Replies.** 2 people read, both classified `other`, no agreement to talk, no classifier
  failures. The sender has been paused since 2026-09-17 by Casey's own decision and Casey
  answers these by hand off his own lanes, which this file cannot see.
- **Enrichment.** `idling_no_inflow`, one batch, one lead. Correct at 99.8% bundled.
- **YouTube keys.** 15 working of 66, 50 quota-exhausted after reset. Settled on 09-16: the
  quota on 50 projects was cut, so this is the standing state and not an incident.
- **Discovery.** 0 new channels, every sweep idle. Paused by Casey's order since 2026-09-08
  and not a fault.
- **Spend.** $0 Anthropic. OpenRouter balance $298.11, account spend 43 cents a day.

## Fix shipped this cycle

`youtube-outreach-orchestrator-v1`, commit `a4759d3`.

The debrief now records how many mailboxes each of the two band readings covered, so the
figures a reader opens first cannot compare two different fleets:

- `band_roster`, `band_roster_prev`, `band_roster_change` and `band_roster_comparable`.
- `band_delta_comparable` and `band_moves_comparable` are both false when the rosters
  differ, so the day-over-day flag can no longer say yes to this cycle's subtraction.
- `band_owned_offline` and `band_owned_offline_ids`: the mailboxes the gate suspended in
  its own name that have left its roster, which is the 67 above. Null, not zero, when
  either the roster or the ownership ledger is missing.

Verified against the live gate state: it reproduces 28 against 94, a difference of 66, both
flags false, and 67 stranded suspensions. Five new test cases cover the day of the drop and
the morning after, when nothing inside the window is short any more and only the roster
sizes carry the fault. Full selftest suite passes, `tsc --noEmit` clean.

No verdict changed and nothing about suspend or resume was touched. The repair for the 67
belongs in automator, which owns the send path.

## Ranked levers

1. **Find out why the warmup list went 94 to 28.** Nineteen domains lost all three of their
   mailboxes in the same hour. Check the warmup provider's account. Everything else on this
   list is smaller.
2. **Release the 67 mailboxes the health gate can no longer reach.** It owns their
   suspension and its resume path walks a roster they are not in. Either the warmup records
   return, or the resume path needs to handle a mailbox it owns and cannot read. In
   automator.
3. **Replace the Apify token.** Ninth morning, eleven days of no work, $21.06 expires
   2026-11-30. Operator-only.
4. **Leave the free recovery lane alone this week.** Lap 20, 1,226 of 1,227 findings
   already on file, and the newest pass lost 120 of 128 leads to the ownership rule before
   any method ran. The declared-link question from 11-22 is still Casey's open call.

## What was verified, not assumed

- The subscription count stepping 94 to 28 and holding for nineteen runs was read from the
  gate's own log, not inferred from the band counts.
- The 72 owned against 28 banded mailboxes, the 67 that are in one and not the other, and
  the domains behind them were counted from `automator/state/inbox-health.json`.
- The claim that the gate cannot resume those 67 was read off `actions()` in
  `automator/scripts/inbox_health.py`, which iterates the warmup-derived records.
- **Not established:** why the subscriptions disappeared. Cancelled, lapsed, or dropped by
  the provider are all consistent with what is visible here, and the corroborating warmup
  snapshot is three days stale.
- The 11-22 redirect fix was not re-measured this cycle; its condition fell to zero for a
  reason unrelated to it.
- Discovery being off, enrichment idling and the weekend zero in the send column are the
  intended state and none was treated as a fault.
