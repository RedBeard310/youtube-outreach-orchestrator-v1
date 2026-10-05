# Lead run analysis, cycle 2026-10-04

Companion to [lead-run-2026-10-05.html](lead-run-2026-10-05.html). Cycle window
2026-10-04T07:00Z to 2026-10-05T07:00Z, which is Sunday 2026-10-04 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-05.json`.

## Headline

**The recovery lane's website search was switched off, not metered out, and the
only alarm that could have named it was unreachable by construction.**

Sunday, so 0 emails is correct. The parked pool went 7,591 to **7,592**, the
lowest daily gain of the run, from one address that verified. Enrichment did one
lead. Apify stayed asleep on $0 spendable. Discovery stayed off by order,
twelfth debrief.

The finding is underneath that. Across four collect passes the lane resolved no
website for **405 of 600 leads, 67.5%**, per pass 4%, 85%, 91%, 90%. Yesterday
the same measure was 2%. Nine of thirteen collection methods need the creator's
website first, so most of the lane was idle for most of the day.

The cause is not a spent search plan. Measured through the collect pass's real
import graph, `braveKeys()` returns **0**. The keys exist in the shared env bank
and nothing in the lane's chain loads it, so `searchBrave()` returned an empty
list on its own first line, before issuing any request. No request, no failure,
no log line.

Zero fatal signatures, zero halts, zero crashes, twenty-second consecutive day of
$0 Anthropic spend.

## Finding 1: website resolution was unconfigured, and silence was the designed outcome

**Shipped: `27dbbb246`, youtube-email-outreach-v1.**

The lane gets a creator's website one of two ways. `buildContext()` reads one
already on file (`external_links`, then `storedWebsite()` over
`leads.contact_points`), and only if neither has one does it pay Brave to search.
Preferring the stored copy is correct and it is why this went unseen: the cursor
spent weeks in a stretch of the book that already had sites. Yesterday 588 of 600
resolved without a single search.

This cycle the cursor entered the part that doesn't, and the second route turned
out not to exist:

| Link in the chain | What it carries |
|---|---|
| `recovery-lane.service` | `HOME` and `PATH`. No `EnvironmentFile` |
| `npm run recovery` → `run-recovery.ts` | `import 'dotenv/config'` over the orchestrator's own `.env`, which has no `BRAVE_` name |
| `spawn('npm', ['run','bloodhound',...])` | inherits that environment |
| `src/bloodhound/cli.ts` → `db.ts` → `search/brave.ts` | nothing in the graph calls `loadSharedEnv()` |

Verified directly rather than inferred. `import './src/bloodhound/db.ts'` then
`braveKeys().length` returns **0** before the fix and **2** after. The keys are
present in `~/env-storage/.env` as `BRAVE_SEARCH_API_KEY_1` and `_2`, both 33
characters, so this was never a missing-key problem.

The consequence is specific. `searchBrave()` opens with
`if (braveKeys().length === 0) return []`. An empty return is read by the caller
as "this creator has no findable website", which skips nine methods. Because no
HTTP request was ever made, no key could refuse, and the loud warning added on
2026-09-04 for precisely this symptom sat behind a `BraveKeysRefused` check that
nothing could throw. **The 09-04 outage reproduced itself through configuration
instead of billing, and the fix for 09-04 could not see it.**

This is the `repo .env shadows the shared bank` class recorded in CLAUDE.md. The
email repo already has the cure (`src/load-shared-env.ts`, written after the
2026-09-02 and 2026-09-09 outages of the same shape); this entry point was never
wired into it. The fix is that import, placed first, because ES modules evaluate
every import before the importing file's first statement and a call under the
imports would run after `search/brave.ts` had already read an empty environment.

*Verified:* typecheck clean on both repos. End to end on one real site-less lead
from the collapsed pass, `--dry-run`, nothing written: keys load as 2, Brave is
called, Brave answers **200**, and the new per-pass line reports the outcome. The
real CLI also runs clean against a nonexistent lead id, so the new first import
does not disturb the normal path.

### What it costs, and what it does not promise

Each unresolved lead is one Brave search at $5 per 1,000. At this cycle's rate
that is about **405 searches a cycle, roughly $2 a day**, charged to key _1,
which Casey funded on 09-13 and which answered 200 today. Key _2 is still
refusing at its $5 cap. Brave's API never reports a balance, so this has to be
counted rather than asked. The plan's own monthly spending limit is the hard
stop, so there is no runaway, but this does begin spending where yesterday it
spent nothing. It restores designed behaviour rather than adding new behaviour,
and it is Casey's to reverse.

It promises that the lane will look, not that it will find. The single lead
probed today resolved nothing: Brave answered, and all its hits were social
profiles or directory sites. Expect the no-site rate to fall. Do not expect a
yield jump until a full pass measures one.

## Finding 2: an empty search result had three causes and one name

**Shipped: same commit.**

Three distinct things ended in `return []`, and the log could name only the first:

1. **every key refused** — loud since 09-04
2. **a non-refusal error** — a 5xx, a malformed body, a thrown URL parse. Silent
3. **Brave answered and all five hits were social or third-party hosts** — silent, and a genuinely correct answer

Case 2 is a fault, case 3 is a picked-over book, and they were indistinguishable
from each other and from a creator with no website. That ambiguity is the whole
reason the check-in could only file three alarms as `attributed_to: "unexplained"`
with the advice "check the collect log before spending anything", which the
collect log had no way to answer.

All four outcomes are now counted, including the unconfigured case, and every
collect pass prints one line naming them. The first non-refusal error also names
itself once. Counting calls nothing and costs nothing. Today's probe printed:

```
[bloodhound] Brave website resolution: 1 searches, 0 resolved a candidate site,
1 answered with only social/third-party hits, 0 hit a key refusal, 0 errored.
```

That is the sentence that would have resolved the first alarm instead of the
third.

*Verified:* a stubbed harness exercising all six paths (never asked, usable hit,
social-only answer, non-refusal error, key refusal, and both warnings firing
exactly once) produced the expected tallies and the expected single copy of each
warning. The summary line is printed after the existing pass footer and matches
neither the `Brave Search API key(s) refused` regex that the check-in and
`bloodhound-lane.ts` rewind on, nor the footer regex `collectPasses` keys passes
by, so no existing parser changes behaviour.

## Finding 3: the lane's one load-bearing input was not in the snapshot

**Shipped: `3870e9e`, youtube-outreach-orchestrator-v1.**

The check-in has measured this rate since 09-04 and alarmed correctly. It fired
three times this cycle, once per pass at 17:11Z, 00:11Z and 06:11Z, exactly as
the 09-21 de-duplication intended. None of it reached the daily snapshot.
`fatal_signatures_today` stays empty because these are observations rather than
crashes, so a reader working only from the authoritative file saw a quiet +1 day
and nothing more. The rate had to be hand-counted out of the collect log on two
cycles running, which is the manual step 09-04 was supposed to end.

`recovery_lane.site_resolution` now carries the newest completed pass:

```json
{"no_site_pct":90,"no_site":135,"sampled":150,"rewalk_pct":100,
 "brave_refusals":0,"leads_after_refusal":0,"resolved_sampled":15,
 "resolved_hit":1,"collapsed":true,
 "pass_summary":"Collected 2 contact points from 1/150 leads."}
