# Lead Run Analysis — 2026-08-30

Cycle: 2026-08-29 07:00Z → 2026-08-30 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-30.json`.
HTML debrief: [lead-run-2026-08-30.html](lead-run-2026-08-30.html).

**Headline:** the shared file holding all 66 YouTube API keys was overwritten
with 0 bytes at 04:58:11Z, and it is still empty. Every process from 05:36Z on
loaded no keys, fell through to the retired RapidAPI backend, discovered that it
has lapsed onto a free tier of 1,000 requests a day, spent that tier, and wrote
`used_pct: 95.2` into the quota file that all five discovery lanes read before
they start. They all paused at their 70% cap. The final hour of the cycle found
**zero channels**, the first empty hour since the lanes went always-on, and
nothing has run since. The direct key pool itself is fine: it reset at Pacific
midnight and **65 of 66 keys are live right now**.

Output was already the weakest in a week before that happened, for reasons that
have nothing to do with it (section 4).

---

## 1. The numbers

| Metric | 2026-08-30 | 2026-08-29 |
|---|---:|---:|
| Parked into `approved_hold` | **+54** | +78 |
| `approved_hold` pool | 3,788 | 3,735 |
| `needs_contact` pool | 4,921 | 4,881 |
| **Total found, never contacted** | **8,709** | 8,616 |
| Contact points recovered | **107** (38 leads) | 131 (62 leads) |
| Channels found | 3,026 | 3,540 |
| Worth contacting (score ≥ 6) | **97 (3.2%)** | 163 (4.6%) |
| Emails verified | 43 | 58 |
| Share of good leads reachable | **44%** | 36% |
| `scoring_failed` | **0 (0.0%)** | 0 (0.0%) |
| Campaign sessions | 15 started / 15 finished | 15 / 15 |
| Keyword finder passes | **716** | 675 |
| Fresh pitchable per pass | **0.043** | 0.052 |
| Fades / passes | **715 / 716** | — |
| Hard stops · time-budget stops | 0 · 14 | 0 · 15 |
| Quota stops · crashes | **1** · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | **$4.58** (6,737 calls) | $5.30 (7,741) |
| OpenRouter balance | $381.99 (~83 days) | $395.78 (~75 days) |
| `fatal_signatures` | **`[]`** | `[]` |

Cost per lead worth contacting **4.7¢** (was 3.3¢). Cost per lead parked
**8.5¢** (was 6.8¢). Both rose because output fell, not because anything got
more expensive.

The one metric that improved: **44% of good leads arrived with a verified
email**, up from 36%.

---

## 2. The shared env bank was emptied, and it is still empty

```
-rw-rw-r-- 1 casey casey 0 Aug 30 04:58 /home/casey/env-storage/.env
```

Zero bytes. `SHARED_ENV_PATH` in `youtube-lead-finder-v1/src/env.ts` resolves to
that file, and it is the one place a YouTube key is ever added. The Mac
overwrites the VPS copy every two minutes, and one of those writes landed empty.
That mechanism is already on the record as a hazard (it silently reverted a
model swap on 2026-07-31); this is the first time it has taken the key pool.

**No code here may touch it.** Restoring it is Casey's, on the Mac.

The break is visible to the minute in the sweep logs:

| Time | Sweep startup line |
|---|---|
| ≤ 05:22Z | `backend: auto (66 direct keys, RapidAPI fallback available)` |
| ≥ 05:36Z | `backend: auto (0 direct keys, RapidAPI fallback available)` |

Hourly discovery, from `leads.lead_candidates.first_discovered_at`:

| Hour (UTC) | 03 | 04 | 05 | 06 |
|---|---:|---:|---:|---:|
| Channels written | 172 | 155 | **60** | **0** |

The dead-key store agrees that the pool itself is healthy. As of 07:20Z,
`logs/youtube-dead-keys.json` holds 27 entries of which **1 is still live**, and
that one is a `blocked` (suspended project), not a quota death. The other 26
expired at Pacific midnight, exactly as designed.

---

## 3. The retired backend's free tier was pausing every discovery lane

This is the part worth keeping, because it will outlive today's outage.

RapidAPI was retired on 2026-08-10 and CLAUDE.md records it as gone. It is not
gone. The account has lapsed onto a **free tier of 1,000 requests and 100
searches per day**, and it answers normally, with well-formed positive numbers:

```json
{"ts":"2026-08-30T07:03:11.445Z",
 "requests":{"remaining":48,"limit":1000,"used_pct":95.2},
 "search":{"remaining":14,"limit":100,"used_pct":86}}
