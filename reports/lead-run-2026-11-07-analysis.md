# Lead Run Analysis — 2026-11-07

Cycle: 2026-11-06T08:00:00Z to 2026-11-07T08:00:00Z (the 24h ending at midnight PT, so all
of Friday 6 November Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-07.json`.
Companion to [lead-run-2026-11-07.html](lead-run-2026-11-07.html).

## Headline

**85 people heard from us for the first time ever, 92% of the day's 92 emails.** That is the
third day of the run and the third halving: 313 new people on Wednesday, 191 on Thursday, 85
on Friday. Nothing on the supply side changed. The fleet did.

**Nine more mailboxes stopped being able to send, and they left three at a time.** Live
inboxes went 31 to 22 and daily capacity 465 to 330. Eight of the nine were suspended by
SmartLead with nothing else wrong with them, and they are every address on
`contentgetsclientsvideo.com`, every address on `hicontentgetsclients.com`, and two of three
on `videoleadsagency.com`. Suspension is arriving by domain, not by mailbox.

**The nine people this push "lost" are the same nine it lost yesterday, and the day before.**
`people_lost` read 5, 5, 8, 9, 9 across the five sending cycles since 11-03, which reads as a
small leak growing. It is one cohort of nine, five of whom have now been lost on five
consecutive days. They cost 9 of Friday's 101 slots. Two have channels that no longer exist
on YouTube. Both faults are fixed below.

**Nothing was parked.** Enrichment has nothing left to do at 99.8% bundled, both recovery
lanes are out of people, and the shelf is a fixed 5,048 people ready to write.

## The reach

| | Wed 11-04 | Thu 11-05 | Fri 11-06 |
|---|---|---|---|
| Mailboxes live | 30 | 31 | **22** |
| Messages a day the fleet would accept | 450 | 465 | **330** |
| Follow-ups already owed | 47 | 100 | **154** |
| Slots the plan could offer | 360 | 208 | **101** |
| People emailed | 352 | 199 | **92** |
| **Genuinely new people** (`first_touch_new`) | **313** | **191** | **85** |
| Repeat offers | 38 | 8 | 7 |
| First-touch share | 89.2% | 96.0% | 92.4% |

`first_touch_recovered` is **0**, so none of the 85 is a stranded lead finally flying. 79 of
them came off `approved_hold`, which is the only number that drains the shelf; the other 6
were `review_status = approved`.

The shelf agrees with itself to the person again. `ready_to_write` went 5,127 to **5,048**,
down exactly the 79 shelf first touches, with nobody parked to offset them. People with a
real send row went 2,231 to 2,310, up exactly 79. `marked_sent_never_emailed` held at 1.

**The day-cap is irrelevant and has been all week.** `day_cap` is 870 and the fleet would
take 330, so the warmup ramp is nowhere near binding. The whole of reach is now mailbox
count minus follow-ups owed, and follow-ups owed have gone 47, 100, 154 as Wednesday's and
Thursday's sequences come due.

## Suspension is arriving by domain

Ten mailboxes stopped being live and one started, net minus nine. Joining
`automator/state/siege/2026-11-05/plan.json` against `2026-11-06/plan.json` per address:

| Mailbox | What happened to it |
|---|---|
| 3 on `contentgetsclientsvideo.com` | suspended in SmartLead, nothing else wrong |
| 3 on `hicontentgetsclients.com` | suspended in SmartLead, nothing else wrong |
| `anthonyokon@`, `keithwehner@videoleadsagency.com` | suspended in SmartLead, nothing else wrong |
| `mariobednar@videoleadsagency.com` | health stop, score 66.7, 3 of 45 warmup emails in spam |
| `andreschmitt@ytleadsagency.com` | health watch, 2 of 48 hours clean |
| `percyleffler@videotubeagency.com` | **came back live** |

So three domains lost nine live mailboxes between them, and `videoleadsagency.com` lost all
three of its addresses to two different gates on the same morning. The block that can
actually be recovered, mailboxes held by suspension and nothing else, went **23 to 32** and
is worth **480 messages a day**. Those 32 sit on eleven domains: ten with all three
addresses suspended, one with two.

**Yesterday's fix got its first comparable reading and it was right.** `only_change` shipped
on 11-06, so 11-06 against 11-07 is the first pair that can be subtracted. It published
`suspended in SmartLead` at plus 9 slots while the mailbox count moved plus 16, which is the
real move. Under the old count-only rows the day would have read as sixteen more mailboxes
naming suspension with no way to tell how many of them that cost anything.

### The unreadable-status row answered itself

Yesterday's open question was why seven mailboxes stopped returning a suspension status at
all. The row is now **0**, and per-address it resolved cleanly: six of the seven read
"suspended in SmartLead" plainly today, and the seventh, `percyleffler@videotubeagency.com`,
is the one mailbox that came back live. It was a transient read, and the gap it left in the
picture was one well mailbox out of seven.

### A new row that cost nothing today and matters next week

"SMTP or IMAP failing" went 0 to **9**, and its `only` is **0**: every one of the nine is
already suspended in SmartLead and already missing from the InboxKit warmup list, so none of
them was live yesterday and the row freed or cost no slots. It is three whole domains,
`tubegrowthagency.com`, `ytgrowthagency.com` and `contentgetsleads.com`, three addresses
each.

This is the 11-05 rule doing its job: a row with a big count and `only: 0` is a passenger.
But it changes the top recommendation. Un-suspending those nine would not make them send,
because the connection underneath them is broken.

### Sole-reason table for the 102 mailboxes that sat out

| Mailboxes | Held by it alone | Why it could not send |
|---|---|---|
| 99 | **32** | suspended in SmartLead |
| 37 | 0 | no Siege campaign yet |
| 36 | 0 | on warmup day 12, and the floor is day 14 |
| 30 | 0 | not in the InboxKit warmup list, so its age is unknown |
| 14 | 2 | health watch, follow-ups only, 2 of 48 hours clean |
| 9 | 0 | SMTP or IMAP failing |
| 6 | 0 | on hold until 2036-09-17 |
| 1 | 0 | health stop, score 66.7 under 80 |
| 1 | 0 | domain watch, 2 of 3 on `contentgetssales.com` sick |
| 1 | 0 | domain watch, 2 of 3 on `salesfromcontent.com` sick |

A mailbox can carry several reasons, so the first column sums above 102. The second cannot.
The warmup cohort reads **day 12 of 14** from the plan's own raw string, so it clears Sunday
**11-08** and first sends Monday **11-09**, which is what the last three debriefs predicted.

## The health gate went the other way, and the returners held

| | 11-06 08:05Z | 11-07 08:05Z |
|---|---|---|
| clear (`band_normal`) | 38 | **50** |
| watch | 21 | 10 |
| stop | 35 | 34 |

`band_delta_comparable` is true (24.0h apart). Inside the cycle, **10 mailboxes were handed
the clear band back**, 1 moved to watch, none to stop, and **all 10 returners were still
clear at the final reading with zero round trips**.

**That answers yesterday's second lever.** The 11-06 debrief asked whether Wednesday's
352-email push had cost 15 clear mailboxes. The clear band recovered 12 of the 15 the next
day with no revolving door, which is the 10-27 shape failing to repeat. On the evidence
bands churn on their own, and a big push is not demonstrably what moved them.

**The two instruments still disagree, and the plan is the one that sends.** The band gate
reads 50 clear while Siege's plan reads 22 live. That is the 11-03 lesson: the band gate
scores deliverability, and SmartLead suspension plus the warmup floor are what actually hold
the fleet. `band_normal` is not sendable capacity and never has been.

`band_held_but_healthy` is **11**, every one of them waiting out the 48-hour clean clock with
the closest due within the hour, and none held for a sick sibling. So about 11 mailboxes
return for free.

## The push, and the cohort of nine

Approved at 11:29:41Z, sends ran 11:32:55Z to 12:10:29Z, 38 minutes for 101 planned people.

| | |
|---|---|
| Planned | 101 |
| Approved (what the push was asked for) | 101 |
| Deferred unapproved | 0 |
| People emailed | 92 |
| **People lost** | **9** |
| `emailed_unlogged` | **0** |

**The push log was clean for the first time in five cycles.** It holds exactly 92 `SENT`
lines against 92 people with a send row. The four cycles before this dropped 6, 1, 34 and 6.

**And the nine lost people are one standing cohort, not a daily leak.** Every id in today's
list was in yesterday's. Five of the nine have been lost on all five sending days since
11-03, and the distinct count across the whole run never exceeded nine, while the published
figure climbed 5, 5, 8, 9, 9. Five debriefs read one stuck group as fresh damage each
morning. Named, with what is really wrong:

| People | What stops them | Fixable where |
|---|---|---|
| 5 | SmartLead refuses the lead, `bounce_count=1`: a bounce already on its file | the send path, `automator` |
| 2 | the research stage cannot build a bundle: **their YouTube channels no longer exist** | **fixed today**, email repo |
| 1 | the writers produced no draft, twice: no clean job title, then an em dash outside the sign-off | the two skills |
| 1 | the log never mentions them at all | unexplained |

The two dead channels are `recYIzI1wmtvWAfyc` (GET CUT WITH GLASS,
`UCxqnDDWY7fzzx5ypqZW2PKg`) and `recztuJgfiqZFBpQC` (Andrew Hiller,
`UCeKKrZ5GnBXRwnKlrixiREQ`). Each morning their enrichment runs for about a second, throws
`No channel found for id=...` out of `quick-youtube-channel-research-v1`, and the pipeline
tries again the next day because `failed` is non-terminal by design.

The genuinely silent one, `rec1c1JQlMsCrvC7b` (Bookkeeping Expert, Zach Pasquariello), is a
repeat offer to somebody last contacted 2026-05-28. The research step logged "already at
`sent_to_smartlead`, skipping" and nothing else in the run mentions them, so a draft was
never written and the push never saw them.

Refusal reasons, ranked by the people each really cost, with the two new rows this morning's
fix adds:

| Reason | Drafts | People lost |
|---|---|---|
| SmartLead did not add the lead (`bounce_count=1`) | 5 | **5** |
| the research stage could not build a bundle | 2 | **2** |
| no draft was written: business owner (no clean job title exists) | 1 | **1** |
| is absent from this batch's Siege manifest | 1 | 0 |

## Supply: everything is out of people

| | This cycle | Prior 7 days |
|---|---|---|
| Parked into `approved_hold` | **0** | 288 on 11-02 alone |
| Free lane contact points | 3 | 79 |
| Free lane email points | 1 | 24 |
| Free lane people with a new address | 1 | — |
| Paid Apify batches | 0 | 6 on 11-02 |
| Enrichment leads done | **0** | 343 on 11-02 |

- **Paid lane:** dry on **59 consecutive ticks** since 2026-11-02T10:22:57Z, 12 idle batches
  this cycle, `$31.20` of November's allowance unspent and `$21.20` spendable.
  `projection.projected_leads` is a measured **0** with `binding_constraint:
  candidate_supply`. Money buys nothing here.
- **Free lane:** lap 15 of an 1,800-lead book, `stranded` 3 and flat, so no selector gap.
  The newest judged pass walked 150 leads, found **590 contact methods and 588 of them were
  already on file**. That is a full re-walk of a picked-over book, which is not a fault.
- **Enrichment:** zero batches, because 7,359 of 7,372 leads are bundled.

Website resolution is healthy this time, unlike Thursday's 93% no-site pass: `cause` is
`resolution_ok`, 4 of 150 leads had no site, and only **6** Brave searches ran at all
because 146 of the 150 already had a site on file. Zero refusals, zero errors.

The largest method fault is `cross-domain redirect` at **56 of 145 errors (39%)**, spread
across five methods, with 25 of them in `28-sitemap`. Coverage of the roll-up is 65%, so
that is a lower bound.

## The queue is now deeper in days than it was when it was bigger

`waiting_for_a_slot` is **1,784** (984 whale, 548 strong7, 252 other7), down from 1,860. At
101 slots a day that is **18 days deep**, against nine days at 208 slots yesterday. The
queue shrank and got further away.

The top two tiers asked for 11 slots again, exactly as yesterday, but out of 101 instead of
208, so the fixed cost of re-offers doubled as a share of the day (5.3% to 10.9%). 90 of the
101 still went to the never-emailed tier. Repeat offers remain a small fixed cost that does
not grow with capacity.

**One number worth watching that nothing has flagged yet.** Siege's own book holds 1,139
never-emailed people, 866 with a verified address, but only **342 ready today** and 339 with
a research bundle, against 5,048 on the shelf. At 90 first touches a day that ready queue is
under four days deep. So next week the thing sizing first touches may be whatever moves a
shelf lead into Siege's book rather than the shelf itself. Not verified: that intake rule
lives in `automator` and was not read this morning.

## Money and quiet

- OpenRouter: **$1.44/day**, balance **$9.56**, which reads as 6.6 days of runway at $0.091
  per enriched lead over 543 leads in a 7-day window. The burn is falling as enrichment
  finishes ($1.64/day yesterday), so this should not empty. **No reason to buy credit.**
- Anthropic: **$0**, against a $75 soft ceiling.
- 0 fatal error signatures, no halt flag, no escalations.
- YouTube key pool: 15 working of 66 probed, 50 still quota-exhausted after the midnight
  reset. Expected, settled, and irrelevant while discovery is off.
- Discovery: **0 new channels**, Casey's standing order of 2026-09-08. Every sweep idle by
  design, the campaign block all zeros.
- `npm run send` fired 0 leads, correctly: the send path is Siege, not this repo.

## Fixes shipped this cycle

**`856b22e` (orchestrator) — a loss the log explained before the push is no longer a silent
one.**

Every counter in the loss split reads the push's own verdicts, so a planned person the push
was never handed printed nothing any of them matched and fell into `lost_silently`, a field
whose whole meaning is that the log said nothing about them. On 11-06 the log said plenty
about three of the four. Two shapes were unreadable:

- `| [FAILED            ] GET CUT WITH GLASS → recYIzI1wmtvWAfyc__GET_CUT_WITH_GLASS.md`,
  the research stage giving up on a bundle;
- `|   recYZCjHSZnKslfkq        failed   em-dash: em or en dash outside the sign-off`, a
  writer that produced nothing, in lowercase, which the `FAIL` matcher cannot see.

That is the 10-09 lesson (a reason sitting in the log with no counter able to read it) one
stage earlier. `lost_before_push` is now that group, each of them earns a row in `reasons`,
and `lost_silently` means what it says. The lines are read only for people the join already
found lost and never into `failed` or `skipped`, so like the ledger join this can only move
somebody out of a worse answer. Re-run against the live 11-06 log: 9 lost splits 5 refused,
3 explained before the push, 1 genuinely silent.

**`6b80846` (orchestrator) — a push loss says whether it is new people or the same cohort
again.**

`people_lost` cannot say whether the people it counts are new, and for five cycles it did
not. `lostCohort()` joins today's named losses against the snapshots this script wrote on
the previous 14 days, newest first, stepping over weekends and missed cycles rather than
counting them as clear days. It publishes `lost_recurring`, `lost_new`,
`lost_longest_streak` and `lost_recurring_ids`. Read against the real snapshots this morning
it returns 9 recurring, **0 new**, longest streak **5**. A streak climbing by one a morning
names somebody no push will ever send, which is a reason to stop planning them rather than
to re-count them. Measured over `lost_ids`, which is capped at 12, so a day losing more than
that reports a lower bound; null, not 0, when no earlier snapshot carries a readable list.

**`b3e16f527` (youtube-email-outreach-v1) — a lead whose YouTube channel no longer exists
stops being re-driven every cycle.**

`failed` is deliberately non-terminal across this pipeline because nearly every failure is
transient. One shape is not: when YouTube answers a `channels.list` for a known id with an
empty list, the channel has been deleted or terminated, and
`quick-youtube-channel-research-v1` throws `No channel found for id=<id>`. Nothing was
stopping the retries, so two leads burned a planned slot each on every sending day from
11-03 to 11-07 and the debrief counted them as losses with no reason.

`channelIsGone()` now lives in `src/cli/stage-gate.ts` beside the rest of the status gating,
and a gate directly under the do-not-contact gate skips those leads with a named log line
before find, verify or enrich spends anything. It reads the persisted `outreach_error`, which
already holds the message verbatim, so it works on the four leads that have already failed
and needs no migration. It writes nothing and changes no status. `--retry-dead-channel`
forces the attempt anyway, the same unlock shape as `--retry-no-email`, which is how a
channel that comes back is picked up again.

Verified: typecheck clean in both repos, 323 orchestrator selftest assertions pass with 11
new ones, 16 `stage-gate` vitest cases pass with 4 new ones, and the predicate returns true
against the exact string persisted on `recYIzI1wmtvWAfyc`.

## Still open

- **The five bounce refusals.** Five people with a bounce already on SmartLead's file are
  planned, written to and refused every single sending day. The repair is in the send path:
  either `dnc-sync` should be picking those bounces up, or the plan should not offer a lead
  SmartLead has already bounced. Lives in `automator`.
- **One writer-blocked person.** `recYZCjHSZnKslfkq` has been unwritable for days: the
  save-time skill finds no clean job title and the voice-objection fallback keeps putting an
  em dash outside the sign-off. Two skills, one lead, every morning.
- **Why nine mailboxes are failing SMTP or IMAP.** New shape, three whole domains, and it
  blocks them as completely as the suspension does.
- **Why SmartLead is suspending whole domains.** Still unexplained, still the top lever, and
  now visibly arriving three addresses at a time.
- **`recPSkSNP2HeR6CCV`** is still stamped as sent and has never been emailed, now through
  three more sending days.
- **The two `automator` repairs, unshipped eight days.** Read out of the code again this
  morning: `why_no_email()` still joins its `fails` list with no coercion
  (`scripts/siege-plan.py:1301`), and `list_campaigns()` still returns `[]` on any failed
  SmartLead read while `list_accounts()` a few lines below it is guarded
  (`scripts/smartlead_api.py:292`).

## Ranked levers

1. **Find out why SmartLead suspends whole domains, starting with the three that fell this
   week.** 32 mailboxes are held by suspension and nothing else, worth about 480 messages a
   day, and the block grew by nine in one cycle. Every one of them arrived as a complete
   domain, which points at the domain and not the mailbox.
2. **Fix SMTP or IMAP on `tubegrowthagency.com`, `ytgrowthagency.com` and
   `contentgetsleads.com` before un-suspending anything there.** Nine mailboxes would come
   off suspension and still not send. This is a correction to yesterday's number-one lever:
   nine of the suspended set have a second, invisible fault.
3. **Plan Monday 2026-11-09 as two events.** The 36 warmup mailboxes clear Sunday and can
   first carry an email Monday, worth about 540 more messages a day. The day-4 and day-10
   follow-up bills for Wednesday's 352 and Thursday's 199 land in the same window.
   Follow-ups owed have gone 47, 100, 154 already.
4. **Decide about supply.** Unchanged and now at zero: nothing was parked, enrichment is
   finished, both recovery lanes are out of people, and the shelf is 5,048 draining at 92 to
   352 a day. Lifting the 2026-09-08 discovery pause is Casey's call alone.
5. **Stop planning the five bounced people.** They have cost five slots a day for five days
   and will keep doing it. The fix is one filter in the send path.
6. **Check what moves a shelf lead into Siege's book.** The never-emailed tier has 342 ready
   against 5,048 on the shelf, which is under four days at the current rate, so this may
   bind before the shelf does.
7. **Ship the two `automator` repairs.** Eight days now. Each has already cost one whole
   sending day.
