# Literature Verification, Claim Mapping, and the Paper Dataset

**Point-in-time baseline:** 2026-11-21. Every search result, status label, and dataset record carries an access/verification date; re-verify before relying on it in a new cycle.

## 1. Review protocol (write before searching)

One page: research questions; inclusion/exclusion criteria (venue tiers, date range, language, peer-reviewed vs. preprint); databases to search; extraction fields (§5). The protocol disciplines against cherry-picking and makes the review re-runnable and updatable.

## 2. Search sources and procedure

- **Official venues (authority of record):** ACL Anthology full-text search, OpenReview (ARR, ICLR, and other OpenReview-hosted venues), PMLR (ICML), NeurIPS proceedings, AAAI proceedings, ACM Digital Library, journal DOI pages.
- **Scholarly indexes (cross-check only):** Semantic Scholar, OpenAlex, Google Scholar — use title-exact searches to detect citation variants, author mismatches, and preprint-versus-proceedings collisions. **Indexes never override official proceedings records.**
- **arXiv:** resolve IDs via the official arXiv API (exact title match); an arXiv record alone establishes preprint status, never acceptance.
- **Snowballing:** backward (references) and forward (citations) from seed papers — the Wohlin (EASE 2014) procedure, with PRISMA-2020-style counts at identification/screening/inclusion.
- **Reading:** Keshav's three passes — triage (title/abstract/headings/conclusions), content (with figures), critique (deep read with virtual re-implementation).
- **Recording:** log query strings, dates, and hit counts. A URL enters a record only when its landing page or repository was directly checked; some official sites (OpenReview PDF, ACM) block non-browser clients — resolve those through the corresponding official search/API channel instead of guessing.
- **Living review:** re-run the search before each resubmission and at camera-ready; for each newly appeared contemporaneous work decide explicitly: cite-only, compare qualitatively, or compare experimentally.

## 3. Publication-status taxonomy (label every record)

| Status | Meaning | Verification rule |
|---|---|---|
| `peer-reviewed` | The venue/proceedings/journal version itself was accepted/published | Official proceedings/DOI record confirms |
| `accepted-not-published` | Accepted, but final proceedings/pagination not yet verified | Acceptance evidence from venue; no final pagination |
| `arr-under-review` | Submitted through ARR, not verified as accepted | Never asserted without direct evidence; treat anonymous "under review" citations per ARR rule |
| `preprint` | arXiv/bioRxiv/tech report only; no peer-review claim | arXiv API / preprint-server record |
| `vendor benchmark` | Self-reported vendor/industrial leaderboard, blog, or tech-report numbers | Flag vendor affiliation; never merge into peer-reviewed evidence |

Rules: take acceptance from the venue record, not from the arXiv version; prefer refereed versions when they exist; flag retracted/withdrawn items; `null` fields mean *not verified*, never *absent*; missing code/data links mean no official artifact was verified — not proof that none exists.

## 4. Evidence tiers (label every cited claim inline)

- **[P]** peer-reviewed at a recognized venue
- **[R]** preprint / not yet peer-reviewed
- **[V]** vendor or self-reported (leaderboards, blogs, tech reports)
- **[D]** independently reproduced / replicated

Weight [P] and [D] above [V]. Never launder a vendor or preprint claim into an unlabeled assertion; keep labels attached as claims propagate into drafts.

## 5. Extraction and the claim table

Per paper, extract: problem, method class, datasets + versions, baselines, metrics, headline numbers with variance, compute, code/data availability and license, stated limitations.

The claim table is the contract for all downstream writing — one claim, one evidence pointer, scope inside the claim:

| Claim ID | Claim text (as written) | Type (empirical / theoretical / design / survey) | Evidence (table/figure/theorem/section) | Experiment → seeds / CIs | Scope qualifiers | Residual risk |
|---|---|---|---|---|---|---|
| C1 | "X outperforms Y on Z" | empirical | Table 2 | 5 seeds, mean±std, paired bootstrap p<0.01 | only on Z v1.2, English | test-set size |

Rules: every abstract/contributions sentence maps to exactly one verifiable location or is deleted/downgraded; distinguish "we introduce / we show empirically / we conjecture / we prove" (informal body arguments need formal appendix proofs); every revision re-derives the table — claims weakened by new evidence are rewritten, not silently dropped.

