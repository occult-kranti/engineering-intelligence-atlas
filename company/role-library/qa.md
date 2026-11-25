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

## OpenCodeGameStudios project resources

Use the pinned [project resource pack](../../integrations/opencode-game-studios/README.md) for the relevant programming, architecture, design, art, Godot or QA procedure. The integration records the source revision and individual resource hashes; its selected definitions are guidance for the assigned employee. They do not create new identities, activate an AI harness, enable MCP servers or change Donna's ownership. Read only the resources needed for the task.

For heritage assets, use the [captured-places library](../../projects/architecture-library/site-models/README.md), keep original source bytes and rights, and compare the decoded geometry against the conversion receipt. Geometry density does not establish physical accuracy. Keep capture, historical reconstruction and invented teaching geometry distinct. Hand QA the exact artifact and actual Blender/Godot results; mark an unavailable Unreal run untested.

## Game-art learning and production references

Use the [game-development research plan](../../projects/game-development-research/README.md) to choose a bounded drawing, Blender asset, procedural geometry, animation, engine-import or rendering task. The [art guide](../../projects/game-development-research/ART_FUNDAMENTALS.md) and [pipeline matrix](../../projects/game-development-research/PIPELINE_AND_RENDERING.md) record verified creator links, access conditions and corrected claims. Hand off an original artifact with source rights, exact versions, import settings and measured acceptance; a tutorial link is not a completed lesson, installed tool or performance result.
