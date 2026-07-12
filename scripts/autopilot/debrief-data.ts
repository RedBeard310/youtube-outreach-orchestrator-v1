// Autopilot debrief data-gatherer (feeds component D).
//
// Emits a compact JSON snapshot of the cycle (midnight-PT → now) so the daily debrief
// agent writes a report grounded in real numbers, not guesses. Reuses the campaign's own
// Airtable helpers + the campaign JSONL. Prints JSON to stdout; also writes it to
// logs/autopilot-debrief-<pacific-date>.json.

import 'dotenv/config';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { countByReviewStatus, getLeadsDiscoveredSince, type Lead } from '../../src/airtable.ts';
import { summarizeToday, pacificDate } from './burn-ledger.js';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');

// UTC instant of midnight America/Los_Angeles for the current cycle.
function pacificMidnightISO(now = new Date()): string {
  const pdate = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  const guess = new Date(`${pdate}T00:00:00Z`);
  const asPT = new Date(guess.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const asUTC = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = asUTC.getTime() - asPT.getTime();
  return new Date(guess.getTime() + offsetMs).toISOString();
}

function readJsonl(file: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try { out.push(JSON.parse(raw)); } catch { /* skip */ }
  }
  return out;
}

// All campaign events at/after the cycle start (spans the UTC-dated files).
function cycleCampaignEvents(sinceISO: string): Array<Record<string, unknown>> {
  const ev: Array<Record<string, unknown>> = [];
  for (const f of readdirSync(LOGS)) {
    if (!/^campaign-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    for (const e of readJsonl(join(LOGS, f))) {
      const ts = typeof e.ts === 'string' ? e.ts : '';
      if (ts >= sinceISO) ev.push(e);
    }
  }
  return ev;
}

function parkedAtCycleStart(sinceISO: string): number | null {
  const f = join(LOGS, 'autopilot-parked-history.jsonl');
  if (!existsSync(f)) return null;
  const hist = readJsonl(f) as unknown as Array<{ ts: string; parked: number }>;
  const inCycle = hist.filter((p) => p.ts >= sinceISO).sort((a, b) => a.ts.localeCompare(b.ts));
  return inCycle.length ? inCycle[0].parked : null;
}

const FATAL_PATTERNS: Array<[string, RegExp]> = [
  ['module_not_found', /ERR_MODULE_NOT_FOUND|Cannot find package/],
  ['missing_skill', /ENOENT[^\n]*\.claude\/skills/],
  ['bad_backend', /must be "rapidapi" or "direct"/],
  ['finder_hard_wall', /two consecutive finder failures/],
  ['find_enoent', /FAILED: ENOENT/],
];

function fatalSignaturesToday(sinceMs: number): string[] {
  const found = new Set<string>();
  const dirs = [join(LOGS, 'autopilot-sessions'), LOGS];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!/session-.*\.log$|campaign-console-.*\.log$/.test(f)) continue;
      const p = join(d, f);
      try {
        if (statSync(p).mtimeMs < sinceMs) continue;
        const tail = readFileSync(p, 'utf8').slice(-60000);
        for (const [name, re] of FATAL_PATTERNS) if (re.test(tail)) found.add(name);
      } catch { /* skip */ }
    }
  }
  return [...found];
}

async function main(): Promise<void> {
  const now = new Date();
  const date = pacificDate(now);
  const sinceISO = pacificMidnightISO(now);
  const sinceMs = Date.parse(sinceISO);

  const [parkedNow, needsContact] = await Promise.all([
    countByReviewStatus('approved_hold'),
    countByReviewStatus('needs_contact'),
  ]);

  const discovered: Lead[] = await getLeadsDiscoveredSince(sinceISO).catch(() => []);
  const pitchable = discovered.filter((l) => (l.signal_score ?? 0) >= 6);
  const byNiche: Record<string, number> = {};
  for (const l of pitchable) {
    const k = l.niche_category ?? '?';
    byNiche[k] = (byNiche[k] ?? 0) + 1;
  }
  const byReview: Record<string, number> = {};
  for (const l of discovered) {
    const k = l.review_status ?? '?';
    byReview[k] = (byReview[k] ?? 0) + 1;
  }
  const emailVerified = discovered.filter((l) => l.outreach_status === 'email_verified').length;

  const ev = cycleCampaignEvents(sinceISO);
  const count = (name: string) => ev.filter((e) => e.event === name).length;
  const sum = (name: string, field: string) =>
    ev.filter((e) => e.event === name).reduce((s, e) => s + (Number(e[field]) || 0), 0);

  const parkedStart = parkedAtCycleStart(sinceISO);
  const burn = summarizeToday(date);

  const snapshot = {
    date,
    cycle_start_iso: sinceISO,
    generated_at: now.toISOString(),
    parked: {
      approved_hold_now: parkedNow,
      approved_hold_at_cycle_start: parkedStart,
      parked_today: parkedStart === null ? null : parkedNow - parkedStart,
      done_parked_gain_sum: sum('done', 'parked_gain'),
      needs_contact_now: needsContact,
    },
    discovered_today: {
      total: discovered.length,
      pitchable_score_ge6: pitchable.length,
      email_verified: emailVerified,
      by_niche_pitchable: byNiche,
      by_review_status: byReview,
    },
    campaign: {
      sessions_started: count('start'),
      sessions_done: count('done'),
      finder_runs: count('finder_run'),
      fresh_pitchable_sum: sum('finder_run', 'fresh_pitchable'),
      fades: count('fade_detected'),
      discovers: count('discover'),
      promotes: count('promote'),
      hard_stops: count('hard_stop'),
      quota_stops: count('quota_stop'),
      time_budget_stops: count('time_budget_stop'),
    },
    burn_today: { total_usd: burn.total_usd, by_source: burn.by_source, soft: burn.soft_usd, hard: burn.hard_usd },
    fatal_signatures_today: fatalSignaturesToday(sinceMs),
    references: {
      prior_debrief_html: '/home/casey/repos/casey-assistant/brain/lead-gen/runs/lead-run-2026-07-10.html',
      index_md: '/home/casey/repos/casey-assistant/brain/lead-gen/INDEX.md',
      runs_dir: '/home/casey/repos/casey-assistant/brain/lead-gen/runs',
      playbook: '/home/casey/repos/casey-assistant/brain/lead-gen/youtube-run-playbook.md',
    },
  };

  const outFile = join(LOGS, `autopilot-debrief-${date}.json`);
  writeFileSync(outFile, JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot, null, 2));
}

main().catch((e) => { console.error(`[debrief-data] fatal: ${e instanceof Error ? e.stack : e}`); process.exit(1); });
