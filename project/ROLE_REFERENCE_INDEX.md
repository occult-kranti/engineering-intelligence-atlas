# Role reference index and routing

The [machine-readable role library](../company/role-library/index.json) contains
compact stable briefs for actual task routing. Each brief links to a detailed
guide, synthetic task packet, code/example paths and primary references. Start
with the task and the relevant role; do not paste the entire library into every
model request.

## Choose the owner of the deliverable

| Need | Role key and guide | Shared service / return route |
| --- | --- | --- |
| Decide portfolio outcomes, priorities and allocations | [`ceo`](../company/role-library/ceo.md) | Owner decision → Donna |
| Maintain one owner conversation and route bounded work | [`donna`](../company/role-library/donna.md) | Coordination → existing service |
| Plan dependencies and accept company work | [`subdirector`](../company/role-library/subdirector.md) | Scoped coordination → Donna |
| Architecture and implementation across boundaries | [`engineering`](../company/role-library/engineering.md) | `engineering` |
| Accessible frontend or explicit source-clipping extension | [`frontend-extensions`](../company/role-library/frontend-extensions.md) | `engineering` → QA/security/research |
| APIs, state transitions and retry contracts | [`backend`](../company/role-library/backend.md) | `engineering` |
| Durable state, cache invalidation and accounting | [`database-cache`](../company/role-library/database-cache.md) | `engineering` |
| Branch inspection, reproducible releases and publication receipts | [`github-release`](../company/role-library/github-release.md) | `engineering` → Donna/knowledge |
| Independent behavioral acceptance | [`qa`](../company/role-library/qa.md) | `engineering`; separate reviewer task |
| Trust boundaries, private data and credential protection | [`security`](../company/role-library/security.md) | `security` |
| Primary-source research and structured evidence | [`research-knowledge`](../company/role-library/research-knowledge.md) | `research-knowledge` |
| A demonstrable vertical slice within a time box | [`hackathon`](../company/role-library/hackathon.md) | `hackathon` |
| Source-linked summaries, indexing and next handoff | [`knowledge`](../company/role-library/knowledge.md) | `research-knowledge` |
| Visual architecture, art direction and cultural references | [`design-architecture`](../company/role-library/design-architecture.md) | `design-architecture` |
| Proof obligations, numerical scope and robust geometry | [`math-geometry`](../company/role-library/math-geometry.md) | `design-architecture`, with research review |
| Original music, sound interfaces and creative assets | [`music-arts`](../company/role-library/music-arts.md) | `music-arts` |
| Analyze observations into candidate causes, then test a forward consequence | [`newton`](../company/role-library/newton.md) | Research panel → skeptic |
| Specify mechanisms, phase, loading and complete energy accounting | [`tesla`](../company/role-library/tesla.md) | Research panel → advisor |
| Challenge inference, source provenance and unresolved proof obligations | [`research-skeptic`](../company/role-library/research-skeptic.md) | Independent task → Donna |
| Choose the next source-bound resonance investigation after critique | [`resonance-advisor`](../company/role-library/resonance-advisor.md) | Research panel → Donna |
| Coordinate matched forward and reverse research contracts | [`paired-research`](../company/role-library/paired-research.md) | Research panel → advisor |

The six canonical service keys match the native shared-service model. Focused
roles describe specialties of an existing service; they do not require twenty-one
always-running agents. A CEO/Donna/subdirector title does not grant external
tools or privileged access. The runtime enforces its supported capability list.

Donna's [decision panel runtime](DECISION_PANELS.md) selects only relevant roles,
reuses eligible contracted or local employees, and hires a missing scoped role
only when needed. Panel rounds become real queue jobs: parallel expert reports
followed by a dependent Donna synthesis. A separate decision record preserves
the verdict, evidence and unresolved disagreements before another round.
The [research skill map](../company/role-library/research-skill-map.json) records
which enabled ChatGPT workflows supplied the compact research briefs. Historical
names identify documented-method lenses; they are not participating people,
endorsers, human peer reviewers or claims of comprehensive source reading.

## Use the library in a working handoff

1. Select one role whose accountable output matches the task. Resolve an existing
   employee or service contract and retain the requesting company scope.
