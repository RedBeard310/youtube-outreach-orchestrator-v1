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

---

## [2026-07-16] Buy "similar channels" from a third party instead of scraping for it

**Idea (Casey):** Tools like the **vidIQ** Chrome extension show a "similar channels"
list when you open a channel page. Casey's read: *vidIQ's own suggestions are awful* —
but the **category of product** is right. If some vendor maintains a genuinely good
channel-similarity graph, we buy an API call instead of scraping YouTube for it.

**Why this matters more than it looks.** Our home-grown answer to "who else is like this
guy?" is structurally fragile, and we proved it the same day:
- YouTube **killed the `relatedToVideoId` API in Aug 2023**. There is no official
  "similar channels" endpoint. There never was a channel-level one.
- So `watchNextEdge` scrapes the watch page for the recommendation rail — free, ToS-gray,
  and on 2026-07-16 it started returning **HTTP 429 after only ~80 fetches** from this VPS.
  A 2,024-seed sweep needs 2,024 fetches.
- The one *legitimate* edge (`sectionsEdge` → `channelSections.list`) came back **empty on
  16 of 17 modal seeds** — small practising firms never configure a featured-channels shelf.

A paid similarity API would replace a brittle scrape with a supported call, and sidestep
the rate limit entirely. That's the whole appeal — not better data, just data we're
allowed to fetch at volume.

**Current state (context for whoever picks this up):**
The graph walker is built and measured. `youtube-lead-finder-v1/src/discovery/graph/`
(`edges.ts`, `candidates.ts`), `scripts/graph-probe.ts` (kill gate), `scripts/graph-sweep.ts`
(the one-time backlog sweep — written, **never completed a run**, blocked by the 429).
Measured on 20 modal seeds: **83.8% net-new** vs all 3,856 search terms (the real asset),
but only **10.0% ICP precision** — the modal-seed hypothesis failed. ~0.6 leads/seed.
Casey's call: wait out the 429 rather than buy rotating IPs. *Days instead of hours is
fine.* IP rotation stays on the table as the other way to solve the same problem.

**GOTCHAS when evaluating a vendor — these are what will actually decide it:**
1. **"Similar" for competitor research ≠ similar for us.** These tools are built for
   creators sizing up rivals, so they optimise for audience overlap and surface *big*
   channels. We want 5k-sub practising attorneys. That is precisely the failure mode our
   first probe found: walking from 19M-sub LegalEagle returned Kurzgesagt / CGP Grey.
   A vendor tuned for overlap will reproduce it. Casey's "vidIQ is awful" is probably
   this exact mismatch, not a quality bug.
2. **Do not pay before probing.** `graph-probe.ts` is already the right harness — swap the
   edge for the vendor's API, keep everything else, and read the same two numbers on a
   free trial: **net-new rate** (must stay ~80%+ — a vendor whose graph mirrors YouTube
   search is worthless to us, since we've mined 3,856 terms) and **ICP precision** (the
   10% baseline is the bar to beat; below it the vendor buys us nothing but legitimacy).
3. **Precision must beat 10% by a lot to justify money.** The current mechanism is free.
   A vendor has to earn its cost with either much better precision *or* the ability to run
   at 2,024-seed volume without a 429 — the second is likely the real value.
4. **Check the ToS for lead-gen use**, not just scraping. Some creator-analytics vendors
   forbid using their data to build prospect lists.
5. Candidates to look at (all unverified — none confirmed to expose this via API):
   vidIQ, Social Blade, ChannelCrawler, Tubular Labs, NoxInfluencer, Modash, HypeAuditor.
   Influencer-marketing platforms are the more promising shelf than creator-SEO tools,
   because lookalike-discovery *is* their product.

**Status:** NOT implemented, not researched. Parked pending the 429 wait-out.

---

## [2026-07-27] Model bakeoff + bundle backfill (pick the models, then backfill everything)

