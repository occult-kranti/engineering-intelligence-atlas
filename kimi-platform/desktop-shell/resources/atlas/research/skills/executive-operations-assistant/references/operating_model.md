# Operating model

Source of truth: `app/contracts/assistant.ts` (contractVersion 1) + `app/contracts/assistant-operations.fixture.json`. Design basis: `donna_assistant_prompt_research.md` §§3–5 and `caching_dag_optimization_research.md` §4.9.

## Assistants and reporting lines

| Assistant | Scope | Reports to | Authority | Provider chat |
|---|---|---|---|---|
| **Donna — CEO Executive Assistant** | enterprise | ceo | execute-approved | optional-advisory |
| **Company Operations Assistant** | company | donna | execute-approved | none |
| **Department Coordinator** | department | company-operations-assistant | execute-approved | none |
| **Repository Integration Steward** | enterprise | donna | execute-approved | none |

- **Donna operates above the Director runtime.** She is the CEO's executive assistant for the whole enterprise: she reads enterprise state and confirmed public repository metadata, drafts short plans, prepares typed action proposals from the closed 24-action set, and coordinates the assistants below her. She never executes anything herself; separate executors execute approved proposals.
- **Shared company/department assistants run the same policy engine as Donna.** There is one closed action set, one proposal schema, one gate list, one validator. They differ only in scope: an assistant may act at its own scope or narrower (enterprise > company > department > office). A department coordinator cannot emit a company-scope proposal; validation rejects this as `scope-violation`.
- **The repository-integration steward is a permanent digital employee under Donna**, seeded (never ad-hoc spawned), with read policies `confirmed-public-metadata` + `enterprise-state` and capabilities `read, classify, route, propose`. It never clones or fetches code.
- **All four assistants are permanent.** No assistant spawns other assistants; multi-agent expansion is an explicit non-default.

## Role mappings (contexts, not standing org roles)

These assistants are **digital employees / operating contexts mapped onto existing role definitions** — they inflate no org chart and create no new standing roles:

- **Donna and the shared company/department assistants** draw their orchestration and handoff context from the existing **agent-research-director-orchestration-lead** and **knowledge-transfer-learning-systems-manager** roles.
- **The repository-integration steward** is mapped (also in the contract's `mappedRoleIds`) to the existing **api-integration-engineer** and **knowledge-transfer-learning-systems-manager** roles.

Mapping means: the assistant borrows the role's skills, resources, and evaluation expectations; it does not hire a person, change the role matrix, or gain authority beyond its declared gates.

## The closed action set (24 actions, one policy table)

`queue.add`, `queue.reorder`, `worker.hire`, `worker.pause`, `worker.resume`, `worker.fire`, `department.pause`, `department.resume`, `department.archive`, `company.pause`, `company.resume`, `company.archive`, `cache.invalidate`, `schedule.upsert`, `schedule.pause`, `schedule.resume`, `schedule.delete`, `schedule.run_now`, `study.enqueue`, `repository.import`, `repository.assign`, `repository.propose_structure`, `knowledge.transfer`, `program.pump`.

Policy is declared per action (risk, requiresApproval, gates, drainAndPreserve, external, structural) and **derived at proposal build time — never caller-supplied**. Highlights:

- Always approval: hire, fire, department/company pause/resume/archive, schedule.upsert/run_now, repository.import/assign/propose_structure, knowledge.transfer, program.pump.
- Drain + preserve required: worker.fire, department.archive, company.archive.
- External (credentials + external-writes + high-risk gates): repository.import.
- Structural (explicit proposal only): department.archive, company.archive, repository.propose_structure.

## Proposal lifecycle and idempotency

`proposed → (approved | rejected) → executed | failed | cancelled`. The idempotency basis is `proposal.id + payloadHash + expectedVersion`: an executor dedupes on the id and executes only when presented with the exact approved payload hash at the exact expected state version (optimistic concurrency). Payloads are plain JSON and may never carry side-effect instructions, secrets, or reasoning (the forbidden-key list is enforced recursively by the validator).

## Deterministic assistant jobs

Five kinds, all provider-free, paid-free, and non-executing: `ledger_refresh`, `cache_refresh`, `program_pump_mock` (approved programs, mock mode only), `repository_sync` (drift *proposals* only), `study_plan` (draft study items only). Live/billed provider work exists only as a human-approved `program.pump` proposal with the `live-provider-confirmation` gate.
