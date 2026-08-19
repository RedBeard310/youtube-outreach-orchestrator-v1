# Lead run analysis — 2026-08-17

Cycle window 2026-08-16T07:00Z to 2026-08-17T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-17.json`.
HTML debrief: [lead-run-2026-08-17.html](lead-run-2026-08-17.html).

## Headline

**+83 parked** (`approved_hold` 2,432 → 2,515), down from +146. Both of yesterday's
fixes worked exactly as built. The drop is what the now-honest arithmetic shows: a
fourth lap over the same seed book runs at **half** the yield of the third.

Separately, counting warnings in the cycle's session logs turned up a tax that has been
running all month. The fleet spent **2,091 requests** in one cycle re-learning which
YouTube keys were already spent, and **403 of its 411** rate-limit collisions landed on
three keys because every process opened on the same end of the pool. Fixed today.

## The numbers

| Metric | Value | Prior day |
|---|---:|---|
| Parked into `approved_hold` | **+83** | +146 |
| `approved_hold` pool | 2,515 | 2,432 |
| `needs_contact` pool | 3,206 | 3,028 |
| **Total parked, none sent** | **5,721** | 5,460 |
| Channels found | 4,993 | 5,570 |
| Worth contacting (score ≥ 6) | **267 (5.3%)** | 389 (7.0%) |
| Emails verified | 80 | 149 |
| `scoring_failed` | 0 | 0 (12th clean day) |
| Campaign sessions | 21 | 17 |
| Finder passes | 259 | 346 |
| Stopped for want of terms | 19 | 18 |
| Time-budget stops | 2 | 0 |
| Quota stops | 0 | 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $5.19 (7,842 calls) | $6.02 (8,958) |
| `fatal_signatures` | `[]` (18th cycle) | `[]` |

Cost per lead worth contacting **1.9¢**; per lead parked **6.3¢**. Both worse than
yesterday's 1.5¢ / 4.1¢, both still second-cheapest of the month.

### Shape of the day

Third cycle with no dead hours, and the first with **no dead tail**, which is the visible
result of the relap fix. The last five hours found **817** channels against yesterday's
236 in the same window. Quietest hour still found 31. Peak 699 at 11:00Z.

The two thin opening hours (37, then 31) are the lap boundary itself: lap 3 finishing on
fumes before the 09:12Z relap.

### By discovery method

| Lane | Found | Worth contacting | Rate | Spend | Cost/lead |
|---|---:|---:|---:|---:|---:|
| Recommended-videos feed | 2,218 | **196** | **8.8%** | $3.24 | 1.7¢ |
| Keyword search | 521 | 50 | **9.6%** | $0.50 | **1.0¢** |
| Peer-network comments | 557 | 11 | 2.0% | $0.29 | 2.6¢ |
| Comment sweep | 1,690 | 10 | **0.59%** | $1.00 | **10.0¢** |
| Podcast crossover | 4 | 0 | 0% | — | — |
| Guest-link mining | 3 | 0 | 0% | — | — |

The ranking is unchanged and every rate is lower: feed 11.7% → 8.8%, keyword 12.3% →
9.6%, peer comments 3.1% → 2.0%. Comment sweep is the only lane that moved up
(0.54% → 0.59%), which after three cycles is noise.

The feed produced **73% of the day's good leads**.

### Best niches

Real Estate 54, Coaching & Consulting 44, Transformation & Performance Coaching 42,
Health & Wellness Clinics 27, Business Growth Coaching 16, Financial Planning 14,
Legal 11, Marketing Agencies 10.

## Q1 — Did the self-reopening book fire, and what is a fourth lap worth?

**It fired, unattended, on the first hourly tick after the book emptied.**

```
2026-08-16T08:11:33Z  restarted   seeds_added 5
2026-08-16T09:12:32Z  relapped    closed_lap 3
2026-08-16T10:11:29Z  skip        already running
   ...21 more hourly ticks, all "already running"
