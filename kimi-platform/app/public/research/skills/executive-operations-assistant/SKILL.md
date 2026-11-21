---
name: executive-operations-assistant
description: >-
  Operate the enterprise executive-assistant layer: Donna (CEO executive assistant above the Director runtime), the shared company/department operations assistants, and the permanent repository-integration steward. Use for typed action proposals through non-bypassable approval gates (queues, hiring/pause/resume/fire with drain-and-preserve, bounded schedules, cache invalidation, repository routing, study queues, knowledge handoffs), deterministic schedule/validation checks, Donna-style prompting with guided action summaries and no raw chain-of-thought, and safe public-repository intake without cloning, paid calls, or automatic roles.
---

# Executive Operations Assistant

Assistants propose; humans approve; separate executors execute. Authorization lives in code (`validateAssistantAction`), never in prompt text. Everything here mirrors the shared contract `app/contracts/assistant.ts` (contractVersion 1) and its golden fixture `app/contracts/assistant-operations.fixture.json`; the contract is the source of truth, this skill is the operating manual plus offline verifiers.

## Route the task

1. **Understand the operating model first.** Read [references/operating_model.md](references/operating_model.md): Donna above the Director, company/department assistants on the same policy engine, the permanent repository steward, role mappings (contexts, not new standing org roles).
2. **Prompting or evaluating Donna.** Read [references/prompting_and_evaluation.md](references/prompting_and_evaluation.md): direct structured answers + short-plan baseline, guided action summaries (no raw CoT), justified escalation only, strict schema with explicit `not_found`, the 12 baseline eval cases, and the explicit non-defaults (no tree search, self-consistency, multi-agent expansion, or provider summarization of ledgers).
3. **Queues, hiring, schedules.** Read [references/queues_hiring_schedules.md](references/queues_hiring_schedules.md): queue add/reorder, approved hire/pause/resume, fire/archive drain-and-preserve, company/department controls, bounded one-time/interval jobs, no automatic paid calls, no missed-run storms.
4. **Caches, memory, handoffs.** Read [references/cache_memory_handoffs.md](references/cache_memory_handoffs.md): content-hash caches with version/seq invalidation, never cache provider responses, artifact refs / work ledger / timeline / handoff manifests.
5. **Repository intake.** Read [references/repository_intake.md](references/repository_intake.md): confirmed public metadata only, pinned SHA/license/archived honesty, quarantine, deterministic routing rules, low-confidence human-approved new structures, no auto clone/code/external writes/role inflation.
6. **Knowledge transfer.** Read [references/knowledge_transfer.md](references/knowledge_transfer.md): study queues from resources, refs-only handoff records, preservation on fire/archive.
7. **Security and governance.** Read [references/security_governance.md](references/security_governance.md): the seven non-bypassable gates, emergency stop, owner scoping, secrets discipline, untrusted-context fencing.

## Offline verification (deterministic, stdlib-only, no network)

All scripts validate and report; none executes actions, imports repositories, or makes provider/paid calls.

```bash
python3 scripts/route_repositories.py REPO_METADATA.json     # print a routing proposal
python3 scripts/validate_action_plan.py PROPOSAL.json --approval APPROVAL.json
python3 scripts/schedule_check.py JOB.json --now EPOCH_MS
python3 scripts/run_tests.py                                  # full offline suite
```

`run_tests.py` checks all fixture vectors/cases (routing, action gates, schedule bounds, study queues) plus documentation link hygiene. Offline fixtures in `fixtures/` are derived from the shared assistant fixture and cover UI/React, AI/security, backend/db, design/geometry, music/audio, unknown, unlicensed, archived, private, and new-domain repositories; valid and invalid action proposals (hash tampering, missing gates, forbidden payload keys, missing drain/preserve, scope violations); and schedule bounds (no paid auto-runs, no missed-run storms).

## Hard rules (summary — details in references)

- Every side effect is a typed proposal from the closed 24-action set, with a payload hash, expected version, and policy-derived risk; high-risk/external/structural actions always need human approval with every required gate explicitly confirmed.
- Fire and archive proposals must carry `{drain: true, preserveArtifacts: true}`.
- Deterministic jobs never make provider or paid calls and never execute proposals; schedules are clamped and skip missed runs in one step.
- No raw chain-of-thought anywhere: outcome-level summaries only. Unknown values are `null`/`not_found`, never guesses.
- Repository routing never invents companies, departments, roles, or skills; unlicensed or non-allowlisted code is read-only with redistribution forbidden; unknowns are quarantined. Metadata intake is `public-anonymous` (no credentials, ever) or `credentialed-approved` (vault record + approved import only).
- Emergency stop (`emergency.stop`) is ungated, immediate, and deliberately **not** in the action set: it never travels through the proposal pipeline, and any proposal claiming it is rejected.
