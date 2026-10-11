# Lead run analysis, cycle 2026-10-10

Companion to [lead-run-2026-10-11.html](lead-run-2026-10-11.html). Cycle window
2026-10-10T07:00Z to 2026-10-11T07:00Z, which is Saturday 2026-10-10 Pacific.
Grounded metrics: `youtube-outreach-orchestrator-v1/logs/autopilot-debrief-2026-10-11.json`.
Four readings were measured directly and are named where they appear: the per-pass
funnel (`logs/bloodhound-collect.log` through `collectPasses()`), the FINRA endpoint
status (a direct `curl` probe), the contact-point count per method
(SQL over `leads.contact_points`), and the share of leads holding a full host name
(SQL over `leads.lead_candidates`).

## Headline

**Nothing sent, because Saturday is not a sending day, and the cycle's entire output
was two people parked. The reading worth having is that the free recovery lane proved
its book is collected out from both directions at once, and that its largest single
error is a method that has never produced a contact point in its life.**

Zero fatal signatures, zero halts, zero crashes, twenty-eighth consecutive cycle of
$0 Anthropic spend.

## Finding 1: nothing sent, and that is the calendar

`sending_day: false`, `binding_constraint: not_a_sending_day`, `plan_found: false`.
`siege-plan.timer` is Monday to Friday, so no plan was due and none was written.
`siege-plan.service`'s last run was Friday 12:05Z with `Result=success`, which is the
run the 10-10 debrief covered, and `push_unit_result` is null because no push belongs
to this window.

