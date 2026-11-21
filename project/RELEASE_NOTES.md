# Daftar 0.6.0 — Violet command studio

Daftar's desktop and private website share a redesigned office inspired by architectural blueprints, ownership boards and drafting surfaces. Deep violet, electric green and warm gold define **Violet studio**; an ivory canvas and darker green/gold controls define **Golden drafting**. The names and company records remain Daftar, with existing native identities and archive compatibility preserved.

## One office, connected views

- **Blueprint:** saved rooms and employee desks, architectural grid, keyboard movement and a compact accessible list alternative.
- **Ownership / Soft Board:** the actual company, office, department and employee hierarchy, search, an employee inspector and links to existing chat and authority controls.
- **Roadmap:** recorded outcomes grouped by their real status, with ownership, dependencies, evidence and update dates. No invented start/end dates or Gantt intervals.
- **Whiteboard:** owned cards and existing goal/job mappings on the same studio surface.
- **Donna dock:** the existing conversation moves beside visual work. One composer and one thread preserve the unsent draft while changing views.

Unsaved room edits survive heat-map changes and state refreshes. Paused employees remain inspectable and cannot become an invalid active chat target. Existing native authorization, revision checks and queued-command behavior remain the action boundary.

## Heat maps with explicit meaning

Choose Workload, Job allowance, Attention or Off. The data layer derives each view from saved records without a provider call or database migration:

- Workload counts unfinished saved jobs; it is not employee utilization or CPU telemetry.
- Job allowance compares recorded commitment with the sum of individual job ceilings. Native reservations already reflected in job usage are counted once. The global budget remains separately labeled and includes external allocations.
- Attention counts distinct jobs with recorded conditions requiring review, such as failures, waiting budget or expired running leases. Earliest dispatch time is not treated as a deadline.
- Missing, stale or unusable evidence is **unknown**, visibly different from a confirmed zero. Fixed legend bins, numbers and patterns accompany color.
- Shared employees and duplicate placements cannot multiply work across the selected execution scope. Oversized inputs fail visibly rather than returning a partial heat map.

[Signal contract](OFFICE_SIGNALS.md) records the exact thresholds, ownership rules, bounds and limitations. [Color system](STUDIO_COLOR_SYSTEM.md) records the calculated foreground/background pairs; those calculations are not a blanket accessibility certification.

## Website, editor and shared design role

The private homepage and application directory use the same studio tokens and appearance preference. Each company has direct links to Donna, Blueprint, Ownership, Roadmap, Whiteboard and expert panels. VS Code adds company-scoped studio links for its connected website, with strict origin/view validation and no credentials in navigation URLs. The extension preserves the editor's high-contrast theme behavior.

The existing Design & Architecture role now includes color-system responsibilities, contrast examples and truthful heat-map acceptance. All 23 role definitions remain; no duplicate employee or paid provider task is created by the redesign.

Public and private renderer assets use content-addressed names. The cloud transport's authored source is now `cloud-workspace/scripts/cloud-bridge.js`; the shared synchronization script generates its hashed distribution together with the renderer, signal engine and styles.

## Installation and verification

All seven verification gates, release publication and Pages passed for source `5b661e5`; the owner-private website is deployed. All three downloaded asset sizes and SHA-256 hashes match GitHub metadata. Use the assets attached to this version: the Linux x86_64 AppImage, `atlas-office-0.6.0.vsix`, and the Android debug APK. The AppImage remains unsigned; Windows/macOS signing and owner-device keychain acceptance are separate work. The Android attachment carries the research atlas rather than the full native Office runtime.

The redesign introduces no native schema migration or provider request. Desktop scheduling still runs while the app is open. Website controls still queue native changes for explicit **Sync now**; hosted Donna is text-only. Theme and heat preferences are local to the current browser/app, while office state follows the existing D1/native synchronization protocol.

[Validation](VALIDATION.md) and the [0.6.0 release receipt](release-0.6.0.json) record actual test, browser, package, deployment and download evidence. Earlier release receipts remain historical and do not certify this version. [Studio review](STUDIO_REDESIGN.md), [handoff](../HANDOFF.md) and [roadmap](../ROADMAP.md) explain the decisions and next acceptance work.
