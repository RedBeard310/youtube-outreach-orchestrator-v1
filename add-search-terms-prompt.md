# Prompt — bulk-add new search terms

**Paste this into a Claude Code session opened in `youtube-lead-finder-v1`. Attach the Excel sheet of new terms.**

---

## Context

I'm hitting a wall on lead discovery. The orchestrator that drives this repo has been running the lead-finder (`npm run agent`) repeatedly, but **all 72 active search terms in the `search_terms` table are now `paused`.** The auto-pause logic (overlap on two consecutive runs → `status=paused`) correctly detected that my current term list has been exhausted of fresh channels — every recent run produced mostly duplicates of channels already in `lead_candidates`.

In other words: the lead-finder isn't broken. The term list is the bottleneck. I need fresh discovery surface.

## What I need

I have an Excel sheet attached with new search terms — niches, sub-niches, angles, market verticals — that I want to add to the `search_terms` table. After they're added the lead-finder will have fresh terms to work with on its next run.

### Step 1 — bulk-add the terms

Parse the attached sheet and write each term as a new row in `search_terms` (Airtable base `appenY7r5jlZMRpJ0`). For each new row:

- `term` — the search term itself, as-is from the sheet
- `status` — `active`
- `priority_score` — use whatever standard initial value this repo uses for new terms (check `scripts/add-new-terms.ts` or wherever the canonical add path lives — don't invent a number)
- Set any other fields the schema requires for new terms (e.g., `runs_executed` = 0, blank stats)

**Dedup carefully.** Before inserting, check whether each term already exists in the table (any status: active, paused, or dead). If it does:
- If existing status is `paused` or `dead` and the user's intent is clearly to revive it: flag it for me to decide rather than auto-flipping.
- Otherwise skip it as a duplicate.

Report at the end:
- N terms parsed from the sheet
- N inserted as new
- N skipped (duplicate of existing active)
- N flagged (duplicate of paused/dead — needs my call)

### Step 2 — audit the 72 paused terms (optional but recommended)

Some of those paused terms may have been auto-paused prematurely (e.g., one or two runs ago when the channel space was different, or because of a brief overlap warning). Worth a quick look.

For each of the 72 paused terms, show me:
- `term`
- `runs_executed`
- `priority_score` at time of pause
- `last_run_date`
- `last_run_new_channels`

Sort by descending `priority_score` so I can spot any that were performing well right before the pause flipped them.

Don't re-activate any automatically — just give me the list. I'll pick which ones (if any) to manually flip back to `active` for one more shot.

### Step 3 — sanity check

Once new terms are added, confirm:
- Total `search_terms` count
- Count by status (active / paused / dead)
- Top 10 newly-added terms by their initial priority_score

## Notes / guardrails

- **Don't run the agent.** Don't run `npm run agent` to test. The orchestrator handles invocation; my job here is just expanding the term inventory.
- **Don't touch the auto-pause logic.** If you have opinions about whether 2-consecutive-overlap is too aggressive, mention them at the end but don't change the code.
- **Don't deactivate or modify existing rows.** The 72 paused terms stay paused unless I explicitly say otherwise.
- **Idempotent if re-run.** If I re-paste the same Excel sheet later, the dedup should catch everything as already-inserted, no new rows.

## When done

Tell me:
1. Final counts (inserted / skipped / flagged-for-decision)
2. Anything in the sheet that looked malformed or ambiguous
3. The list of paused terms worth re-activating (step 2)

Then I'll head back to the orchestrator and resume the discovery loop with the refreshed term list.
