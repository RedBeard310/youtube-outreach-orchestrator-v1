# Lead Run Analysis — 2026-11-08

Cycle: 2026-11-07T08:00:00Z to 2026-11-08T08:00:00Z (the 24h ending at midnight PT, so all
of Saturday 7 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-08.json`.
Companion to [lead-run-2026-11-08.html](lead-run-2026-11-08.html).

## Headline

**Four people were parked, which is the first supply this pipeline has found in three days.**
`approved_hold` went 7,372 to 7,376 and the shelf 5,048 to 5,052. Small, and it ends a run of
zeros: nothing was parked on Thursday or Friday.

**The free recovery lane ran at double its own weekly rate to do it.** 14 contact points and
6 addresses in a day, against 63 and 21 across the prior seven days. Four people got a first
usable address and all four parked.

**No email went out, and that is the schedule, not a fault.** Saturday is not a sending day.
Siege's timer is Monday to Friday, `sending_day` is false and `binding_constraint` reads
`not_a_sending_day`. There is no plan on disk to read, so nothing about the fleet's sendable
capacity was measured today.

**OpenRouter has 4.3 days of runway, and that is the only thing in this cycle with a
deadline.** The balance is $7.77 and the burn is flat at about $1.50 to $1.80 a day whatever
the pipeline does. Cold-email writing runs on that account, so an empty balance on a sending
day is a day with no drafts.

## What actually moved

| | This cycle | Prior 7 days |
|---|---|---|
| Parked into `approved_hold` | **4** | 288 on 11-02 alone, 0 on 11-06 and 11-07 |
| Free lane contact points | **14** | 63 (about 9 a day) |
| Free lane addresses | **6** | 21 (about 3 a day) |
| Free lane people with a new address | **4** | — |
| Paid Apify batches | 0 | 6 on 11-02 |
| Enrichment leads done | 3 | 343 on 11-02 |
| Emails sent | **0** | 92 on Friday, 199 Thursday, 352 Wednesday |

The shelf agrees with itself to the person. `ready_to_write` 5,048 to **5,052**, up exactly
the 4 parked, with nobody emailed to draw it down. People with a real send row held flat at
**2,310**. `marked_sent_never_emailed` is still **1**, `recPSkSNP2HeR6CCV`, now through four
sending days.

### Which methods paid

| Method | Addresses | People |
|---|---|---|
| `14-external-links` | 3 | 2 |
| `17-podcast` | 2 | 1 |
| `01-mailto` | 1 | 1 |

`34-channel-page` found 6 points on 5 leads and not one address. Three methods are quiet:
`04-holehe` (81 days), `19-github` (21), `26-instagram` (17).

### The paid lane is still out of people, and money does not fix it

Dry on **71 consecutive ticks** since 2026-11-02T10:22:57Z, with 12 idle batches this cycle.
`$31.20` of November's allowance is unspent and `$21.20` spendable.
`projection.projected_leads` is a measured **0** and `binding_constraint` reads
`candidate_supply`. The lane restarts only on new arrivals.

## The biggest fault in the only lane still producing, and it is fixed

`cross-domain redirect` was **83 of 150 method faults, 55%**, the largest single condition and
up from 39% yesterday. It arrives as one row per method, which is why it reads small:
`01-mailto`, `02-subpages` and `16-jsonld` each reported it 15 times, `28-sitemap` 17 and
`14-external-links` 20.

Those are the same leads. Nine of the lane's collection methods start from one resolved
website, and `fetchOwnedPageCached` refuses a redirect to a different domain outright, so a
creator whose declared link is a hop loses all nine, every pass, permanently. Three methods
reporting the condition 15 times each means about **15 leads of 150, 10% of the book**, blocked
in all three at once.

The destinations are almost all plainly the creator's own site. Read off the collect log's
condensed shape lines across recent passes: `aba.link -> andersonadvisors.com` (Anderson
Business Advisors), `ltrp.xyz -> linguatrip.com`, `cme.sh -> www.bigdaddydigital.com`,
`eliteceosreviews.com -> tannerchidester.com`, `thenataliedawson.com -> www.10xteams.com`,
`www.calledcoachinstitute.com -> calledwomen.com`.

The 2026-10-26 note that added the public redirectors to the host screen named this exact case
and left it open: a creator's own branded shortener "redirects to a site that really is theirs,
and whether to follow it is an ownership-evidence decision, not a list entry." That decision
shipped today.

The method with the most of these faults, `14-external-links` at 20, is also the method that
produced three of today's six addresses. It is the lane's smallest-volume producer and the
most blocked.

## Website resolution is healthy, so this is not a Brave problem

`cause` is `resolution_ok`. 8 of 150 leads had no site at all (5.3%), **zero** Brave refusals
and zero Brave errors, and only **8** searches ran because 142 of the 150 already had a site on
file. Brave returned 7 candidates and the ownership gate refused all 7, which is the gate
working as designed. **No reason to buy Brave credit.**

A yield alarm did fire on the newest pass: 1 lead of 150 produced anything, 0.7% against a
1.3% baseline over 8 passes, filed as `bloodhound_collect_yield_degraded`. That pass found
**637 contact methods and 635 of them were already on file**. At lap 15 of an 1,800-lead book
that is a re-walk, not a fault, and the cycle as a whole beat its own week. `stranded` is 3
and flat, so no selector gap.

## The fleet, as far as it can be read on a Saturday

No plan, so `live_inboxes` and `mailbox_slots` are null and the sole-reason rows from Friday
cannot be re-measured. Only the band gate ran, hourly, 25 times.

| | 11-07 08:05Z | 11-08 08:05Z |
|---|---|---|
| clear (`band_normal`) | 50 | **48** |
| watch | 10 | 12 |
| stop | 34 | 34 |

`band_delta_comparable` is true (24.0h apart). The clear band rose to a peak of **53** at
11-07T13:05Z, held there for ten hours, then gave back five in three steps overnight: one at
23:05Z and two each at 03:05Z and 05:05Z. Every loss was clear-to-watch; nothing was stopped
all cycle, and there were no round trips.

**The published move counts for this cycle were wrong, and the fix is below.** The snapshot
printed `band_moved_to_normal: 6` with six named returners, which cannot be reconciled with a
clear band that fell by two. The real figures are **3 moved to clear and 5 to watch**, and
50 + 3 − 5 = 48 exactly. The three genuine returners are `tomascartwright@videotubeagency.com`,
`casey_brown@contentgetssales.com` and `casey_brown@salesfromviews.com`, all three still clear
at the final reading.

`band_held_but_healthy` is **12**: ten waiting out the 48-hour clean clock with the closest due
within the hour, two held only because siblings on their domain are sick. So about twelve
mailboxes return for free.

The older warmup gate in the email repo paused **1** mailbox on health and resumed none; 97
lifetime.

**Monday is three things landing together.** The 36 mailboxes that Friday's plan read as
"warmup day 12, and the floor is day 14" clear Sunday 11-08 and can first carry an email Monday
11-09, worth roughly 540 messages a day. The day-4 and day-10 follow-up bills for Wednesday's
352 and Thursday's 199 land in the same window, and two days of no sending means the follow-ups
owed on Monday will be the highest of the run. That warmup date is carried from Friday's raw
string; there is no plan today to re-read it from.

## Money and quiet

- **OpenRouter: $1.79 this cycle, balance $7.77, 4.3 days of runway.** The burn does not track
  what the pipeline does: $1.68 on the 352-email day, $1.64 on 199, $1.44 on 92, $1.79 on a day
  that sent nothing and enriched three leads. So it is a flat floor of about $1.50 to $1.80 a
  day and the runway is a plain countdown to roughly Wednesday 11-12. Three enriched leads at
  the measured $0.111 each account for about $0.33 of the $1.79; what spends the rest was not
  established.
- Anthropic: **$0**, against a $75 soft ceiling.
- 0 fatal error signatures, no halt flag, no escalations, one observation all cycle (the collect
  yield alarm above).
- YouTube key pool: 15 working of 66 probed, 50 still quota-exhausted after the midnight reset.
  Settled, and irrelevant while discovery is off.
- Discovery: **0 new channels**, Casey's standing order of 2026-09-08. Every sweep idle by
  design, the campaign block all zeros.
- `npm run send` fired 0 leads, correctly: the send path is Siege, not this repo.

## Fixes shipped this cycle

**`09a5d097b` (youtube-email-outreach-v1) — a creator's own website behind a redirect stops
costing the lane nine methods.**

`fetchOwnedPageCached` refuses a cross-domain redirect because extraction would otherwise file
the destination site's contacts under this lead. The refusal is right and it was also total:
nine methods start from `ctx.website`, so the block is permanent and costs 10% of the book
every pass, in the one lane still parking anybody.

`redirectTargetLooksOwned()` in `src/bloodhound/identity.ts` answers the ownership question the
10-26 note deferred. It applies the bar a Brave guess already has to clear, unchanged: the
destination domain must read like the creator's name and the rendered page must name them.
That is deliberately conservative, because a redirect destination is *stronger* evidence than a
search hit, because the creator's own declared link points at it, and it keeps the
2026-08-18 audit's house rule intact. Both gates now share one evidence helper and differ only in what they let a
redirect do.

`followOwnedRedirect()` in `db.ts` wires it into `buildContext`, after the website is resolved
from whichever of the three sources supplied it. The fetch is free: four methods fetch that URL
anyway through the same per-lead cache, and when the hop is followed the destination is seeded
into the cache under its own key so nothing re-fetches. A dead link, a 4xx, an unreadable page
or a destination that fails the gate all leave the website exactly as it was, so the worst case
is today's behaviour. A hop onto a redirector, a link-in-bio host or a third-party page is
screened before the gate is even asked, so `pin.it -> pinterest.com` stays refused.

Verified: typecheck clean, all 305 vitest cases pass, and a new pure selftest
(`src/bloodhound/redirect-ownership.selftest.ts`, 9 cases) covers both directions. The two
branded shorteners measured this week are followed, while a public redirector, an unrelated
company that merely mentions the creator, a parked domain, somebody's article, a social profile
and a lead with no channel name are all refused.

**`e698a61` (orchestrator) — the band moves and the band change now describe the same span.**

`band_normal_prev` is read off the run at `band_prev_at`, and that run's counts already include
the moves it made itself. Counting those again as moves inside the cycle left the two numbers a
reader subtracts describing different spans, which is the 2026-10-16 fault (two instruments read
at different hours) inside a single block.

This morning the baseline was the 11-07T08:05:26Z run, whose own `to_normal` held three
mailboxes, and the gate walked 50 → 53 → 48 from there. The published pair was 6 and 5, which
reconciles to +1 against a fleet that lost two, and `band_returned` named three mailboxes already
credited to the previous day's count. The move walk now starts strictly after the baseline run.
`band_peak_normal` still spans the whole cycle, deliberately: how high the fleet got has nothing
to do with where the comparison starts.

Verified: typecheck clean, 326 selftest assertions pass with 3 new ones built on the real gate
history, and re-run against the live state file it returns 3 to clear, 5 to watch, three named
returners, and 50 + 3 − 5 = 48.

## Still open

- **OpenRouter runway, 4.3 days.** New this morning and the only dated item in the cycle.
- **Why SmartLead suspends whole domains.** Carried unchanged; 32 mailboxes were held by
  suspension and nothing else on Friday. Not re-measurable today, no plan on disk.
- **Why nine mailboxes are failing SMTP or IMAP** on `tubegrowthagency.com`,
  `ytgrowthagency.com` and `contentgetsleads.com`. Carried.
- **The five bounce refusals.** Five people with a bounce already on SmartLead's file are
  planned, written to and refused every sending day. Lives in `automator`.
- **One writer-blocked person**, `recYZCjHSZnKslfkq`: no clean job title, then an em dash
  outside the sign-off. Two skills, one lead.
- **`recPSkSNP2HeR6CCV`** is still stamped as sent and has never been emailed.
- **The two `automator` repairs, now nine days unshipped**: `why_no_email()` joining its `fails`
  list with no coercion, and `list_campaigns()` returning `[]` on any failed SmartLead read
  while `list_accounts()` below it is guarded. Not re-read this morning.
- **What moves a shelf lead into Siege's book.** Friday's never-emailed tier had 342 ready
  against 5,052 on the shelf.

## Ranked levers

1. **Put $10 to $20 on OpenRouter before Monday's push.** Balance $7.77, 4.3 days, and the
   cold-email writer runs on that account. A dry balance does not announce itself: the
   2026-09-14 lesson is that a 402 shows up as exit 0 and done 0. This is the cheapest item on
   the list and the only one with a date on it.
2. **Plan Monday 2026-11-09 as three events.** The 36 warmup mailboxes clear and are worth about
   540 messages a day; the follow-up bills for Wednesday's 352 and Thursday's 199 come due; and
   two days of no sending means Monday's owed follow-ups will be the highest of the run.
3. **Find out why SmartLead suspends whole domains.** Unchanged and still the largest block,
   worth about 480 messages a day on Friday's reading. Every one arrived as a complete domain.
4. **Fix SMTP or IMAP on the three domains before un-suspending anything there.** Nine mailboxes
   would come off suspension and still not send.
5. **Watch the redirect fix on the next collect pass.** If it converts, it unblocks nine methods
   on roughly 10% of the book without spending anything. It is the last free lever inside the
   recovery lane; past it, lifting the 2026-09-08 discovery pause is Casey's call alone.
6. **Stop planning the five bounced people.** One filter in the send path.
7. **Ship the two `automator` repairs.** Nine days. Each has already cost a whole sending day.
