# Atlas working studio — design and implementation handoff

## Scope and baseline

This change starts from repository revision `a806c9f` and the verified v0.4.3 renderer. It covers the shared desktop/browser renderer, its transports, fixture interaction tests, and portable browser smoke source. Native decision services, cloud authentication and storage, provider execution, VS Code packaging, release builds, and deployment have separate owners.

The surface is **Operate**: describe work to Donna, choose an accountable scope, review specialist evidence, and carry a decision into existing goals and ownership records. The nine existing navigation destinations and their saved state remain intact. There is one conversation composer and one conversation log.

### Evidence used

- Current renderer and native bridge types, `PRODUCT.md`, `DESIGN.md`, the frontend-engineer and product-psychology role charters, and the existing 125 interaction assertions.
- Actual v0.4.3 desktop and narrow screenshots. These establish the previous layout, not the new candidate's visual correctness.
- The available cloud packages for **panel-led-product-redesign** and **Impeccable 4.4.0**. The local Impeccable launcher was absent; its new-work, operate, and craft-floor resource reads were unavailable. Existing product/design context and observed UI were used directly. No successful launcher run is claimed.
- An actual Donna advisor request using `anthropic/claude-sonnet-5-5`: 7,896 input tokens, 3,410 output tokens, USD 0.049892. Its design recommendations were reviewed against the implementation. This was an advisor report, not independent browser verification or human research.
- Independent native panel and platform agents supplied the authoritative action and transport contracts. The UI/UX and behavioral judgments below are implementation perspectives, not a user study.

## Baseline findings and decisions

| Finding and evidence | Task impact | Decision and owner | Acceptance |
| --- | --- | --- | --- |
| The v0.4.3 desktop capture places the chat after roughly 500 px of title, portfolio, and scope controls. Its composer falls below the 1,000 px capture. | The first action competes with introductory content. | Renderer: compact the command deck; place the single composer directly below Donna's header, followed by its existing scrollable log. | At 1280×720, 1024×768, and 900×700, the first composer and send control have bounds within the viewport. Real-browser assertion added; release owner must run it. |
| Company/office/department selectors carry scope, but spatial views lack a compact parent path. | A person can lose context while moving between views. | Renderer: persistent hierarchy breadcrumb and actual assigned-person/running-request counts. Keep existing selectors and keyboard tabs. | Scope changes update breadcrumb and existing views without creating duplicate records. |
| Previous pale secondary labels were small, and the visual structure did not clearly separate navigation from the work surface. | Dense work becomes harder to scan. | Renderer: deep pine structural rail, stone-paper canvas, stronger ink, restrained architectural vector work, serif headings, and clearer controls. | Measured key color pairs below; actual desktop/narrow screenshot review remains the visual gate. |
| Expert decision panels were absent from the renderer. | Users could not convene, execute, inspect, and resolve the new native review workflow. | Renderer + native panel agent: a Decision room tab in the same workspace and a CEO shortcut into it. | Native action payloads, limits, role selection, queued/running distinction, report provenance, evidence, and decision history are exercised by fixture tests and separate native tests. |
| Cloud sign-in, connection, and snapshot sync have different effects. | A single connected badge could falsely imply all edits were uploaded. | Renderer + platform: explicit website sign-in, masked pairing token, connection, manual Sync now, confirmed revision/time, pending commands, and disconnect. | Pairing clears the field; connection does not invoke sync; failed sync retains local records and displays the error. |
| Remote commands are asynchronous, but existing forms expect immediately applied native state. | Follow-up actions could run against records that do not exist yet. | Renderer + cloud owner: accept `queued:true` as pending delivery, retain the last acknowledged snapshot, and stop dependent form actions. | Queued panel creation renders no new panel, performs one command only, and says it has not yet been applied. |
| Desktop/browser pairing links are single use. | Reusing an already opened dashboard link would fail and expose unnecessary token handling to the renderer. | Platform + renderer: native clipboard-only Pair VS Code action; renderer receives success and expiry metadata only. | No credential URL is rendered or returned by the pairing bridge. |

## Studio design direction

The working studio uses a dark structural rail and a light drawing surface. Navigation is visually stable; the current scope sits immediately above the work tabs. The blueprint, whiteboard, conversation, and decision room are views of connected persisted work. Small architectural SVG details support the office identity and do not claim measured layout or telemetry.

Primary reading and new form controls retain a 14 px body scale. Compact labels and record metadata are smaller; display type is serif. Existing accessible list views, visible focus, keyboard room/card movement, semantic disclosure controls, and reduced-motion handling remain. Native date/select controls keep their constrained-width mobile fixes, and list-mode rooms override inline spatial geometry.

### Measured core color pairs

Ratios were calculated from the exact sRGB values in the candidate CSS. These checks cover the named pairs; they are not a blanket accessibility certification. The normal-text reference is [W3C WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), which specifies a 4.5:1 threshold outside its stated exceptions.

