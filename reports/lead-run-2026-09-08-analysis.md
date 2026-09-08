# Lead Run Analysis — 2026-09-08

Cycle: 2026-09-07T07:00:00Z → 2026-09-08T07:00:00Z (midnight Pacific to midnight Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-08.json`,
the sweep state files, `logs/bloodhound-collect.log`, the finder's dead-key store, and
direct queries against the `pipeline` database. Anything measured by hand during this
session is labelled as such.

## Headline

**+142 parked**, `approved_hold` 5,444 → **5,586**. That is an ordinary day sitting
between two extraordinary ones (627 on 09-03, 488 on 09-07) and slightly above the
eight-day median.

**`needs_contact` fell 18**, from 3,872 to **3,854**, while taking in 46 new arrivals.
Fourth fall in eight days. Combined, **9,440 creators found and never contacted**, none
of them mailed.

**Finding had its best day in a week: 3,046 channels**, the most since 3,146 on 09-01,
and **16 of 24 hours produced** against yesterday's 13. The dark stretch shrank from 11
hours to 8 because the video-graph sweep held out until 22:32Z rather than 19:29Z.

**The morning key probe came back identical to yesterday: 15 working of 66.** That was
the pre-registered signal for "the quota was cut". It does not carry that weight, and the
dig into it found a separate defect that is ours. See Q2.

## The funnel

| Measure | Value |
|---|---|
| Channels discovered | 3,046 |
| Scored 6 or better | 99 (3.3%) |
| Verified email by cycle end | 52 |
| Of today's channels, already in `approved_hold` | 52 |
| Of today's channels, in `needs_contact` | 46 |
| Scoring failures | 0 |
| Campaign sessions | 6 started, 6 done |
| Finder passes | 183, for 13 fresh pitchable |
| Hard stops / quota stops / time-budget stops | 1 / 0 / 5 |
| Term-starvation notices | 24 |
| Fatal signatures | none |
| Halted hours | none |
| Anthropic spend | $0.00 |
| OpenRouter (finder spend log) | $4.32 across 6,274 calls |
| OpenRouter (account meter) | $25.09/day, balance $88.21, **3.5 days** |

Discovery by lane (channels, then score 6+):

| Lane | Channels | 6+ | Rate | Seeds left | State |
|---|---:|---:|---:|---:|---|
| Video-graph sweep | 1,553 | 62 | 4.0% | **53** of 90,139 | Walked 3,423 seeds (+77% on prior). Stopped 22:32Z on the key pool |
| Recommended-videos feed | 1,064 | 23 | 2.2% | **57** of 12,970 | Throughput-bound, 1.2 days of road |
| Keyword search | 286 | 13 | 4.5% | n/a | 183 finder passes at 100 quota units a search |
| Peer network | 142 | 0 | 0% | **0** of 12,876 | Book drained, yield dead |
| Guest-link mining | 1 | 1 | — | n/a | Trickle, converted |
| Comment sweep | 0 | 0 | — | n/a | Paused by Casey 08-20, working as intended |

Niches among the 99: **Other 33**, real estate 21, coaching and consulting 17, health and
wellness clinics 14, transformation coaching 5, relocation 3, manufacturing 2, then
single leads in legal, luxury asset brokerage, business growth coaching and financial
planning. A third landing in "Other" is the largest uncategorised share in recent cycles.

Hourly channels found, 07:00Z → 07:00Z:

```
118 142 153 233 242 226 263 285 246 150 200 229 132 244 153 30 0 0 0 0 0 0 0 0
```

## Q1 — parking fell 488 → 142, and that is not a regression

The 488 was three one-off backlog pushes landing together, and all three are now spent:

- **The risky-address reopen is finished.** 187 of 227 recovered on 09-07 and the backlog
  is at zero. There is nothing left to reopen.
- **Apify is out of money.** `leads.apify_endspec_attempts` shows **zero attempts** in the
  window; the last batch log is 2026-09-06T18:21Z. $83.89 of its $100 month is spent and
  the wrapper reserves $10, so it cannot fit a $7.02 batch. It rests until 30 September.
  This is the wrapper working, not a fault.
- **The free Bloodhound methods keep going**, and they had a good day: **697 contact
  points off 132 of 150 leads** on the collect pass. Only 18 of 150 resolved no website,
  so the `site=(none)` rate is ~12%, inside the normal band, and the Brave cap is not
  biting.

**Strip the one-offs out and the ordinary path improved.** 52 of the 142 parks are
channels first discovered today, against 31 of 488 yesterday. Same-day find-to-park
roughly held its rate across a discovery day nearly twice as large.

## Q2 — the key pool read 15 of 66 again, and what that does and does not prove

The reading itself is sound. `debrief-data.ts` probes every slot with an independent live
call 20 minutes after the reset: **15 working, 50 quota-exhausted, 1 suspended project**.
Identical to yesterday's hand-run at 07:35Z. Keys the rotation had not touched were
refusing too, so it is not the rotation mislabelling its own spending.

**But yesterday's decision rule does not survive contact.** The rule was "if tomorrow
says 15 again, the quota was cut." Both readings were taken at the same point in the
morning, 20 and 35 minutes past the reset. Two measurements of the same instant on two
days are one measurement repeated. A refill that is consistently more than 35 minutes
late produces exactly this pair of numbers.

**The dig found a defect on our side, and it is expensive.** `expiryFor('quota')` in
`youtube-lead-finder-v1/src/youtube/dead-keys.ts` pinned a quota death until the *next*
Pacific midnight, which is correct at 3pm and badly wrong at 00:11. The always-on sweeps
sleep until the reset and touch every key within seconds of waking, so a refill that has
not landed yet answers `quotaExceeded` on a key that is fine.

Measured from the live store this morning, **11 keys were retired between 07:11:28Z and
07:19:12Z**, every one of them inside the first twenty minutes of the day, every one
pinned to `2026-09-09T07:00:00Z`. The 09-07 debrief recorded the same shape (12 keys
retired in 270ms at 07:05Z).

The client already refuses to believe a store that condemns the *whole* pool (there is a
test for it). It has no defence against a store that condemns 50 of 66, which is exactly
the case that happened.

**Shipped:** `youtube-lead-finder-v1` `24bfacc`. Inside `YT_RESET_GRACE_MINUTES` (180) a
quota death expires after `YT_QUOTA_RETRY_MINUTES` (30), clamped so it can never outlive
the next reset. Defaults live in code, not env, per house law.

Why this is safe without first knowing the answer:

- A genuinely spent key is re-retired on its next turn. That costs one HTTP round trip
  and **no quota**, because an exhausted key rejects the request rather than charging for
  it.
- A key that was merely early returns the same morning instead of the next day.
- Worst case is roughly six extra retry rounds spread over the first three hours, arriving
  through the normal rotation rather than as a probe burst.

*Verified:* `tsc --noEmit` clean; **246 tests pass, 6 new** covering the grace window, the
boundary just past it, the clamp against the next reset, nonsense env values, and
`minutesSincePacificMidnight` in both PDT and PST. Today's 11 prematurely-pinned entries
were re-expired live under the new rule (07:41Z–07:49Z instead of tomorrow), so the fix
applies to this morning rather than starting tomorrow.

*Confirmed in production during the session:* by 07:29Z the store held 23 entries, and
every death recorded after the commit carries a `+30 minutes` expiry rather than
tomorrow's reset, so the running sweeps picked the change up on their next process
launch. Worth noting for tomorrow's reading: 22 quota deaths were recorded in the first
29 minutes of the day, which is the behaviour that made the old rule so costly.

**It also settles the original question for free.** From tomorrow, a fingerprint refused
at 07:11 that then stops reappearing was a late refill. One that keeps reappearing all
morning belongs to a project whose quota was cut. No extra probe, no extra spend.

## Q3 — all three graph lanes finished their seed books on the same day

They produced **2,759 of the day's 3,046 channels** at roughly three cents a lead, and:

| Lane | Seeds left | Of |
|---|---:|---:|
| Video-graph | 53 | 90,139 |
| Recommended-videos feed | 57 | 12,970 |
| Peer network | 0 | 12,876 |

Peer already shows what "out of road" looks like downstream: 142 channels scored, zero
worth pitching, `yield_dead: true`. The feed reports 1.2 days of road and
`throughput_bound: true`.

Only video-graph refills itself, hourly, from channels the scorer newly qualifies, and
that is the pattern the other two lack. The alternative is re-walking a finished book,
which pays less each lap (the feed lane closed lap 1 at 0.45 qualified per seed and lap 6
at 0.014).

**Nothing was changed.** Per the standing orders this is Casey's spend call, and the
relap policy question has been carried as an open item since 08-28.

**Update measured during the write-up (outside the cycle window):** video-graph walked
its last 53 seeds and exited at **07:29:26Z** with `SWEEP COMPLETE, every seed walked.
Stopping for good.` The unit is `Restart=on-failure` and it exited 0, so systemd
correctly did not restart it. `video-graph-sweep-refill.timer` fired at 07:31:33Z,
detected the idle sweep and began a full seed rebuild, which is exactly what that script
exists for (it stops the unit, extends the book, restarts it, and refuses to do any of
that if the lifetime cost cap is the reason for the stop — lifetime spend is $57.30
against the $100 cap raised on 09-06, so there is headroom). No intervention needed, and
the check-in's `sweep_stalled` heartbeat covers the case where the rebuild fails.

## Deliberately not done

- **Throttling keyword search when the pool is low.** A keyword search costs 100 quota
  units; the graph lanes run on 1-unit calls plus free watch-page scraping. Today the
  expensive lane bought 13 of 99 good leads and the pool ran out at 22:32Z. Slowing it
  under a thin pool would likely buy the sweeps hours. It is a producing lane and the
  standing rule is not to stop one, so it is flagged as rec 5 rather than done.
- **Stopping the peer lane.** Zero yield, but it costs $0.06/day and stopping a lane is
  Casey's call.
- **Anything about the Apify lane.** It is resting correctly and the cap is a spend call.

## Ranked recommendations

1. **Top up OpenRouter.** $88.21 at $25.09/day is 3.5 days. The rate halved from Sunday's
   $45.26 only because the Apify lane and the enrichment backfill both went quiet, so this
   is a reprieve, not a fix. Every lane scores through this account; a zero balance stops
   finding the way an empty key pool does.
2. **Check the key projects, then read tomorrow's dead-key file.**
   `youtube-lead-finder-v1/scripts/audit-key-projects.sh` reads each key's Google Cloud
   project for zero YouTube quota. Tomorrow's `logs/youtube-dead-keys.json` now separates
   a late refill from a cut quota by itself.
3. **Decide what the graph lanes walk next.** All three finished their books today. This
   is the structural limit on finding while the key pool is capped.
4. **Decide the Apify budget.** Unchanged: ~$256 runs the 3,644 leads it has never
   touched for roughly 2,100 parks at ~$0.12 each, and it halts itself above $0.20.
   No runs until 30 September otherwise.
5. **Look at keyword search's quota share** (see "Deliberately not done").

## Ledger

- Parked pool **5,586**, of which **5,436 carry an enrichment bundle** (150 outstanding).
- `needs_contact` **3,854**.
- **0 sent.** `approved_hold` is a holding lane; only `npm run send` mails anyone.
- 0 fatal signatures, 0 halted hours, 0 scoring failures, 0 campaign quota stops.
- Anthropic API spend **$0.00**.
- One commit: `youtube-lead-finder-v1` `24bfacc`.