```

It re-opened all 9,104 seeds and walked **7,135** of them, 78% of a lap, in under 22
hours. Both gates behaved: nothing was left unwalked, and the closing lap's cost of
1.6¢ per lead cleared the 25¢ ceiling comfortably.

Live figure for the lap in progress:

```
lap4: 7135 seeds | 181 qualified | 0.025/seed (lap 3 0.053 → -52%)
      | 1544 scored | $3.30 ($0.018/lead) | 1969 seeds left | ETA 16.4h
```

**Per-seed yield by lap: 0.453 → 0.373 → 0.053 → 0.025.** Per dollar it is still the
second-cheapest lane at 1.8¢, because cost follows channels scored rather than seeds
walked and a re-walk drops most of what it finds for free.

That combination is the thing to watch. The gate is priced in dollars, so at this decay
it keeps approving laps while each returns less: full lap 4 lands near **228 leads for
about $4.20**, lap 5 near 110, lap 6 near 55. Nothing fails; the lane just becomes a
rounding error while still passing its own test. See recommendation 5.

## Q2 — Why did parking halve when nothing failed?

Two factors multiplied: the pool worth contacting shrank **31%** (389 → 267), and the
share with a findable email fell from **48% to 37%**.

A uniform drop across every lane normally implicates the tool. Here it is the input.
Emails come from the website a creator links in their channel description, and the two
rates move together:

| Cohort | Worth contacting | Has a linked website | Has an email | Emails per linked site |
|---|---:|---:|---:|---:|
| 08-13 | 170 | 51 (30%) | 66 (39%) | 1.29 |
| 08-14 | 348 | 129 (37%) | 147 (42%) | 1.14 |
| 08-15 | 390 | 165 (42%) | 186 (48%) | 1.13 |
| **08-16** | **267** | **92 (34%)** | **98 (37%)** | **1.07** |

The last column is the email finder's own conversion and it has barely moved in four
days. What moved is how many creators had a website at all, 42% → 34%. Of emails found,
66% verified valid against 70% yesterday, which is ordinary movement.

**Not a fault, and nothing to fix in the email path.** A fourth pass over the same seed
book reaches creators slightly less commercially established than a third pass reached,
and no website means no email. Those leads went to `needs_contact` (+178, now 3,206).

## Q3 — What is the key pool costing us to use?

Counted from the cycle's 21 session logs. True every day this month, and nothing in the
pipeline reports it, because every symptom is a line that reads as routine.

Processes that found each slot already spent, and processes that bounced off it on a
per-minute limit:

```
slot           1    2    3    4    5    6  ...  18   19   20   21+
spent          8   58  161  204  204  199  ...  16    9    3     0
rate-limited 206  150   47    0    0    0  ...   0    0    0     0
```

**The good news first, because it is the bigger fact.** No process ran out of keys all
cycle (0 `AllKeysExhausted` events) and no key was ever reported suspended. Slots 3–20
drained their daily allowance; slots 21–52 were never needed. A full day of this pipeline
therefore costs roughly **20 keys' worth of quota**, and the 32 keys behind that are real
headroom in reserve. **The pool is not the constraint**, and the Google Cloud accounts
Casey has been adding are genuine spare capacity.

**What it cost to get there is the problem.** Two faults, one root. The key-handling code
kept its spent-key list **in memory**, and its own comment said "production runs one
client per run." That stopped being true when the campaign went autonomous: this cycle ran
259 finder passes plus four always-on sweep services, so a couple of hundred short
processes each started blank and each rediscovered spent keys by spending a request on
one. Hence **2,091** quota-exhausted responses, and slots 4 and 5 appearing 204 times each
(roughly once per process).

Second, every process opened rotation at **slot 1**, so the fleet's opening burst landed
on the same three keys: **403 of the cycle's 411 per-minute rate limits** hit slots 1, 2
and 3, and the second row shows how sharply it stops (slot 4 and beyond took none). Those
front keys are alive and healthy; they are simply being asked by 21 sessions at once, so
processes bounce off them into the drained middle of the pool before reaching a key that
answers.

The bill: ~20 wasted round trips at the front of every process, plus a standing
rate-limit collision on three keys that is pure self-inflicted latency. It never cost a
lead, never stopped a run and never touched real capacity, which is exactly why it lasted
a month. It is worth fixing rather than shrugging at because the cost scales with how many
processes the campaign runs, and that number only goes up.

## What broke

- **A month of paying twice to learn the same thing** about which keys are spent. Fixed
  today. It hid because every symptom is a warning line that reads as routine, and no
  counter anywhere would have shown 2,091 of them in a day. It never cost a lead or
  stopped a run; it cost latency and wasted requests.
- **Comment sweep, third cycle:** 1,690 channels, 10 leads, 0.59%, **10.0¢/lead** against
  the feed's 1.7¢. Yesterday proved the seed picker ranks correctly and the lane's
  ceiling is the problem. Three cycles is enough. Casey's call; left running.
- **Podcast crossover:** has a timer, ran once, produced **4 channels and 0 leads**
  (yesterday 12 and 1). 16 channels across two cycles. Not a lane yet, but the health
  report calls it active.
- **Peer-network comments** halved volume (935 → 557) and rate (3.1% → 2.0%). One cycle,
  watch rather than act.
- **Two measurement gaps.** The grounded metrics report peer sweep and podcast crossover
  with `seeds_advanced: null` / `productive: null`, so two of five lanes cannot
  self-report whether they did anything. The feed and comment sweep both report real
  numbers.
- **Supadata is still in the transcript fallback chain** despite being retired 08-13 for
  Decodo. Failed twice this cycle with "limit-exceeded" from a cancelled account. Not
  worth churn at two occurrences; remove the dead tier next time anyone is in that file.

### Not a fault

OpenRouter $6.02 → **$5.19**. Anthropic $0 for the 18th cycle. Zero crashes, quota
stops, scoring failures, fatal signatures. 19 of 21 sessions stopped for want of search
terms, which standing orders classify as a supply state rather than an incident. Two
sessions stopped on their time budget, which is the loop pacing itself.

## Yesterday's fixes, checked

| Prediction | Outcome | Verdict |
|---|---|---|
| A drained book re-opens itself on the next hourly tick | Relapped 09:12Z unattended, walked 7,135 seeds, produced 73% of the day's good leads, no dead tail | **confirmed** |
| Expect ~480 leads a lap, not ~3,400 | Lap 4 tracking to ~228. Right in shape, about 2× too high in size, because the decay did not stop at lap 3 | directionally right |
| Lap arithmetic reports the real number | `lap4: 7135 seeds \| 181 qualified \| 0.025/seed`; boundary file carries the lap's own seeds/leads/spend outright | confirmed |
| Relap gate priced in dollars, not per-seed yield | Vindicated. Per seed lap 4 reads as collapse; per dollar it is 1.8¢ and second-cheapest | confirmed |

## Shipped today

`youtube-lead-finder-v1` `080704c` and `youtube-outreach-orchestrator-v1` `0888592`.
Typecheck clean, **218 unit tests pass** (was 193), both halves verified against the live
52-key pool without spending YouTube quota. No `.env` touched.

### 1. A spent key stays spent, across processes, until Google says otherwise

New `src/youtube/dead-keys.ts` moves the spent-key list to disk, so the next of the day's
few hundred processes skips a dead key without spending a request. Each entry carries its
own expiry, because "dead" is not permanent:

- a **daily-quota** death expires at the next **midnight Pacific** (Google's real reset),
- a **project suspension** holds for `YT_BLOCKED_TTL_HOURS` (48) because it needs a human
  appeal,
- a **per-minute rate limit** is never recorded at all.

Keys are stored as a truncated SHA-256, never the value, so the file is safe in `logs/`
and safe to read out loud. Verified on disk: a quota death writes
`expires_at: 2026-08-18T07:00:00Z`, the file contains no trace of the key, and a second
process skips it with zero requests.

The guard that matters most: if remembered state ever claims the **whole** pool is dead,
it is discarded and the pool re-probed. A run trusting a bad state file would die before
issuing a single request, and in auto mode would try to fall through to the retired
RapidAPI mirror on the way down. Being wrong there costs a whole run; re-probing costs
one sweep.

### 2. The fleet no longer all opens on key #1

Rotation starts at a spread offset. Verified against the real pool: 60 client
constructions landed on **36 distinct slots spanning #1 to #51**, where before all 60
would have opened on #1. Total capacity is unchanged, and the point is not to reach the
spare keys (they were always reachable). The point is that 21 sessions stop arriving at
the same three keys in the same second, which is where 403 of the cycle's 411 rate limits
came from.

Injecting a fetch opts out of both changes, so tests and fixture captures stay hermetic
and never touch the live state file. No key count is hard-coded; pool size is whatever
the environment holds.

Found on the way past, unrelated but worth recording: **`mkdirSync` with
`recursive: true` against an unwritable prefix spins forever on this kernel** rather than
raising. It hung a test for five minutes. The code now checks the directory is absent
before creating it.

### 3. Written down so it does not come back

The orchestrator's `CLAUDE.md` key-pool section now carries the rule in one line: a run
is not a process. Key deaths belong on disk with an expiry, and rotation must never open
at index 0. The old assumption was documented as correct for two months, which is how it
survived.

## Recommended next, ranked

1. **Feed the recommended-videos lane seeds it has not seen.** 73% of output at 1.7¢ a
   lead, on a curve that has halved twice (0.373 → 0.053 → 0.025 per seed). Auto-relap
   keeps it alive and cheap and cannot reverse the decay. Only first-time seeds can, and
   those come from the other lanes producing more qualified leads.
2. **Give the keyword harvest new seed phrases.** Untouched since 07-13. Best hit rate,
   cheapest leads (1.0¢), idle in 19 of 21 sessions for lack of input. Still the
   highest-leverage unbuilt thing here.
3. **Kill comment sweep, or accept it as a $1-a-day rounding error.** Three cycles at
   ~0.5%, picker proven to rank correctly, 10.0¢/lead against 1.7¢, 1,690 channels for 10
   leads. Nothing left to test. Left running.
4. **Decide what podcast crossover is for.** Two cycles, 16 channels, 1 lead. Either it
   needs the data source it was waiting on, or its timer comes off so the health report
   stops calling it a lane.
5. **Put a yield floor on auto-relap, not just a price ceiling.** The 25¢/lead gate was
   right yesterday and will now approve laps 5, 6 and 7 while each returns half the one
   before. Something like "stop when a lap returns under 0.01 per seed" lets the lane
   retire itself instead of grinding at a forever-defensible price. Not built today
   because it is a policy choice about how long to keep a decaying lane alive, and that
   is Casey's.
6. **Decide the outlet for `approved_hold`.** 2,515 prepped and ready to write, none
   emailed. Nothing downstream of parking has moved in weeks.
7. **Build the `needs_contact` recovery engine.** 3,206 found, scored and unreachable,
   up 178 today. Every point the linked-website rate falls sends more leads here rather
   than losing them, so this lever grows as the feed lane decays.

## Status

Everything parked, nothing sent. `approved_hold` 2,515 + `needs_contact` 3,206 =
**5,721 creators found and never contacted**. $0 Anthropic, $5.19 OpenRouter. Zero
crashes, scoring failures or quota stops, no fatal signatures for the 18th cycle. The
campaign is still running and was left that way.

---

Sources: grounded metrics
`youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-17.json`; per-lane spend
`youtube-lead-finder-v1/logs/llm-spend-2026-08-1{6,7}.jsonl`; lap figures
`logs/lap-boundary.json`, `logs/graph-sweep-state.json`, `scripts/lap2-progress.ts`;
key-slot histogram counted from the 21 session logs in `logs/autopilot-sessions/`;
per-lane and hourly figures queried live from `leads.lead_candidates`.
