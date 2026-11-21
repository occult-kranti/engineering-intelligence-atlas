# Cognitive Evidence: Memory, Cognitive Load, Perception

**Contents:** evidence-tier discipline · working memory · cognitive load theory ·
Gestalt & preattentive perception · attention failures

## 1. Evidence-tier discipline (apply to every claim)

Label every UI/UX claim with its tier and never upgrade a tier:

| Tier | Meaning | Examples |
|---|---|---|
| **standard** | Normative or stable-spec text | WCAG 2.2 SC, ARIA 1.2, ISO 9241-11 |
| **replicated experiment** | Peer-reviewed + independently replicated | Fitts, Cleveland–McGill (+ Heer–Bostock), Cowan 4±1 |
| **vendor-reported** | Single-org data, unaudited | Tool coverage %, conversion case studies |
| **heuristic judgment** | Expert inspection / practitioner lore | Nielsen heuristics findings, "best practices" |

Point-in-time facts (spec maturity, versions, licenses) in this skill were
verified **2026-11-20**; re-verify before relying on them.

## 2. Working memory (what the numbers actually say)

- **Cowan (2001, BBS 24(1))**: ~**4±1 chunks** for novel, unrelated elements
  when rehearsal and chunking are controlled. Miller's 7±2 (1956, _Psych.
  Review_) describes chunked span and is widely over-cited as a design limit.
- **Peterson & Peterson (1959)**: unrehearsed traces decay below 10% within
  ~18 s.
- *Design use:* never require users to hold state across screens; externalize
  (visible cart contents, entered data, comparison tables); chunk related
  controls; dashboards comparing >~4 metrics simultaneously need grouping and
  progressive disclosure.

## 3. Cognitive load theory (Sweller 1988; Sweller, van Merriënboer & Paas 2019)

Three loads: **intrinsic** (element interactivity of the material),
**extraneous** (load created by the presentation — the designer's fault),
**germane** (productive schema-building). Replicated effects with direct UI
consequences:

- **Split-attention effect** → physically integrate labels into diagrams and
  forms (in-field or top-aligned labels beat distant legends).
- **Redundancy effect** → do not narrate what is already readable on screen;
  remove duplicate channels.
- **Modality effect** → pairing visual + auditory can expand effective capacity
  (voice guidance during visual tasks) — but doubles accessibility obligations.
- **Expertise reversal effect** → guidance that helps novices harms experts;
  justifies adaptive/progressive UIs and Nielsen #7 (flexibility & efficiency).

Primary review: Sweller, van Merriënboer & Paas (2019), "Cognitive Architecture
and Instructional Design: 20 Years Later," _Educ. Psych. Review_
([doi:10.1007/s10648-019-09465-5](https://doi.org/10.1007/s10648-019-09465-5)).

## 4. Gestalt & preattentive perception

- Wertheimer/Koffka/Köhler grouping principles — proximity, similarity, closure,
  continuity, common region, common fate — are the operating system of visual
  hierarchy: communicate grouping with **spacing and enclosure before color or
  borders**.
- **Preattentive attributes** (color, orientation, size, motion) are detected in
  <200–250 ms in parallel (Colin Ware, _Information Visualization: Perception
  for Design_, 4th ed. 2021; Stephen Few). Use them for exactly one "most
  important thing" per view — two preattentive signals compete.
- **Change blindness / inattentional blindness** (Simons & Chabris 1999): users
  literally do not see banners or modals they were not attending to. Never rely
  on peripheral visual change to announce critical state — pair with focus
  movement, announcements, or placement in the attention path.

Practitioner synthesis: Jeff Johnson, _Designing with the Mind in Mind_
(3rd ed.) — perception/memory evidence translated into UI rules with citations.

## 5. Applying the evidence honestly

- A cognitive rationale supports a design *hypothesis*; only task evidence
  (success/time/error) or a replicated experiment supports a design *claim*.
- State the population a finding applies to: novice vs. expert reversals are
  the rule (expertise reversal), not the exception.
- Small-n hallway data is directional signal, never prevalence — see
  [research_methods_metrics.md](research_methods_metrics.md) §6.
