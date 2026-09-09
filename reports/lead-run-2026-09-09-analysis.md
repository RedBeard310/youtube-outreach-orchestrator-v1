# Lead Run Analysis — 2026-09-09

Cycle: 2026-09-08T07:00:00Z → 2026-09-09T07:00:00Z (midnight Pacific to midnight Pacific).
Grounded in `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-09.json`,
the sweep state files, `logs/bloodhound-collect.log`, the finder's dead-key store, the
07:20Z send transcript, and direct queries against the `pipeline` database. Anything
measured by hand this session is labelled as such.

## Headline

**+133 parked**, `approved_hold` 5,569 → **5,702**. Yesterday was +142. The first full
cycle under Casey's discovery pause cost essentially nothing, because **only 28 of the
133 parks came from channels found during the cycle**.

**The day's real event was a send that failed on all 11 leads.** Three separate faults,
all now fixed, and the leads have been restored. Nothing was mailed.

**`needs_contact` fell 65** to **3,789**, taking in 23 arrivals. Combined with
`approved_hold`, that is **9,491 creators found and never contacted**, none of them mailed.

## The funnel

| Measure | Value |
|---|---|
| Channels discovered | 1,616 |
| Scored 6 or better | 67 (4.1%) |
| Verified an email by cycle end | 28 |
| Of today's channels, already in `approved_hold` | 28 |
| Of today's channels, in `needs_contact` | 23 |
| Parked into `approved_hold` | +133 (5,569 → 5,702) |
| Parked leads carrying a bundle | 5,553 of 5,702 (149 outstanding) |
| Scoring failures | 0 |
| Campaign sessions | 6 started, 6 done |
| Finder passes | 132, for 27 fresh pitchable |
| Hard stops / quota stops / time-budget stops | 1 / 0 / 5 |
| Term-starvation notices | 25 |
| Fatal signatures | 0 |
| Anthropic spend | $0.00 |
| OpenRouter | $15.35/day account meter, $2.26 in the finder log, balance $72.86 |
| Apify | 0 runs, resting on budget |

Discovery by method: recommended-videos feed 961 channels for 22 good, video-graph sweep
304 for 18, keyword search 350 for 27, podcast crossover 1 for 0.

## The shape of the day

Channels found per hour, 07:00Z through 06:00Z:

```
150 138 109 121 124 137  94  87 111  62  43  77 116  53  69  98  27
  0   0   0   0   0   0   0
```

Seventeen productive hours, then a hard stop at 23:16Z, which is the minute
`logs/discovery-paused.flag` was written. The seven silent hours are the instruction
working. Per the standing order they are not an anomaly and were not investigated as one.

## Q1. Did switching off discovery cost anything?

Almost nothing. +133 against yesterday's +142 sits inside normal day-to-day variation.

The attribution is what makes the case. Of the 133 parks, **28** were channels first seen
during this cycle. The remaining 105 came off the existing pile via enrichment and the
Bloodhound recovery lane. Finding and parking came apart from each other in early
September, and the recovery lane has been the larger producer since. It needs no new
channels: 3,789 already-found, already-scored creators are queued in `needs_contact`.

Apify contributed nothing this cycle. It has been resting on budget since 09-06.

## Q2. Why did every lead in the 07:20Z send fail?

Three faults, stacked. Two broke the send. The third turned a bad send into lost work.

### Fault 1 — the repo stopped reading half its own config

`env-storage` holds two sources of truth:

```
env-storage/.env                     shared keys, every repo
env-storage/fragments/<repo>.env     that repo's own config
```

`build-envs.sh` concatenates them into each repo's generated `.env`. The email repo's
generated `.env` was deleted on 2026-09-01, and `src/shared-env.ts` reads only the shared
bank. Every fragment-only value went invisible.

This is the **second** outage from the same cause:

| Date | Lost value | Damage |
|---|---|---|
| 2026-09-02 | `ENRICHMENT_REPO_PATH` | backfill chain ran for days completing nothing; patched with a code default in `env.ts` |
| 2026-09-09 | all 16 `SMARTLEAD_CAMPAIGN_*` ids | 9 of 11 leads had no campaign to be pushed into |

Patching one variable at a time does not fix the class, and campaign IDs are
account-specific so they cannot be given a code default at all.

