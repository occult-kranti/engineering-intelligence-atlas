# Daftar design system

## Direction

A game-like operating studio built around a conference table, company seats, department rooms, employee roles and connected work. The interface makes ownership legible through position, labels and navigation. It keeps real work, permissions and evidence visible without turning stored definitions into fabricated activity.

## Surfaces

- **Conference table:** companies occupy seats. Pan, zoom, rotate, fit and optional automatic browsing let the same view scale from a small team to a large portfolio. Keyboard and list alternatives remain available.
- **Company office:** offices, nested departments, employees, goals, roadmaps and whiteboards share saved identities. Connections describe actual relationships. Parent relations do not imply inherited authority.
- **Donna:** a movable, keyboard-operable conversation panel with scope, position, connection and access options. Drafts survive view changes; saved work remains scoped.
- **People & access:** owner controls show the exact company, person, role and expiry. Visiting employees see only permitted projections; restricted areas use grey/black treatment with a clear unavailable label.
- **Models & system:** show downloaded models, progress, shared receipts and employee assignments. Never show configured infrastructure as verified healthy.

## Visual foundations

Violet studio and Golden drafting are the supported themes. Shared tokens in desktop-shell/src/renderer/studio-tokens.css are authoritative. Violet combines dark ink-violet surfaces and an electric green action accent; Golden uses ivory drawing surfaces, warm ink and gold details. Use serif display headings sparingly, clear interface text, tabular numbers, fine rules and strong focus outlines.

Keep text readable at the default scene scale, controls at least 40–44px where layout allows, and labels close to the object they describe. Restriction states, ownership and selected states use text as well as color. Empty, loading, unknown, unavailable, failed and connected states remain distinct.

## Motion and performance

Motion communicates navigation and progress. Auto-pan is opt-in and pauses on interaction, blur or tab hiding; reduced-motion preference suppresses automatic movement. Edge pan and camera gestures must not steal text input or focus. Virtualize scene nodes, cap rendered lists, and bound deep hierarchy labels without discarding descendants.

Perform a baseline review, one full visual sweep, one grouped correction and one confirmation. Functional regression tests cover larger scenes and permission races separately from screenshots.
