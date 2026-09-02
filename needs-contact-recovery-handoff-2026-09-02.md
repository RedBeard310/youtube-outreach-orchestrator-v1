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

## The YouTube API key situation, measured

The env bank holds 66 YouTube keys. The pool is much smaller than that number suggests,
and the API's own error text hides it. Google does not answer "banned" when it kills a
key's YouTube Data API access. It zeroes the key's daily quota, so every call comes back
403 `quotaExceeded`, worded exactly like a key that legitimately spent its 10,000 units.

The finder's own dead-key log separates them, because it records WHEN each key died:

| Category | Keys | Evidence |
|---|---|---|
| Quota zeroed by Google (dead) | 39 | rejected instantly at the start of a fresh quota day |
| Genuinely exhausted by real use | 21 | died one at a time, spread across the day |
| Suspended outright | 1 | `#38`, `CONSUMER_SUSPENDED` |
| Never touched, healthy | 5 | `#4 #6 #7 #10 #11` |

The instant-rejection reading is not a guess. The quota day resets at 07:00 UTC. On
2026-09-01, `logs/youtube-dead-keys.json` shows 16 keys marked quota-dead inside a
0.7-second window at 07:17:23, then 13 more inside 0.6 seconds at 07:44:46, plus smaller
bursts of 4, 4, and 2. No key can spend 10,000 units in a fraction of a second. Those keys
returned `quotaExceeded` on their first call of the day, which only happens when the daily
quota is 0. The 21 that died alone, minutes or hours apart, are the ones doing real work.

Dead slots: `#13 #14 #15 #16 #24 #25 #26 #27 #28 #29 #30 #31 #32 #33 #34 #35 #36 #37 #39
#40 #42 #43 #46 #47 #48 #49 #54 #55 #56 #57 #58 #59 #60 #61 #62 #63 #64 #65 #66`, plus
`#38` suspended.

**So the usable pool is about 26 keys, near 260,000 units a day, not 660,000.** Casey was
right that the newer keys are dying. Note the pattern in the slot numbers: the dead ones
cluster in the high ranges that were added most recently, which points at whatever
provisioning method produced them rather than at usage.

Two things follow. First, confirm the split cheaply: probe every key in the first minutes
after 00:00 Pacific. Anything that says `quotaExceeded` then is zeroed, full stop. Second,
before buying more keys, cut consumption. `search.list` costs 100 units per call against
1 unit for most reads, so a handful of search-heavy paths can drain a real key in minutes.
The RapidAPI mirror that `src/youtube/backend.ts` already falls through to is the other
lever.

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
