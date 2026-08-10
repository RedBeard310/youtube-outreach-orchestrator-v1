// CAMPAIGN DRIVER (#1 + #3, 2026-07-09) — the relentless, autonomous run session.
//
// A thin COORDINATION loop (no business logic — all intelligence lives in the
// finder + email repos). It drives one big `approved_hold` push end-to-end:
//
//   pre-flight: check the fresh-term reservoir; if short, generate probe veins.
//   loop until target parked OR a hard wall:
//     • run the finder for one pass
//     • OVERLAP verify (#1): verify the accumulating pitchable pool while the NEXT
//       finder pass runs — the two never wait on each other
//     • if the vein is fading (few fresh pitchable leads), invent + probe new veins
//       (#3) instead of grinding the same terms
//   finish: final verify sweep → promote verified → approved_hold (which itself
//     auto-sweeps dead-email leads into needs_contact)
//
// "Relentless" = it does not stop on low yield; it pivots (discovery). It stops
// only on the target, a run cap, or a hard wall (finder exiting nonzero twice in a
// row — quota/keys exhausted, Airtable down). Every decision is logged to
// logs/campaign-<date>.jsonl.

import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { driveLeadFinder } from './lead-finder.ts';
import { runChild, runChildCapture } from '../run.ts';
import { countByReviewStatus, getVerifiablePitchableLeads } from '../airtable.ts';
import { writeTickLog } from '../logger.ts';

export interface CampaignOpts {
  target: number;          // leads to park in approved_hold this session
  maxRuns: number;         // hard cap on finder passes (safety)
  topN: number;            // terms per finder pass
  reservoirRuns: number;   // pre-flight: fresh terms should cover this many runs
  fadeThreshold: number;   // fresh pitchable/run below this => vein fading => discover
  discoveryCount: number;  // probe veins to generate when fading / under-stocked
  discovery: boolean;      // enable adaptive discovery
  maxMinutes: number;      // wall-clock budget; stop starting new passes past this (0 = unlimited)
  llmCap?: number;         // per-pass finder LLM budget (channels scored); higher = more leads/pass
  concurrentPasses: number;// finder passes to run in parallel over disjoint term slices (1 = sequential)
  frontier: boolean;       // discovery runs in frontier mode (explore un-mined verticals)
  dryRun: boolean;
}

function log(line: Record<string, unknown>): void {
  const stamp = new Date().toISOString();
  mkdirSync('logs', { recursive: true });
  const file = join('logs', `campaign-${stamp.slice(0, 10)}.jsonl`);
  appendFileSync(file, JSON.stringify({ ts: stamp, ...line }) + '\n');
}

function finderRepo(): string {
  const p = process.env.LEAD_FINDER_REPO_PATH;
  if (!p) throw new Error('LEAD_FINDER_REPO_PATH is not set');
  return p;
}
function emailRepo(): string {
  const p = process.env.EMAIL_OUTREACH_REPO_PATH;
  if (!p) throw new Error('EMAIL_OUTREACH_REPO_PATH is not set');
  return p;
}

// --- YouTube quota governor (#4, 2026-07-10) ---
// The finder writes the latest RapidAPI quota snapshot to its logs/quota-state.json
// after each metered call. We read it BEFORE launching a pass so a long autonomous
// session can throttle/stop itself instead of draining the day's quota unattended
// (2026-07-10 hit 99.9% of the RapidAPI cap because nothing governed across passes).
// Returns the WORST (highest) used-% across buckets, or null if no snapshot yet
// (e.g. still on direct keys, which are the cheap-preferred path and self-abort).
function readFinderQuotaUsedPct(): number | null {
  try {
    const raw = readFileSync(join(finderRepo(), 'logs', 'quota-state.json'), 'utf8');
    const snap = JSON.parse(raw) as { ts?: string } & Record<string, { used_pct?: number }>;
    // STALENESS GUARD: a snapshot older than QUOTA_STALE_MINUTES is meaningless —
    // e.g. last night's 99.9% still on disk at 00:07 after the midnight quota reset,
    // when the finder is back on fresh direct keys and hasn't rewritten it yet.
    // Ignoring it prevents the governor from falsely hard-stopping a fresh run.
    const staleMin = Number(process.env.QUOTA_STALE_MINUTES ?? 90);
    const ts = typeof snap.ts === 'string' ? Date.parse(snap.ts) : NaN;
    if (Number.isFinite(ts) && (Date.now() - ts) / 60000 > staleMin) return null;
    const pcts = Object.values(snap)
      .map((v) => (v && typeof v === 'object' ? v.used_pct : undefined))
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    return pcts.length ? Math.max(...pcts) : null;
  } catch {
    return null; // no snapshot / unreadable → governor inactive
  }
}
function quotaSoftPct(): number {
  const n = Number(process.env.YT_QUOTA_SOFT_PCT ?? 80);
  return Number.isFinite(n) ? n : 80;
}
function quotaHardPct(): number {
  const n = Number(process.env.YT_QUOTA_HARD_PCT ?? 95);
  return Number.isFinite(n) ? n : 95;
}

