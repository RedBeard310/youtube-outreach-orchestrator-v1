import Airtable, { type FieldSet } from 'airtable';

export type ReviewStatus =
  | 'unreviewed'
  | 'approved'
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
  | 'enriched'
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
}

// Note: `failed` and `deep_research_failed` are intentionally NOT terminal.
// The orchestrator auto-retries them on the next tick (most failures here are
// transient — YouTube quota, Airtable timeouts, etc.). For genuinely broken
// leads, that means we'll keep re-driving them indefinitely; that's the
// accepted trade-off (no failure-count bounding in v1).
//
// `deep_research_in_progress` IS terminal — once set, the orchestrator does not
// auto-restart mid-flight runs. Manual intervention required for stuck leads.
const APPROVED_TERMINAL = new Set<OutreachStatus>([
  'sent_to_smartlead',
  'no_email_found',
  'email_invalid',
]);

const D100_TERMINAL = new Set<OutreachStatus>([
  'deep_research_complete',
  'deep_research_in_progress',
  'no_email_found',
  'email_invalid',
]);

function getBase() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.LEAD_BASE_ID;
  if (!apiKey) throw new Error('AIRTABLE_PAT is not set');
  if (!baseId) throw new Error('LEAD_BASE_ID is not set');
  return new Airtable({ apiKey }).base(baseId);
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
  };
}

export async function getLeadsForOrchestration(): Promise<Lead[]> {
  const base = getBase();
  const formula = `OR({review_status}='approved', {review_status}='D100')`;
  const records = await base(tableName()).select({ filterByFormula: formula }).all();
  const leads = records.map(recordToLead);

  return leads.filter(l => {
    const status = l.outreach_status;
    if (l.review_status === 'approved') return !status || !APPROVED_TERMINAL.has(status);
    if (l.review_status === 'D100') return !status || !D100_TERMINAL.has(status);
    return false;
  });
}

export async function getLeadsByIds(ids: string[]): Promise<Lead[]> {
  if (ids.length === 0) return [];
  const base = getBase();
  const conditions = ids.map(id => `RECORD_ID()='${id}'`).join(',');
  const formula = `OR(${conditions})`;
  const records = await base(tableName()).select({ filterByFormula: formula }).all();
  return records.map(recordToLead);
}

export async function getLeadsDiscoveredSince(sinceISO: string): Promise<Lead[]> {
  const base = getBase();
  const formula = `IS_AFTER({first_discovered_at}, "${sinceISO}")`;
  const records = await base(tableName()).select({ filterByFormula: formula }).all();
  return records.map(recordToLead);
}

export async function updateLead(id: string, fields: Partial<FieldSet>): Promise<void> {
  const base = getBase();
  await base(tableName()).update([{ id, fields }]);
}
