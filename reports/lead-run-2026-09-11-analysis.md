# Lead Run Analysis — 2026-09-11

Cycle: 2026-09-10T07:00:00Z → 2026-09-11T07:00:00Z
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-11.json`
Debrief: [lead-run-2026-09-11.html](lead-run-2026-09-11.html)

## Headline

**Eight leads parked, the second-worst day on record, and three quarters of the recovery
lane's capacity went into re-reading the same 58 leads.** Brave Search being out of money
was expected. What was not: the fix shipped yesterday to protect the lane under exactly this
outage picked the wrong batch to protect, held it for three consecutive passes, and was on
course to hold it for twelve more days.

The same logs carry the correction that matters most. **Collection still works with Brave
dead.** One pass this cycle got 268 contact points off 53 of 111 leads with every single
search refused.

## The funnel

| Stage | This cycle | Prior cycle | Note |
|---|---|---|---|
| New channels discovered | 0 | 0 | Paused by Casey 09-08. Intended. |
| Recovery collect passes | 4 | 3 | One walked new leads; three re-walked the same 58 |
| Leads handed genuinely new work | 111 | 450 | The rest was repeat reading |
| Collect hit rate | 48%, then 0%, 0%, 0% | 27% → 48% | 48% is the honest Brave-dead number |
| Recovery verify passes | 7, 40 leads | 6, 129 leads | Starved by collect, not broken |
| Parked → `approved_hold` | **+8** | +44 | Pool 5,746 → **5,754** |
| `needs_contact` pool | 3,737 | 3,745 | Was 4,951 on 09-02 |
| Leads enriched | 7 done, 3 failed | 65 done, 0 failed | All 3 failures are one lead, one bug |
| Enrichment idle | ~23.5 of 24 h | ~20 of 24 h | No inflow |
| Sent to SmartLead | 0 ready, clean exit | 11 of 11 | Nothing parked ready |
| Anthropic spend | $0.00 | $0.00 | Ceiling $150 |
| OpenRouter | $3.82/day, 16 days | $8.07/day, 8 days | Cheap because nothing runs |
| YouTube key pool | 15 / 50 / 1 of 66 | 15 / 50 / 1 of 66 | Fourth identical morning |
| Fatal signatures | 0 | 0 | No halt, no quota stop |

Parked-per-cycle, 14 days: 78, 54, 5, 63, 177, **627**, 71, 71, 151, **488**, 142, 133, 44,
**8**.

## The shape of the day

Four collect passes, from `logs/campaign-2026-09-10.jsonl` and `logs/bloodhound-collect.log`:

| Pass | Leads | Result | Why that batch |
|---|---|---|---|
| 07:02Z | 111 | **268 contact points off 53 leads (48%)** | Rewind budget spent, walked forward |
| 14:00Z | 58 | **0 off 0** | Rewound onto the previous pass's tail |
| 20:01Z | 58 | **0 off 0** | Rewound onto the same 58 |
| 02:01Z | 58 | **0 off 0** | Rewound onto the same 58 |

Verify then starved behind it: seven passes, four leads in six of them, 40 leads total
against 129 yesterday. Eight leads parked.

### Why the same 58

The collect queue carries a bookmark and works forward through the parked pool. It orders
leads by tier first: tier 0 has external links recorded, tier 1 does not. The 07:02Z pass
was at the very end of tier 1, so it came up **short** — 111 leads instead of the full 150 —
which is how the queue signals "the lap is done". A short batch clears the bookmark; the
next pass starts a new lap from the top.

Yesterday's rule rewound it instead. Of those 111 leads, 53 gained a contact point and so
dropped out of the pool by definition, leaving exactly 58 when the same window was selected
again. Those 58 are tier 1 with no resolvable site, so with Brave refusing they produce
nothing, every time, deterministically.

Confirmed by direct query after the fix:

```
fresh-lap batch size: 150   lapComplete: false
old pinned tail size:  58   lapComplete: true
```

### The premise that was wrong

The 09-10 code comment reasoned that while search is down, *every lead ahead of the cursor is
just as unsearchable as the one under it*, so holding position costs nothing. Nine of the
collector's ten methods do need the creator's website — but Brave is not the only route to
one. A free path reads the channel's own page and never touches Brave.

Measured across this outage, with every Brave key answering `402 Usage limit exceeded`, the
lane still collected from **148/150, 143/150, 40/150 and 53/111** leads. Holding position
therefore costs the rest of the book, against a cap that does not reset until 1 October.

## What shipped

### 1. A lap-closing batch is never rewound (orchestrator)

`rewindWaiver()` in `src/recovery/bloodhound-lane.ts`. The `collectResume` record now carries
`lapComplete`, and a rewind is skipped when it is set. Rationale in one line: a rewind exists
to recover leads stranded *behind an advanced cursor*, and a short batch strands nobody —
the cursor was cleared, not stepped over, and every lead in that batch is still in the pool,
so the next lap picks it up from the top regardless.

### 2. A search-dead pass that still worked, advances (orchestrator)

Second clause of the same waiver, driven by `lastCollectPassYield()`, which parses the CLI's
own completion line. Above `SEARCH_DEAD_REWIND_YIELD_FLOOR_PCT` (10) the pass counts as a
real walk and the cursor moves on. The floor sits far below the lane's healthy 85-95% and
below every degraded pass on record, so only a genuine collapse holds the bookmark — which
is the case the rewind was written for.

Verified: `tsc` clean, **34/34 tests pass, 8 new**, and all three helpers run against the
real collect log (`yield {walked:58, withPoints:0}`, `searchDead true`, waiver
`lap_complete`).

**Live state repaired.** The pinned `collectResume` was removed from
`logs/bloodhound-lane-state.json` so the next pass starts a fresh lap rather than burning one
more cycle on the tail. Backup at `logs/bloodhound-lane-state.json.bak-20260911`.

### 3. NUL bytes scrubbed out of comment rows (enrichment repo)

Postgres `text` cannot hold a NUL byte at all; it rejects the statement with
`22021: invalid byte sequence for encoding "UTF8": 0x00`. Stage 4 saves YouTube comment
bodies verbatim, so one poisoned comment fails the whole enrichment run for that channel.

The damage is worse than a lost run. The failure is deterministic, so the backfill chain
relaunched the lead and burned all three of its `MAX_ATTEMPTS` in five minutes, dropping it
from the pool permanently. It also produced the `done=0` zero-progress batches the 09-02
guard exists to catch. `recvP5IA0vHjvMvrf` died this way on 2026-08-25 and
`recioa0mrrdBUo0lY` on 2026-09-10, both at `stage-04-top-comments.ts:227`.

New `src/lib/pg-safe.ts` strips the byte before the row is built, in Stage 3 and Stage 4 (same
comment source, same hazard). Deliberately narrow: lone surrogates are a different problem
with a different fix, and Postgres stores those fine. Verified: `tsc` clean, 4 new tests pass.

## Open questions

**The key pool is still one measurement repeated.** Fourth identical morning
(15 working / 50 exhausted / 1 blocked of 66), and a third straight cycle in which nothing of
ours spent a unit overnight, so our own spending is ruled out three times. But all four
readings sat ~20 minutes past the midnight-PT reset, and a consistently late refill produces
exactly that. The untried discriminator is unchanged: **one probe six or more hours after the
reset**, 66 quota units, on a quiet day. Run it before discovery resumes.

**67 enrichment leads are permanently excluded.** They have burned all three attempts. Today's
NUL bug accounts for at least two, and the 09-01 config outage for more. They are not bad
leads; they hit infrastructure faults that are now fixed, and nothing reopens them by itself.

## Deliberately not done

Nothing touching discovery: no sweep, timer, state file, seed book or flag, per Casey's 09-08
pause. No `.env` written. No spend decisions taken on Brave, Apify or keys. No halt flag. The
key-pool probe was not run, because the useful version has to happen in the afternoon.

## Ranked next

1. **Raise the $5/month Brave cap on both keys.** Still the binding constraint, and it does
   not reset until 1 October. Sized honestly now: with Brave dead the lane runs at roughly
   **48%** of healthy, not zero, so it is worth about half the funnel rather than all of it.
2. **Settle the key pool with one late-day probe** (66 units), before discovery resumes.
3. **Decide the Apify budget** — zero runs since 09-06, resting until 09-30, ~3,600 untouched
   leads at $0.15-0.30 each, halts itself above $0.20.
4. **Watch the next collect pass**: it should dispatch **150** from a fresh lap, not 58. If it
   reads 58, the state repair did not take.
5. **Reopen the 67 excluded enrichment leads.**
