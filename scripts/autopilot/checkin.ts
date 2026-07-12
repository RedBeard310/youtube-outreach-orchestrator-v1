// Autopilot hourly check-in — code-first health check + guardrail (component B).
//
// Runs every hour with NO LLM cost. It reads the campaign's own logs, the burn ledger,
// the quota file, and the live approved_hold count, applies the mechanical guardrails
// (halt on the Anthropic hard ceiling), and decides whether anything needs *intelligent*
// attention. Only when it finds a real, fixable anomaly does it exit 7 — the signal for
// checkin.sh to spend a `claude -p` fix-agent. Most hours it exits 0 and costs nothing.
//
// Exit codes:
//   0  healthy (or only a soft warning) — no agent needed
//   5  halt flag already present / just written — loop is stopping, no agent
//   7  anomaly needs a fix-agent (evidence written to logs/autopilot-attention.jsonl)
//
// Anomaly detection is tuned to the migration-class failures we actually hit: repeated
// fatal error signatures, and a finding-but-not-parking pipeline (approved_hold flat
// across consecutive check-ins while the finder keeps exiting cleanly).

import 'dotenv/config';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeToday, pacificDate } from './burn-ledger.js';
import { countByReviewStatus } from '../../src/airtable.ts';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
const HALT_FLAG = join(LOGS, 'autopilot-halt.flag');
const ATTENTION = join(LOGS, 'autopilot-attention.jsonl');
const PARKED_HIST = join(LOGS, 'autopilot-parked-history.jsonl');

// How long approved_hold may stay flat (while the finder is working) before we treat it
// as a broken verify/park path. In minutes.
const FLAT_PARK_MINUTES = Number(process.env.AUTOPILOT_FLAT_PARK_MINUTES ?? 100);

// Fatal signatures — the exact classes of migration/config break we've seen take the
// pipeline down. Any in a recent session log means a crash a fix-agent should investigate.
const FATAL_PATTERNS = [
  /ERR_MODULE_NOT_FOUND/,
  /Cannot find package/,
  /ENOENT[^\n]*\.claude\/skills/,
  /must be "rapidapi" or "direct"/,
  /two consecutive finder failures/,
  /FAILED: ENOENT/,
];

function newestCampaignJsonl(): string | null {
  const files = readdirSync(LOGS)
    .filter((f) => /^campaign-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .map((f) => join(LOGS, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return files[0] ?? null;
}

function readEvents(file: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try { out.push(JSON.parse(raw)); } catch { /* skip */ }
  }
  return out;
}

function recentFinderOkCount(): { ok: number; total: number } {
  const jf = newestCampaignJsonl();
  if (!jf) return { ok: 0, total: 0 };
  const runs = readEvents(jf).filter((e) => e.event === 'finder_run').slice(-6);
  return { ok: runs.filter((e) => e.exit === 0).length, total: runs.length };
}

// The 1-2 most-recent session logs the campaign-loop wrote (fallback: console logs).
function recentSessionLogs(n = 2): string[] {
  const dirs = [join(LOGS, 'autopilot-sessions'), LOGS];
  const cands: string[] = [];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (/session-.*\.log$/.test(f) || /campaign-console-.*\.log$/.test(f)) cands.push(join(d, f));
    }
  }
  return cands.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs).slice(0, n);
}

interface Attention { ts: string; kind: string; detail: string; evidence?: string }
function raiseAttention(a: Omit<Attention, 'ts'>): void {
  appendFileSync(ATTENTION, JSON.stringify({ ts: new Date().toISOString(), ...a }) + '\n');
}

interface ParkedPoint { ts: string; parked: number }
function readParkedHistory(): ParkedPoint[] {
  if (!existsSync(PARKED_HIST)) return [];
  const out: ParkedPoint[] = [];
  for (const raw of readFileSync(PARKED_HIST, 'utf8').split('\n')) {
    if (!raw.trim()) continue;
    try { out.push(JSON.parse(raw)); } catch { /* skip */ }
  }
  return out;
}

