# Analysis and reporting

## Contents

- Aggregation rules
- Role and skill analysis
- Reporting template
- Audit checks

## Aggregation rules

Start with a coverage table before any finding. Report verified-live records separately from indexed or mirrored leads. For each source state retrieval time, selected categories/queries, paging completeness, access failures, and whether the dataset is a full board, selected-category census, or sample. Do not compare hiring volume across companies unless collection coverage and taxonomy are demonstrably equivalent.

For role counts, use title/category signals and disclose multi-label counting. For unique requisitions, deduplicate by requisition ID while retaining location rows. For skill counts, report “postings mentioning X” rather than “jobs requiring X” unless section-level evidence proves requirement status. Do not turn years expressions into an average without parsing context and exclusions.

## Role and skill analysis

Use job postings to ground role charters, preferred-versus-basic qualification patterns, portfolio evidence, cross-functional interfaces, and emerging specialties. Combine posting evidence with durable standards and craft literature: NIST NICE for cybersecurity, NIST AI RMF for AI governance, WCAG/WAI for accessibility, Google SRE for reliability, and official engine/platform documentation for game roles.

Treat no current posting as “this company never hires this role.” Treat indexed examples as historical or current-status-unverified. Company levels such as L4/L5/L6, Amazon SDE II, Meta E-levels, and Rockstar Senior/Lead are not interchangeable.

## Reporting template

1. Scope, intended decisions, retrieval timestamp.
2. Coverage and failure table.
3. Verified snapshot counts by source/category.
4. Title-based role-family counts; multi-label and requisition caveats.
5. Qualification and skill themes with representative official posting links.
6. Indexed/indirect observations in a separate section.
7. Role taxonomy and hiring-rubric implications.
8. Changes since previous snapshot, if available.
9. Limitations, refresh instructions, and audit results.

## Audit checks

- Unique posting keys and non-empty titles/URLs.
- Expected category/page counts reconciled to source `hits` where available.
- No indirect rows in verified-live aggregates.
- No game-design false positives from “design systems”; require explicit game context.
- No cross-company level equivalence or demand ranking from unequal coverage.
- Full text preserved; spreadsheet cells remain below application limits.
- Every failed source appears in the coverage log and no mass removal was inferred from failure.
