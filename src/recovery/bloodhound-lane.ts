// Bloodhound recovery lane (wired 2026-08-23).
//
// The pipeline auto-tags every score>=6 email-failed lead into the
// needs_contact lane (promote-verified-to-hold.ts auto-sweep), then NOTHING
// worked that lane: Bloodhound (the free multi-method contact-point collector
// in youtube-email-outreach-v1) ran once by hand on 2026-08-18/19, recovered
// 686 emails across 644 leads, verified only 50, and was never scheduled.
// On 2026-08-23 the pool held 3,290 needs_contact/no_email_found leads.
//
// Measured evidence behind this lane:
//   - verify-only pass on the 152 leads with discovered-but-unflipped emails:
//     70 flipped to approved_hold for 109 ZeroBounce credits (46% hit rate).
//   - free collection probe on 30 untouched leads: 8 produced contact points,
//     9 emails among 28 points (~0.3 emails/lead on the general pool).
//
// This module cadence-gates two Bloodhound passes inside the campaign's fade
// pivot: a DETACHED free collection batch (no session time spent) and an
// awaited verify-only pass bounded by the number of leads that actually have
// unverified email points. Credits are spent only on unverified email points;
// the verify selector only picks leads that have them.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from 'pipeline-db';

export interface LaneState {
  lastCollectAt?: string;
  lastVerifyAt?: string;
  /** PID of a detached collect child, if one might still be running. */
  collectPid?: number;
  /** When the collect child spawned, so the pid guard expires on PID reuse. */
  collectStartedAt?: string;
}

export const LANE_STATE_PATH = join('logs', 'bloodhound-lane-state.json');

export function isDue(
  state: LaneState,
  key: 'lastCollectAt' | 'lastVerifyAt',
  nowMs: number,
  intervalHours: number,
): boolean {
  const ts = state[key];
  if (!ts) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return nowMs - t >= intervalHours * 3_600_000;
}

export function loadState(path = LANE_STATE_PATH): LaneState {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LaneState;
  } catch {
    return {};
  }
}

export function saveState(state: LaneState, path = LANE_STATE_PATH): void {
  mkdirSync('logs', { recursive: true });
  writeFileSync(path, JSON.stringify(state) + '\n');
}

function pidAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** needs_contact leads with no email yet and NO contact points collected. */
export async function selectUntouchedIds(limit: number): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT lc.id
       FROM leads.lead_candidates lc
      WHERE lc.review_status = 'needs_contact'
        AND lc.outreach_status = 'no_email_found'
        AND lc.signal_score >= 6
        AND COALESCE(lc.do_not_contact, false) = false
        AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id = lc.id)
      ORDER BY lc.first_discovered_at ASC NULLS LAST
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.id);
}

/** needs_contact leads that have at least one UNVERIFIED email contact point.
 *  GROUP BY stands in for DISTINCT because Postgres requires ORDER BY
 *  expressions to appear in the select list under SELECT DISTINCT. */
export async function selectVerifiableIds(limit: number): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT lc.id
       FROM leads.lead_candidates lc
       JOIN leads.contact_points cp ON cp.lead_id = lc.id
      WHERE lc.review_status = 'needs_contact'
        AND lc.outreach_status = 'no_email_found'
        AND cp.kind IN ('business_email', 'personal_email', 'youtube_email')
        AND COALESCE(cp.verified, false) = false
        AND COALESCE(lc.do_not_contact, false) = false
      GROUP BY lc.id, lc.first_discovered_at
      ORDER BY lc.first_discovered_at ASC NULLS LAST
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.id);
}

export interface LaneOpts {
  dryRun: boolean;
  emailRepoPath: string;
  collectIntervalHours: number;
  verifyIntervalHours: number;
  collectBatch: number;
  verifyBatch: number;
  log: (line: Record<string, unknown>) => void;
}

function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function laneOptsFromEnv(
  emailRepoPath: string,
  dryRun: boolean,
  log: (line: Record<string, unknown>) => void,
): LaneOpts {
  return {
    dryRun,
    emailRepoPath,
    collectIntervalHours: numEnv('BLOODHOUND_COLLECT_INTERVAL_HOURS', 6),
    verifyIntervalHours: numEnv('BLOODHOUND_VERIFY_INTERVAL_HOURS', 3),
    // Integer batches: a fractional LIMIT is a Postgres error.
    collectBatch: Math.floor(numEnv('BLOODHOUND_COLLECT_BATCH', 40)),
    verifyBatch: Math.floor(numEnv('BLOODHOUND_VERIFY_BATCH', 200)),
    log,
  };
}

