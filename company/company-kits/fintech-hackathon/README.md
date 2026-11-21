# Fintech & Hackathon Studio

Public reusable company kit · reviewed 21 November 2026

## Mission

Turn well-evidenced financial problems into small, useful prototypes, enter
appropriate hackathons, and preserve the work that deserves further investment.
The studio covers payments, open finance, financial operations, risk tools,
insurance workflows, financial education and carefully scoped digital-asset
experiments. It also accepts useful general hackathon briefs when the problem,
team eligibility and event rules fit.

“Top” means a ranked fit for this portfolio's skills, available time, costs and
desired outcomes. It is not an unsupported global ranking of events or fintech
businesses. The [opportunity register](opportunity-sources.md) separates current
listings, incomplete qualifications and closed programmes.

This kit supplies an operating charter, role briefs, a roadmap and reusable
packets. The owner workspace records actual company IDs, staff assignments,
contracts and progress. Reading this file neither starts workers nor connects a
financial account. A persistent employee is a saved identity; a job runs only
when the supported runtime dispatches it within an authorized scope.

## Organization and office blueprint

Start with **one office and nine departments**. Group the rooms into strategy,
lab and delivery zones in the blueprint. Separate physical office records can be
created later if workload warrants it; the initial setup does not claim that
three offices are already installed.

| Blueprint zone | Department | Accountable work | Initial staffing |
| --- | --- | --- | --- |
| Strategy & Opportunities | Studio Direction | Scope, prioritization, product discovery, delivery commitments and escalation to Donna | Existing scoped subdirector and the product discovery analyst |
| Strategy & Opportunities | Research | Opportunity radar, organizer rules, existing alternatives and source evidence | Opportunity scout with shared research support |
| Fintech Lab | Payments & Open Finance | Sandbox integration contracts, consent states and transaction events | One fintech integration specialist |
| Fintech Lab | Financial Operations | Reconciliation, invoices, reporting and operational exceptions | Product analyst, with shared backend/database expertise |
| Fintech Lab | Risk & Quality | Threat model, claims review, data handling and independent checks | Existing QA lead and contracted security staff |
| Fintech Lab | Engineering | Vertical implementation, accessibility and release evidence | Existing engineers and contracted design staff |
| Delivery | Hackathon Arena | Work graph, time box, checkpoints and submission readiness | One sprint producer, with the shared hackathon lead |
| Delivery | Demo & Growth | Tested walkthrough, pitch, application packaging and approved communication | Shared design staff; scoped work from the marketing company |
| Delivery | Knowledge & Continuity | Source register, artifact index, reproducible handoff and next investment decision | Shared research/knowledge and release staff |

Add **four specialist employee definitions**: opportunity scout, product analyst,
fintech integrator and sprint producer. Reuse the existing subdirector, knowledge
curator, QA lead and blueprint/design identities, plus shared specialists through
active service contracts. Keep a single primary owner on a
work item even when several departments contribute. The director reports to
Donna; Donna maintains the owner-facing conversation and sends cross-company
decisions to the CEO/owner. Titles do not grant new tools or access.

The [company catalog](../index.json) is the source of truth for stable keys,
initial staff placement and roadmap dependencies. The analyst's home department
is Studio Direction; its research and Financial Operations work crosses those
responsibility areas through scoped tasks. The [role briefs](roles.md) map these responsibilities to Daftar's existing role
library. A new client contract reuses an employee ID and supplies only its scoped
input packet. It does not expose another company's private client records.

## Product laboratory

Select one lane for the first build. The following are proposed research and
prototype directions, not completed integrations or validated commercial claims.

| Lane | Useful first slice | Evidence needed before claiming success |
| --- | --- | --- |
| Payments | Sandbox checkout with successful, failed and duplicate-event paths | Test event receipt, idempotency check and displayed transaction status |
| Open finance | Consent-aware view of synthetic account transactions | Permission state, expiration behavior, unavailable-data state and provenance |
| Financial operations | Match synthetic invoices and payments; place exceptions in a review queue | Known-answer fixture, reconciliation accuracy and correction audit trail |
| Risk and identity | Explain a synthetic transaction's review signals | Explicit limitations, feature provenance and tests for missing/conflicting input |
| Insurance workflows | Inventory declared assets and compare them with a sample coverage schedule | Traceable source clauses and unresolved questions; no asserted coverage decision |
| Financial education | Interactive explanation of a general concept with worked examples | Formula checks, assumptions, accessibility and independent source review |
| Digital-asset infrastructure | Testnet transaction status and event reconciliation | Chain/environment labels, replay behavior, fixture cases and key isolation |
| Adjacent FinOps | Explain cloud-cost allocation and anomaly review from sample billing data | Cost definitions, source window, allocation reconciliation and estimated-vs-observed labels |

