import type { Lead } from '../airtable.ts';
import { runChild, runChildCapture } from '../run.ts';

export interface ApprovedResult {
  attempted: number;
  exit_code: number | null;
  error?: string;
  /** Per-status counts read off the child's `=== Final tally ===` block, or null
   *  when the child printed none (a dry run, or a crash before the summary). */
  outcomes?: Record<string, number> | null;
}

// youtube-email-outreach-v1 ends a run with:
//
//   === Final tally ===
//     sent_to_smartlead: 8
//     failed: 10
//
// and then exits 0 whether that read 18 sent or 18 failed, because a per-lead
// failure is deliberately not fatal to the batch. So the exit code cannot tell a
// clean send from a broken one, and until 2026-09-24 nothing else could either:
// the orchestrator logged `send_attempted=18 send_exit=0` for a run that lost ten
// finished emails to a network flap. Read the tally so the JSONL line says what
// actually happened.
export function parseFinalTally(output: string): Record<string, number> | null {
  const start = output.lastIndexOf('=== Final tally ===');
  if (start < 0) return null;
  const counts: Record<string, number> = {};
  for (const line of output.slice(start).split('\n').slice(1)) {
    const m = /^\s+([a-z_]+):\s*(\d+)\s*$/.exec(line);
    if (!m) {
      // The tally is a contiguous indented block; the first line that isn't one
      // ends it. Keep scanning past blank lines so a trailing newline doesn't
      // truncate a real tally.
      if (line.trim() === '') continue;
      break;
    }
    counts[m[1]] = Number(m[2]);
  }
  return Object.keys(counts).length ? counts : null;
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
  captureTally = false,
): Promise<ApprovedResult> {
  if (leads.length === 0) return { attempted: 0, exit_code: 0, outcomes: null };

  const repoPath = process.env.EMAIL_OUTREACH_REPO_PATH;
  if (!repoPath) throw new Error('EMAIL_OUTREACH_REPO_PATH is not set');

  const concurrency = process.env.APPROVED_CONCURRENCY ?? '4';
  const idCsv = leads.map(l => l.id).join(',');
  const args = ['run', 'outreach', '--', '--lead-ids', idCsv, '--concurrency', concurrency, ...extraArgs];

  if (opts.dryRun) {
    console.log(`[${label}] DRY RUN — would run in ${repoPath}: npm ${args.join(' ')}`);
    return { attempted: leads.length, exit_code: 0, outcomes: null };
  }

  console.log(`[${label}] ${humanAction} for ${leads.length} lead(s)`);
  if (!captureTally) {
    const result = await runChild('npm', args, repoPath);
    return { attempted: leads.length, exit_code: result.exit_code, error: result.error, outcomes: null };
  }
  // runChildCapture still tees the child to this terminal, so the visible output
  // is unchanged; it just also keeps a copy to read the tally out of.
  const result = await runChildCapture('npm', args, repoPath);
  const outcomes = parseFinalTally(`${result.stdout}\n${result.stderr}`);
  return { attempted: leads.length, exit_code: result.exit_code, error: result.error, outcomes };
}

// PREP (runs on the tick): find -> verify -> enrich, then park each lead at
// `outreach_status = ready_data_scraped` via `--stop-after enrich`. Compose and the
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
    'prepping (find -> verify -> enrich, parking at ready_data_scraped)',
    opts,
  );
}

// SEND (on-demand, `npm run send`): resume parked leads through compose -> push.
// Leads enter at `ready_data_scraped` (or `email_drafted` from a partial prior send); the
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
    true, // read the final tally: this is the money path, and its exit code is always 0
  );
}
