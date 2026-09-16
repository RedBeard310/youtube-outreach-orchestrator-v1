# Lead Run Analysis — 2026-09-16

**Cycle:** 2026-09-15T07:00Z → 2026-09-16T07:00Z
**Headline:** Casey's $300 of OpenRouter credit landed and enrichment had its best day since the
discovery pause began: **410 leads enriched with zero failures** in one seventeen-hour batch, at
about **ten cents a lead**, which is a third cheaper than the estimate we have been quoting. The
shelf of leads that are researched and ready to write now stands at **6,192**. Two things went
wrong anyway. Yesterday's credit gate held correctly for five free hours and then released a
500-lead batch into a still-empty account because its own probe errored. And the recovery lane's
verify half turned out to be jammed: every verify pass this cycle was handed the same four dead
addresses, one of which it has been re-buying since 24 August. Both are fixed, verified, and
committed as `d7c75bc`.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Leads enriched** | **410** | 267 | One batch, 17 hours, **0 failures**. Still running |
| Enrichment cost per lead | **~$0.10** | n/a | $41.10 account meter ÷ 410. Estimate was $0.16-0.17 |
| Enrichment rate | ~24 / hour | n/a | Flat all night, no degradation |
| **Ready to write (`ready_data_scraped`)** | **6,192** | ~5,780 | Held on Casey's word, nothing is broken |
| Waiting on enrichment | **278** | 642 | 244 at `failed`, 34 at `email_verified` |
| Parked into `approved_hold` | **40** | 789 | 6,569 → 6,609. All of it the recovery lane |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `needs_contact` pool | 4,477 | 4,517 | Falling, the lane is outrunning arrivals |
| Collect passes / lead-slots | 3 / 450 | 4 / 600 | Book at 3,711, stranded 3, lap 5 |
| Verify passes / leads | 6 / 67 | 6 / 88 | **All six handed the same 4 immortal leads** |
| Lane re-score parks | 14 | 60 | 2 + 8 + 4 across three passes |
| Doomed batches | **1** (499 leads) | 9 (1,635 leads) | The 13:07Z batch. Gate released on a probe error |
| `npm run send` | **14 of 14** | 9 of 14 | Landed 07:20Z, exit 0 |
| Fatal signatures / halts / quota stops | 0 | 0 | Nothing crashed |
| Anthropic spend | $0.00 | $0.00 | Of a $150 hard ceiling |
| OpenRouter balance | **$258.71** | −$0.19 | $41.10/day, ~6 days, mostly this backlog |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | **Ninth identical morning** |
| Apify endspec | resting | resting | $16.11 left, needs $7.02 + $10 reserve. Resets 30 Sep |

---

## 2. What the top-up actually bought

The 14:34Z batch took 500 ids and has finished 410 of them with **not one failure**. It settled at
about 24 leads an hour within the first hour and held that rate through the night. Hourly output,
14:00Z through 06:00Z:

```
9  25  27  28  21  28  32  24  28  27  31  18  22  21  21  23  21
```

That is the least interesting chart in any of these debriefs and it is the one we wanted.

**The price is better than the plan.** The OpenRouter account meter read $41.10 for the 24 hours,
and essentially all of that is this batch, because the enrichment backfill is the account's
dominant consumer and nothing else ran. 410 leads for $41.10 is **$0.100 a lead**.

Three numbers in the standing orders should be corrected against this:

- The remaining 278-lead pool costs about **$28**, not $45.
- The whole 603-lead backlog was going to cost about **$60**, not the $97 estimated on 09-15.
- The $300 Casey added covers this backlog roughly five times over.

