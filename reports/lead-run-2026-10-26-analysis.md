# Lead Run Analysis — 2026-10-26

Cycle: 2026-10-25 00:00 to 24:00 PT (Sunday). Grounded in
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-26.json`, the health gate's own
history in `automator/state/inbox-health.json`, and `logs/bloodhound-collect.log`.

## Headline

**13 of 58 mailboxes can open a new conversation, down from 18, and 11 of the 45 held
mailboxes are already healthy.** Nothing was stopped. The clear count fell anyway, because
five mailboxes moved from clear to watch and a watch mailbox is given zero slots for a new
email. 13 is the lowest reading this month against 34 a week ago.

Nothing was sent, which is correct for a Sunday: Siege plans Monday to Friday and SmartLead
sends Monday to Thursday. `binding_constraint: not_a_sending_day`.

## The fleet, and why the number is softer than it looks

`automator/state/inbox-health.json` carries a per-mailbox reason, and reading it changes the
picture. Of the 45 mailboxes held back:

| Why it is held | Count | Scores |
|---|---|---|
| Clean reading, waiting out the 48h recovery window | 8 | 90.7 to 96.7 |
| Held only because two siblings on its domain are sick | 3 | all 96.7 |
| Its own current reading is below the bar | 34 | mostly 29 to 62 |

Three of the eight on a timer read **47 of 48 hours at 90+**, so they clear within the hour
unless a new reading knocks them back. `casey.brown@startcontentgetsclients.com` scores 96.7,
has been stopped since 10-23, and is 40 hours into the same wait.

The config that produces this (`automator`, `scripts/inbox-health.py`):

- `watch.score_under: 90`
- `recover.score_at_least: 90`, `recover.hours: 48`
- `domain.sick_siblings: 2`
- `watch_to_stop_after_sending_days: 5`

The two bars compound. One warmup email landing in spam drops a mailbox from 96.7 to about
89.9, which puts it on watch and costs it two full days, and through the sibling rule it can
cost its two neighbours the same two days. That happened today:
`contentgetsclientsdigital.com` had one address read 88.4 at 04:05Z, and
`caseybrown@contentgetsclientsdigital.com` (96.7, clean since 10-16) was held alongside it.
**Two of the five slots lost today are collateral rather than sickness.**

Also worth knowing: four stopped mailboxes score 87.7 or better, three of them on
`ytgrowthagency.com` at 92.2, 89.9 and 87.7. Two of those three cannot start the recovery
clock at all, because recovery needs 90 and they are below it.

Band history at 07:05Z, clear / watch / stop:

| | 10-20 | 10-21 | 10-22 | 10-23 | 10-24 | 10-25 | 10-26 |
|---|---|---|---|---|---|---|---|
| Clear | 31 | 27 | 20 | 22 | 17 | 18 | **13** |
| Watch | 3 | 6 | 12 | 6 | 7 | 6 | **11** |
| Stopped | 24 | 25 | 26 | 30 | 34 | 34 | **34** |

`band_delta_comparable: true`, snapshots 24 hours apart. None of this is in the five pipeline
repos; the gate and both numbers live in `automator`.

## The recovery lane

Produced 15 contact points, 2 email addresses, across 10 people. Prior seven days: 94 points
and 21 addresses. The collect pass started a fresh lap and is back in the half of the book
that already carries a website, so search cost almost nothing: **4 Brave searches against 440
yesterday**, 4 of 150 leads with no site, `cause: resolution_ok`, zero refusals.

The limiting fact is saturation, not money. The pass found **673 contact methods and 669 were
already on file**. Four were new, from 3 of 150 people. `rewalk_pct: 100`, lap 12 of a
2,398-lead book, `stranded: 3`. The lane now tracks arrivals rather than effort, and while
discovery is off the only inflow is the weekly subscriber-floor sweep plus the one or two
addresses a day this lane recovers.

Methods that produced: `34-channel-page` (6 points, 6 leads), `16-jsonld` (7, 2),
`01-mailto` (1, 1), `02-subpages` (1, 1). `04-holehe` has been silent 68 days on 51 lifetime
points, which is not worth a fix.

## What was fixed

### 1. The per-lead enrichment cost was one day's whole bill (`5abd704`, orchestrator)

`recovery_budget.projection.openrouter_usd_per_enriched_lead` divided the account's measured
daily OpenRouter spend by the leads that cycle enriched. That is a real unit cost only while
enrichment is the account's heavy caller. It was, while the pool drained. It is not now: the
shelf is 99.9% bundled, the chain idles on 0 to 9 trickle arrivals a day, and the account
still spends about $1.50 a day on everything else.

So the published rate moved on nothing but its denominator:

| Cycle | Leads enriched | Published $/lead |
|---|---|---|
| 10-10 | 1 | $3.7355 |
| 10-14 | 9 | $0.3904 |
| 10-16 | 3 | $0.0000 |
| 10-18 | 3 | $0.3191 |
| 10-24 | 1 | $1.7304 |
| 10-26 (before) | 1 | $1.4884 |

The $0.00 reading is the clearest tell: it says enrichment is free.

**The freeze it was heading for.** The figure has never been multiplied through, because
`channels_affordable` has been 0 every day this month (Apify allowance spent, $10 reserve). On
11-01 the allowance refills, `channels_affordable` jumps to about 1,280, and whatever one-lead
number that morning produces becomes the multiplier on
`openrouter_cost_of_projected_leads_usd` and on `balance_covers_projected`. At today's old
$1.4884 that would have projected about $190 of enrichment against a $66.79 balance and
reported that the pipeline cannot afford the recovery it just budgeted.

**The fix.** The rate is now the lowest of four trailing windows (1, 7, 14, 30 days). Every
window charges the whole account bill to enrichment, so every window is an upper bound, and
the lowest of several upper bounds is the best one. No threshold on "was the backfill busy" is
needed, which is the judgement a sample floor alone cannot make. A window counts only with at
least 30 enriched leads and a real spend reading on **every** day in it, so nothing is
extrapolated: daily `account_spend_usd` has been in this repo's own snapshots since 08-31 and
the chain log holds every batch.

Today's windows and the answer:

| Window | Spend | Leads | $/lead |
|---|---|---|---|
| 1 day | $1.56 | 1 | below floor |
| 7 days | $11.83 | 8 | below floor |
| 14 days | $23.50 | 33 | $0.7121 |
| 30 days | $127.36 | 770 | **$0.1654** |

$0.1654 against a known-good $0.1468 measured live on 10-01 over 133 leads, instead of being
9x it. It self-sharpens: when the backfill runs hot again the 1-day window becomes the
tightest and wins on its own. When no window clears, the cost is null and
`per_lead_unmeasured` names why, which already propagates to an unknown projection.

New fields: `per_lead_window_days`, `per_lead_sample_leads`, `per_lead_sample_spend_usd`,
`per_lead_sample_floor`, `per_lead_unmeasured`. 13 regression assertions; 217 green, selftest
ALL PASS, typecheck clean.

### 2. A redirector was becoming the lead's website (`e2a9b55`, email repo)

Of 175 method errors in the judged pass, **100 were the same condition**,
`cross-domain redirect`, across five methods. That was 57% of all errors and the largest
single cause.

`buildContext` resolves a site from `external_links`, and only if it finds none does it read
the website already stored for that lead and then ask Brave. So when `resolveWebsite` picked a
link-shortening address, the slot was full, the fallback chain never ran, and `01-mailto`,
`02-subpages`, `16-jsonld`, `28-sitemap` and `14-external-links` all died on the same redirect
every lap, permanently.

The pairs measured in the log:

| Redirect | Count |
|---|---|
| `pin.it` to `www.pinterest.com` | 9 |
| `paypal.me` to `www.paypal.com` | 8 |
| `selar.co` to `selar.com` | 4 |
| `openinapp.link` to `openinapp.com` | 3 |
| `t.mtrbio.com` to `metricool.com` | 1 |

`NOT_OWN_SITE_HOSTS` already held every analogue of these (`bit.ly`, `goo.gl`, `t.ly`,
`shorturl.at`, `a.co`, `amzn.to`, `paypal.me`) and `SOCIAL_HOSTS` already held `linktr.ee`,
`beacons.ai` and `stan.store`. These were simply missing, and `pinterest.com` itself was on no
list at all. Added the public redirectors and link-in-bio hosts beside the ones already there,
so those leads go down the fallback chain that can find a real site. **This completes an
existing list, it does not change policy:** nothing stops being collected, because fetching
`pinterest.com` under a creator could only ever file Pinterest's contacts as theirs, which is
what the list exists to prevent.

The screen had no test over it at all, which is why four obvious members were missing.
`src/bloodhound/db-hosts.selftest.ts` now covers it with 21 assertions. 291 vitest tests
green, breaker selftest passes, typecheck clean.

## What is open, and whose call it is

1. **Read the fleet on Monday and Tuesday.** Eleven held mailboxes are healthy and on timers,
   three within an hour of clearing. If they come back you go from 13 clear to about 24 with no
   action, and capacity roughly doubles. If Monday's volume knocks them below 90 again, the
   timers are being reset faster than they run out, and that is the real problem rather than
   any one mailbox.
2. **The two health-gate numbers are worth a look.** The watch bar is a score under 90 and
   recovery needs 90 or better for 48 straight hours, so a mailbox at 89.9 loses two days and
   can cost two siblings the same two days. Today that cost two of five lost slots on addresses
   scoring 96.7. Loosening either number trades deliverability for volume, so it is Casey's
   call. What is new is that the price is measurable: 11 of 45 held mailboxes are healthy.
3. **Decide whether to follow a creator's own branded shortener.** This cycle had `aba.link`
   to `andersonadvisors.com`, `ltrp.xyz` to `linguatrip.com`, `genesisivf.org` to
   `genesisfertilityhospitals.com`, `cme.sh` to `www.bigdaddydigital.com`. Those destinations
   really are the creator's site, reached from a link the creator published, and the lane
   refuses all of them, so those leads yield nothing on every lap. The safe version is to
   require the destination to pass the ownership test a Brave result already has to pass
   (`domainLooksOwned` plus `strongNameMatch` on the fetched page), which is stronger evidence
   than the search path already accepted. Left alone because it changes what gets collected.
4. **Plan for Apify's 11-01 refill with the real unit cost.** $100 at the measured $0.115 a
   lead is roughly 700 recovered leads, and enriching them costs about $116 at the newly
   measured $0.1654. OpenRouter holds $66.79 with 43 days of runway, so the refill needs a
   top-up decision beside it. The old figure would have said $190.
5. **The shelf keeps growing and nothing drains it.** 5,147 creators enriched and never
   written to, up 1. `already_sent` has not moved off 1,666 in ten days. Over the prior seven
   days 680 people got an email and 10 of them had never heard from us, 1.5%.

## Safety and spend

$0 billed to the Anthropic API. OpenRouter spent $1.56 account-wide with $66.79 left, about 43
days of runway; the finder's own log shows 91 calls on `qwen/qwen3.7-flash` for $0.0467. Apify
sat at its $10 reserve and ran nothing until 11-01. Zero fatal error signatures, no halt flag,
no escalation.

The YouTube key pool reads 15 working of 66, 50 quota-exhausted and 1 blocked. That is settled
and inert: the quota on those projects was cut, so a midnight reset cannot refill them, and
finding new channels is off by Casey's 2026-09-08 order.

The 36,909 `below_threshold` rows rewritten in 149 seconds at 06:41Z are the weekly
subscriber-floor sweep re-stamping its own population, not a demotion. `shape:
batched_sweep`, `moved: restamp`, population change 24.

`npm run send` fired once at 07:20Z and sent one email (The Belize Real Estate Guide), which
is a lead parked under `review_status=approved` rather than off the `approved_hold` shelf. It
landed after the cycle closed, so it belongs to the next count.

Discovery wrote 0 new channels, which is the 2026-09-08 order working as intended.
