# Lead Run Analysis — 2026-10-16

Cycle window: 2026-10-15T07:00Z to 2026-10-16T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-16.json`.
Companion: [lead-run-2026-10-16.html](lead-run-2026-10-16.html).

## Headline

**160 emails loaded, against 64 the day before, and the push used every free slot the
fleet had.** Nothing failed, nothing was refused, no draft was turned down. The fleet was
flat at push time, 42 live mailboxes against 43 the morning before, so yesterday's
three-day slide did not continue through the day that sent. What changed is who decides
the fleet: at 22:57Z, eleven hours after the push, a new band-based inbox gate in
`automator` ran for the first time, took over the old gate's health suspensions, and now
holds **22 of 58 mailboxes in a stop band with 18 more on watch**. The next push's ceiling
is 100 slots instead of 160.

## The numbers

| | |
|---|---|
| Emails loaded | **160** by Siege, 10:24Z to 11:28Z; 160 planned, 160 sent, 0 failed, 0 skipped |
| Push losses | **none**, for the first time in four cycles. No 429s, no manifest misses, no quality-gate rejections |
| Fleet at push time | **42 live mailboxes** (was 43), 630 msg/day allowance, 160 free slots after the queue |
| Fleet by 23:00Z | **21 live**, 315 allowance, 100 slots, after the new gate's first run |
| New band gate | first run 22:57Z; **22 stop / 18 watch / 18 normal** of 58 at 07:05Z; owns 22 suspensions |
| Old health gate | 4 suspended, 4 resumed at 09:46Z; 2 on health, **2 unexplained** (reasons adopted away) |
| People parked | **3**; **24 people got an address** (30 addresses) from 6 methods, best in a fortnight |
| Recovery lane | 4 passes, 552 leads, 62 new points; newest pass 704 found / 693 already stored (98% re-walk); lap 10 |
| Shelf, never emailed | **5,138** (was 5,135); ~3.5 weeks at last week's pace, ~13 weeks at 100 slots |
| Enrichment | 2 batches, 3 people, 0 failures. **6,801 of 6,811 bundled, 99.9%.** OpenRouter $0.00, 0 calls |
| `needs_contact` | 3,440; `collect_book_stranded` held at 3 for the 33rd day |
| Spend | $0.00 Anthropic (33rd cycle); OpenRouter $80.84 left; Apify dry to 31 Oct |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched. |

## What the day actually was

**10:15:47Z, the rehearsal.** Siege's dry run printed `inboxes live today: casey 25,
made-up 17` and a ceiling of 870 for sending day 16, then: after SmartLead's queue of 155
unsent first emails and 1,128 mid-sequence messages, **160 slots for new offers**. Six of
seventeen offers could run; the other eleven are blocked on Notion status, a missing
batch writer, or a hard gate.

**10:24:19Z to 11:28Z, the live push.** 160 `SENT` lines in `automator/logs/siege.log`,
zero `FAIL`, zero `SKIP`, zero escalations. The database agrees exactly: 160 people carry
an `outreach_processed_at` inside the cycle. 164 whale-tier people were ready against 160
slots, so capacity was the ceiling and it was used to the last slot.

**Four recovery passes, 07:01Z to 03:01Z.** 552 leads walked, 62 new contact points, 30
of them email addresses across 24 people, 3 of whom parked. `28-sitemap` and `18-rdap`,
both repaired on 10-12, found 25 of the 30 addresses. `17-podcast`, which got its Apple
rate-limit queue yesterday, found 3 with zero refusals logged, against 165 leads it never
reached the day before.

**22:57:06Z, the new gate.** `automator/scripts/inbox-health.py` ran for the first time,
adopted 16 health suspensions out of the old gate's ledger, and banded all 58 mailboxes.
It has run hourly since and moved three more into stop on its own. Its thresholds are
stricter in practice than the old single bar of 90: stop at a score under 80 or two spam
hits in three days, watch at under 90 or one hit.

**22:59:33Z, the artifact.** A dry run re-planned the day and **overwrote
`state/siege/2026-10-15/plan.json`**, which is the file the debrief reads. Its fleet is
the post-gate one: 21 live, 315 allowance, 100 slots. The morning plan, the one the push
flew with, no longer exists on disk.

## The one new finding

**The fleet instrument was comparing two different times of day, and the shape it
produced was indistinguishable from a real collapse.**

`fleetFacts()` shipped yesterday and reported, on its second day, `-22` live inboxes and
`-330` messages against yesterday's snapshot. Both halves of that subtraction are real
readings of real files. Neither is a day-over-day move:

| | Written at | Live inboxes | Allowance |
|---|---|---|---|
| 10-14 plan (yesterday's baseline) | 10:36Z, before that day's push | 43 | 645 |
| 10-15 plan (today's reading) | **23:00Z, after that day's push** | 21 | 315 |
| 10-15 **at push time**, from the log | 10:17Z and 10:25Z | **42** | 630 |

The real move overnight into Thursday was one mailbox. The 22 landed at 22:57Z, inside
this cycle's last four hours, and it prices the next push rather than the one that ran.

The giveaway was in yesterday's snapshot and nobody read it: `planned` was 100 while
`sent_in_cycle` was 160. A plan cannot send more emails than it holds, so the file on
disk was announcing that it was not the plan that was pushed.

**The same cycle surfaced a second instrument fault with the same root.** The health
split read `gate_paused: 4` beside `0` on health and `0` on warmup. All four were health
suspensions, one as low as 73.4. The split reads reasons out of the old gate's
`pausedByGate` registry, and the new band gate's `adopt()` moves health-only suspensions
into its own ledger and deletes them from that registry, because with the old gate's
health rule retired it would otherwise resume them. Nothing had been written to that
registry since 2026-09-08 while the history recorded suspensions on six of the last eight
days. It also rewrites the past: yesterday's debrief read 13 of 13 on health and was
right at the time, and the same run re-read this morning reports 0 and 0.

## Fixes shipped

**1. Plan-snapshot alignment** (orchestrator, `scripts/autopilot/debrief-data.ts`).
`SiegePlanFacts` now carries `plan_generated_at`, `priorSendPlan()` carries the previous
one, and `FleetFacts` adds `snapshot_gap_hours`, `replanned_after_push` and
`delta_comparable`. A delta is comparable only when the two stamps are 12 to 36 hours
apart and the newer one does not post-date the push that sent in the cycle. The push stamp
is passed only when `push_unit_result` is non-null, so a weekend reports unknown rather
than a stale weekday stamp. A snapshot written before today reports `null`, which makes
comparability unknown rather than assumed true. Verified on live data:
`replanned_after_push: true`, `plan_generated_at: 2026-10-15T23:00:43Z`.

**2. The pause-reason split can no longer answer "neither"** (same file).
`inboxGateFacts()` takes a second reason book, and `bandGateFacts()` reads the new gate's
own ledger (`automator/state/inbox-health.json` → `owned`) to supply it. Reasons are
resolved old-registry-first, then the band ledger. Any suspension whose reason is in
neither is counted in `gate_paused_unexplained`, and health + warmup + unexplained now
always equals `gate_paused`. Live data: 2 health, 0 warmup, 2 unexplained, which is the
honest answer because the new gate has since released those two and their reasons are
gone from both files.

**3. The band gate is now in the snapshot** (same file). `band_stop`, `band_watch`,
`band_normal`, `band_gate_owned` and `band_gate_run_at`. This is the instrument that
actually sizes the fleet from here: 22, 18, 18, 22 and `2026-10-16T07:05:14Z` today. Read
filesystem-only, no `automator` import, every field optional on the way in, so a rename
in that repo costs one null rather than the block.

All three are covered by 11 new selftests (adoption with no reasons left, the band ledger
supplying them, the split always reconciling, a plan written after the push, two morning
snapshots a day apart, a missing stamp, no push in the cycle). Full selftest suite passes
and the whole gatherer re-ran clean end to end.

## Still open

- **Siege overwrites the plan it pushed**, including from dry runs, so by evening the
  morning's plan is unrecoverable. Lives in `automator/scripts/siege-plan.py`, outside the
  five repos this agent may edit. The new stamp makes the overwrite visible rather than
  silent, which is as far as this repo can go.
- **The new band gate's thresholds are stricter in practice than the old gate's** and it
  has taken three more mailboxes since starting. Worth a look before it takes more.
- **The plan-and-manifest disagreement.** Quiet today, 9 on 10-15 and 131 on 10-07.
  `automator`.
- **Campaign `START` has no rate-limit retry.** Carried from 10-10, `automator`.
- **The 10-13 fit rubric still gates nothing.** Carried; only 3 people parked today.
- **Three quiet collection methods:** `04-holehe` (58 days), `26-instagram` (28),
  `19-github` (20).

## Ranked next

1. **Decide what to do about the discovery pause.** Its stated job, enriching the leads we
   already have, is finished: 6,801 of 6,811 bundled, and the enrichment chain took 3
   people this cycle because there is nothing left. The two lanes that refill the shelf
   are a book on its tenth lap at 98% re-walk and a budget that is dry until 31 October.
   The flag is untouched and will stay that way until you say otherwise.
2. **Look at the new band gate before it takes more mailboxes.** 22 of 58 stopped and 18
   watched is the ceiling on everything downstream.
3. **Keep spreading the push.** 160 slots on Thursday against 67 on Wednesday is the
   782-day's follow-up bill working its way out. Four days of 160 beats one day of 640.
4. **Have Siege keep the plan it pushed**, or at least refuse to let a dry run overwrite a
   live one.
5. **Decide whether to spend on refilling the shelf.** 19 cents a person, 5,138 to go.
6. **Fix the plan-and-manifest disagreement** in `automator`.
7. One dry run each on the three quiet methods. `18-rdap` and `17-podcast` both looked
   dead before their fixes and found 15 addresses today.
8. Six cycles have metrics and no debrief (09-17, 09-18, 09-19, 08-17, 08-18, 07-11).

## Verified vs assumed

**Verified:** the 160, counted as `SENT` lines in the push log and cross-checked against
160 `outreach_processed_at` stamps in the database, with zero `FAIL` and zero `SKIP`; the
42 live mailboxes at push time, printed twice by Siege itself at 10:17Z and 10:25Z; the
160 free slots and the 155 / 1,128 queue behind them, from the same lines; the 23:00:43Z
re-plan and that it came from a dry run started at 22:59:33Z; the band gate's first run at
22:57:06Z, its 16 adoptions, and its hourly runs since, from its own state file; that the
four 10-15 suspensions are absent from the old gate's registry and that nothing has been
added to that registry since 09-08; the 30 addresses, 24 people and which method found
each; the 98% re-walk and the three Brave searches; the 99.9% bundled figure; both fixes
on live data and the full selftest suite.

**Assumed:** that the new band gate's suspensions and the old gate's are counting the same
58 mailboxes consistently. The two files agree on 22 owned and 22 in stop today, but the
old gate's 35 standing entries predate the new gate and overlap it, so the sum of "paused"
across both is not a number to quote. `band_stop` is. Also assumed: that today's 100 slots
hold. The band gate runs hourly and has moved three mailboxes in seven hours, so the
figure is a reading, not a forecast.

**One caveat on the snapshot file.** `logs/autopilot-debrief-2026-10-16.json` was
regenerated at 07:27:52Z, seven minutes after the timer's own 07:20:01Z run, so the copy
on disk now carries the three new instruments. Every figure this debrief quotes was
compared against the 07:20Z original and all were identical (sent 160, parked 3, shelf
5,138, 62 points, 30 addresses, 24 people, pool 2,419, stranded 3).
