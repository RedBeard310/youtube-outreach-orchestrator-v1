# Lead Run Analysis, 2026-09-23

**Cycle:** 2026-09-22T07:00Z → 2026-09-23T07:00Z
**Headline:** The pipeline parked **zero leads**. Not a low number, zero, for the first time on
record. Every pool ended the day exactly the size it started: **6,853** parked, **4,243** waiting
for a contact, **6,586** researched and ready to write. Nothing crashed, no key expired, no money
ran out, no guard misfired. Every lane ran on schedule and found nothing in front of it. The
recovery lane spent **600 lead slots to move 4 leads** out of its book, because it is reading that
book a second time and a second reading of a lead it already emptied finds nothing. Enrichment ran
**no batches at all**, because its queue is one lead. This is what the pipeline looks like when the
work runs out and the only remaining inputs are decisions.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Parked into `approved_hold`** | **+0** | +7 | 6,853 → 6,853. First zero on record |
| Contact points collected | **29** | 47 | 1,063 on 09-20. Down 97% in three days |
| **Ready to write (`ready_data_scraped`)** | **6,586** | 6,586 | Flat. 96% of the parked pool |
| Leads enriched | **0** | 15 | **0 batches.** Queue is 1 lead, idling not stalled |
| `needs_contact` pool | **4,243** | 4,243 | Flat. No inflow while discovery is paused |
| Collect passes / lead slots | 4 / 600 | 3 / 450 | 08:01, 14:01, 21:01, 04:00Z. All on time |
| Collect hit rate, by pass | **0, 3, 4, 4%** | 8, 5, 1% | 32-pass median is 45% |
| Collect book remaining | **3,344** | 3,348 | Moved **4 leads on 600 slots** |
| Stranded (gap indicator) | 3 | 3 | Unchanged since 09-13. No gap reopened |
| Website resolution per pass | 79, 98, 99, 98% | 93, 79, 79% | Search was UP. Yield collapsed regardless |
| Verify passes / addresses tested | 8 / **6** | 4 / 22 | **Four passes handed nothing at all** |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `npm run send` | **18 attempted, 0 sent** | 18 / 0 | Day 14 of the fleet-wide pause |
| Fatal signatures / halts / quota stops | 0 / 0 / 0 | 0 | Nothing faulted |
| Anthropic spend | **$0.00** | $0.00 | Of a $150 hard ceiling |
| OpenRouter | $1.10/day, **$210.16** left | $2.65/day, $211.25 | 191 days. Spend fell with the workload |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | Tenth-plus identical morning. Settled |
| Alarm: `collect_yield_degraded` | 4 | 3 | **All 4 said `book_rewalk`.** None blamed Brave |
| Alarm: `collect_walking_in_place` | **13** | 0 | All 13 about ONE window. Fixed today |

**Verified, not assumed.** The three pool sizes (6,853 / 4,243 / 6,586) were queried directly
against Postgres, not read off a log. The collect and verify pass counts, hit rates, book depth and
stranded count come from the lane's own `campaign-2026-09-2*.jsonl` dispatch events. The
per-pass website-resolution rates and the 29 contact points were counted out of
`logs/bloodhound-collect.log`. The alarm counts and their attributions were counted out of
`logs/autopilot-observations.jsonl` inside the cycle window. The enrichment figure is from
`logs/backfill-2026-07/chain.log`, whose last entry before this cycle's end is a single lead
finishing at 07:13Z on 09-22.

---

## 2. Why a day of correctly running processes produced zero

The recovery lane is on **lap 6** of its book, and a lap is a second reading.

The book holds every `needs_contact` lead that still has no email address. When the lane works a
lead and comes away with a phone number and a social handle but no email, that lead stays in the
book by definition. So the next lap reads it again, runs the same thirteen methods against the same
website, and gets the same answer.

The arithmetic is blunt. The book started the cycle at **3,348** and ended at **3,344**. Four leads
left it, and the lane spent **600 lead slots** to get them. That is 150 readings per lead gained.
On 09-20 those same four passes produced 1,063 contact points.

Yesterday's debrief measured the composition: **3,016 of the book's 3,347 leads already hold a
contact point from an earlier lap**, and only **331 have never given up anything**. At 600 slots a
day, those 331 are about half a day of genuinely new reading. This cycle spent most of its day past
that point, which is why three of its four passes scored 3% to 4% and one scored 0%.

