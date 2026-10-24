// Autopilot debrief data-gatherer (feeds component D).
//
// Emits a compact JSON snapshot of the cycle (midnight-PT → now) so the daily debrief
// agent writes a report grounded in real numbers, not guesses. Reuses the campaign's own
// database helpers (src/db.ts, Postgres via pipeline-db) + the campaign JSONL. Prints JSON to stdout; also writes it to
// logs/autopilot-debrief-<pacific-date>.json.

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  countByReviewStatus,
  countSentBetween,
  countFirstTouchBetween,
  bulkStatusWrites,
  bulkStatusWriteRollup,
  reviewStatusPopulation,
  countShelf,
  getLeadsDiscoveredSince,
  type BulkRewriteRoll,
  type BulkStatusWrite,
  type Lead,
} from '../../src/db.ts';
import { discoveryReportKey } from '../../src/discovery-method.ts';
import {
  collectBookDepth,
  collectPassAttribution,
  collectPasses,
  collectYieldBetween,
  loadState,
  methodProduction,
  noSiteCause,
} from '../../src/recovery/bloodhound-lane.ts';
import { summarizeToday, pacificDate } from './burn-ledger.js';

const REPO = '/home/casey/repos/youtube-outreach-orchestrator-v1';
const LOGS = join(REPO, 'logs');
const FINDER_REPO = '/home/casey/repos/youtube-lead-finder-v1';
const AUTOMATOR_REPO = '/home/casey/repos/automator';

// THE SEND PLAN, AND WHY A ZERO-SEND DAY WAS UNREADABLE (2026-09-30).
//
// Siege in `automator` sends almost everything. Its daily timer PLANS a batch and
// writes a 20-email sample, then stops on `SAMPLE RUN: nothing pushed, nothing sent.
// Waiting on Casey's approval.` The push is a separate step somebody has to run.
//
// On Tuesday 2026-09-29 the plan held 150 assignments against 296 free mailbox slots
// and nobody approved it, so the whole pipeline sent 4 emails — all four from this
// repo's own session-start send. The debrief had `sent_today.total: 4` and no way to
// tell that apart from "nothing was ready", "SmartLead doesn't send at weekends", or
// "the send crashed". Three very different days, one number.
//
// So read Siege's own plan for the cycle. Deliberately filesystem-only: no database
// call, no automator import, no cost, and a missing or malformed plan degrades to
// `plan_found: false` rather than taking the debrief down with it. This repo must not
// grow send logic (see CLAUDE.md "No business logic here") — it only counts.
export type SiegePlanFacts = {
  plan_found: boolean;
  plan_day: string | null;
  email_paused: boolean | null;
  day_cap: number | null;
  planned: number | null;
  mailbox_slots: number | null;
  live_inboxes: number | null;
  offers_blocked: number | null;
  /** Total messages a day the live mailboxes allow, before follow-ups take their share. */
  mailbox_capacity: number | null;
  /** Follow-ups the live mailboxes owe today. These are spent before any new person. */
  followups_due: number | null;
  /** Live mailboxes with no room left at all for a new person. */
  inboxes_full: number | null;
  /** Ready people who got no slot today, summed over Siege's tiers. This is the queue
   *  behind `sent_today.first_touch`: slots are handed out by tier, so a tier with a
   *  full re-offer queue takes them all and never-emailed people below it wait. */
  waiting_for_a_slot: number | null;
  /** The same, per tier, so "the Whale queue ate the day" is readable rather than
   *  inferred. Keys are automator's tier names; null if the plan stops carrying them. */
  waiting_by_tier: Record<string, number> | null;
  /** When Siege wrote the plan file we just read. NOT the start of the day: the file is
   *  overwritten in place, so a re-plan late at night replaces the morning's fleet
   *  snapshot and every number above describes the fleet AT THIS STAMP. See the
   *  block comment on fleetFacts(). */
  plan_generated_at: string | null;
};

const NO_PLAN: SiegePlanFacts = {
  plan_found: false,
  plan_day: null,
  email_paused: null,
  day_cap: null,
  planned: null,
  mailbox_slots: null,
  live_inboxes: null,
  offers_blocked: null,
  mailbox_capacity: null,
  followups_due: null,
  inboxes_full: null,
  waiting_for_a_slot: null,
  waiting_by_tier: null,
  plan_generated_at: null,
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Pure so the selftest can feed it a hand-built plan. Every field is optional on the
// way in: automator owns this file's shape and may change it without telling us, and a
// renamed key must cost one null, not the block.
export function siegePlanFacts(raw: unknown): SiegePlanFacts {
  if (!raw || typeof raw !== 'object') return NO_PLAN;
  const plan = raw as { summary?: Record<string, unknown>; assignments?: unknown };
  const s = plan.summary && typeof plan.summary === 'object' ? plan.summary : {};
  const inboxes = Array.isArray(s.inboxes) ? (s.inboxes as Array<Record<string, unknown>>) : null;
  const live = inboxes?.filter((i) => i.live === true) ?? null;
  return {
    plan_found: true,
    plan_day: typeof s.day === 'string' ? s.day : null,
    email_paused: typeof s.email_paused === 'boolean' ? s.email_paused : null,
    day_cap: num(s.day_cap),
    planned: Array.isArray(plan.assignments) ? plan.assignments.length : null,
    // What the warm mailboxes would actually accept, which is the number that stopped
    // being the constraint on 09-29 (33 slots on 09-28 -> 296 on 09-29, on +1 inbox:
    // Monday's follow-ups were eating the ladder and Tuesday's were zero).
    mailbox_slots: live === null
      ? null
      : live.reduce((t, i) => t + (num(i.free_before_fill) ?? 0), 0),
    live_inboxes: live?.length ?? null,
    // An object keyed by offer name, each holding that offer's list of reasons. Counted
    // because it is the ceiling on who can be emailed without repeating anyone: 9 of
    // Siege's 16 offers could not run on 2026-09-29. Accepts an array too, so a later
    // shape change degrades to a count rather than a null.
    offers_blocked: Array.isArray(s.offer_problems)
      ? s.offer_problems.length
      : s.offer_problems && typeof s.offer_problems === 'object'
        ? Object.keys(s.offer_problems).length
        : null,
    // WHY mailbox_slots COLLAPSED, WHICH THE SLOT COUNT ALONE CANNOT SAY (2026-10-13).
    //
    // `mailbox_slots` is a remainder: a mailbox's daily allowance minus the follow-ups it
    // already owes. So a healthy fleet and a crippled one report the same small number,
    // and the reader cannot tell a suspension wave from a follow-up wave. On 2026-10-12
    // the fleet was the HEALTHIEST it had been all week — 57 of 58 inboxes live against
    // 50 on Friday, and the highest daily allowance of the three days, 855 — and slots
    // still fell from 618 to 76, because 1,495 follow-ups came due in one day and 50 of
    // the 57 live mailboxes had no room left at all. Reading that took opening
    // automator's own plan by hand, and the mailbox_slots comment above has been naming
    // this shape since 09-29 without ever carrying the number that proves it.
    //
    // It is structural, not weather: every offer is a three-email sequence on days 0, 4
    // and 10, and SmartLead sends Monday to Thursday, so a weekend's worth of due
    // follow-ups piles onto Monday on top of Monday's own. A big first-touch day
    // mortgages the next week's capacity. Capacity against the follow-up bill is what
    // sizes the fleet; the slot remainder on its own argues for nothing.
    mailbox_capacity: live === null
      ? null
      : live.reduce((t, i) => t + (num(i.message_per_day) ?? 0), 0),
    followups_due: live === null
      ? null
      : live.reduce((t, i) => t + (num(i.followups_due) ?? 0), 0),
    inboxes_full: live === null
      ? null
      : live.filter((i) => (num(i.free_before_fill) ?? 0) === 0).length,
    // WHO WAS READY AND GOT NOTHING (2026-10-17). Siege's `fill_slots` sorts by
    // `priority_key` — tier, then score, then subscribers — and nothing in that key
    // asks whether a person has already heard from us. The Whale tier's never-emailed
    // supply ran out on the 776-person push of 10-13, so on 10-16 all 82 slots went to
    // Whale re-offers while 141 Strong-7 and 808 Other-7+ people sat ready, with
    // research bundles, and waited. That is the mechanism behind a 1% first-touch day,
    // it is already in the plan file, and reading it took opening that file by hand.
    waiting_for_a_slot: (() => {
      const w = s.waiting_for_a_slot;
      if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
      return Object.values(w as Record<string, unknown>)
        .reduce((t: number, v) => t + (num(v) ?? 0), 0);
    })(),
    waiting_by_tier: (() => {
      const w = s.waiting_for_a_slot;
      if (!w || typeof w !== 'object' || Array.isArray(w)) return null;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(w as Record<string, unknown>)) {
        const n = num(v);
        if (n !== null) out[k] = n;
      }
      return Object.keys(out).length > 0 ? out : null;
    })(),
    plan_generated_at: typeof s.generated_at === 'string' ? s.generated_at : null,
  };
}

// --- THE FLEET ITSELF SHRANK AND THREE SNAPSHOTS IN A ROW COULD NOT SAY SO (2026-10-15) ---
//
// The block above settled that a small `mailbox_slots` argues for nothing, and said
// capacity against the follow-up bill is what sizes the fleet. It is, and nothing
// compared either one to yesterday. Across the three cycles after the record push the
// send plan read:
//
//   10-13   57 live inboxes   855 messages/day allowance   1,495 follow-ups due
//   10-14   53 live inboxes   795                              0
//   10-15   43 live inboxes   645                            562
//
// A quarter of the fleet and 210 messages a day of allowance gone in three days, and
// every one of those numbers looked unremarkable on its own morning. The cause is on
// disk in the email repo: the inbox health gate paused 13 mailboxes in its 2026-10-14
// run, 0 for warmup day and all 13 for a health score under 90, some as low as 53.5 —
// its biggest single pull in five weeks, the morning after 782 emails went out in one
// push. A suspended mailbox needs two weeks of warmup to come back, so this is the
// expensive kind of capacity loss, not weather.
//
// So carry the day-over-day move and the gate's own last run. Stated carefully: the gate
// also pulled 6 mailboxes after a zero-send weekend, so pauses churn on their own and a
// correlation is not a proof. What the fields are for is making the question askable on
// the morning it starts rather than three days later.
// --- AND THE DELTA COMPARED TWO SNAPSHOTS TAKEN 12 HOURS APART (2026-10-16) ---
//
// The block above shipped the day-over-day move and it read -22 live inboxes / -330
// messages on its second day. The fleet did shrink. The size of that one-day step did
// not happen in one day, and the snapshot could not say so:
//
//   • `state/siege/<day>/plan.json` is OVERWRITTEN in place. The 10-14 file was written
//     at 10:36Z, before that day's push. The 10-15 file was written at 23:00Z, twelve
//     hours AFTER its push ran at 11:28Z — so the two numbers being subtracted describe
//     the fleet at two different times of day, and the newer one describes a fleet that
//     sent nothing at all.
//   • A second, stricter gate went live INSIDE this cycle: `automator/scripts/inbox-health.py`
//     ran for the first time at 22:57Z, suspended its first band of mailboxes, and the
//     23:00Z re-plan is a photograph of that. The push three minutes earlier flew with
//     the morning's fleet.
//   • The giveaway was already in the snapshot and unread: `planned` (100, counted off
//     the re-plan's assignments) was SMALLER than `sent_in_cycle` (160). A plan cannot
//     send more than it holds. That inequality is the file saying "I am not the plan
//     that was pushed".
//
// So carry the stamp, the gap between the two stamps, and whether the newest plan was
// written after the push it is being read as the fleet for. A delta across a 12-hour gap
// is not wrong, it is a different measurement, and it must not read as one day's loss.
//
// --- AND THE PAUSE-REASON SPLIT SILENTLY READ "NEITHER" (2026-10-16) ---
//
// Same cycle, same block: `gate_paused: 4` beside `gate_paused_on_health: 0` and
// `gate_paused_on_warmup: 0`. Four mailboxes paused for no reason at all, which is not a
// thing the gate can do. All four were health pauses, as low as 73.4.
//
// The split is read off the old gate's `pausedByGate` registry, matched by name. The new
// band gate ADOPTS health-only pauses out of that registry into its own ledger
// (`adopt()` in automator/scripts/inbox_health.py) and deletes them, because with the old
// gate's health rule retired it would otherwise resume them. So the reasons move house
// about thirteen hours after the pause, and a debrief reading afterwards finds the names
// in `history` and nothing in the registry. Nothing had been added to that registry
// since 2026-09-08 while the history recorded pauses on six of the last eight days.
//
// It degrades backwards, too: the 10-15 debrief read 13 of 13 on health and was right at
// the time; the same run now reads 0 and 0. An instrument that quietly changes its answer
// about a past day is worse than one that says it does not know.
//
// Two fixes. Read the new gate's ledger for the reasons as well as the old registry,
// newest owner first. And never let the split claim "neither": any paused mailbox whose
// reason could not be found anywhere is counted in `gate_paused_unexplained`, so
// health + warmup + unexplained always adds up to `gate_paused`.
export type FleetFacts = {
  live_inboxes_prev: number | null;
  live_inboxes_change: number | null;
  mailbox_capacity_prev: number | null;
  mailbox_capacity_change: number | null;
  /** When Siege wrote the plan this cycle's fleet numbers came from, and the one
   *  yesterday's came from. Both needed, because the delta is only a day's move if the
   *  two were taken about a day apart. */
  plan_generated_at: string | null;
  plan_generated_at_prev: string | null;
  /** Hours between the two snapshots. ~24 is a day-over-day move; 12 or 36 is not. */
  snapshot_gap_hours: number | null;
  /** True when the plan on disk was written AFTER the push that sent in this cycle, so
   *  it describes a fleet that sent nothing. null when either stamp is missing. */
  replanned_after_push: boolean | null;
  /** The one field to read before quoting a change: false means the two snapshots are
   *  not a day apart or the newer one post-dates the push, so the delta is real
   *  arithmetic on two different measurements. null means a stamp was missing. */
  delta_comparable: boolean | null;
  /** When the inbox health gate last ran. It is staleness-gated to once per 24h. */
  gate_last_run: string | null;
  gate_paused: number | null;
  gate_resumed: number | null;
  /** The split that decides whether a pull is deliverability or just a young mailbox. */
  gate_paused_on_health: number | null;
  gate_paused_on_warmup: number | null;
  /** Paused mailboxes whose reason is in neither ledger. Keeps the split honest:
   *  health + warmup + unexplained === gate_paused, always. */
  gate_paused_unexplained: number | null;
  /** Mailboxes the gate is holding paused right now, all causes, all time. */
  gate_paused_total: number | null;
  /** Largest single pull in the gate's retained history, for scale. */
  gate_biggest_pull: number | null;
  gate_biggest_pull_at: string | null;
  /** The band gate in automator, which took over health pauses on 2026-10-15T22:57Z and
   *  is now the thing that decides how many mailboxes can send. Its bands say the fleet's
   *  size in one number each: `stop` is suspended, `watch` is on its way there. */
  band_gate_run_at: string | null;
  band_normal: number | null;
  band_watch: number | null;
  band_stop: number | null;
  /** Mailboxes the band gate holds suspended in its own name. */
  band_gate_owned: number | null;
  /** The band gate's OWN day-over-day move, read from its own retained run history
   *  (2026-10-18). Needed because on a non-sending day there is no plan, so `band_normal`
   *  is the only live fleet number — and the only prior number beside it was
   *  `live_inboxes_prev`, which is Siege's plan-time count from a different instrument on a
   *  different day. Subtracting those two is the 2026-10-16 fault in a new place. These
   *  fields come from one instrument, so the subtraction is sound by construction. */
  band_prev_at: string | null;
  band_normal_prev: number | null;
  band_watch_prev: number | null;
  band_stop_prev: number | null;
  band_normal_change: number | null;
  band_stop_change: number | null;
  /** Hours between the two band readings, and whether that makes them a day's move. */
  band_gap_hours: number | null;
  band_delta_comparable: boolean | null;
  /** Mailboxes the gate actually moved inside the cycle window, by direction. This is the
   *  morning question ("did the fleet move, and which way") answered without a hand grep
   *  of the gate log. null when no window was supplied: unknown, not zero. */
  band_moved_to_normal: number | null;
  band_moved_to_watch: number | null;
  band_moved_to_stop: number | null;
  /** Who came back, capped. A batch returning in one hour is worth seeing by name. */
  band_returned: string[];
};

const NO_FLEET: FleetFacts = {
  live_inboxes_prev: null,
  live_inboxes_change: null,
  mailbox_capacity_prev: null,
  mailbox_capacity_change: null,
  plan_generated_at: null,
  plan_generated_at_prev: null,
  snapshot_gap_hours: null,
  replanned_after_push: null,
  delta_comparable: null,
  gate_last_run: null,
  gate_paused: null,
  gate_resumed: null,
  gate_paused_on_health: null,
  gate_paused_on_warmup: null,
  gate_paused_unexplained: null,
  gate_paused_total: null,
  gate_biggest_pull: null,
  gate_biggest_pull_at: null,
  band_gate_run_at: null,
  band_normal: null,
  band_watch: null,
  band_stop: null,
  band_gate_owned: null,
  band_prev_at: null,
  band_normal_prev: null,
  band_watch_prev: null,
  band_stop_prev: null,
  band_normal_change: null,
  band_stop_change: null,
  band_gap_hours: null,
  band_delta_comparable: null,
  band_moved_to_normal: null,
  band_moved_to_watch: null,
  band_moved_to_stop: null,
  band_returned: [],
};

/** Parse the inbox health gate's own state file. Pure, so the selftest can feed it one.
 *  The gate owns this file's shape in the email repo and may change it, so every field
 *  is optional on the way in: a rename costs one null, never the block. */
export function inboxGateFacts(raw: unknown, adopted: Record<string, string[]> = {}): Pick<
  FleetFacts,
  'gate_last_run' | 'gate_paused' | 'gate_resumed' | 'gate_paused_on_health'
  | 'gate_paused_on_warmup' | 'gate_paused_unexplained' | 'gate_paused_total'
  | 'gate_biggest_pull' | 'gate_biggest_pull_at'
> {
  const blank = {
    gate_last_run: null, gate_paused: null, gate_resumed: null,
    gate_paused_on_health: null, gate_paused_on_warmup: null,
    gate_paused_unexplained: null,
    gate_paused_total: null, gate_biggest_pull: null, gate_biggest_pull_at: null,
  };
  if (!raw || typeof raw !== 'object') return blank;
  const s = raw as {
    lastRunAt?: unknown;
    pausedByGate?: Record<string, { since?: unknown; reasons?: unknown }>;
    history?: Array<{
      at?: unknown;
      paused?: unknown;
      resumed?: unknown;
      pausedReasons?: Record<string, unknown>;
    }>;
  };
  const history = Array.isArray(s.history) ? s.history : [];
  const last = history.length > 0 ? history[history.length - 1] : null;
  const paused = s.pausedByGate && typeof s.pausedByGate === 'object' ? s.pausedByGate : null;
  // The reason split is read off the mailboxes the LAST run paused, matched by name in
  // the registry, because `history` records names and only the registry records why.
  const lastNames = Array.isArray(last?.paused) ? (last!.paused as unknown[]).filter((n): n is string => typeof n === 'string') : [];
  let health: number | null = null;
  let warmup: number | null = null;
  let unexplained: number | null = null;
  if (paused && lastNames.length > 0) {
    health = 0; warmup = 0; unexplained = 0;
    for (const name of lastNames) {
      // The run's own record first (written by the gate since 2026-10-16 and immune to
      // adoption), then the registry, then the band gate's ledger, which adopts
      // health-only pauses out of that registry hours later.
      const inRun = last?.pausedReasons?.[name];
      const own = paused[name]?.reasons;
      const list = Array.isArray(inRun) && inRun.length > 0
        ? inRun.map(String)
        : Array.isArray(own) && own.length > 0
          ? own.map(String)
          : (adopted[name] ?? []).map(String);
      // A mailbox can fail both tests; count it under health, which is the expensive one.
      if (list.some((r) => /health|inbox_rate|landing|spam|score/i.test(r))) health++;
      else if (list.some((r) => /warmup/i.test(r))) warmup++;
      else unexplained++;
    }
  } else if (paused) {
    health = 0; warmup = 0; unexplained = 0;
  }
  let biggest: { at: string | null; n: number } | null = null;
  for (const h of history) {
    const n = Array.isArray(h?.paused) ? h.paused.length : 0;
    if (!biggest || n > biggest.n) biggest = { at: typeof h?.at === 'string' ? h.at : null, n };
  }
  return {
    gate_last_run: typeof s.lastRunAt === 'string' ? s.lastRunAt : null,
    gate_paused: last ? (Array.isArray(last.paused) ? last.paused.length : null) : null,
    gate_resumed: last ? (Array.isArray(last.resumed) ? last.resumed.length : null) : null,
    gate_paused_on_health: health,
    gate_paused_on_warmup: warmup,
    gate_paused_unexplained: unexplained,
    gate_paused_total: paused ? Object.keys(paused).length : null,
    gate_biggest_pull: biggest?.n ?? null,
    gate_biggest_pull_at: biggest?.at ?? null,
  };
}

