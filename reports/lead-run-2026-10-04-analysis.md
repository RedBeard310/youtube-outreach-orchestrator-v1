# Lead run analysis, cycle 2026-10-03

Companion to [lead-run-2026-10-04.html](lead-run-2026-10-04.html). Cycle window
2026-10-03T07:00Z to 2026-10-04T07:00Z, which is Saturday 2026-10-03 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-04.json`.

## Headline

**Saturday. Nothing sent because nothing was supposed to send, +2 parked, no
faults, and the day's real finding is that the report could not tell this
Saturday apart from a Monday the send never ran.**

The parked pool went 7,589 to **7,591**, the same +2 as Friday, both leads from
the free recovery pass. The enrichment chain ran **one batch, did two leads and
went idle**, those two being the only new work in existence. The paid Apify lane
stayed asleep on **$0 spendable** until 31 October. Discovery stayed off by
order, eleventh debrief.

Emails loaded into SmartLead: **0**. `siege-plan.timer` is
`OnCalendar=Mon..Fri`, the campaigns deliver Mon-Thu, and this cycle was a
Saturday. Friday's run was killed on its one-hour limit with 68 emails unsent,
and a weekend does not pick those up: Monday writes a fresh plan.

Zero fatal signatures, zero halts, zero crashes, twenty-first consecutive day of
$0 Anthropic spend.

## Finding 1: a quiet Saturday and a broken Monday were the same snapshot

**Shipped: `a709b598`, youtube-outreach-orchestrator-v1.**

This was the first weekend the `send_plan` block has had to describe. It produced:

```json
"plan_found": false, "planned": null, "binding_constraint": null, ...
```

That is also exactly what a Monday whose timer silently failed would produce. One
of those days is correct and expected. The other loses a 200-email sending day
with no error line anywhere to find it by. Left alone, the failure mode is not
that someone misreads one day: it is that ten harmless weekends teach everyone
the shape is harmless, and the eleventh one isn't.

Three changes:

- **`sending_day`**, read off the timer's own `OnCalendar` via
  `systemctl show siege-plan.timer -p TimersCalendar`. Hard-coding `Mon..Fri`
  here would have been shorter and would have gone stale: that schedule already
  moved from 08:15 to 06:15 on 2026-10-01.
- **Two new `binding_constraint` values.** `not_a_sending_day` when the calendar
  excludes the cycle's PT day, `plan_missing_on_sending_day` when it doesn't.
  Both cases previously produced `null`, which reads as "no finding". The new
  pair is ranked above the ceiling checks, so a hand-driven batch no longer
  excuses a missing plan: that used to surface as `partial_push`, which asserts a
  plan existed and moved part of itself.
- **`unit_state` / `unit_last_result` / `unit_last_started`**, Siege's most recent
  run whenever it happened. Deliberately separate from the existing
  `push_unit_result`, which stays null unless that run was inside the cycle,
  because Friday's verdict must never print as Saturday's outcome. This closes
  yesterday's open decision 2 ("one look at `systemctl status` after Monday's
  run") by putting the answer in the snapshot.

The weekday parser handles what systemd's calendar syntax actually allows:
ranges (`Mon..Fri`), comma lists (`Mon,Wed,Sat`), ranges that wrap past Sunday
(`Sat..Tue`), and expressions with no weekday field at all (`daily`, `*-*-*
06:15:00`), which mean every day. An abbreviation it does not recognise returns
`null` rather than a guess, on the same rule the rest of this file follows: a
schedule we could not read must not become a claim that the day was fine.

*Verified:* `tsc --noEmit` clean, `debrief-data.selftest.ts` **ALL PASS** with 14
new cases, and run against live systemd. `isSendingDay` on the real timer line
returns true for Friday 10-02, **false for Saturday 10-03 and Sunday 10-04**, and
true for Monday 10-05. The regenerated snapshot reads
`binding_constraint: "not_a_sending_day"`, `sending_day: false`,
`unit_state: "failed"`, `unit_last_result: "timeout"`,
`unit_last_started: "2026-10-02T10:17:09.000Z"`, and `push_unit_result: null`,
which is the correct refusal to attribute Friday's kill to Saturday.

## Finding 2: the same probe read systemd's answers by position

**Shipped: same commit.**

The old code ran `systemctl show siege-plan.service -p Result
-p ExecMainStartTimestamp --value` and destructured the output lines in request
order. **systemd prints properties in its own canonical order and ignores the
order they were asked for.** Verified directly: asking for them reversed returns
the identical output. For these two properties the canonical order happens to
match, so the code was correct by luck.

The failure it was one edit away from is specific. Add a third property, or get a
systemd release that reorders these, and the timestamp lands in the slot holding
the result. `pushRunVerdict` then fails to parse the stamp, returns `null` for
every cycle, and a killed push reports as `partial_push`, meaning "a few leads
the builder could not finish". That is the exact misdiagnosis the 10-02 and 10-03
debriefs spent two days undoing, and it would have come back silently.

Properties are now parsed into a `Key=Value` map, splitting on the first `=` only
because `TimersCalendar` holds a whole expression containing more of them.

## Finding 3: the parked pool overstates the inventory by 548, and the gap grows

**Measured, not a code change.**

Sending an email does not move a lead out of `approved_hold`, so the pool figure
at the top of every one of these reports counts people who have already been
written to. Queried today:

| `outreach_status` within `approved_hold` | Count |
|---|---|
| `ready_data_scraped` | **7,033** |
| `sent_to_smartlead` | **548** |

The 548 is the cumulative output of the send path to date, and the first time
this series has been able to state that as one number. `countShelf` already
reported `ready_to_write: 7033` and has been right all along; what was missing is
that the difference from the headline 7,591 is not ten unbundled leads plus
rounding, it is 548 people already emailed.

The arithmetic it changes: the ramp is 200 a day across four delivery days, so a
full week consumes roughly **800** of the 7,033 while the only lane still adding
leads contributed **2**. That is about **nine weeks** of email in the bank, and
the headline pool number drifts further above the true figure every send day.
**Watch 7,033, not 7,591.**

## What worked, and should not be re-examined

- **Site resolution is healthy.** 9 of 573 walked leads logged `site=(none)`,
  **1.6%** against a bar of roughly 15%. The book is genuinely picked over rather
  than quietly failing, which is the ambiguity the 09-04 incident taught us to
  check. Neither Brave key was called at all: the leads under the cursor already
  have stored websites. Both are still at their 402 cap and it cost nothing for a
  third day.
- **Yesterday's addresses-versus-people fix earned its keep immediately.** Friday
  read 32 addresses / 2 people. Today reads 2 and 2, so nothing was flattered and
  nothing hidden, and the snapshot now carries both without being asked.
- **`collect_book_stranded` held at 3** for the twenty-first day. No selector gap.
- **The paid lane's brake is un-tripped.** `halted: false`, `price_strikes: 0`,
  `budget_read_from: "loop_tick"` so the reading is fresh rather than one batch
  stale. Asleep by design until 31 October.
- **`siege-plan.service` sitting in `failed` blocks nothing.** It has held that
  state since Friday 10-02 at 10:17:09Z, the residue of the one-hour kill. A
  systemd timer fires its unit regardless of how the last run ended, which Friday
  itself demonstrated by running after Thursday's identical failure. It is now
  reported so it reads as history, not as an alarm.
- **The push fix is deployed.** `7fd02b6fd` sits at the head of
  `youtube-email-outreach-v1`, and `scripts/push-batch.ts` ends with
  `await runCli(main)`. It has not been exercised against a live push yet. Monday
  is its first real test.
- **OpenRouter is steady.** $1.82/day on an empty research queue, $110.75 left,
  about 61 days. Nothing to top up.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00** (21st zero) | $0.00 |
| OpenRouter | **$1.82/day**, $110.75 left, **~61 days** | $1.80/day, ~62 days |
| Apify | **$0 spent**, $10 left, **$0 spendable** | $0 spent, $0 spendable |
| Brave | $0, both keys capped, never called | $0, both keys capped |
| Per recovered lead | not measurable (2 leads, no spend) | not measurable |
| Per enriched lead | $0.91 on 2 leads | $0.898 on 2 leads |

`openrouter_usd_per_enriched_lead` charges all account spend to enrichment, so on
a two-lead day it divides the account's fixed daily traffic by two and means
nothing. Read the $1.82/day.

## What did not happen, and is fine

- **0 new channels, 0 campaign sessions.** Discovery paused since 2026-09-08 on
  Casey's order. Every sweep stopped, flag untouched, eleventh debrief carrying it.
- **0 emails.** Saturday. Covered above.
- **0 fatal signatures, 0 halts, 0 crashes.**
- **15 of 66 YouTube keys working.** Settled 09-16: quota was cut on 50 projects.
  It constrained nothing, because the 100-unit keyword search is off and
  enrichment runs on 1-unit calls.
- **The orchestrator's own send found 0 ready leads** at the cycle boundary.
  Siege sends off the `approved_hold` shelf; this repo's lane covers the small
  `approved` path.
- **`scripts/backfill/halt.flag`** still logs its "this is not the halt flag"
  note every 30 minutes. Decoy artefact, warned about since 09-30, left alone.

## Open decisions for Casey

1. **Decide what October's recovery budget is.** Unchanged at number one; nothing
   this cycle moved it. $100 bought 472 leads at thirteen cents on 10-01. The free
   pass has now found two leads on each of two consecutive days. Doing nothing is
   a real answer: the 7,033 left to write then shrinks by roughly 800 a week with
   almost nothing refilling it until 1 November.
2. **Watch Monday's push, from the snapshot.** Tuesday's debrief will carry
   `unit_state` and `unit_last_result` directly, so this needs no manual
   `systemctl` call any more. Expected: a push that finishes in minutes and a
   `TimeoutStartSec` question that closes itself. If it is killed anyway, the
   cause is not slowness and the unit is next.
3. **Unblock a few Siege offers.** Nine of sixteen, same named reasons for seven
   debriefs. With 7,033 leads ready, 36 inboxes and a 200/day ramp, variety of
   message is the live ceiling and supply of people is not.
4. **Decide the discovery pause.** Eleventh debrief. The enrichment work the pause
   was meant to fund finished two days ago at 99.9%.
5. **Raise the Brave cap or add a key.** Under $3, cheap, not urgent. Cost nothing
   again and was not even called this cycle.
6. **Eventually close the other 62 pool leaks.** 30 seconds each per run. Nothing
   else runs in a timed loop, so nothing else costs a send. Pattern to copy is
   `src/db/cli-exit.ts`.

## Still owed

Six debriefs have grounded metrics on disk and no report: 09-19, 09-18, 09-17,
08-18, 08-17, 07-11.

## Note on the snapshot

`logs/autopilot-debrief-2026-10-04.json` was written at 07:20Z on schedule and
then **regenerated at 07:25Z** when the new `sending_day` fields were verified
against live systemd (importing the gatherer runs it). Every headline figure is
identical across the two readings. Three moved by the five minutes of extra
elapsed time and this report quotes the later ones: OpenRouter day-rate $1.76 to
**$1.82**, balance $110.81 to **$110.75**, runway 63 to **61 days**, and
`measured_minutes_after_cycle_end` 20 to 25. The per-enriched-lead upper bound
moved with them, $0.881 to $0.9115, and is meaningless at two leads either way.

Four figures in this report were measured directly rather than read from the
snapshot, and are named where they appear: the `outreach_status` split of the
shelf (one SQL query), the four collect passes and the 13:00Z verify flip (the
`recovery-lane.service` journal for the window), the `site=(none)` rate (a count
over the collect log's last 573 lead lines), and the `siege-plan` timer schedule
and unit state (`systemctl show`).
