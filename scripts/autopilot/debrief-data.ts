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
import { discoveryReportKey } from '../../src/discovery-method.ts';
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

// HOW MUCH ROAD IS LEFT, not just whether the lane moved (2026-08-21).
//
// The two blocks above ask "is it alive" and "did it advance any seeds". Both were
// green all through the 08-21 cycle for a lane that had collapsed 92%: the
// recommended-videos feed walked 10,300 seeds on 08-20 and 257 on 08-21, because its
// seed book finished and its refill only supplies the handful of channels the ICP
// newly qualifies each hour. `seeds_advanced: 257 > 0` reads as `productive: true`,
// so a lane running out of road is indistinguishable from a healthy one until the
// day's lead count comes in and it is already too late to have acted.
//
// Every sweep state file carries `seeds` and `processed`, so remaining road is free
// to compute, and `days_of_road` puts it in the unit that matters: at this lane's own
// demonstrated walk rate, how long until it is a trickle. Under 1.0 means it drains
// before the next debrief. Same rule for all four; podcast-crossover keeps `feeds`
// with no processed list and reports nulls rather than a guess.
type SeedCounts = {
  seeds_total: number | null;
  seeds_walked: number | null;
  seeds_remaining: number | null;
  book_drained: boolean | null;
};
type SeedBook = SeedCounts & { days_of_road: number | null };
function seedCounts(stateFile: string): SeedCounts {
  const blank: SeedCounts = {
    seeds_total: null, seeds_walked: null, seeds_remaining: null, book_drained: null,
  };
  const p = join(FINDER_REPO, 'logs', stateFile);
  if (!existsSync(p)) return blank;
  let state: { seeds?: unknown; processed?: unknown };
  try { state = JSON.parse(readFileSync(p, 'utf8')); } catch { return blank; }
  if (!Array.isArray(state.seeds) || !Array.isArray(state.processed)) return blank;

  // `processed` can hold ids the current book no longer lists (a refill that merged
  // dropped rows, a re-lap). Count what is left in THIS book, not total - walked,
  // which can go negative and read as a full book.
  const done = new Set(state.processed as unknown[]);
  const total = state.seeds.length;
  const remaining = (state.seeds as Array<Record<string, unknown>>)
    .filter((s) => !done.has(s?.videoId ?? s?.channelId ?? s?.id)).length;

  return {
    seeds_total: total,
    seeds_walked: total - remaining,
    seeds_remaining: remaining,
    book_drained: remaining === 0,
  };
}
function seedBook(counts: SeedCounts, advancedThisCycle: number | null): SeedBook {
  return {
    ...counts,
    // Only meaningful against a lane that actually walked this cycle; a stopped lane
    // has no rate, and dividing by zero would report infinite road on a dead engine.
    days_of_road: advancedThisCycle && advancedThisCycle > 0
      ? Math.round((counts.seeds_remaining! / advancedThisCycle) * 10) / 10
      : null,
  };
}

// HOW MANY SEEDS DID THIS CYCLE ACTUALLY WALK? (2026-08-23)
//
// `sweepWorkInCycle` below sums each session log that OVERLAPS the cycle window, but it
// sums the session's WHOLE advance, not the part inside the window. For lanes whose
// sessions are short and land inside one cycle that is exact — peer-sweep reported 264
// against a true 264 on 08-23. For a daemon that runs one 22-hour session it is not: the
// video-graph sweep reported 12,647 seeds on 08-23 when it walked 7,523, because a session
// that started at 09:30 the PREVIOUS day and ended 38 minutes into this one contributed its
// entire 5,204-seed history to this cycle's total.
//
// That inflation is not cosmetic. It fed `days_of_road` (2.3 reported against a true 3.9)
// and it fed `walk_rate_change_pct`, which is what raised the 08-22 debrief's headline
// finding of a 27% throughput regression on the lane that produces 80% of our leads.
//
// The exact number was already on disk and unused: `seeds_walked` is a snapshot of the
// lane's own state file, this script has written it into the debrief JSON since 08-22, and
// the difference between two consecutive snapshots is precisely the seeds walked between
// them. Prefer that. Fall back to the log sum when the delta cannot be trusted — a missing
// baseline (first run after a deploy, a skipped cycle) or a NEGATIVE delta, which is how a
// re-lap or a refill that drops merged rows shows up. Never guess between the two silently:
// `seeds_advanced_source` names which one produced the number.
export type AdvanceSource = 'book_delta' | 'session_logs' | 'none';
export function reconcileAdvanced(
  loggedAdvance: number | null,
  walkedNow: number | null,
  walkedPrevCycle: number | null,
): { seeds_advanced: number | null; seeds_advanced_source: AdvanceSource } {
  if (walkedNow !== null && walkedPrevCycle !== null && walkedNow >= walkedPrevCycle) {
    return { seeds_advanced: walkedNow - walkedPrevCycle, seeds_advanced_source: 'book_delta' };
  }
  if (loggedAdvance === null) return { seeds_advanced: null, seeds_advanced_source: 'none' };
  return { seeds_advanced: loggedAdvance, seeds_advanced_source: 'session_logs' };
}

