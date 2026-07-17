// On-demand "fire" step: write + send emails for approved leads that the tick
// has already prepped and parked at `enriched`. Fully decoupled from the tick —
// sending here touches nothing else. It does NOT find/verify, does NOT enrich,
// and does NOT clean the enrichment DB (that stays a separate manual step and
// only ever removes data for already-sent leads). "Everything lies in wait;
// shoot off emails whenever."
//
// Usage:
//   npm run send                       # fire every ready (enriched) approved lead
//   npm run send:dry                   # preview the exact shell-out, send nothing
//   npm run send -- --lead-ids a,b     # fire only these ids (must be ready)
//   npm run send -- --limit 25         # cap this batch
//
// Acquires the same lockfile as `npm run tick` so it can't overlap a running tick.
import 'dotenv/config';
import {
  getApprovedFireLeads,
  getLeadsByIds,
  isApprovedFireReady,
  type Lead,
} from '../airtable.ts';
import { driveApprovedSend } from '../drivers/approved.ts';
import { acquireLock, releaseLock } from '../lock.ts';
import { writeTickLog } from '../logger.ts';

function parseListFlag(flag: string): string[] | undefined {
  const idx = process.argv.indexOf(flag);
  const raw = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (!raw) return undefined;
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  return ids.length ? ids : undefined;
}

function parseNumericFlag(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) {
    const n = Number(process.argv[idx + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const ids = parseListFlag('--lead-ids');
  const limit = parseNumericFlag('--limit');
  const startedAt = new Date().toISOString();

  if (!acquireLock()) {
    console.error('[send] a tick or another send is running (lockfile present); try again later');
    process.exit(0);
  }

  try {
    let leads: Lead[];
    if (ids) {
      const fetched = await getLeadsByIds(ids);
      leads = fetched.filter(isApprovedFireReady);
      const notReady = fetched.length - leads.length;
      const missing = ids.length - fetched.length;
      if (notReady || missing) {
        console.warn(
          `[send] skipping ${notReady} supplied lead(s) not in a ready-to-send state` +
            `${missing ? ` and ${missing} not found` : ''}`,
        );
      }
    } else {
      leads = await getApprovedFireLeads();
    }

    if (limit && leads.length > limit) {
      console.log(`[send] capping batch at --limit ${limit} (of ${leads.length} ready)`);
      leads = leads.slice(0, limit);
    }

    console.log(`[send] ts=${startedAt} firing ${leads.length} ready lead(s) through compose+push dry_run=${dryRun}`);
    const result = await driveApprovedSend(leads, { dryRun });

    writeTickLog({
      ts: startedAt,
      dry_run: dryRun,
      manual_send_run: true,
      send_attempted: result.attempted,
      send_exit: result.exit_code,
      send_error: result.error ?? null,
    });
    console.log(`[send] done — attempted=${result.attempted} exit=${result.exit_code}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send] failed:', message);
    writeTickLog({ ts: startedAt, dry_run: dryRun, manual_send_run: true, error: message });
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main();
