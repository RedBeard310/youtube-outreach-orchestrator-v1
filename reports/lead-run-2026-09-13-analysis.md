# Lead Run Analysis — 2026-09-13

**Cycle:** 2026-09-12T07:00Z → 2026-09-13T07:00Z
**Headline:** 0 parked into `approved_hold`, the first zero-park day on record. The cause was a
one-clause gap between the recovery lane's two queries that hid 2,780 of 3,735 `needs_contact`
leads. Fixed and verified the same morning. The collect book went from **251 to 3,028**.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| Parked into `approved_hold` | **0** | 2 | Pool flat at 5,756 |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `needs_contact` pool | 3,735 | 3,735 | Nothing in, nothing out |
| Collect pool (as the lane ran) | 251 | 253 | Against 600 lead-slots/day |
| Stranded between the two selectors | 2,780 | 2,778 | 2,282 hold a stored website |
| Already ruled on and failed | 704 | 704 | Correctly retired |
| Contact points collected | **6** (2 leads) | 83 | In 24 hours |
| Verify queue depth | 4 | 4 | Of a 200 batch |
| Leads resolving no website | **825 / 903 (91%)** | ~ | Healthy is ~15% |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing faulted |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter | $2.37/day, $56.33 left | $2.27/day | ~24 days runway |
| YouTube keys working | 15 / 66 | 15 / 66 | Irrelevant, discovery paused |

**The number that exposed the day:** the last six collect passes spent **903 lead-slots on 253
distinct leads**, a 3.6× re-read of the same book. Four of the six ended
`Collected 0 contact points from 0/150 leads`.

---

## 2. Root cause

Two queries drive the recovery lane and they disagreed about what "done" means.

- `COLLECT_IDS_SQL` excluded any lead holding **any** contact point.
- `VERIFIABLE_IDS_SQL` only selects leads holding an **email** contact point.

A lead the collector worked once and came away from holding a website, a phone number or a social
handle satisfied neither. Collect would never look at it again; verify could never rule on it.

That gap held **2,780 of 3,735** `needs_contact` leads. All 2,780 clear the score bar and 2,777
carry an `outreach_status` the lane accepts, so the contact-point clause was the only thing hiding
them. **2,282 of them already had a website found and stored** — the expensive half of the job,
paid for and then skipped.

This is the third instance of the same mistake in this lane (08-24 on the verify selector, 08-27 on
the collect selector, today on the boundary between them): **a query that reads "we got something
for this lead" as "this lead is finished."**

### Why Brave was a real problem but not the main one

Brave answered `402 Usage limit exceeded` on every pass and 91% of leads resolved no website. Nine
of the collector's eleven methods need a website, so those passes were near no-ops. But a top-up
this morning would have bought **251 leads**, not 3,735. The hourly check-in had been recommending
that top-up for nine days. After the fix the ranking flips: about **1,332** leads in the widened
book have no stored site and no declared link, so Brave is the only route to them, and topping up
is now worth doing.

---

## 3. Fixes shipped

| Commit | Repo | What |
|---|---|---|
| `e2d7b81` | orchestrator | `COLLECT_IDS_SQL` excludes on the absence of an **email**, making it the exact complement of the verify query. Tier is now "has a site to work with for free" (declared link **or** stored website), so the cheapest and likeliest-to-yield leads lead each lap. |
| `aa66cd69d` | email-outreach | `storedWebsite()` in `src/bloodhound/db.ts`. `buildContext` now reads back a website this engine already resolved, before falling to Brave. |
| `8301c6d` | orchestrator | `collectBookDepth()` derives both counts from the selector's own exclusion instead of a stale copy, so the book-drained alarm cannot outlive the bug it describes. Alarm text rewritten. |

### Verification (live, not assumed)

