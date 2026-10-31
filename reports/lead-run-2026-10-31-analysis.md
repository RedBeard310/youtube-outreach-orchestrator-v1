# Lead Run Analysis — 2026-10-31

Cycle: 2026-10-30T07:00:00Z to 2026-10-31T07:00:00Z (the 24h ending at midnight PT).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-31.json`.
Companion to [lead-run-2026-10-31.html](lead-run-2026-10-31.html).

## Headline

**0 emails for the second sending day in a row, from a completely different cause than
Thursday's.** Siege built Friday's plan correctly at 10:17:13Z: 69 people against 69 free
mailbox slots, verified addresses, finished emails, every mailbox carrying a real campaign
id, email not paused. Three minutes later the run died in a helper that formats the morning
sample report, and because all five of the send unit's steps live in one systemd oneshot,
the push step never ran. 69 approved people got nothing.

Roughly 131 approved people have now lost a day to two unrelated single points of failure
in the same unit, 48 hours apart.

## The fault, precisely

```
  File "/home/casey/repos/automator/scripts/siege-plan.py", line 1298, in why_no_email
    fails = "; ".join(row.get("fails") or [])
TypeError: sequence item 0: expected str instance, dict found
```

`why_no_email()` turns a blank space in the sample report into a sentence. Its own comment
explains the intent: "Casey cannot tell a skill that correctly declined to write from a
writer that fell over." It joins a writer's list of failure strings into readable text, and
one failure arrived as a structured object. The code written to explain failures was taken
down by a failure shape it did not expect.

That alone should have cost a report. What cost the day is the unit:

```
[Service]
Type=oneshot
ExecStart=... inbox-warmup-sync.py
ExecStart=... siege-plan.py --samples 20        <-- died here, 10:20:49Z
ExecStart=... siege-approve.py --note "standing approval, ..."
ExecStart=... siege-plan.py --live --approved   <-- the only step that sends
ExecStart=... siege-report.py
```

systemd abandons every remaining `ExecStart` the moment one exits non-zero. The crash was
in step 2, so steps 3, 4 and 5 never ran. A step that sends nothing and spends nothing
blocked the step that emails people.

The files on disk are the clean proof. Friday's `state/siege/2026-10-30/` holds `plan.json`
and nothing else. 10-27, 10-28 and 10-29 each hold `samples.json` and `approval.json`
beside it.

## Friday was not Thursday

Two unrelated faults, back to back, in one unit. Worth keeping separate, because they call
for different repairs and because reading one as the other wastes a morning.

| | Thursday 10-29 | Friday 10-30 |
|---|---|---|
| What failed | SmartLead returned an empty campaign list, unguarded | A report helper raised a `TypeError` |
| The plan | Held nobody sendable, all 58 mailboxes `campaign_id: null` | Whole and correct, 69 people, 69 slots |
| How far it got | Reached the push and refused on purpose | Died two steps before the push |
| On disk | `samples.json` + `approval.json` both written | Neither written |
| People who got nothing | 62 | 69 |
| Repair | Guard the campaign read in `smartlead_api.py` | Guard the join, and decouple the report step |

Both live in **automator**, the send path, which is outside the five repos this loop may
edit. Neither repair could be shipped from here.

## The fleet

Dead flat, which is its own finding. The band gate read **48 stopped, 1 on watch, 9 clear
for twenty-four consecutive hourly readings**, with zero mailboxes moving in either
direction, then one returned at 07:05Z to make it 10. Monday by contrast went 13, 17, 19,
15, 13 clear inside a single day.

- `band_normal` 10, `band_watch` 0, `band_stop` 48, against 9 / 1 / 48 a day earlier.
- `band_moved_to_normal`, `_to_watch` and `_to_stop` all 0. No churn at all.
- `band_held_but_healthy` 3, all three waiting out the recovery clock, nearest 11 hours
  away. Those lift themselves. The other 45 do not.
- The old health gate paused 1 mailbox on health score, 49 paused in total.

**83% of the fleet cannot send.** `mailbox_slots` was 69 against an 870 ramp, so the ramp
is irrelevant: the fleet is the ceiling, and 2,090 people are waiting for a slot (974
whale, 321 strong7, 795 other7).

## Everything else

Clean, quiet, and small. No fatal signatures, no halt, $0 Anthropic.

**Recovery lane.** 19 contact points, 4 email addresses, 4 people, against 80 points and 14
addresses over the prior week. A picked-over book rather than a fault, and the measurements
say so rather than leaving it to inference:

- Site resolution healthy: 149 of 150 leads resolved, `cause: resolution_ok`, 4 Brave
  searches, 0 refusals, 0 errors, 0 rejections from the ownership gate.
- `methods_found` 579 with `already_on_file` 577. The methods are working; the leads have
  already been read.
- Lap 13 of a 2,387-lead book. `collect_book_stranded` is 3, so no selector gap.
- The largest error condition is `cross-domain redirect`, 111 of 196 errors across five
  methods, at 70% coverage of the pass. Worth a look if it keeps growing, not today.

**Shelf.** 5,148 ready to write, 99.8% of the pool enriched, 1,668 stamped sent and 1,664
genuinely emailed. The stranded cohort from the 10-13 push is down from 54 to **4**, so
that problem closed itself exactly as the 10-28 debrief expected.

**Enrichment chain.** Genuinely broken, now fixed. 3 batches launched, 3 failed, every one
on the same lead (`rectFTh2Ue4B3LPRi`, "Roofing Success"), every one dying on a quota error
from Supadata, a transcript provider cancelled in August. See the fixes below.

**Discovery.** 0 new channels, which is Casey's instruction since 2026-09-08, not a fault.
The YouTube pool reads 15 working of 66, also expected since the quota on 50 of those
projects was cut, and irrelevant while discovery is off.

**Costs.** $0 Anthropic. OpenRouter at $1.56/day with $58.91 left, 37.8 days of runway.
Apify finished the month with nothing spendable, sitting on its $10 reserve, so it ran no
batches. The $100 calendar-month allowance refills 1 November.

## Fixes shipped this cycle

**1. A crashed send unit now names the crash, not an approval wait.**
`youtube-outreach-orchestrator-v1` `11fb8c6`

`binding_constraint` is the first field anyone reads, and it printed `awaiting_approval` on
a day a crash cost 69 emails. There is no human to wait for: Casey gave Siege standing
approval on 2026-09-30. The existing name for a stopped run, `push_killed`, sits inside the
branch for days that sent something, so a run that failed having sent nothing could not
name its own failure. That is the 2026-10-29 lesson one level up, where a shape that falls
through every branch either prints null or borrows the next branch's name.

Two new names, ranked above `awaiting_approval`:

- `unit_died_before_push` — the unit failed in-cycle, nothing reached SmartLead, and no
  approval record exists on disk, so the push step never ran.
- `push_unit_failed` — the same failure with the approval recorded or unreadable, which
  points at the push itself.

Which step died is measured rather than guessed. `siege-approve.py` writes `approval.json`
in the step immediately before the push, and `--live --approved` refuses without a current
one, so the new published `approval_recorded` field is its existence. Null, meaning no
state directory at all, keeps the generic name instead of claiming the specific one.
Ranked below `email_paused` and below the planned-nobody branch on purpose, so Thursday's
shape keeps `campaign_list_empty`.

13 regression assertions. 248 assertions green, typecheck clean, and the live 10-30 plan
renders `unit_died_before_push` while 10-29 still renders `campaign_list_empty`.

**2. The hourly check-in now watches the send path.**
`youtube-outreach-orchestrator-v1` `acef372`

Every existing health check guards finding and enriching. Nothing watched sending, so both
failed days were invisible until the debrief ran at 00:20 the next morning, about fourteen
hours late. Both runs had failed before 10:21Z and Siege stops pushing at 12:00 ET, so both
mornings had time to act and no signal to act on.

`siegeRunAlarm()` writes a `siege_send_day_failed` observation naming which of the five
steps died, inferred from which state files Siege managed to write: no `samples.json` puts
it at or before the sample step, samples without an approval puts it in the approve step,
both present puts it in the push or the report. Costs two `systemctl show` reads and two
`existsSync` calls. No database, no network.

Deliberately an observation and never an exit-7 anomaly: the repair for both of these days
is in automator, which the fix-agent may not edit, so spending a model hourly would buy
nothing. The detail line says so outright. Keyed on the failed run's own start stamp so it
speaks once rather than every hour, silent when the verdict is a success, and it refuses
Friday's verdict on Saturday, since that is what the unit still reports all weekend.
`siegeUnitFacts()` is now exported and shared rather than re-implemented, because two
instruments reading one unit is how a snapshot and an alarm come to disagree about the same
morning.

11 assertions. Against live systemd it is silent today (Saturday, not a sending day) and
replaying the 10-30 window fires `step=samples`, which is where that run really died.

**3. A cancelled transcript provider no longer kills whole leads.**
`quick-youtube-channel-research-v1` `6ceb7c4`

The Supadata key pool landed 2026-08-07, when Supadata was the only transcript provider, so
an exhausted pool genuinely had no way forward and the code threw to surface it. Its own doc
says as much. Decodo replaced it as the primary six days later at roughly 20x cheaper, and
the Supadata plan was then cancelled, which turns `limit-exceeded` from an incident into the
permanent expected answer from a dead account. The throw outlived its premise and was
killing leads over it.

An exhausted pool now degrades. The video records `fetch_status: "failed"`, which is already
one of the three statuses the caller handles, and which it treats exactly as it treats a
video with no captions: it writes the row and completes the stage. The lead finishes with
thinner transcripts instead of dying. The exhaustion is latched for the rest of the process,
because a cancelled plan will refuse all 15 videos of a lead and asking it fifteen times
buys only latency and a misleading "falling back to Supadata" line. Narrow on purpose: only
`limit-exceeded` degrades, and `unauthorized` / `upgrade-required` still throw, because
those are a config fault rather than spent quota.

The cause underneath is a cancelled key frozen in that repo's own `.env`. `SUPADATA_API_KEY`
is not in the shared bank, so the pool is non-empty only because of the local file, which is
the repo-env-shadows-the-bank hazard again. Deleting that key would also silence this, since
a null pool already returns `failed` cleanly, but `.env` is operator-managed and the code
should survive a stale key either way.

Typecheck and build clean. The end-to-end proof is the chain's next poll of that lead.

## Ranked next

1. **Make the sample and report steps unable to block the push.** Fix the immediate crash
   by coercing non-string entries before the join in `why_no_email()`, a one-line change.
   Then fix the structure: the push is the only one of those five steps that sends, and it
   sits behind two that do not. Move it ahead of them, split them into separate units, or
   let them fail without taking the unit down. Thursday's fault and Friday's fault were
   unrelated, which says the next one will be too.
2. **Then the slot ceiling.** 2,090 waiting against 69 slots. 48 of 58 mailboxes stopped and
   not one moved in 24 hours. Three held mailboxes are healthy and return for free; the
   other 45 do not. Nothing else in the send path is worth tuning, because even a perfect
   sending day reaches 69 people.
3. **Monday retries on its own.** Siege rebuilds the plan from scratch each morning, so the
   69 are still on the shelf and will be planned again. No manual recovery, nothing to
   re-push by hand. These two days cost delay, not people.
4. **Apify refills 1 November.** Roughly 700 recovered leads for about $90 at the measured
   rate, plus the OpenRouter cost of enriching them. OpenRouter's $58.91 covers that output
   but will want watching once the lane starts spending.

## Reading notes for the next session

- `binding_constraint` now distinguishes a crash from an approval wait. If you see
  `unit_died_before_push`, read `approval_recorded` with it and go straight to
  `journalctl -u siege-plan.service`. Do not read it as the 10-29 shape, which reached the
  push and declined on purpose.
- A flat fleet is not a calm fleet. `band_moved_to_*` all reading 0 with `band_stop` at 48
  means nothing is recovering, which is worse than churn.
- The recovery lane's low yield this cycle is lap 13 of a worked book, and the published
  fields say so. Do not propose Brave credit for it: 0 refusals, 0 gate rejections, 149 of
  150 sites resolved.
