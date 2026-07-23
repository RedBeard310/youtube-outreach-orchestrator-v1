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

// All campaign events within the cycle window [sinceISO, untilISO) (spans the UTC-dated files).
function cycleCampaignEvents(sinceISO: string, untilISO: string): Array<Record<string, unknown>> {
  const ev: Array<Record<string, unknown>> = [];
  for (const f of readdirSync(LOGS)) {
    if (!/^campaign-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    for (const e of readJsonl(join(LOGS, f))) {
      const ts = typeof e.ts === 'string' ? e.ts : '';
      if (ts >= sinceISO && ts < untilISO) ev.push(e);
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

// Supply-health from the hourly check-in observations log (autopilot-observations.jsonl).
//
// WHY THIS EXISTS (2026-07-22): the finder's fresh-finding engine has been dead for days
// behind an autocomplete-endpoint IP-block (since 2026-07-17) that no code path can fix —
// the remedy is infra (rotate egress IP / proxy). Yet the debrief JSON only surfaced
// fatal_signatures, so the single most important fact about pipeline state — "fresh finding
// is dead, and for HOW LONG" — was invisible in the authoritative feed. That's dangerous:
// `discovered_today` is dominated by status CHURN (verify→promote + needs_contact sweeps of
// the standing backlog), so a future debrief agent reading only the JSON could misread a
// churn-inflated "619 discovered / 119 pitchable" as a healthy day while the finder produced
// ~zero net-new. This block makes the outage and its true AGE machine-visible every cycle.
interface Obs { ts: string; kind: string }
function readObservations(): Obs[] {
  const f = join(LOGS, 'autopilot-observations.jsonl');
  if (!existsSync(f)) return [];
  return (readJsonl(f) as Array<{ ts?: unknown; kind?: unknown }>)
    .filter((o): o is Obs => typeof o.ts === 'string' && typeof o.kind === 'string')
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

// Start of the CURRENT unbroken run of `kind` observations, walking backward from the latest
// through any gap ≤ maxGapH. The check-in logs these sparsely (only on a starving+blocked
// hour), so tolerate day-level gaps; a genuine multi-day recovery (no observation for >2d)
// correctly resets the episode. Returns null if the latest such observation predates the
// cycle window (i.e. not active this cycle).
function ongoingEpisodeStart(obs: Obs[], kind: string, sinceMs: number, maxGapH = 48): string | null {
  const hits = obs.filter((o) => o.kind === kind);
  if (!hits.length) return null;
  const latest = hits[hits.length - 1];
  if (Date.parse(latest.ts) < sinceMs) return null; // block did not recur this cycle
  let start = latest.ts;
  for (let i = hits.length - 2; i >= 0; i--) {
    if (Date.parse(start) - Date.parse(hits[i].ts) <= maxGapH * 3_600_000) start = hits[i].ts;
    else break;
  }
  return start;
}

// Net-new channels the finder actually WROTE to Airtable this cycle — summed from the finder
// RUN SUMMARY ("New channels written: N") across the session logs. This is the finder's OWN
// authoritative count of fresh FINDING, and it exists because the two finding-ish figures
// already in this snapshot both MISLEAD:
//   • discovered_today is inflated by verify/promote + needs_contact status CHURN (07-23: 833
//     "discovered" / 148 "pitchable" while the finder wrote just ~7 net-new channels all cycle);
//   • the campaign's per-pass `fresh_pitchable` counter is known to UNDERCOUNT DB yield
//     (07-19/07-20 debriefs: ~10 logged vs ~294 real), so keying `fresh_finding_dead` off it
//     alone risks a false "dead" on a healthy day whose counter simply under-reported.
// Grepping this line by hand was the recurring manual cross-check in every block-era debrief;
// this makes it a grounded field. Mirrors fatalSignaturesToday's mtime-windowed log scan.
function netNewChannelsWritten(sinceMs: number): { total: number; passes_with_writes: number } {
  let total = 0;
  let passesWithWrites = 0;
  const dir = join(LOGS, 'autopilot-sessions');
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!/^session-.*\.log$/.test(f)) continue;
      const p = join(dir, f);
      try {
        if (statSync(p).mtimeMs < sinceMs) continue;
        const txt = readFileSync(p, 'utf8');
        const re = /New channels written:\s*(\d+)/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt)) !== null) {
          const n = Number(m[1]);
          total += n;
          if (n > 0) passesWithWrites++;
        }
      } catch { /* skip */ }
    }
  }
  return { total, passes_with_writes: passesWithWrites };
}