| Use | Foreground | Background | Ratio |
| --- | --- | --- | --- |
| Main ink on stone | `#1b332e` | `#f3f1e9` | 11.91:1 |
| Secondary text on surface | `#5d6c63` | `#fffefb` | 5.49:1 |
| Navigation on pine | `#d6dfcd` | `#193b31` | 8.94:1 |
| Active navigation | `#1a3b2e` | `#edf2df` | 10.75:1 |
| Room employee text | `#355a36` | `#ffffff` | 7.87:1 |
| Decision metadata on pale green | `#526447` | `#eaf0df` | 5.51:1 |
| Connection control | `#526a59` | `#fffefb` | 5.84:1 |

The first decision-metadata candidate measured 4.15:1 and was darkened before handoff.

## Decision-room behavior

1. A brief selects company, office, department, or a portfolio group containing the coordinating company. It selects one to five authoritative role keys and can link an existing roadmap outcome.
2. Creating a panel persists a draft. It reuses eligible employees and hires missing roles through the native service; it does not generate an opinion or start a provider.
3. The default total allowance is **60,000 tokens per request**, including context and peer reports, with a **USD 2 whole-panel ceiling**. Rounds and request time remain explicit. Native allocation and global policy enforce the real limits.
4. A review round requires a model and positive cloud prices. Existing review/autonomous policy supplies the appropriate authorization; the renderer does not create a new approval layer. Native jobs perform independent expert reviews followed by Donna synthesis.
5. Reports resolve `panel.goalIds → goal.jobIds → jobs`. Summary, artifact, usage, error, and execution status come from those records. Empty reports remain empty.
6. Committed panel dollars sum `job.usage.costUsd` once. Native reservation values are already mirrored there; adding `reservation.costUsd` would double count.
7. Acceptance requires evidence. A revision returns the native panel to draft for an explicit next round. Decisions retain their history; they do not automatically complete roadmap items or publish repository changes.
8. Map work to whiteboard opens the existing ownership editor with the panel's actual latest goal ID. Back to Donna opens the existing conversation.

## Cloud and editor boundaries

Desktop pairing methods are `cloudStatus`, `configureCloud`, `syncCloud`, `disconnectCloud`, and `copyEditorPairing`. Tokens enter a masked field, are cleared immediately, and are never returned by the main process. Connection authenticates only. Explicit sync uploads the snapshot and processes fetched commands through native validation; the interface shows the last acknowledged revision and time, not an invented automatic-save state.

The private cloud adapter is supplied separately before the renderer adapters. It sets `window.desktopBridge` with `transport:'cloud-browser'`. Its actual `sendCloudChat` result supplies the reply and projected conversation state. The renderer labels Donna as cloud, does not run the native post/goal/plan chain, and explains that code and panel work require the connected desktop. Hosted key management describes a server-held credential, rather than falsely reporting a missing desktop key. Hosted account controls link to `/#devices`.

Public starter previews remain explicitly read only. They cannot convene a panel, store a token, sync, or pair the editor. Navigation and inspection remain available.

Safe initial route parameters are `?workspace=chat`, `blueprint`, `whiteboard`, or `decisions`, and `?ceo=true`. Values are allowlisted and open the existing surfaces. Company selection is owned by the cloud adapter. Unknown values do not create routes or execute code.

## Advisor recommendations accepted and deferred

Accepted: compact command deck, composer-first access, persistent scope orientation, explicit queued/held/error labels, connected records, measured contrast, and a single cloud status entry point backed by the full Settings controls.

Deferred or adapted:

- The advisor's generic approval inbox was not substituted for the actual expert-panel schema.
- Automatic or one-click conflict merging is not implemented. Cloud errors remain visible and local data is retained; the service owns revision validation.
- No promise of automatic offline sync is made. The implemented sync is explicit.
- The suggested 12 px body scale was not adopted for primary reading and new form controls.
- No additional user approval gate was added around already authorized operations.
- No claim of human usability research, screen-reader verification, or three independent visual review rounds is made.

## Verification checkpoint

- **165/165** pure-DOM interaction assertions pass, including all previous 125.
- Strict renderer TypeScript compilation passes.
- **482 unique HTML IDs**, no duplicates, and no unresolved literal renderer DOM targets at the checkpoint.
- Candidate CSS parses as **746 rules with zero parse errors** in the installed DOM parser. This is syntax evidence, not layout evidence.
- Portable browser smoke source passes JavaScript syntax checking and includes the fourth workspace tab plus laptop composer geometry assertions.
- `git diff --check` passes.
- Fixture suites make no network or provider calls and do not persist invented runtime data.

The local browser's previously observed Unix-socket restriction remains; this agent did not repeat the blocked launch or infer layout from DOM tests. The release owner will inspect the actual shared renderer at desktop, laptop, and narrow widths, including draft/review panel states, cloud connection/error state, and public read-only behavior. Any material defects should be corrected in one bounded batch and confirmed once.

## File handoff

- `desktop-shell/src/renderer/chrome.html`, `chrome.css`, and `chrome.ts`
- `desktop-shell/src/renderer/browser-bridge.ts`
- `desktop-shell/tests/fixtures/renderer-bridge.mjs`
- `desktop-shell/tests/renderer-behavior.mjs`
- `desktop-shell/scripts/smoke-renderer.mjs`

No commits, release tags, version changes, or deployment actions were performed by this renderer owner.
