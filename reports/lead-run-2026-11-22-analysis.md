# Lead run analysis, 2026-11-21

Cycle: 2026-11-21T08:00Z to 2026-11-22T08:00Z (the Pacific day of Saturday 2026-11-21).
Companion to [lead-run-2026-11-22.html](lead-run-2026-11-22.html). Every figure comes
from `logs/autopilot-debrief-2026-11-22.json` in the orchestrator repo unless it says
otherwise.

## The one-line version

A weekend cycle, so nothing was sent and that is correct. The contact-recovery lane, the
only lane still allowed to produce, walked 600 lead-slots and found one email address. Part
of that is a book it has read nineteen times. The other part is that about 14 leads in every
150-lead pass lose all nine of their website methods to one refused redirect, and the fix
that shipped on 2026-11-08 to rescue exactly those leads has never been measured. It rescues
almost none of them.

## Headline numbers

| Thing | Reading |
|---|---|
| Emails loaded | 0 (no plan written; the send timer is Mon-Fri) |
| People reached for the first time ever | 0 |
| Parked onto the shelf | 0 (pool flat at 7,390) |
| Shelf ready to write | 4,852 (7,378 bundled, 99.8%; 2,525 really emailed) |
| Recovery lane, its own half | 11 points, 1 email address, 8 people |
| Same, prior 7 days | 77 points, 12 email addresses |
| Collect passes | 4, covering 600 lead-slots, lap 19 of a 1,769-lead book |
| Method errors | 758, of which cross-domain redirect 282 (37%) |
| Mailboxes clear to send | 43, from 35 |
| Replies read | 3 people, 1 a clear yes |
| Apify email recovery | 239.6h with no work, 401 bad token since 2026-11-12 |
| Fatal errors | 0, no halt |
| Spend | $0 Anthropic; OpenRouter balance $298.54 at 14 cents a day |

## What the day was

A weekend. `siege-plan.timer` is Monday to Friday, so no plan exists, nobody was emailed,
and the snapshot names the cause itself (`binding_constraint: not_a_sending_day`). A zero in
the send column needs no further explanation and is not a shortfall.

Everything mechanical was clean. Zero fatal signatures, no halt flag, $0 of Anthropic spend,
twenty reply-reader runs with no classifier failures, and the enrichment chain correctly
reporting `idling_no_inflow` against a pool that is 99.8% bundled.

People reached for the first time ever, by Pacific day, oldest first:

```
11-14  0
11-15  0
11-16  1
11-17  3
11-18  4
11-19  0
11-20  1
11-21  0   <- this cycle, a Saturday
```

The weekend zero is not part of the slide. The five sending days before it are, and they are
unchanged from yesterday's reading.

## The recovery lane, diagnosed

The lane's own half (the `lane_*` fields, which exclude both the paid Apify lane and
automator's contact-lookup timer writing into the same table) added **11 contact points on 8
people and exactly 1 email address**, against 77 points and 12 addresses over the prior seven
days. Only addresses can park anybody, so one address is the number that matters.

Two causes, and only one is a fault.

**A picked-over book, which is benign.** The lane is on lap 19 of a 1,769-lead book, so
nearly everybody it reads today it has already read eighteen times. The newest pass says so
directly: the methods found 632 things and **625 were already on file**. Site resolution is
healthy, with `cause: resolution_ok`, 3 leads of 150 resolving no website, and **zero Brave
refusals**. So this is not the search plan, not a spent key, and not a configuration fault.
No amount of Brave or Apify credit changes it.

**A gate that blocks about 9% of every pass, which is the fault.** The largest single thing
going wrong is `cross-domain redirect`: the lead's declared website sends us to a different
registrable domain, and `fetchOwnedPageCached` refuses to read it. The refusal is right on
its own terms, because extraction would otherwise file the destination site's contacts under
this lead. Across the cycle's four passes it was **282 of 758 method errors, 37%**, running
80, 50, 58 and 94 per pass. The newest pass is the worst of the four, which is exactly why no
single pass can carry a day-over-day comparison.

The 282 overstates how widespread it is. Nine collection methods start from `ctx.website`, so
one refused redirect on one lead arrives in the roll-up as one fault per method. In the newest
pass the condition broke down as `28-sitemap` 31, `14-external-links` 20, `02-subpages` 15,
`01-mailto` 14 and `16-jsonld` 14. `01-mailto` fetches the homepage once per lead, so **about
14 leads of 150, 9% of the pass**, lost their whole page half. Every lap. For good. At four
passes a day that is roughly 56 lead-slots spent on leads that cannot produce anything.

## The 11-08 fix, measured for the first time

`followOwnedRedirect` in `youtube-email-outreach-v1/src/bloodhound/db.ts` shipped on
2026-11-08 for exactly this: when a declared link hops off its own domain, read the
destination and follow it if the page plainly belongs to that creator. It logged a line when
it followed one and **nothing at all when it refused**, so two weeks of passes could not say
whether it had rescued anybody, and the symptom stayed the largest condition in the roll-up.

