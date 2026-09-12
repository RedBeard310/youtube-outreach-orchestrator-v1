// Bloodhound recovery lane (wired 2026-08-23).
//
// The pipeline auto-tags every score>=6 email-failed lead into the
// needs_contact lane (promote-verified-to-hold.ts auto-sweep), then NOTHING
// worked that lane: Bloodhound (the free multi-method contact-point collector
// in youtube-email-outreach-v1) ran once by hand on 2026-08-18/19, recovered
// 686 emails across 644 leads, verified only 50, and was never scheduled.
// On 2026-08-23 the pool held 3,290 needs_contact/no_email_found leads.
//
// Measured evidence behind this lane:
//   - verify-only pass on the 152 leads with discovered-but-unflipped emails:
//     70 flipped to approved_hold for 109 ZeroBounce credits (46% hit rate).
//   - free collection probe on 30 untouched leads: 8 produced contact points,
//     9 emails among 28 points (~0.3 emails/lead on the general pool).
//
// This module cadence-gates two Bloodhound passes inside the campaign's fade
// pivot: a DETACHED free collection batch (no session time spent) and an
// awaited verify-only pass bounded by the number of leads that actually have
// unverified email points. Credits are spent only on unverified email points;
// the verify selector only picks leads that have them.
import { spawn } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, statSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { query } from 'pipeline-db';

/** Where the collect walk has got to in the current lap. See COLLECT_IDS_SQL. */
export interface CollectCursor {
  tier: number;
  disc: string;
  id: string;
}

export interface LaneState {
  lastCollectAt?: string;
  lastVerifyAt?: string;
  /** PID of a detached collect child, if one might still be running. */
  collectPid?: number;
  /** When the collect child spawned, so the pid guard expires on PID reuse. */
  collectStartedAt?: string;
  /** Position in the current collect lap; absent means "start a new lap". */
  collectCursor?: CollectCursor;
  /** How many full laps of the untouched pool the collect pass has walked. */
  collectLaps?: number;
  /** Cursor and lap count as they stood BEFORE the last dispatched batch, held
   *  until that child is seen to have finished. See rewindIfTruncated.
   *  `lapComplete` records whether that batch came up short, i.e. whether it
   *  closed the lap — a lap-closing batch must never be rewound. See
   *  `rewindWaiver`. Absent on state written before 2026-09-11. */
  collectResume?: { from: CollectCursor | null; laps: number; lapComplete?: boolean };
  /** Consecutive rewinds after a TRUNCATED pass, so a child that dies every
   *  single time cannot pin the walk on one batch forever (the 2026-08-27
   *  walking-in-place failure). */
  collectRewinds?: number;
  /** Consecutive rewinds after a SEARCH-DEAD pass. Counted separately from
   *  `collectRewinds` on purpose — see MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS. */
  collectSearchDeadRewinds?: number;
}

export const LANE_STATE_PATH = join('logs', 'bloodhound-lane-state.json');

export function isDue(
  state: LaneState,
  key: 'lastCollectAt' | 'lastVerifyAt',
  nowMs: number,
  intervalHours: number,
): boolean {
  const ts = state[key];
  if (!ts) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return nowMs - t >= intervalHours * 3_600_000;
}

export function loadState(path = LANE_STATE_PATH): LaneState {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as LaneState;
  } catch {
    return {};
  }
}

export function saveState(state: LaneState, path = LANE_STATE_PATH): void {
  mkdirSync('logs', { recursive: true });
  writeFileSync(path, JSON.stringify(state) + '\n');
}

export const COLLECT_LOG_PATH = join('logs', 'bloodhound-collect.log');

/** Append-mode fd for the detached collect child's output. Falls back to
 *  'ignore' if the log can't be opened, so logging can never stop the lane. */
function collectLogFd(): number | 'ignore' {
  try {
    mkdirSync('logs', { recursive: true });
    return openSync(COLLECT_LOG_PATH, 'a');
  } catch {
    return 'ignore';
  }
}

/** Did the last collect pass in the log run to completion?
 *
 *  WHY THIS EXISTS (2026-09-06). The collect child is detached and never reports
 *  back, so the cursor advances at dispatch: a batch that dies is skipped until
 *  the next lap. That was an acceptable trade while the only dispatcher was the
 *  always-on campaign service. It stopped being acceptable the moment the lane
 *  got its own `recovery-lane.service`, a Type=oneshot unit: systemd's default
 *  KillMode is `control-group`, so when ExecStart exits the unit deactivates and
 *  everything left in its cgroup is killed — detached or not. Measured on the
 *  two timer-dispatched passes of 2026-09-06: 6 and 13 leads of 150 reached the
 *  log before the child died ~30s in, and the cursor had already stepped over
 *  all 300. The unit now carries `KillMode=process`, but a killed child is not
 *  special: an OOM, a reboot or a `systemctl stop` does the same thing, and the
 *  damage is silent every time.
 *
 *  So read the lane's OUTPUT rather than trusting the dispatch. The email repo's
 *  CLI prints exactly one completion line per pass; if the newest pass header in
 *  the log has no completion line after it, that pass did not finish.
 *
 *  Returns null when the log cannot answer (missing, unreadable, no header yet),
 *  which is treated as "assume it finished" — an unknown must never rewind. */
