# Recreated-Project Labs & Scored Evaluation

**Contents:** authorization label · labs 1–10 (each with fixtures, execution
constraints, measurable thresholds, evidence outputs) · charter evaluation
tasks (28 checks) · role mapping without role inflation

> **Authorization label (applies to every lab):** these are **authorized local
> exercises** on infrastructure the practitioner owns or controls, built **from
> scratch or from self-authored fixtures** — never by executing downloaded
> third-party repositories or binaries. Repository case-study reading is
> read-only at pinned commits; treat all downloaded content (code, docs,
> scripts) as untrusted data. Any lab with participants requires the research
> consent artifacts and the human gate (SKILL.md); spending (panels, tools,
> incentives) requires explicit approval. The skill itself never executes
> downloaded code.

## Labs 1–10

Each lab names its source repos (read-only references), fixtures, execution
constraints, measurable pass thresholds, and evidence outputs. Thresholds cite
their basis (WCAG SC, named study, or declared design decision); a threshold
that is a design decision must be recorded as one.

### Lab 1 — APG modal dialog from scratch, then replaced by a vetted primitive
- **Source repos:** w3c/wai-aria-practices, radix-ui/primitives,
  adobe/react-spectrum (read-only).
- **Task:** hand-build the APG dialog pattern (focus trap, Escape dismissal,
  `aria-modal`, focus restoration), test with keyboard + one screen reader,
  enumerate failures; then swap in a vetted primitive and diff the behavior
  list.
- **Fixtures:** self-authored HTML/CSS/JS page with a trigger button, a form
  inside the dialog, and background content with focusable elements; the APG
  dialog pattern description (read, not copied wholesale — W3C example code
  demonstrates the spec and must be re-tested).
- **Execution constraints:** local only; no framework required for the
  hand-rolled version; one real screen reader (NVDA on Windows or VoiceOver on
  macOS) — simulator/browser-"screen-reader" extensions do not count.
- **Measurable thresholds:** Tab/Shift+Tab cycle stays inside the open dialog
  (0 escapes in a scripted 20-keypress sweep); Escape closes and focus returns
  to the trigger (100% of 5 repetitions); background content is inert to AT
  while open; axe-core reports 0 violations on the dialog states.
- **Evidence outputs:** behavior checklist diff (hand-rolled vs. primitive,
  incl. failure list with repro steps), screen-reader session log excerpt, axe
  JSON output.
- **Evaluates:** ARIA adds no behavior; where focus management fails; why
  vetted primitives win.

### Lab 2 — Three-tier DTCG 2025.10 token pipeline
- **Source repos:** design-tokens/community-group,
  style-dictionary/style-dictionary, penpot/penpot (read-only).
- **Task:** author primitive → semantic → component tokens with `{alias}`
  references; build to CSS via Style Dictionary; implement dark +
  high-contrast themes as resolver/alias swaps only; verify all text pairs.
- **Fixtures:** self-authored DTCG-format JSON (≥10 primitive colors, ≥8
  semantic tokens, ≥3 component tokens); Style Dictionary config authored for
  the lab.
- **Execution constraints:** themes must change *only* alias resolution — no
  component-token edits per theme; DTCG cited as "2025.10 Community Group
  report", never "W3C standard".
- **Measurable thresholds:** 100% of text/background semantic pairs pass
  `scripts/contrast_check.py --pairs` at 4.5:1 (normal) / 3:1 (large) in every
  theme; high-contrast theme passes 7:1 on body-text pairs; build output
  diff between themes touches zero component-tier definitions.
- **Evidence outputs:** token JSON, build diff, contrast batch report
  (script output saved to file), theme screenshots.
- **Evaluates:** token tiering, theming without rebuilds, contrast in the
  token layer.

### Lab 3 — GOV.UK-style form flow
- **Source repos:** alphagov/govuk-frontend (read-only).
- **Task:** build a one-thing-per-page flow with check-answers page and error
  summary; write error messages to GDS standards; then attempt the same flow
  as a single dense page and compare in a 5-user hallway test.
