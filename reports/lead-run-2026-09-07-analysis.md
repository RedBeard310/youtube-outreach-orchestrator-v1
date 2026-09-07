# Lead Run Analysis — 2026-09-07

Cycle: 2026-09-06T07:00:00Z → 2026-09-07T07:00:00Z (midnight Pacific to midnight Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-07.json`,
the campaign and sweep logs, the Apify batch ledgers, and direct queries against the
`pipeline` database. Anything measured by hand during this session is labelled as such.

## Headline

**+488 parked**, `approved_hold` 4,956 → **5,444**. That is the biggest one-day gain on
record, just past the 480 of the 2026-07-09 debut run and more than three times yesterday.

**`needs_contact` fell 371**, from 4,243 to **3,872**, while taking in 26 new arrivals. It
is the third fall on record and much the largest. Combined, **9,316 creators found and
never contacted**, none of them mailed.

And the other half of the day: **discovery produced nothing for 11 of 24 hours**. The
YouTube key pool ran out at 19:29Z and did not refill at the midnight-Pacific reset.

## The funnel

| Measure | Value |
|---|---|
| Channels discovered | 1,604 |
| Scored 6 or better | 81 (5.0%) |
| Verified email by cycle end | 31 |
| Scoring failures | 0 |
| Campaign sessions | 6 started, 6 done |
| Finder passes | 214, for 17 fresh pitchable |
| Hard stops / quota stops / time-budget stops | 1 / 0 / 5 |
| Term-starvation notices | 24 |
| Fatal signatures | none |
| Halted hours | none |
| Anthropic spend | $0.00 |

Discovery by lane (channels, then score 6+):

| Lane | Channels | 6+ | Rate | State |
|---|---:|---:|---:|---|
| Video-graph sweep | 1,022 | 57 | 5.6% | Stopped 19:29Z on the key pool, slept to the refill |
| Recommended-videos feed | 254 | 6 | 2.4% | Seed book reached zero; refill restarted it 07:11Z |
| Keyword search | 225 | 17 | 7.6% | 214 finder passes |
| Peer network | 100 | 1 | 1.0% | Book fully walked; refill finding no new seeds |
| Guest-link mining | 3 | 0 | — | Trickle |
| Comment sweep | 0 | 0 | — | Paused by Casey 08-20, working as intended |

Best niches among the 81: health and wellness clinics 23, coaching and consulting 13,
transformation and performance coaching 13, real estate 11.

## Q1 — where the 488 actually came from

Not from finding. 1,604 channels produced 81 worth pitching and 31 verified addresses by
the close. The rest of the gain came out of the standing pool of creators we had already
found and could not reach.

Attribution, by the most recently verified contact point on each lead that moved
(707 `approved_hold` rows were touched in the window; the pool gained 488 net):

| Address came from | Leads |
|---|---:|
| Apify endspec scraper (the "View email address" button) | 254 |
| Bloodhound free methods (mailto 57, subpages 53, channel page 41, podcast 36, about text 21, other 8) | 216 |
| No stored contact point (the role-address re-check plus the normal verify path) | 237 |

Two of the three drivers were changes Casey shipped **mid-cycle at 16:45Z**, so this
cycle is the first measurement of them.

**Role addresses.** `info@`, `team@` and the like had been parked as "risky" and never
used. ZeroBounce reports two different things with that one word: `role_based` means the
mail server was reached and the mailbox exists, and `catch-all` means the domain accepts
everything and nothing was proved. The new rule takes only the first. Reopening the
backlog checked **227 addresses and recovered 187 (87%)**. Verified this session: the
risky-verdict backlog in `needs_contact` is now **0**.

## Q2 — the key pool did not come back

At 19:29Z the video-graph sweep printed `STOP: YouTube key pool exhausted mid-triage` and
slept **41,716 seconds** to the midnight-Pacific refill instead of retrying every 900s.
That is the designed behaviour and it is correct. Everything else that needs the YouTube
API went quiet with it. Hourly discovery counts confirm the shape exactly: 154, 105, 143,
92, 150, 138, 74, 102, 155, 128, 127, 165, 71, then **eleven consecutive zeros**.

The part that is not normal is the refill. The sweep woke at 07:05Z, five minutes past
midnight Pacific, and retired twelve keys in a row on `daily quota exhausted` inside
270 milliseconds. So I ran the finder's own key test by hand at 07:35Z, thirty-five
minutes past the reset:

```
WORKING            15
BLOCKED-SUSPENDED   1
QUOTA_EXHAUSTED    50
TOTAL              66
```

Keys the rotation had not touched since the reset were refusing too, so this is not the
rotation mislabelling its own spending. **The pool genuinely did not refill.**

Two explanations fit and they need different answers:

- Google's reset is running late, in which case the pool fills later and the cost is the
  morning.
- Those projects have had their YouTube quota cut, which is what a compliance audit does,
  and waiting fixes nothing.

A single reading cannot separate them. A reading a day can, which is why the fix below
takes one every morning at the moment it is worth the most.

Worth carrying forward, because it changes what "add more keys" buys: a keyword search
costs 100 quota units while the sweeps spend 1 unit per channel and get their edges by
reading watch pages for free. A drained pool hurts the keyword lane first and the sweeps
last, so more keys mainly buy keyword search.

## Q3 — the Apify lane, and why yesterday's numbers were wrong

**It stopped itself on Saturday evening**, $83.89 into a $100 month. The wrapper holds
$10 back on purpose, so with $16.11 showing it can no longer fit a $7.02 batch. It rests
until the billing cycle resets on 30 September. Nothing is broken.

**Yesterday's debrief called the falling hit rate a thinning pool. It was a billing bug.**
A channel that publishes no email wrote no contact point, and the cohort query only
excluded channels that already had one, so a miss looked exactly like a channel nobody
had checked. The ordering is deterministic (`signal_score DESC, subscriber_count DESC`),
so the same 82 misses sat at the top of every batch and were paid for again. 485 channels
became 825 billed scrapes; $23.87 of $57.92 bought nothing.

Corrected numbers, from `leads.apify_endspec_attempts` (586 settled outcomes recorded):

- **83.4% of distinct channels publish an email** (489 found, 97 no_email), flat, not falling.
- The first batch after the fix found 85 of 100 and parked 60, at **$0.117 per parked lead**.
- Yesterday's planning figure of 25 parks per 100 channels was computed on double-billed
  batches. The fixed lane runs at about **60 per 100**.
- **3,644** leads in `needs_contact` have never been through this scraper. At $0.0702 a
  channel that is about **$256** to run all of them, for roughly **2,100 parked leads**.

The lane also brakes itself now: two consecutive batches over `MAX_COST_PER_LEAD` ($0.20)
write a halt flag the wrapper checks before spending anything.

## What broke, and what shipped

| Issue | Mechanism | Status |
|---|---|---|
| Paying twice for channels with no email | A miss left no record; queue sorted best-first | Fixed by Casey mid-cycle (`40059f66e`) |
| Real role addresses discarded | ZeroBounce collapses "mailbox reached" and "catch-all domain" into "risky" | Fixed by Casey mid-cycle (`efd5db1a3`) |
| Verify half dies after the money is spent | `verifyLedger` has no retry; one `fetch failed` throws out of `main()` | Fixed today, email repo `a9710338c` |
| Nothing measured the key pool | Half a cycle went dark on it; the snapshot carried no number for it | Fixed today, orchestrator `06dc970` |
| 50 of 66 keys out of quota after the reset | Slow reset, or quota cut on those projects | **Open.** Now the ceiling on finding |
| OpenRouter at 2.5 days | $45.26/day against $113.30 | **Open.** Hard deadline |
| Video-graph re-walks its chunk on a quota stop | Raised yesterday as waste | **Not worth fixing**, see below |

### Fix 1 — measure the key pool right after the daily reset (orchestrator `06dc970`)

`debrief-data.ts` now probes every `YOUTUBE_API_KEY` slot in the shared bank with the
cheapest possible call (`channels.list?part=id`, one quota unit) and emits
`youtube_key_pool`: working, quota_exhausted, blocked, invalid, rate_limited, other, plus
`working_pct`, `pool_collapsed` and the failing slot labels.

The timing is the point. The debrief fires at about 00:20 Pacific, twenty minutes past the
reset, so this measures the pool the day is **about to run on** rather than the pool
yesterday ended with. Cost is 66 units against a pool of hundreds of thousands.

Key values never leave the function. Google echoes the key back inside its own error
bodies, so only the slot label and the verdict are emitted.

`quotaExceeded` and a suspended project both arrive as HTTP 403 and need opposite answers
(wait for midnight vs replace the key), so `classifyKeyProbe` splits them; six cases added
to the selftest. A network error leaves a key uncounted rather than reporting a healthy
key as dead.

Verified: `tsc` clean, selftest ALL PASS, and the live probe reproduces the finder's own
key test exactly (15 working / 50 quota_exhausted / 1 blocked of 66).

### Fix 2 — replay the verify when the scrape is already paid for (email repo `a9710338c`)

An Apify batch is two halves with a wall between them: the scrape spends the money, then
ZeroBounce decides which addresses are worth parking. `verifyLedger` has no retry, so one
transient `fetch failed` throws out of `main()` and the second half never runs. It hit the
12:21 and 14:21 batches back to back on 09-06: **$14.04 of Apify money bought 40 published
addresses that nobody then checked**, and both logs end on the words "fetch failed".

It also blinded the lane's own money brake, which needs a "leads flipped" number to score
a batch. A crashed verify produced neither a strike nor a reset, so the guard stopped
counting on exactly the runs that went worst.

Replaying costs nothing at Apify: `--verify-only` replays the frozen ledger the scrape
already wrote. The wrapper now does that once when the log shows a finished scrape and no
verify. Once, not a loop.

Verified: `bash -n` clean; the detector run against the four real 09-06 logs picks out
exactly the two crashed batches and skips both the healthy one and the one killed
mid-scrape. Replaying both live returned "0 ZeroBounce checks, 0 flipped", because the
Bloodhound verify pass had already swept those 40 addresses up overnight. So the crash
cost latency rather than leads, and the replay is provably idempotent when another lane
got there first.

### Deliberately not fixed

**The video-graph chunk re-walk.** Yesterday's rec 3 called it pure waste on every quota
stop. Measured today: a chunk is 20 seeds, the channels already given a verdict are
remembered in a persisted `evaluated` set, and the re-walk is watch-page scraping, which
costs no quota. The comment in the code explains why the seeds are deliberately not
consumed: consuming them would lose the partially processed candidates. It is doing the
right thing and the waste is 20 free page reads.

**Seed-book refills and lane spend policy.** Two of three graph lanes are out of seeds and
the peer refill is finding nothing new. Video-graph is the one still working because it
rebuilds its own book hourly from newly qualified channels. Changing the other two to that
pattern is a design change with a spend tail, which is Casey's call, not the autopilot's.

## Ranked recommendations

1. **Top up OpenRouter today.** $113.30 at $45.26 a day is 2.5 days, and it is the one line
   that stops everything: every lane scores its channels through it. The daily rate has
   doubled since Friday and most of it is the enrichment backfill, which keeps no spend log
   of its own, so the provider's account meter is the only honest number.
2. **Look at the YouTube key projects in Google Cloud.** 50 of 66 still out of quota half an
   hour after the reset. Today's snapshot says whether it repeats. If it does, more keys
   from the same accounts buy nothing. `youtube-lead-finder-v1/scripts/audit-key-projects.sh`
   reads each key's project without spending YouTube quota.
3. **Decide the Apify budget for the month.** Out of money on 7 September, resting until the
   30th. The overspend is fixed and the corrected economics are much better than yesterday's:
   about $256 to run the 3,644 untouched leads, for roughly 2,100 parked leads at about
   $0.12 each. It halts itself above $0.20. Spend call, not an engineering one.
4. **Both other graph lanes need new seeds.** The feed walked its book to zero; the peer
   refill has nothing to add.
5. **Enrichment needs nothing.** 5,314 of 5,459 parked leads carry a bundle, so 145 are
   outstanding.

## Status caveat

Everything is **parked**, nothing sent. `approved_hold` is a deliberate holding lane and
only `npm run send` mails anyone.
