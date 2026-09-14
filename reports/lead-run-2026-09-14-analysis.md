# Lead Run Analysis — 2026-09-14

**Cycle:** 2026-09-13T07:00Z → 2026-09-14T07:00Z
**Headline:** Yesterday's collect fix worked completely, and without spending anything. The
recovery lane collected **958 contact points** against 6 the day before, with Brave refusing on
every pass. But the bottleneck moved one step to the right: **40 leads recovered a verified email
and only 6 of them could park**, because the other 34 need a Signal Score v2 re-run with that
email before the hold gate will take them, and no automated step does that. The re-run is **free**
and would clear all 34.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| Parked into `approved_hold` | **24** | 0 | **6 from the lane, 18 from the v2 pilot batch** |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `needs_contact` pool | **4,077** | 3,735 | +342, all from re-scoring, see §3 |
| Collect pool (through the real selector) | **3,311** | 251 | A 13× book |
| Stranded between the two selectors | 3 | 2,780 | The gap stayed closed |
| Collect passes / lead-slots | 4 / 516 | 6 / 903 | Cadence unchanged |
| Distinct leads walked | **516 (ratio 1.00)** | 253 (0.28) | No repetition at all |
| No-website rate, last pass | **19 / 150 (13%)** | 825 / 903 (91%) | Healthy is ~15% |
| **Contact points collected** | **958** | 6 | Across **183** leads |
| — of which are email addresses | **94 (10%)** | 0 | Rest: 365 social, 299 website, 81 phone |
| Leads yielding any email | 66 / 183 (36%) | 0 | |
| — whose email verified good | **40 / 66 (61%)** | 0 | A healthy verify rate |
| — **that reached `approved_hold`** | **6 / 40 (15%)** | 0 | **The new bottleneck** |
| Verify queue depth, now | 4 | 4 | Drained; the verifier ruled on all it could |
| `npm run send` | 0 sent of 3 | 0 ready | Composed 3, damaged 3 rows, see §4 |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing faulted |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter | **$7.65/day, $48.68 left** | $2.37/day, $56.33 | Runway 24 days → **6.4** |
| YouTube keys working | 15 / 66 | 15 / 66 | Irrelevant, discovery paused |

**The number that settles yesterday's diagnosis:** the no-website rate across the day's four
passes ran **91% → 74% → 88% → 13%** while Brave refused on all four.

**The number that defines tomorrow's problem:** 40 verified emails, 6 parked.

---

## 2. The collect fix worked

The 09-13 prediction was deliberately falsifiable: widening the collect book puts leads that
already hold a stored website at the front of each lap, `storedWebsite()` reads that site back
instead of re-buying it, so yield should climb **with Brave dead**. Brave stayed dead. The last
pass collected **771 contact points from 145 of 150 leads** at a 13% no-site rate. The best pass
of the fully-funded era was 885 points off 148 leads, so the lane is back at roughly its old
ceiling while buying nothing.

The repetition measure confirms it from the other end: **516 lead-slots on 516 distinct leads**,
a ratio of 1.00, against 253 over 903 yesterday.

**Nothing further is needed on the collect half.** Every remaining constraint sits downstream of
it.

---

## 3. Where the lane now stops

Two gaps sit between a collected contact point and a parked lead. The first is expected. The
second is new and is the finding of the day.

**Gap one: a contact point is usually not an email.** 958 points came off 183 leads, but only
**94** are email addresses. The rest are social profiles (365), websites (299), phone numbers
(81), domain records (73) and a scattering of names and addresses. Useful to a human, useless to
a lane whose only exit is a verified email. 66 of 183 leads yielded an email at all, and **40 of
those verified good**, a 61% verify rate that is perfectly healthy.

**Gap two: 34 of those 40 cannot leave `needs_contact`.** They hold a good, verified email and
they are stuck. Checked against the database: **not one of the 34 has an old signal score of 6 or
more, and all 6 that did park do.**

That is Casey's v2 hold gate working exactly as written. The rule is that a lead may enter
`approved_hold` at old score 6+, **or** v2 7+ *once the score has been re-run with the verified
email*. The contact gate was widened to old 6+ or v2 6+, so the lane now recovers leads it could
never have worked before. But nothing in the lane runs the post-verification re-score, so a lead
that arrives under the old bar recovers its email and then stops one cheap step short of the
finish.

