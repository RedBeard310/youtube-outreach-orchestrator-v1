// Anthropic burn ledger for the autopilot loop.
//
// The autopilot's dominant, *exactly-measurable* cost is its own headless `claude -p`
// runs (each returns `total_cost_usd` in its JSON result). This ledger records those,
// plus optional pipeline-LLM estimates, into logs/burn-<pacific-date>.jsonl, and sums
// the day against the soft/hard ceilings so the check-in can throttle or halt.
//
// The "day" is the America/Los_Angeles day — it lines up with the midnight-PT cycle
// boundary and the direct-YouTube-key quota reset.
//
// Usage:
//   tsx scripts/autopilot/burn-ledger.ts record --source checkin --usd 0.25 [--model opus] [--note "..."]
//   tsx scripts/autopilot/burn-ledger.ts from-claude <result.json> --source checkin
//   tsx scripts/autopilot/burn-ledger.ts today [--json]
//
// `today` exit code: 0 = under soft, 10 = over soft (warn), 20 = over hard (halt).
// Ceilings via env: ANTHROPIC_SOFT_USD (default 75), ANTHROPIC_HARD_USD (default 150).

import 'dotenv/config';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR = 'logs';

export function pacificDate(d: Date = new Date()): string {
  // en-CA yields YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function ledgerPath(date = pacificDate()): string {
  return join(LOG_DIR, `burn-${date}.jsonl`);
}

export interface BurnRecord {
  ts: string;
  source: string; // checkin | debrief | pipeline | manual
  usd: number;
  model?: string;
  note?: string;
}

export function recordBurn(rec: Omit<BurnRecord, 'ts'>): void {
  mkdirSync(LOG_DIR, { recursive: true });
  const line: BurnRecord = { ts: new Date().toISOString(), ...rec };
  appendFileSync(ledgerPath(), JSON.stringify(line) + '\n');
}

export interface BurnSummary {
  date: string;
  total_usd: number;
  by_source: Record<string, number>;
  soft_usd: number;
  hard_usd: number;
  over_soft: boolean;
  over_hard: boolean;
}

export function summarizeToday(date = pacificDate()): BurnSummary {
  const soft = Number(process.env.ANTHROPIC_SOFT_USD ?? 75);
  const hard = Number(process.env.ANTHROPIC_HARD_USD ?? 150);
  const bySource: Record<string, number> = {};
  let total = 0;
  const path = ledgerPath(date);
  if (existsSync(path)) {
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      try {
        const r = JSON.parse(raw) as BurnRecord;
        const usd = Number(r.usd) || 0;
        total += usd;
        bySource[r.source] = (bySource[r.source] ?? 0) + usd;
      } catch {
        // skip malformed line — never let a bad row hide real spend
      }
    }
  }
  total = Math.round(total * 10000) / 10000;
  return {
    date,
    total_usd: total,
    by_source: bySource,
    soft_usd: soft,
    hard_usd: hard,
    over_soft: total >= soft,
    over_hard: total >= hard,
  };
}

// Pull total_cost_usd out of a `claude -p --output-format json` result file.
function costFromClaudeJson(file: string): { usd: number; model?: string } {
  const j = JSON.parse(readFileSync(file, 'utf8'));
  const usd = Number(j.total_cost_usd) || 0;
  // pick the priciest model as the label, if present
  let model: string | undefined;
  const mu = j.usage?.modelUsage ?? j.modelUsage;
  if (mu && typeof mu === 'object') {
    let best = -1;
    for (const [name, u] of Object.entries(mu as Record<string, { costUSD?: number }>)) {
      const c = Number(u?.costUSD) || 0;
      if (c > best) { best = c; model = name; }
    }
  }
  return { usd, model };
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const cmd = process.argv[2];

  if (cmd === 'record') {
    const usd = Number(flag('--usd'));
    if (!Number.isFinite(usd)) { console.error('record: --usd <number> required'); process.exit(1); }
    recordBurn({
      source: flag('--source') ?? 'manual',
      usd,
      model: flag('--model'),
      note: flag('--note'),
    });
    console.log(`recorded $${usd.toFixed(4)} (${flag('--source') ?? 'manual'})`);
    return;
  }

  if (cmd === 'from-claude') {
    const file = process.argv[3];
    if (!file || !existsSync(file)) { console.error('from-claude <result.json> required'); process.exit(1); }
    const { usd, model } = costFromClaudeJson(file);
    recordBurn({ source: flag('--source') ?? 'checkin', usd, model, note: flag('--note') });
    console.log(`recorded $${usd.toFixed(4)} from ${file} (model=${model ?? '?'})`);
    return;
  }

  if (cmd === 'today' || cmd === undefined) {
    const s = summarizeToday();
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(s));
    } else {
      console.log(`[burn ${s.date}] $${s.total_usd.toFixed(2)} / soft $${s.soft_usd} / hard $${s.hard_usd}`);
      for (const [src, usd] of Object.entries(s.by_source).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${src.padEnd(10)} $${usd.toFixed(2)}`);
      }
    }
    process.exit(s.over_hard ? 20 : s.over_soft ? 10 : 0);
  }

  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

main();
