# Lead Run Analysis — 2026-08-26

Cycle: 2026-08-25 07:00Z → 2026-08-26 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-26.json`.
HTML debrief: [lead-run-2026-08-26.html](lead-run-2026-08-26.html).

**Headline:** the pipeline recovered from yesterday's outage without anyone touching
the server, then had the best nineteen hours it has had in a week. Two of the five
discovery lanes finished their seed lists during those hours and the biggest lane has
about a day left. The seed ceiling that has been carried as a warning since 08-22 is
now the live constraint.

---

## 1. The numbers

| Metric | 2026-08-26 | 2026-08-25 |
|---|---:|---:|
| Parked into `approved_hold` | **+70** | +54 |
| `approved_hold` pool | 3,521 | 3,451 |
| `needs_contact` pool | 4,584 | 4,451 |
| **Total found, never contacted** | **8,105** | 7,902 |
| Channels found | 3,870 | 3,925 |
| Worth contacting (score ≥ 6) | **200 (5.2%)** | 163 (4.2%) |
| Good leads per live hour | **10.5** | 9.2 |
| Emails verified | 67 | 54 |
| Share of good leads reachable | 34% | 33% |
| `scoring_failed` | **0 (0.0%)** | 1 (0.0%) |
| Campaign sessions | 13 started / 11 finished | 11 / 12 |
| Keyword finder passes | 288 | 214 |
| Hard stops · time-budget stops | **0** · 11 | 2 · 10 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | $6.01 (8,107 calls) | $5.34 (6,930) |
| **OpenRouter balance** | **$483.82 (~80 days)** | −$0.20 (depleted) |
| `fatal_signatures` | **`[]`** | 1 (`two consecutive finder failures`) |

Cost per lead worth contacting **3.0¢** (was 3.3¢). Cost per lead parked **8.6¢**
(was 9.9¢). Both improved, because the day's output recovered while spend stayed flat.

The two unfinished sessions are the two that ran into the halt before 12:05Z. Nothing
crashed.

---

## 2. The recovery, timed

This is the part worth recording, because it is the first time the pipeline has
repaired a money outage by itself.

| Time (UTC) | Event |
|---|---|
| 07:51, 08:51, 09:51, 11:05 | Check-in reads the balance: `halt stands — OpenRouter still at $-0.20 (need $5)` |
| between 11:05 and 12:05 | Casey adds credits |
| **12:05:06** | `OpenRouter credits restored ($499.73) — halt cleared, restarting the campaign loop` |
| 12:05:06 | `systemctl restart autopilot-campaign.service` |
| ~12:00–12:59 | First rows in eight hours: 41 channels, 5 good leads |

Detection lag was at most 60 minutes and no one logged into the box. The equivalent
event yesterday needed a person to delete a file by hand. The fix that did this
shipped in the 08-25 cycle as orchestrator `3beb817`.

The other 08-25 fix held too. The video-graph sweep now stops when the scorer fails
rather than eating its seed list in silence, and it re-checks the halt flag every
chunk instead of once at start-up. It sat still all morning. Zero seeds were spent at
zero yield this cycle, against roughly 7,200 yesterday.

---

## 3. Where the leads came from

| Lane | Channels | Score ≥ 6 | Rate | Seeds walked | Leads/seed | Seed list |
|---|---:|---:|---:|---:|---:|---|
| **Video-graph sweep** | 3,135 | **168** | 5.4% | 6,242 | 0.0269 | 6,721 left, ~1.1 days |
| Keyword search | 428 | 24 | 5.6% | n/a | n/a | 288 passes |
| Peer network | 198 | **1** | **0.5%** | 219 | 0.0046 | **finished, refill only** |
| Recommended-videos feed | 106 | 6 | 5.7% | 195 | 0.0308 | **finished, refill only** |
| Guest-link mining | 3 | 1 | — | — | — | trickle |
| Podcast crossover | 0 | 0 | — | unknown | — | ran 2×, no output |
| Comment sweep | 0 | 0 | — | 0 | — | paused by Casey 08-20 |

Video-graph made **84%** of the day's good leads, a fifth straight cycle.

**Video-graph got better, which nothing predicted.** 5.4% against 4.2%, and 0.0269
per seed against 0.0222 measured on yesterday's live hours only. That is up about a
fifth. Do not read one cycle as a trend reversal; the thinning reported on 08-23,
08-24 and 08-25 was measured across several. What it does rule out is a lane
degrading toward zero.

**Peer network is the warning shape.** Its lifetime rate on this seed list is 7.2%
qualified. Today it managed 0.5%. Nothing broke. It finished its list and switched to
refill, and a refill seed is a creator we found a few hours ago, so their peers are
already in our database.

Niche split of the 200: coaching and consulting 43, real estate and property 33,
health and wellness clinics 31, other 29, transformation and performance coaching 27,
business growth coaching 14, relocation and lifestyle design 8, legal services 5,
then singles and pairs across financial planning, marketing agencies, manufacturing,
aviation, practice growth and luxury asset brokerage.

---

## 4. The seed arithmetic

This is the whole story of the next week.

| Lane | Total seeds | Walked | Remaining | Advanced this cycle | Days of road |
|---|---:|---:|---:|---:|---:|
| Recommended-videos feed | 11,690 | 11,690 | **0** | 195 | 0 |
| Peer network | 11,580 | 11,580 | **0** | 219 | 0 |
| Video-graph sweep | 67,495 | 60,774 | 6,721 | 6,242 | **1.1** |

The rail-walking lanes consume more than 11,000 seeds a day between them and are fed
by the ~200 good leads the pipeline produces. A lane seeded by its own output cannot
outrun itself. Two have already stopped trying and the third is about a day away.

Peer-sweep's refill log is the clearest evidence: it re-extended three times over the
cycle by **54, then 33, then 33** seeds, and walked each batch out in four chunks in
seconds. The lane is idle almost all the time now, waiting for us to find it something
to look at.

Dropping the video-graph subscriber-view floor from 20k to 5k buys roughly 46,000
seeds and about a week. That is time to build the real answer, not the real answer.

---

## 5. The term engine

Separate problem, same family. All 13 sessions opened with the reservoir reading
`STOCK-UP`, there were 18 term-starvation observations, and **287 of 288 finder
passes counted as a fade**. The fade threshold is 12 fresh pitchable per pass; the
best pass all day produced 1, and 264 of 288 produced 0.

So the adaptive-discovery machinery, which exists to pivot when a vein fades, fired on
essentially every pass. Measured across the cycle's session logs:

- **306** restock invocations, **272** of which fired the DeepSeek call (40 candidates each)
- **197 of those 272 wrote nothing at all**
- All 272 together wrote **126 probe terms**, 0.46 per call
- Median **58.4s** each, **5h 09m** total, against a **17h 36m** pass loop

That is **29% of the campaign's wall-clock**, in a cycle where all 11 finished
sessions ended on their time budget, so it came straight out of finder passes. And it
did not prevent the starvation it exists for: the reservoir read `STOCK-UP` on every
session with discovery running flat out.

`discover-veins.ts` has its own guard against this. It refuses to regenerate while the
term table has not grown since it last went dry. But the 74 calls that *did* write grew
the table by 1 to 3 terms apiece, which re-armed the guard every time. It was defeated
by its own output, and caught 34 of 306 chances. Fixed today (§7).

---

## 6. What is not broken

- **Scoring:** 0 failures out of 3,870 channels. Clean.
- **Quota:** 0 quota stops, 0 hard stops, 0 crashes, no fatal signatures.
- **Spend:** $6.01 OpenRouter, $0 Anthropic, $483.82 left. About 80 days.
- **Comment sweep** is stale at 141h because Casey paused it on 08-20. Expected.
- **Podcast crossover** ran twice and produced nothing, which is its normal result.

---

## 7. Shipped this cycle

Orchestrator commit `4facbbe`, two fixes.

**Low-yield backoff on vein discovery.** The same guard `harvestKeywords()` got on
08-09, applied to `discover()`, for the waste measured in §5. It samples what the last
5 runs actually wrote; if each wrote fewer than 3 probes it skips for 2 hours.
Self-clearing, so one good yield restores full cadence immediately. Fail-open, so
output it cannot parse records no sample and never starts a backoff.
`DISCOVER_LOW_YIELD_BACKOFF_HOURS=0` disables it. Measuring terms written rather than
table size is what makes it immune to the self-defeating loop that beat the existing
guard.

**Lane output in the health block.** Every field in `discovery_methods_health`
measured seeds consumed, and supply has not been the problem on any of the four days
this bit: 08-21, 08-22, 08-25 (a lane walking 7,200 seeds at zero yield while
reporting `productive: true` and a walk rate 53% *up*, because it had stopped doing the
expensive part) and 08-26 (peer network, 198 channels, one lead, every field green).
Each lane now reports `channels_in_cycle`, `pitchable_in_cycle`, `pitchable_rate_pct`,
`pitchable_per_seed`, and `yield_dead` for real work at zero output. Carried as a
recommendation since 08-25.

Verified before commit: `npm run typecheck` clean, `debrief-data.selftest.ts` ALL PASS
including 6 new `laneYield` cases, 11 new backoff cases passing in a scratch harness,
and `debrief-data.ts` run live against the database emitting the new fields.

---

## 8. Recommended next, ranked

1. **Find a seed source that is not our own output.** Carried five days; it became the
   live constraint today. Two lanes finished, the third has about a day, and the
   arithmetic will not close. The view-floor drop buys a week, not a fix.
2. **Turn the `needs_contact` recovery lane up.** Best value in the pipeline and it
   sidesteps seeds entirely by re-working creators already paid for. Pool is 4,584,
   up 131 today. Casey's call, since it sets scraping intensity.
3. **Decide the `approved_hold` outlet.** 8,105 creators found and never contacted, up
   201 today. Carried since 08-20, grows every day the finder runs.
4. **Decide about the keyword lane.** 288 passes for 24 good leads. The hit rate is
   fine at 5.6%; the volume per pass is not. New seed phrases (carried since 08-16) or
   retire it. Today's backoff makes deferring cheaper, not free.
5. **Add a low-balance warning.** 80 days of runway, so housekeeping. The debrief
   already reads the balance daily; warning at a threshold would have made yesterday's
   outage a note instead of a lost day.

---

## 9. Status

Running, unattended, healthy, nothing to intervene on. The campaign loop has been
working since 12:05Z with no human touching the server. Everything is parked, nothing
is sent: `approved_hold` is a deliberate holding lane. No halt flag is set and none is
warranted.
