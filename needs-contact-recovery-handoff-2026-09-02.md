# Handoff: unlock the `needs_contact` backlog (written 2026-09-02, from the automator repo)

Read this whole file before touching anything. It states a problem, the numbers behind it,
and what to do. It was written by a session working in `automator` on the cold-email ABC
test, which is the thing starved by this backlog.

## The problem in one paragraph

The ABC email test can only draw from leads that are scored 6 or above, email-verified, and
`review_status = 'approved_hold'`. That pool is **2,800 leads**. Casey expected far more, and
he is right to. The database holds **10,178 leads scored 6 or above**. The gap is not a
lead-finding gap. It is a contact-recovery gap: **4,951 qualified leads sit in
`needs_contact` with no verified email**, which is exactly the "biggest remaining lever (not
built)" that `CLAUDE.md` line 244 describes. That note still says 2,173 parked there. It is
now 4,951, so the backlog has more than doubled while the recovery engine stayed unbuilt.

## The numbers (measured 2026-09-02 against `leads.lead_candidates`)

Signal 6+ leads by `review_status`:

| review_status | leads | have an address | verified valid | already contacted |
|---|---|---|---|---|
| needs_contact | 4,951 | 1,172 | 0 | 0 |
| approved_hold | 3,966 | 3,966 | 3,353 | 0 |
| approved | 771 | 771 | 603 | 760 |
| demo_niche_excluded | 465 | 0 | 0 | 0 |
| rejected / unreviewed / D100 | 25 | 22 | 14 | 5 |

What the ABC test's own filter drops, in order:

| Stage | Remaining | Lost |
|---|---|---|
| Signal 6+ | 10,178 | |
| review_status = approved_hold | 3,966 | −6,212 |
| email_verification_result = valid | 3,353 | −613 |
| has enrichment_bundle_path | 3,210 | −143 |
| has host_first_name | 2,800 | −410 |

## What to do, in priority order

**1. The 4,951 in `needs_contact`. This is the whole ballgame.**

These are found, host-identified, score-6+ creators whose `outreach_status` is
`no_email_found` or `email_invalid`. Per `CLAUDE.md` line 72 they flip to `approved_hold`
the moment a valid email exists, which drops them straight into the ABC test's pool with no
other work. Recovering even 40% roughly doubles the sendable universe.

Build or run the contact-recovery pass in `youtube-email-outreach-v1`. Things worth trying
before writing anything new: re-run the existing email finder over rows whose last attempt
is old, since both the finder and the verifier have changed since; widen the scraper past
the channel's own About page to the linked site's contact and team pages; and re-verify the
1,172 rows that already carry an address but never verified, because a verifier run is far
cheaper than a discovery run.

**2. The 613 `approved_hold` rows whose email is not `valid`.**

They are parked as send-ready but would fail the strict gate. Re-verify them. Cheap, and
some fraction comes back valid.

**3. The 427 `approved_hold` rows with a valid email and no `host_first_name`.**

Every one of them is otherwise send-ready and is excluded only because all three ABC email
templates open with a first name. This is a host-identification job, not an email job.

**4. The 143 with no `enrichment_bundle_path`.**

They need the deep-research bundle before any email can be written for them.

## The YouTube API key situation, measured rather than assumed

Casey believes a bunch of the newer keys were banned. I probed all 66 keys in
`~/env-storage/.env` on 2026-09-02 at about 20:45 Pacific with a 1-unit `videos.list` call:

- **14 keys answered normally.**
- **51 returned `quotaExceeded`.** Not banned. Their daily 10,000 units were spent, and they
  reset at midnight Pacific.
- **1 key is actually dead: `YOUTUBE_API_KEY_38`, reason `forbidden`.** Replace or remove it.

So the pool is roughly 650,000 units a day and the constraint is spend rate inside a day,
not a ban wave. Before buying more keys, find what is burning 51 keys' worth of quota, and
check whether the work can move to cached bundles or the RapidAPI mirror that
`src/youtube/backend.ts` already falls through to. If the answer really is "we need more
keys," say so with the per-day unit math behind it.

## Rules that apply to this work

- **LLM API spend must be disclosed before it starts, with a provider name and a dollar
  estimate, and anything at or above $1 needs Casey's explicit approval first.** A
  recovery pass over 4,951 leads can easily cross that. Model choice lives in `models.json`,
  never in code and never in env.
- **Do not run `hold-batch.ts --release`.** It flips every `approved_hold` row to `approved`
  at once and hands the ABC test's pool to the older `npm run outreach` path as well. Two
  systems would email the same people. The ABC test reads `approved_hold` in place and
  leaves the status alone.
- Newly recovered leads should land in `approved_hold`, matching the existing flow.
- Dry-run first. `npm run campaign:dry` prints every shell command and touches nothing.

## How to tell it worked

Re-run this and watch the number climb from 2,800:

```sql
SELECT count(*) FROM leads.lead_candidates c
 WHERE c.review_status = 'approved_hold'
   AND c.email_verification_result = 'valid'
   AND COALESCE(c.email_address, '') <> ''
   AND NOT COALESCE(c.do_not_contact, false)
   AND NOT COALESCE(c.email_bounced, false)
   AND NOT COALESCE(c.unsubscribe_received, false)
   AND c.last_contacted_at IS NULL
   AND COALESCE(c.enrichment_bundle_path, '') <> ''
   AND COALESCE(c.host_first_name, '') <> '';
```

That is the ABC test's own eligibility filter, minus the two clauses that exclude leads
already assigned or already mailed. It lives in
`automator/scripts/email-test-select.py` as the `ELIGIBLE` string. If you change what
"ready" means, change it there too.

## One piece of context so nobody over-rotates

The ABC test currently sends 45 first-touch emails a day, because the Google half of the
inbox fleet stopped sending on 2026-08-27/28 and only 3 Microsoft inboxes remain attached.
At that rate the existing 2,800 leads are about 62 days of sending. The backlog is still
worth clearing, and Casey has asked for it, but the binding constraint on emails going out
today is inbox capacity, not lead supply. Do not let a big recovery run create the
impression that sending will scale with it until the fleet is repaired.
