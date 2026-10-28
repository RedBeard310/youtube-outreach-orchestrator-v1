import PipelineDb, { type FieldSet } from 'pipeline-db/sdk';
import { query } from 'pipeline-db';

// Must match leads.vocab_lead_candidates_review_status in Postgres. The two
// lanes below were live for weeks but missing from this type, so every call site
// passed them as bare strings and a typo compiled. A misspelled status returns a
// count of zero, and zero reads as "nothing parked", which is the exact signal
// scripts/autopilot/checkin.ts uses to decide the pipeline has stopped working.
export type ReviewStatus =
  | 'unreviewed'
  | 'approved'
  // Verified but deliberately parked, and NOT tick-eligible. The way out is
  // hold-batch.ts --release, which flips the pool to 'approved'.
  | 'approved_hold'
  // Score>=6 with no usable email yet. Bloodhound's recovery lane.
  | 'needs_contact'
  | 'D100'
  | 'rejected'
  | 'sent'
  | 'below_threshold'
  | 'scoring_failed'
  | 'demo_niche_excluded'
  | 'no_host_identified';

export type OutreachStatus =
  | 'pending'
  | 'email_found'
  | 'email_verified'
  | 'enriched' // legacy alias for ready_data_scraped; still recognised on read
  | 'ready_data_scraped' // parked, enriched, ready for the on-demand send (was `enriched`)
  | 'ready_no_data' // reserved: ready to email but no enrichment data; not produced/sent yet
  | 'email_drafted'
  | 'sent_to_smartlead'
  | 'no_email_found'
  | 'email_invalid'
  | 'failed'
  | 'deep_research_pending'
  | 'deep_research_in_progress'
  | 'deep_research_complete'
  | 'deep_research_failed';

export interface Lead {
  id: string;
  review_status: ReviewStatus | null;
  outreach_status: OutreachStatus | null;
  email_address: string | null;
  email_verification_result: string | null;
  channel_id: string | null;
  channel_url: string | null;
  channel_name: string | null;
  niche_category: string | null;
  signal_score: number | null;
  first_discovered_at: string | null;
  /** JSON-array string, e.g. '["graph:Wes McDowell"]' — see prospects.ts's
   *  discovered_via_term. Prefix identifies the discovery method: a bare search
   *  term (keyword engine), "graph:" (recommended-videos feed), "comment:"
   *  (comment-sweep), "peer-comment:"/"peer-guest:" (peer-sweep). Used by
   *  debrief-data.ts to attribute daily discovery counts per method. */
  discovered_via: string | null;
  /** True when this person is blocked right now by the do-not-contact registry
   *  (`leads.do_not_contact_active`, maintained by automator/scripts/dnc-sync.py): a
   *  client, free work, a booked or held call, an abusive reply, a bounce, a hand block,
   *  or a conversation that is still live. NEVER compose or send to one of these.
   *  Since Operation Siege (2026-09-13) a decline or a stop request is NOT a block: it is a
   *  no to the one offer it answered, and dnc-sync only records it. */
  do_not_contact: boolean;
  /** Why they're blocked: client | free_work | had_call | hostile | bounced | manual |
   *  in_conversation. in_conversation lasts while the thread is live (their message last,
   *  or anything under 14 days old), and dnc-sync releases it on its own. */
  dnc_reason: string | null;
  /** The composed email, written by the email repo's compose stage. Present + non-empty
   *  means the writing is already paid for and only the SmartLead push is left. Read
   *  here (and nowhere else) so the send queue can tell a lead that died mid-push from
   *  one that never got written. */
  email_subject: string | null;
  email_body: string | null;
  /** Path to the on-disk enrichment bundle. Present means enrichment is already paid
   *  for, so a send can resume at compose without re-running prep. */
  enrichment_bundle_path: string | null;
}

// Every lead-selection query carries this. It is a plain boolean column so the
// filter translator in pipeline-db compiles it without a special case.
//
// The queries are the cheap half of the guard, not the whole of it: the orchestrator
// always calls the email repo with `--lead-ids`, and that path fetches leads by id
// with no filter at all. The gate that actually protects a send lives per-lead in
// youtube-email-outreach-v1/src/cli/outreach.ts.
const NOT_SUPPRESSED = `NOT({do_not_contact})`;

