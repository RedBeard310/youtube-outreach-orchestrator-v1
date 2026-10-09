# Lead run analysis, cycle 2026-10-08

Companion to [lead-run-2026-10-09.html](lead-run-2026-10-09.html). Cycle window
2026-10-08T07:00Z to 2026-10-09T07:00Z, which is Thursday 2026-10-08 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-09.json`.
Per-minute push detail counted from `automator/logs/siege.log`; the plan read from
`automator/state/siege/2026-10-08/plan.json`; repeat-offer counts from
`leads.outreach_sends`; the unit's own verdict read from systemd.

## Headline

**The six-hour ceiling worked on its first real test. The push ran 86 minutes
without being killed and loaded 561 of a 567-email plan, the biggest and most
complete day on record. 128 of those emails were loaded after the minute the old
one-hour ceiling would have cut.**

Only six planned emails never went out, and five of them were drafts our own
quality gate refused, so the losing edge has moved from infrastructure to copy.

The second finding corrects yesterday's headline. **52% of the plan was a repeat
offer to somebody already emailed, so the never-emailed shelf drains at about 272
people a day, not 561.** That is five to six weeks of road, not under four.

Zero fatal signatures, zero halts, zero crashes, twenty-sixth consecutive cycle of
$0 Anthropic spend.

## Finding 1: the ceiling fix is settled, with room to spare

| | |
|---|---|
| Unit started | 10:18:14Z |
| First email loaded | 10:19Z |
| Finished on its own | 11:44:42Z |
| Wall time | **86 min 28 sec**, under a quarter of the new six-hour budget |
| Batches | 233 |
| Loaded | **561** of a 567 plan (99%) |
| Unit verdict | `Result=success`, live unit reads `TimeoutStartUSec=6h` |

All five `ExecStart` steps of the oneshot ran, including the daily report, which
wrote itself at 11:44:43Z. The three cycles that ended in a mid-batch kill (10-01,
10-02, 10-08) are closed.

**What the fix was worth, measured rather than projected:** 433 emails loaded
before 11:18:14Z and **128 after it**. That timestamp is where the old
`TimeoutStartSec=3600` would have sent SIGTERM.

Throughput rose with the plan size rather than falling: **6.5 emails a minute**
across the whole run against 4.0 on 10-08, and the final minute loaded 12, the
same as the tenth minute. 233 batches in 86 minutes is 22 seconds a batch
including writing the drafts, so the 10-03 pool-leak fix (`7fd02b6fd`) is still
carrying. At that rate the six-hour ceiling covers a plan of roughly 2,300 emails,
three times the current warmup cap of 870.

## Finding 2: the six that did not go were our own copy, and five were invisible

| Reason | Emails |
|---|---|
| Draft rejected by the writer's quality gate (`SKIP`) | **5** |
| SmartLead refused: `already_added_to_campaign=1` (`FAIL`) | 1 |

The five gate rejections, by the rule each one broke:

- **em dash outside the sign-off, 2 drafts** (the most common single cause)
- bare-title format in the five-ideas email, 1
- opener did not start the required way, 1
- rank superlative ("Your Best"), banned by the channel-metric rule, 1

That is a **1.1% shortfall on plan**, and it is a different kind of loss from
every cycle since 10-01, which lost emails to a timeout, an account rate limit or
a duplicate flag. The gate itself is healthy: **179 of 184 model-written drafts
passed, 97.3%**, for **$0.67** of OpenRouter spend across the day. The other 383
emails came from template offers that make no model call at all.

### Why five sixths of the shortfall had no explanation

The grounded snapshot read `sent: 561, failed: 1` against a plan of 567.
`siegePushOutcome` counted `SENT` and `FAIL` lines and ignored `SKIP`, so five
planned emails that never went out had no counter and no reason anywhere, even
though their reasons were in the log all along.

Fixed in the orchestrator **`394c90c`**: `push_outcome.skipped` with the reasons
attached, counted apart from `failed` on purpose. `failed` is SmartLead refusing a
lead we offered it; `skipped` is us declining to offer one, and the two need
different fixes. Verified live against the real log before committing: `skipped: 5`
with both reason shapes.

## Finding 3: the shelf lasts about twice as long as yesterday said

A push of 561 emails does not spend 561 people off the shelf. Checked against
`leads.outreach_sends` for all 567 planned leads:

| | Leads |
|---|---|
| First-ever email to that person | **272** |
| Second offer | 175 |
| Third offer | 117 |
| Fourth offer | 3 |
| **Repeat total** | **295 (52%)** |

The shelf arithmetic agrees to within one lead. `already_sent` rose 1,027 to
1,268, a gain of **241**, while **493** of the day's emails came out of the
`approved_hold` pool. The other 252 went to people already marked sent, so they
cost the shelf nothing.

### The repeat stream reopened two days ago

| Cycle | Plan | First-ever | Repeat | Repeat share |
|---|---|---|---|---|
| 10-02 | 200 | 115 | 85 | 42% |
| 10-05 | 129 | 80 | 49 | 38% |
| 10-06 | 250 | 174 | 76 | 30% |
| 10-07 | 503 | 446 | 57 | **11%** |
| 10-08 | 567 | 272 | 295 | **52%** |

The jump follows Casey setting `ignore_duplicate_leads_in_other_campaign` to false
on 10-07 (`becf7fd1a`). That flag had been telling SmartLead to skip every repeat
person, which is what closed the repeat-offer stream between 10-03 and 10-06. With
it off, Siege can do what Operation Siege designed it to do, which is work a person
through several different offers, and that structurally halves how fast the
never-emailed pool empties.

### The shelf, stated the way it should be read

| | |
|---|---|
| Never emailed, ready to write | **6,317** |
| Already sent (still sitting in `approved_hold`) | 1,268 |
| Parked total | 7,595 |
| Enriched | 7,585 (99.9%) |

Outflow against inflow, counting **people off the shelf** rather than emails sent:

| | per week |
|---|---|
| Push, at 272 never-emailed/day over 4 sending days | ~1,088 |
| Push, at 272/day over 5 sending days | ~1,360 |
| Free recovery lane | ~7 (1 parked this cycle) |
| Paid Apify lane | 0 until 31 October |
| Discovery | 0, by Casey's order |

**6,317 / 1,088 = 5.8 weeks. 6,317 / 1,360 = 4.6 weeks.**

Yesterday's 2.6 to 3.9 weeks used the raw push rate, which counts a repeat offer as
a person spent. It overstated the drain by roughly double. The shelf is still
finite and the decision is still the same one, but there is a month and a half of
road rather than three weeks of it.

## Finding 4: a daemon-reload had blinded the verdict that proved the fix

The snapshot read `unit_last_result: success` with `unit_last_started: null`, so
`push_unit_result` came out **null** on the one cycle whose verdict settled whether
the new ceiling worked.

Cause: a `systemctl daemon-reload` clears an inactive unit's
`ExecMainStartTimestamp` and `ActiveEnterTimestamp` while keeping `Result`. Casey
reloaded twice on 10-08 (19:50Z and 22:26Z) after raising the timeout, hours after
that day's run had finished. With no start time, `pushRunVerdict()` could not place
the run inside the cycle window and correctly refused to speak.

Fixed in the orchestrator **`394c90c`**: fall back to the timer's own
`LastTriggerUSec`, which survives the reload and sits within seconds of when the
service started. Service stamp first, timer only as a fallback, and a stale timer
stamp still yields no verdict because the window check still decides. Editing a
unit no longer blinds the report on the run that prompted the edit.
`push_unit_result` now reads `success`.

## The pause still has nothing left to fund

Enrichment: **7,585 of 7,595 bundled, 99.9%**. One batch all cycle, one lead, zero
failures. The paid Apify lane added nothing again: $9.9999 of its $100 month
remains and all of it is the untouchable reserve, so **$0 is spendable until 31
October**.

## Money

- **Anthropic: $0.00.** 26th straight cycle. Soft 75, hard 150, untouched.
- **OpenRouter: $4.24/day, $97.24 left, ~23 days of runway.** Worth one look.
  Only **$0.67** of that day was the Siege email writer and only one lead was
  enriched, so roughly $3.50/day is coming from somewhere else on the account. The
  snapshot's `openrouter_usd_per_enriched_lead` charges all account spend to
  enrichment, which while enrichment runs one lead a day makes that field
  meaningless rather than wrong.
- **Apify: $0 spendable until 31 October.** Allowance spent, reserve intact, lane
  not halted, no price strikes.

## The recovery lane, and yesterday's instrumentation paying off

The free collect pass walked 150 leads on **lap 8** of a 2,519-lead book and found
**588 contact points, 587 of them already on file**. One new address, one lead
parked (7,594 to 7,595).

Yesterday that exact shape read as an outage and had to be disproved by re-running
the lane by hand. This cycle the snapshot said it plainly: `methods_found: 588`,
`already_on_file: 587`, which is the picked-over-book signature rather than a dead
method chain. The 10-08 fixes (`fb371d267` in the email repo, `1e43b08` here) did
what they were built to do on their first live cycle.

Site resolution stayed healthy: **3 no-site in 150** (2%), **zero Brave refusals**.
`collect_book_stranded` held at **3** for a 26th day, so no selector gap reopened.

## Standing items, unchanged

- **Discovery is paused** (Casey, 2026-09-08). Nothing here touched the flag, the
  sweeps, the refill timers or `autopilot-campaign.service`. 0 new channels is the
  intended state, not a fault.
- **15 of 66 YouTube keys** came back working after the midnight reset, 50 were
  still exhausted after it. Irrelevant while discovery is off.
- **Six cycles have metrics on disk and no debrief**: 09-17, 09-18, 09-19, 08-17,
  08-18, 07-11. Backfillable at no risk.

## Ranked next

1. **Decide what refills the shelf, with the corrected clock.** Five to six weeks
   of never-emailed people left, not three. The pause was ordered so every
   resource could go into enriching what we already had; that finished at 99.9%
   and the chain ran one lead all cycle. The trade the pause was making no longer
   exists. The extra month is room to make the call deliberately. Casey's alone.
2. **The em dash is now the largest in-pipeline email loss.** Two of the five
   dropped drafts, each after three failed retries, so it costs tokens as well as
   emails. Every email skill already bans it, so the fix belongs in the writing
   prompt rather than the gate: give the model the replacement rule (commas for
   asides, periods for full thoughts) in the same breath as the ban. Those skills
   live in `~/.claude/skills`, outside the five repos this agent may edit.
3. **Watch whether 52% repeat holds.** One day is not a rate. If it holds, the
   shelf lasts about twice as long as the raw push number suggests and every lever
   that buys new leads reranks accordingly. If it falls back toward 11%, the short
   clock returns. The query is two joins against `leads.outreach_sends`.
4. **Decide the Apify allowance.** 22 more quiet days otherwise. Its best month
   recovered 244 leads for $28.08, about 11.5 cents each, still the cheapest new
   sendable lead available without lifting the pause.
5. **Backfill the six missing debriefs** when convenient.
