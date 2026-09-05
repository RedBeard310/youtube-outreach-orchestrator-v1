# Lead Run Analysis — 2026-09-05

Cycle: 2026-09-04 07:00Z → 2026-09-05 07:00Z (midnight PT to midnight PT).
Grounded snapshot: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-09-05.json`.
HTML debrief: [lead-run-2026-09-05.html](lead-run-2026-09-05.html).

**Headline:** the ready-to-write pool gained **+71**, the same number as yesterday.
Yesterday blamed that on a $5 search-plan spending cap and recommended raising it.
That was half the story. The recovery lane has a **free** second way to resolve a
creator's website, written so the paid search would not be a single point of failure,
and **it has never worked**. It reads the first 1 MB of a YouTube About page. Those
pages run 1.1 to 1.9 MB and the links sit in the last 4%. Fixed and verified live.

**Discovery had its best day in three.** 2,162 new channels (+37% on yesterday's
1,581), and **23 of 24 hours produced**, against 17 dark hours yesterday. That is not
a better quota situation. It is the recommended-videos lane rolling into a fresh lap
and having material to walk.

**Yesterday's midnight-PT fix never fired.** 21 more hard walls, one every ~34 minutes
from 19:05Z to 06:53Z. It waited on a rest marker that no lane ever wrote, and could
not have written. Re-fixed today from the loop's own evidence.

Two fixes shipped across two repos, both verified. Zero fatal signatures, zero hours
halted, zero scoring failures, and Anthropic spend back to **$0.00** from yesterday's
$2.04.

---

## 1. The numbers

| Metric | 09-05 | 09-04 | 09-03 |
|---|---:|---:|---:|
| Parked into `approved_hold` | **+71** | +71 | +627 |
| `approved_hold` pool | **4,805** | 4,734 | 4,663 |
| `needs_contact` pool | 4,352 | 4,344 | 4,350 |
| Total found, never contacted | **9,157** | 9,078 | 9,013 |
| New channels found | **2,162** | 1,581 | 2,817 |
| Pitchable (score ≥ 6) | 79 (3.7%) | 64 (4.0%) | 90 (3.2%) |
| Emails verified | 47 (59%) | 37 (58%) | 56 (62%) |
| Hours with zero channels written | **1** | 17 | 5 |
| Campaign sessions | 28 / 28 | 35 / 36 | 21 / 21 |
| Finder runs | 264 | 151 | 314 |
| Fresh pitchable (campaign lane) | 12 | 18 | 10 |
| Fades · discovers · promotes | 243 · 271 · 264 | 119 · 154 · 152 | 298 · 319 · 313 |
| Hard · quota · time-budget stops | **21** · 0 · 7 | 32 · 0 · 3 | 13 · 1 · 8 |
| Term-starvation observations | 26 | 26 | 25 |
| Hours halted | 0 | 0 | 0 |
| Anthropic API spend | **$0.00** | $2.04 | $0.00 |
| OpenRouter, account meter | $13.53/day | $29.32/day | $82.05/day |
| OpenRouter balance | **$180.23 (13.3 d)** | $193.76 (6.6 d) | $223.07 (2.7 d) |

The runway figure is soft in the same way it was yesterday. Spend is low partly because
the campaign lane was walled for twelve hours. Read it as about a week, not thirteen days.

Hourly channel writes (07:00Z → 07:00Z): 86, 47, 95, 135, 132, 108, 148, 169, 157, 104,
91, 73, **73** (campaign lane walls here), 72, 74, 109, 105, 73, 85, 52, 71, 44, 59, 0.

Per-lane discovery:

| Lane | Channels | Score ≥ 6 | Hit rate | ¢/pitchable | Book |
|---|---:|---:|---:|---:|---|
| Recommended-videos feed | 1,518 | 58 | 3.8% | 3.8¢ | 7,331 / 12,663 after a lap rollover. **5,332 left, ~0.5 d** |
| Keyword search | 360 | 12 | 3.3% | 3.9¢ | Term-supply bound, 26 starvation notices |
| Video-graph sweep | 208 | 9 | **4.3%** | 3.2¢ | **82,829 / 82,829 — DRAINED** |
| Peer network | 76 | 0 | 0% | no yield | **12,604 / 12,604 — DRAINED, yield-dead** |
| Podcast crossover | 0 | 0 | — | — | Ran once, 0 as usual |
| Comment sweep | 0 | 0 | — | — | Paused by Casey 08-20 |

Niche mix of the 79 pitchable: Other 28, Coaching & Consulting 14, Real Estate 7,
Business Growth Coaching 6, Health & Wellness Clinics 6, Transformation Coaching 6,
Marketing Agencies 4, Relocation 3, Financial Planning 2, plus singles in Sales
Training, Legal and Manufacturing. Tarot/astrology/manifestation-adjacent: **8 of 79
(~10%)**, up from 5% yesterday and back in line with the two-week average. Casey has
not ruled; nothing changed.

---

## 2. Q1 — the free path around the Brave cap has been broken since it shipped

The recovery lane resolves a creator's own website before **nine of its ten** collection
methods can do anything. It has two ways to do that: a paid Brave search, and a free read
of the creator's YouTube About page. Yesterday found the paid one dead on a $5/month cap.
Today's finding is that the free one has never returned a single link.

The method is `youtube-email-outreach-v1/src/bloodhound/methods/34-channel-page.ts`. Its
own header calls it "THE ONE THAT UNBLOCKS THE LANE," and it exists precisely so the paid
search would not be a single point of failure. It fetches through `fetchRaw`, which caps
its read at `MAX_HTML_BYTES = 1_000_000`.

**Measured this morning**, four consecutive leads the lane had filed as having no website:

| Lead | Page bytes | First link at | Links, full page | Links, under 1 MB |
|---|---:|---:|---:|---:|
| David Burkus | 1,325,357 | 1,272,894 (96%) | 12 | **0** |
| MUMFORD LAW | 1,194,136 | none | 0 | 0 |
| Nick Carrier | 1,875,821 | 1,821,094 (97%) | 14 | **0** |
| PM Problems | 1,102,247 | 1,063,899 (97%) | 6 | **0** |

The `channel_header` links sit after the whole video grid and the player bundle, in the
last 4% of the document. Every page exceeds the cap.

**Why it survived.** The fetch really did return 200, the parse really did run, and "this
creator pinned no links" is a legitimate outcome. A truncated page and a linkless creator
produce the identical `site=(none)` line. Same shape as the 402 that hid inside
`if (!res.ok) return []` a day earlier, and the enrichment batches on 09-02. **Four
cycles running, the defect has been a step wearing the success path's clothes.**

**Fix 1** (`youtube-email-outreach-v1`): `fetchRaw` takes a caller-supplied byte cap,
defaulting to the old 1 MB so no other method changes, and reports `truncated`. Method 34
asks for 4 MB, better than 2× the largest page seen. It also names truncation explicitly
in its own error output, so this can never again read as a creator without a website.

*Verified live* by re-running the real method against the same four leads:

```
[recY6cbzfGR3zCBTV] David Burkus     site=https://davidburkus.com/   +5 pts  err=0
[recCiKR4nKiSWPwiV] MUMFORD LAW      site=(none)  +0 pts  err=1  "page rendered with no outbound links"
[recf8wNfJxf7Ezv7V] Nick Carrier     site=https://www.nickcarrier.com/ +4 pts  err=0
[recqrClNeZSpig3ff] PM Problems      site=https://www.solvepmproblems.com/ +3 pts  err=0
```

Three of four now resolve, with nine social profiles between them. MUMFORD LAW is the
genuine linkless case and is now distinguishable from the broken one. Each resolved site
un-skips nine downstream methods for that lead.

**What this changes about yesterday's #1 recommendation.** Raising the Brave cap is still
worth doing, but it is no longer the only route, and the free route costs no money, no API
key and no YouTube quota. Worth one cycle of evidence before spending.

**Caveat.** The four-lead sample is small and was chosen from leads that had failed. The
byte measurement is exact and the mechanism is certain; the *recovery rate across the whole
4,352-lead pool* is not yet measured. Next cycle's `site=(none)` rate is the number to watch.

---

## 3. Q2 — yesterday's fix waited for a lane that never sleeps

First hard stop `2026-09-04T19:05:07Z`, last `2026-09-05T06:53:33Z`, one every ~34 minutes.
Twenty-one in total. Session logs confirm the cause line by line: all 64 direct keys rotated
to dead with `⚠ YouTube key #N/64 daily quota exhausted`, ending in
`[runner] All YouTube API keys exhausted. Aborting run.`

