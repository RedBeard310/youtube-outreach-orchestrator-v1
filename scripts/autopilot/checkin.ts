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
import { appendFileSync, existsSync, openSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { summarizeToday, pacificDate } from './burn-ledger.js';
import { countByReviewStatus } from '../../src/airtable.ts';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
const HALT_FLAG = join(LOGS, 'autopilot-halt.flag');
const ATTENTION = join(LOGS, 'autopilot-attention.jsonl');
const OBSERVATIONS = join(LOGS, 'autopilot-observations.jsonl');
const PARKED_HIST = join(LOGS, 'autopilot-parked-history.jsonl');

// How long approved_hold may stay flat (while the finder is working) before we treat it
// as a broken verify/park path. In minutes.
const FLAT_PARK_MINUTES = Number(process.env.AUTOPILOT_FLAT_PARK_MINUTES ?? 100);

// Term-supply-wall detection window (see the starvation heartbeat below). How many of the
// most-recent finder passes to inspect, and the max total fresh-pitchable across them that
// still counts as "near-dry". Observability only — never triggers the paid fix-agent.
const STARVATION_WINDOW = Number(process.env.AUTOPILOT_STARVATION_WINDOW ?? 6);
const STARVATION_MAX_PITCHABLE = Number(process.env.AUTOPILOT_STARVATION_MAX_PITCHABLE ?? 1);

// Minimum fresh-pitchable supply across the same recent window before a flat approved_hold
// count is treated as a broken verify/park path (find_no_park below). Below this, a flat
// count is fully explained by low supply (drought/vein-fading) — nothing to park yet, not a
// bug — and must not fire the alarm. Matches campaign.ts's own fadeThreshold (12): that's
// already the codebase's definition of "not enough fresh leads to expect real conversion".
const MIN_SUPPLY_FOR_PARK_ALARM = Number(process.env.AUTOPILOT_MIN_SUPPLY_FOR_PARK_ALARM ?? 12);

// Backstop keyword-harvest kick (2026-07-17). Casey's standing rule: a multi-hour
// zero-new-leads stretch must ALWAYS kick the keyword engine. The campaign's own STOCK-UP
// path (campaign.ts) is the primary, ~30-min trigger; this hourly check-in is the
// independent belt-and-suspenders that fires even if the campaign's gate is somehow
// bypassed or the campaign is between sessions. Cooldown-gated across BOTH harvest state
// files so a genuine autocomplete saturation can't churn a harvest every single hour.
const FINDER_REPO = process.env.LEAD_FINDER_REPO_PATH ?? '/home/casey/repos/youtube-lead-finder-v1';
const HARVEST_KICK_STATE = join(LOGS, 'autopilot-harvest-kick-state.json');
const HARVEST_KICK_INTERVAL_H = Number(process.env.AUTOPILOT_HARVEST_KICK_INTERVAL_HOURS ?? 2);

// Fatal signatures — the exact classes of migration/config break we've seen take the
// pipeline down. Any in a recent session log means a crash a fix-agent should investigate.
const CONSECUTIVE_FINDER_FAILURES = /two consecutive finder failures/;
const FATAL_PATTERNS = [
  /ERR_MODULE_NOT_FOUND/,
  /Cannot find package/,
  /ENOENT[^\n]*\.claude\/skills/,
  /YOUTUBE_API_BACKEND must be/,
  CONSECUTIVE_FINDER_FAILURES,
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

// Fresh-pitchable / failure profile of the last N finder passes — the raw signal for the
// term-supply-wall heartbeat. A dry wall shows up as the finder either exiting nonzero
// (aborting on "No active terms") or exiting 0 with ~0 fresh pitchable across a run of
// passes, while approved_hold stays legitimately flat (nothing to park).
function recentFinderStats(n: number): { total: number; failed: number; zeroYield: number; pitchable: number } {
  const jf = newestCampaignJsonl();
  if (!jf) return { total: 0, failed: 0, zeroYield: 0, pitchable: 0 };
  const runs = readEvents(jf).filter((e) => e.event === 'finder_run').slice(-n);
  let failed = 0, zeroYield = 0, pitchable = 0;
  for (const r of runs) {
    const exit = r.exit;
    const fp = typeof r.fresh_pitchable === 'number' ? r.fresh_pitchable : 0;
    if (exit !== 0 && exit !== null && exit !== undefined) failed++;
    else if (fp === 0) zeroYield++;
    pitchable += fp;
  }
  return { total: runs.length, failed, zeroYield, pitchable };
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

// Is the public autocomplete endpoint currently IP-blocking us? Two signals in the recent
// session logs: (a) the harvest's explicit AUTOCOMPLETE_ENDPOINT_BLOCKED marker (finder
// circuit-breaker, 2026-07-17), or (b) a dense run of autocomplete "failed: HTTP 403" lines
// (belt-and-suspenders for logs written before the breaker deploys — the 2026-07-17 drought
// buried 22k of them). When blocked, a keyword-harvest kick is futile AND counterproductive
// (it just hammers the blocked endpoint, deepening the block), so the starvation backstop
// must NOT fire one — it's an infra remedy (rotate egress IP / proxy / wait), not a code fix.
function autocompleteBlocked(): boolean {
  for (const f of recentSessionLogs(2)) {
    let body = '';
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    if (body.includes('AUTOCOMPLETE_ENDPOINT_BLOCKED')) return true;
    const m = body.match(/failed: HTTP 403/g);
    if (m && m.length >= 50) return true;
  }
  return false;
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

// Hours since the LAST keyword harvest by EITHER trigger — the check-in's own backstop kick
// or the campaign's STOCK-UP harvest. Reading both prevents the two mechanisms from piling
// redundant harvests on the same drought.
function hoursSinceAnyHarvest(): number {
  let min = Infinity;
  for (const f of [HARVEST_KICK_STATE, join(LOGS, 'keyword-harvest-state.json')]) {
    try {
      const s = JSON.parse(readFileSync(f, 'utf8')) as { last?: string };
      const t = s.last ? Date.parse(s.last) : NaN;
      if (Number.isFinite(t)) min = Math.min(min, (Date.now() - t) / 3_600_000);
    } catch { /* no state / unreadable → treat as long ago */ }
  }
  return min;
}

// Fire scripts/keyword-harvest.ts in the finder repo, detached, if we haven't harvested
// within the cooldown. Fire-and-forget: the harvest writes fresh probe terms to Airtable
// that the next campaign pass consumes; the check-in must stay fast and free, so it does not
// wait on the result. Returns true if a harvest was launched.
function kickKeywordHarvest(reason: string): boolean {
  if (hoursSinceAnyHarvest() < HARVEST_KICK_INTERVAL_H) return false;
  const cap = process.env.KEYWORD_HARVEST_CAP ?? '200';
  const logFile = join(LOGS, `harvest-kick-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
  try {
    const out = openSync(logFile, 'a');
    const child = spawn('npx', ['tsx', 'scripts/keyword-harvest.ts', '--apply', '--cap', cap], {
      cwd: FINDER_REPO, detached: true, stdio: ['ignore', out, out],
    });
    child.unref();
    writeFileSync(HARVEST_KICK_STATE, JSON.stringify({ last: new Date().toISOString(), reason, pid: child.pid ?? null, log: logFile }) + '\n');
    return true;
  } catch {
    return false;
  }
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
      if (!m) continue;
      // "two consecutive finder failures" is campaign.ts's own intentional hard-wall stop,
      // not a crash — and it fires routinely on plain term-supply exhaustion ("No active
      // terms to process"), which campaign-loop.sh already backs off/retries on its own and
      // which section 5 below explicitly treats as NOT fix-agent-fixable. Escalating this
      // benign, self-healing shape to the paid fix-agent every hour it persists (2026-07-19:
      // it had already self-healed by the time the agent ran) burns money for nothing —
      // only escalate when the log does NOT show that benign cause.
      //
      // Same reasoning applies to transient infra blips (Airtable/YouTube 503 SERVICE_UNAVAILABLE,
      // network errors, etc — 2026-07-29): campaign.ts always runs its finalization sequence
      // (final verify sweep → promote → auto-sweep → evaluate probes → "[campaign] DONE") after
      // the hard-wall stop, whether the underlying cause was benign or not. A session log that
      // reaches "[campaign] DONE" proves the session actually completed and campaign-loop.sh has
      // already retried successfully — it is definitionally not stuck. A genuine hang/crash would
      // NOT show DONE after the failure. Without this carve-out, a resolved transient blip keeps
      // re-triggering the fix-agent every hour it stays in the "2 most recent session logs" window.
      const benignNoActiveTerms = /No active terms to process/.test(tail);
      const benignFinalized = /\[campaign\] DONE\b/.test(tail);
      if (p === CONSECUTIVE_FINDER_FAILURES && (benignNoActiveTerms || benignFinalized)) {
        const cause = benignNoActiveTerms
          ? 'term-supply exhaustion ("No active terms to process")'
          : 'a transient failure that already self-healed — the session still finalized ("[campaign] DONE") after the hard-wall stop';
        appendFileSync(OBSERVATIONS, JSON.stringify({
          ts: new Date().toISOString(),
          kind: 'finder_hard_wall_benign',
          detail: `"two consecutive finder failures" in ${f} explained by ${cause} — not a code bug, skipping fix-agent`,
        }) + '\n');
        continue;
      }
      anomalies.push({ kind: 'fatal_signature', detail: `pattern ${p} in ${f}`, evidence: m[0] });
      break;
    }
  }

  // 4) Finding-but-not-parking: approved_hold flat for FLAT_PARK_MINUTES while the finder
  //    keeps exiting 0 AND is surfacing real supply (>= MIN_SUPPLY_FOR_PARK_ALARM fresh
  //    pitchable across the window) — the exact shape of the skill-missing bug we hit this
  //    migration. The supply gate is required: without it, a low-yield drought (terms
  //    intermittently exhausting, "No active terms to process") also satisfies "finder exits
  //    0 while parked is flat" and false-positives as a broken verify/park path when nothing
  //    is actually broken (2026-07-15) — that legitimate case is the term_starvation heartbeat
  //    below, not this alarm. Uses the live Airtable count vs a rolling history file (robust
  //    across long sessions).
  let parked: number | null = null;
  try {
    parked = await countByReviewStatus('approved_hold');
    appendFileSync(PARKED_HIST, JSON.stringify({ ts: new Date().toISOString(), parked }) + '\n');
    const hist = readParkedHistory();
    const cutoff = Date.now() - FLAT_PARK_MINUTES * 60000;
    const older = hist.filter((p) => Date.parse(p.ts) <= cutoff);
    const baseline = older.length ? older[older.length - 1] : null; // most recent point older than the window
    const finder = recentFinderOkCount();
    const supply = recentFinderStats(STARVATION_WINDOW);
    if (baseline && parked <= baseline.parked && finder.ok >= 3 && supply.pitchable >= MIN_SUPPLY_FOR_PARK_ALARM) {
      anomalies.push({
        kind: 'find_no_park',
        detail: `approved_hold flat at ${parked} for ≥${FLAT_PARK_MINUTES}min (was ${baseline.parked} at ${baseline.ts}) while ${finder.ok}/${finder.total} recent finder passes exited 0 and surfaced ${supply.pitchable} fresh pitchable — pipeline finds but doesn't verify/park`,
      });
    }
  } catch (e) {
    // Airtable blip — do NOT treat as an anomaly (transient); just note it.
    console.log(`[checkin ${day}] note: approved_hold count unavailable (${e instanceof Error ? e.message : String(e)})`);
  }

  // 5) Term-supply-wall HEARTBEAT (observability only — NEVER exit 7). A dry term pool is
  //    the recurring failure mode (07-13, 07-15) yet slips past the detectors above: the
  //    finder isn't crashing and approved_hold is flat for a legitimate reason (nothing to
  //    park), not a broken verify path. It is also NOT fix-agent-fixable — the remedy is an
  //    ICP/term-supply decision (keyword harvest / wider ICP / the needs_contact engine), so
  //    spending a `claude -p` agent on it would burn money it can't recover. Instead we (a)
  //    fire a cheap code-only keyword harvest (kickKeywordHarvest) to refill the term pool,
  //    and (b) log a once-hourly heartbeat to a SEPARATE observations file (kept out of the attention file
  //    so the fix-agent's evidence channel stays pure) so the daily debrief and operator can
  //    SEE the wall same-hour instead of only at the next debrief (07-13 rec #4 / 07-14 lever #4).
  const fstats = recentFinderStats(STARVATION_WINDOW);
  const starving = fstats.total >= STARVATION_WINDOW &&
    (fstats.pitchable <= STARVATION_MAX_PITCHABLE || fstats.failed >= fstats.total - 1);
  if (starving) {
    const detail = `finder near-dry: last ${fstats.total} passes → ${fstats.pitchable} fresh pitchable, ${fstats.failed} failed, ${fstats.zeroYield} zero-yield. Term-supply wall (not a code bug) — feed the term pool (keyword harvest / wider ICP) or advance the needs_contact engine.`;
    appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'term_starvation', detail, parked }) + '\n');
    console.log(`[checkin ${day}] OBSERVATION term_starvation — ${detail}`);
    // ACTION (2026-07-17): break the wall, don't just log it. A keyword harvest is a cheap,
    // code-only refill (free autocomplete + a few-cent prefilter) — no `claude -p` agent, so
    // it respects the "not fix-agent-fixable" reasoning above while still honoring Casey's
    // standing rule to ALWAYS kick the engine on a multi-hour zero-lead stretch. Cooldown-
    // gated and coordinated with the campaign's own harvest so the two don't double-fire.
    //
    // EXCEPT when the autocomplete endpoint is IP-blocked (sustained 403 — the 2026-07-17
    // root cause): the harvest CANNOT refill the pool and every request just deepens the
    // block, so kicking it is worse than doing nothing. Log a distinct observation so the
    // operator can rotate egress IP / proxy same-hour, and skip the kick.
    if (autocompleteBlocked()) {
      const bdetail = `autocomplete endpoint IP-blocked (sustained HTTP 403) — the keyword harvest cannot refill the term pool until the block lifts. Skipping the harvest kick (hammering it deepens the block). Remedy is infra: rotate egress IP / proxy, or wait it out.`;
      appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'autocomplete_blocked', detail: bdetail, parked }) + '\n');
      console.log(`[checkin ${day}] OBSERVATION autocomplete_blocked — ${bdetail}`);
    } else if (kickKeywordHarvest('term_starvation_heartbeat')) {
      console.log(`[checkin ${day}] → fired keyword harvest to break the term-supply wall (backstop kick)`);
      appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'harvest_kick', detail: 'checkin backstop fired keyword-harvest --apply', parked }) + '\n');
    }
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
