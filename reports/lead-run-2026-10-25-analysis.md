# Lead Run Analysis — 2026-10-25

Cycle window: 2026-10-24T07:00Z to 2026-10-25T07:00Z (Saturday, Pacific).
Snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-25.json`.
Companion: [lead-run-2026-10-25.html](lead-run-2026-10-25.html).

## Headline

A Saturday. Nothing was sent, which is correct, and `binding_constraint` reads
`not_a_sending_day`. Two things are worth reading anyway.

**The fleet stopped falling.** The band gate moved 3 mailboxes back to clear, 2
onto watch, and stopped none. Clear went 17 to 18 and the stopped band held at
34 of 58 after climbing on four straight mornings. It is the first zero-stop
morning since 10-20.

**The recovery lane's search bill went up about twentyfold for the same output.**
Its cursor crossed from tier 0 of its book (leads that already carry a website
link) into tier 1 (leads that do not) at 08:01Z on 10-24. A tier-0 pass of 150
leads spends about 5 web searches; a tier-1 pass spends 150. The cycle ran 440
Brave searches against roughly 20 the day before, which at $5 per thousand is
about $2.20 for the day. Output was unchanged: 12 contact points, 2 addresses, 2
people, 1 parked.

## The numbers

| Reading | This cycle | Day before |
|---|---|---|
| Emails loaded | 0 (not a sending day) | 148 |
| First touches | n/a | 9 of 148 |
| Clear / watch / stopped (band gate, 07:05Z) | 18 / 6 / 34 | 17 / 7 / 34 |
| Band moves inside the cycle | 3 up, 2 watch, 0 stop | 2 up, 5 watch, 5 stop |
| Parked into `approved_hold` | 1 (pool 6,822) | 1 (6,821) |
| `needs_contact` | 3,432 | 3,433 |
| Shelf: never written to / already sent | 5,146 / 1,666 | 5,145 / 1,666 |
| Enriched share of the pool | 6,812 of 6,822, 99.9% | 99.9% |
| Free recovery lane | 12 points, 2 addresses, 2 people | 11, 2, 2 |
| Judged collect pass | 150 leads, 93% no site, `ownership_gate` | 150, 4%, `resolution_ok` |
| Brave searches in the cycle | 440 | ~20 |
| Enrichment | 1 batch, 1 lead | 1 batch, 1 lead |
| Anthropic / OpenRouter | $0 / $1.66 a day, $68.33 left | $0 / $1.73, $69.95 |
| Fatal signatures / halts | 0 / 0 | 0 / 0 |
| New channels discovered | 0 (by the 2026-09-08 order) | 0 |

## Why the Brave volume jumped, and why credit would not help

`collectBatch` sorts the 2,401-lead book into two tiers: tier 0 is a lead that
carries an external link, tier 1 is a lead that does not. Nine of thirteen
collection methods need the creator's own website first, so a tier-1 lead has to
have its site found by web search before anything else can run.

The cursor tiers from the campaign log, with the Brave search count of each pass:

| Pass | Tier | Brave searches |
|---|---|---|
| 10-23T18:01Z | 0 | 4 |
| 10-24T01:01Z | 0 | 7 |
| 10-24T08:01Z | 1 | 129 |
| 10-24T14:01Z | 1 | 150 |
| 10-24T21:00Z | 1 | 150 |
| 10-25T03:01Z | lap tail | 11 |

Brave answered well. Of the 440 searches, **358 returned a real candidate
website**. The ownership gate then refused **327 of the 358, about 91%**, because
the page could not be tied to that creator. That gate is from the 2026-08-18
audit and it exists to stop a stranger's address being filed under one of our
leads. So buying more search credit buys more candidates for the gate to refuse.
This is the same finding as 10-10 and 10-20, in a new place.

Two of the 440 searches were refused outright on a usage limit, the first
refusals in five days. That is 0.5% of the pass and changes nothing.

**This repeats.** Tier 1 is the tail of every lap, so roughly every four days the
lane will spend about $2 of search credit on this stretch and the gate will
refuse most of it. Worth knowing before a future cycle reads a Brave bill as a
fault.

## Self-improvement shipped

**Orchestrator `b52232f`: `site_resolution` was not describing the newest collect
pass, and nothing said so.**

`collectPassAttribution()` judges the newest completed pass of at least 30 leads.
That floor is right, because a short tail-of-lap batch is not a sample of the
lane. It was also silent, so the snapshot's own note, the hourly alarm and twelve
debriefs all called what came back "the newest completed collect pass".

Today that sentence was false. The lane closed lap 11 at 03:01Z with an 11-lead
tail and `site_resolution` described the 150-lead pass from 21:00Z the evening
before, ten hours and one pass back.

This cycle it cost nothing, because both passes tell the same `ownership_gate`
story. It is still a silent cap that can freeze. The collect batch is
configuration and has been 40 and has been 150. Set it under the floor and every
pass is skipped, `cause` stops moving, and the field a spend decision is read off
describes a pass from weeks ago while still reading as today.

`newer_passes_skipped` and `newer_passes_skipped_leads` now name what the floor
dropped. They live in the parser rather than a private copy, so the alarm and the
report cannot disagree about them either. 0 means the reading really is the
newest; a standing nonzero is the freeze.

3 regression assertions over the live 10-25 lap-tail shape, the clean case and
the under-floor batch. 123 tests green, selftest ALL PASS, typecheck clean, and
the live snapshot renders `1` and `11 leads`.

## Checked and deliberately not changed

- **The ownership gate.** 91% refusal is high and it is doing its job on a
  stretch of book where the creators have no findable site in their own name.
  Loosening an identity gate on a hunch is the one change here that quietly
  poisons the data.
- **The podcast method's own brake.** 16 of the judged pass's 89 method errors
  are "iTunes budget spent for this pass". Apple meters its search API per IP, so
  the lane caps its own calls. It is the largest real fault in the pass and it is
  a deliberate cap, not a break. The largest cause overall, 61 of 89, is
  `34-channel-page: page rendered with no outbound links`, which is that method
  saying the creator genuinely has no links.
- **Enrichment.** 1 lead because ten are left in a 6,822-lead pool.
- **The verify half of the recovery lane.** Five of six runs reported
  `no_pending_email_points` and the sixth ran the 2 leads that had new addresses.
  That is an empty queue, not a selector gap. `stranded` held at 3.
- **The YouTube key pool.** 15 working of 66, 50 still exhausted after the
  midnight reset. Settled on 2026-09-16: the quota on those projects was cut, so
  a reset cannot refill them. Discovery is off and enrichment runs on 1-unit
  calls, so it is inert.
- **Apify.** $9.9998 against a $10 reserve, so spendable is -$0.0002 and it ran
  nothing. The allowance is the calendar month and refills on 11-01.

## Forward note

There is already a draft plan on disk for Monday 10-26, written at
2026-10-24T00:20Z, which is Friday evening, before the weekend's band moves. It
carries **62 new offers against 1,725 people waiting**, all 62 going to `strong7`
and none to the 672 waiting whales. Siege rebuilds the plan on the morning of the
push, and `plan.json` is overwritten in place, so this is a forecast rather than
the plan. It is worth one glance: 62 slots against 150 on Friday is what the
fleet's week looks like translated into email volume.

## Ranked next

1. **The fleet still decides volume.** 34 of 58 stopped, 18 clear. Today's
   zero-stop morning came on a day nothing was sent, and the gate has pulled
   mailboxes after quiet weekends before. Read Monday's band figures before
   concluding the slide has ended. The call is Casey's and it lives in
   `automator`.
2. **Watch whether `strong7` produces first touches again on Monday.** Friday's 9
   was the first break in the drought and it came from a tier clearing its own
   backlog, not from a setting. Five sending days total 686 emails and 10 new
   people, 1.5%. If Monday drops back to 0, Siege's slot order needs a
   first-touch term, which is free and lives in `automator`.
3. **Know what the recovery lane's new search bill is, and do nothing about it.**
   About $2 of Brave credit per lap on tier-1 leads, where the gate refuses 91%
   of what the searches find. Adding keys buys nothing. The only lever that
   changes the yield is the gate's strictness, which is a data-quality decision.
4. **Plan for Apify's 11-01 refill.** $100 at the measured $0.115 a lead is
   roughly 700 recovered leads with about $100 of OpenRouter enrichment behind
   them, against a $68.33 balance and 41 days of runway.
5. **The shelf keeps growing and nothing drains it.** 5,146 enriched and never
   emailed, up 1. Enrichment is finished, discovery is off by Casey's order, and
   the recovery lane adds one or two people a day.