This repo's own send path ran once and had nothing to fire: `attempted=0 sent=0
failed=0`. Friday's two `http 429` escalations on the campaign `START` call did not
recur, for the uninteresting reason that there was no push to recur in. Those six
people are still loaded into two stopped campaigns with their rows marked sent.

## Finding 2: the book is collected out, and this cycle showed it twice

The 10-10 debrief established one half of this. On a slice where no lead has a stored
website, Brave answers, the strict ownership gate refuses the candidate because the
page cannot be tied to that creator, and nine of thirteen methods have nothing to work
with. That shape repeated in this cycle's first pass.

The second half is new. The cycle's other two passes walked slices where most leads
already had a website on file, so the gate never came into it:

| Pass | Leads | Brave searches | Sites already on file | Points found | Already stored | New | People |
|---|---|---|---|---|---|---|---|
| 1 | 125 | 125 | 0 | 90 | 90 | 0 | 0 |
| 2 | 150 | 24 | 126 | 519 | 506 | 13 | 5 |
| 3 | 150 | 30 | 120 | 523 | 521 | 2 | 2 |
| 4 (07:01Z, just past the cycle) | 150 | 5 | 145 | 592 | 588 | 4 | 3 |

Passes 1 to 3 are inside the window and account for exactly the 15 contact points and
7 people the snapshot reports, which is how we know the pass boundaries parsed
correctly.

**So the two readings converge.** Where the lane can collect, the collecting is already
done: 1,634 points found across passes 2 to 4 and 1,615 of them already stored, which
is 19 new points off 450 leads. Where it cannot collect, the obstacle is a creator with
no findable site in their own name, which the 2026-08-18 ownership gate is correctly
refusing to guess at. Neither half is a fault and neither is buyable.

### Yesterday's attribution fix worked unattended

The hourly check-in fired `bloodhound_site_resolution_collapsed` once this cycle, at
11:11Z on pass 1, and filed `attributed_to: "ownership_gate"` with the arithmetic
(125 searches, 105 candidates, 97 refused by the gate, 8 accepted) and the sentence
"SPENDING NOTHING WOULD CHANGE THIS". The two alarms the day before, before the fix,
both read `unexplained`.

Both alarms then went quiet for the rest of the cycle with nobody touching anything,
because passes 2 and 3 resolved sites normally and their yields sat inside the
thresholds. First production outing of `noSiteCause()`, correct with no human in the
loop.

## Finding 3: `09-finra` has produced nothing, ever, and was the biggest error in every pass

This is the cycle's real discovery, and it came out of the instrument shipped on 10-08
rather than out of a symptom.

The commonest error shape in the newest pass is `09-finra: FINRA N`, **53 of its 442
errors**, and the same shape topped the two passes before it at 44 and 28. Three
readings, each taken directly:

- **The endpoint is retired.** A direct probe of `api.finra.org/data/group/individual`
  returns `404` with `"Invalid resource. Check path or other request details."` The
  endpoint that does answer is the public one BrokerCheck's own site uses,
  `api.brokercheck.finra.org/search/individual`, verified `200` on 2026-10-11 and
  returning names, firm and branch city/state.
- **It has never found anything.** `leads.contact_points` holds **zero** rows from
  `09-finra`, against 15,031 from `34-channel-page`, 552 from `17-podcast` and 17 from
  `19-github`.
- **It could not have worked anyway.** The method searched a national register of
  financial advisers on `hostFirstName`, and of the 2,194 `needs_contact` leads that
  have one, **23 hold a full name**. Searching for "Jane" returns hundreds of people,
  and filing one of them is precisely the stranger-filing bug the 2026-08-18 audit
  closed.

So two independent faults, both silent, in a method spending roughly 50 POSTs a pass on
a 12-second timeout. It stayed invisible because a single shape inside a 442-error total
reads as weather, and because the 10-08 fix put the shapes in the collect log and
nothing carried them into the snapshot the debrief is written from. That is the same
gap the no-site rate had on 10-05.

**Honest limit on the value:** fixing this parks nobody. The lane's yield is set by the
book. What it buys is ~50 fewer dead requests a pass, and an error report whose top
line means something.

### Shipped

**`ee1abd7c8`** (`youtube-email-outreach-v1`), two parts:

1. `09-finra` skips when there is no surname to match on, so the 99% case makes no
   request at all, and a hit must match the host's own first and last name before
   anything is filed. Verified by running the method over four contexts: non-finance
   niche skips, a first name alone skips with `no host surname to match on`, a missing
   name skips, and a full name reaches the endpoint and reports `FINRA 404`. The retired
   path and the live BrokerCheck one are both written into the file for whoever rebuilds
   it, along with why a surname is a precondition and not a nicety.
2. A general breaker, `src/bloodhound/breaker.ts`. A method is taken out of the rest of
   the pass once it has run 10 leads, errored on every one, produced no points at all,
   and returned exactly one error shape. State is per-process, so the next pass re-tries
   and the lane heals itself the moment an endpoint returns.

The arming test is deliberately narrow, because cutting a good method costs far more
than a few wasted fetches. `34-channel-page` is the lane's best producer and does log a
byte-identical "page rendered with no outbound links" on 63 of 125 leads on a bad slice,
so the zero-points and single-shape conditions are what keep it safe. 15 selftest cases
in `breaker.selftest.ts` cover that case explicitly, plus varied causes, one clean lead
among the failures, independence between methods, and the shape condenser. All pass,
`tsc` clean.

**`c3c5d93`** (orchestrator): `CollectPass` now carries `methodErrors`,
`topErrorShape`, `topErrorCount` and `deadMethods`, parsed from the two lines the
collect CLI writes after the found-line, and `debrief-data.ts` surfaces them as
`site_resolution.method_errors` / `top_method_error` / `top_method_error_count` /
`methods_dead`. The parser's `openPass` flag became a `current` pass reference because
the error lines arrive after the found-line, which used to close the pass. Verified
against all 154 passes in the live log: the last four reproduce the hand-read figures
exactly, and the regenerated snapshot reads `09-finra: FINRA N` at 53 of 442.

## The pause still has nothing left to fund

Enrichment ran **2 batches of 2 leads** against a pool that is **99.9% bundled**. The
free recovery book now has evidence from both directions that it is collected out. Apify
has $10 of its $100 month left and all of it is reserve, so **$0 spendable until 31
October**, with 0 price strikes.

The flag is untouched, no lane was restarted, and none of this is reported as an
anomaly. The arithmetic is still worth stating: the pause is no longer buying
enrichment, and this is the thirteenth consecutive debrief to say so.

## The shelf

`approved_hold` is 7,598, of which **1,514 have already been emailed**, so the inventory
is **6,074**. At Friday's 277 first-ever emails a sending day across four delivery days,
that is **21.9 sending days**, about five and a half weeks. Intake for the cycle was two
people.

## Money

| Line | Reading |
|---|---|
| Anthropic | **$0.00**, 28th straight cycle |
| OpenRouter | **$1.92/day**, $91.78 left. A non-sending day costs about half a sending day |
| Apify | 0 batches. $10 left of the $100 month, all reserve, so $0 spendable until 31 October |
| Brave | 179 searches across the cycle's three passes, 0 refusals. Roughly $0.90 |

**This corrects yesterday's runway figure rather than contradicting it.** 10-10 read 25
days, measured on the biggest send day on record. At $3.68 on four sending days and
$1.92 on three quiet ones, the blended rate is about $2.93 a day, so $91.78 is roughly
**31 days**. Still the one bill worth watching, and it is the send path, not enrichment.

## Standing items, unchanged

- **YouTube keys: 15 of 66 working**, 50 still exhausted after the midnight reset, 1
  blocked. Settled on 2026-09-16: the quota on 50 projects was cut, so quote ~15 usable
  and do not propose buying more keys for those accounts. Irrelevant while discovery is
  off.
- **Discovery wrote 0 new channels**, as instructed on 2026-09-08.
- `stranded` held at 3 for the 28th day, so no selector gap has reopened. Lap 9 of a
  2,515-lead book. `needs_contact` down to 3,511.
- **Nine of sixteen Siege offers blocked**, tenth debrief.
- **Six cycles have metrics on disk and no debrief**: 09-17, 09-18, 09-19, 08-17, 08-18,
  07-11.

## Ranked next

1. **Decide what refills the shelf.** 6,074 never-emailed people, 277 a sending day,
   about five and a half weeks. This cycle added two. Enrichment is finished, the free
   recovery book is collected out on measured evidence from both directions, Apify is
   dry until 1 November. Thirteenth consecutive debrief, still the only decision that
   changes how many people exist to email, still Casey's.
2. **The OpenRouter runway is about 31 days, not 25.** See Money above.
3. **Give the campaign `START` call a 429 retry** in `automator/scripts/siege-plan.py`.
   Six people are in two stopped campaigns with their rows marked sent. Outside this
   agent's reach.
4. **Fix the em dash in `cold-email-attack-enemy-propose-5-ideas-v1`.** No new evidence
   today; four of Friday's five dropped emails came from that writer.
5. **More inboxes, not a higher day cap.** 618 planned against 618 mailbox slots on 50
   live inboxes under a cap of 870.
6. **Check the next two error shapes once each.** `17-podcast: iTunes N` ran 78 in one
   pass and `34-channel-page: page rendered with no outbound links` ran 63 in another.
   Both methods do produce (552 and 15,031 points), so neither is a `09-finra`, but
   nobody has ever looked at their failure rate because until this cycle nothing counted
   it.
7. **Backfill the six missing debriefs.** No risk, metrics are on disk.

*Snapshot written 07:20:13Z on schedule, regenerated at 07:30Z to pick up the new
error-shape fields. Every headline figure was identical; the two that moved are the
measurement window itself (`measured_minutes_after_cycle_end` 20 to 31) and OpenRouter's
balance ticking down $0.07. The regenerated file is the one left on disk.*