Note the log's own per-stage dollar markers sum to $56.55 across the batch, but those lines double
count (a bank's cost is printed both per stage and again in the export summary). The account meter
is the number to trust.

---

## 3. The credit gate: right about waiting, wrong about stopping

Yesterday's fix (`78b1284`) added `openrouter_ok()` to `chain.sh`. It worked, and then it did not.

**What worked.** The chain came up at 08:07Z, probed, read a definite `DRY -0.19 1.00`, and waited.
It held for five hours and spent nothing. Before the fix those five hours would have been ten
batches of 500 leads each paying for YouTube and transcripts before dying. The hourly check-in also
recorded `backfill_chain_stalled` three times and correctly declined to escalate, because the
remedy was a spend call no fix-agent can make. Both halves of yesterday's shipment did their job.

**What did not.** At 13:07Z the probe itself errored. The gate's rule is fail-open, on the reasoning
that a probe you could not finish proves nothing, so it logged `openrouter credits are back (OK
probe-error)` and launched. **499 of 500 leads failed.** Credits did not actually land until about
14:34Z. Each of those 499 leads had already paid for its YouTube harvest and its Decodo transcripts
before dying at the OpenRouter call.

**The fix is an asymmetry, not a reversal.** Fail-open is correct for *entering* the wait: with no
evidence, run. It is wrong for *leaving* it, because once you are waiting you hold OpenRouter's own
statement that the balance is under the floor, and an unfinished probe is not evidence against that
statement. So the wait loop now requires a confirmed balance reading. `OK probe-error`,
`OK probe-http-500`, `OK probe-unparseable` and `OK nokey` all keep waiting, which costs nothing
because the leads never leave the pool.

*Verified:* `bash -n` clean, and the new matcher unit-tested across all eight states the probe can
emit.

---

## 4. The verify half was jammed, and had been for weeks

**Every verify pass this cycle was handed the same four leads.** 11:01Z, 15:01Z, 19:00Z, 23:00Z,
03:02Z, 07:00Z: `rec0yOK9g8FePcLL5`, `reccO6pPk1diVwhGr`, `rec8xHAFcSVZNKs1N`, `recKe7AzR8OnURpNr`.
Running `VERIFIABLE_IDS_SQL` by hand against Postgres returned **those four ids and nothing else**,
so the entire verify queue was four permanently stuck rows.

**The cause is the third instance of one bug class.** The two marks that say "somebody already ruled
on this" (`verified_at`, and an `[ownership:` note) are written on a **row**. ZeroBounce rules on an
**address**. A lead routinely holds the same address twice under two kinds, because two collection
methods found it independently: the About-tab button writes `youtube_email`, the website scrape
writes `business_email`. The verifier is handed one row, stamps that one, and the twin stays blank
forever. The lead re-selects every pass and buys another credit.

Concretely, `rec8xHAFcSVZNKs1N` holds `info@shanesmithlaw.com` twice. The `business_email` copy was
ruled on **2026-08-24**. The `youtube_email` copy has never been stamped. Twenty-three days of
re-buying the same verdict. The other three were re-stamped at 07:00:36, 07:00:37 and 07:00:38 this
morning, over stamps written by the previous pass, which is the direct proof that a credit is spent
every pass.

This is the same shape as the 08-24 incident (84 of 91 leads re-selected) and the 09-02 one
(`REDACTED FOR PRIVACY` scraped off a WHOIS record, immortal since 08-18). The comment block above
the selector already documents both. This is the third.

**The fix** asks the question the verifier actually answers: has *this address* been ruled on for
*this lead*, by any row.

```sql
AND NOT EXISTS (
      SELECT 1 FROM leads.contact_points ruled
       WHERE ruled.lead_id = cp.lead_id
         AND lower(ruled.value) = lower(cp.value)
         AND (ruled.verified_at IS NOT NULL
              OR COALESCE(ruled.verified, false) = true
              OR COALESCE(ruled.notes, '') LIKE '%[ownership:%'))
```

*Verified against the live database:* 966 unruled email rows across the whole table, exactly **16
newly excluded**, every one a duplicate of an address already ruled on. The four immortal leads drop
out; nobody else does. A transaction test confirmed the three cases that matter: a fresh unruled
address selects, adding a ruled duplicate under a different kind stops it selecting, and adding a
second genuinely unruled address brings it back. No backfill needed. 51/51 tests pass (one new),
`tsc` clean.

**No new gap.** A lead whose every email address has been ruled on already satisfied neither
selector before this change, which is the intended "ruled on and retired" state (the 09-12 entry
counts 704 such leads). This only makes retirement work per address instead of per row.

---

## 5. The key-pool question answered itself

**Ninth consecutive morning at 15 working / 50 out of quota / 1 blocked of 66.** Every debrief since
09-08 has asked for a probe six hours past the reset to separate "the refill is late" from "the
quota was cut," and nobody has run it.

The last nine days ran a better experiment by accident. On 09-11 through 09-13 nothing of ours spent
a single YouTube unit overnight. This cycle we spent heavily: 410 enrichment leads plus roughly
1,500 doomed lead attempts, every one of which pays for a YouTube harvest first. **The morning
reading did not move by one key.**

Both explanations die on that:

- **Not our spending.** It went from nothing to a lot and the number is identical.
- **Not a late refill.** 50 keys carry ~500,000 units. The probe sits 20 minutes past the reset, in
  which window the chain can run about eight leads. Eight leads cannot drain 50 keys.

**So the quota on those 50 projects was cut, and more keys from those accounts buy nothing.** This
does not bite today, because enrichment runs on 1-unit calls. It bites the moment discovery resumes,
because a keyword search costs 100 units. Worth settling before Casey lifts the pause.
`youtube-lead-finder-v1/scripts/audit-key-projects.sh` names the projects and costs no quota.

---

## 6. The hourly check-in has been diagnosing a dead file

`finder_hard_wall_benign` was written to the observations log **24 times in 24 hours**, every hour,
naming `session-20260908T152322Z.log`. The campaign stopped on 09-08, so that file has not changed
in eight days.

`recentSessionLogs()` takes whatever sorts newest, with no age test at all, and all three of its
callers are asking what is happening *right now*. The noise is the cheap half. The expensive half is
that this particular pattern happens to be carved out as benign before the paid fix-agent is
reached; **any other pattern frozen in the same file would page that agent every hour, forever,
about a campaign that is not running.**

**Fixed:** a session log nobody has written to in `MAX_SESSION_LOG_AGE_HOURS` (48) is ignored. An
actually-running campaign is never excluded, because mtime moves while it writes, and the window
self-heals the moment a new session starts. Verified: the live call now returns `[]` where it
previously returned the frozen 09-08 log.

---

## 7. What the pause is now buying

Worth stating plainly, because it is the decision under everything else.

- **6,192 leads are researched, bundled and one command from a written email.** They sit at
  `review_status = approved_hold`, which is Casey's deliberate parking status. Nothing is broken.
- **The send path fires about 14 a day** because it only draws from the small `approved` lane
  (11 at `ready_data_scraped` plus 3 at `email_drafted` this morning, which is exactly the 14 that
  went out at 07:20Z). 1,809 `approved` leads have already been sent.
- **Enrichment has 278 leads left**, about half a day and $28. After that the lane the pause exists
  to feed has an empty queue.

So the month of enrichment work is finished, or nearly. The output is a shelf of 6,192, and what
happens to it is a decision rather than a task.

---

## 8. Shipped this cycle

All in `youtube-outreach-orchestrator-v1`, commit **`d7c75bc`**.

| Change | File | Verification |
|---|---|---|
| Address-level retirement in the verify selector | `src/recovery/bloodhound-lane.ts` | Live query: 966 unruled rows, 16 newly excluded; 3-case transaction test; 51/51 tests, 1 new |
| Credit gate holds on an unreadable probe | `scripts/backfill/chain.sh` | `bash -n` clean; matcher tested across all 8 probe states |
| Check-in ignores session logs older than 48h | `scripts/autopilot/checkin.ts` | `tsc` clean; live call returns `[]` for the frozen 09-08 log |

The chain self-reloads `chain.sh` at the next batch boundary, so the gate fix deploys itself without
killing the batch in flight.

---

## 9. Recommended next, ranked

1. **Decide what happens to the 6,192 ready leads.** Largest thing in the pipeline, waiting on a
   decision rather than on work. `hold-batch.ts --release` moves a slice into the send queue.
2. **Let the backfill finish (278 leads, ~$28, ~half a day), then decide whether the chain stays
   on.** After it drains, the lane the pause redirects everything into has nothing to eat.
3. **Settle the key pool before lifting the pause.** Nine identical mornings across a hundredfold
   swing in our own spending. Run `audit-key-projects.sh` and stop counting those 50 keys as
   capacity.
4. **Watch the verify queue refill.** With the four zombies retired it should show real leads within
   a pass or two. If it stays empty, the collect half is genuinely out of email candidates and
   Brave's cap is the binding constraint rather than a contributing one.
5. **An alarm on an immortal selector.** Three times a selector has re-handed the same ids forever,
   and a person reading a log found it each time. The metric is distinct ids ÷ lead-slots spent, per
   lane, per day. Deliberately not built today so it can be calibrated against a lane that has just
   been unjammed.

---

## 10. Standing constraints, unchanged

- **Discovery stays paused** on Casey's 09-08 order. No sweep, timer, unit or flag was touched.
  Zero new channels is the intended state.
- **Brave key _2 is still at its $5 cap.** Nine of the recovery lane's ten collection methods want a
  website first.
- **Apify rests until 30 September** at $16.11 against a $10 reserve and a $7.02 batch.
- **Sending stays manual.** 14 went out at 07:20Z, just past the cycle boundary.
- **Anthropic spend was $0.00.** Nothing in the pipeline touched the API key.