// Note: `failed` and `deep_research_failed` are intentionally NOT terminal.
// The orchestrator auto-retries them on the next tick (most failures here are
// transient: YouTube quota, database timeouts, etc.). For genuinely broken
// leads, that means we'll keep re-driving them indefinitely; that's the
// accepted trade-off (no failure-count bounding in v1).
//
// `deep_research_in_progress` IS terminal — once set, the orchestrator does not
// auto-restart mid-flight runs. Manual intervention required for stuck leads.
// Statuses at which the tick's *prep* branch stops re-driving an approved lead.
// Since 2026-07-17 the tick only preps (find -> verify -> enrich) and parks the
// lead at `ready_data_scraped`; writing + sending the email is a separate
// on-demand step (`npm run send`). So a lead that has reached `ready_data_scraped`
// (or `email_drafted` / `sent_to_smartlead`, or dead-ended at no_email/invalid) is
// "done" as far as the tick is concerned — it lies in wait for the send command
// and the tick never touches it again. `ready_no_data` is also parked-and-ignored
// by the tick, but it is deliberately NOT in APPROVED_FIRE_READY yet: nothing
// produces it and its no-bundle send path isn't built, so it's a manual holding
// label for now. `enriched` stays here as a legacy alias for any in-flight lead.
const APPROVED_PREP_DONE = new Set<OutreachStatus>([
  'ready_data_scraped',
  'ready_no_data',
  'enriched', // legacy
  'email_drafted',
  'sent_to_smartlead',
  'no_email_found',
  'email_invalid',
]);

// The states a prepped, ready-to-send approved lead sits at. `npm run send`
// resumes these through compose -> push. `email_drafted` = a prior send composed
// the draft but didn't push (e.g. a SmartLead blip); re-firing resumes at push.
// `enriched` is a legacy alias for `ready_data_scraped`. `ready_no_data` is
// intentionally excluded — its send path isn't built yet (see APPROVED_PREP_DONE).
const APPROVED_FIRE_READY: readonly OutreachStatus[] = ['ready_data_scraped', 'enriched', 'email_drafted'];

// `failed` is the fourth fire-ready state, and it is conditional — which is why it
// is listed apart from the three above rather than inside them.
//
// The email repo writes `failed` for ANY unhandled error in a lead's run, including
// a network blip on the SmartLead POST after the email was already written. On
// 2026-09-24 that cost nine finished emails: the 07:20 send composed 18, lost 9 to
// `fetch failed` on the push (one retry each, both inside the same two-minute flap),
// and wrote them `failed`. `failed` was in neither the send queue below nor the
// tick's APPROVED_PREP_DONE, so the send would never look at them again and the only
// thing that could was a manual `npm run tick` that nobody runs. Ten researched,
// written, verified-email leads went quiet with no alarm anywhere, and the approved
// lane read 0 ready / 0 drafted — indistinguishable from a lane that had finished.
//
// A `failed` lead is re-fireable when its own fields show the work is already paid
// for, which is the same reading youtube-email-outreach-v1's `effectiveStatus()`
// makes when it decides where to resume: a written subject + body resumes at push
// (exactly the `email_drafted` case), a bundle resumes at compose (exactly the
// `ready_data_scraped` case). A `failed` lead with neither never got that far and
// belongs to prep, not to send — including it would quietly turn a send into a
// find/verify/enrich run, which is the coupling 2026-07-17 removed on purpose.
const FIRE_RESUMABLE_STATUSES: readonly OutreachStatus[] = [...APPROVED_FIRE_READY, 'failed'];

/** Where `npm run send` would resume this lead, or null if it must not be fired.
 *  Mirrors `effectiveStatus()` in youtube-email-outreach-v1/src/cli/outreach.ts —
 *  if that function's reading changes, change this one with it. */
export function fireResumeStage(lead: Lead): 'push' | 'compose' | null {
  const status = lead.outreach_status;
  if (status == null) return null;
  if (status === 'email_drafted') return 'push';
  if (status === 'ready_data_scraped' || status === 'enriched') return 'compose';
  if (status !== 'failed') return null;
  // A `failed` lead only qualifies on the evidence in its own fields.
  if (lead.email_subject?.trim() && lead.email_body?.trim()) return 'push';
  if (lead.enrichment_bundle_path?.trim()) return 'compose';
  return null;
}

const D100_TERMINAL = new Set<OutreachStatus>([
  'deep_research_complete',
  'deep_research_in_progress',
  'no_email_found',
  'email_invalid',
]);

// pipeline-db finds the Postgres connection string on its own, so no API token is
// needed. LEAD_BASE_ID is the old base id; pipeline-db accepts it and ignores it.
function getBase() {
  const baseId = process.env.LEAD_BASE_ID;
  if (!baseId) throw new Error('LEAD_BASE_ID is not set');
  return new PipelineDb().base(baseId);
}

// A database call can fail on a passing blip (a dropped connection or a timeout).
// Before the 2026-08-12 move to Postgres, the old database threw transient 5xx "Try again"
// errors under load. Either kind aborts a call mid-pass even though a retry would
// succeed, and when that call is the post-run yield query, the run's JSONL line ends
// up with a null breakdown (the "logging gap" seen on 2026-07-08). Wrap the hot reads so
// a blip retries instead of propagating. Writes are safe to retry too: a lead
// update is idempotent (same id + same fields). Rate-limit (429) and 5xx are
// retried; a 422/permission error is not — those won't fix themselves.
// Transient network/DNS failures (ENOTFOUND/EAI_AGAIN from a WiFi blip or a
// laptop that just woke) are retryable — they clear in seconds. A 2026-07-10
// autonomous run hard-crashed because ENOTFOUND wasn't matched here and threw
// straight through withRetry. Permission/422 errors stay non-retryable.
const RETRYABLE = /try again|rate limit|timeout|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EPIPE|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|socket hang up|network|\b5\d\d\b|\b429\b/i;

