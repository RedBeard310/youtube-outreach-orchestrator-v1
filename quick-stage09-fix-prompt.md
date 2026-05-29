# Prompt — fix stage-09 TypeError on malformed Sonnet tool output

**Paste this into a Claude Code session opened in `quick-youtube-channel-research-v1`.**

---

## The bug

Stage 09 (competitor discovery) crashes mid-enrichment with:

```
TypeError: (rankResult.input.ranked ?? []).filter is not a function
    at runStage09 (src/lib/pipeline/stage-09-competitor-discovery.ts:318:55)
```

This killed a successfully-verified lead's enrichment in the orchestrator pipeline today. It's deterministic per-channel and reproducible.

## Root cause

[stage-09-competitor-discovery.ts:283](src/lib/pipeline/stage-09-competitor-discovery.ts#L283) calls `anthropic.toolCall<RankingToolResult>` with a tool schema declaring `ranked` as an array. The TypeScript type and the existing comment at line 315 (`// Sonnet occasionally emits entries missing required fields despite the tool schema`) both acknowledge that Sonnet's tool output is unreliable.

The current guard at line 318 only handles `null`/`undefined`:

```typescript
const validRanked = (rankResult.input.ranked ?? []).filter(...)
```

But Sonnet apparently also sometimes returns `ranked` as a **non-array** value (likely an object — e.g. `{ "0": {...}, "1": {...} }` — or possibly a string of JSON). `??` doesn't catch that, so `.filter` blows up.

## Fix

One-line change at [stage-09-competitor-discovery.ts:318](src/lib/pipeline/stage-09-competitor-discovery.ts#L318): replace the nullish-coalesce guard with an `Array.isArray` guard.

```typescript
// Before
const validRanked = (rankResult.input.ranked ?? []).filter(
  (r) => typeof r.candidate_id === "string" && r.candidate_id.startsWith("cand"),
);

// After
const rankedRaw = Array.isArray(rankResult.input.ranked) ? rankResult.input.ranked : [];
const validRanked = rankedRaw.filter(
  (r) => typeof r.candidate_id === "string" && r.candidate_id.startsWith("cand"),
);
```

Also extend the comment at line 315 to mention the new failure mode you're guarding against:

```typescript
// Guard: Sonnet occasionally emits a malformed `ranked` field — either entries
// missing required keys, or `ranked` as a non-array (object/string) despite the
// tool schema. Coerce to `[]` and drop unusable entries before sorting.
```

That's it. ~3 lines changed. No other behavior changes.

## Why not also log the malformed payload?

Worth doing — when this guard fires, you lose competitor-discovery output silently. Add a `console.warn` if the raw `ranked` is non-null but not an array, so the next time it happens you can capture an example and decide whether to retry the tool call or escalate the prompt:

```typescript
const raw = rankResult.input.ranked;
const rankedRaw = Array.isArray(raw) ? raw : [];
if (raw != null && !Array.isArray(raw)) {
  console.warn(
    `[stage-09] Sonnet returned non-array \`ranked\` (type=${typeof raw}); proceeding with 0 algorithmic competitors. Sample:`,
    JSON.stringify(raw).slice(0, 500),
  );
}
```

## Constraints

- **Don't change the prompt, the tool schema, the ranking model, or anything else in stage 09.** This is a defensive-guard fix only.
- **Don't touch other stages** — the orchestrator depends on the rest of this pipeline working exactly as it does.
- Keep the diff tiny (~5–10 lines including the warn).

## When done

Tell me:
1. The diff (paste it).
2. Confirm only stage-09 was touched.
3. Whether tests pass (`npm test` if there is one).

Then I'll re-run the orchestrator's tick and we'll see the warn fire (or not) on the next crash-prone channel.