**Idea (Casey):** Test a lot of different models across the pipeline, see how they
perform, run the backfill on existing bundles, and assign the winners to all current
and future scraping. Evaluate at two stages: **(a) data collection** — mining insights,
enemies, and offers — and **(b) which model writes the email** using
`cold-email-attack-enemies-propose-script-v1`. Use a frontier model (Opus 5 / Fable 5)
as the brain. Surface the results through a **Variation Chooser** artifact: models doing
a genuinely bad job never reach Casey; the decent ones get shown side by side and
Casey + the LLM pick the best cost-to-performance point together.

**Why:** The research repo is now fully model-agnostic (2026-07-27) — every LLM call
resolves a *task* to a model string from env, and any string routes to Anthropic,
OpenRouter, or an OpenAI-compatible gateway. Nothing is model-locked any more, so the
only thing standing between us and much cheaper scraping is evidence. Casey's stated
target is **cost at much larger scale** (thousands of bundles/month), where the Haiku↔Sonnet
gap compounds into real money — so cheap models should be pushed to their breaking point,
not politely sampled.

**Current state (context for whoever picks this up):**
- `quick-youtube-channel-research-v1/src/lib/models.ts` — the only file naming a model.
  Tasks resolve via `resolveTaskModel()` → per-task env → `LLM_DEFAULT_MODEL` /
  `LLM_DEFAULT_FAST_MODEL` → built-in fallback.
- `.../src/lib/llm.ts` — `[provider:]model-id` routing (`openrouter:`, `openai-compat:`).
  `LLM_TOOL_MODE=json` for models with weak tool support; native mode auto-salvages JSON.
- `.../src/lib/pricing.ts` — OpenRouter reports true per-request spend; anything else
  needs `LLM_PRICING_JSON`.
- `.../scripts/backfill-bundle-banks.ts` — regenerates insights / analysis / enemies /
  offer from disk. `--estimate` is a free dry run with a cross-model cost table.
- `offer.md` is wired into `export-run.ts`, so **all new enrichments already get it**.
- 98 bundles exist on the VPS (`youtube-email-outreach-v1/enrichment-bundles/`), **none**
  have the four files. Measured: 15 transcripts ≈ 38k tokens ≈ $0.19 (Haiku) / $0.56
  (Sonnet 4.6) per bundle for all four steps.
- **Nothing has been run.** No backfill, no sweep.

### The plan

**Phase 0 — Build the grading harness first (no LLM, cheap, most valuable piece).**
`scripts/grade-bundle-banks.ts` in the research repo. Purely mechanical groundedness checks
against `researched/transcripts/*.md`:
- every `**Their words:**` quote in `enemies-bank.md` → verbatim substring present? (binary)
- every "appears in N videos" → recount and compare
- every `offer.md` pitch quote → verbatim present?
- every `offer.md` URL → does it actually appear in `channel.md` / `pinned-comments.md`?
- every `insights-bank.md` quote → verbatim present?
Emits per-run JSON: quote-hit rate, invented-URL count, recurrence-count error, plus volume
(enemies kept, insights kept, offer found/not). **This is the auto-reject gate.**
Proposed floors: quote hit ≥95%, invented URLs = 0, recurrence error ≤1 video.

**Phase 1 — Freeze a fixed sample.** 6 bundles, recorded by recId, chosen for spread:
obvious paid offer / no discernible offer (the hallucination trap) / hot contrarian creator /
measured B2B finance-legal / thin transcripts / very long transcripts. Copy each to
`bakeoff/<model-slug>/<recId>/` and run the backfill on the copies — it writes in place,
so variants need separate dirs. **No code change needed.**

