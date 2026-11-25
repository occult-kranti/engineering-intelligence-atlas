# Mathematics and AI research atlas

**Dated snapshot: 25 November 2026.** Read [the study guide](01-mathematics-study-guide.md) for the connected explanation, [the formula notebook](02-formula-notebook.md) for derivations and domain restrictions, and [the AI mathematics audit](04-ai-mathematics-audit.md) for the recent-claims assessment.

| Deliverable | Contents |
|---|---|
| `01-mathematics-study-guide.md` | Question-led routes from elementary algebra to current research and evidence-aware memory |
| `02-formula-notebook.md` | 64 formulas with notation, assumptions, derivation, worked example and failure boundary |
| `03-ai-math-claim-register.md` | 24 selected primary-source claim assessments with source locators |
| `04-ai-mathematics-audit.md` | How to interpret the claims and preserve their conditions in a memory graph |
| `nodes.json`, `edges.json` | 140 concepts and 176 typed relationships; learning direction is `prerequisite_of` |
| `formulas.json`, `sources.json` | Structured formula records and 58 source records with actual reading depth |
| `ai-math-claims.json` | Exact selected statements, contribution records, artifact identifiers and adjudication limits |
| `openai-math-catalogue.json` | Complete captured metadata for 730 manuscripts / 375 families, all initially marked not individually reviewed |
| `upstream-openai-license.txt` | Unchanged Apache-2.0 license accompanying the upstream catalogue |
| `coverage.md`, `round-2-review.md` | Coverage boundaries, access failures and actual review history |
| `validation.json` | Results from 21 targeted integrity and classical-example checks |

The graph is designed for integration with the wider physics and memory atlas. A relationship is a declared connection, not evidence of a biological mechanism. New theorem claims retain status and source version; a title-only catalogue entry is not automatically treated as true.

## Rebuild the derived files

Use Python 3; the numerical validation examples additionally require NumPy. Run these commands from this directory:

```bash
python3 build_math_atlas.py
python3 build_claim_audit.py
python3 validate_math_atlas.py
```

The builders make no network requests. The first produces core mathematics and its formula notebook; the second adds the selected claim nodes and claim register. Run both in order before validation. The original study guide and audit narrative are maintained as Markdown.

To reproduce the upstream metadata extraction, obtain the exact raw `CONTENTS.md` at commit `3344da59991ed94f9ba711217b29c1d760badfa6`, then run:

```bash
python3 extract_openai_catalogue.py CONTENTS.md regenerated-catalogue.json
```

The extractor requires Git blob `7d4a8770643439016a70f23a4524d0ebacc78900`, accepts internal parentheses in PDF paths and checks both manuscript and family counts. It preserves metadata only. Different retrieval timestamps are expected between runs. The temporary upstream input is not part of this deliverable.

## Read the scope honestly

This is a substantial study framework and representative frontier review, not an exhaustive catalogue of every formula or current paper in every mathematical subfield. It includes a complete captured metadata catalogue for one publisher, while detailed proof review remains selective. No large Lean proof was compiled in this task. Independent verification is attributed to the people and records that report it, with the exact scope retained.
