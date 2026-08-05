import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getLeadsDiscoveredSince, type Lead } from '../airtable.ts';
import { runChild } from '../run.ts';

const STATE_PATH = join('logs', 'lead-finder-state.json');

export interface YieldBreakdown {
  new_leads: number;
  by_signal_score: Record<string, number>;
  by_review_status: Record<string, number>;
  score_6_plus: number;
  host_identified: number;
  score_6_plus_AND_host_identified: number;
}

export interface LeadFinderResult {
  ran: boolean;
  reason: string;
  exit_code: number | null;
  hours_since_last: number | null;
  top_n: number | null;
  yield_breakdown: YieldBreakdown | null;
}

export interface DriverOpts {
  dryRun?: boolean;
  /** Bypass both the auto-disabled check and the interval gate. */
  force?: boolean;
  /** Override --top-n passed to the lead-finder agent. Default: agent's own default (8). */
  topN?: number;
  /** Override --llm-cap passed to the lead-finder agent. Default: agent's own default (500). */
  llmCap?: number;
  /** Override --max-channels-per-term. Default: agent's own default (50). Raise to crawl deeper for fresh channels. */
  maxChannelsPerTerm?: number;
  /** Slice offset into the ranked active-term queue (`--term-offset`). Used to run
   *  concurrent finder passes over DISJOINT term slices. Default 0. */
  termOffset?: number;
}

interface State {
  last_run_at?: string;
}

function readState(): State {
  if (!existsSync(STATE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8')) as State;
  } catch {
    return {};
  }
}

function writeState(state: State): void {
  mkdirSync('logs', { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

function buildBreakdown(newLeads: Lead[]): YieldBreakdown {
  const byScore: Record<string, number> = {};
  const byReview: Record<string, number> = {};
  let score6Plus = 0;
  let hostIdentified = 0;
  let both = 0;

  for (const lead of newLeads) {
    const score = lead.signal_score ?? null;
    const review = lead.review_status ?? '(null)';

    const scoreKey = score === null ? '(null)' : String(score);
    byScore[scoreKey] = (byScore[scoreKey] ?? 0) + 1;
    byReview[review] = (byReview[review] ?? 0) + 1;

    const passScore = score !== null && score >= 6;
    const passHost = review !== 'no_host_identified';

    if (passScore) score6Plus += 1;
    if (passHost) hostIdentified += 1;
    if (passScore && passHost) both += 1;
  }

  return {
    new_leads: newLeads.length,
    by_signal_score: byScore,
    by_review_status: byReview,
    score_6_plus: score6Plus,
    host_identified: hostIdentified,
    score_6_plus_AND_host_identified: both,
  };
}

export async function driveLeadFinder(opts: DriverOpts = {}): Promise<LeadFinderResult> {
  const repoPath = process.env.LEAD_FINDER_REPO_PATH;
  const intervalHours = Number(process.env.LEAD_FINDER_INTERVAL_HOURS ?? 24);
  const autoEnabled = process.env.LEAD_FINDER_AUTO === 'true';

  if (!repoPath) {
    return {
      ran: false,
      reason: 'LEAD_FINDER_REPO_PATH not set; skipping',
      exit_code: null,
      hours_since_last: null,
      top_n: opts.topN ?? null,
      yield_breakdown: null,
    };
  }

  const state = readState();
  let hoursSince: number | null = null;
  if (state.last_run_at) {
    const lastMs = Date.parse(state.last_run_at);
    hoursSince = (Date.now() - lastMs) / (1000 * 60 * 60);
  }

  if (!opts.force) {
    if (!autoEnabled) {
      return {
        ran: false,
        reason: 'LEAD_FINDER_AUTO=false; finder runs only on `npm run finder`',
        exit_code: null,
        hours_since_last: hoursSince,
        top_n: opts.topN ?? null,
        yield_breakdown: null,
      };
    }
    if (hoursSince !== null && hoursSince < intervalHours) {
      return {
        ran: false,
        reason: `last ran ${hoursSince.toFixed(1)}h ago; interval is ${intervalHours}h`,
        exit_code: null,
        hours_since_last: hoursSince,
        top_n: opts.topN ?? null,
        yield_breakdown: null,
      };
    }
  }

  const args = ['run', 'agent'];
  if (opts.topN !== undefined || opts.llmCap !== undefined || opts.maxChannelsPerTerm !== undefined || opts.termOffset) {
    args.push('--');
    if (opts.topN !== undefined) args.push('--top-n', String(opts.topN));
    if (opts.llmCap !== undefined) args.push('--llm-cap', String(opts.llmCap));
    if (opts.maxChannelsPerTerm !== undefined)
      args.push('--max-channels-per-term', String(opts.maxChannelsPerTerm));
    if (opts.termOffset) args.push('--term-offset', String(opts.termOffset));
  }

  if (opts.dryRun) {
    console.log(`[lead-finder] DRY RUN — would run "npm ${args.join(' ')}" in ${repoPath}`);
    return {
      ran: true,
      reason: 'dry run',
      exit_code: 0,
      hours_since_last: hoursSince,
      top_n: opts.topN ?? null,
      yield_breakdown: null,
    };
  }

  // Capture the start time so we can identify leads discovered by THIS run.
  const runStartedAt = new Date().toISOString();
  console.log(
    `[lead-finder] running (top-n=${opts.topN ?? 'default'}, llm-cap=${opts.llmCap ?? 'default'}, last=${state.last_run_at ?? 'never'})`
  );
  const result = await runChild('npm', args, repoPath);

  let breakdown: YieldBreakdown | null = null;
  if (result.exit_code === 0) {
    writeState({ last_run_at: new Date().toISOString() });
    try {
      const newLeads = await getLeadsDiscoveredSince(runStartedAt);
      breakdown = buildBreakdown(newLeads);
      console.log(
        `[lead-finder] yield: ${breakdown.new_leads} new leads | ` +
          `score≥6: ${breakdown.score_6_plus} | ` +
          `host_identified: ${breakdown.host_identified} | ` +
          `both: ${breakdown.score_6_plus_AND_host_identified} | ` +
          `scoring_failed: ${breakdown.by_review_status.scoring_failed ?? 0}`
      );
    } catch (e) {
      console.error('[lead-finder] failed to query post-run breakdown:', e);
    }
  }

  return {
    ran: true,
    reason: result.exit_code === 0 ? 'completed' : `exit ${result.exit_code}${result.error ? `: ${result.error}` : ''}`,
    exit_code: result.exit_code,
    hours_since_last: hoursSince,
    top_n: opts.topN ?? null,
    yield_breakdown: breakdown,
  };
}
