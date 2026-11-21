# Accessibility Engineering: WCAG 2.2, ARIA/APG, Conformance Evidence, Legal Map

**Contents:** normative stack · WCAG 2.2 deltas · ARIA/APG rules · automated vs.
manual boundary · real-world evidence · legal map · inclusive design & older
adults · AT test matrix

Status claims verified **2026-11-20** against w3.org/TR and regulator
publications; re-verify before conformance work.

## 1. The normative stack (what is citable as a requirement)

| Artifact | Status (2026-11-20) | Use |
|---|---|---|
| **WCAG 2.2** | W3C Recommendation 2023-10-05; also **ISO/IEC 40500:2025** | The only certifiable/enforceable baseline; target Level A+AA |
| **WCAG 3.0** | Working Draft (2026-09-10); Rec not expected before ~2028–2029; will coexist with 2.x | Roadmap awareness only — never in conformance claims, audits, contracts, or remediation commitments |
| **WAI-ARIA 1.2** | Recommendation 2023-06 | Production baseline for roles/states/properties |
| **ARIA 1.3** | Working Draft (2026-06-04): `suggestion`/`comment`/`mark` roles, `aria-description`, braille attrs, `aria-notify` | Not production-citable; requires real-AT testing before any use |
| **APG** (ARIA Authoring Practices Guide) | W3C note-track, continuously updated | Pattern + keyboard-interaction companion; example code demonstrates the spec — re-test with real AT before shipping copies |
| **Core-AAM / AccName 1.2** | W3C | How roles/names map to platform APIs; the accessible-name algorithm (why `aria-label` overrides content; why empty `alt=""` differs from missing `alt`) |
| **DTCG 2025.10** | W3C **Community Group Final Report** (2025-10-28) — NOT a W3C standard | Token interchange format; say "DTCG 2025.10", never "the W3C token standard" |
| **APCA** | Exploratory; removed from WCAG 3 draft 2023-07 | Candidate research lens on already-passing palettes; never a pass/fail rule |
| **WebXR Device API** | Candidate Recommendation Draft (2026-06-09) | Buildable, not a Recommendation; see [dataviz_motion_spatial.md](dataviz_motion_spatial.md) |