```

`src/youtube/quota-guard.ts` writes that file after every RapidAPI response.
`src/lib/run-gate.ts` `quotaUsedPct()` reads it, and all five sweeps pause above
a 70% cap. The campaign has two more copies of the same read
(`readFinderQuotaUsedPct` in `campaign.ts`, `quota_used_pct` in
`campaign-loop.sh`).

**Both existing guards passed it.** The staleness guard passed because a
fallback run had just rewritten the file. The 2026-08-11 retired-backend guard
passed because it only catches `remaining < 0`, and a live free tier reports
`remaining: 48`.

So one fallback run spending 950 of 1,000 free requests shut down every
discovery lane in the pipeline, for a full day, against a direct pool sitting at
65 of 66 keys live.

Observed, at 15-minute intervals from 05:36Z through 07:21Z and continuing:

```
[sweep] PAUSE: quota at 95.1% >= 70% cap. Leaving headroom for the campaign.
```

**The discriminator is plan size, not percentage.** This pipeline spends well
over a thousand YouTube requests in an ordinary hour, so a plan whose largest
bucket is 1,000 cannot be metering our day. The paid plan this guard was written
against metered 110,000 requests and 2,000 searches.

**Fixed** in all three copies (section 6).

---

## 4. Take the outage out and the day was still weak

The outage cost the last 90 minutes. It does not explain the other 22.5 hours,
which ran 3 to 7 good leads an hour against a normal 8 to 12.

**The feed lane is on lap 7 of a book it has walked six times.** It walked
**10,346 seeds** today, the most this week, for **64** good leads. From its own
closing banner:

```
THIS LAP (7):  64 qualified / 11325 seeds = 0.006/seed  (lap 6 ran at 0.014/seed)
```

That 0.006 is a **mid-lap** reading and 08-29 established why those move before
a lap closes, so it is a direction, not a rate. The direction: lap 1 ran at
0.45, lap 6 closed at 0.014, lap 7 is tracking at 0.006. **855 seeds remain**,
so it will close within hours of the keys returning, and that closing figure is
the one to quote.

**The keyword lane says the same thing from the other side.** 716 finder passes,
**715 fades**, 31 fresh pitchable across all of them. 23 term-starvation
readings. Every session opened `STOCK-UP`.

Common cause: **every lane is now seeded only by leads the pipeline itself
found.** Peer network has 10 seeds left of 12,180; the feed lane has 855.
Falling yield shrinks tomorrow's seed supply, which lowers yield again.

**Video-graph produced nothing, all 30 runs, on the $50 lifetime cap** carried
from 08-28. Every run this cycle logged `STOP: spent $50.00 >= $50 cumulative
cap.`, including runs from long before the key file emptied. 1,933 seeds
unwalked at 2.7¢ per qualified lead.

> **Snapshot correction.** `discovery_methods_health.video_graph_sweep.idle_reason`
> in today's JSON reads `[video-sweep] PAUSE: quota at 95.1% >= 70% cap.` That is
> wrong for this lane. Its own session logs say the cost cap on every run of the
> cycle. The quota pause is real for the other lanes.

---

## 5. The recovery lane, third cycle

| | 08-30 | 08-29 | 08-28 |
|---|---:|---:|---:|
| Contact points collected | 107 | 131 | 112 |
| Leads that produced one | 38 | 62 | 44 |
| New arrivals into `needs_contact` | 51 | 105 | — |
| Net pool change | +40 | +85 | — |
| **Implied leaving the pool** | **~11** | ~20 | ~16 |

Three cycles, same shape. Collection works. The step after it does not. The
outflow is shrinking, not growing, and it was never large. The bottleneck is
turning a candidate address into a verified one, and that is where the next hour
of work on this lane belongs.

---

## 6. What shipped

**`youtube-lead-finder-v1` `19e7dd6`** — two guards.

*Free-tier guard* in `src/lib/run-gate.ts` `quotaUsedPct()`, which governs all
five sweeps. A snapshot whose largest bucket limit is under
`QUOTA_MIN_PLAN_LIMIT` (default 5,000) no longer governs, because it describes
the fallback lane's free tier rather than our capacity. A revived paid plan at
110,000 requests stays above the floor and still governs normally.

*Empty-pool guard* in `src/env.ts` `resolveYoutubeBackend()`. `auto` with zero
direct keys is a fault, not a configuration, and it used to be silent: the
startup line read like a normal one while the run spent the free tier and
poisoned the quota file for everything else. It now throws
`YOUTUBE_KEY_POOL_EMPTY`, names the empty bank file, and says what releases it.
This is self-healing rather than fatal: the sweeps and `campaign-loop.sh` treat
a startup throw as a resumable stop, so they sleep and pick straight back up
when the bank returns, with no seed loss and nothing to restart by hand.
Override with `YOUTUBE_ALLOW_RAPIDAPI_ONLY=true`.

**`youtube-outreach-orchestrator-v1` (in `bdd675d`)** — the same free-tier guard
in `readFinderQuotaUsedPct` (`src/drivers/campaign.ts`) and `quota_used_pct`
(`scripts/autopilot/campaign-loop.sh`). The shell copy was the weakest of the
three: it carried only the staleness guard and had never received the 2026-08-11
retired-backend guard at all, so a negative bucket still read as 100.1% used
there. It now has both. (The commit is titled `auto-sync` because the two-minute
sync timer committed the files before the agent's own commit ran, which is a
known race; the content is verified present in `bdd675d`.)

**Verification.** 241 finder tests pass, both repos typecheck clean, `bash -n`
clean. All three governors checked against the live quota file (95.2 → inactive)
and against a synthetic paid-plan snapshot (110,000-request plan at 99.8% →
still governs). Regression cover added for both guards, and the run-gate
fixtures were corrected from the free tier's 1,000/100 limits to the paid plan's
110,000/2,000, which is the fixture the outage was invisible in.

**Nothing was halted.** The halt flag would have blocked the pipeline from
healing itself the moment a good env file lands, which is the opposite of what
this outage needs.

---

## 7. Ranked levers

1. **Restore the YouTube keys in `~/env-storage/.env`.** Nothing else matters
   until this is done. Check that the Mac's master copy still holds them, and
   that slots run `_1` upward with no gap of five or more, because several
   loaders stop scanning there. Everything resumes on its own; no service needs
   touching.
2. **Decide whether to raise the video-graph lane's $50 cap.** Carried two days.
   Nothing produced in either. 1,933 seeds at 2.7¢ per lead, the cheapest in the
   pipeline. The durable version is to make the cap refresh per lap, as the
   sibling lane's does.
3. **Find a seed source that is not our own output.** Carried nine days, and now
   behind two problems rather than one: lap 7 at 0.006/seed, and 715 of 716
   passes fading for want of terms. Dropping the feed lane's view floor from 20k
   to 5k still buys about a week of road and is the cheapest option available.
4. **Work the recovery lane's verification step, not its collection step.**
   Three cycles agree.
5. **Decide the outlet for the parked pools.** 3,788 in `approved_hold`, 4,921
   in `needs_contact`, 8,709 found and never contacted. Money is not the
   constraint: $381.99 on OpenRouter, about 83 days at this rate.
