# Lead Run Analysis — 2026-08-27

Cycle: 2026-08-26 07:00Z → 2026-08-27 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-27.json`.
HTML debrief: [lead-run-2026-08-27.html](lead-run-2026-08-27.html).

**Headline:** a full clean cycle with no outage, the biggest raw discovery day of
the month, and two findings that matter more than the totals. The video-graph
sweep finished its seed list and everything its refill produced, so all three
walking lanes now live hand to mouth. And the recovery lane, live since 08-23,
has been re-running the same forty leads every six hours and producing nothing.
Both the diagnosis and the fix for the second one are in this cycle.

---

## 1. The numbers

| Metric | 2026-08-27 | 2026-08-26 |
|---|---:|---:|
| Parked into `approved_hold` | **+74** | +70 |
| `approved_hold` pool | 3,594 | 3,521 |
| `needs_contact` pool | 4,724 | 4,584 |
| **Total found, never contacted** | **8,318** | 8,105 |
| Channels found | **5,122** | 3,870 |
| Worth contacting (score ≥ 6) | 215 (4.2%) | 200 (5.2%) |
| Good leads per live hour | 9.0 | 10.5 |
| Emails verified | 71 | 67 |
| Share of good leads reachable | 33% | 34% |
| `scoring_failed` | **0 (0.0%)** | 0 (0.0%) |
| Campaign sessions | 16 started / **16 finished** | 13 / 11 |
| Keyword finder passes | **565** | 288 |
| Fresh pitchable per pass | **0.083** | 0.083 |
| Hard stops · time-budget stops | 1 · 15 | 0 · 11 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic API spend | $0 | $0 |
| OpenRouter spend | $7.44 (10,984 calls) | $6.01 (8,107) |
| OpenRouter balance | $465.26 (~62 days) | $483.82 (~80 days) |
| `fatal_signatures` | **`[]`** | `[]` |

Cost per lead worth contacting **3.5¢** (was 3.0¢). Cost per lead parked
**10.1¢** (was 8.6¢). Both worsened, and section 4 explains why: the day's
biggest spender bought 30% more seeds and got 7% fewer leads.

Every hour of the cycle produced work. That is the first uninterrupted 24 hours
since 08-24.

---

## 2. The recovery lane has been walking in place since it went live

This is the finding of the cycle, and it was invisible from every existing
metric.

`leads.contact_points` rows written, by day:

| Day | Rows |
|---|---:|
| 2026-08-18 | 1,885 (the manual run) |
| 2026-08-19 | 772 (the manual run) |
| 2026-08-23 | 46 |
| 2026-08-24 | 2 |
| 2026-08-25 | 0 |
| 2026-08-26 | 1 |
| **2026-08-27** | **0** |

Over those four days the lane dispatched four collection passes a day at 40
leads each, roughly 640 lead-dispatches. The pool of `needs_contact` leads with
no contact points sat at **3,315** and never moved.

**The mechanism.** `selectUntouchedIds` ordered by `first_discovered_at ASC` and
excluded a lead only via `NOT EXISTS (... contact_points ...)`. So the only way
out of the queue was to succeed. Every lead the collector failed on stayed at
the head of the queue and was handed back six hours later. The lane re-ran one
fixed batch of the forty oldest leads about sixteen times.

**Why that batch never succeeds.** Of the 3,315 untouched leads, only **1,067**
have any external links recorded, and the collector resolves a business website
from those links. Nine of the eleven collection methods need a website. In the
fixed oldest-40 batch, **27 have no links at all**. Checked live today, the ones
that do have a site fail on their own merits: `ajsimmonsonline.com` no longer
resolves in DNS, `garagedoortrainingschool.com` returns 403 to a bot,
`rapidscale.net` 301s to another domain and trips the cross-domain guard that
stops us filing a stranger's email under a lead.

Measured, both sides:

- 8 leads from the repeated batch → **0 contact points**.
- 8 leads from the middle of the same pool → **7 contact points from 2 leads**.

The pool is productive. The queue was stuck.

**Why nobody saw it.** The collection child is spawned detached, on purpose, so
it cannot eat the campaign session's time budget. It was detached onto
`stdio: 'ignore'`. It had been failing into `/dev/null` every six hours.

This is the same class of bug as the verify selector on 08-24 (`d6af815`): a
selector that reads *no result yet* as *not tried yet*. Two lanes, same repo,
same week. Worth remembering as a shape.

---

## 3. Where the leads came from

| Lane | Channels | Score ≥ 6 | Rate | Seeds walked | Leads/seed | Seed list |
|---|---:|---:|---:|---:|---:|---|
| **Video-graph sweep** | 3,788 | **156** | 4.1% | 8,084 | 0.0193 | **finished, refill only** |
| Keyword search | 850 | 47 | 5.5% | n/a | n/a | 565 passes |
| Peer network | 266 | 5 | 1.9% | 200 | 0.0250 | finished 08-26 |
| Recommended-videos feed | 217 | 7 | 3.2% | 202 | 0.0347 | finished 08-26 |
| Guest-link mining | 1 | 0 | — | — | — | effectively idle |
| Podcast crossover | 0 | 0 | — | unknown | — | ran once, no output |
| Comment sweep | 0 | 0 | — | 0 | — | paused by Casey 08-20 |

Video-graph made **73%** of the day's good leads, down from 84% yesterday only
because the keyword lane ran twice as many passes.

Niche split of the 215: uncategorised 60, coaching and consulting 36, health and
wellness clinics 32, real estate and property 21, transformation and performance
coaching 21, relocation and lifestyle design 14, business growth coaching 9,
marketing agencies 7, luxury asset brokerage 7, financial planning 5, then
singles in legal, tax and manufacturing.

The 60 uncategorised is the largest single bucket for the first time this week.
Worth a look if it stays there: it may mean the scorer is finding good creators
the niche list does not describe.

---

## 4. The seed arithmetic closed

Yesterday's debrief gave video-graph about 1.1 days. It used them.

- Banked at cycle start: **6,721**.
- Refill produced during the cycle: **1,363** (seed book 67,495 → 68,858).
- Seeds walked: **8,084**, which is exactly the sum.
- Banked at cycle end: **0**.

So the lane burns roughly six seeds for every one its refill makes. There is no
version of that which recovers on its own.

The efficiency cost arrived in the same cycle rather than later:

| | 08-26 | 08-27 | Change |
|---|---:|---:|---:|
| Good leads per seed | 0.0269 | 0.0193 | **−28%** |
| Hit rate | 5.4% | 4.1% | −24% |
| Seeds walked | 6,242 | 8,084 | +30% |

Do not read one cycle as proof of collapse; 08-26 was itself an unexpected 20%
*improvement* on 08-25. But the direction now matches the mechanism, which the
08-26 bounce did not.

The two lanes that finished earlier show the settled state clearly, because they
have nothing but refill: peer-network walked 200 seeds for 5 leads, the
recommended feed 202 for 7. Together the three lanes walk about 8,486 seeds a
day and are fed by the 215 good leads the whole pipeline finds.

---

## 5. The term engine: time was never the problem

The 08-26 backoff shipped and worked, and its result is a clean negative
experiment.

- Term-invention calls: **580 chances, 545 skipped, 15 ran.**
- Keyword harvests: **580 chances, 576 skipped.**
- Finder passes: **288 → 565**, up 96%, in the same wall-clock.
- Fresh pitchable per pass: **0.083 → 0.083.**

Twice the passes, twice the leads, identical rate. The lane was not being
starved of run time by the generator, which was the working theory on 08-26. It
is starved of terms.

The 15 calls that did run wrote **3 probes between them**: thirteen wrote
nothing, one wrote one, one wrote two. The reservoir read `STOCK-UP` on all 16
sessions, the starvation heartbeat fired 22 times, and one session hard-stopped
on `term_supply_exhausted` at 04:50Z. The generator is reconverging on its own
priors and no amount of calling it will change that.

The open decision from 08-16 is now cheap to make on evidence: give the keyword
lane genuinely new seed phrases, or retire it. 565 passes for 47 leads.

---

## 6. What is not broken

- **Scoring.** 0 failures across 5,122 channels, three clean days running.
- **The loop.** 16 of 16 sessions finished. 15 ended on their time budget, which
  is the healthy ending. The single hard stop rested and resumed.
- **Money.** $0 Anthropic. The subscription-versus-API separation is holding.
- **Comment sweep.** Stale state file, 0 runs, exactly as Casey ordered on 08-20.
- **Recovery from the 08-25 credit outage.** No repeat, no halt flag written.

---

## 7. Shipped this cycle

**`f74bf4f` (orchestrator) — the collect pass walks the book instead of walking
in place.**

- `COLLECT_IDS_SQL` carries a cursor over an ascending `(tier, disc, id)` tuple.
  One row comparison, so a batch boundary can neither skip nor repeat a lead.
- `tier 0` = the lead has external links, `tier 1` = it does not. Each lap
  spends its early passes on the 1,067 workable leads before the 2,248 bare
  ones.
- A short batch ends the lap and clears the cursor, which starts a fresh walk.
  That is deliberate: a re-walk is worth something once sites come back or a
  method is added. It is also the self-healing property, because a missing or
  corrupt cursor just starts a lap. No state-file edit can strand the lane.
- The detached collect child now appends to `logs/bloodhound-collect.log` by
  file descriptor, which survives `unref()`. The campaign log line carries the
  cursor tier, the lap flag and the lap count.

Verified before commit: typecheck clean, 17 of 17 tests pass (7 new), three
consecutive 40-lead batches against the live database are fully disjoint, batch
one is 40/40 link-carrying against 13/40 under the old selector, and a dry
collect on a mid-book batch produced 7 contact points from 2 of 8 leads against
0 from 8 of the repeated batch.

---

## 8. Recommended next, ranked

1. **Find a seed source that is not our own output.** Carried six days; the
   warning window closed today. All three walking lanes are at zero banked
   seeds. Dropping the video-graph view floor from 20k to 5k buys roughly 46,000
   seeds and about a week, which is time to build the real answer rather than
   the answer itself.
2. **Watch the recovery lane for 24 hours.** Today's fix should turn 160
   dispatched leads a day from 0 contact points into roughly 140, on the
   sample rate. It works a pool of 4,724 creators we already paid to find and it
   needs no new seeds, so it is the one lever the seed wall does not touch.
3. **Decide the `approved_hold` outlet.** 3,594 parked, none ever sent, plus
   4,724 in `needs_contact`. **8,318 creators found and never contacted**, up
   213 today. Carried since 08-20.
4. **Decide about the keyword lane.** Section 5 settled the open question: time
   is not the constraint. New seed phrases or retirement.
5. **Add a low-balance warning.** $465.26, about 62 days, down from 80 because
   daily spend rose. Housekeeping, not an alarm.

---

## 9. Status

Running, unattended, no human touches this cycle. Everything is parked, nothing
is sent; `approved_hold` is a deliberate holding lane and fires only on a manual
`npm run send`. No halt flag written. The loop is left running for the next
cycle.
