# Lead Run Analysis — 2026-09-10

Cycle: 2026-09-09T07:00:00Z → 2026-09-10T07:00:00Z
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-10.json`
Debrief: [lead-run-2026-09-10.html](lead-run-2026-09-10.html)

## Headline

**The send repair from 09-09 held completely: 11 leads out, 11 into SmartLead.** But parking
fell to **+44**, the lowest since 08-31, and the cause is a single $5/month search plan
running out of money. With discovery paused, the Bloodhound recovery lane is the entire top
of the funnel, and nine of its ten collection methods need a website that only Brave Search
can find.

Enrichment, the thing all resources were redirected into on 09-08, idled about **20 of 24
hours** for lack of leads to enrich.

## The funnel

| Stage | This cycle | Prior cycle | Note |
|---|---|---|---|
| New channels discovered | 0 | 0 | Paused by Casey 09-08. Intended. |
| Recovery collect passes | 3 × 150 | 2 × 150 | Same dispatch, collapsed yield |
| Collect hit rate (leads yielding a contact point) | 27% → 48% | 84% → 88% | The story of the day |
| Recovery verify passes | 6, 129 leads | 6, 149 leads | Verify is not the constraint |
| Parked → `approved_hold` | **+44** | +133 | Pool 5,702 → 5,746 |
| `needs_contact` pool | 3,745 | 3,789 | Was 4,951 on 09-02 |
| Leads enriched | 65, 0 failed | ~85, 0 failed | Chain idle ~20/24h |
| Sent to SmartLead | **11 of 11** | 0 of 11 | 6 campaigns, 150.2s |
| Anthropic spend | $0.00 | $0.00 | Ceiling $150 |
| OpenRouter | $8.07/day, 8 days runway | $15.35/day, 4.7 days | Pause is buying runway |
| Fatal signatures | 0 | 0 | No halt, no quota stop |

Parked-per-cycle, 14 days: 65, 78, 54, 5, 63, 177, **627**, 71, 71, 151, **488**, 142, 133,
**44**.

## The shape of the day

Three of the low days in that series share one cause. 08-31 (5 parked) and 09-04 (71 parked)
were both Brave outages. Today is the third. What changed is the absence of a cushion: before
09-08 a bad recovery day was partly covered by the discovery sweeps, and those are off.

## Q1. Did the 09-09 send repair hold?

**Yes.** The 07:20Z run pushed all 11 leads in 150.2 seconds across six SmartLead campaigns
(tax/finance, real estate under both the `5-ideas-email` and `nick_saraev` variants, health,
coaching, relocation). Final tally `sent_to_smartlead: 11`. Every host name resolved at
`finder/high` confidence.

Both of yesterday's guards behaved:

- Campaign IDs preflighted **before** compose, so nothing wrote an email it could not deliver.
- The inbox health gate skipped itself at 18.3h since last run (under the 24h rule) rather
  than blocking the send.

The 09-09 root cause is closed: `shared-env.ts` read only the shared key bank and never the
repo's `fragments/<repo>.env`, so the email repo could not see 16 `SMARTLEAD_CAMPAIGN_*` ids.
Fixed at the loader, so the class is shut rather than one variable.

## Q2. Why did parking fall 133 → 44?

**Brave Search is capped and website resolution is failing.** Both `BRAVE_SEARCH_API_KEY`
slots answer `402 Usage limit exceeded` against a **$5 monthly spending cap**. 24 refusal
lines in the current collect log.

Per-pass share of leads resolving no website at all, oldest to newest:

```
 9.3%   10.7%   18.0%   16.7%   24.7%   20.7%   33.3%   28.0%   59.7%   55.9%
```

Output over the same passes: **885 contact points off 148/150 leads → 186 off 40/150 → 268
off 53/111.** An 87% fall in the only lane still producing.

### The 09-09 rewind fix hit its own cap and reopened the hole

Yesterday's fix rewinds the collect bookmark when the previous pass ran with a dead search
plan, so leads nobody could search are not recorded as walked. It works, but it shared the
3-deep rewind budget with the *truncated pass* case. From the campaign log:

```
09-09 12:01Z  rewound=true   reason=previous_pass_search_dead   rewinds=1
09-09 18:01Z  rewound=true   reason=previous_pass_search_dead   rewinds=2
09-10 01:00Z  rewound=true   reason=previous_pass_truncated     rewinds=3
09-10 07:02Z  rewound=false  reason=rewind_cap_reached          blocked_by=previous_pass_search_dead
              → then walked 111 leads, lap_complete=true, laps=2
