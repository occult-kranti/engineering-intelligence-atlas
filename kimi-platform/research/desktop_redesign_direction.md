# Desktop Redesign Direction — Research Director Desktop Shell

**Scope:** all-screen visual/interaction redesign for the Electron desktop shell
(`/mnt/agents/output/desktop-shell`), grounded in the four current screenshots
(`screenshots/office.png`, `roadmap.png`, `approvals.png`, `skills.png`) and the renderer source.
**Companion:** `visual_library_selection.md` (verified licenses; the design below assumes
**Choice 0** — existing CSS + panzoom + `motion.ts` + original SVG — with Anime.js 4.5.0 MIT as the
pre-verified optional spike).

**Prime directives**
1. Every number on screen traces to a real artifact: `ledger.jsonl`, `events.jsonl`, run store,
   `jobs.jsonl`, `models.catalog.json`, `systemInfo`, or the Donna operations fixture/contract.
   **No decorative dashboards with invented metrics.** Where data is absent, render an explicit
   empty/unknown state — the same "honest unknowns" rule `systemInfo.ts` already uses for VRAM.
2. Accessibility is structural, not a theme: keyboard-complete, WCAG 2.2 AA contrast (enforced by
   the existing `contrast.ts` regression list), reduced-motion double gate (OS + app toggle,
   `motion.ts`), every chart paired with a table.
3. Motion is **transform/opacity only**, token-timed (120/200/320/420 ms), rAF-batched. Nothing
   loops forever. Content is never gated by motion.

---

## 1. Design system deltas

### 1.1 Entity color model (consistent across all screens)
Today status color is applied ad hoc (badges, desk dots, roadmap strokes). Unify into one token
layer in `chrome.css`, consumed by chrome, office, and enterprise renderers:

- **Status hue (semantic, never repurposed):** `succeeded`→`--ok #48d08c`, `running`→`--accent-strong #3d5ef0`,
  `failed/budget-exceeded`→red token, `pending/queued`→`--warn #e0b34a`, `unknown`→neutral gray.
  These map to the existing screenshot palette and stay fixed app-wide.
- **Entity hue (identity):** roles/companies/departments/seats get a *stable* accent derived from
  the existing sitemap dot colors (research green, field-research blue, data red, engineering/QA
  grays in `office.png`). New entities get colors from a fixed 8-hue categorical ramp indexed by
  `hash(entityId) mod 8` (`enterprise/hash.ts` already provides stable hashing) — deterministic
  across sessions, no random assignment.
- **Never color-only:** every status also carries text ("budget exceeded", "pending") and/or shape
  (badge outline vs. fill, dot vs. ring). Charts use entity hue + status is shown by badge text,
  not by recoloring bars — this keeps red/green colorblind users safe and matches WCAG 1.4.1.
- All new pairs are added to `KNOWN_TOKEN_PAIRS` in `contrast.ts` so AA compliance fails the build
  if a future edit breaks it.

### 1.2 Type, density, layout
- Two density breakpoints already exist (`min-width:1280px`, `max-height:720px` in `chrome.css`);
  formalize **900×600** as the small-chrome target: single-column panels, inspector becomes a
  bottom sheet with a 40% max height, tab labels collapse to icons+accessible names.
- Tables get sticky headers and row hover = background only (no motion), 8px rhythm preserved.

### 1.3 Accessible SVG chart primitive (one component, used everywhere)
Hand-rolled (D3 rejected — see selection doc). Contract per chart:
- `<svg role="img" aria-labelledby>` with `<title>` (metric + range) and `<desc>` (trend in words),
  plus a **paired visually-collapsible `<table>`** of the same data (screen-reader and audit path).
- Bars/lines/dots only; text ≥11px at 900×600; values labeled at rest for ≤12 data points, else
  on focus/hover with keyboard-focusable points (`tabindex="0"` on a focus proxy list).
- Entrance: single opacity 0→1 over `MOTION_TOKENS.standard` (200 ms); line "draw-on" only via
  `stroke-dashoffset` if the Anime.js spike lands; skipped entirely under reduced motion.