- Widened book measured through the real selector: **251 → 3,028**, matching `251 + 2,777` exactly.
- Cursor paging checked across two consecutive 150-lead batches: **0 overlap**, and the pair equals
  the first 300 of the book in order, so no lead is skipped or repeated at a batch boundary.
- `storedWebsite()` tested on 8 stranded leads that have a stored site and **no** `external_links`,
  with both Brave keys blanked: **8 of 8 websites recovered, zero Brave calls.** Recovered sites
  include a law firm, a dental practice and a realty firm, all previously logging `site=(none)`.
- `collectBookDepth()` after the change: pool **3,028** (matches the selector exactly), stranded
  **2,780 → 3**, and `bookDrained` correctly stops firing.
- Orchestrator: `tsc --noEmit` clean, **38/38** lane tests pass (two tests that pinned the old
  selector text were rewritten to pin the gap-closing property and the two selectors' agreement).
- Email repo: `tsc --noEmit` clean, **150/150** vitest tests pass.

### Trust note on reusing a stored website

Only methods 33 and 34 write `kind='website'`, both from links the creator declares on their own
channel page or About text, which `resolveWebsite` already trusts without a name check. Brave
guesses only ever become a `website` point after passing `websiteCandidateLooksOwned`, and
multi-tenant hosts like `kw.com` are filed as `other`, never `website`. The socialish and
third-party screen is re-applied on read anyway. Reading the column back does not lower the bar.

---

## 4. Ranked next levers

1. **Watch the next four collect passes.** The fix predicts contact points climbing well past 6/day
   without any Brave top-up, because the first leads in each lap now have a site to reuse. If that
   does not happen, the diagnosis is wrong and the next debrief should say so. Costs nothing.
2. **Raise the Brave cap.** Casey's spend decision, and its value changed today: from 251 leads to
   roughly 1,332. Recommended now, where for nine days it was the wrong first move.
3. **Decide what happens when the lane drains for real.** With discovery paused, `needs_contact`
   gains nothing. The widened book is about five days of walking at 600 lead-slots a day. When it
   closes, the recovery lane has genuinely finished. Lifting the discovery pause is Casey's call
   alone, but the clock is now about a week rather than open-ended.
4. **Apify endspec** stays the paid fallback for leads Brave cannot reach, at roughly $0.30 per
   parked lead. Not recommended until the Brave question is settled.
5. **Add a repeat-walk alarm** (distinct leads over lead-slots per cycle). No guard noticed a 3.6×
   re-read because every existing check watches faults and yield, not repetition. Deliberately left
   unbuilt today so it can be written against a lane in its normal state.

---

## 5. What this day teaches

**Nothing faulted, and that is why it went unseen for five days.** Every guard held, every process
ran on schedule, spend stayed at zero, and the day produced nothing. A lane repeating itself is
indistinguishable from a lane working, from the outside. Both halves of the lane had honest,
well-commented reasons for their queries; the bug lived in the space between them, which neither
file was responsible for.

**The alarm was confidently pointing at a paid remedy.** For nine days the hourly check-in told
Casey to raise a search-plan cap that would have unblocked under a tenth of the pool. The
2026-09-12 session caught that and added the book-depth measurement; today closed the gap it found.
An alarm that names the wrong remedy is worse than no alarm when the remedy costs money.

**Fix the free half first.** The widened book works with Brave dead because 2,282 of the recovered
leads already have their website paid for. Shipping the free half before the spend decision is what
makes the spend decision measurable next cycle.

---

## 6. Standing orders

Discovery of new channels stayed off throughout. No sweep, refill timer, keyword harvest or
`autopilot-campaign.service` was re-enabled, restarted or repaired, and `logs/discovery-paused.flag`
was not read-modified or removed. Paused lanes, stale sweep state files and zero new channels are
the intended state and are not reported as anomalies. No `.env` file was read or written. No halt
flag was written and the loop was left running: nothing today was unsafe to leave running. Session
spend: $0.00 Anthropic, no metered LLM API credits.
