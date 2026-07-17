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

// Shared shell-out to youtube-email-outreach-v1's `npm run outreach`. `extraArgs`
// selects the stage span: prep passes `--stop-after enrich`; send passes nothing
// (so the email repo's stage gates skip the already-done find/verify/enrich and
// only compose + push). All the real logic lives in the email repo — this repo
// just chooses which stages to run and hands over the lead ids.
async function runOutreach(
  leads: Lead[],
  extraArgs: string[],
  label: string,
  humanAction: string,
  opts: DriverOpts,
): Promise<ApprovedResult> {
  if (leads.length === 0) return { attempted: 0, exit_code: 0 };

  const repoPath = process.env.EMAIL_OUTREACH_REPO_PATH;
  if (!repoPath) throw new Error('EMAIL_OUTREACH_REPO_PATH is not set');

  const concurrency = process.env.APPROVED_CONCURRENCY ?? '4';
  const idCsv = leads.map(l => l.id).join(',');
  const args = ['run', 'outreach', '--', '--lead-ids', idCsv, '--concurrency', concurrency, ...extraArgs];

  if (opts.dryRun) {
    console.log(`[${label}] DRY RUN — would run in ${repoPath}: npm ${args.join(' ')}`);
    return { attempted: leads.length, exit_code: 0 };
  }

  console.log(`[${label}] ${humanAction} for ${leads.length} lead(s)`);
  const result = await runChild('npm', args, repoPath);
  return { attempted: leads.length, exit_code: result.exit_code, error: result.error };
}

// PREP (runs on the tick): find -> verify -> enrich, then park each lead at
// `outreach_status = enriched` via `--stop-after enrich`. Compose and the
// SmartLead push never fire here — those are the on-demand `npm run send` step.
// This is the decoupling (2026-07-17): every approved lead ends the tick "lying
// in wait, ready to write," and the tick never sends. Because the tick never
// reaches `sent_to_smartlead`, nothing it does can arm the enrichment-DB cleanup
// (which only ever targets already-sent leads).
export async function driveApprovedPrep(leads: Lead[], opts: DriverOpts = {}): Promise<ApprovedResult> {
  return runOutreach(
    leads,
    ['--stop-after', 'enrich'],
    'approved-prep',
    'prepping (find -> verify -> enrich, parking at enriched)',
    opts,
  );
}

// SEND (on-demand, `npm run send`): resume parked leads through compose -> push.
// Leads enter at `enriched` (or `email_drafted` from a partial prior send); the
// email repo's gates skip find/verify/enrich and only write + push to SmartLead.
// This is the only path that sends, and it runs exactly when you trigger it —
// writing/sending an email is now fully disconnected from everything else.
export async function driveApprovedSend(leads: Lead[], opts: DriverOpts = {}): Promise<ApprovedResult> {
  return runOutreach(
    leads,
    [],
    'approved-send',
    'writing + sending (compose -> push)',
    opts,
  );
}