Verified by hand: the fragment file holds 29 lines including all 16 campaign IDs, and it
shares **zero** keys with the shared bank, so load order carries no risk.

### Fault 2 — a skill folder renamed a month ago

`compose-nick-saraev.ts` hard-coded `~/.claude/skills/nick-saraev-cold-email`. The
2026-08-06 skills reshuffle renamed it `cold-email-nick-saraev`. The old name still sits
in `~/.claude/skills.old-2026-08-06/`, which is how the rename was confirmed. Two leads
died on `ENOENT` before writing a word.

The same class of break happened on 2026-06-15 when the title-writer skill moved its
support files into `references/`, and `title-skill.ts` was hardened then. That hardening
was never copied to the nick-saraev composer.

### Fault 3 — the campaign ID was resolved after the email was written

Order of operations in `runLead`: compose, then push, then resolve the campaign. So nine
leads paid for a full compose, roughly 30 to 85 seconds of model time each, before hitting
a missing ID.

The costlier half is the write-back. Every failure set `outreach_status = failed`, and:

- `failed` is **not** in `APPROVED_FIRE_READY` (`ready_data_scraped`, `enriched`,
  `email_drafted`), so the leads fell out of `npm run send` entirely.
- `failed` is **not** in `APPROVED_PREP_DONE` either, so the next tick would have re-driven
  all 11 through find, verify and enrich from scratch.

Eleven enriched, ready-to-mail leads, priced at a full re-enrichment each, because of a
missing environment variable.

## Q3. The key pool question, answered by the pause for free

The 09-07 and 09-08 debriefs both read **15 working of 66** about twenty minutes past the
reset and could not separate three explanations: a late refill, a cut quota, or our own
sweeps waking at the reset and burning the pool within seconds. Casey shipped a grace
window for the third on 09-08.

Last night was an accidental controlled test.

- **59 keys were already quota-dead at 22:40Z**, the last write to
  `youtube-lead-finder-v1/logs/youtube-dead-keys.json` (58 quota, 1 blocked, plus one
  earlier blocked entry: 60 entries total, 59 quota).
- Discovery stopped at 23:16Z. **Nothing of ours touched a YouTube key for over eight
  hours.**
- The 07:20Z probe, twenty minutes past the reset, found **15 working, 50 quota-exhausted,
  1 blocked**. Roughly eight of the 59 came back.

Our own early-morning spending was not the main cause. It is either a refill that lands
well after 07:00Z for those projects, or a real quota reduction.
`youtube-lead-finder-v1/scripts/audit-key-projects.sh` separates the two for free and
spends no quota. It is not urgent: discovery is off, and the lanes still running use
one-unit calls and free watch-page reads, not hundred-unit searches.

## Brave Search is capped again

`searchBrave()` is refusing across both keys with `402 Usage limit exceeded`, **19 times**
in the current collect log. The plan carries a $5 monthly spending cap. Website resolution
feeds nine of the collector's ten methods, so a capped plan throttles the lane doing most
of the parking.

Measured on the last 500 log lines: **120 of 470 leads resolved no website (25.5%)**. The
documented healthy band is under about 15%, and a full collapse reads over 70%. So
resolution is degraded, not dead.

The structural problem was worse than the throughput loss. A capped pass still
*completes*: it walks all 150 leads, finds almost nothing, and the cursor steps over every
one of them, so real leads wait a full lap before anyone looks again. That is the shape
that turned the 09-02 batch widening into 71 parks instead of 627. The loud diagnostic line
added on 09-04 named the cause and nothing acted on it. Now something does (see fixes).

## Fixes shipped

### `youtube-email-outreach-v1` (commits `6b38d2103`, `81fd7afb6`)

The auto-sync timer committed these before the agent's own commit landed, which is the
documented race. The code is in `main` and pushed.

1. **`src/shared-env.ts`** now loads `env-storage/fragments/<repo>.env` after the shared
   bank, exactly as `build-envs.sh` composes them. The repo folder name is derived from
   the module's own path, not the package name, because they differ (folder
   `youtube-email-outreach-v1`, package `youtube-outreach-v1`). `override: false` is kept,
   so real process env still wins over both files.
   *Verified:* 16 `SMARTLEAD_CAMPAIGN_*` variables visible again, `ENRICHMENT_REPO_PATH`
   set, and all 11 leads resolve a campaign (`11/11 resolvable`).

