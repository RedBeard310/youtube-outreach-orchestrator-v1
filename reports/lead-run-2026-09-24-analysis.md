# Lead Run Analysis, 2026-09-24

**Cycle:** 2026-09-23T07:00Z → 2026-09-24T07:00Z
**Headline:** Casey lifted the email pause on 09-23 and **47 emails were loaded into SmartLead**
that afternoon, the first since 09-10. In the same cycle a hand-started enrichment run put **119
more finished leads on the shelf**, which now holds **6,675** researched, bundled, ready-to-write
leads. Then the automatic 07:20 send this morning composed 18 emails, pushed 8, and wrote the other
10 down as `failed`. Nine of those ten died on a two-minute network wobble talking to SmartLead. All
ten were finished emails with a verified address, and **no query in this pipeline would ever have
looked at them again**. The send queue read zero, which is exactly what it reads when the work is
genuinely done. Fixed today, and the ten are back in the queue.

---

## 1. The numbers

| Metric | This cycle | Prior cycle | Note |
|---|---|---|---|
| **Emails loaded into SmartLead** | **47** | 0 | First since 09-10. Twelve zero days before it |
| **Parked into `approved_hold`** | **+5** | +0 | 6,853 → 6,858. All 5 from the recovery lane |
| **Ready to write (`ready_data_scraped`)** | **6,675** | 6,586 | +119 enriched, 31 shipped out |
| `needs_contact` pool | **4,238** | 4,243 | Falls only by what the lane recovers |
| Leads enriched / batches | **124** / 3+1 | 0 / 0 | **119 from an unscheduled run**, 5 from the chain |
| Contact points collected | **73** | 29 | 1,063 on 09-20. Still a mined-out book |
| Collect passes / lead slots | 4 / 600 | 4 / 600 | 10:01, 17:01, 23:01, 05:02Z. All on time |
| Collect hit rate, by pass | **7, 9, 5, 3%** | 0, 3, 4, 4% | 32-pass median is 42% |
| Collect book remaining | **3,331** | 3,344 | 600 readings bought **13 leads** |
| Website resolution per pass | 97, 99, 96, 97% | 79, 98, 99, 98% | Search was UP. Not the constraint |
| Stranded (gap indicator) | 3 | 3 | Unchanged since 09-13. No gap reopened |
| Verify passes / addresses tested | 6 / **6** | 8 / 6 | 5 more rejected on ownership before spending |
| New channels discovered | 0 | 0 | Intended, paused by Casey 09-08 |
| `npm run send` (07:20, after the cycle line) | **18 attempted, 8 sent, 10 failed** | 18 / 0 | 9 lost to network, 1 to the placeholder guard |
| Fatal signatures / halts / quota stops | 0 / 0 / 0 | 0 / 0 / 0 | Nothing faulted |
| Anthropic spend | **$0.00** | $0.00 | Of a $150 hard ceiling |
| OpenRouter | **$10.18/day, $199.98 left** | $1.10/day, $210.16 | Runway 191 days → **20** |
| YouTube key pool at the reset | 15 / 66 | 15 / 66 | Eleventh identical morning. Settled |
| Apify lane | resting | resting | $0.0053 spendable. Cycle rolls 30 Sep |
| Alarm: `collect_yield_degraded` | 4 | 4 | **All 4 said `book_rewalk`.** None blamed Brave |
| Alarm: `collect_walking_in_place` | **0** | 13 | Yesterday's fix holding |

**Verified, not assumed.** Every pool size (6,858 / 4,238 / 6,675) and every send count was queried
directly against Postgres, not read off a log. The 10 stranded leads were inspected row by row:
all ten carry a written subject and body, a bundle path, a verified address and no SmartLead lead
id, and none is do-not-contact. Collect and verify pass counts, hit rates, book depth and resolution
rates come from `logs/bloodhound-collect.log`, the recovery lane's journal and the alarm
observations. The enrichment split comes from `chain.log` plus the live process table.

**Inferred, and labelled as such.** The OpenRouter spend is an account-level meter with no per-task
breakdown. $10.18 across a cycle whose only model work was 119 enrichments and 65 email composes
divides to about 9 cents a lead, which matches the 10 cents a lead measured on 09-16, so enrichment
explains it. That leaves no measured cost for composing an email. Do not quote one.

---

## 2. The output door opened

The pause that had held since 09-10 came off on 09-23. The lift is conditional and the condition is
enforced in code rather than trusted: `warmup_wait.min_day` in `automator/config/siege.json` holds a
floor at warmup day 12, measured per mailbox from `state/inbox-warmup.json`. A mailbox younger than
day 12, one whose warmup subscription is not active, and one missing from the snapshot are each
refused. The 18 mailboxes bought on 09-19 reach day 12 on 30 September and may first send on
1 October. The fleet that caused the 7% spam placement was retired; the rebuilt fleet is 58
mailboxes on 20 fresh domains.

