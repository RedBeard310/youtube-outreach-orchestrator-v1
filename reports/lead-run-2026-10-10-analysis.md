# Lead run analysis, cycle 2026-10-09

Companion to [lead-run-2026-10-10.html](lead-run-2026-10-10.html). Cycle window
2026-10-09T07:00Z to 2026-10-10T07:00Z, which is Friday 2026-10-09 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-10.json`.
Per-minute push detail and the two escalations counted from `automator/logs/siege.log`;
the plan read from `automator/state/siege/2026-10-09/plan.json`; first-ever versus
repeat offers from `leads.outreach_sends`; website resolution read from
`youtube-outreach-orchestrator-v1/logs/bloodhound-collect.log`.

## Headline

**613 of a 618-email plan loaded in 102 minutes, the biggest send on record, and
the first push SmartLead refused nobody on. All five planned emails that did not
go were drafts our own writing gate rejected, and four of the five came out of one
offer's writer.**

The second finding closes a question open since 2026-10-05. The recovery lane
resolved no website for 90% of its last pass with zero search refusals, and the
cause is neither a fault nor a dry search plan: **Brave found a real candidate for
124 of 150 leads and the ownership gate refused 109 of them.** The remaining book
is creators with no site in their own name. No money changes that.

The shelf is one day shorter and otherwise unchanged. **6,072 never-emailed people,
spent at 277 a sending day, is about five and a half weeks.** Intake was one person.

Zero fatal signatures, zero halts, zero crashes, twenty-seventh consecutive cycle of
$0 Anthropic spend.

## Finding 1: the push is settled, and the failure surface has moved entirely onto our copy

`siege-plan.service` reports `Result=success`. The push loaded its first email at
10:23:05Z and its last at 12:05:26Z, so 102 minutes 21 seconds for 613 emails, a
flat **6.0 a minute** from the first minute to the last (10 emails in the final
minute, 9 in the first). It used 28% of the six-hour budget Casey set on 10-08.
Two clean full-plan pushes in a row, so the `push_killed` shape of 10-01, 10-02
and 10-08 is closed rather than lucky.

**SmartLead refused nobody.** `failed: 0`, against 1 yesterday and 106 on 10-07.
This is the strongest evidence yet for Casey's duplicate-flag change in
`becf7fd1a`: 336 of today's 613 emails went to a person already sitting in another
campaign, which is precisely the traffic
`ignore_duplicate_leads_in_other_campaign: true` had been blocking, and every one
was accepted.

**The whole shortfall is five drafts our own gate refused**, after its retries:

| Rule the writer's gate caught | Leads | Offer |
|---|---|---|
| em dash outside the sign-off | 2 | attack-enemy-propose-5-ideas |
| the locked closing block reworded | 1 | attack-enemy-propose-5-ideas |
| opener shape | 1 | attack-enemy-propose-5-ideas |
| consultant abstraction ("Streamline") | 1 | joke-ai-slop |

Four of five from one skill. The gate itself is healthy at **205 of 211 drafts
(97.2%) for $0.69** across 88 batches, so this is the writing prompt leaking, not
the gate over-reaching. Those skills live in `~/.claude/skills`, outside the five
repos the autopilot may edit, which is why this is a recommendation and not a fix.

### Two campaigns were left holding leads they could not be started with

Both of the cycle's escalations are a plain `http 429` on the campaign `START`
call, at 10:30:57Z (4 leads) and 10:41:48Z (2 leads). Do not read this as the
10-05 rate-limit shape returning: every lead-add succeeded, and the 10-06 fix
(`eedbbff87`) that retries 429s covers the email repo's HTTP layer. This call does
not go through it. `start_campaign()` in `automator/scripts/siege-plan.py` calls
`sl.post_json` once, logs the failure and escalates.

So **6 people are loaded into a stopped campaign**, their rows already read
`sent_to_smartlead`, and nothing will pick them up. It happened once on 10-06 and
twice today, and it will recur on every push busy enough to share a minute with
the reply poller.

### The ceiling is inboxes again

`day_cap: 870`, `mailbox_slots: 618`, `live_inboxes: 50`, `planned: 618`. The plan
is exactly the mailbox number, so inboxes bind for the second cycle running and a
higher day cap buys nothing. Six offers carried the day fairly evenly: joke-ai-slop
111, voice-objection-proof 105, short-work-with-me-video 104, short-save-time 99,
owner-or-youtuber 99, attack-enemy-propose-5-ideas 95. Nine of the sixteen offers
are still blocked.

## Finding 2: the no-site collapse has a name, and it is not something money fixes

This is the cycle's real discovery. The newest completed collect pass:

```
150 leads walked, 135 resolved no website (90%)
Brave: 150 searches, 124 resolved a candidate site,
       26 answered with only social/third-party hits,
       0 hit a key refusal, 0 errored
