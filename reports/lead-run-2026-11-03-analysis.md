# Lead Run Analysis — 2026-11-03

Cycle: 2026-11-02T08:00:00Z to 2026-11-03T08:00:00Z (the 24h ending at midnight PT, so all
of Monday 2 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-03.json`.
Companion to [lead-run-2026-11-03.html](lead-run-2026-11-03.html).

## Headline

**107 people heard from us for the first time ever.** The whole week before this cycle
reached 2. Every one of the 107 came off the shelf of parked, researched leads, which is
the only thing that drains it.

The push sent 116 emails of 123 planned and lost 5 people. Yesterday's snapshot would have
called that 11 lost, and six of the names it published had already been emailed. That is
fixed below.

**The starvation is over, and it was never about supply.** The shelf has held 5,500 written-up
people for weeks. Monday was the first day the send path handed them slots.

## The reach day

| | Prior 7 days | This cycle |
|---|---|---|
| People emailed | 253 | 115 |
| First touches | 61 | **107** |
| Genuinely new people (`first_touch_new`) | 2 | **107** |
| First-touch share | 24.1% | **93%** |

The middle row is the one that matters. A "first touch" can be a stranded lead finally
flying rather than a new person reached, and in the 10-28 cycle 50 of 51 were exactly that.
Not here: `first_touch_recovered` is **0**, so all 107 had never been planned before, and
`shelf_first_touch` is **107**, so all 107 came off `approved_hold`.

For context, the eight days ending 10-29 reached five new people in total.

**What changed is not in this repo.** Siege hands slots out by tier, and the Whale tier's
re-offer queue has taken every slot since 10-13. On Monday 123 slots went to never-emailed
people instead. 2,259 ready people still waited (982 Whale, 414 Strong-7, 863 Other-7+), so
the queue is not drained, just finally moving.

## The finding: the push log lost a batch, and the loss was overstated by six people

`push_outcome` exists to answer "who was planned and got no email", and it answers it by
joining the plan against Siege's **log**. The log is the push's narration, not its record.

On 11-02 it lost a whole push-batch block. The batch at 11:37:55Z printed its `spin` and
`fix` lines, no header, and no `SENT` lines at all. Two of the people it emailed
(`recIpRyMfqQuZyuZL`, `recKmOXpQYaGoYHBA`) appear **nowhere in the file**.

Six leads in total had a real `leads.outreach_sends` row, with the sending inbox, offer and
batch id all matching the plan, and no `SENT` line. So the join called every one of them lost:

| | Published | Real |
|---|---|---|
| People emailed | 110 | **116** |
| People lost | 11 | **5** |
| of which SmartLead refused | 3 | 3 |
| of which we declined | 3 | 0 |
| of which nothing was said about | 5 | **2** |

Three of the six wore a disguise this pipeline has seen before. A later batch re-encountered
them and printed `SKIP ... is absent from this batch's Siege manifest`, which is what a
skip-after-send looks like, except that the `SENT` line which normally cancels it was the
missing one, so they counted as drafts we declined.

**Two independent instruments now agree.** Siege's own database rows for the day read 116
pushed, 3 failed, 2 dropped. `sent_elsewhere` (every email in the cycle that was not this
repo's own send) reads 116 against `people_emailed` 116. The old arithmetic could produce
neither.

## The fleet doubled and sent from twelve mailboxes

Yesterday's lever #2 said to read `inboxes_only_no_campaign` on Monday, because 58 new
mailboxes with no campaign attached and a failed SmartLead campaign read look identical. It
answered: **23**, so the benign version. Not a code fault, about twenty minutes of setup.

But 23 does not explain 124 mailboxes sending from 12, and nothing published the rest. The
plan held it all along:

| Mailboxes that could not send | Reason |
|---|---|
| 77 | suspended in SmartLead |
| 60 | no Siege campaign yet |
| **36** | **on warmup day 8, and the floor is day 12** |
| 6 | not in the InboxKit warmup list, so its age is unknown |
| 6 | on hold until a date years out |
| 5 | health watch, follow-ups only, waiting out the 48h recovery clock |
| 2 | health stop, score 37 and 37.8 against a floor of 80 |

(A mailbox can carry several reasons, so these sum above the 112 that sat out.)

**The 36 are a timer, four days from lifting themselves.** That also settles a
contradiction: the band gate read 63 clear mailboxes this morning and the plan read 12 live.
Those are two gates measuring two different things. The band gate bands on health; the older
warmup gate in `youtube-email-outreach-v1` suspends on age. **`band_normal` is not sendable
capacity**, and yesterday's "roughly five times the sending capacity" read it as if it were.

Capacity this cycle was 180 messages a day against a 870 ramp, with 104 follow-ups owed. The
real ceiling was 123 slots, and the push used all of them.

## What else the cycle did

**Parked 5 people.** `approved_hold` 7,365 to 7,370. The paid Apify lane has now answered
*no candidates* on **11 consecutive ticks** since 11-02T10:22Z, with **$31.20 of November's
$100 unspent** and $21.20 spendable. Yesterday's fix reports it correctly: `projected_leads`
0, `binding_constraint: candidate_supply`. One real batch ran, scraped 2 channels, recovered
both at $0.07.

**The free recovery lane is picked over, not broken.** Lap 14 of an 1,807-lead book, 4 people
gained an address, `stranded` flat at 3. The pass found 473 contact points and **470 were
already on file**. 37 Brave searches, **0 refusals**, `cause: resolution_ok`. The ownership
gate threw out all 29 candidate sites it found, which is the gate working as designed and not
something Brave credit can change.

**Enrichment is essentially finished:** 3 batches, 4 leads, 0 failures. 99.8% of the pool is
bundled, so there is almost nothing left to enrich. That is why OpenRouter burn collapsed
from $24.17 a day to **$1.98**, and $15.99 now reads as **8.1 days** instead of 0.7.
Yesterday's "don't buy credit yet" held exactly.

**Quiet elsewhere.** $0 Anthropic, no fatal signatures, no halt flag. Discovery stayed at
zero, which is Casey's standing instruction since 2026-09-08. The YouTube key pool reads 15
working of 66, expected and irrelevant while discovery is off.

### The stranded cohort grew to 6, and two of them are being re-planned

`marked_sent_never_emailed` went 4 to 6. The two newcomers (`reckl59GwKZc3zk4I`,
`rectQuC1Y8R24T1w7`) were stamped `sent_to_smartlead` on 10-23, have no send row, and have
been planned **five times** since 10-07.

They were in Monday's plan too, and the approval gate deferred both for tomorrow, correctly,
because the live run rebuilt the plan and nobody had approved them. That corrects something
the published note has said since 10-28: a stamped lead is **not** invisible to Siege's
planner. These two keep getting planned. They just never make the approved sample.

So the whole cohort is six people with verified addresses and finished research who could be
recovered by reverting one stamp, which belongs to the send path and not this repo.

## Shipped this cycle

**The push's loss is joined against the send ledger, and the plan names which gate held each
idle mailbox** (orchestrator `99d48ed`, code in `d8b10ff`).

1. `siegePushOutcome()` now also takes the ids the send ledger says were emailed in the
   window (`sentLeadIdsBetween()` in `src/db.ts`). A lead with a send row was emailed
   whatever the log printed, and `emailed_unlogged` names what the log dropped, which is a
   logging fault in the send path and not a lead problem. **Additive on purpose:** the ledger can only
   move somebody out of the loss, never into it, so a partial read cannot invent one. Null
   when it cannot be read, which is the log-only join that shipped before.
2. `not_live_reasons` rolls up every reason in the plan's own inbox list, largest first, with
   per-mailbox numbers condensed to `N` so one fact about the fleet is one row rather than
   four. That is the 10-12 method-cause lesson applied one level up.

One thing worth recording about the condenser: collapsing digit runs naively rewrote
"on warmup day 8, and the floor is day 12" into "on warmup day N and the floor is day N",
eating the comma. A separator is now dropped only *between* digits. A condenser must not
edit the sentence it condenses.

Verified against the live cycle: the loss went 11 to 5 and now equals Siege's own
`leads.siege_plan` tally, and `people_emailed` equals `sent_elsewhere`. 13 new assertions,
all selftests pass, typecheck clean.

## Ranked levers

1. **Attach Siege campaigns to the 23 idle-but-fit mailboxes.** They were otherwise ready
   and sent nothing. It is setup, not code, and it is the only capacity available before
   Friday.
2. **Wait four days for the 36 warmup mailboxes, and don't read `band_normal` as capacity
   again.** They clear the day-12 floor around 11-06 and lift themselves. No action, just
   don't spend anything trying to speed it up.
3. **Find out why `siege.log` dropped a batch's lines.** Two people were emailed with no
   trace in the file at all. The debrief is now immune to it, but the push log is the only
   record of *what* was sent to each person, and a silent gap there is worse than a
   miscounted loss. It lives in `automator`, which this loop may not edit.
4. **Decide about supply.** Unchanged from yesterday and now a week old: the paid lane has
   tried every qualified lead it has, $21.20 sits unspendable, and the only feed is the
   weekly 3,000-subscriber sweep. Either lift the discovery pause (Casey's call alone) or
   live off the shelf, which at Monday's pace is about seven weeks of first touches.
5. **The two automator repairs are still unshipped** (the `why_no_email()` coercion that cost
   Friday 10-30, and the `list_campaigns()` guard that cost 10-29). Both unchanged for four
   days.

## Grounding and caveats

Numbers from `logs/autopilot-debrief-2026-11-03.json`, regenerated after the fix above so the
push figures are the corrected ones. Read directly rather than inferred: the per-mailbox
reasons (`automator/state/siege/2026-11-02/plan.json`), the six unlogged sends and the
stranded pair (`leads.outreach_sends` and `leads.siege_plan` by hand), and the missing
push-batch block (`automator/logs/siege.log`).

**Not verified:** why the log lost that block (concurrent batches writing one file is the
obvious suspect, unproven); whether the 36 warmup mailboxes clear on schedule; and whether
Monday's tier behaviour repeats, which is what decides if 107 was a turn or a one-off.
