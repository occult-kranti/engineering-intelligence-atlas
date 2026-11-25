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

## Color Systems specialist procedure

This is a specialization of the existing `design-architecture` role. Donna
routes color-system work through the assigned employee or an eligible shared
service contract; the procedure creates no duplicate employee, paid request or
executable permission. Reuse the [studio color system](../../project/STUDIO_COLOR_SYSTEM.md),
[semantic tokens](../../desktop-shell/src/renderer/studio-tokens.css) and
[office signal model](../../desktop-shell/src/renderer/office-signals.ts) as the
current source references. Read the relevant sections for the task instead of
copying the entire portfolio into a prompt.

1. Identify the actual user task, selected scope, light/dark preference, current
   token revision and latest explicit color direction. Treat source images as
   visual references; do not import their sample numbers, statuses or permission
   badges as live data.
2. Map canvas, surfaces, text, action, focus and categorical feedback to semantic
   tokens. Keep an action accent separate from a claim of success. Preserve a
   foreground/background pair for every solid action, status chip and legend
   swatch; a visually pleasing hue is not a readability check.
3. Calculate unrounded sRGB contrast for the pairs that will actually appear
   together. Record the foreground, background, ratio, intended threshold and
   outcome. Check normal text, descriptions, placeholders, focus and required
   control boundaries. A token calculation does not establish browser-wide
   accessibility, so record actual component checks separately.
4. Read the signal model's metric definitions, scope, fixed buckets and freshness
   rules before assigning heat colors. Return the selected metric, units, exact
   value, bucket label and numerator/denominator where applicable. Keep unknown,
   confirmed zero, stale data and an explicitly exceeded zero ceiling distinct.
   Never derive capacity or employee quality from a job count, nor replace a
   missing denominator with a fabricated percentage.
5. Provide visible labels or ordinal markers alongside color, an explicit
   unknown treatment, an accessible list alternative and a stable legend across
   scopes. State which colors are decorative. Verify that theme changes preserve
   the current selection, unsent chat and saved work; themes grant no authority.
6. Send the semantic specification and relevant source hashes to Frontend,
   accounting/scope questions to Backend or Database/Cache, and actual keyboard,
   narrow-screen, forced-colors and state-preservation checks to QA. Donna
   receives only the useful outcome, unresolved issue and next accountable owner.

For a color task, retain the normal output envelope and four role fields.
`specification` includes `semanticPalette`, `componentPairs` and `heatLegend`;
`evaluation` includes calculated contrast pairs, unknown-versus-zero cases and
separate observed or not-run interaction checks. `referenceMap` distinguishes
the user's visual direction, primary accessibility guidance and local code.
The envelope's `handoff` names the next role and exact dependency references.

Use the [Color Systems task example](examples/design-color-systems-task.json)
for a bounded paper/local review. Its values and identities are synthetic; its
zero-dollar ceiling and empty capability list do not authorize provider calls,
network access, a code edit or a deployment.

## Architecture library procedure

Use the [architecture and built heritage library](../../projects/architecture-library/README.md)
for dated monument records, structural-element explanations, original Blender
studies and the current geospatial-tool audit. Compose the existing
`architecture-and-built-heritage-research`, `spatial-3d-production-engineering`
and applicable `game-reconstruction-engineering` skills. This is a procedure for
the existing role, not another employee or an executable capability grant.

1. Select a specific site and construction phase, or an explicitly original
   teaching study. Keep source IDs, uncertainty, cultural context and data rights
   with the task. Similar shapes do not prove a common origin.
2. Give Graphics the units, origin, model kind, intended engine, geometry budget
   and permitted inputs. The included studies have invented proportions and
   documented omissions; they are not surveyed reconstructions.
3. For actual Blender jobs, use the configured creative project, assigned tool
   and current native `creative.execute` grant. Inventory and saved role labels
   do not prove that a licensed service is connected.
4. Give Game Engineering the GLB and its metadata; give QA the source/model hashes,
   saved-file inspection and actual target-engine checks. Keep an untested Unreal
   import or a future completion milestone visibly unverified.

Use the [architecture-library task example](examples/architecture-library-task.json)
to draft the handoff and the [production workflow](../../projects/architecture-library/docs/WORKFLOWS.md)
for exact sample paths and MCP payload shapes. Preserve the common result envelope.

## Handoff to implementation

Give frontend the component/state specification, math-geometry the explicit geometric constraint, and QA the interaction checks.

## Prompt sample

> Design the supplied workspace around its main task. Select at most two sourced architectural influences, explain the adaptation, and specify accessible states and a narrow-screen layout. Do not infer scientific effects from style.

Attach the task packet rather than pasting the whole portfolio. The machine-readable [task example](examples/design-architecture-task.json) is synthetic and does not authorize live calls.

## Code and artifact examples

- [company/role-library/examples/design-architecture-task.json](../../company/role-library/examples/design-architecture-task.json)
- [company/role-library/examples/design-reference.json](../../company/role-library/examples/design-reference.json)
- [roles/architect-architectural-designer/README.md](../../roles/architect-architectural-designer/README.md)
- [Color Systems synthetic task](examples/design-color-systems-task.json)
- [Studio color specification](../../project/STUDIO_COLOR_SYSTEM.md)
- [Shared studio tokens](../../desktop-shell/src/renderer/studio-tokens.css)
- [Shared office signals](../../desktop-shell/src/renderer/office-signals.ts)

## Primary references and reading rule

- [Parco archeologico del Colosseo: the Colosseum](https://colosseo.it/en/area/colosseo/)
- [The Met: Gothic Art](https://www.metmuseum.org/essays/gothic-art)
- [The Met: Hinduism and Hindu Art](https://www.metmuseum.org/essays/hinduism-and-hindu-art)
- [The Met: Temple of Dendur architecture](https://www.metmuseum.org/essays/temple-of-dendur-architecture-and-ritual)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

The added color/accessibility references were checked on 20 November 2026
(America/New_York; UTC receipt date 2026-11-21). Existing architectural source
references retain their earlier review record. Read the relevant section for
the current task, record the version/date, and apply it within its documented
scope. These sources guide the design; they do not prove this repository passed
a test or benchmark. Existing [backend research](../../project/BACKEND_RESEARCH.md)
and [budget research](../../project/PROMPT_BUDGET_RESEARCH.md) distinguish
implemented behavior from proposals.
