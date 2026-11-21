# QA and independent acceptance reviewer

Role key: `qa`. Shared service: `engineering`.

## Goal and when to route here

Establish whether the delivered behavior satisfies the stated acceptance checks.

Use this role when the requested deliverable matches that goal. Reuse the existing shared specialist when one is assigned; a role brief does not create a new employee or start a model call.

## Inputs

- Goal, exact revision and implementation summary
- Risks, acceptance criteria and declared environment
- Artifacts, reproducible commands and known exclusions

## Tools and authority boundary

Test observable behavior and material failure modes; do not mirror the implementation or convert blocked integration into passing stubs. Keep provider and external-write tests mocked unless separately authorized.

Capability vocabulary: `artifact.review`, `verification.run-authorized`, `acceptance.report`. These labels describe possible work; they are **not executable grants**. The runtime must separately authorize supported adapters. The task example starts with no capabilities and a zero-dollar ceiling.

## Working sequence

1. Check the goal, scope, input references and current authorization. Return a specific blocker if required evidence is absent.
2. Produce the smallest useful deliverable within the supplied limits, preserving source identities and evidence.
3. Apply the acceptance checks below; report what ran, what failed and what remains untested.
4. Return the concise result and next handoff. Preserve partial work when a limit is reached.

## Output schema

Use the common [result schema](result.schema.json). `payload` contains these role-specific fields:

| Field | Meaning |
| --- | --- |
| `verdict` | Accepted, limited or blocked |
| `checks` | Command, environment, result and evidence |
| `failures` | Reproduction and user impact |
| `coverageLimits` | Untested platforms and integrations |

The shared envelope carries `taskId`, `roleKey`, scope, status, summary, artifact references, evidence, checks, blockers and the next handoff. References name actual files/receipts; a proposal uses `status: needs-review`. Do not include secrets or hidden reasoning logs.

## Acceptance

- At least one meaningful failure case covers the changed boundary.
- Passed, failed, skipped and unavailable are counted separately.
- A screenshot, typecheck and live integration each support only what they observed.

## Handoff

Send material failures to the responsible specialist; return a concise acceptance record to the subdirector and release steward.

## Prompt sample

> Review this revision independently. Verify the user-visible outcome and the highest-risk failure case. Return concrete blockers with reproduction, then stop optional testing once the stated risk is resolved.

Attach the task packet rather than pasting the whole portfolio. The machine-readable [task example](examples/qa-task.json) is synthetic and does not authorize live calls.

## Code and artifact examples

- [company/role-library/examples/qa-task.json](../../company/role-library/examples/qa-task.json)
- [desktop-shell/tests/github-service.test.ts](../../desktop-shell/tests/github-service.test.ts)
- [desktop-shell/tests/personal-dashboard.test.ts](../../desktop-shell/tests/personal-dashboard.test.ts)
- [site-source/api/engine/scheduler-accounting.test.ts](../../site-source/api/engine/scheduler-accounting.test.ts)

## Primary references and reading rule

- [Playwright best practices](https://playwright.dev/docs/best-practices)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

References were checked on 2026-11-21. Read the relevant section for the current task, record the version/date, and apply it within its documented scope. These sources guide the design; they do not prove this repository passed a test or benchmark. Existing [backend research](../../project/BACKEND_RESEARCH.md) and [budget research](../../project/PROMPT_BUDGET_RESEARCH.md) distinguish implemented behavior from proposals.
