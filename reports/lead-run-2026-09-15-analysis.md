# Lead Run Analysis — 2026-09-15

**Cycle:** 2026-09-14T07:00Z → 2026-09-15T07:00Z
**Headline:** 789 leads parked into `approved_hold`, the largest single-day gain on record and
more than the previous best of 627. None of it is new finding. It is Casey approving two held
batches, 290 and 423, plus 60 the recovery lane earned by itself now that it re-scores its own
verified leads. Against that, the OpenRouter account emptied at 22:10Z and enrichment has produced
nothing since. The chain kept launching batches into the dead account for nine hours, 1,635 lead
attempts, each paying for its YouTube and transcript work before dying at the last step, and
finished off all 66 YouTube keys on the way. 642 leads now wait on enrichment. Adding credit is
the only thing that clears them.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Parked into `approved_hold`** | **789** | 24 | **A record.** 290 + 423 approved, 60 from the lane |
| `approved_hold` pool | 6,569 | 5,780 | 5,781 of them already enriched |
| — waiting on enrichment | **642** | ~90 | At `failed`. Non-terminal, retried automatically |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `needs_contact` pool | 4,517 | 4,077 | +440, the 990 run's no-email and invalid leads |
| Collect passes / lead-slots | 4 / 600 | 4 / 516 | Cadence unchanged |
| Contact points collected | **1,272** | 958 | Across 316 of 600 leads worked |
| Leads resolving no website | **2 / 150** | 19 / 150 | **1%, best on record** |
| Collect hit rate per pass | 82 → 35 → 47 → 47% | peaked 97% | Halved, and **not** because of Brave |
| Verify passes / leads | 6 / 88 | 6 / 129 | Queue stays drained |
| Lane re-score passes | **3** | 0 | Parked 57, 2, 1. Yesterday's lever #1, shipped |
| **Leads enriched** | **267** | 65 | **All before 22:10Z. Zero in the nine hours after** |
| Enrichment batches launched | 14 | 4 | **9 produced nothing at all** |
| Lead attempts burned on a dead account | **1,635** | 0 | Each paid for YouTube and transcripts first |
| `npm run send` | **9 of 14** | 0 of 3 | Sending is live again. Landed 07:22Z |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing crashed |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter balance | **−$0.19** | $48.68 | $1,310 bought, $1,310.19 used |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | All 66 were dead by 06:26Z |

---

## 2. What the 789 actually is

Three decisions and one lane.

- **290** at 12:06Z: the valid-email half of the 637-lead finance and coaching run.
- **423** at 02:59Z: the valid-email half of the 990-lead run.
- **60** from the recovery lane, in three hourly re-score passes of 57, 2 and 1.
- **16** ordinary arrivals.

The first two had been sitting scored and verified for days, refused by the old hold gate, waiting
on the enrichment spend that parking starts. Saying yes released them in a single write. **That
part is finished and will not repeat.**

The 60 is the part that repeats. Yesterday the same shape produced 40 verified emails and 6 parks,
because nothing re-ran the Signal Score v2 after the email verified. That step now runs inside the
lane every hour, it is free, and its first pass took 57 of 57. **The lane's floor went from 6 a day
to 60.**

So the honest reading is two records in one day, and only one of them is throughput.

---

## 3. The enrichment outage

The account hit zero at **22:10Z**. Every enrichment lead ends in a call to it, so from that moment
every lead failed.

It failed **late**, which is what made it expensive. A lead runs its YouTube harvest (stage 1),
buys its transcripts from Decodo (stage 2), then dies at stage 4 on `openrouter HTTP 402`. The paid
work happens first and is discarded.

The chain had no way to know. It gates on Supadata and Decodo, and on the YouTube key pool. **The
third paid dependency, the one every lead ends on, had no gate.** So it launched nine more batches
over nine hours: 89, 89, 89, 89, 89, 99, 99, 500, 500. **1,635 lead attempts, every batch
`exit=0 done=0`.**

Its own guards were all correct and none could help:

- The **hard-wall guard** watches the exit code, which was 0 every time.
- The **zero-progress guard** fired on all nine, read the shape correctly as an infrastructure
  outage, refunded the attempts and backed off. Then retried an hour later into the same dead
  account. Past the seventh trip it hit its refund limit and real leads began counting attempts
  against a fault that had nothing to do with them.
- The **batch size grew as it went**, because the pool grew when the 423 were promoted, so the last
  two attempts were 500 leads failing 499 apiece over two hours each.

**And twelve hourly check-ins ran through all of it and printed `healthy`.** The check-in did not
watch the backfill chain at all, while its own log line claimed enrichment lanes were still being
checked. That was survivable while discovery ran. With every sweep off, enrichment is the pipeline,
and it was the one lane nobody was looking at.

**Nothing was lost.** `failed` is non-terminal, the leads stay in the chain's pool, and the chain
picks them up by itself once credits land.

---

## 4. The recovery lane's hit rate halved, and Brave is not the reason

The collect hit rate fell **82% → 35% → 47% → 47%** across the day, against a peak of 97% on the
last pass of 09-14. The reflex for a fortnight has been to blame website resolution, since nine of
the ten collection methods need a site.

**The measurement refuses that reading.** The no-website rate over the last three passes was 2, 2
and 3 leads out of 150, so **1% to 2%, the best on record**, against 13% yesterday and 91% on
09-13. Brave refusal lines stopped appearing in the log entirely after the first pass. The sites
resolve; the leads behind them carry fewer contact points.

