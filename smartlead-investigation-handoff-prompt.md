# Handoff — SmartLead "nothing is sending" investigation + downstream changes (2026-06-01)

**Paste this into a Claude Code session opened in `youtube-outreach-orchestrator-v1`.**

On 2026-06-01 a deep-dive was done across the two downstream repos you drive
(`youtube-email-outreach-v1` and `quick-youtube-channel-research-v1`) after Casey
reported SmartLead "wasn't sending anything." This brings you up to date on what
was actually wrong, what was fixed, and what's still open. Update your operational
docs (`system-overview.md`, `CLAUDE.md`) to match, and act on the open items.

---

## TL;DR

- **SmartLead was never broken. It was sending the whole time.** The screens Casey
  looked at were stale caches. Real sends were confirmed at the per-lead message
  level (180 emails sent on Mon Jun 1).
- The genuine problems were elsewhere and are now fixed or scoped: a stale repo
  path that had killed scheduled ticks, an enrichment-repo crash, 13 sent leads
  missing their SmartLead id, and 44 leads stuck terminal only because of YouTube
  API quota/suspension.
- Several facts about how the system actually behaves need to be baked into your
  model (schedule, `last_contacted_at` pollution, where new volume comes from).

---

## 1. The false alarm — and how to actually verify sends

- **Symptom:** SmartLead "Sent" master inbox showed last activity May 29; the
  in-app "Ask AI" assistant said "0 emails sent today."
- **Reality:** 180 emails were sent Mon Jun 1, confirmed via per-lead
  `message-history` (`type=SENT` timestamps, e.g. a lead emailed 11:20am ET) and
  the live `/campaigns/{id}/statistics` + `/analytics` endpoints.
- **Why the screens lied:** the master inbox is an IMAP sync labeled "syncs every
  1-2 hours" and was stuck around May 29; the "Ask AI" assistant queries a cached
  `analytics_summary` table that is not real-time.
- **To check real send volume:** run `youtube-email-outreach-v1/scripts/sl-sent-per-day.ts`
  (buckets actual `sent_time` per day across all campaigns). Do **not** trust the
  SmartLead master inbox or Ask-AI for this.

## 2. Confirmed system facts (bake these into your model)

- **Send schedule (all 16 campaigns):** Mon-Thu, 09:00-15:00 America/New_York.
  `scheduler_cron_value.days = [1,2,3,4]`. So Fri/Sat/Sun send **0 by design** —
  that's why a weekend looks dead but isn't. Friday is also excluded, which may be
  unintentional.
- **Throughput ceiling:** 6-hour window, Mon-Thu only, `max_leads_per_day=25` per
  campaign, mailbox `message_per_day=15`, 12 mailboxes/campaign. A weekend import
  dump (e.g. 176 leads on a Saturday) queues for days. **Import != send.**
- **`last_contacted_at` is polluted.** It was historically backfilled from
  `outreach_processed_at` (which updates on *every* Airtable write), so ~156
  non-sent leads carry a bogus `last_contacted_at`. CRITICAL: the outreach pipeline
  selects leads by `review_status` + `outreach_status` only and **never reads
  `last_contacted_at`** — so it has zero effect on sending, and it is not a reliable
  "we contacted them" signal right now. Going-forward stamping on push-success is
  correct (per the earlier handoff); the historical backfill is the pollution.
