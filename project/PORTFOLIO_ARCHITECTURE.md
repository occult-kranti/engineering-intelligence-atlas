# Portfolio architecture and preparation contract

Reviewed 2026-11-21. This document describes the generic organization model and
the local preparation tooling. Actual repository membership, private names,
source URLs and per-repository recommendations belong in the private plan.
The public preview uses synthetic or separately approved public records.

## Organize applications without merging repositories

A portfolio group is an organizational parent over existing company records.
It does not merge Git histories, rename repositories, copy all datasets into a
common store, change visibility or publish code. A company keeps its registered
repository URL, source metadata and stable identity. A group supplies a useful
navigation and planning view; one application can use several shared services.

The generic [preset](../company/portfolio-presets.json) supplies eight application
families:

| Group key | Application purpose | Common services |
| --- | --- | --- |
| `control-platform` | Company coordination, developer environments and delivery tools | Engineering, security, research/knowledge |
| `civic-intelligence` | Source-bearing civic/corporate registers, data pipelines and graph analysis | Research/knowledge, engineering, security |
| `learning-games` | Games, quizzes, learning experiences and production assets | Engineering, design, music/arts, hackathon |
| `evidence-archives` | Authorized media/text collections and scoped discourse analysis | Research/knowledge, engineering, security |
| `scientific-labs` | Calculations, geometric instruments and reproducible model studies | Research/knowledge, engineering, design |
| `audio-resonance` | Sound tools, signal simulation and resonance research | Music/arts, engineering, research/knowledge |
| `pattern-symbolic` | Calendars, patterns and source-qualified cultural interpretation | Design, research/knowledge, engineering |
| `personal-tools` | Private daily records and portable local workflows | Engineering, design, security |

These are routing choices, not claims of scientific validity, market fit,
production readiness or shared data permission. The cross-cutting taxonomy is
`engineering`, `frontend`, `backend`, `database`, `security`, `design`, `research`,
`hackathon`, `music`, and `arts`. A repository can carry several tags while keeping
one explicit primary group in a prepared plan.

## Reuse people and services

The native shared-service keys are `engineering`, `design-architecture`,
`research-knowledge`, `security`, `hackathon`, and `music-arts`. The role library
contains each exact key, plus focused guides for API, database/cache, frontend
extensions, GitHub/release, QA, knowledge, mathematics and coordination work.
See the [role reference index](ROLE_REFERENCE_INDEX.md).

A service contract connects a requesting company to existing employee IDs and a
bounded deliverable. Creating another client contract should not clone the same
specialist. An idle employee is a persistent identity, not a background model
loop. A shared specialist receives only the requesting company's authorized
packet and explicitly shared knowledge. Company membership or a parent group
does not grant access to siblings' private content.

The control hierarchy has distinct jobs:

- **CEO/owner:** chooses outcomes, allocations and material tradeoffs.
- **Donna:** maintains one coherent owner conversation, routes work and reports
  actual checkpoints, blockers and decisions.
- **Subdirector:** plans the smallest useful dependency graph for a scoped goal.
- **Shared specialist:** returns the contracted artifact with evidence and limits.
- **Reviewer:** checks the relevant acceptance boundary independently when the
  consequence warrants it; there is no mandatory review swarm for every edit.

