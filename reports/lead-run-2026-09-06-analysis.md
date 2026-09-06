# Lead Run Analysis — 2026-09-06

Cycle: 2026-09-05 07:00Z → 2026-09-06 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-06.json`.
HTML debrief: [lead-run-2026-09-06.html](lead-run-2026-09-06.html).

**Headline:** the ready-to-write pool gained **+151**, more than double each of the
last two days, and **only 22 of those came from channels found today**. The other
129 came from working the pile of creators we already had. The `needs_contact` pool
fell 109 while taking in 20 new arrivals, the second fall on record and much the
bigger one. Recovery is now clearly outproducing discovery, and it spends no YouTube
quota at all.

**The lane doing most of that work was being killed by its own timer.** The contact
collector runs for ~46 minutes as a background job, and yesterday it was moved onto
a short-lived systemd unit. When such a unit exits, Linux kills everything left in
its process group, and running in the background does not escape that. Both scheduled
passes died about 30 seconds in: 6 of 150 leads walked, then 13 of 150, while the
lane's bookmark stepped past all 300. **281 leads were marked walked without anybody
looking at them.** Fixed on both sides, rewound by hand, and verified with a full
pass running live.

**The Apify email scraper has about three days of money left.** Four batches ran
overnight at $7.02 each, so $28 of the $100 monthly allowance is gone and $53 remains
after the reserve. Its returns are also falling fast: 89, 75, 67 and 54 emails found
per 100 channels, and $0.638, $0.201, $0.292, $0.319 per recovered lead. The 92%
figure in the standing orders was the first 52 channels of a best-first queue and
should not be planned against.

Three fixes shipped, all in the orchestrator repo, all verified live. Zero fatal
signatures, zero halted hours, zero scoring failures, **$0.00** of Anthropic spend.

---

## 1. The numbers

| Metric | 09-06 | 09-05 | 09-04 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+151** | +71 | +71 |
| `approved_hold` pool | **4,956** | 4,805 | 4,734 |
| `needs_contact` pool | **4,243** | 4,352 | 4,344 |
| Total found, never contacted | **9,199** | 9,157 | 9,078 |
| New channels found | 2,737 | 2,162 | 1,581 |
| Pitchable (score ≥ 6) | 103 (3.8%) | 79 (3.7%) | 64 (4.0%) |
| Emails verified from today's finds | 22 | 47 | 37 |
| Hours with zero channels written | **0** | 1 | 17 |
| Campaign sessions | 6 / 6 | 28 / 28 | 35 / 36 |
| Finder runs | 252 | 264 | 151 |
| Fresh pitchable (campaign lane) | 11 | 12 | 18 |
| Fades · discovers · promotes | 251 · 257 · 252 | 243 · 271 · 264 | 119 · 154 · 152 |
| Hard · quota · time-budget stops | 1 · 0 · 5 | 21 · 0 · 7 | 32 · 0 · 3 |
| Anthropic spend | **$0.00** | $0.00 | $2.04 |
| OpenRouter (finder log) | $3.82 | $3.09 | — |
| OpenRouter (account meter) | $21.67/day | $13.53/day | — |
| OpenRouter balance / runway | $158.56 / 7.3 d | $180.23 / 13.3 d | — |

The 22 verified emails is a queue snapshot, not a conversion rate. 61 of today's 103
pitchable leads have not reached the verify lane yet. Of the 42 already ruled on, 22
got a usable address, which is the usual ~52%.

## 2. Where the leads came from

| Lane | Channels | Score 6+ | Rate | State |
|---|---:|---:|---:|---|
| Recommended-videos feed | 1,694 | 57 | 3.4% | Walking, 7,774 seeds left (~0.8 days) |
| Video-graph sweep | 717 | 34 | 4.7% | 1,900 seeds walked after the $100 cap raise, 217 left |
| Keyword search | 216 | 11 | 5.1% | 252 passes for 11 leads; term supply, not a fault |
| Peer network | 109 | 1 | 0.9% | Seed book fully walked |
| Guest-link mining | 1 | 0 | — | Trickle |
| Comment sweep | 0 | 0 | — | Paused by Casey 08-20, working as intended |

Parks by source, in the cycle window:

| Source | Parked | Note |
|---|---:|---|
| Apify endspec scraper | 70 | 3 batches in-window (11 + 35 + 24) |
| Bloodhound verify pass | 21 | 20 at 00:52Z, 1 at 04:01Z |
| Channels found today | 22 | Fresh find → verified email |
| Earlier finds finishing verification | ~38 | Arithmetic remainder on the pool delta |

## 3. The bug: a timer that kills its own work

`recovery-lane.service` was installed yesterday as `Type=oneshot`. The lane dispatches
the collect pass with `spawn(..., { detached: true })` and returns immediately, so the
unit deactivates within seconds. systemd's default `KillMode=control-group` then kills
everything left in the unit's cgroup. `detached: true` makes a child a process-group
leader; it does not move it out of a cgroup. Only `KillMode` does.

Evidence, all measured:

- `recovery-lane.service` went `inactive (dead)` at 07:01:20Z, 30 seconds after the
  07:00:50Z dispatch.
- The two timer-dispatched passes wrote 6 and 13 lead lines to
  `logs/bloodhound-collect.log` and never printed the CLI's completion line.
- The campaign-dispatched pass of 09-05 12:03Z, launched from the always-running
  `autopilot-campaign.service`, wrote all 150 and completed normally.
- Controlled test with `systemd-run --service-type=oneshot` on a script that spawns a
  detached sleeper: default `KillMode` left **0** survivors, `KillMode=process` left **1**.

Note this corrects yesterday's commit message `2aec64b`, which recorded that a detached
child holds the unit in `activating`. It does not. The unit deactivates and the child dies.
The wall-clock timer schedules that commit shipped are still right for their own reason.

**Fix 1, the unit.** `KillMode=process` on `recovery-lane.service`. The unit and its
timer are now committed in `scripts/autopilot/systemd/` and installed by
`scripts/autopilot/install.sh`, so a reinstall cannot lose the line. Check after any
edit: `systemctl show recovery-lane.service -p KillMode --value` must read `process`.

**Fix 2, the code, because a kill is not special.** An OOM, a reboot or a `systemctl
stop` truncates a pass the same way, and the damage is silent every time. The lane now
stores `collectResume` (the cursor and lap count as they stood before the dispatched
batch) and, on the next pass, reads the tail of the collect log: if the newest pass
header has no `Collected ...` line after it, that pass did not finish, so the cursor is
put back. Capped at `MAX_CONSECUTIVE_REWINDS = 3` so a child that dies every time cannot
pin the walk on one batch, which is the 08-27 walking-in-place failure in reverse.
An unreadable or absent log returns `null` and never rewinds.

**Repair.** The cursor was rewound by hand to `(tier 1, 2026-08-20T07:18:03.255Z,
recCWem5yVoF5KNrs)`, the position immediately before the first of the two lost batches,
so all 281 leads are back in front of the collector. A full pass was then run under the
fixed unit and is walking normally, resolving a website for about 6 of every 8 leads.

Commit: `08238bb` in `youtube-outreach-orchestrator-v1`.

**One thread left open for tomorrow.** The verification pass is alive and working, but
slower than the 18.5s per lead the 150-lead batch was sized on: 8 leads in the first
30 seconds, then a long stretch with the worker process pegged at 100% of a core and
only two open sockets, so it is CPU-bound rather than waiting on the network. Node is
single-threaded, so one expensive parse stalls all 8 concurrency slots. The obvious
suspect is yesterday's `MAX_HTML_BYTES` change feeding multi-megabyte About pages
through the whole-document regexes in `web.ts` and `methods/33-about-text.ts`, but
**that is a suspicion, not a measurement**, and the 09-05 12:03Z pass completed all 150
after the same change. Time one full pass tomorrow before touching anything.

## 4. The second fix: the watchdog could park itself

`autopilot-checkin.timer` ran on `OnUnitActiveSec=1h`, which schedules the next run from
the moment the last one ends, and `autopilot-checkin.service` had no start timeout at
all (`TimeoutStartUSec=infinity`). `checkin.ts` can spawn a `claude -p` fix agent. One
wedged agent would have held the unit in `activating` forever and stopped the pipeline's
only health check, with nothing anywhere reporting it. That is the exact shape logged
against 08-12, 08-27, 08-29, 09-02 and, today, the recovery lane.

Now `OnCalendar=*-*-* *:11:00`, which keeps the historic slot and cannot be stalled by a
long run, plus `TimeoutStartSec=45min`, roughly 20x the observed 2.7 second run. Verified:
`NextElapseUSecRealtime` returns a date, `TimeoutStartUSec` reads 45min.

Commit: `2fc4f79` in `youtube-outreach-orchestrator-v1`.

## 5. Apify: the numbers moved, and the plan should move with them

| Batch (UTC) | Emails found /100 | ZeroBounce checks | Parked | Cost per parked lead |
|---|---:|---:|---:|---:|
| 00:13 | 89 | 31 | 11 | $0.638 |
| 02:21 | 75 | 77 | 35 | $0.201 |
| 04:21 | 67 | 70 | 24 | $0.292 |
| 06:21 | 54 | 54 | 22 | $0.319 |

Four batches, $28.08, 92 parked leads. Budget left after the $10 reserve: about $53,
which is roughly seven more batches, so **the lane stops by itself around midday Tuesday**
and exits 0 quietly for the rest of the billing month, on purpose, so a timer failure
never looks like a lane failure. Nothing will page anyone when that happens.

The planning number in `docs/standing-orders.md` (92% of channels return an email, ~59%
become usable leads, 3,164 leads for ~$222) came from the first 52 channels of a queue
ordered best-first. After 400 channels the measured rate is about **25 parked leads per
100 channels at ~$0.30 each**, still falling. A full sweep at that rate buys roughly 790
leads for $222 rather than the ~1,870 the pilot implied. Still the only route to an
address hidden behind YouTube's "View email address" button. Casey's spend call.

## 6. Quota and the keyword lane

The campaign ran 252 finder passes for 11 fresh pitchable leads, with 251 fades and 24
term-starvation observations. This is the documented state of the keyword lane, not a
fault: the fresh-term reserve drained on 08-12 and the lane runs on whatever autocomplete
harvest and probe discovery refill.

What it costs is worth stating plainly. A keyword search is 100 quota units; the graph
sweeps run on 1-unit calls plus free page scraping. At 06:31Z the video-graph sweep
stopped with `YouTube key pool exhausted mid-triage`, and its own message adds that the
chunk was not checkpointed so a resume re-walks it. The lane that emptied the pool is
overwhelmingly the one returning 11 leads for 252 passes. Capping keyword passes per
session while the reserve is empty would hand most of a day's quota back to the sweeps.
That is a lane-priority change, so it is Casey's, and it is carried as recommendation 2
rather than shipped.

## 7. Brave is capped again, and it no longer matters

Today's collect passes still log the all-keys `402 Usage limit exceeded` line, so the key
raised yesterday is spent again. Website resolution held anyway: 119 of 150 leads on the
last full pass and 6 of 8 on the pass running now. That is yesterday's `MAX_HTML_BYTES`
fix on the free channel-page route doing exactly the job it was written for, being the
thing that stops a paid search being a single point of failure.

## 8. Decisions for Casey

1. **Apify monthly cap.** It stops around Tuesday midday at $0.30 per recovered lead and
   falling returns. Raise, or accept the stop.
2. **Cap or pause keyword search while its term reserve is empty**, to give the sweeps
   the quota back. 252 passes for 11 leads.
3. **Top up OpenRouter.** $158.56 at $21.67/day is 7.3 days. Most of it is the enrichment
   backfill, which keeps no spend log, so the account meter is the only honest figure.
4. **Brave key 2's cap**, if collect throughput matters more than the free route's ~80%
   resolution rate.