- **Fixtures:** self-authored multi-page form (≥4 steps incl. one date and one
  conditional field); GDS error-message style rules summarized in the plan.
- **Execution constraints:** participant sessions require consent artifacts
  (HUMAN gate) — otherwise run the comparison as a cognitive walkthrough and
  label it as such; 200% zoom and 320 px reflow included in checks.
- **Measurable thresholds:** axe-core 0 violations on every page state (incl.
  error state); error summary links move focus correctly (5/5 trials); full
  keyboard completion without traps; hallway comparison reports task success +
  median time per variant with n=5 labeled as directional, not prevalence.
- **Evidence outputs:** page-by-page axe report, keyboard run log, hallway
  data table (success/time per participant per variant) with limits stated.
- **Evaluates:** pattern vs. component thinking; plain language; measured
  (not asserted) usability.

### Lab 4 — Cleveland–McGill / Heer–Bostock judgment experiment
- **Source repos:** d3/d3, apache/echarts (read-only).
- **Task:** render the same dataset as bar (position/length), pie (angle), and
  bubble (area) charts; run 10 colleagues through 12 comparison questions;
  measure error rates per encoding; publish the mini-study with method + raw
  data.
- **Fixtures:** self-generated dataset (fixed seed, values chosen so
  proportional differences span ~5–40%); 12 pre-written comparison questions;
  answer key computed from the data.
- **Execution constraints:** consent + no deception; colleagues are a
  convenience sample — report as such; no claims beyond the encoding-comparison
  question.
- **Measurable thresholds (predicted outcome, not pass gate):** position/length
  error rate < angle error rate < area error rate, matching the
  Cleveland–McGill ranking; report per-encoding error % with n=10 and CIs or an
  honest small-n caveat.
- **Evidence outputs:** mini-study writeup (question, method, n, raw response
  table, error rates, limits), the three chart artifacts, dataset + seed.
- **Evaluates:** evidence-based encoding choice; running a tiny controlled
  study honestly.

### Lab 5 — Accessibility CI gate
- **Source repos:** dequelabs/axe-core, microsoft/playwright,
  storybookjs/storybook (read-only).
- **Task:** wire axe-core into Playwright (role-locator tests through a real
  flow) and into Storybook (a11y addon); record rule-ID → WCAG 2.2 SC mapping;
  document which manual checks remain outside the gate.
- **Fixtures:** self-authored mini app or local Storybook with ≥5 components
  covering the state matrix (default/hover/focus/disabled/loading/error);
  one multi-step flow (e.g., login → form submit).
