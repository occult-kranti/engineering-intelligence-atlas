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
