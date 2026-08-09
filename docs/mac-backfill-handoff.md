# Mac backfill handoff — approved_hold enrichment (written 2026-08-09, VPS side)

You are the Claude session in the **Mac clone** of `youtube-outreach-orchestrator-v1`.
Casey has locked this plan: **the Mac runs the entire remaining backfill; the VPS
handles only new inflow.** This doc is your complete brief. The VPS side is already
reconfigured and expects you to take the claimed list.

## The split (locked by Casey 2026-08-09)

- **Mac (you):** the 1,836 leads frozen in `scripts/backfill/mac-claimed-ids.txt`
  (committed — you get it via `git pull`). These are `review_status='approved_hold'`
  leads with `outreach_status` in (`email_verified`, `failed`) as of the snapshot.
- **VPS:** everything NOT in that file — i.e. new leads the campaign promotes into
  `approved_hold` after the snapshot. Its id-fetcher already excludes your claimed
  ids (default role `vps` in `scripts/backfill/next-batch-ids.cjs`).
- No coordination needed mid-run: the id sets are disjoint by construction. Statuses
  live in Airtable (base `appenY7r5jlZMRpJ0`) and each lead is only ever touched by
  one machine.

## ⚠️ STEP 0 — env keys, BEFORE anything else

The Mac's `~/Claude/env-storage/.env` is the MASTER env bank: while the Mac is awake
it **overwrites the VPS copy every ~2 minutes**. The VPS bank gained keys on
2026-08-07/08 that the Mac master may not have. **If you start work without adding
them to the Mac master, the sync will strip them from the VPS and break BOTH sides.**

1. `ssh` to the VPS and read `/home/casey/env-storage/.env`.
2. Ensure every one of these exists (same values) in the MAC master
   `~/Claude/env-storage/.env`, adding any that are missing:
   - `SUPADATA_API_KEY`, `SUPADATA_API_KEY_1`, `SUPADATA_API_KEY_2` (rotation pool
     added 2026-08-07 — the bare key's plan is exhausted; the numbered keys carry
     the live credits)
   - `OPENROUTER_API_KEY` (all LLM calls — the pipeline is zero-Anthropic since
     2026-08-01; ANTHROPIC_API_KEY is deliberately absent, do NOT re-add it)
   - `AIRTABLE_PAT`, `RAPIDAPI_KEY`, `RAPIDAPI_YOUTUBE_HOST`
3. Only then proceed.

## Step 1 — freshen the repos (pull, never clone)

`git pull` (do **not** re-clone — `enrichment-bundles/` and archive folders are
gitignored payloads that a clone silently loses):

- `youtube-outreach-orchestrator-v1` — brings this doc, `scripts/backfill/*`
  (chain script, id fetcher, your claim file).
- `youtube-email-outreach-v1` — zero-Anthropic guards, models.json. `npm install`.
- `quick-youtube-channel-research-v1` — Supadata key rotation
  (`src/lib/supadata-keys.ts`), optional-Anthropic fixes in `run-channel.ts` /
  `export-run.ts`, models.json routing to DeepSeek/OpenRouter. `npm install`.

Sanity-check after pulling: `grep -n "supadataKeys" quick.../scripts/run-channel.ts`
should hit, and `grep -n "ANTHROPIC" quick.../scripts/export-run.ts` should show the
optional-key log line, not a `throw`.

## Step 2 — make Mac-local copies of the two backfill scripts

The committed `scripts/backfill/chain.sh` and `next-batch-ids.cjs` hardcode VPS
paths (`/home/casey/repos/...`). Do NOT edit them in place (the repo syncs both
ways). Instead copy to untracked files and adapt:

1. `cp scripts/backfill/chain.sh scripts/backfill/chain.local.sh`
   `cp scripts/backfill/next-batch-ids.cjs scripts/backfill/next-batch-ids.local.cjs`
2. In both copies, replace the VPS repo paths with the Mac equivalents
   (`ORCH`, `EMAIL` at the top of chain.sh; the `require` path inside
   `supadata_ok()`; `DIR` in the .cjs; point chain.local.sh at
   `next-batch-ids.local.cjs`).
