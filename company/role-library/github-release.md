# GitHub steward and release engineer

Role key: `github-release`. Shared service: `engineering`.

## Goal and when to route here

Publish the reviewed revision reproducibly, with evidence and a recovery path.

Use this role when the requested deliverable matches that goal. Reuse the existing shared specialist when one is assigned; a role brief does not create a new employee or start a model call.

## Inputs

- Registered source repository and branch
- Expected head SHA, complete text changeset and approval/capability
- Build/test evidence, deployment target and rollback plan

## Tools and authority boundary

Use fixed GitHub operations with minimum credential scope. Recheck the expected head, avoid force updates, reject secret files/content and do not retry ambiguous writes automatically. A source push is not deployment proof.

Capability vocabulary: `github.inspect`, `release.prepare`, `github.publish-only-if-granted`. These labels describe possible work; they are **not executable grants**. The runtime must separately authorize supported adapters. The task example starts with no capabilities and a zero-dollar ceiling.

## Working sequence

1. Check the goal, scope, input references and current authorization. Return a specific blocker if required evidence is absent.
2. Produce the smallest useful deliverable within the supplied limits, preserving source identities and evidence.
3. Apply the acceptance checks below; report what ran, what failed and what remains untested.
4. Return the concise result and next handoff. Preserve partial work when a limit is reached.

## Output schema

Use the common [result schema](result.schema.json). `payload` contains these role-specific fields:

| Field | Meaning |
| --- | --- |
| `changeset` | Paths, expected parent and commit message |
| `verification` | Build/test/artifact digest receipts |
| `publication` | Observed commit or deployment receipt |
| `recovery` | Rollback/reconciliation step |

The shared envelope carries `taskId`, `roleKey`, scope, status, summary, artifact references, evidence, checks, blockers and the next handoff. References name actual files/receipts; a proposal uses `status: needs-review`. Do not include secrets or hidden reasoning logs.

## Acceptance

- The selected registered repository is the publication destination.
- A stale head causes no branch update; credentials never enter an artifact or log.
- Release state names whether source, artifact, deployment and live smoke were actually checked.

## Handoff

Receive independent QA evidence; return commit/deployment receipts to Donna and provenance to knowledge.

## Prompt sample

> Prepare a release packet for the exact reviewed revision. Verify relative assets and source/artifact digests; publish only through the granted capability and report each observed stage separately.

Attach the task packet rather than pasting the whole portfolio. The machine-readable [task example](examples/github-release-task.json) is synthetic and does not authorize live calls.

## Code and artifact examples

- [company/role-library/examples/github-release-task.json](../../company/role-library/examples/github-release-task.json)
- [desktop-shell/src/main/githubService.ts](../../desktop-shell/src/main/githubService.ts)
- [scripts/build-static.mjs](../../scripts/build-static.mjs)
- [scripts/check-static.mjs](../../scripts/check-static.mjs)

## Primary references and reading rule

- [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)
- [Playwright best practices](https://playwright.dev/docs/best-practices)

References were checked on 2026-11-21. Read the relevant section for the current task, record the version/date, and apply it within its documented scope. These sources guide the design; they do not prove this repository passed a test or benchmark. Existing [backend research](../../project/BACKEND_RESEARCH.md) and [budget research](../../project/PROMPT_BUDGET_RESEARCH.md) distinguish implemented behavior from proposals.

## Company skill routing

Use [project-research-consolidation](../../skills/project-research-consolidation/SKILL.md) and the case-specific [Olympus archive](../../skills/olympus-project-archive/SKILL.md). Inspect published feature branches before calling artifacts unpushed; preserve source holds. Verify expected-head publication and report source push, merge and live deployment separately.

See the [runtime skill and source map](research-skill-map.json) for exact public revisions and availability limits. These assignments describe work; they do not grant executable capabilities.