// IS IT WALKING SLOWER THAN IT COULD? (2026-08-22)
//
// `days_of_road` above answers "does this lane have material left". It cannot answer the
// opposite question, which is the one the 08-22 cycle turned on: the video-graph sweep was
// handed 42,096 fresh seeds by the 08-21 seed-floor fix, had 4.5 days of road, reported
// `productive: true` and `book_drained: false` — and still walked 8,303 seeds against
// 11,415 the day before. Nothing in the snapshot said so. Every field was green because
// every field was measuring seed SUPPLY, and supply had stopped being the constraint.
//
// A lane with road left that walks materially less than it did last cycle is throughput-
// bound: the limit has moved off seed supply and onto walk rate, which is a completely
// different fix (concurrency, pacing, fetch cost) from "give it more seeds". The previous
// cycle's own snapshot is already on disk, written by this same script, so the comparison
// costs one file read and no network.
//
// Deliberately compares raw seeds-per-cycle rather than a per-hour rate: both cycles are
// the same 24h window by construction, and a derived rate would invent precision the
// session logs do not carry.
const WALK_RATE_DROP_PCT = -20; // below this, with road left, the lane is not supply-bound
type WalkRate = {
  seeds_advanced_prev: number | null;
  walk_rate_change_pct: number | null;
  throughput_bound: boolean | null;
};
export function walkRateTrend(
  advancedThisCycle: number | null,
  advancedPrevCycle: number | null,
  book: Pick<SeedBook, 'book_drained' | 'days_of_road'>,
  // Both sides must have been measured the same way. `reconcileAdvanced` above changed how
  // this number is derived, so on the first cycle after that change the baseline is still a
  // session-log sum and the corrected current value would read as a fabricated drop against
  // it. Report the percentage, which is honest arithmetic, but never escalate to
  // `throughput_bound` off a mixed comparison. Self-heals: from the next cycle both sides
  // are `book_delta` and the flag arms again.
  comparableBaseline: boolean = true,
): WalkRate {
  const blank: WalkRate = { seeds_advanced_prev: advancedPrevCycle, walk_rate_change_pct: null, throughput_bound: null };
  if (advancedThisCycle === null || advancedPrevCycle === null || advancedPrevCycle <= 0) return blank;
  const pct = Math.round(((advancedThisCycle - advancedPrevCycle) / advancedPrevCycle) * 1000) / 10;
  // A drained book explains its own slowdown — that is `book_drained`'s job, and flagging it
  // here too would double-report the 08-21 finding as a new one every cycle. Same for a lane
  // with under a day of road: it is about to be supply-bound whatever its rate did.
  const hasRoad = book.book_drained === false && (book.days_of_road ?? 0) >= 1;
  return {
    seeds_advanced_prev: advancedPrevCycle,
    walk_rate_change_pct: pct,
    throughput_bound: comparableBaseline ? hasRoad && pct <= WALK_RATE_DROP_PCT : null,
  };
}

