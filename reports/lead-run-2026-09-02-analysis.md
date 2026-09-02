# Lead Run Analysis — 2026-09-02

Cycle: 2026-09-01 07:00Z → 2026-09-02 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-02.json`.
HTML debrief: [lead-run-2026-09-02.html](lead-run-2026-09-02.html).

**Headline:** the ready-to-write pool gained **+177**, the largest single-day gain
since 07-14, and only **48** of those leads were found in the last 24 hours. The
`needs_contact` backlog **fell for the first time since it was created**, from 4,980
to 4,888, and that fall put more leads into `approved_hold` than a day of fresh
finding did.

Two things underneath it. Finding itself dropped to **85** pitchable from 127,
because four of the six discovery lanes now have no material left and the fifth has
about twelve hours before it re-laps its own book. And **28 of the cycle's 48
enrichment batches completed zero leads** while exiting with a success code, which
also permanently locked 75 innocent leads out of the enrichment pool.

Three fixes shipped, all verified live. Zero fatal signatures, zero quota stops,
zero hours halted, $0 Anthropic for the sixth day.

---

## 1. The numbers

| Metric | 2026-09-02 | 2026-09-01 | 2026-08-30 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+177** | +63 | +54 |
| `approved_hold` pool | **4,036** | 3,860 | 3,788 |
| `needs_contact` pool | **4,888** | 4,980 | 4,921 |
| **Total found, never contacted** | **8,924** | 8,840 | 8,709 |
| New channels found | 2,524 | 3,146 | 3,026 |
| Known channels re-walked | 3,200 | — | — |
| Worth contacting (score ≥ 6) | **85** | 127 | 97 |
| Emails verified | **31** (36%) | 49 (39%) | 43 |
| Leads enriched | 45 | — | — |
| Enrichment batches, zero-work / total | **28 / 48** | — | — |
| Campaign sessions | 30 / 31 | 17 / 17 | 15 / 15 |
| Finder runs | 256 | 565 | 716 |
| Hard stops · quota stops | 25 · 0 | 3 · 0 | 0 · 1 |
| Time-budget stops | 5 | 14 | — |
| Hours halted | **0** | 0 | 0 |
| Scoring failures | **0** | 0 | — |
| Term-starvation observations | 24 | 20 | — |
| Anthropic API spend | **$0** | $0 | $0 |
| OpenRouter, account meter | **$16.73/day** | $17.46/day | — |
| OpenRouter, finder log | $3.41 (4,945 calls) | $4.51 (6,530) | $4.58 |
| OpenRouter balance | $305.13 (**18.2 days**) | $321.85 (18.4) | $381.99 |
| `fatal_signatures` | `[]` | `[]` | `[]` |

Discovery cost per pitchable lead, from the finder's own spend log: recommended
videos **4.3¢**, keyword search **2.3¢**, peer sweep **3.0¢**. Cost is not the
constraint anywhere.

**3,835 of the 4,036 parked leads already carry an enrichment bundle**, so only 201
await enrichment. That backlog is close to clear, which is why a four-hour outage
cost 45 leads of throughput rather than hundreds.

---

## 2. What actually happened

### The pool gained 177 on 48 finds

On top of 2,524 net-new channels, the lanes re-walked **3,200 channels already in
the book** (56% of the cycle's channel work). Re-walking re-scores a channel and
re-runs the email check on it, and **255 of the leads that entered `approved_hold`
this cycle were already in the book** rather than new finds.

`needs_contact` took in 37 and ended 92 smaller, so roughly **129 leads left it**.
Its only exit is a working email address and its only destination is
`approved_hold`. 48 fresh + ~129 recovered ≈ the +177.

**Stated limit:** the 129 is arithmetic on two pool sizes, not a direct count. The
recovery lane's own logs show seven verify passes this cycle of between 1 and 10
leads each, so the logs credit only a handful of it to that lane specifically. The
pool numbers say the backlog drained; they do not say which step drained it. Watch a
second day before calling it a trend.

### Finding fell because the lanes are out of road

| Lane | Runs | Seeds | Channels | ≥ 6 | Hit rate | State |
|---|---:|---:|---:|---:|---:|---|
| Recommended-videos feed | 3 | 10,312 | 2,070 | **67** | 3.2% | 4,670 seeds left, ~12h to re-lap |
| Keyword search | 256 | — | 263 | 14 | **5.3%** | 24 starvation notices, no terms |
| Peer network | 12 | 86 | 191 | 4 | 2.1% | **Book fully walked, 0 remaining** |
| Video-graph sweep | 0 | 0 | 0 | 0 | — | Off on $50 cap, 3,390 unwalked |
| Podcast crossover | 1 | — | 0 | 0 | — | Ran once, found nothing |
| Comment sweep | 0 | — | 0 | 0 | — | Paused by Casey 08-20 |

The feed lane is at **0.0065 pitchable/seed** against 0.45 on lap 1, about 1.5% of
where it started. 25 of the 31 campaign sessions hit a wall within ~3 minutes and
rested, which is the loop behaving correctly against an empty term pool, not a
fault.

Niche split of the 85: Real Estate 15, Coaching and Consulting 12, Relocation and
Lifestyle Design 6, Business Growth Coaching 5, Transformation Coaching 5, Health
and Wellness Clinics 4, Financial Planning 3, Business Brokerage 2, catch-all 33.

On yesterday's tarot and astrology finding: **4 of 85 today (~5%)**, down from 17%.
Small sample, crude word match, settles nothing. Nothing changed, per the standing
rule to ask before adding an exclusion.

### Enrichment ran dead for four hours and reported success

28 of 48 batches completed zero leads. Two causes: `ENRICHMENT_REPO_PATH is not set`
(207 failures, the 09-01 `.env` deletion documented in standing orders) and
`Enrichment exited with code 1` (30 failures). Every batch exited 0, so the
hard-wall guard never saw it. The first good batch was 04:32Z.

The real damage was the retry accounting. Each launched ids file counts as an
attempt against `MAX_ATTEMPTS=3`, and the chain relaunched instantly on failure, so
a lead could burn all three attempts in **90 seconds** and be permanently dropped.
The permanently-excluded count ran **67 → 105** across the outage. 290 lead-attempts
were burned in total.

---

## 3. Fixes shipped

**1. Zero-progress guard in the backfill chain** (orchestrator, `53a6950`).

The existing mass-failure guard is written in absolute leads (`failed > 100`) and
the VPS side works inflow batches of 2 to 55, so a total outage was structurally
invisible to it. `done=0` with two or more failures is now treated as
infrastructure: the pool is ordered best-first out of leads that already passed find
and verify, so "every one failed" is never a statement about the leads. Both of this
cycle's failure texts confirm it.

Action on trip: refund the attempts, back off 10 minutes per consecutive trip to a
1-hour ceiling. **Self-clearing** — one batch that completes any work resets the
streak, so nothing needs remembering when the cause is repaired. Batches of one are
exempt so a genuinely broken lead still ages out, and the refund stops after 6
consecutive trips so a poison lead cannot refund itself immortal.

Verified: syntax, the escalation ladder 1→8 (600s to the 3600s ceiling, refund
cutoff at 6), the reset on any completed work, and the single-lead exemption.

**2. Repaired the 75 locked-out leads** (same commit). The 22 outage ids files were
refunded, taking the permanently-excluded count **105 → 30**.

**3. Email-shaped contact points only** (email repo `e8d0858`, orchestrator
`7900f17`).

Lead `rec0kCDPB850ZLDV2` appeared in **every** verify batch of the cycle and had
since 08-18. It carries a `business_email` whose value is the literal string
`REDACTED FOR PRIVACY`, scraped off a privacy-protected WHOIS record. Nothing can
rule on a value like that, so it never gets a `verified_at` stamp, and
`VERIFIABLE_IDS_SQL` keys on exactly that stamp. On a queue only 38 leads deep, one
immortal row is 3% of it.

Individual methods do screen their own emails (RDAP calls `isJunkEmail`), but a
screen per method is a screen the next method forgets. The guard now sits at
`saveContactPoints`, the single insert point, and tests **shape rather than a value
blocklist**, so `Data Protected`, `not disclosed` and whatever the next registrar
invents all fail the same test. The companion SQL predicate retires the rows already
stored with no backfill.

Verified: `tsc --noEmit` clean in both repos, shape filter unit-checked against 8
cases, and live — queue 38 → 37 with the stuck lead gone.

**No fourth fix.** The remaining candidates are all decisions rather than defects:
the feed lane's re-lap rule is a spend policy working as designed, the video-graph
cap is Casey's spending call, and term supply has no code fix. Inventing churn there
would be worse than nothing.

---

## 4. Open, carried

- **Four of six lanes are out of material.** Peer network has walked every seed it
  owns. Keyword search logged 24 starvation notices and has the best hit rate of any
  lane. Video-graph is capped off. Comment sweep is paused. Carried twelve days.
- **The feed lane re-laps in ~12 hours.** 4,670 seeds left of 12,444, at 1.5% of lap
  1's per-seed yield. The re-lap rule is a 25¢ price ceiling, not a yield floor, and
  that is deliberate.
- **Video-graph off, sixth day.** 3,390 seeds at 2.7¢/lead, and the only lane whose
  seeds are not recycled from our own past output, which is exactly what the supply
  problem is about.
- **Tarot and astrology share.** 5% today against 17% yesterday. Untouched pending
  Casey's call.
- **OpenRouter runway 18.2 days** on $305.13 at $16.73/day.

---

## 5. Decisions for Casey

1. **What the recommended-videos lane does when it runs out, in about twelve
   hours.** It re-laps by default. Cheap, still producing, and re-reading its own
   output. Same call carried from yesterday.
2. **Raise the video-graph $50 cap, or retire the lane.** Sixth day. 3,390 unwalked
   seeds, 2.7¢/lead, the only non-recycled seed source in the pipeline.
3. **Whether the backlog fall is real.** If `needs_contact` keeps shrinking for a
   second and third day, recovery is now a bigger lever than discovery and the
   collect batch is worth widening again.
4. **Top up OpenRouter within ~2 weeks.** $305.13 at $16.73/day.
