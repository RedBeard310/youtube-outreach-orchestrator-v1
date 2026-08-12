// Autopilot debrief data-gatherer (feeds component D).
//
// Emits a compact JSON snapshot of the cycle (midnight-PT → now) so the daily debrief
// agent writes a report grounded in real numbers, not guesses. Reuses the campaign's own
// Airtable helpers + the campaign JSONL. Prints JSON to stdout; also writes it to
// logs/autopilot-debrief-<pacific-date>.json.

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { countByReviewStatus, getLeadsDiscoveredSince, type Lead } from '../../src/airtable.ts';
import { discoveryMethod } from '../../src/discovery-method.ts';
import { summarizeToday, pacificDate } from './burn-ledger.js';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
const FINDER_REPO = '/home/casey/repos/youtube-lead-finder-v1';

// Health snapshot for the three sweep-based discovery methods (2026-08-09). None of
// these show up in campaign.jsonl (that's the keyword engine only), so without this
// a stalled daemon is invisible to the daily report — exactly how graph-sweep sat
// idle 8 days (2026-08-01 -> 2026-08-09) before anyone noticed. Deliberately reads
// only local state/systemd, no Airtable calls — cheap, and can't itself be the thing
// that's broken if Airtable is having a bad day.
function serviceActive(name: string): boolean | null {
  try {
    return execSync(`systemctl is-active ${name}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() === 'active';
  } catch {
    return null; // systemctl unavailable or unit unknown — don't claim unhealthy on a check that couldn't run
  }
}
function sweepStateUpdatedAt(stateFile: string): string | null {
  const p = join(FINDER_REPO, 'logs', stateFile);
  if (!existsSync(p)) return null;
  try { return (JSON.parse(readFileSync(p, 'utf8')) as { updated?: string }).updated ?? null; } catch { return null; }
}
function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? Math.round((ms / 3_600_000) * 10) / 10 : null;
}

// PRODUCTIVITY, not just liveness (2026-08-12). The block above only asks "is the
// state file being touched", and a sweep that bails in its first second still
// rewrites its state file — so all four daemons reported fresh, healthy and
// active for the whole 08-11 -> 08-12 cycle while walking ZERO seeds and
// contributing 0 of the day's 212 leads. Liveness was green; the work was not
// happening. This reads each daemon's own session logs for the cycle and reports
// how many seeds it actually advanced, plus why it stopped if it stopped.
//
// Local files only, same as above: no Airtable, no network, can't itself fail.
const SWEEP_SESSION_DIRS: Record<string, string> = {
  recommended_videos_feed: 'graph-sweep-sessions',
  peer_sweep: 'peer-sweep-sessions',
  comment_sweep: 'comment-sweep-sessions',
  podcast_crossover: 'podcast-crossover-sessions',
};
type SweepWork = {
  runs_in_cycle: number;
  seeds_advanced: number | null;
  idle_reason: string | null;
  productive: boolean | null;
};
function sweepWorkInCycle(dirName: string, sinceMs: number, untilMs: number): SweepWork {
  const blank: SweepWork = { runs_in_cycle: 0, seeds_advanced: null, idle_reason: null, productive: null };
  const dir = join(FINDER_REPO, 'logs', dirName);
  if (!existsSync(dir)) return blank;
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.log'))
      .map((f) => join(dir, f))
      .filter((p) => {
        const m = statSync(p).mtimeMs;
        return m >= sinceMs && m <= untilMs;
      })
      .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  } catch {
    return blank;
  }
  if (files.length === 0) return blank;

  // "[sweep] 7845 seeds total | 7719 done | 126 remaining" — every sweep prints
  // this shape on startup. The delta between the first and last run of the cycle
  // is the honest measure of whether the daemon did anything.
  const doneCount = (path: string): number | null => {
    try {
      const m = /\|\s*(\d+)\s+done\s*\|/.exec(readFileSync(path, 'utf8'));
      return m?.[1] ? Number(m[1]) : null;
    } catch {
      return null;
    }
  };
  const first = doneCount(files[0]!);
  const last = doneCount(files[files.length - 1]!);
  const advanced = first !== null && last !== null ? last - first : null;

  // Why it stopped, taken from the most recent run: a PAUSE/HALT/STOP line if
  // there is one. This is the line that would have named the outage on day one.
  let idle: string | null = null;
  try {
    const tail = readFileSync(files[files.length - 1]!, 'utf8');
    const m = /^\[[^\]]+\]\s+(PAUSE|STOP|HALTED)\b.*$/m.exec(tail);
    idle = m?.[0]?.trim() ?? null;
  } catch {
    idle = null;
  }

  return {
    runs_in_cycle: files.length,
    seeds_advanced: advanced,
    idle_reason: idle,
    productive: advanced === null ? null : advanced > 0,
  };
}
function discoveryMethodsHealth(sinceMs: number, untilMs: number): Record<string, unknown> {
  const work = (key: string): SweepWork =>
    sweepWorkInCycle(SWEEP_SESSION_DIRS[key]!, sinceMs, untilMs);
  const graphUpdated = sweepStateUpdatedAt('graph-sweep-state.json');
  const commentUpdated = sweepStateUpdatedAt('comment-sweep-state.json');
  const peerUpdated = sweepStateUpdatedAt('peer-sweep-state.json');
  const podcastUpdated = sweepStateUpdatedAt('podcast-crossover-state.json');
  return {
    recommended_videos_feed: {
      service_active: serviceActive('graph-sweep.service'),
      refill_timer_active: serviceActive('graph-sweep-refill.timer'),
      state_updated_at: graphUpdated,
      hours_since_update: hoursSince(graphUpdated),
      ...work('recommended_videos_feed'),
    },
    comment_sweep: {
      daily_timer_active: serviceActive('comment-sweep-daily.timer'),
      state_updated_at: commentUpdated,
      hours_since_update: hoursSince(commentUpdated),
      ...work('comment_sweep'),
      // Runs once/day by design — flag only past ~30h (a missed day plus slack), not
      // on every reading the way the continuous daemons below are judged.
      stale: hoursSince(commentUpdated) !== null && (hoursSince(commentUpdated) as number) > 30,
    },
    peer_sweep: {
      service_active: serviceActive('peer-sweep.service'),
      refill_timer_active: serviceActive('peer-sweep-refill.timer'),
      state_updated_at: peerUpdated,
      hours_since_update: hoursSince(peerUpdated),
      ...work('peer_sweep'),
    },
    podcast_crossover: {
      daily_timer_active: serviceActive('podcast-crossover-daily.timer'),
      state_updated_at: podcastUpdated,
      hours_since_update: hoursSince(podcastUpdated),
      ...work('podcast_crossover'),
      stale: hoursSince(podcastUpdated) !== null && (hoursSince(podcastUpdated) as number) > 30,
    },
  };
}

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
// Drop every event belonging to a `--dry-run` campaign session (2026-08-12).
//
// campaign:dry logs to the same JSONL as a real session, and it walks its whole
// run plan instantly without touching anything. On 08-12 two verification dry
// runs contributed 2 of the reported 16 sessions and 30 of the reported 80
// finder passes — all of them zero-yield — which halved the reported per-pass
// yield (0.60/pass reported vs 0.96/pass actually worked) and made the day look
// worse than it was. A dry run is a check on the code, not a unit of work, so it
// must not appear in the cycle's numbers at all.
//
// Attribution is positional: a `start` carrying opts.dryRun opens a dry session
// and everything up to and including its `done` belongs to it. Sessions never
// interleave (single-instance lockfile), so this is exact.
function withoutDryRunSessions(
  ev: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const kept: Array<Record<string, unknown>> = [];
  let inDry = false;
  for (const e of ev) {
    if (e.event === 'start') {
      inDry = (e.opts as { dryRun?: boolean } | undefined)?.dryRun === true;
    }
    if (!inDry) kept.push(e);
    if (e.event === 'done') inDry = false;
  }
  return kept;
}

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
  ['bad_backend', /YOUTUBE_API_BACKEND must be/],
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
        for (const [name, re] of FATAL_PATTERNS) {
          if (!re.test(tail)) continue;
          // Mirror checkin.ts's benign carve-outs for campaign.ts's "two consecutive finder
          // failures" hard-stop, so the authoritative feed classifies it the SAME way the hourly
          // check-in (the paid-fix-agent gate) already does — otherwise the JSON cries
          // `finder_hard_wall` on a stop the check-in already ruled benign & self-healing:
          //  • 086affb (2026-07-19): benign on plain term-supply exhaustion ("No active terms to
          //    process") — routine drought the campaign-loop backs off 30min and retries.
          //  • benignFinalized (2026-07-29): benign on a transient infra blip (Airtable/YouTube
          //    503 SERVICE_UNAVAILABLE, network error, etc.) that ALREADY self-healed — proven
          //    when the SAME session still ran its finalization sequence to "[campaign] DONE"
          //    AFTER the hard-wall stop. campaign.ts always finalizes (final verify → promote →
          //    evaluate-probes → DONE) whether the cause was benign or not, so reaching DONE means
          //    the session completed and campaign-loop.sh has already retried successfully — it is
          //    definitionally not stuck. A genuine hang/crash (module error, OOM, unhandled
          //    campaign exception) never reaches DONE, so it is still surfaced. Without this the
          //    2026-07-30 cycle lit `finder_hard_wall` on a productive session (+18 parked, 118
          //    channels) whose only failure was two consecutive Airtable 503s that rode out within
          //    the same day — crying wolf against the check-in that had logged it benign. Genuine
          //    supply/quota problems are surfaced by supply_health + the hard_stops/quota_stops
          //    counts, not by this signature.
          if (
            name === 'finder_hard_wall' &&
            (/No active terms to process/.test(tail) || /\[campaign\] DONE\b/.test(tail))
          ) continue;
          found.add(name);
        }
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

  // Discovery-method attribution (2026-08-09, Casey-requested). discovered_via is a
  // JSON-array string; the FIRST entry's prefix identifies the method (see the Lead
  // type doc in src/airtable.ts). A bare term with no colon-prefix is the keyword
  // engine — the original method, so it has no tag of its own. This is what makes
  // comment-sweep/graph-sweep/peer-sweep's contribution visible in the daily report
  // instead of invisibly folded into "discovered_today" — see
  // [[comment-sweep-built-and-first-run]] memory for why that mattered.
  // Classifier moved to src/discovery-method.ts (2026-08-10) — the finder's per-pass yield
  // needs the same rule, and two copies would drift the moment a seventh method lands.
  const byMethod: Record<string, number> = {};
  const byMethodPitchable: Record<string, number> = {};
  for (const l of discovered) {
    const m = discoveryMethod(l.discovered_via);
    byMethod[m] = (byMethod[m] ?? 0) + 1;
  }
  for (const l of pitchable) {
    const m = discoveryMethod(l.discovered_via);
    byMethodPitchable[m] = (byMethodPitchable[m] ?? 0) + 1;
  }

  const emailVerified = discovered.filter((l) => l.outreach_status === 'email_verified').length;
  // Scoring health as a FIRST-CLASS metric (2026-08-05, autopilot-improve). It was already
  // present inside by_review_status, but buried there the 08-04 debrief walked straight past
  // 128 scoring_failed rows (16% of the day's discovery) and reported a clean day; by 08-05 it
  // was 580 rows (72%). Surfaced on its own so a scoring outage is impossible to miss in the
  // daily report even if the hourly check-in's alarm is ever mis-tuned.
  const scoringFailed = discovered.filter((l) => l.review_status === 'scoring_failed').length;

  const evAll = cycleCampaignEvents(sinceISO, untilISO);
  const ev = withoutDryRunSessions(evAll);
  const dryRunSessions = evAll.filter(
    (e) => e.event === 'start' && (e.opts as { dryRun?: boolean } | undefined)?.dryRun === true,
  ).length;
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
      scoring_failed: scoringFailed,
      scoring_failed_rate_pct: discovered.length > 0
        ? Math.round((1000 * scoringFailed) / discovered.length) / 10
        : 0,
      by_niche_pitchable: byNiche,
      by_review_status: byReview,
      by_discovery_method: byMethod,
      by_discovery_method_pitchable: byMethodPitchable,
    },
    discovery_methods_health: discoveryMethodsHealth(sinceMs, Date.parse(untilISO)),
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
      dry_run_sessions_excluded: dryRunSessions,
    },
    // scope is Anthropic-only: since the 2026-08-01 zero-Anthropic migration the pipeline's
    // LLM work runs on OpenRouter, which the burn ledger never meters — total_usd:0 == "$0
    // Anthropic", NOT "$0 total LLM spend". Labeled so a reader can't mistake one for the other.
    burn_today: {
      scope: burn.scope,
      note: 'Anthropic-only. Pipeline LLM (OpenRouter) is not metered here — total_usd:0 means $0 Anthropic, not $0 total LLM spend.',
      total_usd: burn.total_usd,
      by_source: burn.by_source,
      soft: burn.soft_usd,
      hard: burn.hard_usd,
    },
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