async function main(): Promise<void> {
  const burn = summarizeToday();
  const day = pacificDate();

  // 1) Halt flag already up → loop is stopping; nothing for the agent to do.
  if (existsSync(HALT_FLAG)) {
    console.log(`[checkin ${day}] HALT flag present — loop stopping. burn=$${burn.total_usd.toFixed(2)}`);
    process.exit(5);
  }

  // 2) Hard $ ceiling → write halt flag ourselves (mechanical, no agent).
  if (burn.over_hard) {
    writeFileSync(HALT_FLAG, `Anthropic hard ceiling $${burn.hard_usd} breached (spent $${burn.total_usd.toFixed(2)}) at ${new Date().toISOString()}\n`);
    console.log(`[checkin ${day}] HARD ceiling breached ($${burn.total_usd.toFixed(2)}/$${burn.hard_usd}) — halt flag written`);
    process.exit(5);
  }

  const anomalies: Array<Omit<Attention, 'ts'>> = [];

  // 3) Fatal error signatures in recent session logs.
  for (const f of recentSessionLogs(2)) {
    let tail = '';
    try { tail = readFileSync(f, 'utf8').slice(-40000); } catch { continue; }
    for (const p of FATAL_PATTERNS) {
      const m = tail.match(p);
      if (m) { anomalies.push({ kind: 'fatal_signature', detail: `pattern ${p} in ${f}`, evidence: m[0] }); break; }
    }
  }

  // 4) Finding-but-not-parking: approved_hold flat for FLAT_PARK_MINUTES while the finder
  //    keeps exiting 0 — the exact shape of the skill-missing bug we hit this migration.
  //    Uses the live Airtable count vs a rolling history file (robust across long sessions).
  let parked: number | null = null;
  try {
    parked = await countByReviewStatus('approved_hold');
    appendFileSync(PARKED_HIST, JSON.stringify({ ts: new Date().toISOString(), parked }) + '\n');
    const hist = readParkedHistory();
    const cutoff = Date.now() - FLAT_PARK_MINUTES * 60000;
    const older = hist.filter((p) => Date.parse(p.ts) <= cutoff);
    const baseline = older.length ? older[older.length - 1] : null; // most recent point older than the window
    const finder = recentFinderOkCount();
    if (baseline && parked <= baseline.parked && finder.ok >= 3) {
      anomalies.push({
        kind: 'find_no_park',
        detail: `approved_hold flat at ${parked} for ≥${FLAT_PARK_MINUTES}min (was ${baseline.parked} at ${baseline.ts}) while ${finder.ok}/${finder.total} recent finder passes exited 0 — pipeline finds but doesn't verify/park`,
      });
    }
  } catch (e) {
    // Airtable blip — do NOT treat as an anomaly (transient); just note it.
    console.log(`[checkin ${day}] note: approved_hold count unavailable (${e instanceof Error ? e.message : String(e)})`);
  }

  const softNote = burn.over_soft ? ` [OVER SOFT $${burn.soft_usd}]` : '';
  const parkedNote = parked === null ? '' : ` parked=${parked}`;

  if (anomalies.length === 0) {
    console.log(`[checkin ${day}] healthy — burn=$${burn.total_usd.toFixed(2)}/$${burn.hard_usd}${parkedNote}${softNote}`);
    process.exit(0);
  }

  for (const a of anomalies) raiseAttention(a);
  console.log(`[checkin ${day}] ${anomalies.length} anomaly(ies) → fix-agent. burn=$${burn.total_usd.toFixed(2)}${parkedNote}${softNote}`);
  for (const a of anomalies) console.log(`   - ${a.kind}: ${a.detail}`);
  process.exit(7);
}

main().catch((e) => { console.error(`[checkin] fatal: ${e instanceof Error ? e.stack : e}`); process.exit(1); });
