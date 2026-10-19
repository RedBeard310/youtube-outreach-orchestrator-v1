# Lead Run Analysis — 2026-10-19

Cycle window: 2026-10-18T07:00Z to 2026-10-19T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-19.json`.
Companion: [lead-run-2026-10-19.html](lead-run-2026-10-19.html).

## Headline

**149 channels grew past the 3,000-subscriber floor, and the snapshot reported the sweep
that found them as a 2,578-lead demotion.** Sunday is not a sending day, so the cycle's one
real event was the weekly floor sweep at 06:41Z: it re-read the live subscriber count on all
**66,488** parked channels, refreshed **38,485** of them, and found **149 that crossed the
floor**. While discovery is paused that lane is the only thing in the pipeline producing
people nobody has written to. The bulk-rewrite field printed the eight busiest seconds of
those 38,485 single-row updates: **2,578 leads to `below_threshold`, 128 with an email
address, `left_the_send_queue: true`**, which is the exact shape of the 2026-10-13 ICP audit
that demoted 881 real people. This one demoted nobody. **Fixed this cycle.** Separately the
fleet had its best morning in five weeks: **34 clear, watch band empty**, and all 25
mailboxes carrying Casey's own name are now in the clear half.

## The numbers

| | |
|---|---|
| Emails loaded | **0**. Sunday: `siege-plan.timer` is Mon-Fri, `binding_constraint: not_a_sending_day`, no plan on disk |
| Floor sweep | **66,488** channels re-checked, **38,485** counts refreshed, **149 crossed**, 66,002 still below, 337 gone from YouTube |
| What the snapshot printed | **2,578 rows, 6.7%** of the write, across 8 of its 155 one-second clusters, with nothing saying it was a sample |
| What the write moved | **0 people.** All 38,485 were already `below_threshold`; only `subscriber_count` changed |
| Band gate at 07:05Z | **34 normal / 0 watch / 24 stop** of 58; was 28 / 4 / 26 at the same hour a day earlier |
| Moves inside the cycle | **6 to normal, 0 to watch, 0 to stop.** Four off watch, two off stop, all six on Casey's own name |
| Clear half, spam | **0 of 1,767** warmup emails. Scores 96.7 to 98.4, zero volume cuts |
| Stopped half, spam | **101 of 269 (38%)**. Scores 35.5 to 92.2, median 52.8. **21 of 24 carry an InboxKit volume cut, 9 written this cycle** |
| Name on the mailbox | Clear: **25 Casey, 9 made-up**. Stopped: **0 Casey, 24 made-up** |
| People parked | **1**; `approved_hold` 6,814 to 6,815; `needs_contact` held at 3,437 |
| Recovery lane | newest pass 150 leads, **324 points found on 103 of them / 310 already stored**; lap 10 of a 2,411 book; `cause: resolution_ok`, 99 Brave searches, 0 refusals, **71 of 80 candidate sites refused by the ownership gate** |
| Free collection | 27 points across 8 people, 5 of them addresses on 4 people, against 275 points / 122 addresses over the prior 7 days |
| Shelf, never emailed | **5,142** (was 5,141); `already_sent` 1,663, unmoved |
| Enrichment | 1 batch, **1 lead done, 0 failed**. 6,805 of 6,815 bundled, **99.9%** |
| Spend | $0.00 Anthropic (36th cycle). OpenRouter $1.31 account-wide, $78.61 left, 60 days of runway. Apify dry to 31 Oct, `spendable: -$0.0002`, 0 price strikes |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched |

## What the day actually was

**No send, by the calendar.** `siege-plan.timer` runs `Mon..Fri` and SmartLead delivers
Monday to Thursday, so Sunday produced no plan and no emails. The snapshot states that
rather than implying it: `sending_day: false`, `binding_constraint: not_a_sending_day`,
`plan_found: false`. The only send this repo ran was its own session-start `npm run send` at
07:20Z, which found 0 parked leads and exited 0. That is correct, because the shelf is fired
by Siege.

**One enrichment batch, one lead.** Exit 0, nothing failed. 6,805 of the 6,815 people in the
hold pool already have a bundle. The lane the discovery pause redirected everything into has
finished.

**02:01Z, the recovery pass.** 150 leads walked. Its methods found **324 contact points on
103 of the 150 leads, and 310 were already on file**, so one lead produced the 14 that were
new. That is a full re-walk of a picked-over book rather than a broken pass, and the
distinction is exactly what `methods_found` exists to make (added 2026-10-08 after a pass
read "0 points from 0 leads" with healthy methods). Brave resolved normally: 99 searches, 0
key refusals, `cause: resolution_ok`. Worth recording anyway: **the ownership gate refused 71
of the 80 candidate sites Brave returned**, the 2026-10-10 shape. The gate is deliberate and
no amount of search credit changes it.

**Through the day, six mailboxes came back.** Two at 10:05Z, one at 11:05Z, one at 15:05Z,
two at 00:05Z. Four came off watch and two off stop. Every one carries Casey's own name.
Saturday's debrief predicted the clear half would reach 31; the gate delivered 34 and emptied
the watch band entirely.

**06:41Z to 06:43Z, the day's real event.** `graduate-channels-weekly.sh` in the lead-finder
fires on Mondays. It re-reads the live subscriber count for every channel parked below the
3,000-subscriber floor, 50 at a time, and sends the ones that have grown back through
scoring. Pass 1 checked 66,488 channels for 1,330 quota units, updated the 38,485 whose count
had changed since last Monday, and found 149 over the floor. Pass 2, the re-scoring, was
still running at 07:31Z, so the graduations themselves land in the next cycle.

**Two of them have already been emailed.** This repo's 07:20Z session-start send found two
leads the sweep had restored to `approved`, composed both on the `nick_saraev` variant and
pushed them to SmartLead by 07:21Z: *Remote Cleaning Boss* (score 9) and *Carolyn Smith |
Space Coast Lifestyle* (score 7). Found, re-scored, written and loaded with nobody watching.
That is past the cycle boundary, so it counts tomorrow.

## Why the snapshot called a sweep a demotion

`parked.bulk_status_writes` exists because of 2026-10-13, when the shelf fell 800 in a cycle
and the only instrument that could see it read `parked_today: -800`. A bare negative there
reads as the send path draining the bank, which is the one explanation ruled out, because
sending never moves a lead out of `approved_hold`. The real cause was an ICP audit that
flipped 881 leads to `rejected` in one statement, 720 of them already emailed. Finding it
took an hour of hand SQL across four repos.

The detector built for it keys on the shape of the write: per-lead work spreads across
seconds, and one `UPDATE` over a thousand rows lands on a single second, so a second holding
50 or more status rows is a bulk reclassification by definition. Group by that second, take
the eight biggest, read the leading `[tag]` out of `notes`.

That is right for one statement and wrong for a writer that pages. The floor sweep issues one
`UPDATE` per channel, so its 38,485 writes landed in **155 separate seconds over 154 seconds
of wall clock**, each one easily past the 50-row bar. The list kept the eight biggest and
reported 2,578 leads, 6.7% of the truth, with `left_the_send_queue: true` and 128 of them
carrying an email address. No field on the line said it had been cut.

Both writes print the same sentence. Only one of them cost anything:

| | 2026-10-13 ICP audit | 2026-10-19 floor sweep |
|---|---|---|
| Rows written | 881 | 38,485 |
| Clusters | **1** | **155**, over 154 seconds |
| Reported | 881, all of it | **2,578, 6.7% of it** |
| `already_emailed` | **720** | **0** |
| Stamp in `notes` | `[NOT ICP 2026-10-13]` | none |
| People actually moved | **881** | **0** |
| Destination population | grew by 881 | flat |

The one honest hint was already on the line and says nothing by itself: `already_emailed: 0`
on all eight rows. A real reclassification of leads that have email addresses catches people
we have written to.

## What shipped this cycle

**The whole bulk rewrite, and whether it moved anybody** (orchestrator, `604bbdc`).

Two new queries in `src/db.ts` and one pure classifier in
`scripts/autopilot/debrief-data.ts`:

- `bulkStatusWriteRollup()` rolls the same window up per destination status with **no cap**,
  reporting `rows_in_window`, `clusters`, `rows_in_clusters`, `first_at`, `last_at` and
  `span_seconds`.
- `reviewStatusPopulation()` writes the live population of every `review_status` into the
  snapshot, as the baseline tomorrow needs.
- `bulkRewriteShape()` joins the two to the capped cluster list and adds `truncated`,
  `clusters_reported`, `rows_reported`, `population_now` / `_prev` / `_change`, plus two
  verdicts:
  - **`shape`** from the cluster count. One statement cannot spread over 155 seconds and a
    paged re-walk of a 66,488-row book cannot land on one. `one_statement` at 1 to 2
    clusters, `few_statements` at 3 to 9, `batched_sweep` at 10 or more. The 10-13 audit was
    1; today was 155.
  - **`moved`** from the destination status's own population against yesterday's snapshot.
    38,485 rows written with the population flat is `restamp`; 881 rows written into
    `rejected` while that population grew by 881 is `migration`. Bands rather than a ratio,
    so a tiny rewrite cannot divide its way to a verdict, and `unknown` with no baseline.

`moved` is **`unknown` today**, because this is the first cycle that writes the baseline.
That is the honest answer, and the same rule the rest of this file follows: unknown and
measured-as-nothing differ. The first usable verdict lands on 2026-10-20.

This is the 2026-10-18 `band_normal_prev` lesson in a new place. That fault was subtracting
two different instruments read at two different hours; this one is reporting a sample as if
it were the whole, and both were only findable by hand.

Verified against live data: `rows_in_window: 38485`, `clusters: 155`, `span_seconds: 154`,
`truncated: true`, `clusters_reported: 8`, `rows_reported: 2578`, `shape: batched_sweep`,
`moved: unknown`. Eight regression cases added to `debrief-data.selftest.ts` (the sweep is a
sample and reads as one; no baseline leaves `moved` unknown and never `restamp`; a flat
population beside 38k writes is a re-stamp; the 10-13 audit is one statement and a migration;
a half-and-half rewrite is `mixed`; a failed query is null, not an empty day; a status the
prior snapshot never listed is unknown, not zero; 3 to 9 clusters is not a sweep). Full suite
passes, `tsc --noEmit` clean. The `bulk_status_writes` comment now carries the reading rule,
so a future cycle cannot re-derive this by hand.

**Nothing was wrong with the sweep itself.** It already guards its write
(`if (fresh !== row.subscriber_count)`), so the 38,485 rows it touched are channels whose
subscriber count genuinely changed in a week. The write is real and useful. It just is not a
status change, and the instrument that read it could not say so.

## Still open, outside this agent's repos

- **The made-up-name domains.** 24 of 33 stopped at 38% spam, 21 carrying an InboxKit volume
  cut, 9 of those written this cycle, and the half got worse in 24 hours while suspended.
  Resting a domain means turning warmup down at InboxKit, which no repo here owns.
- **Campaign 4010851**, from Friday: 4 people loaded, never started after a SmartLead 429,
  counted as sent so nothing else will pick them up. Three days old.
- **Siege's slot order has no first-touch term** (`priority_key` in
  `automator/scripts/siege.py`). 5,142 enriched people have never been written to and the
  shelf gained 1 all weekend.
- **The floor sweep has no debrief line of its own.** It is now the pipeline's only source of
  net-new sendable people, it runs once a week unattended, and nothing watches its yield.

## Ranked next

1. **Decide about the made-up-name domains.** Third day on this list. All 25 mailboxes with
   Casey's name are clear at 0 of 1,767 in spam; 24 of the 33 made-up ones are stopped at 38%
   and a median score of 52.8. The new fact is movement: that half degraded in a day and took
   nine fresh volume cuts while suspended, because warmup keeps running. Rest them at
   InboxKit or retire the domains. Until then the fleet's ceiling is about 34.
2. **Treat the floor sweep as a lane.** 149 channels over the floor for 1,330 quota units and
   a few cents of scoring, two of them already written and pushed by 07:21Z. Weekly, Mondays,
   unwatched. It is the only producer left, and it is not what the discovery pause stops.
3. **Monday's push is the first real send in three days.** 34 clear mailboxes is the most in
   five weeks, and two weekends of follow-ups land on top of Monday's own. Read
   `mailbox_capacity` against `followups_due`, not the slot remainder.
4. **A first-touch term in Siege's slot order.** 5,142 never written to, shelf +1 all weekend.
5. **Restart campaign 4010851.** Three days old.
6. **Decide about the discovery pause.** Stated job done at 99.9% enriched. Both
   shelf-refilling lanes are spent for now: a book on its tenth lap finding 14 new points in
   324, and a paid lane with nothing spendable until 31 October. Flag untouched.
7. Six cycles have metrics and no debrief (09-17, 09-18, 09-19, 08-17, 08-18, 07-11).
   Backfillable any time.
