# Endless Blueprint — three-round laptop plan

**Run:** `laptop-blueprint-20261122` · **Node:** `ux` · **Attempt:** `1`  
**Date:** 2026-11-22 · **Termination owner:** root director  
**Status:** Round 1 accepted by the root director; Round 2 source integration and local checks complete; Round 3 independent corrections complete, exact-source browser acceptance pending.

## 1. Product decision

The whole application is one continuous blueprint canvas. Companies occupy clearly bounded areas of that plane. Offices, departments, subdepartments, people and work stay inside their owning company. There is **no physical conference table, chair, human figure, decorative furniture, folded sheet or elevated presentation slab**. The latest owner instruction supersedes the earlier conference-table concept and the corresponding historical screenshots.

The default operating camera is top-down. Optional shallow 3D reveals architectural partitions without moving the user to another application screen. Employees and assistants remain flat, color-coded circles. Their names, scope and work are more important than depth effects. Donna, management forms and workboards open as movable elements of the same canvas. Native credential prompts and authentication entry flows keep their existing host responsibilities.

The first target is a laptop at **1366×768 and 1440×900 CSS pixels** with mouse, trackpad and keyboard. These are acceptance viewports, not proof of support on every device. A CSS/DOM fallback must keep the office usable when WebGL is unavailable. Existing native state and handlers remain authoritative; the standalone Blueprint World demonstration is a visual reference, not a replacement state store. [Repository product contract](../../PRODUCT.md) · [design foundations](../../DESIGN.md)

## 2. Evidence and design reasoning

Two books inform this plan through their authors' public material. We reviewed Don Norman's published preface to *The Design of Everyday Things*, revised edition, and his official overview of *Living with Complexity*. We did **not** read, reproduce or claim to have reviewed either complete book. No third-party full-book mirror was used.

| Source reviewed | Relevant principle | Application proposed for Daftar |
| --- | --- | --- |
| Norman, revised-edition preface [S1] | Perceptible signifiers help people discover actions; feedback and constraints are explicit design concerns. | Label camera actions, show company scope beside work actions, distinguish plan/queued/running/completed, and retain a visible recovery route. |
| Norman, *Living with Complexity*, author overview [S2] | Necessary task complexity should be made understandable rather than removed indiscriminately. | Keep powerful ownership, compute and model controls, grouped under the company and disclosed when needed. Do not reduce the product to decorative circles. |
| Shneiderman, visualization taxonomy [S3] | Overview, zoom/filter, details, relationships and history are distinct information tasks. | Start with a useful company overview; zoom to a department; inspect a person or board without replacing the world. Keep company search/list access. |
| NN/g, progressive disclosure [S4] | Frequently needed choices can be presented before specialized options. | Show company/people/work first; expose authority, model settings and technical operations in existing popups. Daftar adapts the principle to one canvas. |
| NN/g, purposeful motion [S5] | Motion can communicate state and navigation but also divert attention. | Use brief, interruptible camera transitions and restrained state feedback. Avoid continuous decorative motion. |
| W3C, dragging and target size [S6–S7] | Dragging needs a non-drag single-pointer alternative; pointer-target size has specific minimums and exceptions. | Audit popup movement, resizing and camera navigation separately from keyboard support. Measure transformed targets; do not claim conformance from CSS source values. |

The right-hand column is our task-specific design inference. These sources do not certify the implementation or prescribe Daftar's color palette and dimensions.

## 3. Spatial and visual contract

### One world, contained company areas

World X/Y coordinates are presentation units, not metres. CSS pixels describe screen-space controls. Z is a shallow architectural cue only. Camera transformations must not change native room positions, employee ownership, saved scope or authority.

The integrated layout uses a `1120×760` company footprint with a 48×48 company marker at its upper-left. The company title begins after that marker. Native office content is fitted into a rectangle inset by 32 units horizontally, 92 at the top and 76 at the bottom. This leaves a readable header and a footer of actual work actions. These are implementation parameters to validate on the two laptop viewports, not physical dimensions or immutable product limits.

The world can continue in every direction, but rendering and saved layout remain bounded. At this audit, the existing DOM scene caps rich nodes at 240, visible threads at 160, and canvas panels at 48. New GPU geometry must preserve equivalent bounded behavior and must not turn hidden records into a permission mechanism. [Scene budgets](../../desktop-shell/src/renderer/freeflow/scene.ts) · [panel bounds](../../desktop-shell/src/renderer/freeflow/workspace.ts)

### Visual hierarchy