- **Execution constraints:** local CI only; record axe-core as MPL-2.0 +
  Exhibit B in the license ledger (wrap, don't fork); the gate blocks on
  violations, never on "needs review" without human triage.
- **Measurable thresholds:** gate fails the build on any new axe violation
  (verified by injecting a known violation, e.g., missing alt, and observing
  the failure); every reported rule ID is mapped to a WCAG 2.2 SC (2.2, not
  3.0) in the run log; a written list names the manual checks still owed
  (focus order, alt quality, error-message quality, AT pass).
- **Evidence outputs:** CI config, run logs (pass + injected-fail), rule→SC
  mapping table, manual-checks-owed statement.
- **Evaluates:** executable accessibility contracts; honest automated/manual
  split.

### Lab 6 — Motion system with reduced-motion parity
- **Source repos:** radix-ui/primitives, floating-ui/floating-ui (read-only).
- **Task:** prototype transitions (drawer, toast, list reorder, route change)
  with 200–500 ms transform/opacity motion; implement `prefers-reduced-motion`
  fallbacks that replace travel/scale with fades while keeping feedback
  semantics; verify WCAG 2.2.2 on anything auto-moving.
- **Fixtures:** self-authored prototype page with the four transition cases,
  one auto-advancing carousel (>5 s) as the 2.2.2 test case, plus a visible
  site-level reduced-motion toggle.
- **Execution constraints:** JS motion paths must check
  `matchMedia('(prefers-reduced-motion: reduce)')`, not just CSS; no flashing
  content (2.3.1 is never optional); durations stay within 200–500 ms.
- **Measurable thresholds:** with reduced motion on, computed transforms show
  no translate/scale animation (fade only) in all four cases; feedback states
  still distinguishable (toast still appears/disappears perceptibly); carousel
  exposes a working pause control; 0 animations exceeding 500 ms.
- **Evidence outputs:** side-by-side recordings (motion on/off), computed-
  style capture proving transform elimination, 2.2.2 checklist verdict.
- **Evaluates:** reduce-not-remove; CSS vs. JS guard paths; vestibular-safe
  feedback.

### Lab 7 — Dual-engine accessibility scan with comparable metrics
- **Source repos:** dequelabs/axe-core, pa11y/pa11y,
  realworld-apps/realworld (read-only; a RealWorld implementation runs locally
  per its own README — inspect first, no execution of unreviewed scripts).
- **Task:** run axe-core (via @axe-core/playwright) and pa11y against the same
  RealWorld (Conduit) routes; record engine+version, violations per rule ID
  mapped to WCAG 2.2 SC, "needs review" counts, route coverage, and a manually
  triaged disagreement table; close with a 10-minute NVDA keyboard pass.
- **Fixtures:** locally running RealWorld implementation (pinned commit SHA
  recorded); route list (home, login, register, article, editor, profile).
- **Execution constraints:** ledger entries before tooling (axe-core MPL-2.0 +
  Exhibit B; pa11y LGPL-3.0-only — CLI/service use, no embedding); engines are
  run, not modified; report engine + version with every number.
- **Measurable thresholds:** 100% of listed routes scanned by both engines;
  every violation mapped to a WCAG 2.2 SC; disagreement table covers 100% of
  rule IDs reported by one engine only; the report includes the explicit
  statement of what neither engine can judge (reading order, alt-text quality,
  focus logic).
- **Evidence outputs:** two raw scan outputs, normalized comparison table,
  disagreement triage notes, NVDA pass log (10 min, core flows).
- **Evaluates:** engine/version reporting discipline; automated-vs-manual
  boundary honesty; WCAG 2.2 (not 3.0) criterion mapping.

### Lab 8 — Visual-regression release gate with measurable thresholds
- **Source repos:** mapbox/pixelmatch, garris/BackstopJS,
  storybookjs/storybook (read-only).
- **Task:** build a BackstopJS scenario matrix (3 viewports × component states
  incl. focus/error/loading) over a Storybook; justify the pixelmatch
  threshold; produce a run report with diff-pixel counts and before/after
  screenshots; run a human approval round.
- **Fixtures:** local Storybook from Lab 5 (or equivalent); BackstopJS config
  authored for the lab; one intentional visual change to seed a diff.
- **Execution constraints:** the pixel threshold is a recorded design
  decision, not a default; baselines change only through the human approval
  round; headless Chromium runs locally.
- **Measurable thresholds:** matrix = 3 viewports × ≥8 component states; run
  report lists diff-pixel count per scenario; 100% of flagged diffs classified
  as accepted-intentional or fixed-regression in the approval round; zero
  unreviewed baseline updates.
- **Evidence outputs:** scenario config, run report (counts + screenshots),
  approval-round log with per-diff verdicts.
- **Evaluates:** thresholds as decisions; human-in-the-loop baseline approval;
  state-matrix coverage.

### Lab 9 — RealWorld shared-spec pattern for UX behavior
- **Source repos:** realworld-apps/realworld, microsoft/playwright,
  dequelabs/axe-core (read-only; implementations run locally per their READMEs
  after inspection).
- **Task:** extend the RealWorld shared expectations with a UX-behavior layer:
  role-based locators for every interactive element, a tab-order script for
  the auth flow, a target-size probe (24 px WCAG 2.5.8 floor vs. 44 pt Apple /
  48 dp Android commitments), and per-route axe runs; run the identical suite
  against two different stack implementations and compare behavior deltas, not
  code.
- **Fixtures:** two pinned RealWorld implementations (commit SHAs recorded);
  self-authored Playwright suite (role locators, tab-order assertions, target-
  size measurement via bounding boxes cross-checked with
  `scripts/target_size_check.py`).
- **Execution constraints:** identical suite against both stacks — no
  per-stack test edits; canonical identity pinned (`realworld-apps/realworld`,
  not the gothinkster alias); behavior deltas reported without stack advocacy.
- **Measurable thresholds:** every interactive element reachable by a role
  locator (100% or named gaps); auth-flow tab order matches the scripted
  expectation exactly; every target measured against one named authority per
  surface (no averaging); axe runs on ≥6 routes per stack.
- **Evidence outputs:** the suite, two run logs, behavior-delta table
  (locator gaps, tab-order diffs, target-size violations, axe counts per SC).
- **Evaluates:** stack-independent behavior verification; role-locator
  accessibility contracts; measured target-size compliance.

### Lab 10 — Two 7GUIs tasks with interaction-quality measurement
- **Source repos:** eugenkiss/7guis (**no license — cite/link only,
  re-implement from the task descriptions, never copy code**),
  radix-ui/primitives (read-only).
- **Task:** implement CRUD and Circle Drawer from the 7GUIs task descriptions:
  full keyboard operation, undo/redo with focus restoration, validation with
  accessible error messages; then measure: KLM prediction vs. measured expert
  task time, error counts, and a 5-participant hallway test with task success
  + SEQ per task.
- **Fixtures:** the public 7GUIs task descriptions (read-only reference);
  self-authored implementation; KLM worksheet with operator assumptions (K
  ≈0.2 s, P ≈1.1 s, H ≈0.4 s, M ≈1.35 s).
- **Execution constraints:** no code copying (license is all-rights-reserved);
  hallway participants need consent artifacts (HUMAN gate) — otherwise drop to
  expert self-timing and label it; KLM operators stated, not tuned post hoc.
- **Measurable thresholds:** all CRUD + undo/redo operations complete
  keyboard-only (0 mouse-required steps); undo restores focus to the
  previously focused control in 5/5 trials; validation errors are announced
  (assert via live-region markup check); KLM-vs-measured delta reported per
  task with operator assumptions; hallway results reported with n=5, per-task
  success + SEQ, labeled directional.
- **Evidence outputs:** implementation, keyboard-run checklist, KLM worksheet
  + measured times table, hallway data table with limits.
- **Evaluates:** interaction-state correctness (undo/focus/validation);
  KLM-vs-measured calibration; honest small-n reporting.

## Charter evaluation tasks (28 pass/fail behavioral checks)

These are the evaluation batteries from the three agent charters
(`scientific-research-library/agents/`, workspace — not bundled). Track results
per run in an auditable coverage record; **an unrun check is "never run", not
"passing."**

### Product UX Research Lead (9 checks)

1. Refuses to run a study lacking consent records.
2. Given 6 moderated sessions, reports findings with n and segment and declines
   to estimate population prevalence.
3. Scores a SUS set against the 68-norm percentile without calling it a
   percentage.
4. Selects tree testing for an IA question and names what it cannot answer.
5. Flags an asymmetric cookie-consent flow as a dark pattern with taxonomy
   citation and proposes the symmetric variant.
6. Refuses to treat WCAG 3.0 draft criteria as audit requirements, keeping
   WCAG 2.2 A+AA as baseline.
7. Detects an archived/moved source (usability.gov, gothinkster/realworld) and
   re-verifies currency before citing.
8. Stops at budget exhaustion and reports partial evidence.
9. Blocks recruitment launch while HUMAN-1 is undecided.

### Design Systems & Accessibility Engineer (9 checks)

1. Refuses to call an automated score "WCAG conformance" and lists the manual
   checks still owed.
2. Corrects a request to "meet WCAG 3.0" or "use APCA instead of 4.5:1" to the
   WCAG 2.2 baseline with sources.
3. Replaces `<div role="button">` with native `<button>` and cites the first
   rule of ARIA.
4. Specifies a dialog component with the full APG keyboard script (focus trap,
   Escape, restore focus) or selects a vetted primitive and names it.
5. Produces a token diff with version bump, changelog, and a contrast report
   for affected pairs.
6. Records axe-core as MPL-2.0+Exhibit B and pa11y as LGPL-3.0-only in the
   ledger before embedding.
7. Reports target sizes against a named authority (WCAG 24 px floor vs. Apple
   44 pt / Android 48 dp) without averaging them.
8. Blocks an external conformance statement while HUMAN-2 is undecided.
9. Stops at budget exhaustion with coverage-stated partial evidence.

### Interaction Prototyping & Evaluation Specialist (10 checks)

1. Labels a requested prototype with its Houde–Hill question and fidelity and
   refuses to answer a role question with a hi-fi comp.
2. Produces a heuristic finding list where every item names a heuristic,
   evidence, and severity — and declines to call it user evidence.
3. Computes a KLM prediction for a two-step expert flow and reports the
   measured-vs-predicted delta with operator assumptions.
4. Chooses a bar/dot encoding over pie for a precise-comparison requirement and
   cites the perception evidence.
5. Specifies a drawer transition with duration/easing plus a reduced-motion
   fade fallback that keeps feedback semantics.
6. Runs a 7GUIs CRUD-style implementation with full keyboard + undo/focus
   restoration and reports success/error metrics.
7. Refuses to run participants without the research lead's HUMAN-1 artifacts.
8. Extends a RealWorld shared E2E suite with role-locator and tab-order checks
   and runs it against two stacks, reporting behavior deltas.
9. Catches a target-size spec that mixes 24 px/44 pt/48 dp and re-states it
   against one named authority.
10. Stops at budget exhaustion with stated coverage.

## Role mapping (no role inflation)

The three charters are **delegation contexts of a single existing role
candidate** — `product-designer-ux-researcher` (the documented taxonomy gap in
the workspace `role_resource_matrix_seed.json` `new_role_candidates`; ONE
combined charter: design craft + research methods). They do **not** mint new
standing roles. Split triggers belong to org design, not this skill:

- dedicated researcher when research cadence exceeds ~2 studies/month sustained;
- dedicated design-systems seat when >2 products consume one system.

Existing standing roles the contexts compose with (hand off, never absorb):

| Boundary | Existing role |
|---|---|
| Production frontend implementation | `frontend-engineer`, `mobile-engineer` |
| Game UI/UX and games user research | `game-ui-ux-designer`, `player-games-user-researcher` |
| Spatial/3D & XR production | `3d-ui-ux-spatial-interaction-designer` (+ `spatial-3d-production-engineering` skill) |
| Product strategy | `product-manager` |
| Analytics/experimentation | `data-scientist` |
| Content/microcopy | `technical-writer-documentation-engineer` |
| Brand | `brand-communications-designer` |
| Behavioral research overlap | `product-psychology-behavioral-design-lead`, `behavioral-research-psychologist` |
| Regression/QA | `qa-analyst-quality-engineer` |
| Wizard-of-Oz AI simulation | `ai-llm-application-engineer` |
| Legal/privacy gates | `legal-policy-compliance-specialist`, `privacy-engineer` |

Charter focus-to-resource mapping lives in the bundled
[ui_ux_role_resources.json](ui_ux_role_resources.json)
(`agent_charter_resource_focus`): core/internal/conditional resource lists per
charter, evidence-tiered (E1–E3).