async function withRetry<T>(op: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i === attempts || !RETRYABLE.test(msg)) throw err;
      const backoffMs = Math.min(1000 * 2 ** (i - 1), 15000);
      console.error(`[db] ${label} attempt ${i}/${attempts} failed (${msg}); retrying in ${backoffMs}ms`);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

function tableName() {
  return process.env.LEAD_TABLE_NAME ?? 'lead_candidates';
}

function recordToLead(record: { id: string; get: (field: string) => unknown }): Lead {
  return {
    id: record.id,
    review_status: (record.get('review_status') as ReviewStatus | undefined) ?? null,
    outreach_status: (record.get('outreach_status') as OutreachStatus | undefined) ?? null,
    email_address: (record.get('email_address') as string | undefined) ?? null,
    email_verification_result: (record.get('email_verification_result') as string | undefined) ?? null,
    channel_id: (record.get('channel_id') as string | undefined) ?? null,
    channel_url: (record.get('channel_url') as string | undefined) ?? null,
    channel_name: (record.get('channel_name') as string | undefined) ?? null,
    niche_category: (record.get('niche_category') as string | undefined) ?? null,
    signal_score: (record.get('signal_score') as number | undefined) ?? null,
    first_discovered_at: (record.get('first_discovered_at') as string | undefined) ?? null,
    discovered_via: (record.get('discovered_via') as string | undefined) ?? null,
    do_not_contact: record.get('do_not_contact') === true,
    dnc_reason: (record.get('dnc_reason') as string | undefined) ?? null,
    email_subject: (record.get('email_subject') as string | undefined) ?? null,
    email_body: (record.get('email_body') as string | undefined) ?? null,
    enrichment_bundle_path: (record.get('enrichment_bundle_path') as string | undefined) ?? null,
  };
}

export async function getLeadsForOrchestration(): Promise<Lead[]> {
  const base = getBase();
  const formula = `AND(OR({review_status}='approved', {review_status}='D100'), ${NOT_SUPPRESSED})`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula }).all(),
    'getLeadsForOrchestration',
  );
  const leads = records.map(recordToLead);

  return leads.filter(l => {
    const status = l.outreach_status;
    if (l.review_status === 'approved') return !status || !APPROVED_PREP_DONE.has(status);
    if (l.review_status === 'D100') return !status || !D100_TERMINAL.has(status);
    return false;
  });
}

// On-demand send queue: approved leads that prep has parked in a ready-to-fire
// state (`ready_data_scraped`, or `email_drafted` from a partial prior send). `npm run
// send` drives these through compose -> push. Deliberately separate from the
// tick's prep query so writing/sending an email never rides along with — or is
// blocked by — the find/verify/enrich work, the enrichment-DB cleanup, or
// anything else. Everything lies in wait; this is the only thing that sends.
export async function getApprovedFireLeads(): Promise<Lead[]> {
  const base = getBase();
  const readyClauses = FIRE_RESUMABLE_STATUSES.map(s => `{outreach_status}='${s}'`).join(', ');
  const formula = `AND({review_status}='approved', OR(${readyClauses}), ${NOT_SUPPRESSED})`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula }).all(),
    'getApprovedFireLeads',
  );
  // The query widens to `failed`; fireResumeStage() decides which of those are
  // genuinely resumable. The narrowing happens here rather than in the formula
  // because "has a written body" is a field test the filter translator would have
  // to approximate, and pipeline-db refuses to approximate a lead-selection filter.
  return records.map(recordToLead).filter(l => fireResumeStage(l) !== null);
}

// Whether a specific lead is parked and ready for `npm run send` to fire it.
// Used to filter an explicit `--lead-ids` list so a stray id (unapproved, still
// mid-prep, or already sent) is skipped rather than re-driven.
export function isApprovedFireReady(lead: Lead): boolean {
  return (
    !lead.do_not_contact &&
    lead.review_status === 'approved' &&
    fireResumeStage(lead) !== null
  );
}

export async function getLeadsByIds(ids: string[]): Promise<Lead[]> {
  if (ids.length === 0) return [];
  const base = getBase();
  const conditions = ids.map(id => `RECORD_ID()='${id}'`).join(',');
  const formula = `OR(${conditions})`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula }).all(),
    'getLeadsByIds',
  );
  return records.map(recordToLead);
}

export async function getLeadsDiscoveredSince(sinceISO: string): Promise<Lead[]> {
  const base = getBase();
  const formula = `IS_AFTER({first_discovered_at}, "${sinceISO}")`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula }).all(),
    'getLeadsDiscoveredSince',
  );
  return records.map(recordToLead);
}

