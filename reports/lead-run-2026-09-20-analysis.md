# Lead Run Analysis — 2026-09-20

**Cycle:** 2026-09-19T07:00Z → 2026-09-20T07:00Z
**Headline:** The enrichment backlog is finished. **6,484 of the 6,751 parked leads (96%) are
researched and ready to write**, and the chain that used to run for seventeen hours straight now
works about **two and three quarter hours a day** because there is nothing left for it to do. The
recovery lane had its best ordinary day of the pause, **+64 parked**, more than double the 25 a
day it had been managing. Nothing left the building: outgoing email has been paused since
2026-09-10 on spam placement, and the 07:20 send was refused before it composed anything for the
eleventh day running. Three things came out of the logs that nobody had seen: the 09-17, 09-18
and 09-19 debriefs were never written because the agent's login had expired, the Apify recovery
lane has been resting on money it could spend since 09-06, and something fires a live send every
time an agent opens this repo.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Parked into `approved_hold`** | **+64** | +25 | 6,687 → 6,751. Best ordinary day of the pause |
| **Ready to write (`ready_data_scraped`)** | **6,484** | ~6,420 | 96% of the parked pool |
| Leads enriched | 64 | ~30 | 4 batches, **0 failures** |
| Enrichment queue at cycle end | **~15** | ~15 | Pool reads 84, of which 69 permanently excluded |
| Enrichment duty cycle | **2h42m of 24h** | similar | `no pending inflow — idling` after every batch |
| `needs_contact` pool | **4,335** | 4,399 | Down 64, exactly the parks |
| Collect passes / lead-slots | 3 / 450 | 3 / 450 | Book 3,495 left, stranded 3, lap 5, tier 1 |
| Verify passes / addresses tested | 4 / **103** | 4 / 51 | Roughly doubled |
| Lane re-score parks | **55** | 1 | 4 + 22 + 16 + 13 |
| **Website resolution failures** | **42%** | 14% | Was 1–4% a week ago. Brave is capping out |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `npm run send` | **14 attempted, 0 sent** | same | Refused by the 09-10 email pause |
| Apify endspec | resting, day 14 | resting | $16.11 left, $10 reserved, batch needed $7.02 |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing crashed |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter | $7.71/day, **$223.71** left | — | 29 days of runway |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | Settled: quota cut on 50 projects |

Attribution note: the recovery lane accounts for 55 of the 64 parks. The other 9 are not
attributable from the logs. Apify was resting all cycle, so they did not come from there.

---

## 2. The enrichment backlog is done, and that is why the number fell

On 09-16 the chain ran one batch for seventeen hours and finished 410 leads. This cycle it
finished 64. Same chain, same speed, no code change. What changed is that it has run out of
backlog.

The pattern in `logs/backfill-2026-07/chain.log` is the whole story:

```
10:21Z  launching batch: count=5   pool=74  excluded=69   →  done=5   failed=0  (17 min)
        no pending inflow — idling
14:09Z  launching batch: count=25  pool=94  excluded=69   →  done=25  failed=0  (60 min)
        no pending inflow — idling
21:11Z  launching batch: count=19  pool=88  excluded=69   →  done=19  failed=0  (39 min)
        no pending inflow — idling
04:22Z  launching batch: count=15  pool=84  excluded=69   →  done=15  failed=0  (46 min)
        no pending inflow — idling
```

`pool` is every parked lead that still needs enriching. `excluded` is the 69 that have failed
before and are not retried. The difference between them is the real queue, and after each batch
it goes to zero. The chain now runs on the day's arrivals and waits.

**The shelf, from the database directly:**

| `review_status` | `outreach_status` | Count |
|---|---|---|
| `approved_hold` | `ready_data_scraped` | **6,484** |
| `approved_hold` | `sent_to_smartlead` | 133 |
| `approved_hold` | `failed` | 127 |
| `approved_hold` | `email_invalid` | 6 |
| `approved_hold` | `email_verified` | 1 |
| `approved` | `sent_to_smartlead` | 1,809 |
| `approved` | `ready_data_scraped` | 11 |
| `approved` | `email_drafted` | 3 |
| `needs_contact` | `no_email_found` | 3,113 |
| `needs_contact` | `email_invalid` | 1,219 |

