# Lead Run Analysis — 2026-09-01

Cycle: 2026-08-31 07:00Z → 2026-09-01 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-01.json`.
HTML debrief: [lead-run-2026-09-01.html](lead-run-2026-09-01.html).

**Headline:** yesterday's auto-restart fix held on its first real cycle. The pipeline
ran all 24 hours with nothing stopped and produced **3,146 channels, 127 pitchable,
+63 parked**, its best day since 08-24, with zero fatal signatures and $0 Anthropic.

Two findings underneath it. **81 of the 127 came from one lane on lap 8 of its own
12,307-seed book**, with about six hours of that lap left, at 1.5% of lap 1's
per-seed yield. And **22 of the 127 pitchable leads are tarot readers, astrologers
or psychics** — a share that has run 8% to 21% daily since 08-19 and has never been
measured in any report.

---

## 1. The numbers

| Metric | 2026-09-01 | 2026-08-31 | 2026-08-30 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+63** | +5 | +54 |
| `approved_hold` pool | 3,860 | 3,793 | 3,788 |
| `needs_contact` pool | 4,980 | 4,916 | 4,921 |
| **Total found, never contacted** | **8,840** | 8,709 | 8,709 |
| Channels found | **3,146** | 0 | 3,026 |
| Worth contacting (score ≥ 6) | **127** | 0 | 97 |
| Emails verified | **49** (39%) | 0 | 43 |
| Hours with zero output | **0 of 24** | 24 of 24 | — |
| Campaign sessions | 17 / 17 | 2 / 3 | 15 / 15 |
| Finder runs | 565 | 3 | 716 |
| Hard stops · quota stops | 3 · 0 | 2 · 1 | 0 · 1 |
| Time-budget stops | 14 | — | — |
| Hours halted | **0** | ~22.3 | 0 |
| Scoring failures | **0** | — | — |
| Anthropic API spend | $0 | $0 | $0 |
| OpenRouter, account meter | **$17.46/day** | $42.79 | (not measured) |
| OpenRouter, finder log | $4.51 (6,530 calls) | $0.0079 | $4.58 |
| OpenRouter balance | $321.85 (**18.4 days**) | $339.19 (8 days) | $381.99 |
| `fatal_signatures` | `[]` | `[]` | `[]` |

Discovery cost per pitchable lead, from the finder's spend log: keyword search
**2.4¢**, peer sweep **2.4¢**, recommended-videos **4.1¢**. Blended **3.4¢**.
Cost is not the constraint anywhere.

---

## 2. What actually happened

The cycle opened with the recovery. At **07:24:03Z** `tryAutoClearHalt` (shipped
08-31, commit `b8d52c4`) matched the standing halt flag, probed the shared env bank,
counted 66 direct YouTube keys, cleared the flag and restarted the campaign loop. A
session launched one second later and the loop never stopped again.

Output was flat rather than spiky: every hour of the 24 produced between **86 and 249**
channels and between **2 and 11** pitchable leads. No dead hour, no overnight hole, no
stall. That is the first clean full day in ten. The flatness is itself a signal — it is
what a single fixed-rate lane walking a fixed list looks like, rather than a mix of
sources.

The hourly check-in stayed entirely in observation mode. It logged **25** `sweep_stalled`
notes (all video-graph), **20** `term_starvation`, **9** `pitchable_rate_term_supply_degraded`,
and fired **8** free `harvest_kick` backstops. It never escalated to the paid fix-agent,
which is why Anthropic spend is $0.

---

## 3. Supply: one lane, walking its own output

| Lane | Runs | Seeds | Channels | ≥6 | Rate | State |
|---|---:|---:|---:|---:|---:|---|
| Recommended-videos feed | 3 | 10,717 | 2,214 | **81** | 3.7% | Lap 8, **2,538 seeds left** (~6h) |
| Keyword search | 565 | — | 811 | 44 | **5.4%** | **3 active terms** |
| Peer network | 12 | 123 | 119 | 2 | 1.7% | Book fully walked, refills ~16 seeds/2h |
| Guest-link mining | — | — | 2 | 0 | 0% | Runs inside the peer lane |
| Video-graph sweep | 28 | **0** | 0 | 0 | — | Dead on $50 cap, **3,390 seeds unwalked** |
| Podcast crossover | 1 | — | 0 | 0 | — | Ran once, nothing, as usual |
| Comment sweep | 0 | — | 0 | 0 | — | Paused by Casey 08-20 |

**The recommended-videos lane closed lap 7 at 11:11:36Z on 08-31** and immediately
opened lap 8. The boundary file records the decay precisely:

| | lap 1 | lap 6 (closed 08-28) | lap 7 (closed 08-31) |
|---|---:|---:|---:|
| qualified / seed | 0.45 | 0.014 | **0.007** |
| $ / qualified lead | — | 3.4¢ | **5.0¢** |

**Why it keeps re-lapping is a deliberate rule, not an oversight.** `extend-seeds.ts`
gates the relap on `RELAP_MAX_USD_PER_LEAD`, default **$0.25 per lead**, not on a
per-seed yield floor. The comment in that file explains why: lap 3 dropped 86% on
per-seed yield while costing 1.6¢ per lead, and a yield gate would have switched off
the cheapest source in the pipeline. At 5.0¢ the lane is nowhere near the ceiling, so
it will keep re-lapping for a long time. There is also a zero-qualified backstop, added
08-17, for the case where `usd_per_qualified` is null.

That rule is right and I did not touch it. But the consequence is worth stating: **the
lane will keep running long after it stops finding much**, because cheap and productive
are different questions and only one of them is gated.

Meanwhile keyword search had the **best hit rate of any lane (5.4%)** on **three active
terms**, with the anti-starvation floor reporting `NO never-run and NO cooled proven
terms remain` on essentially every pass. 562 of 565 passes faded. The terms are not bad;
there are none.

---

## 4. The finding: about one in six pitchable leads is a tarot channel

Of the **127** pitchable leads today, **22 (17.3%)** match tarot / astrology / oracle /
psychic / channeller / numerology / reiki keywords against channel name plus description.

It is not a one-day fluke. Daily share since 08-18:

| Date | ≥6 | spiritual | % |
|---|---:|---:|---:|
| 08-18 | 188 | 7 | 3.7 |
| 08-19 | 446 | 64 | 14.3 |
| 08-20 | 265 | 26 | 9.8 |
| 08-21 | 231 | 29 | 12.6 |
| 08-22 | 276 | 30 | 10.9 |
| 08-23 | 285 | 33 | 11.6 |
| 08-24 | 163 | 24 | 14.7 |
| 08-25 | 200 | 36 | 18.0 |
| 08-26 | 215 | 21 | 9.8 |
| 08-27 | 134 | 10 | 7.5 |
| 08-28 | 163 | 35 | 21.5 |
| 08-29 | 97 | 15 | 15.5 |
| 08-31 | 127 | 22 | 17.3 |
| **total** | **2,790** | **352** | **12.6** |

**Half of them do not land in the catch-all bucket.** Today: 12 in `Other`, but **8 under
`Coaching & Consulting`** (half that category for the day) and 2 under
`Transformation & Performance Coaching`. On a per-niche report they read as exactly the
leads we want.

**Accumulated in the pools:** 351 of 3,860 `approved_hold` (9.1%) and 334 of 4,980
`needs_contact` (6.7%), so ~**685 of the 8,840** found-and-never-contacted. The standing
pool share (7.8%) is *lower* than the daily arrival share (12.6%), which means it is
rising, not settling.

**Why the scorer passes them is defensible.** It asks whether a channel is a service
business that could hire a YouTube strategist. A tarot reader with 20k subs sells a
service, books calls, and wants views to become clients — it passes honestly. The
question the business actually sells against is high-ticket B2B (lawyers, financial
advisors, agencies, clinics, consultants), and nothing in the pipeline asks that.

**Caveat, stated plainly:** this is keyword matching, not classification. It will carry
some false positives and will miss anything avoiding those words. 17% is close, not
exact.

**Nothing was excluded or changed.** Casey's standing rule (memory, 2026-08-09 niche
corrections) is to filter liberally and to ask before adding a new exclusion category
rather than add one speculatively. Related off-ICP smell noticed in the same sample and
not quantified further: used-car / RV / boat dealerships (5 keyword matches today).

---

## 5. Fix shipped

**`a6d07f3` (youtube-lead-finder-v1) — don't relaunch a lane that is dead until a human
raises its cost cap.**

The video-graph lane crossed its **$50 lifetime** cap on 08-28. Its own loop prints the
situation unambiguously: *"The lane is now DEAD until VIDEO_SWEEP_MAX_USD is raised —
waiting will not release it."* `video-graph-sweep-refill.timer` was not listening. It
ticked **28 times** this cycle, and each tick paid a full **69,690-row psql seed rebuild**,
stopped and started the unit, and **rewrote the state file**.

That last part is the real defect, and it is the exact failure mode section 7b of
`checkin.ts` was written about on 08-29: a rewritten state file makes a dead lane read
as fresh to every liveness check. The check-in *diagnosed* it correctly **25 times this
cycle** and nothing acted on the diagnosis. Detection without suppression.

The fix makes `refresh-video-seeds.sh` cap-aware, before the psql rebuild:

- **Resolves the cap the way the walker will**, in the same order: `VIDEO_SWEEP_MAX_USD`
  in its own env → the value systemd hands the sweep unit (`systemctl show -p Environment`)
  → the default parsed out of `video-graph-sweep-loop.sh`. So raising the cap by **any** of
  the three routes releases the skip on the next tick with nothing else to remember.
- **Reads lifetime spend from the walker's own state file**, the same counter it caps on.
- **Skips only when both numbers parse.** An unreadable state file or unresolvable cap
  falls through to the normal path: this guard may stop a dead lane, never a live one, and
  never on a number it could not actually read.
- **Leaves the state file untouched on purpose**, so the lane reads stale rather than alive.
  Safe to do: `video_graph_sweep` is deliberately absent from the `sweepChecks` staleness
  list in `checkin.ts`, so going stale escalates nothing, while the 7b progress check reads
  file *contents* and keeps working.

Same shape as the block-aware campaign harvest (orchestrator `4f3a282`): when a wall is
known and a human owns the lever, rest against it instead of hammering it.

*Verified live, four ways:* `bash -n` clean; ran against the real capped lane and it
skipped, exit 0, state-file mtime identical to the nanosecond, service not started, one
`noop` line in `logs/video-graph-sweep-refill.jsonl`; fell through correctly at a raised
cap of both $75 and $100; falls through when either number is unreadable.

**No second fix shipped.** The other candidates were all decisions rather than defects:
the relap economics gate is working as designed and is a spend policy, the tarot share
is Casey's exclusion call, and term supply has no code fix. Inventing churn there would
be worse than nothing.

---

## 6. Open, carried

- **The tarot / astrology share.** New today as a measurement, two weeks old as a fact,
  rising. Untouched pending Casey's call.
- **One lane carries the pipeline, and its seeds are our own output.** 81 of 127. Lap 8,
  0.007 qualified/seed against 0.45 on lap 1, ~6 hours of road before lap 9. It cannot
  reach any creator not already adjacent to something we own.
- **The video-graph lane is off, fifth day.** 3,390 seeds at 2.7¢/lead lifetime, the only
  lane whose seeds are *not* recycled from our own results — which given the point above
  is worth more than the cost saving. Today's fix stops the thrash, not the stop. The
  durable version remains a per-lap cap refresh, the way the sibling lane already does it.
- **Term supply, carried eleven days.** 3 active terms, 20 starvation observations, 8
  harvest kicks, 562 of 565 passes fading. Keyword search still has the best hit rate of
  any lane, which is the whole frustration.
- **The recovery lane appears to have moved 14 leads** from `needs_contact` to
  `approved_hold` (the +63/+49 and +78/+64 gaps are both exactly 14). Consistent with it
  working; the matching deltas are the evidence, not a direct count.
- **Peer sweep is now a trickle lane.** Book fully walked, refills ~16 seeds every 2h,
  2 pitchable for the cycle.

---

## 7. Decisions for Casey

1. **The tarot and astrology channels.** ~1 in 8 of everything found over two weeks,
   share rising, ~685 already parked. Exclude the category (one line in the finder's
   exclusion list), leave it, or eyeball ten first. Nothing changed pending your word.
2. **Raise the video-graph $50 cap, or leave it off.** Fifth day. 3,390 seeds, 2.7¢/lead,
   and the only non-recycled seed source in the pipeline.
3. **Top up OpenRouter within ~2 weeks.** 18 days at $17.46/day on $321.85. Not urgent,
   and the figure is trustworthy now that it comes off the account meter.
4. **Seed and term supply.** Still the ceiling on everything, and now the *only* ceiling
   given the machine itself ran perfectly this cycle.