export async function updateLead(id: string, fields: Partial<FieldSet>): Promise<void> {
  const base = getBase();
  await withRetry(() => base(tableName()).update([{ id, fields }]), `updateLead(${id})`);
}

// Score>=6 leads still eligible for the verify step of an approved_hold run:
// review_status='unreviewed' AND not yet carrying a resolved email outcome. These
// are what the campaign driver hands to `--stop-after verify` (find + ZeroBounce)
// before promotion. Excludes leads already verified/failed so repeated calls
// during a run don't re-verify the same rows.
export async function getVerifiablePitchableLeads(): Promise<Lead[]> {
  const base = getBase();
  const formula = `AND(
    {review_status}='unreviewed',
    {signal_score}>=6,
    OR({outreach_status}='', {outreach_status}='pending', {outreach_status}='email_found', {outreach_status}='failed'),
    ${NOT_SUPPRESSED}
  )`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula }).all(),
    'getVerifiablePitchableLeads',
  );
  return records.map(recordToLead);
}

// Count rows at a given review_status (e.g. 'approved_hold') so the campaign driver
// can measure how many leads it has parked this session against the target.
export async function countByReviewStatus(status: ReviewStatus): Promise<number> {
  const base = getBase();
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: `{review_status}='${status}'`, fields: ['review_status'] }).all(),
    `countByReviewStatus(${status})`,
  );
  return records.length;
}

// Emails loaded into SmartLead inside a window, tallied by the review_status lane
// they came from.
//
// Why this exists (2026-09-25): the loading door reopened on 09-23 and 47, then 55,
// then 10 emails went out — and NOTHING in this repo counted them. The orchestrator's
// own JSONL only records sends it launched itself (8 of the 55 on 09-24; the other 47
// were driven by hand from the email repo), and the debrief's grounded-metrics feed had
// no send field at all. So the one number that is the whole point of the pipeline had to
// be reconstructed from Postgres by hand, every day, by whoever happened to think of it.
// Reads `outreach_processed_at`, which the email repo stamps on the push — NOT
// `last_contacted_at`, which is polluted by a historical backfill (see CLAUDE.md).
//
// Note this counts leads LOADED into a SmartLead campaign, which is not the same as
// emails SmartLead actually delivered: its scheduler sends Mon-Thu 09:00-15:00 ET. For
// real delivered volume use youtube-email-outreach-v1/scripts/sl-sent-per-day.ts.
export async function countSentBetween(
  sinceISO: string,
  untilISO: string,
): Promise<{ total: number; by_review_status: Record<string, number> }> {
  const base = getBase();
  const formula = `AND(
    {outreach_status}='sent_to_smartlead',
    IS_AFTER({outreach_processed_at}, "${sinceISO}"),
    IS_BEFORE({outreach_processed_at}, "${untilISO}")
  )`;
  const records = await withRetry(
    () => base(tableName()).select({ filterByFormula: formula, fields: ['review_status'] }).all(),
    'countSentBetween',
  );
  const by: Record<string, number> = {};
  for (const r of records) {
    const lane = (r.get('review_status') as string | undefined) ?? '(none)';
    by[lane] = (by[lane] ?? 0) + 1;
  }
  return { total: records.length, by_review_status: by };
}

export type FirstTouchCounts = {
  /** People with at least one new-offer send inside the window. */
  people: number;
  /** Of those, how many had never been emailed before that send. */
  first_touch: number;
  /** Of those, how many we had already written to at least once. */
  repeat: number;
  /** first_touch as a whole-number percentage of people, null when nobody was emailed. */
  first_touch_pct: number | null;
  /** First touches who were sitting on the shelf (`review_status = approved_hold`). */
  shelf_first_touch: number;
  /** The same two counts over the seven days before the window, as the baseline. */
  people_prev_7d: number;
  first_touch_prev_7d: number;
  first_touch_pct_prev_7d: number | null;
};