This follows the distinction between manager/tool-style coordination and
ownership-changing handoffs in [OpenAI's orchestration documentation](https://developers.openai.com/api/docs/guides/agents/orchestration).
The hierarchy is an application design, not a promise that extra agents improve
quality or reduce cost. Existing [budget research](PROMPT_BUDGET_RESEARCH.md)
explains why smaller context packets, measured task quality and bounded loops
matter more than the number of role titles.

## From private inventory to a reviewable plan

[`prepare-portfolio.py`](../scripts/prepare-portfolio.py) reads three local inputs:

1. **Inventory:** immutable source metadata: `name`, `repoUrl`, `source`,
   `importedAt`, `visibility`, and `defaultBranch` for each repository.
2. **Briefs:** retrieved README content with repository, branch, visibility,
   observed Git blob SHA and source URL; an unavailable README is allowed and
   remains unknown.
3. **Explicit review:** one group, taxonomy tags, observations with exact README
   excerpts, and exactly three concrete next steps per source identity.

All three inputs must cover the same unique source identities. A title-only or
template README does not establish a working product. For a thin snapshot, begin
with source inventory, an observed setup path and a scoped first milestone.
Documented feature/test counts remain README claims until a current check runs.

Example local invocation; paths are illustrative:

```sh
python3 scripts/prepare-portfolio.py \
  --inventory /private/owned-repositories.json \
  --briefs /private/repository-briefs.json \
  --review /private/portfolio-review.json \
  --output /private/portfolio-plan.json
```

The script performs no network requests, model calls, source-code execution,
native-state mutation or GitHub writes. It refuses malformed identities,
duplicate/missing coverage, unsupported tags, excerpts absent from the README
and a roadmap with other than three steps. Inputs are never rewritten. Output
uses atomic replacement and mode `0600`; an existing destination requires an
explicit `--replace`. Symlink paths and private output inside this application's
Git checkout or a separate sibling checkout are rejected. Ambient source-control
metadata above the hosted workspace is not treated as this application's
publishable repository boundary.

The private plan contains:

```json
{
  "schemaVersion": 1,
  "classification": "private",
  "source": {"inventorySha256": "…", "briefsSha256": "…", "reviewSha256": "…"},
  "groups": [{"key": "control-platform", "name": "Company and developer platforms"}],
  "repositories": [{
    "sourceRepositoryId": "repo-<stable digest>",
    "repository": "example/demo-app",
    "sourceRepository": {"name": "demo-app", "repoUrl": "https://github.com/example/demo-app", "visibility": "private", "defaultBranch": "main"},
    "groupKey": "control-platform",
    "taxonomy": ["engineering"],
    "evidence": {"readme": {"status": "available", "sha": "<observed blob SHA>"}},
    "roadmap": [{"id": "repo-<digest>-next-1", "status": "proposed", "inferred": true, "verification": {"status": "not-run", "evidenceRefs": []}}]
  }],
  "application": {"status": "prepared-not-applied"}
}
```

This is an abbreviated shape, not a valid complete fixture. The script emits all
identity fields and exactly three steps, with rationale, acceptance checks,
dependencies and a proposed owner. Each step is explicitly inferred and
unexecuted; the source snapshot is evidence for the recommendation, not proof
the recommendation has already been implemented.

## Apply the plan without changing source identity

Application is a separate, authorized control-plane operation. Resolve every
`sourceRepository.repoUrl` to an existing registered company's ID; fail on an
absent or ambiguous match. The plan's digest-derived source ID is not a
substitute for the native company ID. Replace roadmap scope references only after
this resolution, retain source provenance, and map dependencies using the
returned/native item IDs.

The native action vocabulary includes `configure_ceo`,
`upsert_portfolio_group`, `ensure_shared_services`, `contract_service`,
`share_knowledge`, `upsert_roadmap_item` and `schedule_repository_reviews`.
Its current contracts are in
[`office.ts`](../desktop-shell/src/shared/office.ts) and the
[`native core`](../native-core/src/). Do not infer command arguments from this
document; validate the actual action contract in the target revision.

For each application step, retain the before/after snapshot and operation
receipt. Use existing shared-service recipients or Donna as a coordination
fallback; do not invent employee IDs. A proposed roadmap item stays proposed or
pending until observed evidence supports a state transition. Preparation itself
does not change native state, start employees, allocate provider spending or
publish repository changes.

## Data, budget and context boundaries

Keep identity and permissions in the control plane, source/artifact bytes in
their authorized stores, and compact evidence references in handoff packets.
The [PROV-O model](https://www.w3.org/TR/prov-o/) is a useful reference for keeping
entities, activities, agents and derivation links distinct; this repository's
JSON record is a practical subset, not a claim of complete PROV conformance.

Budget admission must reserve before dispatch and retain unknown charges for
reconciliation. A project, company and global balance are views over a charge,
not three charges. A deadline or prompt token allowance does not stop a provider
unless the executing adapter enforces it. See the
[OpenAI spending-controller example](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api)
and the repository's [backend accounting report](BACKEND_RESEARCH.md).

Keep three caches separate: compiled role/prompt text, provider prefix reuse and
exact-context text output. Reusing a shared employee does not make private
contexts shareable. Role/prompt/source versions participate in invalidation;
cached text cannot replay a GitHub publish or another side effect. The current
worker's capabilities remain the runtime authority, regardless of what a role
document suggests.

## Public demonstrations and verification

An optional `--demo-output` creates fixed synthetic application identities from
the bundled generic group keys. It never redacts and republishes a real plan:
no real names, URLs, descriptions, excerpts, counts, hashes or roadmap wording
are taken from the private input. A custom preset cannot be used for this public
demo mode. The main product preview has its own integration and release process.

Local checks for this preparation layer:

```sh
python3 -m unittest discover -s scripts -p 'test_prepare_portfolio.py'
node --test company/role-library/examples/examples.test.mjs
python3 company/role-library/examples/orientation.py
```

These checks cover identity preservation, complete mapping, honest status,
README evidence binding, private writes, deterministic synthetic demos and small
example behavior. They do not build or deploy other portfolio repositories,
prove an external source was read today, validate every scientific claim, or
exercise an installed browser extension. Those outcomes need their own receipts.
