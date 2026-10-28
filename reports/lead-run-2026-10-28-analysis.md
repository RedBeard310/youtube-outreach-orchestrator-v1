# Lead Run Analysis — 2026-10-28

Cycle: 2026-10-27 00:00 to 24:00 PT (Tuesday). Grounded in
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-28.json`, the health gate's
own run history and per-mailbox map in `automator/state/inbox-health.json`, direct queries
against `leads.lead_candidates`, `leads.outreach_sends` and `leads.siege_plan`, and
`automator/logs/siege.log`.

## Headline

**Grouped by sending domain instead of by mailbox, the fleet splits almost perfectly in two.**
Six domains carrying 16 mailboxes have **1 spam complaint across 767 warmup emails** and no
volume cuts. Fourteen domains carrying 42 mailboxes have **244 across 664** and 32 volume
cuts. Yesterday's open question was whether the 45 held mailboxes can be recovered. Thirteen
burned domains hold 39 of the 41 stopped mailboxes, so the answer for them is no, not by
waiting.

The three mailboxes that returned to clear yesterday **all held their band today**, which is
the first clean recovery since the band gate took over on 10-15. Three more were lost, and all
three were the three addresses on one domain, `clientsfromvideo.com`, going down inside four
hours of each other.

Sending was good on the one measure that matters most: **6 of the 51 people emailed had never
heard from us, 11.8%**, against 13 of 567 across the prior seven days (2.3%). That is the best
first-touch share of the month, and it came on fewer emails than the day before.

**And a defect worth more than any of it: 54 parked people are marked as already emailed and
have never been emailed.** Nothing in the pipeline can reach them.

## The fleet is domains, not mailboxes

| Group | Mailboxes | Clear | Watch | Stopped | Warmup spam | Volume cuts |
|---|---|---|---|---|---|---|
| Six clean domains | 16 | 14 | 2 | 0 | 1 of 767 | 0 |
| `ytgrowthagency.com` | 3 | 0 | 1 | 2 | 0 of 82 | 0 |
| Thirteen burned domains | 39 | 0 | 0 | 39 | 244 of 582 | 32 |

The six clean domains are `bookcontentgetsclients.com`, `contentgetsclientsvideo.com`,
`hicontentgetsclients.com`, `contentgetsclientsdigital.com`, `meetcontentgetsclients.com` and
`usecontentgetsclients.net`. Every mailbox on them reads 96.7 or better. The two on watch are
at 96.7 and are simply waiting out the recovery clock.

The thirteen burned domains average a **42% spam rate** on warmup mail. The worst three:

| Domain | Warmup spam | Lowest score | Volume cuts |
|---|---|---|---|
| `ytgetsclients.com` | 26 of 34 | 31.0 | 2 |
| `contentgetsleads.com` | 25 of 32 | 34.0 | 3 |
| `tubeleadsagency.com` | 24 of 32 | 28.0 | 2 |

A domain whose warmup mail lands in spam one time in three has a reputation problem. Email
reputation attaches to the domain, so no per-mailbox rule can recover it, and the mailbox
provider is acting on the same evidence independently: it cut warmup volume on **19 mailboxes
today**, 15 of them flagged CRITICAL, on top of 13 the day before. (The cut field holds only
the newest cut, so yesterday's reported 23 now reads 13 and the two counts are not
comparable.)

### The exception, and the one real test tomorrow

`ytgrowthagency.com` has **zero spam complaints across 82 warmup emails** and all three of its
mailboxes read 96.7. Two are stopped anyway, 46 and 47 hours into a 48-hour recovery clock,
and the third (`danflatley@`) is held only by the domain rule: `sick_siblings: 2` holds a well
mailbox when two others on its domain are not well.

This is the first clean domain the recovery clock has ever been asked to judge. Yesterday's
five failures were all on dirty domains, so they told us about the domains and nothing about
the clock. These three will come back on reputation that was never damaged. If they hold, the
rule works and the problem is purely domains. If they fail, the rule is also wrong, and the
48-hour clock needs to measure clean *sending* rather than clean silence.

### Real capacity

| | Mailboxes | Messages/day |
|---|---|---|
| Clear now | 14 | 210 |
| Clean and on the clock | 2 | ~30 |
| `ytgrowthagency.com` | 3 | ~45 |
| **Achievable today** | **19** | **~285** |
| Warmup allowance the plan would permit | 58 | 870 |
| Ready people waiting for a slot | | 1,943 |

Follow-ups owed **zero** this cycle, so none of the shortfall is a follow-up wave eating
slots. It is missing mailboxes, all of it.

## Hour by hour

| Run (Z) | clear | watch | stop | What moved |
|---|---|---|---|---|
| 10-27 07:05 | 13 | 6 | 39 | cycle opens |
| 10-27 08:05 | 14 | 5 | 39 | `casey_brown@usecontentgetsclients.net` returned |
| 10-27 11:05 | 16 | 3 | 39 | two on `contentgetsclientsdigital.com` returned |
| 10-27 13:05 | 16 | 4 | 38 | `danflatley@ytgrowthagency.com` stop → watch |
| 10-27 20:05 | 14 | 6 | 38 | `franciscohansen@` and `jeffkling@clientsfromvideo.com` → watch |
| 10-28 03:05 | 14 | 5 | 39 | `franciscohansen@` stopped |
| 10-28 06:05 | 14 | 4 | 40 | `jeffkling@` stopped |
| 10-28 07:05 | 14 | 3 | 41 | `juliuskoch@clientsfromvideo.com` stopped |

All three returners are still clear at the close: `band_round_trips: 0`, against 5 yesterday.
The whole of the cycle's loss is one domain.

## The 54 stranded people

This started as an arithmetic problem. Six people were emailed for the **first** time this
cycle, all six off the enriched shelf, and the shelf's count of people already written to
printed **1,667 against 1,667**. A running total of people written to cannot stay flat while
six people join it.

### What is actually happening

Loading a lead into SmartLead is not sending them an email. The push marks the lead
`outreach_status = sent_to_smartlead` and stamps `last_contacted_at` when SmartLead **accepts**
it into a campaign. SmartLead's own scheduler sends later, Monday to Thursday. If the sequence
is withdrawn before that, no email ever goes out.

`automator/scripts/siege_live.py` does the withdrawing. It removes the lead from the campaign
and **deletes its row from `leads.outreach_sends`**, which is correct, because nothing was
sent. It does not undo either of the two marks on the lead itself.

Those marks are what the rest of the pipeline reads, so the person goes invisible three ways:

- the shelf's inventory lists only `ready_data_scraped` leads, so they drop out of it;
- `APPROVED_FIRE_READY` selects the same statuses, so `npm run send` never offers them;
- Siege's history loader in `scripts/siege-plan.py` counts
  `outreach_status='sent_to_smartlead' AND last_contacted_at IS NOT NULL` as a send that
  happened, so its planner believes the offer was already used.

**None of the 54 has appeared in a send plan since 10-13.**

### Verified, not inferred

| Check | Result |
|---|---|
| Marked `sent_to_smartlead`, no row in `leads.outreach_sends` | 54 of 1,667 |
| Of those, with a verified address, subject, bundle | 54, 54, 54 |
| On the do-not-contact registry | 0 |
| In a send plan after 10-13 | 0 |
| Dated 2026-10-13 / 2026-10-07 | 53 / 1 |
| `siege_plan` rows for them on 10-13 | 53 marked `pushed` |
| Leads at `ready_data_scraped` that have ever been emailed | 0 (the inventory itself is clean) |

The 10-13 date is the record 782-email push, whose live sequences were pulled that same
afternoon when the ICP audit ran. Against `siege_plan`, **782 rows say `pushed` on 10-13 and
only 728 have a send-ledger row at all**, so the record push put email in front of at most 728
people. One sample traced end to end: `recPSkSNP2HeR6CCV` printed
`SENT … smartlead_lead=4671309489` in `siege.log` on 10-07 and has no ledger row today, which
is the withdraw working as designed and the mark surviving it.

### Fixed, and what is deliberately not fixed

`countShelf()` in `youtube-outreach-orchestrator-v1/src/db.ts` now reads both instruments in
one query. `emailed` counts leads with a row in the send ledger, which is an email we really
put in front of somebody. `marked_sent_never_emailed` publishes the gap, with up to 12 lead
ids, so a stranded group cannot sit inside a healthy-looking number again. Both are `null`,
not `0`, when the ledger cannot be read, and the whole count falls back to the old stamp-only
path rather than taking the shelf block dark. Shipped as `c095e2f` with the reasoning in
`664849c`; the classification is a pure `shelfTally()` with 6 regression assertions over the
live 10-28 shape, the id cap, the legacy `enriched` alias, the unreadable ledger and the empty
shelf. 229 assertions green, typecheck clean, live run 78ms.

**The repair itself was not shipped.** Reaching these 54 means flipping `outreach_status` back
to `ready_data_scraped` and clearing `last_contacted_at` on 54 ids. That is a write on the
send path, and this repo only counts (CLAUDE.md, "No business logic here"). It needs Casey's
word and it belongs in the email repo or in Siege.

**And the count is shelf-only.** Today's query covered `approved_hold`, because that is the
shelf. The same withdraw can mark a lead in any status, so the figure for the whole lead table
is unknown rather than zero.

## Sending

| | This cycle | Day before |
|---|---|---|
| Emails loaded | 52 | 61 |
| People emailed | 51 | 58 |
| People lost | 1 | 0 |
| First touches | 6 (11.8%) | 3 (5.2%) |
| First touches, prior 7 days | 13 of 567 (2.3%) | 10 of 680 (1.5%) |

The one loss is named in the push's own tally: SmartLead refused the lead with
`bounce_count=1`, meaning it already had that address on file as bouncing. One further email
was skipped and then written again in a later batch in the same run, so it cost nobody.
`binding_constraint` reads `partial_push` because `people_lost` is genuinely above zero.

All six first touches came off `approved_hold`, which is the only place a first touch can
drain inventory from. `ready_to_write` moved 5,146 to 5,147 even so, because the recovery lane
parked 2 the same day.

## Everything else

- **Enrichment**: 1 batch, 1 lead. 6,814 of 6,825 parked leads are bundled (99.8%), leaving
  eleven in the whole pool.
- **Recovery lane**: 12 contact points, 4 email addresses, 9 people, 4 of them with a new
  address, and **2 parked**. Prior seven days: 87 points, 17 addresses. The collect pass walked
  150 leads on lap 12 of a 2,394-lead book, found 633 methods and 629 were already on file,
  `cause: resolution_ok`, zero search refusals, 2% of leads with no website, `stranded` held at
  3. Producing methods: `34-channel-page` (6 points, 2 addresses, 6 leads), `16-jsonld` (5, 1,
  2), `18-rdap` (1, 1, 1).
- **A correction to yesterday's report.** It read the `cross-domain redirect` fault rate as
  improving after the 10-26 fix (100 of 175, then 55 of 152) while stating in the same
  paragraph that the passes walked different leads. Today it is **71 of 114, 62%**, higher than
  either. The fix is in place and unchanged; what moved was the slice of leads. Treat the
  redirect rate as un-measured until two passes cover comparable ground.
- **Apify**: 0 batches, $9.9997 against a $10 reserve, 0 price strikes, not halted. The $100
  allowance is the calendar month and refills on 11-01.
- **Cost**: $0 Anthropic. OpenRouter $63.70 balance, $1.44/day across the account, 44.2 days of
  runway. Cost per enriched lead $0.1676 over a 30-day window of 766 leads and $128.37, against
  $0.1684 yesterday.
- **Safety**: 0 fatal error signatures, no halt flag, no escalation. YouTube key pool 15 working
  of 66, settled and inert.
- **Discovery wrote 0 new channels**, which is Casey's 2026-09-08 order working as intended.

## Recommended next, ranked

1. **Buy new sending domains.** Fourteen of twenty domains are burned and hold 42 of 58
   mailboxes. The six that work have 1 spam complaint across 767 warmup emails, so the copy and
   the method are fine and the domains are not. Real capacity is ~19 mailboxes and ~285 emails a
   day against 1,943 ready people. Casey's spend decision.
2. **Decide what happens to the 54 stranded people.** Ready to email, blocked only by a mark.
   The repair is a 54-row status write on the send path and needs Casey's word.
3. **Then measure the same mark outside the shelf.** Today's count is `approved_hold` only; the
   whole-table figure is unknown.
4. **Watch `ytgrowthagency.com` tomorrow.** Three clean mailboxes finishing a 48-hour clock are
   the first honest test of whether the recovery rule works at all.
5. **Protect the first-touch share.** 6 new people on 52 emails beats 3 on 61 and 13 across the
   prior week. When slots open, check whether they go to new people or back into repeat offers
   to the 906 waiting top-tier leads.
