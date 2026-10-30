# Lead Run Analysis — 2026-10-30

Cycle: 2026-10-29 07:00Z → 2026-10-30 07:00Z. Grounded metrics:
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-30.json`.

## Headline

**Zero emails on a Thursday sending day.** Siege's sample pass read 12 live
mailboxes with 62 free slots. Its live pass, four and a half minutes later, read
zero, refused to push, and exited 1. Sixty-two approved people with verified
addresses, written subjects and finished bundles got nothing.

The fleet was not the cause. SmartLead's campaign list came back empty, and one
unguarded line turned that into a lost day.

This is the only cycle this month that carried a Siege plan and sent nothing.
Every other weekday cycle since 10-13 sent between 52 and 783.

## The defect

`automator/scripts/smartlead_api.py`:

```python
def list_campaigns() -> list:
    data = get_json("/campaigns")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("data") or []
    return []
```

Any answer it does not recognise, including `None` from a failed HTTP call,
becomes an empty list. No retry, no raised error, no log line.

`siege-plan.py` builds a name-to-campaign map from that list and, for every
mailbox it cannot find, appends the reason `no Siege campaign yet` and marks the
mailbox not live. So one bad read blanks the entire fleet in silence.

Twenty lines below `list_campaigns()`, `list_accounts()` is guarded against
exactly this shape. It retries, it refuses to return a partial list, and it
carries a comment saying what an empty list would cost ("a live run would empty
`state/siege-suspended.json`, which restarts every suspended mailbox's cool-off
clock"). The campaign list never got the same treatment.

### Evidence

| Reading | Time | Live mailboxes | Free slots | Mailboxes with no campaign |
|---|---|---|---|---|
| Sample pass | 2026-10-29 10:16:50Z | 12 | 62 | 0 (campaigns resolved) |
| Live pass | 2026-10-29 10:21:20Z | 0 | 0 | 58 of 58 |

Twelve of the 58 carry `no Siege campaign yet` as their **only** disqualifying
reason. Those are the same twelve the sample pass had called live. The other 45
were already suspended and picked the reason up on top, which is why the "only"
count is the one that means anything.

Prior plans, for comparison:

| Plan day | Mailboxes with no campaign | Live |
|---|---|---|
| 2026-10-23 | 0 | 23 |
| 2026-10-26 | 0 | 16 |
| 2026-10-27 | 0 | 14 |
| 2026-10-28 | 0 | 19 |
| **2026-10-29** | **58** | **0** |

The campaigns exist. The read of them failed.

The run then logged `62 approved people are no longer plannable (blocked or
already sent today)` and `REFUSING to push: nothing the approval covers is still
plannable`, and `siege-plan.service` exited 1.

## Why the snapshot could not say so

`planned: 0` fell through every branch of `sendPlanHealth()`, so
`binding_constraint` — the field a reader looks at before any other — printed
`null` on the worst send day in weeks. Nothing in the published block named a
cause.

Worse, the block's own rules pointed the wrong way. `band_stop` read 48 of 58,
which on any other morning is where the answer lives. It is the wrong answer
here: the push did not fail because 48 mailboxes were sick, it failed because the
12 healthy ones were invisible to it, and those twelve appear nowhere in the
stopped count. A reader following the note faithfully would have filed this as
more deliverability decline and left the real defect live.

## Fixed this cycle (orchestrator `977c68c`)

Three new fields off the plan's own inbox list, plus three new
`binding_constraint` values:

- `inboxes_total`, `inboxes_no_campaign`, `inboxes_only_no_campaign`
- `campaign_list_empty` — every mailbox lost its campaign and at least one was
  otherwise fit to send
- `no_mailbox_slots` — the fleet genuinely had no room
- `planned_nobody` — neither, and it wants a human

Read `inboxes_only_no_campaign`, not `inboxes_no_campaign`. An already-suspended
mailbox picks the reason up too when the list blanks and proves nothing; one
carrying it alone is a slot the day really lost. Splitting the reason string can
only ever over-split, so the count errs low.

The branch is ranked above the ceilings (a plan holding nobody never reached one)
and is claimed only when nothing else sent either, so a hand-driven batch still
gets the better description. All three fields are null, not 0, when the plan has
no inbox list.

Verified against the live 10-29 plan: `58 / 58 / 12`, `binding_constraint:
campaign_list_empty`. 240 assertions green, selftest ALL PASS, typecheck clean.

**The guard itself belongs in `automator`**, which is the send path and outside
the five repos this agent may edit (CLAUDE.md, "No business logic here"). It is
reported, not shipped.

## The fleet, separately

| Reading | Clear | Watch | Stopped |
|---|---|---|---|
| 2026-10-29 07:05Z → 15:05Z | 12 | 1 | 45 |
| 2026-10-29 16:05Z → 19:05Z | 9 | 3 | 46 |
| 2026-10-29 20:05Z → 2026-10-30 07:05Z | 9 | 1 | 48 |

Nothing returned to clear all cycle. Three moved to stop, two to watch.

**The fleet shrank on a day it sent nothing at all.** The standing explanation
for shrinkage has been that a big push burns inboxes (the 10-15 note). This cycle
pushed zero emails and still lost a quarter of its clear mailboxes, so warmup
traffic alone is now enough to stop one. That changes what buying new domains
is worth.

Three held mailboxes are healthy and only waiting out the 48-hour recovery clock,
soonest in 24 hours, so a little capacity returns for free.

## Everything else was ordinary

- **Recovery lane:** 12 contact points, 1 new address, 8 people. That is almost
  exactly one day's share of the 87 points and 16 addresses found over the prior
  week. Lap 13 of a 2,391-lead book, so most of what it reads it has read before.
- **Site resolution healthy:** 16.7% with no site, zero Brave refusals, cause
  `resolution_ok`. No credit problem.
- **Largest collect fault:** `cross-domain redirect`, 61 of 113 method attempts,
  spread across five method names (sitemap, subpages, external-links, mailto,
  jsonld). One condition wearing five names. Some of those redirects are ordinary
  and some are the ownership gate correctly refusing a stranger's site. Telling
  them apart is real work, and loosening an identity gate on a hunch is the one
  change that quietly poisons the lead data.
- **Stranded cohort closed:** 54 → 4. Fifty flew on 10-29.
- **Apify** parked at its $10 reserve, correctly. The $100 month resets 10-31.
- **$0 Anthropic.** OpenRouter $1.52/day, $60.47 left, 39.8 days.
- **0 fatal signatures, no halt.** Discovery still off by Casey's 2026-09-08
  order; the campaign loop was left stopped.

## Ranked next

1. **Guard `list_campaigns()` today, before the next push.** Give it what
   `list_accounts()` already has: retry an empty or unrecognised answer, raise
   rather than return `[]` if it stays empty. `siege-plan.py` should also refuse
   to write a plan where every mailbox lost its campaign, because the fleet
   cannot actually be in that state. In `automator`, so reported not shipped.
   The next push runs in a few hours and fails the same way if SmartLead answers
   badly again.
2. **Re-plan the 62 dropped people.** Nothing re-queues them. Siege builds each
   morning fresh, so they rejoin the general pool and wait by tier. With 1,995
   waiting against roughly 135 messages a day, that is a couple of weeks.
3. **Ask why three mailboxes stopped on a zero-send day.** Worth reading the spam
   counts behind them before buying domains.
4. **Apify resets 10-31:** ~700 leads at $0.115, with ~$100 of OpenRouter
   enrichment behind them. It front-loads, so early November matters most.
5. **Decide on `cross-domain redirect`.** More than half the collect pass. Needs
   a decision about the ownership gate, not a guess.

## Decisions for Casey

- The `list_campaigns()` guard is in `automator`, which this agent may not edit.
  It needs someone to apply it.
- Whether the 62 dropped people get pushed to the front of the queue or wait
  their turn.
- Whether to loosen the ownership gate's handling of cross-domain redirects.