3. Create the log dir the scripts expect: `mkdir -p logs/backfill-2026-07`.
4. Note for your copy: the `base_fill()` gate inside chain.sh reads `journalctl`,
   which doesn't exist on macOS — it returns nothing there and the gate self-skips.
   That's fine: the **mass-failure guard** (also in chain.sh) is your backstop. Keep
   both in your copy.

What the chain gives you for free (all battle-tested on the VPS this week): flock
single-instance guard, Supadata-exhaustion wait-and-resume, orphan sweep between
batches, halt-flag stop (`logs/backfill-2026-07/halt.flag`), 2-consecutive-crash
hard wall, mass-failure attempt refund + 1h cooldown, per-batch id files with a
3-strike cap on individually-broken leads.

## Step 3 — run it

```bash
cd <mac orchestrator repo>
BACKFILL_CLAIM_ROLE=mac BACKFILL_CONCURRENCY=<see below> \
  caffeinate -i bash scripts/backfill/chain.local.sh &
```

- `BACKFILL_CLAIM_ROLE=mac` is what restricts you to the claimed 1,836 — do not
  omit it or you'll fight the VPS over its inflow leads.
- Concurrency: ~600–700 MB RAM per lane at peak (the export step is the heavy one).
  16 GB Mac → 12; 32 GB+ → 16–20. The VPS measured ~13–17 leads/hour at 8–12 lanes;
  latency is external (LLM + API waits), so lanes ≈ linear speedup until RAM.
- Expected duration: 1,836 leads at ~25/h (c16) ≈ 3 days.
- Watch: `tail -f logs/backfill-2026-07/chain.log` (batch boundaries) and the
  newest `batch-*-run.log` (per-lead progress).

## Step 4 — rsync bundles back to the VPS (the step that must not be skipped)

Compose reads each lead's research bundle from **local disk on the machine that
will send** — that's the VPS. A lead enriched on the Mac is NOT sendable until its
bundle reaches the VPS. Every few hours (and always at the end):

```bash
rsync -av --ignore-existing \
  <mac email repo>/enrichment-bundles/ \
  <vps>:/home/casey/repos/youtube-email-outreach-v1/enrichment-bundles/
```

**Never use `--delete`** (the VPS has ~2,600 bundles the Mac doesn't). Bundles are
the non-reproducible artifact — treat this like the 2026-07 near-loss taught us to.

## Rules of engagement

- **Never run `npm run send`, the campaign, or the finder from the Mac.** Sends,
  SmartLead, inbox-health state, and the autopilot all live on the VPS.
- **Never touch the VPS's `logs/backfill-2026-07/` or its chain** — it runs its own
  inflow-only loop with the same lock/guards.
- Shared external quotas: Supadata credits and RapidAPI are one pool across both
  machines. If your batches suddenly mass-fail, the chain's guards cool you down —
  don't override them; check which quota died before resuming.
- The Airtable enrichment scratch base (`appTvzwOiTLmqC5Mw`, 125k-record cap) is
  shared. The VPS cleanup timer drains it every 15 min. If you see
  `LIMIT_CHECK_TOO_MANY_RECORDS_IN_TABLE` failures, stop and wait ~1h for the
  valve — that's what the mass-fail guard does automatically.
- LLM spend: enrichment runs OpenRouter (DeepSeek) at roughly $0.04–0.05/lead —
  ~$75–90 for the full 1,836. Casey approved this backfill spend on 2026-08-01;
  disclose per the house LLM Spend Guard anyway when you start.
- When the list drains: final rsync, then report to Casey — done count, failures
  by category, leads excluded at 3 strikes (they're listed as `*-ids.infra` and
  triple-appearing ids in the batch files), and total wall-clock.

## Current state on the VPS (as of writing, 2026-08-09 ~09:00 UTC)

- Backfill is PAUSED here: the enrichment base overfilled this morning (est 178%);
  the cleanup valve is purging and the VPS chain auto-resumes below 60% — but from
  then on it only processes post-snapshot inflow, not your 1,836.
- Your claimed leads include ~600 that failed on infra this week (Supadata outage,
  a stale env check, the full base) — their strikes were refunded; they're normal
  leads, just re-queued. True per-lead failure rate has been ~3%.
- Don't start batches until the base is draining again (check with the VPS session
  or just start — the mass-fail guard + 1h cooldown makes a too-early start cheap).
