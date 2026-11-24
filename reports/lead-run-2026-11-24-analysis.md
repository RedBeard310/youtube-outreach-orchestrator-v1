# Lead run analysis, 2026-11-23

Cycle: 2026-11-23T08:00Z to 2026-11-24T08:00Z (the Pacific day of Monday 2026-11-23).
Companion to [lead-run-2026-11-24.html](lead-run-2026-11-24.html). Every figure comes
from `logs/autopilot-debrief-2026-11-24.json` in the orchestrator repo unless it says
otherwise.

## The one-line version

A real sending Monday. Sixty-five emails went out and reached nobody who had never heard
from us, the fourth consecutive day at zero. Twenty-three of the eighty-five approved
people got no email, and the largest single cause, ten of them, was published as "every
offer that can run has already been made to them". The offer library is not out of offers.
All ten have one offer left in their rotation, that offer opens by siding with the creator
against something they argue with, and their research bundle holds no such line. Nine of
the eleven people this has named since 11-11 have an enemies bank with nothing in it.

## Headline numbers

| Thing | Reading |
|---|---|
| Emails loaded | 65 (62 by the send program, 3 by this repo) |
| People reached for the first time ever | 0 of 60 people emailed |
| People lost | 23 of 85 asked for (7 refused, 13 before the push, 3 unexplained) |
| Of those, lost before | 21; longest streak 10 snapshot days; 2 genuinely new |
| Largest loss cause | 10 people, one offer, an empty enemies bank |
| Deferred by the approval gate | 4 (held for the next day, not a loss) |
| Slots | 89 across 17 live mailboxes of 124; warmup allowance 870 |
| People ready and waiting for a slot | 1,346 (whale 219, strong7 714, other7 413) |
| Parked onto the shelf | 1 (pool 7,391 to 7,392) |
| Shelf ready to write | 4,854 (7,380 bundled, 99.8%; 2,525 really emailed) |
| Fleet bands | 16 clear, 4 watch, 8 stopped; roster 28 on both readings |
| Warmup record missing | 96 mailboxes name it, 23 carry nothing else |
| Gate-owned suspensions it cannot reach | 67 of 74 |
| Recovery lane, its own half | 5 contact points, 0 email addresses, 2 people |
| Same, prior 7 days | 77 points, 13 email addresses |
| Collect passes | 3, covering 450 lead-slots, lap 20 of a 1,770-lead book |
| Site resolution, newest pass | 4 no-site of 150; cause `resolution_ok` |
| Method errors | 523 across the cycle; 1,621 of 1,627 findings already on file |
| Replies read | 7 people, 0 a yes, 0 classifier failures |
| Apify email recovery | 287.6h with no work, 401 bad token since 2026-11-12 |
| Fatal errors | 0, no halt |
| Spend | $0 Anthropic; OpenRouter balance $297.98 at 13 cents a day |

## What the day was

A sending Monday that ran. `siege-plan.service` wrote a plan at 2026-11-23T11:27Z, the
push unit reported success, and 65 emails were loaded into SmartLead. The mechanics were
clean: zero fatal signatures, no halt flag, $0 of Anthropic spend, fifteen reply-reader
runs with no classifier failures, and the enrichment chain correctly reporting
`idling_no_inflow` against a pool that is 99.8% bundled. Discovery produced no new
channels, which is Casey's standing order from 2026-09-08 and not a fault.

People reached for the first time ever, by Pacific day, oldest first:

```
11-16  1
11-17  3
11-18  4
11-19  0
11-20  1
11-21  0
11-22  0
11-23  0   <- this cycle, a Monday that sent 65 emails
```

11-21 and 11-22 are a weekend and zero by design. The six sending days in that window
produced nine new people between them, and the last of them produced none.

## The ten people, and what really lost them

### What the report said, and why it is the wrong repair

`push_outcome.reasons` ranks loss causes by the people each one really cost, and this
cycle's top row was:

```
every offer that can run has already been made to them      10 leads, 10 lost
```

That row shipped on 2026-11-21 and has led the table on all three sending days since. It
reads as an offer library with nothing left to say, which points a reader at writing new
offers. It is not a cause. It is the send program's summary **after** the last offer in a
person's rotation has already declined to write, and the writer says why two lines earlier
in the same log, in a different column format that nothing in the snapshot could read:

```
| Doctor Carl Truesdale    skipped    no safe enemy in the bank (0 found, all ruled out)
rectI4slX3LejGPG7: love-your-channel-short wrote nothing and there is no other offer
  for them today (every offer that can run has already been made to them)
```

