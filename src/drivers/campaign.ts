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

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

  const args = ['run', 'outreach', '--', '--stop-after', 'verify', '--lead-ids-file', idsFile,
    '--concurrency', process.env.APPROVED_CONCURRENCY ?? '4'];
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

// Run N finder passes over DISJOINT term slices concurrently (offset 0, topN,
// 2·topN…). Returns an aggregate: worst exit code + summed fresh-pitchable yield.
// NOTE: concurrency>1 can create rare duplicate lead rows when the same channel
// surfaces under terms in two different slices within the race window — run
// scripts/dedupe-leads.ts after a concurrent session. Default 1 = sequential/safe.
async function runFinderPasses(opts: CampaignOpts): Promise<{ exit_code: number | null; freshPitchable: number }> {
  const n = Math.max(1, opts.concurrentPasses);
  const runs = Array.from({ length: n }, (_, i) =>
    driveLeadFinder({ force: true, topN: opts.topN, llmCap: opts.llmCap, termOffset: i * opts.topN, dryRun: opts.dryRun }),
  );
  const results = await Promise.all(runs);
  const exit_code = results.some(r => r.exit_code !== 0 && r.exit_code !== null)
    ? (results.find(r => r.exit_code !== 0 && r.exit_code !== null)?.exit_code ?? 1)
    : 0;
  const freshPitchable = results.reduce((s, r) => s + (r.yield_breakdown?.score_6_plus_AND_host_identified ?? 0), 0);
  return { exit_code, freshPitchable };
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
      await discover(opts);
    }
  }

  // --- Main loop ---
  const seen = new Set<string>();       // every pitchable id sent to verify this session
  let pendingVerify: Promise<number> = Promise.resolve(0);
  let consecutiveFinderFailures = 0;
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

    console.log(`\n[campaign] ===== run ${run}/${opts.maxRuns} — parked so far: ${opts.dryRun ? 'n/a' : gained}/${opts.target}${opts.concurrentPasses > 1 ? ` (×${opts.concurrentPasses} concurrent)` : ''} =====`);
    const passStart = Date.now();
    const finder = await runFinderPasses(opts);
    lastPassMin = (Date.now() - passStart) / 60000;

    // Hard-wall detection: finder exiting nonzero twice in a row => quota/keys/Airtable.
    if (!opts.dryRun && finder.exit_code !== 0 && finder.exit_code !== null) {
      consecutiveFinderFailures++;
      console.error(`[campaign] finder exit ${finder.exit_code} — consecutive failures: ${consecutiveFinderFailures}`);
      if (consecutiveFinderFailures >= 2) {
        console.error(`[campaign] two consecutive finder failures — likely a hard wall (quota/keys/Airtable). Stopping.`);
        log({ event: 'hard_stop', run });
        break;
      }
    } else {
      consecutiveFinderFailures = 0;
    }

    const freshPitchable = finder.freshPitchable;
    log({ event: 'finder_run', run, exit: finder.exit_code, fresh_pitchable: freshPitchable, concurrent: opts.concurrentPasses });

    // Fade → pivot to discovery instead of grinding (#3).
    if (!opts.dryRun && finder.exit_code === 0 && freshPitchable < opts.fadeThreshold && opts.discovery) {
      console.log(`[campaign] only ${freshPitchable} fresh pitchable this pass (< ${opts.fadeThreshold}) — vein fading, pivoting to discovery.`);
      log({ event: 'fade_detected', run, fresh_pitchable: freshPitchable });
      await discover(opts);
    }

    // Overlap verify (#1): make sure the prior verify finished, then kick the next
    // one WITHOUT awaiting it — it runs while the next finder pass starts.
    await pendingVerify;
    // Promote what verified so far, EACH pass — so approved_hold grows live, the
    // target check above can self-limit, and an interruption leaves little unparked
    // (verified-but-unpromoted). Idempotent: promote skips already-parked rows.
    await promoteSeen(opts, seen);
    pendingVerify = verifyPending(opts, seen);
  }

  await pendingVerify;

  // --- Finish: final verify sweep, last promote (auto-sweeps needs_contact),
  //     then evaluate this run's probes (promote winners / retire losers). ---
  console.log(`\n[campaign] final verify sweep…`);
  await verifyPending(opts, seen);
  await promoteSeen(opts, seen);
  await evaluateProbes(opts);

  const endParked = opts.dryRun ? 0 : await countByReviewStatus('approved_hold');
  const finalGain = endParked - startParked;
  console.log(`\n[campaign] DONE — parked ${opts.dryRun ? 'n/a (dry run)' : `${finalGain} new (base ${startParked} → ${endParked})`}.`);
  log({ event: 'done', parked_gain: opts.dryRun ? null : finalGain, start: startParked, end: endParked });
  writeTickLog({ ts: new Date().toISOString(), campaign_done: true, parked_gain: opts.dryRun ? null : finalGain });
}