// Verify the currently-pitchable pool (score>=6 unreviewed, no resolved email yet)
// via the email repo's `--stop-after verify`. Returns the IDs it touched so the
// caller can accumulate them for the final promote. Runs concurrently with the
// next finder pass (#1).
async function verifyPending(opts: CampaignOpts, seen: Set<string>): Promise<number> {
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would query pitchable pool and verify via ${emailRepo()} (npm run outreach -- --stop-after verify)`);
    return 0;
  }
  const leads = await getVerifiablePitchableLeads();
  const ids = leads.map(l => l.id);
  for (const id of ids) seen.add(id);
  if (ids.length === 0) return 0;

  mkdirSync('logs', { recursive: true });
  // ABSOLUTE path — this file is read by a child process whose cwd is the EMAIL
  // repo, not here. A relative 'logs/...' path resolves against the child's cwd and
  // ENOENTs (the bug that zeroed the 2026-07-09 run). resolve() anchors it to the
  // campaign's own cwd (the orchestrator repo).
  const idsFile = resolve('logs', `verify-pool-${Date.now()}.txt`);
  writeFileSync(idsFile, ids.join('\n') + '\n');

  // Verify concurrency 8 default (was 4): 2 concurrent finders out-produce a single
  // concurrency-4 verify lane, so the pitchable pool backs up (2026-07-10). 8 drains
  // it as fast as the finders fill it; same total ZeroBounce credits, just faster.
  const args = ['run', 'outreach', '--', '--stop-after', 'verify', '--lead-ids-file', idsFile,
    '--concurrency', process.env.APPROVED_CONCURRENCY ?? '8'];
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would verify ${ids.length} pitchable leads: npm ${args.join(' ')}`);
    return ids.length;
  }
  console.log(`[campaign] verifying ${ids.length} pitchable leads (overlapped with next finder pass)…`);
  const r = await runChild('npm', args, emailRepo());
  if (r.exit_code !== 0) console.error(`[campaign] verify exited ${r.exit_code} (non-fatal; leads retry next pass)`);
  return ids.length;
}

// Promote everything verified in the pitchable pool so far → approved_hold (the
// promote child also auto-sweeps dead-email leads into needs_contact). Idempotent:
// it only flips rows currently at outreach_status=email_verified, so re-running
// across passes is safe and cheap. No-op until at least one lead has been seen.
async function promoteSeen(opts: CampaignOpts, seen: Set<string>): Promise<void> {
  if (seen.size === 0) return;
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would promote verified leads → approved_hold (${seen.size} in pool, auto-sweeps needs_contact)`);
    return;
  }
  mkdirSync('logs', { recursive: true });
  // ABSOLUTE — read by the promote child running in the EMAIL repo (see idsFile note).
  const allIds = resolve('logs', `campaign-pitchable-${new Date().toISOString().slice(0, 10)}.txt`);
  writeFileSync(allIds, [...seen].join('\n') + '\n');
  console.log(`[campaign] promoting verified leads → approved_hold (auto-sweeps needs_contact)…`);
  const r = await runChild('npx', ['tsx', 'scripts/promote-verified-to-hold.ts', allIds], emailRepo());
  log({ event: 'promote', exit: r.exit_code, pool_size: seen.size });
}

// Ask the finder to invent + write a batch of probe veins (adaptive discovery).
// In frontier mode it explores un-mined verticals instead of re-mining the
// saturated core (the 2026-07-09 lesson: re-mining yields ~0 net-new terms).
async function discover(opts: CampaignOpts, focus?: string): Promise<void> {
  const args = ['tsx', 'scripts/discover-veins.ts', '--count', String(opts.discoveryCount), '--apply'];
  if (opts.frontier) args.push('--frontier');
  else if (focus) args.push('--focus', focus);
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would discover veins: npx ${args.join(' ')}`);
    return;
  }
  console.log(`[campaign] restocking — inventing ${opts.discoveryCount} probe veins${opts.frontier ? ' [FRONTIER]' : focus ? ` (focus: ${focus})` : ''}…`);
  const r = await runChild('npx', args, finderRepo());
  log({ event: 'discover', frontier: opts.frontier, focus: focus ?? null, exit: r.exit_code });
}

