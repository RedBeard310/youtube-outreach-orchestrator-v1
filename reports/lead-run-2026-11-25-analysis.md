# Lead run analysis, 2026-11-24

Cycle: 2026-11-24T08:00Z to 2026-11-25T08:00Z (the Pacific day of Tuesday 2026-11-24).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-25.json`.
Companion report: [lead-run-2026-11-25.html](lead-run-2026-11-25.html).

## The one-line version

Three creators agreed to talk, which is the only thing in this cycle that earns money. Then
the sending fleet's clear band fell from sixteen mailboxes to five on a roster that did not
change size, so for the first time in three weeks a fleet collapse can be reported without a
caveat. Seventy-two emails went out and every one was a repeat offer. Eighteen approved
people got nothing and not one of them was new.

## Headline numbers

| Reading | This cycle | Prior | Note |
|---|---|---|---|
| Creators who agreed to talk | **3** | 0 on 11-23, 0 on 11-24 | 2 yes-with-questions, 1 plain yes |
| People read by the reply lane | 5 | 7 | Counted as people, newest verdict each |
| Emails loaded | 72 | 65 | All by the send program, 0 by this repo |
| People reached for the first time ever | **0** of 69 | 0 of 60 | Fourth day running |
| First touches over the prior 7 days | 8 of 906 people (0.9%) | | 1 person across the last four sending days |
| Approved people who got no email | **18** of 90 | 23 of 85 | Split complete |
| ...of which already lost on an earlier day | **18** | 21 | `lost_new` 0 |
| Longest unbroken loss streak | 10 snapshot days | 10 | Same person |
| Mailboxes clear to send | **5** | 16 | Roster 28 on both mornings |
| Mailboxes on watch / stopped | 11 / 12 | 4 / 8 | 10 arrived in watch inside the cycle |
| Live inboxes at plan time | 16 of 124 | 17 of 124 | Allowance 870, slots 98 |
| People waiting for a slot | **1,724** | 1,346 | whale 289 / strong7 725 / other7 710 |
| Parked into `approved_hold` | 0 | 1 | Pool flat at 7,392 |
| Recovery lane's own half | 23 points, 1 address, 6 people | 73 points, 12 addresses over 7 days | Lap 20 of a 1,769 book |
| Shelf ready to write | 4,854 | 4,854 | 7,380 bundled, 99.8% |
| Apify email recovery | 311.6h with no work | 287.6h | Token refused 70 ticks running |
| Fatal error signatures | 0 | 0 | No halt flag |
| Anthropic spend | $0 | $0 | OpenRouter $297.95, 4 cents/day |

## What the day was

The mechanics were clean. Siege wrote its plan at 11:26:53Z, the push unit reported success,
72 emails reached SmartLead, the reply reader ran fifteen times without a failure, and there
were no fatal signatures and no halt flag. Nothing needed rescuing.

Two things are worth Casey's attention and they point in opposite directions.

The first is good. The reply reader classified five people and **three of them agreed to
talk**: two with questions attached and one a plain yes. The addresses are
`partha@npfinancials.com.au`, `info@planbparaguay.com` and `steve@thefrugalexpat.com`. That
is the best reply day since 11-18 and the only part of this cycle that moves toward revenue.
The auto-reply sender is paused and has been since 2026-09-17 by Casey's own instruction, so
nothing in the pipeline answered them; the lane classifies and logs and sends nothing. Casey
answers these by hand off his own two lanes, the morning draft doc and the Notion board,
neither of which leaves a line in the log this file reads. So this report can say three
people said yes and cannot say whether anybody has replied, which is worth one check.

The second is the fleet, and it is the cycle's real finding. It gets its own section below.

Everything else was quiet or deliberately quiet. Nobody was parked, so the pool sat flat at
7,392. The free recovery lane walked 600 lead-slots across four passes and produced 23
contact points and one email address against 73 points and 12 addresses the prior week, which
is what lap 20 of a 1,769-lead book pays: 2,429 of the 2,452 things its methods found were
already on file. Site resolution was healthy at five no-site leads out of 150 with zero search
refusals, so search credit would buy nothing. The enrichment chain reports itself idle for
want of new work, which is the correct answer when 99.8% of the shelf is finished. Discovery
produced no new channels, per the standing order of 2026-09-08.

## The fleet: eleven clear mailboxes gone, and this time it is real

The health gate bands every mailbox clear, watch or stopped. This morning it reads **5 clear,
11 watch, 12 stopped**, against 16 / 4 / 8 yesterday.

A number like that has been unreportable for three weeks. The gate can only band mailboxes
the warmup service hands it, so when that service shrinks, the clear band shrinks with it and
nothing recovered. On 2026-11-22 at 14:05Z the warmup list fell from 94 subscriptions to 28
and held there, and the 11-23 report published "clear 43 to 19, stopped 46 to 6" beside a flag
saying the comparison was sound. Nobody had recovered. Forty mailboxes had simply left the
instrument.

The fix shipped yesterday records how many mailboxes each of the two compared readings covered
and refuses the comparison when they differ. This morning both covered **28**, the change in
roster size is **0**, and the guard passes. So the collapse is a real health event:

- 10 mailboxes **left the clear band** inside the cycle (plus 2 movers no retained run can
  place, which is why the published figure is a lower bound and the arithmetic closes at 5)
- 10 arrived in watch, 4 in stop, 1 came back to clear and is still clear
- the **highest clear count anywhere in the cycle was the 16 it started at**, so this is not
  a mailbox that rose and fell. It fell and stayed down
- **0 round trips**, so nothing came back and was re-stopped

What that cost: Siege saw only **16 live inboxes of 124** and planned **98 slots** against an
870-message allowance, so mailboxes and not the warmup ramp were the ceiling. **1,724 people
are waiting for a slot**, up from 1,346 the day before.

What comes back for free: **7 held mailboxes are healthy and only waiting out a recovery
timer**, the nearest four hours from clearing. None is held because a sibling address on its
domain is sick. Leave those alone.

What is recoverable by hand: the plan's largest not-live reason, "not in the InboxKit warmup
list, so its age is unknown", is named by 96 mailboxes and carried **alone by 21**. Those 21
are slots the day really lost; the other 75 are blocked by something else as well and
repairing their records would free nobody. That distinction cost the 11-04 report its number
one recommendation, so it is stated carefully here. Separately, **67 of the 78 mailboxes the
gate suspended in its own name now sit outside its roster**, which means no run of it can ever
resume them. Third morning for that figure. Both repairs live in the send-path repo.

Why ten mailboxes left clear in one cycle is **not established here**. The gate records the
moves and the scores behind them live in the repo that owns the gate.

## Why 72 emails reached nobody new

Sixty-nine people were emailed and all 69 had heard from us before. First touches by Pacific
day, oldest first:

```
11-17  3
11-18  4
11-19  0
11-20  1
11-21  0   Saturday, zero by design
11-22  0   Sunday, zero by design
11-23  0
11-24  0   this cycle
```

Four consecutive days at zero, and across the last four **sending** days the pipeline has
reached one person. The prior-week ratio is 0.9%, and reading this cycle's 0% as a collapse
off a healthy week would be wrong: the week was 8 people out of 906.

Meanwhile the shelf holds **4,854 finished emails for people nobody has ever written to**, and
none of them went. Repeat offers are deliberate and have been since 2026-10-07, so this is not
a fault. It is a choice about ordering, and the ordering setting in the send path has not
changed in three weeks.

## The eighteen, and why it is the same eighteen

Eighteen of the 90 people the push was asked for ended the day with no email. **All 18 had
been lost on an earlier day. Zero were new.** The split is complete, so that zero is measured
and not a truncated list reading as a clean day. One of the 18 has now been dropped on ten
consecutive snapshot days.

By what really cost each person:

| Cause | People lost | Repair, and whose |
|---|---|---|
| Ran out of offers (`love-your-channel-short`, no safe enemy) | 8 | The research file, or stop planning them |
| YouTube no longer has their channel | 2 | Stop selecting them; send path |
| No draft written: business owner, no clean job title | 1 | The writing skill |
| SmartLead refused them as already unsubscribed | 3 | Stop selecting them; send path |
| Silent, nothing in the log mentions them | 2 | Unknown |

Fourteen push-level skips were all rewritten and sent in the same run, so they cost nobody and
are not a shortfall. Eight more people were held by the approval gate for the next day, which
is the gate working.

None of these causes resolves itself overnight, which is the whole reason the cohort is
stable. A lead whose channel no longer exists sets none of the four things the send program
filters on, so it takes a slot every morning forever. Three people with a bounce on file will
keep being planned until something stops selecting them.

## The eight, and the number that was missing

The largest cause, eight people, publishes as "every offer that can run has already been made
to them". Yesterday's fix made that row name the offer that declined and the reason it gave:
`love-your-channel-short` needs one line siding with the creator against something they argue
with, and it reported `no safe enemy in the bank`.

That reason then went through a condenser that turns digits into the letter N, so all nine
leads behind it published as one row reading `(N found, all ruled out)`. **The N is the only
part that picks the repair**, and it hides two opposite situations:

```
(0 found, all ruled out)   the research file has no enemies in it at all
                           -> re-mine the transcripts, or stop planning that person

