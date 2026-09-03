# Lead Run Analysis — 2026-09-03

Cycle: 2026-09-02 07:00Z → 2026-09-03 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-03.json`.
HTML debrief: [lead-run-2026-09-03.html](lead-run-2026-09-03.html).

**Headline:** the ready-to-write pool gained **+627**, the biggest single-day gain
on record, beating the 480 of the 07-09 debut run and 3.5× yesterday's 177.
**591 of the 627 came from the contact-recovery lane**, not from finding, and this
is the first cycle where the per-pass logs prove that lead by lead rather than
inferring it from pool arithmetic. The `needs_contact` backlog fell **538**, from
4,888 to 4,350, its second consecutive fall and six times the size of the first.

Two things underneath it, one of which needs Casey.

**OpenRouter is 2.7 days from empty.** Balance $223.07, burning **$82.05/day**
against $16.73 yesterday. The jump is not a fault: yesterday's enrichment fix took
enrichment from 96 leads a cycle to **556**, and enrichment is the majority of LLM
spend and is metered nowhere. If the account empties, everything stops at once,
because scoring, both discovery sweeps, enrichment and the recovery lane all bill it.

**Discovery wrote nothing for the last five hours of the cycle.** The YouTube key
pool hit its daily limit at ~02:00Z, five hours before the midnight-PT refill. The
video-graph lane stopped correctly but its loop relaunched 27 times into the wall.
The recommended-videos lane did not stop at all: it silently switched to the retired
RapidAPI mirror and ran **4h41m producing nothing** while its log read healthy.

Three fixes shipped across two repos, all verified. Zero fatal signatures, zero
scoring failures, zero hours halted, $0 Anthropic for the seventh day.

---

## 1. The numbers

| Metric | 09-03 | 09-02 | 09-01 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+627** | +177 | +63 |
| …of which from the recovery lane | **591** | unclear | — |
| `approved_hold` pool | **4,663** | 4,036 | 3,860 |
| `needs_contact` pool | **4,350** | 4,888 | 4,980 |
| Total found, never contacted | **9,013** | 8,924 | 8,840 |
| New channels found | 2,817 | 2,524 | 3,146 |
| Pitchable (score ≥ 6) | 90 | 85 | 127 |
| Emails verified | **56 (62%)** | 31 (36%) | 49 (39%) |
| Leads enriched | **556** | 96 | 68 |
| Hours with zero channels written | **5** | 0 | 0 |
| Campaign sessions | 21 / 21 | 30 / 31 | 17 / 17 |
| Finder runs | 314 | 256 | 565 |
| Fresh pitchable (campaign lane) | 10 | — | — |
| Fades · discovers · promotes | 298 · 319 · 313 | — | — |
| Hard stops · quota stops · time-budget stops | 13 · 1 · 8 | 25 · 0 · 5 | 3 · 0 · — |
| Term-starvation observations | 25 | 24 | — |
| Hours halted | 0 | 0 | 0 |
| Anthropic API spend | $0.00 | $0.00 | $0.00 |
| OpenRouter, account meter | **$82.05/day** | $16.73/day | $17.46/day |
| OpenRouter balance | **$223.07 (2.7 days)** | $305.13 (18.2 days) | $321.85 (18.4 days) |

Per-lane discovery:

| Lane | Runs | Channels | Score ≥ 6 | Hit rate | Seeds left |
|---|---:|---:|---:|---:|---|
| Recommended-videos feed | 16 | 1,568 | 44 | 2.8% | 7,828 (~0.8 days) |
| Video-graph sweep | 28 | 787 | **34** | **4.3%** | 3,246 (~1.5 days) |
| Keyword search | 314 | 362 | 10 | 2.8% | term-starved, 25 notices |
| Peer network | 10 | 100 | 2 | 2.0% | **18** |
| Podcast crossover | 1 | 0 | 0 | — | — |
| Comment sweep | 0 | 0 | 0 | — | paused by Casey 08-20 |

Niches among the 90 pitchable: Real Estate 18, Coaching & Consulting 13,
Transformation & Performance Coaching 12, Health & Wellness Clinics 6, Business
Growth Coaching 5, Marketing & Growth Agencies 2, Legal Services 2, and 28 in the
catch-all. Tarot/astrology word-match: **5 of 90 (5.6%)**, in line with yesterday's
5%. Still Casey's undecided call; nothing changed.

---

## 2. What actually happened

### The recovery lane produced 16× what finding did, and the logs finally prove it

Yesterday's debrief said the backlog was draining but could only credit "a handful"
of it to the recovery lane specifically, because the verify passes were tiny (1 to
10 leads each) and the 129-lead drain was arithmetic on two pool sizes. Today the
two line up exactly. Every `bloodhound_verify` pass in `logs/campaign-*.jsonl` is
followed within one minute by a `parked_gain` in `logs/orchestrator-*.jsonl`:

| Time (Z) | Leads verified | Parked gain ≤60s later |
|---|---:|---:|
| 08:30 | 38 | +21 |
| 15:10 | 41 | +29 |
| 19:11 | 200 | **+152** |
| 22:43 | 200 | **+152** |
| 02:57 | 200 | **+133** |
| 06:27 | 156 | **+104** |
| **Recovery total** | | **591** |
| Everything else, scattered | | 36 |
| **Cycle total** | | **627** |

**Cause: the collect batch widening from 40 to 150 on 2026-09-02.** Yesterday's
note in CLAUDE.md recorded that change and observed the verify half was "fully
drained (queue depth 1 of a 200 batch)". Three collect passes of 150 ran this cycle
(13:07, 20:45, 02:57), the queue filled, and verify went to full 200-lead batches.
Conversion is roughly 65-76% of each batch.

The collect log confirms the collecting half is the bottleneck, not the converting
half: the 02:57 pass reports `Collected 95 contact points from 37/150 leads`, so
about a quarter of walked leads yield anything at all, and it skips 8-9 methods per
lead. The pool still holds 4,350.

### OpenRouter went from 18 days of runway to 2.7 in one cycle

The account meter (`total_usage` from the provider, not one repo's log) moved
1004.87 → 1086.93, exactly $82.05. Prior two days were $17.34 and $16.72.

Attribution, verified against Postgres:

- Finder's own spend log: **$4.04** (graph-sweep $2.31, video-graph $1.13,
  finder-agent $0.43, misc $0.18). This is the only metered slice.
- `enrichment.runs` rows in the cycle window: **556**, against 96 the prior cycle
  and 68 before that.
- Unexplained remainder: **$78**. 556 × ~$0.14/lead ≈ $78.

So the jump is entirely enrichment, and entirely a consequence of yesterday's fix
working. Yesterday 28 of 48 enrichment batches did zero work; today none did.

This is the known blind spot in
[../costs/enrichment-anthropic-token-costs.md] and the `openrouter-burn-is-enrichment`
memory: enrichment writes no spend log, has no cost cap, and ignores the halt flag.
Every other lane has a lifetime or per-lap cap. The 2026-08-25 precedent is that a
dry account darkens the entire pipeline, and the only existing guard is
`tryAutoClearHalt`'s `openrouter_credits` probe, which is strictly post-mortem: it
restarts things after Casey tops up.

### Discovery went dark for five hours, and one lane faked it

Hourly channel writes from `leads.lead_candidates`:

```
07Z 167  08Z 115  09Z 123  10Z 150  11Z 135  12Z 129
13Z 127  14Z 140  15Z 123  16Z 112  17Z 186  18Z 236
19Z 308  20Z 217  21Z 179  22Z 181  23Z 174  00Z  13
01Z   2  02Z-06Z  ZERO
```

Root cause: the 64-key direct pool exhausted its daily allowance at ~02:00Z. Quota
refills at midnight PT (07:00Z) and at no other time. Writes resumed at 07Z (49).
This is consistent with the `youtube-key-pool-exhausted-vs-banned` memory: on
2026-09-02 the pool read 7 working / 1 suspended / 58 merely out of daily units.

The two lanes diverged:

- **video-graph-sweep did the right thing.** It raised
  `STOP: YouTube key pool exhausted mid-triage`, did not checkpoint the partial
  chunk (so a resume re-walks it rather than losing it), and exited RESUMABLE. Its
  only fault was the loop around it, which retried on a flat 15-minute pause:
  **27 consecutive idle runs** from 00:04Z to the reset, 16 of today's session logs
  carrying the exhaustion line.

- **graph-sweep (recommended-videos) did not stop, and this is the real defect.**
  `YouTubeClient.getAuto()` caught `AllKeysExhaustedError` and, because a RapidAPI
  config was present, set a sticky `fellBackToRapidApi` flag and served the rest of
  the run from the mirror. RapidAPI was retired 2026-08-10 and its account reads
  **−55,328 of 110,000 requests remaining (150.3% used)**, so every call failed.
  Those failures surface as `YouTubeApiError`, which the sweep's candidate loop
  correctly treats as one bad channel (`state.stats.failed += 1; continue`), so the
  run never hit its stop condition. The process ran **4h41m** (confirmed by
  `ps -o etime`, 04:41:43 at the point of restart).

  The log read healthy throughout, which is why nothing caught it. Edge discovery
  scrapes watch pages and needs no API key, so chunks kept advancing with 100+
  net-new edges each. Only the *channel fetch* needs a key. Its real counters were
  frozen for the entire 4h41m: `+4970 qualified`, `45 llm calls`, `$39.4380`,
  identical on every chunk line.

This is the second consecutive cycle where a step reported success while doing
nothing. Yesterday it was enrichment; today it is the main discovery lane. Both had
the same shape: the failure mode produced a success-looking signal, and the guard
that should have caught it was watching a different variable.

---

## 3. Fixes shipped

### `youtube-lead-finder-v1` — `02b40ef`

**The `auto` YouTube backend is now direct-keys-only. A drained pool raises instead
of degrading.**

`getAuto()` no longer falls through to RapidAPI; `AllKeysExhaustedError` propagates
to the caller. Both sweeps already had the correct guard for it (graph-sweep.ts:445
and video-graph-sweep.ts:411 both catch it, set a stop reason, checkpoint and exit
RESUMABLE) and the client was swallowing the signal before either could see it.

This is what CLAUDE.md has documented `auto` as doing since RapidAPI was retired:
*"when the direct pool drains, a run now halts instead of degrading. That's
expected."* The code had simply not caught up. Explicit
`YOUTUBE_API_BACKEND=rapidapi` still works; only the unrequested slide onto a dead
backend is gone. `describeBackend()` also stopped printing "RapidAPI fallback
available" on every run, which was a standing invitation to look for a safety net
that has not existed since August.

**Both sweep loops now rest until the quota refills** instead of relaunching every
15 minutes. `sleep_until_quota_reset()` computes the wait from
`TZ=America/Los_Angeles date -d 'tomorrow 00:05'`, so it stays correct across the
November DST change without a hard-coded offset, floors at the normal pause and
caps at 24h. Being clock-derived, it self-clears: if Casey adds keys mid-day it
costs at most one extra sleep and needs no intervention.

Each loop writes a **quota-rest marker** while asleep
(`logs/graph-sweep-quota-rest.json`, `logs/video-graph-sweep-quota-rest.json`)
carrying `since` and `until`, deleted on wake.

Verified: `tsc` clean, **241/241 tests pass**, both loops `bash -n` clean. The
`tests/youtube/auto-backend.test.ts` suite was rewritten to assert the new law
(no degrade on a drained pool, fail fast on repeat calls, RapidAPI untouched even
when configured). Live: `graph-sweep.service` restarted, which also ended the
in-flight blind run; it resumed from seed 4916 on 64 direct keys with zero fallback
lines.

### `youtube-outreach-orchestrator-v1` — `49bd1d0`

**The hourly check-in no longer reads a lane resting on quota as a stalled daemon.**

This is a companion to the fix above and prevents a regression it would otherwise
have introduced. The new sleep can exceed `maxAgeH: 8`, and `sweep_daemon_stale`
escalates to a `claude -p` fix-agent. An agent cannot refill a daily quota, so that
would have been waste, hourly, for a lane behaving correctly. Same reasoning that
already keeps the term-supply wall and the sweep-progress stalls off the anomaly
list.

`readQuotaRestMarker()` reads the marker and records
`sweep_daemon_resting_on_quota` as an OBSERVATION instead. It is only honoured
while the marker's own `until` is still in the future, so a marker left behind by a
killed loop cannot mask a genuine stall.

Verified against fixtures both directions, with `LEAD_FINDER_REPO_PATH` and
`AUTOPILOT_OBSERVATIONS` redirected so nothing real was touched:

- live marker (`until` = +3h) + 20h-old state file → `sweep_daemon_resting_on_quota`
  observation, `healthy`, exit 0.
- expired marker (`until` = −1h) + same state file → `sweep_daemon_stale` anomaly,
  exit 7.

`tsc` clean.

---

## 4. Open, carried

- **OpenRouter runway, 2.7 days.** Spending call, see below. This is the only item
  with a deadline.
- **Enrichment has no meter and no cap.** Carried; now demonstrated to be capable of
  a 5.8× swing overnight.
- **Discovery supply.** Recommended-videos has 7,828 seeds (~0.8 days),
  video-graph 3,246 (~1.5 days), peer network **18**. Both producing lanes walk
  material we generated ourselves. Carried 13 days.
- **Keyword search is term-starved**, 25 starvation notices this cycle, 24 the day
  before. Carried.
- **YouTube quota is now the binding limit on finding**, ahead of seeds or terms.
  New today.
- **Peer-sweep is paused on a dead RapidAPI meter.** `quota-state.json` reads
  `requests: -55,328/110,000 (150.3%)` and `search: -1,301/2,000 (165.1%)`, negative
  values from a blown account, and the guard pauses on them. Deliberately left
  alone: the lane has 18 seeds left in its entire book, so the loss is near zero and
  a speculative change on a quiet day is not worth it. Worth fixing when the lane is
  refilled. Matches the `rapidapi-free-tier-stops-the-pipeline` memory.
- **Tarot/astrology share**, 5.6% today. Casey's undecided call, untouched.
- **Comment sweep** stays off per Casey's 08-20 instruction.

---

## 5. Decisions for Casey

1. **Top up OpenRouter today or tomorrow.** $223 at $82/day. If it empties,
   scoring, both discovery sweeps, enrichment and the recovery lane all stop
   together, which is what happened on 2026-08-25.
2. **Whether enrichment gets a spending ceiling.** It is the majority of the bill
   and the only lane without a cap. A ceiling would also stop leads becoming
   writable, so this is a genuine trade rather than an obvious fix.
3. **Add YouTube keys.** The pool ran dry five hours early. Today's fixes make that
   failure clean and visible; they create no quota. One command on the Mac
   (`casey-assistant/tools/sync-youtube-keys-from-notion.py --apply`).
4. **Widen the recovery lane's collect batch again.** 40 → 150 produced today's
   record. The verify half cleared full 200-lead batches all day at ~65-76%
   conversion and the collect half is the bottleneck. 4,350 leads remain in the pool
   and the lane is out-producing fresh discovery 16 to 1.
5. **Note that raising the video-graph cap paid off.** It came back at a 4.3% hit
   rate, the best of any lane, and 34 of the day's 90 pitchable.