// Industrialised Keyword Layer (2026-07-14). Mine REAL search strings from YouTube +
// Google autocomplete and write the ICP-prefiltered survivors as probes, via the
// finder's scripts/keyword-harvest.ts. This is the durable answer to term-drought:
// unlike discover() — one LLM call that reconverges on its own priors (the root
// cause of the drought) — the harvest pulls demand-verified autocomplete tails the
// generator would never imagine. The module + CLI already existed and were proven by
// hand on 07-13 (933 net-new terms / 260 probes → the +166 recovery day); this just
// wires it into the autonomous loop so it self-refills instead of needing a human.
//
// It is HEAVIER than an LLM call (hundreds of free autocomplete requests + a Haiku
// prefilter), so it is CADENCE-GATED: at most once per KEYWORD_HARVEST_INTERVAL_HOURS
// (default 4). Between harvests the reservoir gate falls through to the fast discover()
// below. The expensive part is not the harvest (autocomplete is free, prefilter a few
// cents) but TESTING the probes it writes (100 units/search) — that is already bounded
// by the quota governor, so a generous cap is safe. State lives in the campaign's cwd.
function harvestStatePath(): string {
  return join('logs', 'keyword-harvest-state.json');
}
function blockStatePath(): string {
  return join('logs', 'autocomplete-block-state.json');
}
// Persist "we just observed a live 403 block" with a timestamp. Called whenever a block
// marker is detected in a session log (see autocompleteBlocked below).
function markAutocompleteBlocked(atMs?: number): void {
  try {
    mkdirSync('logs', { recursive: true });
    const ts = new Date(atMs ?? Date.now()).toISOString();
    writeFileSync(blockStatePath(), JSON.stringify({ last_seen: ts }) + '\n');
  } catch { /* best-effort; the log scan still catches the very next session */ }
}
// Have we seen a live block within the backoff window? The log-scan alone is SELF-ERASING:
// a session that correctly SKIPS the harvest leaves a clean log (no 403 marker), so after two
// consecutive skips the newest-logs window holds no block evidence and the next session
// harvests again — re-storming the blocked endpoint (observed 2026-07-20: the harvest
// oscillated skip→skip→harvest→403 and RAN 18× against a 4-day-old IP-block, each run firing
// ~853 futile autocomplete requests + a wasted Haiku ICP-prefilter that kept 0). The persisted
// stamp carries the block forward across clean-log skips for AUTOCOMPLETE_BLOCK_BACKOFF_HOURS
// (default 6). Still self-clearing: after the window with no fresh marker it probes once; if
// still blocked the probe re-stamps, if clear the harvest succeeds and normal cadence resumes.
function blockedRecently(): boolean {
  const backoffH = Number(process.env.AUTOCOMPLETE_BLOCK_BACKOFF_HOURS ?? 6);
  if (backoffH <= 0) return false;
  try {
    const s = JSON.parse(readFileSync(blockStatePath(), 'utf8')) as { last_seen?: string };
    const t = s.last_seen ? Date.parse(s.last_seen) : NaN;
    return Number.isFinite(t) && (Date.now() - t) / 3_600_000 < backoffH;
  } catch { return false; }
}
// Is the public autocomplete endpoint currently IP-blocking the harvest? Same signal the
// hourly check-in uses (scripts/autopilot/checkin.ts → autocompleteBlocked): the finder's
// AUTOCOMPLETE_ENDPOINT_BLOCKED circuit-breaker marker, or a dense run of "failed: HTTP 403"
// lines, in the 1–2 newest session logs. 403 = access denied (a block), NOT empty responses
// (true term exhaustion). A fresh log marker refreshes the persisted backoff stamp; absent a
// fresh marker we fall back to that stamp so a run of correct skips can't re-open the endpoint.
function autocompleteBlocked(): boolean {
  const cands: string[] = [];
  for (const d of [join('logs', 'autopilot-sessions'), 'logs']) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (/session-.*\.log$/.test(f) || /campaign-console-.*\.log$/.test(f)) cands.push(join(d, f));
    }
  }
  const newest = cands.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, 2);
  for (const f of newest) {
    let body = '';
    let mtimeMs = NaN;
    try { body = readFileSync(f, 'utf8'); mtimeMs = statSync(f).mtimeMs; } catch { continue; }
    // Stamp with the LOG FILE's mtime, not Date.now(): this function gets called on every
    // preflight check across a session's lifetime, and a marker written once near the start
    // of a long-running session (or in a prior session that's still one of the 2 newest)
    // would otherwise get re-discovered and re-stamped to "now" on every subsequent call —
    // perpetually resetting the AUTOCOMPLETE_BLOCK_BACKOFF_HOURS window and never letting the
    // block state expire even after the real block has cleared (observed 2026-07-29: a single
    // 403 burst at the start of an 85-minute session kept re-arming the 6h backoff well past
    // when the endpoint had recovered, starving the finder of new terms for hours).
    if (body.includes('AUTOCOMPLETE_ENDPOINT_BLOCKED')) { markAutocompleteBlocked(mtimeMs); return true; }
    const m = body.match(/failed: HTTP 403/g);
    if (m && m.length >= 50) { markAutocompleteBlocked(mtimeMs); return true; }
  }
  // No fresh marker in the newest logs — trust the persisted backoff (fixes the oscillation).
  return blockedRecently();
}
// --- Low-yield harvest backoff (2026-08-09) ---------------------------------
// The 08-08 prefilter reject cache did its job: harvests stopped re-classifying the same
// ~4.3k already-rejected terms (92.1% of candidates now skipped from cache). What it
// EXPOSED is that the 42-seed autocomplete set is mined out. Over the 08-09 cycle 14
// harvests were offered 58,746 candidates, found 4,617 genuinely unjudged, and kept 15
// terms — seven of the fourteen wrote nothing at all. Yet every one of the 14 sessions
// opened `STOCK-UP` with `fresh: 0`, which force-harvests at a 1h floor, so the loop paid
// ~21 minutes of session startup EVERY session (301 min across the cycle) for about one
// usable term. The stock-up gate is structurally unsatisfiable against an exhausted seed
// set: the handful of terms a harvest does write are consumed immediately, so the next
// pre-flight reads `fresh: 0` again and re-fires.
//
// That time is not spare capacity — all 14 sessions ended on their time budget, so it
// comes straight out of finding (a pass is ~9 min and writes ~8.7 new leads).
//
// So: measure what a harvest actually WRITES and back off when it stops paying. Same
// shape as the autocomplete-block guard above, and self-clearing for the same reason —
// after the window one harvest always runs, and a single good yield clears the streak and
// restores normal cadence. That matters because harvest yield is not permanently dead:
// editing skills/keyword-icp-prefilter.md or models.json invalidates the reject cache
// fingerprint and everything becomes judgeable again, and new seeds do the same.
//
// Fail-open on supply: a harvest whose yield can't be parsed (crash, changed output)
// records NO sample, so it neither extends nor starts a backoff streak. The worst case
// of an unreadable harvest is the status quo, never a silently disabled one.
// Escape hatch: HARVEST_LOW_YIELD_BACKOFF_HOURS=0 disables the guard entirely.
interface HarvestYieldSample { ts: string; probes: number }
function harvestYieldStatePath(): string {
  return join('logs', 'keyword-harvest-yield-state.json');
}
function readHarvestYield(): HarvestYieldSample[] {
  try {
    const s = JSON.parse(readFileSync(harvestYieldStatePath(), 'utf8')) as { runs?: HarvestYieldSample[] };
    return Array.isArray(s.runs) ? s.runs.filter(r => r && Number.isFinite(r.probes)) : [];
  } catch { return []; }
}
function recordHarvestYield(probes: number): void {
  try {
    mkdirSync('logs', { recursive: true });
    const runs = [...readHarvestYield(), { ts: new Date().toISOString(), probes }].slice(-20);
    writeFileSync(harvestYieldStatePath(), JSON.stringify({ runs }) + '\n');
  } catch { /* best-effort; a missing sample only means we harvest again next interval */ }
}
// How many probes did this harvest write? Reads the two terminal lines keyword-harvest.ts
// prints on its write path. Returns null when neither is present — see fail-open above.
export function parseHarvestProbes(stdout: string): number | null {
  const done = [...stdout.matchAll(/\[harvest\] done\. (\d+) probes written/g)];
  if (done.length) return Number(done[done.length - 1][1]);
  if (/\[harvest\] nothing to write\./.test(stdout)) return 0;
  return null;
}
// Have the last N harvests all come back near-empty, and was the newest one recent enough
// that the seed set can't plausibly have refilled since? Exported for the unit check.
export function harvestLowYieldBackoff(
  runs: HarvestYieldSample[],
  nowMs: number,
  env: { samples: number; minProbes: number; backoffH: number },
): { skip: boolean; streak: number; sinceH: number } {
  const recent = runs.slice(-env.samples);
  const streak = recent.length === env.samples && recent.every(r => r.probes < env.minProbes) ? env.samples : 0;
  const lastTs = runs.length ? Date.parse(runs[runs.length - 1].ts) : NaN;
  const sinceH = Number.isFinite(lastTs) ? (nowMs - lastTs) / 3_600_000 : Infinity;
  return { skip: env.backoffH > 0 && streak > 0 && sinceH < env.backoffH, streak, sinceH };
}
function hoursSinceLastHarvest(): number {
  try {
    const s = JSON.parse(readFileSync(harvestStatePath(), 'utf8')) as { last?: string };
    const t = s.last ? Date.parse(s.last) : NaN;
    return Number.isFinite(t) ? (Date.now() - t) / 3_600_000 : Infinity;
  } catch {
    return Infinity; // no state yet → due
  }
}
async function harvestKeywords(opts: CampaignOpts, intervalOverrideH?: number): Promise<boolean> {
  // Default cadence is the pre-flight 4h gate. Callers with a stronger, MEASURED
  // supply-pressure signal (a mid-session fade — the active vein just drained) may pass
  // a shorter floor so the pool refills faster precisely when it's draining.
  const intervalH = intervalOverrideH ?? Number(process.env.KEYWORD_HARVEST_INTERVAL_HOURS ?? 4);
  const cap = process.env.KEYWORD_HARVEST_CAP ?? '200';
  const sinceH = hoursSinceLastHarvest();
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would harvest keywords: npx tsx scripts/keyword-harvest.ts --apply --cap ${cap} (gate: every ${intervalH}h; last ${sinceH === Infinity ? 'never' : sinceH.toFixed(1) + 'h'} ago)`);
    return false;
  }
  // Autocomplete IP-block guard (2026-07-18). When the public suggest endpoint is IP-blocking
  // us (sustained HTTP 403 — the 2026-07-17 root cause), a harvest CANNOT refill the term pool
  // and every request only deepens the block. The hourly check-in already skips its backstop
  // kick on this signal; the always-on campaign loop must too — otherwise it storms the blocked
  // endpoint on every STOCK-UP pre-flight (it fired the harvest 14× on 2026-07-18 while the
  // block was live). This is the precise, self-clearing replacement for the old blunt "floor the
  // starved cadence at 1h" mitigation: skip while a live block marker is present, resume the
  // first clean session after it lifts. The remedy is infra (rotate egress IP / proxy), not code.
  if (autocompleteBlocked()) {
    console.log('[campaign] keyword harvest skipped — autocomplete endpoint IP-blocked (sustained HTTP 403); harvesting would only deepen the block. Remedy is infra: rotate egress IP / proxy.');
    log({ event: 'keyword_harvest', skipped: true, reason: 'autocomplete_blocked' });
    return false;
  }
  // Low-yield backoff (2026-08-09). Checked BEFORE the cadence gate because the STOCK-UP
  // pre-flight deliberately overrides that gate down to 1h — which is exactly the caller
  // that was force-firing an exhausted harvest every session.
  const lowYield = harvestLowYieldBackoff(readHarvestYield(), Date.now(), {
    samples: Number(process.env.HARVEST_LOW_YIELD_SAMPLES ?? 3),
    minProbes: Number(process.env.HARVEST_LOW_YIELD_MIN_PROBES ?? 3),
    backoffH: Number(process.env.HARVEST_LOW_YIELD_BACKOFF_HOURS ?? 6),
  });
  if (lowYield.skip) {
    console.log(
      `[campaign] keyword harvest skipped — last ${lowYield.streak} harvests each wrote < ` +
        `${process.env.HARVEST_LOW_YIELD_MIN_PROBES ?? 3} probes (autocomplete seed set is mined out); ` +
        `backing off ${process.env.HARVEST_LOW_YIELD_BACKOFF_HOURS ?? 6}h, ${lowYield.sinceH.toFixed(1)}h elapsed. ` +
        `Time goes to finder passes instead. Remedy is supply-side: new seeds, or edit the prefilter skill / models.json (either invalidates the reject cache).`,
    );
    log({ event: 'keyword_harvest', skipped: true, reason: 'low_yield_backoff', streak: lowYield.streak, since_hours: Number(lowYield.sinceH.toFixed(2)) });
    return false;
  }
  if (sinceH < intervalH) {
    console.log(`[campaign] keyword harvest skipped — last run ${sinceH.toFixed(1)}h ago (< ${intervalH}h gate).`);
    log({ event: 'keyword_harvest', skipped: true, since_hours: Number(sinceH.toFixed(2)) });
    return false;
  }
  console.log(`[campaign] harvesting real autocomplete terms → probes (cap ${cap})…`);
  const r = await runChildCapture('npx', ['tsx', 'scripts/keyword-harvest.ts', '--apply', '--cap', String(cap)], finderRepo());
  // runChildCapture tees to the terminal, so the session log is byte-identical to before;
  // we just also get the stdout needed to read the yield.
  const probes = parseHarvestProbes(r.stdout);
  if (probes !== null) recordHarvestYield(probes);
  // Record the ATTEMPT regardless of exit code so a persistently-failing harvest can't
  // re-block the session every pass; a transient failure simply retries next interval.
  mkdirSync('logs', { recursive: true });
  writeFileSync(harvestStatePath(), JSON.stringify({ last: new Date().toISOString(), exit: r.exit_code, cap }) + '\n');
  log({ event: 'keyword_harvest', skipped: false, exit: r.exit_code, cap, probes_written: probes });
  // If this run just slammed into the 403 wall, persist the block now (autocompleteBlocked()
  // reads this session's fresh marker and stamps) so the NEXT session backs off immediately
  // instead of oscillating back into another futile harvest.
  if (autocompleteBlocked()) markAutocompleteBlocked();
  if (r.exit_code !== 0) console.error(`[campaign] keyword harvest exited ${r.exit_code} (non-fatal; falling back to LLM discovery).`);
  return r.exit_code === 0;
}

// At the end of a run, promote the probe winners (qr>=threshold) to the fresh tier
// and retire the losers — so discovered veins that converted come back with the
// good terms and duds stop wasting quota. Was manual on 2026-07-09; now automatic.
async function evaluateProbes(opts: CampaignOpts): Promise<void> {
  if (opts.dryRun) {
    console.log('[campaign] DRY RUN — would run evaluate-probes.ts --apply');
    return;
  }
  console.log('[campaign] evaluating probes (promote winners / retire losers)…');
  const r = await runChild('npx', ['tsx', 'scripts/evaluate-probes.ts', '--apply'], finderRepo());
  log({ event: 'evaluate_probes', exit: r.exit_code });
}

// Rescue rows stranded at review_status=scoring_failed (2026-08-06).
//
// WHY THIS IS AUTOMATIC NOW. On 08-04/05 a scoring token-budget bug wrote 733 rows as
// scoring_failed over ~30h. Those are real prospect rows that simply never got a score,
// so nothing was lost — but nothing swept them either: recovery took a HAND-LAUNCHED
// `scripts/rescore-failed.ts`, and the leads sat stranded until a human noticed. The
// rescue itself worked (733/733 rescored, 337 of them score >= 6, and they are a large
// part of today's +173 parked), which is exactly why it should not depend on a human
// noticing. Any future scoring outage — a model swap, a provider having a bad hour, a
// rubric change — now self-heals on the next session.
//
// SAFETY. Rescoring while the scorer is broken burns LLM calls to re-fail every row, so
// this only fires when THIS session's own passes prove scoring currently works:
//   • a real sample of newly-discovered leads (RESCUE_MIN_SAMPLE), and
//   • a scoring_failed rate under RESCUE_MAX_FAIL_RATE_PCT.
// The child is additionally wall-clock-bounded (RESCUE_MAX_MINUTES) and self-aborts on a
// run of consecutive failures (its exit 4). It is naturally resumable — it re-queries
// whatever is still stranded on each start — so a bounded slice per session drains a big
// backlog over a few sessions without ever blocking one session for hours.
async function rescueScoringFailed(
  opts: CampaignOpts,
  health: { newLeads: number; scoringFailed: number },
): Promise<void> {
  const maxMinutes = Number(process.env.RESCUE_MAX_MINUTES ?? 20);
  if (maxMinutes <= 0) return; // explicitly disabled
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would rescue stranded scoring_failed rows: npx tsx scripts/rescore-failed.ts --max-minutes ${maxMinutes}`);
    return;
  }

  const minSample = Number(process.env.RESCUE_MIN_SAMPLE ?? 25);
  const maxFailPct = Number(process.env.RESCUE_MAX_FAIL_RATE_PCT ?? 20);
  const failPct = health.newLeads > 0 ? (100 * health.scoringFailed) / health.newLeads : 0;

  if (health.newLeads < minSample) {
    console.log(`[campaign] scoring_failed rescue skipped — only ${health.newLeads} new leads this session (< ${minSample}), not enough evidence the scorer is healthy.`);
    log({ event: 'rescue_scoring_failed', skipped: true, reason: 'insufficient_sample', new_leads: health.newLeads });
    return;
  }
  if (failPct >= maxFailPct) {
    console.warn(`[campaign] scoring_failed rescue skipped — this session's own scoring_failed rate is ${failPct.toFixed(0)}% (>= ${maxFailPct}%). Rescoring would re-fail every row; fix scoring first.`);
    log({ event: 'rescue_scoring_failed', skipped: true, reason: 'scorer_unhealthy', fail_pct: Number(failPct.toFixed(1)), new_leads: health.newLeads });
    return;
  }

  console.log(`[campaign] rescuing stranded scoring_failed rows (scorer healthy: ${failPct.toFixed(0)}% failures over ${health.newLeads} new leads; budget ${maxMinutes}min)…`);
  const r = await runChild('npx', ['tsx', 'scripts/rescore-failed.ts', '--max-minutes', String(maxMinutes)], finderRepo());
  log({ event: 'rescue_scoring_failed', skipped: false, exit: r.exit_code, max_minutes: maxMinutes, fail_pct: Number(failPct.toFixed(1)) });
  if (r.exit_code === 4) {
    console.error('[campaign] rescue aborted — the scoring pipeline still looks broken (see the finder log). Non-fatal; the next session re-checks.');
  } else if (r.exit_code !== 0) {
    console.error(`[campaign] rescue exited ${r.exit_code} (non-fatal; retries next session).`);
  }
}