Both lines are the same person at the same moment. Every one of the ten was turned down by
`love-your-channel-short` for that same stated reason, and so was every one of the eleven
people the terminal wording has named since 2026-11-11. The cohort is not growing; it is
the same eleven, planned and dropped each sending morning. Per-day distinct counts from
`automator/logs/siege.log`: 1 on 11-11, 1 on 11-12, 1 on 11-16, 3 on 11-17, 9 on 11-18,
10 on 11-20, 10 on 11-23.

### Why that offer cannot write for them

`cold-email-love-your-channel-short-v1` opens with one line siding with the creator against
something they push back on. It builds that line from the **enemies bank** in the creator's
enrichment bundle (`researched/enemies-bank.md`), a short file listing the people, ideas and
practices the creator argues against, each with a verbatim quote. The skill reads the bank,
drops any entry matching its own safety filter (politics, religion, violence, race and
similar), and skips the lead outright when nothing is left. Read off
`scripts/run-batch.mjs` in that skill.

All eleven bundles were opened by hand:

| What their enemies bank holds | People | What would change it |
|---|---|---|
| No enemies, on full transcript coverage | 7 | Another mining pass, or a weaker enemy bar |
| No enemies, and no transcripts mined at all (`0 of 0`) | 2 | Transcripts first |
| Enemies on file, every one ruled out by the safety filter | 2 | Nothing. The filter is correct |

The two with no transcripts never had anything to mine. The seven with full coverage are
the group worth a decision: the mining ran over every transcript they have and returned
"No enemies yet, no enemies were mined". One is a facial plastic surgeon with 7 of 7
transcripts mined and 863 videos on the channel, which may simply be a creator who picks no
fights. The file's own closing line promises it "regenerates on Auto Update as transcript
coverage grows", which cannot happen for a lead already at full coverage.

For scale, 668 of the 11,809 bundles on disk (5.7%) have an enemies bank with no entries, so
this is not confined to eleven people; it is the share of the shelf that no enemy-based offer
can ever write for. Counted directly off `youtube-email-outreach-v1/enrichment-bundles`.

**The decision is Casey's**, and it is a judgment call rather than a bug: another research
pass for the seven, transcripts for the two, and the rotation stops planning anybody it
cannot write to. Loosening the enemy bar or the safety filter is not recommended here.

## Why 65 emails reached nobody new

Repeat offers are the standing decision since 2026-10-07, so a repeat-heavy day is not a
fault. The pairing is what makes it readable: 60 people emailed, 60 of them repeats, and
`shelf.ready_to_write` holding **4,854 finished emails for people nobody has ever written
to**. None of those went.

Two constraints, both in the send program:

- **The tier order.** Siege fills slots by tier and the whale tier ran out of never-emailed
  people on the 10-13 push, so its re-offer queue takes the room. 1,346 people were ready
  and waiting for a slot: 219 whale, 714 strong7, 413 other7.
- **The slot count.** 89 slots across 17 live mailboxes out of 124, against a warmup
  allowance of 870. The ramp is not the ceiling and neither is the shelf. The mailbox count
  is.

## The fleet: yesterday's fix held, and the cost is now readable

The warmup list is still returning **28 subscriptions**, the same 28 it fell to at
2026-11-22T14:05Z. `band_roster` is 28 on both this morning's reading and yesterday's, so
`band_roster_comparable` is true and the day-over-day move is real rather than two different
rosters subtracted: **clear 19 to 16, stopped 6 to 8**. The move counts agree with it
(0 back to normal, 1 to watch, 2 to stop, `band_left_normal` 3, no short readings). Three
held mailboxes are already healthy and all three are simply waiting out the recovery clock,
the nearest with 24 hours left.

The cost lands in Monday's plan, and the 11-05 rule decides how to read it. "Not in the
InboxKit warmup list, so its age is unknown" is named by **96 mailboxes** and carried alone
by **23**. Those 23 are the slots the gap really costs. That is a different answer from
11-04, when the same row was a passenger with every mailbox on it blocked by something else
and the debrief's top recommendation freed nobody. It is not a passenger now.

Unchanged from yesterday: 67 of the 74 mailboxes the gate suspended in its own name are
outside the roster it reads, and the resume path walks that roster, so no run of it will
release them. That repair is in the send program.

Day-over-day plan figures are unavailable: yesterday was a Sunday with no plan on disk, so
`fleet.delta_comparable` is null and 17 live mailboxes is stated on its own.

## Everything else

- **Recovery lane.** Its own half produced 5 contact points, no email addresses and 2
  people, against 77 points and 13 addresses over the prior week. Lap 20 of a 1,770-lead
  book, with 1,621 of 1,627 findings already on file. Website resolution was healthy this
  pass (4 misses of 150, cause `resolution_ok`), which confirms the 11-22 reading of 120 of
  128 was the cursor sitting on a different slice and not a change in the ownership rule.
  `collect_book_stranded` is 3, so no selector gap has reopened.