Yesterday's change told the loop to sleep until the midnight-PT refill **if a sweep lane was
already asleep on the same drained pool**, by reading the `*-quota-rest.json` marker the
sweeps write. The stated reasoning was that all three copies of "out of quota" should agree.

**No marker file has ever existed on disk.** The loop fell through to the flat 1800s retry.

The dependency is structurally wrong, not merely unlucky. **A finder pass spends 100 quota
units per `search.list`. The sweeps spend 1 per `channels.list` and get their edges by
scraping watch pages, which costs no quota at all.** The campaign lane therefore hits the
daily wall many hours before a sweep does, and on this cycle the sweeps never hit it at all:
they walked 10,244 seeds and wrote channels in 23 of 24 hours while the campaign loop could
not buy a single search. Waiting for a sweep to fall asleep meant waiting for a lane that was
still working.

**Fix 2** (`youtube-outreach-orchestrator-v1`): the loop asks its own session log. The
finder's exhaustion line is a clean discriminator, present in all 21 walled sessions this
cycle and absent from all 7 productive ones. On a match it sleeps to the midnight-PT refill
using the same `TZ=America/Los_Angeles date -d 'tomorrow 00:05'` arithmetic the sweeps use,
so it survives the November DST change and is self-clearing. The sweep-marker read is kept
as a fallback.