// Run N finder passes over DISJOINT term slices concurrently (offset 0, topN,
// 2·topN…). Returns an aggregate: worst exit code + summed fresh-pitchable yield.
// NOTE: concurrency>1 can create rare duplicate lead rows when the same channel
// surfaces under terms in two different slices within the race window — run
// scripts/dedupe-leads.ts after a concurrent session. Default 1 = sequential/safe.
async function runFinderPasses(opts: CampaignOpts, concurrencyOverride?: number): Promise<{ exit_code: number | null; freshPitchable: number; freshPitchableBaseWide: number; keywordNewLeads: number; newLeads: number; scoringFailed: number; score6Plus: number }> {
  const n = Math.max(1, concurrencyOverride ?? opts.concurrentPasses);
  const runs = Array.from({ length: n }, (_, i) =>
    driveLeadFinder({ force: true, topN: opts.topN, llmCap: opts.llmCap, termOffset: i * opts.topN, dryRun: opts.dryRun }),
  );
  const results = await Promise.all(runs);
  const exit_code = results.some(r => r.exit_code !== 0 && r.exit_code !== null)
    ? (results.find(r => r.exit_code !== 0 && r.exit_code !== null)?.exit_code ?? 1)
    : 0;
  // FADE SIGNAL — keyword-engine rows only (2026-08-10). The sweep daemons write into the
  // same lead base continuously, so the base-wide count includes rows this pass did not
  // produce; on 08-10 that read 762 fresh pitchable against the keyword engine's actual
  // 255. Fade is a statement about whether the TERM SLICE still has a vein, so it has to
  // ignore work no term did. `?? …score_6_plus_AND_host_identified` keeps the old
  // behaviour if the sub-count is ever missing, so a shape change degrades to over-
  // counting (fewer discovery pivots) rather than to a fake zero (permanent churn).
  const freshPitchable = results.reduce(
    (s, r) =>
      s +
      (r.yield_breakdown?.keyword_engine?.score_6_plus_AND_host_identified ??
        r.yield_breakdown?.score_6_plus_AND_host_identified ??
        0),
    0,
  );
  // Base-wide on purpose — this is the denominator of the scoring-health checks, and the
  // scorer is shared by every discovery method, so a bigger sample is a better one.
  const newLeads = results.reduce((s, r) => s + (r.yield_breakdown?.new_leads ?? 0), 0);
  const scoringFailed = results.reduce((s, r) => s + (r.yield_breakdown?.by_review_status?.scoring_failed ?? 0), 0);
  const score6Plus = results.reduce((s, r) => s + (r.yield_breakdown?.score_6_plus ?? 0), 0);
  // Kept for the log line so the daily debrief can still read the base-wide figure and
  // see how much of the day's intake the daemons are now carrying.
  const freshPitchableBaseWide = results.reduce((s, r) => s + (r.yield_breakdown?.score_6_plus_AND_host_identified ?? 0), 0);
  const keywordNewLeads = results.reduce((s, r) => s + (r.yield_breakdown?.keyword_engine?.new_leads ?? r.yield_breakdown?.new_leads ?? 0), 0);
  return { exit_code, freshPitchable, freshPitchableBaseWide, keywordNewLeads, newLeads, scoringFailed, score6Plus };
}

