# Lead Run — 2026-07-13 — Technical Analysis

**Cycle:** 2026-07-12T07:00:00Z → 2026-07-13T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** The term well ran dry — the 07-09 "term-supply-limited" ceiling hardened into a hard wall — and a dead line of back-off code let the resulting finder failures thrash 168×. The exhaustion is structural; the thrash is fixed.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **115** | in-cycle leads now in `approved_hold` |
| `approved_hold` pool | 1,826 → **1,941** | net **+115** |
| Pitchable found (score ≥6 + host) | **266** | across 375 finder passes = **0.71/pass** (07-12 ≈ 3.0) |
| Verified email (of pitchable) | **115 (~43%)** | verify rate held — the loss was upstream |
| Swept → `needs_contact` | **143** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **2,700** | up ~143 on the cycle |
| Finder passes | **375** | 207 exit-0, **168 exit-1** (45% failed) |
| Zero-yield passes | **265 / 375** | not a contiguous stall — an all-cycle decay |
| Passes ≥12 fresh pitchable | **1** | max single pass = 13 |
| Sessions started / done | 172 / 172 | **168 ended on a `hard_stop`** |
| Discovery passes | **378** | producing **0 net-new terms** (all dedupe vs a 4,438-term table) |
| Fades / promotes / evaluate_probes | 206 / 220 / 222 | verify+promote lane kept draining the backlog |
| YouTube quota stops | **0** | quota never a factor — finder aborted before any search call |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | the exhaustion left no trace in the health signal |

Per-niche pitchable (top): Health & Wellness Clinics 98 · Coaching & Consulting 56 · Real Estate 28 · Financial Planning 24 · Marketing Agencies 16 · Business Growth Coaching 14 · Legal 7 · Sales Training 5 · Practice Growth Coaching 4 · SaaS 3.

---

## The primary finding — term-supply exhaustion (structural)

The 07-09 debrief called it: **term-supply-limited, not channel-supply-limited.** On 07-13 that ceiling became a wall. Three supply layers bottomed out simultaneously, all visible in the finder's own run log:

```
[anti-starvation] active pool exhausted and NO never-run paused terms remain — relying on discovery to invent fresh veins.
[firm-tilt] applied: ranked 0 active terms, selected [0, 0) …
[runner] No active terms to process.
… Aborted: No active terms to process.   → exit 1
```

1. **Active pool mined out.** Every proven-niche term is exhausted (already run, ~2–4% qualified, auto-demoted to negative priority).
2. **The 07-10 anti-starvation reserve is fully spent.** That fix auto-reactivates never-run paused terms when the active pool goes all-negative. On 07-13 the log reads `NO never-run paused terms remain` on **175 / 175** in-window sessions — the ~274-term reserve is consumed. The fix still works; it's just out of fuel.
3. **Frontier discovery is saturated.** The reservoir gate calls `discover-veins.ts`, which asks `claude-sonnet-5` for 40 fresh candidate terms. With **4,438 terms already in the table**, every candidate dedupes:

```
[discover] 4438 terms in table (4438 run). Generating 40 candidates via claude-sonnet-5 [FRONTIER]…
[discover] 0 unique, in-ICP candidates (deduped vs table):
[discover] nothing to write.
```

With no active terms **and** no new discovery, the finder has nothing to mine → aborts → exit 1.

**Net effect:** 266 pitchable / 375 passes = **0.71/pass**, most of it from the tail of the long 07-11 `resume3` session that held the lock into ~08:36Z 07-12 (one `done` posted **+98**). After that handoff the autopilot loop faced the bare wall, and yield collapsed to a trickle of 0s and 1s for the rest of the cycle.

### Why this isn't a miner bug

Two proofs it's exhaustion, not a stall like 07-10:
- **The channel universe is fine** — the finder never got far enough to *see* channels; it aborted at term selection (`Terms processed: 0, Channels seen: 0`). Contrast 07-10, where it kept seeing 322–400 channels/pass but they were already-known.
- **Reactivation had nothing to reactivate** — the 07-10 remedy (`reactivate-untapped.ts`) works by promoting never-run paused terms; there are none left. The remedy is now *upstream* of finding: invent new terms (wider ICP) or work the parked pool (`needs_contact`).

---

## The secondary finding — a dead-code back-off (fixed this cycle)

The exhaustion should have been *quiet*: finder fails → campaign `hard_stop` → `campaign-loop.sh` sleeps 30 min (`QUOTA_WAIT`) → retries. Instead it **thrashed 168× at ~2.5-min intervals**, each relaunch re-running the reservoir pre-flight and a futile Claude-sonnet discovery pass.

**Mechanism.** After a `hard_stop` break, the campaign still runs its final verify+promote and logs a `done` event. The loop's classifier took the *chronologically-last* stop event:

```bash
# before:
tail -6 "$f" | grep -oE '"event":"(quota_stop|hard_stop|time_budget_stop|done)"' | tail -1
```

`done` always trails `hard_stop`, so this **always** returned `done` → the `*)` branch → `CLEAN_PAUSE` (20s), never the `quota_stop|hard_stop` → `QUOTA_WAIT` (1800s) branch. The hard-wall back-off was **dead code from the start**; 07-13 was simply the first day something hammered it continuously. (Verified by replaying the raw JSONL: of the 78 sessions in the 07-13 file, the old classifier returns `done` for 77; the new one returns `hard_stop` for 77.)

**Fix (shipped, orchestrator repo — `scripts/autopilot/campaign-loop.sh`):** classify by the stop *cause*, scanning the tail for `quota_stop`/`hard_stop`/`time_budget_stop` and preferring it over the trailing `done`:

```bash
tail8="$(tail -8 "$f")"
if grep -q '"event":"quota_stop"'       <<<"$tail8"; then echo "quota_stop";       return; fi
if grep -q '"event":"hard_stop"'        <<<"$tail8"; then echo "hard_stop";        return; fi
if grep -q '"event":"time_budget_stop"' <<<"$tail8"; then echo "time_budget_stop"; return; fi
echo "done"
```

Now term-exhaustion (and any real quota/keys/Airtable wall) rests 30 min instead of relaunching in 20s — **~12× fewer relaunches** (≈24/h → ≈2/h) and the same cut to wasted discovery-LLM spend. `time_budget_stop` and clean `done` still take the fast `CLEAN_PAUSE` path, as intended. Change is a pure loop-driver edit — no business logic touched. Verified: `bash -n` clean, and `last_stop_reason` returns `hard_stop` against the live 07-13 log (was `done`).

**Note on cost:** the thrash burned finder-side Claude-sonnet tokens (378 discovery generations) and wall-clock — **not** YouTube quota (0 quota stops; the finder aborted before any `search.list`). That's why the day was cost-safe on the autopilot burn-ledger ($0) yet still wasteful. The wasted spend is on the *finder repo's* Anthropic key, invisible to `burn-ledger.ts`.

---

## The instrumentation gap (open)

`fatal_signatures_today = []`, `burn_today = $0`, no fix-agent fired — despite a **45% finder-failure rate**. The hourly `checkin.ts` watches for (a) fatal error signatures and (b) `approved_hold` flat while the finder produces. Neither tripped:
- `"No active terms to process"` is a clean abort, not a fatal signature.
- `approved_hold` was **not** flat — it rose **+115** as the verify/promote lane drained the *already-found* backlog into parked, independent of any new finding.

The check-in's silence was arguably *correct* (a cheap fix-agent cannot invent net-new terms, so spending on one would be waste) — but it means the health signal is **blind to term-supply exhaustion.** Rec #4 proposes a finder-failure-rate flag that surfaces the condition in the debrief without necessarily firing an agent.

---

## Shape of the day

375 finder passes, `fresh_pitchable` per pass — a slow decay, not a cliff:

```
morning (resume3 tail + early autopilot, 0 exit-1s):  1 0 0 0 1 8 3 3 9 0 0 3 0 1 1 4 2 1 1 2 …
                                                       (yields 4–28/hour, terms still remained)
15:00Z onward — the wall:                              …0 0 0 9 2 0 0 0 6 0 0 0 1 0 1 0 3 0 0 7 0 2 …
                                                       (mostly 0s and 1s; exit-1 climbs to 15–22/hour)
```

- avg **0.71 pitchable/pass**, max 13, **exactly 1 pass ≥12** all cycle.
- **265 zeros** — but *scattered/decaying*, not the 07-10 signature (17 contiguous). The 07-10 anti-starvation floor + fast dead-term pause held; this is a different failure — running *out of terms entirely*, one level up from starvation-within-a-pool.

Hourly finder failures climbed as the reserve drained: 0 exit-1 through 14:00Z, then 8 → 5 → 4 → 15 → 9 → **21 → 22** (20:00–21:00Z peak) → holding 4–17/hour to cycle end.

---

## Constraints (updated)

1. **Term supply is now the hard wall, not just the ceiling.** 4,438 terms accumulated; discovery yields 0 net-new. This is *the* binding constraint. Lever = widen the ICP/frontier (new professions, geographies, phrasings) or seed fresh niches by hand.
2. **Email verify ~43% held** — still a throttle, but *not* today's problem. Finding was.
3. **`needs_contact` = 2,700 and growing (+143/day).** The single largest unbuilt lever, and the one that fully sidesteps the term-supply wall. Deferred pending greenlight.

---

## Ranked next levers

1. **Widen the discovery frontier / ICP** — the only thing that raises the floor. More `FRONTIER_VERTICALS`, adjacent professions, new geos/phrasings, or a human niche seed. Without new ground, every cycle stays near +115.
2. **Build the `needs_contact` recovery engine** (`youtube-email-outreach-v1`) — 2,700 parked creators; recovering a third out-yields a week of fresh finding at today's rate. Biggest lever, deferred.
3. **Cheap "discovery is dry" bail** — after N consecutive 0-net-new discovery passes, stop paying for a full sonnet generation each pass; fall straight to the back-off. Kills the residual LLM waste the loop fix only caps.
4. **Finder-failure-rate anomaly in `checkin.ts`** — flag a cycle where finder passes exit nonzero above a threshold, so exhaustion surfaces in the health signal instead of hiding behind a rising `approved_hold`.

---

## Changes shipped this cycle

| Repo | Change | Commit |
|---|---|---|
| youtube-outreach-orchestrator-v1 | `campaign-loop.sh`: `last_stop_reason()` classifies by the stop *cause* (not the trailing `done`), so the 30-min hard-wall back-off actually fires — term-exhaustion/quota/keys/Airtable walls rest instead of relaunching every 2.5 min (~12× fewer relaunches) | `autopilot-improve: fix dead hard-wall back-off in campaign-loop (168× thrash)` |

No changes to the finder, email-outreach, deep-research, or quick-research repos: the day's dominant issue there (term-supply exhaustion) is **structural, not a code fault** — the fix is a wider ICP or the `needs_contact` engine, both operator decisions, not autopilot churn. A cheap discovery-dry bail (rec #3) is a candidate finder-repo change for a future cycle but was left out today to avoid touching finder business logic without a clear, low-risk landing.
