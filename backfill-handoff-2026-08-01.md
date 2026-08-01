# HANDOFF — approved_hold enrichment backfill (as of 2026-08-01 ~17:45 UTC)

Read this first in a fresh session. Memory files carry the durable gotchas
(`env-storage-mac-clobber`, `rapidapi-quota-mechanics`); this doc carries the
live run state. Delete it when the backfill is done.

## Mission

Enrich the entire `approved_hold` pool (find→verify already done; this runs
**enrich only**, `--stop-after enrich`) so every lead parks at
`outreach_status=ready_data_scraped`, ready for a future `npm run send`.
Leads stay `review_status=approved_hold` throughout — **nothing can send**.
Casey authorized the full backfill; sending is NOT part of this.

## Live state

| Bucket | Count |
|---|---|
| Done (`ready_data_scraped`) | **370** |
| Remaining (`email_verified`) | **3,196** (pool grows ~200+/day — the finder keeps promoting) |
| Failed (auto-retry by including in next batch) | 2 |

**THE BATCH IS PAUSED** (Casey's call, 2026-08-01 ~16:30 UTC, during the
Anthropic-spend investigation — now resolved, see below). Day-1 file was 500
ids; ~270 of them are done. **Resume needs Casey's explicit word.**

## How to resume (day-1 remainder)

```bash
cd /home/casey/repos/youtube-email-outreach-v1 && YOUTUBE_API_BACKEND=rapidapi \
  nohup npm run outreach -- \
  --lead-ids-file /home/casey/repos/youtube-outreach-orchestrator-v1/logs/backfill-2026-07/day1-500-ids.txt \
  --stop-after enrich --concurrency 8 \
  > /home/casey/repos/youtube-outreach-orchestrator-v1/logs/backfill-2026-07/day1-500-run-c8b.log 2>&1 &
```

- Idempotent: done leads skip instantly (bundle+run_id recorded → prep no-ops).
- **c8, not c12** — c12 OOM'd the box (exit-137 export kill, swap exhausted) and
  bought zero throughput. Real speed is ~19–20 leads/h at ANY concurrency
  (external choke, suspected OpenRouter serialization) → ~470/day → ~7 more days.
- `YOUTUBE_API_BACKEND=rapidapi` on the enrichment command ALWAYS — direct
  Google keys belong to the finder (Casey's rule: finder never starves;
  after the backfill the finder gets 100% of everything again — nothing
  persistent was taken from it).
- Arm a failure monitor on the log (grep `"] FAILED:"`), and a completion watch.

## Daily rhythm (after day-1 completes)

1. **New ids file** (~500/day; quota room is ample post-patch — 8 searches/lead
   vs 5,000/day bucket): dump from Airtable where `review_status='approved_hold'`
   AND `outreach_status` IN (`email_verified`, **`failed`**) — the `failed`
   inclusion retries OOM/transient casualties; the probe/day-1 dumps only used
   `email_verified` (day-2+ must add `failed`). Script pattern: see
   `logs/backfill-2026-07/` + scratchpad dump scripts; 100-id and 500-id files
   already there as templates.
2. **Launch** as above, new log name, background + monitor.
3. **Drain after each batch** (or let the 80% valve handle mid-batch):
   `cd youtube-email-outreach-v1 && npx tsx scripts/airtable-cleanup.ts --older-than 1h`
   (~30 min for ~60k rows). The tool archives→rolls up→deletes; Drive syncs on
   the 15-min timer; bundles are never touched. Verified end-to-end 2026-08-01.
4. Base math: 612 records/run; valve trips at 80% of 125k. `CLEANUP_MIN_AGE_HOURS=2`
   is set via systemd drop-in (see Restore list).

## What happened today (all committed)