async function main(): Promise<void> {
  const now = new Date();
  const date = pacificDate(now);
  // The debrief timer fires ~00:20 PT to summarize the 24h cycle that JUST ENDED.
  // pacificMidnightISO(now) is that cycle's END (the most-recent PT midnight); the cycle
  // START is 24h earlier. (Bug fixed 2026-07-12: previously sinceISO = pacificMidnightISO,
  // so at the 00:20 fire the window collapsed to ~20 min and the debrief saw almost nothing.)
  const untilISO = pacificMidnightISO(now);
  const sinceISO = new Date(Date.parse(untilISO) - 24 * 60 * 60 * 1000).toISOString();
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

  const ev = cycleCampaignEvents(sinceISO, untilISO);
  const count = (name: string) => ev.filter((e) => e.event === name).length;
  const sum = (name: string, field: string) =>
    ev.filter((e) => e.event === name).reduce((s, e) => s + (Number(e[field]) || 0), 0);

  const parkedStart = parkedAtCycleStart(sinceISO);
  const burn = summarizeToday(date);

  // Supply-health — surface the persistent term-supply outage the finder can't self-heal.
  const obs = readObservations();
  const blockStart = ongoingEpisodeStart(obs, 'autocomplete_blocked', sinceMs);
  const freshPitchableSum = sum('finder_run', 'fresh_pitchable');
  const netNew = netNewChannelsWritten(sinceMs);
  const nowMs = now.getTime();
  const supplyHealth = {
    // Fresh FINDING — two independent lenses on the same question ("did the finder surface
    // net-new channels this cycle?"), both distinct from discovered_today (inflated by
    // verify/promote + needs_contact status churn):
    //  • net_new_channels_written — the finder's OWN authoritative RUN-SUMMARY count (ground truth);
    //  • fresh_pitchable_sum — the campaign's per-pass counter, kept for continuity but known to
    //    UNDERCOUNT DB yield (07-19/07-20), so NOT trusted as the `dead` trigger.
    net_new_channels_written: netNew.total,
    net_new_passes_with_writes: netNew.passes_with_writes,
    fresh_pitchable_sum: freshPitchableSum,
    // Dead when the finder wrote almost no net-new channels all cycle. A working finder writes
    // hundreds+ (even the weakest post-block days cleared this easily); block-era dead days sit
    // at ~7–19. Keyed off the hard count, not the flaky per-pass counter.
    fresh_finding_dead: netNew.total < 30,
    autocomplete_blocked: blockStart !== null,
    autocomplete_blocked_since: blockStart,
    autocomplete_blocked_days: blockStart === null ? 0
      : Math.round(((nowMs - Date.parse(blockStart)) / 86_400_000) * 10) / 10,
    autocomplete_block_obs_this_cycle: obs.filter((o) => o.kind === 'autocomplete_blocked' && o.ts >= sinceISO).length,
    term_starvation_obs_this_cycle: obs.filter((o) => o.kind === 'term_starvation' && o.ts >= sinceISO).length,
  };

  const snapshot = {
    date,
    cycle_start_iso: sinceISO,
    cycle_end_iso: untilISO,
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
      fresh_pitchable_sum: freshPitchableSum,
      fades: count('fade_detected'),
      discovers: count('discover'),
      promotes: count('promote'),
      hard_stops: count('hard_stop'),
      quota_stops: count('quota_stop'),
      time_budget_stops: count('time_budget_stop'),
    },
    burn_today: { total_usd: burn.total_usd, by_source: burn.by_source, soft: burn.soft_usd, hard: burn.hard_usd },
    supply_health: supplyHealth,
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