```

Brave's cap is **monthly**, so a re-run cannot fix search-dead. The lane therefore did the
worst possible thing: three wasted re-walks of a batch it could not search, then a blind
advance over 150 leads, then repeat. A full lap closed with its tail walked at a 27% hit rate.

**The leads are not barren.** A pass that resolves no website has proved only that nobody
looked. This is the exact shape that turned the 09-02 batch widening into 71 parks instead
of 627.

### The alarm slept through all of it

`checkin.ts` section 7c warns when the no-website share exceeds `AUTOPILOT_NO_SITE_ALARM_PCT`
(70). Every reading above, including the two worst at 60% and 56%, sat under that floor. The
threshold is calibrated to a total outage and is structurally blind to a slide.

## Q3. The key pool: narrowed, not settled

Morning probe: **15 working / 50 quota-exhausted / 1 blocked of 66.** Identical to 09-08 and
09-09.

What is new is that this is the **second consecutive cycle in which nothing of ours spent a
single YouTube unit overnight** (discovery off since 09-08 23:16Z; the sweeps, the campaign
and the keyword lane are all stopped). Our own early-morning spending is ruled out twice.

Two explanations remain and this reading cannot choose between them:

1. Those Google Cloud projects had their quota reduced.
2. Their refill lands well after 07:00Z.

Both readings were taken ~20 minutes past the reset, so per the 09-08 rule they are **one
measurement repeated**, not two independent ones.

**The discriminating test, which nobody has run:** probe the pool again 6+ hours after the
reset on a quiet day. Still 50 exhausted → quota was cut, and more keys from those accounts
buy nothing. Reads ~60 working → the refill is just slow and the morning number was never
meaningful. Cost: 1 unit per key, 66 total.

Not urgent while discovery is off (the running lanes use 1-unit calls and free page reads).
It needs an answer **before** discovery resumes.

## Enrichment has capacity and no input

The backfill chain is healthy and is **not** the constraint:

```
09-09T08:15Z  batch finished: exit=0 done=21 failed=0
09-09T16:14Z  batch finished: exit=0 done=20 failed=0
09-09T19:43Z  batch finished: exit=0 done=11 failed=0
09-10T04:04Z  batch finished: exit=0 done=13 failed=0
```

65 leads, zero failures, and `no pending inflow — idling` for roughly 20 of the 24 hours.
The 09-08 redirect of all resources into enrichment is currently buying idle time, because
what feeds enrichment is gated behind a $5 search plan.

Also standing: `excluded=67` in every batch line. Those leads burned `MAX_ATTEMPTS=3`. Some
fraction are probably casualties of the 09-01 config outage rather than genuinely broken
leads. Low value now, worth a sweep before the pool grows.

## Apify is resting until 30 September

`apify-endspec.timer` still fires every 2h (lock file stamped 09-10 06:20), checks the
monthly ledger, finds it short of the $100 cap plus the $10 reserve, and **exits 0 quietly
by design** so it does not train anyone to ignore a failing unit. It contributed zero this
cycle and will contribute zero for ~20 days unless the cap moves.

## Fixes shipped

### `youtube-outreach-orchestrator-v1` (commit `f92e022`)

**1. Split the Bloodhound rewind budget by reason** (`src/recovery/bloodhound-lane.ts`).

- `MAX_CONSECUTIVE_REWINDS` stays 3 for a **truncated** pass. A re-run might succeed, and a
  child that dies every time must not pin the walk.
- New `MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS = 48` for a **search-dead** pass, about twelve
  days at the 6h collect interval, so it outlasts a monthly spending cap.
- Separate counters (`collectRewinds`, `collectSearchDeadRewinds`), each resetting the other,
  so alternating failures cannot add up to a cap neither reached alone.

The reasoning, recorded in the file: while resolution is down, holding the bookmark costs
nothing, because every lead ahead of the cursor is exactly as unsearchable as the one under
it. Holding preserves the invariant that matters — *a lead is marked walked only once
somebody actually searched for it* — and the re-walk doubles as the probe that notices Brave
coming back, so the lane resumes with no diagnosis. It stays finite rather than `Infinity`
because a misfiring detector must not park the lane silently.

**2. Alarm on a sliding collect pass, not just a collapsed one** (`scripts/autopilot/checkin.ts`,
new section 7d).

Judges the lane against its own trailing median instead of a fixed floor: parses the
`Collected N contact points from M/K leads.` summary the file already reads, takes the median
hit rate of the previous passes as baseline, and warns on a relative fall past
`AUTOPILOT_COLLECT_YIELD_DROP_PCT` (40). Emits `bloodhound_collect_yield_degraded`.

Verified against the real log — silent on healthy passes, fires on both damaged ones:

```
  pass -4: 132/150 = 88.0%  vs 92.0%  →  drop  4.3%
  pass -3: 127/150 = 84.7%  vs 90.0%  →  drop  5.9%
  pass -2: 116/150 = 77.3%  vs 90.0%  →  drop 14.1%
  pass -1:  40/150 = 26.7%  vs 88.0%  →  drop 69.7%  FIRES
  pass -0:  53/111 = 47.7%  vs 87.3%  →  drop 45.3%  FIRES
```

Observation only, never escalates to a paid fix agent — the remedy is a spend call. It also
catches a resolution failure that logs no Brave line at all, which the old check could not.

**Verification:** `tsc --noEmit` clean; 4 new regression tests, 26 of 26 passing; `checkin.ts`
run live and it emitted the new observation and finished healthy.

## Deliberately not done

- **Nothing touching discovery.** No paused lane was restarted, re-enabled, diagnosed or
  reported as an anomaly, per the 09-08 standing order. `logs/discovery-paused.flag` untouched.
- **No spend decisions taken.** Brave cap, Apify cap and key purchases are all Casey's.
- **No halt flag.** Nothing this cycle was unsafe to leave running.
- **The excluded-67 sweep**, which needs a look at why each lead failed rather than a blind
  attempt refund.

## Ranked levers

1. **Raise the Brave Search cap on both keys ($5/month plan).** The binding constraint on the
   whole pipeline, and the cheapest item here. Cost the day roughly 90 leads. Third time in a
   fortnight. Enrichment sits idle 20/24h behind it.
2. **Decide on the Apify cap ($100/month, spent).** Second recovery lane, dead for 20 more
   days. ~3,600 untouched leads at ~$0.15–0.30 each; the lane halts itself above $0.20/lead.
3. **Settle the key pool question before discovery resumes.** One late-day probe on a quiet
   day, 66 quota units, answers whether more keys buy anything.
4. **Recovery lane lap policy.** It closed lap 2 this cycle. Laps 1 and 2 ran under very
   different Brave conditions, so a re-walk is not the dead weight it would be on a graph
   sweep. Not readable until Brave is back.
5. **The 67 permanently excluded enrichment leads.** Likely partly 09-01 outage casualties.
   Worth a sweep before the pool grows again.