- **Apify email recovery.** Tenth morning. The token has answered "user-or-token-not-found"
  since 2026-11-12T10:20Z, `lane_no_work_hours` is 287.6 (twelve days), and $21.06 of the
  November allowance expires 2026-11-30. Operator-only; the token is in the settings bank.
- **Replies.** 7 people read, 15 runs, no classifier failures. Five unsubscribes, one
  not-interested, one other. No agreements. The auto-sender stays paused by Casey's
  2026-09-17 order, which is deliberate and not a backlog.
- **Push skips.** 13 skips, all 13 rewritten and sent in the same run, so they cost nobody.
  4 people were deferred by the approval gate and wait for the next day.
- **Enrichment.** 1 lead finished, chain `idling_no_inflow`, which is the right answer at
  99.8% bundled. Measured cost $0.1269 per enriched lead over 566 leads in 30 days.
- **YouTube keys.** 15 working of 66. Settled 2026-09-16: the quota was cut on 50 projects.
  Not an incident and not a reason to buy keys.
- **Spend.** $0 Anthropic. OpenRouter balance $297.98 at 13 cents a day.

## Fix shipped this cycle

**The offer library running out now names the precondition that stopped the last offer.**
`siegePushOutcome()` in `scripts/autopilot/debrief-data.ts`:

- The writers' column-format skip verdict is now read, per offer, for the whole window.
  Two or more spaces either side of the word is what keeps the batch's own summary line
  (`| 3 leads: 0 ready, 0 failed, 3 skipped, 0 errors`) and the push footer
  (`| sent=0  skipped=0  failed=1`) out of it.
- The terminal exhaustion line now captures the offer that printed it, and the loss row
  reads `every offer that can run has already been made to them (love-your-channel-short:
  no safe enemy in the bank)`, which fits under the 120-character reason cap.
- A new `push_outcome.offer_exhaustion` block carries the people, the offers, the full
  verdict and `precondition_leads`, so a verdict claimed off one lead shows as thin.
- The pairing is per offer, not per person, on purpose: the writer keys its refusal by
  channel name while the summary keys by lead id, and the summary lines print in one group
  at the end of the planning phase rather than beside the batch that caused them. An offer
  with no verdict in the window keeps the bare 11-21 wording and `precondition` reads null,
  so it can never borrow somebody else's reason. `people` is null, not 0, on an unreadable
  plan.
- The verdict has its digits collapsed to N, because `(0 found, all ruled out)` is per-lead
  and would otherwise split one precondition into a row per lead. That is the 10-12 lesson.

Verified against Monday's live log and plan: 89 planned, 85 approved, 23 lost, 13 lost
before the push, identical to the published snapshot, with the top row now naming the offer
and its empty bank and `offer_exhaustion` reporting 10 people on one offer with 15 leads
behind the verdict. Seven new test cases; full suite 438 cases, 0 failures; `tsc --noEmit`
clean. Commits `4aedb7e` and `295b7f4` in `youtube-outreach-orchestrator-v1`, the second
correcting the bank count in the notes from ten to nine after reading all eleven files.

## Ranked levers

1. **Decide what happens to the eleven people whose last offer cannot write to them.** Seven
   need another research pass or should stop being planned, two need transcripts, two should
   be left alone. All ten reachable ones are planned and dropped every sending morning and
   one has been lost ten days running. Casey's call.
2. **Get the warmup records back for the 23 mailboxes blocked by nothing else.** The list
   fell 94 to 28 on Sunday and has held. Unlike 11-04, those 23 are a real recovery. Check
   the warmup provider's account.
3. **Replace the Apify token.** Twelve days dead, $21.06 expiring 2026-11-30, six days left.
4. **Ask why the queue sends to repeats while 4,854 never-contacted emails sit finished.**
   One day of slots pointed at the untouched shelf would reach more new people than the last
   six sending days combined. The tier order is in the send program.
5. **Leave the free recovery lane alone.** Lap 20, a picked-over book, healthy resolution.
   More search credit buys nothing.

## What was verified, not assumed

Every figure above comes from the grounded snapshot except the enemies-bank diagnosis. For
that: the eleven lead ids were taken from `automator/logs/siege.log`, each one's
`researched/enemies-bank.md` was opened in `youtube-email-outreach-v1/enrichment-bundles`,
and the table counts plus the transcript coverage are a direct read of those files. The
668-of-11,809 share is a count over every bundle on disk. The rule that the offer needs an
enemy was read off the skill's own `run-batch.mjs`.

Not established here: whether another research pass would find an enemy for the seven with
full transcript coverage, and whether the warmup subscriptions were cancelled, lapsed or
dropped by the provider. Both need somebody outside this file. Discovery being off,
enrichment idling, the parked count of one and the paused reply sender are all the intended
state, and none was treated as a fault.
