# Enrichment Run Handoff — how to run & report a 100-lead batch

**Audience:** the model (or person) picking up the **next** batch of lead enrichments.
**Written:** 2026-07-18, after the first probe batch of 100 completed.
**Your job in one line:** enrich the next N leads-that-already-have-email through Quick-mode research, **park them (never send)**, and report back in the exact format in §5.

This doc is the operating contract for repeated enrichment batches. Read §1 (constraints) and §5 (report format) before doing anything. The deep per-stage cost teardown + reduction levers live in a companion doc — [enrichment-anthropic-cost-analysis.md](enrichment-anthropic-cost-analysis.md) — don't duplicate it, reference it.

---

## 0. TL;DR runbook

1. **Pause the autopilot campaign** so the shared RapidAPI key isn't contaminated mid-run (§4.3).
2. **Select the next 100** `email_verified` leads that aren't enriched yet, write their record ids to an ids file (§3).
3. **Record the start time**, then shell out from `youtube-email-outreach-v1`:
   `npm run outreach -- --lead-ids-file <abs-path> --concurrency 4 --stop-after enrich` (§3).
4. When it finishes, **record the end time** and gather the three metrics from the per-lead logs + the RapidAPI meter (§4).
5. **Restore the autopilot campaign** (§4.3).
6. **Report** time / Anthropic $ / YouTube credits in the §5 format, then **stop** and wait for a green light before the next batch.

---

## 1. Standing constraints (non-negotiable)

- **Nothing sends. Ever.** Enrichment stops at the data. `--stop-after enrich` is mandatory — it parks each lead at `outreach_status = ready_data_scraped` and never composes or pushes to SmartLead. Do not remove that flag, and do not run `npm run send`.
- **Enriching does not make a lead sendable.** These leads are `review_status = approved_hold`; the send path requires `review_status = approved`. Enrichment leaves `review_status` untouched, so a parked lead stays un-sendable by construction. Good — that's the safety.
- **Don't touch the enrichment repo.** `quick-youtube-channel-research-v1` is marked *locked, don't touch* in the orchestrator CLAUDE.md. Cost-cutting ideas (§6) are a **menu to propose**, not changes to make without Casey's explicit approval.
- **Never edit or commit `.env` / secrets** in any repo.
- **Don't retry inside the run.** Failed leads stay at `email_verified` and are re-runnable next batch (§7). Log the failures, move on.

---

## 2. Reference run — the first 100 (measured baseline)

This is what "normal" looks like. Use it to sanity-check the next batch and to explain the numbers.

| Metric | Result | Per lead |
|---|---|---|
| **Wall time** | **7 h 47 m** (28,040 s) @ `--concurrency 4` | ~4.7 min throughput / ~15–19 min each |
| **Anthropic cost** | **$13.50** ($13.4951) | **$0.138** |
| **YouTube units** (Google-equivalent) | **224,452** | 2,290 (min 1,346 / max 2,557) |
| **Outcome** | 98/100 enriched & parked at `ready_data_scraped`; 2 crashed | — |

**Free vs. paid YouTube split (matters — see §4.2):**
- 7 free direct Google keys **exhausted ~37 min in** → only **~21 channels ran fully free**; the other **79 spilled to paid RapidAPI**.
- RapidAPI **search bucket 4,708 → 3,685 = ~1,023 search calls** for this one batch (~20% of the **5,000/window** search bucket — the tight one).
- Direct-key pool under-delivered (~48k units before dying vs. ~70k theoretical) → **some of the 7 keys are blocked/pre-drained; worth auditing.**

**The one-sentence verdict to keep repeating:** *Anthropic cost is trivial (~$13.50/batch); the real cap is the RapidAPI **search** bucket — ~1,000 search calls per 100 leads means the 5,000 bucket is gone in ~5 batches.* That's the finding that governs how fast we can enrich.

