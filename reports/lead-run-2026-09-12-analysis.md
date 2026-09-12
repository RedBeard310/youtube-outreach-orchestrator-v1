# Lead run analysis — 2026-09-12

Cycle: 2026-09-11T07:00Z → 2026-09-12T07:00Z. Companion to
[lead-run-2026-09-12.html](lead-run-2026-09-12.html).

## Headline

**+2 parked into `approved_hold`** (pool 5,754 → 5,756). Worst cycle on record,
after 8 yesterday and 44 the day before.

The nine-day story has been that a $5/month Brave Search plan is throttling the
recovery lane. That was true and it is no longer the main thing. **The lane's
collect queue is down to 253 leads while the lane walks 600 lead-slots a day**,
so it re-reads its whole remaining book about 2.4 times every 24 hours. And
**2,778 of the 3,735 leads in `needs_contact` are stranded in a gap between the
lane's two selectors**, where neither half can ever see them again.

## The numbers

| Measure | Value |
|---|---|
| Parked into `approved_hold` | **2** (5,754 → 5,756) |
| New channels discovered | 0 (intended — discovery paused 09-08) |
| `needs_contact` pool | 3,735 (fell by exactly 2) |
| — reachable by the collector | **253** (19 tier-0, 234 tier-1) |
| — stranded, contact point but no email | **2,778** |
| — ruled on and failed, correctly retired | 704 |
| — verifiable right now | **4** |
| Collect passes | 4 — **571 lead-slots over 271 distinct leads** |
| Contact points collected | 83 (80, 3, 0, 0 across the four passes) |
| Verify passes | 6 — 30 lead-slots of a 1,200 capacity |
| Enrichment | 1 batch, 2 done, 0 failed, idle the rest of the day |
| `npm run send` | 0 ready leads, exit 0 |
| Fatal signatures / halted hours / quota stops | 0 / 0 / 0 |
| Anthropic spend | $0.00 of $150 hard ceiling |
| OpenRouter | $2.27/day, $58.70 balance, ~26 days |
| YouTube key pool | 15 working / 50 exhausted / 1 blocked of 66 |

## Q1 — why only two leads parked

The collect half selects `needs_contact` leads that have **no contact point of
any kind**. That pool is 253. The lane runs four passes a day at a batch of 150,
so it walks 600 lead-slots daily against a 253-lead book.

Counted off the collect log, the four passes covered **571 lead-slots but only
271 distinct leads**. Passes three and four were handed a byte-identical list of
150 ids and both ended `Collected 0 contact points from 0/150 leads`.

The verify half is finished from the other end: 6 passes, 30 lead-slots used of
1,200, queue now 4 deep. Neither half is broken. Both have run out of work.

## Q2 — where the other 3,482 leads went

They are still in `needs_contact` and nothing can reach them.

- `COLLECT_IDS_SQL` excludes any lead that **already has a contact point**.
- `VERIFIABLE_IDS_SQL` only selects leads that have an **email-kind** contact
  point.

A lead the collector worked and came away from holding a website, a phone and a
social handle but no email satisfies neither. **2,778 leads — 74% of the pool —
sit in that gap.** Contact-point kinds they do hold: website 2,281, social
profile 1,101, domain info 1,056, phone 785, company name 223.

This is the 09-06 Apify double-billing shape inverted. There, a channel that
published no email was indistinguishable from a channel nobody had checked.
Here, a lead that was checked and yielded something unusable is indistinguishable
from a lead that is finished.

**2,281 of the stranded leads carry an already-resolved website.** Resolving a
website is the expensive step and the one Brave's cap blocks. For those 2,281 it
is already paid for and stored.

## Q3 — the Brave cap is no longer the top lever, and the alarms said it was

Both lane alarms (`bloodhound_site_resolution_collapsed`,
`bloodhound_collect_yield_degraded`) attribute the collapse to the search plan
whenever a Brave refusal line appears in the log. That line is now printed at the
top of **every pass**, so the attribution had become unconditional. They fired
**24 times this cycle** recommending a cap raise or new keys.

Brave is genuinely refusing (`402 Usage limit exceeded`, $5 monthly cap, resets
**1 October**). But raising it buys the 253 leads the collector can still see,
not the 3,735 the pool report shows. An alarm that names the wrong remedy is
worse than no alarm when the remedy costs money.

**Yesterday's rewind fix did work.** The `lap_complete` waiver fired at 21:02Z,
released the lane off the 58-lead tail, and batch sizes returned to a full 150.
The lane then re-pinned at the *top* of the book for a different reason, fixed
below.

## Shipped — orchestrator `075e3b3`

1. **`collectBookDepth()`** — counts the pool `COLLECT_IDS_SQL` walks plus the
   stranded set, in one query next to the two selectors it derives from. Every
   collect dispatch now logs `pool_remaining`, `stranded_no_email` and
   `book_drained`, so "stopped producing" and "finished its book" are tellable
   apart without a database session.
2. **`bloodhound_collect_book_drained`** in `checkin.ts` — fires when a day's
   passes cover the whole book more than once (pool ≤ batch × passes-per-day,
   both read from `laneOptsFromEnv` so a retune cannot stale it), and
   **suppresses** the two older alarms when it does.
3. **`rewindWaiver` gains `rewalk_produced_nothing`** — a search-dead re-walk
   that collected zero is not re-walked a third time. The first zero still
   rewinds, preserving the killed-child case the rewind exists for. Brave's cap
   is monthly, so a third identical attempt cannot differ. The 48-deep budget had
   46 more queued, about twelve days.

Verified before commit: `tsc --noEmit` clean, **36/36 tests** (2 new covering the
rewind rule and its non-leakage into the truncated and yield-held cases),
`collectBookDepth()` run live against Postgres returning 253 / 2,778, and
`checkin.ts` re-run end to end — the new observation fires with correct numbers
and the two old ones go silent.

## Ranked next

1. **Build a second collect mode for the 2,778 stranded leads. Top lever in the
   pipeline, and it costs nothing.** 2,281 already have a stored website, so
   re-running the site-scraping methods against it skips resolution and makes
   **zero Brave calls** — the exact step the cap blocks. Needs a selector for
   leads holding a non-email contact point plus a collect path that uses the
   stored site instead of searching. Roughly 9× the collector's entire remaining
   book.
2. **Decide on the Brave cap.** No longer first, but still the only route to a
   website for the 234 tier-1 leads left in the pool, and it matters again when
   discovery resumes. Resets 1 October regardless. Casey's spend call.
3. **Settle the YouTube key pool with one late-day probe.** Fifth identical
   morning (15/50/1 of 66) and a fourth straight cycle with nothing of ours
   spending a unit overnight. All five readings sat ~20 min past the midnight-PT
   reset, so they are still **one measurement repeated**. One probe 6+ hours
   after the reset, on a quiet day, costs 66 units and answers it.
4. **Leave the 704 ruled-and-failed leads alone.** Checked, dead, correctly
   retired. Re-checking spends ZeroBounce credits for nothing.
5. **Nothing needs restarting.** No fatal signatures, halts, quota stops or
   crashes. `npm run send` found nothing ready and exited clean.

## Standing context

Discovery of new channels is paused on Casey's 2026-09-08 instruction. Every
stopped sweep, stale sweep state file, disabled timer and dry term pool is the
intended state, not an incident. Sending stays manual. No `.env` was touched and
no discovery lane was re-enabled or repaired.