/**
 * How many of the cycle's emails reached somebody we had never written to.
 *
 * WHY THIS EXISTS (2026-10-17). `sent_today` counts emails and `shelf.ready_to_write`
 * counts the inventory, and for two cycles the two numbers sat side by side telling a
 * story neither could state: 160 emails went out on 10-15 and 82 on 10-16, both pushes
 * lossless, and the shelf did not move one person — `ready_to_write` read exactly 5,138
 * and `already_sent` exactly 1,663 on three consecutive mornings. Every one of those 242
 * emails was a repeat offer to somebody already in `already_sent`. Finding that out took
 * hand SQL over `leads.outreach_sends`, and the only reason anybody went looking was that
 * all four shelf figures happened to be byte-identical two days running. A one-person
 * change would have hidden it completely.
 *
 * The cause is upstream in `automator` and is not a fault: `siege.fill_slots` hands slots
 * out by `priority_key`, which is tier, then score, then subscribers, and carries nothing
 * about whether a person has heard from us. The Whale tier's never-emailed supply ran out
 * on the 776-person push of 10-13, so since then its re-offer queue has taken every slot
 * while 949 ready Strong-7 and Other-7+ people waited (see `waiting_for_a_slot` in the
 * plan facts). Repeat offers are deliberate — Casey reopened that stream on 2026-10-07 —
 * so this is a report, never an alarm. The point is that "we sent 82 and lost none" and
 * "we reached one new person" are different days, and until now they printed the same.
 *
 * Counts PEOPLE, not rows: one person can be loaded into more than one campaign. Reads
 * `leads.outreach_sends`, which holds one row per new offer started (every row in the
 * 10-16 cycle had `is_followup = false`; SmartLead sends the day-4 and day-10 messages on
 * its own and they are not logged here), so this measures first touches and not replies
 * to our own sequence. "Before" means before that person's own first send in the window,
 * not before the window, so a person first emailed mid-cycle counts once and correctly.
 *
 * One statement, no model, no network beyond the pool. Fail-soft at the call site.
 */
export async function countFirstTouchBetween(
  sinceISO: string,
  untilISO: string,
): Promise<FirstTouchCounts> {
  const prevStartISO = new Date(new Date(sinceISO).getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const rows = await query<Record<string, string | number | null>>(
    `WITH touched AS (
       SELECT s.lead_id,
              min(s.sent_at) FILTER (WHERE s.sent_at >= $1 AND s.sent_at < $2) AS cyc_first,
              min(s.sent_at) FILTER (WHERE s.sent_at >= $3 AND s.sent_at < $1) AS prev_first
         FROM leads.outreach_sends s
        WHERE s.sent_at >= $3 AND s.sent_at < $2
        GROUP BY 1
     ),
     scored AS (
       SELECT t.lead_id,
              t.cyc_first,
              t.prev_first,
              lc.review_status,
              EXISTS (SELECT 1 FROM leads.outreach_sends p
                       WHERE p.lead_id = t.lead_id AND p.sent_at < t.cyc_first)  AS cyc_repeat,
              EXISTS (SELECT 1 FROM leads.outreach_sends p
                       WHERE p.lead_id = t.lead_id AND p.sent_at < t.prev_first) AS prev_repeat
         FROM touched t
         LEFT JOIN leads.lead_candidates lc ON lc.id = t.lead_id
     )
     SELECT count(*) FILTER (WHERE cyc_first IS NOT NULL)                       AS people,
            count(*) FILTER (WHERE cyc_first IS NOT NULL AND NOT cyc_repeat)    AS first_touch,
            count(*) FILTER (WHERE cyc_first IS NOT NULL AND cyc_repeat)        AS repeat_touch,
            count(*) FILTER (WHERE cyc_first IS NOT NULL AND NOT cyc_repeat
                               AND review_status = 'approved_hold')             AS shelf_first_touch,
            count(*) FILTER (WHERE prev_first IS NOT NULL)                      AS people_prev,
            count(*) FILTER (WHERE prev_first IS NOT NULL AND NOT prev_repeat)  AS first_touch_prev
       FROM scored`,
    [sinceISO, untilISO, prevStartISO],
  );
  const r = rows[0] ?? {};
  const n = (v: unknown) => Number(v ?? 0);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : null);
  const people = n(r.people);
  const firstTouch = n(r.first_touch);
  const peoplePrev = n(r.people_prev);
  const firstTouchPrev = n(r.first_touch_prev);
  return {
    people,
    first_touch: firstTouch,
    repeat: n(r.repeat_touch),
    first_touch_pct: pct(firstTouch, people),
    shelf_first_touch: n(r.shelf_first_touch),
    people_prev_7d: peoplePrev,
    first_touch_prev_7d: firstTouchPrev,
    first_touch_pct_prev_7d: pct(firstTouchPrev, peoplePrev),
  };
}

