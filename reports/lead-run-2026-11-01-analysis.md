# Lead Run Analysis — 2026-11-01

Cycle: 2026-10-31T07:00:00Z to 2026-11-01T07:00:00Z (the 24h ending at midnight PT, so all
of Saturday 31 October Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-11-01.json`.
Companion to [lead-run-2026-11-01.html](lead-run-2026-11-01.html).

## Headline

**250 people parked in `approved_hold`, the biggest single day since the recovery lane
shipped, and 193 of them enriched the same night.** The pool went 6,827 to 7,077 and the
shelf of people ready to write reached 5,341 at 99% bundled.

It was bought, not found. The Apify allowance is a UTC calendar month, so November opened
at 17:00 Pacific, seven hours before the cycle closed, and the paid lane spent $21.06 of the
fresh $100 immediately. Cost per recovered person: **$0.112**.

**The bill landed on a different budget.** Enriching those people cost the OpenRouter account
**$15.77 in 24 hours against $1.56 a day over the prior week**, a tenfold jump in one cycle.
Balance at the reading: **$43.14, which is 2.7 days**.

## Where the 250 came from

Four batches, 100 already-known channels each, scraping the business email YouTube publishes
on the channel page, then ZeroBounce verifying it:

| Batch (UTC) | Addresses found | Flipped to approved_hold | Cost per recovered |
|---|---|---|---|
| 00:22Z | 95 of 100 | 72 | $0.097 |
| 02:20Z | 87 of 100 | 62 | $0.113 |
| 04:21Z | 82 of 100 | 61 | $0.115 |
| 06:22Z | 75 of 100 | 55 | $0.128 |
| **total** | **339 of 400** | **250** | **$0.112 avg** |

Two independent instruments agree the number is 250: the lead table's own cycle delta
(`parked_today`) and the lane's ledger (`recovered_in_cycle`). That agreement matters, because
a shelf drop and a park are easy to confuse (see the 10-13 ICP audit).

The **free** half of the recovery lane found **2 people** on the same night. That is a
picked-over book, not a fault, and the pass measurements say so without ambiguity:

- website resolved for **148 of 150** leads (1.3% no-site, against the ~15% normal bar)
- **4** web searches, **0** refusals, **0** rejections from the ownership gate
- methods found **541** contact points, of which **531** were already on file
- thirteenth lap of a 2,119-lead book, `stranded` at 3 (flat, so no selector gap)

Paid beat free **125 to 1** on the same night. Worth remembering before anyone proposes
Brave credit or a wider collect batch to fix the free lane: nothing in its own numbers is
broken.

## The money, which is the real finding

A recovered address is not a person anyone can write to. Compose reads the enrichment bundle
on disk, so each parked person needs the chain to research their channel first, and that is
the step that spends OpenRouter credit.

| | Apify (find the address) | OpenRouter (make it writable) |
|---|---|---|
| Cost per person | $0.112 | $0.082 |
| Money left | $68.94 spendable | $43.14 |
| How long it lasts | the rest of November | 2.7 days |
| Rest of the allowance needs | 982 more channels | $50.16 |

So roughly **19 cents** buys a verified, researched, writable person. The pipeline's unit
economics are fine. The mismatch is the problem: one budget is funded for a month and the
other for two and a half days, and the second is **$7 short of the first one's output** before
another batch runs.

Two mitigations, both real:

1. **Running dry is a stop, not a loss.** The chain checks the balance before every batch and
   holds at its gate, so leads stay in the pool. That guard was added 2026-09-15, after the
   09-14 night when nine batches each paid for YouTube and transcripts and then died at the
   writing stage on HTTP 402, about 1,635 lead attempts, with nobody told.
2. **The $50.16 is an overestimate.** It assumes 0.625 recovered per channel, and the four
   batches went 0.72, 0.62, 0.61, 0.55 inside one night. On that slope cost per person crosses
   the lane's own **$0.20 ceiling** in about six more batches and the lane halts itself for the
   month. Four points is a short series, so this is a slope to watch, not a forecast.

## What else the cycle did

**No send, and correctly labelled.** `binding_constraint: not_a_sending_day`. Siege's timer is
Mon-Fri and the last unit run was Friday 10-30, the crash day. Monday is the first sending day
after two consecutive zero-email weekdays (10-29 campaign list blanked, 10-30 a report helper
crashed before the push step), and **neither repair has shipped**: both live in `automator`,
which this loop may not edit. Friday's 69 people are still on the shelf and Siege rebuilds its
plan each morning, so no manual re-push is wanted.

**The fleet improved and, for once, held.** Clear mailboxes went 10 to 12 of 58 at 05:05Z.
Three were handed the clear band inside the cycle and **all three were still clear at the final
reading, with zero round trips**. That is the first clean recovery since the band gate took
over on 10-15; on 10-27 six came back and five were re-stopped within hours on fresh warmup
spam. Only **1 of the 45 held mailboxes** is healthy enough to lift itself, and it is an hour
from its clock expiring, so no further capacity returns for free.

One measurement caveat: the gate logged 3 moves to normal and 1 to watch while the clear count
rose by 2 and the stopped count fell by 2, which does not fully reconcile. At this size it is
not worth chasing; the **+2** is the figure to quote, since the band totals are read directly
rather than accumulated from moves.

**The stranded cohort is effectively closed**: 4 people marked sent who were never emailed,
down from 54 on 10-28.

**Quiet elsewhere.** $0 Anthropic spend, no fatal signatures, no halt flag. The enrichment
chain ran 6 batches, 193 done, 6 failed, each failure an individual lead that the chain
quarantined (`excluded` climbed 4 to 6) rather than looping on. Discovery stayed at zero, which
is Casey's standing instruction since 2026-09-08. The YouTube key pool reads 15 working of 66,
expected and irrelevant while discovery is off.

## Shipped this cycle

**1. The account that pays for enrichment is watched hourly now** (orchestrator `7ba82aa`).

The debrief published `days_of_runway` once a day and nothing read it in between. That is fine
for a number that drifts and useless for one that moved tenfold in a cycle: the 10-31 debrief
read 38 days and was right; one day later the same arithmetic reads 2.7. The only other signal
was check 7e, which reports the chain **after** it has stalled, hours after enrichment stopped.

`openRouterRunwayAlarm()` is a pure classifier with three tiers, each needing only what it can
measure: `low` (runway under 3 days), `below_margin` (balance under the $5 the chain's own
preflight needs, which needs no burn rate at all to say), `depleted`. It names the balance, the
burn with both its measurement window and its age, and whether the unspent Apify allowance has
already outgrown the credit. Keyed on tier plus day, so a steady shortfall speaks once while a
balance crossing the next line down speaks the hour it crosses. An observation and never an
exit-7 anomaly, because adding credit is a spend call no fix-agent can make.

One meter on the account, not two: the burn rate is the debrief's own measured
`account_spend_per_day_usd`, read from its newest snapshot, and only the balance is read live.
The check deliberately does not write to `openrouter-usage-samples.jsonl`, because the debrief
diffs the newest sample older than six hours, so an hourly sample would hand it a six-hour
spend labelled as a cycle and understate the per-lead cost by four, which is the multiplier the
whole recovery-budget projection runs on.

Live: one `openrouter_runway_low` line, `low`, 2.7 days, and the check-in still exits 0 healthy.
18 new assertions, 277 green, typecheck clean.

**2. The transcript gate stopped blaming the cancelled provider** (orchestrator `chain.sh`).

On 10-31 the chain held itself at the transcript preflight from 04:52Z to 08:02Z, three hours of
the only lane still producing, and logged `supadata limit still active` at every probe. The
hourly check-in quotes that line verbatim.

The gate has been Decodo-first since 2026-08-13 and only reaches the Supadata keys if Decodo
cannot answer. Supadata is cancelled, so every key answers 429 forever, which means the gate can
now only ever hold when **Decodo** fails. Every hold from here was going to be a Decodo outage
wearing the wrong name, and the obvious reading of that log line ("drop Supadata, it is dead")
would not have fixed one minute of it.

The probe now reports who answered and why the others did not: `200 decodo`, `200 supadata`, or
`DOWN decodo=<reason> supadata=<status>x<n>`, with Supadata statuses tallied rather than listed
one key per line so the Decodo half cannot be buried. Decodo reasons separate the shapes that
need different repairs: absent, `http-<status>`, answered-but-empty, timeout, unreachable. The
function is `transcripts_ok` and sets `$TRANSCRIPT_STATE` for the caller to log, mirroring the
`$OPENROUTER_STATE` pattern the credit gate below it already uses. Both messages keep the
suffixes the check-in parser matches, so the stall is still recognised and now quotes a true
cause. When the gate holds is unchanged.

Verified live against the real env: `200 decodo` today, `DOWN decodo=http-401 supadata=429x2`
with a bogus Decodo key, `DOWN decodo=absent supadata=429x2` with no Decodo key. The 429s are
the real pool, which is the point.

**3. Yesterday's quick-research fix is proven** (`6ceb7c4`, nothing new shipped). On 10-31 three
batches failed on one lead because a cancelled provider's exhausted plan was treated as fatal.
This cycle: 193 leads enriched, no transcript-provider failures. That fix is what made the 250
recovered people writable the same night.

## Ranked levers

1. **Put roughly $60 on OpenRouter.** $43 buys about 530 more enriched people; November's
   remaining Apify allowance is projected to deliver 614. Past that the chain holds at its gate
   and every further Apify dollar buys an address nobody can write to. The new alarm will warn
   before it happens instead of after, but it cannot fix it.
2. **Ship the two automator repairs before Monday.** Coerce non-string entries before the join
   in `why_no_email()`; guard the empty campaign list in `list_campaigns()` the way
   `list_accounts()` directly below it already is; and stop the sample and report steps being
   able to block the push. Two unrelated faults in 48 hours says the next one will be unrelated
   too, and all three cost the same thing.
3. **The fleet is still the ceiling.** 46 of 58 mailboxes cannot send and exactly one will lift
   itself. The three that returned this cycle held, which is the first good sign in a week, but
   a perfect Monday still only reaches what 12 mailboxes carry.
4. **Let the paid lane brake itself.** Cost per person climbed $0.097 to $0.128 across four
   batches. Two batches above $0.20 halts it for the month, which on that slope is a day or two
   out. That brake is correct and should not be raised: a thinning pool is the signal to stop
   buying, not to pay more.

## Grounding and caveats

Numbers from `logs/autopilot-debrief-2026-11-01.json`, except: the per-batch Apify figures
(the four `apify-endspec-*.log` run logs in youtube-email-outreach-v1), the hourly fleet
readings (`automator/logs/inbox-health.log`), and the gate timings (the chain's own log). The
gate misattribution was confirmed by running the probe live rather than inferred.

**Not verified:** whether the cost-per-person slope continues past four batches, whether Monday's
send clears, and whether the band gate's move counters and band totals keep disagreeing by one.
