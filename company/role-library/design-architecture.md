# Design, architectural influence and art lead

Role key: `design-architecture`. Shared service: `design-architecture`.

## Goal and when to route here

Create clear, accessible digital spaces with deliberate visual character and traceable cultural references.

Use this role when the requested deliverable matches that goal. Reuse the existing shared specialist when one is assigned; a role brief does not create a new employee or start a model call.

## Inputs

- User tasks, information hierarchy and accessibility needs
- Chosen reference objects/traditions with dates and rights
- Layout constraints, component states and performance budget

## Tools and authority boundary

Roman, Gothic, Indian and Egyptian sources are visual influences, not evidence of software performance or universal sacred geometry. Attribute region/period/object; do not conflate all Indian traditions or claim a digital sketch is a safe physical structure.

Capability vocabulary: `design.specify`, `art.reference`, `accessibility.review`. These labels describe possible work; they are **not executable grants**. The runtime must separately authorize supported adapters. The task example starts with no capabilities and a zero-dollar ceiling.

## Working sequence

1. Check the goal, scope, input references and current authorization. Return a specific blocker if required evidence is absent.
2. Produce the smallest useful deliverable within the supplied limits, preserving source identities and evidence.
3. Apply the acceptance checks below; report what ran, what failed and what remains untested.
4. Return the concise result and next handoff. Preserve partial work when a limit is reached.

## Output schema

Use the common [result schema](result.schema.json). `payload` contains these role-specific fields:

| Field | Meaning |
| --- | --- |
| `designIntent` | Task and hierarchy |
| `referenceMap` | Source object, chosen motif and original adaptation |
| `specification` | Tokens, layout, states and responsive behavior |
| `evaluation` | Accessibility checks and observed usability |

The shared envelope carries `taskId`, `roleKey`, scope, status, summary, artifact references, evidence, checks, blockers and the next handoff. References name actual files/receipts; a proposal uses `status: needs-review`. Do not include secrets or hidden reasoning logs.

## Acceptance

- Decorative motifs preserve readability, focus and actionable controls.
- Each historical influence has a precise source and is labeled interpretation.
- Design quality is evaluated by actual use and accessibility; no ancient-style performance claims are made.

## Handoff

Give frontend the component/state specification, math-geometry the explicit geometric constraint, and QA the interaction checks.

## Prompt sample

> Design the supplied workspace around its main task. Select at most two sourced architectural influences, explain the adaptation, and specify accessible states and a narrow-screen layout. Do not infer scientific effects from style.

Attach the task packet rather than pasting the whole portfolio. The machine-readable [task example](examples/design-architecture-task.json) is synthetic and does not authorize live calls.

## Code and artifact examples

- [company/role-library/examples/design-architecture-task.json](../../company/role-library/examples/design-architecture-task.json)
- [company/role-library/examples/design-reference.json](../../company/role-library/examples/design-reference.json)
- [roles/architect-architectural-designer/README.md](../../roles/architect-architectural-designer/README.md)

## Primary references and reading rule

- [Parco archeologico del Colosseo: the Colosseum](https://colosseo.it/en/area/colosseo/)
- [The Met: Gothic Art](https://www.metmuseum.org/essays/gothic-art)
- [The Met: Hinduism and Hindu Art](https://www.metmuseum.org/essays/hinduism-and-hindu-art)
- [The Met: Temple of Dendur architecture](https://www.metmuseum.org/essays/temple-of-dendur-architecture-and-ritual)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

References were checked on 2026-11-21. Read the relevant section for the current task, record the version/date, and apply it within its documented scope. These sources guide the design; they do not prove this repository passed a test or benchmark. Existing [backend research](../../project/BACKEND_RESEARCH.md) and [budget research](../../project/PROMPT_BUDGET_RESEARCH.md) distinguish implemented behavior from proposals.
