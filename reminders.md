# Reminders — things to come back to

Ideas/refinements parked for later. Logged here intentionally WITHOUT making the
change yet. Each entry: the idea, why, current state, and any gotcha to respect
when actually implementing.

---

## [2026-06-07] Rank no-host channels BELOW host-found channels (not just neutral)

**Idea (Casey):** Channels with no identified host should still flow all the way
through to the enrichment step and the final manual-approval queue (they already
do — the host *gate* was removed in C1, and on 2026-06-07 the −2 no-host scoring
penalty was zeroed out as part of the "D" fix). But rather than treating no-host
as fully neutral, score host-found channels *higher* than otherwise-identical
no-host channels, so when reviewing the queue the leads with a real personal host
sort to the top. Both still reach manual approval; host-found just ranks above.

**Why:** a real personal host is a mild positive (more personal greeting, likely
higher reply rate), so it's a sensible tiebreaker. Zeroing the penalty to make the
≥6 bar "real" flattened this host vs no-host distinction.

**Current state (so the next session has context):**
`youtube-lead-finder-v1/src/scoring/schema.ts` — `no_host_identified` weight is
currently `0` (was `-2`). `high_ticket_signal` is `2` (was `1`). These two changes
are what made ≥6 the real approval bar. See memory `finder-host-gate-and-score-todos` (D, FIXED 2026-06-07).

**GOTCHA — do NOT just set the no-host weight back to a small negative.** The
approval bar is `signal_score >= 6`. A strong no-host business currently scores
exactly 6 (niche 1 + business_domain 2 + expertise 1 + high_ticket 2). Any negative
no-host weight (e.g. −1) drops it to 5 → below the bar → it never reaches approval,
which re-breaks the exact thing the D fix solved. So a naive penalty defeats the goal.

**Cleaner ways to get "host ranks higher, no-host still clears ≥6" (pick when implementing):**
1. **Host BONUS instead of no-host penalty** — add a small `+1` for a *confidently
   identified host* (host-found → 7, no-host → 6; both clear ≥6, host sorts above).
   Requires bumping MAX and re-checking the dead-zone shape.
2. **Secondary review sort key** — leave scores equal at ≥6, but sort/group the
   manual-approval view by `host_name_confidence` (high first) as a tiebreaker.
   Zero scoring-math risk; pure presentation. Probably the safest option.

**Status:** NOT implemented. Revisit after the current 70-lead pipeline run.

---

## [2026-06-07 → RESOLVED 2026-06-11] Auto-approve — now ON, gated at signal_score ≥ 6

~~Casey's call (2026-06-07): the ≥6 approval step stays manual as the standing policy.~~

**RESOLVED 2026-06-11 — auto-approve is now the standing default, but ONLY for leads
with `signal_score >= 6`.** Casey: "We can auto-approve, but only if we get a signal
score of at least six." So bulk runs may programmatically set `review_status=approved`
on ≥6 leads (recomputed new-weight score) without a manual checkpoint; anything below
6 is NOT auto-approved. This is what the approve scripts already do — now explicitly
sanctioned, no longer a per-batch one-off. See memory `auto-approve-at-6`.

---

## [2026-06-07] Mega-creator (whale) exclusion — better signal than a raw sub cap

This run used a blunt **>800k subscriber hard cap** (removed Hormozi 4.25M, Matthew
Hussey 3.41M, Codie Sanchez 2.18M). Casey is open to a smarter signal. Options,
best-first:
1. **"Media brand vs service practitioner" Haiku check at scoring** — the real ICP
   boundary: takes on clients vs personal-brand/course-and-community at scale. Most
   precise; needs a `youtube-lead-finder-v1` scoring-prompt change + a new signal.
2. **Sub count as a SOFT scoring penalty** (not a hard cap) — e.g. −2 above ~600k,
   −3 above ~1M. Tunable, uses data we already fetch (`subscriber_count`). Quick win.
3. **Tighten `pure_course_seller` disqualifier** — whales monetize via courses/community.
NOTE: Casey has real clients ~250k subs, so any cap/penalty must stay well above that
(800k cap was chosen for headroom). NOT implemented — revisit with the finder scoring.
