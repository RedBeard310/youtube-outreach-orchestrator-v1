# Airtable → Postgres migration plan

Scoped 2026-08-10. Status: **proposal, not approved.** Nothing has been built or changed.

Covers all five pipeline repos that read or write Airtable:
`youtube-lead-finder-v1`, `youtube-email-outreach-v1`, `youtube-outreach-orchestrator-v1`,
`quick-youtube-channel-research-v1`, `youtube-deep-research-v1`.

---

## 1. Why this is worth doing

The $54/month was the reason for asking. It turned out to be the smallest of the three reasons.

**Reason 1: the record cap is not hypothetical, it's close.**

| Base | Records now | Cap | Status |
|---|---:|---:|---|
| Enrichment scratch (`appTvzwOiTLmqC5Mw`) | 100,548 | 125,000 | **80.4% full. The capacity valve has already tripped.** |
| Lead base (`appenY7r5jlZMRpJ0`) | 44,541 | 125,000 | 36% full, and filling |

The enrichment base only stays under the cap because a timer deletes from it every 15 minutes.
That's not headroom, that's a treadmill.

The lead base has never been cleaned. It grew 22,341 rows in July and 14,827 in the first ten
days of August. At August's pace it hits the cap in **54 days**. At July's slower pace, 112 days.
So the wall lands somewhere between early October and early December 2026.

**Reason 2: a large amount of code exists only to cope with Airtable's limits.**

Measured across the repos, roughly **2,900 lines** are pure limit-tax and would be deleted, not
ported:

| What | Lines | Exists because |
|---|---:|---|
| `airtable-cleanup.ts` (delete half), `airtable-purge-all.ts`, `rollup-archived-runs.ts`, `inject_banks_into_archives.py` | ~1,700 | 125,000 record cap |
| `bank-rows.ts` + `push-bank-rows.ts` (bank chunking) | ~239 | 100,000-character cell cap |
| `src/lib/pipeline/links.ts` and its 13 call sites | ~30 + callers | Airtable formulas can't see linked-record ids |
| `setup-airtable.ts` + `add-banks-table.ts` (deep + quick repos) | ~600 | The schema API is one-shot and rejects most field types |
| `src/airtable/init.ts` (email repo) | ~182 | Same |
| Rate limiters, 429 backoff, 10-record batching, 100-row pagination | ~150 spread | 5 requests/second limit |

**Reason 3: two silent data-loss bugs go away.**

- Transcripts longer than 99,500 characters get truncated and the tail is destroyed
  (`stage-02-transcripts.ts`, two copies).
- `top_comments` was cut from ~200 per channel to ~30 purely to save records. That was real data
  thrown away to fit a quota.

**And the $54/month.** Replacement hosting runs $6 to $20/month depending on the option in §3.

---

## 2. The good news: the data model is already relational

This was the biggest open risk and it came back clean. Across all five repos:

- **No rollups.** Zero.
- **No lookups.** The three that were wanted are already hand-denormalized into plain columns,
  because Airtable's API can't create them.
- **No attachments.** Deliberately rejected (signed URLs expire, so archives would rot).
- **No views used in code.** A human review view exists, but nothing queries it.
- **No autonumber.**
- **Three formula fields, and no application code reads any of them.** They exist for humans
  browsing the UI. Outlier flags are recomputed in TypeScript anyway.

Translation: there's no Airtable magic to reverse-engineer. The tables are already flat tables
with foreign keys. This is a port, not a redesign.

The one genuinely Airtable-shaped thing is **linked-record fields** in the enrichment and
per-client bases, written as `field: [recXXXX]`. Those become ordinary foreign-key columns, and
the `[...]` wrapping and unwrapping disappears.

---

## 3. Where it runs

**The current VPS cannot absorb this as-is.** Measured today: 7.6 GB RAM with 5.8 GB used and
2.3 GB of swap already in use, and 22 GB of free disk against 6.0 GB of archives plus 2.5 GB of
bundles that already exist. The box is under memory pressure before adding anything.

Three options:

| Option | Cost/month | Notes |
|---|---:|---|
| **A. Separate small DB server** (recommended) | ~$6–12 | Hetzner CX22-class, 4 GB RAM / 40 GB disk. Isolates the database from the pipeline, so a runaway enrichment run can't starve it. Backups and resizing are independent. |
| B. Resize the current VPS | ~$12–25 extra | Simplest, one box to manage. But the database competes with the pipeline for RAM, and a pipeline crash takes the database's host with it. |
| C. Managed Postgres (Neon, Supabase) | $0–25 | No ops work. Free tiers have storage caps that this data will outgrow, which reintroduces the exact problem being solved. |

Recommendation is **A**. Even at the top of that range it's a third of the Airtable bill, and
keeping the database off the box that runs four concurrent sweeps is worth the separation on its
own.

Disk planning: budget 40 GB. Current live data is small (well under 1 GB), but the point of the
exercise is that nothing ever gets deleted, and there's 6 GB of historical archive to load.

### The review UI

This is the part that has nothing to do with code. `review_status` is set **by hand, in the
Airtable grid**. Raw Postgres has no UI, so that workflow needs a replacement before the lead
base can move.