The gate requires two things of a destination: `domainLooksOwned` (the domain label reads like
the creator's name) and `strongNameMatch` over the rendered page (the page names them). Its
own docstring argues a declared link is *stronger* evidence than a Brave guess, and then
applies the identical bar a Brave guess has to clear. That is the gap.

Checked against the live data rather than reasoned about. The redirect pairs were read out of
`logs/bloodhound-collect.log` and the leads behind two of them queried from
`leads.lead_candidates`:

| Hop | channel_name | domainLooksOwned | Lands in |
|---|---|---|---|
| `aba.link -> andersonadvisors.com` | Anderson Business Advisors | true | the page-evidence half |
| `cme.sh -> www.bigdaddydigital.com` | Steven Thompson | **false** | the domain-label half |

The second one is the point. `cme.sh -> www.bigdaddydigital.com` is named in the 11-08 gate's
own docstring as one of the hops it was built to rescue, and the real lead carries
`channel_name` "Steven Thompson" with `host_first_name` "Steven", so it is refused one screen
before the page is ever considered. The selftest written alongside the fix asserts that hop
with the channel name "Big Daddy Digital", which no lead in the database has.

That is the common shape: a creator's branded shortener points at their own firm, the channel
carries the person's name, the domain carries the company's, and the gate cannot see that
they are the same business.

Other pairs from the same log, unqueried, that look like the same shape:
`ltrp.xyz -> linguatrip.com`, `eliteceosreviews.com -> tannerchidester.com`,
`t.mtrbio.com -> metricool.com`. And pairs that should stay refused and do:
`pin.it -> pinterest.com`, `paypal.me -> paypal.com`, `selar.co -> selar.com`,
`openinapp.link -> openinapp.com`, all of which are already on the host screen.

## Fix shipped

`youtube-email-outreach-v1`, in `src/bloodhound/db.ts` and `src/bloodhound/cli.ts`.

The gate now records every hop it examines and which of its own screens refused it:

- `hostScreen` — a redirector or link-in-bio host. Working as intended, never the creator.
- `domainLabel` — the destination domain does not read like the creator's name. This is the
  branded-shortener bucket, and it is the one the decision hangs on.
- `pageEvidence` — the domain reads like them and the landed page does not name them. A
  parked domain or a real miss.
- `unreadableDestination` — the final URL would not parse.

Each bucket keeps one untouched example, in the style of the plan's not-live rows: a condensed
key drops the thing a reader decides on. One line prints **per lead**, not per method, which
is the whole reason the roll-up could not see this. `redirectGateSummary()` prints a pass
footer immediately after the method-cause roll-up it explains, which is where
`braveSearchSummary()` already sits, so the existing pass-boundary parsers are untouched.

Counting changed no verdict. Nothing about which contacts get filed moved. Whether to loosen
the `domainLabel` screen for a link the creator *declared* is an ownership decision, and the
2026-08-18 audit's house rule stands: nothing gets filed that cannot be tied to this creator.
So the fix measures the size of that decision instead of taking it.

The selftest was corrected too. The `cme.sh` fixture keeps its original case, which isolates
the page-evidence half honestly, and the real lead's channel name is now a case of its own
asserting the live refusal, with a note on why a fixture carrying a name the lead does not
have reads as proof of something it does not prove.

Verified: `npm run typecheck` clean, `redirect-ownership.selftest.ts` 10 of 10 passing
including the new case, `db-hosts.selftest.ts` all passing.

## The rest of the cycle

**The fleet recovered.** 43 mailboxes clear, up from 35, with 5 on watch and 46 stopped. Six
named mailboxes came back to the clear band and all six still held it at the last reading, so
no revolving door. Four more are held but healthy and will lift themselves, three on a
recovery clock with the nearest about two hours out and one held only because a sibling
address on its domain is sick. The health gate pulled 4 mailboxes this cycle, all on health
score.

One caveat on that: the band reading at 2026-11-22T03:05:18Z covered a shorter fleet than the
runs around it, so `band_moves_comparable` is false and the **move counts for the day are not
trustworthy**. The band totals and `band_normal_change` are. This is the 2026-11-10 shape and
the field reports it correctly.

**A creator said yes.** Three people were classified and one is a clear agreement to talk
(`partha@npfinancials.com.au`, category simple-yes). It was not sent, for two separate
reasons: the auto-reply sender has been paused since 2026-09-17 by Casey's own decision, which
runs the lane in dry-run; and the drafter cannot resolve which mailbox the thread sends from,
so it cannot sign the reply and holds it even on a confident yes. That second one is a real
defect, eleven replies deep since 2026-10-07 with eight of them clear yeses, and it lives in
automator, which owns the reply path. Casey answers these by hand off his own lanes and this
file cannot see that, so it is a name worth checking rather than a missed reply.

**Apify is dead, eighth morning.** The token has answered `user-or-token-not-found` since
2026-11-12T10:20Z. `lane_no_work_hours` reads **239.6**, ten days, which is the gauge to quote
(`lane_refusing_hours` only covers the part of the outage the stamp witnessed). $21.06 of the
month's spendable allowance expires 2026-11-30 and cannot carry over. This lane has found
2,376 addresses in its life, and it is the only address source that works at size while the
free lane re-reads a finished book.

**Everything the standing order turns off stayed off.** 0 new channels, every sweep idle, the
campaign loop stopped. `logs/discovery-paused.flag` is in place and none of that was treated
as a fault. The YouTube key pool reads 15 working of 66, which has been the settled state
since 2026-09-16 (the quota on 50 projects was cut) and matters even less with discovery off,
since the sweeps run on 1-unit calls and only keyword search needs the 100-unit searches.

## Decisions for Casey

1. **Replace the Apify token.** Eighth morning, ten days dead, $21.06 expiring 11-30.
   Operator-only, since the token lives in the settings bank.
2. **The declared-link redirect question.** Keep requiring the destination domain to read like
   the creator's name, which blocks every branded shortener pointing at the creator's own firm,
   or accept a declared hop on page evidence alone. From tomorrow the pass footer says how many
   leads each half costs. Loosening an ownership gate is his call.
3. **One creator agreed to talk** and the drafter cannot sign the reply. The repair is in
   automator.
4. **Leave the fleet alone** until Monday's plan, since this cycle's move counts are not
   comparable.