1. **Company:** a fine boundary, lightly tinted floor, compact identity circle and full name. The company is the strongest spatial unit.
2. **Office/department:** contained partitions, a short label and explicit nested relationships. No wall or employee marker escapes its company boundary because of a camera change.
3. **Person:** a flat circle, initials and name when readable. Department colors remain stable. A visiting or shared employee has a text/outline distinction and provenance; color never grants authority.
4. **Work:** native board markers and a footer linking Roadmap, Whiteboard, Ownership and Hire. Details open near the current context and retain their own scope.
5. **Operations:** connection, Compute, Setup flow and surface search stay in restrained floating controls. Long forms appear on demand.

Midnight blue, ivory tint and navy architectural linework establish the drafting language. Warm accents identify emphasis, not every border. Both `blueprint` and `drafting` preference keys remain supported. Selected, restricted, unknown, disconnected and running states require words or patterns as well as color.

### Laptop density and camera

The initial frame must make at least one actual company useful, with nearby company boundaries suggesting continuation. Fitting every company into illegible thumbnails is not a successful overview. Company search/list and Home/Fit remain reachable at all times.

Main controls target 40–44px where practical. Labels should read comfortably at the initial camera scale; a nominal font size before transformation is insufficient. At low detail levels, prefer a meaningful count and focused inspection to many unreadable names. Hidden employee labels must remain discoverable through a real list or inspector.

Top, zoom, fit and optional tilt remain explicit. Pan/zoom/rotation cannot consume input editing, inner scroll, selection or button activation. Manual action interrupts camera motion. Automatic browsing stays opt-in and pauses during interaction, blur or hidden tabs. Reduced motion removes animation, **not geometric transforms**.

### Donna and attached work surfaces

Donna is a movable conversation popup with current company/department/employee scope, an actual saved assistant identity, and a clearly named plan/execution mode. The integrated default is 440×480 world units, subject to screenshot review. Arrange also provides ordinary click movement and resizing in 20-unit steps. It can expand, collapse, move, pin and reopen using the existing panel controller. Geometry changes must preserve drafts and form handlers.

The crew surface shows Donna, company/office assistants and department coordinators from native identities. Missing configuration stays visible. Employee definitions are not represented as running processes; activity comes from actual receipts or jobs. Connections and credentials remain in host-native controls, never new token fields on the canvas.

## 4. Complete owner workflow map

This table maps the intended canvas entry to existing native surfaces. It does not claim that every new inline button has passed acceptance.

| Owner goal | Discoverable canvas entry | Existing behavior to retain | Required evidence / guard |
| --- | --- | --- | --- |
| Create a company or import repositories | Create / company management popup | `create_company`, repository import and canonical company selection | Saved company appears once; rejected or queued writes do not masquerade as success. |
| Organize subcompanies | Company header → Manage / hierarchy | Native company-parent editor | Cycle rejection; parent relationship does not create grants or legal ownership. |
| Create offices and departments | Company / office inspector → Add | Existing office and department forms | Correct selected scope; assistant identities come from accepted native state. |
| Organize subdepartments | Department → Manage | Native department-parent editor | Reject cross-company/cyclic relationships; no lifecycle or authority cascade. |
| Hire, reuse and manage employees | Company footer Hire / People popup | Existing skill-linked hire and employee controls | Hiring saves a definition; paid work and host permissions remain separate. |
| Coordinate Donna and sub-Donnas | Floating Donna / crew surface | Scoped conversation, goal draft, recorded-authority actions | Exact actor and scope shown; no invented assistant IDs or implicit access transfer. |
| Share work with visiting employees | People & access / existing supported connection surface | Existing authenticated invitation and restricted visitor paths | Role, company and expiry explicit. Masking follows restricted data projection. VS Code capability gaps are disclosed. |
| Assign work and ownership | Employee / board inspector; company Ownership action | Employee authority editor; board ownership; People & ownership | Company-only Ownership now routes to the company People & ownership surface; actual browser scope verification remains pending. |
| Track a roadmap | Company footer Roadmap | Native timeline, milestone/goal ownership and evidence | Current company remains visible; no invented dates, progress or completion. |
| Use a whiteboard | Company footer Whiteboard / board marker | Existing nodes, links, task references and owner forms | Same saved board identity; existing drafts survive popup movement. |
| Inspect organizational flow | People & ownership / hierarchy popup | Actual company/department hierarchy and shared service contracts | Organizational edges, service relationships and authority grants remain distinguishable. |
| Run and inspect work | Jobs / Donna / native queue popup | Bounded queue, receipts, pause/cancel and job details | Definitions, queued work and running work are separate states. Lost acknowledgement is not auto-retried. |
| Connect desktop, website, SSH or VPS | Connections / Setup flow | Existing parent-native connection commands | Connection state and capability checks are truthful. An SSH banner is not GPU proof. |
| Grant owner host control | Compute popup → manual/auto/God mode | Current-revision grants, attributed host script, revoke, inspect and Stop managed host work | Native owner action; no implicit rental, job, budget change or platform-approval bypass. |
| Prepare environments and share models | Compute popup → maintained environment / resources | Durable environment proof, pinned installed digest, scoped model grants, explicit downloads | Company hierarchy does not silently enlarge sharing. An installed model is not proof of a successful inference. |
| Plan expert/model routes | Compute popup → resource routes | 1–4 expert jobs, optional aggregator and provenance | Explicit bounded execution; no claim of trained MoE weights. |
| Install supported design tools | Compute popup → design applications | Catalog, dependency plan, explicit install and proof inspection | Missing/root-required prerequisites remain blockers; no fake installed status. |
| Inspect operations and knowledge | Activity / ledger / observer / knowledge popup | Metadata journal, deterministic summaries, native ledger, scoped transfer forms | No raw credential text; observer output does not invent a repair or provider call. |
| Connect an MCP client | Setup flow → existing configuration command | Private-file stdio bridge configuration and long-job inspection | Copied config is not an established ChatGPT connection; REST is not mislabelled as HTTP MCP. |

