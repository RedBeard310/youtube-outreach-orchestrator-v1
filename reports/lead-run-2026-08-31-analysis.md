# Lead Run Analysis — 2026-08-31

Cycle: 2026-08-30 07:00Z → 2026-08-31 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-31.json`.
HTML debrief: [lead-run-2026-08-31.html](lead-run-2026-08-31.html).

**Headline:** yesterday's empty key file caused a halt, the key file repaired
itself overnight, and nothing was watching for that. The campaign loop and all
five discovery lanes stayed stopped for **22h44m** after their cause was gone.
This cycle found **zero** channels and **zero** creators worth contacting, the
first fully empty cycle since the lanes went always-on. The pipeline is running
again as of **07:24:04Z**, restarted by the fix shipped for exactly this.

Second finding, unrelated and arguably larger: **the OpenRouter spend figure in
these reports has never covered the account.** It sums one repo's log. The
account really spent **$42.79** this cycle while the reported figure was
**$0.0079**, and the runway it printed was **42,965 days** against a real **8**.

---

## 1. The numbers

| Metric | 2026-08-31 | 2026-08-30 |
|---|---:|---:|
| Parked into `approved_hold` | **+5** | +54 |
| `approved_hold` pool | 3,793 | 3,788 |
| `needs_contact` pool | 4,916 | 4,921 |
| **Total found, never contacted** | 8,709 | 8,709 |
| Channels found | **0** | 3,026 |
| Worth contacting (score ≥ 6) | **0** | 97 |
| Emails verified | **0** | 43 |
| Leads enriched (backfill bundles) | **224** | 104 |
| Campaign sessions | 2 started / 3 finished | 15 / 15 |
| Finder runs | **3** | 716 passes |
| Hard stops · quota stops | **2 · 1** | 0 · 1 |
| Sweep-lane relaunches · seeds walked | **253 · 0** | — |
| Hours halted | **~22.3 of 24** | 0 (halt began 08:40Z, after the window) |
| Anthropic API spend | $0 | $0 |
| OpenRouter, finder log | $0.0079 (1 call) | $4.58 (6,737) |
| **OpenRouter, account meter** | **$42.79** | (not measured before today) |
| OpenRouter balance | $339.19 (**~8 days**) | $381.99 (reported ~83 days) |
| `fatal_signatures` | `[]` | `[]` |

No cost-per-lead figures this cycle. The denominator is zero.

---

## 2. What actually happened

Timeline, all UTC:

| When | What |
|---|---|
| 08-30 04:58:11Z | The Mac's two-minute sync overwrites `~/env-storage/.env` with 0 bytes. Every repo resolves 0 direct YouTube keys. (Yesterday's story.) |
| 08-30 08:09:40Z | The hourly check-in logs a fatal signature: `two consecutive finder failures`. |
| 08-30 08:1xZ | The paid fix-agent investigates and correctly declines to act. Restoring a secrets file is barred to it; the on-disk backups are from July and hold a smaller, possibly-suspended key set; guessing on an auth path is the one thing it was told not to do. It writes `logs/autopilot-halt.flag` explaining all of this and stops. |
| 08-30 08:40:34Z | `campaign-loop.sh` reads the flag and exits 0. |
| overnight | A later Mac sync carries a full file. The bank is back to 66 keys, `_1` through `_66`, contiguous. **Nothing notices.** |
| 08-30 09:10Z → 08-31 07:10Z | **Twenty consecutive hourly check-ins** read the flag, log `HALT flag present — loop stopping`, and exit 5. Correct behaviour, no cost, no recovery. |
| same window | All five discovery lanes relaunch on their timers, read the flag, and quit in ~2s. **253 relaunches across the four lanes that log runs. 0 seeds walked.** |
| 08-31 07:24:03Z | The fix shipped today matches the flag, counts 66 keys, clears it, and restarts the loop. |
| 08-31 07:24:04Z | A campaign session launches. The keyword harvest starts returning net-new terms, which is independent proof the keys work. |

The +5 parked and the −5 on `needs_contact` are the same five leads, promoted at
08:09Z in the last session before the stop. Nothing replaced them.

**The halt itself was the right call.** The agent hit a genuine
human-only boundary and said so clearly. The defect is that stopping was
automatic and starting was not.

---

## 3. Why the existing self-healing did not cover this

`tryAutoClearHalt` in `scripts/autopilot/checkin.ts` was added on 2026-08-25 for
precisely this failure shape: the OpenRouter account ran dry at 00:49Z, everything
parked correctly, and nothing noticed the top-up. It was deliberately written to
recognise **one** cause and leave every other halt alone, on the sound principle
that a probe should only clear what it can positively disprove.

So the recovery machinery existed, worked, and did not apply. An emptied key bank
is just as checkable as an empty account, and more cheaply: it is a file on disk.
It simply was not on the list, and the list was a hard-coded regex rather than a
list.

---

## 4. The spend finding

`openRouterHealth` sums `youtube-lead-finder-v1/logs/llm-spend-<day>.jsonl` and
nothing else. Other repos on the same account keep no spend log at all. The big
one is enrichment: `backfill-chain.service` has been running continuously since
08-25, drives `quick-youtube-channel-research-v1`, whose `models.json` routes
**15 tasks** to OpenRouter, and is **not gated by the halt flag**.

This cycle isolated it perfectly, because everything else was stopped:

- Finder log: **1 call, $0.0079**
- Enrichment: **224 bundles** written (104 the cycle before, so it sped up with
  nothing competing for the box)
- Account meter: **$42.79**

Reconstructed daily burn from the archived snapshots, comparing the balance delta
against what each debrief reported:

| Cycle | Real (balance delta) | Reported |
|---|---:|---:|
| 08-27 | $18.56 | $7.44 |
| 08-28 | $32.78 | $4.62 |
| 08-29 | $36.70 | $5.30 |
| 08-30 | $13.80 | $4.58 |
| 08-31 | **$42.79** | $0.0079 |

Lifetime, the finder's ledger accounts for **$110.05** of the account's
**$970.81** of usage. Some of that gap is the finder ledger only starting on
08-12, and some is OpenRouter settling generation costs slightly after the fact.
Most of it is enrichment that was never in the figure.

**Nothing is wrong with the spending.** 224 bundles at roughly the documented
~$0.09 to $0.19 per bundle lands near $42. The defect was the reporting, and its
consequence was a runway of 42,965 days on an account with 8 days left.

This is the second act of the 08-25 outage. The fix then was "watch the balance."
That is insufficient on its own: a balance is only alarming once you know the
rate, and the rate was the number being measured wrong.

---

## 5. Fixes shipped

All three in `youtube-outreach-orchestrator-v1`.

**`b8d52c4` — the halt auto-clear now works from a list of causes.**
`tryAutoClearHalt` becomes a `HALT_RECOVERIES` table, each entry pairing a
recogniser with a free probe that must positively disprove the cause. Same
narrowness rule as before: anything unrecognised is left for a human. Added the
empty-key-bank cause; its probe reads the shared bank, counts key **names** only
and never a value, and floors at `AUTOPILOT_MIN_YOUTUBE_KEYS=5` rather than any
pool size, since the pool has gone 9 → 39 → 52 → 66 and keeps growing.
*Verified live:* tsc clean, then it matched the real flag, counted 66, cleared it
and restarted the loop, which launched a session at 07:24:04Z. Separately
confirmed an unrecognised cause is still left halted.

**`705f764` — a halted cycle is now countable in the grounded JSON.**
The snapshot had no halt field at all; the halt appeared only as stray text inside
each lane's `idle_reason`, which reads like five independent lane failures rather
than one flag. The check-in now writes a free hourly `halt_standing` heartbeat
instead of only printing to a journal nobody reads, and `debrief-data.ts` gains a
`halt` block that counts them, so a halt stays countable after the flag is gone.
That is the midnight-boundary case: an overnight recovery clears the flag before
the debrief runs. Also made `AUTOPILOT_OBSERVATIONS` overridable, matching the
existing `AUTOPILOT_HALT_FLAG` precedent, so halt paths can be exercised without
appending test rows the debrief would then report as fact.

**`4dba0b1` — report the account's burn, not one repo's log.**
Sample OpenRouter's own cumulative `total_usage` once per cycle and diff it. That
counts every repo whether or not it reports itself, and no repo can forget to
write into it. Adds `account_spend_usd`, a per-day rate so an off-cadence run
cannot read as a cheap day, and `runway_basis`; `days_of_runway` now prefers the
account rate. The finder figure stays, labelled with its scope.
*Verified:* seeded one true prior sample from the archived 08-30 snapshot
(granted 1310 − balance 381.99) and regenerated 08-31 — $42.79 over 24.17h,
$42.49/day, runway **8 days**, basis `account`.

---

## 6. Open, carried

- **The video-graph lane is off, fourth day.** $50 lifetime cost cap, unchanged.
  **1,940 seeds** unwalked at 2.7¢ per good lead, the cheapest in the pipeline.
  Clearing the halt does not restart it: the cap is a separate switch. Casey's
  spending call. The durable version is a per-lap cap refresh, the way the sibling
  lane already does it.
- **No alert path for a halt a probe cannot disprove.** By design there is no
  external notification, so the only channel is this daily report. Yesterday's
  halt began *after* yesterday's report was written, which is why the first
  possible surfacing was today, a full cycle late. Self-clearing now covers the
  two causes that have actually occurred; a third would sit silently again.
- **Seed supply, carried ten days.** Untested this cycle. Before the stop, the
  recommended-videos lane was on lap 7 of a book walked six times at 0.006 good
  leads per seed against 0.45 on lap 1, and 715 of 716 finder passes were fading
  for want of terms. Expect it waiting tomorrow exactly as left.
- **The recovery lane produced nothing** and learned nothing. Its pass fires from
  the hourly check-in, which exits on the halt flag before reaching it. The
  three-cycle finding stands untested: collection works, verification does not.
- **The Mac wrote a 0-byte env file.** Today's fix covers the recovery, not the
  cause. Worth understanding once why a sync can write nothing at all.

---

## 7. Decisions for Casey

1. **8 days of runway.** Balance $339.19, real burn ~$42/day. Top up or throttle
   the backfill, but decide on the real number, not the $4 to $7 these reports
   have shown all week.
2. **Raise the video-graph lane's $50 cap, or leave it off.** Fourth day.
3. **Seed supply.** Still the ceiling on everything once the machine is running.
