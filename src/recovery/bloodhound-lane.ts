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
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from 'pipeline-db';

/** Where the collect walk has got to in the current lap. See COLLECT_IDS_SQL. */
export interface CollectCursor {
  tier: number;
  disc: string;
  id: string;
}

export interface LaneState {
  lastCollectAt?: string;
  lastVerifyAt?: string;
  /** PID of a detached collect child, if one might still be running. */
  collectPid?: number;
  /** When the collect child spawned, so the pid guard expires on PID reuse. */
  collectStartedAt?: string;
  /** Position in the current collect lap; absent means "start a new lap". */
  collectCursor?: CollectCursor;
  /** How many full laps of the untouched pool the collect pass has walked. */
  collectLaps?: number;
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

export const COLLECT_LOG_PATH = join('logs', 'bloodhound-collect.log');

/** Append-mode fd for the detached collect child's output. Falls back to
 *  'ignore' if the log can't be opened, so logging can never stop the lane. */
function collectLogFd(): number | 'ignore' {
  try {
    mkdirSync('logs', { recursive: true });
    return openSync(COLLECT_LOG_PATH, 'a');
  } catch {
    return 'ignore';
  }
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

/** needs_contact leads with no email yet and NO contact points collected.
 *
 *  WALK THE BOOK, DON'T WALK IN PLACE (2026-08-27). The only way a lead left
 *  this pool was to GAIN a contact point, so every lead the collector fails on
 *  stayed at the front of the queue and was handed back on the next cadence,
 *  forever. Measured over the lane's first four days: 4 collect passes a day,
 *  40 leads each, and the pool sat at 3,315 the whole time while
 *  `contact_points` gained 46 rows on 08-23, 2 on 08-24, 0 on 08-25, 1 on 08-26
 *  and 0 on 08-27. It was re-running one fixed batch of the 40 oldest leads
 *  about sixteen times. That batch is the worst forty in the pool: 27 of them
 *  carry no external links at all, so 9 of the 11 methods skip on sight, and
 *  the 13 that do have a site have dead DNS, a bot wall or a cross-domain
 *  redirect. Same failure class as the verify selector on 08-24 (d6af815), one
 *  lane over: a selector that reads "no result yet" as "not tried yet".
 *
 *  So carry a cursor. The ordering is a plain ascending 3-tuple, which is what
 *  lets the cursor be a single row comparison:
 *
 *    tier 0 = the lead has external links, tier 1 = it does not. Nine of the
 *      eleven methods need a website, so a linked lead is worth roughly five
 *      times a bare one. Tier ordering spends each lap's early passes on the
 *      1,067 workable leads before the 2,248 bare ones.
 *    disc  = first_discovered_at, oldest first, unchanged.
 *    id    = tiebreak, so a batch boundary can never skip or repeat a lead
 *      that shares a timestamp with its neighbour.
 *
 *  A short batch means the lap is done: the caller clears the cursor and the
 *  next pass starts a fresh lap over whatever is still uncollected. That is
 *  deliberate rather than terminal — a re-walk is worth something once sites
 *  come back, a method is added, or new leads land mid-book — and it is also
 *  the self-healing property: no state file edit can strand the lane, because
 *  a missing or garbage cursor just starts a lap.
 */
export const COLLECT_IDS_SQL = `WITH pool AS (
       SELECT lc.id,
              CASE WHEN COALESCE(lc.external_links, '') NOT IN ('', '[]') THEN 0 ELSE 1 END AS tier,
              COALESCE(lc.first_discovered_at, 'infinity'::timestamptz) AS disc
         FROM leads.lead_candidates lc
        WHERE lc.review_status = 'needs_contact'
          AND lc.outreach_status = 'no_email_found'
          AND lc.signal_score >= 6
          AND COALESCE(lc.do_not_contact, false) = false
          AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id = lc.id)
     )
     SELECT id, tier, disc
       FROM pool
      WHERE $2::int IS NULL
         OR (tier, disc, id) > ($2::int, $3::timestamptz, $4::text)
      ORDER BY tier, disc, id
      LIMIT $1`;

export interface CollectBatch {
  ids: string[];
  /** Where to resume; null when this batch finished the lap. */
  nextCursor: CollectCursor | null;
  /** True when the batch came up short, i.e. the lap is done. */
  lapComplete: boolean;
}

export async function selectUntouchedBatch(
  limit: number,
  cursor?: CollectCursor,
): Promise<CollectBatch> {
  const rows = await query<{ id: string; tier: number; disc: string | Date }>(
    COLLECT_IDS_SQL,
    [limit, cursor ? cursor.tier : null, cursor ? cursor.disc : null, cursor ? cursor.id : null],
  );
  const last = rows[rows.length - 1];
  const lapComplete = rows.length < limit;
  return {
    ids: rows.map((r) => r.id),
    nextCursor:
      last && !lapComplete
        ? { tier: Number(last.tier), disc: new Date(last.disc).toISOString(), id: last.id }
        : null,
    lapComplete,
  };
}

/** Back-compat wrapper: the first batch of a fresh lap. */
export async function selectUntouchedIds(limit: number): Promise<string[]> {
  return (await selectUntouchedBatch(limit)).ids;
}

/** needs_contact leads that have at least one email contact point NOBODY HAS
 *  RULED ON YET.
 *
 *  `verified = false` is not "still to check" — it is also the resting state of
 *  every address that has already been checked and failed, because Bloodhound
 *  writes `verified = false` both when ZeroBounce says undeliverable and when
 *  the identity gate rejects the address as somebody else's. Selecting on it
 *  alone re-hands the same dead addresses to the tool every cadence, which is
 *  exactly what happened on the lane's first night (2026-08-24): pass one
 *  checked 42 addresses and flipped 7, pass two three hours later re-selected
 *  84 of the same 91 leads, spent 34 more ZeroBounce credits and flipped 0.
 *  Left alone that is ~270 wasted credits a day, forever, and an ownership note
 *  re-appended to the same rows on every pass (83 rows had already collected
 *  more than one after two passes).
 *
 *  So exclude anything already ruled on, by either of the two marks Bloodhound
 *  writes: `verified_at` (ZeroBounce returned a verdict) and an `[ownership:`
 *  note (the identity gate rejected it before a credit was spent). The note
 *  test is what makes this self-healing on rows that pre-date the companion
 *  fix in youtube-email-outreach-v1, which now stamps `verified_at` on the
 *  ownership branch too. No backfill needed.
 *
 *  GROUP BY stands in for DISTINCT because Postgres requires ORDER BY
 *  expressions to appear in the select list under SELECT DISTINCT. */
export const VERIFIABLE_IDS_SQL = `SELECT lc.id
       FROM leads.lead_candidates lc
       JOIN leads.contact_points cp ON cp.lead_id = lc.id
      WHERE lc.review_status = 'needs_contact'
        AND lc.outreach_status = 'no_email_found'
        AND cp.kind IN ('business_email', 'personal_email', 'youtube_email')
        AND COALESCE(cp.verified, false) = false
        AND cp.verified_at IS NULL
        AND COALESCE(cp.notes, '') NOT LIKE '%[ownership:%'
        AND COALESCE(lc.do_not_contact, false) = false
      GROUP BY lc.id, lc.first_discovered_at
      ORDER BY lc.first_discovered_at ASC NULLS LAST
      LIMIT $1`;

export async function selectVerifiableIds(limit: number): Promise<string[]> {
  const rows = await query<{ id: string }>(VERIFIABLE_IDS_SQL, [limit]);
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

/**
 * Keep the recovery lane moving during the one halt it doesn't depend on.
 * Generic halt reasons still mean a full stop.
 */
export async function runRecoveryDuringOpenRouterHalt(
  haltReason: string,
  runLane: () => Promise<void>,
): Promise<boolean> {
  if (!haltReason.startsWith('HALT — OpenRouter account out of credits (')) return false;
  await runLane();
  return true;
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
      const batch = await selectUntouchedBatch(opts.collectBatch, state.collectCursor);
      const ids = batch.ids;
      // A short batch ends the lap wherever it happened, including the empty
      // case: clear the cursor so the next pass restarts from the top.
      const advance = (): void => {
        state.collectCursor = batch.nextCursor ?? undefined;
        if (batch.lapComplete) state.collectLaps = (state.collectLaps ?? 0) + 1;
      };
      if (ids.length === 0) {
        opts.log({ event: 'bloodhound_collect', skipped: 'lap_complete', laps: (state.collectLaps ?? 0) + 1 });
        advance();
        state.lastCollectAt = new Date().toISOString();
        if (!opts.dryRun) saveState(state);
        return;
      }
      if (opts.dryRun) {
        opts.log({ event: 'bloodhound_collect', dry_run: true, leads: ids.length, lap_complete: batch.lapComplete });
        return;
      }
      // The collect child used to run on stdio:'ignore'. That is why nobody saw
      // the lane produce nothing for four days: it fails, or finds nothing, in
      // total silence. Tee it to a log instead. Appending by fd works with
      // detached + unref, where an inherited stream would not survive the
      // parent exiting.
      const child = spawn(
        'npm', ['run', 'bloodhound', '--', '--lead-ids', ids.join(',')],
        { cwd: opts.emailRepoPath, stdio: ['ignore', collectLogFd(), collectLogFd()], detached: true },
      );
      // Without this handler a spawn failure (ENOENT etc.) throws as an
      // uncaught exception AFTER spawn returns, crashing the campaign's
      // finish block. The collect pass must never take the session down.
      child.on('error', (err) => {
        opts.log({ event: 'bloodhound_collect', spawn_error: err.message });
      });
      child.unref();
      // Advance BEFORE the child reports, because it never reports: it is
      // detached on purpose so the session's time budget goes to finder passes.
      // Worst case a failed batch is skipped until the next lap, which beats
      // the old behaviour of re-running the same failed batch every 6 hours.
      advance();
      state.collectPid = child.pid;
      state.lastCollectAt = new Date().toISOString();
      state.collectStartedAt = state.lastCollectAt;
      saveState(state);
      opts.log({
        event: 'bloodhound_collect',
        leads: ids.length,
        pid: child.pid,
        cursor_tier: batch.nextCursor?.tier ?? null,
        lap_complete: batch.lapComplete,
        laps: state.collectLaps ?? 0,
      });
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
