# Opportunity sources and qualification register

Reviewed **21 November 2026**, using official organizer and product pages.
This is a dated seed for the company's private register, not an always-current
calendar, endorsement, application or claim of eligibility. Sources and rule
availability can change; recheck before committing work or an external action.

## Current organizer findings

| Source / candidate | Observed evidence | Studio status | Next action |
| --- | --- | --- | --- |
| [ETHGlobal official event directory](https://ethglobal.com/events) | Lists Agentic Markets, 3–10 December, as an upcoming async hackathon; lists Cannes 2027 on 14–16 April and other 2027 events | Directory-confirmed lead; detail rules unverified | Open the event-specific rules and confirm year, deadline/timezone, eligibility, permitted AI and prior code before qualifying |
| [Agentic Markets event route](https://ethglobal.com/events/agenticmarkets) | Linked by the official directory; the detail request returned HTTP 500 during this review | Needs information | Retry a normal source fetch later; preserve the failed retrieval, and do not infer missing terms |
| [ETHGlobal Cannes 2027](https://ethglobal.com/events/cannes2027) | Listed by the organizer, but its detail request also returned HTTP 500 | Watchlist / needs information | Qualify travel, team and rule requirements when the page is available |
| [Global FinTech Hackcelerator](https://www.fintechfestival.sg/global-fintech-hackcelerator) | Official page says 2026 applications closed 21 August; Demo Day was listed for 18 November; it offers 2027 interest registration | 2026 closed; 2027 watchlist, not an open application confirmed here | Study the financial problem statements; revisit the new edition's actual application rules before planning an entry |
| [MLH 2027 season directory](https://www.mlh.com/seasons/2027/events) | Lists upcoming organizer-linked events, including Hack Canada on 8–10 January 2027 | Discovery source; not every event is fintech-specific | Use event-level sources for rules and current status; season labels do not determine the event's calendar year |
| [Hack Canada 2027](https://hackcanada.org/) | Official page offers applications by 31 December and an 8–10 January 2027 event. Its FAQ limits attendance to students and says code must be written during the event | Application route observed; user's eligibility and deadline timezone unverified | Check student eligibility, timezone, AI rules and complete official terms before selecting; do not prebuild competition code |

“Apply” on a website does not establish that a registration endpoint completed,
that an application is accepted, or that the user meets the rules. No forms were
submitted, accounts created, messages sent or entry/travel purchases made for
this source review.

The reviewed shortlist deliberately includes a fintech-specific innovation
programme, a specialist builder organizer, and a general hackathon discovery
network. This broadens discovery without treating blockchain as all of fintech
or treating every hackathon as a financial-services event.

## Qualification fields

One candidate record per event edition should hold:

| Field | Required meaning |
| --- | --- |
| Identity | Organizer, exact event name/edition, canonical detail URL and local stable key |
| Source evidence | URL, retrieval time, concise factual summary, provenance/claim type, optional content hash and retrieval error |
| Format | Online/in-person/hybrid, location and attendance obligations |
| Time | Application deadline, project submission deadline and event start/end kept separately; original wording plus explicit timezone |
| Eligibility | Age/student/location/organization-stage requirements and evidence of the user's fit or an unknown flag |
| Team | Permitted team size, member requirements, registration route and account owner |
| Build rules | Prior work, open source/licensing, permitted tools and AI assistance, mandatory sponsor products and prohibited shortcuts |
| Submission | Required files, public/private links, video length, source-code requirements and final portal |
| Rights | Organizer terms, IP/license obligations, publicity rights and material unresolved questions |
| Expense | Entry fee, travel, infrastructure and inference estimates separately; prize/stipend eligibility is not cash received |
| Decision | Go / defer / no-go, named owner, rationale summary and next review time |
| Outcome | Prepared, submitted, accepted, demo-verified or awarded, each with its own evidence |

Unknown values remain `null` or explicitly unknown. A date without a timezone
must not silently become midnight in the device timezone. Preserve the original
deadline wording and verify the timezone before converting to UTC. Display the
owner's local timezone alongside the organizer's deadline after verification.

## Prioritization rubric

Apply hard eligibility and rule checks first. An event known to be closed or
ineligible cannot be rescued by a high numeric score. An unresolved mandatory
field remains `needs-information` and does not auto-enter the queue.

For qualified candidates, score each dimension 0–5 and retain the reason:

| Dimension | Weight | Interpretation |
| --- | --- | --- |
| User/problem fit | 25% | Clear useful problem in the studio's accepted strategy |
| Deliverability | 20% | Available skills, working environment and a plausible complete slice |
| Reusable learning | 20% | Expected knowledge or components valuable after the event |
| Time fit | 15% | Feasible schedule with review and submission margin |
| Cost fit | 10% | Authorized total expense, not prize amount |
| Demonstration fit | 10% | Observable outcome that fits the published judging/submission format |

`fitScore = sum(weight × score / 5)` yields a planning score out of 100.
The weights are a proposed studio decision aid, not empirical predictors of
winning. Do not fabricate numeric probability of acceptance or prize return.

## Refresh and cache policy

- Cache a fetched public organizer page with its URL, retrieval time and content
  hash. Keep the page's factual excerpt separate from the scout's inference.
- A weekly discovery pass is a proposed cadence, not a registered automation.
  Use on-demand review until a supported schedule is actually configured.
- Recheck rules before accepting an event into a sprint and deadlines before
  submission. A candidate inside seven days of a deadline needs a fresh source
  check at each delivery checkpoint; avoid unnecessary repeated fetches during
  the same review.
- Treat the cache as a reading aid. Never replay an application, enrollment,
  payment or post from cached output. An uncertain write needs reconciliation.
- If source retrieval fails, retain the last verified date and expose the stale
  status. A failed refresh cannot mark an event open or extend its deadline.

## Fintech infrastructure reading list

These are official candidate development references, **not connected accounts or
installed adapters in Daftar**. Product/region access and supported operations
must be checked for the specific build.

| Reference | What the reviewed page establishes | Studio use |
| --- | --- | --- |
| [Stripe sandboxes](https://docs.stripe.com/sandboxes) | Isolated testing; sandbox payments are not processed by payment networks | Candidate payments lab; distinguish fixtures from an observed sandbox call |
| [Plaid sandbox overview](https://plaid.com/docs/sandbox/) | Test environment and simulated scenarios; sandbox data does not capture all production complexity | Candidate open-finance lab with explicit consent, stale-data and environment tests |
| [Visa API environments and usage](https://developer.visa.com/resources/working-with-visa-apis) | Separate Sandbox, Certification and Production environments; product-specific access and commercial arrangements | Candidate payment/identity API research; confirm the exact product's requirements before use |

Read the relevant product endpoint contract before implementation. A provider
brand is not a guarantee that every API is available in every market or sandbox.
Synthetic invoices, ledgers and event fixtures remain useful when credentials
or suitable product access are not available.

## Evidence limits

The organizer pages were reviewed on the date above. The directory findings are
not a complete list of fintech events, and no popularity ranking was computed.
No application flow, owner eligibility, admission outcome or production API
connection was tested. Source links establish the reviewed statements; only
separate runtime/build/submission receipts can establish the studio's actions.