// The shelf: parked leads that are researched, bundled and one command from a written
// email. This has been the largest thing in the pipeline since 2026-09-16 and it was
// only ever counted by hand. `bundled` is the honest measure of whether enrichment has
// work left; `ready_to_write` is what `npm run send` could fire today if the lane it
// draws from were opened to approved_hold.
//
// `already_sent` added 2026-10-05. Sending an email does NOT move a lead out of
// `approved_hold`, so `total` counts people who have already been written to, and the
// gap widens by every email the send path pushes. On 2026-10-04 it was 548 of 7,591 and
// had to be reconstructed with a hand-written SQL query to find that out — while the
// only lane still adding leads was contributing one or two a day. A 200/day ramp across
// four delivery days eats about 800 a week, so the headline figure and the real
// inventory diverge faster than the inventory grows. Counted here so no report has to
// ask: `ready_to_write` is the inventory, `total` is the label.
//
// THE STAMP IS NOT AN EMAIL (2026-10-28). `already_sent` reads one field,
// `outreach_status='sent_to_smartlead'`, which the push writes when SmartLead ACCEPTS a
// lead into a campaign. Acceptance is not delivery: SmartLead's own scheduler sends later
// (Mon-Thu 09:00-15:00 ET), and a lead can be withdrawn from the campaign before it ever
// goes out. `automator/scripts/siege_live.py` does exactly that — it removes the lead and
// DELETES its row from `leads.outreach_sends`, correctly, because no email happened. It
// does not revert the lead's own `outreach_status` or `last_contacted_at`.
//
// So the two instruments drift, silently and in the expensive direction. On 2026-10-28,
// 54 of the 1,667 stamped leads had no send row at all: 53 from 2026-10-13, the record
// 782-email day whose live sequences Casey's ICP audit paused that afternoon, and 1 from
// 10-07. Every one has a verified address, a written subject, a finished bundle, and no
// do-not-contact flag. Nobody has ever emailed them, and nothing will:
//
//   - the stamp keeps them out of `ready_to_write`, so the published inventory is short
//     by 54 people and reads as complete;
//   - `APPROVED_FIRE_READY` selects `ready_data_scraped`/`email_drafted`, so `npm run send`
//     skips them forever;
//   - Siege's history loader credits a phantom send off
//     `outreach_status='sent_to_smartlead' AND last_contacted_at IS NOT NULL`, so its
//     planner believes the offer was already used, and none of the 54 has appeared in a
//     plan since 10-13.
//
// The giveaway was in the published snapshot for a second morning and unread: six people
// were emailed for the FIRST time in the cycle, all six off this shelf, and `already_sent`
// printed 1,667 against 1,667. A cumulative count of people written to cannot stay flat
// while six join it. It stayed flat because those six had been stamped before they were
// ever sent to, which is the same defect seen from the other side.
//
// `emailed` is now grounded on the send ledger — a row in `leads.outreach_sends` is an
// email we really put in front of somebody — and `marked_sent_never_emailed` publishes the
// gap with the ids, so a stranded cohort can never again sit inside a healthy-looking
// number. The ledger fields are null, not 0, when the ledger cannot be read: unknown and
// measured-as-nothing differ, and this repo only counts (see CLAUDE.md "No business logic
// here") — recovering these leads means reverting a stamp, which belongs to the send path.
export type ShelfRow = {
  id: string;
  outreach_status: string | null;
  bundled: boolean;
  /** Has a row in `leads.outreach_sends`. `null` = the ledger could not be read. */
  emailed: boolean | null;
};

export type ShelfTally = {
  ready_to_write: number;
  bundled: number;
  /** The stamp. Counts acceptance into a campaign, which is not the same as an email. */
  already_sent: number;
  /** The send ledger. People this pipeline really emailed. Null if unreadable. */
  emailed: number | null;
  /** Stamped `sent_to_smartlead` with no send row: nobody emailed them, nothing will. */
  marked_sent_never_emailed: number | null;
  marked_sent_never_emailed_ids: string[] | null;
  total: number;
};

/** How many stranded ids a snapshot names, same cap the fleet and push blocks use. */
export const MAX_SHELF_STRANDED_IDS = 12;

/** Pure, so the shape can be asserted against a live snapshot without a database. */
export function shelfTally(rows: ShelfRow[]): ShelfTally {
  let ready = 0;
  let bundled = 0;
  let sent = 0;
  let emailed = 0;
  const stranded: string[] = [];
  // One unreadable row makes the whole ledger reading unknown. A partial count here would
  // be a smaller gap than the real one, which is the failure this field exists to stop.
  let ledgerReadable = true;
  for (const r of rows) {
    const status = r.outreach_status;
    if (status === 'ready_data_scraped' || status === 'enriched') ready += 1;
    if (status === 'sent_to_smartlead') sent += 1;
    if (r.bundled) bundled += 1;
    if (r.emailed === null) {
      ledgerReadable = false;
      continue;
    }
    if (r.emailed) emailed += 1;
    else if (status === 'sent_to_smartlead') stranded.push(r.id);
  }
  return {
    ready_to_write: ready,
    bundled,
    already_sent: sent,
    emailed: ledgerReadable ? emailed : null,
    marked_sent_never_emailed: ledgerReadable ? stranded.length : null,
    marked_sent_never_emailed_ids: ledgerReadable ? stranded.slice(0, MAX_SHELF_STRANDED_IDS) : null,
    total: rows.length,
  };
}

