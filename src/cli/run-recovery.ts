// Standalone driver for the Bloodhound recovery lane (`needs_contact` -> `approved_hold`).
//
// WHY THIS EXISTS (2026-09-06)
// ----------------------------
// The lane used to run ONLY as the last step of a campaign session
// (`src/drivers/campaign.ts`, at the end of drivePass). That was fine while the
// campaign ran back-to-back all day. It stopped being fine on 2026-09-04, when
// campaign-loop.sh learned to sleep to the midnight-PT YouTube refill instead of
// retrying every 30 minutes — a good fix for the finder, which cannot work without
// quota, and a silent throttle on this lane, which spends NO YouTube quota at all.
// Collect passes went 4, 3, 4, 4, 2 across 09-01..09-05 on a 6h interval that
// should deliver 4, because the campaign was down ~14h a day and the lane slept
// with it.
//
// This lane is the pipeline's biggest producer of parked leads (627 on 09-03,
// against ~60/day from fresh finding), so tying its cadence to an unrelated
// resource was costing real leads every day.
//
// SAFE TO RUN OFTEN. runBloodhoundLane self-gates on its own state file
// (logs/bloodhound-lane-state.json): collect is due every
// BLOODHOUND_COLLECT_INTERVAL_HOURS (6), verify every
// BLOODHOUND_VERIFY_INTERVAL_HOURS (3), and anything not due is a no-op. The
// systemd timer therefore fires hourly and lets the lane decide, rather than
// encoding the schedule in two places that can disagree.
//
// It also takes NO tick lock, on purpose. Collect is a detached child doing HTTP
// against creators' own sites and verify only spends ZeroBounce credits; neither
// touches the send path, the enrichment bundles, or anything `npm run tick` and
// `npm run send` care about. The lane's own stale-PID guard
// (staleCollectAfterMs) is what prevents two collectors overlapping.
//
// Usage:
//   npm run recovery          # run whichever passes are due
//   npm run recovery:dry      # report what would run, touch nothing
import 'dotenv/config';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { laneOptsFromEnv, runBloodhoundLane } from '../recovery/bloodhound-lane.ts';

// A PATH IS CONFIGURATION, NOT A SECRET, SO IT GETS A COMMITTED DEFAULT.
// On 2026-09-01 Casey deleted the email repo's .env and every enrichment batch
// began failing instantly on a bare `ENRICHMENT_REPO_PATH is not set`, while the
// chain still reported healthy and exited 0 — the outage ran ~5h unseen. The fix
// there was a default in code, and the same reasoning applies here: this repo's
// own .env is the only thing currently supplying EMAIL_OUTREACH_REPO_PATH, and a
// timer that dies on a deleted dotfile is a lane that stops without saying so.
const DEFAULT_EMAIL_REPO = '/home/casey/repos/youtube-email-outreach-v1';

function emailRepo(): string {
  const p = process.env.EMAIL_OUTREACH_REPO_PATH?.trim();
  if (p) return p;
  if (existsSync(DEFAULT_EMAIL_REPO)) {
    console.warn(`[recovery] EMAIL_OUTREACH_REPO_PATH unset — using ${DEFAULT_EMAIL_REPO}`);
    return DEFAULT_EMAIL_REPO;
  }
  throw new Error('EMAIL_OUTREACH_REPO_PATH is not set and the default path does not exist');
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startedAt = new Date().toISOString();

  // Same daily-jsonl shape the campaign writes, so the debrief and check-in can
  // read lane events from one place regardless of which driver dispatched them.
  mkdirSync('logs', { recursive: true });
  const logFile = join('logs', `campaign-${startedAt.slice(0, 10)}.jsonl`);
  const log = (line: Record<string, unknown>) => {
    const row = { ts: new Date().toISOString(), dispatched_by: 'run-recovery', ...line };
    appendFileSync(logFile, JSON.stringify(row) + '\n');
    console.log(`[recovery] ${JSON.stringify(row)}`);
  };

  try {
    await runBloodhoundLane(laneOptsFromEnv(emailRepo(), dryRun, log));
    console.log(`[recovery] done (dry_run=${dryRun})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[recovery] failed:', message);
    log({ event: 'bloodhound_lane_error', error: message });
    process.exitCode = 1;
  }
}

main();