**Use NocoDB.** The reason is specific: NocoDB can connect to an *existing external* Postgres
database and render a grid over tables it did not create. So the repos keep owning the schema
through migration files, and NocoDB is purely a viewer and editor on top. Baserow wants to own
its own schema, which would invert that relationship and make the database answer to the UI.
Self-hosted, free, and it can live on the same small DB server.

---

## 4. The two decisions that de-risk everything

### Decision 1: keep the Airtable record ids as the primary keys

Do **not** mint new ids. Airtable's `rec...` ids have leaked out of Airtable and are load-bearing
in four places:

1. **4,647 directories** named `enrichment-bundles/<recId>/`. Compose reads from these.
2. **1,805 JSON archives** (6.0 GB) with `rec...` ids embedded on every row.
3. **The A/B variant assignment** in `src/writer/variant.ts` is a SHA-256 hash of the record id.
   New ids would re-roll the arm for every unsent lead and corrupt the running experiment.
4. **Cross-repo CLI contracts**: the orchestrator passes `--lead-ids rec...` to the email repo.

So: `id TEXT PRIMARY KEY` holding the existing value, and new rows get `rec` plus 14 random
characters to match the format. This single choice makes the entire ID-migration problem
disappear, and every existing bundle directory and archive file stays valid with no renaming.

### Decision 2: preserve the existing client interfaces, don't rewrite call sites

There are roughly **360 Airtable call sites** across the five repos. Rewriting them individually
is the whole cost of the project. Almost all of it can be avoided, and the two repo families
need different treatment:

**Family A: the research repos** (`quick-youtube-channel-research-v1`,
`youtube-deep-research-v1`). These don't use the Airtable SDK at all. They use a hand-rolled
`AirtableClient` class in `src/lib/airtable.ts`, and every stage constructs one. Reimplement that
one class against Postgres with the same method signatures, and roughly **135 call sites migrate
for free.** One file per repo.

**Family B: the SDK repos** (`youtube-lead-finder-v1`, `youtube-email-outreach-v1`,
`youtube-outreach-orchestrator-v1`). These use `airtable@0.12.2` directly, in the shape
`base(table).select({filterByFormula}).all()` with `record.get('field')` and `record.id`. Write a
small compatibility layer exposing `select / create / update / find / all / firstPage / eachPage`
over Postgres. Most scripts then change only their import line.

The shim needs one real component: a **`filterByFormula` → SQL translator**. There are ~86
distinct formula strings, but the grammar in use is small: `AND OR NOT = != >= <=`, `BLANK()`,
`FIND()`, `LEFT()`, `LOWER()`, `NOW()`, `DATEADD()`, `DATETIME_DIFF()`, `DATETIME_FORMAT()`,
`IS_AFTER()`, `RECORD_ID()`, `ARRAYJOIN()`. That's a few hundred lines and it's the highest-
leverage thing in the whole project.

**One semantic trap to get right in the translator.** Airtable collapses "missing field", "null",
and "empty string" into one state. Postgres keeps them separate. So `{x} != ''` has to become
`x IS NOT NULL AND x <> ''`, not `x <> ''`. Every one of the ~86 formulas needs this checked, and
getting it wrong produces queries that silently return nothing.

Note the production paths are tiny, which is why this is tractable at all:

| Repo | Production call sites | Script call sites |
|---|---:|---:|
| orchestrator | 1 file, 8 functions | ~30 |
| email-outreach | **7**, behind one module | ~126 |
| lead-finder | ~17, behind 5 files | ~66 |
| quick-research | ~63 | ~29 |
| deep-research | ~72 | ~30 |

Roughly 40 of the email repo's scripts are read-only diagnostics (`check-*`, `count-*`,
`census-*`, `dump-*`). Those don't need porting at all. They become `psql` queries or get deleted.

---

## 5. Phasing

**Migrate by base, not by repo.** The repos share bases, so repo-by-repo would require dual-write
bridges. Base-by-base doesn't.

### Phase 0 — Infrastructure (~1 day)

Provision the DB server. Install Postgres 16 and NocoDB. Set up `pg_dump` to the existing restic
backup target. Create the schema-migration harness (plain numbered SQL files, no ORM). Add
`DATABASE_URL` to the shared env bank, and remember the Mac clobbers `~/env-storage/.env` every
two minutes, so this has to go in the Mac master, not appended VPS-side.

### Phase 1 — Enrichment base (~3–5 days) ← start here

`appTvzwOiTLmqC5Mw`, 12 tables, 100,548 rows. Touched by exactly two repos: quick-research writes
it, email-outreach reads and deletes from it.

This goes first for four reasons: it's the one that's actually 80% full; it's pure scratch data
with no human review workflow attached, so no UI is needed yet; it's only two repos; and it's
where nearly all the deletable code lives.

1. Port the 12-table schema. Real foreign keys with `ON DELETE CASCADE`, the 11 enum vocabularies
   as `CHECK` constraints or Postgres enums.