export function lastCollectPassFinished(
  path = COLLECT_LOG_PATH,
  tailBytes = 512_000,
): boolean | null {
  try {
    const fd = openSync(path, 'r');
    try {
      const size = statSync(path).size;
      const start = Math.max(0, size - tailBytes);
      const buf = Buffer.alloc(Math.min(size, tailBytes));
      readSync(fd, buf, 0, buf.length, start);
      const tail = buf.toString('utf8');
      const header = tail.lastIndexOf('\nBloodhound: ');
      if (header < 0) return null;
      return tail.lastIndexOf('\nCollected ') > header;
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** Did the last collect pass run with website resolution DOWN?
 *
 *  WHY THIS EXISTS (2026-09-09). Nine of the collector's ten methods need the
 *  creator's own website, and the website comes from Brave Search, which sits on
 *  a plan with a monthly spending cap. When the cap is hit every key answers
 *  `402 Usage limit exceeded` and resolution stops. The pass still "completes" —
 *  it walks all 150 leads, finds almost nothing, and the cursor steps over every
 *  one of them. Those leads then wait a FULL LAP before anyone looks at them
 *  again. That is what turned the 2026-09-02 batch widening into 71 parks
 *  instead of 627: the leads were not barren, they were never actually searched.
 *
 *  The loud one-line diagnostic added on 2026-09-04 named the cause but nothing
 *  acted on it. Act on it: a pass that ran with a dead search plan did not walk
 *  its batch in any meaningful sense, so rewind exactly as a truncated pass
 *  does. The same rewind cap applies, so a cap that stays hit for days cannot
 *  pin the walk in place forever.
 *
 *  Returns null when the log cannot answer, which is treated as "search was
 *  fine" — an unknown must never rewind. */
export function lastCollectPassSearchDead(
  path = COLLECT_LOG_PATH,
  tailBytes = 512_000,
): boolean | null {
  try {
    const fd = openSync(path, 'r');
    try {
      const size = statSync(path).size;
      const start = Math.max(0, size - tailBytes);
      const buf = Buffer.alloc(Math.min(size, tailBytes));
      readSync(fd, buf, 0, buf.length, start);
      const tail = buf.toString('utf8');
      const header = tail.lastIndexOf('\nBloodhound: ');
      if (header < 0) return null;
      // Matches the searchBrave() all-keys-refused line, whatever the status.
      return /Brave Search API key\(s\) refused/.test(tail.slice(header));
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** How many leads the last collect pass walked, and how many of them produced at
 *  least one contact point, read off the CLI's own completion line
 *  ("Collected 268 contact points from 53/111 leads.").
 *
 *  Exists because "Brave refused" and "the pass did no work" are NOT the same
 *  statement, and the 2026-09-10 rewind rule treated them as one. Returns null
 *  when the log cannot answer, which every caller must read as "no evidence",
 *  never as "zero". */
export function lastCollectPassYield(
  path = COLLECT_LOG_PATH,
  tailBytes = 512_000,
): { walked: number; withPoints: number } | null {
  try {
    const fd = openSync(path, 'r');
    try {
      const size = statSync(path).size;
      const start = Math.max(0, size - tailBytes);
      const buf = Buffer.alloc(Math.min(size, tailBytes));
      readSync(fd, buf, 0, buf.length, start);
      const tail = buf.toString('utf8');
      const header = tail.lastIndexOf('\nBloodhound: ');
      if (header < 0) return null;
      const m = /\nCollected \d+ contact points from (\d+)\/(\d+) leads\./.exec(tail.slice(header));
      if (!m) return null;
      const withPoints = Number(m[1]);
      const walked = Number(m[2]);
      if (!Number.isFinite(walked) || walked <= 0) return null;
      return { walked, withPoints };
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** Hit rate at or above which a SEARCH-DEAD pass counts as a real walk and the
 *  cursor is allowed to advance. Below it the pass is treated as "nobody looked
 *  at these leads" and rewound.
 *
 *  WHY (2026-09-11). The search-dead rewind was written on the premise that
 *  "every lead ahead of the cursor is just as unsearchable as the one under it",
 *  so holding the cursor costs nothing. Measured against a live Brave outage
 *  that premise is half wrong: nine methods need a website, but the FREE
 *  channel-page route resolves one for a large share of leads with no Brave call
 *  at all. Through this cycle's outage the lane still collected from 148/150,
 *  143/150, 40/150 and 53/111 leads. Holding the cursor on a pass like that
 *  costs the entire rest of the book — and Brave's cap is monthly, so "wait for
 *  it to come back" is up to three weeks of nothing.
 *
 *  10% is deliberately far below the lane's healthy 85-95% and below every
 *  degraded pass on record, so this waiver only fires when resolution is
 *  genuinely producing something. A pass that truly collects nothing still
 *  rewinds, which is the case the rule was written for. The relative-fall alarm
 *  in `checkin.ts` (`bloodhound_collect_yield_degraded`) is the observation half
 *  of the same measurement and is unchanged. */
export const SEARCH_DEAD_REWIND_YIELD_FLOOR_PCT = 10;

/** Why a rewind is being skipped even though the previous pass failed its batch,
 *  or null to go ahead and rewind.
 *
 *  WHY `lap_complete` (2026-09-11, and this is the one that actually bit). A
 *  rewind exists to recover leads stranded BEHIND an advanced cursor. A batch
 *  that came up short did not strand anybody: it closed the lap, the cursor was
 *  cleared rather than advanced, and every lead in it is still in the pool, so
 *  the very next pass re-selects it from the top. Rewinding that case pins the
 *  lane on the book's short tail instead.
 *
 *  That is exactly what ran for the 24h to 2026-09-11T07:00Z. The tail batch was
 *  tier 1 (no external links) and unsearchable with Brave capped, so three
 *  consecutive passes re-walked the SAME 58 leads and logged
 *  "Collected 0 contact points from 0/58 leads" three times, while 3,737 leads
 *  sat in `needs_contact` and the day parked 8. The 48-deep search-dead budget
 *  meant it would have done that for about twelve more days. */
export function rewindWaiver(
  reason: string | null,
  resume: { lapComplete?: boolean } | undefined,
  passYield: { walked: number; withPoints: number } | null,
  priorSearchDeadRewinds = 0,
): string | null {
  if (!reason) return null;
  if (resume?.lapComplete) return 'lap_complete';
  if (reason === 'previous_pass_search_dead' && passYield) {
    const pct = (passYield.withPoints / passYield.walked) * 100;
    if (pct >= SEARCH_DEAD_REWIND_YIELD_FLOOR_PCT) return 'yield_held';
    // A re-walk that produced nothing is the end of the evidence, not the start
    // of it. WHY (2026-09-12): the pass that just ran was ITSELF a re-walk of
    // the batch before it (priorSearchDeadRewinds >= 1). It walked the same
    // leads, with the same search plan still refusing under the same MONTHLY
    // cap, and collected zero a second time. Nothing about a third attempt can
    // differ, so the 48-deep budget below just re-walks one batch for twelve
    // days. Measured on 2026-09-11/12: passes three and four of the cycle were
    // byte-identical 150-lead batches, both "Collected 0 contact points from
    // 0/150 leads", and the budget had 46 more of those queued up.
    //
    // This waives only the SECOND consecutive zero. The first rewind still
    // happens, which is what preserves the case the rewind was written for: a
    // pass whose child was cut off logs no completion line, gets one re-walk,
    // and that re-walk is real work. And a pass that collected anything at all
    // is handled by the yield floor above, not here.
    if (passYield.withPoints === 0 && priorSearchDeadRewinds >= 1) {
      return 'rewalk_produced_nothing';
    }
  }
  return null;
}

/** Maximum times in a row a TRUNCATED pass may be re-walked. Past this the walk
 *  moves on regardless: re-running one batch forever is the worse failure. */
export const MAX_CONSECUTIVE_REWINDS = 3;

/** Maximum times in a row a SEARCH-DEAD pass may be re-walked. Deliberately far
 *  larger than the truncated cap, because the two failures need opposite
 *  patience.
 *
 *  WHY (2026-09-10). Both reasons shared the 3-deep budget above, and that made
 *  the lane behave at its worst under exactly the outage the search-dead rewind
 *  was written for. Brave's cap is MONTHLY, so a re-run does not fix it: the
 *  lane rewound three times, re-walking one batch it could not search, then hit
 *  the cap, reset the counter to 0 and advanced 150 leads blind — and then did
 *  the whole thing again. Measured over 2026-09-09/10: leads producing any
 *  contact point fell 148/150 to 40/150 and 53/111, and a full lap closed with
 *  its tail walked at a 27% hit rate. Three wasted re-walks AND a blind advance,
 *  every cycle.
 *
 *  A truncated pass MIGHT succeed on a re-run, so it gets a small budget: a
 *  child that dies every time must not pin the walk. A search-dead pass will
 *  not succeed on a re-run, but walking on does not help either — every lead
 *  ahead of the cursor is just as unsearchable as the one under it. So holding
 *  the cursor costs nothing while resolution is down, and it preserves the one
 *  invariant that matters here: a lead is marked walked only once somebody
 *  actually searched for it. The re-walk doubles as the probe that notices Brave
 *  coming back, so the lane resumes by itself with no diagnosis.
 *
 *  It is still a cap and not `Infinity`, because the detector could misfire and
 *  a lane pinned forever with no error is the failure this whole file exists to
 *  prevent. 48 is about twelve days at the 6h collect interval; a search plan
 *  still refusing after twelve days is a spend decision that has been in the
 *  observations log every hour since it started. */
export const MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS = 48;

/** How long a detached collect child may live before a matching PID is assumed
 *  to be OS reuse. Scales with the batch so the guard cannot drift out of date
 *  behind a changed batch size; never shorter than the original flat 2h. */
export function staleCollectAfterMs(collectBatch: number): number {
  return Math.max(2 * 3_600_000, collectBatch * 90_000);
}

function pidAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** needs_contact leads with no email yet and NO contact points collected.
 *
 *  WALK THE BOOK, DON'T WALK IN PLACE (2026-08-27). The only way a lead left
 *  this pool was to GAIN a contact point, so every lead the collector fails on
 *  stayed at the front of the queue and was handed back on the next cadence,
 *  forever. Measured over the lane's first four days: 4 collect passes a day,
 *  40 leads each, and the pool sat at 3,315 the whole time while
 *  `contact_points` gained 46 rows on 08-23, 2 on 08-24, 0 on 08-25, 1 on 08-26
 *  and 0 on 08-27. It was re-running one fixed batch of the 40 oldest leads
 *  about sixteen times. That batch is the worst forty in the pool: 27 of them
 *  carry no external links at all, so 9 of the 11 methods skip on sight, and
 *  the 13 that do have a site have dead DNS, a bot wall or a cross-domain
 *  redirect. Same failure class as the verify selector on 08-24 (d6af815), one
 *  lane over: a selector that reads "no result yet" as "not tried yet".
 *
 *  So carry a cursor. The ordering is a plain ascending 3-tuple, which is what
 *  lets the cursor be a single row comparison:
 *
 *    tier 0 = the lead has external links, tier 1 = it does not. Nine of the
 *      eleven methods need a website, so a linked lead is worth roughly five
 *      times a bare one. Tier ordering spends each lap's early passes on the
 *      1,067 workable leads before the 2,248 bare ones.
 *    disc  = first_discovered_at, oldest first, unchanged.
 *    id    = tiebreak, so a batch boundary can never skip or repeat a lead
 *      that shares a timestamp with its neighbour.
 *
 *  BOTH FAILURE MODES ARE THE SAME JOB (2026-09-02). This selector read
 *  `outreach_status = 'no_email_found'` only, so 1,181 of the 4,951 leads in the
 *  lane -- every one whose discovered address came back `email_invalid` -- were
 *  never handed to the collector at all. Nothing downstream required that:
 *  `canAttemptRecovery` and `HOLD_FLIP_WHERE` in the email repo's hold-guard
 *  both gate on `review_status = 'needs_contact'` and the score bar, never on
 *  `outreach_status`. It was just a narrow selector, and it hid a quarter of the
 *  backlog for ten days. An `email_invalid` lead is if anything the better
 *  prospect of the two: somebody already found a site worth scraping there, and
 *  411 of the 1,181 carry external links, so they enter at tier 0.
 *
 *  What that widening required first: `verifyAndFlip` used to write
 *  `email_address = COALESCE(NULLIF(email_address, ''), $1)`, which on an
 *  `email_invalid` row keeps the dead address and stamps 'valid' over it. Fixed
 *  in the email repo the same day (`promoteVerifiedEmailSql`). Do not narrow one
 *  without narrowing the other.
 *
 *  A short batch means the lap is done: the caller clears the cursor and the
 *  next pass starts a fresh lap over whatever is still uncollected. That is
 *  deliberate rather than terminal — a re-walk is worth something once sites
 *  come back, a method is added, or new leads land mid-book — and it is also
 *  the self-healing property: no state file edit can strand the lane, because
 *  a missing or garbage cursor just starts a lap.
 */
export const COLLECT_IDS_SQL = `WITH pool AS (
       SELECT lc.id,
              CASE WHEN COALESCE(lc.external_links, '') NOT IN ('', '[]') THEN 0 ELSE 1 END AS tier,
              COALESCE(lc.first_discovered_at, 'infinity'::timestamptz) AS disc
         FROM leads.lead_candidates lc
        WHERE lc.review_status = 'needs_contact'
          AND lc.outreach_status = ANY(ARRAY['no_email_found', 'email_invalid'])
          AND lc.signal_score >= 6
          AND COALESCE(lc.do_not_contact, false) = false
          AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id = lc.id)
     )
     SELECT id, tier, disc
       FROM pool
      WHERE $2::int IS NULL
         OR (tier, disc, id) > ($2::int, $3::timestamptz, $4::text)
      ORDER BY tier, disc, id
      LIMIT $1`;

export interface CollectBatch {
  ids: string[];
  /** Where to resume; null when this batch finished the lap. */
  nextCursor: CollectCursor | null;
  /** True when the batch came up short, i.e. the lap is done. */
  lapComplete: boolean;
}

/** The same pool COLLECT_IDS_SQL walks, as a count, plus the leads that have
 *  fallen into the gap between the two selectors.
 *
 *  WHY (2026-09-12). The lane spent this whole cycle telling Casey, once an
 *  hour, that its yield had collapsed because Brave was refusing and he should
 *  raise the search plan's cap. Brave WAS refusing. It was not the binding
 *  constraint. The collect pool had drained to 253 leads against a batch of
 *  150, so four passes walked 571 lead-slots over 271 distinct leads and two of
 *  them were byte-identical — the lane was re-walking its entire remaining book
 *  twice a day. Raising the search cap would have bought 253 leads, not the
 *  3,735 in `needs_contact`, and the alarm text said otherwise in so many words.
 *
 *  `stranded` is the reason those two numbers are so far apart, and it is the
 *  bigger finding. COLLECT_IDS_SQL excludes a lead that has ANY contact point;
 *  VERIFIABLE_IDS_SQL only selects leads that have an EMAIL contact point. A
 *  lead the collector worked and came away from holding a website, a phone or a
 *  social handle satisfies neither: collect will never look at it again and
 *  verify can never rule on it. 2,778 of 3,735 `needs_contact` leads sit in that
 *  gap, 2,281 of them carrying an already-resolved website — the expensive half
 *  of the job, done, and unreachable by both halves of the lane.
 *
 *  Measuring it here rather than in the check-in keeps the definition next to
 *  the two selectors it is derived from, so a change to either cannot leave the
 *  alarm describing a pool that no longer exists. */
export async function collectBookDepth(): Promise<{ pool: number; stranded: number }> {
  const rows = await query<{ pool: string | number; stranded: string | number }>(
    `SELECT
       count(*) FILTER (
         WHERE lc.outreach_status = ANY(ARRAY['no_email_found', 'email_invalid'])
           AND lc.signal_score >= 6
           AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id = lc.id)
       ) AS pool,
       count(*) FILTER (
         WHERE EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id = lc.id)
           AND NOT EXISTS (
             SELECT 1 FROM leads.contact_points cp
              WHERE cp.lead_id = lc.id
                AND cp.kind IN ('business_email', 'personal_email', 'youtube_email'))
       ) AS stranded
       FROM leads.lead_candidates lc
      WHERE lc.review_status = 'needs_contact'
        AND COALESCE(lc.do_not_contact, false) = false`,
    [],
  );
  const r = rows[0];
  return { pool: Number(r?.pool ?? 0), stranded: Number(r?.stranded ?? 0) };
}

export async function selectUntouchedBatch(
  limit: number,
  cursor?: CollectCursor,
): Promise<CollectBatch> {
  const rows = await query<{ id: string; tier: number; disc: string | Date }>(
    COLLECT_IDS_SQL,
    [limit, cursor ? cursor.tier : null, cursor ? cursor.disc : null, cursor ? cursor.id : null],
  );
  const last = rows[rows.length - 1];
  const lapComplete = rows.length < limit;
  return {
    ids: rows.map((r) => r.id),
    nextCursor:
      last && !lapComplete
        ? { tier: Number(last.tier), disc: new Date(last.disc).toISOString(), id: last.id }
        : null,
    lapComplete,
  };
}

/** Back-compat wrapper: the first batch of a fresh lap. */
export async function selectUntouchedIds(limit: number): Promise<string[]> {
  return (await selectUntouchedBatch(limit)).ids;
}

/** needs_contact leads that have at least one email contact point NOBODY HAS
 *  RULED ON YET.
 *
 *  `verified = false` is not "still to check" — it is also the resting state of
 *  every address that has already been checked and failed, because Bloodhound
 *  writes `verified = false` both when ZeroBounce says undeliverable and when
 *  the identity gate rejects the address as somebody else's. Selecting on it
 *  alone re-hands the same dead addresses to the tool every cadence, which is
 *  exactly what happened on the lane's first night (2026-08-24): pass one
 *  checked 42 addresses and flipped 7, pass two three hours later re-selected
 *  84 of the same 91 leads, spent 34 more ZeroBounce credits and flipped 0.
 *  Left alone that is ~270 wasted credits a day, forever, and an ownership note
 *  re-appended to the same rows on every pass (83 rows had already collected
 *  more than one after two passes).
 *
 *  So exclude anything already ruled on, by either of the two marks Bloodhound
 *  writes: `verified_at` (ZeroBounce returned a verdict) and an `[ownership:`
 *  note (the identity gate rejected it before a credit was spent). The note
 *  test is what makes this self-healing on rows that pre-date the companion
 *  fix in youtube-email-outreach-v1, which now stamps `verified_at` on the
 *  ownership branch too. No backfill needed.
 *
 *  The lane list matches COLLECT_IDS_SQL's: a lead the collector worked must be
 *  a lead the verifier can rule on, or a widened collect pass just fills
 *  contact_points with points nobody ever checks. See the note there.
 *
 *  GROUP BY stands in for DISTINCT because Postgres requires ORDER BY
 *  expressions to appear in the select list under SELECT DISTINCT.
 *
 *  The email-shape test was added 2026-09-02. Both of the "already ruled on"
 *  marks above assume the verifier CAN rule on a value, and on a value that is
 *  not an email it never does — so the row keeps both marks empty forever and
 *  the lead is re-selected every pass for good. `rec0kCDPB850ZLDV2` carries a
 *  `business_email` of `REDACTED FOR PRIVACY`, scraped off a privacy-protected
 *  WHOIS record, and had appeared in every verify batch since 08-18 (all seven
 *  of the 09-01/02 cycle). On a queue that is ~38 leads deep, one immortal row
 *  is 3% of it. The companion fix in youtube-email-outreach-v1's
 *  `saveContactPoints` stops new ones being written; this predicate is what
 *  makes the rows already in the table stop coming back, with no backfill. */
export const VERIFIABLE_IDS_SQL = `SELECT lc.id
       FROM leads.lead_candidates lc
       JOIN leads.contact_points cp ON cp.lead_id = lc.id
      WHERE lc.review_status = 'needs_contact'
        AND lc.outreach_status = ANY(ARRAY['no_email_found', 'email_invalid'])
        AND cp.kind IN ('business_email', 'personal_email', 'youtube_email')
        AND cp.value ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'
        AND COALESCE(cp.verified, false) = false
        AND cp.verified_at IS NULL
        AND COALESCE(cp.notes, '') NOT LIKE '%[ownership:%'
        AND COALESCE(lc.do_not_contact, false) = false
      GROUP BY lc.id, lc.first_discovered_at
      ORDER BY lc.first_discovered_at ASC NULLS LAST
      LIMIT $1`;

export async function selectVerifiableIds(limit: number): Promise<string[]> {
  const rows = await query<{ id: string }>(VERIFIABLE_IDS_SQL, [limit]);
  return rows.map((r) => r.id);
}

export interface LaneOpts {
  dryRun: boolean;
  emailRepoPath: string;
  collectIntervalHours: number;
  verifyIntervalHours: number;
  collectBatch: number;
  verifyBatch: number;
  log: (line: Record<string, unknown>) => void;
}

/**
 * Keep the recovery lane moving during the one halt it doesn't depend on.
 * Generic halt reasons still mean a full stop.
 */
export async function runRecoveryDuringOpenRouterHalt(
  haltReason: string,
  runLane: () => Promise<void>,
): Promise<boolean> {
  if (!haltReason.startsWith('HALT — OpenRouter account out of credits (')) return false;
  await runLane();
  return true;
}

function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function laneOptsFromEnv(
  emailRepoPath: string,
  dryRun: boolean,
  log: (line: Record<string, unknown>) => void,
): LaneOpts {
  return {
    dryRun,
    emailRepoPath,
    collectIntervalHours: numEnv('BLOODHOUND_COLLECT_INTERVAL_HOURS', 6),
    verifyIntervalHours: numEnv('BLOODHOUND_VERIFY_INTERVAL_HOURS', 3),
    // Integer batches: a fractional LIMIT is a Postgres error.
    //
    // COLLECT BATCH 40 -> 150 (2026-09-02). 40 was the lane's opening guess and
    // "raising that batch is the next lever" has been the standing note on it
    // since 08-24. The measurement that sizes it: 17 logged passes at 40 leads,
    // the last of them 23:54:44 -> 00:07:02 on 09-01, is 18.5s per lead at
    // concurrency 8, so 150 leads is about 46 minutes of detached child. Four
    // passes a day is then 600 leads instead of 160, which walks the widened
    // 4,444-lead book in about a week instead of a month.
    //
    // Nothing else in the chain minds. Collection is free (no LLM, no metered
    // API); Brave only assists leads with no resolvable site and already
    // degrades to a plain skip when its free tier rate-limits; concurrency is
    // unchanged, so per-site politeness is unchanged; and the downstream
    // ZeroBounce spend is ~0.5 credits per collected lead, or ~2,200 for the
    // whole book against a 4,015-credit balance.
    collectBatch: Math.floor(numEnv('BLOODHOUND_COLLECT_BATCH', 150)),
    verifyBatch: Math.floor(numEnv('BLOODHOUND_VERIFY_BATCH', 200)),
    log,
  };
}

/**
 * Run whichever Bloodhound passes are due. Collect is fire-and-forget (detached
 * child; it must not burn the campaign session's time budget). Verify is
 * awaited because it is short (only leads with pending email points) and its
 * flips feed the approved_hold pool the same session promotes.
 */
export async function runBloodhoundLane(opts: LaneOpts): Promise<void> {
  const now = Date.now();
  const state = loadState();

  // --- verify pass (bounded credit spend: only leads with unverified emails) ---
  if (isDue(state, 'lastVerifyAt', now, opts.verifyIntervalHours)) {
    try {
      const ids = await selectVerifiableIds(opts.verifyBatch);
      if (ids.length === 0) {
        opts.log({ event: 'bloodhound_verify', skipped: 'no_pending_email_points' });
        state.lastVerifyAt = new Date().toISOString();
        if (!opts.dryRun) saveState(state);
      } else if (opts.dryRun) {
        opts.log({ event: 'bloodhound_verify', dry_run: true, leads: ids.length });
      } else {
        const r = await runBloodhound(opts.emailRepoPath, [
          '--lead-ids', ids.join(','), '--verify', '--verify-only',
        ]);
        opts.log({ event: 'bloodhound_verify', leads: ids.length, exit: r.exit_code });
        // Stamp the cadence only on success; a failed child should be retried
        // next pass, not deferred a full interval.
        if (r.exit_code === 0) {
          state.lastVerifyAt = new Date().toISOString();
          saveState(state);
        }
      }
    } catch (e) {
      opts.log({ event: 'bloodhound_verify', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // --- collect pass (free; detached so the session keeps moving) ---
  // Past some age a "living" PID is OS reuse, not our child, and the guard has
  // to expire or the lane stops forever. That window was a flat 2h, written
  // against a 40-lead batch. A flat number silently becomes wrong the moment
  // the batch moves, so derive it: 90s per lead is roughly five times the
  // measured 18.5s, floored at the original 2h so a small batch is unaffected.
  const collectAgeMs = state.collectStartedAt ? now - Date.parse(state.collectStartedAt) : Infinity;
  if (isDue(state, 'lastCollectAt', now, opts.collectIntervalHours)) {
    if (pidAlive(state.collectPid) && collectAgeMs < staleCollectAfterMs(opts.collectBatch)) {
      opts.log({ event: 'bloodhound_collect', skipped: 'previous_still_running', pid: state.collectPid });
      return;
    }
    // The previous child is gone. Did it get through its batch, or was it cut
    // off? A cut-off pass leaves its leads unwalked behind an advanced cursor,
    // so put the cursor back before selecting the next batch.
    if (state.collectResume && !opts.dryRun) {
      const finished = lastCollectPassFinished();
      const searchDead = lastCollectPassSearchDead();
      // Two ways a pass fails to walk its batch: it was cut off, or it ran with
      // website resolution down. Both leave real leads behind an advanced cursor.
      const reason =
        finished === false ? 'previous_pass_truncated'
        : searchDead === true ? 'previous_pass_search_dead'
        : null;
      // Two failures, two budgets. Sharing one made a sustained Brave outage
      // alternate three wasted re-walks with one blind 150-lead advance — see
      // MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS for the measurement.
      const truncated = reason === 'previous_pass_truncated';
      const rewinds = (truncated ? state.collectRewinds : state.collectSearchDeadRewinds) ?? 0;
      const cap = truncated ? MAX_CONSECUTIVE_REWINDS : MAX_CONSECUTIVE_SEARCH_DEAD_REWINDS;
      // A failed pass is not automatically a re-walkable one: a lap-closing
      // batch strands nobody, and a pass that still collected from a real share
      // of its leads did the work. Both cases advance. See rewindWaiver.
      const waiver = rewindWaiver(
        reason, state.collectResume, lastCollectPassYield(),
        state.collectSearchDeadRewinds ?? 0,
      );
      if (reason && !waiver && rewinds < cap) {
        state.collectCursor = state.collectResume.from ?? undefined;
        state.collectLaps = state.collectResume.laps;
        // Only the reason that fired advances; the other resets, so alternating
        // failures can never add up to a cap neither one reached on its own.
        if (truncated) {
          state.collectRewinds = rewinds + 1;
          state.collectSearchDeadRewinds = 0;
        } else {
          state.collectSearchDeadRewinds = rewinds + 1;
          state.collectRewinds = 0;
        }
        opts.log({
          event: 'bloodhound_collect',
          rewound: true,
          reason,
          cursor_tier: state.collectCursor?.tier ?? null,
          rewinds: rewinds + 1,
          cap,
        });
      } else {
        if (reason && waiver) {
          opts.log({ event: 'bloodhound_collect', rewound: false, reason: 'rewind_waived', waiver, blocked_by: reason });
        } else if (reason) {
          opts.log({ event: 'bloodhound_collect', rewound: false, reason: 'rewind_cap_reached', blocked_by: reason, rewinds, cap });
        }
        state.collectRewinds = 0;
        state.collectSearchDeadRewinds = 0;
      }
      state.collectResume = undefined;
      saveState(state);
    }
    try {
      const batch = await selectUntouchedBatch(opts.collectBatch, state.collectCursor);
      const ids = batch.ids;
      // A short batch ends the lap wherever it happened, including the empty
      // case: clear the cursor so the next pass restarts from the top.
      const advance = (): void => {
        state.collectCursor = batch.nextCursor ?? undefined;
        if (batch.lapComplete) state.collectLaps = (state.collectLaps ?? 0) + 1;
      };
      if (ids.length === 0) {
        opts.log({ event: 'bloodhound_collect', skipped: 'lap_complete', laps: (state.collectLaps ?? 0) + 1 });
        advance();
        state.lastCollectAt = new Date().toISOString();
        if (!opts.dryRun) saveState(state);
        return;
      }
      if (opts.dryRun) {
        opts.log({ event: 'bloodhound_collect', dry_run: true, leads: ids.length, lap_complete: batch.lapComplete });
        return;
      }
      // The collect child used to run on stdio:'ignore'. That is why nobody saw
      // the lane produce nothing for four days: it fails, or finds nothing, in
      // total silence. Tee it to a log instead. Appending by fd works with
      // detached + unref, where an inherited stream would not survive the
      // parent exiting.
      const child = spawn(
        'npm', ['run', 'bloodhound', '--', '--lead-ids', ids.join(',')],
        { cwd: opts.emailRepoPath, stdio: ['ignore', collectLogFd(), collectLogFd()], detached: true },
      );
      // Without this handler a spawn failure (ENOENT etc.) throws as an
      // uncaught exception AFTER spawn returns, crashing the campaign's
      // finish block. The collect pass must never take the session down.
      child.on('error', (err) => {
        opts.log({ event: 'bloodhound_collect', spawn_error: err.message });
      });
      child.unref();
      // Advance BEFORE the child reports, because it never reports: it is
      // detached on purpose so the session's time budget goes to finder passes.
      // A batch the collector genuinely worked and failed on is skipped until
      // the next lap, which beats re-running the same failed batch every 6
      // hours. A batch it never got to is a different thing, so remember where
      // this one started; the next pass rewinds here if the child was cut off.
      state.collectResume = {
        from: state.collectCursor ?? null,
        laps: state.collectLaps ?? 0,
        lapComplete: batch.lapComplete,
      };
      advance();
      state.collectPid = child.pid;
      state.lastCollectAt = new Date().toISOString();
      state.collectStartedAt = state.lastCollectAt;
      saveState(state);
      // How much book is left, recorded on every dispatch so "the lane stopped
      // producing" can be told apart from "the lane finished its book" without
      // a database session. A pool at or under the batch size means this pass
      // re-walked everything the collector can still see. Never fatal: a
      // counting query that fails must not stop a pass that already spawned.
      const depth = await collectBookDepth().catch(() => null);
      opts.log({
        event: 'bloodhound_collect',
        leads: ids.length,
        pid: child.pid,
        cursor_tier: batch.nextCursor?.tier ?? null,
        lap_complete: batch.lapComplete,
        laps: state.collectLaps ?? 0,
        pool_remaining: depth?.pool ?? null,
        stranded_no_email: depth?.stranded ?? null,
        book_drained: depth ? depth.pool <= opts.collectBatch : null,
      });
    } catch (e) {
      opts.log({ event: 'bloodhound_collect', error: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Awaited bloodhound run (used by the verify pass). Watchdog-killed after
 * VERIFY_TIMEOUT_MS so a hung CLI can never block the campaign finish block
 * indefinitely; a kill reports a non-zero exit, which skips the cadence
 * stamp and retries next session. */
function runBloodhound(
  cwd: string,
  extraArgs: string[],
  timeoutMs = 20 * 60_000,
): Promise<{ exit_code: number | null }> {
  return new Promise((resolvePromise) => {
    const child = spawn('npm', ['run', 'bloodhound', '--', ...extraArgs], { cwd, stdio: 'inherit' });
    const watchdog = setTimeout(() => { child.kill('SIGTERM'); }, timeoutMs);
    child.on('exit', (code) => { clearTimeout(watchdog); resolvePromise({ exit_code: code }); });
    child.on('error', () => { clearTimeout(watchdog); resolvePromise({ exit_code: null }); });
  });
}