The 18 pilot leads that parked today prove the route works: they also score under 6 on the old
measure, and they parked because somebody ran the v2 re-score on them by hand.

**The blocking step is free, and every one of the 34 would clear the gate.** Read from the
database rather than assumed: all 34 already carry a v2 score, so the paid classification stage
has already run on them. **16 sit at v2 8, 10 at v2 7, 8 at v2 6, and all 34 have their contact
component at 0.** `rescore-v2.py --stage assemble` is pure SQL with no model call; it adds the one
contact point each lead has now earned, taking them to 9, 8 and 7 against a gate that wants 7.
**34 of 34.**

**Why it was still not done here.** The script lives in `automator`, outside the five repos this
agent may modify, and it is a bulk lead write, which that repo's permission guard blocks without
Casey's word. The question is not the cost of the re-score, which is zero. It is what parking
starts: enrichment spend, which is the same reason Casey is holding the last run's 290 valid-email
leads. A decision, not a defect. Lever #1.

---

## 4. The `needs_contact` pool grew, and it is not discovery

`needs_contact` went 3,735 → 4,077. With every sweep off, that looks alarming at a glance. It is
the 09-13 standing order landing.

5,395 channels with 10k+ subscribers had never been given a Signal Score v2, because
`rescore-v2.py` only scored leads already at old score 6+. Casey's widened contact gate went live
in both repos this morning, moving 342 already-owned leads into the lane's reach.

Checked, not assumed: every arrival was first discovered between May and September. 13 from May,
34 from June, 135 from July, 146 from August, 18 from September. No channel was discovered, no
sweep ran, no timer was touched.

This also resets yesterday's drain clock. The lane was described as having about five days of book
left with nothing replenishing it. It now holds 3,311 leads, and the refill source has barely
started, since only the finance and coaching slices have been scored.

---

## 5. Fixes shipped

| Commit | Repo | What |
|---|---|---|
| `f124b1bb6` | email-outreach | A run that will push reads the email pause **before** composing. The per-lead guard stays but no longer writes `failed` for a pause, and it halts the batch. |
| `bb0a319` | orchestrator | `bloodhound_collect_walking_in_place`: measures distinct leads against lead-slots over the last day of passes, fires below a 0.7 ratio, names the cursor rather than a spend remedy. |

### The send failure, in full

`npm run send` fired 3 parked leads at 07:20. All three composed successfully (3 LLM calls, 59
seconds), then all three refused at the SmartLead POST because outgoing email has been paused
since 09-10 over spam placement. Every one was then written back as `outreach_status = failed`.

That is wrong twice. The compose was spent on a condition known before the run started, and
`failed` drops a fully prepped lead **out** of the send queue (`APPROVED_FIRE_READY` is
`ready_data_scraped` / `enriched` / `email_drafted`) for a reason that says nothing about the
lead.

**This is the third instance of the same shape**: a missing campaign id on 09-09, and the email
pause twice over. The guard was correct each time and sat at the end of the pipeline each time.
The lesson is about where a refusal is *read*: a condition that will refuse every lead in a batch
identically belongs before the first one costs anything. The 09-09 fix already established that
pattern in this exact file; the pause was simply never added to it.

**The three damaged rows were repaired** to `email_drafted` with drafts intact, so they send the
moment Casey lifts the pause.

### Verification (live, not assumed)

- Preflight run live against the real pause file: refuses in under a second, before the lead
  fetch, before the inbox-health gate, before any LLM call. Exits 0, because a pause Casey set on
  purpose is not a fault and a nonzero exit would read as a broken send to every check watching
  for one.