Sources: [WCAG22](https://www.w3.org/TR/WCAG22/) ·
[wcag-3.0](https://www.w3.org/TR/wcag-3.0/) ·
[ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/) ·
[ARIA 1.3](https://www.w3.org/TR/wai-aria-1.3/) ·
[APG](https://www.w3.org/WAI/ARIA/apg/) ·
[DTCG 2025.10](https://www.designtokens.org/TR/2025.10/) ·
[WebXR](https://www.w3.org/TR/webxr/)

## 2. WCAG 2.2 specifics audits get wrong

- POUR: Perceivable, Operable, Understandable, Robust. Conformance is **per
  success criterion and level**, with documented exceptions.
- Nine criteria added over 2.1: **2.4.11 Focus Not Obscured** (AA), 2.4.12/2.4.13
  enhanced focus (AAA), **2.5.7 Dragging Movements** (AA), **2.5.8 Target Size
  Minimum 24×24 CSS px** (AA — five exceptions: spacing via the 24-px circle
  test, equivalent control, inline, user-agent, essential), **3.2.6 Consistent
  Help** (A), **3.3.7 Redundant Entry** (A), **3.3.8 Accessible Authentication
  (Minimum)** (AA).
- **4.1.1 Parsing is retired** in 2.2 — audit templates must be version-aware.
- *Understanding WCAG* and *Techniques* are informative: techniques are
  sufficient *ways* to meet criteria, not requirements.
- Contrast (the only legally referenced contrast rules): **4.5:1** normal text,
  **3:1** large text (≥18pt / 14pt bold), **3:1** UI components & graphical
  objects (1.4.11). Verify pairs with `scripts/contrast_check.py`.

## 3. ARIA / APG operating rules

1. **First rule of ARIA: don't use ARIA** where a native HTML element carries
   the semantics — `<button>` beats `<div role="button" tabindex="0">` because
   the native element ships focusability, key handling, and AT mappings for
   free. Follow *ARIA in HTML* for allowed roles per element.
2. **ARIA adds semantics and zero behavior.** The APG keyboard script (arrow-key
   movement, Home/End, Enter/Space activation, Escape dismissal, roving
   tabindex, focus trap for modal dialogs) is the author's obligation and the
   most common hand-rolled-widget failure.
3. Where a vetted headless library implements the pattern (Radix, React Aria,
   Ariakit class — see [repo_casebook.md](repo_casebook.md)), prefer it over
   hand-rolling; document the APG pattern + version it implements. Hand-roll
   only with written justification and a full keyboard/AT test plan.
4. Check deployment reality against support matrices (e.g., a11ysupport.io) —
   spec support ≠ AT support.

## 4. Automated vs. manual boundary (hard rule)

Automated engines (axe-core, HTML_CodeSniffer via pa11y) cover only the
**mechanically testable subset** of barriers. Do not attach a universal
percentage to tool coverage — it varies by rule set, page, and counting method.
**Automated checks never equal conformance.** Always report:

- engine + version + rule set, rule IDs mapped to WCAG 2.2 SCs, route/page
  coverage, and "needs review" vs. "violation" counts;
- manual results: full keyboard-only pass, at least one real screen reader per
  platform (**NVDA** on Windows, **VoiceOver** on macOS/iOS; JAWS where the
  audience requires), 200% zoom (1.4.4), 320 CSS px reflow (1.4.10),
  `prefers-reduced-motion` on;
- residual known failures with severity and owner — never a bare "score".

What automation cannot judge: meaningful alt text, logical reading order,
error-message quality, focus management in dynamic flows, announcement quality.

## 5. What the evidence says (WebAIM Million 2025)

- 94.8% of top-1M home pages have detectable WCAG failures; low contrast (79.1%)
  tops the list. The six recurring failure classes (low contrast, missing alt
  text, empty links/buttons, missing form labels, missing document language)
  have been stable for years — a **checklist-and-CI problem**, not a knowledge
  problem. Source: [webaim.org/projects/million](https://webaim.org/projects/million/).
- Pages **with** ARIA average *more* detected errors (59.1) than pages without
  (42): mis-implemented custom widgets are worse than native HTML. This is the
  empirical case for the native-first rule and vetted primitives.

## 6. Legal map (point-in-time 2026-11-20; verify at decision time)

- **EU — European Accessibility Act (Directive 2019/882)**: applies since
  2025-06-28 to e-commerce, banking, e-books, ticketing, terminals.
  **ETSI EN 301 549 V4.1.1 (2026-09)** incorporates **WCAG 2.2** across web,
  non-web documents, and software
  ([official standard PDF](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf)).
  Publication by ETSI is **not** itself legal presumption of conformity: that
  depends on the applicable harmonized-standard citation in the Official
  Journal — check the citation status at decision time; do not claim automatic
  presumption.
- **US — ADA Title II** (28 CFR Part 35): WCAG 2.1 AA; deadlines 2027-04-26 /
  2028-04-26 after the 2026 interim extension. **Section 508**: WCAG 2.0 AA.
  Title III: case-by-case, WCAG as de facto benchmark.
- **UK**: PSBAR 2018 (public sector).
- Procurement practice: require a **VPAT/ACR** (ITI VPAT 2.5) dated <12 months,
  and WCAG 2.2 AA as the contract target regardless of the pinned statutory
  version.
- Sources: [W3C WAI policies](https://www.w3.org/WAI/policies/). This skill is
  not legal advice; route external conformance claims through the human gates.

## 7. Inclusive design & older adults

- **Microsoft Inclusive Design** (Kat Holmes's team, 2016+; _Mismatch_ 2020):
  exclusion = design-created mismatch; principles — recognize exclusion, learn
  from diversity, solve for one and extend to many. The **Persona Spectrum**
  maps permanent → temporary → situational versions of one limitation. Carry
  the critique: a distracted driver does not "understand blindness" — permanent-
  disability lived experience remains the anchor; involve, don't simulate.
- **Older adults (W3C WAI-AGE, 150+ studies)**: information overload is the
  dominant barrier (page density, ads/motion, nonlinear hypertext, cross-site
  inconsistency); age-related vision/motor/cognitive needs are substantially
  covered by WCAG — the evidence-backed package is WCAG 2.2 AA + generous
  targets + plain language + generous (or no) timeouts + **including older
  adults in research**. [w3.org/WAI/older-users](https://www.w3.org/WAI/older-users/)
- Inclusive ≠ accessible: accessibility is a measurable floor (WCAG); inclusive
  design asks who is *still* excluded after the floor (literacy, language,
  bandwidth, device age, cultural context, neurodivergence).

## 8. Adjacent standards (scope triggers)

- **ATAG 2.0 / UAAG 2.0** — when shipping CMSs, design tools, or white-label
  editors (the product *is* an authoring tool).
- **WCAG2ICT / WCAG2Mobile** — applying WCAG beyond web documents; native apps
  map the same criteria (24×24 CSS px ↔ platform units).
- **ARRM** (Accessibility Roles and Responsibilities Mapping,
  [w3.org/WAI/planning/arrm](https://www.w3.org/WAI/planning/arrm/)) —
  decompose WCAG into role-level checkpoints (designer owns color-not-alone and
  focus-order intent; developer owns name/role/value; content owns plain
  language). Use ARRM as the governance bridge; never assign "accessibility" to
  one person.

## 9. Minimal AT test matrix (before any conformance claim)

| Pass | Surface | Verdict recorded |
|---|---|---|
| Keyboard-only, all core flows | tab order, focus visible, no traps, skip links | steps + failures |
| NVDA (Windows, free — GPL test tool, never embed) | forms, tables, dynamic updates, dialogs | speech-viewer/log excerpt |
| VoiceOver (macOS + iOS Safari) | same flows; rotor/gesture navigation | recording notes |
| Zoom 200% + 320px reflow | no loss of content/function | screenshots |
| Reduced motion on | feedback semantics preserved | checklist |
