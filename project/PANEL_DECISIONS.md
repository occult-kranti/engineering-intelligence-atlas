# Donna workspace — implementation review decisions

## Baseline and evidence

This review compares the committed launcher at `c3a23a9`, the initial v0.3 workspace redesign in this working tree, and the v0.4 Donna workspace candidate. It uses the repository's frontend-engineer and product-psychology-behavioral-design-lead charters, `PRODUCT.md`, `DESIGN.md`, native bridge types, and executed interaction tests. It is an implementation review by the project agents, not a claim of an external user study or completed visual panel.

The original launcher presents four entry cards: Offline Atlas, Online Runtime, System & Models, and Local Projects. The v0.3 candidate introduced a consistent company workspace, team, roadmap, and permanent Office controls. The v0.4 candidate makes a scoped conversation with Donna the default home and places the spatial views of the same work beside it.

## Decisions

| Question | Decision in v0.4 | Evidence or reason |
| --- | --- | --- |
| Where does a user begin? | Open Donna's Chat by default. A new goal returns to the same composer. | The original launcher required choosing a subsystem before describing the desired outcome. The new goal focus and route are covered by the DOM suite. |
| How do organization and work stay connected? | Company, office, department, and employee scopes drive conversations, plans, room placement, and ownership. | Native `OfficeScope`, `OfficeGoal`, and `OfficeBlueprint` records are authoritative. No independent renderer organization is persisted. |
| Should the office be decorative? | Rooms contain actual employee assignments. Room selection, employee selection, placement, and movement have actions. | Normalized position and employee assignment mutations are exercised by the DOM suite. SVG floor-plan accents are decorative and have no telemetry meaning. |
| How does the whiteboard represent accountability? | A saved ownership card links a room, employee, and existing goals/jobs. Completion comes from those linked records. | Ownership and position commands use the native whiteboard schema; the UI does not invent a second completion state. Lines refer to saved owner desks. |
| What belongs in the main view? | Chat, Office Blueprint, and Whiteboard share one workspace. Administrative tools sit in an expandable Office tools area. | Existing employees, queue, schedules, cache, knowledge, ledger, and GitHub controls retain their bindings. Other original reference and project screens remain reachable. |
| How is model work distinguished from planning? | Local plans are labeled Local planning. Provider replies are displayed only from provider-attributed records. | `post_chat` stores a user message; `plan_goal` is a local native operation. Provider results are emitted after recorded jobs. The UI test checks local provenance and zero model calls for plan-only mode. |
| How does autonomy work? | Review mode holds the saved plan for an execution action. Autonomous mode applies the saved authorization policy without repeating the goal checkbox. | Both paths retain model, price, token, time, per-job spend, and global limits. Policy and authorization behavior are tested. |
| How are budget limits communicated? | The remaining global budget stays beside the workspace tabs. Expanded policy separates observed, estimated, and reserved amounts. | Values come directly from `OfficeBudget`; the UI does not recompute a competing ledger. Waiting-budget jobs remain visible. |
| Is a queued goal a running model? | Goal labels derive execution activity from actual linked jobs. A goal workflow with no running job is shown as Work queued. | Native goal status may indicate an active workflow before its first provider request. This label avoids claiming a process is already running. |
| What does the time limit mean? | Goal time is labeled a target checked between iterations; provider requests have their own transport timeout. | Matches the native goal contract and worker behavior. |
| How does GitHub publishing remain reviewable? | Branch metadata, comparison, expected head SHA, text changeset, and commit message remain together under Office tools. | Review mode requires the reviewed-changeset input. The renderer sends the expected head; the main service owns validation and non-force publication. |
| What can a public preview do? | Navigate and inspect an explicitly labeled example workspace. Save and execute controls are disabled. | The public-preview bridge is separate from the private browser transport. A DOM check ensures the example banner and read-only controls survive refresh. |
| How do non-spatial users operate the office? | Room and card inspectors, normalized coordinate inputs, keyboard movement, and list views provide alternatives to dragging. | The DOM suite verifies keyboard movement and persistent coordinates. Real layout and assistive-technology verification still require a browser. |

## Visual and interaction choices

The palette uses warm white, ink, and a restrained evergreen accent. Serif display headings establish the Atlas identity; system sans text carries the controls. The room view uses SVG floor-plan details and an unobtrusive grid. Usage figures remain connected to recorded data.

The final implementation pass increased secondary-text contrast and the size of conversation, ownership, and room labels. Inputs and primary actions receive larger touch targets at narrow widths. Focus indicators, semantic tablists, reduced motion, safe text rendering, and bounded lists remain in place.

## Validation and limits

- Renderer strict TypeScript compilation passes.
- `npm run test:renderer` builds and runs the suite using pinned `jsdom@31.0.1`; CI includes this gate.
- The pure-DOM renderer suite passes **125 assertions** with a fixture bridge and zero provider/network calls.
- HTML has **405 unique IDs**, no duplicate IDs, and no missing literal renderer DOM targets at this checkpoint.
- Separate worker/import tests pass **49 tests**, including cancellation accounting, cache integrity, malformed metadata, and the inclusive 2,000-repository boundary.
- A portable real-browser smoke suite covers three viewport widths, nine routes, three workspace views, five Office tool tabs, and the unconnected/read-only preview states.

The local Chromium launch failed before page load because the environment disallowed its required Unix socket. No local visual pass or native end-to-end result is inferred from jsdom. The release owner will inspect the published starter preview and record any observed visual fixes separately. No paid provider request was made by this design work.

## CEO portfolio extension

The portfolio extension adds a CEO overview **above the existing company scope**. It changes the organizational view, not the conversation surface. Company and group entry points open the same Chat, Office Blueprint, or Whiteboard. This keeps portfolio decisions connected to the working context.

| Decision | Implemented behavior | Evidence |
| --- | --- | --- |
| Show the organizational hierarchy without making another chat | Group → company directory, with direct entry to existing workspace views | DOM assertions verify a single conversation and company navigation |
| Make reassignment concrete | Group membership editor and one atomic membership plan for moving a company | Mutation payload preserves company identities and source repositories |
| Reuse shared workers | Explicit service contracts and the original employee IDs | UI tests cover contract selection, pause/resume, recipient queue scope, and source-company employee reuse |
| Cover creative and delivery work | Shared preset includes Hackathon and Music & Arts alongside engineering, design, research, and security | Six named specialty cards render from native service records |
| Keep optimization explainable | Preserve existing groups; put unassigned imports into a stable Ungrouped projects collection | No claim of inferred code similarity; memberships are editable |
| Connect strategy to ownership | Global roadmap filters by company, group, department, and status; outcomes map into whiteboard records | Evidence gates Done, and `roadmapItemIds` survive the mapping |
| Distinguish staffed roles from live work | Shared-specialist and contract counts are separate from running requests | Running-request metric reads actual job status |
| Prepare maintenance without surprise execution | Daily review templates start paused with explicit model/rates, 48,000-token and spend caps | Tests verify paused state and proposal-only wording |
| Preserve privacy in the public demonstration | Public CEO data comes from an isolated starter seed; mutation buttons are disabled | Tests exercise local-only navigation in public-preview mode |

The final portfolio checkpoint passes **125 DOM assertions** and strict renderer compilation. It has **405 unique IDs** with no duplicate or unresolved literal DOM references. The source is ready for the parent release agent's published visual capture; no local browser-success claim or private-data export is made here.