export async function countShelf(): Promise<ShelfTally> {
  // One query, both instruments, so they cannot be read at two different moments.
  try {
    const rows = await query<{ id: string; outreach_status: string | null; bundled: boolean; emailed: boolean }>(
      `SELECT lc.id,
              lc.outreach_status,
              (lc.enrichment_bundle_path IS NOT NULL AND btrim(lc.enrichment_bundle_path) <> '') AS bundled,
              EXISTS (SELECT 1 FROM leads.outreach_sends s WHERE s.lead_id = lc.id)              AS emailed
         FROM leads.lead_candidates lc
        WHERE lc.review_status = 'approved_hold'`,
    );
    return shelfTally(rows);
  } catch {
    // The ledger join is the only new dependency, so lose it rather than the whole block.
    const base = getBase();
    const rows = await withRetry(
      () => base(tableName()).select({
        filterByFormula: `{review_status}='approved_hold'`,
        fields: ['outreach_status', 'enrichment_bundle_path'],
      }).all(),
      'countShelf',
    );
    return shelfTally(rows.map((r) => ({
      id: r.id,
      outreach_status: (r.get('outreach_status') as string | undefined) ?? null,
      bundled: Boolean((r.get('enrichment_bundle_path') as string | undefined)?.trim()),
      emailed: null,
    })));
  }
}

export type BulkStatusWrite = {
  /** The second every row in the cluster shares, which is what makes it one statement. */
  at: string;
  review_status: string | null;
  leads: number;
  /** How many had already been emailed when the write landed. */
  already_emailed: number;
  with_email: number;
  /** The leading `[tag]` the writer stamped into `notes`, if it stamped one. */
  stamp: string | null;
  /** Reporting label only, never a selector — see the comment above. */
  left_the_send_queue: boolean;
};

// Mirrors SIEGE_REVIEW_STATUSES in automator/scripts/siege_tiers.py, which OWNS the
// definition. Duplicated here on purpose and nowhere else: this list never selects a
// lead, it only labels a line in a report, so drift mislabels a sentence in a debrief
// instead of emailing the wrong person. Do not reuse it to pick leads.
const SEND_QUEUE_STATUSES_FOR_REPORTING = ['approved_hold', 'approved', 'needs_contact'];

/**
 * Single-statement bulk rewrites of `review_status` inside a window, largest first.
 *
 * WHY THIS EXISTS (2026-10-14). The shelf fell 800 in one cycle — 7,604 to 6,804 — and
 * the only instrument that could see it was `parked.parked_today: -800`. A bare negative
 * there reads as the send path draining the bank, which is the one explanation the
 * numbers ruled out: 783 emails went out, and sending does not move a lead out of
 * `approved_hold` at all (see countShelf above). The real cause was an ICP audit Casey
 * ran at 16:26 UTC that flipped 881 leads to `rejected` and zeroed their score, 720 of
 * whom had already been emailed, and it also paused 684 live SmartLead sequences. None of
 * that is a fault — it is the correct call, with a working undo script — but finding it
 * took an hour of hand SQL across four repos, a whole-home grep, and reading a rubric out
 * of a backups folder no repo knows about.
 *
 * The cheapest detector for that entire class is the shape of the write itself. Per-lead
 * work — a push, a verify pass, an Apify batch — spreads across seconds. One UPDATE over
 * a thousand rows lands on a single second, so a second holding 50+ status rows is a bulk
 * reclassification by definition, whoever ran it. Grouping by that second and reading the
 * leading `[tag]` out of `notes` makes the write name itself: the 10-13 audit reports as
 * `881 leads -> rejected, stamp [NOT ICP 2026-10-13]`.
 *
 * Deliberately a report and not an alarm. Bulk reclassification is a normal, healthy
 * operation and the point is to put it in front of a reader beside the shelf delta it
 * explains, so nobody spends another cycle blaming the send path for a number it
 * did not move. One grouped query, no network, no model.
 *
 * It cannot prove which status a row came FROM — nothing keeps lead history — so it
 * reports the destination and the size. That is enough to separate "the shelf was
 * reclassified" from "the shelf was sent", which is the question that went unanswered.
 */
export async function bulkStatusWrites(
  sinceISO: string,
  untilISO: string,
  minLeads = 50,
): Promise<BulkStatusWrite[]> {
  const rows = await query<Record<string, string | number | Date | null>>(
    `SELECT date_trunc('second', lc.updated_at) AS at,
            lc.review_status                   AS review_status,
            count(*)                           AS leads,
            count(*) FILTER (WHERE lc.outreach_status = 'sent_to_smartlead') AS already_emailed,
            count(*) FILTER (WHERE lc.email_address IS NOT NULL)             AS with_email,
            mode() WITHIN GROUP (ORDER BY substring(lc.notes from '\\[[^\\]]{1,60}\\]')) AS stamp
       FROM leads.lead_candidates lc
      WHERE lc.updated_at >= $1
        AND lc.updated_at <  $2
      GROUP BY 1, 2
     HAVING count(*) >= $3
      ORDER BY count(*) DESC
      LIMIT 8`,
    [sinceISO, untilISO, minLeads],
  );
  return rows.map((r) => {
    const status = r.review_status === null ? null : String(r.review_status);
    return {
      at: new Date(String(r.at)).toISOString(),
      review_status: status,
      leads: Number(r.leads ?? 0),
      already_emailed: Number(r.already_emailed ?? 0),
      with_email: Number(r.with_email ?? 0),
      stamp: r.stamp === null ? null : String(r.stamp),
      left_the_send_queue: status === null
        || !SEND_QUEUE_STATUSES_FOR_REPORTING.includes(status),
    };
  });
}

