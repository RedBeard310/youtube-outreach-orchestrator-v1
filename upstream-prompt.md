# Prompt for `youtube-email-outreach-v1` cleanup session

**Paste this into a Claude Code session opened in the `youtube-email-outreach-v1` repo.**

---

I need to make two small, additive changes to `src/cli/outreach.ts` so that an external orchestrator can drive this repo cleanly. Both changes must be backward-compatible — existing invocations using `--lead-id <singleId>` and the full find→verify→enrich→compose→push flow must keep working exactly as today.

## Change 1 — `--stop-after <stage>` flag

Add a new optional flag `--stop-after <stage>` where `<stage>` is one of:

- `find`
- `verify`
- `enrich`
- `compose`
- `push`

Behavior: after the named stage completes successfully for a lead, skip the remaining stages, update `outreach_status` to reflect where we stopped, and exit cleanly. If the stage itself fails, behave as today (the existing state machine handles it).

When the flag is omitted, the CLI runs all stages as it does today.

**Why this is needed:** an orchestrator will run d100-tagged leads through find + verify only — they should not be enriched (quick), composed, or pushed to SmartLead. A different repo handles their enrichment.

## Change 2 — Bulk `--lead-ids` input

Currently the CLI accepts `--lead-id <singleId>` (one lead per process). Add support for processing many leads in one process:

- `--lead-ids id1,id2,id3,…` (comma-separated list), AND
- `--lead-ids-file <path>` (newline-delimited file of IDs, useful when the list is long enough to bump up against shell arg limits)

Either form should iterate the leads through the existing per-lead pipeline, respecting `--concurrency` if it's set. Per-lead failures should not abort the batch — log them and continue, same as the repo handles single-lead failures today.

When neither form is provided, the existing `--lead-id` behavior must work unchanged.

## Constraints

- Both changes are **additive**. No existing flag, behavior, or status transition changes.
- Keep the code change small — target ~35 lines total across both. If you find yourself rewriting `outreach.ts`'s pipeline, stop and ask.
- Don't add retry logic, alerting, or any new state fields. The orchestrator handles cross-tick scheduling; this repo's job remains per-lead execution.
- Update the repo's README (or wherever flags are documented) with the new flags.

## When done

Confirm back to Casey that:
1. `--stop-after <stage>` works for all five stages.
2. `--lead-ids` and `--lead-ids-file` both work and respect `--concurrency`.
3. Existing single-lead invocations are unchanged.
4. The diff is roughly the size promised (no scope creep).

Casey will then tell the orchestrator session that the upstream changes have landed.
