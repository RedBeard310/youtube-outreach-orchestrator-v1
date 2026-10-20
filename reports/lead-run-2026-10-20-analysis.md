# Lead Run Analysis — 2026-10-20

Cycle window: 2026-10-19T07:00Z to 2026-10-20T07:00Z (the midnight-PT boundary).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-20.json`.
Companion: [lead-run-2026-10-20.html](lead-run-2026-10-20.html).

## Headline

**175 emails went out, nothing failed at SmartLead, and not one of them reached somebody
new.** Monday's push planned 176, pushed 173, lost 0 to SmartLead. All **169 people** it
reached had heard from us before: **first touches 0, against 882 of 1,153 people (76.5%)
over the prior seven days**. The already-written-to count on the shelf printed **1,663 for
the fifth morning running**, which is only possible on a day of pure repeat offers.
**1,427 people were ready and waiting for a slot** (whale 443, strong7 171, other7 813) and
the whale re-offer queue took all 176. Separately the recovery lane spent the cycle
reporting `cause: search_dead` and asking for Brave credit, while its own footer one line
down said **43 searches, 2 refused, 34 real candidate sites found, and the ownership gate
threw out 33 of the 34**. Both reporting faults are fixed this cycle.

## The numbers

| | |
|---|---|
| Emails loaded | **175** (`sent_by_this_repo` 2, `sent_elsewhere` 173). Siege planned 176, pushed 173, **0 failed**, 15 per-lead skips, `binding_constraint: partial_push` |
| First touches | **0 of 169 people.** Prior 7 days: 882 of 1,153, **76.5%**. `shelf_first_touch` 0 |
| Waiting for a slot | **1,427** (whale 443, strong7 171, other7 813) against 176 slots |
| Push span | 10:20:31Z to 11:04:28Z, about 44 minutes. One escalation at 10:51Z: campaign 4010806 would not start, HTTP 429, **2 leads stranded in it** |
| Push skips | 15. **12 "not in the Siege manifest", of which 10 were sent anyway in their own batch** (2 people lost); 4 were the writer's own quality gate (rank superlative, 199 words, 95 words above block, "Streamline") |
| Skips by offer | 5-ideas 5, joke-ai-slop 3, owner-or-youtuber 3, work-with-me 2, save-time 1, voice-objection 1 |
| Fleet at plan time | **33 live inboxes**, 495 msg/day capacity, **509 follow-ups already due**, 176 free slots, `day_cap` 870, `inboxes_full` 0 |
| Band gate at 07:05Z | **31 normal / 3 watch / 24 stop** of 58; was **34 / 0 / 24** at the same hour a day earlier, `band_delta_comparable: true`, 24.0h apart |
| Moves inside the cycle | **0 to normal, 2 to watch, 0 to stop.** Old health gate ran 09:46Z and paused nobody (the band gate owns 24) |
| People parked | **2**; `approved_hold` 6,815 to 6,817; `needs_contact` held at 3,437 |
| Shelf, never emailed | **5,144** (up 2). `already_sent` **1,663, unmoved for the fifth morning**; 6,807 of 6,817 bundled, **99.9%** |
| Recovery lane | newest pass **43 leads, 42 no site (97.7%)**, **36 points found and all 36 already on file**, lap **11** of a 2,411 book, `stranded` 3 |
| Brave this pass | 43 searches, **2 refused**, 34 candidates, **1 accepted, 33 refused by the ownership gate**, 7 social-only. Cause was `search_dead`, is now `ownership_gate` |
| Free collection | **6 points, 2 addresses, 2 people**, against 290 points / 124 addresses over the prior 7 days. Producers: 34-channel-page, 01-mailto, 02-subpages, 16-jsonld |
| Method errors | 16, **all one cause** (`34-channel-page: page rendered with no outbound links`), which is a content outcome. `top_method_fault_cause` null, so no real fault in the pass |
| Enrichment | 2 batches, **2 leads done, 0 failed, 0 in flight.** Nothing left to take at 99.9% |
| Apify | 0 batches. **$9.9998 left against a $10 reserve**, `spendable: -$0.0002`, dry to 31 Oct, 0 price strikes |
| Spend | **$0.00 Anthropic (37th straight cycle).** OpenRouter $2.14 account-wide, $76.47 left, 35.7 days of runway; finder log $0.1356 across 318 `qwen3.7-flash` calls |
| YouTube keys | 15 working of 66 probed, 50 quota-exhausted after the reset, 1 blocked. Settled 09-16, not an incident |
| Clean-run | **0 fatal signatures, 0 halts, 0 crashes** |
| Discovery | **0 new channels, by the 2026-09-08 order.** Flag untouched, 0 campaign sessions |

## What the day actually was

**One event, 44 minutes long.** Siege wrote its plan at 10:20:27Z and pushed straight into
it, finishing at 11:04:28Z. Everything else was small: the recovery lane crossed into lap
11, enrichment took the two leads it had left, and the band gate moved two mailboxes out of
the clear half through the day. This repo's own session-start `npm run send` fired at 07:20Z
and found 0 parked leads, which is correct, because the shelf is fired by Siege and not from
here.

### The push was close to clean, and the day still reached nobody

176 planned, 173 pushed, 0 refused by SmartLead. The 3 that never got there are accounted
for: 2 of them are the manifest crossover below and one sits elsewhere in the plan.

The part that matters is who they went to. **169 people, 0 of them new.** The shelf tells
the same story from the inventory side: of the 6,817 people in `approved_hold`, **5,144 have
never been written to and 1,663 have**, and that second figure has printed 1,663 every
morning since 10-16 across several hundred emails. Sending does not move a lead out of
`approved_hold`, so a repeat offer leaves both halves of that split exactly where they were.

**The mechanism is a queue and not a fault.** `siege.fill_slots` orders slots by tier, then
score, then subscriber count, and nothing in that sort key asks whether a person has heard
from us. The whale tier's never-emailed supply ran out on the 776-person push of 10-13, so
its re-offer queue has had first call on every slot since. Yesterday **443 whale-tier people
were waiting**, 176 slots existed, and the 984 people in the two lower tiers got none.

Repeat offers have been deliberate since Casey's 10-07 call. The open question is not
whether to send them, it is that five thousand people we already own are not being worked at
all, and no number in the daily push distinguishes those two days. The `first_touch` block
added on 10-17 is what makes this readable; without it, yesterday and 10-13 (767 first
touches of 776) print the same `total`.

### The recovery lane asked for money for a problem money cannot fix

The snapshot said `cause: search_dead`, which the hourly alarm renders as "raise the cap or
add `BRAVE_SEARCH_API_KEY[_N]` keys", and `leads_after_refusal: 43` of 43, meaning the whole
pass supposedly ran with no web search at all. The pass's own footer, on the next line of the
same log file:

```
[bloodhound] Brave website resolution: 43 searches, 34 resolved a candidate site,
7 answered with only social/third-party hits, 2 hit a key refusal, 0 errored.
```

So Brave answered **41 of 43** lookups and found a real website for **34**. Then the strict
ownership gate refused **33 of those 34**, because the page could not be tied to that
creator by name, and exactly one became a site. That gate is deliberate (the 2026-08-18
audit) and exists so a stranger's email is never filed under one of our leads. Brave credit
buys more searches; searches were never what was short.

**Why it misreported.** The lane watches for a log line that fires when every key refuses one
lookup, and `noSiteCause()` treated that line appearing at all as `search_dead`. The line is
latched once per process, so it prints at most once per pass however the rest of the pass
goes, and a single transient refusal against a funded plan sets it. Yesterday it printed
before the pass read its first lead, so every downstream reading inherited the worst possible
interpretation of two refused searches. The footer carrying the real counts had been parsed
and discarded since 10-05.

This is the same bug class as 09-12, 09-13, 09-22, 09-27, 09-28 and 10-10: a claim about
cause with no measurement behind it. Six outings, and the measurement was in the file each
time.

### Twelve manifest skips cost two people, not twelve

The push refuses to send to any address the batch manifest does not carry for that lead.
Yesterday it refused 12. Joining the SKIP ids against the SENT ids of the same run:
**10 of the 12 were written again in their own batch and sent**, so they cost writer time and
nothing else. Only `recNhh1UrOv8rRuPA` and `reckFPU6owC7hUeDB` never went out.

The cause is a batch crossover: ten drafts were written into a batch directory whose manifest
covers a different set of people. Spot-checked two of them, both present in a sibling batch's
`manifest.json` with a valid address. The assignment lives in `automator`, in how Siege files
a written draft into a batch, which I do not modify. **The gate caught every one**, which is
what it is for; it is the last door before SmartLead.

The other four skips were our own writer refusing its own drafts, each with a named rule.
That is the quality gate working and it points at the skill, not the push.

### The fleet gave back three

**31 normal / 3 watch / 24 stop** of 58, against 34 / 0 / 24 at the same hour yesterday. Two
of the three moved to watch inside the cycle and none went to stop, so the stopped half held
flat. Both readings come from the band gate's own retained run history 24.0 hours apart, so
this is one instrument against itself rather than the 10-16 mistake of subtracting two.

The old health gate ran at 09:46Z and paused nobody, which is now the expected shape: since
2026-10-15T22:57Z the band gate in `automator` owns health pauses and has adopted 24 of them.
The made-up-name domain finding from 10-17 and 10-18 is unchanged and still open.

### Three lanes could refill the shelf, and all three are quiet

| Lane | Yesterday | Why |
|---|---|---|
| Recovery lane, free | **2 people** | Lap 11 of a 2,411-lead book; 36 of 36 points already on file; ownership gate refused 33 of 34 sites |
| Apify endspec, paid | **0** | $89.93 of October's $100 spent (472 people, about 19c each), at its $10 reserve until 31 Oct |
| Discovery sweeps | **0** | Paused by Casey on 2026-09-08. Intended state |
| Weekly floor sweep | 149 last Monday | Not what the pause stops: it re-reads channels we already hold. Next fires 10-26 |

**The pause's stated job is finished.** It was set on 09-08 to put every resource into
enriching the leads we already had. Enrichment reads **6,807 of 6,817 bundled, 99.9%**, and
yesterday it had two leads to take and took them. Whether to lift it is Casey's call and
nothing here touches the flag.

## What shipped

**1. A Brave refusal is no longer read as a spent plan** (orchestrator, `4f167e6`).

- `searchDied()` is the new test: `search_dead` requires refusals to hold at least half of a
  pass's searches, instead of the latched warning line being nonzero. Falls back to the
  latched line when the footer is missing (every pass before 10-05), so an unknowable pass
  still over-reports rather than under-reports a real outage, which is the direction the
  09-27 fix was written to protect.
- `braveRefusedSearches` / `braveErroredSearches` are parsed off the footer's groups 4 and 5,
  which the regex had been capturing and throwing away since 10-05, and carried into the
  snapshot as `brave_refused_searches` / `brave_errored_searches`. Null, not zero, for an
  older pass.
- `checkin.ts`: the yield-degraded alarm now branches on `searchDied()` rather than the
  latched line, which also made the `ownership_gate` branch reachable at all (it sat behind
  the refusal branch, so one bounced lookup made it dead code). `braveCost()` leads with the
  measured refusal count and states the lead figure as the upper bound it is. The two texts
  that hard-coded "with 0 key refusals" now print the real count.
- Verified live: the 10-20 pass reclassifies from `search_dead` to `ownership_gate`. 7
  regression cases added (the exact 10-20 pass, a plan that genuinely caps mid-pass, a
  footer-less pass, a pass with no refusal, `search_off` precedence, `resolution_ok`), 90
  tests green, `tsc --noEmit` clean, `debrief-data.selftest.ts` ALL PASS.

**2. A Siege push skip names which manifest miss it is** (email repo, `03429e8c0`).

- The skip line distinguishes "absent from this batch's manifest" from "in the manifest with
  no address", and stays short and fixed so the debrief's reason histogram cannot fragment
  per batch (`normalizePushReason` caps at 120 characters and a batch-specific count would
  have split one reason into one row per batch, the 10-12 per-lead-token lesson one repo
  over).
- The batch detail prints on its own line beneath: this manifest's offer, its lead count, its
  inbox, and the draft file to check. The parser requires `SKIP rec…` on a line, so the extra
  line cannot be miscounted.
- Typecheck clean; both message shapes rendered and checked.

**Nothing else shipped.** No fatal signatures, no halts, no crashes, no quota waste to fix
(discovery is paused and the key pool question was settled on 09-16), and no fade thrash or
term starvation because the campaign ran 0 sessions by design.

## Levers, ranked

1. **Give Siege's slot order a first-touch term.** Five mornings at 0 first touches, 5,144
   people never written to, 1,427 ready while 443 whale re-offers take every slot. Free, and
   the one lever that converts inventory already owned. Lives in `siege.fill_slots` in
   `automator`. A per-day floor on first touches would do it.
2. **Decide about the shelf-refill lanes, because the pause's stated job is done.**
   Enrichment 99.9%, the free lane on lap 11 and held by a gate rather than by money, Apify
   at about 19c a person and reopening 31 October.
3. **Look at the ownership gate's strictness.** 33 of 34 candidates refused this pass, 71 of
   80 the pass before. It is the real ceiling on the free recovery lane, free to review, and
   loosening it has a genuine cost (a stranger's address filed under a lead), so it is a
   deliberate judgment call rather than a tuning job.
4. **Restart the two stalled campaigns.** 4010806 holds 2 leads after the 10:51Z 429;
   4010851 has held 4 since 10-17. Both count as sent and nothing will pick them up.
5. **Fix the batch crossover in Siege.** 12 drafts into wrong batch directories, 2 people
   lost, 10 drafts wasted. The log now says what to look for; the assignment is in
   `automator`.
6. **Watch the clear band.** 31 of 58, down 3, stopped half flat at 24. The made-up-name
   domain decision is still the ceiling on fleet size.

## Footnotes on reading this cycle

- `sent_today.total` is emails **loaded into a SmartLead campaign**, counted from
  `leads.outreach_processed_at`. SmartLead delivers on its own schedule (Mon-Thu 09:00-15:00
  ET). For delivered volume run `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`.
- `sent_by_this_repo` is 2 and `sent_elsewhere` is 173, which is the normal shape: Siege in
  `automator` sends almost everything and has had standing approval since 09-30.
- `bulk_status_writes` and `bulk_rewrite` are both empty, so the `moved` verdict shipped
  yesterday had nothing to rule on. That is the correct answer and not a missing reading. Its
  first real test is Monday 10-26, when the floor sweep next fires.
- The snapshot was read 20 minutes after the boundary (`measured_minutes_after_cycle_end:
  20`, `counts_post_cycle_arrivals: false`), so the two parks are inside the window.
- Six older cycles still have metrics and no debrief: 2026-09-17, 09-18, 09-19, 08-17, 08-18
  and 07-11.
