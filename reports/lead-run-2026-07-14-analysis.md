# Lead Run — 2026-07-14 — Technical Analysis

**Cycle:** 2026-07-13T07:00:00Z → 2026-07-14T07:00:00Z (24h, midnight-PT to midnight-PT)
**Autopilot:** unattended on the Linux VPS. Debrief written by the end-of-cycle agent.
**One-line:** A recovery day (+166 vs 07-13's +115) — but 91% of the yield came *after* a 16:03Z service restart. The morning re-ran the exact 07-13 thrash because the committed back-off fix hadn't deployed into the running loop. Both the deploy gap and the discovery-LLM waste are now self-healing.

---

## Headline numbers

| Metric | Value | Note |
|---|---|---|
| Newly parked → `approved_hold` | **166** | in-cycle leads now parked |
| `approved_hold` pool | 1,941 → **2,107** | net **+166** |
| Pitchable found (score ≥6 + host) | **367** | across 217 finder passes = **1.69/pass** (07-13 ≈ 0.71, 07-12 ≈ 3.0) |
| — pre-16:03Z (old thrashing loop) | **34** | ~130 passes, near-barren |
| — post-16:03Z (fix live + fresh terms) | **333** | 87 passes — **91% of the day** |
| Verified email (of pitchable) | **166 (~45%)** | verify rate held |
| Swept → `needs_contact` (this cycle) | **196** | found + scored ≥6, no verifiable email |
| `needs_contact` pool | **2,897** | up ~197 on the cycle |
| Total channels discovered | **1,318** | 702 below-threshold, 224 unreviewed, 30 demo-niche-excluded |
| Finder passes | **217** | 126 exit-0, **91 exit-1** (42% failed — term exhaustion) |
| Sessions started / done | 98 / 98 | 91 ended on `hard_stop`, 7 on `time_budget_stop` |
| Search-term table | 4,453 → **5,086** | **+633** (mostly probes + Keyword Layer v1, not frontier discovery) |
| Discovery generations | **212** | **168 (79%) wrote 0 net-new**; 44 productive (~109 terms) |
| Campaign hard-stops / fades / promotes | 91 / 122 / 124 | verify+promote lane kept draining backlog |
| YouTube quota stops | **0** | quota never a factor |
| Claude autopilot spend | **$0.00** | check-in fired no fix-agent |
| Fatal signatures | **0** | clean cycle on the health signal |

Per-niche pitchable (top): Real Estate & Property **117** · Health & Wellness Clinics **115** · Financial Planning 33 · Legal 30 · Coaching & Consulting 30 · Tax & Accounting 22 · Other 6 · SaaS 4 · Relocation 3 · Wealth 2 · Business Growth 2. **RE + clinics = 63% of all pitchable** — the two niches the fresh terms landed in.

---

## Primary finding — the 07-13 fix was committed but never deployed for the first 9 hours

The 07-13 debrief shipped a fix to `scripts/autopilot/campaign-loop.sh` (`last_stop_reason()` classifies by the stop *cause*, so a `hard_stop` rests 30 min instead of relaunching in 20s). It was committed **07-13T07:28:21Z** (`92ee26f`).

But **a long-running bash `while` loop does not re-read its own script mid-run** — bash parses the loop body once and re-executes the in-memory AST. The `autopilot-campaign.service` process that was already running kept executing the *old, dead-back-off* code. So for the first ~9h of this cycle the exact thrash the fix targeted **continued**.

The service happened to restart at **16:03:24Z** (`Main PID 592791`, aligned with Casey's Keyword Layer v1 deploy window), loading the fixed script. The split is unambiguous:

| Window | Sessions | Median relaunch gap | Behaviour |
|---|---|---|---|
| 07:00Z → 16:03Z (old process) | 84 | **2.6 min** | 60 sub-3-min relaunches — thrash, dead back-off |
| 16:03Z → 07:00Z (new process) | 14 | **82.5 min** | 0 fast relaunches; all gaps ≥25 min — back-off live |

Replaying the *fixed* classifier against the raw JSONL returns `hard_stop` for ~160 sessions (it would rest correctly) — proving the code is right and the only failure was **it wasn't running**. The yield split tells the same story: **34 pitchable pre-restart vs 333 post** — the thrashing morning was nearly dead; the healthy afternoon/night carried the whole day.

### Fix shipped — self-reload (orchestrator, `401d62b`)

`campaign-loop.sh` now records its own mtime at start and, at the top of each iteration, re-`exec`s itself when the on-disk script has changed **and still passes `bash -n`**:

```bash
now_mtime="$(stat -c %Y "$0" 2>/dev/null || echo 0)"
if [ "$now_mtime" != "$SELF_MTIME" ] && bash -n "$0" 2>/dev/null; then
  log "campaign-loop.sh updated on disk — re-exec'ing to load it"
  exec "$0" "$@"
fi
```

`exec` keeps the same PID, so systemd sees no restart. Future `autopilot-improve` commits to the loop driver self-deploy within one iteration instead of waiting for a manual `systemctl restart`. **Bootstrap note:** the currently-running process predates this change, so it activates on the next natural restart — after which it is permanent. Verified: `bash -n` clean, and a standalone harness confirms the mtime-change → re-exec path fires.

---

## Secondary finding — 79% of discovery generations were pure LLM waste (fixed)

The campaign fires a full `claude-sonnet-5` discovery generation on every fade (`discover-veins.ts --frontier --apply`, 40 candidates). This cycle:

```
212 generations · 168 wrote "nothing to write" (0 unique) · 44 productive (1–6 each, ~109 terms total)
[discover] 5080 terms in table (5080 run). Generating 40 candidates via claude-sonnet-5 [FRONTIER]…
[discover] 0 unique, in-ICP candidates (deduped vs table):
[discover] nothing to write.
```

79% of the calls generated 40 candidates that **all deduped to zero** against a term table that hadn't grown since the previous dry pass — the same prompt over the same table re-proposing the same known terms. This is the exact waste 07-13 rec #3 flagged and deferred; now quantified. It burns the *finder's* Anthropic key, so `burn-ledger.ts` (autopilot key) shows `$0` while the waste is real.

### Fix shipped — discovery-dry guard (finder, `31c208b` via auto-sync)

`discover-veins.ts` now persists, per discovery mode (`frontier` / `focus:<niche>`), the `totalTerms` count at which it last went dry, in `logs/discovery-dry-state.json`. Before the expensive generation:

```ts
const prior = readDryState()[modeKey];
if (prior && perf.totalTerms <= prior.dryAtTotalTerms) {
  // went dry at N terms, table still ≤ N → no new ground → skip the claude-sonnet-5 call
  return;
}
```

It records dryness on a 0-candidate result and clears it on a productive one, so it **self-re-arms the instant the table grows** (a probe promoted, a niche seeded, Keyword Layer terms added). Crucially it is **behaviourally identical downstream**: a skipped-dry pass writes 0 terms, exactly like the generate-then-"nothing to write" path it replaces — the finder's term availability is unchanged, only the wasted call is removed. `--apply`-gated so manual dry-runs always generate. Verified: type-checks clean, loads and runs live, and the guard logic passes an isolated truth-table test (flat/retired table → skip; grown table → re-arm).

---

## Why the day still recovered despite a barren morning

The restart at 16:03Z did two things at once:
1. **Loaded the back-off fix** → hard-walls rest 30 min, letting probe promotion + discovery re-fuel the pool between sessions instead of grinding it.
2. **Coincided with fresh term supply** → the table grew +633 over the cycle (Keyword Layer v1 + probe promotion), concentrated in Real Estate and Health & Wellness Clinics.

Net: the post-restart half ran healthy (7–20 fresh pitchable/pass in bursts) and produced 333 of 367 pitchable at a held ~45% verify rate. **The recovery is a term-supply story, not a finder-mechanics story** — consistent with the 07-09 finding that we are term-supply-limited, not channel-supply-limited.

---

## Shape of the day

217 finder passes, `fresh_pitchable` per pass:

```
07:00–16:03Z (old process, thrashing):  0 0 0 0 0 0 3 0 0 1 0 9 0 0 … mostly 0s, sum = 34 over ~130 passes
16:03Z → EOC (fix live + fresh terms):  7 2 4 2 3 7 8 7 10 4 10 1 7 3 2 10 13 20 … sum = 333 over 87 passes
```

- avg **1.69 pitchable/pass**; max single pass **20**; the healthy cluster is entirely post-restart.
- 131 zero passes — but the front 130 are the thrash, not a mid-run stall.

---

## Constraints (updated)

1. **Term supply is still the governing input** — but it *moves*: +633 terms this cycle drove +166 parked. Feeding the pool (Keyword Layer v1, wider ICP) is the lever; frontier discovery alone yields ~0 net-new.
2. **Deploy latency for loop-driver fixes was the hidden cost** — now closed by self-reload. Any fix to `campaign-loop.sh` used to require a manual restart to take effect.
3. **Email verify ~45% held** — a throttle, not the binding constraint this cycle.
4. **`needs_contact` = 2,897 (+197/cycle)** — the single largest unbuilt lever; fully sidesteps the term-supply wall. Deferred pending greenlight.

---

## Ranked next levers

1. **Keep feeding the term pool** — Keyword Layer v1 + wider ICP. Today proved supply → parked is near-linear; without new ground the cycle drifts back to the wall.
2. **Build the `needs_contact` recovery engine** (`youtube-email-outreach-v1`) — 2,897 parked creators; recovering a third out-yields a week of fresh finding. Biggest lever, deferred.
3. **Verify the two shipped fixes hold next cycle** — the self-reload should deploy the next loop-driver commit with no manual restart; `discovery-dry-state.json` should suppress the dry sonnet calls (watch for the "skip … no new ground" log line dominating fades).
4. **Finder-failure-rate flag in `checkin.ts`** (07-13 rec #4, still open) — surface a term-supply wall in the health signal instead of hiding behind a rising `approved_hold`.

---

## Changes shipped this cycle

| Repo | Change | Commit |
|---|---|---|
| youtube-outreach-orchestrator-v1 | `campaign-loop.sh`: self-`exec` on disk change so committed loop-driver fixes deploy without a manual restart (root cause of the 07-13 fix's 9h dormancy) | `autopilot-improve: self-reload campaign-loop.sh on disk change` (`401d62b`) |
| youtube-lead-finder-v1 | `discover-veins.ts`: discovery-dry guard — skip the `claude-sonnet-5` generation when the term table hasn't grown since the mode last went dry (killed 168/212 wasted calls this cycle); self-re-arms on table growth | landed via auto-sync `31c208b` |

No changes to the email-outreach, deep-research, or quick-research repos: the day's structural driver (term supply) is an operator/ICP decision, and both shipped fixes target the two concrete, measured wastes (deploy latency, dry-discovery LLM burn) without touching business logic.