/**
 * Run whichever Bloodhound passes are due. Collect is fire-and-forget (detached
 * child; it must not burn the campaign session's time budget). Verify is
 * awaited because it is short (only leads with pending email points) and its
 * flips feed the approved_hold pool the same session promotes.
 */
export async function runBloodhoundLane(opts: LaneOpts): Promise<void> {
  const now = Date.now();
  const state = loadState();

  // --- verify pass (bounded credit spend: only leads with unverified emails) ---
  if (isDue(state, 'lastVerifyAt', now, opts.verifyIntervalHours)) {
    try {
      const ids = await selectVerifiableIds(opts.verifyBatch);
      if (ids.length === 0) {
        opts.log({ event: 'bloodhound_verify', skipped: 'no_pending_email_points' });
        state.lastVerifyAt = new Date().toISOString();
        if (!opts.dryRun) saveState(state);
      } else if (opts.dryRun) {
        opts.log({ event: 'bloodhound_verify', dry_run: true, leads: ids.length });
      } else {
        const r = await runBloodhound(opts.emailRepoPath, [
          '--lead-ids', ids.join(','), '--verify', '--verify-only',
        ]);
        opts.log({ event: 'bloodhound_verify', leads: ids.length, exit: r.exit_code });
        // Stamp the cadence only on success; a failed child should be retried
        // next pass, not deferred a full interval.
        if (r.exit_code === 0) {
          state.lastVerifyAt = new Date().toISOString();
          saveState(state);
        }
      }
    } catch (e) {
      opts.log({ event: 'bloodhound_verify', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // --- collect pass (free; detached so the session keeps moving) ---
  // A collect batch of 40 leads finishes well under 2h; past that age a
  // "living" PID is OS reuse, not our child, and the guard must expire.
  const collectAgeMs = state.collectStartedAt ? now - Date.parse(state.collectStartedAt) : Infinity;
  if (isDue(state, 'lastCollectAt', now, opts.collectIntervalHours)) {
    if (pidAlive(state.collectPid) && collectAgeMs < 2 * 3_600_000) {
      opts.log({ event: 'bloodhound_collect', skipped: 'previous_still_running', pid: state.collectPid });
      return;
    }
    try {
      const ids = await selectUntouchedIds(opts.collectBatch);
      if (ids.length === 0) {
        opts.log({ event: 'bloodhound_collect', skipped: 'pool_empty' });
        state.lastCollectAt = new Date().toISOString();
        if (!opts.dryRun) saveState(state);
        return;
      }
      if (opts.dryRun) {
        opts.log({ event: 'bloodhound_collect', dry_run: true, leads: ids.length });
        return;
      }
      const child = spawn(
        'npm', ['run', 'bloodhound', '--', '--lead-ids', ids.join(',')],
        { cwd: opts.emailRepoPath, stdio: 'ignore', detached: true },
      );
      // Without this handler a spawn failure (ENOENT etc.) throws as an
      // uncaught exception AFTER spawn returns, crashing the campaign's
      // finish block. The collect pass must never take the session down.
      child.on('error', (err) => {
        opts.log({ event: 'bloodhound_collect', spawn_error: err.message });
      });
      child.unref();
      state.collectPid = child.pid;
      state.lastCollectAt = new Date().toISOString();
      state.collectStartedAt = state.lastCollectAt;
      saveState(state);
      opts.log({ event: 'bloodhound_collect', leads: ids.length, pid: child.pid });
    } catch (e) {
      opts.log({ event: 'bloodhound_collect', error: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Awaited bloodhound run (used by the verify pass). Watchdog-killed after
 * VERIFY_TIMEOUT_MS so a hung CLI can never block the campaign finish block
 * indefinitely; a kill reports a non-zero exit, which skips the cadence
 * stamp and retries next session. */
function runBloodhound(
  cwd: string,
  extraArgs: string[],
  timeoutMs = 20 * 60_000,
): Promise<{ exit_code: number | null }> {
  return new Promise((resolvePromise) => {
    const child = spawn('npm', ['run', 'bloodhound', '--', ...extraArgs], { cwd, stdio: 'inherit' });
    const watchdog = setTimeout(() => { child.kill('SIGTERM'); }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(watchdog); resolvePromise({ exit_code: code }); });
    child.on('error', () => { clearTimeout(watchdog); resolvePromise({ exit_code: null }); });
  });
}
