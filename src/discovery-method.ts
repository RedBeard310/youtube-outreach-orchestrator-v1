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
  | 'video_graph_sweep'
  | 'comment_sweep'
  | 'peer_network'
  | 'guest_link_mining'
  | 'podcast_crossover'
  | 'unregistered'
  | 'unknown';

// Longest prefix first: 'video-graph:' must be tested before 'graph:' would ever be
// loosened to a contains-check, and 'peer-comment:' before any future 'peer:'.
const PREFIXES: ReadonlyArray<readonly [string, DiscoveryMethod]> = [
  ['video-graph:', 'video_graph_sweep'],
  ['peer-comment:', 'peer_network'],
  ['peer-guest:', 'guest_link_mining'],
  ['graph:', 'recommended_videos_feed'],
  ['comment:', 'comment_sweep'],
  ['podcast:', 'podcast_crossover'],
];

// A tag written by a daemon: a lowercase hyphenated word immediately followed by a colon,
// no space. Every prefix above matches it. Checked against 15,578 genuine keyword rows
// from the last month: zero of them match, so this cannot mistake a real search term for
// a daemon tag.
const TAG_SHAPE = /^[a-z][a-z0-9_-]*:/;

export function discoveryMethod(discoveredVia: string | null): DiscoveryMethod {
  if (!discoveredVia) return 'unknown';
  let first = '';
  try {
    const arr = JSON.parse(discoveredVia) as unknown;
    first = Array.isArray(arr) && typeof arr[0] === 'string' ? arr[0] : '';
  } catch {
    first = discoveredVia;
  }
  for (const [prefix, method] of PREFIXES) {
    if (first.startsWith(prefix)) return method;
  }
  // Tagged by SOMETHING, but not by anything this file knows about — a lane that shipped
  // without being registered here. Name it rather than absorbing it (see below).
  if (TAG_SHAPE.test(first)) return 'unregistered';
  return 'keyword_search';
}

/**
 * Report label. Same as `discoveryMethod`, except an unregistered lane is named by its own
 * prefix (`unregistered:video-graph`) so the daily debrief says which one it is.
 */
export function discoveryReportKey(discoveredVia: string | null): string {
  const method = discoveryMethod(discoveredVia);
  if (method !== 'unregistered') return method;
  let first = discoveredVia ?? '';
  try {
    const arr = JSON.parse(first) as unknown;
    if (Array.isArray(arr) && typeof arr[0] === 'string') first = arr[0];
  } catch {
    /* not JSON; use the raw value */
  }
  return `unregistered:${first.slice(0, first.indexOf(':'))}`;
}

/** The daemons that write into the lead base alongside a finder pass. */
export const SWEEP_METHODS: ReadonlySet<DiscoveryMethod> = new Set<DiscoveryMethod>([
  'recommended_videos_feed',
  'video_graph_sweep',
  'comment_sweep',
  'peer_network',
  'guest_link_mining',
  'podcast_crossover',
  'unregistered',
]);

// Everything that is NOT a recognised sweep counts as the keyword engine — including
// 'unknown'. That direction is deliberate: if attribution ever breaks (field renamed,
// value blanked, a new writer with no prefix), the finder over-counts exactly as it does
// today rather than reading zero on every pass. A fake zero would make every pass "fade"
// and send the campaign into permanent discovery churn, which is the worse failure.
//
// 'unregistered' is the ONE exception, added 2026-08-18 after the case the comment above
// predicted actually happened. `video-graph-sweep.ts` shipped on 08-17 tagging its rows
// `video-graph:`, which no branch here matched, so 3,279 of its channels and 206 of its
// leads were reported as keyword-search output — while the keyword engine itself found
// 223. The finder also counted them as its own per-pass yield, which is the exact
// inflation this file was written in 2026-08-10 to stop.
//
// So: a row carrying a daemon-shaped tag is never the keyword engine, whether or not this
// file has heard of the daemon. The fail-safe still covers every case the comment above
// lists, because all of those produce a null or an untagged term, not a tagged one.
export function isKeywordEngineLead(lead: { discovered_via: string | null }): boolean {
  return !SWEEP_METHODS.has(discoveryMethod(lead.discovered_via));
}
