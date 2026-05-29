# Prompt — fix Anthropic 400 "no low surrogate in string" error

**Paste this into a Claude Code session opened in `youtube-lead-finder-v1`.**

---

## The bug

The lead-finder agent is crashing with an Anthropic 400 the moment it tries to score certain YouTube channels:

```
[runner] Unhandled error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"The request body is not valid JSON: no low surrogate in string: line 7 column 1128 (char 1234)"},"request_id":"req_011CbTify6Mdag9tjBry17hE"}
```

This is deterministic — the same channel crashes every run. The orchestrator (`youtube-outreach-orchestrator-v1`) has hit this on three separate `npm run agent` invocations today. The runner aborts after scoring exactly **1 channel**, so no new leads get written.

## Root cause

Some YouTube channel snippets (title, description, or related fields) contain **unpaired UTF-16 surrogate characters** — typically the result of upstream truncation or encoding mismatches in user-generated content. When `JSON.stringify` serializes these strings for the Anthropic request body, the resulting bytes contain lone surrogates (a `\uD800–\uDBFF` high-surrogate without its `\uDC00–\uDFFF` low-surrogate partner, or vice versa). The Anthropic API's JSON parser rejects these as invalid JSON.

This is the same class of issue any service consuming raw user content hits eventually. The fix is to sanitize strings at the boundary, before they're serialized for the API call.

## Required fix

Add a one-line sanitizer and apply it to all user-derived strings that flow into Anthropic prompts. Standard implementation:

```typescript
/**
 * Replace any unpaired UTF-16 surrogate with U+FFFD (Unicode replacement char).
 * Anthropic's JSON parser rejects lone surrogates with HTTP 400 "no low surrogate in string".
 */
export function sanitizeUnicode(s: string): string {
  return s.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    "�",
  );
}
```

(Replacing with U+FFFD is the right call over stripping — preserves the *position* of the malformed character in case it matters semantically. It's the same character browsers render for invalid bytes.)

## Where to apply it

**Find the function(s) that build Anthropic requests** — likely in `src/anthropic.ts` or `src/lib/anthropic.ts` or whatever the scoring agent uses. Then audit **every place a string from the YouTube channel snippet enters a prompt**, not just one. Common fields:

- `channel.title` / `channel.snippet.title`
- `channel.description` / `channel.snippet.description`
- `channel.snippet.customUrl`
- Any related metadata (location, country, etc.)
- Anything from `videos.list` results (video titles, descriptions)
- Anything from comments (most likely culprit — comments are user input)

Cleanest place to apply it: as a wrapper around the Anthropic client call itself, sanitizing each `messages[].content` text block before `JSON.stringify`. That catches everything regardless of where the bad string originated.

Pseudo-pattern:

```typescript
const sanitizedMessages = messages.map(m => ({
  ...m,
  content: typeof m.content === "string"
    ? sanitizeUnicode(m.content)
    : m.content.map(c => c.type === "text" ? { ...c, text: sanitizeUnicode(c.text) } : c),
}));

const response = await anthropic.messages.create({ ...params, messages: sanitizedMessages });
```

A field-by-field approach (sanitizing each channel attribute at extraction time) also works, but the wrapper approach is safer — single chokepoint, can't be forgotten when new fields are added.

## What to verify

1. **`sanitizeUnicode` helper exists** somewhere centralized (`src/lib/text-sanitize.ts` or similar).
2. **All Anthropic API calls** in this repo route through code that sanitizes their inputs. Run a quick `grep -rn "anthropic.messages.create\|claude.messages\|/v1/messages"` to find every call site and confirm they're all covered.
3. **Quick test** — either a unit test or an inline assertion that:
   - `sanitizeUnicode("hello")` returns `"hello"` (unchanged)
   - `sanitizeUnicode("hi 👋 there")` returns `"hi 👋 there"` (properly-paired emoji untouched)
   - `sanitizeUnicode("bad\uD83Dchar")` returns `"bad�char"` (lone surrogate replaced)

## Constraints

- Don't change scoring logic, prompts, or any other behavior. This is a sanitization-only fix.
- Don't change anything outside the Anthropic call path. (Specifically, do **not** sanitize before writing channel data to Airtable — Airtable handles unicode fine; we only need sanitization at the Anthropic boundary.)
- Keep the diff small. Estimate ~30–50 lines including the helper, tests, and applying it at the call sites.

## When done

Confirm to Casey:

1. `sanitizeUnicode` helper added at `<path>`.
2. Every Anthropic call site routes through it. List the call sites you found.
3. Diff size.
4. A quick before/after note: ran the agent locally with a known bad-surrogate string and it succeeded (or, "couldn't repro locally but the wrapper now sanitizes at the API boundary regardless").

After confirmation, Casey will re-run the orchestrator's finder loop in `youtube-outreach-orchestrator-v1` and we'll know within one minute whether the bug is killed.
