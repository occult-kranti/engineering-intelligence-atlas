# Daftar — an infinite blueprint world with scoped Studio editing

**Current status: Studio frontend published as owner-private Site version 17, with a graphics verification gap.** [Open Blueprint World](https://atlas-command-office.whatswrong-inc.chatgpt.site/concepts/blueprint-world). The source combines scoped records, a Three.js architectural floorplan world and native HTML work elements. The Studio expansion adds explicit local editing actors, scoped grants, sub-Donnas and history to the continuous canvas. Native Studio workflows and laptop popup behavior were reviewed on the published HTTPS site. **Actual WebGL rendering remains unavailable in the managed Chrome environment, so GPU appearance, shaders, rendered-scene picking and frame rate remain unverified.**

![Current flat-circle blueprint direction](assets/03-flat-circle-blueprint.png)

This generated concept remains a visual target. Its labels and counts are illustrative; it is not a screenshot of the implemented application or data from the user's companies.

## Implemented source

The entry point is [blueprint-world.html](../../cloud-workspace/public/concepts/blueprint-world.html). Serve the public directory as a static website and open `/concepts/blueprint-world.html` in a WebGL2-capable browser. Local imports use the checked-in vendor bundle; the prototype has no live model or account integration.

| Component | Current scope |
| --- | --- |
| [Core](../../cloud-workspace/public/concepts/blueprint-world-core.js) | Company and sub-company creation, one default office per company, departments and nested departments, local employee definitions and explicit assignments, company-owned tasks and notes, validation and bounded local persistence. |
| [Renderer](../../cloud-workspace/public/concepts/blueprint-world-renderer.js) and [architectural relief](../../cloud-workspace/public/concepts/blueprint-world-relief.js) | Continuous table, contained company plans, layered floorplan slabs, slim room partitions, camera-facing cutaway, flat circles, lights, world anchors and bounded motion. Top remains the default; optional 3D overview and plan/relief style controls use the same world. Actual GPU behavior remains unverified. |
| [Work elements](../../cloud-workspace/public/concepts/blueprint-world-app.js) | Company, department and person popups; creation and local hiring; roadmap, ownership, hierarchy and whiteboard; scripted Donna; search, drafts, scoped Studio integration and graphics-unavailable recovery. |
| [Studio command layer](../../cloud-workspace/public/concepts/blueprint-world-studio-edits.js) | Explicit local actors and capabilities; company/department grants; validated edits; revision checks, idempotency receipts, compensating undo, owner-change barriers and combined bounded snapshots. |
| [Attached Studio UI](../../cloud-workspace/public/concepts/blueprint-world-studio-ui.js) | Department name/color/order, company and employee position, local actor selection, Access and History disclosures, grant/revoke controls and atomic local sub-Donna creation. Forms remain in world-attached popups. |
| [Local dependencies](OPEN_SOURCE.md) | Pinned Three.js 0.187.0 with OrbitControls in a local MIT-licensed bundle. Troika and Rapier were evaluated and were not added. |

The composition remains one continuous conference-table scene containing company blueprint territories. A flat company circle represents its conference seat. Department linework, relief partitions, employee circles and company boards belong to their owning territory; sub-companies have separate territories linked by an organizational relationship. Greater depth comes from the plan slabs, contained partitions, lighting and camera, while every person remains a flat colored circle. No figures, furniture or decorative office props were added. These source-level choices remain subject to actual graphics review.

## Local editing and ownership

Open **Studio** from the canvas controls or **Edit blueprint** from a company, department, person or Donna popup. Select an explicitly registered local actor to perform floorplan edits. The owner can register an existing employee, add a scoped grant, create a sub-Donna for a department, inspect history or revoke a grant. Registration and role labels alone confer no editing rights.

| Local actor | Explicit initial policy |
| --- | --- |
| CEO owner | All seven Studio capabilities at workspace scope; manages policy and can undo an eligible edit. |
| Canonical company director | Department rename/color/reorder, company movement and employee placement within its own company. |
| Canonical company Donna | Department rename/color/reorder and employee placement within its own company. |
| Sub-Donna created through Studio | The same four department/placement capabilities scoped to its selected department subtree, with a reporting relationship to the company's canonical Donna. |
| Visiting employee | No initial Studio grant. A visible circle, visiting assignment or shared identity does not confer authority. |

Company creation, hiring, tasks and notes remain **CEO owner tools**. Switching the Studio actor does not change those owner workflows or pretend to sign in as another person. New or newly registered actors need explicit grants; company parentage never transfers rights to a subsidiary.

Changes are checked against the current model revision and current grants. A stale form keeps its draft and requires an explicit draft-base refresh. Revocation takes effect on the next command. A successful undo adds a compensating history event; owner CRUD changes establish a barrier so an older layout edit cannot overwrite later owner work. Cross-tab storage changes fence further edits/saves until reload. Model and Studio metadata share one bounded JSON snapshot; invalid metadata does not silently replace the stored bytes.

This is a local policy demonstration. It is **not server authentication, tamper-resistant authorization, collaborative synchronization or production account ownership**. The model fingerprint detects changes; it is not an integrity guarantee.

## Verification checkpoints

| Evidence | Recorded result and boundary |
| --- | --- |
| Unchanged core | 12 of 12 independent groups passed for records, scope, atomic mutations, capacities, storage and layout geometry. The core hash is unchanged from the preserved first checkpoint. |
| Studio command layer | [17 of 17 independent groups passed](validation/studio-receipt-3a586a4d0905.json): scoped grants, company boundaries, placement, stale revisions, revocation, idempotency, undo/barriers, malformed metadata and capacity/storage limits. |
| Integrated Studio DOM | [14 of 14 groups passed](validation/studio-ui-final.json): six previous regressions plus eight Studio workflows, with the renderer explicitly unavailable. The receipt pins the app, UI, command, HTML and harness sources. |
| Renderer numerical review | [21 of 21 non-GPU groups passed](validation/studio-renderer-evidence.json), including capacity fixtures with 100 companies/1,000 employees, a dense department, large-floorplan framing and 4,100 marker-occlusion rays. These are CPU mathematics and bounded resource-count checks, not GPU frame-rate or rendered-scene-picking evidence. The original checkpoint's 11 groups remain historical. |
| Historical managed Chrome controls | 20 grouped native-control observations cover the original checkpoint's creation, nested departments, visiting employees, ownership, Donna drafts, movable panels, persistence and focus. They used the graphics-unavailable path and **do not validate the later Studio source**. |
| Published Studio native-browser review | [Separate version 16 and 17 observations](validation/studio-browser-receipt.json) cover local actor/grant behavior, Donna edits and undo, sub-Donna scope, immediate revocation, persistence, keyboard focus and popup dragging. Final version 17 was reviewed at 1363 × 936 with no HTML-page scroll. This review used the graphics-unavailable path. |
| Actual WebGL acceptance | Unavailable in the managed Chrome environment. GPU visuals, shader compilation, rendered-object picking, frame timing and graphics resource behavior remain unverified. |

The [validation record](validation/README.md) and [validation index](validation/validation-index.json) identify the tested source hashes. A later edit needs corresponding evidence; a passing receipt is not transferable solely because the filename is unchanged. [BUILD-RUN.json](BUILD-RUN.json) preserves the initial build at commit `287dfdf70bcece1960c7bda364e911c82dea37e2`, when publication was still pending. [STUDIO-RUN.json](STUDIO-RUN.json) records the later expansion and its acceptance boundaries.

The local-preview reload was rejected by browser URL policy and was not retried or bypassed. The browser subsequently accepted the published HTTPS destination for the authorized live review. Version 16 observations found two presentation defects: the reorder permission check used a no-op probe, and sub-Donna creation displayed a redundant CEO actor toast. Local repairs made the reorder probe test an actual adjacent move and removed the misleading toast. The popup was also compacted to a 420 px width and 680 px height limit. Final version 17 observations confirmed persisted actor/grant state, the correct actor label, owner undo after the recorded revocation, Name-to-Save keyboard focus and drag positioning without page scroll. Grant preservation across undo is established by the pure/DOM tests; the final native observation did not reselect the revoked actor after undo. Source versions remain distinct in the browser receipt.

## Publication

| Item | Verified value |
| --- | --- |
| Live page | [Blueprint World](https://atlas-command-office.whatswrong-inc.chatgpt.site/concepts/blueprint-world) |
| Site version | **17** |
| Pushed Site source | `e0a17a669dd359a4346d9ca7c61e11394fa3760b` |
| Deployment | `appgdep_6b0233ef6a648191b6527e6cb6ff0811` — succeeded at `2026-11-22T00:14:45.290141+00:00` |
| Audience | One owner; zero editors, groups or external visitors. No MCP connection was enabled. |
| Evidence | [publication.json](publication.json) and [native browser receipt](validation/studio-browser-receipt.json) |

This publication identity belongs to the Site source repository; the GitHub design branch has its own commit history. Publication does not resolve the graphics gap or connect the demo to real accounts, model execution or employees.

## Authorship and runtime boundary

External Claude Sonnet 5.5 supplied partial core source and the initial UI plus a bounded completion. The core was completed locally, and the UI received independent repairs. The original renderer was authored locally after automatic approval review blocked polling its provider process; no renderer response was observed and no provider retry was made. The later Studio expansion used four distinct Claude requests for architectural relief, the edit layer and its bounded suffix, and the Studio UI. Two reached their output limits; local completion, integration and independent repairs supplied the accepted sources. [Development accounting](../../project/CLAUDE_USAGE.md) preserves every earlier uncertainty and records **$0.446882 observed usage against the additional $20 Studio ceiling**, with no new uncertain reservation.

Donna chat is scripted. Hiring creates local employee definitions; it does not start a worker or grant production access. Studio's atomic sub-Donna creation additionally registers a local actor and an explicit local department grant. Real model execution, shared-account authority, native/cloud adapters and collaborative synchronization remain unconnected. This standalone frontend is separate from the [previous validated prototype](../blueprint-canvas/README.md), its historical owner-private publication, and the released 0.8.0 desktop binaries. Their source and receipts remain unchanged.

## Design and dependency records

- [PLAN.md](PLAN.md) — architecture, remaining graphics acceptance, physics rationale and implementation boundaries.
- [BRIEF.md](BRIEF.md) — operating-interface and scoped workflow brief.
- [OPEN_SOURCE.md](OPEN_SOURCE.md) — adopted and evaluated libraries, pinned packaging and primary documentation.
- [provenance.json](provenance.json) — selected and superseded visual studies.

## Superseded explorations

The [physical-office study](assets/01-superseded-physical-office.png) and [desk-focus study](assets/02-superseded-desk-focus.png) are retained only as design history. Both are excluded from the active direction because the user requested flat circles and blueprint linework.
