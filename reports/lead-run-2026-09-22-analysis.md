# Lead Run Analysis — 2026-09-22

**Cycle:** 2026-09-21T07:00Z → 2026-09-22T07:00Z
**Headline:** The pipeline parked **7 leads**, the weakest ordinary day since the discovery pause
began. The cause is not the one the alarms named. Three times this cycle the check-in told Casey
that website searches were failing and he should raise the Brave Search cap. Those three collect
passes resolved a website for **93%, 79% and 79%** of their leads. Search was working. What had
actually happened is that the recovery lane finished a full lap of its book at 06:01Z on 09-21 and
immediately started it again from the top, and a second reading of a lead it has already worked
finds nothing. **Every lead in the last two passes had been read before.** The lane collected **47
contact points against 1,063 the day before.**

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Parked into `approved_hold`** | **+7** | +95 | 6,846 → 6,853. Weakest ordinary day of the pause |
| — claimed by the lane's own log | 13 | 19 | Three re-score passes; 6 leads left the pool in the same window |
| — from Apify endspec | 0 | 62 | At its $10 reserve, $0.0054 spendable |
| **Contact points collected** | **47** | 1,063 | A 96% fall. 15 of the 47 were email addresses |
| **Ready to write (`ready_data_scraped`)** | **6,586** | 6,570 | 96% of the parked pool |
| Leads enriched | 15 | 86 | 4 batches, **0 failures**, idle after every one |
| `needs_contact` pool | **4,243** | 4,241 | Flat. No inflow while discovery is paused |
| Collect passes / lead-slots | 3 / 450 | 4 / 554 | Lap 5 closed 06:01Z 09-21; lap 6 open |
| Collect hit rate, by pass | **8, 5, 1%** | 45, 44, 26, 30% | Lane normal is ~46% |
| **Batch already read before** | **100, 100%** (last two) | not measured | New reading, shipped today |
| Website resolution failures | **7, 21, 21%** | 61, 60, 74, 78% | Resolution RECOVERED and yield still collapsed |
| Verify passes / leads tested | 4 / **22** | 3 / 43 | 3 more passes handed nothing at all |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `npm run send` | **18 attempted, 0 sent** | 15 / 0 | Refused by the 09-10 pause, confirmed in the DB |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing crashed |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter | $2.65/day, **$211.25** left | $9.80/day, $213.90 | ~80 days. Spend fell with the workload |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | Fifteenth identical morning |

**Verified, not assumed.** The zero sends were checked directly against Postgres (no lead reached
`sent_to_smartlead` in the cycle window). The 47-vs-1,063 contact-point counts, the book
composition and the Brave-dependency split were all queried against `leads.contact_points` and
`leads.lead_candidates`, not read off a log. The re-read percentages were computed from the collect
log's own per-lead lines. The new check-in code was run end to end against the live logs before
committing.

---

## 2. What actually happened

### The lane has read its whole book and started again

The recovery lane keeps a book of leads it wants contact details for and walks it in laps. Since
the 09-13 widening the book runs about 3,347 leads, roughly five days per lap at 150 leads per
6-hourly pass. **Lap 5 closed at 06:01Z on 09-21**, signalled the way the queue signals it, by
coming up short (104 leads instead of 150). Lap 6 opened behind it at the top of the book.

The three passes of this cycle are that second reading:

| Pass | Website found | Produced a contact point | Already read before |
|---|---|---|---|
| 09-21 13:01Z | 93% | 12 of 150 | **100%** |
| 09-21 19:01Z | 79% | 7 of 150 | **100%** |
| 09-22 02:00Z | 79% | 1 of 150 | **100%** |

The book's composition says why a second reading is worth so little. Of the 3,347 leads in it,
**3,016 already hold a contact detail that is not an email**, which means the lane worked them on
an earlier lap and took everything it could get. Only **331 have never yielded anything at all**,
which is about half a day of walking.

That was a known and deliberate design choice, and it was right once. The 09-13 widening kept
already-worked leads in the book on the argument that the expensive half of the job, resolving the
creator's website, was already paid for. That argument holds for the **first** walk under the new
rule. It says nothing about the second.

### Website searches recovered this cycle, and yield fell anyway

This is the fact that settles the diagnosis. Through 09-20 and into 09-21, website resolution was
genuinely failing: 42%, then 61, 60, 74, 78%. Yesterday's debrief was right to call that out. This
cycle it **recovered** to 7%, 21% and 21% failure, because the leads at the top of the book mostly
have a website already stored from an earlier lap and the collector reads it back for free.

Sites resolved, methods ran, and **1 of the 119 leads with a working website produced anything** on
the final pass. That is not a search problem in any form.

### The alarm named a remedy that would have bought nothing

All three `bloodhound_collect_yield_degraded` firings said: *"The lane logged a Brave Search
refusal, so website resolution is the likely cause: raise the plan cap or add
`BRAVE_SEARCH_API_KEY[_N]` keys."*

The only test behind that sentence was whether the string `Brave Search API key` appeared anywhere
in the tail of the collect log. One Brave key has sat at its $5 monthly cap since early September,
so that line now prints at the top of **every** pass. A test that is always true is not a test.

