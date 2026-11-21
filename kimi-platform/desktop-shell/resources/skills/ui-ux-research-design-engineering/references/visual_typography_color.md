# Visual Design: Hierarchy, Typography, Color, Responsive

**Contents:** hierarchy · typography · color · grids & spacing · responsive &
mobile · touch targets (three authorities) · performance as UX

## 1. Hierarchy

Hierarchy is structure made visible: **size → weight → color → position**, in
that order of perceptual force; one dominant element per view. The F/Z scanning
patterns are consequences of hierarchy quality, not design templates.
Communicate grouping with spacing and enclosure before color or borders
(Gestalt; see [cognitive_evidence.md](cognitive_evidence.md)).

## 2. Typography

Bringhurst, _The Elements of Typographic Style_; Lupton, _Thinking with Type_:

- Body text **45–75 characters per line** (~66 ideal); line-height **~1.4–1.6**
  for body text.
- Establish a **modular scale** (e.g., 1.125–1.333 ratio) instead of ad-hoc
  sizes.
- Left-align for LTR readability; justify only with hyphenation.
- Minimum practical UI text ~16 px for comfortable reading (USWDS guidance);
  honor user zoom: WCAG **1.4.4** resize to 200%, **1.4.10** reflow at 320 CSS
  px width.
- Font licenses are separate from code licenses (OFL vs. proprietary) — ledger
  every font asset.

## 3. Color

- **Never encode meaning by color alone** (WCAG 1.4.1; ~4.5% of people have
  some color-vision deficiency) — pair with text, shape, pattern, or icon.
- Use perceptually uniform spaces (**OKLCH**, CSS Color 4) for palette
  generation so equal steps are equal perceived steps; keep **hue for
  categories, luminance for magnitude**.
- Maintain the **4.5:1 / 3:1** WCAG 2.x ratios at the *token* level so
  conformance is inherited; verify with `scripts/contrast_check.py`.
- **APCA is not normative anywhere** (removed from the WCAG 3 draft 2023-07).
  Using APCA to pass colors that fail 4.5:1 invites scanner-driven legal
  findings; using it as an additional readability lens on already-passing
  palettes is legitimate.

## 4. Grids & spacing

4/8-pt spacing systems create the rhythm Gestalt proximity needs. Density is a
contextual variable (data-dense expert tools vs. consumer flows), not a taste.

## 5. Responsive & mobile

- Ethan Marcotte's responsive web design (2010: fluid grids, flexible images,
  media queries) → mobile-first content prioritization (Luke Wroblewski,
  _Mobile First_, 2011). Modern practice: **content-out breakpoints**,
  container queries for components, intrinsic layouts (flex/grid) over
  device-named breakpoints.
- **One-handed/thumb ergonomics** (Steven Hoober's research: ~49% hold
  one-handed, thumb sweep arcs): keep destructive/primary actions out of the
  accidental-tap zone. Gesture discoverability: gestures need visible
  affordances or onboarding, and every path gesture needs a single-pointer
  alternative (WCAG 2.5.1/2.5.7).

## 6. Touch targets — three authorities, three numbers (never average)

| Authority | Minimum | Note |
|---|---|---|
| **WCAG 2.2 SC 2.5.8 (AA)** | **24×24 CSS px** | Legal floor with five exceptions (spacing via 24-px circle test, equivalent, inline, user-agent, essential); ~⅓ of an adult fingertip (avg. pad 16–20 mm) |
| **WCAG 2.2 SC 2.5.5 (AAA)** | 44×44 CSS px | Enhanced |
| **Apple HIG** | **44×44 pt** default (28×28 minimum on iOS) | ≈7.3 mm — finger-sized |
| **Android / Material** | **48×48 dp** + 8 dp separation | ≈7.6 mm — finger-sized |

Commit to a **named authority per surface and record it** in the spec.
Hit area ≠ visible icon: pad via pseudo-elements. Check layouts with
`scripts/target_size_check.py`.

## 7. Performance is UX

Core Web Vitals as the user-perceived performance contract: **LCP ≤ 2.5 s,
INP ≤ 200 ms, CLS ≤ 0.1**. Nielsen's classic response-time limits still frame
feedback design: 0.1 s instant / 1 s uninterrupted flow / 10 s attention
boundary — below each threshold the interface owes progressively stronger
feedback (spinner, progress bar, cancelability).