FinOps cloud-cost work is an adjacent engineering/business discipline. A project
with “FinOps” in its name is not automatically a financial-services product.
Classify the actual brief before assigning fintech, marketing or cloud-platform
ownership.

Use an isolated development environment and synthetic fixtures first. Stripe
documents isolated sandboxes without real payment processing; Plaid documents a
testing environment whose data does not reproduce every production condition;
Visa distinguishes Sandbox from its later certification and production stages.
These are candidate integration paths, not evidence that Daftar has connected
them. See the [source register](opportunity-sources.md#fintech-infrastructure-reading-list)
for official documentation and review dates.

## Opportunity-to-delivery workflow

1. **Discover.** Record the organizer URL, event identity, retrieval date and a
   short statement of fit. A directory listing creates a lead, not an entry.
2. **Qualify.** Verify the current edition's eligibility, team rules, exact
   deadline and timezone, attendance requirements, pre-existing-code policy,
   AI-assistance policy, licenses/IP, required sponsor use and submission format.
   Preserve unknowns instead of converting them to permission.
3. **Choose.** The director records fit, estimated effort, cash costs and a
   go/defer/no-go decision. Existing owner authorization is used where it covers
   the concrete action; the kit does not introduce a new blanket approval gate.
4. **Define the outcome.** Product Discovery writes one user problem, one demo
   journey, a failure case and an observable success check. Separate “learn from
   this event” from “enter this event.”
5. **Plan a small graph.** Assign explicit owners and prerequisite artifacts.
   Parallelize independent interface, fixture and design work; join it at a
   tested integration checkpoint.
6. **Build and record.** Use the event's permitted starting point. Capture source
   revision, dependencies, build commands, fixtures and actual test results.
   Save work at every meaningful checkpoint.
7. **Review the demonstration.** Run the promised journey and at least its
   material failure case. Separate mocks, sandbox responses and live behavior in
   both the interface and the pitch. Remove unsupported performance claims.
8. **Prepare the submission.** Produce the exact required files, links, license
   disclosures, attribution and event-specific declarations. Recheck the
   deadline and access of each link before sending.
9. **Record the action.** “Prepared” is distinct from “submitted.” A submitted
   status requires a receipt or an explicitly attributed owner report. An
   uncertain submission result is reconciled before retrying.
10. **Decide continuity.** Archive, reuse or harden the prototype based on evidence
    and the owner's goals. Capture lessons and known debt without inventing
    adoption, revenue, awards or customer approval.

An event can forbid code prepared before its start. Preserve existing components
as reference material, and reuse them in a submission only when that edition's
rules allow it. An internal demo can be built independently and must not be
presented as an eligible competition entry without that check.

## First operating round and roadmap

The eight rows below use the exact milestone keys, titles, owners and dependencies
from the [company catalog](../index.json), under `companies[key=fintech-hackathon]`.
The shorter acceptance descriptions elaborate that catalog without defining a
second numbered roadmap. Company provisioning/readback is a setup receipt, not
an extra milestone. Actual workspace completion requires its own evidence.

| Catalog milestone key and title | Catalog owner key | Depends on | Deliverable and acceptance |
| --- | --- | --- | --- |
| `charter` — Confirm the first fintech problem and success measure | `director` | None | One target user/problem, source evidence, accountable owner, success measure or explicit unknown, excluded scope and bounded allowance |
| `radar` — Qualify the opportunity radar | `scout` | `charter` | Dated organizer shortlist, rules and eligibility, unknown/closed/open distinctions, fit scorecard and go/no-go decision |
| `discovery` — Validate the user journey and sandbox choice | `analyst` | `charter` | User-journey evidence, alternatives, synthetic-data choice, integration boundary and smallest useful vertical slice |
| `architecture` — Design the integration and risk boundary | `integrator` | `discovery` | Data-flow and event/ledger contracts, environment separation, recovery and failure-case design with scoped shared-service review |
| `prototype` — Build and verify a runnable prototype | `integrator` | `architecture` | Exact revision, reproducible setup, deterministic fixtures, observed success/failure/replay results and clear demo limitations |
| `submission` — Prepare the event-specific submission | `producer` | `radar`, `prototype` | Event-rule-to-artifact checklist, required files, license attribution and usable demo links; preparation never implies submission |
| `growth` — Test the proposition and economics | `analyst` | `prototype` | Evidence-qualified audience demo/landing-page draft, cost assumptions and a next experiment decision; no implied ads or posting |
| `handoff` — Decide what graduates and archive the rest | `knowledge` | `submission`, `growth` | Evidence-backed continue/pivot/archive decision, reusable assets, debt, next owner and milestone; awards/revenue need separate proof |

`radar` and `discovery` can progress independently after `charter`. An internal
demo may reach `prototype` without selecting an event; it must retain that label
and cannot be represented as eligible competition code. Internal checkpoint
handoffs may be saved at any stage, while completing the catalog's final
`handoff` still follows its recorded dependencies. If event participation is
excluded, the director records the disposition of `submission` explicitly.

The first round should qualify a short list and choose one build, not initiate
several paid parallel competitions. A reasonable initial experiment is a
synthetic invoice/payment reconciliation workbench: it can expose a complete
workflow with correction and audit evidence without connecting a real bank.
The [first-demo brief](first-demo-brief.md) makes this proposed, unexecuted work
item concrete through a small fixture, invariants, controls and acceptance. It
is not a completed product or an event-specific eligibility claim.

## Work graph, budget and review cadence

Use [workflow.md](workflow.md) for the concrete packet, graph and checkpoints.
Every job names input references, allowed paths/tools, output artifact,
acceptance checks, owner and remaining allocation. Avoid sending the entire
portfolio history to every employee.

The company inherits the existing global budget rather than adding a second
copy of it. Company, sprint and job allocations are nested reservations. Record
actual provider cost, unpriced/uncertain cost and other expenses separately.
Travel, entry fees, hosted infrastructure and provider inference are different
expense categories. An award or stipend is not available funding until its
receipt is established.

Suggested planning defaults are one selected build, at most three independent
active implementation jobs, and one short evidence-review pass at each merge
point. Actual concurrency must follow the runtime's available capacity. These
are proposed operating defaults, not newly enforced runtime limits.

At budget warnings, preserve artifacts and narrow scope. At a hard ceiling,
checkpoint and pause new spending; never erase progress, silently raise the
ceiling or retry an uncertain external write. See Daftar's existing
[budget research](../../../project/PROMPT_BUDGET_RESEARCH.md) and
[portfolio contract](../../../project/PORTFOLIO_ARCHITECTURE.md).

## Owner controls and truthful states

The company dashboard should expose the chosen initiative, accountable owner,
event qualification, deadline provenance, next dependency, build evidence and
remaining authorized budget. Existing roadmap, blueprint, ownership and Donna
views remain the control surfaces. A documented workflow is not an unimplemented
social, bank, payment or event-submission connector.

Use explicit states: `discovered`, `needs-information`, `qualified`, `deferred`,
`in-progress`, `demo-verified`, `ready-to-submit`, `submitted`, `closed` and
`archived` in evidence packets. Map them to supported runtime status fields
without adding unsupported enum values. A successful build is not an event win,
financial approval, security certification or production authorization.

The owner controls account access and external acts. Company roles may prepare
research, code, tests and draft submissions within their assigned scope. Real
money movement, regulated account operations, public messaging, external
enrollment and binding agreements remain distinct actions with their own
concrete authorization and supported tools.

## Kit index

- [Roles and bounded prompts](roles.md)
- [Current opportunity sources and infrastructure references](opportunity-sources.md)
- [Workflow, evidence, cache and handoff contracts](workflow.md)
- [Proposed first-demo brief](first-demo-brief.md)
- [Synthetic reconciliation fixture](first-demo-fixture.json)
- [Synthetic opportunity packet](opportunity.example.json)
- [Synthetic sprint task packet](sprint-task.example.json)

Private client briefs, contact details, credentials and account records belong in
the owner's workspace. This public kit contains only reusable structures and
public source references.
