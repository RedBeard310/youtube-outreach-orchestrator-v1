# Standing Orders — the living priority document

**Read this at the start of every session before deciding what to work on.**
This file exists because day-to-day instructions were slipping through the
cracks between sessions (Casey, 2026-08-14). When Casey changes a priority in
chat, UPDATE THIS FILE in the same session — that is what "living" means.
Keep the change log at the bottom.

## The mission (never changes)

More qualified leads. Every discovery method runs permanently and overnight.
Never stop a producing lane. Sending email stays MANUAL (`npm run send`) —
everything up to "parked, ready to write" is automatic.

## Discovery lane priority (updated 2026-08-14)

1. **Recommended-videos feed (graph-sweep) — PRIMARY. Pound it hard.**
   Casey 2026-08-14: this is the new #1, hit it as hard as we can every day.
   It self-feeds (every qualified lead becomes a seed) and re-walking the
   whole seed book (a new "lap") is proven at ~80% of first-lap precision —
   0.45 qualified/seed lap 1. Standing authorization: always-on, OpenRouter
   spend included, no per-run approval. If this lane is idle, that is a
   PROBLEM to fix, not a normal state.
2. **Comment-sweep — self-refilling seeds.** Mines commenters on
   creator-education channels (best per-seed yield measured: 2.1/seed). Seeds
   must never run out again: the seed-discovery engine searches YouTube for
   creator-education keywords ("how to grow a YouTube channel", "how to write
   a YouTube script", "how to get clients from YouTube", every variant) and
   refills automatically. Unlimited keyword space — use it.
3. **Keyword/term search — opportunistic, not primary.** The fresh-term
   reserve drained 2026-08-12. The lane runs on whatever the autocomplete
   harvest + probe discovery refill; do NOT treat "no active terms" (finder
   exit 3) as an incident, and do NOT lean on this lane for volume.
4. **Peer-comment + guest-link lanes** — keep running on their timers.
5. **Podcast crossover** — NOT built; waiting on Casey's data-source call.

## Enrichment / prep (steady state since 2026-08-13)

- Transcripts: **Decodo** primary (~$0.50/1k, key `Decodo_API_KEY` mixed case),
  Postgres cache checked first, Supadata CANCELLED (keys may vanish; code
  treats it as optional fallback). Never filter on `captions_exist`.
- The backfill chain (`scripts/backfill/chain.sh`) self-drains the
  approved_hold pool; VPS handles unclaimed + inflow, the Mac owns its frozen
  claim file. Leads run ~3-6 min each now.
- The store is **Postgres** (`pipeline` db, via `/home/casey/.pipeline-db.env`).
  Anything that reads Airtable is dead code. Whole-table reads are forbidden —
  enrichment.videos is 2.5M rows and killed every export once (2026-08-13).

## Parked pools waiting on Casey (don't touch without his word)

- `needs_contact` (~2,600): recovery engine unbuilt — HIS green light needed.
  Biggest known volume lever.
- `approved_hold` (~2,200): fires only via manual `npm run send`.

## Session checklist (every session, ~2 minutes)

1. Is graph-sweep.service actively walking? (`systemctl status graph-sweep`;
   idle + seeds available = fix it.)
2. Did comment-seed discovery run in the last day? (`logs/comment-seed-discovery.jsonl`)
3. Is the backfill chain alive and past its gates? (`logs/backfill-2026-07/chain.log`)
4. Radar fresh? (youtube-ingest.timer, every 6h; manual: `python3 scripts/youtube_ingest.py` in automator)
5. Anything in this file contradicted by what Casey said today? → update it.

## Change log

- 2026-08-14: File created. Graph-sweep promoted to explicit #1 ("pound it"),
  refill cadence tightened 4h→1h, next lap queued; comment-sweep seed
  discovery engine commissioned; keyword lane demoted to opportunistic.
  (Casey's instruction after a thin overnight: don't let exhausted lanes
  masquerade as primary ones.)
- 2026-08-14 (later): Lap 3 re-walk LIVE — 8,409 seeds queued, ~3 days of
  continuous walking, watch `npx tsx scripts/lap2-progress.ts` (finder repo).
  Lap 2 closed at 0.373 qualified/seed (82% of lap 1 — compounding holds).
  OPEN DECISION for Casey: auto-`--relap` on drain (extend-seeds.ts) once
  this re-walk's rate is measured, so the lane never idles again.
- 2026-08-14 (later): Comment-seed discovery engine LIVE
  (finder scripts/discover-comment-seeds.ts + 40-query bank, runs before the
  09:11 UTC daily sweep, cursor rotates queries daily). First run: 15 new
  seeds (vidIQ, TubeBuddy tier); first chunk surfaced 4,546 net-new
  commenters. Expect elevated OpenRouter scoring spend on rich days; the
  --max-llm 4000 cap pausing a walk mid-day (exit 10) is normal, it resumes
  next day.
