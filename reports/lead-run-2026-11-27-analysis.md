# Lead run analysis, 2026-11-26

Cycle: 2026-11-26T08:00Z to 2026-11-27T08:00Z (the Pacific day of Thursday 2026-11-26).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-27.json`.
Companion report: [lead-run-2026-11-27.html](lead-run-2026-11-27.html).

## The one-line version

The fleet recovered, the plan went from 25 people to 61, 44 emails went out, and not one of
them reached somebody who had never heard from us. That makes six sending days in a row at
zero and one new person in eight days. The 36 extra slots the fleet bought all went to repeat
offers, which answers a question this report has led with for five mornings: capacity was not
what was holding reach down.

## Headline numbers

| Reading | This cycle | Prior | Note |
|---|---|---|---|
| Emails loaded | **44** | 8 | All by the send program, 0 by this repo |
| People emailed | 44 | 8 | Plus 1 the log forgot, caught by the send ledger |
| Approved people who got no email | 17 of 61 | 17 of 25 | Split complete, no capped prior days |
| ...as a share of what the push drove | **27.9%** | 68.0% | Same cohort, bigger denominator |
| ...of which already lost on an earlier day | **17** | 17 | `lost_new` 0, and exact this time |
| Longest unbroken loss streak | 10 snapshot days | 10 | Same person |
| People reached for the first time ever | **0** of 43 | 0 of 7 | Sixth sending day running |
| First touches over the prior 7 days | 1 of 380 people (0.3%) | 5 of 666 (0.8%) | The 11-18 day aged out |
| Live inboxes at plan time | **6** of 124 | 4 of 124 | Allowance 870, capacity 90, slots 61 |
| People the approval covered | 61 | 36 | Nobody deferred; every planned person approved |
| Mailboxes clear to send | **7** | 5 | Roster 28 on both mornings, so the rise is real |
| Mailboxes on watch / stopped | 0 / 21 | 6 / 17 | Watch emptied; 4 arrived in stop |
| Band moves | 2 to normal, 0 to watch, 4 to stop | | 5+2-0 = 7 closes; 1 mover unplaceable |
| Returned and still clear | 2 of 2 | 6, five of them re-stopped | 0 round trips this cycle |
| Held but healthy | 2 | 7 | Both on clock, soonest 12h, 0 sick-sibling |
| Gate-owned suspensions outside the roster | 67 of 86 | 67 | Nothing can resume them, 5th morning |
| People waiting for a slot | **1,857** | 1,797 | whale 374 / strong7 728 / other7 755 |
| Parked into `approved_hold` | 0 | 1 | Pool flat at 7,393 |
| Recovery lane's own half | 5 points, 2 addresses, 4 people | 9 points, 0 addresses | Lap 21 of a 1,765 book |
| Points from automator's own lookup timer | 17 points, 3 people | | Not the lane's, do not credit it |
| Site resolution | 2.7% no site | 91.3% | 146 of 150 already had a site on file |
| Shelf ready to write | 4,855 | 4,855 | 7,381 bundled, 99.8% |
| Replies | 7 people, **2 yes** | 1 person, 0 yes | 0 classifier failures, auto-send paused |
| Enrichment | 0 batches, 0 leads | 1 lead | Idle with nothing arriving; unit active |
| Apify email recovery | 359.6h with no work | 335.6h | Token refused, 6-tick streak on the stamp |
| Fatal error signatures | 0 | 0 | No halt flag |
| Anthropic spend | $0 | $0 | OpenRouter $297.85, 1.5 cents/day |

## What the day was

The machinery was clean. Siege wrote its plan at 11:27:11Z, the push unit reported success, 44
people were emailed, the reply reader ran 85 times with no classifier failures, and there were
no fatal signatures and no halt flag. This repo's own send command fired once, found nothing
parked and ready, and sent nothing, so every email came from the send program.

**The fleet improved, for the first time in a week.** The health gate's clear band went 5 to 7
on a roster covering 28 mailboxes on both mornings, so the comparison is checked rather than
two different fleets subtracted. Watch emptied from 6 to 0 and stopped went 17 to 21, which is
the watch band draining downward rather than clear mailboxes falling: `band_left_normal` is 0,
and 5 + 2 - 0 closes exactly on the 7 published. Both returners held their band to the end of
the cycle and there were no round trips, unlike the revolving door of 10-27. Siege then saw 6
live mailboxes against 4, 90 messages of capacity against 60, and planned 61 people against 25.

**And reach did not move at all.** Forty-four people emailed, zero reached for the first time
ever. Sixth sending day in a row at zero. The eight-day window now holds **one** person, down
from five, because the 4-person day of 11-18 slid out of it. The series by Pacific day reads 0,
1, 0, 0, 0, 0, 0, 0.

**Seventeen of the 61 got no email, and all 17 were people an earlier push had already
refused.** As a share of the plan that is 27.9% against 68.0% yesterday, which is a flat leak
against a plan that more than doubled. Nothing about the cohort changed.

## The controlled test nobody designed

This cycle is as close to a controlled experiment as this pipeline produces, and it settles the
argument the last five debriefs have been having with themselves.

Everything about the lead side was identical: the same shelf of 4,855 finished emails for
never-contacted people, the same 1,857 people waiting for a slot, the same tier split, the same
17-person refusal cohort. The only variable that moved was slots: 25 to 61.

- Emails went 8 to 44, so the slots were used.
- People reached for the first time ever went 0 to 0.

Every one of the 36 extra slots went to somebody already emailed. That is the tier queue doing
exactly what it is built to do: Siege fills by tier, the whale tier ran out of never-emailed
people on the 10-13 push, and its re-offer queue takes every slot before a ready lower-tier
person is reached. 374 whale-tier people are waiting, 728 strong7 and 755 other7.

The consequence for the recommendations: "restore the fleet" has now been half-granted and
bought nothing in reach. It is still worth doing, for follow-up capacity and for volume. It is
no longer a credible answer to "we have reached one new person in eight days." The queue
ordering is the lever and it is a setting in the send path, outside the five repos this agent
may edit.

## Why the loss share halved while nothing improved

Seventeen lost yesterday, seventeen today, all repeats on both mornings, longest streak ten
snapshot days on both. Yesterday that was 68.0% of 25 planned; today it is 27.9% of 61. The
share field that shipped on 11-25 is now earning its keep in the opposite direction from the one
it was built for: it was added because a shrinking plan made a flat leak look like a flood, and
this morning it stopped a growing plan making the same flat leak look like a repair.

One thing is genuinely better, and it is the confidence rather than the number. Yesterday
`lost_new: 0` was a lower bound because an earlier day in the 14-day window had named fewer
people than it lost. Today `lost_split_complete` is true and `lost_history_capped_days` is 0, so
"nobody new was lost" is exact.

## What took the seventeen

Five were refused by SmartLead, ten never reached the push at all, and two left no trace in the
log. One further person the log forgot entirely was emailed anyway; the send ledger caught that,
so they were not counted as a loss (`emailed_unlogged: 1`). Four push skips cost nobody: all
four were `voice-objection-proof` drafts rewritten and sent in the same run.

By cause, covering 13 of the 17:

| Cause | People | Where the repair lives |
|---|---|---|
| Every offer in their rotation has now declined | 7 | Research banks, or stop planning them |
| SmartLead holds them as unsubscribed | 3 | Send path: stop planning them |
| YouTube no longer has their channel | 2 | Send path: stop planning them |
| No draft written, no clean job title for a plain business owner | 1 | The writing skill |

The seven offer-exhausted were all turned down by `love-your-channel-short` for one
precondition, no safe enemy in the research bank. The per-variant field that shipped on 11-25
reads the split without opening a bundle file: **7 of the 9 leads hold a bank with zero enemies
in it**, 2 hold enemies the skill's safety filter ruled out, and `precondition_variants_complete`
is true. Those are opposite repairs. An empty bank is a research pass or a decision to stop
planning that person. A filtered bank is a question about how strict the filter should be, and
that one is Casey's.

None of the 17 is fixable in this repo.

## The quiet lanes, briefly

**Two people said yes.** Seven replies were read and classified: one plain yes, one yes with a
personal note, two unsubscribes, three other. Zero classifier failures. The auto-sender has
been paused by order since 2026-09-17, so nothing answers them on its own, and one of the two
cannot be signed automatically because the thread's sending mailbox cannot be identified.

**Recovery lane.** Its own half produced 5 contact points and 2 email addresses across 4
people, against 93 points and 10 addresses over the prior week. That is lap 21 of a 1,765-lead
book with 1,626 of 1,633 findings already on file, which is what a picked-over book pays. The
other 17 points in the cycle came from automator's own contact-lookup timer and are not this
lane's. Stranded is flat at 3, so the selector gap closed on 09-13 has not reopened.

**Site resolution read 2.7% no site, against 91.3% yesterday.** The cause field says
`resolution_ok`, and the mechanism is visible: 146 of the 150 sampled leads already had a site
on file, so only 6 Brave searches ran, none were refused, and the ownership gate turned down 4
of 6 candidates. This is a different and easier slice of the book rather than a resolution
repair, and the fields support that reading without ruling the other out. Either way, more
search credit buys nothing here.

**Enrichment ran no batches.** Correct: a 99.8%-bundled shelf has nothing arriving. The chain
was active and unrestarted since 2026-11-14T06:13:41Z, and the fact that the snapshot could not
say so is what shipped this cycle.

**Apify email recovery is fifteen days dead.** The token still answers "user or token not
found", `lane_no_work_hours` is 359.6, and **$21.06 of the November allowance expires on
11-30**, so three days are left to spend it. A credential is operator-only; no repo can fix it.

**Discovery stayed off** per the standing order of 2026-09-08, so zero new channels, zero
campaign sessions, and a stale sweep state is the intended state. The podcast lane woke, read
the flag and halted, which is the flag working. The YouTube key pool reads 15 working of 66,
settled on 09-16 as cut project quota and not an incident.

## Fix shipped this cycle

`youtube-outreach-orchestrator-v1` `7f0499a`: a chain that is silent because it is idle no
longer reads like one that stopped.

**The fault.** With discovery paused, enrichment is the only thing that turns a recovered
address into a lead anybody can write to, so "is the chain running" is the question that matters
most in this snapshot. This morning it could not be answered. The chain published
`gate_cleared_transcripts` with `chain_silent_hours: 12.4` behind it, which reads as a chain
that announced it was resuming batches and then stopped.

**What really happened.** The transcripts gate opened at 2026-11-26T19:37:08Z onto a pool
holding no inflow (pool 6, excluded 5). The chain says its idle line once and is then quiet on
purpose until work arrives, and the latch that suppresses it is only reset where a batch really
runs. So a gate opening onto an empty pool left a promise standing as the newest line in the
log, and the newest line is what the state reader quotes. This is the 11-16 lesson, that a lane
quiet by design cannot be measured by how long it has been quiet, landing in the other lane
eleven days later.

**Two repairs, because the field was wrong in two places.**

1. `scripts/backfill/chain.sh` resets the idle latch whenever any of its three gates clears
   (transcripts, OpenRouter credit, YouTube quota), so a gate opening onto an empty pool
   re-states `idling_no_inflow` instead of leaving a promise. One extra log line per gate
   clearance, nothing else.
2. `scripts/autopilot/debrief-data.ts` adds `chain_unit_state`, `chain_unit_result` and
   `chain_unit_started` to the enrichment block, read straight from systemd with the same
   local-only `showUnit()` probe the send path has used since 2026-10-30. A silent chain whose
   unit is `active` is idling; a silent chain whose unit is anything else is an outage; and a
   `chain_unit_started` that moves is a restart nobody ordered. All three read null when
   systemd cannot be read, which is unknown and never a dead chain.

**Verified.** `bash -n` clean on the chain script, `tsc --noEmit` clean, the full snapshot
self-test suite passes, and systemd returns `active` / `success` / 2026-11-14T06:13:41Z for the
live unit. No enrichment, send, research or filter behaviour was touched.

## Confirmed working: the fields shipped on 11-25

`people_lost_pct` and `lost_recurring_pct` both read 27.9 against yesterday's 68.0 on an
unchanged 17-person cohort, which is the arithmetic working in the direction nobody built it
for. `precondition_variants` split the seven offer-exhausted into 7 empty banks and 2 filtered
ones with `precondition_variants_complete` true, so this analysis opened no bundle files; the
11-24 debrief needed eleven.

## Ranked levers

1. **Point one day of slots at the shelf.** The controlled test above: 36 extra slots produced
   36 extra emails and zero extra people reached. 4,855 finished emails are waiting for people
   who have never been contacted, and the tier queue sends none of them while the whale
   re-offer queue has anybody left. One day of first touches would beat the last six sending
   days combined. Send-path setting, unchanged for over three weeks.
2. **Stop planning the people no push can send.** 17 of 61 slots, one of them for the tenth
   consecutive snapshot day. Two deleted YouTube channels, three SmartLead unsubscribes.
   Neither condition improves by being re-planned. Returns 28% of the day for one gate.
3. **Answer the two people who said yes.** First agreements in days, and nothing replies
   automatically while the auto-sender is paused. One of the two cannot be auto-signed anyway.
4. **Replace the Apify token.** Fifteenth morning, 359.6 hours with no work done, $21.06
   expiring 11-30. Operator-only.
5. **Keep repairing the fleet, but for volume, not reach.** 20 mailboxes are blocked by nothing
   except a missing warmup record (96 name that reason; read the 20 that carry it alone, per
   the 11-05 rule). 67 gate-owned suspensions have left the roster so nothing can resume them.
   Both are real capacity, and today showed neither reaches a new person on its own.
6. **Decide what happens to the seven offer-exhausted.** 7 of 9 leads have a research file with
   no enemies in it; 2 hold enemies the filter refused. A slot every sending day since 11-11.
7. **Leave the recovery lane and enrichment alone.** Lap 21 of a picked-over book, and an idle
   chain on a 99.8%-bundled shelf. Neither is broken.

## What was verified, not assumed

- The enrichment finding was read off the chain's own log (gate cleared 19:37:08Z, no line
  after it), the latch was read in the script, and the unit's state and start time came from
  systemd directly. The fix was syntax-checked, typechecked and run against the full suite.
- The fleet comparison is sound because both gate readings covered the same 28 mailboxes
  (`band_roster_comparable` true), the plans were written 24 hours apart at the same hour
  (`delta_comparable` true, no re-plan after the push), and the move counts reconcile with the
  band change.
- The loss reading is complete: the split covered all 17 and no prior day in the window named
  fewer people than it lost, so `lost_new: 0` is exact rather than a floor.
- The reach series is by Pacific day, dense and oldest-first, so a day that reached nobody
  appears as a 0 and not as a gap.

**Not established.** Why the tier queue still has no first touches to give out, which is a
send-path question nothing here can read. Whether the seven empty research banks are empty
because transcripts were never mined or because those creators argue with nothing. Whether the
2.7% no-site reading is a resolution improvement or simply an easier slice of the book; the
fields support the second and cannot rule out the first. One mover the band walk could not place
makes `band_left_normal` a lower bound, though the arithmetic closes at 0.

**Untouched by design.** Discovery stayed off, per Casey's standing order of 2026-09-08. No
credential, no send-path behaviour and no research or filter rule was changed.
