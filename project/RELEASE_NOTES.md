# Atlas 0.4.2 — Personal agent office

Donna's unified workspace links scoped chat, an interactive office blueprint and
owned roadmap whiteboards. Companies contain offices, departments, shared
assistants and permanent specialist roles. Idle employee definitions make no
provider calls.

Goals support explicit planning, review/autonomous execution, bounded iterations,
DAG dependencies, shared budget reservations, early warnings, saved artifacts
and durable checkpoints. GitHub integration can discover owner repositories,
including private ones, inspect branches and publish bounded changesets against
a verified branch head without force.

This release adds a Rust control core, an authenticated personal browser view of
the same desktop workspace, encrypted credential-file import, compact evidence
handoffs, cache integrity checks, recovered SQL migrations and reproducible CI.
The original atlas, role/skill library, local model manager, projects and Android
source remain available.

## CEO portfolio extension

CEO mode organizes companies by application family and contracts shared departments instead of duplicating workers. Company/group/global roadmaps connect to the same office blueprint and ownership whiteboard. The default shared office includes Engineering, Design & Architecture, Research & Knowledge, Security, Hackathon and Music & Arts. Sixteen role guides provide concise briefs, source references, code examples, acceptance checks and explicit handoffs.

The worker now supports bounded parallel dispatch with one global reservation ledger. Scheduled repository reviews use fresh commit-pinned source snapshots and preserve model proposals as artifacts and knowledge records. Private data transfer requires a selected granted reference; sharing a specialist never shares its home company's context automatically. Portable personal exports retain state, roadmaps and bounded artifacts separately from the public application package.

## Distribution

The Linux AppImage is an unsigned development build. It does not contain personal
credentials or private company state. Import credentials into the destination
machine's OS keychain. The scheduler and personal browser server run while the
desktop app is open. Windows/macOS packaging and an OS background worker remain
on the roadmap.

The Android APK, when attached by the release gate, is a debug build of the
existing mobile shell with the updated atlas. It does not claim the complete
new native desktop Office UI or a signed store release.

See [validation](VALIDATION.md), [handoff](../HANDOFF.md), [roadmap](../ROADMAP.md)
and [prompt/budget research](PROMPT_BUDGET_RESEARCH.md) for evidence and limits.

## Visual review follow-up

This patch follows the verified 0.4.0 release. It makes room membership totals visible, keeps long room rosters within the inspector, corrects singular portfolio counts and uses portable vector decorations. Browser coverage now includes the CEO portfolio, budget policy and every office administration tab in wide and narrow layouts.

The expanded panel sweep exposed intrinsic-width overflow in the narrow queue and schedule forms. Their grid tracks and native controls now fit the available width, and queue filters wrap. The release workflow also runs the browser layout/offline gate before publishing binaries; a layout failure blocks the release as well as Pages.
