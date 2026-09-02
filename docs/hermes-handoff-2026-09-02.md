# Prompt for Hermes — recovery lane handoff, 2026-09-02

Paste this to Hermes as-is.

---

Context update on the lead-gen pipeline. Claude Code made changes today that
affect your work, and I want to divide the labour so we don't collide.

**What changed.** `lead_candidates.external_links` was never YouTube's About-tab
link list. It is a regex over the About paragraph
(`youtube-lead-finder-v1/src/youtube/fetchers.ts`), and the Data API does not
expose the real link row at all. That is why ~2,569 of the needs_contact leads
looked like they had no website and why nine of the eleven Bloodhound collect
methods were skipping on them. Fetching the public channel `/about` page instead:
26 of 30 sampled leads had real links, 4 of 30 had an email in plain sight.

Three things landed:

1. `youtube-email-outreach-v1/src/bloodhound/methods/30-channel-page.ts` — scrapes
   the channel About page, decodes YouTube's redirect wrapper, keeps only
   `channel_header` / `channel_description` links, and writes the resolved site
   onto the shared LeadContext so the site-dependent methods work in the same pass.
2. `.../methods/29-about-text.ts` — harvests the 439 leads whose About text already
   held an email that ZeroBounce was never shown.
3. `youtube-lead-finder-v1/src/env.ts` — `YOUTUBE_API_KEY_1` and `_2` are now held
   out of the discovery pool. `youtube-deep-research-v1` hoists the same two to the
   front of its own pool. This is so a Dream 100 report never finds the pool at
   zero. Do not remove it and do not "fix" the smaller discovery pool.

**Please do not touch these files.** Claude Code owns
`src/bloodhound/methods/29-*`, `30-*`, `src/bloodhound/registry.ts` (the method
ORDER is load-bearing — 30 must run before anything reading `ctx.website`),
`src/email/finder-llm.ts`, and the key-reserve code above. If you think one of
them is wrong, write down what and why and tell me. Don't edit it.

Also: a backfill of methods 29 and 30 is running across the whole needs_contact
lane right now and will take several hours. Your "Lead-gen continuous
improvement" cron (`76ced4a203e6`) fires at 20:25 tonight. Please have that run
skip the email-outreach repo entirely this cycle.

**Your lane.** Everything that needs a real browser or a residential IP, which
Claude Code has none of:

- `07-newsletter` under xvfb with the burner IMAP inbox. It is built and held back.
- Instagram and Facebook profiles. `26-instagram` only extracts links today
  because datacenter IPs get blocked; your residential Chrome doesn't. 85 leads
  link Instagram, 64 Facebook, and `instaloader` is installed and unused.
- LinkedIn public Contact Info.
- `maigret` on the highest-value residue only, not the general pool.
- The genuinely odd sites where a human-style read is worth the tokens.

Wait until the backfill finishes before you start, so you're working the real
residue and not leads Claude Code is about to solve for free.

**Two more things.**

The video-graph lifetime cap is raised from $50 to $53, so your
`refresh-video-seeds` cron at 00:00 UTC will restart that sweep on its own. It
has been no-oping hourly on "lifetime cost cap" since it stopped at $50.0021 with
3,390 seeds unwalked. Nothing for you to do, just don't be surprised when it
wakes up.

And confirm for me that you can actually WRITE to Postgres, not just read. Your
own skill says terminal shells inherit `PGOPTIONS=-c
default_transaction_read_only=on` and that the sanctioned path is
`env -u PGOPTIONS psql "$DATABASE_URL" ...`. Please prove it end to end by
inserting one throwaway row into `leads.contact_points` and deleting it again,
then tell me it worked. I don't want to assign you write work on an assumption.