> ⚠️ Note on the companion doc: [enrichment-anthropic-cost-analysis.md](enrichment-anthropic-cost-analysis.md) estimated **$0.09/lead** from 70 older/smaller runs *before* this batch ran. The **measured** number is **$0.138/lead** — bigger channels than the old sample. Treat $0.138 as the working baseline; the companion doc is still correct on *where* the cost comes from and how to cut it.

---

## 3. Select and run the next batch

### 3.1 The queue

The enrichment queue = leads with a verified email that aren't enriched yet:

```
AND({review_status}='approved_hold', {outreach_status}='email_verified')
```

As of 2026-07-18 this pool was **~2,376** (and grows as the autopilot finds more). Already-enriched leads (`outreach_status='ready_data_scraped'`) are automatically excluded because enrichment flips them off `email_verified`, so **you can re-run this selection every batch and never double-process.**

> `email_verified` = an email was found AND ZeroBounce returned valid-or-risky. `--lead-ids-file` fetches records by id directly, bypassing the normal `review_status='approved'` filter, so `approved_hold` leads process fine.

### 3.2 Build the ids file

Write the next 100 record ids (newline-separated) to a scratch file. Node snippet (run from the orchestrator repo root so `node_modules`/`.env` resolve — the scratchpad has neither; if you write the script elsewhere, copy it into a repo root first):

```js
// _make_ids.mjs  — run: node _make_ids.mjs > batch.ids ; then delete the script
import 'dotenv/config';
import Airtable from 'airtable';
import { writeFileSync } from 'node:fs';
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.LEAD_BASE_ID);
const LIMIT = 100;
const recs = await base(process.env.LEAD_TABLE_NAME ?? 'lead_candidates')
  .select({ filterByFormula: `AND({review_status}='approved_hold', {outreach_status}='email_verified')`, fields: ['channel_name'] })
  .all();
writeFileSync('batch.ids', recs.slice(0, LIMIT).map(r => r.id).join('\n') + '\n');
console.error(`wrote ${Math.min(LIMIT, recs.length)} ids of ${recs.length} in queue`);
```

Put `batch.ids` somewhere stable (the session scratchpad is fine as a *storage* location; just generate it from a repo root). Use the **absolute path** in the next step.

### 3.3 Run it

From **`youtube-email-outreach-v1`** (its `.env` has the API keys the enrichment children inherit):

```bash
cd $EMAIL_OUTREACH_REPO_PATH   # /home/casey/repos/youtube-email-outreach-v1
npm run outreach -- \
  --lead-ids-file /abs/path/to/batch.ids \
  --concurrency 4 \
  --stop-after enrich \
  2>&1 | tee logs/enrich-batch-$(date +%Y%m%d-%H%M).log
```

- `--concurrency 4` is the proven setting (the 100-batch ran at 4). Don't raise it blindly — it multiplies pressure on the shared YouTube quota.
- The `tee`'d batch log gives you clean start/end timestamps and the top-level exit. Each lead ALSO writes its own file: `youtube-email-outreach-v1/logs/enrichment-<leadId>-<ts>.log`, containing `Total LLM cost: $X` and `Total YouTube quota used: N units` — those per-lead files are what you aggregate in §4.
- This is a long run (~7–8 h for 100). Launch it in the background and monitor; don't block on it.

---

## 4. Gather the three metrics

### 4.1 Anthropic $ and YouTube units — from the per-lead logs

Every successful lead prints two lines to its `enrichment-<leadId>-<ts>.log`:
```
  Total YouTube quota used: 2090 units
  Total LLM cost: $0.1222
```
Sum them **only over this batch's lead ids** (match by id so you never pick up a neighbouring run). Aggregator (run from a repo root):

