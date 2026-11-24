# Daftar — Infinite Office Canvas

## Implementation brief for Claude

**Target project:** `occult-kranti/engineering-intelligence-atlas`

**Experience:** a laptop-first company office on an endless conference table, with architectural blueprints laid over it.

**Main direction:** Emerald Drafting Table.

**Companion artifact:** a Claude-generated HTML visual prototype, with root-led QA.

This is an implementation contract and integration brief. The existing repository has not been inspected for this document. Discover its actual architecture, instructions, data model, and working behavior before changing it. Treat the HTML as a visual and interaction reference; a control is verified only when the accompanying QA record explicitly reports it. Sample activity, assistant responses, and spend figures are demonstration data until connected to authoritative services.

## 1. Scope and non-negotiable experience

Build for laptop and desktop use. Mobile design is outside this iteration.

The user enters one continuous spatial workspace. There are no destination screens for companies, employees, settings, tasks, boards, analytics, or assistants. Each operation appears as a canvas object, an anchored inspector, or a movable popup. Selecting another company moves the camera through the same workspace. It must not replace the office with a conventional dashboard page.

The office itself carries meaning: companies are blueprint sheets, departments are rooms, employees occupy desks, company representatives occupy conference-table chairs, and work lives on boards and notes. Retain a small persistent tool layer for search, creation, camera control, saving, and identity. Avoid a permanent sidebar, full-page forms, or a grid of interchangeable dashboard cards.

The first useful viewport must show a recognizable floorplan with walls, door arcs, corridors, desks, room names, and one clear selected company. Adjacent sheets and the table edge establish that the workspace extends beyond the viewport.

## 2. Visual directions

| Direction | Materials and color | Organization | Decision |
| --- | --- | --- | --- |
| **Emerald Drafting Table** | Charcoal table; deep emerald sheets; warm ivory drafting lines; restrained brass details; green activity accents | Company sheets along a continuous conference table; departments inside each floorplan | Build this as the principal direction |
| Paper Architecture Studio | Warm tracing paper; graphite drawings; muted green annotations; colored pinned notes | Overlapping plans and attached extension wings | Preserve as a future material theme or optional concept |
| Cobalt Operations Campus | Midnight blueprint surface; cyan-white lines; subtle wall extrusion | Related office plots form a connected campus | Preserve as an alternative spatial presentation |

Use material depth selectively: paper edges, furniture thickness, wall extrusion, contact shadows, and consistent lighting. Readability takes priority over simulated realism. State colors must retain the same meaning across themes. Typography, borders, radii, elevations, and motion durations belong in reusable tokens.

## 3. Initial spatial composition

Open on Daftar HQ with the Director's office and Donna's hub near the center of responsibility. Engineering, Design, Research, and Growth occupy separate rooms. A shared collaboration area contains the whiteboard, hierarchy softboard, and roadmap rail. Include a visitor area and a clear extension zone for adding departments.

Place other companies partly outside the initial frame. Their chairs or table markers provide navigation without creating a competing navigation shell. Choosing a chair highlights both the chair and its blueprint before focusing the camera.

Default to a readable top-down editing view. Offer a restrained presentation tilt of roughly 12–18 degrees using the same objects and coordinates. Keep essential labels facing the user. Camera mode changes must preserve selection, open boards, and edited content.

## 4. Interaction contracts

| Interaction | Required result |
| --- | --- |
| Select a company or search result | Focus its world position; preserve the prior camera position for Back |
| Create company | Open a scoped popup; validate; place a blueprint and table marker in free space |
| Add subcompany | Create an adjacent related sheet and a labeled parent connection |
| Add department | Preview an extension wing; commit room, scope, and placement together |
| Hire employee | Collect role, skills, department, owner, and execution preference; place a desk or seat |
| Inspect employee | Show an anchored inspector with role, assignment, ownership, access, and activity |
| Assign task | Preview the new owner and scope; apply atomically; provide reversible undo |
| Open board or roadmap | Expand a world object while the surrounding office remains visible |
| Add note | Place at the chosen world position; attach to a company, room, employee, or board |
| Inspect spend or access | Open a movable tool scoped to the current selection |