**Phase 2 — Sweep arm (a).** Proposed slate (Casey edits; verify IDs + prices on OpenRouter
at run time, they're needed for `LLM_PRICING_JSON` anyway):
Haiku 4.5 (cheap baseline) · Sonnet 4.6 (control, current default) · Sonnet 5 ·
`openrouter:google/gemini-2.5-flash` · `openrouter:qwen/...` · `openrouter:moonshotai/kimi-k2` ·
`openrouter:deepseek/...`. Sweep only the 5 tasks that reach the email — insights, enemies,
offer, examples, icp. (Stages 5/6/7/11 never run in quick mode; their model vars are moot.)
Cost ≈ 6 bundles × 7 models × ~$0.35 ≈ **$15**.

**Phase 3 — Grade, then gate, then judge.** Mechanical grader on all outputs → auto-reject
below floor → frontier judge (Opus 5) on **survivors only**, blind and paired, scoring enemy
centrality, quote fidelity, offer correctness, and usefulness-for-email. ≈$5–10.

**Phase 4 — Variation Chooser artifact.** Self-contained HTML in the shape of
`casey-assistant/deliverables/oleg-idea-card-layout-variations.html` (filter bar, chips, cards):
one card per surviving model × bundle showing top-3 enemies, the offer block, groundedness
numbers, and $/bundle. Auto-rejected models go in a collapsed section **with the reason**, so
Casey can see why something was cut without reading it. Casey + LLM pick jointly.

**Phase 5 — Arm (b), BLOCKED.** Deferred by Casey's call until the skill exists. Three unblocks
required, in order: (1) `cold-email-attack-enemies-propose-script-v1` pushed from the Mac —
it does not exist on the VPS, and the installed `cold-email-attack-enemies-v1` is **opener-only**;
(2) installed into `~/.claude/skills/` (the repo `claude-skills/` is a superset — attack-enemies
is not installed); (3) the email repo made model-agnostic — it hard-codes `claude-opus-4-7` at
`youtube-email-outreach-v1/src/writer/compose.ts:11` and `compose-nick-saraev.ts:28`, plus Haiku
at `host-name.ts:8` and `email/finder-llm.ts:19`. Port `models.ts` + `llm.ts` across. Then sweep
writer models against the **winning bank from arm (a)** and judge against the golden corpus.

**Phase 6 — Roll out.** Canary first: set the winner in the research repo's `.env`, run ~5 new
enrichments, re-run the grader, confirm numbers match the bakeoff. Record the previous `.env`
values so rollback is one edit. Only then backfill all 98 (`--i-know-the-cost`).

### GOTCHAS — these are what will actually decide it

1. **A frontier model choosing the roster is the wrong job for it.** Which models to test is a
   price-list lookup; Casey can do it in ten minutes on OpenRouter. Where a smart model genuinely
   earns its cost is as the **judge** of outputs. Spend it there.
2. **LLM judging without ground truth rewards confident hallucination.** Handed two enemies banks
   and asked "which is better," a judge prefers the more assertive, more elaborate one — which is
   exactly backwards, because the thing that kills a cold email is a confidently invented enemy or
   a misattributed quote. This is why Phase 0 (mechanical verbatim checking) comes **before** any
   judging, and why it is the gate rather than a tiebreaker.
3. **Do not sweep `INSIGHTS_BASELINE_MODEL`.** The insights bank measures novelty as a *differential*
   between the miner and a deliberately average baseline. Cheapen both and they converge, novelty
   scoring collapses into noise, and the bank silently fills with generic takes that still *look*
   fine. Hold the baseline fixed and cheap by design; sweep the miner only.
4. **n=1 will produce noise, not a decision.** Same frozen sample for every model, and run at least
   one model **twice** to measure run-to-run variance before believing any between-model gap.
5. **Judge the emails, not the banks — eventually.** A cheap miner can produce a bank that reads
   fine and still yields worse emails. Arm (a) results are provisional until arm (b) confirms them;
   don't lock a model into `.env` permanently on arm (a) alone.
6. **Autopilot picks this up unattended.** Once the winner is in the research repo's `.env`, the
   always-on campaign loop uses it on every new bundle with nobody watching. A bad choice degrades
   silently until a debrief catches it — hence the canary and the recorded rollback values.
7. **Cost accounting is only automatic on OpenRouter** (it reports true per-request spend). Gemini
   via Google's own endpoint, or any other gateway, needs prices in `LLM_PRICING_JSON` or every
   cost line reads $0.00.
8. **`--estimate` is a heuristic** (~4 chars/token × per-step pass multipliers), fine for choosing
   between models, not a quote. The real number is the cost line each generator prints.

**Status:** NOT started. Research repo is ready; grading harness and Variation Chooser are not
built. Arm (b) blocked on the skill.