**The gate matters as much as the sleep.** The other thing that hard-walls this loop is
term-supply exhaustion, and there were 26 starvation notices this cycle. Terms do not refill
at midnight, so parking a term wall until morning would have been a new bug. A session
without the exhaustion line keeps the old 30-minute behaviour.

*Verified* by running the two new functions against all 41 session logs on disk: detected in
exactly the 34 walled sessions, not detected in the 7 productive ones, and the refill clock
resolved to `2026-09-06 00:05:00 PDT`. `bash -n` clean.

---

## 4. Q3 — "the pool is drained" is not one condition

Discovery ran all night despite the wall, and the reason is worth stating because it changes
what buying more keys is for.

A `search.list` costs 100 quota units. A `channels.list` costs 1. The recommended-videos lane
finds its next channels by scraping public watch pages, which costs nothing. So after 19:05Z
the campaign lane could not run a single term while the feed lane kept writing 44 to 109
channels an hour on the small change left in the pool, producing **1,518 of the day's 2,162
channels and 58 of the 79 pitchable leads**.

Yesterday's 17 dark hours were therefore not a worse quota day. They were the feed lane out
of seeds. Today it rolled into a fresh lap and had material.

**Implication:** more YouTube keys mainly buy **keyword search**, the lane that spends 100
units a query. The cheap lanes are short of seeds, not units.

---

## 5. Q4 — two books empty, the third re-walking its own ground

| Lane | Walked | Left | State |
|---|---:|---:|---|
| Video-graph sweep | 82,829 | **0** | Book finished. 208 channels on leftovers, best hit rate of any lane (4.3%) |
| Peer network | 12,604 | **0** | Book finished and **yield-dead**: 76 channels, zero pitchable |
| Recommended-videos feed | 7,331 / 12,663 | 5,332 | Re-lapped. ~0.5 days at **0.0057 pitchable/seed** |

Same structural finding as yesterday, one day further on. The lanes refill each other's
books: a lane qualifies a score-≥6 creator, and that creator becomes a seed for the next
lane. A circuit with one producing lane runs down. The peer lane is the clearest signal,
walking 76 channels for nothing at all. It is not broken; it has read everything it owns.

