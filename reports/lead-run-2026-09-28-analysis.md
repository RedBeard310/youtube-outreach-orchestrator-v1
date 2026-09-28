# Lead run analysis, cycle 2026-09-27

Companion to [lead-run-2026-09-28.html](lead-run-2026-09-28.html). Cycle window
2026-09-27T07:00Z to 2026-09-28T07:00Z, which is Sunday 2026-09-27 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-28.json`.

## Headline

**The recovery lane's cursor crossed into the part of its book that cannot be
read without paid search, and both Brave keys are still at their monthly cap.**
The share of leads with no website found went 3%, 3%, 48%, 94% across the day's
four collect passes. There are 576 such leads in the book. At $5 per 1,000
searches, one attempt at all of them costs under $3.

Everything else was quiet: +2 parked, 0 emails (Sunday), 0 faults, 0 halts,
$0.00 Anthropic for the fifteenth day.

## The book has a cheap end and an expensive end

`COLLECT_IDS_SQL` in `src/recovery/bloodhound-lane.ts` sorts the collect book by
a tier, then by discovery date. The tier is:

- **-2 / -1**: on `leads.recovery_priority` (Casey's finance and coaching batch).
- **tier 0**: the lead's YouTube page links a website, OR a `website` contact
  point has already been stored for it. Reading it costs nothing.
- **tier 1**: neither. The only route to a website is a paid Brave search.

Counted live against Postgres with the selector's own predicate:

| Tier | Leads |
|---|---|
| -2 (priority) | 139 |
| -1 (priority) | 40 |
| 0 (free to read) | 2,562 |
| 1 (needs a paid search) | 576 |
| **Total** | **3,317** |

That total matches `collect_book_pool` in the metrics file exactly, so the tier
split is a decomposition of the book the lane actually walks, not an
approximation of it.

The cursor entered tier 1 during the 21:01Z pass. `logs/bloodhound-lane-state.json`
records `collectCursor.tier: 1` from that pass onward.

## The four passes, and why the day has two separate causes

| Pass (UTC) | Cursor tier | No website | Leads with a contact | Contact points |
|---|---|---|---|---|
| 07:00 | 0 | 3% | 1 / 150 | 1 |
| 14:01 | 0 | 3% | 0 / 150 | 0 |
| 21:01 | 1 (crossing) | 48% | 6 / 150 | 22 |
| 04:00 | 1 | 94% | 4 / 150 | 18 |

Two different failures, and they need opposite answers:

- **Passes 1 and 2 could see and found nothing.** 97% site resolution, one
  contact point across 300 lead-slots. This is the mined-out lap-6 book
  documented since 09-22. Search credit changes nothing here.
- **Passes 3 and 4 could not see.** These leads have never had a website found
  for them, by definition of tier 1, so there is no stored site to fall back on
  and the free channel-page route rarely carries one. With Brave refusing, 141
  of 150 leads in the last pass resolved nothing at all.

Summing them into "40 contact points, down from 1,300 in the prior 7 days"
produces a number that recommends nothing.

## Verify, and the +2

`needs_contact` fell by 1 to 4,235; `approved_hold` rose by 2 to 6,865.

Eight verify slots ran. Six logged `no_pending_email_points`. The two that had
work each tested one address and each flipped one lead:

- 23:01Z: `1 addresses checked, 2 rejected on ownership before checking, 1 leads
  with a valid email, 1 flipped needs_contact → approved_hold`
- 06:01Z: `1 addresses checked, 0 rejected on ownership, 1 flipped`

Verify is not the constraint. It can only test what collect finds, and collect
found five email addresses all cycle.

## Alarms

Four firings, all observation-only, none escalated:

| Alarm | Times | Reading |
|---|---|---|
| `bloodhound_collect_walking_in_place` | 3 | 749 slots / 302 then 451 distinct; causes `rewind_loop` then `lap_rewalk` |
| `bloodhound_collect_yield_degraded` | 1 | 0/150 (0%) against a 5% long baseline |
| `bloodhound_site_resolution_collapsed` | 1 | 141/150 (94%) |

The walking-in-place alarm reported the same window twice with two different
causes, six hours apart, and both readings were correct at the time. A real
rewind happened at 14:01 (`previous_pass_truncated`, rewinds 1 of a cap of 3),
so the 15:11 firing read `rewind_loop`; by 21:11 no counter had risen further,
so it read `lap_rewalk`. The 09-23 rise-not-standing rule is doing what it was
built for.

Also worth recording: the 07:00 pass opened with a rewind for
`previous_pass_search_dead` (rewinds 2 of a cap of 48), so Friday's dead-search
passes kept their leads rather than being stamped walked. That machinery, built
after 09-04, has now saved leads two cycles running.

## Shipped: `7a06ce5`, the refusal count is a yes/no and never was a volume

Yesterday's fix (`41a23f5`) added `braveRefusals` to `collectPassAttribution()`
so the alarm would stop dismissing a real Brave outage. It counts occurrences of
the all-keys-refused line inside the judged pass.

**That line prints at most once per pass.** `searchBrave()` in
`youtube-email-outreach-v1/src/bloodhound/db.ts` latches a module-level
`braveExhaustedWarned` the first time every key refuses:

```ts
if (!braveExhaustedWarned) {
  console.error(`[bloodhound] All ${braveKeys().length} Brave Search API key(s) refused: ${why}. ...`);
  braveExhaustedWarned = true;
}
```

A collect pass is one process, so the count is 0 or 1 however many lookups die.
The alarm text read it as a volume:

> It did lose 1 lookup to every Brave key refusing at once ... which is the
> smaller half of this pass.

On today's 94% pass that sentence would have described 141 lost leads as one
lost lookup and called it the smaller half. This is the same class as the three
fixes before it (09-22, 09-23, 09-27): a sentence naming or dismissing a remedy
with no measurement behind it.

What shipped:

- `collectPassAttribution()` gains `braveRefusedAfterLeads`, `leadsAfterRefusal`
  and `noSiteAfterRefusal`. Once the line has printed, every later lookup in that
  pass got nothing, so the leads behind it are the measurable cost, the ones that
  still resolved prove the free routes were carrying part of the pass, and the
  no-site count among them is an honest upper bound (some creators have no site).
- Both alarm texts now say that instead of counting log lines. Live on the real
  log the new sentence reads: *"every key refused from its first lead onward, so
  the 150 leads behind that point ran with no web search at all. 141 of them
  resolved no website (an upper bound on the cost: some creators have none), and
  9 resolved anyway off a stored site or the channel page."*
- `bloodhound_site_resolution_collapsed` stops keeping a private copy of the
  parse. It had its own 400-line tail window and its own substring test, and its
  `lines.slice(start)` ran **past** its own pass boundary, so a refusal logged by
  the *next* pass counted as evidence about this one. It now goes through
  `collectPassAttribution()` like its two siblings, matching the same regex
  `lastCollectPassSearchDead()` rewinds on. Third instance of "a private copy of
  a predicate it was meant to track" (09-13 `collectBookDepth`, 09-22 the tail
  read, now this).

Verified: tsc clean, **100/100 tests** (4 new, including a
refusal-in-the-previous-pass case that must cost this pass nothing while still
reporting the collapse), and the check-in run end to end against the live logs,
exiting `healthy`.

## Sends

| Pacific day | Wed 09-23 | Thu 09-24 | Fri 09-25 | Sat 09-26 | Sun 09-27 | Mon 09-28 |
|---|---|---|---|---|---|---|
| Loaded into SmartLead | 47 | 55 | 107 | 0 | 0 | 2 so far |

Sunday's zero is the schedule. `siege-plan.timer` is `Mon..Fri 08:15
America/New_York`, and the ramp counts sending days, so Monday resumes at day 4
of `[50,50,100,100,150,150,200,250]`, cap 100.

**Forty minutes after this cycle closed, the session-start send pushed two.**
At 07:20:32Z on 09-28 it found two leads in the `approved` lane and pushed both
in 17.5s (`send_attempted=2 send_sent=2 send_failed=0`):

- `rec6x1O2XXHHiJwNr` The Beck Team, Coldwell Banker Realty, old score 9, to the
  real-estate campaign
- `recTzGnebujeamCb0` Marie Stopes International Cambodia, old score 7, to the
  health campaign

Two things follow. First, **the `approved` lane is not permanently empty.** The
09-25 debrief called it structurally drained at 1,827 leads all sent; it now
reads 1,829, all sent. It refills at a trickle and the session-start trigger
fires into it. The only lane-touching event logged in the cycle was `dnc-sync`
releasing one lead at 23:23Z, which is not enough to account for both, so what
refills the lane is **not established** and should not be assumed.

Second, the second lead is worth Casey's eye on fit. Marie Stopes International
Cambodia is an international reproductive-health NGO, reached through the search
term "fertility clinic patient referrals". It is not a high-ticket B2B service
business in the sense the pitch assumes. One lead is not a pattern, and adding
an exclusion category is Casey's call, so this is recorded rather than acted on.

## Everything else

- **Enrichment:** 2 batches of 1 lead, both `exit=0 done=1 failed=0`, idle after
  each. Pool of 3 with 2 permanently excluded. Shelf **6,575 ready to write**,
  **6,857 of 6,865 bundled (99.9%)**. The 09-08 order to put every resource into
  the leads already in hand is finished work, not a stalled lane.
- **Discovery:** 0 new channels, intended. `logs/discovery-paused.flag` is
  present and untouched. All five sweeps stale by design.
- **Stranded in the collect book:** 3, unchanged for 15 days, so no selector gap
  has reopened.
- **Money:** Anthropic $0.00 (15th zero). OpenRouter $1.50/day, $191.38 left,
  ~128 days. The drop from $2.03 is the enrichment drip, not a change in health.
- **YouTube keys:** 15 of 66. Settled since 09-16: quota was cut on 50 projects,
  so more keys on those accounts buy nothing, and nothing running today needs
  them.
- **Apify:** still resting on its $10 reserve. Billing cycle rolls 30 September,
  two days out. Last run: 62 recoveries at $0.099 each.
- **Owed debriefs:** 09-19, 09-18, 09-17, 08-18, 08-17, 07-11.

## Ranked next

1. **Raise the Brave cap or add a key.** 576 leads, roughly one search each, $5
   per 1,000 searches, so under $3 for one pass at the whole tier. Until then the
   lane spends 600 lead-slots a day on leads it cannot read. Casey's spend call
   and the cheapest item on the list.
2. **Decide the discovery pause.** The free end of the book is mined out. Only
   new arrivals create work for the recovery lane, enrichment or the send path.
3. **Watch Apify on 30 September.** The only lane with a proven cost per
   recovered lead.
4. **Find the session-start send trigger.** It loaded two real emails on Monday
   morning from a lane thought to be empty. Nothing is watching it.
5. **Unblock more Siege offers.** Ten of sixteen cannot run. Offer variety, not
   lead supply, is the volume ceiling.

## The lesson

The lane's yield fell for two unrelated reasons eight hours apart, and the daily
total is the sum of both. One half is re-reading leads it already emptied, which
no money fixes. The other half is reading leads it has never been able to see,
which about three dollars fixes. A single daily number averages them and
recommends nothing.
