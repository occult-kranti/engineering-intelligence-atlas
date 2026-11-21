# Daftar — flat blueprint content in an infinite 3D canvas

**Current status: implemented local frontend demo; publication pending.** The current source includes scoped records, a Three.js world renderer and native HTML work elements. **Actual WebGL rendering was unavailable in the managed Chrome environment. GPU appearance, shader behavior and rendered-scene picking have not been verified.** Passing data, DOM and numerical checks do not close that graphics gap.

![Current flat-circle blueprint direction](assets/03-flat-circle-blueprint.png)

This generated concept remains a visual target. Its labels and counts are illustrative; it is not a screenshot of the implemented application or data from the user's companies.

## Implemented source

The entry point is [blueprint-world.html](../../cloud-workspace/public/concepts/blueprint-world.html). Serve the public directory as a static website and open `/concepts/blueprint-world.html` in a WebGL2-capable browser. Local imports use the checked-in vendor bundle; the prototype has no live model or account integration.

| Component | Current scope |
| --- | --- |
| [Core](../../cloud-workspace/public/concepts/blueprint-world-core.js) | Company and sub-company creation, one default office per company, departments and nested departments, local employee definitions and explicit assignments, company-owned tasks and notes, validation and bounded local persistence. |
| [Renderer](../../cloud-workspace/public/concepts/blueprint-world-renderer.js) | Three.js scene source for the continuous table, contained company plans, flat circles, camera navigation, world anchors and bounded presentation motion. Actual GPU behavior remains unverified. |
| [Work elements](../../cloud-workspace/public/concepts/blueprint-world-app.js) | Company, department and person panels; creation and local hiring; roadmap, ownership, hierarchy and whiteboard; scoped scripted Donna; search, drafts and truthful graphics-unavailable recovery. |
| [Local dependencies](OPEN_SOURCE.md) | Pinned Three.js 0.187.0 with OrbitControls in a local MIT-licensed bundle. Troika and Rapier were evaluated and were not added. |

The intended composition is one continuous conference-table scene containing company blueprint territories. A flat company circle represents its conference seat. Department lines, employee circles and company boards belong to their owning territory; sub-companies have separate territories linked by an organizational relationship. Top view is the default, with optional tilt and orbit. These design choices remain subject to actual graphics review.

## Verification checkpoint

| Evidence | Recorded result and boundary |
| --- | --- |
| Independent core validation | 12 of 12 groups passed for records, scope, atomic mutations, capacities, storage and layout geometry. |
| Independent DOM validation | 6 of 6 groups passed with the renderer explicitly unavailable. This verifies native form logic, scope and drafts, not browser layout or GPU rendering. |
| Renderer-owner numerical review | 11 non-GPU groups passed using Three.js mathematics. This is separate from the independent core/DOM suite and does not certify shaders, visible geometry or scene picking. |
| Managed Chrome controls | 20 grouped native-control observations cover creation, nested departments, visiting employees, ownership, scope-isolated Donna drafts, movable panels, persistence and keyboard focus. See the browser receipt; these observations used the graphics-unavailable path. |
| Actual WebGL acceptance | Unavailable in the managed Chrome environment. GPU visuals, shader compilation, rendered-object picking, frame timing and graphics resource behavior remain unverified. |

The [independent validation record](validation/README.md) and [validation index](validation/validation-index.json) identify the tested source hashes. A later edit needs corresponding evidence; a passing receipt is not transferable solely because the filename is unchanged. [BUILD-RUN.json](BUILD-RUN.json) records the coordinated build and its boundaries. Publication URL, version and final source identity remain pending the coordinator's receipt.

## Authorship and runtime boundary

External Claude Sonnet 5.5 supplied partial core source and the initial UI plus a bounded completion. The core was completed locally, and the UI received independent repairs. The renderer was authored locally after automatic approval review blocked polling its provider process; no renderer response was observed and no provider retry was made. [Development accounting](../../project/CLAUDE_USAGE.md) retains the uncertainty for that request.

Donna is scripted. Hiring creates local employee definitions; it does not start a worker or grant access. Real model execution, shared-account authority, native/cloud adapters and collaborative synchronization remain unconnected. This standalone frontend is separate from the [previous validated prototype](../blueprint-canvas/README.md), its historical owner-private publication, and the released 0.8.0 desktop binaries. Their source and receipts remain unchanged.

## Design and dependency records

- [PLAN.md](PLAN.md) — architecture, remaining graphics acceptance, physics rationale and implementation boundaries.
- [BRIEF.md](BRIEF.md) — operating-interface and scoped workflow brief.
- [OPEN_SOURCE.md](OPEN_SOURCE.md) — adopted and evaluated libraries, pinned packaging and primary documentation.
- [provenance.json](provenance.json) — selected and superseded visual studies.

## Superseded explorations

The [physical-office study](assets/01-superseded-physical-office.png) and [desk-focus study](assets/02-superseded-desk-focus.png) are retained only as design history. Both are excluded from the active direction because the user requested flat circles and blueprint linework.