**The 47 did not come through `npm run send`.** Nothing in `logs/orchestrator-2026-09-23.jsonl`
records them, so they were driven from the email repo directly, in two goes at 16:00 and 17:00 UTC.
They were picked across both lanes: 31 from `approved_hold` and 16 from `approved`. That is the
documented shape of a hand-run (the email repo fetches by id with no filter), and the per-lead
do-not-contact guard still applied to every one of them.

---

## 3. A finished email fell through a gap, and the queue still read zero

The 07:20 send this morning sits just past the cycle boundary but belongs to this debrief, because
it is the first thing the lifted pause let through automatically.

Eighteen leads went through writing and pushing. Four pushes completed in under 2.5 seconds each.
The rest returned `fetch failed` after 10 to 15 seconds, which is what a connection timeout looks
like from the inside. `retryOnTransient` in the email repo retries once after 60 seconds, and four
more got through on that second attempt. Nine did not, because both attempts fell inside the same
two-minute window. A tenth was correctly refused by the placeholder guard, which found
`[Agent Name]` still in the body.

All ten were then written as `failed`. That label is accurate and it was also a trapdoor:

- `APPROVED_FIRE_READY` in `src/airtable.ts` selects `ready_data_scraped`, `enriched` and
  `email_drafted`. `failed` is in none of them, so `npm run send` would never see them again.
- `APPROVED_PREP_DONE` does not contain `failed` either, so the tick *would* re-drive them. Ticks
  have been manual-only since 2026-06-01 and nobody runs one.
- Nothing alarms on it. The hourly check-in has no observation for a send at all.

After the failure the approved lane in Postgres read **0 ready, 0 drafted, 10 failed**. A send queue
of zero is also exactly what it reads when the lane has genuinely finished. Same number, opposite
meanings.

---

## 4. Enrichment restarted, from a process nobody scheduled

The VPS backfill chain ran three batches totalling five leads and logged `no pending inflow, idling`
after each. That is correct: its pool is 40 of which 39 are permanently excluded.

Beside it, a process started at **21:28 UTC on 09-23** has been working a 132-lead list at roughly
eleven leads an hour:

```
npm exec tsx src/cli/outreach.ts \
  --lead-ids-file /tmp/claude-1000/-home-casey-repos-automator/<session>/scratchpad/backfill-ids.txt \
  --stop-after enrich --concurrency 4
```

Of those 132: **115 reached `ready_data_scraped`**, 11 failed, 6 came back email-invalid. It is
doing exactly the work the discovery pause exists to fund, and it is where the $10.18 of OpenRouter
went.

**Worth knowing, not worth stopping.** No systemd unit owns it. Its id list lives in a temporary
folder belonging to an interactive chat session. If the process dies, nothing restarts it, and the
chain's own log will go on saying "idling" while it does. It was deliberately left running.

---

## 5. The recovery lane, unchanged

Four collect passes, 600 lead slots, 73 contact points, hit rates of 7, 9, 5 and 3% against a
32-pass median of 42%. The book fell from 3,344 to 3,331, so 600 readings bought 13 leads.

The cause is the one established on 09-22 and confirmed three days running: the lane is on **lap 6**
and re-reading leads it already emptied. All four `bloodhound_collect_yield_degraded` firings
attributed to `book_rewalk`, recorded the readings behind that choice, and recommended no spend.
Website resolution ran 96% to 99%, so the alarm correctly refused to blame Brave. `collectRewalk`
read 100% re-read on three of the four passes.

The verify half: six passes, six addresses actually checked, five more rejected on ownership before
a ZeroBounce credit was spent, four flips into `approved_hold`, plus one park from the hourly
re-score. That is the whole **+5**. Two of the six passes were handed nothing at all, which is a
symptom of the collect half and not a verify problem.

---

## 6. What shipped

### 6a. Yesterday's fix proved itself (no action needed)

`collect_walking_in_place` fired **13 times about one window** on 09-23 and **zero times** this
cycle. The per-pass keying and the `collectRewalkCause()` reading both held.

### 6b. Shipped today: orchestrator `ce5abf1`

*"stop a network blip on the SmartLead push from stranding a finished email forever, and make a bad
send say so"*

**Half one, the trapdoor.** `getApprovedFireLeads()` and `isApprovedFireReady()` now share one
predicate, `fireResumeStage()`, which widens the query to `failed` and then decides per lead on the
evidence in that lead's own fields:

| Lead state | Resumes at | Why |
|---|---|---|
| `ready_data_scraped` / `enriched` | compose | unchanged |
| `email_drafted` | push | unchanged |
| `failed` + written subject and body | **push** | the writing is already paid for, same as `email_drafted` |
| `failed` + bundle, no draft | **compose** | enrichment is already paid for, same as `ready_data_scraped` |
| `failed` + neither | **refused** | never reached the end of prep. Belongs to the tick, not to send |

That last row matters. Pulling in a bare `failed` lead would quietly turn a send into a
find-verify-enrich run, which is the coupling removed on purpose on 2026-07-17.

This is the same reading `effectiveStatus()` in `youtube-email-outreach-v1/src/cli/outreach.ts`
already makes when it decides where to restart a lead. The two repos disagreed: one knew how to
resume a failed lead and the other would never hand it one. A comment in each now points at the
other.

**Half two, the silence.** The email repo prints a `=== Final tally ===` block and then exits 0,
because one lead failing is deliberately not fatal to the batch. So this morning's orchestrator log
line read `send_attempted=18 send_exit=0` and nothing else, identical to a clean run. The send
driver now captures the child (still teeing it to the terminal), parses the tally, records
`send_sent` / `send_failed` / `send_outcomes` in the JSONL, prints them on the closing line, and
warns loudly when failures outnumber sends.

**Verified:** typecheck clean, **87/87 tests pass** (11 new, covering the exact ten-lead shape, the
refusal of a bare `failed` lead, an empty-string draft, do-not-contact overriding everything, and
the tally parser against the real 09-24 output). Then verified live against Postgres: before the
change `npm run send:dry` returned **0** leads; after it, it returns **exactly the ten stranded
ids** and nothing else. The fix is retroactive by nature. It rescues leads already in the trapdoor,
not just future ones.

**Not done, and why.** Raising the push retry from one attempt to two or three was considered and
rejected. It would probably have rescued several of the nine, but a `fetch failed` can also be a
response lost after SmartLead accepted the lead, and a second retry raises the chance of loading the
same person twice into a campaign. SmartLead's de-duplication behaviour is not verified here, and
with the selector fixed a failed lead simply goes out on the next send at no risk. Ranked as a lever
below, not shipped.

---

## 7. Recommended next, ranked

1. **Send again, and watch the failure count.** The door is open, the shelf is 6,675 deep, and the
   ten stranded leads are back in the queue. The new log line reports sent against failed, so a
   repeat of nine-out-of-eighteen is visible immediately. Sending stays manual and stays Casey's
   call.
2. **Measure what an email costs before a big push.** Enrichment is a known 10 cents a lead.
   Composing is not measured at all, and the shelf is 6,675 emails. One send with the per-task cost
   log turned on answers it, and doing it before a large batch is cheaper than after.
3. **Decide whether the unscheduled enrichment run should become a real unit.** It did 119 of the
   cycle's 124 leads, from a list in `/tmp` owned by a chat session, with nothing to restart it. The
   VPS chain sits idle beside it because its own queue is one lead. Either feed the chain that list
   or give the run a unit.
4. **Decide on the discovery pause.** Unchanged from yesterday. 600 readings a day are buying 13
   leads and that will not improve on its own. New leads arrive three ways: lifting the pause, Apify
   on 30 September, funding Brave. **Casey's word alone.**
5. **Watch Apify on 30 September.** Six days out. Last run recovered 62 leads in 52 minutes at
   $0.099 each. Resting on its $10 reserve correctly.
6. **Keep an eye on the OpenRouter balance.** $199.98 and about three weeks at the current rate. Not
   urgent, but it stopped being a background number this cycle.
7. **More push retries, with a duplicate check first.** Only worth doing if SmartLead's behaviour on
   a re-POST of the same address is confirmed to be a no-op. See "not done" above.
8. **The 09-17, 09-18 and 09-19 debriefs are still unwritten.** Writing them needs a human re-login
   on the VPS, and no Anthropic API key may be used instead.

---

## 8. The thing worth remembering

The pipeline spent thirteen days where zero output was the correct answer, and everyone learned to
read zero as normal. On the first day that stopped being true, ten finished emails fell through a
gap and the queue still read zero. The label `failed` was accurate; the trapdoor was that no query
included it. **A status that describes what happened is not the same as a status something acts on,
and the gap between those two is where work goes to die quietly.**

**Deliberately not done:** no email sent by this agent, no discovery lane touched, no `.env` or
secret read or written, no alarm threshold moved, no halt flag written, and the unscheduled
enrichment run was left alone rather than killed or adopted. The loop is left running for the next
cycle.
