# PG schema additions — 2026-08-12 (from the Mac backfill session)

After the Postgres cutover, both machines' enrichment batches were failing on
pipeline-db's writable-field guard: the DDL generation dropped every table's
Airtable primary "label" field plus the bank chunking fields, all of which the
quick repo writes at insert time. Applied directly to the live DB (additive,
nullable, `IF NOT EXISTS`):

- `enrichment.transcripts.transcript_label` text
- `enrichment.classifications.classification_label` text
- `enrichment.pinned_comments.comment_label` text
- `enrichment.top_comments.comment_label` text
- `enrichment.icp_avatar.avatar_label` text
- `enrichment.banks.bank_label` text
- `enrichment.banks.chunk_index` integer
- `enrichment.banks.chunk_count` integer

Not added: `videos.is_trending_outlier` / `is_all_time_outlier` (Airtable
formula fields — computed, never written) and `outbound_links.link_label`
(nothing writes it). pipeline-db's catalog reads live from information_schema,
so no code or rebuild was needed — fresh processes pick the columns up
automatically.

If the DDL generator (`quick-youtube-channel-research-v1/scripts/gen-leads-ddl.py`
family) re-runs against these tables, fold these columns in so a regenerate
doesn't drop them again.

## Second addition, same day — the subscriber floor

Casey's 2026-08-12 rule: a channel under 3,000 subscribers can never be
pitchable, so nothing below that may reach the `signal_score >= 6` bar. Applied
by `youtube-lead-finder-v1/scripts/backfill-subscriber-floor.ts` (same
convention: additive, nullable, `IF NOT EXISTS`):

- `leads.lead_candidates.signal_score_uncapped` integer
- `leads.lead_candidates.subscriber_floor_applied_at` timestamptz

`signal_score_uncapped` holds the pre-cap score for all 45,393 rows. It exists
so the floor stays reversible: moving the threshold later is a SQL re-derive off
this column, never a re-score. **Do not overwrite it on a re-run** — the
backfill's `WHERE signal_score_uncapped IS NULL` guard is what stops a second
pass from saving the already-capped value over the original.

Nothing reads these two columns at runtime. They are provenance.