**The verify half is drained and that is a symptom, not the problem.** Verify tested six email
addresses in twenty-four hours, and four of its eight passes were handed nothing at all
(`no_pending_email_points`). Verify can only test addresses collect found. Collect found almost
none. Fixing verify would change nothing.

---

## 3. Nothing is broken, and that is the finding

This is worth stating carefully, because it is unusual and because a quiet pipeline and a broken
one look identical from outside.

- **Zero fatal error signatures. Zero halts. Zero quota stops.**
- **$0.00 Anthropic** against a $150 hard ceiling. OpenRouter at $1.10/day with $210.16 left.
- The **`stranded` counter sat at 3** all cycle, unchanged since the collect/verify gap was closed
  on 09-13. That is the number that would say leads had fallen between the lane's two selectors.
  Nothing is being hidden.
- Every timer fired on schedule: four collect passes, eight verify passes, twenty-four check-ins,
  the do-not-contact sync, the debrief.
- **The YouTube key pool read 15 working of 66 again.** Tenth-plus identical morning. That question
  was settled on 09-16 (the quota on 50 projects was cut) and is harmless while nothing searches.

**Enrichment ran no batches, and that is correct too.** Its last run was one lead finishing 07:13Z
on 09-22, and it has logged `no pending inflow, idling` ever since. Its pool reads 70 of which 69
are permanently excluded, so the real queue is one lead. Enrichment has nothing to do because the
lane that feeds it produced nothing to feed it. Do not read "0 enriched" as a collapse from 09-16's
410. Same chain, same speed, no backlog.

---

## 4. Brave Search, ranked honestly

Brave is the web search the lane uses to find a creator's own website, and nine of its ten
collection methods need one. One of its two keys has sat at a $5 monthly cap since early September,
so a refusal line prints on most passes. It is tempting to read that line as the cause of a quiet
day. It was not the cause of this one.

**Website resolution worked.** The four passes resolved a site for **119, 147, 148 and 147 of their
150 leads**, which is 79% to 99%. And yield collapsed anyway: on the worst pass, **0 of the 119
leads with a working website produced a single contact point**. You cannot blame the search when
the search succeeded and the answer was still empty.

Funding Brave is still worth something, just less than it looks. Of the book's 3,347 leads, **620
need a paid search** to get a website at all; the other 2,727 already have one stored or linked,
and reading those back costs nothing. A top-up buys attempts at 620 leads, most of which have
already been read on an earlier lap. **Rank it below the discovery decision and below Apify.**

---

## 5. What shipped

### 5a. Yesterday's fix proved itself within a day (no action needed)

The 09-22 debrief shipped `collectPassAttribution()` (`9dc4eb6`) because all three of that day's
yield alarms told Casey to raise the Brave cap on passes where search was working. The only test
behind that advice was whether the string `Brave Search API key` appeared in the log tail, and
since one key is permanently capped, that line prints on nearly every pass. A test that is always
true is not a test.

This cycle the alarm fired four times and **all four attributed the fall to `book_rewalk`**. Not
one blamed Brave. Two ran on passes with no refusal line at all; the other two named the refusal
and ruled it out in the same sentence, quoting the pass's own 98% resolution rate. **Zero wrong
spending recommendations, against three the day before.**

### 5b. Shipped today: orchestrator `0874d8a`

**The problem.** `bloodhound_collect_walking_in_place` fired **13 times between 08:11 and 20:11**,
every firing byte-identical (600 lead slots, 305 distinct leads, ratio 0.508). Thirteen reports of
one event.

Two separate faults in one alarm:

1. **It was never keyed on the pass it judges.** The 09-21 fix (`da4b849`) keyed the other two lane
   alarms so they stop re-reporting the same pass hourly. This one was left out. Third outing of
   that class.
2. **It asserted a cause that the lane's own state file refuted.** Its text read *"this is the
   cursor failing to advance rather than the lane running out of work, check for a collectCursor
   that has not moved and for collectRewinds climbing."* The state at the time read
   `collectRewinds: 0`, `collectSearchDeadRewinds: 0`, and a cursor that had moved. It was sending
   Casey to hunt a fault its own inputs said did not exist. The real cause was the lap boundary,
   and it cleared itself: the walk returned to a clean 1.00 two passes later with nobody touching
   anything.