| Fix | Where | Commit |
|---|---|---|
| RapidAPI 429 = fatal → retry/backoff | quick repo `src/lib/youtube.ts` | `2564e33` |
| DeepSeek tool-call shape drift crashed offer-bank | quick repo `offer-bank.ts` | `74bc2c4` |
| 22 searches/lead → 8 (search.list waste in stages 01+10) | quick repo harvest stages | `c25e090` |
| Compose Opus 4.7 → DeepSeek v3.2 (+ provider-agnostic `src/llm/complete.ts`) | email repo | `42fe7e9` |
| Synthesis fallback → DeepSeek (env kept getting clobbered) | quick repo `models.ts` | `fae4c09` |
| **`models.json` = source of truth for ALL 14 task models (out of env, Casey's rule)** | quick repo root + CLAUDE.md | `90fcc8e` |
| Drive sync `--prune` (guarded ≥10 local JSONs) | automator cleanup wrapper | `fdd3aaa` |
| Unit-economics cost report | casey-assistant `brain/costs/cold-email-unit-economics.md` | `c40d19c`+`1d166a8` |

## The Anthropic-spend incident (resolved 2026-08-01)

Casey saw ~$80/10h on the API key. Attribution: **~$50–55 = Claude Code
sessions billing the API key** (`.bashrc` sourced all of env-storage →
`ANTHROPIC_API_KEY` reached the VS Code extension → key wins over
subscription); ~$16 = enrichment stages on Sonnet (Mac env-clobber reverted
the DeepSeek swap — root-caused, fixed via models.json); ~$5 finder Haiku
(standing); ~$4 autopilot.

- `.bashrc` now `unset ANTHROPIC_API_KEY` after sourcing env-storage. Pipeline
  unaffected (all repos read keys from files). **Casey must reload the VS Code
  window** for a running session to stop billing the key — check whether that
  happened; if the new session runs without the key in `/proc/self/environ`,
  it worked.
- Enrichment now makes **zero Anthropic calls** (all 14 quick-repo tasks →
  `openrouter:deepseek/deepseek-v3.2` via `models.json`). Expect ~$0.09/lead.
- Still on the API key by design: finder Haiku (scoring + host-ID, ~$10–15/day).
  Casey may want the finder moved to DeepSeek too (models.json pattern) — ASK,
  not done yet.

## Open items / decisions pending

1. **Resume word from Casey** for the day-1 remainder.
2. **SmartLead monthly price** — last blank in `brain/costs/cold-email-unit-economics.md`.
3. **Finder → DeepSeek?** (kills the last standing Anthropic burn; Casey hasn't decided.)
4. Brain cost doc's enrichment numbers are Sonnet-era measurements ($0.137 med);
   re-measure after a full DeepSeek batch and update §2/§4 + the INDEX row hook.
5. One probe lead's offer.md may be a thin/placeholder (pre-fix soft-fail);
   find by smallest `offer.md` among probe bundles, regenerate if it matters.

## Restore list — when the LAST batch is drained

- [ ] Remove systemd drop-in `/etc/systemd/system/enrichment-db-cleanup.service.d/override.conf`
      (`CLEANUP_MIN_AGE_HOURS=2` → back to 6) + `daemon-reload`.
- [ ] Confirm finder untouched/full-quota (it was never throttled — just verify
      `autopilot-campaign.service` active and passes running).
- [ ] Update brain cost doc with measured DeepSeek-era $/lead (see item 4).
- [ ] Run-debrief HTML to `casey-assistant/brain/lead-gen/runs/` + INDEX row
      (per orchestrator CLAUDE.md convention).
- [ ] Delete this handoff file.

## Key paths

- Batch files + logs: `logs/backfill-2026-07/` (ids files, run logs, drain-test.log)
- Enrichment scratch base: `appTvzwOiTLmqC5Mw` (11 tables; `channels` = permanent 18k baseline)
- Archives: `youtube-email-outreach-v1/Exported Leads in JSON/` → Drive folder `1OjW2Qa29MxKb0E3qaX2WseSWhNFaedyl`
- Bundles (compose reads these; never purged): `youtube-email-outreach-v1/enrichment-bundles/<recId>/`
- Cost report: `casey-assistant/brain/costs/cold-email-unit-economics.md`
