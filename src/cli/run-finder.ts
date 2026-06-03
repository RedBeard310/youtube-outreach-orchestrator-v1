// Manually trigger the lead-finder. Bypasses LEAD_FINDER_AUTO and the
// interval gate. Acquires the same lockfile as `npm run tick` so it can't
// overlap with a tick in progress.
import 'dotenv/config';
import { driveLeadFinder } from '../drivers/lead-finder.ts';
import { acquireLock, releaseLock } from '../lock.ts';
import { writeTickLog } from '../logger.ts';

function parseNumericFlag(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const prefix = `${flag}=`;
  for (const arg of process.argv) {
    if (arg.startsWith(prefix)) {
      const n = Number(arg.slice(prefix.length));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return undefined;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const topN = parseNumericFlag('--top-n');
  const llmCap = parseNumericFlag('--llm-cap');
  const startedAt = new Date().toISOString();

  if (!acquireLock()) {
    console.error('[finder] tick in progress (lockfile present); try again later');
    process.exit(0);
  }

  try {
    console.log(`[finder] manual run ts=${startedAt} dry_run=${dryRun} top_n=${topN ?? 'default'} llm_cap=${llmCap ?? 'default'}`);
    const result = await driveLeadFinder({ dryRun, force: true, topN, llmCap });
    writeTickLog({
      ts: startedAt,
      dry_run: dryRun,
      manual_finder_run: true,
      finder_ran: result.ran,
      finder_exit: result.exit_code,
      finder_reason: result.reason,
      finder_top_n: result.top_n,
      finder_yield: result.yield_breakdown,
    });
    console.log(`[finder] done — ran=${result.ran} exit=${result.exit_code} reason="${result.reason}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[finder] failed:', message);
    writeTickLog({ ts: startedAt, dry_run: dryRun, manual_finder_run: true, error: message });
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main();
