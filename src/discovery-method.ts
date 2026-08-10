// Which discovery method wrote a lead row.
//
// `discovered_via` is a JSON-array string (see the Lead type in airtable.ts); the FIRST
// entry's colon-prefix names the method. A bare term with no prefix is the keyword
// engine — the original method, so it never got a tag of its own.
//
// WHY THIS IS SHARED (2026-08-10). It used to live only in debrief-data.ts, purely for
// the daily report. It now also gates the finder's own per-pass yield. Since 2026-08-08
// three sweep daemons (recommended-videos feed, comment-sweep, peer-sweep) write into the
// SAME lead base continuously, and the finder measures a pass by diffing that base since
// the pass started — so every daemon row landing mid-pass was being counted as the pass's
// own yield. On 2026-08-10 the campaign's per-pass counters read 4,218 new leads / 762
// fresh pitchable while the keyword engine actually wrote 1,017 / 255. That inflation
// feeds the fade detector, which is what pivots a mined-out term slice into discovery.
// See campaign.ts's fade check and lead-finder.ts's buildBreakdown.
export type DiscoveryMethod =
  | 'keyword_search'
  | 'recommended_videos_feed'
  | 'comment_sweep'
  | 'peer_network'
  | 'guest_link_mining'
  | 'podcast_crossover'
  | 'unknown';

export function discoveryMethod(discoveredVia: string | null): DiscoveryMethod {
  if (!discoveredVia) return 'unknown';
  let first = '';
  try {
    const arr = JSON.parse(discoveredVia) as unknown;
    first = Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : '';
  } catch {
    first = discoveredVia;
  }
  if (first.startsWith('graph:')) return 'recommended_videos_feed';
  if (first.startsWith('peer-comment:')) return 'peer_network';
  if (first.startsWith('peer-guest:')) return 'guest_link_mining';
  if (first.startsWith('comment:')) return 'comment_sweep';
  if (first.startsWith('podcast:')) return 'podcast_crossover';
  return 'keyword_search';
}

/** The daemons that write into the lead base alongside a finder pass. */
export const SWEEP_METHODS: ReadonlySet<DiscoveryMethod> = new Set<DiscoveryMethod>([
  'recommended_videos_feed',
  'comment_sweep',
  'peer_network',
  'guest_link_mining',
  'podcast_crossover',
]);

// Everything that is NOT a recognised sweep counts as the keyword engine — including
// 'unknown'. That direction is deliberate: if attribution ever breaks (field renamed,
// value blanked, a new writer with no prefix), the finder over-counts exactly as it does
// today rather than reading zero on every pass. A fake zero would make every pass "fade"
// and send the campaign into permanent discovery churn, which is the worse failure.
export function isKeywordEngineLead(lead: { discovered_via: string | null }): boolean {
  return !SWEEP_METHODS.has(discoveryMethod(lead.discovered_via));
}
