# Blueprint canvas verification

`check.mjs` exercises the standalone prototype through public DOM controls and independently calculated CSS transformation matrices. It uses the repository's installed `jsdom` dependency from `desktop-shell`; it does not start a browser or server, contact a backend, or modify the prototype.

## Run

From the repository root, install the desktop development dependencies on a fresh checkout with `npm ci --prefix desktop-shell`, then run:

```sh
node design/blueprint-canvas/validation/check.mjs cloud-workspace/public/concepts/blueprint-office.html design/blueprint-canvas/validation/receipt.json
```

Both arguments are optional. The default input is the same repository prototype; the default output is `daftar-blueprint-prototype-checks.json` in the operating system's temporary directory. An alternative HTML file and receipt path can be supplied as the first and second arguments. Paths are resolved without requiring a particular checkout location. The receipt records the input SHA-256, Node and JSDOM versions, scope, counts, and individual results.

`PROTOTYPE_FILTER` optionally selects groups by regular expression. Such a run is explicitly labelled `targeted`; the checked-in final receipt uses all 15 groups. A failing assertion makes the process exit unsuccessfully.

## Coverage

The 15 groups cover:

- Corrupt or unavailable storage; company, task and note limits; duplicate identifiers; valid parent relationships; unsafe text and unsupported saved geometry.
- Popup lifecycle, bounded chat history, reopen consistency, same-clock task creation and reload, and preservation of an unsent draft during company navigation.
- One shared world, company wall/desk and board containment, top-view defaults, optional tilt/orbit, and nearest-company detail rendering at 100 companies.
- Cursor-anchored zoom, inverse board dragging, popup anchors and inverse-billboard orientation at four pitches, finite camera bounds, degenerate pinch input, and interruption of camera flights.
- All four popup corners remaining above the floor and board plane. This regression uses three explicit simulated measured sizes and the viewport-height fallback, at every pitch and minimum/fit/maximum zoom. Checking only a popup's anchor and screen rectangle does not establish that its lower edge stays in front of the scene.

Static checks reject external resources and network API references in the standalone document. Automatic JSDOM subresource fetching is disabled; explicit network APIs are trapped during the interaction checks. All fixture data is synthetic.

## What this evidence establishes

This is a synthetic DOM and mathematical geometry suite. Canvas drawing is stubbed, timers and time are deterministic, and pointer capture is simulated. The popup-depth cases provide explicit element dimensions because JSDOM does not perform layout. Those inputs exercise the adaptive elevation calculation; they are not measurements of a browser-rendered popup.

The suite cannot verify browser compositing, real pointer hit testing, font metrics, accessibility-tree behavior, or visual quality. The live browser review must independently confirm that controls remain visible and clickable, including Donna's Send button at tilted views, and that focusing a popup does not scroll the viewport. A mathematically valid anchor or bounding rectangle alone is insufficient evidence for those behaviors.

This prototype contains local demo state and scripted Donna responses. Passing these checks does not validate production access control, provider execution, or a deployed application backend.
