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
    llmCap: numFlag('--llm-cap', 0) || undefined,
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
