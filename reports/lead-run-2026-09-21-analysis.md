# Lead Run Analysis — 2026-09-21

**Cycle:** 2026-09-20T07:00Z → 2026-09-21T07:00Z
**Headline:** Two things happened and they point opposite ways. Yesterday's one-line fix to the
Apify lane woke it up after fourteen days idle, and in 52 minutes it recovered **62 leads** at ten
cents each, making this the biggest day since the discovery pause began at **+95 parked**.
Underneath it, the Bloodhound recovery lane, which is the only lane that produces leads every day,
fell from 55 parks to **19**. Brave Search is why, and it has now crossed the line where the
alarms can see it: website resolution failed for **78%** of leads on the last collect pass. The
Apify money is spent until the billing cycle resets on 30 September, so tomorrow the pipeline goes
back to the sinking lane on its own.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Parked into `approved_hold`** | **+95** | +64 | 6,751 → 6,846. Best day of the pause |
| — from Apify endspec | **62** | 0 | One 87-channel batch, $0.099/recovered lead |
| — from the recovery lane re-score | **19** | 55 | Down 65% in one cycle |
| — unattributable from the logs | 14 | 9 | |
| **Ready to write (`ready_data_scraped`)** | **6,570** | 6,484 | 96% of the parked pool |
| Leads enriched | 86 | 64 | 4 batches, **0 failures** |
| Enrichment duty cycle | ~4h15m of 24h | 2h42m | `no pending inflow — idling` after every batch |
| `needs_contact` pool | **4,241** | 4,335 | Down 94, no inflow while discovery is paused |
| Collect passes / lead-slots | 4 / 554 | 3 / 450 | Lap 5 CLOSED 06:01Z, lap 6 open. Book 3,360, stranded 3 |
| Collect hit rate, by pass | **45, 44, 26, 30%** | 66, 76, 63% | Lane normal is ~46% |
| **Website resolution failures** | **61, 60, 74, 78%** | 42% | Was 1–4% a week ago |
| Verify passes / leads tested | 3 / **43** | 4 / 103 | 3 more passes handed nothing at all |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `npm run send` | **15 attempted, 0 sent** | 14 / 0 | Refused by the 09-10 pause, confirmed in the DB |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing crashed |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter | $9.80/day, **$213.90** left | $7.71/day, $223.71 | 21.8 days of runway |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | Fourteenth identical morning |

**Verified, not assumed:** the zero sends were checked directly against Postgres (no lead reached
`sent_to_smartlead` in the cycle window), the parked split was read from `lead_candidates`, and
the new check-in code was run twice end to end against the live logs before committing.

---

## 2. What actually happened

### The record day is one batch of money, not a faster pipeline

The Apify endspec lane solves the captcha behind YouTube's "View email address" button. Yesterday's
fix let it size its batch to the spendable balance instead of an all-or-nothing 100. At 08:21Z it
launched **87 channels**, found published emails for **78**, ran 80 ZeroBounce checks, and flipped
**62 leads into `approved_hold`** at **$0.099 per recovered lead**, half its $0.20 self-halt
ceiling. Yesterday's prediction was 87 channels and about 51 recoveries; it got 62.

Then it stopped, correctly. The balance is now $10.0054 against a $10 reserve, so every two-hourly
tick since has logged `resting … $0.0054 spendable buys 0 channels`. **It cannot run again until
the Apify billing cycle rolls on 30 September.**

The enrichment handoff behind it worked without supervision: Apify finished at 09:13Z, the backfill
chain picked the 62 new leads up at 09:40Z and had them all researched by 12:32Z. 86 leads, four
batches, zero failures.

### The lane that runs every day fell by two thirds, and the batch hid it

| | 09-20 cycle | 09-21 cycle |
|---|---|---|
| Lane parks | 55 | **19** |
| Verify passes / leads tested | 4 / 103 | 3 / **43** |
| Verify passes handed nothing | 0 | **3** (08:00, 15:01, 23:01Z) |
| Collect hit rate | 66, 76, 63% | **45, 44, 26, 30%** |

An empty verify queue is not a verify problem. The collect half in front of it produces the email
addresses, and it is producing fewer because it is finding fewer websites. Nine of its ten
collection methods need one.

### Brave crossed both alarm thresholds

Every collect pass this cycle opens with `All 2 Brave Search API key(s) refused: 402 Usage limit
exceeded`. Key `_1` got $50 on 09-13; key `_2` has sat at its $5 cap since. Brave's API never
reports a balance, so searches have to be counted rather than asked about. A 150-lead pass uses
roughly 150.

Yesterday's debrief recorded 42% resolution failure and noted both alarms were correctly silent.
Today:

- `bloodhound_site_resolution_collapsed` fired from 23:11Z (74%, then 78%). Alarm threshold 70%.
- `bloodhound_collect_yield_degraded` fired on the 26% pass (against a 50% baseline, a 48% fall).

