# Lead Run Analysis — 2026-10-29

Cycle: 2026-10-28 00:00 to 24:00 PT (Wednesday). Grounded in
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-29.json`, the band gate's own
run history and per-mailbox map in `automator/state/inbox-health.json`,
`automator/logs/inbox-health.log`, and direct queries against `leads.lead_candidates`,
`leads.outreach_sends` and `leads.siege_plan`.

## Headline

**The snapshot opened with the best first-touch day of the month, and it was one new person.**
`first_touch` read **52 of 144 people, 36.1%**, against 19 of 505 over the prior seven days
(3.8%). A nine-fold jump in reach is the one thing the 10-15 note said to watch for, because
reach is what the Whale re-offer queue has been blocking since 10-13.

It was not reach. **Fifty-one of the 52 were the stranded cohort yesterday's debrief found.**
Those people were stamped `sent_to_smartlead` on 2026-10-13, the ICP audit paused their live
SmartLead sequences that afternoon, and so acceptance was credited while no email ever went
out. The send path reverted the stamp inside one cycle and 50 of them flew, **exactly the
repair yesterday asked for, and the right outcome.** But the re-push overwrites
`outreach_processed_at`, so every one of them now carries a 10-28 stamp and nothing in the row
says they are fifteen days old.

The honest reading: **1 genuinely new person this cycle, and 5 across the eight days ending
with it.** A 36.1% day and a 3.8% week describe the same starvation.

**Second finding: the clean domain singled out yesterday as the honest test of the recovery
clock failed it within hours of carrying traffic**, and it failed for a reason that is in the
slot arithmetic rather than in the domain.

## The first-touch surge was a backlog

I could not tell a drained backlog from new supply out of the published fields, so I joined
`leads.siege_plan` by hand:

| Measure | This cycle | Prior 7 days |
|---|---|---|
| People emailed | 144 | 505 |
| First touches | 52 (36.1%) | 19 (3.8%) |
| …already pushed on an earlier day | **51** | **15** |
| …never planned before | **1** | **4** |
| Oldest backlog day behind them | 2026-10-13 | — |

Fifty of the 51 sit in `siege_plan` under `run_day` 2026-10-13 already marked `pushed`. All 51
first-emailed people now show an `outreach_processed_at` of 2026-10-28, so the stamp carries no
trace of the original push.

### Verified, not inferred

- All 52 people first-emailed in the cycle carry a 10-28 stamp (`outreach_processed_at::date`).
- Every send-ledger row written in the cycle belongs to a 10-28-stamped lead, so the cohort
  was **re-stamped**, not emailed under its old stamp.
- 50 of the 51 shelf first touches appear in `siege_plan` at `run_day` 2026-10-13, `pushed`.
- The shelf's own arithmetic agrees: `emailed` went 1,613 → **1,664** (+51) while the stamp went
  1,667 → **1,668** (+1), so `marked_sent_never_emailed` fell 54 → **4**, which is exactly
  54 + 1 − 51.
- The four left stranded are stamped 10-13 (×3) and 10-07 (×1).
- The 718 `rejected` rows dated 10-13 were written **on 10-13**, not this cycle, so
  `bulk_status_writes: []` is correct and no bulk rewrite was missed.

### Correction to yesterday

Yesterday's debrief said the 10-13 record push "reached at most 728 people" of the 782 it
pushed. Re-measured now that the cohort has flown: **779 of 782 have a send-ledger row.** The
54 were a fifteen-day delay, not 54 lost people. That is a better outcome than yesterday
recorded, and it matters before anyone re-plans that cohort.

### Shipped

Orchestrator `826e2bd`. `countFirstTouchBetween()` now carries `first_touch_recovered`,
`first_touch_new`, `first_touch_recovered_oldest_day` and the same split over the prior seven
days. A person counts as recovered only on a `pushed` `siege_plan` row **strictly before the
day of their own first send**, keyed off the send's own date rather than the window, so a plan
from earlier the same morning is not mistaken for a backlog and a window straddling midnight
stays right. It is a separate statement from the counts it annotates and fail-soft at the call
site: `siege_plan` belongs to `automator`, so a rename costs these five fields and never
`first_touch` itself, and all five are null rather than 0 when it cannot be read. The
classification is a pure `recoveredTally()` so the boundary rule can be asserted without a
database. 4 regression assertions, 233 green, typecheck clean, live query renders 52 / 51 / 1
/ 2026-10-13, matching the hand join exactly.

## The fleet, and why a clean mailbox broke

`ytgrowthagency.com` was yesterday's named test: **0 spam across 82 warmup emails**, all three
mailboxes at 96.7, held only by the 48-hour recovery clock and the sick-sibling rule. All three
returned to clear this cycle. By evening all three were stopped again.

| Mailbox | Yesterday | Emails carried | Stopped at | Now |
|---|---|---|---|---|
| `malcolmwatsica@ytgrowthagency.com` | 96.7, clean | **15** | 18:05Z | 69.7, 3 spam of 27 |
| `danflatley@ytgrowthagency.com` | 96.7, clean | **15** | 22:06Z | 69.7, 3 spam of 49 |
| `jermainemohr@ytgrowthagency.com` | 96.7, clean | **14** | 18:05Z | 65.9, 3 spam of 31 |

Those were the three largest per-mailbox loads in the whole push, against a 4-to-8 typical. The
provider cut warmup volume 30% on all three today.

### The mechanism is the slot remainder

A mailbox's slots are its daily allowance **minus the follow-ups it already owes**. A mailbox
just back from a 48-hour suspension owes none, so it gets the **biggest remainder in the
fleet**: a full load on its first day back, with no ramp. The gate then reads the spam that
load produces and stops it again.

That is the revolving door, and it is mechanical rather than bad luck: 4 of 5 returners
round-tripped inside the cycle, and `band_held_but_healthy` fell from 8 to **1**, so capacity
no longer returns for free.

Both numbers behind it are config in `automator`: `siege.fill_slots` for the allocation,
`config/inbox-health.json` for `recover.hours: 48` and `stop.spam_hits: 2`. Outside the five
repos, so this is reported and not shipped. It is the fix the 10-27 debrief asked for ("return
a mailbox at a fraction of its allowance first"), now with a measured mechanism.

Worth noting on `stop.spam_hits: 2`: the test is a raw count over three days, so it is
volume-blind. Two spam hits out of 27 warmup emails and two out of 51 are treated identically,
which penalises the mailboxes warming up fastest.

### The clean group is not stable either

| Group | Domains | Mailboxes | Clear | Stopped |
|---|---|---|---|---|
| Clean | 5 | 13 | **12** | 0 |
| Burned | 15 | 45 | 0 | **45** |

Yesterday this was six domains and 14 clear. `meetcontentgetsclients.com` lost all three
mailboxes this cycle: 4–5 spam of 43–45, scores 48.7 / 57.7 / 61.0, with provider cuts of 30%
to 50% and two flagged CRITICAL at 58% and 61% spam rates. Its three mailboxes carried 8, 7 and
6 emails in the push, so load alone does not separate it from the survivors; `ytgrowthagency`
at 15/15/14 is the clear outlier.

Hour by hour: **14 → 18 (08:05Z) → 19 (10:05Z)**, push at 10:18–10:38Z, then **15 (15:05Z) →
12 (16:05Z)** and flat at 12 for the last seventeen readings. The fleet peaked at the moment it
was used and closed below where it opened. `band_peak_normal: 19`, `band_returned_still_normal:
1`, `band_round_trips: 4`.

## Sending

Clean push. **146 planned, 146 approved, 145 sent, 1 lost**. SmartLead refused it with
`bounce_count=1`. No skips, no deferrals, no rate limiting.

Every one of the 146 rows was tier `strong7`. **Only 99 `strong7` people remain waiting**,
against 965 whales and 830 `other7` of 1,894 total. The tier that carried this cycle is about
one day from empty, so the next plan either re-offers to whales or opens `other7`.

Capacity: 19 live inboxes, **285 emails/day**, against an 870 warmup allowance and 123
follow-ups due. The allowance is not the ceiling; the mailboxes are.

## Everything else

- **Parked +1.** `approved_hold` 6,826, `needs_contact` 3,428. Shelf **5,148 ready to write**,
  1,668 stamped, **1,664 really emailed**, 4 stranded, 99.9% bundled.
- **Recovery lane near-zero, and not a fault.** 7 contact points / 2 addresses / 2 people
  against 94 / 21 over the prior week. Newest judged pass: 150 leads, 128 no site (85.3%),
  `cause: ownership_gate`. **134 Brave searches, 0 refusals, 103 candidates, 97 refused by the
  gate.** 201 methods found, **200 already on file**, a full re-walk of lap 12 of a 2,392-lead
  book. `stranded` flat at 3. Credit cannot buy past an identity gate.
- **Top error cause is a content outcome**, not a fault: `34-channel-page: page rendered with no
  outbound links`, 52 of 115 (45%), which is that method correctly reporting creators with no
  links. Top real fault is `17-podcast: iTunes` at 28 (24%), the per-IP brake built on 10-15
  giving up as designed, on a method with no points in 13 days. Checked the code and left it
  alone.
- **Enrichment 2 batches / 2 leads.** Correct: ten leads left unbundled.
- **Money.** $0 Anthropic. OpenRouter $1.70/day, **$61.99** left, 36.5 days, $0.1678 per
  enriched lead. Apify at its $10 reserve (spendable −$0.0003) until the **11-01** refill.
- **YouTube keys 15 working of 66**, 50 still exhausted after the reset. Settled 2026-09-16 (the
  quota was cut) and irrelevant while discovery is off.
- **0 fatal signatures, no halt, 0 new channels** by Casey's 2026-09-08 order. The campaign loop
  is stopped and was left that way.
- **Six dated metric files still have no debrief**: 2026-09-17/18/19, 08-17/18, 07-11.

## Recommended next, ranked

1. **Ramp a returning mailbox instead of handing it a full load.** Highest leverage, config
   only, and the mechanism is now measured. Cap the first day or two back at a fraction of the
   allowance. `siege.fill_slots` in `automator`, outside the five repos.
2. **Buy new sending domains, and expect them to burn the same way without #1.** 5 clean
   domains / 12 clear mailboxes against 15 / 45 stopped, and a whole clean domain fell this
   cycle.
3. **Decide where tomorrow's volume comes from** before the snapshot decides it: `strong7` is
   down to 99 waiting after a 146-row all-`strong7` plan.
4. **Add a first-touch term to the slot order.** Five genuinely new people in eight days is the
   real reach number and it is now published. The shelf holds 5,148 people never written to and
   nothing drains it.
5. **Leave the recovery lane alone** until Apify refills on 11-01 (~700 leads at $0.115, with
   ~$100 of OpenRouter behind them against $61.99). Lap 12 with 200 of 201 methods already on
   file is a picked-over book, not a broken lane.