- **Airtable data state** (`lead_candidates`, base `appenY7r5jlZMRpJ0`), 2026-06-01:
  3,139 total. `review_status`: approved 777, no_host_identified 1149,
  below_threshold 455, demo_niche_excluded 340, unreviewed 268, rejected 144, D100 6.
  Of the 777 approved: ~503 `sent_to_smartlead` (all now have a `smartlead_lead_id`),
  ~252 terminal failures, ~19 in flight. **The approved pipeline is essentially
  drained.** More email volume comes from reviewing the **268 unreviewed** leads
  (Casey's action in the lead-finder), not from re-running outreach.
- **Terminal failures among approved:** 86 `no_email_found`, 133 `email_invalid`,
  35 `failed` (33 of those = `host_name_low_confidence`). 44 of these failed purely
  on YouTube quota/block errors and were retryable (see §4).

## 3. Changes made in the downstream repos

### youtube-email-outreach-v1
- **YouTube backend rewrite** — branch `youtube-direct-keys-first` (commit `809ea6f`,
  pushed to origin, **not merged to main**). `YOUTUBE_API_BACKEND` now defaults to
  `auto`: use direct `YOUTUBE_API_KEY[_N]` keys first (rotating past both
  quota-exhausted AND project-suspended keys), fall back to RapidAPI only when all
  direct keys are dead. Modes: `auto` / `direct` / `rapidapi`. Added
  `scripts/youtube-key-health.ts` (probes each key, redacts the key value).
  - **LANDMINE:** `.env` is set to `YOUTUBE_API_BACKEND=auto`, but the code that
    understands `auto` exists **only on the `youtube-direct-keys-first` branch**.
    The repo is currently checked out on that branch. If anyone checks out `main`
    with this `.env`, `resolveBackend()` will throw ("must be rapidapi or direct")
    and every outreach run fails at preflight. Keep the repo on this branch, merge
    it to main, or set `YOUTUBE_API_BACKEND=rapidapi` when on main.
  - Key health 2026-06-01: 6 of 20 unique direct keys WORKING, 14 BLOCKED-SUSPENDED.
    Re-run the tester every ~2 days; suspensions can be reinstated.
- **New diagnostic/maintenance scripts (UNCOMMITTED in working tree):**
  `scripts/sl-sent-per-day.ts`, `scripts/backfill-smartlead-lead-ids.ts`,
  `scripts/reset-youtube-quota-failures.ts`.

### quick-youtube-channel-research-v1 (enrichment repo)
- **Fixed an enrichment-export crash (UNCOMMITTED):** `renderBankMarkdown` in
  `src/lib/pipeline/examples-bank.ts` iterated `it.data.steps`, which the model
  sometimes returns as a non-array → `TypeError: it.data.steps is not iterable`
  killed the whole bundle export. Now coerces to an array. Confirmed fixed by a
  live enrichment run.
- **NOTE:** this repo has its **own** YouTube backend (separate from
  youtube-email-outreach-v1's). It was NOT touched and may still hit RapidAPI
  quota. If enrichment fails on YouTube 403s, that's the next fix here.

### Infra
- The launchd cron had been failing every scheduled tick on a **stale
  `ENRICHMENT_REPO_PATH`** (old-Mac path `/Users/casey/Documents/_Stuff/Claude/...`).
  The outreach repo's `.env` is now corrected to
  `/Users/caseybrown/Claude/quick-youtube-channel-research-v1` (exists).
- **Scheduled ticks are now OFF (manual-only), per Casey.** The launchd agent is
  unloaded and the plist is renamed `.disabled`. Reason: the Mac is usually off or
  the repo closed at scheduled tick times. Run ticks manually. **Do not re-enable
  the 4-hour cron unless Casey says so.**

## 4. Airtable mutations performed (production writes)

- Backfilled `smartlead_lead_id` on **13** leads (looked up by email in SmartLead).
  All ~503 `sent_to_smartlead` leads now have an id. Wrote only that field via the
  raw client (no `outreach_processed_at` side effect).
- Reset **44** terminal YouTube-quota-failure leads to `pending` and cleared
  `outreach_error`. Re-ran find+verify → **15 recovered a valid email**. Ran the
  full enrich→compose→push on those 15 (1 confirmed sent with a high-quality,
  on-channel email; the remaining 14 were processing in the background as of this
  handoff). The other 29 stayed terminal (genuinely no valid email / no host).

## 5. Open items / decisions (none of these are done)

1. **Schedule:** decide whether to add Friday and/or raise `max_leads_per_day` to
   drain backlog. Changing it sends real email — needs Casey's explicit yes.
2. **Redrive `last_contacted_at` cleanly** (from SmartLead `sent_time`; clear for
   never-sent leads). 156 are polluted.
3. **Merge or discard `youtube-direct-keys-first`** and resolve the `.env` landmine.
4. **Commit** the uncommitted scripts + the `examples-bank.ts` fix.
5. **Check the enrichment repo's own YouTube backend health** (RapidAPI quota).
6. **More volume = review the 268 unreviewed leads** (Casey, in the lead-finder).

## 6. What to do in this orchestrator session

- Update `system-overview.md` / `CLAUDE.md` to capture: manual-only ticks; the
  YouTube-backend branch + `.env` landmine; the `last_contacted_at` pollution
  caveat; and that real send volume is verified via `sl-sent-per-day.ts`, not the
  SmartLead UI/AI.
- Keep delegating outreach to `youtube-email-outreach-v1` via `npm run outreach`
  (useful flags: `--lead-ids-file`, `--stop-after find|verify|enrich|compose|push`,
  `--concurrency`, `--dry-run`).
- Do not re-enable the cron.
