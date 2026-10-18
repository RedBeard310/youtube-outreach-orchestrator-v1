# Lead Run Analysis — 2026-10-18

Cycle window: 2026-10-17T07:00Z to 2026-10-18T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-18.json`.
Companion: [lead-run-2026-10-18.html](lead-run-2026-10-18.html).

## Headline

**Nothing sent, nothing supposed to, and the gate handed back ten clean mailboxes.**
Saturday is not a sending day. The cycle's one real event was at 23:05Z, when nine
mailboxes moved from watch back to normal in a single hourly run, and a tenth followed at
00:05Z. Monday opens with **28 mailboxes allowed to start a new person against the 18
Friday's push had**. None of the ten had healed: all were at 96.7 or better with zero spam
landings the whole time, and they were held only because the gate's 48-hour recovery clock
cannot credit clean time from before its own first run. **And the fleet's two halves no
longer overlap on any measure:** the 28 clear mailboxes put 0 of 1,490 warmup emails in
spam, the 26 stopped ones put 114 of 306, and all 20 of InboxKit's own volume cuts sit on
stopped mailboxes carrying a made-up name.

## The numbers

| | |
|---|---|
| Emails loaded | **0**. Saturday: `siege-plan.timer` is Mon-Fri, `binding_constraint: not_a_sending_day`, no plan on disk |
| Band gate at 07:05Z | **28 normal / 4 watch / 26 stop** of 58; was 18 / 14 / 26 at the same hour a day earlier |
| Moves inside the cycle | **10 to normal, 0 to watch, 0 to stop**; nine at 23:05Z, one at 00:05Z |
| Who came back | 6 on Casey's own name, 4 made-up. All at 96.7 or 98.4, zero spam across 39 to 56 warmup emails |
| Why they had been held | All ten carried `score_clean_since = 2026-10-15T22:57:06Z`, the gate's first run. 48 hours later the cohort aged out together |
| Clear half, spam | **0 of 1,490** warmup emails. Scores 96.7 to 98.4 |
| Stopped half, spam | **114 of 306 (37%)**. Scores 40.8 to 96.7, median 59.1 |
| InboxKit volume cuts | **20 mailboxes**, every one in the stop band, every one a made-up name. **8 written this cycle**, 7 reading `CRITICAL` at 53% to 72% |
| People parked | **3**; `approved_hold` 6,811 to 6,814; `needs_contact` 3,440 to 3,437 |
| Recovery lane | newest pass 150 leads, **638 points found / 636 already stored**; lap 10 of a 2,414 book; `cause: resolution_ok`, 4 Brave searches, 0 refusals |
| Free collection | 12 points across 11 people, 2 of them email addresses, against 278 points over the prior 7 days |
| Shelf, never emailed | **5,141** (was 5,138 for three mornings); `already_sent` 1,663, unmoved |
| Enrichment | 2 batches, **3 leads done, 0 failed**. 6,804 of 6,814 bundled, **99.9%** |
| Spend | $0.00 Anthropic (35th cycle). OpenRouter $0.92 account-wide, $79.92 left, 87 days of runway. Apify dry to 31 Oct |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched. |

## What the day actually was

**No send, by the calendar.** `siege-plan.timer` runs `Mon..Fri` and SmartLead delivers
Monday to Thursday, so Saturday produced no plan and no emails. The snapshot states that
rather than implying it: `sending_day: false`, `binding_constraint: not_a_sending_day`. The
only send this repo ran was its own session-start `npm run send` at 07:20Z, which found 0
parked leads and exited 0. That is correct, because the shelf is fired by Siege.

**Two enrichment batches, three leads.** 18:15Z took 1 lead, 22:13Z took 2, both exit 0
with nothing failed. The chain's own log reads `pool=4 excluded=3` and
`pool=5 excluded=3`, which is the whole of the remaining work: 6,804 of 6,814 people in the
hold pool already have a bundle. The lane the discovery pause redirected everything into
has finished.

**05:00Z, the recovery pass.** 150 leads walked, 638 contact points found, 636 of them
already on file. Two leads produced something new. Brave resolved sites normally (4
searches, 3 candidates, 2 accepted, 1 social-only, 0 refusals) and the lane is on its tenth
lap, so this is a full re-walk of a picked-over book rather than a fault. The largest error
cause was `28-sitemap: cross-domain redirect` at 18% of 142 errors spread over 15 causes,
which is a flat spread and not one thing to chase.

**23:05Z, the day's real event.** Nine mailboxes moved back to normal in one run:
`casey.brown@contentgetsclientsvideo.com`, `casey_brown@hicontentgetsclients.com`,
`casey_brown@startcontentgetsclients.com`, `caseybrown@contentgetsclientsvideo.com`,
`caseybrown@hicontentgetsclients.com`, `erickwuckert@youtubegetsleads.com`,
`jeffkling@clientsfromvideo.com`, `josephmcglynn@youtubegetsleads.com` and
`juliuskoch@clientsfromvideo.com`. `casey_brown@contentgetsclientsvideo.com` followed at
00:05Z. Before that run, the band counts had printed `26 stop, 14 watch, 18 normal`
unchanged for every hourly run since 2026-10-16 22:05Z.

## Why ten came back at once

The recovery rule in `automator/config/inbox-health.json` is a clean reading plus a score
of 90 or better held for 48 hours without a break. Every one of the ten had been clean
continuously, at 96.7 or 98.4, with zero spam landings across 39 to 56 warmup emails. They
were in the watch band because the gate inherited them there when it took over at
2026-10-15T22:57Z, and it cannot prove a mailbox was clean before its own first reading. So
all ten carried `score_clean_since = 2026-10-15T22:57:06Z`, and 48 hours after that stamp
the whole inherited cohort cleared together.

That is defensible behaviour for a gate with no history. The cost is worth naming: those
ten were on follow-ups-only when Friday's push ran, which is a large part of why it printed
18 live mailboxes and 82 slots. The effect is one-time and has already passed. It returns in
full any time that state file is reset, which is the reason it is written down here.

The three remaining `recovering` mailboxes read `44h of 48h at 90+` and `46h of 48h`, so
they clear within hours and take the clear half to 31. The fourth watch mailbox,
`caseybrown@contentgetsclientsdigital.com`, has 1 of 23 warmup emails in spam and restarted
its clock on 10-16.

## The fleet's two halves

Friday's debrief found the collapse was one-sided. A day later it is sharper than that:
sorting the 58 mailboxes by band separates every measure completely, with nothing in the
middle.

| Measure | The 28 clear | The 26 stopped |
|---|---|---|
| Warmup emails in spam | **0 of 1,490** | **114 of 306**, 37% |
| Health score range | 96.7 to 98.4 | 40.8 to 96.7, median 59.1 |
| Name on the mailbox | 21 Casey, 7 made-up | 1 Casey, 25 made-up |
| InboxKit volume cuts | 0 | 20 of 26 |

The volume cuts are the independent check. InboxKit runs its own judgement on warmup
placement, separate from this gate, and it has cut volume on 20 mailboxes for a high spam
rate. All 20 are stopped, all 20 carry a made-up name, and not one clear mailbox has a cut.
Two systems looking from different angles picked the same 20.

**The stopped half is not resting.** Eight of those cuts were written during this cycle:
`mariobednar@videoleadsagency.com` 72%, `anthonyokon@videoleadsagency.com` 70%,
`karlyost@videobookscalls.com` 59%, `martylynch@contentgetsleads.com` 57%,
`christianlynch@tubeleadsagency.com` 56%, `clintonrussel@videobookscalls.com` 56%,
`shanebogan@tubeleadsagency.com` 53%, `neilgoldner@tubegrowthagency.com` 20%. Suspending a
mailbox in SmartLead stops cold email; it does not stop InboxKit warmup. Those domains are
still sending into spam filters at half volume. Leaving them alone is a choice with an
ongoing cost, not a neutral hold.

## What shipped this cycle

**The band gate's own day-over-day move, in the snapshot** (orchestrator,
`scripts/autopilot/debrief-data.ts`).

The fault: on a non-sending day there is no plan, so `band_normal` is the only live fleet
number, and the only prior number sitting beside it was `live_inboxes_prev: 18`, which is
Siege's plan-time count from Friday. Subtracting those two says "+10 inboxes" about two
instruments read at two different hours. That is the 2026-10-16 fault in a new place, and
the real move could only be found by hand-reading 40 lines of the gate's log, which is the
same shape as the 2026-10-15 `top_method_fault_cause` lesson.

The fix: `bandGateFacts` now reads the gate's own retained run history and reports

- `band_normal_prev` / `band_watch_prev` / `band_stop_prev` / `band_prev_at`, taken from the
  run closest to 24 hours back inside the same 12-to-36-hour window `delta_comparable`
  already uses, so the two blocks cannot disagree,
- `band_normal_change` / `band_stop_change` and `band_gap_hours`,
- `band_delta_comparable`, false when no run qualifies,
- `band_moved_to_normal` / `_to_watch` / `_to_stop`, counted over the runs inside the cycle
  window, and `band_returned` naming the returners up to 12,
- all of the move fields null rather than 0 when no window is supplied, because unknown and
  measured-as-nothing differ.

Verified on live state: `28` against `band_normal_prev: 18`, `band_normal_change: +10`,
`band_gap_hours: 24.0`, `band_delta_comparable: true`, `band_moved_to_normal: 10` with all
ten named. Four regression cases added to `debrief-data.selftest.ts` (the baseline is the
nearest-24h run and not the neighbouring hour; moves are counted by direction; no window
means null not zero; no qualifying run means not comparable). Full suite passes, `tsc
--noEmit` clean. The `send_plan.note` carries the new reading rule, including why ten
mailboxes cleared in one hour, so a future cycle does not re-diagnose it.

## Still open, outside this agent's repos

- **The 48-hour recovery clock's cold start** (`automator/config/inbox-health.json`,
  `recover.hours`). Self-clearing and already cleared. Returns if the state file is reset.
- **Campaign 4010851**, from Friday: 4 people loaded, never started after a SmartLead 429,
  counted as sent so nothing else will pick them up.
- **Siege's slot order has no first-touch term** (`priority_key` in
  `automator/scripts/siege.py`). 5,141 enriched people have never been written to.
- **Warmup keeps running on suspended mailboxes.** Resting a domain means turning warmup
  down at InboxKit, which no repo in this pipeline owns.

## Ranked next

1. **Decide about the made-up-name domains.** Two independent systems sorted the same 26
   mailboxes into the same bucket, the clear half has put zero of 1,490 warmup emails in
   spam, and the stopped half is still sending. Rest them at InboxKit or retire the domains.
   Until then the fleet's ceiling is about 32 mailboxes.
2. **Monday's push is the test of the +10.** Read `mailbox_capacity` against
   `followups_due`, not the slot count alone: a weekend of due follow-ups lands on Monday on
   top of Monday's own.
3. **A first-touch term in Siege's slot order.** The shelf moved by 3 all weekend.
4. **Restart campaign 4010851.** Two days old.
5. **Decide about the discovery pause.** Its stated job is finished at 99.9% enriched, and
   both shelf-refilling lanes are spent for now: a book on its tenth lap finding 2 new
   points in 638, and a paid lane with nothing spendable until 31 October. Flag untouched.
6. **Watch the last four on watch.** Three clear within hours, taking the clear half to 31.
7. Six cycles have metrics and no debrief (09-17, 09-18, 09-19, 08-17, 08-18, 07-11).
   Backfillable any time.