```js
// _agg.mjs  — run: node _agg.mjs /abs/path/to/batch.ids
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const LOGDIR = '/home/casey/repos/youtube-email-outreach-v1/logs';
const ids = new Set(readFileSync(process.argv[2], 'utf8').split('\n').map(s => s.trim()).filter(Boolean));
let usd = 0, units = 0, ok = 0, missing = [];
for (const id of ids) {
  const f = readdirSync(LOGDIR).filter(n => n.startsWith(`enrichment-${id}-`)).sort().pop();
  if (!f) { missing.push(id); continue; }
  const t = readFileSync(join(LOGDIR, f), 'utf8');
  const c = t.match(/Total LLM cost: \$([0-9.]+)/); const q = t.match(/Total YouTube quota used: (\d+) units/);
  if (c && q) { usd += +c[1]; units += +q[1]; ok++; } else { missing.push(id); }
}
console.log(`succeeded: ${ok}/${ids.size}   failed/no-metrics: ${missing.length}`);
console.log(`Anthropic: $${usd.toFixed(4)}  ($${(usd/ok).toFixed(4)}/lead)`);
console.log(`YouTube:   ${units} units  (${Math.round(units/ok)}/lead)`);
if (missing.length) console.log('no-metrics ids (crashed — re-run next batch):', missing.join(', '));
```

Crashed leads print no totals → they land in `missing` and cost ~nothing. That's your failure list for §7.

### 4.2 Free vs. paid YouTube split — from the RapidAPI meter

The YouTube backend is `auto`: it burns the **free** direct Google keys first, then spills to **paid** RapidAPI. To measure the split:

- **Capture the RapidAPI meter before and during the run.** Read `youtube-lead-finder-v1/logs/quota-state.json` — the `search` bucket (`remaining`/`limit`, limit 5,000) is the tight one. **Snapshot it right before you start** and again right after; the delta is your paid search-call count. *The `search` bucket resets on RapidAPI's rolling window, so a delta read hours later is meaningless — capture it around the run.* (If the campaign is paused per §4.3, the delta is almost entirely your batch.)
- **Find the free→paid handoff** by grepping the per-lead logs for the first direct-key-exhaustion / RapidAPI-fallback line, and note roughly how many channels ran before it (the first batch: ~21 free, handoff ~37 min in, 79 paid).
- If you want an independent meter read, a `channels.list` probe against `youtube-data-api-v33.p.rapidapi.com` returns the same `x-ratelimit-search-remaining` header.

### 4.3 Keep the meter clean — pause the autopilot for the run

Two always-on systemd loops share the same RapidAPI key and will pollute the meter delta:

```bash
# BEFORE the run — halt the campaign (either the halt flag or stop the unit):
touch /home/casey/repos/youtube-outreach-orchestrator-v1/logs/autopilot-halt.flag
sudo systemctl stop autopilot-campaign.service   # passwordless sudo is available

# AFTER the run — restore it and confirm it's back:
rm -f /home/casey/repos/youtube-outreach-orchestrator-v1/logs/autopilot-halt.flag
sudo systemctl restart autopilot-campaign.service
systemctl is-active autopilot-campaign.service    # expect: active
```

`graph-sweep.service` also touches the key; on the first batch it was left running (its contribution was small). If you want a *perfectly* clean search-bucket delta, stop it too and restart it after — otherwise just note it as minor contamination. **Always restore whatever you stopped.**

---

## 5. Report format (this is how Casey wants it reported)

Report as text, in this shape. Lead with the three numbers Casey actually asked for — **time, Anthropic cost, YouTube credits** — then the split, the outcome, and the one-line sustainability verdict. Fill the bracketed values from §4.

```
## Enrichment batch <N> — <M> leads

98/100 enriched and parked at `ready_data_scraped`. Nothing composed or sent.   ← state the send-safety plainly, every time.

| Metric          | Result                                  | Per lead |
|-----------------|-----------------------------------------|----------|
| Time            | <Hh Mm> @ concurrency 4                  | ~<x> min |
| Anthropic cost  | $<total>                                 | $<avg>   |
| YouTube units   | <total>                                  | <avg>    |

Free vs. paid: ~<k> channels ran free on direct Google keys; <j> spilled to RapidAPI.
RapidAPI search bucket: <before> → <after> = <delta> search calls (~<pct>% of the 5,000 bucket).

Failures: <count> — <lead names/ids> (still at email_verified, re-runnable next batch).

Verdict: <one line — is the pace sustainable against the RapidAPI search bucket?>
```