Allow drag on empty space to pan and Space-drag from selection mode. Support natural trackpad movement and pointer-centered zoom. Provide visible zoom, fit selection, fit company, Home, and perspective controls. Escape dismisses the newest transient layer or cancels the active gesture. Add undo/redo and a minimap when the workspace becomes large.

Separate selection, text editing, object dragging, and camera panning into explicit interaction states. Opening or dragging a popup must not move the world underneath it. Every floating object needs a clear handle, close/minimize control, focus behavior, and a recovery command when moved out of view.

## 5. Entity, ownership, and layout model

Use stable identifiers and normalized relationships. Keep business entities separate from their visual placements so moving a desk cannot change an employee's identity or accidentally duplicate a task.

The principal hierarchy is workspace → company → subcompany → department → team → employee. Projects may appear as companies, as requested, while retaining distinct project records when the existing application requires them. Inspect current entities before introducing competing models.

Each owned object records its workspace, parent scope, accountable owner, collaborators, permission policy, and lifecycle status. Each placement records its entity reference, world position, dimensions, rotation, stacking order, and containing surface. Tasks additionally record status, assignee, dependencies, and attached artifacts. Board items and notes reference their target scope explicitly.

Prevent parent cycles. Distinguish an accountable owner from a task assignee and from a collaborator. A department move must update scope intentionally; visual proximity must never grant access. Deletion must preview affected employees, tasks, and boards and support reassignment or archival. Apply related changes transactionally.

## 6. Boards, notes, and roadmap

The **whiteboard** supports freeform text, diagrams, decisions, sketches, and attached artifacts. The **softboard** represents hierarchy, ownership, role relationships, dependencies, and handoffs. The **roadmap** represents milestones and task progression, including blockers and accountable owners. Do not merge these into three names for the same generic card list.

Notes support text editing, attachment, movement, color, and optional assignee. Use yellow for comments, mint for to-dos, coral for blockers, blue for research, and lilac for ideas. Pair color with a label or icon. To-do notes have a checkbox and owner. Decide explicitly whether completing a task-linked note completes its task; preview any cross-object change.

Long text should expand or scroll inside the object. Empty boards provide a direct creation affordance. Editing remains possible without zooming into an unreadably small control.

## 7. Donna and sub-Donna orchestration

Donna is the Director's coordinator. Company and department sub-Donnas operate within explicit scopes. Show these relationships on the softboard and through their office placements.

Donna's hovering conversation object is draggable and resizable, with a visible context chip identifying the selected company or department. Allow pinning to the viewport or to a world location. Preserve draft input when minimizing or changing selection.

For an action, Donna identifies scope, proposes structured changes, previews affected objects, executes authorized operations, and reports the result with links back to those objects. Reversible changes offer undo. A failed action leaves the conversation and previous state intact.

Cross-company work requires an explicit handoff with ownership and access checks. A sub-Donna cannot inherit Director authority merely because it was delegated a task. Keep action records with actor, scope, input reference, result, and relevant usage. Use one shared coordinator when appropriate instead of duplicating equivalent assistant calls.

The prototype may demonstrate deterministic local commands. Label these as sample assistant behavior. Production execution must use a provider adapter, structured tool contracts, cancellation, idempotency, and server-enforced authorization.

## 8. API credentials and execution boundary

Never embed provider tokens in HTML, client bundles, sample data, exports, screenshots, logs, or repository files. Provider credentials belong in a protected server process or the desktop application's protected credential facility. The renderer requests authorized actions through a narrow interface; it does not receive raw secrets.

Keep provider selection, model configuration, usage reporting, and error translation behind adapters. Inspect the existing integration before adding another one. Do not assume that an uploaded token is valid, that a particular model is available, or that the prototype has a live connection.

Honor the configured budget and existing approvals. Reserve allowance for concurrent in-flight work and reconcile reported usage. A budget limit should stop new execution cleanly and leave work inspectable. Spending is a constraint, not a success metric.

## 9. Activity heatmap and spend objects

Distinguish Running, Waiting, Blocked, Idle, Loaded, and Unknown/Disconnected. Running requires recent execution evidence; Loaded means present in the renderer and must never be presented as activity. A room's light reflects its employees' actual states, with text and icons available alongside color.