export async function driveCampaign(opts: CampaignOpts): Promise<void> {
  console.log(`[campaign] START target=${opts.target} maxRuns=${opts.maxRuns} topN=${opts.topN} discovery=${opts.discovery} dryRun=${opts.dryRun}`);
  log({ event: 'start', opts });

  const startParked = opts.dryRun ? 0 : await countByReviewStatus('approved_hold');

  // --- Pre-flight reservoir gate (#2) ---
  const resArgs = ['tsx', 'scripts/reservoir-check.ts', '--runs', String(opts.reservoirRuns), '--top-n', String(opts.topN), '--json'];
  if (opts.dryRun) {
    console.log(`[campaign] DRY RUN — would check reservoir: npx ${resArgs.join(' ')}`);
  } else {
    const res = await runChildCapture('npx', resArgs, finderRepo());
    let verdict = 'UNKNOWN';
    try { verdict = (JSON.parse(res.stdout.slice(res.stdout.indexOf('{'))) as { verdict: string }).verdict; } catch { /* leave UNKNOWN */ }
    log({ event: 'reservoir', verdict });
    if (verdict === 'STOCK-UP' && opts.discovery) {
      console.log(`[campaign] reservoir short — stocking up before the run.`);
      // STOCK-UP means the fresh-term pool literally cannot cover this run — the term
      // engine is DRY, which is precisely when a harvest is mandatory. The normal 4h
      // cadence is the wrong gate here: skipping because we happened to harvest a few
      // hours ago leaves the finder with zero terms, it aborts on "No active terms",
      // two aborts trip the hard-wall, and the whole session parks 0 leads for hours
      // (the 2026-07-17 term-starvation stall — reservoir was STOCK-UP but harvest was
      // skipped at 3.6h < 4h gate). When we're genuinely short we harvest far more
      // eagerly than the normal 4h cadence — but NOT every cycle: the harvest hits
      // Google/YouTube autocomplete, which on this datacenter IP can hard-403 the whole
      // batch (observed 2026-07-17: 586/586 requests 403, ~0 net-new terms — same IP-
      // reputation family as the graph-sweep watch-page 429s). Force-harvesting every
      // ~30-min session would just storm a blocked endpoint and risk deepening the block,
      // so we floor the starved cadence at 1h: eager enough to catch the moment the block
      // clears and refill, gentle enough not to grind a forbidden endpoint. Env-tunable.
      await harvestKeywords(opts, Number(process.env.KEYWORD_HARVEST_STARVED_INTERVAL_HOURS ?? 1));
      await discover(opts);        // LLM veins as the fast complement / between-harvest fallback
    }
  }

  // --- Main loop ---
  const seen = new Set<string>();       // every pitchable id sent to verify this session
  let pendingVerify: Promise<number> = Promise.resolve(0);
  let consecutiveFinderFailures = 0;
  let fadeCount = 0; // fades since the last mid-run evaluate-probes (#3)
  const probeEvalEveryFades = Number(process.env.PROBE_EVAL_EVERY_FADES ?? 3);
  // Session-level scoring health, accumulated across passes. Used at finish time to
  // decide whether it is safe to rescue rows stranded at scoring_failed.
  let sessionNewLeads = 0;
  let sessionScoringFailed = 0;
  const startedMs = Date.now();
  const elapsedMin = () => (Date.now() - startedMs) / 60000;
  let lastPassMin = 0; // wall-clock of the previous finder pass, for deadline reservation

  for (let run = 1; run <= opts.maxRuns; run++) {
    // Wall-clock budget: don't START a pass that would likely finish PAST the
    // deadline. A pass runs tens of minutes, so we reserve the last pass's duration
    // (+15% slack) — otherwise a pass starting just under budget overruns (the
    // 2026-07-09 run finished ~26 min late this way). The final verify+promote below
    // still runs, so we always checkpoint cleanly before stopping.
    const reserve = lastPassMin > 0 ? lastPassMin * 1.15 : 0;
    if (opts.maxMinutes > 0 && elapsedMin() + reserve >= opts.maxMinutes) {
      console.log(`[campaign] wall-clock budget reached (${elapsedMin().toFixed(0)}min + ~${reserve.toFixed(0)}min/pass reserve >= ${opts.maxMinutes}) — finishing up before deadline.`);
      log({ event: 'time_budget_stop', run, elapsed_min: Math.round(elapsedMin()), reserve_min: Math.round(reserve) });
      break;
    }

    const parked = opts.dryRun ? 0 : await countByReviewStatus('approved_hold');
    const gained = parked - startParked;
    if (!opts.dryRun && gained >= opts.target) {
      console.log(`[campaign] target reached: ${gained}/${opts.target} parked. Stopping.`);
      break;
    }

    // Quota governor (#4): read the finder's last quota snapshot and self-limit
    // BEFORE spending more searches. Hard-stop past the hard floor; throttle
    // concurrent passes → 1 past the soft floor (each pass costs ~topN×100 units).
    let effectiveConcurrency = opts.concurrentPasses;
    if (!opts.dryRun) {
      const usedPct = readFinderQuotaUsedPct();
      if (usedPct !== null && usedPct >= quotaHardPct()) {
        console.error(`[campaign] YouTube quota at ${usedPct}% (>= hard floor ${quotaHardPct()}%) — stopping to preserve remaining credits.`);
        log({ event: 'quota_stop', run, used_pct: usedPct });
        break;
      }
      if (usedPct !== null && usedPct >= quotaSoftPct() && effectiveConcurrency > 1) {
        console.warn(`[campaign] YouTube quota at ${usedPct}% (>= soft floor ${quotaSoftPct()}%) — throttling ${opts.concurrentPasses}→1 concurrent to conserve.`);
        log({ event: 'quota_throttle', run, used_pct: usedPct });
        effectiveConcurrency = 1;
      }
    }

    console.log(`\n[campaign] ===== run ${run}/${opts.maxRuns} — parked so far: ${opts.dryRun ? 'n/a' : gained}/${opts.target}${effectiveConcurrency > 1 ? ` (×${effectiveConcurrency} concurrent)` : ''} =====`);
    const passStart = Date.now();
    const finder = await runFinderPasses(opts, effectiveConcurrency);
    lastPassMin = (Date.now() - passStart) / 60000;

    // Hard-wall detection: finder exiting nonzero twice in a row => quota/keys/Airtable.
    if (!opts.dryRun && finder.exit_code !== 0 && finder.exit_code !== null) {
      consecutiveFinderFailures++;
      // Finder exit 3 = benign term-supply exhaustion ("No active terms to process"),
      // NOT an infra hard wall. Label the stop by its real cause so debriefs and the
      // hourly check-in can tell a dry term pool (harvest/discovery couldn't refill —
      // self-heals on the next harvest/back-off) apart from a genuine quota/keys/Airtable
      // failure (needs a human). Prior to this, all 23 of the 2026-08-01 supply-exhaustion
      // stops logged as an indistinguishable "hard wall (quota/keys/Airtable)".
      const supplyExhausted = finder.exit_code === 3;
      console.error(`[campaign] finder exit ${finder.exit_code} — consecutive failures: ${consecutiveFinderFailures}`);
      if (consecutiveFinderFailures >= 2) {
        const reason = supplyExhausted ? 'term_supply_exhausted' : 'hard_wall';
        console.error(
          supplyExhausted
            ? `[campaign] two consecutive term-supply-exhausted passes — the active term pool is dry (harvest/discovery could not refill it). Stopping; the loop back-off + next keyword harvest refill it.`
            : `[campaign] two consecutive finder failures — likely a hard wall (quota/keys/Airtable). Stopping.`,
        );
        log({ event: 'hard_stop', run, reason });
        break;
      }
    } else {
      consecutiveFinderFailures = 0;
    }

    const freshPitchable = finder.freshPitchable;
    sessionNewLeads += finder.newLeads;
    sessionScoringFailed += finder.scoringFailed;
    log({
      event: 'finder_run',
      run,
      exit: finder.exit_code,
      fresh_pitchable: freshPitchable,
      // fresh_pitchable is keyword-engine-only since 2026-08-10; these two carry the
      // base-wide view so a trend line across the change is still readable.
      fresh_pitchable_base_wide: finder.freshPitchableBaseWide,
      keyword_new_leads: finder.keywordNewLeads,
      concurrent: opts.concurrentPasses,
      new_leads: finder.newLeads,
      scoring_failed: finder.scoringFailed,
      score_6_plus: finder.score6Plus,
    });

    // Fade → pivot to discovery instead of grinding (#3).
    if (!opts.dryRun && finder.exit_code === 0 && freshPitchable < opts.fadeThreshold && opts.discovery) {
      console.log(`[campaign] only ${freshPitchable} fresh pitchable this pass (< ${opts.fadeThreshold}) — vein fading, pivoting to discovery.`);
      log({ event: 'fade_detected', run, fresh_pitchable: freshPitchable });
      // A fade is direct evidence the active vein just drained MID-SESSION — a stronger
      // supply-pressure signal than a pre-flight reservoir verdict. Refill with REAL
      // autocomplete terms first, at a shorter cadence floor (KEYWORD_HARVEST_MIN_INTERVAL_HOURS,
      // default 2h vs the pre-flight 4h), then still run the LLM discover() as a complement.
      // Additive + cadence-gated: no-ops when not due, so quota stays bounded (the harvest
      // itself is ~free autocomplete; only probe-TESTING costs quota, already governed).
      // Closes the between-harvest supply sag (07-15 rec #3): pre-flight was previously the
      // ONLY place the harvest could fire, so a session that drained mid-window had to wait
      // for the next session's pre-flight to refill while every fade hit the ~0-net-new discover().
      await harvestKeywords(opts, Number(process.env.KEYWORD_HARVEST_MIN_INTERVAL_HOURS ?? 2));
      await discover(opts);
      // Promote probe winners MID-RUN (#3), not just at the end: every N fades,
      // run evaluate-probes so veins the day's discovery already validated re-enter
      // the fresh/active tier the SAME session instead of auto-pausing unused. On
      // 2026-07-10 winners sat paused until run-end and never got mined live.
      if (++fadeCount >= probeEvalEveryFades) {
        fadeCount = 0;
        await evaluateProbes(opts);
      }
    }

    // Overlap verify (#1): make sure the prior verify finished, then kick the next
    // one WITHOUT awaiting it — it runs while the next finder pass starts.
    await pendingVerify;
    // Promote what verified so far, EACH pass — so approved_hold grows live, the
    // target check above can self-limit, and an interruption leaves little unparked
    // (verified-but-unpromoted). Idempotent: promote skips already-parked rows.
    await promoteSeen(opts, seen);
    // Kick the next verify WITHOUT awaiting — but attach a .catch so a transient
    // failure (network blip mid-query) can NEVER become an unhandled rejection that
    // hard-crashes the whole autonomous run (the 2026-07-10 ENOTFOUND crash). A
    // failed verify is non-fatal: those leads stay pitchable and retry next pass.
    pendingVerify = verifyPending(opts, seen).catch((e) => {
      console.error('[campaign] verify pass errored (non-fatal; leads retry next pass):', e instanceof Error ? e.message : String(e));
      return 0;
    });
  }

  await pendingVerify;

  // --- Finish: final verify sweep, last promote (auto-sweeps needs_contact),
  //     then evaluate this run's probes (promote winners / retire losers). ---
  console.log(`\n[campaign] final verify sweep…`);
  await verifyPending(opts, seen);
  await promoteSeen(opts, seen);
  await evaluateProbes(opts);
  // Last, because it is the only step that can be skipped without costing this session
  // anything: sweep any rows stranded at scoring_failed back through the (now verified
  // healthy) scorer. Bounded + resumable — see rescueScoringFailed above.
  await rescueScoringFailed(opts, { newLeads: sessionNewLeads, scoringFailed: sessionScoringFailed });

  const endParked = opts.dryRun ? 0 : await countByReviewStatus('approved_hold');
  const finalGain = endParked - startParked;
  console.log(`\n[campaign] DONE — parked ${opts.dryRun ? 'n/a (dry run)' : `${finalGain} new (base ${startParked} → ${endParked})`}.`);
  log({ event: 'done', parked_gain: opts.dryRun ? null : finalGain, start: startParked, end: endParked });
  writeTickLog({ ts: new Date().toISOString(), campaign_done: true, parked_gain: opts.dryRun ? null : finalGain });
}
