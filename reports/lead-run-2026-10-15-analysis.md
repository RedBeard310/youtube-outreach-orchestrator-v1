# Lead Run Analysis — 2026-10-15

Cycle window: 2026-10-14T07:00Z to 2026-10-15T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-15.json`.
Companion: [lead-run-2026-10-15.html](lead-run-2026-10-15.html).

## Headline

**64 emails loaded, against 782 the day before.** Yesterday's debrief predicted a small
day and named the follow-up bill, which is real: 562 follow-ups came due against a
645-message allowance. The bigger half of the fall is new. **At 09:45Z, 83 minutes before
the push, the inbox health gate suspended 13 mailboxes, all 13 on a failing health score
and none for being too young in warmup.** That is its second-biggest pull in 50 recorded
runs, and it landed the morning after the largest push on record. The fleet went 57 live
mailboxes and an 855-message daily allowance, to 53 and 795, to **43 and 645** in three
days. The binding constraint on sending has moved from the shelf to the fleet.

## The numbers

| | |
|---|---|
| Emails loaded | **64** by Siege at 10:41Z; 67 planned, 3 unpushed, 10 refused, 0 failed |
| Push losses | 9 to a plan-vs-manifest disagreement, 1 to our own length gate; 2 SmartLead 429s absorbed by the 10-05 retry |
| Fleet | **43 live mailboxes** (was 53, 57), **645 msg/day allowance** (was 795, 855), 562 follow-ups due, 24 of 43 full |
| Health gate | 13 suspended, 2 resumed at 09:45:53Z; **13 of 13 on health score**, 0 on warmup day; 51 paused in total |
| People parked | **4**; 8 people got an address, from **6 different methods** |
| Recovery lane | 4 passes, 552 leads, 884 points found, 840 already on file (95% re-walk), **44 new**; lap 10 closed |
| Shelf, never emailed | **5,135** (was 5,171); 2.5 weeks at last week's pace, 19 weeks at today's fleet |
| `needs_contact` | 3,443; `collect_book_stranded` held at 3 for the 32nd day |
| Spend | $0.00 Anthropic (32nd cycle); OpenRouter $3.35/day, $80.84 left (~24 days); Apify dry to 31 Oct |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched. |

## What the day actually was

**09:45:53Z, the health gate.** 13 mailboxes suspended, 2 resumed, read off
`youtube-email-outreach-v1/.inbox-health-state.json`. Health scores: 53.5, 65.5, 66.7,
68.2, 68.5, 68.5, 79, 80.5, 81.2, 83.9, 83.9, 88.4, 89.5 against a bar of 90. Zero
warmup-day pauses. The gate's history holds 50 runs back to 08-17; only 09-24 pulled more
(18).

**10:36Z, the plan.** 67 free slots across 43 live mailboxes, because 562 of the 645
messages the fleet allows were already owed to follow-ups and 24 mailboxes had no room at
all. `day_cap` was 870, so the warmup ramp was not the ceiling. The fleet was.

**10:41Z to 11:08Z, the push.** 64 `SENT` lines in `automator/logs/siege.log`, agreeing
exactly with the 64 people carrying an `outreach_processed_at` inside the cycle. Two
`listCampaignMailboxes` 429s, both absorbed on the second attempt by the 10-05 retry.

**Correlation, not proof.** The gate also suspended 6 mailboxes on 10-11 after a weekend
with no sends, so pauses churn independently of volume. What is measurable is the timing
and the size: the largest push ever, then the largest health pull in five weeks. A
suspended mailbox needs two weeks of warmup to return, which makes this the expensive
kind of capacity loss.

## The one new finding

**The binding constraint moved, and both levers are now priced.**

The shelf's runway depends on how fast the fleet is allowed to send, and that range is
the decision:

| | Pace | Runway on 5,135 people |
|---|---|---|
| Last week actually ran at | 2,095 emails over 5 sending days | **~2.5 weeks** |
| Today's fleet allows | ~67 new people a day, ~268 a week | **~19 weeks** |

Neither is a plan. A healthy fleet drains the shelf in a month; a crippled one hands you
five months of runway nobody wants.

And refilling is no longer a guess. **October's Apify allowance bought 472 people into
`approved_hold` for $89.93, about 19 cents each**, across 13 runs on 1 and 2 October (983
addresses found, 472 recovered). On those days it parked 236 people a day. The free
recovery lane, four passes a day on a book it has now walked ten times, parked 4. So
refilling 5,000 people costs roughly $950, and the whole month's $100 went in the first
two days, which is why the lane has been dry for 13 days.

Keeping the fleet healthy, by contrast, costs nothing but spreading a push across four
days instead of one.

## Fixes shipped

**1. `send_plan.fleet`** (`9a54fbc`, orchestrator). Three snapshots in a row reported the
fleet shrinking and none could say so, because every figure arrived with nothing to
compare it to and the slot remainder the reader does see is documented as arguing for
nothing. `fleetFacts()` carries live inboxes and daily allowance against yesterday's
snapshot, plus `inboxGateFacts()` reading the gate's own newest run, split into **health
pauses** (deliverability, two weeks of warmup to undo) and **warmup-day pauses** (a young
mailbox, lifts itself). Verified on the live cycle: `-10` inboxes, `-150` messages a day,
13 health pauses, 0 warmup pauses, and the biggest pull in the gate's history (18, on
09-24) for scale. A missing prior snapshot reports null, never "no change". `tsc` clean,
selftests pass.

**2. `17-podcast` was losing ~40% of its leads to an Apple rate limit**
(`f53bb9127`, email repo). Refusals climbed 12, 69, 56, 28 across the cycle's four
passes: **165 of 552 leads never got the method**. Reproduced from this box: 40 iTunes
search calls 8-wide returned 20 answers and 20 refusals, mixing 403 and 429; the same 40
one at a time all answered 200. The collect pass runs 8 leads wide (`--concurrency`,
default 8). New `src/bloodhound/itunes.ts` queues every search process-wide behind a
window that widens on a refusal and halves after four clean calls, retries once, and
gives up for the pass after 5 leads refused in a row with one line that names itself.
Verified against the live endpoint: 5 leads attempted, 15 short-circuited, instead of 150
refusals.

The method breaker cannot catch this shape and should not: 17-podcast skips most leads
and still produces points on the ones Apple answers, so `errored === ran` never holds.
The breaker is for a dead dependency; this is a live one with a budget.

**3. `httpReason()`** (same commit). Both error condensers collapse digits to `N` on
purpose, so `iTunes 403`, `RDAP 403`, `FINRA 404` and `HTTP 429 on ...` all arrive as
`iTunes N` / `RDAP N`: a request failed and the report refuses to say how. That is also
how `18-rdap` hid a Cloudflare 403 for weeks before 10-12. The digit rule cannot be
loosened (the breaker needs `shapes.size === 1` to mean one fault), so all five call
sites now write a word beside the number and a future report reads `iTunes N
rate-limited`. Documented price: a host answering a *mix* of statuses is now two shapes,
so the breaker leaves it in the pass. That is the safe direction, and a consistently dead
endpoint still trips (asserted).

**4. `top_method_fault_cause`** (`d8e6d21`, orchestrator). The 10-12 rule says a cause
holding most of a pass is one fault to chase. It pointed at a non-fault for three days:
`34-channel-page: page rendered with no outbound links` held 60% of the newest pass, and
that message is the method saying the creator genuinely has no links (it checks the
rendered channel markers first and emits a different message when they are missing).
`collectPasses()` now keeps every named cause and names the largest that is not a known
content outcome. Verified against all four passes: it names `17-podcast: iTunes N` in
three of them, including the two where the benign row outranked it. The benign list is
deliberately one entry long. 83 tests pass.

## Still open

- **The plan and the manifest disagree, intermittently and expensively.** 9 emails
  refused today with `not in the Siege manifest`. It fires on three days in the whole
  send log: 6 on 09-28, **131 on 10-07** against 336 sent, 9 today, zero on every other
  push day. The refusal is correct; the file disagreement is not. Both files are written
  by `automator`, outside the five repos this agent may edit.
- **Apple's podcast budget for this address is spent right now**, from about 200 probe
  calls spent measuring the fault. The next pass or two may give up early on
  `17-podcast`. Self-clearing, named so it is not read as a new fault.
- **Length and em dash rules in the writing skills.** One draft lost today on two length
  checks. Carried from 10-13 and 10-14.
- **Campaign `START` has no rate-limit retry.** Carried from 10-10, lives in `automator`.
- **The 10-13 fit rubric still gates nothing.** Carried from 10-14; no new evidence today
  because only 4 people were parked.
- **Three quiet collection methods:** `04-holehe` (57 days), `26-instagram` (27),
  `19-github` (19).

## Ranked next

1. **Spread the push across the four sending days.** New top item and it is free. 782
   first emails in one morning books three messages each across the next week and, on the
   evidence of the next morning, costs mailboxes that take two weeks to earn back. The
   lever is `automator/scripts/siege-plan.py`.
2. **Decide whether to wait out or replace the 13 suspended mailboxes.** Six are below 70
   against a bar of 90. `npm run inbox-health -- --status` in the email repo reads the
   current per-inbox assessment without changing anything.
3. **Decide whether to spend on refilling the shelf, now that it is 19 cents a person.**
   5,135 remain; the next $100 of Apify allowance arrives 31 October by itself.
4. **Fix the plan-and-manifest disagreement** in `automator`. 9 today, 131 on 10-07.
5. **Decide whether the fit rubric becomes a gate.** Carried from 10-14 unchanged.
6. Length and em dash fixes in the writing skills.
7. One dry run each on the three quiet methods. `18-rdap` and `17-podcast` both produced
   an address today after weeks of silence.
8. Six cycles have metrics and no debrief (09-17, 09-18, 09-19, 08-17, 08-18, 07-11).

## Verified vs assumed

**Verified:** the 64 against both the push log and the database; the 13 suspensions, their
health readings, and that none was a warmup pause; the fleet's three-day fall off the
three snapshots; the two absorbed 429s; the 9 manifest refusals today and the 131 on
10-07, counted across the whole send log; the four collect passes reconciling to exactly
44 new points and 884 found; the 8 addresses and which method found each; the iTunes rate
limit, reproduced 8-wide and serialized from this box; October's Apify spend and
recoveries, summed from its own 13 run logs; all four fixes on live data.

**Assumed:** that the record push caused the suspensions. The timing and the size support
it and the mechanism is plausible, but InboxKit's health score is a composite I cannot
take apart from here, and the gate pulled 6 mailboxes after a zero-send weekend, so
pauses churn on their own. Treat it as the question to ask, not a settled cause. The
2.5-week runway uses the real trailing week, which includes the 782-day, so it is the
fast end rather than the normal.

**One caveat on the snapshot file.** Importing `debrief-data.ts` to verify the new fields
re-ran the gatherer and rewrote `logs/autopilot-debrief-2026-10-15.json` at 07:42Z, 42
minutes after the boundary instead of the timer's 20. Every figure this debrief quotes was
compared against the original 07:20Z run and all were identical (parked 4, sent 64, shelf
5,135, 44 points, 8 addresses, pool 2,443, stranded 3). The file now also carries both new
instruments on live data.