[Native action routing](../../desktop-shell/src/renderer/chrome.ts) · [VS Code product/compute contract](../../project/VSCODE_PRIMARY_PRODUCT.md) · [compute controls](../../vscode-extension/src/compute-office.js)

## 5. Time, activity and the requested “4D” view

Here, the useful fourth dimension is **time associated with work**, not another spatial direction. Current roadmap and activity surfaces already expose scheduled work or recorded events. Their presence does not implement historical spatial replay.

A future temporal mode could filter by interval and show saved job/ownership events while retaining company scope. It would require a revisioned event-to-scene mapping, timestamp semantics, retention-gap display, reconstruction rules, and explicit read-only historical state. Interpolated animation must not fabricate events or imply that an old grant still authorizes a new action. This remains **future work**, outside the present visual refresh. The project spatial skill's terminology reference distinguishes time-based media and schedule-linked models from physical “4D printing” and vendor dimensional claims. [Terminology](../../skills/spatial-3d-production-engineering/references/terminology_and_tools.md)

## 6. Three-round swarm plan and gates

The root director owns assignments, budgets, source integration and termination. Specialist outputs are evidence artifacts, not authority to widen scope. This is the existing prompt-driven collaboration process; it does not claim a newly implemented distributed scheduler. [Collaboration protocol](../../organization/skill_collaboration_protocol.md)

| Round | Assigned work | Output and acceptance | State at this handoff |
| --- | --- | --- | --- |
| **1 — Evidence and workflow design** | UX node reads the project skill, real screenshots, current handlers and primary UX sources. Root resolves the latest owner direction. | This plan plus `UX_REVIEW.md`, workflow matrix, baseline provenance and explicit unresolved questions. Director accepts the brief before promoting implementation claims. | Accepted by the root director. Latest no-table brief governs implementation. |
| **2 — Claude/build integration** | Root coordinates real Claude Sonnet work, native layout and scene adapters, CSS, preserved DOM controls, packaging and focused regressions. | Exact source hash, provider authoring receipt/cost when available, build output, deterministic geometry/camera results, shared-renderer asset hashes and handler tests. Repair only observed discrepancies. | Integrated. Renderer build, 162 Freeflow checks and 129 VS Code checks passed locally. Live GPU/browser evidence remains the Round 3 gate. |
| **3 — Independent visual and stress acceptance** | A reviewer independent of each changed component checks exact-source screenshots and functional receipts; a separate verification path exercises edge cases. | Laptop screenshots, actual browser renderer/backend receipt, permission/draft/camera tests, forced fallback/reduced-motion review, installed-platform evidence where affected, findings and bounded corrections. Root closes the gate only after re-verification. | Independent code review found and corrected extreme-grid placement, distant-company resource allocation and terminal GPU cleanup. Exact-source browser artifacts and visual review are pending. |

### Round 2 closure checklist