**Deliberately not changed.** Stopping the peer lane, or putting a yield floor on the feed
lane's re-lap, are spend and policy decisions rather than defects. The re-lap gate is a price
ceiling by design, chosen because a yield gate would have killed the cheapest source in the
pipeline. Those calls are Casey's.

---

## 6. What held from yesterday

| Yesterday's fix | Held? | Evidence |
|---|---|---|
| Brave rotates on any key-level refusal, plus a loud line | **Held** | Four explicit 402 warnings naming the cap in `bloodhound-collect.log` |
| Check-in observes collapsed site resolution | **Held** | `bloodhound_site_resolution_collapsed` × 23, correctly refusing to escalate a spend decision |
| An empty seed book is not a stalled daemon | **Held** | `sweep_daemon_book_drained` × 2; Anthropic spend back to $0.00, zero fix-agent pages |
| Campaign loop sleeps to the midnight refill | **Did not fire** | 21 hard walls; no rest marker ever written. Re-fixed today |

Check-in observations this cycle: 27 `finder_hard_wall_benign`, 25 `term_starvation`,
23 `bloodhound_site_resolution_collapsed`, 9 `harvest_kick`, 2 `sweep_daemon_book_drained`,
1 `sweep_daemon_resting_on_quota`, 1 `pitchable_rate_term_supply_degraded`. Zero paid
escalations.

---

## 7. Fixes shipped

| # | Repo | Change |
|---|---|---|
| 1 | `youtube-email-outreach-v1` | `fetchRaw` takes a caller-supplied byte cap and reports truncation; method 34 reads 4 MB so it can actually see the About-tab links, and names truncation explicitly instead of looking like a creator with no website. Verified live on 4 real leads |
| 2 | `youtube-outreach-orchestrator-v1` | The campaign loop reads its own session log for the finder's key-exhaustion line and sleeps to the midnight-PT refill itself, instead of waiting on a sweep lane that spends 100× less quota and never falls asleep. Gated so a term-supply wall keeps the 30-minute retry |

Both verified before commit: `tsc` clean in the email repo with the method run against four
real leads, `bash -n` clean in the orchestrator with both new functions exercised against
every session log on disk. Nothing was stopped, no halt flag written, the loop was left
running.

*Note on commit attribution:* the orchestrator change was swept into `cdf51a9
auto-sync: 2026-09-05T07:25:37Z` by the 2-minute auto-sync timer before the
`autopilot-improve:` commit could be made. The change is committed and will push; only the
message is the timer's.

---

## 8. Recommended next, ranked

1. **Watch the recovery lane for one cycle before spending on Brave.** The free website path
   is fixed and it is what nine of ten collection methods wait on. If the `site=(none)` rate
   falls back toward the 9% it ran at on 09-02, the lane recovers without the cap being
   touched. If it stays high, the Brave cap is genuinely binding and worth raising. One
   cycle of evidence costs nothing and settles a spend question.
2. **Decide how the seed books refill.** Two of three empty, third at ~0.5 days and
   re-walking old ground. More YouTube quota, wider niches, or a new discovery method. The
   video-graph book is worth refilling first, at 3.2¢/pitchable and the best hit rate of any
   lane.
3. **Add YouTube keys, knowing what they buy.** Allowance gone by 19:00Z. Today's fix stops
   the waste but creates no quota. More keys mainly buy keyword search; the cheap lanes are
   short of seeds, not units.
4. **Top up OpenRouter within the week.** $180.23. The 13-day reading is flattered by twelve
   walled hours; a working day reads closer to a week. Everything bills this account, and an
   empty balance stopped the whole pipeline on 08-25.
5. **The tarot and astrology question is still open.** 8 of 79 today (~10%), in line with the
   two-week average, roughly 1 in 8 of everything parked. Nothing excluded, per the standing
   err-liberal / ask-first rule.
6. **Enrichment needs nothing.** 4,701 of 4,805 parked leads carry a bundle. 104 outstanding,
   flat on yesterday's 105.

---

**Status caveat:** everything is *parked*, nothing sent. `approved_hold` holds until
`npm run send` is run by hand.