/** The band gate's own state file (automator/state/inbox-health.json). Pure, so the
 *  selftest can feed it one. It is another repo's file and another repo's shape, so every
 *  field is optional on the way in: a rename costs one null, never the block.
 *
 *  `owned` doubles as the reason book for pauses this gate adopted off the old gate. */
export function bandGateFacts(
  raw: unknown,
  window: { sinceISO: string; untilISO: string } | null = null,
): Omit<Pick<FleetFacts,
  | 'band_gate_run_at' | 'band_normal' | 'band_watch' | 'band_stop' | 'band_gate_owned'
  | 'band_prev_at' | 'band_normal_prev' | 'band_watch_prev' | 'band_stop_prev'
  | 'band_normal_change' | 'band_stop_change' | 'band_gap_hours' | 'band_delta_comparable'
  | 'band_moved_to_normal' | 'band_moved_to_watch' | 'band_moved_to_stop' | 'band_returned'
>, never> & { reasons: Record<string, string[]> } {
  const blank = {
    band_gate_run_at: null, band_normal: null, band_watch: null,
    band_stop: null, band_gate_owned: null, reasons: {},
    band_prev_at: null, band_normal_prev: null, band_watch_prev: null, band_stop_prev: null,
    band_normal_change: null, band_stop_change: null,
    band_gap_hours: null, band_delta_comparable: null,
    band_moved_to_normal: null, band_moved_to_watch: null, band_moved_to_stop: null,
    band_returned: [],
  };
  if (!raw || typeof raw !== 'object') return blank;
  type Run = {
    at?: unknown;
    counts?: Record<string, unknown>;
    to_normal?: unknown;
    to_watch?: unknown;
    to_stop?: unknown;
  };
  const s = raw as {
    generated_at?: unknown;
    runs?: unknown;
    owned?: Record<string, { reasons?: unknown }>;
  };
  const runs = (Array.isArray(s.runs) ? s.runs : []) as Run[];
  const last = runs.length > 0 ? runs[runs.length - 1] : null;
  const counts = last?.counts && typeof last.counts === 'object' ? last.counts : {};
  const owned = s.owned && typeof s.owned === 'object' ? s.owned : null;
  const reasons: Record<string, string[]> = {};
  if (owned) {
    for (const [email, rec] of Object.entries(owned)) {
      const list = Array.isArray(rec?.reasons) ? rec.reasons.map(String) : [];
      if (list.length > 0) reasons[email] = list;
    }
  }
  const runAt = typeof last?.at === 'string'
    ? last.at
    : (typeof s.generated_at === 'string' ? s.generated_at : null);
  const normal = num(counts.normal);
  const watch = num(counts.watch);
  const stop = num(counts.stop);

  // The prior reading: the gate runs hourly and keeps dozens of runs, so pick the one
  // closest to 24h before the newest rather than "the one before it", which would be an
  // hour-over-hour move dressed up as a day's. Only runs 12 to 36 hours back qualify —
  // the same window `delta_comparable` uses, so the two blocks cannot disagree.
  const lastMs = runAt ? Date.parse(runAt) : NaN;
  let prev: Run | null = null;
  let prevGap: number | null = null;
  if (Number.isFinite(lastMs)) {
    for (const r of runs) {
      if (typeof r?.at !== 'string') continue;
      const ms = Date.parse(r.at);
      if (!Number.isFinite(ms) || ms >= lastMs) continue;
      const gap = (lastMs - ms) / 3_600_000;
      if (gap < 12 || gap > 36) continue;
      if (prevGap === null || Math.abs(gap - 24) < Math.abs(prevGap - 24)) {
        prev = r; prevGap = gap;
      }
    }
  }
  const pc = prev?.counts && typeof prev.counts === 'object' ? prev.counts : {};
  const normalPrev = prev ? num(pc.normal) : null;
  const watchPrev = prev ? num(pc.watch) : null;
  const stopPrev = prev ? num(pc.stop) : null;

  // Moves inside the cycle window, by direction. A window is required: without one,
  // "0 moved" and "nobody asked" would print the same number.
  let toNormal: number | null = null;
  let toWatch: number | null = null;
  let toStop: number | null = null;
  const returned: string[] = [];
  if (window) {
    const a = Date.parse(window.sinceISO);
    const b = Date.parse(window.untilISO);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      toNormal = 0; toWatch = 0; toStop = 0;
      for (const r of runs) {
        if (typeof r?.at !== 'string') continue;
        const ms = Date.parse(r.at);
        if (!Number.isFinite(ms) || ms < a || ms >= b) continue;
        const n = Array.isArray(r.to_normal) ? r.to_normal.map(String) : [];
        toNormal += n.length;
        toWatch += Array.isArray(r.to_watch) ? r.to_watch.length : 0;
        toStop += Array.isArray(r.to_stop) ? r.to_stop.length : 0;
        for (const e of n) if (returned.length < 12) returned.push(e);
      }
    }
  }

  return {
    band_gate_run_at: runAt,
    band_normal: normal,
    band_watch: watch,
    band_stop: stop,
    band_gate_owned: owned ? Object.keys(owned).length : null,
    band_prev_at: typeof prev?.at === 'string' ? prev.at : null,
    band_normal_prev: normalPrev,
    band_watch_prev: watchPrev,
    band_stop_prev: stopPrev,
    band_normal_change: normal !== null && normalPrev !== null ? normal - normalPrev : null,
    band_stop_change: stop !== null && stopPrev !== null ? stop - stopPrev : null,
    band_gap_hours: prevGap === null ? null : Number(prevGap.toFixed(1)),
    band_delta_comparable: Number.isFinite(lastMs) && runs.length > 0 ? prev !== null : null,
    band_moved_to_normal: toNormal,
    band_moved_to_watch: toWatch,
    band_moved_to_stop: toStop,
    band_returned: returned,
  };
}

