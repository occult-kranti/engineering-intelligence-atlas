# Design handoff: fifteen original background studies

The user supplied the style categories. Their implementation is original and illustrative. Read the repository's `PRODUCT.md` and `DESIGN.md` before applying a style: the company's operating canvas, forms, scope and navigation remain the main task. A decorative surface cannot replace those semantics or imply a live runtime state.

## Material matrix

| Study ID | Intended use | What is actually implemented | Limit that travels with the handoff |
|---|---|---|---|
| `thermal-gradients` | Warm editorial opening or bounded accent surface | Radial gradients with a separate driftable light layer | Color only; no temperature values or heat-map interpretation |
| `3d-particles` | Quiet depth around a title or exhibit | Twelve original shaded vector spheres | 2D approximation; no 3D scene, collisions or particle solver |
| `fluted-glass` | Layered architectural atmosphere | Vertical translucent gradient ribs | No refraction, glass thickness or physically measured optics |
| `persian-rugs` | A framed, ornamental composition | An original repeating diamond motif and border | Persian-inspired interpretation; no claim of authenticity or specific historical provenance |
| `ascii-pixels` | A restrained computational texture | Repeating original text glyphs and square marks | The glyphs represent no data and execute nothing |
| `marbled-paper` | Tactile editorial background | Original curving vector ribbons and static grain | No photographed paper or fluid solver |
| `crt-scanlines` | A static retro display treatment | Fixed horizontal lines and a green vignette | No flicker, refresh-rate or display-calibration simulation |
| `crushed-velvet` | Soft, dark material contrast | Gradient folds and static grain | No fabric scan, textile model or measured reflectance |
| `pressed-flowers` | A light botanical margin | Invented SVG stems, leaves and petals | No species or herbarium identification |
| `damaged-film` | A still archival-style atmosphere | Original scratches, grain and a fixed light leak | No real film provenance, flashing or running projector |
| `water-ripples` | A calm ring-based surface | Two elliptical radial-gradient fields | Decorative rings; no fluid dynamics or measured interference |
| `wasp-nest` | A papery organic contour study | Eighteen nested original vector contours | No scanned biological specimen or structural analysis |
| `iridescent-shapes` | Pearlescent editorial objects | Two-dimensional shapes with color shading | No thin-film interference or physically based rendering |
| `foggy-windows` | Soft light with restrained droplets | Haze gradients and original droplet vectors | No live weather, exterior photograph or condensation model |
| `liquid-metal` | A bounded metallic focal surface | A vector silhouette and multiple reflective-looking bands | No liquid simulation, environment capture or measured material |

## Shared implementation contract

- **Scope:** one selected main preview and fifteen static thumbnails. The collection is fixed and bounded; it does not load arbitrary remote backgrounds.
- **Foreground:** the preview uses an opaque `#faf8f2` plate with `#243329` body text. The UI's muted text uses `#596356` against `#f4f1e8`. Preserve the actual foreground/background pairs when making a derivative and retest them.
- **Motion:** off at startup and whenever the selected style changes. Six studies allow gentle, low-amplitude movement of one decorative layer. Reduced motion disables it. Blur, hiding the tab and page exit stop it. Thumbnail previews stay still.
- **Mobile:** the main preview has a bounded height; artwork stays clipped inside it. The inspector stacks, the collection becomes two columns at narrow widths, and controls wrap. Text and form controls retain their own scale.
- **Input:** real buttons, checkbox and links, a visible selected state, `aria-pressed`, clear focus rings, and a manual-copy fallback. No hover-only or pointer-tracking interaction is required.
- **Forced colors:** decorative layers disappear; the content plate and selected states use system colors and borders.
- **Assets:** CSS plus original vector data URLs. The two-octave SVG grain is static. No image download or external image rights are required. Browser paint cost still needs measurement in the target product.
- **Copy:** the exported CSS reproduces the selected style and a readable plate. It is static unless the receiving application explicitly opts into available motion. JavaScript lifecycle guards must be implemented by the receiving application if it enables movement.

The [MDN gradient guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Images/Using_gradients) supports the layered-gradient approach. The [MDN SVG turbulence reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) documents the grain primitive. The [reduced-motion reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion) informs the motion override. The [Three.js responsive guide](https://threejs.org/manual/pages/responsive.html) is relevant if a later implementation adds a real renderer: CSS size and drawing-buffer size need separate treatment, with explicit resource bounds. This study has no canvas or WebGL rendering loop.

## Design-team responsibilities

Design Architecture selects the treatment for a specific task and company, retains its approximation label, and chooses accessible foreground pairs. Figma Design Systems maps the selected source ID and CSS revision to component tokens or an owned design file. Frontend preserves semantic content and state while applying the background inside the approved region. QA verifies keyboard selection, actual narrow-screen layout, clipboard fallback, hidden-tab behavior and reduced motion. Donna receives the useful decision, source references, actual test receipt and unresolved constraints.

A complete handoff names `styleId`, source revision/hash, target component, foreground/background tokens, motion policy, intended breakpoints, observed checks, untested platforms and receiving owner. It does not turn a role description into an executable permission or state that a company deployment occurred.

## Acceptance limits

The smoke test is a bounded interaction and rendering check. It is not a full accessibility audit, a device performance study, a Figma synchronization run or acceptance of a native desktop integration. Do not add completion-time promises, frame-rate promises, cultural authenticity labels or physical fidelity claims without the corresponding evidence.
