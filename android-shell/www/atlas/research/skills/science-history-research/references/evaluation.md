# Science History Research — Evaluation Tasks

Use these tasks to calibrate and regression-test the agent. Score with the A/B/C/D/X confidence labels and the controls in [evidence_and_provenance.md](evidence_and_provenance.md); verdicts are scored against [case_audits.md](case_audits.md).

## Practical evaluation suite

1. **Quotation provenance trace.** Given 10 famous science quotations (e.g., "shoulders of giants", *hypotheses non fingo*, Tesla on the future of wireless), produce the earliest stable source with identifier (classmark/folio, edition/page, letter date). Pass = correct artifact and pinpoint location; fail = quotation-site provenance or missing identifier.
2. **Myth audit.** Given 12 popular claims drawn from the case audits (apple story, plague year, "invented calculus", "invented AC", "sole inventor of radio", Wardenclyffe free energy, death ray, Colorado Springs photograph, Nobel refusal, Parthenon/pyramid/nautilus golden ratio, "Fibonacci discovered the sequence"), return verdict + controlling evidence. Pass = verdict matches the audit tables with primary evidence cited; any repetition of folklore as fact is a hard fail.
3. **Patent claim reading.** Given [US645576A](https://patents.google.com/patent/US645576A/en) or [US381968A](https://patents.google.com/patent/US381968A/en), summarize what the independent claims disclose, the filing/priority history, and what the patent does not establish. Pass = distinguishes disclosure from reduction to practice and commercial success.
4. **Court-record discipline.** Given the slogan "the Supreme Court ruled Tesla invented radio," produce the controlled reading of [320 U.S. 1 (1943)](https://supreme.justia.com/cases/federal/us/320/1/): which patent and claims were adjudicated, what was held, what was expressly not decided. Pass = no global-priority slogans.
5. **Edition discrimination.** Given a *Principia* or *Opticks* claim, state which edition (1687/1713/1726; 1704/1717-18) and why it matters (e.g., General Scholium added 1713; Queries evolved across editions). Pass = edition-specific citation.
6. **Calendar and dating.** Convert English pre-1752 dates with Old Style/New Style and year-start conventions (Newton's birth and death dates). Pass = dual dating reported.
7. **Indian priority credit.** Given any Fibonacci-sequence history question, the answer must credit Piṅgala, Virahāṅka, Gopāla, and Hemachandra, note the Lucas naming (1870s), and cite Singh (1985) or Plofker (2009). Omitting Indian priority is a hard fail.
8. **Pseudohistory detection.** Given a paragraph mixing genuine history with suppression/conspiracy or lone-genius framing, flag each violation and rewrite with the anti-pseudohistory rules. Pass = all planted violations flagged, no false accusations against well-sourced statements.
9. **Dated source matrix construction.** Given a priority dispute not in the case audits, build the matrix (private note → patent → publication → demonstration → commercialization → recollection), assign confidence labels per claim, and state what would change the assessment. Pass = recollection never outranks dated contemporary records.
10. **Fail-stop behavior.** Given a load-bearing historical claim with no identifiable primary source, the agent must fail-stop and label D/X rather than assert. Pass = refusal to launder unattributed claims into fact.

## Scoring guidance

- A zero on tasks 2, 7, or 10 (myth propagation, erasing priority, laundering unattributed claims) is decisive regardless of other scores.
- Report per-task pass/fail with evidence, not an averaged score.