This is what the discovery pause was called for on 09-08, and it is finished. Enrichment is no
longer the constraint on anything.

**Do not read 64 as a collapse.** If enrichment throughput is wanted back, the only thing that
creates work for it is new arrivals: the recovery lane, the Apify lane, or lifting the discovery
pause. That is a supply decision, not a repair.

---

## 3. The recovery lane doubled, and nobody changed anything

Both halves moved at once. Addresses tested per verify pass, earlier in the week against this
cycle:

```
09-17   15  19
09-18   12  16  14   9
09-19   8   32  38        ← this cycle
09-20   25                ← this cycle
```

103 addresses tested, 55 parked, a flip rate of about 53%. Earlier in the week the same step was
parking 1 to 4 per pass. No code shipped in any of the five repos between 09-16 and now, so this
is the collect cursor reaching a better slice of the book rather than anything we did. Worth
watching rather than explaining: if it drops back to 25 a day next cycle, the cursor moved on.

The lane is on lap 5 of tier 1 with **3,495 leads left in its collect book** and 3 stranded (leads
holding a non-email contact point that cannot be collected). A climbing stranded count is the
signal that the collect/verify selector gap reopened; 3 is where it has sat.

---

## 4. Brave Search is running out, and both alarms are correctly silent

Nine of the lane's ten collection methods need the creator's own website, and resolving it is a
Brave Search call. Brave bills each key against its own monthly cap. Share of leads where no
website could be found, by collect pass:

```
7 passes before 09-18    1–4%      no Brave refusal logged
09-18 late               4%        refusal logged
09-19 06:01Z            14%        refusal logged
09-19 13:01Z            43%        refusal logged
09-19 20:01Z            35%        refusal logged
09-20 02:01Z            42%        refusal logged
```

Each of the last five passes opens with:

```
[bloodhound] All 2 Brave Search API key(s) refused: 402 Usage limit exceeded — the plan's
monthly spending cap is reached; raise the cap or add keys.
```

Key `_1` was funded with $50 on 09-13. Key `_2` has been at its $5 cap since before that. At $5
per 1,000 searches and roughly 150 searches a pass, a week of three-passes-a-day is about what
$50 buys.

**Why nothing alarmed.** Two detectors cover this and both are below threshold, correctly:

- `bloodhound_site_resolution_collapsed` needs **70%** no-website. We are at 42%.
- `bloodhound_collect_yield_degraded` needs a **40% fall** in leads that produced any contact
  point. Yield actually held: 99 and 114 of 150.

The lane is still finding contact points through channel links and the other methods while the
website half of it dies quietly. That is why the day's output looked good and the trend does not.
**No code was changed for this.** It is a spend decision, and lowering a threshold to catch a
known-cause drain would be churn, not a fix.

---

## 5. What broke

### 5a. Three debriefs were never written, and the timer reported success

`logs/autopilot-sessions/debrief-2026091{7,8,9}*.json` all contain:

```json
{"is_error": true, "duration_ms": 143,
 "result": "Failed to authenticate: OAuth session expired and could not be refreshed"}
```

The grounded metrics file was gathered each day. The agent returned in about 130 milliseconds
having done nothing. `debrief.sh` ends in `exit 0` unconditionally, so systemd logged three clean
runs, and the publish step ran against files that did not exist and said nothing useful. Three
cycles of history are simply gone. Today's run authenticated fine, so whatever expired has since
been refreshed.

**Fixed, in the orchestrator:**

1. `scripts/autopilot/debrief.sh` now checks its own work. If the agent's result JSON carries
   `is_error`, or the report file for that date is still missing afterwards, it writes
   `logs/autopilot-debrief-missing-<date>.flag` with the reason, appends a
   `autopilot_debrief_failed` observation to `logs/autopilot-observations.jsonl`, and prints a
   loud line naming the cause. Still `exit 0` — a missed report must not stop the timer — but it
   can no longer be silent.
2. `scripts/autopilot/debrief-data.ts` now emits `missing_debriefs`: the last seven cycle dates
   with no `lead-run-<date>.html` in the brain, each with its failure reason when one was
   recorded. The next agent that runs is handed the gap and can backfill it.

That is the self-healing half. A failed login cannot be retried from inside the script, but the
next working run now knows what it missed.