**Rules for the report:**
- **Always compare to the §2 baseline.** If a number drifts a lot (e.g. Anthropic > $0.20/lead, or search-bucket burn > ~1,200/batch), call it out and say why (bigger channels? more paid spill?).
- **Always answer the sustainability question**, because it's the whole reason we're probing 100 at a time: *at this burn, how many batches until the 5,000 search bucket is exhausted, and is that acceptable?*
- **Don't send anything, don't propose sending, don't run cleanup.** The report ends the batch. Wait for a green light before the next one.

---

## 6. Cost & the real constraint (context for the report)

- **Anthropic is not the bottleneck.** ~$0.138/lead → ~$13.50 per 100 → ~$405/mo if you ran 100/day. Cheap, and reducible ~40–70% if we ever want to (see the levers in [enrichment-anthropic-cost-analysis.md](enrichment-anthropic-cost-analysis.md) §6).
- **The YouTube search quota IS the bottleneck.** ~1,000 RapidAPI search calls per 100 leads against a 5,000 bucket = only ~5 batches before it's dry, and the free direct-key pool only covers ~20/batch before exhausting. **This is what actually caps enrichment throughput** — surface it in every report.
- **The single highest-leverage change** (proposal, not to be done without approval): the competitor stages (Stage 09 discovery + Stage 10 harvest) are ~86% of the YouTube units *and* a large share of Anthropic cost, and Stage 11 (their only consumer) is already skipped in Quick mode — so they may be vestigial for cold-email enrichment. Gating them off behind a flag would fix the quota wall *and* most of the cost. **Verify nothing downstream reads competitor data first** (companion doc §8 Q1), then propose it as an A/B.

---

## 7. Failure handling

- Crashed leads (no `Total LLM cost` line, non-zero child exit — e.g. the first batch's `recZUef3bYIkSmmlw` / Amy Plano and `reciKMvvTGJ7iXFkY` / The Adviser Advantage) **stay at `email_verified`**, so the §3.1 selection re-picks them automatically next batch. No manual reset needed. If a specific lead crashes repeatedly, flag it for Casey rather than looping on it.
- A whole-run hard failure (finder/quota/Airtable down) → stop, report what completed, don't force it.
- **Idempotency:** a lead already at `ready_data_scraped` is skipped by the queue query, so re-running the batch selection never re-drives a done lead. Safe to re-run.

---

## 8. Quick reference

| Thing | Where |
|---|---|
| Run command | `youtube-email-outreach-v1` → `npm run outreach -- --lead-ids-file <f> --concurrency 4 --stop-after enrich` |
| Enrichment queue query | `AND({review_status}='approved_hold', {outreach_status}='email_verified')` on `lead_candidates` (`appenY7r5jlZMRpJ0`) |
| Per-lead metrics | `youtube-email-outreach-v1/logs/enrichment-<leadId>-<ts>.log` → `Total LLM cost` / `Total YouTube quota used` |
| RapidAPI meter | `youtube-lead-finder-v1/logs/quota-state.json` (`search` bucket = the tight one, 5,000) |
| Autopilot control | halt flag `logs/autopilot-halt.flag` + `sudo systemctl stop/restart autopilot-campaign.service` |
| Deep cost teardown + levers | [enrichment-anthropic-cost-analysis.md](enrichment-anthropic-cost-analysis.md) |
| Parked-status meaning | `ready_data_scraped` = enriched, ready-but-NOT-sent; `review_status` stays `approved_hold` |