// Last cycle's `seeds_advanced` per lane, read out of the debrief snapshot this script
// wrote 24h ago. Returns an empty map when that file is missing or unreadable (first run
// after a deploy, a skipped cycle) — an absent baseline reports nulls, never a false alarm.
type PriorLane = { seeds_advanced?: number | null; seeds_walked?: number | null; seeds_advanced_source?: string | null };
function priorLanes(priorDate: string, logsDir: string): Record<string, PriorLane> {
  const p = join(logsDir, `autopilot-debrief-${priorDate}.json`);
  if (!existsSync(p)) return {};
  try {
    const prior = JSON.parse(readFileSync(p, 'utf8')) as {
      discovery_methods_health?: Record<string, PriorLane>;
    };
    return prior.discovery_methods_health ?? {};
  } catch { return {}; }
}
export function priorSeedsAdvanced(priorDate: string, logsDir: string = LOGS): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [lane, h] of Object.entries(priorLanes(priorDate, logsDir))) {
    out[lane] = typeof h?.seeds_advanced === 'number' ? h.seeds_advanced : null;
  }
  return out;
}
// The other half of the same snapshot: where each lane's seed book stood 24h ago, which is
// what `reconcileAdvanced` differences against. Written into the debrief JSON since 08-22,
// so the first cycle that can use it is 08-23.
export function priorSeedsWalked(priorDate: string, logsDir: string = LOGS): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [lane, h] of Object.entries(priorLanes(priorDate, logsDir))) {
    out[lane] = typeof h?.seeds_walked === 'number' ? h.seeds_walked : null;
  }
  return out;
}
// Absent on any snapshot written before 2026-08-23, which is exactly the case that must not
// arm `throughput_bound` — an older snapshot's number is a session-log sum by definition.
export function priorAdvanceSource(priorDate: string, logsDir: string = LOGS): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [lane, h] of Object.entries(priorLanes(priorDate, logsDir))) {
    out[lane] = typeof h?.seeds_advanced_source === 'string' ? h.seeds_advanced_source : null;
  }
  return out;
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
  video_graph_sweep: 'video-graph-sweep-sessions',
  peer_sweep: 'peer-sweep-sessions',
  comment_sweep: 'comment-sweep-sessions',
  podcast_crossover: 'podcast-crossover-sessions',
};
type SweepWork = {
  runs_in_cycle: number;
  seeds_advanced: number | null;
  idle_reason: string | null;
  productive: boolean | null;
  /**
   * How many of the lane's MOST RECENT consecutive runs advanced no seeds, and when that
   * run of nothing began (2026-08-19).
   *
   * `productive` sums the whole window, so a lane that did great work in hour one and
   * nothing for the nine hours since reads `productive: true`. That is exactly what the
   * video-graph sweep reported on 08-19 while it was deadlocked and still deadlocked at
   * debrief time — 33 consecutive runs advancing nothing, the outage visible only as a
   * one-line `idle_reason` that a reader had to interpret. A lane dying at the END of a
   * cycle is the case that matters most, because it is still dying now.
   */
  idle_run_streak: number;
  idle_since: string | null;
};
// Every `outreach_status` that can only be reached by verifying an email first. The
// debrief reports "emails verified today" and used to test `=== 'email_verified'`, which
// is a snapshot of where a lead is standing RIGHT NOW rather than a count of what the
// verifier did. The moment a verified lead advances — and the campaign's own promote step
// advances it to `ready_data_scraped` within the same cycle — it stops being counted, so
// the metric decays toward zero as the pipeline works properly.
//
// It reached exactly zero on 2026-08-14: every one of the day's 53 newly-parked leads had
// a verified email and sat at `ready_data_scraped`, and the funnel reported 0 verified out
// of 170 pitchable. A headline number that reads 0 on a working day is worse than no
// number, because the obvious reading is that verification broke.
//
// `ready_no_data` is deliberately NOT here. It is a reserved manual holding label that
// nothing in the pipeline writes, so counting it would mean trusting a hand-applied label
// as evidence that the verifier ran.
const VERIFIED_OR_BEYOND: ReadonlySet<string> = new Set([
  'email_verified',
  'ready_data_scraped',
  'enriched', // legacy alias for ready_data_scraped, still recognised on read
  'email_drafted',
  'sent_to_smartlead',
]);
export function isVerifiedOrBeyond(status: unknown): boolean {
  return typeof status === 'string' && VERIFIED_OR_BEYOND.has(status);
}

