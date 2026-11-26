# Daftar design system

## Direction

A game-like operating studio on one continuous spatial canvas. The conference table, company seats, department rooms, employee roles and connected work remain in the same world as the forms used to manage them. Perspective and camera motion communicate depth; readable, semantic controls remain ordinary interactive content. Ownership is legible through position, labels and connections, with real permissions and evidence visible.

## Surfaces

- **Conference table:** companies occupy seats. Pan, zoom, rotate, fit and optional automatic browsing scale the view from a small team to a large portfolio. The table remains present when a selected company's blueprint is laid into the world. Keyboard and list alternatives remain available.
- **Company blueprint:** offices, nested departments, employees, goals, roadmaps and whiteboards share saved identities. Department focus moves the camera without relocating the company's rooms. Connections describe actual relationships; parent relations do not imply inherited authority.
- **Canvas elements:** conversation, crew, scope, roadmap, whiteboard, hiring, queue, ledger, integrations and settings are movable panels inside the world. A searchable surface finder and Home action keep closed or distant panels reachable. Moving, resizing, pinning or collapsing affects presentation only.
- **Donna and sub-Donnas:** the conversation and crew are separate elements within the same canvas. Crew labels distinguish saved employees, missing configuration and deterministic runtime checks. Running counts require job evidence. Scoped actions describe their actual effect, including the possibility that resumed queued work can start.
- **People & access:** owner controls show the exact company, person, role and expiry. Visiting employees see only permitted projections; restricted areas use grey/black treatment with a clear unavailable label. Masking is visual feedback after server-side restriction, not the access-control mechanism.
- **Models, source review and ledger:** show observed downloads, progress, shared receipts, assignments and bounded review findings. Unknown, unconfigured and disconnected states remain visible. A source review report is not a claim that the source is safe or a website was crawled.

## Continuity and navigation

Reparent existing application elements into the canvas rather than cloning their forms or creating a second state store. Drafts, semantic labels, validation and event handlers must survive panel movement. Drag handles and resize controls have keyboard equivalents; camera gestures must not consume text editing, inner scrolling or button actions. Saved panel geometry is bounded, recoverable and device-local.

The signed-in website owner lands on the canvas. Connections, applications and access forms use compact same-origin embedded presentations within it. Existing deep links still select the intended company or surface. Sign-in remains reachable when signed out, and invitation/visitor routes preserve their restricted entry and token-consumption semantics.

The infinite-canvas effect comes from continuous navigation over a bounded, virtualized world. Do not render every hidden record or use distant coordinates as an information boundary. The camera frames the relevant content at a readable scale, with explicit routes back to the table and the surface finder.

## Visual foundations

Night office and Drafting paper are the current themes. Shared tokens in desktop-shell/src/renderer/studio-tokens.css are authoritative. Night office combines charcoal surfaces, pale olive actions and brass details; Drafting paper uses warm ivory, olive ink and restrained gold. The existing `blueprint` and `drafting` preference keys remain compatible. Use serif display headings sparingly, clear interface text, tabular numbers, fine rules and strong focus outlines.

Keep text readable at the default scene scale, controls at least 40–44px where layout allows, and labels close to the object they describe. Restriction states, ownership and selected states use text as well as color. Empty, loading, unknown, unavailable, failed and connected states remain distinct.

## Motion and performance

Motion communicates navigation and progress. Short camera flights are interruptible; manual navigation takes precedence. Auto-pan is opt-in and pauses on interaction, blur or tab hiding; reduced-motion preference suppresses automatic movement. Panel dragging and resizing use the current camera transform so the element stays under the pointer in rotated and perspective views. Focus and scroll actions must not restart an interrupted flight or steal an active input.

Virtualize scene nodes, cap rendered lists and panel preferences, and bound deep hierarchy labels without discarding descendants. Repeated navigation, close/reopen, hidden tabs, unavailable storage and malformed saved coordinates must remain usable. Listener and animation cleanup belongs to the component lifecycle.

Perform a baseline review, one full visual sweep, one grouped correction and one confirmation. Functional regression tests cover larger scenes and permission races separately from screenshots.

## Blueprint World: flat circles in a continuous world

The latest design brief uses flat, color-coded circles for people and roles, clean floorplan lines, company-contained offices/departments and anchored work elements. It supersedes the physical-office/figurine studies. The Studio expansion adds layered company slabs, slim contained partitions, controlled lighting and camera-facing cutaway for a stronger architectural 3D overview. People remain flat circles; no furniture, figures or decorative office props are added. Top view remains the default operating view; optional overview, orbit, zoom and Plan/Relief style preserve the same world and record identities.

The standalone implementation uses a local Three.js WebGL 2 bundle, instanced flat circles, scoped records and native world-attached forms. Studio editing lives in an attached popup with local actor selection, department styling/order, company and employee positioning, Access and History. Explicit grants determine which local actor can edit each company or department; role labels, visual proximity, visiting status and parent-company relationships grant nothing. The owner can register an employee, create a department-scoped sub-Donna and revoke grants. Company/hiring/task tools remain visibly CEO owner tools. Local actor selection is not account impersonation or server authentication.

Drafts survive rejected stale edits and require an explicit base refresh; current grants are checked again when a command is applied. History records compensating undo and owner-change barriers. The local model and policy share a bounded snapshot. These controls demonstrate scoped local editing and do not start workers, connect Donna to a provider or implement collaborative synchronization.

[Blueprint World](design/blueprint-world/README.md) records the implemented flows, project-skill swarm, Claude authorship and exact-source verification. The current Studio command layer passed 17 independent groups, the final integrated UI passed 14 DOM groups, and the renderer passed 21 non-GPU groups, including 4,100 occlusion rays and dense/capacity layouts. Native published-site review covered scoped Donna/sub-Donna editing, immediate revocation, history/undo, persisted state, keyboard focus and popup dragging. Version 16 findings led to the actual-move reorder probe, removal of the redundant CEO actor toast and a more compact popup; final version 17 observations are retained separately at a 1363 × 936 viewport with no HTML-page scroll.

The [owner-private Site version 17](https://atlas-command-office.whatswrong-inc.chatgpt.site/concepts/blueprint-world) is published, with its exact source and audience in [publication.json](design/blueprint-world/publication.json). The local-preview reload was rejected by browser URL policy and was not retried or bypassed; the published HTTPS destination was accepted for live review. Managed Chrome still cannot create WebGL 2, so GPU painting, shaders, rendered-scene picking and frame rate remain unverified. Native form observations and CPU geometry results do not close that gap. The earlier CSS prototype, its historical browser observations and the 0.8.0 runtime release remain separate, unchanged checkpoints.