2. **Introspect the live base first, don't trust `airtable-schema.ts`.** Three fields exist in
   production that aren't in the schema file: `last_enriched_at`, `data_removed`,
   `bundle_archived`. There may be more.
3. Reimplement `quick-youtube-channel-research-v1/src/lib/airtable.ts` against Postgres.
4. Backfill: live base first, then the 6.0 GB of historical archives. Stream them; one archive
   file is 315 MB and the box has ~1.7 GB free.
5. Delete the cleanup machinery. `bank-rows.ts`, `push-bank-rows.ts`, the chunking columns, the
   purge scripts, the rollup consolidator, the systemd timer.
6. Remove the transcript truncation constant. Stop destroying long transcripts.

### Phase 2 — Lead base (~4–6 days)

`appenY7r5jlZMRpJ0`, 2 tables (`lead_candidates`, `search_terms`), 44,541 rows. Touched by all
four other repos, and it's the one with the manual review workflow.

1. Stand up NocoDB over the two tables and confirm the review workflow actually feels right
   before cutting over. **This is a product judgment, not a technical one.** If the grid is worse
   to work in than Airtable's, the whole plan needs revisiting.
2. Build the SDK shim and the formula translator (§4, Decision 2).
3. Cut all four repos over together, in one window. The finder, email repo, and orchestrator all
   read and write these tables, so there's no partial state that works.
4. Keep Airtable in place, read-only, for a week as a rollback path.

Watch out for two things here. The finder's `discovered_via` is a JSON array crammed into a text
field and read-modify-written on every duplicate hit, which is racy today across four concurrent
sweeps. Migration is the moment to make it a real array with an atomic append. And `upsertProspect`
is currently select-then-branch, which is a genuine race; it becomes
`INSERT ... ON CONFLICT (channel_id) DO UPDATE`.

Also: `typecast: true` currently lets an LLM invent a new `niche_category` and have Airtable
silently accept it. A strict Postgres enum will **reject** that, turning a silent write into a
crash in the sweeps. Use a text column with a lookup table and an explicit unknown-value path, or
this surfaces as production failures on day one.

### Phase 3 — Deep-research per-client bases (~2–3 days)

50 separate Airtable bases, one per client, all with the identical 11-table schema. No urgency
and no cap pressure, so this can wait.

Collapse to one schema with a `client_id` column. `clients.json` becomes a `clients` table.
`slugify()` survives unchanged. The 402-line `setup-airtable.ts` (three-phase field creation,
topological table ordering, unsupported-field-type detection, a rollback that returns 403 and
doesn't work) becomes a single `INSERT INTO clients`.

Bonus: `export-run.ts` currently loops over all 50 bases issuing an HTTP query to each when
`--client` isn't passed. That becomes one indexed lookup.

### Phase 4 — Long tail (ongoing)

The ~250 diagnostic script call sites. Port lazily, on demand. Delete the ones that were
one-offs. Many collapse into `psql` one-liners once real `GROUP BY` exists.

---

## 6. Honest total

**Roughly two to three weeks of focused work**, and it can't safely be compressed much because
Phase 2's cutover is all-or-nothing across four repos.

Against that: $54/month becomes ~$6–12/month, the cap goes away permanently, ~2,900 lines of
workaround code gets deleted, and two silent data-loss bugs stop.

The deadline is set by the lead base filling up somewhere between early October and early
December 2026. Phase 1 is more urgent than that number suggests, because the enrichment base is
at 80% today and only stays there because a timer keeps deleting from it.

---

## 7. Risks worth naming

| Risk | Severity | Mitigation |
|---|---|---|
| NocoDB's grid is worse for manual review than Airtable's | **High** | Test it in Phase 2 step 1, before any cutover. This is the one that could kill the plan. |
| Phase 2 cutover breaks a repo mid-flight | High | Do it during a halt-flag pause. Keep Airtable read-only for a week. |
| `!= ''` null-semantics bug in translated formulas | Medium | Silent, returns empty sets. Needs a test per formula, not a spot check. |
| Enum rejection where `typecast` used to absorb bad values | Medium | Text + lookup table, not a strict enum. |
| Backfill misses history split across live base, archives, and bundles | Medium | Reconcile all three. Note truncated transcripts are already unrecoverable. |
| The DB box becomes a new single point of failure | Medium | `pg_dump` into the existing restic target from day one, not later. |
| Nobody actually knows the current cap | Low | Three different numbers appear in three docs (10k, 50k, 125k). The 125,000 figure is what the live base measures against and matches the Airtable Business plan. |

---

## 8. Open decisions for Casey

1. **Where does it run?** Option A (separate ~$6–12/month DB server) is the recommendation.
2. **Is NocoDB an acceptable replacement for the Airtable grid** for manual review? Worth
   standing one up over a copy of the data before committing to anything else.
3. **Phase 1 only, or the whole thing?** Phase 1 alone solves the urgent problem, deletes the most
   code, and doesn't touch the review workflow. It's a legitimate stopping point. But Airtable
   still costs $54/month until Phase 2 lands.
4. **What happens to the 6.0 GB of historical archives?** Load them into Postgres as permanent
   history, or leave them as cold files on disk and only migrate live data?
