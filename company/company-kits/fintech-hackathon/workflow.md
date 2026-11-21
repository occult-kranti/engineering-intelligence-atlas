# Sprint, evidence and knowledge-transfer workflow

Reviewed 21 November 2026. This is a reusable operating contract to map onto
Daftar's supported company, service-contract, roadmap, goal, job and artifact
records. It does not add an unimplemented status, scheduler or adapter merely by
naming one.

The [company catalog](../index.json) defines the saved roadmap keys and dependency
graph; [README.md](README.md#first-operating-round-and-roadmap) maps those exact
keys to this guide. The stage table below describes work inside those milestones,
not a second numbered roadmap. The [first-demo brief](first-demo-brief.md) is a
proposed artifact feeding `charter`, `discovery`, `architecture` and `prototype`;
its existence does not complete those milestones.

## Minimum kickoff packet

The director gives the sprint producer a compact packet containing company and
initiative IDs; owner authorization references; problem and demo acceptance;
qualified opportunity evidence or the internal-demo designation; source
repository and permitted paths; permitted data; credential reference names;
active service contracts; dependencies; and limits for tokens, duration,
iterations, concurrency and USD.

Attach relevant source/artifact pointers instead of long conversation history.
Use [sprint-task.example.json](sprint-task.example.json) as a synthetic formatting
example. It is not a dispatch-ready permission grant and its USD cap is zero.

## Small dependency graph

| Stage | Independent work where useful | Join condition |
| --- | --- | --- |
| Qualification | Organizer-rule review; available-data review | Named director records event eligibility or chooses an internal build |
| Brief | User journey; known-answer fixture; interface sketch | Product analyst accepts one outcome and the input/output contract |
| Implementation | UI using the accepted fixture; adapter using the same contract; source/license inventory | Exact revisions integrate into one runnable slice |
| Verification | Core/failure walkthrough; credential and scope review; claim review | Material defects resolved or explicitly bounded in the demo |
| Packaging | Pitch narrative; setup guide; evidence index | Required files and links match the verified build |
| External submission | Single owner/action executor | Receipt recorded, or uncertainty reconciled before retry |
| Continuity | Component reuse review; next-step options | Donna records keep, harden, pause or archive with evidence |

Avoid splitting a tiny patch into a committee. Parallel jobs must have distinct
editable paths or a shared contract and merge owner. A planned dependency is
enforced only when the runtime's validated job graph carries it; the document
alone cannot prevent dispatch.

## Checkpoints and bounded spending

Recommended initial sprint allocation, expressed as shares of the approved
time box: 10% qualification/brief, 55% build, 20% verification, 15% packaging and
handoff. These are planning defaults, not measured optimums. An unfamiliar
financial integration may require more qualification and less scope.

Create checkpoints after the brief, integrated slice, meaningful test result and
final packet. Record the artifact revision/hash and next action so another
authorized worker can continue. A checkpoint contains concise findings and
decisions, not hidden reasoning transcripts.

For every job, distinguish reserved budget, observed usage and uncertain usage.
Release unused reservations after reconciled completion; never count a parent
allocation and its child reservation as two separate expenses. Do not assume
that time pressure permits a new service subscription, travel purchase or a
larger provider ceiling. Near a warning threshold, reduce optional work and
checkpoint. At the hard ceiling, preserve progress and stop new spending until
the existing authorization permits continuation.

## Artifact and ledger structure

Keep one initiative register with pointers to:

1. `brief` — problem, audience, acceptance and assumptions.
2. `opportunity` — event edition, rule/deadline sources and qualification status.
3. `decision` — owner, options, concise rationale and budget allocation.
4. `contract` — active specialist identities, permitted scope and deliverables.
5. `build` — source revision, dependencies, commands and environment.
6. `verification` — actual checks, outcome, defects and evidence captures.
7. `submission` — exact packet, destination and receipt or unresolved status.
8. `handoff` — accepted artifacts, known debt and next action.

Each worker ledger entry records the task asked, assigned owner/role, input refs,
planned output, actual returned artifact, acceptance outcome, usage and next
owner. A failed or cancelled task retains useful files and a clear reason. A
completed task without an artifact or acceptance evidence needs reconciliation.

## Data and cache boundaries

Use a cache key that includes company scope, source identity/version,
authorization context, task-schema version and relevant freshness window. Do
not reuse another company's private result simply because prompts look alike.
Public documentation may be shared by reference; a customer's private financial
record may not.

Cache read results and immutable artifacts, not side-effect completion. A
pending/posted transaction transition, consent revocation or source correction
invalidates derived results that depend on it. Deduplicate source evidence by
hash while preserving the relationship from each company/job that used it.
Keep credentials out of logs, source snapshots, screenshots and artifact bodies.

The schema and adapter should be chosen for the actual workload. The studio
does not prescribe a language rewrite: use Rust for a measured native or
concurrency need and retain existing interfaces when they meet the acceptance
criteria. Profile before claiming memory or latency improvement.

## Handoff to the marketing company

Share only an accepted demo brief, brand assets the studio owns, explicit public
claims, permitted screenshots, audience, draft CTA and source/evidence refs.
Name the recipient company and purpose in the knowledge-transfer record. The
marketing company returns the pitch, captions and campaign draft plus a claim
audit. Its private account credentials, unrelated customer work and publishing
authority do not flow back into the studio.

A public launch, direct message, press contact or event submission is a separate
external action. The handoff can make its content concrete and reviewable;
execution follows the user's applicable authorization and the actual supported
connector. A document stating “ready” does not establish publication.

## UI and operating-state mapping

In the initial single-office blueprint, group the rooms in discovery → lab →
arena order. Expansion into separate offices is a later capacity decision.
The roadmap owns milestone dependencies; the ownership board shows the
director and contracted specialists; the whiteboard links the user journey,
source/rule cards, architecture and demo evidence. Donna stays the single
owner-facing conversation with an explicit company/task scope.

Use Daftar's saved-record heat signals for queued work and recorded commitments.
Do not invent realtime CPU, employee productivity or financial performance.
Unknown data has its own label. Color accents support status labels and icons:
green can mark accepted/available work, gold an upcoming checkpoint, and the
existing attention token a blocker; do not encode status through hue alone.

## Release and continuity checklist

Before an accepted handoff, confirm that the exact source revision builds, core
and material failure paths have observed results, source/license obligations
are recorded, credentials are absent from artifacts, all demo links are usable
at the intended audience, and event rule constraints still fit the packet.
Keep only checks relevant to the actual consequence; this is not a requirement
for exhaustive certification of a prototype.

Record whether the next owner should harden the existing prototype, extract one
component, run a targeted experiment or archive it. “Paused” preserves useful
work; “archived” retains provenance. Neither status is permission to delete
the repository, workspace, submission or evidence.
