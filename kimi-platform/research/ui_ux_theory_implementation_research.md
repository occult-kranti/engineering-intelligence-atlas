# UI/UX Theory & Implementation Research

**Purpose:** Foundational theory + verified implementation evidence for a dedicated UI/UX specialist capability: three agent charters (`product-ux-research-lead`, `design-systems-accessibility-engineer`, `interaction-prototyping-evaluation-specialist`), one proposed shared skill (`ui-ux-research-design-engineering`), and the proposed non-game role `product-designer-ux-researcher`.

**Point-in-time verification:** All status claims (spec maturity, versions, licenses, legal deadlines) were verified **2026-11-20** against primary sources (w3.org/TR pages, GitHub API, regulator publications). Standards and repos drift; re-verify before relying on any status claim after this date.

**Method:** (1) authoritative literature and standards review; (2) read-only inspection of implementation repositories via the GitHub API (no code executed) — license, lifecycle, structure, and implementation lessons; (3) synthesis into charters and a resource matrix. Companion files: `ui_ux_repo_cases.json` (per-repo detail), `ui_ux_role_resources.json` (resource mapping in the project's `role_resource_matrix_seed.json` schema).

---

## 1. Executive summary — what is verifiably true today

| Claim | Status verified 2026-11-20 | Primary source |
|---|---|---|
| **WCAG 2.2** is the current W3C accessibility standard; conformance target is Level A+AA | W3C Recommendation 2023-10-05; also published as **ISO/IEC 40500:2025** | [w3.org/TR/WCAG22](https://www.w3.org/TR/WCAG22/) |
| **WCAG 3.0** is a Working Draft (latest 2026-09-10) — **not certifiable**: no law, procurement rule, or conformance claim may reference it; Recommendation not expected before ~2028–2029; will coexist with, not replace, WCAG 2.x. The enforceable/certifiable baseline is **WCAG 2.2 (A+AA)** | Working Draft | [w3.org/TR/wcag-3.0](https://www.w3.org/TR/wcag-3.0/) |
| **WAI-ARIA 1.2** is the current Recommendation (2023-06); **ARIA 1.3** is a Working Draft (latest 2026-06-04) adding `suggestion`/`comment`/`mark` roles, `aria-description`, braille attributes, `aria-notify` | Rec vs WD | [w3.org/TR/wai-aria-1.2](https://www.w3.org/TR/wai-aria-1.2/), [w3.org/TR/wai-aria-1.3](https://www.w3.org/TR/wai-aria-1.3/) |
| **APG** (ARIA Authoring Practices Guide) is the pattern/keyboard-interaction companion; its example code demonstrates the spec and must be re-tested with real assistive technology | W3C note-track guide, continuously updated | [w3.org/WAI/ARIA/apg](https://www.w3.org/WAI/ARIA/apg/) |
| **Design Tokens (DTCG) 2025.10** — first stable token format (Format, Color, Resolver modules), 2025-10-28. A W3C Community Group Final Report, **not** a W3C standard | Stable CG report | [designtokens.org/TR/2025.10](https://www.designtokens.org/TR/2025.10/) |
| **APCA** contrast is **not** normative anywhere: removed from the WCAG 3 draft (2023-07) for further evaluation; WCAG 2.x's 4.5:1 / 3:1 ratios remain the only legally referenced contrast rules | Exploratory | [WCAG 3 draft](https://www.w3.org/TR/wcag-3.0/) |
| Legal landscape: EU **European Accessibility Act** applies since 2025-06-28; **ETSI EN 301 549 V4.1.1 (2026-09)** incorporates WCAG 2.2, while legal presumption of conformity depends on the applicable harmonized-standard citation. US **ADA Title II** requires WCAG 2.1 AA (deadlines 2027/2028, extended by 2026 interim rule); **Section 508** still WCAG 2.0 AA | In force; verify jurisdiction and cited standard at decision time | [W3C WAI policies](https://www.w3.org/WAI/policies/), [ETSI EN 301 549 V4.1.1](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf) |
| Automated tools cover only a subset of accessibility barriers; manual keyboard + screen-reader testing remains mandatory | Engineering limitation; do not convert tool coverage into a conformance claim | [WebAIM Million](https://webaim.org/projects/million/) demonstrates detected-error prevalence, not total tool coverage |
| **WebAIM Million 2025**: 94.8% of top-1M home pages have detectable WCAG failures; low contrast (79.1%) tops the list; pages **with** ARIA average *more* errors (59.1) than without (42) — ARIA is not self-executing | Annual survey | [webaim.org/projects/million](https://webaim.org/projects/million/) |
| **WebXR Device API** is a Candidate Recommendation Draft (latest 2026-06-09), not a Recommendation; modules (AR, hit-test, hand input, anchors, DOM overlays) at WD/CR stages | CRD | [w3.org/TR/webxr](https://www.w3.org/TR/webxr/) |
| Dark patterns are now enforceable law: **DSA Art. 25** (applies 2024-02-17), **EDPB Guidelines 03/2022**, **FTC "Bringing Dark Patterns to Light" (2022-09)**, Amazon Prime $2.5B settlement (2025-09), India CCPA 13 banned patterns (2023) | In force | [FTC report](https://www.ftc.gov/reports/bringing-dark-patterns-light), [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj) |

**Design implication for the charters:** UI/UX claims are checkable. Contrast ratios, target sizes, keyboard operability, SUS percentiles, tree-test success rates, and spec maturity are all measurable — the specialist agents must produce *evidence artifacts*, not opinions, and must label the evidence tier of every claim (standard / replicated experiment / vendor-reported / heuristic judgment).

---

## 2. HCI & interaction-design foundations

### 2.1 The canonical corpus (what to actually read, in order)

1. **Don Norman, _The Design of Everyday Things_ (1988; revised 2013)** — the vocabulary every design review uses: **affordances vs. signifiers** (an affordance is a relationship between object and agent; a signifier is the perceivable cue that communicates it — most "affordance problems" are signifier problems), **mapping** (control↔effect spatial correspondence), **feedback** (immediate, informative, non-punishing), **constraints** (physical/cultural/semantic/logical), **conceptual models** (the system image must let users build a workable mental model), **discoverability**, and the **gulfs of execution and evaluation** (from Norman's 1986 _User Centered System Design_ with Draper). Design errors: Norman distinguishes **slips** (right goal, wrong execution — prevent with constraints and confirmation-free undo) from **mistakes** (wrong goal — prevent with better information at decision points). Source: [jnd.org](https://jnd.org/the-design-of-everyday-things-revised-and-expanded-edition/).
2. **Jakob Nielsen, _10 Usability Heuristics_ (1994, updated 2024-01-30)** — visibility of system status; match system to real world; user control & freedom; consistency & standards; error prevention; recognition rather than recall; flexibility & efficiency; aesthetic & minimalist design; error recovery; help & documentation. These are *heuristics for inspection*, not conformance criteria: a finding must name the step, the evidence, and the expected change. [nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/) (verified 2026-11-20).
3. **Ben Shneiderman, _Designing the User Interface_ (6th ed. 2016) and the _Eight Golden Rules_** — strive for consistency; seek universal usability; offer informative feedback; design dialogs to yield closure; prevent errors; permit easy reversal; keep users in control (internal locus); reduce short-term memory load. Plus **direct manipulation** (visibility of objects, rapid/reversible/incremental actions, replacement of typed commands) and his later **information-visualization mantra**: *overview first, zoom and filter, then details on demand*.
4. **Card, Moran & Newell, _The Psychology of Human-Computer Interaction_ (1983)** — GOMS and the **Keystroke-Level Model**: predict expert execution time as sums of primitive operators (K keystroke ≈ 0.2s, P pointing ≈ 1.1s, H homing ≈ 0.4s, M mental ≈ 1.35s, R system response). Useful for comparing designs analytically *before* any user test; blind to learning, errors, readability, and non-routine tasks.
5. **Steve Krug, _Don't Make Me Think_ (3rd ed.)** — the operative rules: users **satisfice** (first plausible option, not optimal), **scan** (F-pattern-ish skimming of headings/links, not reading), and **muddle through** without building accurate models. Consequences: self-evident > self-explanatory > documented; every unnecessary word and choice costs navigation signal.
6. **Jenny Preece / Yvonne Rogers / Helen Sharp, _Interaction Design: Beyond Human-Computer Interaction_ (5th ed. 2019)** — the process spine: establish requirements → design alternatives → prototype → evaluate; usability goals (effectiveness, efficiency, safety, utility, learnability, memorability) vs. UX goals (satisfying, motivating, trust…).

### 2.2 Quantitative laws — real, replicated, but scoped

- **Fitts's Law (1954)**: movement time `MT = a + b·log2(1 + D/W)` (Shannon formulation, MacKenzie 1992). Among the most robust quantitative laws in HCI; on-screen pointing replication solid. *Design use:* make frequent targets large and near the expected pointer position; edges/corners have "infinite width" (screen-edge toolbars); pop-up menus near the cursor. *Limit:* it models the tap, not the intent — "bigger button" does not guarantee conversion.
- **Hick–Hyman Law (1952/1953)**: decision time `T = a + b·log2(n+1)` for *equally likely, unordered* choices. Fails for practiced users and alphabetically/semantically ordered menus — best treated as a novice-performance model. *Design use:* reduce competing options at decision points; chunk menus; put the common case first.
- **Steering Law (Accot & Zhai, CHI 1997)**: time through a constrained tunnel is linear in ∫(1/W)ds — generalizes Fitts to trajectory tasks (dropdown navigation, scrollbar dragging, drawing).
- **Power Law of Practice (Newell & Rosenbloom 1981)**: task time improves as a power function of practice — quantitative basis for learnability claims and for why expert shortcuts (accelerators) pay off.
- **Miller 7±2 (1956) vs. Cowan 4±1 (2001)**: working memory for *novel, unrelated* elements is ~4 chunks when rehearsal/chunking is controlled; Peterson & Peterson (1959) showed unrehearsed traces decay below 10% within ~18 s. *Design use:* never require users to hold state across screens (Nielsen #6: recognition over recall); chunk and externalize; dashboards that exceed ~4 simultaneously-compared metrics need grouping/progressive disclosure.

### 2.3 Cognitive load theory (Sweller, 1988–2019)

Three loads: **intrinsic** (element interactivity of the material), **extraneous** (load created by the presentation — the designer's fault), **germane** (productive schema-building). Evidence-based effects with direct UI consequences:

- **Split-attention effect** → physically integrate labels into diagrams/forms (in-field or top-aligned labels beat distant legends).
- **Redundancy effect** → don't narrate what's already readable on screen; remove duplicate channels.
- **Modality effect** → pairing visual + auditory can expand effective capacity (voice guidance during visual tasks) — but doubles accessibility obligations.
- **Expertise reversal effect** → guidance that helps novices harms experts; justify adaptive/progressive UIs and Nielsen #7 (flexibility & efficiency).

### 2.4 Gestalt & perception

Wertheimer/Koffka/Köhler grouping principles — proximity, similarity, closure, continuity, common region, common fate — are the operating system of visual hierarchy: grouping is communicated by **spacing and enclosure before color or borders**. Stephen Few and Colin Ware (_Information Visualization: Perception for Design_, 4th ed. 2021) ground this in visual system evidence: **preattentive attributes** (color, orientation, size, motion) are detected in <200–250 ms in parallel — use them for exactly one "most important thing" per view, because two preattentive signals compete. Related failure evidence: **change blindness** and **inattentional blindness** (Simons & Chabris 1999) — users literally do not see banners/modals they weren't attending to; don't rely on peripheral visual change to announce critical state.

---

## 3. Usability & UX research methods

### 3.1 Definitions and standards

- **ISO 9241-11:2018**: usability = extent to which specified users achieve specified goals with **effectiveness, efficiency, and satisfaction** in a specified context of use. Any usability claim without the user/goal/context triplet is undefined.
- **ISO 9241-210:2019** (human-centred design): understand context → specify requirements → produce design solutions → evaluate against requirements, iterated; explicitly requires *involving users throughout*.
- **UX vs. usability vs. accessibility** (W3C WAI): accessibility is a *prerequisite attribute* (can people with disabilities use it at all), usability is effectiveness/efficiency/satisfaction *for the target population*, UX is the whole experience arc. They overlap but are not interchangeable; WAI's "Accessibility, Usability, and Inclusion" note is the canonical framing.

### 3.2 Method selection (what each method can and cannot prove)

| Method | Evidence type | What it proves | What it can't |
|---|---|---|---|
| **Moderated think-aloud test (qual)** | Behavioral + verbal | *Where and why* a design fails on real tasks | Prevalence, magnitude, preference |
| **Unmoderated remote test** | Behavioral | Task success/time at larger n, geographic spread | Why; probing; accessibility-tool usage |
| **Heuristic evaluation** (Nielsen & Molich 1990; 3–5 evaluators) | Expert judgment | Likely problems cheaply, pre-users | Real severity, real-user truth (false positives are inherent) |
| **Cognitive walkthrough** | Expert judgment | Learnability of task sequences | Efficiency/expert use |
| **Card sorting** (open/closed) | Mental models | How users group and label content | Whether a finished structure works |
| **Tree testing** (Spencer; Optimal Workshop, ~2010) | Behavioral | Findability within a text-only structure (success/directness/time); isolates IA from visual design | Anything visual or interactive |
| **First-click testing** | Behavioral | Whether the entry point is right (correct first click strongly predicts success) | Full journey |
| **A/B test** | Causal (on the metric) | Which variant moves a pre-registered metric | Why; long-run/brand effects; novelty effects |
| **Analytics/funnel & search logs** | Behavioral, at scale | What people actually do; what they can't find (search terms) | Intent; satisfaction |
| **Diary studies, contextual inquiry, interviews** | Attitudinal/contextual | Needs, vocabulary, environment | Observable performance |

Selection heuristic (NN/g "Which UX Research Methods", verified 2026-11-20): position the question on **attitudinal↔behavioral** and **qualitative↔quantitative** axes and the product phase (discover → explore → test → listen); never use a qualitative study to estimate magnitude, and never use analytics to explain motivation.

**Source-currency warning (verified 2026-11-20):** usability.gov is **archived** (content frozen; maintained only as a static archive by HHS) — do not cite it as live guidance; prefer W3C WAI resources, NN/g, and Digital.gov. Likewise, the RealWorld demo-app project moved from `gothinkster/realworld` to the canonical `realworld-apps/realworld` — always re-resolve canonical repo identity before citing or cloning (pin URL + commit SHA).

### 3.3 Metrics that are safe to quote

- **Task success rate** (with completion criteria defined *before* the session), time-on-task, error counts — the ISO 9241-11 operationalization.
- **SUS (System Usability Scale)** — primary source: **Brooke, J. (1996), "SUS: A 'quick and dirty' usability scale," in Jordan, Thomas, McClelland & Weerdmeester (eds.), _Usability Evaluation in Industry_, Taylor & Francis, pp. 189–194** (written 1986 at Digital Equipment Corp.; 1996 chapter is the canonical citation). 10 items, ×2.5 → 0–100. **The mean across ~500 studies is 68 (SD 12.5)**; 68 = 50th percentile, not "68%". Curved grading (Sauro & Lewis): ≥80.3 ≈ A, 68 ≈ C. Common errors: administering mid-task; reporting as a percentage; unvalidated translations (drift up to ~8 points); comparing pre/post without controlling cohort composition.
- **UMUX-LITE** — primary source: **Lewis, J. R., Utesch, B. S., & Maher, D. E. (2013), "UMUX-LITE: When there's no time for the SUS," Proc. CHI 2013, pp. 2099–2102** — the 2-item short form; use it rather than dropping SUS items ad hoc.
- **NASA-TLX** — primary source: **Hart, S. G., & Staveland, L. E. (1988), "Development of NASA-TLX," in Hancock & Meshkati (eds.), _Human Mental Workload_, pp. 139–183** (see also Hart 2006) — 6-dimension workload instrument for comparing interface variants (unweighted "Raw TLX" is acceptable and common).
- **SEQ (Single Ease Question)** per task; **NPS** only as a loyalty metric, never as usability evidence.
- **Accessibility conformance**: report per-criterion WCAG results (A/AA), the test method (automated rule set + version, manual checks, AT used), and residual known failures — an "accessibility score" without criterion granularity is not conformance evidence.

### 3.4 The "5 users" claim, scoped honestly

Nielsen & Landauer (1993): with problem probability p≈0.31 per user, 5 users find ~85% of *usability problems in one design iteration of one homogeneous user group*. It is an argument for **many small iterative tests**, not for tiny total evidence: it does not apply to quantifying prevalence, to heterogeneous populations (each distinct segment needs its own ~5), or to accessibility (a session without screen-reader users finds zero screen-reader problems). Molich's CUE studies showed even professional teams find overlapping but far-from-identical problem sets — heuristic findings need corroboration before severity claims.

---

## 4. Accessibility: the W3C stack as engineering infrastructure

### 4.1 The normative stack (status verified 2026-11-20)

- **Baseline rule:** WCAG 2.2 Level A+AA is the only certifiable/enforceable target today; WCAG 3.0 remains a Working Draft (2026-09-10) and must never appear in conformance claims, audit verdicts, contracts, or remediation commitments.
- **WCAG 2.2** (W3C Recommendation 2023-10-05; ISO/IEC 40500:2025): POUR principles — Perceivable, Operable, Understandable, Robust. Adds 9 criteria over 2.1 (2.4.11 Focus Not Obscured, 2.4.12/13 enhanced focus, 2.5.7 Dragging Movements, 2.5.8 Target Size Minimum 24×24 CSS px, 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication); retires 4.1.1 Parsing. Conformance is by **success criterion and level**, with documented **exceptions** (e.g., 2.5.8's spacing/equivalent/inline/user-agent/essential exceptions).
- **Understanding WCAG** and **Techniques** are informative: techniques are sufficient *ways* to meet criteria, not requirements.
- **WAI-ARIA 1.2** (Rec 2023-06) + **ARIA in HTML** (Rec): rules for roles/states/properties; **the first rule of ARIA is "don't use ARIA"** where a native HTML element carries the semantics (a `<button>` beats `<div role="button" tabindex="0">` — the native element ships focusability, key handling, and AT mappings for free). ARIA 1.3 (WD 2026-06-04) is *not* production-citable yet.
- **APG**: per-pattern role structure, states/properties, and — critically — **expected keyboard interaction** (arrow-key movement, Home/End, Enter/Space activation, Escape dismissal, roving tabindex). ARIA adds semantics but **zero keyboard behavior**; keyboard logic is the author's job and the most common failure.
- **Core-AAM / AccName 1.2**: how roles/names map to platform accessibility APIs and how accessible names are computed (the algorithm that decides what a screen reader announces; explains why `aria-label` overrides content and why empty `alt` differs from missing `alt`).
- **ARRM** (Accessibility Roles and Responsibilities Mapping): decomposes WCAG into role-level checkpoints (designer owns color-not-alone and focus order intent; developer owns name/role/value; content owns plain language) — the governance bridge between design and engineering.
- **ATAG 2.0 / UAAG 2.0**: authoring tools and user agents — relevant when shipping CMSs, design tools, or white-label editors (Penpot case, §16).
- **WCAG2ICT / WCAG2Mobile**: applying WCAG beyond web documents — native apps map the same criteria (24×24 CSS px ↔ platform units).

### 4.2 What the evidence says about real-world accessibility

- WebAIM Million 2025: 94.8% of homepages fail detectable WCAG checks; the six recurring failure classes (low contrast, missing alt text, empty links/buttons, missing form labels, missing document language) have been stable for years — a **checklist and CI problem**, not a knowledge problem.
- Sites using ARIA average *more* detected errors than sites without: mis-implemented custom widgets are worse than native HTML. Lesson: adopt **headless primitive libraries that encode APG behavior** (Radix, React Aria, Ariakit — §16) instead of hand-rolling.
- Automated engines (axe-core) cover the mechanically testable subset of accessibility barriers; logical reading order, meaningful alt text, error-message quality, focus management in dynamic flows, and AT behavior require manual testing with keyboard + at least one real screen reader (NVDA/JAWS/VoiceOver) per platform. Do not attach a universal percentage to tool coverage: it varies by rule set, page, and counting method.
- **Contrast**: WCAG 2.x requires 4.5:1 (normal text), 3:1 (large text ≥18pt/14pt bold), 3:1 for UI components and graphical objects (1.4.11). APCA is a candidate research model only — using APCA to *pass* colors that fail 4.5:1 invites scanner-driven legal findings; using it as an additional readability lens on already-passing palettes is legitimate.

### 4.3 Legal map (point-in-time, 2026-11-20)

EU: **EAA (Directive 2019/882)** applies since 2025-06-28 to e-commerce, banking, e-books, ticketing, terminals. **ETSI EN 301 549 V4.1.1 (2026-09)** now incorporates WCAG 2.2 across web, non-web documents, and software ([official standard](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf)); publication by ETSI must not be conflated with a jurisdiction's harmonized-standard citation or presumption of conformity, which must be checked at decision time. US: **ADA Title II** rule (28 CFR Part 35) → WCAG 2.1 AA, deadlines 2027-04-26 / 2028-04-26 after the 2026 extension; **Section 508** → WCAG 2.0 AA; Title III case-by-case with WCAG as de facto benchmark. UK PSBAR 2018 (public sector). Procurement practice: require a **VPAT/ACR** (ITI VPAT 2.5) dated <12 months and WCAG 2.2 AA as the contract target regardless of the pinned statutory version.

---

## 5. Visual design: hierarchy, typography, color

- **Hierarchy is structure made visible**: size → weight → color → position, in that order of perceptual force; one dominant element per view. The F/Z scanning patterns are consequences of hierarchy quality, not design templates.
- **Typography** (Bringhurst, _The Elements of Typographic Style_; Lupton, _Thinking with Type_): body text 45–75 characters per line (~66 ideal); line-height ~1.4–1.6 for body; establish a **modular scale** (e.g., 1.125–1.333 ratio) instead of ad-hoc sizes; left-align for LTR readability, justify only with hyphenation; minimum practical UI text ~16px for comfortable reading (USWDS guidance), honoring user zoom (WCAG 1.4.4 resize to 200%, 1.4.10 reflow at 320 CSS px width).
- **Color**: encode meaning redundantly — never color alone (WCAG 1.4.1; ~4.5% of people have some color-vision deficiency). Use perceptually uniform spaces (**OKLCH**, CSS Color 4) for palette generation so equal steps are equal perceived steps; keep hue for categories, luminance for magnitude. Maintain the **4.5:1/3:1** ratios at the *token* level (§8) so conformance is inherited.
- **Grids & spacing**: 4/8-pt spacing systems create the rhythm Gestalt proximity needs; density is a contextual variable (data-dense expert tools vs. consumer flows), not a taste.

## 6. Information architecture

Rosenfeld, Morville & Arango (_Information Architecture: For the Web and Beyond_, 4th ed. 2015 — the "polar bear book"): four systems — **organization** (hierarchies, facets, audience/task schemes), **labeling** (user vocabulary, not org-chart names), **navigation** (global/local/contextual, breadcrumbs as supplemental), **search** (zones, logs as IA feedback). Dan Brown's 8 principles (2010) add: objects, choices, disclosure, exemplars, front doors, multiple classification, focused navigation, growth. **Method pair:** card sorting (generative) → tree testing (evaluative, text-only, ≥30 participants for quant) → first-click testing; target tree-test success >70–80% on core tasks before build. IA failure signature: high search usage for content that should be browsable, plus "Where am I?" support contacts.

## 7. Design systems & design tokens

- **A design system is a product**: principles + tokens + components + patterns + documentation + governance (contribution model, versioning, deprecation policy). Brad Frost's **Atomic Design** (atoms→molecules→organisms→templates→pages) is a naming convention for composition depth, not an architecture mandate.
- **Design tokens = design decisions as data.** The W3C **DTCG 2025.10** format (stable 2025-10-28; Community Group report, *not* a W3C standard) defines `$value`/`$type`/`$description`, groups, `{alias}` references, and resolver-based theming; reference implementations: Style Dictionary (Apache-2.0), Tokens Studio, Terrazzo; supported by Figma (native variable import/export since late 2025), Penpot, Sketch, Framer, zeroheight. Use **three tiers**: primitive (raw `indigo-700`) → semantic (intent: `color.text.primary`) → component (`button.primary.background`); consumers reference semantic/component tiers so theming (dark mode, brand, high-contrast) is an alias swap.
- **Accessibility belongs in the token layer**: contrast-checked pairs as token pairs, focus-ring tokens, motion-duration tokens with a reduced-motion scale, minimum-target-size tokens per platform authority (§9). Fixes made here are inherited by every component; fixes made per-screen are regression debt.
- **Headless/unstyled primitive pattern** (Radix, React Aria, Ariakit): behavior, ARIA, keyboard, focus management, and i18n are packaged *without* visuals, letting teams apply their own tokens/CSS — the dominant 2020s solution to the WebAIM finding that hand-rolled ARIA widgets fail more than native HTML.

## 8. Responsive & mobile

- Ethan Marcotte's **responsive web design** (2010: fluid grids, flexible images, media queries) → mobile-first content prioritization; Luke Wroblewski's **Mobile First** (2011). Modern practice: **content-out breakpoints**, container queries for components, intrinsic layouts (flex/grid) over device-named breakpoints.
- **Touch targets — three authorities, three numbers (do not average):** WCAG 2.2 SC **2.5.8**: 24×24 CSS px at AA with five exceptions (spacing via 24-px circle test, equivalent control, inline, user-agent, essential); SC **2.5.5** (AAA): 44×44. Apple HIG: **44×44 pt** default (28×28 minimum on iOS). Android/Material: **48×48 dp** recommended with 8 dp separation. 44 pt ≈ 7.3 mm and 48 dp ≈ 7.6 mm — platform numbers are finger-sized; WCAG's 24 is a legal floor, ~⅓ of an adult fingertip (avg. pad 16–20 mm). Design-system guidance: commit to a named authority per surface and record it; hit area ≠ visible icon (pad via pseudo-elements).
- **One-handed/thumb ergonomics** (Steven Hoober's research: ~49% hold one-handed, thumb sweep arcs); destructive/primary actions out of the accidental-tap zone; gesture discoverability problem — gestures need visible affordances or onboarding (and every path gesture needs a single-pointer alternative per WCAG 2.5.1/2.5.7).
- **Performance is UX**: Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1) as the user-perceived performance contract; Nielsen's classic response-time limits (0.1s instant / 1s uninterrupted flow / 10s attention boundary) still frame feedback design.

## 9. Data visualization

- **Cleveland & McGill (JASA 1984)** ranked elementary perceptual tasks by judged accuracy: position on a common scale > position on non-aligned scales > length/direction/angle > area > volume/curvature > shading/saturation. **Heer & Bostock (CHI 2010)** crowdsourced-replicated the ranking for web charts and added: gridlines improve accuracy (keep ≥~8px apart); accuracy gains saturate beyond ~80px chart height; 1:1-aspect rectangles are the worst area encodings (viewers proxy side length). Consequences: dot/bar charts beat pies for precise comparison; stacked bars make only the baseline segment comparable; label values on area encodings; hue is a *categorical* channel (no perceptual quantity order).
- **Munzner (_Visualization Analysis & Design_, 2014; nested model, TVCG 2009)**: four levels — domain situation (threat: *wrong problem*), data/task abstraction (*wrong abstraction*), encoding/interaction idiom (*wrong idiom*), algorithm (*wrong algorithm*) — each with matched validation (interviews/observation → abstraction justification → perceptual justification + lab studies → timing benchmarks → field/adoption). **The governing rule for any viz claim: evidence must match the level of the claim** — a fast renderer says nothing about whether the encoding answers the user's question.
- **Tufte**: maximize data-ink, remove chartjunk (but "ink" is a heuristic — Bateman 2010 showed modest embellishment can aid memorability); high-density small multiples for comparison. **Stephen Few**: dashboards answer monitoring questions at a glance — sparklines, bullet graphs, alert thresholds with stated semantics.
- **Accessible visualization**: text equivalents and data tables as the semantic layer; don't encode in color alone (patterns/shapes/labels); keyboard-navigable data points or a sibling table; summaries that state the *finding*, not just the structure ("revenue fell 12% in Q3", not "bar chart of revenue"); honor `prefers-reduced-motion` in animated transitions; test with screen readers — SVG `<title>`/`<desc>` and role|img are the minimum.

## 10. Motion & animation

- Motion earns its place when it answers: *where did this come from / where did it go* (spatial continuity), *did it work* (feedback), *what can I do* (affordance hint). 200–500 ms for UI transitions (Material's easing/duration guidance); ease-out for entrances, ease-in for exits; animate `transform`/`opacity` (compositor-friendly).
- **Accessibility contract (verified):** WCAG **2.2.2 Pause, Stop, Hide** (A) — auto-moving content >5s needs a control; **2.3.1 Three Flashes** (A) — seizure safety, never optional; **2.3.3 Animation from Interactions** (AAA) — interaction-triggered motion disableable unless essential; mechanism: `prefers-reduced-motion` media query (Baseline since 2020) + a visible site-level toggle (users who need it don't all know the OS setting). **Reduce ≠ remove**: replace travel/parallax/scale with fades; keep feedback semantics. JS-driven animation (GSAP/Framer Motion/canvas) is invisible to CSS-only guards — check `matchMedia('(prefers-reduced-motion: reduce)')` in code paths.
- Vestibular evidence: ~35% of US adults ≥40 have measurable vestibular dysfunction (NHANES 2001–2004 data) — this is a large minority, not an edge case.

## 11. Prototyping

- **Houde & Hill (1997), "What do Prototypes Prototype?"**: prototypes answer three separable questions — **role** (what is this for in users' lives), **look & feel** (sensory experience), **implementation** (how does it work). Declare which question a prototype answers before building it; a pixel-perfect comp cannot answer the role question and a clickable wireframe cannot answer look-&-feel.
- **Fidelity as a variable, not a virtue**: low-fidelity (paper/Balsamiq-style) maximizes change willingness and keeps feedback structural (people critique flow, not kerning); high-fidelity needed for visual/motion/fine-interaction evaluation and stakeholder sign-off. **Wizard of Oz** prototypes (human simulates the system) test AI/voice/service concepts before building capability. Parallel prototyping (multiple divergent alternatives) beats serial refinement on quality metrics (Dow et al. 2010).
- Prototype evaluation must record: the question, the fidelity, what was learned, and what changed — otherwise it's demo theater.

## 12. Ethics, dark patterns, privacy

- **Taxonomy lineage**: Brignull (2010, darkpatterns.org → deceptive.design, _Deceptive Patterns_ 2023); Gray et al. CHI 2018 (five categories from practitioner data) and the **2024 unified ontology** harmonizing academic + regulatory taxonomies; Mathur et al. CSCW 2019 (crawl of ~11K shopping sites: 1,818 instances, 22 third-party dark-pattern providers — the practice is industrialized).
- **Regulatory mapping (verified 2026-11-20)**: DSA Art. 25 + Recital 67 (prohibits interface structures that distort autonomous choice; names nagging, hard-to-cancel, preselection); EDPB Guidelines 03/2022 (six categories for social platforms: overloading, skipping, stirring, obstructing, fickle, left-in-the-dark); FTC 2022 staff report (four categories; Section 5 enforcement); Amazon Prime **$2.5B settlement** (2025-09); FTC click-to-cancel rule finalized 2024-10, **vacated** by the 8th Circuit 2025-07, new rulemaking opened 2026-03; India CCPA 2023 bans 13 named patterns; EU Digital Fairness Act proposal expected Q4 2026.
- **Practical ethics gates for design work**: symmetry test (accept vs. reject path parity in steps, prominence, wording); privacy-protective defaults; no confirmshaming; no drip pricing; no fake scarcity/social proof; consent flows never optimized on conversion alone; experimentation review for consent/pricing/cancellation flows.
- **Research ethics** (the other half of UX ethics): informed consent, minimal data collection, secure storage, right to withdraw, fair compensation, IRB/ethics review where institutional; GDPR/CCPA obligations for research data; vulnerable-population care (children — COPPA/Age-Appropriate Design Code; older adults; cognitively impaired participants).

## 13. Inclusive design & older adults

- **Microsoft Inclusive Design** (Kat Holmes's team, 2016+; _Mismatch_ 2020): exclusion = design-created mismatch; three principles — **recognize exclusion, learn from diversity, solve for one and extend to many**; the **Persona Spectrum** maps permanent → temporary → situational versions of the same limitation (one arm / wrist injury / parent holding a baby) to size the population a fix serves. **Critique to carry** (e.g., Spillers 2025): the spectrum communicates scale, but a distracted driver does not "understand blindness" — permanent-disability expertise and lived experience remain the anchor; involve, don't simulate.
- **Older adults (W3C WAI-AGE project)**: literature review of 150+ studies found **information overload** the dominant barrier (page density, ads/motion, nonlinear hypertext, cross-site inconsistency); age-related vision (contrast, small text), motor (small targets, drag), and cognitive (working-memory-heavy flows, timeouts) needs are **substantially covered by WCAG** — designing to WCAG 2.2 AA plus generous targets, plain language, generous timeouts (or none), and *including older adults in research* is the evidence-backed package. See [w3.org/WAI/older-users](https://www.w3.org/WAI/older-users/).
- Inclusive ≠ accessible: accessibility is a measurable floor (WCAG); inclusive design asks who is *still* excluded after the floor (literacy, language, bandwidth, device age, cultural context, neurodivergence).

## 14. Spatial / 3D UI & XR (scoped relevance)

- **WebXR Device API**: Candidate Recommendation Draft (2026-06-09) — stable enough to build on, not a Recommendation; AR Module CR (2025-04-25), Hit-Test WD, Hand Input WD, Anchors/Layers/DOM Overlays/Depth/Lighting in progress; browser reality: Chromium (incl. Quest Browser) full; Safari visionOS-limited; Firefox none. Khronos **OpenXR** is the native counterpart.
- **Spatial UX principles**: 3D UI inherits 2D laws (Fitts in 3D pointing; depth perception is poor — don't require precise depth judgment) plus its own: **cybersickness** (vection mismatch; keep user-initiated locomotion, offer teleport + smooth options, maintain ≥72–90 fps, avoid forced camera motion), **comfort zones** (content ~0.5–10 m, avoid neck-strain vertical extents), **diegetic vs. spatial vs. 2D-anchored UI** choice, and the standing rule that **every immersive experience needs a 2D fallback** for accessibility and for the majority of users without headsets.
- Evidence discipline: XR usability findings are device- and context-sensitive; lab SUS for XR exists (plus simulator-sickness instruments like SSQ) but small samples dominate the literature — report device, locomotion mode, and sample with every claim.

---

## 15. Implementation repository cases (summary; full detail in `ui_ux_repo_cases.json`)

All inspected read-only via GitHub API on 2026-11-20. Lessons focus on what each repo *demonstrates*, license and lifecycle posture — not popularity.

| Repo | License (verified) | Lifecycle signal | What it demonstrates |
|---|---|---|---|
| [w3c/wcag](https://github.com/w3c/wcag) | W3C Document License (GitHub: NOASSERTION) | Active (push 2026-11-20) | Normative WCAG 2.x source: success criteria + guidelines in markup; the standard itself is a maintained repo |
| [w3c/aria](https://github.com/w3c/aria) | W3C Document License | Active | ARIA 1.3-in-progress source; spec change management in the open |
| [w3c/wai-aria-practices](https://github.com/w3c/wai-aria-practices) | W3C Software License | Active | APG source: patterns + example code + regression tests; demonstrates "pattern = roles + states + keyboard script + example" |
| [w3c/wai-website](https://github.com/w3c/wai-website) | W3C licenses (mixed) | Active | WAI resource production (ARRM, tutorials, older-users guidance) as docs-as-code |
| [design-tokens/community-group](https://github.com/design-tokens/community-group) | W3C CLA (spec text) | 2025.10 stable report | The token format spec itself; versioning by dated modules; format-first standardization |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | MIT (WorkOS) | Active | 59 single-responsibility packages: behavior (focus-scope, roving-focus, dismissable-layer, portal, presence) packaged separately from components — accessibility behaviors as composable primitives |
| [adobe/react-spectrum](https://github.com/adobe/react-spectrum) | Apache-2.0 | Very active (`react-aria-components@1.22.0`, 2026-10) | Three-layer architecture: `@react-aria` (behavior) / `@react-stately` (state) / `@react-spectrum` (styled) + `@internationalized` (i18n: dates/numbers/collation) — separation of behavior, state, presentation, and locale |
| [ariakit/ariakit](https://github.com/ariakit/ariakit) | MIT (per package.json) | Active (0.7.x components line) | Store-based headless components for React **and Solid**; framework-portable state stores |
| [floating-ui/floating-ui](https://github.com/floating-ui/floating-ui) | MIT | Active | The positioning layer problem solved once: `core` (platform-agnostic compute) → `dom` → framework bindings (react/vue/react-native); middleware pipeline (flip, shift, arrow, autoUpdate) |
| [storybookjs/storybook](https://github.com/storybookjs/storybook) | MIT | Very active (v10.6.8, 2026-11-20) | Component workshop as design-system infrastructure: stories as the unit of documentation, visual/interaction/a11y test target, and review artifact; a11y addon runs axe-core per story |
| [d3/d3](https://github.com/d3/d3) | ISC | Active (v7.9.2) | Visualization as *data joins + scales + selections*, not chart templates — maximal expressiveness, maximal author responsibility (accessibility is on you) |
| [apache/echarts](https://github.com/apache/echarts) | Apache-2.0 | Active (6.1.0, 2026-05) | Declarative chart option model + built-in `aria` decal/label support — batteries-included viz with an accessibility surface D3 lacks by default |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | Very active (v1.65.1, 2026-11) | Browser automation with locators that mirror ARIA roles (`getByRole`) — testing nudges toward accessible semantics; trace/screenshot evidence artifacts |
| [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | MPL-2.0 **+ Exhibit B** ("Incompatible With Secondary Licenses" — not combinable into GPL works) | Very active (v4.14.1, 2026-11-16) | 155 rule files + `checks` + `standards` data (aria-roles/attrs, html-elms): WCAG SCs compiled into executable checks with tagged rule→criterion mapping; designed for zero false positives on violations |
| [pa11y/pa11y](https://github.com/pa11y/pa11y) | LGPL-3.0-only | Active | CLI/CI-first scanning (HTML_CodeSniffer) + dashboard/webservice companions; the batch-runner complement to axe's embedded engine; license drives runner choice |
| [nvaccess/nvda](https://github.com/nvaccess/nvda) | GPL-2.0-or-later with two exceptions (per copying.txt) | Very active | The free Windows screen reader that anchors manual AT testing; proof that license truth lives in the repo file, not the API (GitHub: NOASSERTION) |
| [realworld-apps/realworld](https://github.com/realworld-apps/realworld) | MIT | Active | Canonical home of "RealWorld" (moved from gothinkster/realworld): one full-stack spec, many stacks, shared E2E expectations — stack-independent behavior verification |
| [mapbox/pixelmatch](https://github.com/mapbox/pixelmatch) + [garris/BackstopJS](https://github.com/garris/BackstopJS) | ISC / MIT | Active | Visual regression: perceptual pixel-diff primitive + scenario-matrix runner with human baseline approval — "looks broken" made measurable |
| [eugenkiss/7guis](https://github.com/eugenkiss/7guis) | None (all rights reserved — re-implement from task spec only) | Reference/complete | 7GUIs benchmark: seven tasks isolating interaction-state challenges (undo, validation, bidirectional flow) from framework noise |
| [penpot/penpot](https://github.com/penpot/penpot) | MPL-2.0 | Very active (2.19.3, 2026-11-18) | Open-source design & prototyping tool: Clojure/ClojureScript stack, SVG-native model, `render-wasm` renderer, plugins + MCP surfaces, self-hostable — design tooling as inspectable infrastructure |
| [alphagov/govuk-frontend](https://github.com/alphagov/govuk-frontend) | MIT | Active | Public-sector design system: Nunjucks components paired with research-backed service patterns (GOV.UK Service Manual); demonstrates pattern-level guidance ("ask for X", "check answers") over raw components |
| [a11yproject/a11yproject.com](https://github.com/a11yproject/a11yproject.com) | Apache-2.0 | Active | Community-maintained accessibility checklist + posts; demonstrates plain-language operationalization of WCAG for non-specialists |
| [style-dictionary/style-dictionary](https://github.com/style-dictionary/style-dictionary) (moved from amzn/) | Apache-2.0 | Active | Token build pipeline: DTCG JSON → platform outputs (CSS/Swift/Kotlin) via transforms; demonstrates tokens as compiled artifacts with a single source of truth |

**Cross-repo implementation lessons**

1. **Behavior is separable from presentation — and should be.** Radix (59 behavior-focused packages), React Aria (behavior/state/style/i18n layers), Floating UI (core→dom→framework): the teams that treat accessibility behavior, positioning, and i18n as *infrastructure layers* ship the fewest per-product a11y bugs.
2. **Keyboard and focus are the hard 20%.** The packages that exist only for focus (`focus-scope`, `roving-focus`, `focus-guards`, `dismissable-layer`) show where hand-rolled widgets fail; APG encodes the target behavior.
3. **Conformance is compilable.** axe-core's `lib/standards` maps WCAG criteria to data-driven checks; Storybook's a11y addon puts those checks in the component dev loop; Playwright's `getByRole` makes tests assert semantics. The pipeline: tokens → components → stories → axe + role-locator tests → release evidence.
4. **Licenses are permissive but not uniform**: MIT dominates libraries; Apache-2.0 adds patent grant (React Spectrum, ECharts, Playwright, Storybook's ecosystem); MPL-2.0 (axe-core, Penpot) is file-level copyleft — embedding is fine, *modifying the licensed files* triggers source disclosure for those files; W3C spec licenses permit implementation but read the Document license for excerpting spec text.
5. **Lifecycle ≠ stars**: check pushed-at (all above active as of 2026-11-20), release cadence, and governance (W3C WG, Apache podling, company-owned OSS, community forks like style-dictionary's org move).
6. **Penpot + DTCG + Style Dictionary** close the open-source design pipeline: open tool → open token format → open build → open components — a fully inspectable alternative to proprietary handoff.

---

## 16. Failure-mode taxonomy (feeds the charters' "must NOT do" sections)

1. **Opinion-as-evidence**: design verdicts without a named criterion, heuristic, study, or measurement.
2. **Spec-maturity smuggling**: citing WCAG 3.0, ARIA 1.3, or APCA as requirements (all draft/exploratory as of 2026-11-20); citing DTCG as "a W3C standard" (it's a CG report).
3. **Checklist theater**: reporting an axe/Lighthouse score as accessibility conformance; skipping keyboard + AT manual passes; testing only the happy path.
4. **Metric abuse**: SUS as a percentage; 5 users as population prevalence; A/B novelty effects as wins; analytics as motivation; NPS as usability.
5. **Dark-pattern drift**: conversion-optimizing consent/cancellation; asymmetric accept/reject paths; preselected invasive defaults — now legally actionable (DSA, FTC, EDPB, CCPA-India).
6. **Research-harm failures**: no consent/compensation records, PII in synthesis artifacts, testing vulnerable groups without safeguards.
7. **ARIA misuse**: custom widgets with roles but no keyboard script; `aria-label` overriding visible text inconsistently; believing ARIA adds behavior.
8. **Handoff ambiguity**: specs that mix the three target-size authorities; designs without focus/empty/error/loading/overflow states; unlabeled fidelity (a comp mistaken for a committed build).
9. **License/provenance errors**: treating MPL file-level copyleft as MIT; copying APG example code without re-testing (W3C itself warns examples demonstrate the spec, not production hardening); unverified "open source" claims for design assets/fonts/icons (font licenses are separate: OFL vs. proprietary).
10. **Scope smuggling**: an accessibility "audit" that silently becomes a remediation commitment; a prototype presented as production-ready.

---

## 17. Proposed role & skill architecture

### 17.1 Role: `product-designer-ux-researcher` (proposed, non-game)

The workspace's own gap analysis (`role_resource_matrix_seed.json`, `new_role_candidates`) already identifies this as **"MISSING STANDING ROLE — the only genuine taxonomy gap"**: the 109-role catalog has `game-ui-ux-designer` (role 64) and `player-games-user-researcher` (role 65) requiring engine/input fluency, and `frontend-engineer` (role 9) owning implementation, but **no non-game role owns product design or UX research**. Recommended form per the seed: ONE combined charter (design craft + research methods); split triggers — dedicated researcher when research cadence exceeds ~2 studies/month sustained; dedicated design-systems seat when >2 products consume one system. Draft charter fields (from seed): mission "Own problem framing, interaction quality, evidence of usability, and design coherence for non-game software"; outputs: flows/prototypes, design-system contributions, research plans and synthesis, accessibility annotations, decision briefs; interfaces: PM, frontend, engineering, data, marketing, accessibility (per W3C ARRM).

This research supports that proposal and decomposes the agentic side into **three specialist charters** (§17.2) sharing **one skill** (§17.3).

### 17.2 Three agent charters (delivered under `scientific-research-library/agents/`)

| Charter | Owns | Boundary (does NOT own) |
|---|---|---|
| `product-ux-research-lead` | Research strategy, study design, participant ethics, synthesis quality, evidence repository, usability metrics integrity | Visual design decisions, component code, analytics pipeline engineering |
| `design-systems-accessibility-engineer` | Tokens (DTCG), component/ARIA/APG correctness, WCAG conformance evidence, a11y CI (axe/Playwright), theming/RTL/i18n of the system | Product strategy, research participant management, brand |
| `interaction-prototyping-evaluation-specialist` | Flows, prototypes at declared fidelity, motion design + reduced-motion fallbacks, heuristic evaluation, moderated test execution, data-viz interaction, spatial/3D scoping | Research program governance, system-level token architecture, production frontend implementation |

Existing role slugs they interface with (workspace catalog): `product-manager`, `frontend-engineer`, `mobile-engineer`, `data-scientist`, `technical-writer-documentation-engineer`, `brand-communications-designer`, `product-psychology-behavioral-design-lead` (documented overlap pair with `behavioral-research-psychologist`), `game-ui-ux-designer`, `player-games-user-researcher`, `3d-ui-ux-spatial-interaction-designer`, `qa-analyst-quality-engineer`, `ai-llm-application-engineer`, `legal-policy-compliance-specialist`, `privacy-engineer`. Existing skills they compose with: `agent-research-director` (orchestration + collaboration protocol), `spatial-3d-production-engineering` (3D/XR boundary), `engineering-organization-architect` (role design), `ai-research-frontier` (literature freshness).

### 17.3 Proposed skill: `ui-ux-research-design-engineering`

```
ui-ux-research-design-engineering/
├── SKILL.md                      # frontmatter (name, description) + routing + workflow + gates
├── references/
│   ├── theory_foundations.md     # Norman/Nielsen/Shneiderman/GOMS; laws with scope limits
│   ├── cognitive_evidence.md     # Cowan/Sweller/Gestalt/preattentive; evidence tiers
│   ├── accessibility_engineering.md  # WCAG 2.2 SC map, ARIA/APG rules, ARRM split, AT test matrix
│   ├── research_methods_metrics.md   # method selection, SUS/UMUX-LITE/SEQ, tree/card protocols
│   ├── design_systems_tokens.md      # DTCG 2025.10, three-tier tokens, headless pattern, versioning
│   ├── visual_typography_color.md    # hierarchy, type scale, OKLCH, contrast rules
│   ├── dataviz_motion_spatial.md     # Cleveland-McGill, Munzner nested model, motion contract, WebXR scope
│   ├── ethics_dark_patterns.md       # Gray/Brignull/EDPB/FTC taxonomies, symmetry test, research ethics
│   └── repo_casebook.md              # distilled ui_ux_repo_cases.json lessons
├── scripts/
│   ├── contrast_check.py         # WCAG 2.x ratio math (4.5/3.0) — no APCA pass/fail
│   ├── target_size_check.py      # 2.5.8 circle-test + authority labeling (WCAG/Apple/Android)
│   ├── sus_score.py              # SUS/UMUX-LITE scoring with percentile + grading output
│   └── tree_test_analysis.py     # success/directness/time summaries
└── assets/
    ├── heuristic_evaluation_template.md
    ├── usability_test_plan_template.md
    ├── accessibility_audit_report_template.md
    └── research_consent_record_template.md
```

Frontmatter description (proposed): *"Plan, design, and evaluate user interfaces with evidence: UX research methods and metrics, WCAG 2.2/ARIA/APG accessibility engineering, design tokens and systems, visual hierarchy, prototyping at declared fidelity, motion with reduced-motion fallbacks, data-viz perception, dark-pattern and research ethics gates. Use for product design, UX research, design-system and accessibility work in non-game software. Does not present draft standards (WCAG 3.0, ARIA 1.3, APCA) as requirements, automated scores as conformance, or opinions as user evidence."*

---

## 18. Verification log (selected primary sources)

| Source | What it anchors | Verified |
|---|---|---|
| w3.org/TR/WCAG22 | WCAG 2.2 Recommendation, criteria, exceptions | 2026-11-20 |
| w3.org/TR/wcag-3.0 | WCAG 3.0 Working Draft status (2026-09-10) | 2026-11-20 |
| w3.org/TR/wai-aria-1.2, /wai-aria-1.3 | ARIA Rec vs WD | 2026-11-20 |
| w3.org/WAI/ARIA/apg | APG patterns + keyboard expectations + testing caveat | 2026-11-20 |
| w3.org/WAI/planning/arrm | Role↔WCAG responsibility mapping | 2026-11-20 |
| w3.org/WAI/older-users | WAI-AGE older-user findings | 2026-11-20 |
| w3.org/community/design-tokens + designtokens.org/TR/2025.10 | DTCG 2025.10 stable, CG-report status | 2026-11-20 |
| w3.org/TR/webxr | WebXR CRD 2026-06-09 | 2026-11-20 |
| webaim.org/projects/million | 2025 failure stats, ARIA-error correlation | 2026-11-20 |
| nngroup.com/articles/ten-usability-heuristics | Heuristics (1994/2024) | 2026-11-20 |
| GitHub API repos (§15) | licenses, release tags, structures, pushed-at | 2026-11-20 |
| FTC "Bringing Dark Patterns to Light" (2022); DSA Reg. 2022/2065 Art. 25; EDPB Guidelines 03/2022 | Dark-pattern law/taxonomy | 2026-11-20 |
| ISO 9241-11:2018 / 9241-210:2019 | Usability definition; HCD process | standard texts |
| Cleveland & McGill (1984) JASA 79(387); Heer & Bostock (2010) CHI; Munzner (2009) TVCG 15(6) | Viz perception + nested model | bibliographic |
| Cowan (2001) BBS 24(1); Miller (1956) Psych. Rev.; Peterson & Peterson (1959) | Working memory | bibliographic |
| Sauro (2011) / Sauro & Lewis (2016); Brooke (1996) | SUS norms | bibliographic |
| Houde & Hill (1997); Dow et al. (2010) | Prototyping theory | bibliographic |
| Microsoft Inclusive 101 guidebook; Holmes, _Mismatch_ (2020) | Inclusive design method | 2026-11-20 |

*This document records point-in-time facts and synthesis for agent/role design; it is not legal advice, and spec status must be re-verified before conformance work.*
