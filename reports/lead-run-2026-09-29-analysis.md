# Lead run analysis, cycle 2026-09-28

Companion to [lead-run-2026-09-29.html](lead-run-2026-09-29.html). Cycle window
2026-09-28T07:00Z to 2026-09-29T07:00Z, which is Monday 2026-09-28 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-29.json`.

## Headline

**The recovery lane spent the whole cycle inside the 574 leads that cannot be
placed without a paid web search, and both Brave keys are still refusing at
their monthly cap.** All four collect passes came back between 92% and 96% of
leads with no website found: 562 of 600 lead slots. Yield was 11 contact points
from 5 leads, one of them an email address, and it did not verify, so the parked
pool was flat at 6,865.

The sender had an ordinary Monday: 34 emails loaded into SmartLead. No faults, no
halts, `$0.00` Anthropic for the sixteenth day.

## The book, counted live

Same query as yesterday, the lane's own `COLLECT_IDS_SQL` predicate from
`src/recovery/bloodhound-lane.ts`, run against Postgres:

| Tier | Leads | Yesterday |
|---|---|---|
| -2 (priority list) | 139 | 139 |
| -1 (priority list) | 40 | 40 |
| 0 (linked or stored website, free) | 2,567 | 2,562 |
| 1 (needs a paid search) | 574 | 576 |
| **Total** | **3,320** | **3,317** |

The total matches `collect_book_pool` in the metrics file exactly, so this is a
decomposition of the book rather than an estimate of it.

Cursor position, from `logs/bloodhound-lane-state.json`
(`tier 1, disc 2026-08-19T23:14:27Z, id recKHC126epdiviZS`): **380 leads into
tier 1, with 194 of them still ahead of it in this lap.** The lane will be inside
unreadable leads for several more days at its current rate.

Tier 1 fell by 2 and tier 0 rose by 5, so the lane did find two websites the slow
way (channel page or stored site) and five leads arrived in the free half.

## The four passes

| Pass (UTC) | No website | Leads with a contact | Contact points | Cursor action |
|---|---|---|---|---|
| 10:00 | 142/150 (95%) | 3 / 150 | 7 | rewound, `previous_pass_search_dead` (1) |
| 17:00 | 144/150 (96%) | 0 / 150 | 0 | rewound again (2) |
| 00:00 | 138/150 (92%) | 2 / 150 | 4 | advanced, waiver `rewalk_produced_nothing` |
| 06:01 | 138/150 (92%) | 0 / 150 | 0 | rewound (1) |

Sums check against the metrics file: 7+0+4+0 = **11 contact points**, 3+0+2+0 =
**5 leads with new points**, both exact.

Every pass after the first printed the all-keys-refused line:

```
[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded
```

So 600 lead slots bought two fresh batches. That is the rewind behaviour working
as designed, not a loop:

- A search-dead pass rewinds so a lead is only marked walked once somebody
  actually searched for it, and the re-walk doubles as the probe that notices
  Brave coming back (`MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS`, 09-10).
- After one re-walk that collects nothing, `rewindWaiver` accepts the evidence
  and advances, so the lane cannot pin itself on one batch for twelve days
  (09-12).

Both of those are fixes from this same debrief series, and both fired today in
the same cycle. Nothing here needs changing.

## Where today sits in the trend

Contact points by Pacific day, counted off `leads.contact_points.created_at`:

| 09-18 | 09-19 | 09-20 | 09-21 | 09-22 | 09-23 | 09-24 | 09-25 | 09-26 | 09-27 | 09-28 |
|---|---|---|---|---|---|---|---|---|---|---|
| 924 | 1,501 | 1,063 | 47 | 29 | 73 | 35 | 26 | 27 | 40 | **11** |

Today is the low point of a nine-day slide, not a cliff. The 277 figure in the
metrics file is the 09-21 to 09-27 sum, and the 1,300 quoted in yesterday's
debrief was the same rolling window while it still held 09-20. The step down on
09-21 is the lane finishing the productive part of the book, and the last four
days are the expensive end plus a dead search plan.

## What this is not

- **Not the mined-out book.** That story (lap 6, re-reading leads already
  emptied) explains the 3%-no-site passes from 09-27, where the lane could see
  fine and still found nothing. Today's passes could not see.
- **Not a selector gap.** `collect_book_stranded` is 3, unchanged for 16 days.
- **Not a verify problem.** Verify ran four times, was handed nothing three
  times, tested the one address collect found at 13:02Z, and it failed. Verify
  can only rule on what collect finds.
- **Not discovery.** Zero new channels is the standing order since 2026-09-08.
  The flag file is untouched and every sweep and the campaign loop stayed off.

## The send path: bound by mailboxes, not leads

34 leads were loaded (`leads.outreach_processed_at`), 9 from the `approved` lane
and 25 from `approved_hold`. Split by driver:

- **32 from Siege**, across six offers: attack-enemy-propose-5-ideas 9,
  owner-or-youtuber 8, short-save-time 6, short-work-with-me-video 5,
  joke-ai-slop 3, voice-objection-proof 2.
- **2 from the session-start send** in this repo at 07:20Z (00:20 Pacific),
  attempted 2, sent 2.

The constraint is worth writing down because it is not lead supply:

```
today's ceiling: 100 new emails (sending day 4); mailbox ladder gives 33 slots
emailable_today   Whale=1201  Strong 7=1100  Other 7+=834   (3,135)
waiting_for_a_slot Whale=982  Strong 7=1100  Other 7+=834   (2,916)
```

The ramp allowed 100, the warm mailboxes allowed 33, and 32 went out. Ten of
Siege's sixteen offers still cannot run, each for a short named reason it prints
every day (missing subject line in Notion, no batch writer, paused status, one
hard gate on an unrecorded video). Offer variety widens who can be emailed
without repeating anyone; slots are what convert a ready lead into a sent email.

## Fix shipped: a character count is no longer a blocked send

**What happened.** At 07:20Z, twenty minutes after this cycle closed, the send
composed five emails, pushed four, and refused the fifth:

```
refusing to send: email for lewis@pacificcascadelegal.com still contains
5 unresolved placeholder(s): [56] [61] [66] [69] [68].
```

All five numbers sat on the ends of the five proposed video titles:

```
3. Divorce Before Selling Your Home? This Legal Order Could Prevent Disaster [66]
```

They are the model's own character counts. `loadTitleSkillBlock()` injects a
55-to-65-character target into both compose variants, so the model counted its
work and showed the count. The placeholder guard treats every square bracket as
an unfinished template, which is correct and is why it caught the real
`Hi {{first_name}}` incident on 2026-09-02.

**Why it needed a fix.** Refusing cost a finished lead. Pacific Cascade Legal is
researched, holds a verified address and a written email, and landed on `failed`.
It is re-fireable (the 09-24 fix put `failed` back in the send queue when the
lead's own fields show the work is paid for), but the next compose is free to
print the count again. The prompt already forbids printing it and names two
shapes it must not use, a dash then the number, and `'(54 chars)'`. The model
invented a third.
An instruction is not a guard.

**What shipped** (`f6f9a3f`, youtube-email-outreach-v1):

- `stripTitleCharCounts()` in `src/smartlead/placeholders.ts` removes a bracketed
  1-to-3-digit integer sitting alone at the end of a line, and nothing else.
- Wired into `resolveMergeTags()`, which is the Siege push path, so
  `push-batch.ts` stops blocking on it.
- Wired into `buildAddLeadRequest()` in `src/smartlead/client.ts`, the one
  function every send path builds its request in (`cli/outreach.ts`,
  `push-batch.ts`, `probe-smartlead.ts`), so the live send is covered too. It
  logs one line naming the lead when it strips anything.
- The example list in the title prompt now names the bracket shape as well.

A bracket holding any other text, or one mid-sentence, still stops the send.

**Verified.** `tsc --noEmit` clean. Full suite: **271 tests pass**, 5 new,
including a replay of the real refused body off disk, a proof that the refusal it
produced is cleared, a narrowness check (`[56 chars]`, `[1234]`,
`[company name]` all still refuse), and a proof that a clean body comes back
byte-identical.

## Money

| Item | Value | Note |
|---|---|---|
| Anthropic | `$0.00` | 16th consecutive zero |
| OpenRouter, account | `$1.97/day`, `$189.42` left | ~96 days of runway |
| OpenRouter, finder log | `$0.1816`, 413 calls | qwen3.7-flash scoring only |
| Brave Search | both keys 402 | monthly spending cap, not a fault |
| Apify | rolls 30 September | last run 62 leads at `$0.099` each |
| YouTube keys | 15 of 66 working | settled, quota cut on 50 projects |

Pricing the Brave decision again, because it is the only actionable number:
574 tier-1 leads, roughly one search each, `$5` per 1,000 searches, so **under
`$3`** to attempt the whole tier once.

## Ranked next

1. **Raise the Brave cap or add a key** (~`$3`). The lane is walking 574 leads it
   cannot read, right now.
2. **Decide the discovery pause.** Recovery is the only source of new parked
   leads, it is on lap 6, and it has reached the expensive end of its book.
3. **Grow the warm mailbox count.** 33 slots against a 100 ceiling and 2,916
   ready leads waiting is the real cap on send volume.
4. **Watch Apify on 30 September.** The one recovery route the Brave cap does not
   touch.
5. **Find what fires `npm run send` on session start.** Two real cycles in a row
   now, and today one of its five emails was the refused one.

## Still owed

Six debriefs have grounded metrics and no report: 09-19, 09-18, 09-17, 08-18,
08-17, 07-11. Not a fault, a decision about whether the history is worth the
tokens.
