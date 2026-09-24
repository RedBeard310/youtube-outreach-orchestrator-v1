import PipelineDb, { type FieldSet } from 'pipeline-db/sdk';

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
// needed. LEAD_BASE_ID is the old Airtable base id; pipeline-db accepts it and ignores it.
function getBase() {
  const baseId = process.env.LEAD_BASE_ID;
  if (!baseId) throw new Error('LEAD_BASE_ID is not set');
  return new PipelineDb().base(baseId);
}

// A database call can fail on a passing blip (a dropped connection or a timeout).
// Before the 2026-08-12 move to Postgres, Airtable threw transient 5xx "Try again"
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
