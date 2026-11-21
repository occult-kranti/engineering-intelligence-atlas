# Visual Library Selection — Research Director Desktop Shell

**Role:** design/performance director review of the proposed visual/animation repositories for the
desktop-shell renderer and the civilization-art / music skills.
**Method (read-only):** every license statement below was verified on 2026-11-21 by reading the
actual LICENSE file (or the manifest `license` field where the repo ships no LICENSE file) via the
GitHub contents API. File SHAs are recorded so each claim is re-checkable. No repository code was
downloaded or executed. Star counts, marketing copy, and self-reported performance claims were
**not** used as evidence (GSAP's own `package.json` description claims "up to 20x faster than
jQuery!" — that is advertising, not a benchmark, and it played no part in the verdicts).

---

## 1. Constraints that any library must fit (verified in the codebase)

The renderer of `/mnt/agents/output/desktop-shell` is **not a typical web app**. Verified facts:

1. **No bundler.** `tsconfig.renderer.json` compiles vanilla TS (ES2022 modules) with `tsc`;
   `scripts/copy-renderer-assets.mjs` copies HTML/CSS and the `src/renderer/vendor/` tree verbatim.
   Runtime libraries are **vendored files loaded by `<script src>`**, exactly like the existing
   `src/renderer/vendor/panzoom/panzoom.min.js` (panzoom 9.4.3, MIT, `LICENSE.txt` shipped beside it).
2. **Strict offline CSP** (`chrome.html`): `script-src 'self'; connect-src 'self'; object-src 'none'`.
   No CDN, no remote fonts, no `eval`/WASM-friendly loosening. Any library must run from a local file
   and must not require CSP relaxation.
3. **A motion system already exists** (`src/renderer/office/motion.ts`): duration/easing tokens
   (120/200/320/420 ms), a rAF `animate()` helper, a View-Transition wrapper, and a *double-gated*
   reduced-motion switch (OS `prefers-reduced-motion` **and** an app-level persisted toggle), reflected
   as a `.reduce-motion` class that `chrome.css` uses to kill CSS animation. `chrome.css` already
   enforces "transform/opacity only" motion tokens.
4. **A contrast system already exists** (`src/renderer/office/contrast.ts`): WCAG 2.2 SC 1.4.3/1.4.11
   ratio computation with an automated token-pair regression list that fails the build.
5. The app ships as a **packaged binary** (electron-builder), so redistributed third-party code must
   carry a redistributable, machine-pinnable license (SPDX or equivalent). The project itself is
   private/UNLICENSED, which makes copyleft contamination an own-goal, not a feature.

Any candidate that needs a bundler, a WASM blob, a CDN, relaxed CSP, or replaces the existing
reduced-motion gate is disqualified regardless of how nice its demos look.

---

## 2. Verdict table

| Library (proposed) | Repo (primary URL) | Verified license (how) | Version at inspection | Verdict |
|---|---|---|---|---|
| **panzoom** (already shipped) | https://github.com/anvaka/panzoom (npm `panzoom@9.4.3`, vendored) | MIT — `src/renderer/vendor/panzoom/LICENSE.txt` read locally | 9.4.3 | **KEEP** (unchanged) |
| **Anime.js** | https://github.com/juliangarnier/anime | **MIT** — `/LICENSE.md`, file SHA `f999fa58ebdda6d8d0f3ae581ebdfe821f09603a`; `package.json` `"license": "MIT"` (pkg SHA `7ebe3997…`) | 4.5.0 | **ACCEPT — conditional, optional (see §4)** |
| **GSAP** | https://github.com/greensock/GSAP | **Custom "Standard 'no charge' license"** — repo ships **no LICENSE file** (root listing: README/SECURITY/dist/esm/src/types only); `package.json` `"license": "Standard 'no charge' license: https://gsap.com/standard-license"` (pkg SHA `10b168f1…`) | 3.15.1 | **REJECT** |
| **Motion** (motion.dev, ex-Framer Motion) | https://github.com/motiondivision/motion | MIT — `/LICENSE.md`, file SHA `81110442c72270dd317667cc52181522647401f2` | 14.14.0 | **REJECT** (redundant + packaging) |
| **Lenis** | https://github.com/darkroomengineering/lenis | MIT — `/LICENSE`, file SHA `4960877b2aad0e450491cb902d66e825d19acf80` | 1.3.27 | **REJECT** (harms ops task flow) |
| **p5.js** | https://github.com/processing/p5.js | **LGPL-2.1** — `/license.txt` full text read, file SHA `602010bac7f5f49d168d0b1987863708cb177b2d` | 1.x/2.x | **REJECT** |
| **dotLottie (web)** | https://github.com/LottieFiles/dotlottie-web | MIT — `/LICENSE`, file SHA `1ed117dcaafbf5692dd0d19999dd11f311aa1a1c` | 0.x | **REJECT** (assets + WASM + decorative) |
| **D3** (charts, considered as fallback) | https://github.com/d3/d3 | ISC — `/LICENSE`, file SHA `a8918c41d974616d6c8d3e31d76af1923028083a` | 7.x | **REJECT** (unnecessary weight) |

---

## 3. Rejection rationale (per library)

### GSAP — REJECT (license, not quality)
- The repo contains **no LICENSE/COPYING file at all**; the only license statement is the
  `package.json` field pointing at a proprietary "Standard 'no charge' license"
  (https://gsap.com/standard-license). "GSAP is free now" is a pricing statement, not an OSI license:
  there is no SPDX identifier, the terms live at a mutable URL, and they historically carry
  conditions around commercial distribution that a packaged desktop binary must not discover
  after the fact. Unpinnable license → unshippable dependency for this project. Any claim that GSAP
  is "MIT-like" is **unverifiable as claimed** from the repo itself.

### Motion (motion.dev) — REJECT (redundant, wrong shape)
- License is genuinely MIT (verified). But `motion@14.14.0` **depends on `framer-motion@14.14.0`**
  (verified in `packages/motion/package.json`, SHA `b94b49a0…`) and is published as a
  React-first meta-package (peer deps `react`/`react-dom`, optional but the distribution is ESM/CJS
  trees with no self-contained UMD bundle to vendor under our no-bundler, `script-src 'self'` CSP).
  Its vanilla surface (`motion-dom`) would duplicate `office/motion.ts`, which already implements
  rAF animation *with the reduced-motion gate wired through the whole app*. Pulling a second
  animation engine that does not know about the app-level "Reduce motion" toggle is a regression.

### Lenis — REJECT (harms task flow)
- MIT (verified). Lenis is inertial smooth-scrolling for content/marketing pages. This shell's long
  surfaces are **data tables, ledgers, and a panzoom canvas** — inertial scroll adds input latency,
  desynchronizes scroll position from selection state, conflicts with the panzoom world transform,
  and is exactly the motion category `prefers-reduced-motion` exists to remove. An operations
  desktop should scroll 1:1 with the user's input. Zero benefit, real harm.

### p5.js — REJECT (license + wrong tool)
- **LGPL-2.1** verified by reading the full `license.txt`. Shipping p5 inside an electron-builder
  package triggers LGPL §6 obligations (relinkable object distribution or shared-library mechanics)
  that this project's build has no machinery to satisfy, plus permanent notice obligations.
  It is also a creative-coding immediate-mode canvas framework — the opposite of the retained-mode,
  accessible, DOM/SVG-first rendering this redesign mandates.

### dotLottie — REJECT (asset provenance + WASM + decorative)
- The *runtime* is MIT (verified). The rejection is everything around it:
  (a) `.lottie` **assets** carry their own per-asset licenses that must be audited individually —
      the same "umbrella license does not launder per-item rights" rule the
      creative-rights-reproducibility-editor gate enforces;
  (b) `dotlottie-web` renders through a **WASM (ThorVG) blob**, which sits awkwardly with the
      CSP/no-`object-src` posture and defeats the "inspect every shipped line" vendoring norm;
  (c) looping character animations on an operations console are decoration that reduced-motion
      must kill anyway — paying a WASM runtime for pixels the accessibility policy deletes is
      indefensible.

### D3 — REJECT (right license, wrong necessity)
- ISC license verified. But the charts this redesign needs (budget partition bars, burn-down lines,
  queue sparklines, utilization strips) are 20–60 SVG elements each, hand-rolled against the
  existing theme tokens, with `<title>`/`<desc>` and a paired data table for accessibility.
  D3 would add ~30 transitive modules to solve a problem that 200 lines of local SVG code solves
  more accessibly and more auditably.

### Heavy 3D / liquid / shader / text-effect libraries — REJECT as a class
Anything in the three.js/Rive/WebGL-shader/split-text-effect family is rejected without individual
review: continuous GPU animation on an operations desktop burns CPU/GPU for zero task value, breaks
the transform/opacity-only motion rule, and is incompatible with the 6×-CPU-throttle frame budget
(see `desktop_redesign_direction.md`). Note that Anime.js 4.5.0 declares an **optional** three.js
peer (`peerDependenciesMeta.three.optional = true`, verified in its `package.json`) — we will not
install or use that adapter.

---

## 4. Chosen set (at most 2 — and the honest headline)

> **Headline: the existing CSS + vendored-panzoom + `motion.ts` stack, extended with original
> hand-built SVG charts and static modern-exercise SVG accents, is the better answer.**
> No new runtime dependency is *required*. One library is pre-verified as an optional spike.

### Choice 0 (primary, ships): existing stack + original SVG art — no new dependency
- **panzoom 9.4.3 (MIT)** stays the only vendored runtime library, as-is.
- Charts and accents are **original inline SVG** generated from real ledger/run data (see the
  redesign direction), animated with the existing `motion.ts` tokens and CSS transitions.
- Why this beats a library: zero new license surface, zero new bytes, full CSP compatibility, and
  every animation inherits the already-tested reduced-motion double gate.

### Choice 1 (optional spike, pre-verified): Anime.js 4.5.0 — MIT
Accepted **only** if the design review wants staggered/sequenced SVG entrance choreography (e.g.
burn-down line draw-on, ledger-row staggers) that `motion.ts`'s single-property helper would make
awkward. Verified facts: MIT (`LICENSE.md` SHA `f999fa58…`), vanilla JS, ships a self-contained
UMD build `dist/bundles/anime.umd.min.js` — **118,043 bytes, blob SHA `6c1a3ca65c60d1eb968a01470307de1c581d0490`**
(listing of `dist/bundles/`, 2026-11-21). Do not trust the repo README's performance claims; budget
compliance is proven by our own 6×-throttle test matrix, not their marketing.

**Exact vendor/license pinning and offline integration (if the spike is approved):**
1. Pin by version **and** integrity: `npm pack animejs@4.5.0` (exact version, no range), record the
   tarball SHA-512 from the npm registry into `scripts/vendor-manifest.json` (new), alongside the
   file blob SHA `6c1a3ca6…` of `anime.umd.min.js`.
2. Copy exactly two files into `src/renderer/vendor/anime/`: `anime.umd.min.js` and `LICENSE.md`
   (SHA `f999fa58…`) — the same pattern as `vendor/panzoom/`. `copy-renderer-assets.mjs` already
   syncs `vendor/` into `dist/renderer/`; no build change needed.
3. Load with `<script src="./vendor/anime/anime.umd.min.js" defer>` — allowed under the existing
   `script-src 'self'` CSP; **no network, no CDN, works fully offline in the packaged app**.
4. Wrap every call site in the existing gate: `if (isMotionReduced()) { applyFinalState(); } else { anime(...) }`
   — Anime.js must never own the reduced-motion decision; `motion.ts` does.
5. Animate **transform and opacity only**; never layout properties, never `filter`, never
   continuous loops. All durations from `MOTION_TOKENS` (≤420 ms).
6. Ship a `NOTICES`/`VENDORED.md` entry: name, version, MIT text, upstream URL, file SHAs.
7. Spike acceptance gate: the 6×-CPU-throttle visual test matrix (redesign doc §7) must pass with
   **zero** dropped-frame regressions vs. Choice 0; otherwise the spike is abandoned and Choice 0
   ships — the pre-registered fallback.

### Not chosen (summary)
GSAP (custom unpinnable license), Motion (redundant meta-package), Lenis (anti-pattern for ops),
p5.js (LGPL-2.1 + wrong tool), dotLottie (asset licensing + WASM + decorative), D3 (unnecessary),
all 3D/liquid/shader/text-effect libraries (class rejection).

---

## 5. Verification appendix (primary sources, read 2026-11-21)

- Anime.js MIT: https://github.com/juliangarnier/anime/blob/main/LICENSE.md (SHA f999fa58…);
  package meta https://github.com/juliangarnier/anime/blob/main/package.json (SHA 7ebe3997…);
  bundle listing https://github.com/juliangarnier/anime/tree/main/dist/bundles.
- GSAP custom license: https://github.com/greensock/GSAP/blob/master/package.json (SHA 10b168f1…);
  root listing shows no LICENSE file; license URL https://gsap.com/standard-license.
- Motion MIT: https://github.com/motiondivision/motion/blob/main/LICENSE.md (SHA 81110442…);
  dependency on framer-motion: https://github.com/motiondivision/motion/blob/main/packages/motion/package.json (SHA b94b49a0…).
- Lenis MIT: https://github.com/darkroomengineering/lenis/blob/main/LICENSE (SHA 4960877b…).
- p5.js LGPL-2.1: https://github.com/processing/p5.js/blob/main/license.txt (SHA 602010ba…).
- dotLottie MIT: https://github.com/LottieFiles/dotlottie-web/blob/main/LICENSE (SHA 1ed117dc…).
- D3 ISC: https://github.com/d3/d3/blob/main/LICENSE (SHA a8918c41…).
- panzoom MIT (local): `desktop-shell/src/renderer/vendor/panzoom/LICENSE.txt`.
