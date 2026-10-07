# Lead run analysis, cycle 2026-10-06

Companion to [lead-run-2026-10-07.html](lead-run-2026-10-07.html). Cycle window
2026-10-06T07:00Z to 2026-10-07T07:00Z, which is Monday 2026-10-06 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-07.json`.
Per-lead detail counted from `automator/logs/siege.log`, and the send history
checked directly against `leads.outreach_sends` and `leads.lead_candidates`.

## Headline

**The push walked its entire 250-lead plan without being killed and still loaded
only 139, because SmartLead declined every person already sitting in another
campaign.**

The split is clean enough to settle the question on its own:

| | leads | had been emailed before |
|---|---|---|
| SmartLead accepted | 139 | **0** |
| SmartLead refused | 106 | 103 marked `sent_to_smartlead` |

Every one of the 106 refusals carried the same counter,
`skipped_in_other_campaign_count: 1`. **Not one 429 fired all cycle.** Yesterday's
wall was a different wall.

The cause is a setting whose name reads backwards.
`ignore_duplicate_leads_in_other_campaign: true` tells SmartLead to skip anyone
already in another campaign. Siege has asked for `true` since it shipped, but the
live POST dropped the setting until 2026-10-03, so SmartLead used its own default
and repeat offers went out fine through 10-02. The day the setting started
arriving, repeat offers stopped. Casey set it to `false` at 01:16Z today
(`becf7fd1a`, with the comment corrected in `d10b066af`).

Everything else was quiet, and the quiet is the second story: the work the
discovery pause was meant to fund has run out.

Zero fatal signatures, zero halts, zero crashes, twenty-fourth consecutive cycle
of $0 Anthropic spend.

## Finding 1: the refusals were repeat people, and that is provable

150 batches ran between 10:15:21Z and 11:00:57Z. The tally closes exactly:
139 sent + 106 failed + 5 skipped = 250 planned.

The 106 are not a progressive failure. The first half of the attempt order loaded
76 of 122 and the second half loaded 63 of 123, so nothing degraded as the hour
went on. The refusals arrive in blocks because Siege groups its plan by person,
and a person either is or is not already in a SmartLead campaign.

Querying the refused ids directly:

- 76 of the 106 have a row in `leads.outreach_sends` dated before 2026-10-06.
- 103 of the 106 carry `outreach_status = sent_to_smartlead`, so they were pushed
  at some point, including in the era before Siege recorded sends in its own
  table.
- 3 of the 106 are `ready_data_scraped` and have never been emailed by us, yet
  SmartLead still called them duplicates.

Of the 139 SmartLead accepted, **not one** had any prior send. The API was
behaving exactly as instructed.

Those last 3 are the only loose end. The likely explanations are an address shared
with another lead row or a lead added to a campaign by hand. It is 3 leads out of
250, so it is worth a note rather than an investigation.

### What this cost, and what the fix is worth

The direct loss is 111 emails a day (106 refused plus 5 skipped) on every sending
day from 10-03 to 10-06. The larger loss is structural. Siege's whole design is
several offers per person over time, which is how 7,593 parked people turn into far
more than 7,593 emails. While the flag was arriving, the repeat stream was closed
and only first-touch people could be mailed. That makes Wednesday's push the most
informative measurement on the board: a clean run should show roughly 250 loaded
and zero `skipped_in_other_campaign_count`.

## Finding 2: SmartLead named the reason and two layers of our own code threw it away

The reply was complete, readable and sitting in the log 106 times:

```json
{"ok":true,"upload_count":1,"total_leads":0,"skipped_in_other_campaign_count":1,
 "block_count":0,"duplicate_count":0,"invalid_email_count":0,"invalid_emails":[],
 "already_added_to_campaign":0,"unsubscribed_leads":[],"is_lead_limit_exhausted":false,
 "lead_import_stopped_count":0,"bounce_count":0}
