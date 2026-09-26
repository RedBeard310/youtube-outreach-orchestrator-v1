---
title: Lead Run Analysis, 2026-09-26
type: analysis
status: maintained
updated: 2026-09-26
tags: [lead-gen, youtube, outreach, autopilot, debrief, siege]
---

# 2026-09-25: 107 emails, nearly double the record, and 97 of them came from a sender this repo doesn't own

Companion to [lead-run-2026-09-26.html](lead-run-2026-09-26.html). Cycle window
2026-09-25T07:00Z to 2026-09-26T07:00Z, which is exactly Pacific day 2026-09-25.
Every figure here is either from `logs/autopilot-debrief-2026-09-26.json`, from a
Postgres query run while writing this, or from a named log file.

## Headline

**107 emails were loaded into SmartLead**, against 55 the day before and 47 the day
before that. The split:

| Source | Count | What it was |
|---|---|---|
| Siege engine | 97 | One LIVE run, 16:25 to 17:22 UTC (09:25 Pacific), 6 offers |
| `npm run send` | 10 | The session-start send at 00:20 Pacific, emptying its lane |

By lane: **84 from `approved_hold`, 23 from `approved`**. Per Pacific day since the
pause lifted: 09-23 **47**, 09-24 **55**, 09-25 **107**. Before the pause: 09-08
**8**, 09-09 **14**, 09-10 **40**, and 09-11 to 09-22 **zero**.

**Loaded is not delivered.** SmartLead's scheduler sends Monday to Thursday, 09:00
to 15:00 Eastern. For delivered volume run
`youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`.

## The Siege run, in its own numbers

From `automator/logs/siege.log`, the LIVE run starting `2026-09-25T16:25:31Z`.

| Measure | Value |
|---|---|
| People on the board | 4,737 (whale 1,873, strong-7 1,660, other-7+ 1,204) |
| Do-not-contact blocks honoured | 513 active entries |
| Mailboxes | 37 configured, 22 live, 15 emails a day each |
| Slots the mailbox ladder offered | 185 |
| Ramp cap for the day (sending day 3) | 100 new emails |
| Offers planned | short-save-time 20, joke-ai-slop 20, voice-objection-proof 17, short-work-with-me-video 16, attack-enemy-propose-5-ideas 14, owner-or-youtuber 13 |
| Outcome | **sent 97, skipped 1, failed 0, blocked 0** |
| Model spend | **$0.** Every live offer is a template writer, "No model calls, $0" |
| Leads with a research bundle on disk | 100 of 100 |

The 97 sends each wrote a row to `leads.outreach_sends` with a `batch_id` of the
form `siege-<date>-<smartlead campaign id>-<offer>-<hash>`. **The 10 sends from
`npm run send` wrote no row there**, which is worth knowing before reading that
table as the whole send history: it starts 2026-09-02 and holds 324 rows, all of
them from Siege or the email-test harness.

### Ten of sixteen offers cannot run

Siege gates every offer and prints why. Six can run. The other ten are blocked on:
no subject line in Notion, no batch-writer script, zero of the two required
follow-up bodies, an `email_type` missing from `leads.vocab_outreach_email_type`, a
Notion Working Status left on Paused, and in one case a writer importing
`/Users/caseybrown/Claude/...` from the old Mac. One is blocked on purpose: the 80%
time offer's hard gate says the breakdown video does not exist yet.

**This is the volume ceiling now.** The ladder offered 185 slots against a ramp cap
of 100, and offer variety is what lets one board absorb more volume without
emailing anybody twice.

## Pools

| Pool | Now | Yesterday | Note |
|---|---|---|---|
| `approved_hold` | 6,860 | 6,860 | **0 parked.** Sending does not change this count |
| of which ready to write | 6,570 | 6,649 | Fell by the 84 that shipped out of it |
| of which carrying a bundle | 6,852 of 6,860 | 6,852 of 6,860 | 99.9%. Enrichment is finished |
| `needs_contact` | 4,236 | 4,236 | Nothing arriving, nothing leaving |
| `approved` (the send lane) | fully sent | fully sent | This morning's send attempted 0 |

At yesterday's rate the shelf is about sixty days of sending.

## The recovery lane: lap 6 of a picked-over book

Four collect passes and six verify passes ran on schedule
(`journalctl -u recovery-lane.service`).

| Measure | This cycle | Prior 7 days |
|---|---|---|
| Contact points written | **26** | **3,672** |
| of which email addresses | **6** | **405** |
| Leads that produced anything | 20 of 600 readings | n/a |
| Addresses verified | 5 across 3 passes | n/a |
| Leads parked | **0** | 374 recovered lifetime |
| Book remaining | 3,321 (from 3,326) | n/a |
| `stranded` gap indicator | 3 | 3 since 09-13 |

Per-pass hit rates were 4.7%, 2.7%, 2.0%, 4.0%. Every pass was **100% re-walks**,
website resolution ran at **98 to 99%**, and **Brave refused nothing**. The
constraint is leads to walk, not search credit, which is exactly what the four
`bloodhound_collect_yield_degraded` observations said before declining to escalate.

