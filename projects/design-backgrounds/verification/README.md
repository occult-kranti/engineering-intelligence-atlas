# Verification receipt

The DOM, exact-export, source/public-parity, motion-policy and declared-color checks were executed locally on 25 November 2026. All 48 checks passed; `dom-checks.json` records each assertion and the current source hashes.

Real Chromium rendering was attempted but did not start. The bundled Playwright executable was absent. The repository's existing system Chromium then failed before page load with `socket() failed: Operation not permitted`. No screenshot, layout pass, visual approval or browser accessibility result is claimed. `browser-checks.json` records the blocked state.

The strict browser command is ready for an environment with an installed browser and permitted browser processes:

```sh
node scripts/smoke-design-backgrounds.mjs --browser
```

Successful browser mode replaces the blocked receipt with actual results and writes `desktop.png` and `mobile.png` in this directory. It exercises all fifteen painted effects, selection, desktop/mobile overflow, opt-in and reduced motion, the cultural qualification, copy feedback, forced colors and script-error capture. Failing or blocked browser mode returns a nonzero exit code. No fallback silently counts a DOM pass as a visual pass.
