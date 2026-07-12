// Autopilot hourly check-in — code-first health check + guardrail (component B).
//
// Runs every hour with NO LLM cost. It reads the campaign's own logs, the burn ledger,
// and the quota file, applies the mechanical guardrails (halt on the Anthropic hard
// ceiling), and decides whether anything needs *intelligent* attention. Only when it
// finds a real, fixable anomaly does it exit 7 — the signal for checkin.sh to spend a
// `claude -p` fix-agent. Most hours it exits 0 and costs nothing.
//
// Exit codes:
//   0  healthy (or only a soft warning) — no agent needed
//   5  halt flag already present / just written — loop is stopping, no agent
//   7  anomaly needs a fix-agent (evidence written to logs/autopilot-attention.jsonl)
//
// Anomaly detection is deliberately tuned to the migration-class failures we actually
// hit: a finding-but-not-parking pipeline, repeated fatal error signatures, and the
// campaign-loop's own rapid-fail halt.

import 'dotenv/config';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeToday, pacificDate } from './burn-ledger.js';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
const HALT_FLAG = join(LOGS, 'autopilot-halt.flag');
const ATTENTION = join(LOGS, 'autopilot-attention.jsonl');

// Fatal signatures — the exact classes of migration/config break we've seen take the
// pipeline down. Any of these in a recent session log means "find but don't park" or a
// hard crash a fix-agent should investigate.
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
  const line: Attention = { ts: new Date().toISOString(), ...a };
  appendFileSync(ATTENTION, JSON.stringify(line) + '\n');
}

function main(): void {
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

  // 4) Finding-but-not-parking: recent sessions finish with parked_gain 0 while the
  //    finder is exiting cleanly (finds leads) — the exact shape of the skill-missing bug.
  const jf = newestCampaignJsonl();
  if (jf) {
    const ev = readEvents(jf);
    const dones = ev.filter((e) => e.event === 'done').slice(-3);
    const finderRuns = ev.filter((e) => e.event === 'finder_run').slice(-6);
    const finderOkCount = finderRuns.filter((e) => e.exit === 0).length;
    const parkedRecent = dones.reduce((s, e) => s + (Number(e.parked_gain) || 0), 0);
    if (dones.length >= 2 && parkedRecent === 0 && finderOkCount >= 3) {
      anomalies.push({
        kind: 'find_no_park',
        detail: `last ${dones.length} campaign sessions parked 0 to approved_hold while ${finderOkCount}/${finderRuns.length} recent finder passes exited 0 — pipeline finds but doesn't verify/park`,
      });
    }
  }

  // Soft warning is informational only — never spends an agent.
  const softNote = burn.over_soft ? ` [OVER SOFT $${burn.soft_usd}]` : '';

  if (anomalies.length === 0) {
    console.log(`[checkin ${day}] healthy — burn=$${burn.total_usd.toFixed(2)}/$${burn.hard_usd}${softNote}`);
    process.exit(0);
  }

  for (const a of anomalies) raiseAttention(a);
  console.log(`[checkin ${day}] ${anomalies.length} anomaly(ies) → fix-agent. burn=$${burn.total_usd.toFixed(2)}${softNote}`);
  for (const a of anomalies) console.log(`   - ${a.kind}: ${a.detail}`);
  process.exit(7);
}

main();
