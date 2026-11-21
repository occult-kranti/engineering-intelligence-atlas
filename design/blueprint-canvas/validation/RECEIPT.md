# Final prototype verification receipt

The full **15-group synthetic DOM and geometry suite passed** at **2026-11-21 22:34:08 UTC**. The independently observed browser checks below also passed on the same frozen source.

## Exact source

- Prototype: [`cloud-workspace/public/concepts/blueprint-office.html`](../../../cloud-workspace/public/concepts/blueprint-office.html).
- Size: **86,124 bytes**.
- SHA-256: `91d824237d60305a51d255b0e8ca58b1a327fc6135bd9f9150c1f370b22e69cf`.
- The repository copy was verified byte-identical to the tested input.
- Automated runtime: **Node v24.22.3**, **JSDOM 31.0.1**.
- Machine-readable results: [`receipt.json`](receipt.json).
- Portable harness and rerun instructions: [`check.mjs`](check.mjs), [`README.md`](README.md).

## Automated assertions

These results come from isolated public-DOM interactions and independently calculated transformation matrices. All 15 groups ran together on the exact final hash above.

| Area | Passing evidence |
| --- | --- |
| Standalone document | One inline script; no external resource or network API reference; no observed network call during the exercised interactions. |
| Storage recovery | Nine corrupt, malformed, oversized, unavailable, or quota-exhausted storage cases leave controls usable. |
| Company capacity and hierarchy | 100 total companies, including three seeded companies; 97 extra companies persist; overflow rejected; parent relationship survives reload. |
| Task and note capacity | 60 unique tasks; note capacity reached at 40; both overflow actions rejected; unsupported or nonnumeric saved geometry rejected. |
| Unsafe input | Four malicious text entry surfaces stay inert, without injected elements or event attributes. |
| Popup lifecycle | 50 Donna open/close cycles and 25 mixed-popup cycles preserve one live dialog per type without uncaught errors. |
| Chat history | 80 sends retain 60 visible messages; 10 sends followed by close/reopen preserve 21 transcript messages without duplication. |
| Rapid task persistence | Two same-clock additions retain eight unique tasks after reload. |
| Shared world and containment | One continuous table/world; 192 extruded wall/desk boxes within company blueprints; 12 boards within company workbench areas; popups remain under the world. Top view is the default; all four pitch settings are reachable. |
| Cursor zoom and inverse dragging | 36 cursor anchors and 12 inverse board drags across 12 pitch/orbit combinations; maximum anchor error 0.01705 CSS pixels. |
| Popup orientation and depth | 12 screen anchors and inverse-billboard matrices; maximum anchor error 0.00822 CSS pixels. 48 popup planes and all 192 corners remain above the floor/board plane across four pitches and minimum/fit/maximum zoom. Minimum world-space corner elevation is 113.996; minimum clearance above the board plane is 68.996. |
| Camera edge input | 200 zoom clicks, 100 orbit clicks, five nonfinite-input cases, and a zero-distance pinch stay finite and bounded. |
| Interruption and keyboard | Six keyboard, toolbar, or pointer interruptions stop a camera flight; Escape closes a popup while its input has focus. |
| Distant-company navigation | Navigation across 100 companies retains three detailed blueprints, preserves an open unsent draft, and opens the far company's department with the keyboard. |

The popup-depth regression supplies explicit synthetic dimensions of 300 × 240, 360 × 390, and 360 × 720 pixels, plus an unmeasured-height case using the 800-pixel viewport fallback. It checks all four corners, not only the anchor. This detects the failure in which a popup's lower portion passes behind the floor even though its screen rectangle is valid.

## Separate actual browser observations

The integration owner reported the following observations from managed **Chrome through the Sites preview**, at a **1363 × 936** viewport, on the same final hash. These observations were performed separately from the JSDOM harness:

- Donna's Send action succeeded at **20°, 38°, 52°, and Top 0°**. Each action inserted a scripted response and emptied the input.
- `elementFromPoint` at the Send button's center returned the Send button at each tested angle.
- All ten ancestors from the form through `html` retained `scrollLeft = 0` and `scrollTop = 0` after each interaction.
- Screenshot inspection confirmed that the chat plane remained visible. Earlier live checks covered the default top view and an Engineering department popup.

Those observations address actual compositing, hit targeting, and focus-induced scrolling for the tested laptop viewport. They are not a cross-browser or full accessibility certification.

## Scope and limits

JSDOM does not provide real layout, compositing, hit testing, font metrics, or an accessibility tree. The harness stubs canvas drawing and pointer capture, uses deterministic time, disables automatic subresource loading, and traps explicit network APIs. Its synthetic popup dimensions validate the elevation calculation but do not measure browser-rendered dimensions.

The prototype uses synthetic companies, local demo state, and explicitly scripted Donna responses. These checks do not validate production authorization, provider execution, backend integration, or the separately released desktop software. This receipt records verification; it does not assert that a commit, push, merge, or deployment has completed.
