# Lead Run Analysis — 2026-08-25

Cycle: 2026-08-24 07:00Z → 2026-08-25 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-25.json`.
HTML debrief: [lead-run-2026-08-25.html](lead-run-2026-08-25.html).

**Headline:** the OpenRouter account ran out of credits at 00:49Z and the pipeline
stopped. Most of it stopped correctly. The biggest lane kept walking for another
six and a half hours, spent roughly 7,200 seeds it can never re-walk, produced
zero leads, and every health check called it healthy the whole time. That part is
fixed. The empty account is not, and only Casey can fix it.

---

## 1. The numbers

| Metric | 2026-08-25 | 2026-08-24 |
|---|---:|---:|
| Parked into `approved_hold` | **+54** | +189 |
| `approved_hold` pool | 3,451 | 3,394 |
| `needs_contact` pool | 4,451 | 4,345 |
| **Total found, never contacted** | **7,902** | 7,739 |
| Channels found | 3,925 | 5,101 |
| Worth contacting (score ≥ 6) | **163 (4.2%)** | 285 (5.6%) |
| Emails verified | 54 | 109 |
| Share of good leads reachable | 33% | 38% |
| `scoring_failed` | 1 (0.0%) | 0 |
| Campaign sessions | 11 started / 12 finished | 16 / 15 |
| Keyword finder passes | 214 | 334 |
| Hard stops · time-budget stops | **2** · 10 | 1 · 14 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | $5.34 (6,930 calls) | $7.95 (10,688) |
| **OpenRouter balance** | **−$0.20 (depleted)** | not measured |
| `fatal_signatures` | **1** (`two consecutive finder failures`) | `[]` (25th cycle) |

Cost per lead worth contacting **3.3¢** (was 2.8¢). Cost per lead parked **9.9¢**
(was 4.2¢). Both worsened for the same reason: the denominators collapsed when the
account died, while the day's spend was already on the books.

The spend figure is low only because the cycle effectively ended at 00:49Z. It is
not a saving.

## 2. The outage, in order

| Time (UTC) | What happened |
|---|---|
| 00:49 | Every OpenRouter call starts returning HTTP 402. Two finder passes fail identically |
| 00:49 | Campaign trips its own hard-wall stop and ends the session after 191s |
| 00:51 | Hourly check-in matches the fatal signature, writes `logs/autopilot-halt.flag` with a correct diagnosis and the exact remedy |
| 01:21 | Campaign loop reads the flag and stops |
| 01:11 onward | Graph sweep relaunches every 15 min, reads the flag, sleeps. Correct |
| 05:20 | Peer-sweep refill reads the flag, exits 10, and is marked `failed` by systemd |
| 00:49 → 07:26 | **Video-graph sweep keeps running.** 360 chunks, ~7,200 seeds, 0 good leads |
| 07:26 | Stopped by hand, restarted onto the fixed code, read the flag, slept |

The check-in's halt note is worth quoting, because it got the call right and said
so plainly: *"This is a real account balance depletion, not a code/config bug ...
Not something the fix-agent should paper over (e.g. by shrinking max_tokens) as
that masks the real depletion, and it's a money-path decision outside the
fix-agent's authority per house law."*

Lifetime account figures off the credits endpoint: **$810 granted, $810.195 used.**

## 3. Why the biggest lane didn't stop

All five sweeps share one shape. YouTube key-pool exhaustion is a `stop`: it halts
the chunk loop, deliberately does *not* checkpoint the chunk, and lets a resume
re-walk those rails for free. The comment in `video-graph-sweep.ts` spells out
why, because the alternative was learned the hard way:

> without stopping the CHUNK loop too, every later chunk walks its watch pages
> into a triage that can't fetch anything, consumes its seeds, and the sweep
> drains to a false "COMPLETE" with zero yield.

An LLM failure got `state.stats.failed += 1; continue`. Silent, unbounded, and no
different from a channel returning malformed JSON.

Evidence it ran that way for six hours, from the sweep's own session log and state
file:

- Last good lead: **chunk 121**. Final chunk reached: **481**. That is 360 chunks
  at 20 seeds each with **zero** good leads.
- `llm_calls` frozen at **728** across all 360, printed on every chunk line.
- `qualified` frozen at **1,500 (lifetime)**, printed on every chunk line.
- Roughly 17 candidates cleared triage per chunk, so about 6,000 channels were
  fetched, filtered, and then silently dropped.

And in the database, over the same window:

| Window | Rows written | Score ≥ 6 |
|---|---:|---:|
| 08-25 00:49 → 07:00 | 696 | **0** |
| 08-24 00:49 → 07:00 | 1,160 | **59** |

**Every one of those 696 rows is `below_threshold` with `signal_score = 0`.** They
are sub-3,000-subscriber parks, which `parkIfBelowFloor` writes *before* any
scoring call. So the lane kept writing rows at a plausible rate all night with
nothing good in any of them. That is why a row-count check would not have caught
this, and it is the single most useful detail of the day.

**The seeds are the loss.** A walked seed is checkpointed and never re-walked. The
book went from roughly 14,500 remaining to 7,303. Close to half the lane's
remaining road was spent on nothing.

The start-of-run halt check did exist and never fired. This is the only long-lived
process in the pipeline: it had been up since 18:46 the previous evening, so its
check was six hours stale by the time the flag was written. The short-lived sweeps
relaunch every 15 minutes and caught the flag within one cycle.

## 4. The day was already thin before the outage

All 163 good leads landed before 00:49. The honest comparison is the same 17.8
hours a day earlier, which produced **226**. So the day was **28% down before the
account died**. The outage explains the last quarter of the cycle, not the rest.

| Lane | Channels | Score ≥ 6 | Rate | Book state |
|---|---:|---:|---:|---|
| **Video-graph sweep** | 3,223 | **136** | 4.2% | 7,303 seeds, ~0.6 days |
| Keyword search | 391 | 16 | 4.1% | 214 passes for 16 leads |
| Recommended-videos feed | 121 | 6 | 5.0% | **1 seed left of 11,496** |
| Peer network | 187 | 4 | 2.1% | **drained (0 of 11,361), refill blocked by the halt** |
| Guest-link mining | 3 | 1 | — | trickle |
| Comment sweep | 0 | 0 | — | paused by Casey on 08-20 |

Video-graph carried **83%** of the day's good leads, a fourth straight cycle. Per
seed, before the outage, it ran at **0.0222** against 0.0250 yesterday and 0.0292
the day before, so the slow thinning tracked since 08-23 continues at about the
same rate. The 0.0102 you get from raw daily totals is an artefact of the dead
hours, not a collapse. Worth stating explicitly so it isn't read as one next week.

**The structural point, carried and now urgent:** every rail-walking lane is
seeded by our own qualified leads, about 160 a day, while consuming more than
11,000 a day. Two of those books are finished and the third has half a day left.

## 5. The health monitor read the outage as an improvement

`video_graph_sweep` in tonight's snapshot: `seeds_advanced: 13336` against 8,710
the day before, `walk_rate_change_pct: +53.1`, `productive: true`,
`idle_run_streak: 0`, `throughput_bound: false`. Every field green, on a lane that
made nothing for six hours.

It walked faster **because** it had stopped doing the expensive part. Scoring is
what costs time, so a lane whose scorer is dead accelerates.

This is the third appearance of one pattern. On 08-21 a finished book graded
`productive: true` because 257 > 0. On 08-22 a lane that had run out of hours
graded green on every field because every field measured supply. Tonight a lane
with a dead scorer graded green and its one moving number pointed the wrong way.
The monitor watches how much material a lane consumes and never what it produces.

Not fixed tonight. It needs a design decision about what "productive" means, and
guessing at that would be churn.

## 6. What shipped

**Finder `a419e55`** — a scorer outage now stops a sweep, the way key-pool
exhaustion already did.

- New `ScorerOutageTripwire` in `src/lib/run-gate.ts`, alongside the two gates
  already shared there for exactly this "copy-pasted in four places" reason. It
  trips on the **first** unmistakable billing or auth failure (HTTP 402/401,
  "requires more credits") and on a **streak of 25** for anything else. The
  2026-08-04/05 truncation bug, 726 `scoring_failed` rows in one day with no
  provider fault, is the same shape and would have tripped the streak.
- Wired into all five sweeps. A trip sets `stop`, which they already handle by not
  checkpointing the chunk, so a resume re-walks those rails for free.
- Both failure paths are covered. `scoreChannel` swallows transport errors into
  `ok: false` rather than throwing, so the `!outcome.ok` branch is where the 402
  actually landed, and wiring only the `catch` would have fixed nothing.
- Video-graph re-checks the halt flag **every chunk**, closing the stale-start-up
  gap.
- `refill-peer-sweep.sh`: exit 10 is `EXIT_RESUMABLE`, a deliberate self-gate, not
  a fault. Propagating it parked the unit in systemd `failed` for the whole
  outage, which is the alarm that hides the next real one.

Verified: `tsc` clean; the tripwire unit-tested against the real 402 body (trips),
against `no JSON object found in model output` and a 429 (correctly do not trip),
and for streak and reset behaviour; both dry-runs load; the refill script run live
and defers with exit 0.

**Orchestrator `3beb817`** — the OpenRouter-credits halt heals itself.

The halt flag was one-way. Topping up the account would have changed nothing until
someone remembered a file on a VPS. The check-in now reads the flag before
accepting it, and if it names the OpenRouter credit depletion, probes the credits
endpoint (free) and clears the flag once the balance is back above
`AUTOPILOT_MIN_CREDIT_MARGIN_USD` (default $5). A margin, not any non-zero
balance: an account at $0.30 would clear the flag, 402 within minutes, and flap
hourly. Clearing the flag revives the sweeps on its own; the campaign loop exits
0 on a halt and `Restart=on-failure` doesn't cover a clean exit, so it gets an
explicit restart.

Narrow on purpose. Any halt it does not positively recognise, including the hard
dollar ceiling and a migration freeze, is left exactly alone for a human.

Verified live against the genuinely depleted account: refuses at −$0.20 and exits
5; clears and restarts on a decoy flag with the margin lowered, with the journal
confirming the loop started then re-halted on the real flag, which proves the
passwordless sudo restart path; leaves a hard-ceiling decoy untouched.

**Orchestrator `a28b270`** — the account that pays for the pipeline is now in the
debrief.

New `openrouter_today` block: cycle spend and call count (from the finder's own
per-day spend logs, already on disk), live balance, and `days_of_runway`.
Everything fails soft to null, because a debrief must still be written with the
network down and a missing number must never read as a zero balance. Runway is
documented as a ceiling rather than a forecast, since it divides by today's spend,
which reads low on a day the account died early.

Verified against the live cycle: $5.3412 over 6,930 calls, matching a hand count
off the same logs; video-graph-sweep $3.69 of it; balance −$0.20, `depleted: true`.
The authoritative 07:20Z snapshot was restored after the test run.

**Operational, by hand:** stopped the bleeding lane (restarted `video-graph-sweep`
onto the fixed code, which read the flag and slept, preserving **7,303 seeds**) and
cleared `peer-sweep-refill`'s stuck `failed` state.

## 7. Looked at, left alone

- **The campaign's 2 hard stops and 16 term-starvation observations.** Documented
  behaviour since the keyword lane was demoted on 08-14, and one of the two hard
  stops is the credit outage itself.
- **Comment sweep at 0.** Paused by Casey on 08-20. Its 117-hour-stale state is
  expected, not a fault.
- **The single `scoring_failed` row.** One in 3,925. Noise.
- **Shrinking `max_tokens` to fit the remaining balance.** This would have bought
  a few more hours of scoring and hidden the depletion. The check-in agent
  explicitly refused it as a money-path decision, and it was right.

## 8. Ranked next

1. **Add OpenRouter credits.** Nothing else can happen first. At $5 to $8 a day,
   $200 buys roughly a month. The pipeline now restarts itself within the hour.
2. **Find a seed source that isn't our own output.** Carried four days, no longer
   theoretical. Dropping the video-graph view floor from 20k to 5k buys about
   46,000 seeds and a week, which is a reprieve, not a fix.
3. **Turn the `needs_contact` recovery lane up.** Best value in the pipeline and it
   sidesteps the seed problem entirely, because it re-works supply already paid
   for. Pool is 4,451; the expensive half is bounded since 08-24, so raising the
   free collection batch adds output without adding spend. Casey's call.
4. **Decide about the keyword lane.** 214 passes for 16 leads, ~$1.20/day
   inventing terms retired after one run. Not broken, finished. New seed phrases
   (carried since 08-16) or retire it.
5. **Teach the health monitor to watch output, not supply.** Third appearance of
   this pattern. Needs a design decision, so deliberately not guessed at tonight.
6. **Decide the `approved_hold` outlet.** 3,451 parked plus 4,451 in
   `needs_contact` is **7,902 creators found and never contacted**, growing daily.
