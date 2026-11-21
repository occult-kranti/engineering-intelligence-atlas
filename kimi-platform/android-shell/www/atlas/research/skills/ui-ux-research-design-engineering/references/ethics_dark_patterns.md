# Ethics, Dark Patterns, and Research Privacy

**Contents:** taxonomy lineage · regulatory map · practical design gates ·
research ethics & privacy

## 1. Taxonomy lineage

- **Brignull (2010)** — darkpatterns.org →
  [deceptive.design](https://www.deceptive.design/); _Deceptive Patterns_
  (2023): the practitioner taxonomy (nagging, obstruction, sneaking, forced
  action, interface interference…).
- **Gray et al. (CHI 2018)** — five categories from practitioner data; **2024
  unified ontology** harmonizing academic + regulatory taxonomies.
- **Mathur et al. (CSCW 2019)** — crawl of ~11K shopping sites: 1,818 dark-
  pattern instances, 22 third-party dark-pattern providers — the practice is
  industrialized.

## 2. Regulatory map (verified 2026-11-20; in force)

- **DSA Art. 25 + Recital 67** (applies 2024-02-17): prohibits interface
  structures that distort autonomous choice; names nagging, hard-to-cancel,
  preselection. [Reg. 2022/2065](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- **EDPB Guidelines 03/2022**: six categories for social platforms —
  overloading, skipping, stirring, obstructing, fickle, left-in-the-dark.
- **FTC "Bringing Dark Patterns to Light" (2022-09)**: four categories;
  Section 5 enforcement.
  [ftc.gov/reports/bringing-dark-patterns-light](https://www.ftc.gov/reports/bringing-dark-patterns-light)
- **Amazon Prime $2.5B settlement (2025-09)** — cancellation-flow obstruction.
- **FTC click-to-cancel rule**: finalized 2024-10, **vacated** by the 8th
  Circuit 2025-07, new rulemaking opened 2026-03 — check status before citing.
- **India CCPA 2023**: 13 named banned patterns.
- **EU Digital Fairness Act**: proposal expected Q4 2026 (track, don't cite).

## 3. Practical ethics gates for design work

Run these on every flow, especially consent, pricing, and cancellation:

1. **Symmetry test**: accept vs. reject path parity in steps, prominence, and
   wording. Asymmetric cookie/consent dialogs fail.
2. **Privacy-protective defaults**; no preselected invasive options.
3. **No confirmshaming** ("No thanks, I hate saving money").
4. **No drip pricing** (fees revealed late), **no fake scarcity/social proof**
   ("14 people are viewing this").
5. Consent flows are never optimized on conversion alone.
6. Experimentation review for consent/pricing/cancellation flows.

Flag findings with a concrete taxonomy citation (Brignull/Gray/EDPB/FTC) and
propose the symmetric alternative. Conversion pressure never overrides this
gate.

## 4. Research ethics (the other half of UX ethics)

- **Informed consent recorded before any session**; right to withdraw;
  compensation fair and recorded.
- **Minimal data collection**, secure storage, retention dates; PII minimized
  and never carried into synthesis artifacts.
- GDPR/CCPA obligations apply to research data; IRB/ethics review where
  institutional.
- **Vulnerable populations need elevated safeguards**: children (COPPA,
  Age-Appropriate Design Code), older adults, cognitively impaired
  participants — human review before any such study.
- External publication of findings or sharing raw data beyond the team
  requires anonymization-adequacy review.
- No user recruitment, incentive payments, or panel spending without explicit
  human approval (see SKILL.md hard gates).
