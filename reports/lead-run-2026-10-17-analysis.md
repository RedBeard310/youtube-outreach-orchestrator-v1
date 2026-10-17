# Lead Run Analysis — 2026-10-17

Cycle window: 2026-10-16T07:00Z to 2026-10-17T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-17.json`.
Companion: [lead-run-2026-10-17.html](lead-run-2026-10-17.html).

## Headline

**82 emails loaded, nothing lost, and exactly one of the 79 people it reached had never
heard from us.** The other 78 were repeat offers. That is 1.3% first touches against 68.7%
over the prior seven days, and the shelf of never-written-to people printed the same 5,138
for the third morning running. Meanwhile the fleet halved again, from 42 live mailboxes at
Thursday's push to **18 at Friday's**, and the collapse is one-sided: **25 of the 33
mailboxes carrying a made-up name are stopped, against 1 of the 25 carrying Casey's.**
Eight whole sending domains are dead three mailboxes out of three.

## The numbers

| | |
|---|---|
| Emails loaded | **82** by Siege, 10:24Z to 10:50Z; 82 planned, 82 sent, 0 failed, 0 skipped |
| Push losses | **none at the push**. One 429 at 10:32Z left 4 people loaded into a campaign that never started, counted as sent |
| People reached who were new | **1 of 79** (1.3%). Prior 7 days: 1,158 of 1,685 (**68.7%**) |
| Ready and waiting for a slot | **1,012** (whale 63, strong7 141, other7 **808**); 949 of them in tiers that got zero slots |
| Fleet at push time | **18 live mailboxes** (casey 15, made-up 3), 270 msg/day allowance, 82 free slots |
| Band gate at 07:05Z | **26 stop / 14 watch / 18 normal** of 58; was 22 / 18 / 18 a day earlier |
| Fleet by persona | made-up: 3 clear, 5 watch, **25 stop** of 33. Casey: **15 clear**, 9 watch, 1 stop of 25 |
| Domains fully stopped | **8** (all made-up names), 3 more fully on watch; every clear mailbox is on a `contentgetsclients` domain |
| Why they stopped | 30 of 58 mailboxes read a spam hit inside 3 days; 24 read a score under 80. The 4 that fell this cycle scored 65.9 / 66.7 / 67 / 71.5 |
| People parked | **0**; `approved_hold` held at 6,811; **3 people got an address** (30 points) from 2 methods |
| Recovery lane | newest pass 150 leads, **670 points found / 666 already stored (99.4% re-walk)**; lap 10; `cause: resolution_ok`, 0 Brave refusals |
| Shelf, never emailed | **5,138**, unmoved for three mornings; `already_sent` 1,663, also unmoved |
| Enrichment | 0 batches, nothing to take. **6,801 of 6,811 bundled, 99.9%.** OpenRouter $0.00, 0 calls |
| `needs_contact` | 3,440; `collect_book_stranded` held at 3 for the 34th day |
| Spend | $0.00 Anthropic (34th cycle); OpenRouter $80.84 left; Apify dry to 31 Oct |
| Clean-run | 0 fatal signatures, 0 halts, 0 crashes |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched. |

## What the day actually was

**09:05Z, the gate takes one.** `travisoconnell@videobookscalls.com` moved into the stop
band on a health score of 66.7 with 3 of its last 16 warmup emails landing in spam. The
band gate runs hourly and bands all 58 mailboxes; the counts going into the push were 18
normal, 17 watch, 23 stop.

**10:16Z, the rehearsal.** Siege printed `inboxes live today: casey 15, made-up 3` and a
ceiling of 870 for sending day 17, then: after SmartLead's queue of 143 unsent first
emails and 822 mid-sequence messages, **82 slots for new offers**. The queue was flat
against Thursday (143 and 822 against 143 and 823), so the fall from 160 slots to 82 is
the fleet and nothing else. Watch-band mailboxes print `follow-ups only`, with their own
reasons attached: warmup mail in spam, a sibling-domain pull, or `recovering: clean
reading, 11h of 48h at 90+`.

**10:24Z to 10:50Z, the live push.** 82 assignments, 82 `SENT`, no `FAIL`, no `SKIP`. 145
Whale-tier people were ready against 82 slots, so the push took every slot it had. Six
offers ran: `owner-or-youtuber` 21, `joke-ai-slop` 19, `short-work-with-me-video` 13,
`short-save-time` 11, `voice-objection-proof` 10, `attack-enemy-propose-5-ideas` 8.

**10:32Z, one quiet loss.** `ESCALATE siege could not start a campaign that has leads in
it {"campaign": "4010851", "inbox": "caseybrown@meetcontentgetsclients.com", "leads": 4,
"http": 429}`. Four people are loaded and will not be sent until somebody starts that
campaign. They count as sent in every instrument.

**11:05Z and 14:05Z, three more stop.** `clintonrussel@videobookscalls.com` (71.5, 3 of
15 in spam), `darrenmayert@ytgetsclients.com` (67, 3 of 30),
`karlyost@videobookscalls.com` (65.9, 4 of 19). All four of the cycle's demotions came
with real readings, not the five-sending-day watch ratchet. Three of the four are on the
same domain.

**01:01Z, the recovery lane's newest collect pass.** 150 leads, 670 contact points found,
666 already on file. Four new points from 2 leads. Across the cycle, 30 points and **3
email addresses across 3 people**, from `18-rdap` (2) and `02-subpages` (1). Thursday's
two carriers, `28-sitemap` (13 addresses) and `17-podcast` (3), wrote nothing at all.
Nobody parked.

**07:05Z, the band gate's last run before the boundary.** 18 normal, 14 watch, 26 stop. The
18 clear mailboxes held their band through the whole cycle; every demotion came out of
watch.

## The one new finding

**The send path has stopped reaching new people, and the shelf has been saying so in a
way no instrument could read.**

Three consecutive mornings the shelf printed four identical numbers: `ready_to_write`
5,138, `bundled` 6,801, `already_sent` 1,663, `approved_hold_total` 6,811. Across those
cycles 242 emails went out. Sending an email does not move a lead out of `approved_hold`,
so a repeat offer leaves every one of those figures untouched, and a lossless push and a
day that reached nobody print the same number.

Counted off `leads.outreach_sends`, which holds one row per new offer started:

| PT day | people reached | never heard from us before |
|---|---|---|
| 10-08 | 558 | 266 (48%) |
| 10-09 | 611 | 277 (45%) |
| 10-12 | 75 | 72 (96%) |
| 10-13 | 776 | **767 (99%)** |
| 10-14 | 64 | 42 (66%) |
| 10-15 | 159 | **0** |
| 10-16 | 79 | **1** |

The mechanism is a queue, not a fault. `siege.fill_slots` hands slots out in
`priority_key` order, which is tier, then signal score, then subscribers, and nothing in
that key asks whether a person has been written to. The Whale tier's never-emailed supply
ran out on the record 776-person push of 10-13, where 767 of the 776 were first touches.
Since then its re-offer queue has been first in line every morning. Friday it took all 82
slots while **141 Strong-7 and 808 Other-7+ people sat ready, with research bundles, and
got nothing**.

Repeat offers are deliberate; Casey reopened that stream on 2026-10-07 and a second offer
to a creator who ignored the first is a real play. What was wrong is that nothing could
tell the two kinds of day apart.

## The second finding: the fleet is failing by identity, not at random

Split the 58 mailboxes by whose name is on them and the halves are in different states:

| | clear | watch | stopped |
|---|---|---|---|
| Casey's own name (25) | **15** | 9 | 1 |
| A made-up name (33) | 3 | 5 | **25** |

Eight sending domains are stopped three-for-three, all carrying made-up names:
`tubegrowthagency.com`, `videoleadsagency.com`, `tubeleadsagency.com`,
`videobookscalls.com`, `ytgrowthagency.com`, `ytgetsclients.com`, `contentgetsleads.com`,
`videoclientsagency.com`. Three more are entirely on watch
(`youtubegetsleads.com`, `contentgetsclientsvideo.com`, `hicontentgetsclients.com`). Every
mailbox still clear sits on a `contentgetsclients` domain.

The reasons are deliverability, not warmup age. 30 of 58 mailboxes read a spam hit inside
the last three days and 24 read a score under 80. Warmup mail landing in spam is the
domain's reputation, not the mailbox's age.

Two consequences. The obvious one is the ceiling: 18 mailboxes at 15 a day is 270, and 82
after follow-ups. The expensive one is the offers: `fill_slots` picks a mailbox by persona
and several offers may only come from a made-up name, so with 3 made-up mailboxes live
those offers are capped at a handful a day however large the shelf is.

The good news is that this gate lets a mailbox back. Its rule is 48 hours reading 90 or
better, not the old gate's two-week warmup restart, and two mailboxes are already partway
there. This is reputation to repair, not hardware to replace.

Gate thresholds, from `automator/state/inbox-health.json`: stop below 80 or two spam hits
in three days; watch below 90 or one hit; a domain with two sick mailboxes pulls its
siblings in, which is why these fail in whole threes; watch becomes stop after five
sending days on watch.

## Fixes shipped

**1. `sent_today.first_touch` in the orchestrator** (`src/db.ts`,
`scripts/autopilot/debrief-data.ts`). Counts people, not emails: how many of the cycle's
emails reached somebody who had never been written to, as a count and a percentage,
against the same measure over the prior seven days, plus `shelf_first_touch` for the only
number that drains the shelf. Reads `leads.outreach_sends` in one statement, fail-soft to
null at the call site. "Before" means before that person's own first send inside the
window, not before the window, so a person first emailed mid-cycle counts once and
correctly.

Verified against hand SQL on three windows: this cycle 79 people / 1 first touch / 1.3%,
10-13 776 / 767 / 98.8%, and a no-send day returning `first_touch_pct: null` rather than
0. Typecheck clean.

**2. `send_plan.waiting_for_a_slot` and `waiting_by_tier`** (same feed). The queue that
explains a 1% first-touch day, summed and kept per tier, read off the plan file Siege
already writes. 1,012 waiting on 10-16, 949 of them in tiers that got zero slots. Three
new selftest cases cover the real 10-16 shape, a non-numeric tier costing that tier rather
than the sum, and a plan with no waiting block costing nulls rather than the plan.

Both landed in the orchestrator at `c63837e`. The 2-minute auto-sync timer committed them
under its own message before the agent's commit ran, which is the known race; `git show
c63837e` carries all three files.

**3. The twin of the 10-12 content-type gate** (`youtube-email-outreach-v1`,
`c3b5c2b0f`). The pass's largest fault cause read `28-sitemap: non-HTML content-type` at
22 of 193 errors, five days after that gate was repaired. Reading the actual values
settled it: those are servers answering with no content-type header at all, which the
gate refuses on purpose. A server saying nothing is not a server saying text.

But chasing it found the real thing one file over. `src/email/fetch-scraper.ts`, the page
fetcher the **email finder and host-name resolver run by default**, had its own copy of
the same gate still on the pre-10-12 four-type list, discarding every `text/xml`,
`application/rss+xml` and `text/markdown` page unread. It now uses the identical rule to
`bloodhound/web.ts`, so the two cannot drift again. An empty content-type still passes
there, which `web.ts` refuses: that call site has always allowed it and tightening it
would silently drop pages the email finder reads today. Widen only.

Verified live: `www.offgridpower.solutions/sitemap.xml`, the exact URL named in the 10-12
comment, reads 160,685 bytes where it used to throw. Typecheck clean.

## Still open

- **The made-up-name domains.** 25 of 33 mailboxes stopped, 8 domains dead three-for-three.
  Outside the five repos this agent may edit, and a spend and branding call besides.
- **Siege's slot order has no first-touch term.** `priority_key` in
  `automator/scripts/siege.py`. Outside the five repos.
- **Campaign 4010851 was never started.** Four people loaded, 429, nothing retried. In
  `automator`.
- **Siege overwrites one plan file per day**, including from dry runs, so the plan that
  flew is gone by evening. The 10-16 stamps make it visible rather than silent and did so
  correctly this cycle (`delta_comparable: false`, `snapshot_gap_hours: 11.4`). The cause
  is still in `automator`.
- **Six cycles have metrics and no debrief**: 09-17, 09-18, 09-19, 08-17, 08-18, 07-11.

## Ranked next

1. **Decide what to do about the made-up-name domains.** The ceiling on everything
   downstream. The gate takes a mailbox back after 48 hours reading 90+, so the question is
   whether those domains can be rested and repaired or should be retired.
2. **Give Siege's slot order a first-touch term.** 5,138 enriched people have never been
   written to, 1,012 were ready on Friday, and all 82 slots went to people who have already
   heard from us. One tie-breaker inside `priority_key` would do it without touching the
   tier logic. Repeat offers stay, they just stop being first in line every morning.
3. **Restart campaign 4010851.** Four people are loaded, counted as sent, and nothing else
   will pick them up.
4. **Decide about the discovery pause.** Unchanged from Thursday: its stated job finished at
   99.9% enriched, and the two lanes that refill the shelf are a picked-over book on its
   tenth lap and a budget that resets on 31 October. The flag is untouched.
5. **Watch whether the 14 on watch follow the 26.** The gate promotes watch to stop after
   five sending days, so unless they clear 48 hours at 90+ the next step is already
   scheduled. All 18 clear mailboxes held their band this cycle, which is the reason not to
   call it a slide yet.
6. **Spread the push rather than spending it.** Three emails per offer on days 0, 4 and 10
   against a Monday-to-Thursday sender means a big first-touch day mortgages the next week,
   and 18 live mailboxes have no headroom to absorb that.
7. Backfill the six missing debriefs. No risk, any time.

## Verified vs assumed

**Verified.** The 82 agrees three ways (82 assignments in the plan, 82 `SENT` in
`automator/logs/siege.log` with no `FAIL` or `SKIP`, 82 rows with `outreach_processed_at`
inside the window). The first-touch collapse was computed by hand against
`leads.outreach_sends` before the new instrument existed and the instrument then matched
it on three separate windows. The shelf being frozen was checked straight against
Postgres, not inferred from the snapshots: `approved_hold` is 5,138 `ready_data_scraped`
and 1,663 `sent_to_smartlead` right now. The 42-to-18 fleet move comes from Siege's own log
line at each push, not from the plan delta, because the older plan on disk is a dry run.
The band counts, per-mailbox scores, spam readings and domain groupings come from
`automator/state/inbox-health.json` at its 07:05Z run, cross-checked against the persona
labels in Siege's plan. The `28-sitemap` content-types were read out of the collect log
rather than assumed. Both shipped fixes typecheck, the orchestrator selftest passes
whole, and the email-repo change was exercised against a live `text/xml` sitemap.

**Assumed, and worth saying so.** That the Whale tier's never-emailed supply "ran out" on
10-13 is read off the shape of the data, not off a counter Siege keeps; what is certain is
that 767 first touches happened that day and 1 has happened in the two cycles since. The
reading that made-up names deliver worse *because* they are made-up names is not proven
here: the persona and the domain are perfectly correlated in this fleet, so the data
cannot separate "the alias is distrusted" from "those eight domains have bad reputation."
Either way the mailboxes are stopped. The three-person gap between 82 loaded and 79 with a
send row is unexplained and was not chased.
