# Surface Studies — design team background collection

Fifteen original selectable CSS/SVG background studies with a shared readable content plate, copyable CSS, local CSS download, keyboard controls, and optional gentle movement on six suitable styles. Motion starts off, stops when the page loses focus or becomes hidden, and remains disabled when the device requests reduced motion.

Open the [interactive collection](index.html) through a static HTTP server. The public source mirror lives at `site-source/public/design-backgrounds/`; the published route is `/design-backgrounds/` when the parent site is built and deployed. This folder does not establish that a deployment occurred.

## Included styles

| # | Study | Technique | Optional motion |
|---|---|---|---|
| 01 | Thermal gradients | Layered radial/linear gradients | Gentle layer drift |
| 02 | 3D particles | Twelve shaded SVG spheres | Gentle layer drift |
| 03 | Fluted glass | Repeating translucent gradient ribs | Static |
| 04 | Persian rugs | Original Persian-inspired diamond tile and border | Static |
| 05 | ASCII pixels | SVG character grid and pixel marks | Static |
| 06 | Marbled paper | Original Bézier ribbons and grain | Static |
| 07 | CRT scanlines | Static lines, glow and vignette | Static; no flicker |
| 08 | Crushed velvet | Directional shaded folds and grain | Static |
| 09 | Pressed flowers | Original stems, leaves and petals | Static |
| 10 | Damaged film | Original scratches, grain and still light leak | Static; no flicker |
| 11 | Water ripples | Repeating elliptical gradient rings | Gentle layer drift |
| 12 | Wasp nest | Hexagonal paper-like cells and nested contours | Static |
| 13 | Iridescent shapes | SVG forms with multicolor shading | Gentle layer drift |
| 14 | Foggy windows | Haze gradients and SVG droplets | Gentle layer drift |
| 15 | Liquid metal | Original vector shape and silver gradient bands | Gentle layer drift |

These are illustrative approximations. The particle, metal, water, glass and iridescent studies do not implement their corresponding physical simulations. The Persian-inspired pattern is an original geometric adaptation, not an authentic regional textile, traditional pattern attribution, or reproduction of a museum object. The botanical forms are invented. All artwork is procedural CSS or original SVG; no external raster image, texture pack, font service or provider request is needed.

## Use and handoff

Select a thumbnail, or use Previous/Next. The selected study's description, technique and limitations update alongside the preview. The content-plate checkbox changes only the illustration. Copy CSS includes the style, the content-plate rule, static defaults and reduced-motion override. If browser clipboard access fails, the code opens and is selected for manual copy. Download creates a local `.css` file.

The copied CSS uses `.surface` and `.content-plate`. A minimal structure is:

```html
<section class="surface">
  <div class="content-plate">
    <h2>Your actual content</h2>
    <p>A readable introduction and the next useful action.</p>
  </div>
</section>
```

Keep the plate opaque and verify its actual text colors when adapting it. The optional `data-motion="on"` attribute is available only in styles that declare motion, and CSS still suppresses it under reduced motion. The static copied effect is the default; it does not include the studio's JavaScript lifecycle controls. A receiving application that enables animation must also implement its own visibility, focus and user-pause handling.

The [style briefs](style-briefs.md) provide the exact design-team mapping and implementation limits. The [source register](sources.json) records primary implementation guidance, access depth and why each reference was used. Three.js responsive guidance informs a future WebGL handoff; this collection does not ship or claim a Three.js renderer.

## Build and verify

From the repository root:

```sh
node projects/design-backgrounds/build.mjs
node scripts/smoke-design-backgrounds.mjs
node scripts/smoke-design-backgrounds.mjs --browser
```

`effects.mjs` is the source of the fifteen styles and their CSS exports. `build.mjs` generates `effects.css`, writes metadata and synchronizes the declared public files. The smoke script checks selection, exact CSS export, clipboard success/failure, invalid hashes, static defaults, motion guards, reduced-motion changes, source/public parity and the bounded study count. Browser mode additionally checks actual desktop/mobile layout, CSS painting, copy behavior and reduced motion, and saves screenshots. It needs the repository's Playwright package and an installed Chromium binary.

Test receipts distinguish DOM checks from real browser checks. A passing smoke test does not establish browser-wide accessibility, physical realism, production integration, frame-rate performance or device battery behavior. No speed or performance guarantee is attached to these studies.

## Ownership and integration

This is a shared design-team reference. It does not create an employee, connection, authority grant or active provider job. Route a chosen treatment through the existing `design-architecture` and `figma-design-systems` roles. Their updated procedures preserve company scope, source IDs and actual acceptance evidence. Applying a study to the native Donna workspace is a separate implementation decision; this collection does not alter native state or data access.