// A session log's own start instant, read off its filename (`sweep-20260812-120629.log`,
// `daily-20260812-165034.log`) rather than its mtime, because mtime is the LAST write.
// Falls back to mtime when the name doesn't carry a stamp.
export function sessionStartMs(path: string, mtimeMs: number): number {
  const m = /(\d{8})-(\d{6})\.log$/.exec(path);
  if (!m) return mtimeMs;
  const [, d, t] = m as unknown as [string, string, string];
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : mtimeMs;
}

// Seeds this ONE session advanced: where its chunk counter ended, minus where its
// startup line said it began.
//
//   [peer-sweep] 7587 seeds total | 2470 done | 5117 remaining   <- startup
//   [chunk 445/512]  seeds 6911-6920 of 7587                     <- progress
//
// Reading only the startup line (as the 2026-08-12 version did) measures a session
// that has not finished as zero, forever. Returns null when the session printed no
// progress line at all — genuinely unknown, which is not the same as zero.
export function sessionSeedsAdvanced(text: string): number | null {
  const start = /\|\s*(\d+)\s+done\s*\|/.exec(text);
  if (!start?.[1]) return null;

  // PREFER THE SUMMARY, WHICH COUNTS WHAT WAS CONSUMED (2026-08-19). Every sweep ends with
  // `<NAME> SWEEP — <walked>/<total> (seeds|videos) walked`, and that number only moves when
  // seeds are actually checkpointed. The chunk header below is the range a chunk INTENDED to
  // walk, printed before any of it happens — so a run that bailed on its first chunk without
  // consuming anything still read as a full chunk of progress. That is not a rounding error:
  // the video-graph sweep's 33 dead relaunches on 08-18/19 each claimed 20 seeds, so a lane
  // that had been frozen for nine hours was reported as having advanced 7,486 seeds and
  // `productive: true`. The idle-run streak beside it depends on this being honest.
  const summaries = [...text.matchAll(/SWEEP\s+[—-]\s+(\d+)\s*\/\s*\d+\s+(?:seeds|videos)\s+walked/g)];
  const summary = summaries.length ? summaries[summaries.length - 1]![1] : undefined;
  if (summary !== undefined) return Math.max(0, Number(summary) - Number(start[1]));

  // No summary block: the session is mid-flight (or was killed). Fall back to the chunk
  // header, which over-reports by at most the chunk in progress.
  // `videos` as well as `seeds`: video-graph-sweep prints the identical chunk line but
  // walks videos, and matching only `seeds` reported the pipeline's biggest lane as null.
  const chunks = [...text.matchAll(/\[chunk[^\]]*\]\s+(?:seeds|videos)\s+\d+\s*-\s*(\d+)\s+of\b/g)];
  const end = chunks.length ? chunks[chunks.length - 1]![1] : undefined;
  if (end === undefined) return null;
  // Per-session, so a mid-cycle seed refill (which resets `done`) can't drive the
  // total negative the way a first-file/last-file delta could.
  return Math.max(0, Number(end) - Number(start[1]));
}