- One projection of canonical native records; stable IDs, company containment and source-aware labels.
- A successful GPU renderer changes only geometric painting. DOM controls, accessible names and form ownership survive; failure restores visible CSS geometry.
- Company markers and native people remain circles. New board actions use actual scoped handlers, including the company-only Ownership route.
- Large records, missing geometry and restricted projections remain bounded and honest.
- Provider authorship, deterministic tests, mocked tests and actual GPU/browser evidence are reported separately. The UX node makes no paid calls.

### Round 3 acceptance matrix

| Case | What the reviewer must observe | Evidence required |
| --- | --- | --- |
| 1366×768 and 1440×900, top view | Useful company detail; no table prop; contained departments and circles; no page scroll or hidden recovery control | Actual screenshots plus viewport/camera metadata |
| Optional 3D and return to Top | Shallow partitions without occluding labels; matching DOM hit positions; stable native identity | GPU screenshot and camera/picking interaction receipt |
| Donna and workboards | Move, expand, collapse and reopen preserve a draft; background canvas stays navigable | Real DOM interaction receipt and screenshot |
| Navigation and entry | Pan, zoom, fit, company search and keyboard focus work; inputs/inner scrolling do not move the camera | Interaction receipt, including long text and keyboard-only path |
| Accessible movement | Pointer alternatives to dragging and keyboard alternatives are both usable; transformed targets measured | Manual/automated target and interaction findings, no blanket conformance claim |
| Reduced motion / forced colors / WebGL unavailable | Geometry remains positioned; semantic controls and labels stay visible; no automatic motion | Separate fallback screenshots and assertions |
| Empty / partial / stale state | No invented staff/rooms/readiness; clear unavailable or rejected state; drafts retained | Fixture provenance and expected-vs-observed result |
| Crowded / long names / deep nesting | Counts and search replace illegible detail; scene/panel limits respected; no company leakage | Dense native fixture, bounds assertions and screenshot |
| Authority changes mid-flow | Revoked or expired scope rejects at action; visual hierarchy never widens access | Existing native/security tests plus targeted UI scope check |
| Repeated lifecycle | Open/close/dispose/reconnect does not duplicate listeners, requests, panels or jobs | Lifecycle and connection-epoch results |
| Real environment boundary | No provider call, infrastructure rental, model download or application installation from merely opening a surface | Recorded call/network assertions |

Performance review should record browser/renderer, platform, viewport, device-pixel ratio, scene size, observed frame timing and context failures. A target such as a responsive laptop interaction is a goal; this plan does not claim measured frame rate or real Vast GPU operation.

## 7. Provenance, budget and continuation

This node owns only `PLAN.md` and `UX_REVIEW.md` for the planning task. Earlier CSS ownership has returned to root. The director contract bounds this attempt to 20,000 tokens, 30 tool calls and 35 minutes, subject to remaining run budget. No paid provider calls or external writes are authorized for this node. Reading public primary sources and writing these repository documents are within scope.

The normalized delegation transcription has SHA-256 `4be66d7e788307c813bb442e967cf16ed4d5b28bbe37f96e51ba4c8c96faa94e`. It records this run/node/attempt, owned paths, limits, root termination, no external writes and the next input: exact-source screenshot/acceptance artifacts. It is a documentation digest, not a runtime-signed approval. Skill and baseline hashes are recorded in the companion review.

After this handoff the UX node enters `waiting`. It resumes only when the director supplies the accepted Round 2 source/artifacts or requests a bounded correction. No polling, repeated billable attempt, release mutation or automatic publication is part of this plan. Earlier v0.9 acceptance is retained as baseline evidence and cannot close the new blueprint gate.

## Primary sources

All links were opened or retrieved on 2026-11-22. Findings use paraphrases and limited source descriptions; no full books were copied.

- **S1:** Don Norman, [Preface: Design of Everyday Things, Revised Edition](https://jnd.org/preface-design-of-everyday-things-revised-edition/), author-published preface, 2013.
- **S2:** Don Norman, [Living with Complexity](https://jnd.org/books/living-with-complexity/), author's book overview and contents. Complete book not reviewed.
- **S3:** Ben Shneiderman, [The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations](https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf), author-hosted paper, 1996.
- **S4:** Jakob Nielsen, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), NN/g, 2006.
- **S5:** Page Laubheimer, [The Role of Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/), NN/g, 2020.
- **S6:** W3C WAI, [Understanding SC 2.5.7: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html). Understanding guidance is explanatory, not a conformance certificate.
- **S7:** W3C WAI, [Understanding SC 2.5.8: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