```

**Layer one, in the email repo.** `assertLeadAdded` matched that body against a
hand-written list of seven counters. `skipped_in_other_campaign_count` was not on
the list, so the function fell through to its "no reason given" branch and printed
the body as a consolation prize. A list of reasons can only ever lag the API.

**Layer two, in the orchestrator.** `normalizePushReason` trims a refusal to 120
characters so that 106 identical refusals collapse to one counted row instead of
106. With the body quoted inside the message, the cut landed four characters
before the key. The authoritative JSON for today reads:

```
"reason": "SmartLead did not add the lead (no reason given; its whole reply was
           {\"ok\":true,\"upload_count\":1,\"total_leads\":0,\"skippe"
```

So the snapshot that exists specifically to remove hand-reading of logs sent a
reader back to the log to answer the one question that mattered.

### The misdiagnosis this produced

Yesterday's debrief read the 50 silent refusals of 10-05 as part of the SmartLead
account rate-limit story and wrote that they gave "no reason counter set". Today's
cycle shows the same refusal shape with **zero** 429s, which means that family of
refusals is the duplicate flag and not the rate limit. The 3 outright 429s on
10-05 were real, were a different fault, and the retry work shipped for them
(`eedbbff87`) still stands. The rate limit remains a genuine shared ceiling
between the push and the reply poller. It simply was not what cost us the emails.

### Both layers fixed

- `youtube-email-outreach-v1`: `assertLeadAdded` moved out of `scripts/push-batch.ts`
  into `src/smartlead/add-lead-outcome.ts` and rewritten to report **whatever the
  reply set**, with the known counters used only for ordering. It had no test
  before, because importing `push-batch.ts` runs a push. It now has 7, including
  the exact 10-06 body and a fabricated future counter nobody has listed.
  `npm run typecheck` and `npm run typecheck:scripts` clean.
- `youtube-outreach-orchestrator-v1`: `normalizePushReason` now condenses a quoted
  JSON reply to the fields it actually set, which is both shorter than the body and
  the entire diagnosis. A truncated or non-JSON body is left exactly as logged
  rather than guessed at. Four new selftest cases, whole selftest passing,
  `tsc --noEmit` clean. The `send_plan` note now tells the next reader to read the
  counter and not reach for the rate limit twice.

## Finding 3: the discovery pause has run out of work to fund

The pause was ordered on 2026-09-08 so that every resource could go into enriching
the leads already in hand. Four measurements say that job is finished.

**Enrichment.** 7,583 of 7,593 parked leads are bundled, 99.9%. The backfill chain
ran **one batch with one lead** in the whole cycle. There is nothing left to
enrich.

**Free recovery.** The collect pass is on **lap 8** of a 2,523-lead book. 99.3% of
the leads it walked were re-walks. It produced 11 contact points across 6 people
and **one email address on one person**, which did not verify. Compare the previous
seven days: 184 free contact points and 49 email points.

**It is a picked-over book and not a broken lane.** Website resolution was the
healthiest it has been measured: 1 no-site in 150 sampled, 0.67%, against 67.5% two
days ago and 16% yesterday. Zero Brave key refusals, zero errors. The lane has full
reach and nothing left to reach for. Stranded held at 3 for the 24th day, so no
selector gap has reopened.

**Paid recovery.** Apify ran 0 batches. $10 of the $100 monthly allowance remains
and all $10 of it is the untouchable reserve, so $0 is spendable until the cycle
rolls on 31 October. 0 price strikes, not halted.

Net effect: the parked pool moved 7,592 to 7,593. One lead. The machine is healthy,
cheap and idle.

## The shelf, stated the way it should be read

- `approved_hold` total: **7,593**
- Already emailed and must never be written to again: **756**
- Real inventory, people never emailed: **6,827**
- Enriched: 7,583, which is 99.9% of the total on purpose, since a sent lead was
  enriched too

At the plan's 250-a-day cap that is roughly 27 sending days of first-touch email,
and more than that once repeat offers flow again.

## Money

| | |
|---|---|
| Anthropic | **$0.00**, 24th consecutive cycle |
| OpenRouter | $2.47 a day, $104.36 left, about 42 days of runway |
| Apify | $0 spendable until 31 October, $90 of $100 spent |
| Brave | no refusals, no errors, resolution healthy |

## Standing items, unchanged

- **Discovery is off by Casey's order** since 2026-09-08. 0 new channels written,
  which is the intended state. Nothing here re-enabled, restarted or repaired any
  sweep, timer or flag.
- **15 of 66 YouTube keys** came back working after the midnight reset, 50 still
  exhausted and 1 blocked. Settled question: the quota was cut on 50 of the
  projects. It does not matter while discovery is off, because the sweeps run on
  1-unit calls and keyword search is what needs the quota.
- **The 10-03 pool-leak fix is holding.** The push ran 46 minutes across 150
  batches and `siege-plan.service` reported success. It was not killed at the hour.
- **This repo's own send path** ran once, attempted 2 and loaded 1.
- **Six cycles have metrics on disk and no debrief**: 09-17, 09-18, 09-19, 08-17,
  08-18, 07-11.

## Ranked next

1. **Confirm the duplicate flag on the next sending day.** Expect roughly 250
   loaded and zero `skipped_in_other_campaign_count` in `push_outcome`. Biggest
   lever on the board, and worth more than the 111 daily emails it recovers,
   because it reopens repeat offers to all 7,593 people rather than only the 6,827
   never emailed.
2. **Decide whether to lift the discovery pause.** It was ordered to fund
   enrichment. Enrichment is at 99.9% and had one lead to do all cycle, and the
   free recovery book is on its eighth lap at 99.3% re-walk. The pause now costs
   new supply and buys nothing. Casey's call alone.
3. **Decide the Apify allowance.** $0 spendable for 24 more days. Its best month
   recovered 244 leads for $28.08, about 11.5 cents each, so the question is
   whether to raise the cap now or accept the quiet stretch.
4. **Revisit the 250 day cap once repeats flow.** The plan capped at 250 while the
   live inboxes would have accepted 533. The warmup ramp, not the mailboxes, is
   what is holding volume down.
5. **Backfill the six missing debriefs.** The metrics are on disk and the job
   carries no risk.