2. Attach only its stable brief, the current goal, bounded input references,
   accepted dependencies, authorized tools and limits. Preserve full artifacts
   by reference instead of repeatedly copying them.
3. Read the linked guide or source section when the task needs that detail. The
   research role records actual source-reading depth; a reference link alone is
   not evidence that its contents were reviewed.
4. Return the [common result envelope](../company/role-library/result.schema.json)
   and the role-specific payload fields documented in the guide. The next worker
   receives conclusions, evidence, uncertainties and an action, not hidden
   reasoning transcripts.
5. Require the task-specific acceptance checks before promoting a result to
   accepted/completed. Record skipped and unavailable integrations explicitly.

Each synthetic `*-task.json` starts with `allowedCapabilities: []`, a zero-dollar
ceiling and one iteration. It is a shape example, not a runnable paid job or
implicit authorization. Likewise the result schema checks an envelope; each
operation still needs semantic validation of scope, evidence and capabilities.

This design follows provider guidance on selecting useful context and preserving
clear orchestration ownership. It is an implementation choice, not a measured
token-saving claim. See [Anthropic context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents),
[OpenAI orchestration](https://developers.openai.com/api/docs/guides/agents/orchestration),
and the existing [prompt/budget research](PROMPT_BUDGET_RESEARCH.md).

## Focused examples

The existing [Security specialist](../company/role-library/security.md) owns the
[Clouds Against Humanity reference path](../company/role-library/references/clouds-against-humanity.md)
and its [synthetic paper task](../company/role-library/examples/security-clouds-against-humanity-task.json).
Donna reuses that shared role for the first three upstream beginner primers
(cloud resources, networking, identity/secrets/zero trust), then scopes later
IaC, threat-modeling, SOC/NOC or privacy questions to a concrete deliverable.
The source register distinguishes maintainer-reported tests, unapplied cloud
designs and reading-based privacy drafts. This addition creates no employee,
scheduled job or deployment; the task has no capabilities and a zero-dollar
ceiling. See the guide for exact primary URLs, reviewed revision and acceptance.

The [Manifest V3 source clipper](../company/role-library/examples/source-clipper/README.md)
demonstrates an explicit **Capture → Review → Export** flow. It requests only
`activeTab` and `scripting`, reads a bounded selected passage, excludes editable
fields and keeps the record local. It does not collect credentials, use hidden
sessions or bypass access restrictions. This matches the gesture-scoped access
model in [Chrome's activeTab documentation](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
A real extension installation/download test remains separate from its local
projection and permission checks.

The [orientation example](../company/role-library/examples/orientation.py) uses
rational input for a small exact predicate, including collinear input. It is not
a proof of arbitrary geometry or a replacement for a robust geometry library.
[CGAL's kernel guide](https://doc.cgal.org/latest/Kernel_23/index.html) explains
why exact predicates and exact constructions are different guarantees.

The [bounded tone](../company/role-library/examples/bounded-tone.js) is an
original, short Web Audio example with explicit start/stop and duration. It does
not autostart, upload audio or claim an effect on the listener. Digital gain is
not measured listening SPL. The [Web Audio specification](https://www.w3.org/TR/webaudio-1.0/)
is the technical reference for the node graph and scheduling behavior.

The [design reference map](../company/role-library/examples/design-reference.json)
shows how to attribute Roman, Gothic, Indian and Egyptian influences while
creating an original digital interface. The references are specific historical
objects and traditions, not interchangeable labels for an ancient universal
design system. The proposed use of repeated bays, vertical grouping, layered
thresholds or spatial sequence is a design interpretation. It does not establish
better software performance, psychological effects or structural safety.

## Sources, versions and verification

Primary references were checked on 2026-11-21 and are attached to each role.
They include official provider/developer documentation, W3C specifications,
GitHub, OWASP, database maintainers, CGAL and the cultural institutions that
document the cited works. The guides summarize only the relevant principle;
they do not copy source manuals or claim that reference compliance has been
certified.

Keep the brief stable and version/hash it when changed. The worker should use the
canonical service key after resolving any runtime assignment alias. Code paths
link to current repository examples and remain distinct from proposed future
capabilities. The public role library contains no real private portfolio names,
source text, API keys or repository-specific plans.