**There is nothing to fix in the alarms for this.** The remedy is money and a fix agent may not
spend it. What is new is that doing nothing now has a price attached: 55 parks to 19 in one cycle,
with no Apify batch available to cover it again until October.

---

## 3. What was shipped

### The alarm built to catch a slide was being silenced by the slide

Orchestrator `da4b849`, `src/recovery/bloodhound-lane.ts` + `scripts/autopilot/checkin.ts`.

On 09-10 the fixed 70% floor slept through a ten-pass slide, so a relative alarm was added: compare
the newest pass against the median hit rate of the eight passes behind it. That baseline has the
mirror-image flaw. **A slide walks into its own baseline.**

Simulated against this repo's real collect log, a lane pinned at 28% (about 60% of normal) reads as:

| Passes since the slide began | Reading under the old rule |
|---|---|
| 1 | 37% fall |
| 3 | 24% fall |
| **5** | **0% fall** |

Roughly thirty hours from degraded to invisible, after which a lane at well under half strength is
indistinguishable from a healthy one. Today's own passes were already walking it down: the alarm
fired seven times on the 26% pass and then went quiet for the 30% pass behind it.

**Fix:** the baseline is now the higher of the short-window median and a **32-pass** median, about
eight days at the current 6-hourly cadence. A cliff is still caught instantly by the short window;
a slow slide can no longer erase the memory of normal. A genuine permanent regime change, the book
thinning to its hard tail, still ages out by itself after eight days rather than alarming forever,
which is the self-healing property the fixed floor never had. The observation now also records
which window held the baseline up, so a reader can tell a cliff from a long slide.

### Both lane alarms were re-reporting the same pass every hour

Same commit. They judge the last *completed* collect pass, the check-in runs hourly, and the lane
collects every six hours. So one bad pass was re-reported every hour: this cycle logged **9 copies**
of the collapse alarm and **7** of the yield alarm about exactly **two** passes. Nothing is learned
on the second through ninth copy, and it makes "how many times did this fire" useless as a measure
of how bad a day was, because the number counts check-ins rather than events.

Same class as the `finder_hard_wall_benign` noise fixed on 09-16, one layer up: there the input was
stale, here the input is current and the *report* repeats.

Both alarms now carry a `pass_key` and skip if the newest observation of that kind already names
the same pass. Each still fires once per pass, four times a day, for as long as the condition
holds. It loses the repetition, not the signal.

**Verified:** `tsc` clean, 63/63 tests (7 new, including the erosion regression and a
permanently-changed-regime case that must NOT alarm), and the check-in run twice end to end against
the live logs with observations redirected to a scratch file. First run fired the collapse alarm
once and wrote `pass_key 83:Collected 148 contact points from 31/104 leads.`; second run was
silent; both exited `healthy`, with the discovery pause honoured.

---

## 4. Still open, carried forward

- **Three debriefs (09-17, 09-18, 09-19) were never written** and their metrics files still exist.
  Yesterday's `missing_debriefs` field correctly named all three, which is the fix working. Today's
  agent authenticated normally, so the fault was the expired login, not the script. Whether to write
  them after the fact is a judgement call about time, not a task to do silently.
- **Something fires a live `npm run send` when an agent opens this repo.** 14 leads yesterday, 15
  today, refused both times. No hook exists in any readable settings file. Harmless only while the
  pause holds.
- **The YouTube key pool** read 15 working of 66 for the fourteenth consecutive morning. Settled
  question (the quota was cut on those 50 projects) and irrelevant while discovery is paused,
  binding the moment it resumes.

---

## 5. Recommended next, ranked

1. **Put money on Brave, or watch the recovery lane keep sinking.** Moved from second to first
   because it now has a price on it. The lane fell 55 to 19 in a cycle, resolution is failing for
   78% of leads, and Apify cannot cover it again until 30 September. $5 buys 1,000 searches, a pass
   uses about 150, and key `_2` is still capped at $5.
2. **Decide what happens to 6,570 finished leads.** Still the biggest number in the pipeline and
   still waiting on a decision rather than on work. Twelve days with the loading door shut.
3. **Expect tomorrow to look like 19, not 95.** Apify is at its reserve and the lane is the only
   daily producer left. A day near 19 is the real rate, not a regression.
4. **Decide whether the three missing debriefs get written after the fact.**
5. **Find whatever fires `npm run send` on session start.** Low urgency while the pause holds, high
   the moment it lifts.

---

**Status caveat.** Everything in `approved_hold` is parked, not sent. Outgoing email has been paused
since 2026-09-10 and only Casey lifts it. Discovery of new channels has been paused since 2026-09-08
and only Casey lifts that. Both pauses held correctly all cycle.
