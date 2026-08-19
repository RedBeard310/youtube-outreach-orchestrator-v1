# Lead run analysis — 2026-08-18

Cycle window 2026-08-17T07:00Z to 2026-08-18T07:00Z (midnight to midnight Pacific).
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-08-18.json`.
HTML debrief: [lead-run-2026-08-18.html](lead-run-2026-08-18.html).

## Headline

**+131 parked** (`approved_hold` 2,518 → 2,649), up from 83, on 6,741 channels found.

The generated metrics file credits keyword search with 3,502 channels and 219 good
leads. The keyword engine actually found **223 channels and 13 good leads**. The other
3,279 came from `video-graph-sweep`, a lane that shipped yesterday morning and was filed
under the wrong name all day because the classifier had never heard of its tag.

It is now the single biggest producer in the pipeline. For one cycle it was invisible.

Second confirmation of the day: yesterday's key-rotation fix cut YouTube rate limits from
**411 to 4**.

## The numbers

| Metric | Value | Prior day |
|---|---:|---|
| Parked into `approved_hold` | **+131** | +83 |
| `approved_hold` pool | 2,649 | 2,515 |
| `needs_contact` pool | 3,428 | 3,206 |
| **Total parked, none sent** | **6,077** | 5,721 |
| Channels found | 6,741 | 4,993 |
| Worth contacting (score ≥ 6) | **379 (5.6%)** | 267 (5.3%) |
| Emails verified | 129 | 80 |
| `scoring_failed` | 0 | 0 (19th clean day) |
| Campaign sessions | 33 | 21 |
| Finder passes | 115 | 259 |
| Stopped for want of terms | **33 of 33** | 19 of 21 |
| Quota stops | 0 | 0 |
| YouTube rate limits (429) | **4** | 411 |
| Anthropic spend | $0 | $0 |
| OpenRouter spend | $10.03 (14,668 calls) | $5.19 |
| `fatal_signatures` | `[]` (19th cycle) | `[]` |

Cost per lead worth contacting **2.6¢**; per lead parked **7.7¢**. Both up on yesterday,
because the new lane is still walking its most expensive seeds.

### Shape of the day

Third cycle with no dead hours. Peak 573 at 11:00Z, floor 134 at 03:00Z, and the quietest
hour still returned 7 good leads. The dead tail seen on 08-16 has not come back.

### By discovery method (corrected)

Counted directly in Postgres, not from the metrics file:

| Lane | Found | Worth contacting | Rate | Spend | Cost/lead |
|---|---:|---:|---:|---:|---:|
| **Video-graph sweep (new)** | **3,279** | **206** | 6.28% | $5.74 | 2.8¢ |
| Recommended-videos feed | 1,929 | 140 | **7.26%** | $3.01 | 2.2¢ |
| Peer-network comments | 760 | 13 | 1.71% | $0.37 | 2.8¢ |
| Comment sweep | 546 | 7 | 1.28% | $0.28 | 4.0¢ |
| Keyword search | 223 | 13 | 5.83% | $0.19 | **1.5¢** |
| Guest-link mining | 4 | 0 | 0% | — | — |

The metrics file for today merges rows 1 and 5 into a single 3,502-channel
"keyword_search" line.

Per-niche pitchable leaders: **Other 76**, Health & Wellness Clinics 74, Coaching &
Consulting 74, Real Estate 48, Transformation & Performance Coaching 37, Relocation &
Lifestyle Design 14, Business Growth Coaching 10, Financial Planning 8, Legal 8.

## Q1 — Why did keyword search find seven times more channels than yesterday?

**It didn't.** It found 223, about what it has found all week.

Every lane tags the rows it writes and `discovery-method.ts` reads that tag to assign
credit. It knew `graph:`, `peer-comment:`, `peer-guest:`, `comment:` and `podcast:`. The
new lane writes `video-graph:`, which matches none of them, and the closing line of the
function hands anything unmatched to the keyword engine.

So the new lane's whole output landed under the one lane we keep calling starved. Taken at
face value, the obvious reading was that the keyword harvest had recovered by itself and
the term-supply problem had solved itself. It hasn't: the keyword engine hard-stopped on
`term_supply_exhausted` in **33 of 33** sessions, the same starvation as always, hidden
behind another lane's leads.

**The second consequence is the worse one.** The same function decides what counts as a
finder pass's own yield. It was written on 2026-08-10 for precisely this reason — sweep
daemons write into the lead base continuously, a pass measures itself by diffing that base,
so daemon rows landing mid-pass get counted as the pass's own work. Because `video-graph:`
read as keyword engine, the video sweep's rows were inflating per-pass yield again, and
that number feeds the fade detector that pivots a mined-out term slice into discovery. The
bug the file exists to prevent returned through the door it left open.

Fade rate moved in the direction that implies: 235 fades in 259 passes yesterday (90.7%)
against 82 in 115 today (71.3%).

## Q2 — Did yesterday's key-rotation fix hold?

**Yes, by more than expected.** 429s went from **411 to 4**.

Both halves of the fix are visibly working. `logs/youtube-dead-keys.json` holds five
quota-dead keys, each stored as a truncated hash rather than a key value, each expiring at
`2026-08-19T07:00Z` — midnight Pacific, Google's actual reset. Rotation opening at a spread
offset removed the pile-up on keys #1–#3 that produced 403 of yesterday's 411 limits.

Zero quota stops and no suspensions. Five dead out of 52 means the pool remains nowhere
near the constraint.

## Q3 — Is the re-walking lane still worth it?

**Yes, and the per-seed decline continued as forecast.** Lap 4 of the recommended-videos
book closed this cycle at **9,701 seeds, 315 good leads, $6.26**.

Per-seed yield by lap: 0.453 → 0.373 → 0.053 → **0.032**. Yesterday predicted 0.025, so the
decay is tracking. Per lead it is still **2.0¢**, second-cheapest of anything we run,
because cost follows channels *scored* rather than seeds walked and a re-walk drops most of
what it sees for free.

The 25¢-per-lead gate approved this lap easily and will keep approving laps 5, 6 and 7
while each returns roughly half the last. Still an open policy call, still Casey's, nothing
changed.

## What broke

### A new lane could ship without the report knowing

Worth fixing more than the mislabelling itself. The classifier's closing rule was a
deliberate fail-safe: anything unrecognised counts as the keyword engine, because
over-counting is survivable while a false zero would make every pass look like a fade and
push the campaign into permanent discovery churn.

That reasoning holds for the cases the original comment names — a renamed field, a blanked
value, a new writer emitting no tag. All three produce an empty or untagged value. It fails
for what actually happened: a new writer emitting a perfectly good tag nobody registered.
There the fail-safe doesn't degrade quietly, it hands one lane's entire output to another
and reports it with complete confidence.

### 33 of 33 sessions stopped for want of terms

Up from 19 of 21. Standing orders demoted the keyword lane to opportunistic on 08-14 and say
not to treat an empty term pool as an incident, so this is not a regression by itself. What
is new is that it was **invisible** — the lane looked like the day's second-biggest producer
while stopping instantly in every session. It still posts a 5.83% hit rate and the cheapest
leads we have. No new seed phrases since 07-13.

### Podcast crossover produced nothing again

A timer, one run, zero channels, zero leads. Third cycle at or near zero. Left alone;
switching off a lane Casey built deliberately is his call.

### Not a fault

Zero crashes, quota stops, scoring failures or fatal signatures, nineteenth consecutive
cycle. Anthropic $0. OpenRouter rose $5.19 → $10.03, which is the new lane doing real work:
$5.74 of the total for 206 leads.

## Yesterday's fixes, checked

| Prediction | Outcome | Verdict |
|---|---|---|
| Persisting dead keys stops processes re-learning which are spent | Five keys on disk, hashed, expiring at Pacific midnight | confirmed |
| Spread rotation offset stops the fleet piling onto keys #1–#3 | 429s 411 → 4 | confirmed |
| Auto-relap keeps paying at ~480 leads a lap | Lap 4 returned 315 at 2.0¢; per-seed 0.053 → 0.032 | holding, decaying |
| Comment sweep has nothing left to test | Fourth cycle at 1.28%, 546 channels for 7 leads | confirmed |

## Shipped today

**`youtube-outreach-orchestrator-v1` `094d108`** — one commit, one file plus its caller.
Typecheck clean; verified with an eleven-case table covering every tag in live use, then
end to end by re-running the metrics collector over today's real data. No `.env` touched.

1. **`video-graph:` is registered** as its own lane, so it appears in the report by name and
   stops inflating the finder's per-pass yield.

2. **A daemon-shaped tag is never the keyword engine**, registered or not. A daemon tag is a
   lowercase hyphenated word followed immediately by a colon. Checked against 15,578 genuine
   keyword rows from the past month: exactly zero match that shape, so it cannot mistake a
   real search term for a lane tag.

3. **An unregistered lane reports under its own prefix** (`unregistered:video-graph`) rather
   than being absorbed. The next lane that ships unregistered names itself in the next
   morning's debrief instead of spending a day disguised as something else.

The original fail-safe is intact: null values and untagged terms still resolve to the
keyword engine, so every failure mode the old comment guarded against behaves as before.

```
before:  keyword_search 3,502 found / 219 pitchable
after:   video_graph_sweep 3,279 / 206
         keyword_search       223 /  13
