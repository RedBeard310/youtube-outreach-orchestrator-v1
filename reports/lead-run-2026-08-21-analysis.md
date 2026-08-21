# Lead run analysis — 2026-08-21

Cycle window 2026-08-20T07:00Z to 2026-08-21T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-21.json`.
HTML debrief: [lead-run-2026-08-21.html](lead-run-2026-08-21.html).

## Headline

**+105 parked** (`approved_hold` 2,910 → 3,015), and good leads went **446 → 265**.
Nothing failed. Three discovery lanes ran out of seeds at the same time.

Yesterday's fix worked on every number it was measured against. The video-graph sweep
merged 3,180 fresh seeds at 20:30Z and then walked **11,455 seeds**, double its previous
best, producing 3,133 channels and 201 good leads, which is 76% of everything found today.

Underneath that, the supply ran out. The recommended-videos feed, the lane the standing
orders name primary, fell from **2,716 channels to 228** because its book is finished at
10,555 of 10,555 walked and its refill can only supply the seven to ten channels an hour
the pipeline newly qualifies. The peer-network lane is in the same state at 10,444 of
10,444. And the video-graph sweep itself ended the cycle with **417 seeds left** against a
demonstrated 11,455 a day, roughly 24 hours from the same trickle.

Fixed today: the video-graph seed query now reaches 57,301 seeds instead of 15,410, which
adds 42,074 unwalked seeds to that lane, and lane health now reports how much road each
lane has left.

## The numbers

| Metric | Today | 08-20 |
|---|---:|---:|
| Parked into `approved_hold` | **+105** | +149 |
| `approved_hold` pool | 3,015 | 2,910 |
| `needs_contact` pool | 3,921 | 3,769 |
| **Total parked, none sent** | **6,936** | 6,679 |
| Channels found | 4,584 | 7,483 |
| Worth contacting (score ≥ 6) | **265 (5.8%)** | 446 (6.0%) |
| Emails verified | 106 | 147 |
| Share of good leads reachable | 40% | 33% |
| Dropped by niche exclusions | 19 | 247 |
| `scoring_failed` | 0 | 0 |
| Campaign sessions | 14 | 23 |
| Keyword finder passes | 301 | 237 |
| Stopped for want of terms | 3 hard stops, 11 on time budget | 17 of 23 |
| Quota stops · crashes | 0 · 0 | 0 · 0 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $7.48 (9,629 calls) | $10.81 |
| `fatal_signatures` | `[]` (22nd cycle) | `[]` |

Cost per lead worth contacting **2.8¢**, up from 2.4¢. Cost per lead parked **7.1¢**,
level with yesterday's 7.3¢. Efficiency held. Volume did not.

### Shape of the day

Channels found per hour, 07:00Z through 06:00Z:

```
202  157  399  121  205  161  103  154  193  122  246  239
175  106  287  190  188  204  203  169  169  170  241  180
```

Flat, like yesterday, but at about 60% of yesterday's height the whole way across. Low
103, high 399, no cliff and no hour where anything fell over. This is what the pipeline
looks like running correctly on less material.

## Where the leads came from

| Lane | Channels | Worth contacting | Rate | Spend | Cost per lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep** | 3,133 | **201** | 6.4% | $4.98 | 2.5¢ |
| Keyword search | 663 | 40 | 6.0% | $1.95 | 4.9¢ |
| Recommended-videos feed | 228 | 17 | **7.5%** | $0.33 | **1.9¢** |
| Peer-network comments | 399 | 7 | 1.8% | $0.15 | 2.1¢ |
| Comment sweep | 159 | 0 | 0% | $0.08 | no leads |
| Podcast crossover, guest links | 2 | 0 | 0% | — | — |

The video-graph sweep is 76% of the day's good leads on its own. The row worth staring at
is the third one: the recommended-videos feed had the **best conversion rate and the
cheapest lead in the pipeline**, on 228 channels. Its problem is not quality. It has
nothing left to look at.

Keyword spend breaks down as $1.25 on inventing new terms (`discover-veins`), $0.68 on the
finder agent and $0.02 on the autocomplete harvest.

**Best niches:** Other 58, Real Estate 55, Health & Wellness Clinics 39, Coaching &
Consulting 32, Transformation & Performance Coaching 22, Relocation & Lifestyle Design 17,
Business Growth Coaching 13, Financial Planning 11, Legal Services 6.

## Seed books at the end of the cycle

| Lane | Seeds | Walked | Remaining | Walked today | Road left |
|---|---:|---:|---:|---:|---:|
| Recommended-videos feed | 10,555 | 10,555 | **0** | 257 | drained |
| Peer-network comments | 10,444 | 10,444 | **0** | 262 | drained |
| Video-graph sweep | 19,898 | 19,481 | 417 | 11,455 | under a day |
| Comment sweep (paused) | 139 | 80 | 59 | 85 | n/a, off |

Every one of these lanes reported `productive: true` in the health snapshot.

## Q1 — did yesterday's refill fix hold?

Yes. At 20:30Z the refill fired for the first time since it was written and logged
`merged +3,180 new seeds, 12,044 upgraded (19,898 total, 3,218 remaining)`. The lane then
walked 11,455 seeds against 5,718 yesterday.

The merge behaviour held too. It kept the walked-seed list and the lifetime stats rather
than wiping them, so none of that 11,455 was re-walking ground already covered.

## Q2 — then why did the day halve?

The seed supply behind every rail-walking lane is smaller than the walking, and three
lanes hit the end of their books in one cycle.

The mechanism is the same for all of them. **Their seed source is our own qualified
leads.** We qualify roughly 265 creators a day; the lanes consume more than 11,000 seeds a
day between them. A lane fed by its own output cannot stay ahead of itself. The
recommended-videos feed restarted 25 times today to walk 257 seeds, exactly the rate at
which the pipeline hands it new material.

Nothing needs repairing here. Every service ran, every timer fired, every refill did what
it was written to do. The pipeline is now limited by how much unwalked material exists,
not by uptime, quota or code.

There is a second finding inside this one. The feed lane's own summary reads
`lap 5: 203 qualified / 10,555 seeds = 0.019/seed`, against 0.033 on lap 4 and 0.45 on lap
1. **Lap 4 to lap 5 held 58%, not the 80% the compounding note claims, and lap 5 runs at
4% of the first lap.** Re-walking that book is no longer worth the walk.

## Q3 — was anything watching for this?

No. The health monitor reported all three drained lanes as `productive: true`. It asks two
questions of a lane, is it alive and did it advance any seeds, and 257 is more than zero.

That is how a 92% collapse passed without a warning. A lane whose book is finished looks
identical to a healthy one until the next morning's lead count arrives, by which point the
day is spent. The monitor was built two days ago to catch silent stalls, and it could not
see this shape of one.

## Shipped today

Two commits, one per repo. Both verified against live data before committing. Nothing in
any `.env`.

### 1. `youtube-lead-finder-v1` — widen the video-graph seed floor

`scripts/rebuild-video-seeds.sql` took only videos above 100,000 views, capped at the top
20 per channel. Measured against the same 4,649 qualified channels:

| Seed rule | Seeds available | Days of road at 11,455/day |
|---|---:|---:|
| 100k floor, top 20 per channel (before) | 15,410 | already spent |
| **20k floor, top 40 per channel (now)** | **57,301** | **3.7** |
| 5k floor, top 40 per channel (next step) | 103,582 | 9.0 |

Verified: the widened query returns 57,301 valid seed rows in 7 seconds, and a dry-run
merge against a copy of live state adds **42,074 new seeds**, taking the book from 417
remaining to 42,491.

This is not a quality concession. The lane's own written policy is that mega-view rails
are the least ICP-dense and low-view rails are the densest, and seeds are walked in
ascending view order, so the newly opened 20k to 100k band gets walked **first**. Median
view count of the new seeds is 44,154. Check its qualified-per-seed against the old band
before dropping the floor to 5,000.

Landed inside auto-sync commit `46181df` (the two-minute sync timer committed the edit
before the improve commit could).

### 2. `youtube-outreach-orchestrator-v1` — report how much road each lane has left

`scripts/autopilot/debrief-data.ts`, commit `e40f043`. Lane health gains `seeds_total`,
`seeds_walked`, `seeds_remaining`, `days_of_road` and `book_drained`. Road is measured
against the rate that lane actually walked this cycle, so the answer arrives as "this
drains before the next debrief" rather than as a raw count nobody can size. Remaining is
counted by walking the current book rather than subtracting, because `processed` can hold
ids a merge dropped and the subtraction can go negative and read as a full book.

Typechecks clean. Run against the live 08-21 state it flags the recommended-videos feed
and the peer-network lane as `book_drained: true` on sight.

## Not a fault

- The keyword lane's 21 term-starvation heartbeats and 3 hard stops. Documented state
  since the lane was demoted to opportunistic on 08-14.
- 11 sessions ending on their time budget.
- The comment sweep contributing 0 leads from 159 channels. That run fired at 09:11Z on
  08-20, before the pause took effect. `comment-sweep-daily.timer` is confirmed `disabled`
  and `inactive`, and a stale state file is expected, not an incident.
- $0 Anthropic for the twenty-second consecutive cycle. Zero crashes, quota stops,
  scoring failures and fatal signatures.

## Recommended next, ranked

1. **Check the widened seed book actually merged.** Tonight's refill tick should log
   roughly `merged +42,000 new seeds`, and the lane's summary should show tens of
   thousands remaining rather than hundreds. This single number decides whether tomorrow
   looks like today or like Wednesday.
2. **The recommended-videos feed needs a decision, not a repair.** The standing orders
   name it primary and say an idle one is a problem to fix. It is not idle and not broken;
   it converts better than any other lane at the lowest cost per lead. It has walked
   everything it can reach and its lap yield has fallen 24 times over. As it stands it is
   a 17-lead-a-day follower of what the other lanes find. The ranking in
   `standing-orders.md` is untouched, with a dated note of the measurement added, because
   re-ranking a lane is Casey's call.
3. **Decide the outlet for `approved_hold`.** 3,015 leads prepped and ready to write, none
   emailed. The pool has grown every day for seven weeks and crossed 3,000 today.
4. **Build the `needs_contact` recovery engine.** 3,921 creators found, scored and
   unreachable, up 152 today. Operation Bloodhound was built on 08-18; its audit is in the
   brain.
5. **Give the keyword harvest new seed phrases.** Carried since 08-16, unchanged since
   07-13. The lane converts at 6.0%, competitive with the best lane, and is purely
   volume-starved. It spent $1.25 of the day's $7.48 inventing terms to compensate.
6. **Find a seed source that is not our own output.** The deeper version of item 1. Every
   rail-walking lane is fed by leads we already qualified, so seed supply grows at about
   265 a day while the lanes consume more than 11,000. Today's fix buys days by digging
   deeper into the same channels. An independent source is what removes the ceiling.

## Status

Everything parked, nothing sent. `approved_hold` 3,015 plus `needs_contact` 3,921 is
**6,936 creators found and never contacted**. $0 Anthropic, $7.48 OpenRouter. The campaign
loop and all live discovery lanes were left running. The comment sweep stays off.
