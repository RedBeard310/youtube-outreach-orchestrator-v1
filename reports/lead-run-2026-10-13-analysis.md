# Lead run analysis, cycle 2026-10-13

Companion to [lead-run-2026-10-13.html](lead-run-2026-10-13.html). Cycle window
2026-10-12T07:00Z to 2026-10-13T07:00Z, which is Monday 2026-10-12 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-13.json`.

Five readings were measured directly during this session and are named where they
appear: per-method contact-point production inside the window (SQL over
`leads.contact_points`, grouped by source and kind), the timestamp of every one of the
44 new points (same table, which is what pins the fixes to the passes), the four parked
leads and their flip times (`leads.lead_candidates.outreach_processed_at`), the
per-mailbox follow-up load for three sending days (`automator/state/siege/<day>/plan.json`,
read-only), and `dns.resolveMx` behaviour on two live link-shortener domains (direct
Node probes).

## Headline

**75 of 76 planned emails went out, the cleanest push rate on record, and every one of
the four people parked today came from a one-line content-type fix shipped yesterday
morning. Separately, the healthiest inbox fleet of the week had room for only 76 new
people, because 1,495 follow-ups came due in a single day against a total allowance of
855.**

Zero fatal signatures, zero halts, zero crashes, thirtieth consecutive cycle of $0
Anthropic spend.

## Finding 1: the push was as clean as this pipeline gets

`push_outcome` reports **75 sent, 0 failed, 1 skipped** against `planned: 76`. No
SmartLead refusal, no rate-limit casualty, no batch dying before its first lead. The
single loss was ours: a `joke-ai-slop` draft the writer's own quality gate rejected after
its retries, for a consultant abstraction (the word "Streamline"). That is the gate doing
its job, and the fix is the skill, not the push.

Two older fixes can be marked as holding:

- The **account rate limiter** fired three times during a one-lead send at 07:20Z (one
  `add-lead` on campaign 3347388, two lead lookups, all `429`) and the retries added on
  10-05 absorbed all three. The push completed.
- That 07:20Z send is **20 minutes past this cycle's boundary**, so its one lead (Lisa
  Doyle, real estate) belongs to tomorrow's count. Noting it so it is not double counted.

The snapshot still labels the day `binding_constraint: partial_push`. That is a
remainder of planned minus sent, so a run that loses one draft to its own copy standard
and a run that loses half a batch to a rate limit land under the same word. The field's
own note already says to read `push_outcome` first, and that is the right instruction;
the label is coarse rather than wrong.

## Finding 2: Friday's 618 was borrowing, and Monday paid for it

This is the part that changes the picture of send volume.

| Day | Live inboxes | Allowance/day | Follow-ups due | Room for someone new | Mailboxes with zero room |
|---|---|---|---|---|---|
| Thu 10-08 | 54 of 58 | 810 | 270 | 567 | 9 of 54 |
| Fri 10-09 | 50 of 58 | 750 | 185 | 618 | 6 of 50 |
| **Mon 10-12** | **57 of 58** | **855** | **1,495** | **76** | **50 of 57** |

Read off Siege's own plans. The fleet on Monday was in the **best shape of the week**:
more inboxes live than either prior day and the highest total allowance. The number that
collapsed is the leftover after the follow-up bill is paid.

The cause is structural, not weather. Every offer is a three-email sequence on days 0, 4
and 10, and SmartLead sends Monday to Thursday only, so a weekend's worth of due
follow-ups lands on Monday on top of Monday's own. Thursday and Friday together started
**1,185 first touches**, and their day-4 follow-ups all came due inside Monday and
Tuesday.

**The honest ceiling, derived from those numbers:** 855 messages a day across four
sending days is 3,420 messages a week, and each new person costs three of them, so the
fleet supports roughly **1,140 new people a week**, about 285 a sending day. Thursday
and Friday started a full week's worth in two days. On that basis the shelf's 6,015 is
about **5.3 weeks** of real sending, which is the same answer the old 277-a-day figure
gave by a different route.

That derivation is mine and not a measured field. It assumes every started sequence runs
all three emails and nobody replies out of it, so 1,140 is an upper bound. The measured
fields are the allowance, the bill and the full-mailbox count.

## Finding 3: both of yesterday's method fixes paid off within hours

The fix commit landed at **07:30Z**. Four collect passes ran after it, each on 150 leads.

| Pass | Time | Found | Already on file | New | People |
|---|---|---|---|---|---|
| 1 | 10:00Z | 710 | 692 | 18 | 6 |
| 2 | 16:00Z | 540 | 533 | 7 | 6 |
| 3 | 23:00Z | 598 | 582 | 16 | 6 |
| 4 | 06:00Z | 564 | 561 | 3 | 1 |
| **Total** | | **2,412** | **2,368** | **44** | **19** |

The four new-point counts add to exactly the `free_contact_points_added: 44` and
`free_leads_with_new_points: 19` the snapshot counts out of the database, so the log and
the table agree with nothing left over. The re-walk rate is 98.2% and the new-point share
is **3.7 times yesterday's**, on the same book, the same batch size and the same cursor.

Where the 44 points came from:

```
 source            points  addresses  people
 28-sitemap            16         16       5
 18-rdap               10          4       5
 02-subpages            8          1       4
 16-jsonld              6          1       1
 34-channel-page        3          0       3
 01-mailto              1          1       1