## 6. Paper / topic-network dataset schema

JSON record per paper, sufficient to drive literature reviews, claim mapping, and a citation/derivation network. Top-level collections: `papers`, `edges`, `venues`, `authors`.

```json
{
  "paper_id": "2024.acl-long.123",
  "title": "...",
  "abstract": "...",
  "authors": [{"name": "...", "orcid": "...", "affiliation": "...", "position": 1}],
  "venue": {"name": "ACL", "year": 2024, "track": "main-long", "tier": "A", "peer_reviewed": true},
  "identifiers": {"doi": "10.18653/v1/...", "arxiv": "2406.00000v2", "openreview": "forumId", "url": "..."},
  "version": {"stage": "preprint|submitted|accepted|vor", "revision_of": "...", "accessed": "2026-11-20"},
  "license": {"paper": "CC-BY-4.0", "code": "MIT", "data": "CC-BY-NC-4.0"},
  "artifact": {"code_url": "...", "code_commit": "...", "data_doi": "...", "checkpoints": "...",
               "acm_badges": ["artifacts-available", "results-reproduced"]},
  "evidence": {"tier": "P|R|V|D", "peer_reviewed": true, "independently_reproduced": false},
  "methods": ["instruction-tuning"], "tasks": ["summarization"], "languages": ["en"],
  "datasets_used": [{"name": "...", "version": "...", "split_reporting": true}],
  "metrics": [{"name": "ROUGE-L", "value": 41.2, "ci95": [40.1, 42.3], "seeds": 5,
               "baseline_source": "re-run|copied"}],
  "compute": {"gpu_type": "H100", "gpu_count": 8, "gpu_hours": 320},
  "claims": [{"id": "C1", "text": "...", "evidence_pointer": "Table 2", "scope": "..."}],
  "limitations_stated": true, "ethics_section": true,
  "provenance": {"vendor_affiliation": "...", "vendor_benchmark": false,
                 "verification_sources": ["official-venue", "arxiv-api"]},
  "verification_date": "2026-11-20"
}
```

**Edge records** (citation/derivation network):

```json
{"edge_id": "...", "src": "paper_id", "dst": "paper_id",
 "type": "cites|extends|benchmarks-on|reproduces|contradicts|supersedes|dataset-of|model-of",
 "context": "section/sentence where the edge is asserted",
 "polarity": "support|neutral|critique", "confidence": "verified|inferred"}
```

**Validation rules:** `paper_id` resolvable to exactly one identifier; status/`evidence.tier` consistent with `venue.peer_reviewed`; every `metrics[].baseline_source` set; every `claims[].evidence_pointer` present; `license.*` from a controlled vocabulary (SPDX/CC); edges acyclic for `supersedes`; every record carries `verification_date`. The schema interoperates with OpenAlex/Semantic Scholar ingestion.

## 7. Worked example corpora (point-in-time snapshots)

Three curated datasets demonstrate this schema in practice; treat them as dated snapshots and re-verify individual records before citing:

- `frontier_nlp_agents_papers.json` (33 records, verified 2026-11-20) — foundation/open LLMs, reasoning and test-time compute, RAG, agents (SWE-bench/OSWorld/τ-bench class), evaluation methodology, prompt/program optimization, alignment, interpretability, multilingual NLP, efficient LMs. Companion synthesis: `frontier_nlp_agents_research.md`.
- `frontier_data_science_papers.json` (30 records, verified 2026-11-21) — statistical learning, causal inference, uncertainty/conformal, time series, tabular/data-centric AI, AutoML, recommenders, graph ML, federated learning, privacy/fairness, MLOps, decision-making/RL; 14 frontier 2025–2026 papers paired with 16 seminal foundations; vendor-benchmark and preprint-only records explicitly flagged. Companion: `frontier_data_science_research.md`.
- `frontier_multimodal_science_papers.json` (38 records, verified 2026-11-20) — computer vision, vision-language models, video generation, speech/audio, robotics/embodied AI, generative 3D, AI-for-science, scientific foundation models. Companion: `frontier_multimodal_science_research.md`.

Use them as seed corpora for snowballing and as formatting exemplars — not as claims of exhaustive coverage, and never as unverified input to a new claim table. Biology/chemistry records are bibliographic metadata only (abstract-level descriptions; no operational protocols).
