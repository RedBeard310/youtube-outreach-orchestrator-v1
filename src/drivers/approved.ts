import type { Lead } from '../airtable.ts';
import { runChild } from '../run.ts';

export interface ApprovedResult {
  attempted: number;
  exit_code: number | null;
  error?: string;
}

export interface DriverOpts {
  dryRun?: boolean;
}

export async function driveApproved(leads: Lead[], opts: DriverOpts = {}): Promise<ApprovedResult> {
  if (leads.length === 0) return { attempted: 0, exit_code: 0 };

  const repoPath = process.env.EMAIL_OUTREACH_REPO_PATH;
  if (!repoPath) throw new Error('EMAIL_OUTREACH_REPO_PATH is not set');

  const concurrency = process.env.APPROVED_CONCURRENCY ?? '4';
  const idCsv = leads.map(l => l.id).join(',');
  const args = ['run', 'outreach', '--', '--lead-ids', idCsv, '--concurrency', concurrency];

  if (opts.dryRun) {
    console.log(`[approved] DRY RUN — would run in ${repoPath}: npm ${args.join(' ')}`);
    return { attempted: leads.length, exit_code: 0 };
  }

  console.log(`[approved] driving ${leads.length} leads through full outreach pipeline`);
  const result = await runChild('npm', args, repoPath);
  return { attempted: leads.length, exit_code: result.exit_code, error: result.error };
}
