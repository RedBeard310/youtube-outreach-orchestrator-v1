// Autonomous approved_hold run session. Coordinates finder + overlapped verify +
// adaptive discovery until the parked-lead target is hit or a hard wall stops it.
// Acquires the same lockfile as `npm run tick` so it can't overlap a tick.
//
//   npm run campaign -- --target 500                 # full autonomous run
//   npm run campaign -- --target 500 --dry-run       # print the plan, touch nothing
//   npm run campaign -- --target 300 --max-runs 10 --top-n 8 --no-discovery
import 'dotenv/config';
import { driveCampaign, type CampaignOpts } from '../drivers/campaign.ts';
import { acquireLock, releaseLock } from '../lock.ts';

function numFlag(flag: string, dflt: number): number {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) {
    const n = Number(process.argv[i + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return dflt;
}

// Resilience net for a long autonomous run: a stray transient rejection (a network
// blip in a floating promise) should be logged LOUDLY, not hard-crash the process
// mid-campaign. The main loop already handles real stop conditions (target,
// max-runs, hard wall); this just prevents a momentary DNS/socket error from
// killing hours of progress. (Added after the 2026-07-10 ENOTFOUND crash.)
process.on('unhandledRejection', (reason) => {
  console.error('[campaign] UNHANDLED REJECTION (logged, not fatal):', reason instanceof Error ? (reason.stack ?? reason.message) : String(reason));
});

async function main(): Promise<void> {
  const opts: CampaignOpts = {
    target: numFlag('--target', 500),
    maxRuns: numFlag('--max-runs', 15),
    topN: numFlag('--top-n', 8),
    reservoirRuns: numFlag('--reservoir-runs', 6),
    fadeThreshold: numFlag('--fade-threshold', 12),
    discoveryCount: numFlag('--discovery-count', 40),
    discovery: !process.argv.includes('--no-discovery'),
    maxMinutes: numFlag('--max-minutes', 0),
    // 500 is the proven-best throughput setting (llm-cap 800 was ~60% slower for
    // only ~35% more yield, 2026-07-09). Override with --llm-cap.
    llmCap: numFlag('--llm-cap', 500),
    concurrentPasses: numFlag('--concurrent', 1),
    frontier: process.argv.includes('--frontier'),
    dryRun: process.argv.includes('--dry-run'),
  };

  if (!acquireLock()) {
    console.error('[campaign] tick in progress (lockfile present); try again later');
    process.exit(0);
  }
  try {
    await driveCampaign(opts);
  } catch (err) {
    console.error('[campaign] failed:', err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main();
