# Lead Run Analysis — 2026-10-27

Cycle: 2026-10-26 00:00 to 24:00 PT (Monday). Grounded in
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-27.json`, the health gate's own
run history and per-mailbox map in `automator/state/inbox-health.json`, and
`logs/bloodhound-collect.log`.

## Headline

**Six held mailboxes cleared exactly as yesterday's debrief predicted, and five of them were
stopped again before morning.** The sendable fleet went 13 to 17 at 09:05Z to 19 at 15:05Z,
then 15 at 17:05Z and back to 13 by 18:05Z, closing the cycle at 13 of 58. The stopped band
finished at **39 against 34**, its highest. Every one of the five was re-stopped on fresh
warmup spam complaints.

The day's sending was clean. **61 emails loaded, nobody lost**, and **3 of the 58 people
emailed had never heard from us** (5.2%), against 10 of 680 over the prior seven days (1.5%).
One of the three came off the enriched shelf, which moved `already_sent` from 1,666 to 1,667
after ten days flat.

## The fleet: a revolving door, not a recovery

The 10-26 debrief's first recommendation was to read the fleet today, because 11 of the 45
held mailboxes were healthy and waiting out a timer, three of them within an hour of
clearing. That prediction was half right, and the half it got wrong matters more.

Hour by hour inside the cycle, clear to send:

| Run (Z) | clear | watch | stop | What moved |
|---|---|---|---|---|
| 10-26 07:05 | 13 | 11 | 34 | cycle opens |
| 10-26 09:05 | 17 | 7 | 34 | 4 returned to normal |
| 10-26 15:05 | 19 | 6 | 33 | 2 more returned |
| 10-26 17:05 | 15 | 10 | 33 | 3 of the returners pulled to watch |
| 10-26 18:05 | 13 | 11 | 34 | 1 to watch, 1 stopped |
| 10-26 19:05 | 13 | 10 | 35 | 1 stopped |
| 10-26 20:05 | 13 | 9 | 36 | 1 stopped |
| 10-27 03:05 | 13 | 8 | 37 | 1 stopped |
| 10-27 04:05 | 13 | 6 | 39 | 2 stopped |

The six returners and where they ended up, scores out of 100:

| Mailbox | Returned | Now | Score | Warmup spam |
|---|---|---|---|---|
| `casey.brown@askcontentgetsclients.com` | 09:05Z | stop 04:05Z | 55.0 | 4 of 29 |
| `casey_brown@askcontentgetsclients.com` | 09:05Z | stop 04:05Z | 55.0 | 4 of 47 |
| `caseybrown@askcontentgetsclients.com` | 09:05Z | stop 19:05Z | 64.4 | 3 of 28 |
| `casey.brown@startcontentgetsclients.com` | 15:05Z | stop 20:05Z | 48.7 | 5 of 48 |
| `caseybrown@startcontentgetsclients.com` | 15:05Z | stop 18:05Z | 48.7 | 5 of 46 |
| `casey_brown@hicontentgetsclients.com` | 09:05Z | **normal** | 96.7 | 0 of 39 |

Against that, the thirteen mailboxes that never lost their clear band: **every one reads 96.7
or better with zero spam complaints across about 55 warmup emails.** Two distinct cohorts, one
clean and one sick, and the recovery rule keeps handing the sick one back its slots.

### Why the rule cannot work as written

`automator/config/inbox-health.json` sets `recover.hours: 48` and `recover.score_at_least: 90`,
and `spam_window_days: 3`. So the hold lifts after 48 unbroken hours at a score of 90 or
better, and the score is driven by spam complaints over the **trailing three days**.

A held mailbox sends less. Its three-day window empties on its own, the score climbs, and it
clears without anything about its deliverability having improved. **The clock is testing an
idle mailbox and then returning a working one to traffic.** The first real sends answer the
question the clock could not, which is why five of six failed within hours and one inside
three hours.

A second, independent instrument agrees that this is real deliverability and not a scoring
quirk: the mailbox provider halved warmup volume on **23 mailboxes today for a critical spam
rate**, against 14 yesterday. None of the thirteen clean mailboxes is among them.

This is all config in `automator`, outside the five repos the autopilot may edit, so it is
reported and not fixed.

## What the day sent

| Reading | Value |
|---|---|
| Emails loaded | 61 (60 Siege, 1 orchestrator) |
| Planned / sent / lost | 60 / 60 / **0** |
| Skipped | 8, all "absent from this batch's Siege manifest" |
| Skips that cost a person | 0 (5 re-sent in the same run, 3 never planned) |
| First touches | 3 of 58 people, 5.2% |
| Prior 7 days | 10 of 680, 1.5% |
| Binding constraint | `mailbox_slots` (60 slots against an 870 warmup allowance) |
| Waiting for a slot | 1,730 (whale 672, strong 230, other 828) |
| Follow-ups owed | 353 |

The push was lossless by its own per-person join, which is the reading that matters rather
than `sent` against `planned`. The 8 skips are the shape the 10-20 and 10-21 debriefs got
wrong in both directions, and the counters now settle it: 5 `skipped_then_sent`, 3
`skipped_unplanned`, `people_lost: 0`.

## The recovery lane

11 contact points, 1 email address, 6 people, against 82 points and 18 addresses over the
prior week. Not a fault. The newest judged pass walked 150 leads, found **656 contact methods
and 651 were already on file**. It is lap 12 of a 2,398-lead book at 100% re-walk, with
`cause: resolution_ok`, 3.3% of leads carrying no website, zero Brave refusals, 6 searches,
and `stranded` held at 3.

Yesterday's redirect fix (`e2a9b55`, email repo, committed 10-26T07:37Z) is moving the right
way. The `cross-domain redirect` condition was **100 of 175 method faults (57%)** on the
10-26 pass and is **55 of 152 (36%)** today. These are different 150-lead slices, so this is
consistent with the fix rather than a measurement of it. What is left is concentrated: 14
leads hitting `01-mailto`, `02-subpages`, `16-jsonld` and `14-external-links` at 13 to 14
each, which is the creators' own branded shorteners the fix deliberately left alone.

The largest single fault cause is now `28-sitemap: fetch failed` at 21 of 152 (14%), a flat
spread of the web being the web rather than one thing to chase.

## What was fixed

### The fleet block counted moves, not outcomes (`dc1e312`, orchestrator)

`band_moved_to_normal` says a mailbox was handed a band, not that it kept it. This morning the
snapshot read `band_moved_to_normal: 6`, `band_normal_change: 0`, and named all six returners
in `band_returned`. Read plainly that says six came back while six unrelated ones fell. **Five
of the six that came back were the ones that fell**, and the clear count had reached 19
mid-afternoon while the published figure was a flat 13 against 13.

This is not a cosmetic misread. Yesterday's **#1 recommendation** was "if those mailboxes come
back, capacity roughly doubles", and the published fields said they came back. The next reader
would have filed the prediction as confirmed and moved on.

Added to `scripts/autopilot/debrief-data.ts`:

- `band_peak_normal` / `_at` — the highest clear count any gate run inside the cycle reached,
  so a fleet that rose and fell cannot print flat. Today: 19 at 15:05Z.
- `band_returned_still_normal` — how many returners hold `normal` at the newest reading. Today: 1.
- `band_round_trips` / `band_round_trip_ids` — returners demoted again inside the same cycle.
  Counted only against a mailbox already handed `normal` earlier in the ordered walk, so an
  unrelated demotion cannot inflate it. Today: 5, named.

And the number the fleet decision actually turns on, which had been hand-queried out of
`automator`'s state file two mornings running (11 of 45 on 10-26, 8 of 45 today) with the
10-26 table printing "not measured" for the day before:

- `band_held_but_healthy` — held mailboxes at or above `recover.score_at_least`. Today: 8 of 45.
- `band_held_but_healthy_on_clock` — waiting out `recover.hours`, so they lift themselves. 7.
- `band_held_but_healthy_sibling` — held only because two addresses on their domain are sick,
  which is someone else's deliverability charged to a well mailbox. 1.
- `band_held_healthy_soonest_hours` — what the closest one still owes, read off the gate's own
  "47h of 48h at 90+" wording rather than a clock. Today: 1 hour.

Every new field is null rather than 0 without a cycle window or without the gate's per-mailbox
map, and that map is another repo's shape, so a rename there costs one null and never the
block. 6 regression assertions over the live 10-27 round-trip shape, the peak, a demotion of a
mailbox that was never handed `normal`, the held-but-well split, and both unknown cases. 223
assertions green, selftest ALL PASS, typecheck clean. Verified against the live state file:
peak 19, 5 round trips, 1 still normal, 8 held-but-healthy.

## What is open, and whose call it is

1. **Are the 45 held mailboxes recoverable, or is the answer new domains?** Casey's call. The
   evidence for asking: six cleared and five failed again the same day, the stopped band is at
   its highest, and the provider halved warmup volume on 23 mailboxes today against 14
   yesterday. The thirteen clean mailboxes are genuinely clean.
2. **If the recovery rule stays, make it prove itself under load.** The clean 48 hours should
   have to include real sending volume, or a returning mailbox should get a fraction of its
   allowance for a few days first. Both are edits in `automator`, outside the five repos.
3. **The branded-shortener question** is now the whole remainder of the redirect faults: 55 of
   152, on roughly 14 leads, permanently. The safe version requires the destination to pass the
   same ownership test a search result already passes. Data-quality call.
4. **Where the slots go when capacity returns.** 1,730 ready people are waiting, 672 in the top
   tier, and the top tier's re-offer queue takes slots ahead of never-emailed people in lower
   tiers. Today's 5.2% first-touch rate came from 60 emails, so the ratio improved rather than
   the volume.

## Safety and spend

- **$0 billed to the Anthropic API.** Zero fatal error signatures, no halt flag, no escalation.
- OpenRouter: $0.138 logged by the finder, **$1.72 a day account-wide**, balance **$65.13**,
  about 38 days of runway.
- Cost per enriched lead **$0.1684** over 30 days and 767 leads, against $0.1654 yesterday.
  The new estimator held to under 2% on its second day; the field it replaced swung between
  $0.32 and $3.74 within the month.
- Enrichment ran **0 batches**: 6,813 of 6,823 parked leads are already bundled (99.9%), so
  ten remain in the whole pool.
- Apify sat at its $10 reserve, 0 batches, 0 price strikes, not halted. The $100 allowance is
  the calendar month and refills on 11-01.
- YouTube key pool: 15 working of 66, settled and inert.
- Discovery wrote **0 new channels**, which is Casey's 2026-09-08 order working as intended.
