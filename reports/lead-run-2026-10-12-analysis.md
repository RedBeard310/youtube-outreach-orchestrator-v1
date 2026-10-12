# Lead run analysis, cycle 2026-10-11

Companion to [lead-run-2026-10-12.html](lead-run-2026-10-12.html). Cycle window
2026-10-11T07:00Z to 2026-10-12T07:00Z, which is Sunday 2026-10-11 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-12.json`.
Four readings were measured directly during this session and are named where they
appear: the per-pass funnel (`logs/bloodhound-collect.log` through `collectPasses()`),
the lifetime contact-point count and last-point date per method (SQL over
`leads.contact_points`), the `rdap.org` response with and without a User-Agent (direct
`fetch` probes on three live domains), and the content type `www.offgridpower.solutions`
serves its sitemap with (direct `curl`).

## Headline

**Nothing sent, because Sunday is not a sending day, and the cycle's entire output was
two people parked. The reading worth having is that yesterday's fix retired the only
error shape large enough to read, which exposed that the error tally cannot name a
cause at all, and counting the same errors by cause instead found a method that
produced 336 contact points in two days and has answered nothing but 403s for the 53
days since.**

Zero fatal signatures, zero halts, zero crashes, twenty-ninth consecutive cycle of
$0 Anthropic spend.

## Finding 1: nothing sent, and that is the calendar

`sending_day: false`, `plan_found: false`, `binding_constraint: not_a_sending_day`.
`siege-plan.timer` is Monday to Friday, so no plan was due and none was written.
`push_unit_result` is null because no push belongs to this window. `unit_state:
inactive` with `unit_last_result: success` and a last start of Friday 12:05Z describes
the run the 10-10 debrief covered, not this cycle.

This repo's own send path ran once and had nothing to fire: `attempted=0 sent=0
failed=0`. That is three consecutive weekend cycles reading correctly since the 10-04
fix. Friday's two `http 429` escalations on the campaign `START` call did not recur,
because there was no push to recur in. Those six people are still loaded into two
stopped campaigns with their rows marked sent.

## Finding 2: four passes, 600 leads, a 99.5% re-walk

Four collect passes completed inside the window, each on 150 leads.

| Pass | Leads | Had a site on file | Points found | Already stored | New |
|---|---|---|---|---|---|
| 1 (07:01Z) | 150 | 145 | 592 | 588 | 4 |
| 2 (14:00Z) | 150 | 147 | 687 | 685 | 2 |
| 3 (20:01Z) | 150 | 145 | 615 | 611 | 4 |
| 4 (03:01Z) | 150 | 148 | 585 | 583 | 2 |
| **Total** | **600** | **585** | **2,479** | **2,467** | **12** |

The four new-point counts add to exactly the 12 contact points and 10 people the
snapshot counts out of the database (`free_contact_points_added: 12`,
`free_leads_with_new_points: 10`), so the log and the table agree with nothing left
over. Pass 1 was dispatched 93 seconds into the cycle and the 10-11 debrief labelled it
"just past the cycle"; it belongs to this one and is counted once.

"Had a site on file" is `150 - brave_searches`, because the collect pass asks Brave only
for a lead with no stored website. Across 600 leads it ran **15 searches**, about 7
cents, with **zero key refusals**. The newest pass reports `cause: resolution_ok` and
`no_site: 1 of 150`. Website resolution is not the constraint on this stretch of the
book, which is worth saying plainly because two of the last three cycles were a
resolution story and this one is not.

Three of the twelve new points were email addresses, on three people. Two of the three
verified and parked: `approved_hold` 7,598 to 7,600. The cursor is on lap 9 of a
2,514-lead book. `collect_book_stranded` held at 3 for the 29th straight day, so no
selector gap has reopened. `needs_contact` is 3,512.

## Finding 3: yesterday's fix worked, and blinded the instrument that found it

`09-finra` was 53 of pass 1's 442 method errors. It does not appear in the top shapes
of passes 2, 3 or 4 at all, which is the 10-11 commit going live mid-cycle and doing
exactly what it was built to do.

What it left behind is a tally that can no longer name anything. The four passes logged
442, 413, 500 and 458 method errors. Pass 4's **458 errors came back as 432 distinct
shapes**, the largest holding **4 of them, under 1%**, with **426 shapes in the unnamed
tail**.

This is structural, not bad luck. `condenseError()` keeps the hostname on purpose: the
dead-method breaker arms only when every one of a method's errors condenses to ONE
shape, which is what stops it retiring a good method that fails differently on
different sites. The hostname is per lead, so 150 identical failures become 150 shapes
and the real cause can never hold a majority.

So the fix is a second, coarser key, reported beside the first rather than instead of
it: the shape says which site, the cause says what went wrong, and only the cause
aggregates. `condenseCause()` drops URLs, bare hostnames, paths, quoted values and
redirect targets. On a six-lead probe, nine shapes collapsed to three causes, and two
of the three were real faults.

## Finding 4: the fetch guard was refusing most sitemaps

`fetchRaw()` in `src/bloodhound/web.ts` allowed four exact content types. One of them
was `application/xml`. `text/xml` was not on the list, **and that is how most sitemaps
are served**. Measured: `www.offgridpower.solutions/sitemap.xml` answers
`text/xml;charset=utf-8` with 233 KB of real sitemap.

That matters more than the error count suggests, because of which method it disables.
`28-sitemap` exists to reveal the contact, team, staff and press pages a homepage never
links to, and then read them. Refusing the sitemap on its content type means the method
never gets a URL list at all. The same list also refused `application/rss+xml`, which
is `17-podcast`'s own format, and `text/markdown`.

Any `text/*` is text by definition and any XML flavour is text too, so both now pass.
An absent content type still fails, deliberately: that is a server saying nothing, not a
server saying text. The 1 MB read cap is what keeps a surprise payload cheap.

## Finding 5: a method that produced 336 points has been dead for 53 days

The cause tally's other finding was `18-rdap: RDAP N`, four of nine errors on the probe,
one for every lead that had a website.

One grouped query over `leads.contact_points` sized it:

```
 15036  34-channel-page     last 2026-10-12
  4756  02-subpages         last 2026-10-12
  3947  33-about-text       last 2026-10-07
  2992  16-jsonld           last 2026-10-11
  1192  01-mailto           last 2026-10-11
   552  17-podcast          last 2026-10-07
   336  18-rdap             last 2026-08-19   <-- 53 days
   279  26-instagram        last 2026-09-17
   154  28-sitemap          last 2026-10-07
    79  14-external-links   last 2026-09-28
    51  04-holehe           last 2026-08-18
    17  19-github           last 2026-09-25
```

`18-rdap` wrote **336 contact points on 18 and 19 August**, which made it the lane's
eighth-largest producer, and **not one since**. The reason is one missing header.
`rdap.org` sits behind Cloudflare, which answers a request with no User-Agent with a 403
challenge page. Probed the same minute: `carnivoretoday.com`,
`offgridpower.solutions` and `smpaus.com.au` all returned **403** with no User-Agent and
all three returned **200** through the registry redirect with one. So for eight weeks
the method has spent one futile request per lead with a website, on a 15-second timeout,
every pass, and has never read a registration record.

Note that `09-finra` (yesterday's find) never produced a point in its life, while this
one produced well and then stopped. They are different failures and only the second
kind is a loss.

## Finding 6: four instruments were live and all four were blind to it

This is the part worth keeping, because the fix is the instrument, not the header.

- The **pass footer** counts points in total, so a method going dark hides behind
  `34-channel-page`'s 15,036.
- The **shape tally** (10-08) keys on the hostname, so the failure read as 150 separate
  one-offs.
- The **breaker** (10-11) needs one shape to arm, so the hostname hid it there too.
- The **no-site rate** (09-04, 09-10, 10-10) was healthy all along, because resolution
  genuinely was fine.

None of them asked the cheapest question available: when did each method last produce
anything? `methodProduction()` now answers it in one grouped query with no network and
no model, and the debrief carries `recovery_lane.methods` and `methods_quiet`. Today it
names five quiet free methods: `04-holehe` (54 days), `18-rdap` (53), `26-instagram`
(24), `19-github` (16), `14-external-links` (14). The Apify lanes are excluded because
their silence is a spent budget, not a fault.

**Quiet is deliberately a low bar, not an alarm.** A method whose niche is rare in the
current slice goes quiet honestly. The point is to put the number in front of a reader
once a day rather than to decide for them.

## What shipped

| Commit | Repo | What |
|---|---|---|
| `1665d526b` | youtube-email-outreach-v1 | Cause-level error tally beside the shape tally; `text/*` and any XML flavour pass the fetch guard; `18-rdap` sends the shared User-Agent, now exported from `web.ts` |
| `bbdd082` | youtube-outreach-orchestrator-v1 | `CollectPass` carries `topErrorCause`, its count, its share and the cause count into the snapshot the debrief is written from |
| `ab1e143` | youtube-outreach-orchestrator-v1 | `methodProduction()` plus `recovery_lane.methods` / `methods_quiet` in the debrief data |

Verified before committing: the collect CLI ran a six-lead dry run three times, and
method errors on that fixed slice went **9 to 2** as the two fixes landed. Point yield
on the slice was unchanged at 28, which is expected, since those six sites' hidden pages
held nothing new. Both repos typecheck clean. The new log line is parsed by a direct
test of `collectPasses()` against a synthetic pass.

The honest limit on the RDAP fix: all three probe domains were privacy-redacted and
exposed only the registrar, so the fix is proven to restore 200s and is not yet proven
to restore points. The next real pass settles it. If `18-rdap` answers 200 and still
writes nothing, the fix bought back quota rather than leads.

## What this cycle did not spend

Anthropic $0.00, the 29th consecutive cycle. OpenRouter $1.73 a day with $90.05 left,
about 52 days, and the only logged calls were 41 to `qwen3.7-flash` for 2.4 cents. Apify
sat out with $0.00 spendable and 0 price strikes until the allowance resets on 31
October. Enrichment ran 1 batch for 1 lead and has essentially nothing left to do, at
7,589 of 7,600 bundled. Brave about 7 cents.

The YouTube key pool probed 20 minutes after the midnight-PT reset at 15 working of 66,
with 50 still exhausted after the reset and 1 blocked. That binds nothing while
discovery is paused, and the cause is settled (the quota on those projects was cut, so
the pool is ~15 usable keys and more keys are not the answer for those accounts).

**0 new channels discovered, by Casey's 2026-09-08 order.** `logs/discovery-paused.flag`
is present and untouched. Every stopped sweep, stale state file and disabled timer in
`discovery_methods_health` is the intended state and is not reported as a fault.

## The shelf

| | |
|---|---|
| In `approved_hold` | 7,600 |
| Already emailed | 1,514 |
| **Never emailed (the real inventory)** | **6,075** |
| Enriched | 7,589 (99.9%) |

At 277 a sending day that is about 22 sending days, roughly five and a half weeks. The
cycle added two people and sent none, so the inventory is flat.

## Ranked next

1. **Decide what refills the shelf.** Fourteenth consecutive debrief to put this first.
   Enrichment is finished, the recovery book is a 99.5% re-walk, Apify is dry until 1
   November, and discovery is paused by Casey's order. Nothing below changes this.
2. **One look each at the other four quiet methods.** `18-rdap` was a one-line fix worth
   336 points, so the expected value is real and a dry run each is the whole cost.
3. **Confirm the RDAP fix writes points on the next real pass**, per the limit above.
4. **OpenRouter runway is comfortable**: $90.05 at $1.73 a day, about 52 days.
5. **Give the campaign `START` call a 429 retry** in `automator/scripts/siege-plan.py`.
   Six people are still in stopped campaigns with their rows marked sent. Carried from
   10-10; `automator` is outside the five repos this agent may edit.
6. **Fix the em dash in `cold-email-attack-enemy-propose-5-ideas-v1`.** Carried, no new
   evidence this cycle.
7. **More inboxes, not a higher day cap.** Friday planned 618 against 618 mailbox slots
   on 50 live inboxes under a cap of 870.
8. **Six cycles have metrics on disk and no debrief** (09-17, 09-18, 09-19, 08-17,
   08-18, 07-11). No risk, backfillable any time.