export type BulkRewriteRoll = {
  review_status: string | null;
  /** EVERY row this window rewrote into this status, not just the reported clusters. */
  rows_in_window: number;
  /** How many 50+ seconds the window held. 1 is one UPDATE; 155 is a paged sweep. */
  clusters: number;
  /** Rows inside those clusters, so `rows_in_window` minus this is the per-lead tail. */
  rows_in_clusters: number;
  first_at: string | null;
  last_at: string | null;
  /** Seconds from the first cluster to the last. 0 when there is only one. */
  span_seconds: number | null;
};

/**
 * The same window as bulkStatusWrites(), rolled up per destination status with NO cap.
 *
 * WHY (2026-10-19). bulkStatusWrites() groups by the second and keeps the eight biggest,
 * which is right for the shape it was built for — one UPDATE lands on one second — and
 * wrong for a writer that pages. The weekly subscriber-floor sweep
 * (`youtube-lead-finder-v1/scripts/graduate-grown-channels.ts`, Mondays) re-checks all
 * 66,488 parked channels in batches of 50 and re-stamps every one that is still below the
 * floor. This cycle that was 38,492 rows across 155 clusters in 154 seconds, and the
 * snapshot reported the eight biggest: 2,578 leads, 6.7% of the truth, with nothing on the
 * line saying it had been cut. A reader got "2,578 leads left the send queue, 128 of them
 * with an email" for a sweep that moved almost nobody.
 *
 * So report the roll-up beside the clusters. `clusters` is the tell that separates the two
 * writers without needing to know either of them: one statement cannot spread over 155
 * seconds, and a paged re-walk of the whole book cannot land on one.
 *
 * Still no origin — nothing keeps lead history. What answers "did anybody actually move"
 * is `population_change` in bulkRewriteShape(), which reads this status's own population
 * against yesterday's snapshot.
 */
export async function bulkStatusWriteRollup(
  sinceISO: string,
  untilISO: string,
  minLeads = 50,
): Promise<BulkRewriteRoll[]> {
  const rows = await query<Record<string, string | number | Date | null>>(
    `WITH touched AS (
       SELECT date_trunc('second', lc.updated_at) AS at,
              lc.review_status                   AS review_status,
              count(*)                           AS leads
         FROM leads.lead_candidates lc
        WHERE lc.updated_at >= $1
          AND lc.updated_at <  $2
        GROUP BY 1, 2)
     SELECT review_status,
            sum(leads)                                     AS rows_in_window,
            count(*) FILTER (WHERE leads >= $3)             AS clusters,
            coalesce(sum(leads) FILTER (WHERE leads >= $3), 0) AS rows_in_clusters,
            min(at)  FILTER (WHERE leads >= $3)             AS first_at,
            max(at)  FILTER (WHERE leads >= $3)             AS last_at
       FROM touched
      GROUP BY 1
     HAVING count(*) FILTER (WHERE leads >= $3) > 0
      ORDER BY sum(leads) DESC`,
    [sinceISO, untilISO, minLeads],
  );
  return rows.map((r) => {
    const first = r.first_at === null ? null : new Date(String(r.first_at)).toISOString();
    const last = r.last_at === null ? null : new Date(String(r.last_at)).toISOString();
    return {
      review_status: r.review_status === null ? null : String(r.review_status),
      rows_in_window: Number(r.rows_in_window ?? 0),
      clusters: Number(r.clusters ?? 0),
      rows_in_clusters: Number(r.rows_in_clusters ?? 0),
      first_at: first,
      last_at: last,
      span_seconds: first === null || last === null
        ? null
        : Math.round((Date.parse(last) - Date.parse(first)) / 1000),
    };
  });
}

/**
 * Live population of every `review_status`, so tomorrow's debrief can ask whether a bulk
 * rewrite actually moved anybody. One GROUP BY over the lead table, no filter.
 *
 * This is the baseline half of the 2026-10-19 fix. A rewrite of 38,492 rows into
 * `below_threshold` whose population did not grow is a re-stamp of leads that were already
 * there; the 2026-10-13 ICP audit wrote 881 into `rejected` and that population grew by
 * 881. The sizes are indistinguishable from the write alone and obvious from the pair.
 */
export async function reviewStatusPopulation(): Promise<Record<string, number>> {
  const rows = await query<Record<string, string | number | null>>(
    `SELECT coalesce(review_status, '(null)') AS review_status, count(*) AS leads
       FROM leads.lead_candidates
      GROUP BY 1
      ORDER BY 2 DESC`,
    [],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.review_status)] = Number(r.leads ?? 0);
  return out;
}