**The verify half is genuinely drained, not gapped.** Of the 913 `needs_contact`
leads holding an email contact point, 1,215 points in total, **only 4 have never
been checked**; 542 carry a ZeroBounce verdict and the rest are held by the
ownership gate. There is no hidden queue here.

**The alarm is about to stop saying any of this.** Its long baseline of normal fell
27.7% → 17.3% → 8.3% → 7.3% across the cycle's four firings, and today's fall read
45.5% against a 40% threshold. One more day and it goes quiet while the book
problem remains.

## Enrichment finished

The backfill chain launched **no batches** this cycle. Its pool is **3 leads, two
permanently excluded**. Last real work was 09-24 13:19. One line was logged all
day: a transcript-provider limit at `2026-09-25T12:40:34Z` that cleared **19
seconds later** on its own. The chain sleeps 30 minutes and re-polls, silent until
work arrives, which is by design.

The instruction Casey gave on 09-08, put every resource into enriching the leads we
already have, is complete at **99.9%**.

## The money, and where OpenRouter is actually going

| Line | Value |
|---|---|
| Anthropic | **$0.00** against a $150 ceiling, thirteenth zero |
| OpenRouter, this cycle | **$2.52**, balance **$194.99**, about **77 days** |
| Apify | resting on $0.0053 spendable against a $10 reserve, cycle rolls 30 Sep |
| The 97 Siege emails | $0 of model spend |

**Spend held flat while the thing that used to explain it did nothing.** Enrichment
processed zero leads and the finder logged zero calls, yet the rate is unchanged
from yesterday's $2.44. The spender found:

`automator/scripts/smartlead-auto-reply.py` ran **683 times inside the cycle**,
always in dry run, and **401 of those runs classified the same address**
(`tara@rehab-hq.com`). Dry run never sends, so the reply never leaves the queue,
so the next run pays to classify it again. The classifier is
`openrouter:deepseek/deepseek-v3.2` per `automator/models.json`; the suggester is
`sonnet`, which bills the subscription and not the API.

The fix is to hold a classification against the reply's id, or to slow the timer
while it is in dry run. **It is outside the five repos the autopilot may edit**, so
it is recorded here rather than shipped.

## Shipped this cycle

**Orchestrator `5eb5581`** ("count what the recovery lane produced, and stop an
empty send reading as an unmeasured one"). Typecheck clean, 86 tests pass, both new
queries run live against Postgres.

1. **`recovery_lane` block in the grounded metrics.** The lane is the only process
   still producing sendable leads while discovery is paused, and nothing in the
   metrics counted its output. `parked_today` is the parked-pool delta, which the
   Siege send path also moves, so a zero there was ambiguous. The new block carries
   contact points and email addresses for the cycle, the same two for the prior
   seven days, book depth, the stranded counter and the lap number. The query lives
   next to the two selectors it derives from (`collectYieldBetween` in
   `src/recovery/bloodhound-lane.ts`) so widening one cannot leave the number
   describing a pool that no longer exists.
2. **An empty send batch now reports 0 sent and 0 failed.** Yesterday's fix made a
   clean send say "zero failures" instead of "unknown"; it missed the no-batch case.
   Both session-start sends since the approved lane drained logged
   `send_sent: null` and printed `sent=? failed=?`, which is the shape of a send
   that crashed before printing its tally. Nothing attempted means zero sent and
   zero failed. Regression test added.

## Health

Zero fatal signatures, zero halts, zero quota stops. Every timer fired.
`stranded` held at 3 for the thirteenth day. YouTube keys read **15 working of 66**
for the thirteenth identical morning, which is settled and free while nothing is
searching. Discovery produced zero new channels, which is the standing instruction
from 09-08 and not a fault.

## Recommended next, ranked

1. **Stop paying to classify the same reply 400 times a day** (automator, outside
   the autopilot's edit scope).
2. **Unblock more Siege offers.** Ten of sixteen are out for small, named reasons
   Siege already prints. This is the volume lever.
3. **Decide what `npm run send` is for.** Its lane is permanently empty; Siege
   reaches the shelf by naming leads. Retire it, or open its selector to
   `approved_hold` and accept the hold gate becomes automatic. **Casey's call.**
4. **Decide whether the hourly collect pass keeps its slot.** Two days, 1,200
   readings, 5 leads moved, nobody parked. It costs nothing and is not broken, but
   the 4,236-lead pool needs a method it does not have, not another lap.
5. **Expect the yield alarm to go quiet and do not read that as recovery.**
6. **Watch Apify on 30 September.**
7. **The 09-19 debrief is still unwritten** and its metrics file exists.

## Deliberately not done

No email sent by this agent. No discovery lane touched, restarted or repaired. No
`.env` or secret read or written. No alarm threshold moved. No halt flag written.
The send selector left reading `approved` only. The automator's reply loop left
running rather than changed from here. The loop is left running for the next cycle.
