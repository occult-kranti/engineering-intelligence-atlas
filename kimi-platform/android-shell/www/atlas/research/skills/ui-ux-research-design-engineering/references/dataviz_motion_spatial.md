# Data Visualization, Motion, and Spatial/3D UI

**Contents:** dataviz perception evidence · Munzner's nested model · dashboards ·
accessible visualization · motion design + reduced-motion contract · spatial/3D
& XR scope

## 1. Dataviz perception evidence

- **Cleveland & McGill (JASA 1984, 79(387))** ranked elementary perceptual
  tasks by judged accuracy: position on a common scale > position on
  non-aligned scales > length/direction/angle > area > volume/curvature >
  shading/saturation.
  ([doi:10.1080/01621459.1984.10478080](https://doi.org/10.1080/01621459.1984.10478080))
- **Heer & Bostock (CHI 2010)** crowdsourced-replicated the ranking for web
  charts and added: gridlines improve accuracy (keep ≥~8 px apart); accuracy
  gains saturate beyond ~80 px chart height; 1:1-aspect rectangles are the
  worst area encodings (viewers proxy side length).
- Consequences: dot/bar charts beat pies for precise comparison; stacked bars
  make only the baseline segment comparable; label values on area encodings;
  **hue is a categorical channel** (no perceptual quantity order).

## 2. Munzner's nested model (the governing rule for viz claims)

Munzner (_Visualization Analysis & Design_, 2014; nested model, TVCG 2009,
15(6)): four levels, each with its own threat and matched validation —

| Level | Threat | Matched validation |
|---|---|---|
| Domain situation | wrong problem | interviews, observation |
| Data/task abstraction | wrong abstraction | abstraction justification |
| Encoding/interaction idiom | wrong idiom | perceptual justification, lab studies |
| Algorithm | wrong algorithm | timing benchmarks, field/adoption |

**Evidence must match the level of the claim** — a fast renderer says nothing
about whether the encoding answers the user's question.

## 3. Dashboards & Tufte

Tufte: maximize data-ink, remove chartjunk — but "ink" is a heuristic: Bateman
et al. (2010) showed modest embellishment can aid memorability. High-density
small multiples for comparison. Stephen Few (_Information Dashboard Design_):
dashboards answer monitoring questions at a glance — sparklines, bullet graphs,
alert thresholds with stated semantics.

## 4. Accessible visualization (non-visual alternatives are required)

- Text equivalents and **data tables as the semantic layer**; never encode in
  color alone (patterns/shapes/labels).
- Keyboard-navigable data points or a sibling table.
- Summaries that state the *finding*, not the structure ("revenue fell 12% in
  Q3", not "bar chart of revenue").
- Honor `prefers-reduced-motion` in animated transitions.
- SVG minimum: `<title>`/`<desc>` and `role="img"`; test with screen readers.
- D3 gives no accessibility by default (author responsibility); ECharts ships
  an `aria` component with generated descriptions and decal patterns — evaluate
  whether generated descriptions state findings or merely restate structure.

## 5. Motion design

Motion earns its place when it answers: *where did this come from / where did
it go* (spatial continuity), *did it work* (feedback), *what can I do*
(affordance hint).

- **200–500 ms** for UI transitions (Material guidance); ease-out for
  entrances, ease-in for exits; animate `transform`/`opacity`
  (compositor-friendly). Reference: Val Head, _Designing Interface Animation_.
- **Accessibility contract (WCAG 2.2):** **2.2.2 Pause, Stop, Hide (A)** —
  auto-moving content >5 s needs a control; **2.3.1 Three Flashes (A)** —
  seizure safety, never optional; **2.3.3 Animation from Interactions (AAA)** —
  interaction-triggered motion disableable unless essential.
- Mechanism: `prefers-reduced-motion` media query (Baseline since 2020) **plus
  a visible site-level toggle** — users who need it don't all know the OS
  setting. JS-driven animation (GSAP/Framer Motion/canvas) is invisible to
  CSS-only guards: check `matchMedia('(prefers-reduced-motion: reduce)')` in
  code paths.
- **Reduce ≠ remove**: replace travel/parallax/scale with fades; keep feedback
  semantics.
- Vestibular evidence: ~35% of US adults ≥40 have measurable vestibular
  dysfunction (NHANES 2001–2004) — a large minority, not an edge case.

## 6. Spatial / 3D UI & XR (scoped relevance)

- **WebXR Device API**: Candidate Recommendation Draft (2026-06-09) — stable
  enough to build on, **not** a Recommendation; modules at WD/CR stages (AR
  Module CR 2025-04-25; Hit-Test, Hand Input WD; Anchors/Layers/DOM
  Overlays/Depth/Lighting in progress). Browser reality: Chromium (incl. Quest
  Browser) full; Safari visionOS-limited; Firefox none. Khronos **OpenXR** is
  the native counterpart.
- **Spatial UX principles**: 3D UI inherits 2D laws (Fitts in 3D pointing;
  depth perception is poor — never require precise depth judgment) plus its
  own: **cybersickness** (vection mismatch; user-initiated locomotion; offer
  teleport + smooth options; maintain ≥72–90 fps; no forced camera motion),
  **comfort zones** (content ~0.5–10 m; avoid neck-strain vertical extents),
  diegetic vs. spatial vs. 2D-anchored UI choice.
- **Standing rule: every immersive experience needs a 2D fallback** — for
  accessibility and for the majority of users without headsets.
- Evidence discipline: XR usability findings are device- and context-sensitive;
  small samples dominate the literature — report device, locomotion mode, and
  sample with every claim (SSQ for simulator sickness; SUS variants exist).
- Boundary: XR/spatial production work composes with the existing
  `3d-ui-ux-spatial-interaction-designer` role and the
  `spatial-3d-production-engineering` skill — do not duplicate them here.
