# Lead Run Analysis — 2026-10-14

Cycle window: 2026-10-13T07:00Z to 2026-10-14T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-14.json`.
Companion: [lead-run-2026-10-14.html](lead-run-2026-10-14.html).

## Headline

**782 emails loaded into SmartLead in one push, the largest on record**, beating 613
on 10-09 by a quarter. Nothing was refused by SmartLead. **At the same time the parked
pool fell 7,604 to 6,804**, and the single instrument covering that read `-800`, which
reads as the send path draining the bank. It cannot be: sending never moves a person out
of `approved_hold`. The real cause was **Casey's own fit audit at 16:26Z, which rewrote
881 people to `rejected` and paused 684 live sequences**.

## The numbers

| | |
|---|---|
| Emails loaded | **782** by Siege at 10:15Z, plus 1 from this repo's session-start send |
| Push losses | 0 refused by SmartLead; 8 refused by us; 1 batch of 5 lost to an unretried 429 |
| Rejected as not a fit | **881** at 16:26:29Z, one statement; 720 already emailed; 684 sequences paused |
| People parked | **8** (4 on 10-13); 7 trace to the two 10-12 method fixes |
| Recovery lane | 71 contact points, **53 addresses on 14 people** (prior 7 days: 35 addresses) |
| Shelf, never emailed | **5,171**, down 844; about **4.9 weeks** at ~1,060 new people a week |
| `needs_contact` | 3,447 |
| Spend | $0.00 Anthropic; OpenRouter $3.51/day, $84.19 left (~24 days); Apify dry to 1 Nov |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes, `collect_book_stranded` held at 3 |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched. |

## What the day actually was

Two unrelated events seven hours apart, folded into one number by the morning report.

**10:15Z, the push.** 782 `SENT` lines in `automator/logs/siege.log`, agreeing with the
database's 783 people carrying an `outreach_processed_at` in the cycle. SmartLead's
account-wide limit of 200 requests a minute was hit four times on
`listCampaignMailboxes` and the 10-05 retry absorbed every one, under four times the load
that first exposed that bug.

**16:26:29Z, the fit audit.** One `UPDATE`, 881 rows sharing a timestamp to the
microsecond, `review_status` to `rejected` and `signal_score` to 0. Each row carries
`[NOT ICP 2026-10-13]` leading its notes plus a `not_icp` key in
`signal_v2_components`, naming one of five patterns: `product_seller`,
`showcase_no_teaching`, `direct_competitor`, `low_ticket_only`,
`faceless_view_monetized`. Two minutes later 684 live SmartLead sequences were paused,
0 failures.

**This is correct and must not be "repaired".** Enforcement holds on its own: Siege
selects only `approved_hold`, `approved` and `needs_contact`
(`automator/scripts/siege_tiers.py`, `SIEGE_REVIEW_STATUSES`), so `rejected` drops out
of every future plan. There is a working undo. The only failure was the measurement.

Side effect worth knowing: the audit overwrote `updated_at` on 436 people emailed hours
earlier, so their send timestamps are gone. Harmless, because `outreach_processed_at` is
the field anything reads, but `updated_at` is not a history.

## The one new finding

**The purge may not be a one-off.** The day after 881 unfit people were removed, the only
lane still adding people parked eight, and several read as the same profile against the
audit's own rubric: a yacht brokerage showing inventory, a speaker bureau showcasing
talent, a Disney travel agency on booking commissions, a travel vlog selling trip
planning. The rubric's headline bad-fit example is a boat retailer. Yesterday's park list
included Calibre Yacht Sales, still on the shelf and untouched by the audit.

That read is mine, from the leads' own stored summaries, and it is a flag rather than a
verdict: applying the rubric honestly needs a model call per person, and it is Casey's
ICP to define. What is measurable:

| Niche | Rejected | Still on shelf | Share rejected |
|---|---|---|---|
| Luxury Asset Brokerage | 20 | **36** | 35.7% |
| Relocation & Lifestyle Design | 72 | 219 | 24.7% |
| Other | 140 | 634 | 18.1% |
| Real Estate & Property | 204 | 1,391 | 12.8% |
| Health & Wellness Clinics | 126 | 1,015 | 11.0% |
| Coaching & Consulting | 153 | 1,307 | 10.5% |

**No code anywhere applies the rubric.** It exists as prose in
`/home/casey/backups/icp-audit-2026-10-13/rubric.md`. The scoring skill's
`isExcludedCategory` cannot catch these, because they score into valid niches, which is
the whole point of the audit. So the leak is still open and the recovery lane walks past
it.

## Fixes shipped

**1. `parked.bulk_status_writes`** (`95fc6f6`, orchestrator). `bulkStatusWrites()` in
`src/db.ts` reports any second carrying 50 or more `review_status` rows. Per-lead work
spreads across seconds, so a second that dense is a single statement by definition,
whoever ran it. Each row carries size, destination, how many were already emailed, and
the leading `[tag]` from the notes, so the write names itself. Verified on the live cycle:
returns the audit as `881 leads -> rejected, stamp [NOT ICP 2026-10-13]` and nothing
else. The 782-email push does not trip it. `tsc` clean, debrief selftest passes.

It reports the destination, not the origin, because nothing keeps lead history. That is
enough to separate "the shelf was reclassified" from "the shelf was sent", which is the
question that went unanswered.

**2. The sequence calls ride out a rate limit** (`16ad34cdc`, email repo). At 11:17:15Z
the sign-off guard `push-batch.ts` runs before a batch's first lead took
`429 Account rate limit exceeded`, had no retry, and the `owner-or-youtuber` batch died
with `pushed=0`: five researched, verified people dropped on a refusal lasting seconds.
The 10-05 fix wrapped add-lead and `listCampaignMailboxes` and left
`src/smartlead/sequences.ts` on bare `fetch`. All three calls now go through
`smartleadFetch`, the guard marked idempotent so it also rides out a 5xx. Three new tests
drive the real exported functions; 9 of 9 pass.

**3. The audit is recorded** (`95fc6f6`, `docs/icp-audit-2026-10-13.md`). What ran, where
the rubric, undo script and paused-sequence list live, the SQL that finds the population
without the folder, and what the audit did not close. Nothing in any repo mentioned it
before; it was found by grepping the whole home directory.

## Still open

- **`send_plan.planned` reads 75 against 782 sent.** Not a shortfall. Siege rewrote
  `plan.json` at 17:33Z, seven hours after the push, so it describes the aftermath: every
  mailbox at zero free slots, 796 people queued. The push log is authoritative. Fix
  belongs in `automator`, outside the five repos this agent may edit.
- **Em dashes in the writing skills.** Two of today's eight skips, third separate day.
- **Campaign `START` has no rate-limit retry.** Carried from 10-10, lives in `automator`.
- **Three quiet collection methods:** `04-holehe` (56 days), `26-instagram` (26),
  `19-github` (18).

## Ranked next

1. **Decide whether the fit rubric becomes a gate** at the moment a person is promoted
   into `approved_hold`. A handful of leads a day, so cents. Casey's call: too tight
   quietly discards good people.
2. **Decide what refills the shelf.** 5,171 left, about 4.9 weeks. Sixteenth consecutive
   debrief to raise it.
3. **Expect another dead Monday.** 782 first emails in one day is a week's worth; each
   person costs three messages across days 0, 4 and 10, and every mailbox is now full with
   796 queued. Same front-loading that left 10-12 room for 76.
4. **Re-check the 36 Luxury Asset Brokerage leads still on the shelf.** Smallest, densest
   slice of item 1.
5. Em dash fix in the writing skills.
6. One dry run each on the three quiet methods.
7. Retry on the campaign `START` call.
8. Six cycles have metrics and no debrief (09-17, 09-18, 09-19, 08-17, 08-18, 07-11).

## Verified vs assumed

**Verified:** the push size against both the log and the database; the audit as a single
statement, its size, its stamp, and that 720 of the 881 were already emailed; the 684
paused sequences; Siege's selector excluding `rejected`; the unretried 429 and the four
that were absorbed; today's 8 parks and the method behind each; the three collect passes
reconciling to 71 points and 21 people exactly; the niche shares; the new instrument on
live data.

**Assumed:** that several of today's 8 parks are a poor fit, read from their stored
summaries against the rubric, flagged rather than decided. The ~1,060 new people a week
is arithmetic off the fleet's 795-message daily allowance across four sending days at
three messages per person, so it assumes every sequence runs all three emails and nobody
replies out. Treat it as an upper bound.
