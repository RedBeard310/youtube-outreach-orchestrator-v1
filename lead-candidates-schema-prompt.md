# Prompt — document the `lead_candidates` schema

**Paste this into a Claude Code session opened in `youtube-email-outreach-v1`.**

---

I'm building an orchestrator that drives this repo plus a deep-research repo. To wire the deep-research path correctly, I need an accurate map of the `lead_candidates` table on the lead Airtable base (`appenY7r5jlZMRpJ0`), specifically the fields **your repo reads or writes**.

**Don't guess — read the source.** Look at your Airtable client code, type definitions, every place a field name appears as a string literal in your code. Walk the codebase systematically.

## What I need documented

For each section, give exact field names (as they appear in Airtable formulas / your code), Airtable types (singleLineText, url, singleSelect with options, multipleSelects, dateTime, etc.), and a one-line description of what your repo does with each.

### 1. Channel-identifying fields

Whatever fields hold:
- Full YouTube channel URL (e.g. `https://www.youtube.com/@handle`)
- Channel handle (e.g. `@handle`)
- Channel name / display title
- Channel ID (the `UCxxxxx...` form)
- Any other ID/identifier that the channel can be looked up by

For each: field name, type, sample value.

### 2. Categorization fields

Is there a field for:
- A deterministic **client/prospect slug** (e.g., kebab-case channel handle)?
- **Business model** of the channel (with options like `high_ticket_service`, `saas`, `info_product`, `coaching`, `agency`, `other`)?
- **Niche** / category / vertical?
- Anything that would feed into per-lead deep-research parameters?

If a field doesn't exist, explicitly say "no such field" — don't invent one.

### 3. Status fields

Confirm the exact field names and the full set of allowed values for:
- `review_status`
- `outreach_status` (include any newly added values, e.g. `stopped_early` from the recent `--stop-after` work)
- Any other status-like column your repo reads or writes

### 4. Every other field your repo touches

Single table listing every field on `lead_candidates` that your code references, with: name, type, read/write/both, one-line meaning.

## Output format

Two outputs:

1. **Write the doc to a file** at the repo root: `LEAD_CANDIDATES_SCHEMA.md`. Use clean markdown — tables for the field lists.

2. **Also print the entire file content to the conversation** in a single fenced ` ```markdown ` code block at the end, so Casey can copy/paste it into the orchestrator repo.

Aim for ~150–250 lines. Don't include orchestrator architecture or anything about how leads get reviewed — just the schema as your code sees it.