- Re-render from data on each coalesced refresh; no transitions between live values (avoid
  implying precision that a 250 ms-coalesced refresh doesn't have).

### 1.4 Civilization-art SVG accents (strictly bounded)
Per the `civilization-art-design-research` skill's hard gates:
- Use **only the skill's modern generative labs** — `pattern_svg_generator.py` frieze/quadrature/
  girih/robins-grid exercises — rendered as **static** thin divider rules in view headers and empty
  states (Launcher, CEO portfolio header, Donna queue headers, Connections section separators).
- Every accent is labeled in source and (on hover/focus tooltip) in UI as a **"modern design
  exercise"** — no historical period/culture claim is made or implied anywhere in the desktop UI.
  No golden-ratio framing, no "reconstruction" language, no sacred-geometry copy.
- Accents are `aria-hidden="true"`, `currentColor`-based at ≤30% opacity, ≤24px tall, **zero
  animation** (they must not move even when motion is enabled), and tree-shaken out of the 900×600
  density breakpoint first. Music-skill tie-in: none on screen; the music line company appears only
  as an entity with its assigned identity hue.

---

## 2. Screen-by-screen design

### 2.1 Launcher (`chrome.ts`, `launcher-view`) — health / usage / active work
Current: three static cards (Atlas / Online Runtime / System & Models). Redesign:
- **Health strip (top):** desktop-bridge status, vault availability (boolean — never key material),
  atlas packaged yes/no (from the existing `atlas-status`), runtime URL configured (URL only).
  Each item: status dot + word ("ready" / "not configured"), no invented latency numbers.
- **Active work card:** live list of running/paused local runs and CEO program state, sourced from
  the projects store and `enterprises/*/enterprise.json`; each row links into Office/CEO at the
  right tab. Empty state: modern-exercise frieze rule + "No active runs".
- **Usage card (today):** tokens in/out and USD summed from `ledger.jsonl` rows dated today and
  `jobs.jsonl`, shown as three big numerals + one 7-day SVG sparkline. If no runs exist, the
  sparkline area shows "No usage recorded yet" — never a flat fake line.
- Jobs list keeps its table; add status badges using the unified status tokens.

### 2.2 Office (`office/app.ts`, `canvas.ts`, `derive.ts`) — queue / room / usage / burn-down / roadmap
Current (screenshots): panzoom org canvas, sitemap rail, inspector with Timeline/Approvals/
Artifacts/Node tabs, roadmap tab with node table + SVG DAG.
- **Queue strip (new, above canvas):** run queue in dispatch order — queued → running → blocked —
  each chip = entity hue border + status word + node name; keyboard: roving-tabindex chip list.
  Replaces the current need to open Timeline to see what's next.
- **Room view:** the sitemap's room grouping (Direction/Research/Data/Engineering/QA) becomes a
  collapsible header row per room showing occupancy `active desks / seats` from the run plan —
  real counts only.
- **Usage per node (inspector → Node tab):** existing "Budget / Usage (this run)" lines become a
  labeled SVG meter trio (tokens, minutes, USD) = `usage / budget` from the run record, with the
  raw numbers kept as text exactly as today ("4096 tokens · 5 min · $0.25" / "700 in / 500 out ·
  $0.0022 · attempt 2").
- **Burn-down (new, Timeline tab header):** one SVG chart, x = run wall-clock from the timeline's
  own event timestamps, y = cumulative USD and tokens vs. the run budget caps; budget caps drawn as
  dashed limit lines. Failed nodes (e.g. "Data Analyst — budget exceeded, attempt 1" in
  `roadmap.png`) are marked with a status glyph at their event time. Data source: the same event
  stream already rendered in the Timeline tab — no new logging.
- **Roadmap:** keep the DAG + table; add per-row attempts bar (integer ticks, since attempts are
  small integers) and keep the existing status pill column. `loop-requeued` events get a visible
  revision marker row (the Timeline already renders "LOOP REVISION 1" — mirror that affordance in
  the roadmap table as a "revision n" badge).
- **Approvals:** payload JSON gets syntax-preserving monospace block (as today) + a one-line
  human summary above it derived from the approval DTO (`hire approval · design-time · requested
  2026-02-01 10:02` is already there — promote it visually). Approve/Reject stay bottom-left,
  keyboard reachable, with focus returning to the next pending approval after a decision.

### 2.3 CEO (`enterprise/app.ts`, `office/ceo.ts`) — budget / utilization / contract throughput / memory
Existing sections: Portfolio, Blueprint, Graph, Companies, Program (+`buildPartitionMeters`),
Contracts, Memory, Ledger, Timeline, Stewards, Inspector, Approvals. Redesign adds four charts,
all fed by `ledger.jsonl` + `events.jsonl` + `enterprise.json` (token-free deterministic
derivations, consistent with `docs/CACHING.md`):
- **Company budget:** upgrade `buildPartitionMeters` output to labeled horizontal SVG bars per
  company: allocated share (from `partitionBudget`, provably ≤ envelope), consumed-so-far overlay
  from ledger rows. Envelope total labeled in USD + tokens (fixture-scale example: 4,000,000
  tokens / $250 envelope, 25% capacity share companies). Bar values as text at bar ends.
- **Utilization:** per department/seat strip chart: seat state over the last 24h — `staffed
  active / staffed idle / leased (fencing token held) / unstaffed` — from contract seat records and
  capacity-lease events. Unstaffed seats render the existing honest `unstaffed` label, hatched
  pattern (not just gray).
- **Contract throughput:** weekly bars of contracts `proposed → approved → fulfilled` from
  `events.jsonl` counts; the current week shows partial with a "week to date" label.
- **Memory:** entries per office over time (stacked bars by owning office, entity hues) plus the
  existing list; promotion/revocation events marked on the timeline. Shared-memory entries link to
  their `ArtifactRef` + sha256 as today.
- Ledger table stays the audit spine; gains column sorting (client-side, stable) and sticky header.

### 2.4 Donna (operations assistant — `assistant-operations.fixture.json` contract) — queues / schedules / cache / repo intake
Donna has no dedicated screen yet; add a **Donna tab in the enterprise view** mirroring the
fixture's 24 actions and 7 gates, with honest capability labeling (fixture-derived):
- **Queues:** per-department queue list from `queue.add`/`queue.reorder` state; each item shows
  position, enqueue time, and the approval state of any gated action affecting it.
- **Schedules:** schedule cards with next-run countdown (computed from stored cron/interval, not a
  fake progress bar), paused/resumed state (`schedule.pause/resume`), and a "run now" button that
  is always routed through the approval gate (`schedule.run_now` is in `alwaysApproval`).
- **Cache:** from `docs/CACHING.md` — show the two real caches (skill-excerpt, blueprint-preview)
  with entry counts, keys as short hashes, and last invalidation reason (`version`/`eventSeq`
  moved). Explicitly show "provider responses are never cached" as a policy line — this is a trust
  feature, not decoration.
- **Repository intake:** `repository.import`/`assign`/`propose_structure` items with their
  `confirmed-public-metadata` read policy badge and pending-approval state; external-action badge
  on imports (`repository.import` is the only `external` action in the fixture).

### 2.5 Connections (provider / hardware / storage — `chrome.ts` system view + settings)
- **Providers:** configured-boolean + last-status timestamp only (vault contract: never even a
  last4). Provider errors shown sanitized, as today. Ollama shown as "detected at 127.0.0.1:11434 /
  not detected" — loopback policy stated in one line.
- **Hardware:** the existing `systemInfo` report gets grouped sections (CPU/RAM/OS/disk/GPU) with
  **explicit "unknown" chips** where measurement failed (nvidia-smi absent → VRAM unknown, matching
  the current honest-unknowns rule). No spec inference from GPU names.
- **Storage:** userData usage breakdown (projects / enterprises / models / venvs / logs) measured
  on demand; each model download row shows verified state (size-verified / SHA-256-verified /
  unavailable / quarantined) exactly per `models.catalog.json` availability semantics.

---

## 3. Motion spec (binding)

- Properties: `transform`, `opacity` only. No `width/height/top/left/filter/box-shadow` animation.
- Durations/easings: `MOTION_TOKENS` / `MOTION_EASING` only; max 420 ms (camera emphasis).
- Batching: one rAF loop per view (`motion.ts animate()`); all DOM writes for a frame batched
  inside it; refresh-driven re-renders stay on the existing `scheduleRefresh` 250 ms coalescing —
  charts re-render, they do not tween.
- View transitions: only for tab/project switches via `withViewTransition`; never on the canvas.
- Reduced motion: both gates (OS + app toggle) checked per animation; end state applied instantly.
  Accents never animate. Status changes communicate by text/badge change, which motion never owns.
- Keyboard: every interactive chart point, queue chip, and graph node is focusable with visible
  focus ring; canvas pan/zoom keeps its keyboard controls; new charts never trap focus.

## 4. Performance budgets (hard limits, enforced in the test matrix)

Measured in the packaged app (Electron 45), cold start + steady state per view:

| Budget | 900×600 | 1440×900 |
|---|---|---|
| Frame rate (interaction) | ≥30 fps under **6× CPU throttle**; 60 fps unthrottled | same |
| Long task | <50 ms any task; input→paint <100 ms | same |
| DOM nodes per view | ≤1,500 | ≤3,000 (virtualize ledger/timeline lists >200 rows) |
| SVG nodes per chart | ≤300 | ≤600 |
| Renderer heap (steady) | ≤120 MB | ≤150 MB |
| Heap growth over 30 min idle-with-open-view | ≤5 MB (no listener/timer leaks) | same |
| Local JS payload added by redesign | ≤130 KB (fits Anime.js spike 118 KB + charts) | same |
| Network | **zero** new requests for local views; provider calls unchanged | same |
| Chart re-render on 250 ms refresh tick | ≤5 ms scripting each | ≤8 ms |

## 5. Visual test matrix (binding for any visual PR)

- **Sizes:** 900×600, 1440×900 (both density breakpoints) × **DPR** 1 and 2.
- **CPU:** unthrottled and **6× throttle** (DevTools protocol), asserting the frame budget above.
- **Motion:** reduced-motion ON (both OS-flag and app-toggle paths) and OFF; assert instant end
  state and identical information content.
- **Theme/contrast:** existing `contrast.ts` KNOWN_TOKEN_PAIRS suite + every new token pair;
  screenshot diff at each size via the existing `scripts/ux-shoot.py` / `ux-screenshots*.mjs`
  harness (extend to CEO/Donna/Connections views).
- **Keyboard:** scripted Tab traversal of Launcher, Office queue strip, CEO charts (focus proxies),
  Donna tab, Connections; assert focus visibility and no traps; approvals decide-approve flow
  fully keyboard-driven.
- **Data honesty:** fixture-driven tests (`assistant-operations.fixture.json`,
  `enterprise-blueprint.fixture.json`, empty-ledger fixture) asserting empty/unknown states render
  text, not zeros or fake flatlines (vitest + jsdom, extending the current suite).
- **License gate:** `VENDORED.md`/manifest check in CI: any file under `src/renderer/vendor/` must
  have a recorded SPDX license + SHA — fails the build otherwise.

## 6. Phasing

1. **P0 (no new deps):** entity color tokens + contrast regression extension; accessible SVG chart
   primitive; Office queue strip + node usage meters; Launcher health/usage/active-work cards;
   budget burn-down from timeline events.
2. **P1:** CEO budget/utilization/throughput/memory charts on real derivations; Donna tab
   (queues/schedules/cache/repo intake); Connections grouping + storage breakdown.
3. **P2 (optional spike):** Anime.js 4.5.0 staggered chart entrances behind the §4 budget gate;
   abandoned if any budget regresses.
4. **Never:** 3D/liquid/shader/text-effect layers, animated backgrounds, live-ticker charts,
   any metric not traceable to a ledger/run/event artifact.