/** Hours between two ISO stamps, one decimal. Null if either is missing or unparseable. */
function hoursBetween(aISO: string | null, bISO: string | null): number | null {
  if (!aISO || !bISO) return null;
  const a = Date.parse(aISO);
  const b = Date.parse(bISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Number(((a - b) / 3_600_000).toFixed(1));
}

/** Today's plan against yesterday's snapshot, plus both gates' own last runs. A missing
 *  prior snapshot reports nulls: an absent baseline must never read as "no change".
 *
 *  `pushStartedAt` is when the push that sent in this cycle began (the Siege unit's own
 *  start stamp). It is what makes `replanned_after_push` answerable — see the block
 *  comment on FleetFacts. */
export function fleetFacts(
  plan: SiegePlanFacts,
  prior: {
    live_inboxes?: number | null;
    mailbox_capacity?: number | null;
    plan_generated_at?: string | null;
  } | null,
  gateState: unknown,
  bandState: unknown = null,
  pushStartedAt: string | null = null,
  bandWindow: { sinceISO: string; untilISO: string } | null = null,
): FleetFacts {
  const livePrev = typeof prior?.live_inboxes === 'number' ? prior.live_inboxes : null;
  const capPrev = typeof prior?.mailbox_capacity === 'number' ? prior.mailbox_capacity : null;
  const stampPrev = typeof prior?.plan_generated_at === 'string' ? prior.plan_generated_at : null;
  const gap = hoursBetween(plan.plan_generated_at, stampPrev);
  // A push stamp we could not read must not turn into a claim that the plan is the one
  // that flew: unknown stays unknown.
  const pushMs = pushStartedAt ? Date.parse(pushStartedAt) : NaN;
  const planMs = plan.plan_generated_at ? Date.parse(plan.plan_generated_at) : NaN;
  const afterPush = Number.isFinite(pushMs) && Number.isFinite(planMs) ? planMs > pushMs : null;
  const band = bandGateFacts(bandState, bandWindow);
  return {
    ...NO_FLEET,
    live_inboxes_prev: livePrev,
    live_inboxes_change: livePrev !== null && plan.live_inboxes !== null
      ? plan.live_inboxes - livePrev : null,
    mailbox_capacity_prev: capPrev,
    mailbox_capacity_change: capPrev !== null && plan.mailbox_capacity !== null
      ? plan.mailbox_capacity - capPrev : null,
    plan_generated_at: plan.plan_generated_at,
    plan_generated_at_prev: stampPrev,
    snapshot_gap_hours: gap,
    replanned_after_push: afterPush,
    // 12 to 36 hours apart is a day-over-day move read at a comparable hour. Outside
    // that, or taken after the push, it is arithmetic across two different measurements.
    delta_comparable: gap === null
      ? null
      : (gap >= 12 && gap <= 36 && afterPush !== true),
    ...inboxGateFacts(gateState, band.reasons),
    band_gate_run_at: band.band_gate_run_at,
    band_normal: band.band_normal,
    band_watch: band.band_watch,
    band_stop: band.band_stop,
    band_gate_owned: band.band_gate_owned,
    band_prev_at: band.band_prev_at,
    band_normal_prev: band.band_normal_prev,
    band_watch_prev: band.band_watch_prev,
    band_stop_prev: band.band_stop_prev,
    band_normal_change: band.band_normal_change,
    band_stop_change: band.band_stop_change,
    band_gap_hours: band.band_gap_hours,
    band_delta_comparable: band.band_delta_comparable,
    band_moved_to_normal: band.band_moved_to_normal,
    band_moved_to_watch: band.band_moved_to_watch,
    band_moved_to_stop: band.band_moved_to_stop,
    band_returned: band.band_returned,
  };
}

// WAS A SATURDAY INDISTINGUISHABLE FROM A BROKEN MONDAY (2026-10-04).
//
// `plan_found: false` is the right answer for both of these days and they are not
// remotely the same day:
//
//   • Saturday — `siege-plan.timer` is `OnCalendar=Mon..Fri`, so no plan exists and
//     none should. SmartLead sends Mon-Thu anyway. Nothing is wrong.
//   • A Monday the timer silently did not fire — no plan, no emails, and a whole
//     sending day lost with no error anywhere to read.
//
// The cycle for 2026-10-03 was the first Saturday this block had to describe, and it
// emitted exactly what a dead Monday would. So ask the timer for its own schedule and
// say which kind of day this was. Read off systemd, not hard-coded here: the schedule
// moved once already (06:15 from 08:15 on 2026-10-01) and a copy of it in this file
// would be the next thing to go stale.
export type SiegeUnitFacts = {
  sending_day: boolean | null;
  unit_state: string | null;
  unit_last_result: string | null;
  unit_last_started: string | null;
};

export const NO_UNIT: SiegeUnitFacts = {
  sending_day: null,
  unit_state: null,
  unit_last_result: null,
  unit_last_started: null,
};

// systemd's weekday order, Monday first, matching its own `Mon..Fri` syntax.
const SYSTEMD_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const WEEKDAY_SPEC = /^[a-z]{3}(\.\.[a-z]{3})?(,[a-z]{3}(\.\.[a-z]{3})?)*$/;

/** Is `pacificDay` (YYYY-MM-DD) a day the Siege timer runs on?
 *
 *  `calendar` is a raw `systemctl show <timer> -p TimersCalendar` line, e.g.
 *  `{ OnCalendar=Mon..Fri *-*-* 06:15:00 America/New_York ; next_elapse=... }`.
 *  Only the weekday field is read — the time of day cannot make a day a non-sending
 *  day. No weekday restriction means every day, which is the honest reading of
 *  `OnCalendar=daily`. Anything unparseable returns null: a schedule we could not
 *  read must not turn into a claim that the day was fine. */
export function isSendingDay(calendar: string | null, pacificDay: string): boolean | null {
  if (!calendar) return null;
  const m = /OnCalendar=(.*?)(?:\s*;|\s*\}|$)/.exec(calendar);
  const expr = (m?.[1] ?? calendar).trim();
  if (!expr) return null;
  const d = new Date(`${pacificDay}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  // Midday UTC, so the calendar weekday of the date string is the weekday meant,
  // whatever timezone this process runs in.
  const want = SYSTEMD_DAYS[(d.getUTCDay() + 6) % 7]!;

  const first = expr.split(/\s+/)[0]!.toLowerCase();
  if (!WEEKDAY_SPEC.test(first)) return true; // no weekday field at all -> every day
  for (const part of first.split(',')) {
    const [a, b] = part.split('..');
    const from = SYSTEMD_DAYS.indexOf(a!);
    if (from < 0) return null; // an abbreviation we don't know -> don't guess
    if (b === undefined) {
      if (a === want) return true;
      continue;
    }
    const to = SYSTEMD_DAYS.indexOf(b);
    if (to < 0) return null;
    const span = (to - from + 7) % 7;
    const at = (SYSTEMD_DAYS.indexOf(want) - from + 7) % 7;
    if (at <= span) return true;
  }
  return false;
}

/** What the push itself said about the leads it dropped.
 *
 *  WHY (2026-10-06). `binding_constraint: partial_push` names a shortfall and stops
 *  there. On 2026-10-05 it covered 60 unpushed emails of a 129 plan, and the snapshot
 *  could not say whether that was 60 leads SmartLead declined, a batch that died before
 *  its first lead, or a crash. Answering it took reading automator's siege log by hand
 *  and counting, which is the manual step every one of the last four debriefs has been
 *  about removing. The answer mattered: 53 leads were refused per-lead and 3 whole
 *  batches died at the top, which are different faults with different fixes.
 *
 *  `reasons` is the refusal text SmartLead or the push gave, trimmed to its shape and
 *  counted, most common first. It carries no addresses: the push prints the reason after
 *  the lead id, and only the reason is kept. */
export type SiegePushOutcome = {
  log_found: boolean;
  sent: number | null;
  failed: number | null;
  /** Planned emails the push declined to even offer SmartLead — almost always a draft the
   *  writer's own quality gate rejected. A refusal by us, not by SmartLead, which is why
   *  it is counted apart from `failed`. See the block comment on siegePushOutcome(). */
  skipped: number | null;
  /** Batches that exited non-zero having pushed nothing, so their leads were never tried. */
  batches_failed_before_first_lead: number | null;
  escalations: number | null;
  reasons: Array<{ reason: string; leads: number }>;
  /** Which offer's writer produced the skipped drafts, so the fix has an address.
   *  Empty when nothing was skipped. See siegePushOutcome(). */
  skipped_by_offer: Array<{ offer: string; leads: number }>;
  /** The plan's own lead list joined against the lines above, so the counters answer
   *  "how many PEOPLE got no email" instead of "how many events happened". Every field
   *  here is null when the plan could not be read: unknown, never zero. See the
   *  reconciliation block on siegePushOutcome(). */
  planned_leads: number | null;
  /** Planned people the push really emailed. Counts a person once however many batches
   *  tried them. */
  people_emailed: number | null;
  /** Planned people who ended the run with no email. This is the shortfall. */
  people_lost: number | null;
  /** ...of which SmartLead refused them (a FAIL and no SENT anywhere). */
  lost_to_fail: number | null;
  /** ...of which we declined to offer them (a SKIP and no SENT anywhere). */
  lost_to_skip: number | null;
  /** ...of which the log said NOTHING about at all. No SENT, no FAIL, no SKIP. */
  lost_silently: number | null;
  /** Those people, named, so the morning is one grep and not a hand-written join.
   *  Capped at 12. */
  lost_ids: string[];
  /** Skips that cost a draft and not a person: a SKIP in one batch, a SENT in another,
   *  same run. This is why `skipped` can exceed `people_lost` and must not be read as
   *  a loss on its own. */
  skipped_then_sent: number | null;
  /** The other reason a skip costs nobody: the lead was never in the plan. A draft got
   *  written for somebody this plan does not carry, and the gate refused it. Wasted
   *  writer time, zero people lost — and the shape that made the 10-20 debrief name two
   *  "lost" leads who were never planned. */
  skipped_unplanned: number | null;
  /** How many people the morning's approval covered, from that day's sample. The push was
   *  never asked to send more than this, whatever `planned_leads` says. */
  approved_leads: number | null;
  /** Planned people the approval does NOT cover, so Siege held them for tomorrow on
   *  purpose. NOT a loss. See the approval-trim block on siegePushOutcome(). */
  deferred_unapproved: number | null;
  /** Those people, named, capped at 12 — so "they wait for tomorrow" can be checked
   *  against tomorrow's plan instead of taken on faith. */
  deferred_ids: string[];
  /** The same count read off Siege's own log line, as a cross-check on the file read.
   *  A disagreement with `deferred_unapproved` means the approval files and the run that
   *  pushed are describing different things, which is worth seeing. */
  deferred_logged: number | null;
};

export const NO_PUSH_OUTCOME: SiegePushOutcome = {
  log_found: false,
  sent: null,
  failed: null,
  skipped: null,
  batches_failed_before_first_lead: null,
  escalations: null,
  reasons: [],
  skipped_by_offer: [],
  planned_leads: null,
  people_emailed: null,
  people_lost: null,
  lost_to_fail: null,
  lost_to_skip: null,
  lost_silently: null,
  lost_ids: [],
  skipped_then_sent: null,
  skipped_unplanned: null,
  approved_leads: null,
  deferred_unapproved: null,
  deferred_ids: [],
  deferred_logged: null,
};

export type SendPlanHealth = SiegePlanFacts & SiegeUnitFacts & {
  sent_in_cycle: number | null;
  sent_by_this_repo: number | null;
  sent_elsewhere: number | null;
  unpushed_planned: number | null;
  approval_pending: boolean | null;
  push_unit_result: string | null;
  binding_constraint: string | null;
  push_outcome: SiegePushOutcome;
  note: string;
};

/** Did the push run finish, or was it stopped? `null` means not measured.
 *
 *  WHY (2026-10-02). `partial_push` says a plan moved some of its emails and not
 *  the rest, and reads as a soft shortfall — a few leads a builder couldn't
 *  finish. On 2026-10-01 it was not soft: `siege-plan.service` is a oneshot with
 *  five sequential steps and ONE `TimeoutStartSec=3600` across all of them, the
 *  push needs about 35 seconds of `npx tsx` startup per batch of one to three
 *  emails, and at 11:17:22Z systemd killed it with SIGTERM mid-batch — 132 of 150
 *  sent, the rest dropped, and the `siege-report.py` step never ran either. The
 *  1-hour budget was noted the day before as "not a fault, just slow". It became
 *  the fault the first day the plan was big enough.
 *
 *  Nothing in the pipeline said so: no error line, no retry, and the day read as
 *  135 emails against a 150 plan. So read the unit's own verdict. `success` means
 *  the shortfall really is per-lead; `timeout` or a signal means the run was cut
 *  off and the missing emails are simply unsent. */
export function pushRunVerdict(
  result: string | null,
  startedISO: string | null,
  sinceISO: string,
  untilISO: string,
): string | null {
  if (!result) return null;
  // The unit result is whatever its LAST run left behind, and the timer runs
  // Mon-Fri. On a debrief for a day the unit never ran, that verdict belongs to a
  // different cycle, so say nothing rather than report the wrong day's outcome.
  if (!startedISO) return null;
  const t = Date.parse(startedISO);
  if (!Number.isFinite(t) || t < Date.parse(sinceISO) || t >= Date.parse(untilISO)) return null;
  return result;
}

// `sent_elsewhere` is everything that reached SmartLead this cycle that this repo did
// not push — Siege plus any batch driven by hand from the email repo. It cannot be
// attributed further from here, and it does not need to be: the question is whether
// the planned batch moved at all.
//
/** `nothing_lost`: a plan that moved and cost nobody (2026-10-24).
 *
 *  `binding_constraint` is the one field a reader looks at before any other, and until
 *  now its fallback answer was computed from plan.json alone: `planned` minus what
 *  reached SmartLead, anything left over called `partial_push`. That is the same fault
 *  the 2026-10-22 fix removed from inside `push_outcome`, one level up — plan.json is
 *  not the push's instruction. Siege plans twice each morning and `approval_is_current()`
 *  trims the re-plan back to the approved list, so a planned person can be held for
 *  tomorrow on purpose and leave a gap here that nobody lost.
 *
 *  On 2026-10-23 that is exactly what happened: 150 planned, 148 sent, and the missing
 *  two were `deferred_unapproved` — held for the next day by the approval gate, named in
 *  `deferred_ids`, and cross-checked against Siege's own `deferred_logged`. Seventeen
 *  skips all got written again and sent in the same run (`skipped_then_sent: 17`). The
 *  push's own per-person join read `people_lost: 0`, `lost_to_fail: 0`, `lost_to_skip: 0`,
 *  `lost_silently: 0` — a lossless push — while the headline field said `partial_push`.
 *
 *  So when the join is available and says nobody ended the run without an email, do not
 *  name a shortfall. `people_lost: null` is unknown, not zero, and keeps the old
 *  conservative `partial_push`: the plan could not be read, so the day cannot be cleared.
 *  The two real ceilings (`mailbox_slots`, `day_cap`) and `push_killed` still outrank
 *  this — they say what sized or stopped the day, which is a different question from
 *  whether it lost anybody. */
export function sendPlanHealth(
  facts: SiegePlanFacts,
  sentInCycle: number | null,
  sentByThisRepo: number | null,
  pushUnitResult: string | null = null,
  unit: SiegeUnitFacts = NO_UNIT,
  pushOutcome: SiegePushOutcome = NO_PUSH_OUTCOME,
): SendPlanHealth {
  const elsewhere = sentInCycle === null || sentByThisRepo === null
    ? null
    : Math.max(0, sentInCycle - sentByThisRepo);
  const planned = facts.planned;
  const unpushed = planned === null || elsewhere === null ? null : Math.max(0, planned - elsewhere);
  // A plan with work in it that moved nothing. Not flagged when email is paused on
  // purpose, and not inferred when either count is missing — "we didn't measure" is
  // not "nothing happened".
  const approvalPending = planned === null || elsewhere === null
    ? null
    : facts.email_paused === true
      ? false
      : planned > 0 && elsewhere === 0;

  let binding: string | null = null;
  // No plan on disk has two causes and they need different names. Ranked first because
  // when there is no plan there are no ceilings to press against, and a hand-driven
  // batch reaching SmartLead does not excuse a missing plan on a sending day.
  if (!facts.plan_found && unit.sending_day === false) binding = 'not_a_sending_day';
  else if (!facts.plan_found && unit.sending_day === true) binding = 'plan_missing_on_sending_day';
  else if (facts.email_paused === true) binding = 'email_paused';
  else if (approvalPending === true) binding = 'awaiting_approval';
  else if (elsewhere !== null && elsewhere > 0) {
    // Only claim a ceiling when the day actually pressed against it.
    if (facts.day_cap !== null && facts.mailbox_slots !== null && facts.mailbox_slots < facts.day_cap
      && elsewhere >= facts.mailbox_slots) binding = 'mailbox_slots';
    else if (facts.day_cap !== null && elsewhere >= facts.day_cap) binding = 'day_cap';
    // The run was stopped rather than finished, so the shortfall is the kill, not
    // the leads. Ranked below the two real ceilings: a push killed after it had
    // already sent everything the ramp allowed cost nothing.
    else if (pushUnitResult !== null && pushUnitResult !== 'success') binding = 'push_killed';
    // Whether a plan that moved fell short is a question about PEOPLE, and plan.json
    // cannot answer it (2026-10-24). See the `nothing_lost` block below.
    else if (pushOutcome.people_lost === 0) binding = 'nothing_lost';
    else binding = 'partial_push';
  }

  return {
    ...facts,
    ...unit,
    sent_in_cycle: sentInCycle,
    sent_by_this_repo: sentByThisRepo,
    sent_elsewhere: elsewhere,
    unpushed_planned: unpushed,
    approval_pending: approvalPending,
    push_unit_result: pushUnitResult,
    binding_constraint: binding,
    push_outcome: pushOutcome,
    note:
      "Siege's own plan for this cycle, read from automator/state/siege/<day>/plan.json. " +
      'Casey gave Siege standing approval on 2026-09-30, so approval_pending:true now means ' +
      'the run did not reach the push at all, not that a person left a batch standing. ' +
      'DO NOT READ A SMALL mailbox_slots AS A SICK FLEET (2026-10-13): it is a remainder, ' +
      'a mailbox\'s daily allowance minus the follow-ups it already owes, so a suspension ' +
      'wave and a follow-up wave report the same small number. On 2026-10-12 the fleet was ' +
      'the healthiest of the week, 57 of 58 live against 50 on Friday and the highest ' +
      'allowance of the three days at 855, and slots still fell 618 to 76 because ' +
      'followups_due was 1,495 in one day and inboxes_full was 50 of 57. That is ' +
      'structural: every offer is a three-email sequence on days 0, 4 and 10 and SmartLead ' +
      'sends Mon-Thu, so a weekend of due follow-ups lands on Monday on top of Monday\'s ' +
      'own, and a big first-touch day mortgages the next week. mailbox_capacity against ' +
      'followups_due is what sizes the fleet; the slot remainder on its own argues for ' +
      'nothing. ' +
      'day_cap is the warmup ramp and ' +
      'mailbox_slots is what the live inboxes would accept; the smaller one is the real ' +
      'ceiling. push_unit_result is siege-plan.service\'s own verdict on the run that sent ' +
      'this cycle (null = that unit did not run in this window, so no verdict applies); ' +
      'binding_constraint:push_killed means systemd stopped the push part-way, the shape ' +
      'seen on 2026-10-01 and 2026-10-02: TimeoutStartSec=3600 covers all five of that ' +
      "oneshot's steps and the push ran past it. The 10-02 debrief blamed `npx tsx` " +
      'startup for that hour and was wrong. Measured 2026-10-03: each push-batch process ' +
      'did its real work in ~1.1s and then sat ~29s on an unclosed pg pool ' +
      '(idleTimeoutMillis 30s), so 90 batches spent ~43 minutes of the hour waiting on ' +
      'nothing. Fixed in youtube-email-outreach-v1 7fd02b6fd (src/db/cli-exit.ts), which ' +
      'took a batch 31s to 1.9s. If push_killed appears for a cycle after 2026-10-03, do ' +
      'not re-diagnose it as slowness: check that the fix is deployed, then the unit. ' +
      'plan_found:false means no plan on ' +
      'disk (Siege did not run), which is not the same as a plan that ran and pushed ' +
      'nothing — and READ sending_day BEFORE CALLING IT A FAULT: siege-plan.timer is ' +
      'Mon-Fri, so a weekend cycle is binding_constraint:not_a_sending_day and nothing ' +
      'is wrong, while plan_missing_on_sending_day means a real sending day produced no ' +
      'plan at all and the timer is what to look at. sending_day is read off the timer\'s ' +
      'own OnCalendar, so it follows a schedule change. unit_state / unit_last_result / ' +
      'unit_last_started describe siege-plan.service\'s MOST RECENT run whenever it ' +
      'happened, which on a weekend is a weekday two days back — unlike ' +
      'push_unit_result, which is null unless that run was inside this cycle. A unit_state ' +
      'of failed left over from a prior cycle does not block the next timer firing. ' +
      'binding_constraint:nothing_lost means the plan moved and the push\'s own ' +
      'per-person join found nobody who ended the run without an email — a lossless ' +
      'push, not a shortfall. It replaces partial_push for that shape (2026-10-24): the ' +
      'fallback used to be plan.json arithmetic, planned minus what reached SmartLead, ' +
      'which is the 10-22 fault one level up because plan.json is not the push\'s ' +
      'instruction. On 2026-10-23 the headline field read partial_push against 150 ' +
      'planned and 148 sent while push_outcome read people_lost:0 on the same snapshot; ' +
      'the missing two were deferred_unapproved, held for the next day by the approval ' +
      'gate. partial_push now means people_lost is genuinely above zero, or null — and ' +
      'null is an unreadable plan, which is unknown and NOT a clean day. ' +
      'READ push_outcome BEFORE CALLING partial_push A SOFT SHORTFALL: it carries the ' +
      "push's own tally of what it dropped and why. On 2026-10-05, 53 of 129 planned " +
      'emails were refused per-lead and 3 whole batches died at listCampaignMailboxes ' +
      'before their first lead, all to one cause: SmartLead meters the ACCOUNT at 200 ' +
      'requests a minute and the reply poller (71 campaigns every ~2 minutes) was ' +
      'spending most of that window alongside the push. Nothing retried. Fixed in ' +
      'youtube-email-outreach-v1 eedbbff87. A `reasons` entry naming a 429 means that is ' +
      'happening again past the retries. EVERY OTHER REFUSAL NAMES ITS OWN COUNTER NOW, ' +
      'so read the counter and do not reach for the rate limit a second time: on ' +
      '2026-10-06 all 106 dropped emails were `skipped_in_other_campaign_count=1` and not ' +
      'one 429 fired, yet they logged "no reason given" because the counter was missing ' +
      'from a hand-kept list, and the shortfall was blamed on the rate limit for a whole ' +
      'cycle. The cause was Siege finally sending ' +
      'ignore_duplicate_leads_in_other_campaign:true (it had been dropped in transit until ' +
      '10-03), so SmartLead skipped every repeat person; Casey set it false in becf7fd1a. ' +
      'The reason is now read off SmartLead\'s own reply rather than matched against a ' +
      'list (src/smartlead/add-lead-outcome.ts), and a quoted reply here is condensed to ' +
      'the fields it set so the answer cannot fall off the end of the 120-character cap. ' +
      'A `no counter set` entry is the one remaining unexplained shape: SmartLead answered ' +
      '200, imported nothing, and set nothing. ' +
      'AND READ push_outcome.skipped: it is planned emails WE declined to offer SmartLead, ' +
      'nearly always a draft the writer\'s own quality gate rejected after its retries, ' +
      'so it is a different fix from anything `failed` names — tighten the skill, not the ' +
      'push. It was unreadable before 2026-10-09: on 10-08 the first clean full-plan push ' +
      'logged sent 561 and failed 1 against a plan of 567, and the other five were SKIPs ' +
      'the parser never counted, so five sixths of the shortfall had no counter and no ' +
      'reason. Their reasons were in the log all along (an em dash outside the sign-off ' +
      'twice, bare-title format, opener shape, a rank superlative). `reasons` now covers ' +
      'failed and skipped together, because the question is why a planned email did not go. ' +
      'AND READ people_lost, NOT sent AGAINST planned, FOR THE SHORTFALL (2026-10-21): every ' +
      'counter beside it counts log lines, and one planned person can collect several of ' +
      'them or none. On 10-20, 12 skips cost 2 people, because ten of the twelve were ' +
      'written again in another batch and sent in the same run. On 10-21 all 3 skips were ' +
      're-sent and cost nobody, and the one person actually lost appeared in no counter and ' +
      'no reason at all: the push never reached them, so it printed no SENT, no FAIL and no ' +
      'SKIP, and the only trace was unpushed_planned:1 — a remainder a re-sent skip can ' +
      'cancel out. Both answers took a hand-written join of plan.json against the log. ' +
      'push_outcome now carries that join: planned_leads / people_emailed / people_lost are ' +
      'people, the loss splits into lost_to_fail (SmartLead refused it), lost_to_skip (we ' +
      'declined to offer it) and lost_silently (the log said nothing about them at all), ' +
      'skipped_then_sent and skipped_unplanned are the two reasons a skip count can exceed ' +
      'the loss, and lost_ids names them, capped at 12. The 10-20 debrief\'s own answer was ' +
      'wrong the other way: the two leads it named as lost to the manifest gate were never ' +
      'in the plan (skipped_unplanned), and that cycle\'s three real losses were planned ' +
      'drafts the writer\'s quality gate rejected (lost_to_skip). All of it is null when the ' +
      'plan cannot be read, which is unknown and NOT a clean push. ' +
      'AND READ approved_leads, NOT planned_leads, AS WHAT THE PUSH WAS ASKED FOR ' +
      '(2026-10-22): plan.json is not the push\'s instruction. Siege runs twice each ' +
      'morning — a sample run records the people it covers, then the push run rebuilds the ' +
      'plan from scratch so a block added during the morning is honoured, and that rebuild ' +
      'can pull in somebody nobody approved. approval_is_current() trims the day back to ' +
      'the approved list and logs "N planned today were not in the approved list; they wait ' +
      'for tomorrow". Those people print no SENT, no FAIL and no SKIP for exactly the same ' +
      'reason a person the push never reached prints none, so on 10-21 all 18 of them were ' +
      'counted as lost_silently and the snapshot said 18 of 149 people were lost on a day ' +
      'nobody was lost. leads.siege_plan agrees with the overstatement, because the rebuild ' +
      'writes its rows BEFORE the trim: 131 pushed, 18 left at planned. It had already ' +
      'misreported the day before at a believable size — the lead the 10-21 debrief named ' +
      'as lost with no line anywhere in the log was deferred on 10-20, approved the next ' +
      'morning and sent at 2026-10-21T10:39:02Z, a one-day wait reported as a ' +
      'disappearance. approved_leads is what the push was asked for, deferred_unapproved ' +
      'and deferred_ids are the people held for tomorrow and are excluded from every lost_* ' +
      'figure, and deferred_logged is Siege\'s own count of them so the files and the run ' +
      'cannot silently disagree. Null, not zero, when the approval files are missing or the ' +
      'approval is for another day or another sample: the trim is unknowable then. ' +
      'AND READ send_plan.fleet BEFORE READING ANY OF THE ABOVE AS A SHORTFALL (2026-10-15): ' +
      'it carries the fleet\'s day-over-day move, which nothing did until then. Over the ' +
      'three cycles after the record 782-email push the plan read 57 live inboxes and an ' +
      '855-message allowance, then 53 and 795, then 43 and 645 — a quarter of the fleet and ' +
      '210 messages a day gone in three days, each number unremarkable on its own morning. ' +
      'gate_paused/gate_resumed are the inbox health gate\'s own newest run (the gate lives ' +
      'in youtube-email-outreach-v1 and is read off its state file, never driven from here), ' +
      'and gate_paused_on_health vs gate_paused_on_warmup is the split that matters: a ' +
      'warmup-day pause is a young mailbox and will lift itself, while a health pause is ' +
      'deliverability and costs two weeks of warmup to undo. The 2026-10-14 run pulled 13, ' +
      'ALL on health, some as low as 53.5, its biggest pull in five weeks and the morning ' +
      'after that push. Stated carefully, because the gate also pulled 6 after a zero-send ' +
      'weekend: pauses churn on their own, so a big pull beside a big push is a question ' +
      'worth asking the same morning and not a proof. live_inboxes_change is null when ' +
      'yesterday\'s snapshot is missing — unknown, not steady. READ fleet.delta_comparable ' +
      'BEFORE QUOTING EITHER CHANGE (2026-10-16): plan.json is overwritten in place, so the ' +
      'two numbers being subtracted are whatever hour each file was last written. The 10-14 ' +
      'plan was written at 10:36Z before its push; the 10-15 plan was written at 23:00Z, ' +
      'twelve hours AFTER its push ran at 11:28Z and three minutes after a new, stricter ' +
      'gate suspended its first band of mailboxes — so -22 inboxes and -330 messages in ' +
      '"one day" spans two different hours of two different days, and the newer snapshot ' +
      'describes a fleet that sent nothing. plan_generated_at / plan_generated_at_prev / ' +
      'snapshot_gap_hours are the arithmetic; replanned_after_push:true says the plan on ' +
      'disk is not the plan that flew. The giveaway was in the snapshot all along and ' +
      'unread: planned (100, counted off the re-plan) was smaller than sent_in_cycle (160), ' +
      'and a plan cannot send more than it holds. AND band_* IS NOW THE FLEET: ' +
      'automator/scripts/inbox-health.py took over health pauses at 2026-10-15T22:57Z and ' +
      'bands every mailbox normal / watch / stop, so band_stop is how many cannot send and ' +
      'band_watch is how many are on their way there. The old gate\'s ledger is no longer ' +
      'the whole picture: it ADOPTS health-only pauses out of pausedByGate and deletes ' +
      'them, which is why gate_paused read 4 beside 0 on health and 0 on warmup for a run ' +
      'whose four pauses were all health, as low as 73.4. Reasons are now read from both ' +
      'ledgers, and gate_paused_unexplained carries any pause whose reason is in neither, ' +
      'so health + warmup + unexplained always equals gate_paused and the split can never ' +
      'silently answer "neither" again. ' +
      'AND READ band_normal_prev, NEVER live_inboxes_prev, WHEN QUOTING A BAND MOVE ' +
      '(2026-10-18): those two are different instruments read at different hours, and on a ' +
      'non-sending day there is no plan at all, so band_normal is the only live fleet ' +
      'number and the only prior number sitting beside it was Siege\'s plan-time count from ' +
      'the last weekday. That morning they read 28 and 18, and subtracting them says "+10 ' +
      'inboxes" about two things that were never measured together — the 2026-10-16 fault ' +
      'in a new place. band_* _prev now comes from the band gate\'s own retained run ' +
      'history, picking the run closest to 24h back inside the same 12-to-36-hour window ' +
      'delta_comparable uses, so the subtraction is one instrument against itself; ' +
      'band_delta_comparable is false when no run qualifies. band_moved_to_normal / ' +
      '_to_watch / _to_stop are what the gate actually moved inside the cycle, which took a ' +
      'hand grep of the gate log until now: on 2026-10-18 TEN mailboxes returned to normal ' +
      'in one hour at 23:05Z, all ten clean at 96.7 the whole time and held on ' +
      'follow-ups-only purely because the 48-hour recovery clock in ' +
      'automator/config/inbox-health.json recover.hours could not credit any clean time ' +
      'before the gate\'s own first run, so the first cohort aged out together. They are ' +
      'null, not 0, on a snapshot written without a window: unknown and measured-as-nothing ' +
      'differ. band_returned names them, capped at 12.',
  };
}

/** Parse the push's own log lines for one cycle. Pure, so the selftest can drive it.
 *
 *  Reads only lines the push prints itself. `SENT`, `FAIL` and `SKIP` are per-lead; an
 *  ESCALATE naming `pushed: 0` is a batch that never reached a lead at all, which is the
 *  shape that loses leads silently — they appear in neither tally.
 *
 *  WHY `SKIP` IS COUNTED (2026-10-09). The push prints
 *  `SKIP  <lead>    batch report marked it failed` for a planned email whose draft the
 *  writer's own quality gate rejected after its retries. That email was in the plan and
 *  never went out, so it belongs in the arithmetic — but this parser only read SENT and
 *  FAIL, so on 2026-10-08 the snapshot showed `sent: 561, failed: 1` against a plan of
 *  567 and five of the six unpushed emails had no counter and no reason anywhere. The
 *  reasons were in the log all along (em dash outside the sign-off ×2, bare-title format,
 *  opener shape, a rank superlative), and they name a different fix from anything
 *  SmartLead does: tighten the skill, not the push.
 *
 *  Counted apart from `failed` on purpose. `failed` is SmartLead refusing a lead we
 *  offered it; `skipped` is us declining to offer one. Mixing them would have made the
 *  first clean full-plan push read as six SmartLead rejections. `reasons` covers both,
 *  since the question it answers is "why did a planned email not go out".
 *
 *  THE SKIP LINE DOES NOT CARRY ITS OWN REASON (2026-10-10). It says
 *  `batch report marked it failed` and nothing else, so counting SKIPs bought the
 *  arithmetic and not the diagnosis: all five of the 2026-10-10 shortfall reported that
 *  one string, which names no rule and no remedy. The real reason is printed by the
 *  batch WRITER a few lines above, as `still broken: <rule> — <detail>` under its own
 *  `<channel> FAIL <words> fails ...` line, inside the same batch directory. So keep the
 *  writer's reasons per batch id and spend them, in order, on that batch's SKIPs. Reading
 *  them in cycle order rather than per batch was tried first and loses reasons: a batch's
 *  SENT lines interleave with its SKIPs, so a rolling buffer gets cleared mid-batch.
 *
 *  `skipped_by_offer` comes from the same loop because the fix is a different one per
 *  skill: on 2026-10-10 four of the five skips came out of ONE offer's writer
 *  (attack-enemy-propose-5-ideas) and the snapshot could not say so.
 *
 *  THESE COUNTERS COUNT EVENTS, AND THE QUESTION IS ABOUT PEOPLE (2026-10-21). Each
 *  number above is a line in a log, and a planned person can collect several of them or
 *  none, so the tallies do not add up to the plan and cannot be made to. Two cycles
 *  running they were read as a shortfall and were not one:
 *
 *    10-20   176 planned, 173 sent, 12 skipped. TEN of the twelve were written again in
 *            another batch and sent in the same run. Two people were lost.
 *    10-21   116 planned, 115 sent, 3 skipped. ALL THREE were sent in another batch.
 *            One person was lost, and nothing in the log mentioned them once.
 *
 *  And the 10-20 answer was itself wrong, which this join also settles: the two leads
 *  that debrief named as lost to the manifest gate were never in the plan at all, so no
 *  planned person was lost that way. The cycle's three real losses were planned leads
 *  whose drafts the writer's own quality gate rejected — `skipped_unplanned` against
 *  `lost_to_skip`, two shapes one `skipped` counter had been reporting as one thing.
 *
 *  Both answers took a hand-written join of `plan.json` against the log, which is the
 *  manual step every one of these fixes exists to remove — and the 10-21 loss could not
 *  be found any other way, because a planned lead the push never reaches prints no line
 *  at all: no SENT, no FAIL, no SKIP, no ESCALATE. It is absent from every counter here
 *  and from `reasons`, and the only trace is arithmetic, `unpushed_planned: 1`, which is
 *  a remainder that a re-sent skip can cancel out.
 *
 *  So join the two. `planned_leads` / `people_emailed` / `people_lost` are per-person,
 *  the loss is split by what the log said about each one, `skipped_then_sent` explains a
 *  skip count larger than the loss, and `lost_ids` names them. Null throughout when the
 *  plan is unreadable: the join is unknown then, not clean.
 *
 *  AND THE PUSH IS NOT ASKED TO SEND THE WHOLE PLAN ON DISK (2026-10-22). `plan.json` is
 *  not the push's instruction. Siege runs twice each morning: a sample run writes a plan
 *  and records the people it covers, then the push run REBUILDS the plan from scratch so a
 *  block added during the morning is honoured. That rebuild can also pull in somebody new,
 *  and nobody approved them, so `approval_is_current()` in automator trims the day back to
 *  the approved list and says so in one line:
 *
 *    [2026-10-21T10:20:34Z]   18 planned today were not in the approved list; they wait
 *                             for tomorrow
 *
 *  Those people are held by design. They print no SENT, no FAIL and no SKIP for exactly
 *  the same reason a person the push never reached prints none, so the join above counted
 *  all 18 of them as `lost_silently` and the snapshot reported 18 people lost out of 149
 *  on a day nobody was lost at all. The rebuild also writes its own rows to
 *  `leads.siege_plan` BEFORE the trim, so the database agrees with the overstatement: 131
 *  rows `pushed`, 18 left at `planned`.
 *
 *  It had already misreported the day before at a size small enough to believe. The 10-21
 *  debrief named `reckjbAvfyqs7jSeD` as a person lost with no line anywhere in the log —
 *  that lead was deferred on 10-20 by this same trim, approved the next morning, and sent
 *  at 2026-10-21T10:39:02Z. A one-day wait, reported as a disappearance.
 *
 *  So read the approved set too. `approved_leads` is what the push was asked for,
 *  `deferred_unapproved` and `deferred_ids` are the people held for tomorrow, they are
 *  excluded from every `lost_*` figure, and `deferred_logged` carries Siege's own count of
 *  them so the file read and the run cannot silently disagree. Null, not zero, when the
 *  approval files are missing or stale — then the trim's size is unknown and the old
 *  arithmetic is all there is. */
export function siegePushOutcome(
  log: string,
  sinceISO: string,
  untilISO: string,
  plannedIds: string[] | null = null,
  approvedIds: string[] | null = null,
): SiegePushOutcome {
  const since = Date.parse(sinceISO);
  const until = Date.parse(untilISO);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let deadBatches = 0;
  let escalations = 0;
  const reasons = new Map<string, number>();
  const skippedByOffer = new Map<string, number>();
  // Writer verdicts waiting to be claimed by a SKIP, keyed by batch id. Filled from the
  // writer's `still broken:` lines; drained in order by that batch's SKIP lines.
  const gateReasons = new Map<string, string[]>();
  const gateUsed = new Map<string, number>();
  // Who the push said what about, for the per-person join below. A lead can appear in
  // more than one of these — that is the whole point of keeping them apart.
  const sentIds = new Set<string>();
  const failedIds = new Set<string>();
  const skippedIds = new Set<string>();
  // The batch whose lines we are currently inside. Both the writer invocation (a path
  // ending `<batch-id>/leads.json`) and the push header (`batch_id = <batch-id>`) name it.
  let batch: string | null = null;
  // Null until the log says something about the approval trim, so "the line never printed"
  // and "it printed a zero" stay different answers.
  let deferredLogged: number | null = null;

  for (const line of log.split('\n')) {
    const stamp = /^\[(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ)\]/.exec(line);
    if (!stamp) continue;
    const t = Date.parse(stamp[1]!);
    if (!Number.isFinite(t) || t < since || t >= until) continue;

    const writerBatch = /\/(siege-[A-Za-z0-9-]+)\/leads\.json/.exec(line);
    if (writerBatch) batch = writerBatch[1]!;
    const pushBatch = /batch_id\s+=\s+(siege-[A-Za-z0-9-]+)/.exec(line);
    if (pushBatch) batch = pushBatch[1]!;
    const broken = /\bstill broken:\s*(.+)$/.exec(line);
    if (broken && batch) {
      const list = gateReasons.get(batch) ?? [];
      list.push(broken[1]!.trim());
      gateReasons.set(batch, list);
      continue;
    }

    // Both tallies require the lead id the push prints after the verdict. Without it this
    // also catches lines from the batch WRITERS, which print their own FAIL for a lead whose
    // copy failed validation (`| <channel> FAIL 236w fails 2->2->2->2` on 10-05). That lead
    // was never pushed, so counting it here would overstate the push's losses by one and
    // invent a reason that has nothing to do with SmartLead.
    const sentLead = /\bSENT\s+(rec[A-Za-z0-9]{8,})/.exec(line);
    if (sentLead) { sent++; sentIds.add(sentLead[1]!); continue; }
    const fail = /\bFAIL\s+(rec[A-Za-z0-9]{8,})\s+(.*)$/.exec(line);
    if (fail) {
      failed++;
      failedIds.add(fail[1]!);
      const reason = normalizePushReason(fail[2]!);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      continue;
    }
    const skip = /\bSKIP\s+(rec[A-Za-z0-9]{8,})\s+(.*)$/.exec(line);
    if (skip) {
      skipped++;
      skippedIds.add(skip[1]!);
      if (batch) {
        const offer = offerFromBatchId(batch);
        if (offer) skippedByOffer.set(offer, (skippedByOffer.get(offer) ?? 0) + 1);
      }
      // Prefer the writer's own verdict; fall back to the push's placeholder string when
      // the log holds none (a batch whose writer output rotated out, say).
      const queue = batch ? gateReasons.get(batch) ?? [] : [];
      const i = batch ? gateUsed.get(batch) ?? 0 : 0;
      if (batch) gateUsed.set(batch, i + 1);
      const raw = i < queue.length ? `quality gate: ${queue[i]!}` : skip[2]!;
      const reason = normalizePushReason(raw);
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      continue;
    }
    // Siege's own count of the approval trim, as a cross-check on reading the files.
    // Worded by approval_is_current() in automator/scripts/siege-plan.py.
    const deferLine = /(\d+)\s+planned today were not in the approved list/.exec(line);
    if (deferLine) {
      deferredLogged = (deferredLogged ?? 0) + Number(deferLine[1]);
      continue;
    }
    if (line.includes('ESCALATE')) {
      escalations++;
      // The driver prints its own JSON payload; "pushed": 0 is the batch that moved nothing.
      if (/"pushed":\s*0\b/.test(line)) deadBatches++;
    }
  }

  // The per-person join. A planned lead with a SENT anywhere in the run got an email,
  // however many batches fumbled them first; one with no SENT did not, and what the log
  // said about them is the whole diagnosis. Order matters: a FAIL is SmartLead's refusal
  // and outranks our own SKIP when a lead collected both.
  const planned = plannedIds === null ? null : [...new Set(plannedIds)];
  // The approval trim. A planned person the approval does not cover was held for tomorrow
  // on purpose, so they are neither emailed nor lost — they are simply not this push's
  // job. With no approval on file the trim's size is unknown, and the whole plan is the
  // only denominator there is.
  const approved = approvedIds === null ? null : new Set(approvedIds);
  const deferred = planned === null || approved === null
    ? null
    : planned.filter((id) => !approved.has(id));
  const asked = planned === null
    ? null
    : deferred === null ? planned : planned.filter((id) => !deferred.includes(id));
  const lost = asked === null ? null : asked.filter((id) => !sentIds.has(id));
  const join = planned === null || asked === null || lost === null
    ? {
      planned_leads: null, people_emailed: null, people_lost: null,
      lost_to_fail: null, lost_to_skip: null, lost_silently: null,
      lost_ids: [], skipped_then_sent: null, skipped_unplanned: null,
      approved_leads: approved === null ? null : approved.size,
      deferred_unapproved: null, deferred_ids: [],
    }
    : {
      planned_leads: planned.length,
      approved_leads: approved === null ? null : approved.size,
      deferred_unapproved: deferred === null ? null : deferred.length,
      deferred_ids: (deferred ?? []).slice(0, 12),
      people_emailed: asked.length - lost.length,
      people_lost: lost.length,
      lost_to_fail: lost.filter((id) => failedIds.has(id)).length,
      lost_to_skip: lost.filter((id) => !failedIds.has(id) && skippedIds.has(id)).length,
      lost_silently: lost.filter((id) => !failedIds.has(id) && !skippedIds.has(id)).length,
      // Named, because the loss is usually one or two people and a name is actionable
      // where a count is not. Capped for the same reason everything else here is.
      lost_ids: lost.slice(0, 12),
      skipped_then_sent: [...skippedIds].filter((id) => sentIds.has(id)).length,
      skipped_unplanned: (() => {
        const inPlan = new Set(planned);
        return [...skippedIds].filter((id) => !inPlan.has(id)).length;
      })(),
    };

  return {
    log_found: true,
    sent,
    failed,
    skipped,
    batches_failed_before_first_lead: deadBatches,
    escalations,
    ...join,
    deferred_logged: deferredLogged,
    reasons: [...reasons.entries()]
      .map(([reason, leads]) => ({ reason, leads }))
      .sort((a, b) => b.leads - a.leads || a.reason.localeCompare(b.reason))
      // Enough to see the shape of a bad day without pasting a log into the snapshot.
      .slice(0, 6),
    skipped_by_offer: [...skippedByOffer.entries()]
      .map(([offer, leads]) => ({ offer, leads }))
      .sort((a, b) => b.leads - a.leads || a.offer.localeCompare(b.offer))
      .slice(0, 8),
  };
}

/** The offer name inside a Siege batch id.
 *
 *  Ids look like `siege-2026-10-09-23650563-joke-ai-slop-1484cc`: the prefix, the day,
 *  the campaign id, the offer, and a hash. Taking the middle by position rather than by
 *  regex over a list of offer names, so a new offer needs no change here. Returns null
 *  for a shape it cannot read, because a wrong offer name would point a fix at the wrong
 *  skill. */
export function offerFromBatchId(batchId: string): string | null {
  const m = /^siege-\d{4}-\d\d-\d\d-\d+-(.+)-[0-9a-f]{6}$/.exec(batchId);
  return m ? m[1]! : null;
}

/** One refusal, reduced to its shape so two of the same thing count as two.
 *
 *  Campaign ids, lead ids and quoted bodies vary per lead and would each become their own
 *  "reason", turning 53 identical refusals into 53 rows. Trimmed hard for the same reason
 *  the snapshot carries counts rather than a log. */
export function normalizePushReason(raw: string): string {
  return condenseQuotedReply(raw.trim())
    .replace(/\bon campaign \d+/g, 'on campaign <id>')
    .replace(/\brec[A-Za-z0-9]{10,}/g, '<lead>')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

// Fields in a SmartLead add-lead reply that say what it DID, so never a refusal reason.
const REPLY_OUTCOME_KEYS = ['ok', 'upload_count', 'total_leads'];

function replyFieldIsSet(v: unknown): boolean {
  if (v === undefined || v === null || v === false || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

/** A refusal that quotes a whole JSON reply loses its answer to the 120-character cap.
 *
 *  WHY (2026-10-07). Every one of the 106 emails the 10-06 push dropped was refused with
 *  `skipped_in_other_campaign_count: 1`, and SmartLead's reply said so in full. But the
 *  reason text read `...(no reason given; its whole reply was {"ok":true,"upload_count":1,`
 *  `"total_leads":0,"skippe` — the cap landed four characters before the only field that
 *  mattered, so the authoritative snapshot reported the day's whole shortfall as
 *  unexplained and the key had to be dug out of automator's log by hand.
 *
 *  Keeping the answer is not a matter of a longer cap: the useful field can sit anywhere
 *  in a reply SmartLead is free to grow. So a quoted object is replaced by the fields it
 *  actually set, which is both shorter than the body and the whole diagnosis. The source
 *  side now names the counter itself (youtube-email-outreach-v1 src/smartlead/
 *  add-lead-outcome.ts), and this stands behind it for older log lines and for any other
 *  caller that quotes a body. */
function condenseQuotedReply(text: string): string {
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open === -1 || close <= open) return text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(open, close + 1));
  } catch {
    return text; // Truncated or not JSON at all — leave it exactly as logged.
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return text;
  const set = Object.entries(parsed as Record<string, unknown>)
    .filter(([k, v]) => !REPLY_OUTCOME_KEYS.includes(k) && replyFieldIsSet(v))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  return text.slice(0, open) + (set.length > 0 ? set.join(' ') : 'nothing set') + text.slice(close + 1);
}

// The PT day the cycle covers. The debrief fires ~00:20 PT and reports the 24h that
// just ended, so that is yesterday's date, and Siege names its plan directory for the
// day it ran. Derived from the cycle window rather than `date - 1` so the two can
// never drift apart.
export function cyclePacificDay(sinceISO: string): string {
  return pacificDate(new Date(Date.parse(sinceISO) + 12 * 60 * 60 * 1000));
}

/** The lead ids the plan assigned, for the per-person join in siegePushOutcome().
 *
 *  Pure, and as forgiving as siegePlanFacts() for the same reason: automator owns this
 *  file's shape. Returns null rather than an empty list when it cannot find ids, so a
 *  renamed key reads as "join unknown" instead of "every planned person was lost". */
export function siegePlanLeadIds(raw: unknown): string[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = (raw as { assignments?: unknown }).assignments;
  if (!Array.isArray(a)) return null;
  const out: string[] = [];
  for (const row of a) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = r.lead_id ?? r.id ?? r.record_id;
    if (typeof id === 'string' && id.length > 0) out.push(id);
  }
  return out.length > 0 ? out : null;
}

/** The lead ids the morning's approval covers — the people the push was actually asked to
 *  send. See the approval-trim block on siegePushOutcome().
 *
 *  The list lives in the SAMPLE file; `approval.json` carries only a count and the
 *  fingerprint of the sample it approved. Both conditions automator checks before trimming
 *  are checked here, for the same reason: an approval for another day, or for a sample that
 *  changed afterwards, does not authorise anybody. Returns null rather than an empty list
 *  whenever that cannot be established, so a missing file reads as "the trim is unknown"
 *  and never as "every planned person was deferred". */
export function siegeApprovedLeadIds(sampleRaw: unknown, approvalRaw: unknown, day: string): string[] | null {
  if (!sampleRaw || typeof sampleRaw !== 'object') return null;
  if (!approvalRaw || typeof approvalRaw !== 'object') return null;
  const sample = sampleRaw as Record<string, unknown>;
  const approval = approvalRaw as Record<string, unknown>;
  if (approval.day !== day) return null;
  if (approval.fingerprint !== sample.fingerprint) return null;
  const ids = sample.planned_lead_ids;
  if (!Array.isArray(ids)) return null;
  const out = ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return out.length > 0 ? out : null;
}

function readSiegeApprovedLeadIds(day: string): string[] | null {
  const dir = join(AUTOMATOR_REPO, 'state', 'siege', day);
  const sample = join(dir, 'samples.json');
  const approval = join(dir, 'approval.json');
  if (!existsSync(sample) || !existsSync(approval)) return null;
  try {
    return siegeApprovedLeadIds(
      JSON.parse(readFileSync(sample, 'utf8')),
      JSON.parse(readFileSync(approval, 'utf8')),
      day,
    );
  } catch {
    return null;
  }
}

function readSiegePlanLeadIds(day: string): string[] | null {
  const f = join(AUTOMATOR_REPO, 'state', 'siege', day, 'plan.json');
  if (!existsSync(f)) return null;
  try {
    return siegePlanLeadIds(JSON.parse(readFileSync(f, 'utf8')));
  } catch {
    return null;
  }
}

function readSiegePlan(day: string): SiegePlanFacts {
  const f = join(AUTOMATOR_REPO, 'state', 'siege', day, 'plan.json');
  if (!existsSync(f)) return NO_PLAN;
  try {
    return siegePlanFacts(JSON.parse(readFileSync(f, 'utf8')));
  } catch {
    return NO_PLAN;
  }
}

// Same rule as readSiegePlan: filesystem only, no automator import, and a missing or
// unreadable log degrades to "not measured" rather than to zeros. The log is append-only
// and grows across months, so only the tail is read — one cycle cannot be more than a few
// thousand lines and reading the whole file would get slower every day.
function readSiegePushOutcome(
  sinceISO: string,
  untilISO: string,
  plannedIds: string[] | null = null,
  approvedIds: string[] | null = null,
): SiegePushOutcome {
  const f = join(AUTOMATOR_REPO, 'logs', 'siege.log');
  if (!existsSync(f)) return NO_PUSH_OUTCOME;
  try {
    const whole = readFileSync(f, 'utf8');
    const lines = whole.split('\n');
    const tail = lines.slice(Math.max(0, lines.length - 20000)).join('\n');
    return siegePushOutcome(tail, sinceISO, untilISO, plannedIds, approvedIds);
  } catch {
    return NO_PUSH_OUTCOME;
  }
}

// Health snapshot for the three sweep-based discovery methods (2026-08-09). None of
// these show up in campaign.jsonl (that's the keyword engine only), so without this
// a stalled daemon is invisible to the daily report — exactly how graph-sweep sat
// idle 8 days (2026-08-01 -> 2026-08-09) before anyone noticed. Deliberately reads
// only local state/systemd, no database calls, so it's cheap and can't itself be the thing
// that's broken if the database is having a bad day.
function serviceActive(name: string): boolean | null {
  try {
    return execSync(`systemctl is-active ${name}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() === 'active';
  } catch {
    return null; // systemctl unavailable or unit unknown — don't claim unhealthy on a check that couldn't run
  }
}

/** `systemctl show` as a property map.
 *
 *  BY NAME, NOT BY POSITION (2026-10-04). This used to run with `--value` and
 *  destructure the lines in the order they were asked for. systemd prints properties in
 *  its OWN canonical order and ignores the request order — it happens to agree for
 *  `Result` and `ExecMainStartTimestamp`, so the old code was right by luck. Had it ever
 *  disagreed, the timestamp would have landed in `result`, every verdict would have gone
 *  null, and `binding_constraint` would have read `partial_push` on a killed push: the
 *  exact wrong diagnosis the 10-02 and 10-03 debriefs spent two days undoing.
 *
 *  Local systemd only, no network and no token, same rule as every other probe here. */
function showUnit(unit: string, props: string[]): Record<string, string> {
  try {
    const out = execSync(
      `systemctl show ${unit} ${props.map((p) => `-p ${p}`).join(' ')}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const map: Record<string, string> = {};
    for (const line of out.split('\n')) {
      const at = line.indexOf('=');
      // Values carry '=' of their own (TimersCalendar holds a whole OnCalendar expression),
      // so split on the first one only.
      if (at > 0) map[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    return map;
  } catch {
    return {}; // systemctl unavailable or unit unknown — say nothing, don't claim a fault
  }
}

// systemd prints its timestamps like "Thu 2026-10-01 10:15:25 UTC"; Date can read that
// once the weekday is dropped. An unparseable or empty stamp yields null, not a guess.
function systemdStamp(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw.replace(/^[A-Za-z]{3}\s+/, ''));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** What Siege's timer and service say about themselves, plus whether the cycle's PT day
 *  was a sending day at all. See the block comment on SiegeUnitFacts. */
function siegeUnitFacts(pacificDay: string): SiegeUnitFacts {
  const svc = showUnit('siege-plan.service', ['Result', 'ActiveState', 'ExecMainStartTimestamp']);
  const timer = showUnit('siege-plan.timer', ['TimersCalendar', 'LastTriggerUSec']);
  return {
    sending_day: isSendingDay(timer.TimersCalendar ?? null, pacificDay),
    unit_state: svc.ActiveState || null,
    unit_last_result: svc.Result || null,
    unit_last_started: unitStartedAt(svc.ExecMainStartTimestamp, timer.LastTriggerUSec),
  };
}

/** When the push run that left `Result` behind actually started.
 *
 *  WHY THE FALLBACK (2026-10-09). A `systemctl daemon-reload` clears an inactive unit's
 *  `ExecMainStartTimestamp` and `ActiveEnterTimestamp` while keeping `Result`. Casey
 *  edited `siege-plan.service` to raise `TimeoutStartSec` to six hours and reloaded twice
 *  on 2026-10-08, hours after that day's run had finished cleanly — so the snapshot read
 *  `unit_last_result: success` with `unit_last_started: null`, pushRunVerdict() could not
 *  place the run inside the cycle, and `push_unit_result` came out null on the one cycle
 *  whose verdict settled whether the new ceiling worked. Editing a unit should not blind
 *  the report on the run that prompted the edit.
 *
 *  The timer's own `LastTriggerUSec` survives the reload and is within seconds of when
 *  the service started, so it answers the question the service has forgotten. Service
 *  first, timer only as a fallback: if the unit was last run by hand the service stamp is
 *  the true one, and a blank service stamp plus a stale timer stamp still yields no
 *  verdict rather than a wrong one, because pushRunVerdict() checks the window. */
export function unitStartedAt(
  execMainStart: string | undefined,
  timerLastTrigger: string | undefined,
): string | null {
  return systemdStamp(execMainStart) ?? systemdStamp(timerLastTrigger);
}

/** siege-plan.service's own verdict on the run that did this cycle's sending, or null
 *  if that unit did not run inside the window. See pushRunVerdict(). */
function siegeUnitVerdict(unit: SiegeUnitFacts, sinceISO: string, untilISO: string): string | null {
  return pushRunVerdict(unit.unit_last_result, unit.unit_last_started, sinceISO, untilISO);
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
//
// A LAP ROLLOVER IS NOT AN UNKNOWN (2026-08-29)
//
// The fallback above says "a NEGATIVE delta is how a re-lap shows up", and then hands the
// answer to the session-log sum it was written to replace. On the feed lane that is now the
// common case, not the rare one: it re-laps every second day, so it fell back on 08-28 AND
// 08-29. The 08-29 fallback reported 13,199 seeds against a true 6,019 — a 2.2x over-report
// on the lane that produced 116 of the day's 163 leads, which pushed its yield to
// 0.0088/seed (it was 0.0193), its road to 0.8 days (1.9), and its walk rate to +89% (-13%).
// Every one of those numbers went into a debrief as fact.
//
// But a rollover is fully determined by the snapshot already on disk. The lane walked the
// rest of the old book, then started the new one: `(prev_total - prev_walked) + walked_now`.
// Both terms have been in the debrief JSON since 08-22.
//
// The signature that separates a rollover from a book that SHRANK (a refill dropping merged
// rows, the other way `walked` goes backwards) is the total: a new lap carries the old seeds
// plus whatever was added, so `total_now >= total_prev`. A shrunken book fails that test and
// still falls through to the log sum, which is the right answer for a case we cannot compute.
//
// Limit, stated because it is invisible otherwise: this assumes ONE rollover per cycle. Two
// laps inside 24h would under-count by a whole book. At ~6k seeds/day against a ~12k book
// that cannot happen on this lane today, and if the lane ever gets that fast the fix is to
// carry a lap counter in the snapshot rather than to infer one.
export type AdvanceSource = 'book_delta' | 'lap_rollover' | 'session_logs' | 'none';
export function reconcileAdvanced(
  loggedAdvance: number | null,
  walkedNow: number | null,
  walkedPrevCycle: number | null,
  totalNow: number | null = null,
  totalPrevCycle: number | null = null,
): { seeds_advanced: number | null; seeds_advanced_source: AdvanceSource } {
  if (walkedNow !== null && walkedPrevCycle !== null && walkedNow >= walkedPrevCycle) {
    return { seeds_advanced: walkedNow - walkedPrevCycle, seeds_advanced_source: 'book_delta' };
  }
  // Only reachable when the walk counter went BACKWARDS, i.e. the book was replaced.
  if (
    walkedNow !== null && walkedPrevCycle !== null &&
    totalNow !== null && totalPrevCycle !== null &&
    totalNow >= totalPrevCycle && walkedPrevCycle <= totalPrevCycle
  ) {
    return {
      seeds_advanced: (totalPrevCycle - walkedPrevCycle) + walkedNow,
      seeds_advanced_source: 'lap_rollover',
    };
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

/** Last cycle's fleet size, out of the snapshot this script wrote 24h ago. Null on a
 *  missing or malformed file: an absent baseline must read as unknown, not as no change.
 *  Both fields have been written since 2026-10-13, so the first usable baseline is the
 *  2026-10-14 snapshot. */
export function priorSendPlan(
  priorDate: string,
  logsDir: string = LOGS,
): {
  live_inboxes: number | null;
  mailbox_capacity: number | null;
  plan_generated_at: string | null;
} | null {
  const p = join(logsDir, `autopilot-debrief-${priorDate}.json`);
  if (!existsSync(p)) return null;
  try {
    const prior = JSON.parse(readFileSync(p, 'utf8')) as {
      send_plan?: { live_inboxes?: unknown; mailbox_capacity?: unknown; plan_generated_at?: unknown };
    };
    const s = prior.send_plan;
    if (!s || typeof s !== 'object') return null;
    return {
      live_inboxes: num(s.live_inboxes),
      mailbox_capacity: num(s.mailbox_capacity),
      // Written since 2026-10-16. Older snapshots report null, which makes the gap
      // unknown rather than assumed comparable.
      plan_generated_at: typeof s.plan_generated_at === 'string' ? s.plan_generated_at : null,
    };
  } catch { return null; }
}

/** Last cycle's population per `review_status`, out of the snapshot this script wrote 24h
 *  ago. Null on a missing or malformed file, and null for a status that file never listed:
 *  an absent baseline must read as unknown, never as no change. Written since 2026-10-19,
 *  so the first usable baseline is the 2026-10-20 snapshot. */
export function priorReviewStatusPopulation(
  priorDate: string,
  logsDir: string = LOGS,
): Record<string, number> | null {
  const p = join(logsDir, `autopilot-debrief-${priorDate}.json`);
  if (!existsSync(p)) return null;
  try {
    const prior = JSON.parse(readFileSync(p, 'utf8')) as {
      parked?: { review_status_population?: unknown };
    };
    const pop = prior.parked?.review_status_population;
    if (!pop || typeof pop !== 'object' || Array.isArray(pop)) return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(pop as Record<string, unknown>)) {
      const n = num(v);
      if (n !== null) out[k] = n;
    }
    return Object.keys(out).length === 0 ? null : out;
  } catch { return null; }
}

export type BulkRewriteShape = BulkRewriteRoll & {
  /** How many of this status's clusters the capped list above actually printed. */
  clusters_reported: number;
  /** True when the printed list is a sample of this status's clusters, not all of them. */
  truncated: boolean;
  /** Rows the capped list printed, so the understatement is arithmetic and not a claim. */
  rows_reported: number;
  population_now: number | null;
  population_prev: number | null;
  population_change: number | null;
  /** `one_statement` | `few_statements` | `batched_sweep`. Null when nothing clustered. */
  shape: string | null;
  /** `migration` (the population grew by about what was written), `restamp` (it did not),
   *  `mixed`, or `unknown` when there is no prior population to subtract. */
  moved: string;
};

/**
 * WHAT A BULK REWRITE ACTUALLY DID, BESIDE THE CLUSTERS THAT REPORT IT (2026-10-19).
 *
 * `bulk_status_writes` prints the eight largest one-second clusters in the window. That is
 * the right instrument for one UPDATE and it understates a writer that pages. This cycle
 * the weekly subscriber-floor sweep rewrote 38,492 rows into `below_threshold` across 155
 * clusters in 154 seconds, and the snapshot printed the eight biggest — 2,578 leads, with
 * `left_the_send_queue: true` and 128 of them carrying an email address. Nothing on the
 * line said it was a sample, so the only available reading was a 2,578-lead demotion. The
 * sweep demoted nobody: every one of those leads was already `below_threshold` and the
 * sweep re-stamped it on the way past.
 *
 * Two fields separate the cases, and neither needs to know who the writer was:
 *
 *   - `shape`, off the cluster count. One statement lands on one second. A paged re-walk
 *     of a 66,488-row book cannot. 155 clusters is a sweep; the 10-13 ICP audit was 1.
 *   - `moved`, off this status's own population against yesterday's snapshot. 38,492 rows
 *     written with the population flat is a re-stamp. The 10-13 audit wrote 881 into
 *     `rejected` and that population grew by 881. Same instrument against itself, 24h
 *     apart, which is the 2026-10-18 `band_normal_prev` lesson applied here.
 *
 * `moved` is `unknown` with no prior population, which is the honest answer on the first
 * run and after any skipped cycle. Unknown and measured-as-nothing differ.
 */
export function bulkRewriteShape(
  rollup: BulkRewriteRoll[] | null,
  clusters: BulkStatusWrite[] | null,
  populationNow: Record<string, number> | null,
  populationPrev: Record<string, number> | null,
): BulkRewriteShape[] | null {
  if (rollup === null) return null;
  const key = (s: string | null) => (s === null ? '(null)' : s);
  return rollup.map((roll) => {
    const k = key(roll.review_status);
    const mine = (clusters ?? []).filter((c) => key(c.review_status) === k);
    const now = populationNow === null ? null : populationNow[k] ?? 0;
    const prev = populationPrev === null ? null : populationPrev[k] ?? null;
    const change = now === null || prev === null ? null : now - prev;
    // Bands, not a ratio, so a tiny rewrite cannot divide its way to a verdict.
    const moved = change === null
      ? 'unknown'
      : change >= roll.rows_in_window * 0.5
        ? 'migration'
        : change <= roll.rows_in_window * 0.1
          ? 'restamp'
          : 'mixed';
    return {
      ...roll,
      clusters_reported: mine.length,
      truncated: mine.length < roll.clusters,
      rows_reported: mine.reduce((a, c) => a + c.leads, 0),
      population_now: now,
      population_prev: prev,
      population_change: change,
      shape: roll.clusters === 0
        ? null
        : roll.clusters <= 2
          ? 'one_statement'
          : roll.clusters < 10
            ? 'few_statements'
            : 'batched_sweep',
      moved,
    };
  });
}

/** The inbox health gate's state file, which lives in the email repo because the gate
 *  does (CLAUDE.md: that lever is owned there, and this repo only counts). */
function readInboxGateState(): unknown {
  const f = join('/home/casey/repos/youtube-email-outreach-v1', '.inbox-health-state.json');
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch { return null; }
}

/** The band gate's state file, in automator, for the same reason: it owns the lever and
 *  since 2026-10-15 it owns the health pauses too. Filesystem only, no automator import. */
function readBandGateState(): unknown {
  const f = join(AUTOMATOR_REPO, 'state', 'inbox-health.json');
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch { return null; }
}

// Last cycle's `seeds_advanced` per lane, read out of the debrief snapshot this script
// wrote 24h ago. Returns an empty map when that file is missing or unreadable (first run
// after a deploy, a skipped cycle) — an absent baseline reports nulls, never a false alarm.
type PriorLane = { seeds_advanced?: number | null; seeds_walked?: number | null; seeds_total?: number | null; seeds_advanced_source?: string | null };
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
// The third field `reconcileAdvanced` needs, and the one that tells a lap rollover apart
// from a book that shrank. Also written into the debrief JSON since 08-22.
export function priorSeedsTotal(priorDate: string, logsDir: string = LOGS): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [lane, h] of Object.entries(priorLanes(priorDate, logsDir))) {
    out[lane] = typeof h?.seeds_total === 'number' ? h.seeds_total : null;
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
// Local files only, same as above: no database, no network, can't itself fail.
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
// A lane's health key is not always its `discovered_via` key: the peer daemon reports as
// `peer_sweep` here and tags its rows `peer-comment:`, which classifies as `peer_network`.
// Everything else is spelled the same. Kept explicit so a rename on either side is a
// compile error rather than a lane that silently reports zero output forever.
const LANE_DISCOVERY_KEY: Readonly<Record<string, string>> = {
  recommended_videos_feed: 'recommended_videos_feed',
  video_graph_sweep: 'video_graph_sweep',
  comment_sweep: 'comment_sweep',
  peer_sweep: 'peer_network',
  podcast_crossover: 'podcast_crossover',
};
/**
 * What the lane actually PRODUCED this cycle, beside what it consumed (2026-08-26).
 *
 * Every other field in this block measures seed supply, and supply has not been the
 * problem on any of the three days this blind spot bit. The same shape has now shown up
 * four times: 08-21, 08-22, 08-25 (a lane walking 7,200 seeds at zero yield with a dead
 * scorer, reporting `productive: true` and a walk rate 53% UP, because it had stopped
 * doing the expensive part), and 08-26 (peer-sweep: 219 seeds walked, 198 channels
 * written, ONE lead scoring >= 6, every health field green).
 *
 * `productive` answers "did this lane move?". These answer "did it make anything?", which
 * is the question the last four debriefs actually needed. `yield_dead` is the alarm: the
 * lane did real work — at least `minChannels` channels written, so a quiet lane is never
 * accused — and got nothing above the approval bar for it.
 *
 * Deliberately NOT a comparison against a prior cycle. A lane thinning slowly is a
 * business fact for the debrief to weigh; a lane at zero after real work is a fault, and
 * conflating the two is how 08-25 read an outage as a speed-up.
 */
export function laneYield(
  channels: number | undefined,
  pitchable: number | undefined,
  seedsAdvanced: number | null,
  minChannels = 50,
): { channels_in_cycle: number; pitchable_in_cycle: number; pitchable_rate_pct: number | null; pitchable_per_seed: number | null; yield_dead: boolean } {
  const ch = channels ?? 0;
  const p = pitchable ?? 0;
  return {
    channels_in_cycle: ch,
    pitchable_in_cycle: p,
    pitchable_rate_pct: ch > 0 ? Math.round((1000 * p) / ch) / 10 : null,
    pitchable_per_seed:
      seedsAdvanced !== null && seedsAdvanced > 0 ? Math.round((10000 * p) / seedsAdvanced) / 10000 : null,
    yield_dead: ch >= minChannels && p === 0,
  };
}
function discoveryMethodsHealth(
  sinceMs: number,
  untilMs: number,
  byMethod: Record<string, number>,
  byMethodPitchable: Record<string, number>,
): Record<string, unknown> {
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
  const priorTotal = priorSeedsTotal(priorDate);
  const priorSource = priorAdvanceSource(priorDate);
  // Counts first, then the reconciled cycle advance, then the road that advance implies.
  // `days_of_road` and `walk_rate_change_pct` both divide by this number, so it has to be
  // settled before either is computed.
  const advance = (lane: string, w: SweepWork, c: SeedCounts) =>
    reconcileAdvanced(
      w.seeds_advanced, c.seeds_walked, priorWalked[lane] ?? null,
      c.seeds_total, priorTotal[lane] ?? null,
    );
  const trend = (lane: string, advanced: number | null, source: AdvanceSource, b: SeedBook): WalkRate =>
    walkRateTrend(advanced, prior[lane] ?? null, b, (priorSource[lane] ?? 'session_logs') === source);
  const lane = (key: string, stateFile: string, w: SweepWork) => {
    const counts = seedCounts(stateFile);
    const adv = advance(key, w, counts);
    const book = seedBook(counts, adv.seeds_advanced);
    const dk = LANE_DISCOVERY_KEY[key] ?? key;
    return {
      ...w,
      ...adv,
      ...book,
      ...trend(key, adv.seeds_advanced, adv.seeds_advanced_source, book),
      ...laneYield(byMethod[dk], byMethodPitchable[dk], adv.seeds_advanced),
    };
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

// What this repo's own JSONL recorded about sending inside the cycle (2026-09-25).
//
// WHY, and why it is reported NEXT TO the database count rather than instead of it:
// `npm run send` is not the only thing that pushes to SmartLead. On 2026-09-23 and again
// on 09-24, 47 emails a day were driven by hand from the email repo, and this log knows
// nothing about them — 09-24 read `send_attempted=18` for a day that loaded 55. So the
// gap between the two numbers IS the signal: it says how much of the money path ran
// outside the coordination loop that is supposed to own it. Do not "reconcile" them by
// dropping one.
export function summarizeSendLines(
  lines: Array<Record<string, unknown>>,
  sinceISO: string,
  untilISO: string,
): {
  runs: number;
  attempted_sum: number;
  sent_sum: number | null;
  failed_sum: number | null;
  dry_runs_excluded: number;
} {
  let runs = 0;
  let attempted = 0;
  let sent: number | null = null;
  let failed: number | null = null;
  let dry = 0;
  for (const e of lines) {
    const ts = typeof e.ts === 'string' ? e.ts : '';
    if (ts < sinceISO || ts >= untilISO) continue;
    if (e.manual_send_run !== true) continue;
    if (e.dry_run === true) { dry += 1; continue; }
    runs += 1;
    attempted += typeof e.send_attempted === 'number' ? e.send_attempted : 0;
    // send_sent/send_failed only exist from 2026-09-24 (`ce5abf1`), and are null when the
    // child printed no tally at all. Leave the sum null rather than reading a missing
    // field as a zero — "we didn't measure" is not "nothing happened", which is the exact
    // confusion that let a batch lose ten finished emails unnoticed.
    if (typeof e.send_sent === 'number') sent = (sent ?? 0) + e.send_sent;
    if (typeof e.send_failed === 'number') failed = (failed ?? 0) + e.send_failed;
  }
  return { runs, attempted_sum: attempted, sent_sum: sent, failed_sum: failed, dry_runs_excluded: dry };
}

function orchestratorSendLog(sinceISO: string, untilISO: string): {
  runs: number;
  attempted_sum: number;
  sent_sum: number | null;
  failed_sum: number | null;
  dry_runs_excluded: number;
} {
  const lines: Array<Record<string, unknown>> = [];
  for (const f of readdirSync(LOGS)) {
    if (!/^orchestrator-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) continue;
    lines.push(...readJsonl(join(LOGS, f)));
  }
  return summarizeSendLines(lines, sinceISO, untilISO);
}

function parkedAtCycleStart(sinceISO: string): number | null {
  const f = join(LOGS, 'autopilot-parked-history.jsonl');
  if (!existsSync(f)) return null;
  const hist = readJsonl(f) as unknown as Array<{ ts: string; parked: number }>;
  const inCycle = hist.filter((p) => p.ts >= sinceISO).sort((a, b) => a.ts.localeCompare(b.ts));
  return inCycle.length ? inCycle[0].parked : null;
}

// Which recent cycles have no debrief in the brain (2026-09-20).
//
// WHY. debrief.sh ends in an unconditional `exit 0` so a bad cycle can never stop
// the timer. That is right, and it is also why 2026-09-17, -18 and -19 each looked
// like a clean run: `claude -p` came back in ~130ms with "Failed to authenticate:
// OAuth session expired and could not be refreshed", no report was written, and
// nothing said so. Three cycles of history went missing in plain sight.
//
// The gatherer runs BEFORE the agent, so it is the one place that can tell the
// agent what earlier cycles are still owed. Every date listed here has a grounded
// metrics file on disk, so a later run can write the report from real numbers
// rather than guesses. Deliberately reads only the filesystem: no database call,
// no cost, and it cannot itself be the thing that is broken.
//
// A GAP MUST NOT AGE OUT OF ITS OWN REMINDER (2026-09-27). The list above was a
// flat 7-day lookback, which is exactly long enough to forget the thing it was
// written for. 2026-09-17, -18 and -19 were the gap it was built on 09-20 to
// report, and by 09-25 all three had slid past the seventh day: this field read
// `[]` on 09-26 and 09-27 while six cycles were owed, three of them the original
// three. A reminder with a shorter memory than the backlog it tracks reports an
// empty backlog and reads as "nothing owed".
//
// So it is now the union of two readings, which answer different questions:
//
//  - the last 7 dates, which catch a cycle that failed so early it wrote no
//    metrics file at all (`has_metrics: false`), the shape of the OAuth failure
//    in the note above;
//  - every date that HAS a metrics file and no report, however old, because that
//    is precisely the set a later run can still write from real numbers. It is
//    bounded by the metrics files on disk, and no date before the first one can
//    ever be written anyway.
//
// Newest first, capped, so a long backlog cannot crowd out the current cycle.
export const MAX_MISSING_DEBRIEFS = 14;

export function missingDebriefs(today: string): Array<{ date: string; has_metrics: boolean; reason: string | null }> {
  const RUNS = '/home/casey/repos/casey-assistant/brain/lead-gen/runs';
  const todayMs = Date.parse(`${today}T12:00:00Z`);
  if (Number.isNaN(todayMs)) return [];
  const dates = new Set<string>();
  // The last 7 completed cycles. Today's own report does not exist yet — the agent
  // that reads this is the one about to write it — so start one day back.
  for (let back = 1; back <= 7; back++) {
    dates.add(new Date(todayMs - back * 86_400_000).toISOString().slice(0, 10));
  }
  // Every cycle whose numbers survive on disk, at any age.
  try {
    for (const f of readdirSync(LOGS)) {
      const m = /^autopilot-debrief-(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
      if (m && m[1]! < today) dates.add(m[1]!);
    }
  } catch { /* an unreadable log dir leaves the 7-day window, which is the old behaviour */ }
  const out: Array<{ date: string; has_metrics: boolean; reason: string | null }> = [];
  for (const d of [...dates].sort().reverse()) {
    if (existsSync(join(RUNS, `lead-run-${d}.html`))) continue;
    const flag = join(LOGS, `autopilot-debrief-missing-${d}.flag`);
    let reason: string | null = null;
    if (existsSync(flag)) {
      try {
        reason = (readFileSync(flag, 'utf8').split('\n').find((l) => l.startsWith('Reason: ')) ?? '')
          .replace(/^Reason: /, '').trim() || null;
      } catch { /* a flag we cannot read is still a flag */ }
    }
    out.push({ date: d, has_metrics: existsSync(join(LOGS, `autopilot-debrief-${d}.json`)), reason });
    if (out.length >= MAX_MISSING_DEBRIEFS) break;
  }
  return out;
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
          //  • benignFinalized (2026-07-29): benign on a transient infra blip (database error,
          //    YouTube 503 SERVICE_UNAVAILABLE, network error, etc.) that ALREADY self-healed — proven
          //    when the SAME session still ran its finalization sequence to "[campaign] DONE"
          //    AFTER the hard-wall stop. campaign.ts always finalizes (final verify → promote →
          //    evaluate-probes → DONE) whether the cause was benign or not, so reaching DONE means
          //    the session completed and campaign-loop.sh has already retried successfully — it is
          //    definitionally not stuck. A genuine hang/crash (module error, OOM, unhandled
          //    campaign exception) never reaches DONE, so it is still surfaced. Without this the
          //    2026-07-30 cycle lit `finder_hard_wall` on a productive session (+18 parked, 118
          //    channels) whose only failure was two consecutive the old database 503s that rode out within
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

// Halt state, and how much of the cycle the pipeline spent stopped.
//
// WHY THIS EXISTS (2026-08-31): on 08-30 the shared env bank was truncated to 0 bytes, a
// fix-agent correctly halted rather than guess at a secrets file, and the halt flag stopped
// the campaign loop AND all five discovery lanes for 22h44m — including ~22h AFTER the bank
// had already refilled itself. That was the entire story of the cycle, and this snapshot,
// the feed a debrief agent is told to treat as authoritative, said nothing about it: the
// halt appeared only as incidental text inside each lane's `idle_reason`. A reader could
// have called it five independent lane failures instead of one flag.
//
// `hours_halted_in_cycle` counts the hourly `halt_standing` heartbeats the check-in writes,
// so a halt stays countable even once the flag is gone — which is exactly the case a
// midnight-boundary debrief hits after an overnight recovery.
function haltHealth(sinceMs: number, untilMs: number) {
  const f = join(LOGS, 'autopilot-observations.jsonl');
  const rows = existsSync(f)
    ? (readJsonl(f) as Array<Record<string, unknown>>).filter((o) => typeof o.ts === 'string')
    : [];
  const inWindow = rows.filter((o) => {
    const t = Date.parse(o.ts as string);
    return Number.isFinite(t) && t >= sinceMs && t < untilMs;
  });

  const standing = inWindow.filter((o) => o.kind === 'halt_standing');
  const cleared = inWindow
    .filter((o) => o.kind === 'halt_auto_cleared')
    .map((o) => ({ ts: o.ts as string, cause: (o.cause as string) ?? null, detail: (o.detail as string) ?? null }));

  const flag = join(LOGS, 'autopilot-halt.flag');
  let activeNow = false;
  let writtenISO: string | null = null;
  let reason: string | null = null;
  if (existsSync(flag)) {
    activeNow = true;
    try { writtenISO = new Date(statSync(flag).mtimeMs).toISOString(); } catch { /* raced */ }
    try {
      reason = readFileSync(flag, 'utf8').split('\n').find((l) => l.trim())?.trim().slice(0, 300) ?? null;
    } catch { /* raced */ }
  } else if (standing.length) {
    writtenISO = (standing[0].halt_written_iso as string) ?? null;
    reason = (standing[standing.length - 1].reason as string) ?? null;
  }

  return {
    active_now: activeNow,
    halt_written_iso: writtenISO,
    reason,
    // One heartbeat per hourly check-in, so this doubles as "hours the loop was down".
    hours_halted_in_cycle: standing.length,
    heartbeats_first: standing.length ? (standing[0].ts as string) : null,
    heartbeats_last: standing.length ? (standing[standing.length - 1].ts as string) : null,
    auto_clears_in_cycle: cleared,
  };
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

// Net-new channels the finder actually WROTE to the database this cycle — summed from the finder
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

/**
 * How many YouTube API keys actually work, measured right after the daily reset.
 *
 * WHY (2026-09-07). The key pool is the binding constraint on discovery, and
 * nothing measured it. On the cycle ending 2026-09-07 the video-graph sweep hit
 * an exhausted pool at 19:29Z and correctly slept 11.6h to the midnight-PT
 * refill, so HALF THE CYCLE produced no channels at all — and the snapshot that
 * is supposed to explain the day carried no number for the thing that caused it.
 * A hand-run of the finder's key test at 00:35 PT then found 50 of 66 keys still
 * answering `403 daily quota exhausted` THIRTY-FIVE MINUTES AFTER the reset that
 * was meant to refill them. That is either a slow reset or projects whose quota
 * has been cut, and one number a day tells the two apart. Nobody should have to
 * discover it by hand again.
 *
 * TIMING IS THE POINT. This runs at ~00:20 PT, twenty minutes past the reset, so
 * it measures the pool the day is about to run on rather than the pool the last
 * day ended with. Read it as a forecast, not a post-mortem.
 *
 * COST is one unit per key (`channels.list?part=id`), so ~66 units against a
 * ~660,000-unit pool. Key VALUES are never emitted — Google echoes the key back
 * inside its own error bodies, so only the slot label and the verdict leave here.
 *
 * Fails soft to nulls, like everything else in this file: a debrief must still be
 * written when the network is down, and a missing count must never read as zero.
 */
type KeyVerdict = 'working' | 'quota_exhausted' | 'blocked' | 'invalid' | 'rate_limited' | 'other';

export function classifyKeyProbe(status: number, body: string): KeyVerdict {
  if (status === 200) return 'working';
  if (status === 429) return 'rate_limited';
  const b = body.toLowerCase();
  if (status === 403) {
    // Order matters: a suspended project also says "forbidden", but only a spent
    // key says quotaExceeded, and the two need different answers (wait vs replace).
    if (b.includes('quotaexceeded') || b.includes('quota') && b.includes('exceeded')) return 'quota_exhausted';
    if (b.includes('accessnotconfigured') || b.includes('suspend') || b.includes('blocked') || b.includes('forbidden')) return 'blocked';
    return 'other';
  }
  if (status === 400 && (b.includes('keyinvalid') || b.includes('api key not valid'))) return 'invalid';
  return 'other';
}

/** Slot labels + values from the shared bank. Values never leave this function's caller. */
function youtubeKeySlots(): Array<{ label: string; key: string }> {
  const path = join(process.env.HOME ?? '/home/casey', 'env-storage', '.env');
  if (!existsSync(path)) return [];
  try {
    const found: Array<{ n: number; label: string; key: string }> = [];
    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!v) continue;
      if (k === 'YOUTUBE_API_KEY') found.push({ n: 0, label: 'YOUTUBE_API_KEY', key: v });
      const m = k.match(/^YOUTUBE_API_KEY_(\d+)$/);
      if (m) found.push({ n: Number(m[1]), label: k, key: v });
    }
    found.sort((a, b) => a.n - b.n);
    return found.map((f) => ({ label: f.label, key: f.key }));
  } catch {
    return [];
  }
}

async function youtubeKeyPoolHealth(): Promise<Record<string, unknown>> {
  const slots = youtubeKeySlots();
  if (slots.length === 0) {
    return { probed: false, reason: 'no YOUTUBE_API_KEY slots readable in the shared bank', total: 0 };
  }
  const counts: Record<KeyVerdict, number> = {
    working: 0, quota_exhausted: 0, blocked: 0, invalid: 0, rate_limited: 0, other: 0,
  };
  const deadSlots: string[] = [];
  let probed = 0;
  const CONCURRENCY = 8;
  const queue = [...slots];
  const worker = async (): Promise<void> => {
    for (;;) {
      const slot = queue.shift();
      if (!slot) return;
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw&key=${encodeURIComponent(slot.key)}`,
          { signal: AbortSignal.timeout(20_000) },
        );
        const body = res.ok ? '' : await res.text().catch(() => '');
        const verdict = classifyKeyProbe(res.status, body);
        counts[verdict] += 1;
        probed += 1;
        if (verdict !== 'working') deadSlots.push(`${slot.label}:${verdict}`);
      } catch {
        // A network failure is not a key verdict. Leave it uncounted rather than
        // reporting a healthy key as dead and starting a key hunt over a blip.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, slots.length) }, worker));

  const workingPct = probed > 0 ? Number(((100 * counts.working) / probed).toFixed(1)) : null;
  return {
    probed: true,
    probed_at: new Date().toISOString(),
    // Named so it cannot be read as "how many keys exist". Slots that failed to
    // answer at all are in `total` but not in `probed`.
    total: slots.length,
    probed_count: probed,
    working: counts.working,
    quota_exhausted: counts.quota_exhausted,
    blocked: counts.blocked,
    invalid: counts.invalid,
    rate_limited: counts.rate_limited,
    other: counts.other,
    working_pct: workingPct,
    // The finding this field exists for: keys still refusing minutes after the
    // midnight-PT reset are not spent-today, they are a pool that did not refill.
    exhausted_after_reset: counts.quota_exhausted,
    pool_collapsed: workingPct !== null && workingPct < 50,
    dead_slots: deadSlots.sort(),
    note: 'Probed ~20 min after the midnight-PT quota reset, so this is the pool TODAY starts with. A high exhausted_after_reset means the reset did not refill those projects.',
  };
}

// THE PAID RECOVERY LANE AND THE ENRICHMENT BILL ARE ONE BUDGET (2026-10-01).
//
// Apify's billing month rolled at 00:00 on 1 Oct and the endspec lane, idle since
// 20 Sep on a drained allowance, ran four batches and parked 203 leads. Every one
// of those leads then has to be enriched, so the backfill chain went from batches
// of 1-3 leads to 66 and 67, and the OpenRouter account rate went $4.61/day to
// $19.52/day — runway 40 days to 8.5. Nothing in this snapshot connected those
// facts: Apify's remaining allowance appeared nowhere, the enrichment chain
// appeared nowhere, and the OpenRouter runway was a figure with no cause attached.
//
// They are the same decision. Apify money converts into parked leads at a measured
// rate, and each parked lead draws a measured amount of OpenRouter to enrich. So
// spending the rest of the Apify allowance commits a predictable amount of
// OpenRouter, and whether the balance covers it is answerable a week ahead instead
// of discovered when enrichment stops mid-pool.
//
// DELIBERATELY FILESYSTEM-ONLY, like sendPlanHealth. Every endspec run log opens
// with Apify's own ledger line, so the allowance needs no token and no network
// call, and this can never be the reason a debrief fails to be written. The figure
// is as of the last batch, which is the right resolution for a daily snapshot;
// `budget_read_at` says how stale it is.

/** Apify's own ledger line, printed at the top of every endspec run log. */
export function apifyLedgerLine(log: string): { used: number; cap: number; left: number; cycleEnds: string } | null {
  const m = /^Apify: plan \S+, month \$([\d.]+) of \$([\d.]+) used, \$([\d.]+) left \(cycle ends (\d{4}-\d{2}-\d{2})\)/m.exec(log);
  if (!m) return null;
  return { used: Number(m[1]), cap: Number(m[2]), left: Number(m[3]), cycleEnds: m[4] };
}

/**
 * What one endspec batch scraped and what it actually recovered.
 *
 * `recovered` prefers the `Recovered:` line, which counts lead state and so
 * includes the leads the recovery lane's verify timer parked mid-scrape. The
 * `leads flipped` fallback is for logs written before 2026-10-01, when that was
 * the only number and it undercounted by whatever the other lane had taken (19 of
 * a real 59 on the 04:20 batch).
 */
export function apifyBatchFacts(log: string): { scraped: number; found: number; recovered: number | null } | null {
  const s = /^Scrape done: (\d+) found, (\d+) no email, (\d+) failed/m.exec(log);
  if (!s) return null;
  const found = Number(s[1]);
  const scraped = found + Number(s[2]);
  const rec = /^Recovered: (\d+) of \d+/m.exec(log);
  if (rec) return { scraped, found, recovered: Number(rec[1]) };
  const flip = /(\d+) leads flipped to approved_hold/.exec(log);
  return { scraped, found, recovered: flip ? Number(flip[1]) : null };
}

/** Backfill chain batches that finished inside the window, and the leads they enriched. */
export function enrichmentChainFacts(
  chainLog: string,
  sinceISO: string,
  untilISO: string,
): { batches: number; leads_done: number; leads_failed: number; in_flight: number } {
  let batches = 0;
  let done = 0;
  let failed = 0;
  let launched = 0;
  for (const line of chainLog.split('\n')) {
    const t = /^\[(\d{4}-\d{2}-\d{2}T[\d:]+Z)\]/.exec(line);
    if (!t || t[1] < sinceISO || t[1] >= untilISO) continue;
    const fin = /batch finished: exit=\d+ done=(\d+) failed=(\d+)/.exec(line);
    if (fin) { batches++; done += Number(fin[1]); failed += Number(fin[2]); continue; }
    if (/launching batch: count=\d+/.test(line)) launched++;
  }
  // A launch with no matching finish is a batch still running at cycle close, not
  // a lost one. Reporting it as zero work is how a busy night reads as a quiet one.
  return { batches, leads_done: done, leads_failed: failed, in_flight: Math.max(0, launched - batches) };
}

/**
 * Convert the remaining Apify allowance into leads, and those leads into the
 * OpenRouter dollars enriching them will cost. Pure arithmetic on measured rates,
 * so a rate that could not be measured yields null rather than a guess.
 */
export function projectRecoveryBudget(input: {
  spendableUsd: number | null;
  pricePerRun: number;
  recoveredInCycle: number | null;
  channelsInCycle: number;
  enrichedInCycle: number;
  accountSpendUsd: number | null;
  balanceUsd: number | null;
}): Record<string, unknown> {
  const { spendableUsd, pricePerRun, recoveredInCycle, channelsInCycle, enrichedInCycle } = input;
  const channels = spendableUsd !== null && spendableUsd > 0
    ? Math.floor(spendableUsd / pricePerRun)
    : 0;
  const perChannel = recoveredInCycle !== null && channelsInCycle > 0
    ? Number((recoveredInCycle / channelsInCycle).toFixed(4))
    : null;
  const projectedLeads = perChannel !== null ? Math.round(channels * perChannel) : null;
  // Cost per enriched lead, from the provider's own meter over the same cycle that
  // did the enriching. Attributing ALL account spend to enrichment is an upper
  // bound and deliberately so: on a cycle where the backfill is the only heavy
  // caller it is near-exact, and erring high is the safe direction for a runway.
  const perLead = input.accountSpendUsd !== null && enrichedInCycle > 0
    ? Number((input.accountSpendUsd / enrichedInCycle).toFixed(4))
    : null;
  const enrichCost = projectedLeads !== null && perLead !== null
    ? Number((projectedLeads * perLead).toFixed(2))
    : null;
  return {
    channels_affordable: channels,
    recovered_per_channel: perChannel,
    projected_leads: projectedLeads,
    openrouter_usd_per_enriched_lead: perLead,
    openrouter_cost_of_projected_leads_usd: enrichCost,
    openrouter_balance_usd: input.balanceUsd,
    balance_covers_projected: enrichCost !== null && input.balanceUsd !== null
      ? input.balanceUsd >= enrichCost
      : null,
  };
}

/** The paid-recovery / enrichment budget pair, read off disk. */
function recoveryBudgetHealth(
  sinceISO: string,
  untilISO: string,
  openrouter: { account_spend_usd?: unknown; balance_usd?: unknown },
): Record<string, unknown> {
  const EMAIL_REPO = '/home/casey/repos/youtube-email-outreach-v1';
  const PRICE_PER_RUN = 0.0702; // apify-endspec-loop.sh APIFY_PRICE_PER_RUN
  const RESERVE = 10;           // apify-endspec-loop.sh BUDGET_RESERVE_USD

  let batches = 0;
  let channels = 0;
  let found = 0;
  let recovered: number | null = null;
  let ledger: ReturnType<typeof apifyLedgerLine> = null;
  let ledgerAt: string | null = null;
  const emailLogs = join(EMAIL_REPO, 'logs');
  if (existsSync(emailLogs)) {
    const names = readdirSync(emailLogs)
      .filter((n) => /^apify-endspec-\d{8}T\d{6}Z\.log$/.test(n))
      .sort();
    for (const n of names) {
      const stamp = /(\d{8})T(\d{6})Z/.exec(n)!;
      const iso = `${stamp[1].slice(0, 4)}-${stamp[1].slice(4, 6)}-${stamp[1].slice(6, 8)}T`
        + `${stamp[2].slice(0, 2)}:${stamp[2].slice(2, 4)}:${stamp[2].slice(4, 6)}Z`;
      let text = '';
      try { text = readFileSync(join(emailLogs, n), 'utf8'); } catch { continue; }
      // The allowance is read from the NEWEST log whatever cycle it belongs to: a
      // lane resting all month still has a real remaining balance worth reporting.
      const led = apifyLedgerLine(text);
      if (led) { ledger = led; ledgerAt = iso; }
      if (iso < sinceISO || iso >= untilISO) continue;
      const f = apifyBatchFacts(text);
      if (!f) continue;
      batches++; channels += f.scraped; found += f.found;
      if (f.recovered !== null) recovered = (recovered ?? 0) + f.recovered;
    }
  }

  let chain = { batches: 0, leads_done: 0, leads_failed: 0, in_flight: 0 };
  const chainLog = join(LOGS, 'backfill-2026-07', 'chain.log');
  if (existsSync(chainLog)) {
    try { chain = enrichmentChainFacts(readFileSync(chainLog, 'utf8'), sinceISO, untilISO); } catch { /* keep zeros */ }
  }

  // The lane writes its live ledger reading every tick, resting or not
  // (apify-endspec-loop.sh, 2026-10-02). Prefer it when it is newer than the newest
  // run log's own line, because a run log's figure is taken BEFORE that batch spends:
  // on 2026-10-01 the last batch started at "$15.69 left" and spent $5.69, so the
  // logs' freshest answer said $5.69 was spendable while the lane had been resting on
  // $0.00 for seven hours. Falls back to the run-log line when the file is absent.
  let left = ledger ? ledger.left : null;
  let ledgerSource = ledger ? 'run_log' : null;
  try {
    const t = JSON.parse(readFileSync(join(emailLogs, 'apify-endspec-budget.json'), 'utf8'));
    const tickAt = typeof t.read_at === 'string' ? t.read_at : null;
    const tickLeft = typeof t.left_usd === 'number' ? t.left_usd : null;
    if (tickAt && tickLeft !== null && (ledgerAt === null || tickAt > ledgerAt)) {
      left = tickLeft;
      ledgerAt = tickAt;
      ledgerSource = 'loop_tick';
    }
  } catch { /* no tick file yet, or unreadable: the run-log line stands */ }
  const spendable = left !== null ? Number((left - RESERVE).toFixed(4)) : null;
  const halted = existsSync(join(emailLogs, 'apify-endspec-halt.flag'));
  let strikes = 0;
  const strikeFile = join(emailLogs, '.apify-endspec-overpriced');
  if (existsSync(strikeFile)) {
    try { strikes = Number(readFileSync(strikeFile, 'utf8').trim()) || 0; } catch { /* 0 */ }
  }

  return {
    apify: {
      batches_in_cycle: batches,
      channels_scraped: channels,
      addresses_found: found,
      recovered_in_cycle: recovered,
      cost_per_recovered_usd: recovered !== null && recovered > 0
        ? Number(((channels * PRICE_PER_RUN) / recovered).toFixed(3))
        : null,
      budget_left_usd: left,
      budget_cap_usd: ledger ? ledger.cap : null,
      budget_cycle_ends: ledger ? ledger.cycleEnds : null,
      budget_read_at: ledgerAt,
      budget_read_from: ledgerSource,
      reserve_usd: RESERVE,
      spendable_usd: spendable,
      halted,
      price_strikes: strikes,
    },
    enrichment: chain,
    projection: projectRecoveryBudget({
      spendableUsd: spendable,
      pricePerRun: PRICE_PER_RUN,
      recoveredInCycle: recovered,
      channelsInCycle: channels,
      enrichedInCycle: chain.leads_done,
      accountSpendUsd: typeof openrouter.account_spend_usd === 'number' ? openrouter.account_spend_usd : null,
      balanceUsd: typeof openrouter.balance_usd === 'number' ? openrouter.balance_usd : null,
    }),
    note: 'Apify allowance read off the newest endspec run log (no token, no network) — `budget_read_at` is its age. `projection` turns the unspent allowance into leads at the cycle\'s measured recovery rate, then into the OpenRouter dollars those leads will cost to enrich, so the two budgets are decided together. `openrouter_usd_per_enriched_lead` charges ALL account spend to enrichment, which is an upper bound. `halted`/`price_strikes` are the lane\'s own brake: 2 strikes stops it for the month.',
  };
}

/**
 * The account that actually pays for this pipeline, and how long it has left.
 *
 * WHY (2026-08-25). `burn_today` meters Anthropic, which has been $0.00 since the
 * zero-Anthropic migration on 08-01 — it is a gauge on a tank nobody draws from.
 * Every real LLM dollar goes to OpenRouter, and NOTHING watched that: not the
 * hourly check-in, not this snapshot, not any lane's health. So on 08-25 the
 * account simply ran out at 00:49Z with no warning at any point beforehand, and
 * every discovery lane went dark. The balance had been walking down at $6-8/day
 * in plain sight of a system that never looked at it.
 *
 * Two numbers, both cheap. Spend comes from the finder's own per-day spend logs,
 * already on disk. Balance comes from the credits endpoint, which is free to
 * call. `days_of_runway` is the one that matters: at a week's notice, topping up
 * is a calendar item rather than an outage.
 *
 * Everything here fails soft to null. A debrief must still be written when the
 * network is down, and a missing number must never read as a zero balance.
 */
async function openRouterHealth(sinceISO: string, untilISO: string): Promise<Record<string, unknown>> {
  // Spend: the two day-files that can overlap a PT-midnight-to-PT-midnight window.
  let usd = 0;
  let calls = 0;
  const byTask: Record<string, { usd: number; calls: number }> = {};
  for (const day of [sinceISO.slice(0, 10), untilISO.slice(0, 10)]) {
    const p = join(FINDER_REPO, 'logs', `llm-spend-${day}.jsonl`);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let r: { ts?: string; usd?: number; cost?: number; task?: string; model?: string };
      try { r = JSON.parse(line); } catch { continue; }
      if (typeof r.ts !== 'string' || r.ts < sinceISO || r.ts >= untilISO) continue;
      const c = Number(r.usd ?? r.cost ?? 0);
      if (!Number.isFinite(c)) continue;
      usd += c; calls += 1;
      const k = r.task ?? r.model ?? 'unknown';
      byTask[k] ??= { usd: 0, calls: 0 };
      byTask[k].usd += c; byTask[k].calls += 1;
    }
  }

  let remaining: number | null = null;
  let totalUsage: number | null = null;
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (key) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: { total_credits?: number; total_usage?: number } };
        const granted = Number(body.data?.total_credits);
        const used = Number(body.data?.total_usage);
        if (Number.isFinite(granted) && Number.isFinite(used)) { remaining = granted - used; totalUsage = used; }
      }
    } catch { /* fail soft — a debrief still gets written with the network down */ }
  }

  // ACCOUNT-WIDE burn, from the provider's own meter (2026-08-31).
  //
  // `spend_usd` above sums the FINDER's spend log and nothing else, so it only
  // ever describes one of several repos drawing on this account. The gap is not
  // small: the enrichment backfill runs quick-research, whose models.json routes
  // 15 tasks to OpenRouter, writes no spend log at all, and is not gated by the
  // halt flag. On 08-31 the whole pipeline was halted, the finder logged ONE call
  // for $0.0079, the backfill quietly enriched 224 bundles, and the account
  // actually spent $42.79. Runway was reported as 42,965 days. It was about 8.
  //
  // total_usage is the provider's own cumulative meter, so it counts every repo,
  // metered or not. Sampling it once per cycle and diffing gives ground truth
  // that no repo can forget to report. First run has no prior sample and returns
  // null rather than guessing.
  let accountSpend: number | null = null;
  let sampleHours: number | null = null;
  const SAMPLE = join(LOGS, 'openrouter-usage-samples.jsonl');
  // Well under the 24h debrief cadence, so the normal daily run always measures,
  // and comfortably above the minutes between an accidental double-run.
  const MIN_USAGE_SAMPLE_GAP_H = 6;
  if (totalUsage !== null) {
    try {
      // A SECOND RUN IN THE SAME CYCLE MUST NOT DESTROY THE MEASUREMENT (2026-09-30).
      // This appended a sample on every run and diffed against the newest one, so
      // re-running the gatherer — which this script is safe to do, and which the
      // debrief agent does when it wants fresh numbers — diffed against a sample
      // minutes old. Today that turned a real $4.61/day over 24h into $15.00/day
      // over 0.02h, and cut reported runway from 40 days to 12. The numbers had to
      // be repaired by hand, which is the tell that the measurement was fragile.
      // Two halves of one rule: diff against the newest sample that is actually old
      // enough to measure against, and don't write a new one until that much time
      // has passed. Re-running now returns the same answer instead of a sliver.
      const samples = existsSync(SAMPLE)
        ? (readJsonl(SAMPLE) as Array<{ ts?: unknown; total_usage?: unknown }>)
            .filter((r) => typeof r.ts === 'string' && typeof r.total_usage === 'number')
        : [];
      const nowMs = Date.now();
      const oldEnough = (r: { ts?: unknown }) =>
        nowMs - Date.parse(r.ts as string) >= MIN_USAGE_SAMPLE_GAP_H * 3_600_000;
      const prior = samples.filter(oldEnough).pop();
      if (prior) {
        const dt = nowMs - Date.parse(prior.ts as string);
        if (dt > 0) {
          accountSpend = Number((totalUsage - (prior.total_usage as number)).toFixed(4));
          sampleHours = Number((dt / 3_600_000).toFixed(2));
        }
      }
      const newest = samples.at(-1);
      if (!newest || oldEnough(newest)) {
        appendFileSync(SAMPLE, JSON.stringify({ ts: new Date().toISOString(), total_usage: totalUsage }) + '\n');
      }
    } catch { /* sampling is best-effort; never fail a debrief over it */ }
  }
  // Per-day rate, so an off-cadence debrief run can't read as a cheap day.
  const accountPerDay = accountSpend !== null && sampleHours && sampleHours > 0
    ? Number(((accountSpend * 24) / sampleHours).toFixed(2))
    : null;

  return {
    spend_usd: Number(usd.toFixed(4)),
    calls,
    // Named so this can't be mistaken for the account's burn. It is one repo's log.
    spend_scope: 'youtube-lead-finder-v1 spend log only — other repos on this account (notably the enrichment backfill) write no log and are NOT included',
    by_task: Object.fromEntries(
      Object.entries(byTask)
        .sort((a, b) => b[1].usd - a[1].usd)
        .map(([k, v]) => [k, { usd: Number(v.usd.toFixed(4)), calls: v.calls }]),
    ),
    // Provider-side truth: every repo, metered or not.
    account_spend_usd: accountSpend,
    account_spend_per_day_usd: accountPerDay,
    account_sample_hours: sampleHours,
    balance_usd: remaining,
    // Prefer the account rate. The finder-log rate reads LOW whenever another repo
    // is doing the spending, which is exactly when an optimistic runway is worst.
    days_of_runway: remaining !== null && accountPerDay !== null && accountPerDay > 0
      ? Number((remaining / accountPerDay).toFixed(1))
      : remaining !== null && usd > 0 ? Number((remaining / usd).toFixed(1)) : null,
    runway_basis: accountPerDay !== null && accountPerDay > 0 ? 'account' : 'finder_log',
    depleted: remaining !== null && remaining <= 0,
  };
}

/**
 * The live `first_touch_pct` pair, worded for the note that teaches how to read it.
 *
 * Both halves can be null and they mean different things, so neither is printed as a
 * number unless it is one: a null `first_touch_pct` is a cycle that emailed nobody (no
 * denominator), and a null `first_touch_pct_prev_7d` is a prior week that emailed
 * nobody. "0%" and "no emails to measure" are not the same reading, and a note that
 * flattened one into the other would be the same class of fault as the frozen figures
 * it replaces. A null block (the query failed) is unknown, not zero.
 */
export function firstTouchReadingText(
  ft: { first_touch_pct: number | null; first_touch_pct_prev_7d: number | null } | null,
): string {
  if (!ft) return 'unavailable this cycle (the query failed), which is not the same as zero';
  const now = ft.first_touch_pct === null
    ? 'no emails to measure this cycle'
    : `${ft.first_touch_pct}% this cycle`;
  const prev = ft.first_touch_pct_prev_7d === null
    ? 'no emails over the prior week either'
    : `${ft.first_touch_pct_prev_7d}% over the prior week`;
  return `${now} against ${prev}`;
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

  // Sending is the point of the pipeline and until now no field here counted it.
  // Both fail soft: a debrief missing its send numbers is bad, one that crashes and
  // writes nothing is worse (that is how 09-17/18/19 went unwritten).
  const sent = await countSentBetween(sinceISO, untilISO).catch(() => null);
  const shelf = await countShelf().catch(() => null);

  // How many of those emails reached somebody new. Same fail-soft rule. See
  // countFirstTouchBetween() for the two cycles that printed a lossless push beside a
  // shelf that had not moved one person, and said nothing.
  const firstTouch = await countFirstTouchBetween(sinceISO, untilISO).catch(() => null);
  // A NOTE THAT SAYS "THIS CYCLE" MUST MEAN THIS CYCLE (2026-10-23). The sentence below
  // teaching how to read the pair froze 2026-10-17's own figures into its wording and
  // re-stated them every cycle after as "1.3% this cycle against 68.7% over the prior
  // week". Six days later the live pair was 0% against 0.3% and the note still printed
  // the old numbers inside a clause that names the current cycle — in the one field
  // whose whole purpose is to stop a reader quoting a figure that describes another day,
  // and read by the debrief agent, which takes these notes as the instructions. It is
  // the only "N% this cycle" left in any note; the rest name their dates. Computed, so
  // it cannot go stale again.
  const firstTouchReading = firstTouchReadingText(firstTouch);

  // Why the shelf moved, when it moved in one statement. Same fail-soft rule as the
  // calls below: a broken query degrades to null, it does not take the debrief down.
  const bulkWrites = await bulkStatusWrites(sinceISO, untilISO).catch(() => null);
  // ...and whether that capped list is the whole write, and whether it moved anybody.
  // See bulkRewriteShape() for the 38,492-row sweep this snapshot reported as 2,578.
  // Same fail-soft rule: both degrade to null rather than taking the debrief down.
  const bulkRollup = await bulkStatusWriteRollup(sinceISO, untilISO).catch(() => null);
  const statusPopulation = await reviewStatusPopulation().catch(() => null);

  // The recovery lane is the only thing still producing new sendable leads while
  // discovery is paused, and no field here counted its output. Same fail-soft rule
  // as the two above. See collectYieldBetween() for what each number means.
  const laneYieldNow = await collectYieldBetween(sinceISO, untilISO).catch(() => null);
  const laneBook = await collectBookDepth().catch(() => null);
  // Per-method lifetime production, PLUS what each one produced inside this cycle. See
  // methodProduction() for the eight weeks of silent 403s this exists to make visible,
  // and for why lifetime alone cannot say who found today's leads.
  const laneMethods = await methodProduction(14, { sinceISO, untilISO }).catch(() => null);
  const laneState = loadState(join(LOGS, 'bloodhound-lane-state.json'));

  // SITE RESOLUTION, THE LANE'S ONE LOAD-BEARING INPUT, WAS NOT IN THIS FILE (2026-10-05).
  //
  // Nine of thirteen collection methods need the creator's own website first, so the
  // no-site rate decides the pass yield, which decides parking, which while discovery is
  // paused is the whole output of the pipeline. The hourly check-in has measured it since
  // 09-04 and alarmed on it correctly — it fired three times across the 10-04 cycle, once
  // per pass, as the rate went 4%, 85%, 91%, 90%. None of that reached the snapshot the
  // debrief is written FROM. `fatal_signatures_today` stays empty because these are
  // observations, not fatals, so a reader working only from this file saw a quiet +1 day
  // and nothing else. The rate had to be hand-counted out of the collect log two cycles
  // running, which is exactly the manual step the 09-04 incident was supposed to end.
  //
  // Read with the SAME function the alarm uses, not a private copy of the parse. Three
  // separate re-implementations of this pass boundary have now gone wrong (09-13, 09-22,
  // 09-28), and a fourth here would be the worst place for it: it would let the report
  // and the alarm disagree about the same pass.
  const laneSite = (() => {
    try {
      const text = readFileSync(join(LOGS, 'bloodhound-collect.log'), 'utf8');
      const att = collectPassAttribution(text);
      if (!att) return null;
      const passes = collectPasses(text);
      return {
        no_site_pct: att.noSitePct,
        no_site: att.noSite,
        sampled: att.sampled,
        rewalk_pct: att.rewalkPct,
        brave_refusals: att.braveRefusals,
        leads_after_refusal: att.leadsAfterRefusal,
        resolved_sampled: att.resolvedSampled,
        resolved_hit: att.resolvedHit,
        // The alarm's own threshold, so the report never invents a second bar.
        collapsed: att.noSitePct >= Number(process.env.AUTOPILOT_NO_SITE_ALARM_PCT ?? 70),
        // WHY A COLLAPSED PASS COLLAPSED (2026-10-10). `collapsed: true` with
        // `brave_refusals: 0` had two readings in the note below and the truth was a
        // third: Brave answers, returns a real candidate, and the strict ownership gate
        // refuses it. Measured on the two passes in this cycle, the gate threw out 107
        // and 109 of 114 and 124 candidates. `cause` is named by the same function the
        // hourly alarm uses, so the report and the alarm cannot disagree.
        brave_searches: att.braveSearches,
        brave_candidates: att.braveCandidates,
        brave_accepted: att.braveAccepted,
        gate_rejected: att.braveGateRejected,
        social_only: att.braveSocialOnly,
        // THE REFUSAL COUNT THAT IS A VOLUME (2026-10-20). `brave_refusals` above is
        // the latched warning line, capped at 1 per pass however many lookups died,
        // and `cause` used to read `search_dead` off it being nonzero. These two are
        // the collect CLI's own per-search counts, so a reader can see whether search
        // actually stopped. On 2026-10-20 they were 2 and 0 against 43 searches and
        // 34 candidates found, and the cause was the ownership gate.
        brave_refused_searches: att.braveRefusedSearches,
        brave_errored_searches: att.braveErroredSearches,
        cause: noSiteCause(att, Number(process.env.AUTOPILOT_NO_SITE_ALARM_PCT ?? 70)),
        pass_summary: passes.length > 0 ? passes[passes.length - 1]!.summary : null,
        // A ZERO-POINT PASS WAS UNREADABLE FROM THIS FILE ALONE (2026-10-08). pass_summary
        // said "Collected 0 contact points from 0/150 leads" and the methods were in fact
        // working: a hand dry-run of five of those leads turned up 21 points, all of them
        // already stored, because the insert counts only rows it really writes. These two
        // fields carry that distinction so the next reader does not have to re-run the
        // lane by hand. Null on passes logged before the collect CLI started writing the
        // line — not zero. See CollectPass in src/recovery/bloodhound-lane.ts.
        methods_found: passes.length > 0 ? passes[passes.length - 1]!.found : null,
        already_on_file: passes.length > 0 ? passes[passes.length - 1]!.alreadyOnFile : null,
        // A DEAD METHOD WAS INVISIBLE FROM THIS FILE (2026-10-11). `09-finra` has
        // produced zero contact points in its life — its API path is retired and
        // answers 404 to every call — and it was the largest error shape in every
        // recent pass. The 10-08 fix put the shapes in the collect log; nothing
        // carried them here, so twelve debriefs read `methods_found` and called the
        // methods healthy. top_method_error names the commonest shape and
        // methods_dead names whatever the collect CLI's breaker took out of the pass.
        // A shape holding most of method_errors is the one to chase. Null before the
        // lines existed, not zero.
        //
        // THE SHAPE STOPPED NAMING ANYTHING THE DAY AFTER THAT FIX (2026-10-12). A shape
        // keeps the hostname, and the host is per-lead, so with `09-finra` retired the
        // newest pass read 458 errors across 432 shapes and a top shape of 4 — under 1%,
        // with 426 shapes in the tail. top_method_cause is the same errors counted with
        // the per-lead tokens dropped, which is the count that can hold a majority:
        // READ IT FIRST, and read top_method_cause_pct before chasing anything. The
        // first pass to carry both lines turned nine shapes into three causes and named
        // two real faults on sight — `28-sitemap: non-HTML content-type` (the fetch gate
        // refused `text/xml`, which is how most sitemaps are served) and `18-rdap: RDAP
        // N` (that method sent no User-Agent, so Cloudflare answered 403 on every lead
        // with a website). Both fixed the same day; errors on a six-lead slice went 9 to
        // 2. Null before the line existed, not zero.
        method_errors: passes.length > 0 ? passes[passes.length - 1]!.methodErrors : null,
        top_method_error: passes.length > 0 ? passes[passes.length - 1]!.topErrorShape : null,
        top_method_error_count: passes.length > 0 ? passes[passes.length - 1]!.topErrorCount : null,
        top_method_cause: passes.length > 0 ? passes[passes.length - 1]!.topErrorCause : null,
        top_method_cause_count: passes.length > 0 ? passes[passes.length - 1]!.topErrorCauseCount : null,
        top_method_cause_pct: passes.length > 0 ? passes[passes.length - 1]!.topErrorCausePct : null,
        method_causes: passes.length > 0 ? passes[passes.length - 1]!.errorCauseShapes : null,
        // AND THE TOP CAUSE CAN BE A CONTENT OUTCOME, WHICH IS NOT A FAULT (2026-10-15).
        // The guidance above says a cause holding most of a pass is one fault to chase.
        // That read failed on its third day: `34-channel-page: page rendered with no
        // outbound links` held 60% of the 03:01Z pass, and that message is the method's
        // own way of saying this creator has no links — it tests for the rendered channel
        // markers first and says something else when they are missing. The real fault was
        // the SECOND row, `17-podcast: iTunes N`, which had climbed 3 -> 12 -> 69 -> 56
        // across the cycle's four passes (Apple meters its Search API per IP and the pass
        // calls it 8-wide, costing 165 of 552 leads), and finding it took a hand grep of
        // the collect log while the snapshot pointed at the benign row.
        //
        // So: method_cause_list is every cause the collect CLI named, largest first, and
        // top_method_fault_cause is the largest one that is not a known content outcome.
        // READ THE FAULT CAUSE FIRST and treat top_method_cause as context. A null fault
        // cause with a large method_errors means the whole pass was content outcomes,
        // which is a picked-over book and not a fault. Both null before the cause line
        // existed, which is unknowable and NOT zero.
        method_cause_list: passes.length > 0 ? passes[passes.length - 1]!.causeList : null,
        top_method_fault_cause: passes.length > 0 ? passes[passes.length - 1]!.topFaultCause : null,
        top_method_fault_cause_count: passes.length > 0 ? passes[passes.length - 1]!.topFaultCauseCount : null,
        top_method_fault_cause_pct: passes.length > 0 ? passes[passes.length - 1]!.topFaultCausePct : null,
        // AND A CAUSE KEY STILL CARRIES THE METHOD NAME, WHICH SPLITS ONE CONDITION INTO
        // MANY (2026-10-22). The 10-12 fix dropped every per-lead token from the key so
        // `fetch failed` became one row with a real count. The method name survived, and it
        // has to — but a condition that stops every method on the same lead then arrives as
        // one row per method, each looking small. On the 2026-10-21 23:00Z pass
        // `cross-domain redirect` was 32 + 21 + 16 + 16 + 16 = 101 of 209 errors under five
        // method names while top_method_fault_cause_pct read 15%, pointing at the largest
        // single row of a condition holding nearly half the pass.
        //
        // So read top_method_fault_condition FIRST and the cause rows as the breakdown.
        // Every count here is a LOWER bound: the CLI names six causes and summarises the
        // rest, and condition_coverage_pct says how much of the pass the roll-up saw.
        top_method_fault_condition: passes.length > 0
          ? passes[passes.length - 1]!.topFaultCondition : null,
        top_method_fault_condition_count: passes.length > 0
          ? passes[passes.length - 1]!.topFaultConditionCount : null,
        top_method_fault_condition_pct: passes.length > 0
          ? passes[passes.length - 1]!.topFaultConditionPct : null,
        method_condition_list: passes.length > 0
          ? passes[passes.length - 1]!.conditionList : null,
        condition_coverage_pct: passes.length > 0
          ? passes[passes.length - 1]!.conditionCoveragePct : null,
        methods_dead: passes.length > 0 ? passes[passes.length - 1]!.deadMethods : null,
      };
    } catch {
      return null;
    }
  })();

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
  // type doc in src/db.ts). A bare term with no colon-prefix is the keyword
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

  const sendLog = orchestratorSendLog(sinceISO, untilISO);
  const cycleDay = cyclePacificDay(sinceISO);
  const siegeUnit = siegeUnitFacts(cycleDay);
  const siegePlan = readSiegePlan(cycleDay);
  const sendPlan = sendPlanHealth(
    siegePlan,

    sent?.total ?? null,
    sendLog.sent_sum,
    siegeUnitVerdict(siegeUnit, sinceISO, untilISO),
    siegeUnit,
    // The plan's own lead list, so the push's event counters can be joined into
    // per-person ones, and the approved list, because the push is only ever asked for the
    // people that covers. See the reconciliation block on siegePushOutcome().
    readSiegePushOutcome(
      sinceISO,
      untilISO,
      readSiegePlanLeadIds(cycleDay),
      readSiegeApprovedLeadIds(cycleDay),
    ),
  );
  // The fleet's own day-over-day move, which no snapshot carried until 2026-10-15 —
  // see FleetFacts. Both reads are filesystem-only and degrade to nulls.
  const fleet = fleetFacts(
    siegePlan,
    priorSendPlan(pacificDate(new Date(sinceMs))),
    readInboxGateState(),
    readBandGateState(),
    // Only a push that ran INSIDE this cycle can be the push the plan post-dates.
    // `push_unit_result` is null unless that is true (see siegeUnitVerdict), so this is
    // null on a weekend rather than a stale weekday stamp.
    sendPlan.push_unit_result !== null ? sendPlan.unit_last_started : null,
    // The band gate's own moves inside this cycle. Same window as everything else.
    { sinceISO, untilISO },
  );

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

  // Fetched before the snapshot literal because recovery_budget prices its
  // projection off the same account figures, and both must report one reading.
  const openrouter = await openRouterHealth(sinceISO, untilISO);

  // Whether this cycle's bulk rewrites were a sample, a sweep, or a real migration.
  // Pure arithmetic over the three reads above plus yesterday's snapshot.
  const bulkRewrite = bulkRewriteShape(
    bulkRollup,
    bulkWrites,
    statusPopulation,
    priorReviewStatusPopulation(pacificDate(new Date(sinceMs))),
  );

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
      // `approved_hold_now` is a LIVE count, so parked_today is really "the gain from
      // cycle start until this gatherer ran". The timer fires 20 min after the
      // boundary and that bleed is immaterial, but a re-run hours later is not: on
      // 2026-10-01 a re-run at 07:46Z read 247 against the 203 the 07:20Z run saw,
      // because an Apify batch was still flipping leads. Same shape as the
      // OpenRouter double-run repaired on 09-30 — a figure whose measurement window
      // silently depends on when you asked. So say when it was asked.
      // 30 min, not an hour: the timer fires at 20 and today's re-run at 32 had
      // already drifted 203 -> 247. The line has to sit just above the scheduled
      // run or it flags nothing that matters.
      measured_minutes_after_cycle_end: Math.round((nowMs - Date.parse(untilISO)) / 60_000),
      counts_post_cycle_arrivals: nowMs - Date.parse(untilISO) > 30 * 60_000,
      // READ THIS BEFORE EXPLAINING A NEGATIVE parked_today (2026-10-14). Sending does
      // not move a lead out of approved_hold, so the send path can never be the reason
      // the shelf shrank, however many emails went out. A bulk reclassification can, and
      // did: the shelf fell 800 this cycle because an ICP audit flipped 881 leads to
      // `rejected` in one statement at 16:26Z, 720 of them already emailed, and no
      // instrument could show it — the diagnosis took hand SQL across four repos and a
      // rubric found in a backups folder. Every row here is one second that carries 50+
      // status rows, which per-lead work cannot produce, with the leading `[tag]` the
      // writer stamped into `notes`. An empty array means nothing was rewritten in bulk,
      // so a shelf move has to be explained by arrivals and departures one lead at a
      // time. Null means the query failed, which is not the same as empty. See
      // bulkStatusWrites() in src/db.ts for why the destination is reported and the
      // origin is not.
      //
      // READ bulk_rewrite BEFORE QUOTING ANY NUMBER OUT OF THIS LIST (2026-10-19). The
      // list is capped at the eight largest seconds, which is the whole write when one
      // UPDATE did it and a sample when a paged writer did. This cycle the weekly
      // subscriber-floor sweep rewrote 38,492 rows into `below_threshold` across 155
      // clusters in 154 seconds and the list printed 2,578 of them — 6.7% — with
      // `left_the_send_queue: true` and 128 carrying an email, which is exactly the shape
      // of a 2,578-lead demotion and was not one. Every one of those leads was already
      // `below_threshold`.
      bulk_status_writes: bulkWrites,
      // rows_in_window is the real size; truncated says the list above is a sample;
      // shape separates one statement from a paged sweep by cluster count; moved answers
      // whether the destination population actually grew. See bulkRewriteShape().
      bulk_rewrite: bulkRewrite,
      // The baseline `moved` needs tomorrow. One GROUP BY, no filter. Null means the
      // query failed, which is not the same as an empty table.
      review_status_population: statusPopulation,
    },
    // Emails LOADED into a SmartLead campaign this cycle (see countSentBetween). Null
    // means the query failed, not that nothing was sent.
    sent_today: {
      total: sent?.total ?? null,
      by_review_status: sent?.by_review_status ?? null,
      orchestrator_log: sendLog,
      // WHETHER ANY OF THOSE EMAILS REACHED SOMEBODY NEW (2026-10-17). A lossless push
      // and a day that touched nobody new printed identically for two cycles running:
      // 160 emails then 82, nothing failed, nothing refused, and the shelf did not move
      // one person. See countFirstTouchBetween() in src/db.ts. Null means the query
      // failed, which is not the same as nobody new.
      first_touch: firstTouch,
      note:
        'Loaded into a SmartLead campaign, counted from leads.outreach_processed_at. ' +
        'SmartLead sends on its own schedule (Mon-Thu 09:00-15:00 ET), so this is not ' +
        'delivered volume — for that run youtube-email-outreach-v1/scripts/sl-sent-per-day.ts. ' +
        'orchestrator_log covers only sends this repo launched; a batch driven by hand from ' +
        'the email repo shows up in total and not there, and the difference is the point. ' +
        'READ first_touch BEFORE CALLING A LOSSLESS PUSH A GOOD DAY (2026-10-17): total ' +
        'counts emails and cannot say whether any of them reached a person who had never ' +
        'heard from us. On 2026-10-15 and 10-16, 242 emails went out, both pushes lost ' +
        'nothing, and between them they reached ONE new person — every other email was a ' +
        'repeat offer, and the shelf printed exactly 5,138 ready and 1,663 already-sent on ' +
        'three consecutive mornings. first_touch_pct against first_touch_pct_prev_7d is the ' +
        'reading: ' + firstTouchReading + '. It is not a fault — ' +
        'repeat offers are deliberate since 2026-10-07 — but it is a different day from the ' +
        'one total describes, and the pair of them is what says which. Read it beside ' +
        'send_plan.waiting_for_a_slot: Siege fills slots by tier and the Whale tier ran out ' +
        'of never-emailed people on the 10-13 push, so its re-offer queue takes every slot ' +
        'while ready lower-tier people wait. shelf_first_touch is how many first touches ' +
        'came off approved_hold, which is the only number that drains the shelf.',
    },
    // Why the cycle sent what it sent. sent_today counts emails; this says whether a
    // batch was written and left standing. See the block comment on siegePlanFacts().
    send_plan: { ...sendPlan, fleet },
    // What the Bloodhound recovery lane produced this cycle. Its collect pass is the
    // pipeline's only lead-producing process while discovery is paused, so a debrief
    // that can't see its yield can't tell a picked-over book from a broken lane.
    // `email_points` is the number that matters: only an email flips a lead to
    // approved_hold. A null block means the queries failed, not that yield was zero.
    //
    // The `free_*` fields are this lane's own work and the `*_added` totals are not:
    // the paid Apify lane writes into the same table. See collectYieldBetween() for
    // the 2026-10-01 cycle that made the difference load-bearing.
    recovery_lane: {
      contact_points_added: laneYieldNow?.points ?? null,
      email_points_added: laneYieldNow?.email_points ?? null,
      leads_with_new_points: laneYieldNow?.leads_with_points ?? null,
      leads_with_new_email: laneYieldNow?.leads_with_email_points ?? null,
      contact_points_prev_7d: laneYieldNow?.points_prev_7d ?? null,
      email_points_prev_7d: laneYieldNow?.email_points_prev_7d ?? null,
      free_contact_points_added: laneYieldNow?.free_points ?? null,
      free_email_points_added: laneYieldNow?.free_email_points ?? null,
      free_leads_with_new_points: laneYieldNow?.free_leads_with_points ?? null,
      free_leads_with_new_email: laneYieldNow?.free_leads_with_email_points ?? null,
      free_contact_points_prev_7d: laneYieldNow?.free_points_prev_7d ?? null,
      free_email_points_prev_7d: laneYieldNow?.free_email_points_prev_7d ?? null,
      paid_contact_points_added: laneYieldNow?.paid_points ?? null,
      paid_email_points_added: laneYieldNow?.paid_email_points ?? null,
      paid_leads_with_new_email: laneYieldNow?.paid_leads_with_email_points ?? null,
      paid_contact_points_prev_7d: laneYieldNow?.paid_points_prev_7d ?? null,
      collect_book_pool: laneBook?.pool ?? null,
      collect_book_stranded: laneBook?.stranded ?? null,
      collect_laps: laneState.collectLaps ?? null,
      last_collect_at: laneState.lastCollectAt ?? null,
      last_verify_at: laneState.lastVerifyAt ?? null,
      site_resolution: laneSite,
      // A METHOD CAN GO COMPLETELY DEAD AND EVERY OTHER FIELD HERE STAYS NORMAL
      // (2026-10-12). `18-rdap` wrote 336 points on 18-19 Aug, the lane's eighth-biggest
      // producer, and nothing since (53 days when this was written): rdap.org went behind Cloudflare and
      // the method sends no User-Agent, so it has been collecting 403 challenge pages at
      // one futile 15-second request per lead ever since. methods_quiet is every free
      // method that has produced before and produced nothing in 14 days — the cheapest
      // detector for the class, because the pass footer, the error tally and the breaker
      // were all blind to it. QUIET IS NOT BROKEN: a method whose niche is rare in the
      // current slice goes quiet honestly. It means look, not fix.
      methods: laneMethods,
      methods_quiet: laneMethods ? laneMethods.filter((m) => m.quiet) : null,
      // WHICH METHODS ACTUALLY FOUND THIS CYCLE'S LEADS (2026-10-13). `methods` above
      // ranks by silence and `points` is a lifetime total, so neither can answer the
      // question a reader has every morning: what produced today, and did yesterday's
      // fix take? On the first cycle after the sitemap and RDAP fixes shipped, the answer
      // was that `28-sitemap` wrote 16 of 44 points, 16 of 23 email addresses and every
      // one of the day's 4 parks, while `18-rdap` produced for the first time in 55 days.
      // Both readings took hand SQL. This list is that query, ranked by email addresses
      // first because an address is the only point kind that can park anybody — one
      // creator with a mailto on every page writes dozens of plain points alone.
      methods_producing: laneMethods
        ? laneMethods
          .filter((m) => (m.points_in_cycle ?? 0) > 0)
          .sort((a, b) =>
            (b.email_points_in_cycle ?? 0) - (a.email_points_in_cycle ?? 0)
            || (b.points_in_cycle ?? 0) - (a.points_in_cycle ?? 0)
          )
        : null,
      note:
        'Contact points written in the cycle, from leads.contact_points.created_at. ' +
        'READ THE free_* FIELDS AS THIS LANE: the totals also contain the paid Apify ' +
        'lane, which writes into the same table, and on 2026-10-01 that was 701 of 742 ' +
        'points while the free pass found 6 addresses. ' +
        'COUNT PEOPLE, NOT ADDRESSES: free_leads_with_new_email is the number that ' +
        'predicts parking, because one creator with a mailto on every page writes dozens of ' +
        'email points alone. On 2026-10-02 free_email_points_added was 32 and ' +
        'free_leads_with_new_email was 2, with 31 of the 32 from one lead; both flipped and ' +
        'parked_today was 2. free_leads_with_new_points counts every kind of point, so it is ' +
        'the wrong denominator for addresses (it read 12 that day). ' +
        'A lap is one full walk of collect_book_pool; past lap 1 most leads are re-walks, so a ' +
        'low yield at a high lap count is a picked-over book rather than a fault, so read it ' +
        'against free_contact_points_prev_7d. ' +
        'READ site_resolution BEFORE BLAMING A PICKED-OVER BOOK: it describes the newest ' +
        'completed collect pass, nine of thirteen collection methods need the creator website ' +
        'first, and collapsed:true means the lane had almost no input that pass whatever the ' +
        "book's state. brave_refusals IS NOT A SPENT PLAN — READ brave_refused_searches " +
        'INSTEAD (2026-10-20): the first is the latched all-keys-refused warning, which ' +
        'prints at most once per pass and fires on a single transient 429 against a funded ' +
        'plan, and cause named search_dead off it being nonzero. On 2026-10-20 that ' +
        'reported a spent plan, and "43 of 43 leads ran with no web search at all", about a ' +
        'pass whose own footer on the next line counted 2 refused searches out of 43 and 34 ' +
        'candidate sites found — the ownership gate threw out 33 of those 34, and Brave ' +
        'credit could not have bought one extra site. search_dead now requires refusals to ' +
        'hold most of the searches (searchDied() in src/recovery/bloodhound-lane.ts). ' +
        'brave_refused_searches and brave_errored_searches are the real volumes, and they ' +
        'are null, not zero, for a pass logged before 2026-10-05. ' +
        'READ site_resolution.cause RATHER THAN GUESSING AT A COLLAPSED PASS (2026-10-10): ' +
        'collapsed with 0 refusals used to be read as "either a resolution fault or a ' +
        'site-less slice" and was in fact a third thing — Brave answers, returns a real ' +
        'candidate, and the strict ownership gate refuses it because the page cannot be ' +
        'tied to that creator (the gate is deliberate, 2026-08-18 audit). The two passes in ' +
        'the 2026-10-10 cycle ran 149 and 150 searches with ZERO refusals, found candidates ' +
        'for 114 and 124, and kept 8 and 15: the gate threw out 107 and 109. The hourly ' +
        'alarm filed both `unexplained` and said "check the collect log before spending ' +
        'anything" while the log held the answer one line under the footer it was reading. ' +
        'cause is one of search_off (a configuration fault, free to fix), search_dead (costs ' +
        'money), ownership_gate or no_candidates (NEITHER is buyable — Brave credit changes ' +
        'nothing), resolution_ok, or unmeasured (the pass predates the counters, which means ' +
        'unknowable and NOT zero). brave_searches/brave_candidates/brave_accepted/' +
        'gate_rejected/social_only are the arithmetic behind it, named by the same function ' +
        'the alarm uses so the two cannot disagree. ' +
        'AND READ site_resolution.methods_found BEFORE CALLING A ZERO-POINT PASS DEAD: the ' +
        'insert counts only rows it really wrote, so a lead whose points are all already ' +
        'stored scores 0 and reads identically to a lead the methods found nothing on. On ' +
        '2026-10-08 pass_summary said "0 contact points from 0/150 leads" and the methods ' +
        'were fine — a dry-run of five of those leads turned up 21 points, every one already ' +
        'on file. methods_found>0 with 0 points is a full re-walk of a picked-over book and ' +
        'is not a fault; methods_found:0 is the shape worth chasing. Both are null for passes ' +
        'logged before 2026-10-08, which means unknowable, NOT zero. ' +
        'READ top_method_cause, NOT top_method_error, WHEN method_errors IS LARGE ' +
        '(2026-10-12): an error shape keeps the hostname and the hostname is per-lead, so ' +
        'the day after the breaker retired the one shape big enough to read, a pass logged ' +
        '458 errors across 432 shapes with a top shape of 4 — under 1% of them — and 426 ' +
        'shapes in the unnamed tail. The cause key drops the per-lead tokens, so ' +
        '"fetch failed" and "cross-domain redirect" each become one row with a real count; ' +
        'top_method_cause_pct is the share it holds, and a cause holding most of a pass is ' +
        'ONE fault to chase while a flat spread is the web being the web. The first pass ' +
        'carrying both lines collapsed nine shapes into three causes and named two real ' +
        'faults on sight: the fetch gate was refusing text/xml, which is how most sitemaps ' +
        'are served, so 28-sitemap (the method that finds the contact and team pages a ' +
        'homepage never links) threw every one away unread; and 18-rdap sent no ' +
        'User-Agent, so Cloudflare answered 403 for every lead with a website and the ' +
        'method had never once read a registration record. Both fixed 2026-10-12. Null ' +
        'before the line existed, NOT zero. ' +
        'BOTH OF THOSE FIXES PAID OFF INSIDE ONE CYCLE AND methods COULD NOT SHOW IT, ' +
        'WHICH IS WHY methods_producing EXISTS (2026-10-13): methods ranks by silence and ' +
        'its points field is a lifetime total dominated by 34-channel-page, so the morning ' +
        'question (what produced today, and did yesterday fix anything) took hand SQL. ' +
        'methods_producing is that query — every method with a point in the window, ranked ' +
        'by email addresses first, because an address is the only point kind that can park ' +
        'anybody. On 2026-10-13 it read 28-sitemap 16 points / 16 addresses / 5 people, ' +
        'carrying every one of the day\'s 4 parks, and 18-rdap producing for the first time ' +
        'in 55 days. points_in_cycle/email_points_in_cycle/leads_in_cycle are null, not 0, ' +
        'on a snapshot written without a window: unknown and measured-as-nothing differ. ' +
        'AND READ top_method_fault_cause BEFORE CHASING top_method_cause (2026-10-15): the ' +
        'largest cause can be a deliberate content outcome. That day it was ' +
        '"34-channel-page: page rendered with no outbound links" at 60% of the pass, which ' +
        'is that method saying the creator genuinely has no links (it checks the rendered ' +
        'channel markers first and emits a different message when the page did not render), ' +
        'so the 10-12 rule above pointed at a non-fault for three days. The real fault was ' +
        'the second row, "17-podcast: iTunes N", which had climbed 3 -> 12 -> 69 -> 56 ' +
        'across that cycle\'s four passes: Apple meters its Search API per IP, the collect ' +
        'pass calls it 8-wide, and 165 of 552 leads never got the method at all. Reading it ' +
        'took a hand grep of the collect log. method_cause_list is now every cause the ' +
        'collect CLI named, largest first, and top_method_fault_cause is the largest one ' +
        'that is not a known content outcome — READ THAT FIRST. A null fault cause beside a ' +
        'large method_errors means the whole pass was content outcomes, which is a ' +
        'picked-over book and not a fault. Both null before the cause line existed, which ' +
        'is unknowable and NOT zero. ' +
        'AND READ top_method_fault_condition BEFORE top_method_fault_cause (2026-10-22): a ' +
        'cause key is "<method>: <condition>", so one condition that stops every method on ' +
        'the same lead arrives as one row per method and each row looks small. On the ' +
        '2026-10-21 23:00Z pass "cross-domain redirect" was 32 + 21 + 16 + 16 + 16 = 101 of ' +
        '209 errors under five method names, and top_method_fault_cause_pct read 15% for ' +
        'the largest single row of a condition holding nearly half the pass — the 10-12 ' +
        'lesson (a key that keeps a per-lead token splits one fault into many) one level up, ' +
        'because the method name is per-method and the condition is not. ' +
        'method_condition_list is the roll-up, largest first, and the cause rows are its ' +
        'breakdown. EVERY COUNT THERE IS A LOWER BOUND: the CLI names six causes and ' +
        'summarises the rest, so condition_coverage_pct says how much of the pass the ' +
        'roll-up could see. A condition is only benign when every method reporting it is. ' +
        'The same cycle fixed the reason the status was ' +
        'unreadable: both error condensers collapse digits to N, so every bare HTTP status ' +
        'in the lane now carries a word beside it (httpReason() in the email repo) and a ' +
        'future "iTunes N" reads "iTunes N rate-limited". ' +
        'A climbing collect_book_stranded is the real fault ' +
        'signal (a selector gap has reopened). Emails here are unverified: the verify pass ' +
        'decides which ones flip to approved_hold.',
    },
    // The shelf: parked, researched, one command from a written email. The largest
    // thing in the pipeline since 2026-09-16 and, until now, counted only by hand.
    shelf: {
      ready_to_write: shelf?.ready_to_write ?? null,
      bundled: shelf?.bundled ?? null,
      already_sent: shelf?.already_sent ?? null,
      approved_hold_total: shelf?.total ?? null,
      bundled_pct: shelf && shelf.total > 0 ? Math.round((1000 * shelf.bundled) / shelf.total) / 10 : null,
      note:
        'READ ready_to_write AS THE INVENTORY, NOT approved_hold_total. A sent lead stays ' +
        'in approved_hold, so the total also counts already_sent people who have been ' +
        'written to and must never be written to again. On 2026-10-04 that was 548 of ' +
        '7,591, found only by a hand-written query. The two figures diverge by every email ' +
        'the send path pushes (roughly 800 a week at the 200/day ramp across four delivery ' +
        'days) while the recovery lane adds one or two a day, so quoting the total overstates ' +
        'the weeks of email in the bank and the overstatement grows. bundled_pct measures ' +
        'enrichment against the same total on purpose: a sent lead was enriched too.',
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
    discovery_methods_health: discoveryMethodsHealth(sinceMs, Date.parse(untilISO), byMethod, byMethodPitchable),
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
    openrouter_today: openrouter,
    recovery_budget: recoveryBudgetHealth(sinceISO, untilISO, openrouter),
    youtube_key_pool: await youtubeKeyPoolHealth(),
    supply_health: supplyHealth,
    halt: haltHealth(sinceMs, Date.parse(untilISO)),
    fatal_signatures_today: fatalSignaturesToday(sinceMs),
    missing_debriefs: missingDebriefs(date),
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

// ONLY WHEN THIS FILE IS THE THING BEING RUN (2026-10-19).
//
// `main()` used to fire on import, and this module is imported by
// debrief-data.selftest.ts. So every selftest run quietly started a second full gatherer
// pass — dozens of Postgres queries, a 66-key YouTube probe, a systemd sweep — and whether
// it got far enough to overwrite `logs/autopilot-debrief-<date>.json` came down to whether
// the selftest's `process.exit` won the race. It usually did, which is why this went
// unnoticed. It lost once today: importing the module to exercise one pure function
// rewrote the day's snapshot 39 minutes past the cycle boundary, and the only reason that
// was harmless is that `counts_post_cycle_arrivals` says when it was measured.
//
// The one real caller passes this file as argv[1] (`npx tsx .../debrief-data.ts` in
// debrief.sh), so matching on the entry file's name is enough and needs no ESM/CJS
// `import.meta` branch — tsx compiles this to CJS.
const entryFile = process.argv[1] ?? '';
if (/(^|[\\/])debrief-data\.(ts|js|cjs|mjs)$/.test(entryFile)) {
  main().catch((e) => { console.error(`[debrief-data] fatal: ${e instanceof Error ? e.stack : e}`); process.exit(1); });
}
