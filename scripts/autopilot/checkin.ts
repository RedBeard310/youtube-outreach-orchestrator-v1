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
import { appendFileSync, existsSync, openSync, readdirSync, readFileSync, unlinkSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { summarizeToday, pacificDate } from './burn-ledger.js';
import { countByReviewStatus } from '../../src/airtable.ts';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
// Overridable so this path can be exercised without arming the real one. The
// finder's src/lib/run-gate.ts already honours the same variable, so the two
// halves of the halt contract now agree about where the flag lives.
const HALT_FLAG = process.env.AUTOPILOT_HALT_FLAG || join(LOGS, 'autopilot-halt.flag');
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

// Is the finder currently running on a degraded term pool (2026-08-12+, search_terms.ts)?
// Two signatures in the recent session logs, both self-healing and already documented as
// low-conversion by design — the remedy is the term pool refilling (discovery/keyword-
// harvest, already automatic), not a scoring-pipeline fix:
//
//   - tier2_fallback (commit 37ceb96): no paused term clears the preferred 3.5% qualified-
//     rate floor after cooling, so tier 2 drops to a 2% floor and revives the best available
//     mediocre terms instead of starving. Casey's own commit message documents the expected
//     yield: ~78 channels, ~1.5 scoring >=6 (~1.9%) — well under half the trailing baseline,
//     by design.
//   - anti_starvation_exhausted (2026-08-13): a strictly worse supply state — even tier 2's
//     cooled-proven fallback comes up empty (NO never-run AND NO cooled proven terms at
//     all), so the pass runs entirely on freshly harvested/discovery-invented probe terms,
//     which are unvalidated and convert lower than the proven pool until evaluate-probes
//     promotes the winners. Same "not a bug" shape, just one rung further down.
//
// Left undetected, either one reads exactly like a scoring-rubric regression and pages a
// fix-agent every hour the term pool stays thin, for a condition that already has a name,
// a reason, and a self-healing path.
function termSupplyDegradationActive(): 'tier2_fallback' | 'anti_starvation_exhausted' | null {
  for (const f of recentSessionLogs(2)) {
    let body = '';
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    // 2026-08-14 (finder commit 7ea99ab) rewrote the tier2 log line from the single
    // '[tier2] no term cleared ...' message this used to match to a 4-rung ladder that
    // only logs when it lands below rung 1 ('[tier2] rung N/4: nothing available at the
    // stricter bars; ...'). Rung 1 (the preferred bar, full cooldown) is silent by design,
    // so any '[tier2] rung' line at all means tier 2 fell back — match generically instead
    // of a literal rung number so the next ladder-length tweak can't silently break this again.
    if (/\[tier2\] rung \d+\/\d+/.test(body)) return 'tier2_fallback';
    if (body.includes('[anti-starvation] active pool exhausted') && body.includes('NO never-run and NO cooled proven terms remain')) {
      return 'anti_starvation_exhausted';
    }
    // Tier 2 landed (reactivated cooled-proven terms) rather than exhausting outright —
    // same self-healing, lower-conversion-by-design shape as tier2_fallback above, just
    // reached via the anti-starvation path's own wording rather than the tier2 ladder log.
    if (body.includes('[anti-starvation] active pool exhausted') && body.includes('reactivated') && body.includes('proven paused terms that have cooled off')) {
      return 'tier2_fallback';
    }
  }
  return null;
}

// Scoring-pipeline health thresholds (2026-08-05, the reasoning-token-truncation
// incident — see youtube-lead-finder-v1/src/scoring/score.ts HOTFIX comment). The
// checkin ran hourly through 20+ hours of a 76-86% scoring_failed rate and never
// caught it: recentFinderStats only ever looked at fresh_pitchable, never at
// scoring_failed or the raw score_6_plus rate. These two checks close that gap.
const SCORING_FAILED_RATE_PCT = Number(process.env.AUTOPILOT_SCORING_FAILED_RATE_PCT ?? 20);
const SCORING_MIN_SAMPLE = Number(process.env.AUTOPILOT_SCORING_MIN_SAMPLE ?? 20);
const PITCHABLE_MIN_SAMPLE = Number(process.env.AUTOPILOT_PITCHABLE_MIN_SAMPLE ?? 40);
const PITCHABLE_BASELINE_MIN_POINTS = Number(process.env.AUTOPILOT_PITCHABLE_BASELINE_MIN_POINTS ?? 8);
const PITCHABLE_COLLAPSE_RATIO = Number(process.env.AUTOPILOT_PITCHABLE_COLLAPSE_RATIO ?? 0.5);
// Baseline window cap (2026-08-12, the term-floor-fallback incident). The baseline used to
// average over the ENTIRE history file since inception — by 2026-08-12 that was 148+ hourly
// points back to 08-05. An unbounded mean can't absorb a sustained, intentional rate shift
// (e.g. 37ceb96's tier-2 fallback floor, which openly trades rate for not starving): the
// alert fired every hour for 5+ straight hours after four separate fix-agents each confirmed
// it wasn't a bug, because 5 new low points barely move a 148-point all-time average. Capping
// to the most recent N points makes "trailing baseline" actually trailing — it still needs
// PITCHABLE_BASELINE_MIN_POINTS before firing, so a sudden real regression is still caught,
// but a deliberate multi-hour-plus shift stops re-paging the same diagnosis indefinitely.
const PITCHABLE_BASELINE_WINDOW = Number(process.env.AUTOPILOT_PITCHABLE_BASELINE_WINDOW ?? 72);
const PITCHABLE_RATE_HIST = join(LOGS, 'autopilot-pitchable-rate-history.jsonl');

// Walk recent finder_run events (newest campaign-*.jsonl first, falling back one day if the
// window straddles midnight) accumulating new_leads/scoring_failed/score_6_plus until we hit
// SCORING_MIN_SAMPLE new leads or run out of events, capped at 40 events so a stale/quiet day
// can't pull in week-old data. This is "after a certain amount of leads" (Casey, 2026-08-05):
// a rate over 5 new leads is noise; a rate over 40 is a real signal either way.
function recentFinderYield(minSample: number): { newLeads: number; scoringFailed: number; score6Plus: number; events: number } {
  const files = readdirSync(LOGS)
    .filter((f) => /^campaign-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
    .map((f) => join(LOGS, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .slice(0, 2);
  const runs: Array<Record<string, unknown>> = [];
  for (const f of files) runs.push(...readEvents(f).filter((e) => e.event === 'finder_run'));
  runs.sort((a, b) => Date.parse(String(b.ts ?? 0)) - Date.parse(String(a.ts ?? 0)));

  let newLeads = 0, scoringFailed = 0, score6Plus = 0, events = 0;
  for (const r of runs.slice(0, 40)) {
    // Older log lines predate this instrumentation (2026-08-05) and won't carry these fields —
    // skip them rather than silently treating "undefined" as 0 new leads.
    if (typeof r.new_leads !== 'number') continue;
    newLeads += r.new_leads;
    scoringFailed += typeof r.scoring_failed === 'number' ? r.scoring_failed : 0;
    score6Plus += typeof r.score_6_plus === 'number' ? r.score_6_plus : 0;
    events += 1;
    if (newLeads >= minSample) break;
  }
  return { newLeads, scoringFailed, score6Plus, events };
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

/**
 * Clear a halt whose cause we can PROVE has gone away, and restart the loop.
 *
 * WHY (2026-08-25). The halt flag is one-way: something writes it, everything
 * stops, and only a human deleting a file ever starts anything again. On 08-25
 * the OpenRouter account ran out of credits at 00:49Z, the flag went up, and the
 * campaign loop plus three sweeps parked themselves correctly — but the moment
 * Casey tops the account up, nothing notices. The pipeline would sit dark until
 * he remembered a file on a VPS, hours or a day after paying to fix the actual
 * problem.
 *
 * Deliberately narrow, in both directions:
 *
 * - ONLY the OpenRouter-credits halt. Every other halt (the Anthropic hard
 *   ceiling, rapid finder failures, a migration freeze) means something a probe
 *   cannot check, so those still wait for a human. Anything this function does
 *   not positively recognise is left alone.
 * - The check is the credits endpoint, which spends nothing. It needs a real
 *   margin, not a non-zero balance: an account left at $0.30 would clear the
 *   flag, 402 within minutes, and re-halt, flapping every hour.
 *
 * Clearing the flag alone revives the sweeps, which re-read it each cycle. The
 * campaign loop exits(0) on a halt and Restart=on-failure does not cover a clean
 * exit, so it needs the explicit restart.
 */
async function tryAutoClearHalt(day: string): Promise<boolean> {
  const MIN_CREDIT_MARGIN_USD = Number(process.env.AUTOPILOT_MIN_CREDIT_MARGIN_USD ?? 5);

  let reason = '';
  try { reason = readFileSync(HALT_FLAG, 'utf8'); } catch { return false; }
  if (!/OpenRouter account out of credits/i.test(reason)) return false;

  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return false;

  let remaining: number;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const granted = Number(body.data?.total_credits);
    const used = Number(body.data?.total_usage);
    if (!Number.isFinite(granted) || !Number.isFinite(used)) return false;
    remaining = granted - used;
  } catch {
    return false; // a probe we could not complete is not proof of anything
  }

  if (remaining < MIN_CREDIT_MARGIN_USD) {
    console.log(`[checkin ${day}] halt stands — OpenRouter still at $${remaining.toFixed(2)} (need $${MIN_CREDIT_MARGIN_USD})`);
    return false;
  }

  unlinkSync(HALT_FLAG);
  appendFileSync(OBSERVATIONS, `${JSON.stringify({
    ts: new Date().toISOString(), kind: 'halt_auto_cleared',
    detail: `OpenRouter credits restored ($${remaining.toFixed(2)} available) — halt flag removed and the campaign loop restarted`,
  })}\n`);
  console.log(`[checkin ${day}] OpenRouter credits restored ($${remaining.toFixed(2)}) — halt cleared, restarting the campaign loop`);
  try {
    execSync('sudo -n systemctl restart autopilot-campaign.service', { stdio: 'pipe', timeout: 60_000 });
  } catch (err) {
    console.warn(`[checkin ${day}] halt cleared but the campaign restart failed: ${(err as Error).message}`);
  }
  return true;
}

async function main(): Promise<void> {
  const burn = summarizeToday();
  const day = pacificDate();

  // 1) Halt flag already up → loop is stopping; nothing for the agent to do.
  //    Unless its stated cause has provably cleared (see tryAutoClearHalt).
  if (existsSync(HALT_FLAG)) {
    if (await tryAutoClearHalt(day)) {
      // Exit clean rather than falling through: the day's session logs still
      // carry the fatal signature of the outage we just recovered from, and
      // escalating a resolved cause would spend a paid fix-agent for nothing.
      // The next hourly tick check-ins normally.
      process.exit(0);
    }
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
  // Computed BEFORE the heartbeat (2026-08-05, autopilot-improve) so section 5 can't
  // MIS-ATTRIBUTE a broken scoring pipeline as a term-supply wall. On 08-04/05 this
  // heartbeat fired 19× asserting "Term-supply wall (not a code bug)" while the actual
  // cause was the reasoning-token truncation bug — channels were being found and written,
  // they just all came back scoring_failed. That wrong label is a large part of why the
  // incident survived 30 hours: every hourly observation said "supply problem, nothing to fix".
  const yieldStats = recentFinderYield(SCORING_MIN_SAMPLE);
  const scoringFailedRatePct = yieldStats.newLeads > 0 ? (100 * yieldStats.scoringFailed) / yieldStats.newLeads : 0;
  const scoringFailedAlarm = yieldStats.newLeads >= SCORING_MIN_SAMPLE && scoringFailedRatePct >= SCORING_FAILED_RATE_PCT;

  const fstats = recentFinderStats(STARVATION_WINDOW);
  const starving = fstats.total >= STARVATION_WINDOW &&
    (fstats.pitchable <= STARVATION_MAX_PITCHABLE || fstats.failed >= fstats.total - 1);
  if (starving) {
    const cause = scoringFailedAlarm
      ? `NOT a term-supply wall — ${scoringFailedRatePct.toFixed(0)}% of the last ${yieldStats.newLeads} new leads came back scoring_failed, so the finder IS finding and the scoring pipeline is dropping them (see the scoring_failure_rate anomaly).`
      : `Term-supply wall (not a code bug) — feed the term pool (keyword harvest / wider ICP) or advance the needs_contact engine.`;
    const detail = `finder near-dry: last ${fstats.total} passes → ${fstats.pitchable} fresh pitchable, ${fstats.failed} failed, ${fstats.zeroYield} zero-yield. ${cause}`;
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
    if (scoringFailedAlarm) {
      // Same reasoning as the IP-block carve-out below: more terms cannot fix a scoring
      // pipeline that drops everything it finds, and each kick spends a prefilter LLM call
      // for nothing. 6a below is already paging the fix-agent with the real diagnosis.
      console.log(`[checkin ${day}] → skipping harvest kick: scoring_failed rate ${scoringFailedRatePct.toFixed(0)}% explains the dry passes, more terms won't help`);
    } else if (autocompleteBlocked()) {
      const bdetail = `autocomplete endpoint IP-blocked (sustained HTTP 403) — the keyword harvest cannot refill the term pool until the block lifts. Skipping the harvest kick (hammering it deepens the block). Remedy is infra: rotate egress IP / proxy, or wait it out.`;
      appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'autocomplete_blocked', detail: bdetail, parked }) + '\n');
      console.log(`[checkin ${day}] OBSERVATION autocomplete_blocked — ${bdetail}`);
    } else if (kickKeywordHarvest('term_starvation_heartbeat')) {
      console.log(`[checkin ${day}] → fired keyword harvest to break the term-supply wall (backstop kick)`);
      appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'harvest_kick', detail: 'checkin backstop fired keyword-harvest --apply', parked }) + '\n');
    }
  }

  // 6) Scoring-pipeline health (2026-08-05). Two checks over the same recent-yield window:
  //
  //   6a. scoring_failed rate — the DIRECT signal. In a healthy pipeline this sits near 0%
  //       (a stray transient API error here and there); a sustained spike means the scoring
  //       call itself is broken (bad token budget, bad model/JSON parsing, schema mismatch)
  //       regardless of what niches are being mined that day. Low false-positive rate, so this
  //       goes straight to the fix-agent like a fatal signature would.
  //
  //   6b. pitchable-rate collapse vs a rolling baseline — Casey's own suggested check ("what %
  //       came back score>=6, is it below our ~20% average"). Noisier than 6a (term supply,
  //       niche mix, and market conditions all move this legitimately), so it only fires when
  //       today's rate falls to less than half the trailing baseline AND 6a is NOT already
  //       explaining it — if scoring_failed is already elevated, 6a is the correct, more
  //       specific diagnosis and firing both would just be the same incident reported twice.
  // (yieldStats / scoringFailedRatePct / scoringFailedAlarm are computed above section 5.)
  if (scoringFailedAlarm) {
    anomalies.push({
      kind: 'scoring_failure_rate',
      detail: `${yieldStats.scoringFailed}/${yieldStats.newLeads} newly-discovered leads (${scoringFailedRatePct.toFixed(0)}%) came back scoring_failed over the last ${yieldStats.events} finder pass(es) — threshold is ${SCORING_FAILED_RATE_PCT}%. Likely a scoring-pipeline bug (token budget, model config, JSON parsing), not a niche/term-supply issue. See youtube-lead-finder-v1 src/scoring/score.ts and logs for "no JSON object found" / finish_reason "length".`,
    });
  } else if (yieldStats.newLeads > 0) {
    console.log(`[checkin ${day}] scoring_failed rate ${scoringFailedRatePct.toFixed(0)}% (${yieldStats.scoringFailed}/${yieldStats.newLeads}, n=${yieldStats.events} passes) — within normal range`);
  }

  const pitchableYieldWindow = recentFinderYield(PITCHABLE_MIN_SAMPLE);
  if (pitchableYieldWindow.newLeads >= PITCHABLE_MIN_SAMPLE) {
    const rate = pitchableYieldWindow.score6Plus / pitchableYieldWindow.newLeads;
    appendFileSync(PITCHABLE_RATE_HIST, JSON.stringify({ ts: new Date().toISOString(), rate, sample: pitchableYieldWindow.newLeads }) + '\n');
    const hist = existsSync(PITCHABLE_RATE_HIST)
      ? readFileSync(PITCHABLE_RATE_HIST, 'utf8').split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l) as { ts: string; rate: number; sample: number }; } catch { return null; } }).filter((x): x is { ts: string; rate: number; sample: number } => x !== null)
      : [];
    const priorAll = hist.slice(0, -1); // exclude the point we just appended
    const prior = priorAll.slice(-PITCHABLE_BASELINE_WINDOW); // trailing window, not all-time
    if (prior.length >= PITCHABLE_BASELINE_MIN_POINTS) {
      const baseline = prior.reduce((s, p) => s + p.rate, 0) / prior.length;
      if (baseline > 0 && rate < baseline * PITCHABLE_COLLAPSE_RATIO && !scoringFailedAlarm) {
        const degradation = termSupplyDegradationActive();
        // termSupplyDegradationActive() only scrapes the [tier2]/[anti-starvation] log LINE out
        // of the 2 most-recent session-log files. That line is emitted once, when the term pool
        // first falls back — not every pass while it stays fallen back — so a session rotation
        // (~every 2h) can push it out of the 2-file window while the pool is still in the exact
        // same degraded state. 2026-08-22: this desynced the two term-supply checks in this same
        // script run — section 5's `starving` (backed by recentFinderStats, structured pass data,
        // not log text) correctly fired term_starvation with "Term-supply wall (not a code bug)"
        // at the same timestamp this check escalated pitchable_rate_collapse to the fix-agent for
        // the identical condition. Fall back to `starving` (already computed above, already
        // excludes the scoring_failed cause) so a still-degraded pool can't lose its explanation
        // just because the log line scrolled out of a 2-file window.
        const stillStarving = starving && !scoringFailedAlarm;
        if (degradation || stillStarving) {
          // Already explained — see termSupplyDegradationActive() above. Not fix-agent-
          // fixable: the remedy is the term pool refilling (discovery/keyword-harvest),
          // which is already automatic. Observe it instead of paging, same pattern as
          // section 5.
          const reason = degradation === 'tier2_fallback'
            ? 'tier-2 term-pool fallback (search_terms.ts, commit 37ceb96) is active in the recent session logs, which is documented to convert around ~2%'
            : degradation === 'anti_starvation_exhausted'
            ? 'the anti-starvation floor found NO never-run and NO cooled proven terms at all in the recent session logs — the pass is running entirely on freshly harvested/discovery-invented probe terms, which convert lower than the proven pool until evaluate-probes promotes the winners'
            : `the same check-in run's term_starvation heartbeat also fired (last ${fstats.total} passes → ${fstats.pitchable} fresh pitchable) — the explaining tier2/anti-starvation log line has likely just aged out of the 2 most-recent session-log files across a session rotation, but the pool is still in the same degraded state`;
          const tdetail = `score>=6 rate is ${(rate * 100).toFixed(1)}% over the last ${pitchableYieldWindow.newLeads} new leads, vs a ${(baseline * 100).toFixed(1)}% trailing baseline — but ${reason}. Expected, not a regression; observing only.`;
          appendFileSync(OBSERVATIONS, JSON.stringify({ ts: new Date().toISOString(), kind: 'pitchable_rate_term_supply_degraded', detail: tdetail, degradation: degradation ?? 'starving_fallback', parked }) + '\n');
          console.log(`[checkin ${day}] OBSERVATION pitchable_rate_term_supply_degraded (${degradation ?? 'starving_fallback'}) — ${tdetail}`);
        } else {
          anomalies.push({
            kind: 'pitchable_rate_collapse',
            detail: `score>=6 rate is ${(rate * 100).toFixed(1)}% over the last ${pitchableYieldWindow.newLeads} new leads, vs a ${(baseline * 100).toFixed(1)}% trailing baseline (${prior.length} of last ${PITCHABLE_BASELINE_WINDOW} check-ins) — less than half. scoring_failed rate is normal (${scoringFailedRatePct.toFixed(0)}%), so this isn't the token-budget bug; likely a scoring-rubric, prefilter, or term-mix regression worth a look.`,
          });
        }
      }
    }
  }

  // 7) Sweep-daemon staleness (2026-08-09). graph-sweep sat idle 8 days (2026-08-01 ->
  // 2026-08-09) with zero signal anywhere — a clean drain and a silent stall look
  // identical unless something actually checks. Refill timers now exist for
  // graph-sweep and peer-sweep (every 4h) and comment-sweep runs on its own daily
  // timer, so a state file untouched well past its own cadence means the automation
  // itself broke (timer disabled, script erroring, systemd unit removed), not just
  // "between refills." Deliberately independent of Airtable/campaign.jsonl, both of
  // which this check must survive to be useful.
  function isEnabled(unit: string): boolean | null {
    try { return execSync(`systemctl is-enabled ${unit}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() === 'enabled'; }
    catch { return null; }
  }
  function sweepStateAgeHours(stateFile: string): number | null {
    const p = join(FINDER_REPO, 'logs', stateFile);
    if (!existsSync(p)) return null;
    try {
      const updated = (JSON.parse(readFileSync(p, 'utf8')) as { updated?: string }).updated;
      return updated ? (Date.now() - Date.parse(updated)) / 3_600_000 : null;
    } catch { return null; }
  }
  const sweepChecks: Array<{ method: string; timer: string; stateFile: string; maxAgeH: number }> = [
    { method: 'recommended_videos_feed', timer: 'graph-sweep-refill.timer', stateFile: 'graph-sweep-state.json', maxAgeH: 8 },
    { method: 'peer_sweep', timer: 'peer-sweep-refill.timer', stateFile: 'peer-sweep-state.json', maxAgeH: 8 },
    // comment_sweep deliberately absent: Casey paused the lane 2026-08-20 ("never run
    // it again unless I say"). Its timer is stopped+disabled ON PURPOSE — do not flag
    // it, and no fix-agent may re-enable it. See docs/standing-orders.md.
    { method: 'podcast_crossover', timer: 'podcast-crossover-daily.timer', stateFile: 'podcast-crossover-state.json', maxAgeH: 30 },
  ];
  for (const c of sweepChecks) {
    const enabled = isEnabled(c.timer);
    if (enabled === false) {
      anomalies.push({ kind: 'sweep_daemon_disabled', detail: `${c.timer} is not enabled — ${c.method} will never refill/rerun. Re-enable: sudo systemctl enable --now ${c.timer}.` });
      continue;
    }
    const ageH = sweepStateAgeHours(c.stateFile);
    if (ageH !== null && ageH > c.maxAgeH) {
      anomalies.push({ kind: 'sweep_daemon_stale', detail: `${c.method}'s state file hasn't updated in ${ageH.toFixed(1)}h (expected within ~${c.maxAgeH}h). Check: systemctl status ${c.timer}, and the unit this timer drives, for an error.` });
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