Track event timestamps and stale-data thresholds. Reconnecting must reconcile current state rather than replaying obsolete activity as live. Show sample telemetry visibly in the prototype.

Spend objects can show session total, remaining allowance, per-company allocation, provider usage, and a time plot. Differentiate reported charges from estimates. Never derive a live dollar counter from animation time or fabricated employee activity.

## 10. Shared web and desktop renderer

Use one domain model, interaction system, visual renderer, and board implementation across website and desktop. Put platform functions behind capability adapters. The desktop host can expose approved file, notification, or local-runtime functions; the web adapter offers its supported equivalent or a clear unavailable state.

Do not let the canvas invoke arbitrary operating-system commands. Represent capabilities, permissions, progress, and errors through the same scoped popups. Keep synchronization, identity, execution, and storage independent of camera state.

## 11. Performance and resilience

An endless workspace is a coordinate system, not an unlimited number of mounted DOM objects. Add viewport culling, spatial indexing, and zoom-dependent detail. Distant employees become department summaries; nearby employees retain useful interaction targets. Stop decorative animation outside the viewport and when the tab is inactive.

Measure representative workspace sizes before selecting optimizations. Avoid expensive blur and shadow effects on thousands of objects. Bound extreme coordinates and camera scales. Keep selection stable across level-of-detail changes.

Persist edits through a versioned schema with recovery for invalid data. Production collaboration needs conflict handling, actor attribution, and reconnect reconciliation. Offline edits must be identified as pending; they must not appear synchronized until acknowledged.

## 12. Accessibility and motion

Every essential action must be keyboard reachable with visible focus. Provide a searchable object navigator as a popup for users who cannot efficiently operate a spatial map. Keep forms, labels, and editing controls semantic even if geometry uses a graphics renderer.

Reduced-motion mode removes camera interpolation and decorative pulses. Normal motion explains a change: a short focus glide, a department unfolding, or a handoff traveling along its relationship. Avoid automatic camera drift and constant activity everywhere. At 200% browser zoom, close, submit, recovery, and camera controls remain reachable.

## 13. Risk-based verification

Test meaningful user outcomes, not only implementation details:

1. Open at 1366 × 768, 1440 × 900, and 1920 × 1080; inspect legibility and overlapping tools.
2. Pan away, zoom repeatedly, toggle perspective, and recover Home without losing selection.
3. Open several popups; verify stacking, Escape order, focus restoration, and drag isolation.
4. Create a company, department, employee, note, and task assignment; undo and reload.
5. Exercise long names, multiline notes, empty rooms, and large employee rosters.
6. Reject hierarchy cycles and invalid ownership moves; preserve existing data on failure.
7. Expire visitor access mid-session; verify server enforcement and visual updates.
8. Disconnect telemetry and providers; prevent false activity, success, or synchronized status.
9. Cancel or retry an assistant action; prevent duplicate tasks and duplicate charging requests.
10. Exercise concurrent budget reservations at the cap; stop safely and retain results.
11. Stress a representative fixture, initially 50 companies, 250 departments, and 2,000 employees; measure rendering and interaction behavior.
12. Verify keyboard operation, reduced motion, 200% zoom, corrupted persistence, and reconnect conflicts.

Report actual environments, observed outcomes, and unresolved risks. Do not describe stress targets as passed before measuring them.

## 14. Integration sequence and acceptance

**First:** inspect repository instructions and map the current canvas, assistants, authentication, storage, and desktop entry points. Record what can be reused.

**Second:** implement the spatial shell, camera, company plan, object selection, and popup system. Match the prototype's visual hierarchy and material treatment.

**Third:** connect company/department creation, employee hiring, ownership, boards, notes, and persistence to the existing model. Complete the reversible interaction loop before adding decorative effects.

**Fourth:** integrate Donna, scoped delegation, provider adapters, authoritative telemetry, and budget enforcement. Add shared desktop capabilities through the same interfaces.

**Finally:** run the risk-based checks, capture laptop screenshots and a short interaction walkthrough, and produce a concise verification record. Acceptance requires that core work happens in the same canvas, state survives correctly, restricted actions remain restricted, and simulated data is never mistaken for live execution.