```

Read with `collectPassAttribution()`, **the same function the alarm uses**, not a
private copy. Three separate re-implementations of that pass boundary have
already gone wrong (09-13, 09-22, 09-28) and a fourth here would be the worst
place for one: it would let the report and the alarm disagree about the same
pass. `collapsed` comes from the check-in's own `AUTOPILOT_NO_SITE_ALARM_PCT`
rather than a second invented bar.

*Verified:* against the live log it matches the 06:11Z alarm record field for
field. Gatherer self-test ALL PASS, typecheck clean.

## Finding 4: two smaller ones, both reports that mislead while nothing is wrong

**Shipped: `6f5ea47` and `6d2419e`, youtube-outreach-orchestrator-v1.**

**The 548 already-emailed leads are counted now.** Yesterday measured them with a
hand-written query and told the reader to watch 7,033 rather than 7,591.
`countShelf()` now returns `already_sent` and the snapshot carries it. Live read:
`{"ready_to_write":7034,"bundled":7582,"already_sent":548,"total":7592}`. The
arithmetic corroborates itself, 7,034 + 548 = 7,582 = bundled, with the 10
unbundled leads making up the 7,592 pool.

**The enrichment chain's log is readable again.** The cycle produced 51 lines, 48
of which said that a stale file beside `chain.sh` is not the halt flag and
nothing is halted. The three real lines were one batch launched, one finished,
one idle. The warning is correct and worth keeping, since that wrong path is the
one somebody would reach for, so it now says itself once a day, with the stamp
kept beside the real halt flag so a restart cannot reset it and an unreadable
stamp means "warn" rather than "stay quiet". Exercised across five cases (first
pass, second pass, corrupt stamp, 25-hour-old stamp, no decoy present).

The stale file itself said enrichment was frozen for the Postgres cutover and
that deleting it would resume. The cutover finished 2026-08-12 and nothing reads
the path, so both lines were false to anyone who found them. It now states what
it is and names the two real flags.

## What worked, and should not be re-examined

- **The alarm layer did its job.** Three site-resolution observations, one per
  pass, plus one `bloodhound_collect_yield_degraded` correctly attributed to
  `site_resolution`. The 09-21 keying on the pass rather than the clock held: no
  repeats, and the count means events rather than check-ins.
- **Yesterday's weekend fix handled its second weekend day** with no manual
  check. `sending_day: false`, `binding_constraint: not_a_sending_day`,
  `push_unit_result: null`, `unit_state: failed` reported as Friday's history.
- **`collect_book_stranded` held at 3** for the twenty-second day. No selector gap.
- **The paid lane's brake is un-tripped.** `halted: false`, `price_strikes: 0`,
  `budget_read_from: "loop_tick"`, so the $10 reading is this morning's rather
  than a batch stale. Asleep by design until 31 October.
- **The Apify monthly reset needs no help.** The loop reads
  `maxMonthlyUsageUsd - monthlyUsageUsd` live from Apify on every tick, so the
  allowance refilling on 1 November wakes the lane by itself. Checked because a
  lane asleep on a cached number for 26 days would be an expensive thing to
  assume.
- **OpenRouter is steady.** $1.78/day on an empty research queue, $109.03 left,
  about 62 days.

## Money

| | This cycle | Prior cycle |
|---|---|---|
| Anthropic | **$0.00** (22nd zero) | $0.00 |
| OpenRouter | **$1.78/day**, $109.03 left, **~62 days** | $1.82/day, ~61 days |
| Apify | **$0 spent**, $10 left, **$0 spendable** | $0 spent, $0 spendable |
| Brave | $0, and now known to be $0 because nothing called it | $0, reported as both keys capped |
| Brave, from here | **about $2/day** at this cycle's no-site rate | n/a |
| Per recovered lead | not measurable (1 lead, no spend) | not measurable |
| Per enriched lead | $1.78 on 1 lead (meaningless) | $0.91 on 2 leads |

`openrouter_usd_per_enriched_lead` charges all account spend to enrichment, so on
a one-lead day it prints the account's whole daily traffic. Read the $1.78/day.

One correction to yesterday's table: it recorded both Brave keys as sitting at
their spending cap. Key _1 answered **200** when called today, so that reading
was stale. Brave cost nothing because nothing asked it.

## What did not happen, and is fine

- **0 new channels, 0 campaign sessions.** Discovery paused since 2026-09-08 on
  Casey's order. Every sweep stopped, flag untouched, twelfth debrief.
- **0 emails.** Sunday. The timer is `Mon..Fri 06:15 America/New_York` and its
  next run was due 10:15Z today, after this cycle closed.
- **0 fatal signatures, 0 halts, 0 crashes.**
- **15 of 66 YouTube keys working.** Settled 09-16: quota was cut on 50 projects.
  It constrained nothing; the 100-unit keyword search is off and the running
  lanes use 1-unit calls.
- **The orchestrator's own send found 0 ready leads** inside the window. It then
  fired at 07:20Z, just past the close, and loaded 2 leads. Those belong to
  tomorrow's count.
- **The enrichment chain doing one lead is not a fault.** The shelf is bundled at
  99.9% and that lead was the only new work in existence.

## Open decisions for Casey

1. **Say whether about $2 a day on Brave Search is wanted.** The one decision
   this cycle created. Resolution works now, and working means spending. The
   plan's monthly limit is the hard stop, the lane is the only thing adding
   leads, and nine of its thirteen methods were idle for most of yesterday.
   Doing nothing accepts the spend; reversing it returns the lane to four
   methods.
2. **Decide what October's recovery budget is.** Second only because it led for
   four debriefs and nothing moved it. $100 of Apify bought 472 leads at thirteen
   cents on 10-01. Doing nothing means the 7,034 left to write shrinks by roughly
   800 a week with almost nothing refilling it until 1 November.
3. **Read tomorrow's `site_resolution` block first.** Single digits means the
   keys are reaching the lane. Still near 90% with `brave_refusals: 0` means
   something else, and the new per-pass line will name it.
4. **Watch today's push from Tuesday's snapshot.** First live run since the
   pool-leak fix. `unit_state` and `unit_last_result` carry the verdict.
5. **Unblock a few Siege offers.** Nine of sixteen, same reasons for eight
   debriefs. Message variety is the live ceiling, not supply of people.
6. **Decide the discovery pause.** Twelfth debrief. The enrichment work it was
   meant to fund finished at 99.9% three days ago.
7. **Eventually close the other 62 pool leaks.** Thirty seconds each per run.
   Nothing else runs in a timed loop, so nothing else costs a send. Pattern to
   copy is `src/db/cli-exit.ts`.

## Still owed

Six debriefs have grounded metrics on disk and no report: 09-19, 09-18, 09-17,
08-18, 08-17, 07-11.

## Note on the snapshot

`logs/autopilot-debrief-2026-10-05.json` was written at 07:20Z on schedule and
**regenerated at 07:38Z** once `shelf.already_sent` and
`recovery_lane.site_resolution` were verified. Every headline figure is identical
across the two readings. Four moved with the elapsed time and this report quotes
the later ones: OpenRouter day-rate $1.66 to **$1.78**, balance $109.15 to
**$109.03**, runway 65.8 to **61.6 days**, and
`measured_minutes_after_cycle_end` 20 to 34. That last one flipped
`counts_post_cycle_arrivals` to true, so the parked figures could in principle
include arrivals after the cycle closed; both readings give 7,592 and `+1`, so
nothing here depends on it.

Measured directly rather than read from the snapshot, and named where they
appear: the per-pass no-site rates and the 600-lead cycle total (counted over the
four passes in the collect log), the Brave key count through the collect pass's
import graph, the three alarm records and their timestamps (from
`logs/autopilot-observations.jsonl`), the chain log's signal-to-noise split, the
`siege-plan` timer schedule and unit state (`systemctl show`), and the Apify
loop's live ledger read (`scripts/apify-endspec-loop.sh`).