```

**`28-sitemap` wrote 13 business addresses inside the first two minutes of the first pass
after the fix** (12 at 10:01Z, 1 at 10:02Z), on a method that had produced 154 points in
its entire life. Over the cycle it wrote 16 points, every one of them an email address,
on 5 people. **Four of those five verified and parked:** Calibre Yacht Sales (11:28Z),
Joy Movement (18:07Z), Acez Academy (18:11Z) and Nelson Schuman (18:15Z). That is the
whole day's park count, `approved_hold` 7,600 to 7,604.

**`18-rdap` produced at 16:05Z, 54 days after its previous point** (2026-08-19 18:08Z),
and then in all three remaining passes: 10 points on 5 people, 4 of them personal email
addresses. The 10-12 debrief flagged the honest limit that the fix was proven to restore
200s but not to restore points. It restores points. Whether those addresses survive
ZeroBounce is still open, since registration contacts are often privacy-redacted.

So the two highest-producing methods of the day are the two that were broken yesterday,
and together they hold **20 of the 23 email addresses**. The lane's biggest lifetime
producer, `34-channel-page` with 15,039 points, contributed three website links and no
addresses.

## Finding 4: the top error cause in every pass was not an error

The cause tally shipped on 10-12 and has now run for four passes. `05-catch-all: queryMx
ENODATA` held the **top slot in every single one**: 29 of 191, 40 of 201, 37 of 200, 31
of 214. That is **137 of the cycle's 806 method errors, 17%, and none of it is a fault.**

`dns.resolveMx` reports "this domain publishes no mail exchanger" **by throwing**, not by
returning an empty array. The method's own code has always treated no-MX as a plain
negative, correctly, because a domain that accepts no mail cannot be a catch-all. But the
negative almost never arrives as `[]`, so it was landing in the catch block and being
filed as a method error on every pass, for every lead of that shape.

The shape is ordinary. Probed live the same minute: `tr.ee` and `subscribepage.io`, the
link-shortener and landing-page hosts that fill the `website` column for creators without
a real site, both answer ENODATA. `payhip.com`, `vk.com` and `gosuslugi.ru` all answer
with real MX records.

This matters for the same reason the cause key exists at all. A tally whose top row is a
non-fault hides the real faults underneath it, and counting by cause rather than shape is
exactly what exposed the sitemap guard and the RDAP header the day before. Removing 17%
of phantom errors promotes `18-rdap: RDAP N` to the top of the list, which is a real
thing to look at.

## Finding 5: two instruments could not answer the question the day turned on

Both gaps are the same gap in different places: a field that reports a remainder or a
lifetime total, where the reader needs the inside of the window.

- **`recovery_lane.methods`** (built yesterday) carries lifetime points and a
  last-produced date. Lifetime totals barely move, because `34-channel-page` holds 15,039
  of them, and a date only answers yes or no. So "did yesterday's fix work" and "what
  found today's leads" both needed hand SQL, which is the manual step the function was
  built to end. The 10-12 debrief had to file it as ranked next action #3.
- **`send_plan.mailbox_slots`** is a remainder: allowance minus follow-ups owed. A
  suspension wave and a follow-up wave report the same small number, so the healthiest
  fleet of the week and a crippled one are indistinguishable. Reading the real cause meant
  opening automator's plan by hand. The field's own comment has named this shape since
  09-29 without ever carrying the number that proves it.

## What shipped

| Commit | Repo | What |
|---|---|---|
| `32b9cedbb` | youtube-email-outreach-v1 | `05-catch-all` treats the four DNS codes that mean "nothing here accepts mail" as the plain negative its own no-MX branch always returned. Anything else still propagates. |
| `e6dbd85` | youtube-outreach-orchestrator-v1 | `methodProduction()` takes the cycle window; each method carries points, addresses and people found inside it, and the debrief gains `methods_producing`, ranked by addresses. |
| `14da986` | youtube-outreach-orchestrator-v1 | `send_plan` carries `mailbox_capacity`, `followups_due` and `inboxes_full`, so a small slot count can be read as a follow-up wave rather than a sick fleet. |

Verified before committing:

- The catch-all fix ran against both live ENODATA domains and returned zero errors where
  it previously returned one each. A lead with no website still reports `skipped`, not an
  error.
- The method-production change was run against the live database and reproduces **44
  points and 23 addresses exactly**, matching the two totals the snapshot computes
  independently elsewhere. Called without a window every new field is `null`, not `0`.
- The send-plan change was run against both real plan files: Friday reads 750 / 185 / 6
  and Monday reads 855 / 1,495 / 50. Three new selftests cover the 10-12 shape, a dead
  inbox contributing nothing, and a renamed key costing one null. All of
  `debrief-data.selftest.ts` passes.
- Both repos typecheck clean.

The `05-catch-all` commit is credited to auto-sync (`32b9cedbb`) rather than an
`autopilot-improve:` message, because the 2-minute timer committed the working tree
first. The change is in that commit and on the branch.

## What this cycle did not spend

Anthropic $0.00, the 30th consecutive cycle. OpenRouter $2.35 a day with $87.70 left,
about 37 days, and the only logged calls were 513 to `qwen3.7-flash` for 28 cents. Apify
sat out with $0.00 spendable and 0 price strikes until the allowance resets on 31
October. Brave ran 24 searches across 600 leads with zero key refusals, about 12 cents,
and the newest pass reports `cause: resolution_ok` with `no_site: 3 of 150`. Website
resolution is not the constraint on this stretch of the book. Enrichment ran 3 batches
for 5 leads and has essentially nothing left to do, at 7,594 of 7,604 bundled.

`needs_contact` is 3,515. The collect cursor is on lap 9 of a 2,509-lead book, and
`collect_book_stranded` held at 3 for the 30th straight day, so no selector gap has
reopened.

The YouTube key pool probed 20 minutes after the midnight-PT reset at 15 working of 66,
with 50 still exhausted after the reset and 1 blocked. That binds nothing while discovery
is paused, and the cause is settled (the quota on those projects was cut, so the pool is
about 15 usable keys and more keys are not the answer for those accounts).

**0 new channels discovered, by Casey's 2026-09-08 order.** `logs/discovery-paused.flag`
is present and untouched. Every stopped sweep, stale state file and disabled timer in
`discovery_methods_health` is the intended state and is not reported as a fault.

## The shelf

| | |
|---|---|
| In `approved_hold` | 7,604 |
| Already emailed | 1,579 |
| **Never emailed (the real inventory)** | **6,015** |
| Enriched | 7,594 (99.9%) |

Down 60 on the week despite four arrivals, because 75 went out. At the fleet's real pace
of about 1,140 new people a week that is roughly 5.3 weeks.

## Ranked next

1. **Decide what refills the shelf.** Fifteenth consecutive debrief to put this first.
   Enrichment is finished, the recovery book is a 98% re-walk on lap 9, Apify is dry until
   1 November, and discovery is paused by Casey's order. Nothing below this changes it.
2. **Buy inboxes against the follow-up bill, not the day cap.** Same lever as before, now
   with a number: 855 of allowance against 1,495 of follow-ups owed. Raising the 870 cap
   changes nothing until the allowance clears the bill.
3. **Smooth the first-touch days instead of front-loading them.** 1,185 started on
   Thursday and Friday, 76 of room left on Monday. A scheduling change in `automator`,
   outside the five repos this agent may edit.
4. **One look each at the other four quiet methods.** `04-holehe` (51 points, 55 days),
   `26-instagram` (279, 25), `19-github` (17, 17), `14-external-links` (79, 15). Two
   one-line fixes produced 26 points and every park today, so the expected value is no
   longer theoretical.
5. **Watch whether `18-rdap`'s four addresses verify.** Registration contacts are often
   privacy-redacted, so the method could produce points that never park anyone.
6. **Fix the em dash in `cold-email-attack-enemy-propose-5-ideas-v1`.** Carried. Today's
   one refused draft broke a different rule, say-the-action, on `joke-ai-slop`.
7. **Give the campaign `START` call a 429 retry** in `automator/scripts/siege-plan.py`.
   Carried from 10-10. Six people still sit in two stopped campaigns with their rows
   marked sent.
8. **Six cycles have metrics on disk and no debrief** (09-17, 09-18, 09-19, 08-17, 08-18,
   07-11). No risk, backfillable any time.
