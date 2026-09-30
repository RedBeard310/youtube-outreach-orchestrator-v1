# Lead run analysis, cycle 2026-09-29

Companion to [lead-run-2026-09-30.html](lead-run-2026-09-30.html). Cycle window
2026-09-29T07:00Z to 2026-09-30T07:00Z, which is Tuesday 2026-09-29 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-30.json`.

## Headline

**Mailbox capacity stopped being the constraint, and the day was spent anyway.**
For three debriefs the binding limit on send volume was warm mailboxes. Monday
allowed 100 emails on the ramp and the mailboxes would take 33. Tuesday the
mailboxes would take 296, the ramp allowed 150, Siege planned 150, and **0 were
pushed**. The pipeline sent 4 emails, all four from this repo's own send at
00:20 Pacific.

The recovery lane had a small but complete day: 11 contact points, 2 email
addresses, both verified, both flipped into `approved_hold`. The pool moved
6,865 to 6,867, its first movement in three days.

## Why nothing was sent

Siege's timer plans and samples, then stops. The last line of its 09-29 run,
at 12:19:40Z:

```
20 written, 0 with something to look at; sample at .../2026-09-29/samples.json
SAMPLE RUN: nothing pushed, nothing sent. Waiting on Casey's approval.
```

This is standing behaviour, not a regression. `SAMPLE RUN` appears on 09-23,
09-24, 09-25, 09-28 and 09-29. On the days that sent, a push happened separately
afterwards: Monday's 32 emails went out from 18:32Z onward, six hours after the
plan was written. Tuesday's push never happened, and `logs/siege.log` has not
been written since 12:19Z.

So the send path is gated on a manual approval with no schedule and nothing
watching it. That is fine when somebody is around and total when nobody is.

### What Tuesday had ready

Read off `automator/state/siege/2026-09-29/plan.json`:

| | Tue 09-29 | Mon 09-28 |
|---|---|---|
| Sending day | 5 | 4 |
| Ramp ceiling (`day_cap`) | 150 | 100 |
| Mailbox slots | **296** | 33 |
| Live inboxes | 37 | 36 |
| Assignments written | 150 | 100 |
| Pushed by Siege | **0** | 32 |

Eligible leads on Tuesday, by tier: whale 1,200, strong-7 1,099, other-7 834,
so **3,133** leads held a verified address and could have been emailed.

### The 33 to 296 jump is follow-up load, not new inboxes

Only one inbox went live. The per-inbox lines explain it:

```
Mon  altonberge@tubegrowthagency.com   LIVE mpd=15 followups=4 free=1 new=1
Mon  anthonyokon@videoleadsagency.com  LIVE mpd=15 followups=5 free=0 new=0
Tue  altonberge@tubegrowthagency.com   LIVE mpd=15 followups=0 free=8 new=4
Tue  anthonyokon@videoleadsagency.com  LIVE mpd=15 followups=0 free=8 new=4
```

Monday's inboxes were carrying 4 to 8 follow-ups due, which consumed the daily
allowance before a new conversation could start. Tuesday's had none. 37 live
inboxes at 8 free slots each is the 296.

The practical point: capacity swings hard day to day for reasons nobody touched,
so an open day is not a standing condition. Tuesday was the most open day of the
ramp so far.

### Nine of sixteen offers still can't run

`offer_problems` in the plan holds 9 entries, `offers_starting` holds 6. The
reasons are individually small: a missing subject line in Notion, a Paused
working status, no `run-batch.mjs` or `build-batch.mjs` in the skill folder, zero
follow-up bodies against a 2-step campaign, an `email_type` absent from
`leads.vocab_outreach_email_type`. Two stand out:

- `time-offer` is gated on a breakdown video that has not been recorded.
- `super-fan`'s writer imports `/Users/caseybrown/Claude/cold-email-guard/...`,
  a Mac path that does not exist on this machine.

This does not cap volume while slots (296) exceed the ramp (150). It caps
variety, which is what lets a 6,553-lead shelf be worked without repeating
anyone.

## The recovery lane

Three collect passes, 450 lead slots. Every pass printed:

```
All 2 Brave Search API key(s) refused: 402 Usage limit exceeded
```

| Pass (UTC) | No website | Leads with a contact | Contact points | Cursor action |
|---|---|---|---|---|
| 13:00 | 134/150 (89%) | 3 | 6 | advanced, waiver `rewalk_produced_nothing` |
| 19:01 | 135/150 (90%) | 1 | 5 | rewound, `previous_pass_search_dead` (1) |
| 01:01 | 136/150 (91%) | 0 | 0 | rewound again (2) |

Sums check against the metrics file exactly: 6+5+0 = **11** contact points,
3+1+0 = **4** leads with new points. This is the day decomposed, not estimated.

Verify ran six times. Twice it had an address, and both times it flipped the lead:

```
14:00:29  Verify: 1 addresses checked, 1 leads with a valid email, 1 flipped needs_contact → approved_hold
22:01:39  Verify: 1 addresses checked, 1 leads with a valid email, 1 flipped needs_contact → approved_hold
```

The other four runs logged `skipped: no_pending_email_points`. Those two flips are
the entire `parked_today: 2`.

### Where today sits

Contact points by Pacific day, off `leads.contact_points.created_at`:

| 09-22 | 09-23 | 09-24 | 09-25 | 09-26 | 09-27 | 09-28 | 09-29 |
|---|---|---|---|---|---|---|---|
| 29 | 73 | 35 | 26 | 27 | 40 | 11 | **11** |

`contact_points_prev_7d` is 241, which is 29+73+35+26+27+40+11 exactly. Two flat
days at 11, both inside the tier that needs a paid search, both with the search
plan dead. `collect_book_stranded` is 3, unchanged for 17 days, so this is not a
selector gap. Book is 3,318, lap 6.

## Fixes shipped

### 1. A zero-send day named no cause (`f278b7d`, orchestrator)

`sent_today.total: 4` was indistinguishable from four different days: nothing
ready, a weekend, a crashed send, or a written batch waiting on a human. Those
need different responses.

`debrief-data.ts` now emits a `send_plan` block read from Siege's own plan:
`planned`, `day_cap`, `mailbox_slots`, `live_inboxes`, `offers_blocked`,
`sent_by_this_repo`, `sent_elsewhere`, `unpushed_planned`, `approval_pending`,
and a `binding_constraint` naming what capped the day. Tuesday's:

```json
"planned": 150, "day_cap": 150, "mailbox_slots": 296, "live_inboxes": 37,
"offers_blocked": 9, "sent_in_cycle": 4, "sent_by_this_repo": 4,
"sent_elsewhere": 0, "unpushed_planned": 150, "approval_pending": true,
"binding_constraint": "awaiting_approval"
```

Filesystem only, no database call, no import from `automator`. A missing plan
gives `plan_found: false`, which is deliberately distinct from a plan that ran
and pushed nothing. A renamed key costs one null. `approval_pending` is never
inferred when a count is missing, the same rule `summarizeSendLines` keeps.

**Verified.** `tsc` clean. Selftest ALL PASS with 14 new cases: the real 09-28
and 09-29 shapes, a deliberate `email_paused`, a renamed key, garbage input, no
plan, and the two ceiling cases. One test caught a wrong expectation of mine
rather than a code bug, which is the test earning its place.

### 2. The enrichment chain's self-update killed the chain (`1718e78`, orchestrator)

`chain.sh` re-execs itself when its own mtime changes, so a committed fix deploys
without a `systemctl restart` that would kill an in-flight batch. It did that
with `exec "$0" "$@"`.

That was copied from `campaign-loop.sh`, which git tracks `100755`. `chain.sh` is
tracked `100644`, and its unit runs it as
`ExecStart=/usr/bin/env bash .../chain.sh`. So the re-exec asked the kernel to
execute a file with no execute bit:

```
[2026-09-29T17:41:47Z] chain.sh updated on disk (mtime 1789543600 → 1790702215) — re-exec'ing to load it
chain.sh: line 201: /home/casey/.../chain.sh: Permission denied
[2026-09-29T17:42:47Z] chain started (pid 2364503, batch size 500)
```

A failed `exec` takes the shell with it, so the mechanism built to avoid killing
the process was the thing killing it. `Restart=always` brought it back 60s later
and the chain was idle, so nothing was lost. It could never have worked, so every
self-deploy since 2026-09-02 has been a crash-and-restart.

Both loops now `exec bash "$0" "$@"`, which ignores the mode bit, and both log
and continue on the already-loaded copy if `exec` still fails.

**Verified.** `bash -n` clean on both. Reproduced on a throwaway mode-644 script:
the old form printed the identical `Permission denied` **and never reached the
line after the exec**, which proves the shell dies; the new form re-executed the
same file successfully.

Also added: `chain.sh` now logs a note if a `halt.flag` sits next to it. The real
flag is `logs/backfill-2026-07/halt.flag`. A tracked `scripts/backfill/halt.flag`
from the 2026-08-12 migration freeze is still on disk, is read by nothing, and
cost me a real diagnostic detour reading it as a halted pipeline. It is warned
about rather than honoured, because honouring it would stop enrichment on deploy.

### 3. Running the gatherer twice destroyed its own spend number (`2b2247c`, orchestrator)

The OpenRouter account figure is a diff between two samples of the provider's
cumulative meter. It appended a sample every run and diffed against the newest,
so a second run diffed against a sample minutes old. That happened during this
session: **$4.61/day over 24.00h became $15.00/day over 0.02h**, and runway fell
from 40 days to 12. The published metrics file had to be repaired by hand.

It now diffs against the newest sample at least `MIN_USAGE_SAMPLE_GAP_H` (6)
hours old, and only writes a sample once that gap has passed.

**Verified.** `tsc` clean. Two back-to-back runs report the same `$4.68` over
24.25h with the sample file unchanged at 34 lines.

## Money

| Item | Value | Note |
|---|---|---|
| Anthropic | `$0.00` | 17th consecutive zero |
| OpenRouter, account | `$4.61/day`, `$184.81` left | ~40 days. **Was `$1.97/day`, ~96 days** |
| OpenRouter, finder log | `$0.0000`, 0 calls | Accounts for none of the above |
| Brave Search | both keys 402 | Monthly spending cap, not a fault |
| Apify | resting, `$0.0053` spendable | Did **not** roll on 30 September |
| YouTube keys | 15 of 66 working | Settled, quota cut on 50 projects |

**The OpenRouter jump is unexplained and worth an answer.** Spend more than
doubled on a cycle where enrichment ran two single-lead batches and Siege wrote
20 sample emails at roughly a fifth of a cent each. The finder's log shows zero
calls. `/api/v1/activity` returns `403 Only management keys can fetch activity
for an account`, so it cannot be attributed from this key. Either add a
management key or make whatever is spending write a log.

**Apify.** Yesterday's lever said to watch 30 September. It has rested every two
hours since on `$10.0053 left, $10 reserved, $0.0053 spendable buys 0 channels`,
so its billing month does not turn on the calendar month. One tick logged
`could not read the Apify monthly ledger — skipping this tick rather than
guessing`, which is the guard working.

**Brave, priced again.** Roughly 574 leads in the paid-search tier, about one
search each, `$5` per 1,000, so **under `$3`** for one full pass.

## Ranked next

1. **Approve Siege's batch, or let trusted offers push unattended.** The biggest
   lever in the pipeline now. 150 written, 296 slots, 3,133 eligible, 4 sent.
2. **Raise the Brave cap** (~`$3`). Third debrief with the same price on it.
3. **Explain the OpenRouter jump.** Runway halved twice over on an idle day.
4. **Decide the discovery pause.** Seventh debrief carrying it. The constraint has
   moved: the pipeline is now short of permission to send, not of leads or slots.
5. **Unblock a few Siege offers.** Nine of sixteen down, reasons small and named.
6. **Find Apify's real reset date,** or lower its `$10` reserve.

Dropped from yesterday's list: **grow the warm mailbox count**, which was #3 and
resolved itself overnight, 33 slots to 296. Worth noting that it resolved through
follow-up load falling rather than through inboxes finishing warmup, so it can
swing back.

Still open from yesterday: **what fires `npm run send` on session start.** Third
cycle in a row it has loaded real emails. On Tuesday it was the only thing that
sent anything, which is an argument for understanding it rather than removing it.

## Still owed

Six debriefs have grounded metrics and no report: 09-19, 09-18, 09-17, 08-18,
08-17, 07-11. Not a fault, a decision about whether the history is worth the
tokens.