(2 found, all ruled out)   the file HAS enemies and the safety filter refused them
                           -> the question is how strict that filter should be, and it is
                              Casey's call
```

This cycle it was **eight of the first kind and one of the second**. Counted across the whole
send log the split is **83 leads to 16**, so about five in six are empty files.

This is a rule already written down in this pipeline. On 2026-11-04 a report told Casey to wait
four days for mailboxes to clear, because the condensed row read "warmup day N, and the floor
is day N" while the untouched line said day 9 against a floor of 14, which is five days and a
different answer. The lesson recorded then was to read the untouched example and never the
condensed key. It landed twenty days later inside the one field built to end this exact
mystery.

## Fix shipped this cycle

**Orchestrator `cbbaed2`: the dry-offer precondition keeps the number that picks the repair.**

The condensed key still groups, because the per-lead number would otherwise split one
precondition into a row per lead. Beside it, each offer row in `push_outcome.offer_exhaustion`
now carries:

- `precondition_example`: one untouched wording, exactly as the writer printed it, being the
  most common of the variants
- `precondition_variants`: every distinct untouched wording with the leads each was said
  about, largest first, capped at four
- `precondition_variants_complete`: whether those are all of them, so a capped view cannot
  read as a complete one

All three are null, and the variants empty, exactly when `precondition` is null, so an
unmeasured offer cannot carry a confident-looking example.

**Verified, not assumed.** Re-ran against the live send log and Siege's own plan and approval
files for 2026-11-24: 98 planned, 90 approved, 72 sent, 18 lost and 14 skipped all reproduce
the snapshot exactly, and the new fields split the nine leads into 8 empty files and 1 strict
filter. Three new cases cover the live two-variant shape, a tie broken by wording, and a tail
past the cap. Suite 440 assertions, all pass. Typecheck clean under the project config.

**Not touched.** No research, filter or rotation behaviour changed. Re-mining the eight empty
files and loosening the enemy bar are Casey's calls, under the house rule that the ownership
and safety gates are his.

## Confirmed working: yesterday's roster guard

The 11-23 fix was tested properly on its first real morning. It reads the roster size behind
both compared readings and refuses the comparison when they differ. Today both read 28, so it
said yes, and the 16-to-5 collapse is reported as a real health event rather than hedged.
Three weeks of fleet numbers needed a caveat. This one does not.

## Ranked levers

1. **Answer the three creators who agreed to talk.** Two with questions, one a plain yes. The
   auto-sender is paused by choice, so nothing replied, and this file cannot see Casey's draft
   doc or his Notion board. One check that all three landed there.
2. **The fleet is Wednesday's ceiling, and 21 slots of it are free.** Five clear mailboxes
   against 1,724 waiting. Leave the 7 held-but-healthy alone, they lift themselves. Restore
   the warmup records for the **21 mailboxes blocked by nothing else**, and read the 21 and
   never the 96.
3. **Decide what happens to the nine offer-exhausted.** Eight need another research pass or
   should stop being planned; one is a question about the safety filter. They have cost a slot
   every sending day since 11-11.
4. **Replace the Apify token.** Thirteenth morning, 311 hours with no work, still "user or
   token not found". **$21.06 expires 2026-11-30**, five days away. Operator-only.
5. **Ask again why the slots go to repeat offers** while 4,854 finished, never-sent emails sit
   on the shelf. One day of slots aimed there would beat the last four sending days together.
6. **Leave the recovery lane alone** at lap 20 with 99% of findings already on file, and
   release the 67 gate-owned suspensions that sit outside the gate's roster (send path).

## What was verified, not assumed

- **Verified:** the send counts, by recomputing `siegePushOutcome` from the live send log and
  Siege's plan and approval files; they reproduce the snapshot exactly. The empty-versus-strict
  split, by counting the writers' own skip lines in that log (8 and 1 this cycle, 83 and 16
  lifetime). The fleet comparison's validity, by checking both readings covered 28 mailboxes.
  The three warm replies, as the reply reader's newest verdict per person.
- **Assumed:** nothing numeric. Every figure above comes from the grounded snapshot or from a
  re-run against the same logs.
- **Not established:** why ten mailboxes left the clear band in one cycle. Whether the three
  agreements reached Casey's hand-lanes. Whether the eight empty research files are empty
  because transcripts were never mined or because those creators argue with nothing.
- **Untouched by design:** discovery stayed off per the 2026-09-08 standing order. No
  credential, no send-path behaviour, no research or filter rule was changed.