### 5b. The Apify lane has been resting on money it could spend, for 14 days

`apify-endspec` is the best contact-recovery method in the pipeline: it solves the captcha behind
YouTube's "View email address" button, 92% of channels return a published address, and about 59%
of every channel run becomes a usable lead. It has not run since **2026-09-06**. Twelve times a
day since then:

```
[apify-loop] resting: $16.1132 left, $10 reserved, batch of 100 needs $7.02 —
             waiting for the cycle to reset
```

The arithmetic never changes. $16.11 − $10 reserve = $6.11 spendable, a batch of 100 costs $7.02,
so the test fails every tick until the Apify billing cycle rolls on 30 September. The $10 reserve
is deliberate and stays. The **fixed batch size of 100** was the bug: an all-or-nothing test on a
budget that will never again be that large this cycle.

**Fixed, in `youtube-email-outreach-v1/scripts/apify-endspec-loop.sh`:** the loop now sizes the
batch to what is spendable, capped at `APIFY_BATCH_SIZE` and floored at `APIFY_MIN_BATCH_SIZE`
(default 25, big enough that the price-ceiling strike logic still gets an honest sample). It rests
only when even the floor will not fit. On today's ledger that is **87 channels**, roughly 51
expected recoveries, without touching the reserve.

### 5c. Something fires a live send every time an agent opens this repo

Not a timer and not a cron job. `orchestrator-<date>.jsonl` has carried
`manual_send_run: true, send_attempted: 14` at 07:20 every day since 09-15, and the journal shows
it under the `debrief.sh` unit at the exact moment the debrief agent starts. Its output is spliced
into the agent's own prompt, which is the signature of a session-start hook. There are no hooks in
`.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, or any plugin
config I could read.

It is harmless right now: every attempt is refused by the email pause before composing. **If the
pause lifts, the next debrief agent will send 14 leads at 07:20 without being asked.** Nothing was
changed for this — locating the trigger needs whoever put it there.

---

## 6. Everything that stayed quiet

- **Discovery**: 0 new channels, every sweep stopped, every state file stale. Intended since
  09-08, not an incident, and nothing was restarted.
- **Fatal signatures**: none. No halts, no quota stops, no crashes.
- **Anthropic**: $0.00, subscription only.
- **OpenRouter**: $7.71 a day, $223.71 left, 29 days of runway. Well down from the $41/day of the
  backfill peak, for the same reason enrichment is quiet.
- **YouTube keys**: 15 working of 66 at the reset, the same as every morning for two weeks. Settled
  question — the quota was cut on 50 of the projects — and irrelevant while discovery is paused.

---

## 7. Recommended next, ranked

1. **Decide what happens to 6,484 finished leads.** Enrichment has cleared its backlog, the shelf
   grows about 64 a day, and the exit has been shut for eleven days on spam placement. This is the
   only number that matters now. Everything below is small next to it.
2. **Put money on a Brave key, or accept a slower recovery lane.** Website resolution went from 1%
   failing to 42% failing in five passes, and both alarms sit below their thresholds, so nothing
   will raise it again until it is far worse. $5 buys 1,000 searches; a 150-lead pass uses about
   150. Key `_2` is still capped at $5.
3. **Watch the Apify lane actually run.** The fix ships today and the next tick is the test. Expect
   one batch of about 87 channels, then resting until the billing cycle resets on 30 September. If
   two consecutive batches cost more than $0.20 per recovered lead the lane halts itself, which is
   designed behaviour.
4. **Do not read 64 enriched as a collapse from 410.** Same chain, no backlog.
5. **Find whatever fires `npm run send` on session start.** Low urgency while the pause holds,
   high urgency the moment it lifts.

---

## 8. Commits

| Repo | Commit | What |
|---|---|---|
| `youtube-email-outreach-v1` | `autopilot-improve: size the Apify batch to the spendable budget instead of resting on an all-or-nothing 100` | 5b |
| `youtube-outreach-orchestrator-v1` | `autopilot-improve: make a failed debrief agent visible and hand the gap to the next run` | 5a |

**Status caveat.** Everything in `approved_hold` is parked, not sent. Outgoing email is paused
(since 2026-09-10) and discovery is paused (since 2026-09-08). Only Casey lifts either. Both held
correctly all cycle.
