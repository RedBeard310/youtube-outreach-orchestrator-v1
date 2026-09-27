# Lead run analysis, cycle 2026-09-26

Companion to [lead-run-2026-09-27.html](lead-run-2026-09-27.html). Cycle window
2026-09-26T07:00Z to 2026-09-27T07:00Z, which is Saturday 2026-09-26 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-27.json`.

## Headline

**Zero emails loaded into SmartLead, against 107 the day before, and the zero is
the schedule rather than a fault.** Nothing failed. Three leads parked, enrichment
ran three single-lead batches, and Anthropic spend was zero for the fourteenth day.
The one real event is that **both Brave Search keys hit their monthly spending cap**,
which the recovery lane detected and handled correctly, and which the hourly alarm
then described wrongly.

## Why the day was a zero

`siege-plan.timer` is `OnCalendar=Mon..Fri 08:15 America/New_York`. It last ran
Friday 2026-09-25 at 12:15 UTC and produced that day's 97 emails. It did not run
Saturday and will not run Sunday. The timer is 45 minutes ahead of SmartLead's own
sending window, and SmartLead delivers Monday to Thursday only.

Two things make this cost nothing:

- **The volume ramp counts sending days, not dates.** `config/siege.json` sets
  `per_day_ramp` to `[50, 50, 100, 100, 150, 150, 200, 250]` and its note says a
  skipped day resumes where it left off. Friday was day 3 (cap 100, sent 97).
  Monday is day 4 (cap 100).
- **`npm run send` had nothing to lose.** It fired at 00:20 Pacific, selected zero
  leads and logged `attempted=0 sent=0 failed=0`. Its lane (`review_status=approved`)
  has been fully sent since Friday.

Sends per Pacific day, from `outreach_processed_at`:

| Day | 09-23 Wed | 09-24 Thu | 09-25 Fri | 09-26 Sat |
|---|---|---|---|---|
| Loaded | 47 | 55 | 107 | 0 |

Lifetime `sent_to_smartlead`: 2,132.

## Brave ran out of money, and the lane coped

Two of the cycle's three collect passes logged
`All 2 Brave Search API key(s) refused: 402 Usage limit exceeded`. Counted per
pass, the last eight passes logged that line 0, 0, 0, 0, 0, 1, 1 and 0 times, so
this is a change of state rather than background noise.

What the lane did with it:

- `lastCollectPassSearchDead()` read the line and the lane **rewound its cursor
  twice** (`reason: previous_pass_search_dead`, rewinds 1 then 2 of a 48 cap). The
  300 leads in those passes keep their turn instead of being stamped walked and
  waiting a lap of 3,300.
- Site resolution still read **97%**, because most leads are re-walks whose site is
  already stored and the free channel-page route needs no search. So the pass was
  **both** a re-walk of a mined-out book and unable to search. Those need opposite
  answers: wait, and spend.

Brave has been the pipeline's only web search since Tavily was dropped on 09-13, so
the same cap throttles email finding in `youtube-email-outreach-v1`, not just this
lane. The caps are monthly, so the two options are a top-up (or more keys) and
waiting for the plan month to roll over.

## Recovery lane numbers

| Measure | This cycle | Previous | Prior 7 days |
|---|---|---|---|
| Contact points | 27 | 26 | 2,774 |
| Email addresses | 4 | 6 | 360 |
| Leads with new points | 10 | 20 | n/a |
| Collect passes / readings | 3 / 450 | 4 / 600 | n/a |
| Hit rate per pass | 2.0, 4.0, 0.7% | 4.7, 2.7, 2.0, 4.0% | n/a |
| Book remaining | 3,316 | 3,321 | n/a |
| Stranded | 3 | 3 | 3 since 09-13 |
| Parked | +3 | 0 | n/a |

Lap 6, every pass 100% re-walks. The `bloodhound_collect_yield_degraded` alarm fired
twice, on distinct passes, and its long baseline of "normal" fell from 7.3% to 5.0%
as degraded passes age into its 32-pass memory. Predicted on 09-25 and 09-26; still
firing, but with less room each cycle.

## The other lanes

- **Enrichment is finished and behaving like it.** Three batches of one lead each,
  three distinct ids, all exit 0, then idle. Pool of 3 with 2 permanently excluded.
  Shelf: 6,855 of 6,863 parked leads carry a bundle (99.9%); 6,573 ready to write.
- **Apify is resting on its reserve floor**, as it has since 09-06: $10.0053 in the
  account, $10 reserved, $0.0053 spendable, which buys 0 channels against a
  25-channel floor. Twelve correct resting lines, no work.
- **The paid reply loop stopped by itself.** 698 runs in the cycle, 539 of them
  paying `openrouter:deepseek/deepseek-v3.2` to re-classify `tara@rehab-hq.com`,
  then the reply left the queue at 01:31Z and every run since reads "0 replies to
  classify". Lifetime for that one reply: **940 paid classifications**. The shape
  that caused it is untouched.
- **Discovery: zero new channels**, which is Casey's 09-08 instruction. Sweep state
  files are stale on purpose. YouTube pool 15 working of 66, fourteenth identical
  morning.

## Shipped

### `41a23f5`: count Brave refusals from the pass being judged

The 09-22 fix stopped this alarm blaming the search plan for a drained book. It was
right about the symptom and wrong about the mechanism: it assumed the all-keys-refused
line prints on every pass because one key sits at its $5 cap, so it hard-coded
"raising the cap would not have changed it" into the alarm text. The line prints only
when **every** key refuses one lookup.

So when both keys capped out, the 01:11 firing recorded `brave_refusal_logged: true`,
attributed the fall to `book_rewalk` alone, and told Casey his money would buy
nothing, one hour after the lane had rewound its cursor off that same line.

`collectPassAttribution()` now returns `braveRefusals`, counted inside the judged
pass with the same regex `lastCollectPassSearchDead()` uses, so the alarm and the
rewind cannot disagree. The observation gains `pass_brave_refusals`, and
`attributed_to` can read `book_rewalk+search_dead` or `search_dead`. A pass with no
refusal still gets a plain statement that search credit is not the constraint.

Verified: typecheck clean, 96 tests pass (4 new), and run against the live collect
log, where the judged pass reads `braveRefusals 1, noSitePct 2.7, rewalkPct 100`.

### `93c428b`: a missing-debrief gap can no longer age out of its own reminder

`missing_debriefs` was added on 09-20 after an expired login silently skipped the
reports for 09-17, 09-18 and 09-19. It looked back seven days, so by 09-25 those
three had slid out of the window and the field read `[]` for two cycles while six
reports were owed.

It now also lists every date with a grounded metrics file on disk and no report, at
any age, since that is exactly the set a later run can write from real numbers.
Newest first, capped at 14 so a backlog cannot crowd out the current cycle. Today it
reads 09-19, 09-18, 09-17, 08-18, 08-17 and 07-11. Yesterday's report named one of
those six.

Verified: typecheck clean, selftest all-pass with 3 new cases.

## Ranked next

1. **Top up Brave or add keys.** The one active money problem. Also throttles email
   finding. Casey's spend call.
2. **Unblock more Siege offers.** Ten of sixteen are out for a missing subject line,
   writer script, two follow-up bodies, a vocabulary row, or a Paused Notion status.
   The ramp reaches 250 a day within five sending days and the board needs offer
   variety to absorb it.
3. **Give Apify $10 to $20, or retire it.** Three weeks of correct resting lines and
   no work. Last real run recovered 62 leads at about ten cents each.
4. **Cache the auto-reply classification against the reply id.** It self-cleared, the
   cause did not. Outside the five repos this agent may edit.
5. **Expect a zero today too.** Weekend zeroes are the schedule. Read a send count
   next to its day of the week.
6. **Write the six owed debriefs, or decide they are not owed.** All have metrics.
7. **Decide whether the collect pass keeps its slot.** Three days, 1,650 readings,
   8 leads off the book, 3 parked. Not broken, just picked over.

## Not done, deliberately

No email sent by this agent. No discovery lane touched, restarted or repaired. No
`.env` or secret read or written. No alarm threshold moved. No halt flag written. The
send selector still reads `approved` only. Brave and Apify left unfunded because both
are spend calls. The automator's reply loop left as it is. The campaign loop is left
running for the next cycle.
