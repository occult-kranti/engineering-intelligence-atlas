# Design Systems & Design Tokens

**Contents:** what a design system is · DTCG 2025.10 · three-tier token
architecture · accessibility in the token layer · headless primitives ·
versioning & governance · tool support reality

## 1. A design system is a product

Principles + tokens + components + patterns + documentation + governance
(contribution model, versioning, deprecation policy). Brad Frost's **Atomic
Design** (atoms → molecules → organisms → templates → pages) is a naming
convention for composition depth, not an architecture mandate. Patterns ("ask
one thing per page", "check answers", how to write an error) outlive components
— ship pattern guidance, not just a component library (GOV.UK model; see
[repo_casebook.md](repo_casebook.md)).

## 2. DTCG 2025.10 — status and format

The W3C Design Tokens Community Group published its first stable format
**2025.10** (2025-10-28: Format, Color, Resolver modules). It is a **W3C
Community Group Final Report, not a W3C standard** — say "DTCG 2025.10", never
"the W3C token standard". Source: [designtokens.org/TR/2025.10](https://www.designtokens.org/TR/2025.10/).

Format essentials: `$value` / `$type` / `$description`, groups, `{alias}`
references, resolver-based theming. Reference implementations: Style Dictionary
(Apache-2.0), Tokens Studio, Terrazzo; supported by Figma (native variable
import/export since late 2025), Penpot, Sketch, Framer, zeroheight. **Tool
support is still partial** (e.g., Style Dictionary v5 DTCG support in progress)
— verify the specific token types a tool version supports before committing a
taxonomy, and version tokens by module date so support claims are checkable.

## 3. Three-tier token architecture

```
primitive   raw scales:            indigo-700, spacing-4
semantic    intent:                color.text.primary, color.surface.raised
component   slot-level:            button.primary.background
```

Consumers reference the semantic/component tiers so theming (dark mode, brand,
high-contrast) is an **alias swap, not a rebuild**. Token changes are versioned
commits with CI build + visual regression on generated output, never manual
handoff.

## 4. Accessibility belongs in the token layer

Fixes made at the token layer are inherited by every component; fixes made
per-screen are regression debt. Encode:

- **Contrast-checked text/background pairs as token pairs** (verify with
  `scripts/contrast_check.py`; 4.5:1 / 3:1 per WCAG 2.2 SC 1.4.3 / 1.4.11);
- **focus-ring tokens** (visible focus is SC 2.4.7 + 2.4.11–13);
- **target-size tokens per named platform authority** (WCAG 2.5.8 24 px floor
  vs. Apple 44 pt vs. Android 48 dp — record the authority, never average);
- **motion-duration tokens with a reduced-motion scale** (see
  [dataviz_motion_spatial.md](dataviz_motion_spatial.md)).

## 5. The headless/unstyled primitive pattern

Behavior, ARIA, keyboard, focus management, and i18n packaged *without*
visuals; consumers bring their own tokens/CSS. The dominant 2020s fix for the
WebAIM finding that pages with ARIA average more errors than pages without:

- **Radix Primitives** (MIT): 59 single-responsibility packages; behavior
  (focus-scope, roving-focus, dismissable-layer, portal, presence) separated
  from visible components.
- **React Aria / React Spectrum** (Apache-2.0): `@react-aria` behavior /
  `@react-stately` state / `@react-spectrum` styled + `@internationalized`
  (dates, numbers, collation, RTL) — i18n as an infrastructure layer.
- **Ariakit** (MIT): framework-portable stores (React + Solid).

The dedicated focus packages show exactly where hand-rolled widgets fail:
keyboard navigation, focus trapping, outside-click dismissal, portal layering.

## 6. Versioning & governance

- Semver the system; pin consumers; publish a changelog and deprecation policy.
- A published Storybook is living documentation and the design/engineering
  contract surface: stories force the explicit state matrix
  (default/hover/focus/disabled/loading/error/empty/overflow/RTL) and the a11y
  addon runs axe-core per story in the dev loop.
- Token taxonomy restructures and major versions are human-gate decisions, not
  autonomous ones.
- Keep a license/provenance ledger for every embedded library and asset
  (fonts/icons carry their own licenses — OFL vs. proprietary); see SKILL.md
  hard gates and [repo_casebook.md](repo_casebook.md) §3.