**This is the third outing of one bug class, and the rule was already written down twice.** On
09-12 the same alarm fired 24 times blaming Brave for a drained book, and the lesson recorded then
was: *an alarm that names a remedy costing money must be sure the remedy is the constraint.* The
09-12 fix added a suppressor, but it only fires when the day's passes cover the whole book more
than once. The book is 3,347 and a day covers 0.18 of it, so the suppressor could not fire and the
misattribution walked straight back in through the gap. Same shape as 09-13's `collectBookDepth`
keeping its own private copy of a predicate it was supposed to track: the guard was written against
the instance, not the class.

---

## 3. What was shipped

### The alarm now reads the pass it is judging, not the file it sits in

Orchestrator **`9dc4eb6`**, `src/recovery/bloodhound-lane.ts` + `scripts/autopilot/checkin.ts`.

A new reading, `collectPassAttribution()`, answers two questions about the pass being judged. Both
are free and both come off lines the collect log already writes:

- **`noSitePct`, over that pass only.** If the pass resolved its websites, search is not what
  broke, whatever a leftover Brave line says elsewhere in the file.
- **`rewalkPct`, the share of the batch that appears earlier in the log.** Measured against the
  whole log rather than a window, which is what makes it a lap-scale reading and not a restatement
  of the existing stuck-cursor check (`collectRewalk`). That one asks whether a pinned cursor is
  re-reading inside a single day, and it sat correctly silent at 1.36× while this read 100%.

The alarm now chooses between three explanations instead of always choosing the expensive one:
`site_resolution`, `book_rewalk`, or `unexplained`, recorded in a new `attributed_to` field
alongside the raw readings. The closing sentence changes with the verdict: "the remedy is a spend
call a fix agent cannot make" becomes "nothing is faulting, and no code change makes a read-out
book yield again."

The re-walk bar is 80% and deliberately high. The point is to be confident before telling Casey his
money would buy nothing, and a genuine fresh lap sits near zero rather than near the bar.

**Verified:** typecheck clean, **69/69 tests** (6 new, including the regression this exists for and
a case where a real search outage must still read as one, so the fix cannot silence the alarm it
came from). The check-in was run end to end against the live logs with observations redirected to a
temporary file. It produced:

> Website resolution is NOT what broke here: this pass resolved a site for 119 of 150 leads (79%).
> A Brave refusal line is printed on every pass because one key sits permanently at its monthly
> cap, so it is not evidence about this pass and raising the cap would not have changed it. 150 of
> the 150 leads (100%) have been collected from before in this log, and only 1 of the 119 with a
> working site produced anything. The lane is re-walking a book it has already mined. The
> constraint is leads to walk, not search credit.

It exited `healthy` and escalated nothing.

### Yesterday's fix proved itself in production the next day

The 09-21 change (`da4b849`) stopped a slow decline from erasing its own baseline by remembering
normal over 32 passes rather than 8. This cycle it was load-bearing. The 02:11Z firing read against
the long baseline of 45% and said so in its own text: the short 8-pass baseline had already sagged
to **37%**. Under the old rule the final pass, 1 contact point from 150 leads, would have been
judged against a baseline the collapse itself had dragged down.

The same commit's per-pass keying also held: **three yield alarms for three distinct passes, no
hourly repeats**, against 7 and 9 copies of two alarms the day before.

---

## 4. Corrections to the record

**Yesterday's forecast was wrong in its reasoning.** The 09-21 debrief said to expect roughly 19
parks a day until Brave is funded. The lane fell to 7, and funding Brave would not have prevented
it. The Brave slide was real through 09-20 and 09-21; it was not what capped this cycle.

**Brave is worth less than that entry implied.** Of the 3,347 leads in the book, **620 would need a
paid search** to find a website. The other 2,727 already have one stored or linked from their
channel. Money buys attempts at 620 leads, and most of those have already been walked past once
without a website being found. It belongs below the book problem and below the shelf decision, not
above them.

---

## 5. Recommended next, ranked

1. **The recovery lane is out of leads to work, and that is now the whole pipeline.** 3,016 of
   3,347 have already given up what they had; 331 have never been touched, about half a day of
   walking. With discovery paused nothing refills it. Three options, all Casey's: lift the
   discovery pause, fund Apify when the billing cycle rolls on 30 September, or accept single-digit
   days. **No code change makes a book that has been read yield more.**
2. **Decide what happens to 6,586 finished leads.** Unchanged. The shelf grows every day, the
   loading door has been shut thirteen days on spam placement, and nothing else moves it.
3. **Brave, re-ranked downward.** See §4. Still worth money eventually, but it buys 620 leads of
   attempts, not the lane.
4. **Find whatever fires `npm run send` on session start.** 14 leads on 09-20, 15 on 09-21, 18
   today. Harmless only while the pause holds.
5. **Consider retiring leads from the collect book after a lap that finds nothing.** Deliberately
   not shipped today. The lane holds no record of when a lead was last worked, so it needs a schema
   decision, and a retirement rule should be calibrated against a lane in its normal state rather
   than one mid-collapse. Today's new reading is the measurement that would calibrate it.

---

## 6. Open items carried forward

- **09-17, 09-18 and 09-19 debriefs are still unwritten.** Correctly named again by the
  `missing_debriefs` field. Their metrics are on disk so they can be written after the fact; that
  is a decision about whether it is worth the time.
- **Apify cannot run until 30 September.** $0.0054 spendable against a $10 reserve that must not be
  touched.
- **YouTube key pool: 15 working of 66**, fifteenth identical morning. Settled question, and
  irrelevant while discovery is paused.