2. **`src/writer/skill-files.ts`** (new) resolves a skill folder by search rather than by
   path: known aliases first, then any sibling folder whose name is the same set of
   hyphen-separated words and which actually contains a `SKILL.md`. Each file is then
   resolved by basename, flat or under `references/`, then by recursive search.
   `compose-nick-saraev.ts` uses it and exports `loadSkillBlock` for preflight.
   *Verified:* the 47,279-character block loads, all five files present.

3. **`src/cli/outreach.ts`** gained two preflights and one write-back guard.
   - The nick-saraev skill is loaded once at startup, alongside the existing title-skill
     preflight. It warns rather than exits, because half the batch is `5-ideas-email` and
     can still send.
   - Campaign IDs are resolved for every `(niche, variant)` pair in the batch **before
     compose**. Blocked leads are dropped from the batch untouched, with a per-variable
     count printed. If nothing is runnable the run aborts having spent nothing.
   - A `CampaignConfigError` or `SkillNotFoundError` **never writes a lead status**. A
     config fault is not the lead's fault, and writing `failed` is what stranded these 11.

   *Verified live* against the same 11 lead IDs: the run now aborts in about five seconds
   with the exact list of missing variables, instead of composing for 101 seconds and
   losing every lead.

### `youtube-outreach-orchestrator-v1` (commit `f0c8e6a`)

`src/recovery/bloodhound-lane.ts` gained `lastCollectPassSearchDead()`, a sibling of the
existing `lastCollectPassFinished()`. It reads the same log tail for the all-keys-refused
line emitted by `searchBrave()`. A search-dead pass now rewinds the collect cursor exactly
as a truncated pass does, under the same `MAX_CONSECUTIVE_REWINDS` cap so a long Brave
outage cannot pin the walk in place forever. An unreadable log returns `null` and never
rewinds.

*Verified:* `tsc --noEmit` clean; against the live log `searchDead=true`, so the next
collect pass will rewind rather than burn 150 leads; against three synthetic logs,
healthy `false`, brave-dead `true`, unreadable `null`.

### Manual repair

The 11 leads were restored from `outreach_status = 'failed'` to `'ready_data_scraped'`,
which is the state they held before the send. All 11 carry an enrichment bundle, so the
parked status is truthful. `outreach_error` records why. They are back in the send queue
and nothing has been mailed: sending stays manual.

## Deliberately not done

- **Nothing touching discovery.** No sweep re-enabled, no timer restarted, no state file
  repaired, no edit to `logs/discovery-paused.flag`. Dry pools, stopped sweeps and zero
  new channels were read as the intended state, per the standing order.
- **No `.env` file was written.** The env fix is in the loader, which reads a file
  `build-envs.sh` already treats as a source of truth.
- **No second key probe.** Better quota instrumentation would settle the late-refill
  question sooner, but it is discovery instrumentation, and resources belong on enrichment
  while the pause holds. `audit-key-projects.sh` already answers it for free when needed.
- **The Apify reserve was not lowered.** A batch of 80 would fit inside the $6.11 of
  usable balance where a batch of 100 does not, but changing a money-path guard is Casey's
  call, not the autopilot's.

## Ranked levers

1. **Decide whether to send the 11.** Repaired, verified, and waiting. Sending is manual
   by design.
2. **Top up OpenRouter. 4.7 days** at $72.86 and $15.35/day. This matters more under the
   pause, not less: enrichment and the recovery lane both score and write through
   OpenRouter, so a zero balance stops exactly the work the pause protects.
3. **Raise the Brave cap, or accept a slower recovery lane.** $5/month across both keys,
   refusing again. Nine of ten collection methods need a website first. Today's fix stops
   a capped plan from destroying leads; it cannot make searches happen.
4. **Decide the Apify budget.** Zero runs since 09-06, blocked until 09-30 by $16.11 minus
   a $10 reserve against a $7.02 batch, with roughly 3,600 leads never touched.
5. **Run `audit-key-projects.sh` before resuming discovery.** Free, and it settles whether
   50 exhausted keys are a late refill or a cut quota.
