# Lead Run — 2026-07-12 — Technical Analysis

**Cycle:** 2026-07-11T07:00:00Z → 2026-07-12T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** A healthy, boring frontier day — that the automated debrief nearly misreported as dead because its measurement window had collapsed to 20 minutes. Bug found and fixed.

---

## Headline numbers (corrected)

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **162** | leads discovered in-cycle now in `approved_hold` |
| `approved_hold` pool | 1,770 → **1,826** | net **+56** (releases/reclassification net out ~106) |
| Pitchable found (score ≥6) | **409** | |
| Verified email (of pitchable) | **162 (~40%)** | the rest lack a deliverable email |
| Swept → `needs_contact` | **201** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **2,557** | up ~200 on the cycle |
| Finder passes | **131** | across 8 sessions started / 4 completed |
| Fresh pitchable across passes | **398** | ≈3.0 / pass |
| Zero-yield passes | 35 | **scattered**, no contiguous stall |
| Hard stops | 3 | all transient, self-healed |
| Claude spend | **$0.00** | check-in fired no fix-agent all cycle |
| Total discovered (all statuses) | 1,391 | 603 below_threshold, 260 unreviewed, 165 demo_excluded |

Per-niche pitchable (top): Health & Wellness Clinics 79 · Coaching & Consulting 71 · Marketing Agencies 61 · Business Growth Coaching 37 · Real Estate & Property 36 · SaaS & Software Demos 27 · Financial Planning 26 · Legal 16 · Sales Training 13 · AI Automation 12.

---

## The instrumentation bug (primary finding)

The debrief agent is handed a grounded JSON snapshot from `scripts/autopilot/debrief-data.ts`. For cycle 2026-07-12 that snapshot read:

```
finder_runs: 4 · fresh_pitchable_sum: 1 · parked_today: null · discovered_today.total: 5
cycle_start_iso: 2026-07-12T07:00:00Z · generated_at: 2026-07-12T07:20:00Z
```

`cycle_start_iso` was **the most-recent PT midnight** (i.e. ~20 minutes before generation), not the start of the cycle that just ended. Mechanism:

- `debrief-data.ts` used `sinceISO = pacificMidnightISO(now)`.
- `pacificMidnightISO(now)` returns midnight PT of the **current** Pacific day.
- The debrief timer (`autopilot-debrief.timer`) fires at **00:20 PT** — 20 minutes into the new day.
- So the window `[sinceISO, now]` was only those 20 minutes → 4 finder passes, 1 pitchable.

Every autopilot debrief would have shipped near-empty and misleading. (The 07-11 JSON looked fine only because that run happened to be generated mid-day at 01:37Z with `cycle_start` = 07-11T07:00Z — an ~18h window by luck of timing, not design.)

### Fix (shipped, orchestrator repo)

`scripts/autopilot/debrief-data.ts`:

```ts
// cycle that just ended: [prev PT midnight, most-recent PT midnight)
const untilISO = pacificMidnightISO(now);                                   // cycle END
const sinceISO = new Date(Date.parse(untilISO) - 24*60*60*1000).toISOString(); // cycle START
```

- `cycleCampaignEvents(sinceISO, untilISO)` now bounds events on **both** ends.
- Added `cycle_end_iso` to the snapshot for transparency.
- `fatalSignaturesToday` and `getLeadsDiscoveredSince` now correctly scan the full cycle.

Verified by re-running the gatherer: window widened to the full 24h, producing 131 runs / 398 pitchable / 409 discovered-pitchable — matching a direct count of the raw JSONL. The corrected snapshot overwrote `logs/autopilot-debrief-2026-07-12.json` and is the basis for this report.

**Residual (minor):** `parked_today` = +56 undercounts the ~162 truly-new because `autopilot-parked-history.jsonl` doesn't yet reach back a full 24h (earliest in-window entry is 07-12T01:18Z = 1,770). Self-corrects once the history file has ≥24h of hourly samples. Not worth a code change.

---

## Shape of the day

131 finder passes, `fresh_pitchable` per pass:

```
[0×15 leading] 7 3 0 9 17 13 4 4 6 1 3 4 6 4 4 4 10 8 8 3 0 2 6 1 3 20 4 2 6 7 1 21 6 0 0 ...
... a long body oscillating 1–11 with occasional teens/20s, 35 scattered zeros total ...
```

- **avg ≈ 3.0 pitchable/pass**, max 21, only 4 passes ≥12.
- **35 zeros, scattered** — the 07-10 signature (17 contiguous 0-yield passes from term-starvation) did **not** recur. The anti-starvation floor + fast dead-term pause + mid-run probe promotion held.
- Leading 15 zeros = startup + core (non-frontier) warmup + the three transient hard-stops before the long frontier session (started 22:32 UTC 07-11, PID held the lock and ran 8+ h) settled in.

### Sessions / hard-stops timeline (UTC)

```
07:23 dry-run · 07:23 live core (maxRuns 15) · 07:50 live core · 08:04 live frontier (maxRuns 100) — reservoir GO
09:31 HARD_STOP run 2   → 09:48 done (parked 1667→1668)
17:43 live frontier — reservoir GO
22:26 live frontier — reservoir UNKNOWN → 22:27 HARD_STOP run 2
22:30 live frontier — reservoir STOCK-UP → 22:31 HARD_STOP run 2
22:32 live frontier — reservoir STOCK-UP → ran clean 8+ h (produced most of the 398)
```

The 3 hard-stops were the campaign's "two consecutive finder failures → hard wall" guard firing correctly. Actual errors (from `campaign-console-2026-07-11-resume*.log`):

- `ERR_MODULE_NOT_FOUND` for `reservoir-check.ts`, `promote-verified-to-hold.ts`, `evaluate-probes.ts`, and package `@supadata/js`
- `YOUTUBE_API_BACKEND must be "rapidapi" or "direct" (got "auto")`

All occurred during **manual resume attempts** (22:26, 22:30) before the finder/email repos were on their working branches with deps installed and env resolved. The 22:32 relaunch had a clean environment and ran the rest of the cycle without incident. This is **branch/deps/env-class** (cf. memory: finder's real branch is `youtube-backend-auto-direct-first`; a fresh clone breaks the campaign), **not** an orchestrator code fault — so no orchestrator change was warranted. See rec #4 for the durable mitigation (a resume pre-flight).

---

## Constraints (unchanged, structural)

1. **Term-supply-limited, not channel-supply-limited.** Frontier passes yield a flat ~3 pitchable each; the proven core is mined out. Lever = widen `FRONTIER_VERTICALS`.
2. **Email verify ~40% is the funnel throttle.** Scoring is no longer the binding constraint — email discovery/verification is. 201/day fall out to `needs_contact` for lack of a deliverable email.
3. **`needs_contact` = 2,557 and growing.** The single largest unbuilt lever. Recovering a third out-yields a day of fresh finding. Deferred pending greenlight.

---

## Ranked next levers

1. **Build the `needs_contact` recovery engine** (`youtube-email-outreach-v1`) — 2,557 parked creators, +200/day. Biggest lever, deferred.
2. **Widen the discovery frontier** — more verticals, not more passes over saturated niches.
3. **Lift the ~40% verify rate** — converts existing found-supply straight into parked leads.
4. **Resume pre-flight** — verify the finder/email repos' scripts + backend resolve before the first pass, so a resume on the wrong branch fails fast with a clear message instead of burning two relaunch cycles.

---

## Changes shipped this cycle

| Repo | Change | Commit |
|---|---|---|
| youtube-outreach-orchestrator-v1 | `debrief-data.ts`: cycle window = trailing 24h ending at most-recent PT midnight (was 20-min sliver at the 00:20 fire); added `cycle_end_iso`; bounded event window on both ends | `autopilot-improve: fix debrief cycle window (was 20-min sliver)` |

No changes to the finder, email-outreach, deep-research, or quick-research repos — the day's issues there were transient env/branch-class and already self-healed; no high-confidence durable fix identified without risking churn.
