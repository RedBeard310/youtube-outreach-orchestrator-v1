import 'dotenv/config';
import { getLeadsForOrchestration } from '../airtable.ts';
import { driveApproved } from '../drivers/approved.ts';
import { driveD100 } from '../drivers/d100.ts';
import { driveLeadFinder } from '../drivers/lead-finder.ts';
import { acquireLock, releaseLock } from '../lock.ts';
import { writeTickLog } from '../logger.ts';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const startedAt = new Date().toISOString();

  if (!acquireLock()) {
    console.error('[orchestrator] another tick is running (lockfile present); exiting');
    process.exit(0);
  }

  try {
    const leads = await getLeadsForOrchestration();
    const approved = leads.filter(l => l.review_status === 'approved');
    const d100 = leads.filter(l => l.review_status === 'D100');

    console.log(
      `[orchestrator] tick start ts=${startedAt} approved=${approved.length} d100=${d100.length} dry_run=${dryRun}`
    );

    const approvedResult = await driveApproved(approved, { dryRun });
    const d100Result = await driveD100(d100, { dryRun });
    // Lead-finder runs last so a long discovery run can't delay per-lead work.
    // It only fires if `LEAD_FINDER_INTERVAL_HOURS` has elapsed since its last
    // successful run (tracked in `logs/lead-finder-state.json`).
    const finderResult = await driveLeadFinder({ dryRun });

    writeTickLog({
      ts: startedAt,
      dry_run: dryRun,
      approved_processed: approvedResult.attempted,
      approved_exit: approvedResult.exit_code,
      approved_error: approvedResult.error ?? null,
      d100_processed: d100Result.attempted,
      d100_step_a_invoked: d100Result.step_a_invoked,
      d100_step_a_exit: d100Result.step_a_exit,
      d100_step_b_invoked: d100Result.step_b_invoked,
      d100_step_b_succeeded: d100Result.step_b_succeeded,
      d100_step_b_failed: d100Result.step_b_failed,
      d100_bootstrap_attempted: d100Result.bootstrap_attempted,
      d100_notes: d100Result.notes,
      finder_ran: finderResult.ran,
      finder_exit: finderResult.exit_code,
      finder_reason: finderResult.reason,
      finder_top_n: finderResult.top_n,
      finder_yield: finderResult.yield_breakdown,
    });

    console.log(`[orchestrator] tick done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrator] tick failed:', message);
    writeTickLog({ ts: startedAt, dry_run: dryRun, error: message });
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main();
