# Prompt — wire `last_contacted_at` into the SmartLead-push success path

**Paste this into a Claude Code session opened in `youtube-email-outreach-v1`.**

---

## The bug

Today's orchestrator pilot pushed 4 leads to SmartLead. Their `outreach_processed_at` updated correctly to today's timestamp — but their `last_contacted_at` did NOT. Example:

```
Dentist Advisors (rec4rjsDm25Wp7chW):
  outreach_status      = sent_to_smartlead  ✓
  outreach_processed_at = 2026-05-29T06:22:07.455Z  ✓ (today's send)
  last_contacted_at    = 2026-05-27T23:35:35.270Z  ✗ (yesterday's failed tick, stale)
```

This is the bug Casey called out in the cross-repo handoff:

> **On every outbound email send**, write `last_contacted_at = new Date().toISOString()` to the lead row alongside whatever you set on `outreach_processed_at`. This is the field Casey uses to filter the retargeting pool. If you forget, the field drifts and the retargeting tool produces stale results.

That instruction got captured in the handoff but didn't ship in the code — every `sent_to_smartlead` transition from today onward is producing a lead row with a stale `last_contacted_at`. The `list-retargetable-leads.ts` query that Casey uses to pick re-engagement candidates will produce incorrect results until this lands.

## What to fix

**Find the code path that flips `outreach_status` to `sent_to_smartlead` after a successful SmartLead push.** Likely in `src/lib/smartlead.ts` or `src/lib/airtable.ts` or wherever the Airtable update for that transition happens. There should be a single `update(...)` call (or small handful) that sets `outreach_status` and `outreach_processed_at` on send success.

**Add `last_contacted_at: new Date().toISOString()` to the same fields object.** Same call, same transaction, same timestamp source — so the two fields can't drift relative to each other.

Rough pattern:

```typescript
// Before
await airtable.update(leadId, {
  outreach_status: 'sent_to_smartlead',
  outreach_processed_at: now,
});

// After
await airtable.update(leadId, {
  outreach_status: 'sent_to_smartlead',
  outreach_processed_at: now,
  last_contacted_at: now,  // <-- north star for retargeting eligibility
});
```

## Where else to apply it

`last_contacted_at` semantically means "we last contacted this person." Right now there's only one outbound contact event in this repo (push to SmartLead). But check:

- Are there any other code paths that send a real outbound email directly (not via SmartLead)? If yes, write it there too.
- Are there follow-up sends or any retry-with-new-copy flows? Those count as contact events.

If SmartLead push is the only outbound event in this repo, then a single edit at the push-success transition is sufficient. Don't over-engineer it.

## What NOT to change

- **Don't write `last_contacted_at` at any other status transition.** Not at `email_drafted`, not at `enriched`, not at `email_verified`. Only at actual outbound-send success.
- **Don't change `outreach_processed_at` semantics.** Keep both fields. `outreach_processed_at` is the orchestrator-state field; `last_contacted_at` is the retargeting-eligibility field. They happen to share a value at send time but are semantically distinct.
- **Don't backfill historical leads from this code.** The handoff said `last_contacted_at` was already backfilled from `outreach_processed_at` for existing leads. If the 4 leads from today's pilot show up stale, that's the orchestrator's problem to handle separately (or a one-shot script Casey runs); don't put a backfill loop in production code.
- **Don't touch `reply_received` / `email_bounced` / `unsubscribe_received`.** The daily noon `sync-smartlead-replies.ts` sync owns those.

## What to verify before reporting back

1. Grep for every Airtable update call in this repo that sets `outreach_status='sent_to_smartlead'` or `outreach_processed_at`. Confirm `last_contacted_at` is set in all of them and only in those.
2. Run a quick test — drive a single lead through send (or simulate by triggering the update path), then read the lead row and confirm `last_contacted_at` equals `outreach_processed_at` (within a few ms).
3. Typecheck clean.

## Report back

1. The exact file(s) and line numbers you changed.
2. The list of grep'd send-success call sites and confirmation each got the new field.
3. Whether you found any other outbound-send paths (or confirmed there's just one).
4. Diff size — should be tiny (1-3 lines per call site).

Then Casey will scale up the orchestrator from 5 leads to the remaining 23 enriched-and-ready leads, and we'll verify `last_contacted_at` lands correctly on the next batch.
