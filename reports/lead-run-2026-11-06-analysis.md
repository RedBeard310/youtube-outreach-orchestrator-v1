# Lead Run Analysis — 2026-11-06

Cycle: 2026-11-05T08:00:00Z to 2026-11-06T08:00:00Z (the 24h ending at midnight PT, so all
of Thursday 5 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-06.json`.
Companion to [lead-run-2026-11-06.html](lead-run-2026-11-06.html).

## Headline

**191 people heard from us for the first time ever, 96% of the day's 199 emails.** It is the
second-biggest reach day the pipeline has had, behind yesterday's 313. Across the two days
together it has reached **504 new people**, against 9 in the six days before them. The prior
week's 429 first touches are, in fact, just three days: 107 on 11-03, 9 on 11-04 and 313 on
11-05.

**Wednesday's turn was not a one-off, and it was not a second lucky break either.** Nothing
was found and nothing was bought. The fleet gained one mailbox and 15 messages of capacity.
Slots fell 360 to 208, emails tracked slots and new people tracked emails. Reach is now a
function of fleet size and nothing else.

**The one piece of fleet news that looked good was false, and this report's own instrument
was about to publish it.** "Suspended in SmartLead" fell from 90 mailboxes to 83 while a new
row, "SmartLead did not return its suspension status", arrived at 7. Not one of the 90 was
live a day later. Six were relabelled into the new row and one into a health stop. Fixed and
committed.

**One person was parked.** Both recovery lanes are out of people, enrichment has nothing
left to do at 99.8% bundled, and the shelf is a fixed 5,127 draining at up to 275 a day.
That is three to four weeks, and the supply decision is now the clock.

## The reach

| | Wed 11-04 plan | Thu 11-05 plan |
|---|---|---|
| Mailboxes live | 30 | 31 |
| Messages a day the fleet would accept | 450 | 465 |
| Follow-ups already owed | 47 | 100 |
| Slots the plan could offer | 360 | 208 |
| People emailed | 352 | 199 |
| First touches | 314 | 191 |
| **Genuinely new people** (`first_touch_new`) | **313** | **191** |
| Repeat offers | 38 | 8 |
| First-touch share | 89.2% | 96.0% |

`first_touch_recovered` is **0**, so none of the 191 is a stranded lead finally flying. All
191 had never been planned before. 173 of them came off `approved_hold`, which is the only
number that drains the shelf; the other 18 were `review_status = approved`.

The shelf agrees with itself to the person. `ready_to_write` went 5,299 to **5,127**, down
172, which is the 173 shelf first touches less the one person parked during the cycle.
People with a real send row went 2,058 to 2,231, up exactly 173. `marked_sent_never_emailed`
held at 1.

## The repeat-offer question is now settled

Three debriefs argued about whether the top tiers' re-offer queue was crowding new people
out. It was not, and today is the third reading in a row that says so.

| Tier | Slots it asked for, 11-04 | Slots it asked for, 11-05 |
|---|---|---|
| whale | 2 | 2 |
| strong7 | 27 | 9 |
| other7 (never emailed) | 331 | 197 |

The top two tiers wanted 29 slots of 360 yesterday and **11 of 208** today. Repeat offers
were 8 of 199 emails against 38 of 352. It is a small fixed daily cost that does not grow to
fill extra capacity. Behind it, `waiting_for_a_slot` is 1,860 (983 whale, 538 strong7, 339
other7), down from 2,037. At 208 slots a day that queue is nine days deep, so for the first
time the fleet and the queue are roughly the same size.

## Why there were 208 slots and not 360

Wednesday's own bill started arriving. Every offer is a three-email sequence on days 0, 4 and
10, and SmartLead sends Monday to Thursday, so a big first-touch day mortgages the following
week.

- Follow-ups owed went **47 to 100** in a day.
- `mailbox_capacity` is 465 a day and `day_cap` (the warmup ramp) is 870, so the fleet is the
  ceiling, not the ramp.
- The **day-4 bill for Wednesday's 352 emails lands Monday 2026-11-09**, which is also the
  day the 36 warmup mailboxes clear.

Monday is therefore the biggest capacity gain and the biggest follow-up bill of the run at
the same time. Expect the slot count to come in well under what capacity suggests.

## The seven mailboxes that did not come back

The published change rows for the fleet read:

| Reason | Mailboxes | Prev | Change |
|---|---|---|---|
| SmartLead did not return its suspension status | 7 | 0 | +7 |
| suspended in SmartLead | 83 | 90 | -7 |
| health watch, follow-ups only (recovering) | 11 | 6 | +5 |
| no Siege campaign yet | 37 | 39 | -2 |

Read as mailbox counts that is seven released from suspension. Joining
`automator/state/siege/2026-11-04/plan.json` against `2026-11-05/plan.json` per address:

- **0 of the 90 mailboxes suspended on Wednesday was live on Thursday.**
- 0 joined the suspended row.
- 6 of the 7 that left it now carry "SmartLead did not return its suspension status"
  (`owenhansen@ytgetsclients.com`, `neilgoldner@tubegrowthagency.com`,
  `nathanturner@tubeleadsagency.com` and three `casey.brown@` addresses).
- The 7th, `casey.brown@startcontentgetsclients.com`, is now a health stop at score 46.8
  with 8 of 11 warmup emails in spam.
- The 7th row in the new reason is a mailbox that was not in Wednesday's plan at all.

So the recoverable block, mailboxes held by suspension and nothing else, went **24 to 23**.
The published rows said plus and minus seven about a day that freed one slot in the wrong
direction.

## Sole-reason table for the 93 mailboxes that sat out

| Mailboxes | Held by it alone | Why it could not send |
|---|---|---|
| 83 | **23** | suspended in SmartLead |
| 37 | 0 | no Siege campaign yet |
| 36 | 0 | on warmup day 11, and the floor is day 14 |
| 30 | 0 | not in the InboxKit warmup list, so its age is unknown |
| 11 | 1 | health watch, follow-ups only, 26 of 48 hours clean |
| 7 | 1 | SmartLead did not return its suspension status |
| 6 | 0 | on hold until 2036-09-17 |
| 1 | 0 | health stop, score 46.8 under 80 |
| 1 | 0 | domain watch, 2 of 3 on `contentgetssales.com` sick |
| 1 | 0 | domain watch, 2 of 3 on `tubegetssales.com` sick |

A mailbox can carry several reasons, so the first column sums above 93. The second cannot.
The warmup cohort reads **day 11 of 14** for a third consecutive day, on course to clear
Sunday 11-08 and first send Monday 11-09.

## The health gate took a bite

| | 11-05 08:05Z | 11-06 08:05Z |
|---|---|---|
| clear (`band_normal`) | 53 | **38** |
| watch | 16 | 21 |
| stop | 25 | 35 |

`band_delta_comparable` is true (24.0h apart). Inside the cycle, 16 mailboxes moved to watch,
10 to stop and 2 back to clear; both returners held, and there were no round trips. It peaked
at **55 clear at 09:05Z**, an hour before the push, and finished at 38.

This is the shape of 2026-10-14, the morning after the record 782-email day, when the old
gate pulled 13 mailboxes on health alone. Stated carefully: bands churn on their own, and the
gate has also pulled mailboxes after zero-send weekends, so a 15-mailbox fall beside a
352-email push is a question worth asking the same morning, not a proof. It is now the second
time the pattern has appeared.

`band_held_but_healthy` is **17**: 12 waiting out the 48-hour clean clock with the closest due
within the hour, and 5 held only because other addresses on their domain are sick. So about
12 mailboxes return for free, and the question is whether the next big push puts them back.

## The push

Approved at 11:24:22Z, ran 11:25:04Z to 12:06:53Z, 42 minutes for 208 planned people.

| | |
|---|---|
| Planned | 208 |
| **Approved (what the push was asked for)** | **216** |
| Deferred unapproved | 0 |
| People emailed | 199 |
| **People lost** | **9** |
| lost to a SmartLead refusal | 5 |
| lost to a skip | 0 |
| lost silently | 4 |
| `emailed_unlogged` | 6 |

Refusal reasons, ranked by the people each really cost:

| Reason | Drafts | People lost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 5 | **5** |
| is absent from this batch's Siege manifest | 30 | **0** |

**Yesterday's loss-ranking fix got its first live cycle right.** The 30-draft manifest row
would have topped a line-count ordering for a second day, and it cost nobody: 26 of the skips
were re-written and sent in the same run and 1 was never planned. The wasted writing was 18
save-time, 8 voice-objection and 4 love-your-channel drafts. The row worth chasing, the
5-lead bounce refusal, is where the real loss is.

The push log dropped 6 sends again. That is 6, then 1, then 34, now 6 across four cycles.
Counting is safe because the join reads `leads.outreach_sends` as well, but for those 6
people there is no log line recording what they were sent.

## Supply: both lanes are out of people

| | This cycle | Prior 7 days |
|---|---|---|
| Parked into `approved_hold` | **1** | 288 on 11-02 alone |
| Free lane contact points | 13 | 78 |
| Free lane email points | 2 | 23 |
| Free lane people with a new address | 2 | — |
| Paid Apify batches | 0 | 6 on 11-02 |
| Enrichment leads done | 1 | 343 on 11-02 |

- **Paid lane:** dry on **47 consecutive ticks** since 2026-11-02T10:22:57Z, 12 idle batches
  this cycle, `$31.20` of the November allowance unspent and `$21.20` spendable.
  `projection.projected_leads` is a measured **0** with `binding_constraint:
  candidate_supply`. Money cannot buy leads here.
- **Free lane:** lap 14 of a 1,801-lead book, `stranded` 3 (flat, so no selector gap). The
  newest judged pass walked 150 leads, found 96 contact methods and **all 96 were already on
  file**.
- **Enrichment:** 1 batch, 1 lead, 0 failed, because the pool is 99.8% bundled.

### The 93% no-site pass is the ownership gate, not Brave

Website resolution went from 2 leads of 150 with no site on Wednesday to **140 of 150**
today. It is not a credit problem:

| | |
|---|---|
| Brave searches | 150 |
| Brave refusals / errored searches | **0 / 0** |
| Candidate sites found | 125 |
| Accepted | 10 |
| **Thrown out by the ownership gate** | **115** |
| `cause` | `ownership_gate` |

The gate refuses a site it cannot tie to that creator, which is deliberate since the
2026-08-18 audit. No amount of search credit changes the number. The largest method cause,
"34-channel-page: page rendered with no outbound links" at 74 of 84 errors, is a content
outcome, and `top_method_fault_cause` is a real but tiny 4 aborted sub-page fetches.

## Money and quiet

- OpenRouter: **$1.64/day**, balance **$11.00**, reads as 6.7 days of runway at
  $0.0911 per enriched lead measured over 543 leads in a 7-day window. With nothing left to
  enrich, that burn should fall rather than empty the balance. **No reason to buy credit.**
- Anthropic: **$0**, against a $75 soft ceiling.
- 0 fatal error signatures, no halt flag, no escalations.
- YouTube key pool: 15 working of 66 probed, 50 still quota-exhausted after the midnight
  reset. Expected, settled, and irrelevant while discovery is off.
- Discovery: **0 new channels**, Casey's standing order of 2026-09-08. Every sweep idle by
  design; the campaign block is all zeros.
- `npm run send` fired 0 leads, correctly: the send path is Siege, not this repo.

## Fixes shipped this cycle

**`661e439` (orchestrator) — a fleet reason row that moved carries the slots it moved.**

The change rows shipped on 11-04 carrying a mailbox `count` alone, one day before `only`
joined the rows they are built from. So the field a reader opens to see *which gate moved*
re-introduced the exact fault `only` exists to close, which is the 10-29 rule (read how many
mailboxes carry a reason **alone**, never how many name it) one level up.

What changed in `notLiveReasonMoves()`:

- every row carries `only`, `only_prev` and `only_change`;
- the ranking prefers the move in `only` whenever **any** row can supply one, and falls back
  to `count` otherwise rather than mixing the two, so a known small slot move cannot sort
  under an unknown large count move;
- a row whose `count` held steady while the mailboxes it holds alone moved is now published,
  because that is a real move in slots;
- `only_prev` is **null**, not 0, for a row a pre-11-06 snapshot wrote without the field
  (unknown, not measured-as-nothing), while a row absent from a snapshot held nobody alone
  there and is a real 0. The first fully comparable pair is 11-06 against 11-07.
- `priorSendPlan()` parses `only` out of the prior snapshot, and the field note carries the
  11-06 lesson: a negative `change` beside a flat `only_change` is a relabelling, so read
  `live_inboxes_change` beside it before calling it freed capacity.

Verified: typecheck clean, 312 selftest assertions pass with 4 new ones, including the live
11-04 against 11-05 shape, which now ranks the +1 slot move above the -7 mailbox move.

## Still open

- **The push log keeps dropping sends.** Four cycles: 6, 1, 34, 6. Lives in `automator`.
- **Nine people lost of 216**, 5 to a bounce already on file and 4 with nothing said.
- **`recPSkSNP2HeR6CCV`** is still stamped as sent and has never been emailed, now through
  two more sending days.
- **The two `automator` repairs, unshipped seven days.** Read out of the code this morning:
  `why_no_email()` still joins its `fails` list with no coercion
  (`scripts/siege-plan.py:1301`), and `list_campaigns()` still returns `[]` on any failed
  SmartLead read while `list_accounts()` a few lines below it is guarded
  (`scripts/smartlead_api.py:292`).
- **Why seven mailboxes stopped returning a suspension status at all.** New shape, and it
  blocks them just as completely as a suspension does.

## Ranked levers

1. **Un-suspend the 23 mailboxes SmartLead holds and nothing else does.** Still the fleet's
   whole recoverable capacity, roughly 345 slots at 15 messages a mailbox a day, and almost
   unchanged after a day whose headline row claimed seven came back.
2. **Ask whether Wednesday's 352-email push cost 15 clear mailboxes, and pace the pushes if
   it did.** Second appearance of the pattern. 12 of the 17 held-but-healthy lift themselves.
3. **Plan Monday 2026-11-09 as two events.** The 36 warmup mailboxes clear (about 540 more
   messages a day) and Wednesday's day-4 follow-up bill lands on the same day.
4. **Decide about supply.** Unchanged and more urgent: shelf 5,127, three to four weeks, both
   lanes out of people, money buys nothing. Lifting the 2026-09-08 pause is Casey's call
   alone.
5. **Find out why the push log keeps losing sends.** Counting is safe, the audit trail is not.
6. **Ship the two `automator` repairs.** Each has cost a whole sending day once, and a
   sending day is now worth two hundred people.