That is the book getting harder, not a fault. The 09-13 fix put leads with an already-paid-for
website at the front of each lap and those are being consumed. **1,272 contact points off 316 of
600 leads is still the second-best collection day on record.**

**Consequence worth carrying:** the standing recommendation to raise Brave's cap rested on
resolution being the constraint. On today's numbers it is not, and a top-up buys less than it would
have a week ago.

---

## 5. The key pool, again, and why today settles nothing

Five identical mornings: 15 working, 50 out of quota, 1 suspended, all probed about 20 minutes past
the reset. Until today, nothing of ours had spent a unit overnight, which made them one measurement
repeated.

**Today genuinely spent the pool.** The 290-lead batch ran 12:20Z to 22:11Z and had already killed
keys 31 through 40 by the time it finished; the 1,635 failing attempts ate the rest, and by 06:26Z
the run log reads `All 66 direct YouTube key(s) exhausted/blocked`. So today's reading is consistent
with ordinary spending and discriminates nothing either, for the opposite reason to the previous
four.

The untried test is unchanged: **one probe six or more hours after the reset on a quiet day**, 66
units. It needs a day when nothing of ours is spending, and clearing a 642-lead backlog is not that
day. Discovery is paused, so the pool constrains nothing meanwhile.

---

## 6. Fixes shipped

Both in the orchestrator, commit **`78b1284`**.

**1. An OpenRouter credit preflight on the backfill chain** (`scripts/backfill/chain.sh`).
`openrouter_ok()` probes the credits endpoint before every batch and waits while the balance is
below `BACKFILL_MIN_OPENROUTER_USD` (default $1), mirroring the Supadata and YouTube gates beside
it. It **fails open**: no key, a network error, a non-200 or an unparseable body all return OK, so
only OpenRouter itself saying the balance is low stops the chain. Self-clearing, and the failed
leads never leave the pool.

*Verified:* `bash -n` clean; the function extracted and run live against the real account, where it
reads −$0.19 and waits, and passes when the floor is lowered, so the pass path is exercised too,
not just a blanket refusal.

**2. A check-in alarm on a stalled enrichment chain** (`scripts/autopilot/checkin.ts`).
`backfill_chain_stalled` fires when no batch has completed work in three hours, names the cause by
reading the newest batch run log rather than guessing, and reports the **new waiting state** as
well, so a silent gate cannot outlive its own repair the way the 08-25 and 08-30 halts did.
Observation only, never a paid fix-agent: every cause seen so far ends in a spend or secrets call.

*Verified:* tsc clean; the check-in run end to end against the live logs, where it fires and
correctly names the OpenRouter 402; and against three synthetic chain logs, where it fires when
gated, and stays silent both when a batch has resumed real work and when the chain is simply idle.

*Caught before committing:* the cause-naming sorted run logs by name and picked
`probe-100-run.log`, a stray hand-run that sorts after every `batch-<date>`, then named the outage
off a file the chain never wrote. Now newest by modification time, and only `batch-*` files. Small,
but it is the exact shape that makes an alarm worse than none: confidently wrong about a cause.

---

## 7. The pattern behind the day

Three times in a week this pipeline has paid for work and then been refused at the last step: a
missing campaign id on 09-09, the email pause on 09-14, and an empty LLM account today. Every guard
was correct, and every one sat at the end.

**A condition that will refuse every item in a batch identically belongs at the front**, where it
costs one probe instead of a thousand attempts. Both fixes today are that move, applied to the two
places it was still missing.

---

## 8. Recommended next, ranked

1. **Add OpenRouter credit.** The only thing between 642 prepped leads and finished bundles.
   Roughly $95 at 16 to 17 cents a lead. Nothing is at risk while it waits, and the chain now idles
   at the new gate instead of burning YouTube quota and transcript spend. It restarts by itself the
   moment credits land. Everything else here is smaller.
2. **Expect the lane to park tens, not hundreds.** The 789 was a backlog release. The number to
   watch is the lane's own contribution, 6 → 60, and it depends entirely on enrichment having
   credit to consume what the lane produces.
3. **Re-rank Brave.** No-website rate 1% to 2%, refusals gone from the log, and the hit rate halved
   anyway. A cap raise buys real leads but fewer than the last two debriefs implied. One live probe
   before any spend, not a standing recommendation.
4. **Decide whether the 990 run's 69 risky-email leads stay out.** They were excluded because
   sending was paused. Sending resumed this morning, 9 of 14 pushed at 07:22Z, so the reason has
   changed. A deliverability judgement, not a defect.
5. **Leave the key pool question for a quiet day.** The six-hours-past-reset probe is still the only
   test that separates a late refill from a cut quota. Clearing a 642-lead backlog is not a quiet
   day, and with discovery paused the pool constrains nothing.

---

## 9. Standing orders honoured

Discovery of new channels stayed off. No sweep, refill timer, keyword harvest or campaign service
was re-enabled, restarted or repaired, and `logs/discovery-paused.flag` was read but not modified.
The paused lanes, the stale sweep state files and the zero new channels are the intended state and
are reported nowhere above as faults. The rise in `needs_contact` is the 990-lead email run's
no-email and invalid leads, not discovery. No `.env` file was read or written. No lead was promoted,
no re-score was run, no email was composed or sent by this session, and no credit was purchased.
No halt flag was written and the loop was left running: an empty LLM account stops work but is not
unsafe to leave running, and the chain now waits for it rather than grinding.

**Spend:** $0.00 Anthropic, no metered LLM API credits used by this session. The two live probes it
made, the OpenRouter credits endpoint and the check-in's log reads, are unbilled.