function sweepWorkInCycle(dirName: string, sinceMs: number, untilMs: number): SweepWork {
  const blank: SweepWork = {
    runs_in_cycle: 0, seeds_advanced: null, idle_reason: null, productive: null,
    idle_run_streak: 0, idle_since: null,
  };
  const dir = join(FINDER_REPO, 'logs', dirName);
  if (!existsSync(dir)) return blank;
  let files: Array<{ path: string; startMs: number }>;
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.log'))
      .map((f) => {
        const path = join(dir, f);
        const endMs = statSync(path).mtimeMs;
        return { path, startMs: sessionStartMs(path, endMs), endMs };
      })
      // Interval overlap, not "mtime landed inside the window". A daemon that runs one
      // 19-hour session is still being appended to when the debrief fires, so its mtime
      // sits AFTER the cycle end and the old containment test dropped it — which is how
      // peer-sweep walked 4,530 seeds on 2026-08-13 and was reported as 0, idle.
      .filter((f) => f.startMs <= untilMs && f.endMs >= sinceMs)
      .sort((a, b) => a.startMs - b.startMs)
      .map(({ path, startMs }) => ({ path, startMs }));
  } catch {
    return blank;
  }
  if (files.length === 0) return blank;

  const read = (path: string): string | null => {
    try { return readFileSync(path, 'utf8'); } catch { return null; }
  };

  let advanced: number | null = null;
  const perRun: Array<{ startMs: number; advanced: number | null }> = [];
  for (const { path, startMs } of files) {
    const text = read(path);
    if (text === null) { perRun.push({ startMs, advanced: null }); continue; }
    const n = sessionSeedsAdvanced(text);
    perRun.push({ startMs, advanced: n });
    if (n === null) continue;
    advanced = (advanced ?? 0) + n;
  }

  // Walk BACK from the newest run while each one advanced nothing. Only a zero counts as
  // idle; an unparseable run stops the walk rather than being guessed at either way.
  let idleStreak = 0;
  let idleSince: string | null = null;
  for (let i = perRun.length - 1; i >= 0; i--) {
    const r = perRun[i]!;
    if (r.advanced === 0) {
      idleStreak += 1;
      idleSince = new Date(r.startMs).toISOString();
    } else break;
  }

  // Why it stopped, taken from the most recent run: a PAUSE/HALT/STOP line if
  // there is one. This is the line that would have named the outage on day one.
  const tail = read(files[files.length - 1]!.path);
  const idle = tail === null
    ? null
    : /^\[[^\]]+\]\s+(PAUSE|STOP|HALTED)\b.*$/m.exec(tail)?.[0]?.trim() ?? null;

  return {
    runs_in_cycle: files.length,
    seeds_advanced: advanced,
    idle_reason: idle,
    productive: advanced === null ? null : advanced > 0,
    idle_run_streak: idleStreak,
    idle_since: idleSince,
  };
}
function discoveryMethodsHealth(sinceMs: number, untilMs: number): Record<string, unknown> {
  const work = (key: string): SweepWork =>
    sweepWorkInCycle(SWEEP_SESSION_DIRS[key]!, sinceMs, untilMs);
  const graphUpdated = sweepStateUpdatedAt('graph-sweep-state.json');
  const videoGraphUpdated = sweepStateUpdatedAt('video-graph-sweep-state.json');
  const commentUpdated = sweepStateUpdatedAt('comment-sweep-state.json');
  const peerUpdated = sweepStateUpdatedAt('peer-sweep-state.json');
  const podcastUpdated = sweepStateUpdatedAt('podcast-crossover-state.json');
  // Bind each lane's work to its own book so `days_of_road` is measured at the rate
  // that lane actually walked this cycle, not a shared average.
  const graphWork = work('recommended_videos_feed');
  const videoGraphWork = work('video_graph_sweep');
  const commentWork = work('comment_sweep');
  const peerWork = work('peer_sweep');
  const podcastWork = work('podcast_crossover');
  // The prior cycle's debrief is dated by ITS cycle-start, which is this cycle's start
  // instant (both are PT midnight), so the lookup needs no separate date arithmetic.
  const priorDate = pacificDate(new Date(sinceMs));
  const prior = priorSeedsAdvanced(priorDate);
  const priorWalked = priorSeedsWalked(priorDate);
  const priorSource = priorAdvanceSource(priorDate);
  // Counts first, then the reconciled cycle advance, then the road that advance implies.
  // `days_of_road` and `walk_rate_change_pct` both divide by this number, so it has to be
  // settled before either is computed.
  const advance = (lane: string, w: SweepWork, c: SeedCounts) =>
    reconcileAdvanced(w.seeds_advanced, c.seeds_walked, priorWalked[lane] ?? null);
  const trend = (lane: string, advanced: number | null, source: AdvanceSource, b: SeedBook): WalkRate =>
    walkRateTrend(advanced, prior[lane] ?? null, b, (priorSource[lane] ?? 'session_logs') === source);
  const lane = (key: string, stateFile: string, w: SweepWork) => {
    const counts = seedCounts(stateFile);
    const adv = advance(key, w, counts);
    const book = seedBook(counts, adv.seeds_advanced);
    return { ...w, ...adv, ...book, ...trend(key, adv.seeds_advanced, adv.seeds_advanced_source, book) };
  };
  const graphLane = lane('recommended_videos_feed', 'graph-sweep-state.json', graphWork);
  const videoGraphLane = lane('video_graph_sweep', 'video-graph-sweep-state.json', videoGraphWork);
  const commentLane = lane('comment_sweep', 'comment-sweep-state.json', commentWork);
  const peerLane = lane('peer_sweep', 'peer-sweep-state.json', peerWork);
  const podcastLane = lane('podcast_crossover', 'podcast-crossover-state.json', podcastWork);
  return {
    recommended_videos_feed: {
      service_active: serviceActive('graph-sweep.service'),
      refill_timer_active: serviceActive('graph-sweep-refill.timer'),
      state_updated_at: graphUpdated,
      hours_since_update: hoursSince(graphUpdated),
      ...graphLane,
    },
    // Added 2026-08-18, the cycle after this lane shipped. It found 3,279 channels and 206
    // leads on its first full day — more than any other lane — with no health entry here,
    // so a stall would have been silent. Continuous daemon, judged like the feed above.
    video_graph_sweep: {
      service_active: serviceActive('video-graph-sweep.service'),
      state_updated_at: videoGraphUpdated,
      hours_since_update: hoursSince(videoGraphUpdated),
      ...videoGraphLane,
    },
    comment_sweep: {
      daily_timer_active: serviceActive('comment-sweep-daily.timer'),
      state_updated_at: commentUpdated,
      hours_since_update: hoursSince(commentUpdated),
      ...commentLane,
      // Runs once/day by design — flag only past ~30h (a missed day plus slack), not
      // on every reading the way the continuous daemons below are judged.
      stale: hoursSince(commentUpdated) !== null && (hoursSince(commentUpdated) as number) > 30,
    },
    peer_sweep: {
      service_active: serviceActive('peer-sweep.service'),
      refill_timer_active: serviceActive('peer-sweep-refill.timer'),
      state_updated_at: peerUpdated,
      hours_since_update: hoursSince(peerUpdated),
      ...peerLane,
    },
    podcast_crossover: {
      daily_timer_active: serviceActive('podcast-crossover-daily.timer'),
      state_updated_at: podcastUpdated,
      hours_since_update: hoursSince(podcastUpdated),
      ...podcastLane,
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

  // Close the window at the cycle end too. The query is open-ended, so every row the
  // sweeps write between midnight PT and whenever this actually runs used to land in
  // "today" — and the debrief is written FROM these numbers, so a rerun silently
  // reported different intake than the first run. Trimmed here rather than in the
  // filter formula: the Postgres translator refuses anything it can't render exactly,
  // and a debrief that returns nothing is worse than one that returns 0.2% too much.
  // Parsed, not string-compared: Postgres hands back `2026-08-13 07:23:19.265+00`
  // (space, no Z) and lexical order puts that BEFORE `2026-08-13T07:00:00.000Z`,
  // which would quietly keep every row it is meant to drop.
  const untilMsExact = Date.parse(untilISO);
  const discovered: Lead[] = (await getLeadsDiscoveredSince(sinceISO).catch(() => []))
    .filter((l) => {
      if (!l.first_discovered_at) return true;
      const t = Date.parse(l.first_discovered_at);
      return !Number.isFinite(t) || t < untilMsExact;
    });
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
    const m = discoveryReportKey(l.discovered_via);
    byMethod[m] = (byMethod[m] ?? 0) + 1;
  }
  for (const l of pitchable) {
    const m = discoveryReportKey(l.discovered_via);
    byMethodPitchable[m] = (byMethodPitchable[m] ?? 0) + 1;
  }

  const emailVerified = discovered.filter((l) => isVerifiedOrBeyond(l.outreach_status)).length;
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