**Fourth outing of the misattribution class**, after 09-12 (24 firings blaming Brave for a drained
book), 09-13 (`collectBookDepth` holding a private copy of a predicate it was meant to track) and
09-22 (the yield alarm blaming Brave for a re-walk). The pattern each time: an alarm that names a
remedy without testing whether that remedy is the constraint.

**The fix.** The alarm is now keyed on the window it judges, so thirteen firings become one. It
loses the repetition, not the signal. And `collectRewalkCause()` in
`src/recovery/bloodhound-lane.ts` reads the cause off `logs/bloodhound-lane-state.json` rather than
asserting it, recording the readings behind its choice in the observation so the next reader can
check the work:

- **`cursor_pinned`**, when the cursor has not moved across a completed pass. Because the alarm is
  keyed on the pass window, a second firing means a new pass finished, so this is direct evidence
  rather than inference. This is the fault the alarm exists for.
- **`rewind_loop`**, when a rewind counter **rose** since the last firing. A rise, not a standing
  count: the counters are lifetime totals, so one historical rewind would otherwise read as a live
  loop forever. That is the same "always true, so not a test" shape as the Brave line.
- **`lap_rewalk`**, when neither holds and the lane has closed a lap. It says plainly that nothing
  is faulting and that the constraint is leads to walk, not search credit and not a cursor bug.
- **`unexplained`**, when the lane has closed no lap and nothing rose. It names no remedy, which is
  the right answer when there is no evidence for one.

**Verified:** typecheck clean. **70/70 tests pass, 7 new**, including a case where the cursor
genuinely does not move which must *still* read `cursor_pinned`, so the fix cannot silence the
fault it came from, and a case proving a standing (as opposed to rising) rewind count is not read
as a live loop. Run against the real lane state and the real 09-22 log window, the alarm now reads
`lap_rewalk` where it previously asserted a pinned cursor. The full check-in was run end to end on
live logs and exited `healthy`, staying correctly silent because the current window is a clean 1.00
walk.

---

## 6. Recommended next, ranked

1. **Decide what happens to the 6,586 finished leads.** The biggest number in the pipeline, and it
   has not moved in three days. Researched, bundled, one command from a written email, with the
   loading door shut 14 days on inbox placement. Every other item here is about making that number
   grow. This one is about whether it is ever worth anything. **Casey's call, no code involved.**
2. **Decide on the discovery pause.** The pause did what it was called for: the enrichment backlog
   is finished and the recovery lane has read its book. Roughly half a day of unread leads remains.
   After that, days like this one are the normal state rather than an anomaly. Lift it, wait for
   Apify on 30 September, or accept zero and single-digit days until then. **Casey's word alone. No
   agent may touch this.**
3. **Watch Apify on 30 September.** Its billing cycle rolls in about seven days. Last run it
   recovered 62 leads in 52 minutes at $0.099 each, half its self-halt ceiling. It is resting on a
   $10 reserve, correctly, and needs nothing done to it. It is the one source of new leads that
   arrives without a decision.
4. **Fund Brave only if the first two are settled.** $5 per 1,000 searches, key `_2` still capped at
   $5. It buys attempts at the **620** book leads with no website on file, most already read once.
   It would not have changed this cycle.
5. **The 09-17, 09-18 and 09-19 debriefs are still unwritten.** Three cycles of history are gone.
   The 09-20 detection fix works and names them correctly every morning, but writing them needs a
   human re-login on the VPS. No Anthropic API key may be used instead.
6. **Before the email pause lifts, find what fires `npm run send` at session start.** It ran again
   at 07:20 with **18 leads**, up from 14 on 09-20. Harmless only because the pause refuses it. The
   moment placement improves, the next debrief agent sends 18 emails without being asked.

---

## 7. The thing worth keeping

A pipeline with nothing left to do and a pipeline that is broken look identical from outside. Both
produce zero. Every guard held, every timer fired, every process exited clean, and the output was
nothing.

The only numbers that told the difference were ones nobody alarms on: the size of the book and how
much of it has been read before. Two of the three alarms that fired were about a genuine slowdown
with no fix available, and the third spent the day pointing at a fault that did not exist.

**Deliberately not done:** nothing touching discovery, no `.env` or secrets, no alarm threshold
lowered to make a known-cause quiet day look better, no release of held leads, no email sent, no
halt flag written. The loop is left running for the next cycle.