- **Prep is deliberately unaffected.** The gate keys on `runWillPush`, extracted for exactly this
  reason and now covered by tests: `--stop-after enrich` (the tick's prep) and `--stop-after
  verify` (d100 and the campaign verify lane) do not push, so the send pause cannot stop
  enrichment. With discovery paused, enrichment is the only work Casey wants running, and a rule
  that miscounted those as pushes would have halted the whole pipeline over a send switch.
- Email repo: `tsc --noEmit` clean, **197/197** vitest pass (9 new in `tests/email-pause.test.ts`,
  covering the pause file's read semantics including "unreadable means paused", and every
  `--stop-after` carve-out).
- Orchestrator: `tsc --noEmit` clean, **52/52** node tests pass (6 new for `collectRewalk`,
  including the exact 2026-09-12 shape of 571 slots over 271 distinct leads).
- New alarm run against the live collect log: `{slots: 516, distinct: 516, ratio: 1}`, **silent**,
  the correct reading for a healthy lane. Full check-in executed end to end against a scratch
  observations file: exits clean, spends no fix-agent.
- The 40-versus-6 gap, the old scores behind it, and the 342 arrivals' discovery dates were all
  read from Postgres rather than inferred.

### One correction worth recording

The first pass at this debrief reported a verify queue of **764** and called it next cycle's
parking. That was a raw count of `needs_contact` leads holding any email contact point. Run
through the lane's own `VERIFIABLE_IDS_SQL`, the real queue is **4**: almost all of those emails
had already been ruled on. Chasing the discrepancy is what surfaced the 40-versus-6 gap above. A
count that does not go through the selector is not the selector's queue, which is the same lesson
this lane taught on 08-24, 08-27 and 09-13.

---

## 6. Ranked next levers

1. **Decide whether the recovery lane may re-score a lead after its email verifies.** This is the
   difference between the lane producing 6 parked leads a day and producing 40. **The step itself
   is free and would clear all 34:** every one is already classified, so `--stage assemble` makes
   no model call, and adding the earned contact point takes 16 leads from v2 8 to 9, 10 from 7 to
   8, and 8 from 6 to 7, against a gate that wants 7. What needs deciding is not the re-score's
   cost but what parking triggers: enrichment spend, the same reason the last run's 290
   valid-email leads are on hold. The backlog grows every cycle the lane runs well. If the answer
   is yes, the step belongs inside the lane so it is never forgotten again.
2. **Top up OpenRouter.** $48.68 at $7.65/day is **6.4 days**. The higher rate is the v2 scoring
   and email-finding work ordered on 09-13, and only two niches of that job are done, so it is
   more likely to hold than to fall. An empty balance stops enrichment, which is the entire point
   of the discovery pause. The only item with a deadline.
3. **Probe Brave before spending on it.** Two different faults now wear one label: a `402` cap on
   key `_2`, and `no key answered (network or timeout)` on key `_1`, which Casey funded with $50
   on 09-13. Yesterday's recommendation to raise the cap assumed a single fault. One live call
   settles it. Not urgent while the lane routes around Brave entirely, but it returns for the
   ~1,300 book leads with no site to reuse.
4. **Decide what "placement improves" means for lifting the send pause.** Off since 09-10 at 7%
   spam on the best inbox. Prepped leads are stacking behind it and more are coming. Nothing is
   lost while they wait and nothing is gained. Casey's call alone; no agent should touch
   `config/email-pause.json`.
5. **Leave the collect half alone.** It is running at full rate, the stranded count is 3 and
   stable, and the new repeat-walk alarm will say so if the cursor ever pins.

---

## 7. What this day teaches

**A fix that predicts a number is worth more than a fix that explains one.** Yesterday's debrief
committed to contact points climbing past 6/day with no Brave top-up, and said in writing that if
it did not happen the diagnosis was wrong. It happened, at 958. That is a far stronger result than
the same fix shipped with a confident explanation and nothing staked on it.

**Fixing a bottleneck reveals the next one, and the next one is usually a policy rather than a
bug.** The collect half is now excellent and the lane still parks 6. What stops it is a rule
working correctly: the hold gate wants a fresh score, and nobody wired the re-score in. No test
fails, no alarm fires, and no log line looks wrong.

**The same bug shipped three times because the guard kept being right.** The campaign-id gap, and
now the email pause twice, all refuse correctly at the SmartLead POST. Nothing was ever broken in
the guard, so nothing drew attention to the refusal being read too late to be free.
Correct-but-late is a failure mode no test catches, because every test passes.

---

## 8. Standing orders

Discovery of new channels stayed off throughout. No sweep, refill timer, keyword harvest or
`autopilot-campaign.service` was re-enabled, restarted or repaired, and `logs/discovery-paused.flag`
was read but not modified or removed. Paused lanes, stale sweep state files and zero new channels
are the intended state and are not reported as anomalies. The rise in `needs_contact` is
re-scoring, not discovery. No `.env` file was read or written, and `config/email-pause.json` was
read but never modified. No re-score was run and no held lead was promoted, both being Casey's
spend decisions. No halt flag was written and the loop was left running: nothing today was unsafe
to leave running. Session spend: $0.00 Anthropic, no metered LLM API credits.
