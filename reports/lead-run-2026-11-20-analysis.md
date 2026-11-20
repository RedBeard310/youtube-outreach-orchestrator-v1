# Lead Run Analysis, 2026-11-19

Cycle: 2026-11-19T08:00:00Z to 2026-11-20T08:00:00Z (the 24h ending at midnight PT, so all of
Thursday 19 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-20.json`.
Companion to [lead-run-2026-11-20.html](lead-run-2026-11-20.html).

## Headline

**Nobody was emailed on Thursday, and the cause was one missing line in a settings file.**
Not a thin plan, not a shortfall. Zero emails, no plan file written, and no
`automator/state/siege/2026-11-19` folder on disk at all.

`siege-plan.service` started on time at 11:15:02Z and ended having written exactly one line
to the system journal:

```
Nov 19 11:15:02  python3[3690549]: INBOX_KIT_API is not set (expected in env-storage/.env)
```

That is `inbox-warmup-sync.py`, the **first** of the unit's six sequential `ExecStart` steps.
Its only job is to download each sending mailbox's warmup age and health and save it to a file
the planner reads later. It writes no email. systemd abandons every remaining step at the
first non-zero exit, and only the campaign-enrolment step carries a leading `-`, so the five
behind it never ran: the enrolment, `--samples 20`, `siege-approve`, `--live --approved` and
the report.

**The key is in the shared settings bank right now**, so nothing was deleted. This is the
documented env-file race: the Mac rewrites `env-storage/.env` on the VPS about every two
minutes, and `smartlead_api.load_env()` walks it line by line with no completeness check, so a
file caught mid-write loads as a short file and raises nothing. A one-second overlap cost a
working sending day with **4,853 finished emails on the shelf**.

**The hourly watchdog worked.** `siege_send_day_failed` was written at 12:11:02Z, 56 minutes
after the crash. Siege stops pushing at noon New York time, so about five hours of sending day
were still recoverable. Nothing acted, which is expected for an unattended loop whose repair
lives in a repo the self-improvement agent may not edit.

**The snapshot blamed the timer.** `binding_constraint` published
`plan_missing_on_sending_day`, whose own documented meaning is that the day produced no plan
and the timer is what to look at. The timer fired perfectly. Fixed this cycle.

**The fleet lost 10 clear mailboxes and none came back.** 49 clear to 39, stopped 35 to 42.

**2 people parked**, pool 7,388 to 7,390, and the recovery lane's own half found neither of
them. $0 Anthropic, 0 fatal signatures, no halt flag, 0 new channels (discovery paused by
order since 2026-09-08).

## What actually moved

| Reading | Wed 11-18 | Thu 11-19 |
|---|---|---|
| Emails loaded | 314 | **0** |
| People reached for the first time ever | 4 | **0** |
| Plan file on disk | yes | **no** |
| Send unit verdict | success | **exit-code** |
| Parked pool | 7,388 | 7,390 (+2) |
| Shelf ready to write | 4,851 | 4,853 |
| Mailboxes clear to send | 49 | **39** |
| Mailboxes stopped | 35 | 42 |
| Recovery lane, own addresses found | 0 | 0 |
| Apify hours with no work | 167.6 | 191.6 |

New people reached, by Pacific day:

```
11-12: 3   11-13: 2   11-14: 0   11-15: 0   11-16: 1   11-17: 3   11-18: 4   11-19: 0
```

11-14 and 11-15 are the weekend; `siege-plan.timer` runs Mon to Fri. Thursday is the ninth
single-digit day running and the first weekday since 11-09 to reach nobody at all.

**Thursday's zero is a different kind from the eight before it.** Those were days when
hundreds of emails went out and every one went to somebody who had heard from us before, which
is a decision about who gets the slots. Thursday no email went anywhere, so a whole day of
capacity, the follow-ups it owed, and whatever first touches it would have carried are gone.
The follow-ups it skipped now land on Friday on top of Friday's own, which is the structural
effect the 2026-10-13 note describes.

## Q1. Why did nobody get an email on a sending Thursday?

The first step of six failed and took the other five with it.

Timeline, all read from live sources:

| When | What |
|---|---|
| 11:15:02Z | `siege-plan.service` starts (timer: `Mon..Fri 06:15 America/New_York`) |
| 11:15:02Z | `inbox-warmup-sync.py` exits on `INBOX_KIT_API is not set` |
| 11:15:02Z | systemd abandons the five remaining steps; unit `Result=exit-code` |
| 12:11:02Z | hourly check writes `siege_send_day_failed`, `step: unknown` |
| 17:00Z | Siege's own noon-New-York push cutoff passes |
| 08:05:13Z (11-20) | band gate reads 39 clear, down 10 |

The unit's six steps, in order, with only one of them tolerant of its own failure:

```
ExecStart=  inbox-warmup-sync.py            <- died here
ExecStart=- smartlead_campaigns.py enroll    (leading "-", may fail safely)
ExecStart=  siege-plan.py --samples 20
ExecStart=  siege-approve.py
ExecStart=  siege-plan.py --live --approved   <- the push
ExecStart=  siege-report.py
```

Two things make this worth a fix rather than a shrug.

**The dead step is the least important one in the chain.** It refreshes
`state/inbox-warmup.json`, a snapshot of mailbox ages. Losing it means the planner reads
yesterday's ages, so a mailbox on warmup day 14 reads day 13 and waits one extra day. That is
a small, self-correcting cost. Cancelling the push is not.

**The failure is transient by nature, so it will happen again.** The credential was present
the next morning. `load_env()` reads the file line by line and sets whatever it finds, so a
half-written file is indistinguishable from a complete one with fewer keys. There is no retry,
no length check, and no error. The two-minute Mac sync is a standing fixture, so the window
reopens every two minutes of every day.

## Q2. Why did the snapshot blame the timer?

Because the field a reader opens first had no name for this shape, so it borrowed the one next
to it.

`binding_constraint` is ranked, and the ranking put "no plan on a sending day" above every
crash name. Its own note says that value means the day produced no plan at all **and the timer
is what to look at**. A reader following that would have checked a timer that had fired on
schedule.

Three crash names already existed, and none could be reached:

| Name | Describes | Why it could not fire |
|---|---|---|
| `unit_died_before_push` | unit failed, approval not recorded | needs `approval_pending`, which needs `planned`, which needs a plan file |
| `push_unit_failed` | unit failed, approval recorded or unreadable | same |
| `push_killed` | systemd stopped a push mid-batch | sits inside the "something was sent" branch |

All three sit behind a test for "a plan with work in it that moved nothing", and that test is
computed from the plan file. **No plan, no number, no branch.** The one day where the crash
comes before the plan is exactly the day the crash names cannot describe.

This is the third time this specific fault has cost a morning:

- **2026-10-29**: a plan that held nobody fell through every branch and printed `null`.
- **2026-10-30**: a crashed unit borrowed `awaiting_approval`, a state that cannot exist since
  Casey's 2026-09-30 standing approval.
- **2026-11-19**: a crash before the plan borrowed the timer's name.

Each one lands in the single field a reader checks before any other.

## Q3. Did anything get into the pipeline?

Two people, and the recovery lane found neither.

| Source | Points | Addresses | People |
|---|---|---|---|
| Recovery lane's own half (`lane_*`) | 21 | **0** | 8 |
| Automator's contact lookup (`other_lane_*`) | 4 | 2 | 2 |
| Paid Apify lane | 0 | 0 | 0 |

Both of the day's parks came from the second row, which is automator's half-hourly lookup
working on leads already on the shelf. The lane that walks the 2,875 people with no address
found zero addresses. Its own prior week was 41 points and 4 addresses, so it has roughly
halved off a small base.

**That is a picked-over book, not a fault.** The grounded numbers say so directly: lap 19 of a
1,778-person book, **1,090 of the 1,115 methods that found anything this cycle found something
already on file**, and only 3 leads stranded. Website resolution is the best in weeks:
`cause: resolution_ok`, 31 of 150 leads with no site found (20.7%), **zero Brave refusals**
across 39 searches, 29 candidate sites found and 8 accepted. The ownership gate threw out 21,
which is the gate doing its 2026-08-18 job. No amount of Brave credit changes any of this.

The cycle's top error condition is `cross-domain redirect` at 95 of 481 method errors (20%),
spread very unevenly across the four passes (33, 0, 0, 62), which is the 2026-11-09 lesson
about per-pass figures swinging two-fold on which slice of the book the cursor sits on.

**Enrichment is idle and correct.** `chain_state: idling_no_inflow`, 2 batches, 2 leads, and
the shelf is 99.8% bundled. There is nothing to enrich because nearly everybody already is.

## The fleet

| Band | Thu 11-19 08:05Z | Wed 11-18 08:05Z | Move |
|---|---|---|---|
| Clear to send | 39 | 49 | **-10** |
| On watch (follow-ups only) | 13 | 10 | +3 |
| Stopped | 42 | 35 | +7 |
| Gate-owned total | 66 | | |

The arithmetic closes by construction: 49 clear, `band_moved_to_normal` 0, `band_left_normal`
10, giving 39. And it is a real reading rather than an instrument fault, which is the thing to
check first since 2026-11-10:

- `band_short_readings` **0**: every hourly run inside the window read the full fleet.
- `band_moves_comparable` **true**, `band_delta_comparable` **true**, 24h gap.
- `band_peak_normal` **49**, at the prior reading, so the clear count never rose inside the
  cycle. No revolving door, which is the 2026-10-27 check.
- `band_left_normal_unknown` **0**, so the 10 is exact, not a lower bound.

**Nine held mailboxes are already healthy enough to return**: 6 waiting out a recovery clock
with the soonest owing 1 more hour, and 3 held only because two sick addresses share their
domain. So part of this lifts itself without a config change.

**Two silences are the crash, not separate faults.** The older warmup gate in
`youtube-email-outreach-v1` last ran 2026-11-18T10:46:26Z and its 4 health pauses belong to
Wednesday; that gate runs at send time, and there was no send. And `state/inbox-warmup.json` is
stamped 2026-11-18T11:15:15Z because the step that rewrites it is the step that died.

## Fixes shipped this cycle

### A send day lost to a crash read as a timer that never fired (`53ecfe9fd`, orchestrator)

Two changes, both to reporting. The crash itself is in `automator`, which the autopilot may not
edit.

**1. The headline field names the crash.** `sendPlanHealth()` now splits the no-plan branch: no
plan on a sending day plus a cycle-scoped unit verdict that is not `success` reads
`unit_died_before_plan`. `pushUnitResult` was already scoped to the cycle by `unitStartedAt()`,
so a verdict left over from Friday cannot rename a Sunday. A `null` verdict and a `success`
verdict both keep `plan_missing_on_sending_day`, because an unmeasured unit is unknown rather
than crashed, and a unit that reported success and wrote no plan really is the timer's
question. The `not_a_sending_day` branch still outranks both.

**2. The hourly alarm can name the first step.** `siegeRunAlarm()`'s step ladder began at
`--samples 20` and read the state directory, so a run that died before anything was written
there had no rung and landed on `unknown`. The new `warmup` rung uses the same principle as the
rungs below it: a step that finished left a file behind. `inbox-warmup-sync.py` rewrites
`state/inbox-warmup.json` and stamps `generated_at`, and it deliberately refuses to overwrite
a good snapshot with an empty one, so a stamp older than the run's own start means the step did
not finish. On 11-19 that read 2026-11-18T11:15:15Z against a run that started
2026-11-19T11:15:02Z: a day stale, unmistakable, and unread. The rung's wording points at a
missing or momentarily unreadable credential rather than a traceback inside Siege, which is a
different repair. `checkin.ts` supplies the reading with one file read, no network.

**Positively measured only.** An unreadable or absent warmup snapshot falls through to
`unknown` rather than claiming the first step, which is the rule every rung here follows and
the one the 10-29 and 10-30 faults came from breaking. The alarm's detail text also stopped
describing the unit as five steps; it is six, and only the campaign enrolment may fail safely.

**Verified:** full self-test suite passes with 11 new assertions, covering both the new names
and every way each must stay silent (success, weekend, unknown schedule, unreadable snapshot,
absent reading). Both files typecheck clean under `--strict`. The crash, its timestamp, the
missing state folder, the stale warmup stamp, the alarm line at 12:11:02Z, the unit's step
order and the branch ordering were all read from live sources before anything was written.

## Ranked levers

1. **Stop the warmup step being able to cost a sending day.** New, and the highest-value item
   here. Either put a leading `-` on that `ExecStart` line in `siege-plan.service`, the way the
   enrolment line already has, or make `load_env()` refuse a half-written file instead of
   silently loading a short one. The second also protects every other script reading that file.
   Both are in `automator`. Casey's call.
2. **Decide what the slots are for.** Eleven days unchanged. Thursday is a gap in the evidence,
   not a new data point, but the eight days around it reached 13 people for the first time while
   4,853 finished emails wait on the shelf. `siege.fill_slots` and its `priority_key`, in
   `automator`. Repeat offers were Casey's 2026-10-07 decision, so the mix is his to set.
3. **Replace the Apify token.** 191.6 hours with no work, 10 refused ticks, $21.06 of allowance
   expiring 2026-11-30, still HTTP 401 `user-or-token-not-found`. Operator-only. Sixth morning
   unchanged.
4. **Watch the fleet on Friday and decide nothing yet.** Ten clear mailboxes lost with zero
   returned is the sharpest one-day fall in three weeks, and Thursday sent nothing, so none of
   it was earned by Thursday's own volume. Nine held mailboxes are already healthy, six on a
   clock with the soonest owing one hour. One more morning tells you whether this is a slide or
   a wobble.
5. **Nothing needed for the recovery lane, the enrichment chain, the reply lane or the keys.**
   Lap 19, 1,090 of 1,115 methods already on file, best website resolution in weeks: a
   picked-over book. The chain is idle because the pool is 99.8% bundled. The reply lane read 6
   people cleanly with 0 classifier failures and nobody said yes. 15 of 66 working keys is the
   settled 2026-09-16 finding, and the quota it buys is keyword search, which is off.

## Checked rather than assumed

**Checked:**

- The crash and its exact timestamp, from `journalctl -u siege-plan.service`, which holds one
  line for the whole run.
- The six `ExecStart` steps, their order, and that only the campaign enrolment carries a
  leading `-`, from `systemctl cat siege-plan.service`.
- That no plan was written, by listing `automator/state/siege/`: 11-16, 11-17 and 11-18 are
  there, 11-19 is not.
- That the warmup snapshot is a day stale, from its own `generated_at` (2026-11-18T11:15:15Z).
- That `INBOX_KIT_API` is present in the settings bank right now, by counting the name in the
  file without printing its value. This is what makes it a race and not a deletion.
- That `load_env()` reads line by line and sets whatever it finds, with no completeness check,
  by reading `automator/scripts/smartlead_api.py`.
- That `inbox-warmup-sync.py` refuses to overwrite a good snapshot with an empty one, by
  reading its `main()`, which is what makes a stale stamp a reliable signal.
- That the alarm fired, from the `siege_send_day_failed` line stamped 2026-11-19T12:11:02Z in
  `logs/autopilot-observations.jsonl`.
- That the three existing crash names are unreachable without a plan file, by reading the branch
  order in `sendPlanHealth()`. That is why the fix adds a fourth rather than widening one.
- The fleet move's trustworthiness, from `band_short_readings`, `band_moves_comparable`,
  `band_peak_normal` and `band_left_normal_unknown` rather than from the band counts alone.
- The fix: full self-test suite and a `--strict` typecheck, both before committing.

**Assumed:**

- That the missing credential was the env-file sync race rather than something that emptied the
  file deliberately. It fits, the file is whole now, and the hazard is documented, but the
  moment of overlap is not recoverable because nothing logs that file's writes.
- That the slots go to repeat offers because of the tier ordering rather than something else.
  `fill_slots` is in another repo and was not read this cycle, and this cycle produced no push
  to measure it against.
- That the 10 mailboxes leaving the clear band is ordinary health churn rather than anything
  caused by the dead send day. The gate reads health from InboxKit on its own hourly schedule
  and does not depend on a push having run, but the per-mailbox reasons were not pulled, because
  the plan file that normally carries them does not exist for this day.