```

## Recommended next, ranked

1. **Let the video sweep finish its book.** It has walked 4,774 of 16,718 seeds — **71%
   unwalked**. At the current rate that is roughly 450 more good leads with nothing new
   built. Largest known reserve of unworked supply we have, and it did not exist two days
   ago.
2. **Check what the video sweep is bringing in.** "Other" is now the largest niche at 76
   pitchable, and the sweep seeds off very large general-audience videos — the seed list
   opens with LegalEagle clips at 99M views. Good volume at a good rate, but worth one
   manual look to confirm these are businesses worth contacting and not the hobbyist
   channels rejected on 08-09.
3. **Put a yield floor on auto-relap.** Carried from yesterday, unchanged. The dollar gate
   keeps approving laps that each return half the last; a per-seed floor would let the lane
   retire itself.
4. **Give the keyword harvest new seed phrases.** Unchanged since 07-13. Cheapest leads we
   have at 1.5¢, stopped instantly in 33 of 33 sessions. Still the highest-leverage unbuilt
   item.
5. **Decide on comment sweep.** Four cycles at ~1.3%; 546 channels for 7 leads at 4.0¢.
6. **Podcast crossover: connect it or retire it.** Zero output, three cycles.
7. **Decide the outlet for `approved_hold`.** 2,649 prepped, none emailed.
8. **Build the `needs_contact` recovery engine.** 3,428 found, scored and unreachable, up
   222 today.

## Status

Everything parked, nothing sent. `approved_hold` 2,649 + `needs_contact` 3,428 = **6,077
creators found and never contacted**. $0 Anthropic, $10.03 OpenRouter. Zero crashes, zero
quota stops, zero scoring failures, no fatal signatures for the nineteenth cycle. The
campaign is still running and was left that way; no halt flag.

**Brain repo note.** It was on `operation-bloodhound` again with local `main` well behind
the remote. Yesterday's debrief is safe on `origin/main`; only the local branch pointer was
stale. Today's was moved onto `main` the same way and the branch put back as found.
