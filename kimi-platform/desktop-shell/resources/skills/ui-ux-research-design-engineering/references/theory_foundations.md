# Theory Foundations: HCI Canon, Quantitative Laws, IA, Prototyping

**Contents:** canonical corpus · quantitative laws (with scope limits) · information architecture · prototyping theory

Use these as named-citation anchors for design reviews. A finding must name the
step, the evidence, and the expected change — "violates Nielsen #4" without
evidence is opinion, not analysis.

## 1. The canonical corpus (read in this order)

1. **Don Norman, _The Design of Everyday Things_ (1988; revised 2013)** — the
   vocabulary of every design review: **affordances vs. signifiers** (an
   affordance is a relationship between object and agent; a signifier is the
   perceivable cue communicating it — most "affordance problems" are signifier
   problems), **mapping** (control↔effect spatial correspondence), **feedback**
   (immediate, informative, non-punishing), **constraints**
   (physical/cultural/semantic/logical), **conceptual models** (the system image
   must let users build a workable mental model), **discoverability**, and the
   **gulfs of execution and evaluation** (Norman & Draper 1986, _User Centered
   System Design_). Error taxonomy: **slips** (right goal, wrong execution —
   prevent with constraints and confirmation-free undo) vs. **mistakes** (wrong
   goal — prevent with better information at decision points).
   Source: [jnd.org](https://jnd.org/the-design-of-everyday-things-revised-and-expanded-edition/).
2. **Jakob Nielsen, _10 Usability Heuristics_ (1994, updated 2024-01-30)** —
   visibility of system status; match system to real world; user control &
   freedom; consistency & standards; error prevention; recognition rather than
   recall; flexibility & efficiency; aesthetic & minimalist design; error
   recovery; help & documentation. These are *heuristics for inspection*, not
   conformance criteria.
   [nngroup.com/articles/ten-usability-heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
3. **Ben Shneiderman, _Designing the User Interface_ (6th ed. 2016) + Eight
   Golden Rules** — consistency; universal usability; informative feedback;
   dialogs yielding closure; error prevention; easy reversal; internal locus of
   control; reduce short-term memory load. Plus **direct manipulation**
   (visibility of objects; rapid, reversible, incremental actions) and the
   information-visualization mantra: *overview first, zoom and filter, then
   details on demand*.
4. **Card, Moran & Newell, _The Psychology of Human-Computer Interaction_
   (1983)** — GOMS and the **Keystroke-Level Model (KLM)**: predict expert
   execution time as sums of primitive operators — K keystroke ≈ 0.2 s,
   P pointing ≈ 1.1 s, H homing ≈ 0.4 s, M mental ≈ 1.35 s, R system response.
   Use for comparing designs analytically *before* user tests; blind to
   learning, errors, readability, and non-routine tasks.
5. **Steve Krug, _Don't Make Me Think_ (3rd ed.)** — users **satisfice** (first
   plausible option), **scan** (skim headings/links, don't read), and **muddle
   through** without accurate models. Consequences: self-evident >
   self-explanatory > documented; every unnecessary word and choice costs
   navigation signal.
6. **Preece / Rogers / Sharp, _Interaction Design: Beyond HCI_ (5th ed.
   2019)** — the process spine: establish requirements → design alternatives →
   prototype → evaluate; usability goals (effectiveness, efficiency, safety,
   utility, learnability, memorability) vs. UX goals (satisfying, motivating,
   trust…).
7. **Cooper et al., _About Face_ (4th ed.)** — goal-directed design, personas
   from research (not marketing), intermediate-user dominance.

## 2. Quantitative laws — real, replicated, but scoped

Never cite a law without its scope limit; never use one as marketing
("bigger button = more conversion" is not Fitts).

- **Fitts's Law (1954)**: movement time `MT = a + b·log2(1 + D/W)` (Shannon
  formulation, MacKenzie 1992). Among the most robust quantitative laws in HCI.
  *Design use:* make frequent targets large and near the expected pointer
  position; screen edges/corners have "infinite width"; pop-up menus near the
  cursor. *Limit:* it models the tap, not the intent.
- **Hick–Hyman Law (1952/1953)**: decision time `T = a + b·log2(n+1)` for
  *equally likely, unordered* choices. Fails for practiced users and
  ordered/semantic menus — treat as a novice-performance model. *Design use:*
  reduce competing options at decision points; chunk menus; common case first.
- **Steering Law (Accot & Zhai, CHI 1997)**: time through a constrained tunnel
  is linear in ∫(1/W)ds — generalizes Fitts to trajectory tasks (dropdown
  navigation, scrollbar dragging, drawing).
- **Power Law of Practice (Newell & Rosenbloom 1981)**: task time improves as a
  power function of practice — the quantitative basis for learnability claims
  and for why accelerators pay off.
- **Working memory**: Miller 7±2 (1956) describes *chunked* span; Cowan (2001,
  BBS 24(1)) shows ~**4±1 chunks** for novel, unrelated elements with rehearsal
  controlled; Peterson & Peterson (1959): unrehearsed traces decay below 10%
  within ~18 s. *Design use:* never require holding state across screens
  (Nielsen #6: recognition over recall); chunk and externalize; dashboards
  comparing >~4 simultaneous metrics need grouping/progressive disclosure.

## 3. Information architecture

Rosenfeld, Morville & Arango (_Information Architecture: For the Web and
Beyond_, 4th ed. 2015 — the "polar bear book"): four systems —
**organization** (hierarchies, facets, audience/task schemes), **labeling**
(user vocabulary, not org-chart names), **navigation** (global/local/
contextual, breadcrumbs supplemental), **search** (zones; logs as IA feedback).
Dan Brown's 8 principles (2010): objects, choices, disclosure, exemplars, front
doors, multiple classification, focused navigation, growth.

**Method pair:** card sorting (generative) → tree testing (evaluative,
text-only, ≥30 participants for quant) → first-click testing; target tree-test
success **>70–80% on core tasks before build**. IA failure signature: high
search usage for content that should be browsable, plus "Where am I?" support
contacts.

## 4. Prototyping theory

- **Houde & Hill (1997), "What do Prototypes Prototype?"**: prototypes answer
  three separable questions — **role** (what is this for in users' lives),
  **look & feel** (sensory experience), **implementation** (how does it work).
  Declare which question a prototype answers before building it; a pixel-perfect
  comp cannot answer the role question, and a clickable wireframe cannot answer
  look-&-feel.
- **Fidelity is a variable, not a virtue**: low fidelity maximizes change
  willingness and keeps feedback structural; high fidelity is needed for
  visual/motion/fine-interaction evaluation and sign-off. **Wizard of Oz**
  (human simulates the system; disclose the simulation) tests AI/voice/service
  concepts before building capability. Parallel prototyping beats serial
  refinement on quality metrics (Dow et al. 2010).
- Every prototype evaluation records: the question, the fidelity, what was
  learned, and what changed — otherwise it is demo theater.