```

150 searches for 150 leads means not one lead held a declared or stored site, so
every one of them went to Brave, and Brave answered for 124. **Only 15 became the
lead's website.** The other 109 were refused by `websiteCandidateLooksOwned`,
which will not accept a page it cannot tie to that creator.

The arithmetic closes exactly, which is how we know this is the whole story:
**135 no-site = 109 gate refusals + 26 social-only answers.** Nothing is
unexplained. The pass before it reads the same way: 149 searches, 114 candidates,
8 sites, 107 refused.

That gate is deliberate. The 2026-08-18 audit added it after the lane filed
strangers' contact details under leads whose top search hit was somebody else
writing about them. It is working. What was broken is that nobody could see it
working.

### Why this mattered: two alarms, both filed "unexplained"

The hourly check-in fired `bloodhound_site_resolution_collapsed` twice in this
cycle, at 21:11Z and 04:11Z, both with `attributed_to: "unexplained"` and both
printing "this is either a new failure mode in website resolution or a genuinely
site-less slice of the book. Check the collect log before spending anything."

The collect log had the answer on the line directly below the footer that alarm
was already reading. This is the fifth outing of one bug class in this lane
(09-12, 09-13, 09-22, 09-27, now), and the rule those wrote down is the one that
applied: an alarm that names a remedy costing money must take its evidence from
the pass being judged.

**Shipped** (`0ec3b719`, orchestrator): `collectPassAttribution()` reads the
per-pass Brave line, bounded to the lines between this pass's footer and the next
pass's first lead so a later pass can never be read as evidence about this one. It
derives `braveAccepted` as `resolvedSampled - (sampled - braveSearches)` (the
leads that never needed a search already held a site) and `braveGateRejected` as
the candidates that did not survive. A new `noSiteCause()` names one of
`search_off`, `search_dead`, `ownership_gate`, `no_candidates`, `resolution_ok` or
`unmeasured`, and both the check-in and the daily snapshot call it, so the alarm
and the report cannot give different answers about the same pass.

Verified against all six live passes in the log. The derivation agrees with a hand
count on every one, including the small ones where most leads had stored sites
(4 searches, 1 candidate, 1 accepted, 0 refused). Passes logged before the Brave
line existed return null, not zero.

### What the lane is actually doing

32 free contact points across 11 leads, 2 addresses on 2 people, **1 parked**.
Methods found 129 points and 126 were already on file, which is the picked-over
re-walk shape the 10-08 instrumentation was built to make readable, and it read
correctly without anyone re-running the lane. Lap 8 of a 2,517-lead book at 100%
re-walk. `stranded` held at 3 for the 27th day, so no selector gap has reopened.
`needs_contact` is down to 3,513 from 4,239 on 09-29.

## Finding 3: all five dropped emails reported one string that names nothing

Yesterday's fix counted skips for the first time. It bought the arithmetic and not
the diagnosis: the push prints `SKIP <lead> batch report marked it failed`, and
that was the only reason in the snapshot for all five. It names no rule, no offer
and no remedy.

The real reason is printed by the batch writer a few lines above, as
`still broken: <rule>` under its own `FAIL` line. **Shipped** (same commit):
`siegePushOutcome()` keeps those verdicts per batch id and spends them in order on
that batch's skips, and adds `skipped_by_offer`.

Keyed per batch id rather than as a rolling buffer for a measured reason: a
batch's `SENT` lines interleave with its skips, so a buffer cleared on each send
loses three of the five reasons. Seven new selftest cases cover the interleave,
a second skip in one batch, a skip with no writer verdict in the log (which keeps
the push's own string), and a batch id of an unreadable shape (which names no
offer rather than guessing one). All pass, `tsc` clean, and the regenerated
snapshot now reads the five rules and the two offers above.

## The pause still has nothing left to fund

Casey paused all new-channel discovery on 2026-09-08 so every resource could go
into enriching the leads already in hand. That work is **99.9% bundled** and the
enrichment chain ran **1 batch of 1 lead** all cycle. The free recovery book is
picked over for a now-measured reason. Apify is dry until 1 November.

The flag is untouched, no lane was restarted, and nothing here is reported as an
anomaly. But the arithmetic is worth stating plainly: the pause is no longer
buying enrichment, and it is the twelfth consecutive debrief to say so.

## The shelf, stated the way it should be read

`approved_hold` is 7,596, of which **1,514 have already been emailed**, so the
inventory is **6,072**. Counted from `leads.outreach_sends`, today's 613 emails
were:

| | Leads |
|---|---|
| first-ever email to this person | 277 |
| second offer | 308 |
| third offer | 27 |
| fourth offer | 1 |

**6,072 / 277 = 21.9 sending days**, and SmartLead delivers Monday to Thursday, so
about **5.5 weeks**. Repeat share is 55%, holding where it landed after the
duplicate flag went false (52% on 10-09, 11% on 10-07).

Against that, intake for the cycle was 1 person. The shelf has lost 1,041
never-emailed people in the eight days since 10-02 (7,113 to 6,072).

## Money

| Line | Reading |
|---|---|
| Anthropic | **$0.00**, 27th straight cycle |
| OpenRouter | **$3.68/day**, $93.70 left, about 25 days. Rate was $2.39 on 10-06 and has climbed with plan size |
| of which the writer | **$0.69** for 88 batches of drafts |
| Apify | 0 batches. $10 left of the $100 month, all of it reserve, so **$0 spendable until 31 October**. 0 price strikes |
| Brave | 300 searches across two passes, 0 refusals. Roughly $1.50 at $5 per 1,000 |

The OpenRouter runway is the one to watch. It is not enrichment any more, which is
finished; it is the send path writing 600-email plans.

## Standing items, unchanged

- **YouTube keys: 15 of 66 working**, 50 still exhausted after the midnight reset,
  1 blocked. Settled on 2026-09-16: the quota on 50 projects was cut, so quote
  ~15 usable and do not propose buying more keys for those accounts. Irrelevant
  while discovery is off.
- **Nine of sixteen Siege offers blocked**, ninth debrief.
- **Six cycles have metrics on disk and no debrief**: 09-17, 09-18, 09-19, 08-17,
  08-18, 07-11.

## Ranked next

1. **Decide what refills the shelf.** 6,072 people, 277 a sending day, five and a
   half weeks. Enrichment is done, the recovery book is measurably picked over,
   Apify is dry until November. Casey's call; the flag stays untouched.
2. **Fix the em dash in the writing prompt** for
   `cold-email-attack-enemy-propose-5-ideas-v1`. Four of five dropped emails, two
   of them an explicitly banned character. Outside this agent's reach.
3. **Give the campaign `START` call a 429 retry** in
   `automator/scripts/siege-plan.py`. Six people are in two stopped campaigns with
   their rows marked sent.
4. **More inboxes, not a higher day cap.** 618 planned against 618 mailbox slots
   under a cap of 870.
5. **Watch the OpenRouter runway**, 25 days at a rate that has risen 55% in four
   days.
6. **Backfill the six missing debriefs.** No risk, metrics are on disk.

*Snapshot written 07:20:01Z on schedule. Regenerated at 07:30Z to verify the two
new instrument fields against live data; every headline figure was identical and
the numbers here are from the scheduled run. Four readings were measured directly
and are named where they appear: the first-ever/repeat split (SQL over
`leads.outreach_sends`), the per-minute push series and the two escalations
(`automator/logs/siege.log`), the Brave resolution line and the per-lead `site=`
counts (`logs/bloodhound-collect.log`), and the two alarm records
(`logs/autopilot-observations.jsonl`).*
