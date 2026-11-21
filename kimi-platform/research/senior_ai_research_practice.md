# Senior AI Researcher / Writer Practice for Tier-A Venues and ACL ARR

**Version:** 1.0 · **Compiled:** 2026-11-20 · **Evidence standard:** every policy claim below is anchored to an official venue/organization source or a primary research-methods source, with access date 2026-11-20 unless noted. Policy pages change every cycle; **always re-open the cited page for the current cycle before acting on it** (ARR explicitly re-assesses forms and guidelines periodically).

**Companion role charters** (in `scientific-research-library/agents/`):
[ai-research-director.md](scientific-research-library/agents/ai-research-director.md) ·
[senior-ai-research-scientist.md](scientific-research-library/agents/senior-ai-research-scientist.md) ·
[research-writer-reproducibility-editor.md](scientific-research-library/agents/research-writer-reproducibility-editor.md)

---

## 1. Venue landscape and governing policies

### 1.1 ACL Rolling Review (ARR)

ARR is the shared peer-review service for ACL, NAACL, EACL, EMNLP, and other \*CL venues. It provides **reviews only**; venues make acceptance decisions on committed papers.

- **Cycle model.** Recurring (two-monthly) submission deadlines, firm and in "anywhere on Earth" time; submissions via OpenReview (`https://openreview.net/group?id=aclweb.org/ACL/ARR/<YEAR>`). After review: revise-and-resubmit to a later cycle, **or** commit the reviews to a venue by its commitment deadline — these options are mutually exclusive. Source: <https://aclrollingreview.org/authors>, <https://aclrollingreview.org/cfp>.
- **What gets desk-rejected.** Formatting/anonymity violations, dual submissions, self-plagiarism (significant overlap with the authors' other work), incorrect/incomplete/misleading Responsible NLP Checklist, resubmission-policy violations, appendix format abuse, page-limit gaming (e.g., results hidden in Limitations), "hallucitations" (fabricated references), hidden prompt injections targeting machine readers, and — newer — papers two chairs judge clearly below the top-tier bar. Source: <https://aclrollingreview.org/cfp>, <https://aclrollingreview.org/authorchecklist>.
- **Originality.** ≤10% token overlap with any other submitted/published work (authors' own preprints excluded); concurrent related submissions with overlapping authors must cite each other as `Anonymous (YEAR). Title. Under review.` and be uploaded as anonymized supplementary material. Source: <https://aclrollingreview.org/cfp>, ACL Policy on Publication Ethics <https://www.aclweb.org/adminwiki/index.php/ACL_Policy_on_Publication_Ethics>.
- **Citation obligations.** Cite all relevant refereed publications; cite refereed versions in addition to/instead of superseded preprints; work appearing <3 months before the deadline is "contemporaneous" and does not require detailed comparison. Source: ARR CFP; ACL Policies for Review and Citation.
- **Anonymity.** Double-blind review. Since the February 15, 2024 deadlines there is **no anonymity period / preprint embargo** — posting non-anonymous preprints while under review is allowed — but the submission itself must be anonymized, and anything revealing author identity (including withdrawn papers elsewhere) counts as a "preprint" that must be declared. Source: <https://github.com/acl-org/aclrollingreview/blob/main/authors.md>.
- **Review form.** Reviewers score Soundness (must be justified in text), Excitement (explicitly subjective), and Overall Assessment (Award / Conference / Findings / Resubmit bands on a 1–5 scale), plus reproducibility judgment; reviewer guidelines forbid lazy heuristics ("not novel" without a citation, "not SOTA", "too simple", "only tested on English" unless claims are general, "I would have done X"). Source: <https://aclrollingreview.org/reviewerguidelines>.
- **Service model.** From the October 2026 cycle ARR operates under ACL's sustainable-reviewing policy (review-guarantee tied to contributing qualified reviewers; per-author submission caps). Check the current cycle announcement before planning. Source: <https://aclrollingreview.org/authors>.

### 1.2 ACL author guidelines, formatting, and ethics code

- **ACL Author Guidelines** (submission types, formatting, anonymity, dual submission): <https://www.aclweb.org/adminwiki/index.php/ACL_Author_Guidelines>.
- **ACLPUB formatting** (<https://acl-org.github.io/ACLPUB/formatting.html>, updated January 2025): mandatory **Limitations** section (no new experiments/figures/analysis; after conclusion, before references; excluded from page limit); optional **Ethical Considerations** section (same placement and exclusion); unnumbered Acknowledgments before references, omitted from the review version; clarifications on figure/table font sizes and two-column appendices. Page limits: 8 (long) / 4 (short) at submission, +1 page at camera-ready; Limitations, Ethics, Acknowledgments, and references do not count. Use the official Overleaf/ACLPUB template unmodified; check with the `aclpub_check` tool and refresh `.bib` entries with `rebiber`.
- **ACL Code of Ethics**: <https://www.aclweb.org/portal/content/acl-code-ethics> — professional competence, honest representation of results, privacy and data protection, non-discrimination, avoidance of harm, transparency about limitations and risks.
- **ACL Policy on Publication Ethics** (<https://www.aclweb.org/adminwiki/index.php/ACL_Policy_on_Publication_Ethics>): authorship follows the four Vancouver/ICMJE criteria (substantial contribution **and** drafting/revision **and** final approval **and** accountability); generative models cannot be authors; conflicts of interest disclosed; dual submission prohibited; **coordinated disclosure** required for works documenting new ways to make models/technologies behave harmfully (contact developers, ≥30 days before first public disclosure, document who/when/how); reviewer conduct (confidentiality, no collusion, no citation manipulation, no doxxing, no use of manuscript ideas before publication); generative-assistance rules for reviewers (no first drafts by generative tools; never upload manuscripts or reviews to non-privacy-preserving tools).
- **AI writing/coding assistance (authors).** Generative AI use for writing or coding must be disclosed (Responsible NLP Checklist + Acknowledgments/README); all authors remain fully responsible for correctness, including plagiarism of text and code; prompt injections aimed at machine readers → desk rejection or retraction. Source: ARR CFP; ACL Policy on AI Writing Assistance.

### 1.3 NeurIPS / ICML / ICLR (Tier-A ML venues)

- **NeurIPS Paper Checklist** (<https://neurips.cc/public/guides/PaperChecklist>): mandatory checklist covering (1) claims match contributions/scope, (2) limitations, (3) theory assumptions and complete proofs, (4) experimental reproducibility — *some reasonable avenue* for reproducing/verifying results is required even if code is not released (algorithm description, architecture spec, checkpoint, hosted access, or dataset construction instructions), (5) open access to data and code with exact run instructions (see the Code Submission Policy, <https://neurips.cc/public/guides/CodeSubmissionPolicy>; anonymized repos at submission), (6) full training/test details, (7) statistical significance/error bars, (8) compute resources, plus human-subjects, dataset-documentation, and broader-impacts items. Answers are visible to reviewers.
- **Origin of the checklist regime.** The ML Reproducibility Checklist was piloted at NeurIPS 2018 and made mandatory at NeurIPS 2019, alongside a code-submission policy and a Reproducibility Challenge; measurable effects (code-release rates, hyperparameter and variance reporting) are documented in the program report: Pineau et al., "Improving Reproducibility in Machine Learning Research," *JMLR* 22(164), 2021, <https://www.jmlr.org/papers/volume22/20-303/20-303.pdf>. Variants were subsequently adopted by ICML, ICLR, AAAI, and the ACL community's checklists.
- **ICML.** Double-blind; strongly encourages (and in recent years operationally expects) code submission; its "thinly sliced contributions" rule (concurrently submitted overlapping papers must cite each other) is the rule ARR now follows. Venue-year calls at <https://icml.cc>.
- **ICLR.** Public review on OpenReview (reviews, author responses, and for accepted papers the identities/discussion become public); anonymized submissions; checklists harmonized with NeurIPS. Venue-year calls at <https://iclr.cc>.

### 1.4 ACM venues and artifact evaluation

- **ACM Artifact Review and Badging v1.1** (<https://www.acm.org/publications/policies/artifact-review-and-badging-current>): voluntary post-acceptance (or parallel) artifact evaluation by an Artifact Evaluation Committee. Badges: **Artifacts Available** (public archival repository with DOI/stable identifier; personal web pages not acceptable), **Artifacts Evaluated – Functional** (documented, consistent, complete, exercisable, with verification/validation evidence), **Artifacts Evaluated – Reusable** (Functional + carefully documented and structured for reuse/repurposing), **Results Reproduced** (independent team obtained main results using author artifacts), **Results Replicated** (independent team obtained main results without author artifacts). Terminology: repeatability = same team/artifacts; reproducibility = different team/same artifacts; replicability = different team/different artifacts.
- **ACM publication rights** (<https://www.acm.org/publications/policies/publication-rights-and-licensing-policy>): since January 1, 2023 authors retain copyright and grant ACM a non-exclusive license; from January 1, 2026 the CC options are CC-BY and CC-BY-NC-ND. Authors may post preprint, submitted, and accepted versions on their homepage, institutional repository, funder-mandated repositories, and non-commercial repositories; CC-licensed works may post the Version of Record anywhere.

### 1.5 COPE (cross-venue ethics backbone)

COPE's consolidated guidance — historically the 10 **Core Practices** (allegations of misconduct; authorship and contributorship; complaints and appeals; conflicts of interest; data and reproducibility; ethical oversight; intellectual property; journal management; peer review processes; post-publication discussion and corrections) — was replaced in 2026 by a **Code of Conduct** plus **Core Principles**, covering integrity of the scholarly record, transparent handling of misconduct allegations, protection of whistleblowers, corrections/retractions/expressions of concern, FAIR/CARE data principles, and funding disclosure. Sources: <https://publicationethics.org/>, <https://publicationethics.org/guidance/guideline/principles-transparency-and-best-practice-scholarly-publishing>, <https://publicationethics.org/about/what-we-do/our-story/history-code-conduct>. For a research team, COPE's flowcharts are the reference process for handling suspected plagiarism, fabrication, duplicate submission, and authorship disputes.

---

## 2. Literature review methods

**Goal:** a defensible, reproducible map of prior work that supports (a) gap identification, (b) claim positioning, and (c) citation completeness under ARR's "cite all relevant refereed publications" rule.

1. **Protocol before search.** Write a one-page review protocol: research questions, inclusion/exclusion criteria (venue tiers, date range, language, peer-reviewed vs. preprint), databases to search, and the extraction fields (see the paper schema in §13). This disciplines against cherry-picking and makes the review updatable.
2. **Three-pass reading.** Keshav's three-pass approach — (1) skim title/abstract/headings/conclusions for triage, (2) read with figures for content, (3) deep read with virtual re-implementation for critique — remains the standard triage method. Keshav, "How to Read a Paper," *ACM SIGCOMM CCR* 37(3), 2007.
3. **Systematic search + snowballing.** Combine database queries (ACL Anthology full-text search, Semantic Scholar / OpenAlex / Google Scholar, arXiv listing) with backward snowballing (references) and forward snowballing (citations) from seed papers — the procedure formalized for SE by Wohlin (EASE 2014) and consistent with PRISMA 2020 reporting logic (Page et al., *BMJ* 2021; record counts at identification/screening/inclusion). Record the query strings, dates, and hit counts so the review is re-runnable.
4. **Venue-weighted evidence tiers.** Label every cited claim with an evidence tier: **[P]** peer-reviewed at a recognized venue; **[R]** preprint / not yet peer-reviewed; **[V]** vendor or self-reported (leaderboards, blogs, tech reports); **[D]** independently reproduced / replicated. ARR's contemporaneous-work rule (§1.1) relieves deep comparison only for <3-month-old work; it never excuses omitting a citation.
5. **Extraction into claim/evidence tables.** Extract per paper: problem, method class, datasets + versions, baselines, metric(s), headline numbers with variance, compute, code/data availability and license, stated limitations. This table is the substrate for §3 and for the related-work section; it is also the fastest defense against "missing baseline" reviews.
6. **Synthesis, not enumeration.** Organize related work by *approach families and their trade-offs*, ending each family with the open problem your work addresses. Reviewers flag "laundry-list" related work; ARR explicitly allows desk review of positioning quality.
7. **Preprint hygiene.** Prefer refereed versions when they exist (ARR rule); label preprints as such; never cite withdrawn or hallucinated references — fabricated citations ("hallucitations") are a named desk-rejection cause. Verify every BibTeX entry against the ACL Anthology / DOI record; run `rebiber` before submission.
8. **Living review.** Re-run the search before each resubmission and at camera-ready; log newly appeared contemporaneous work and decide explicitly: cite-only, compare qualitatively, or compare experimentally.

---

## 3. Claim/evidence mapping

The first question of both the NeurIPS checklist and the ARR Responsible NLP Checklist is whether **claims in the abstract/introduction match what the paper actually demonstrates**. Operationalize this as an explicit artifact maintained from first draft to camera-ready:

| Claim ID | Claim text (as written in paper) | Type (empirical / theoretical / design / survey) | Evidence (table/figure/theorem/section) | Experiment → seed set / CIs | Scope qualifiers | Residual risk |
|---|---|---|---|---|---|---|
| C1 | "X outperforms Y on Z" | empirical | Table 2 | 5 seeds, mean±std, paired bootstrap p<0.01 | only on Z v1.2, English | test-set size |

Rules of practice:

- **One claim, one evidence pointer.** Every sentence in the abstract and contributions list maps to exactly one verifiable location. If a claim has no pointer, delete or downgrade it.
- **Scope travels with the claim.** Benchmark, dataset version, language/domain, model size, and harness move *inside* the claim sentence, not into a footnote. "State of the art" is banned unscoped (consistent with ARR reviewer guidance against "not SOTA" heuristics — the burden is symmetric).
- **Contribution language discipline.** Distinguish "we introduce / we show empirically / we conjecture / we prove". Informal arguments in the body must be backed by formal proofs in the appendix (NeurIPS checklist theory item).
- **Negative space.** The Limitations section enumerates where the claims *stop*; it may not smuggle in new experiments (ACLPUB rule).
- **Claim diffing at revision.** Every revision re-derives the table; claims weakened by new evidence are rewritten, not silently dropped — reviewers comparing versions notice.

---

## 4. Reproducibility practice

Target standard: an independent researcher can regenerate the main tables/figures from the artifact alone — the bar behind ACM's *Functional/Reusable/Reproduced* badges and the NeurIPS reproducibility item.

**Minimum artifact set** (convergent across NeurIPS/AAAI/IJCAI checklists and ACM badging):

1. Runnable source code, pinned commit.
2. Datasets or immutable links + version IDs (DOI, revision hash, checksums).
3. Pre-trained checkpoints where training cost is material, or exact training recipes.
4. A single entry-point command/script that regenerates each reported metric (evaluation harness), including baselines.
5. Machine-readable environment (`requirements.txt` / `environment.yml` / Dockerfile / container image) with framework, CUDA/driver, and hardware recorded.
6. A README that binds 1–5 into one workflow, with expected runtime and compute.

**Reporting requirements** (NLP Reproducibility Checklist lineage — Dodge et al., "Show Your Work," EMNLP-IJCNLP 2019 — folded into the ARR checklist section C):

- Hyperparameter search protocol (grid/random/manual), ranges tried, **best-found values**, number of trials, and which split was used for selection — never tune on the test split.
- Descriptive statistics across runs: mean/std or CIs over ≥3 seeds (≥5 preferred), and state whether reported numbers are mean/median/best.
- Exact train/dev/test splits and dataset versions; preprocessing steps.
- Compute: GPU/TPU type × count, wall-clock, total GPU-hours, framework versions; expected validation results so re-runners can detect silent divergence.
- Model selection rule (early stopping criterion, checkpoint selection).

**Process habits:**

- Treat single-seed headline numbers as *exploratory*, not publishable (Reimers & Gurevych, EMNLP 2017, showed score distributions across seeds routinely exceed claimed SOTA deltas).
- Keep a deterministic "golden config" per headline result; verify re-run equality within tolerance before submission.
- Archive the artifact to a DOI-minting repository (Zenodo/figshare/Dryad) at camera-ready; GitHub links alone do not satisfy ACM *Artifacts Available*.
- Closed/proprietary constraints: document the reproducibility *avenue* explicitly (hosted access, API, partial release) — "no" is an acceptable checklist answer only with justification; it is not acceptable when the artifact **is** the contribution (e.g., a new open benchmark).

---

## 5. Statistical evaluation

Reference standard for NLP/ML comparisons: Dror, Baumer, Shlomov & Reichart, "The Hitchhiker's Guide to Testing Statistical Significance in Natural Language Processing," ACL 2018 (<https://aclanthology.org/P18-1128/>), plus its test-recommendation appendix (arXiv:1809.01448). Their ACL 2017 audit: of 180 experimental long papers, 63 tested significance, 42 named the test, 36 used it correctly — expect reviewers to apply this lens.

**Practices:**

1. **Paired tests for same-test-set comparisons.** Systems evaluated on the same examples are dependent samples: use paired tests — paired bootstrap or approximate randomization (permutation) as the default, McNemar for 2×2 contingency outcomes, Wilcoxon signed-rank for perplexity-like large-outcome-space metrics, paired t-test only where the normality assumption is defensible.
2. **Bootstrap CIs everywhere.** Report 95% confidence intervals (percentile or BCa bootstrap) on headline metrics; CIs communicate precision even where significance testing is inappropriate.
3. **Multiple comparisons.** Pre-declare the primary hypothesis set. Control family-wise error (Bonferroni/Holm) for confirmatory claim families; for cross-validation or multi-dataset significance, per-fold tests + replicability analysis (Dror et al. 2017, KBonferroni). Post-hoc comparisons are labeled exploratory.
4. **Effect size and practical significance.** A significant 0.1-point delta may be meaningless; report effect size and discuss whether it matters for the application.
5. **Test-set realities.** Bootstrap assumes the test set represents the population; small or skewed test sets invalidate it — say so. Report dataset size, split provenance, and contamination checks (train/test leakage, benchmark-in-pretraining overlap).
6. **Variance sources.** Separate seed variance, data-order variance, and (for LLM systems) sampling/decoding variance; for LLM-as-judge or generation metrics, fix seeds/temperatures and report judge agreement.
7. **Human evaluation.** Report annotator counts, recruitment/payment (ARR checklist D2), full instructions, inter-annotator agreement (Krippendorff's α or similar), and power considerations; crowdwork protocols may require IRB/ethics-board approval or documented exemption (D4).
8. **Baselines.** Reproduce baselines in your own harness where possible; numbers copied from other papers are labeled as such (different data versions/preprocessing can manufacture fake deltas).

---

## 6. Dataset and model documentation

- **Datasheets for Datasets** — Gebru et al., *CACM* 64(12), 2021 (arXiv:1803.09010): structured questions across the dataset lifecycle — motivation, composition, collection process, preprocessing/cleaning/labeling, uses, distribution, maintenance.
- **Model Cards** — Mitchell et al., FAT* 2019 (DOI 10.1145/3287560.3287596, arXiv:1810.03993): 1–2 page record with model details, intended use, factors, metrics (disaggregated by relevant groups), evaluation data, training data, quantitative analyses, ethical considerations, caveats. The Hugging Face Hub operationalized this as README + YAML metadata.
- **Data Statements for NLP** — Bender & Friedman, *TACL* 6, 2018: language-varieties/speaker-demographic documentation for language data. **Data Cards** (Pushkarna et al., FAccT 2022) extend this for industry pipelines.
- **ARR integration.** The Responsible NLP Checklist section B encodes the same content: document data source/curation rationale, license and terms-of-use consistency with intended use, PII/offensive-content screening and anonymization steps, consent, dataset statistics and splits, and annotation instructions. ARR explicitly encourages attaching datasheets and model cards as supplementary material; ACL venues resumed **publishing the checklists of accepted papers**.
- **Practice:** write the datasheet/model card **at artifact creation time**, not at camera-ready; version it with the artifact; register dataset/model licenses in the paper and in the artifact README.

---

## 7. Responsible research and ethics gates

Layered obligations, from most general to venue-specific:

1. **COPE** — no fabrication, falsification, plagiarism, or duplicate submission; authorship per contributorship criteria; transparent corrections (§1.5).
2. **ACL Code of Ethics** — competence, honesty, privacy, fairness, harm avoidance.
3. **ACL Policy on Publication Ethics** — authorship (Vancouver criteria), COI disclosure, ≤10% text reuse, coordinated disclosure (≥30 days) for newly documented model-failure/vulnerability techniques, no reviewer deanonymization, anti-harassment.
4. **ARR Responsible NLP Checklist** (derived from the NeurIPS 2021 checklist, the Rogers–Baldwin–Leins responsible-data checklist, and the Dodge et al. NLP reproducibility checklist): limitations and risks; artifact licensing, PII screening, consent; experimental setup and descriptive statistics; human-subject instructions, recruitment, pay adequacy, IRB status; AI-assistance disclosure. **Incorrect, incomplete, or misleading checklist answers can cause desk rejection; checklists of accepted papers are published.**
5. **Human subjects.** Plan ethics review *before* data collection (ARR recommends consulting the checklist at project start, not submission). Document approval or exemption (checklist D4).
6. **Generative AI use.** Disclose scope of writing/coding assistance; humans verify every citation and number; generative tools cannot be authors; nothing is written for machine "readers" (no hidden text, no prompt injection).
7. **Societal impact.** A Limitations section is mandatory; an Ethical Considerations section is encouraged and exempt from page limits — use it for dual-use, bias, environmental, and labor impacts, honestly scoped.

---

## 8. Peer review and the ARR process (author-side)

Timeline within one ARR cycle: submission → AC desk-check screen → ≥3 reviews → **author response** → reviewer update/discussion → review-issue reporting → meta-review → meta-review-issue reporting → decision point for the author: **revise-and-resubmit, commit to a venue, or withdraw**.

**Author response (rebuttal) rules — current ARR mechanics:**

- One **general response** to all reviews + one **response per review**, each capped at **5,000 characters**, **text-only, no external links or images** (violation → desk rejection).
- Recommended maximum of 2 author responses per review thread; ACs are not obligated to read beyond that.
- New experimental results are allowed **only** as minor direct responses to reviewer questions (an ablation, a hyperparameter variant, one extra baseline) — never unsolicited headline results indicating substantial post-submission work.
- Reviewers are asked (not obligated) to acknowledge responses and update reviews for resolved misunderstandings; non-response can be flagged later via the **review issue report**, not by pestering.
- The real audience is the **Area Chair writing the meta-review** — which travels with the paper to commitment. Optimize the response to give the AC a clean, checkable record: quote the criticism, answer with a section/table pointer or a small new result, state what will change in revision.
- Do not press for score changes; do not litigate style disagreements; flag guideline-violating reviews (unsupported "not novel", score/text mismatch, lazy heuristics) through the issue-report mechanism with specifics.
- After the meta-review: options are (a) revise and resubmit to the next deadline (~1 week) with revision notes, (b) revise longer and resubmit later (request fresh reviewers if justified — new reviewers see old reviews only after submitting their own), (c) commit to a venue (optionally using the venue's "response to meta-review" field for committed revisions, revision history, or genuinely new meta-review issues), (d) pursue direct (non-ARR) review — note venue rules, e.g., TACL requires a 9-month gap after ARR submission.
- Resubmissions must include revisions addressing prior reviews or explicit justification for not doing so — violating this is a named desk-rejection cause.

**Reviewer-side duties (when serving):** read fully before searching related work; do not attempt to identify authors, disclose if you infer identity; write the review yourself (no generative first drafts; no uploading manuscripts or reviews to non-privacy-preserving tools); justify soundness scores; acknowledge author responses.

---

## 9. Rebuttal and camera-ready practice

**Rebuttal craft (ARR-constrained):**

1. Triage reviews within 24h: factual misunderstandings (answer directly with evidence), clarity objections (usually → revise and resubmit), judgment disagreements (one respectful paragraph, then stop).
2. Draft the general response as the meta-narrative: the 2–3 load-bearing misunderstandings and the concrete fixes committed for revision.
3. Per-review responses: mirror the reviewer's numbered weaknesses; each answer = restatement + pointer (+ small new result if solicited); explicitly say "we will revise §X to …" — ACs weight commitment to fix.
4. Character-budget discipline: 5K chars ≈ 700 words; put the strongest material first; never spend characters on tone management.
5. File review-issue reports only for due-diligence failures, with references; they signal to SACs but do not trigger revision.

**Camera-ready (\*ACL final version — ACLPUB final-version checklist, <https://www.cs.jhu.edu/~post/tmp/aclpub/final-version.html> and venue instructions):**

- Incorporate reviewer/AC comments; use the extra page (9 long / 5 short) for that purpose.
- De-anonymize: author names/affiliations under the title, own-work citations de-anonymized, Acknowledgments added (unnumbered, before references, page-limit-exempt).
- Keep Limitations and Ethical Considerations sections (page-limit-exempt; no new experiments inside).
- Verify formatting with `aclpub_check`; A4, embedded Type-1 fonts, readable figures/tables, two-column appendices; update metadata (title, author order, abstract) in the submission system so the table of contents and Anthology record are correct.
- Refresh bibliography against the Anthology (`rebiber`); cite refereed versions.
- Complete the **copyright/license form** (§10) and finalize the **Responsible NLP Checklist**, which will be published with the paper.
- Attach supplementary material (code/data/datasheets/model cards) per venue instructions; ensure anonymized repos are replaced by canonical DOI'd archives where permitted.

---

## 10. Author-version and license checks

Before posting, sharing, or reusing any version of a paper or artifact, verify:

1. **Which version, which right.**
   - *Preprint / submitted version:* postable to arXiv and personal/institutional pages under both ACL and ACM policies; declare existing non-anonymous versions in the ARR form (they affect deanonymization, not eligibility, since the embargo was removed in Feb 2024).
   - *Accepted manuscript:* postable per publisher policy (ACM explicitly allows on homepage/institutional/funder/non-commercial repositories with an attribution statement).
   - *Version of Record:* ACL Anthology papers from 2016 onward are **CC BY 4.0** (pre-2016: CC BY-NC-SA 3.0) — freely redistributable with attribution (<https://aclanthology.org/faq/copyright/>). ACM VoR posting rights depend on the license chosen at rights completion (CC-BY works: anywhere; otherwise the listed repositories only).
2. **arXiv license choice.** Choose the arXiv license compatible with the venue's copyright form and your reuse plans: CC BY 4.0 aligns with ACL Anthology licensing; the minimal arXiv license suffices for distribution but restricts downstream reuse. Set it at first submission — it cannot be tightened later without friction.
3. **Third-party material.** Figures, tables, datasets, models, and code reused from others: check each license at the pinned version; CC-BY-NC assets cannot be used in commercial contexts; "open weights" ≠ "open source"; record license + version + URL in the paper and README. The ARR checklist explicitly asks whether use is consistent with the assets' licenses and intended use.
4. **Copyright forms.** Complete the venue's license-to-publish/copyright form accurately (ACL: CC BY grant for Anthology; ACM: non-exclusive license, authors retain copyright). Mismatched author lists/titles between form, PDF, and metadata delay publication.
5. **Anonymity residue.** Before camera-ready, scrub: git histories, file metadata, acknowledgments of grants/people, dataset collection pages that identify the lab, and analytics-capable links (TACL bans supplementary links partly for this reason).
6. **Not legal advice.** License determinations are informational; for commercial redistribution, read the license text at the pinned revision and consult counsel.

---

## 11. Research operations

The substrate that makes §§2–10 cheap instead of heroic:

- **Project skeleton per paper:** `paper/` (LaTeX + claim table + checklist), `experiments/` (configs, scripts, runs registry), `data/` (versioned pointers + datasheets), `artifacts/` (checkpoints, DOI'd archives), `reviews/` (reviews, responses, issue reports, decision log), `ops/` (budgets, deadlines, delegation contracts).
- **Deadline ledger:** ARR cycle deadlines, venue commitment deadlines, camera-ready, copyright form, checklist grace periods (ARR metadata/checklist: +48h) — with owners. Submit ≥1 hour before deadlines (ARR recommendation under system load).
- **Experiment registry:** every run logged with config hash, code commit, data version, seed set, compute, metrics, and the claim IDs (§3) it feeds. No untraceable numbers in the paper.
- **Budget and compute accounting:** track GPU-hours per experiment and in aggregate (checklist C reporting needs it anyway); pre-register the compute budget for the final-seed replications so "ran out of budget" never decides the statistics.
- **Version discipline:** paper, code, data, and artifact versions cross-referenced; every external share (preprint, supplementary, repo) tagged with the version it represents.
- **Gate reviews:** internal gate before each external milestone — pre-submission format/anonymity/checklist audit (use ARR's "common problems" list), pre-camera-ready rights-and-license audit (§10), pre-release artifact audit (§4).
- **Incident handling:** suspected misconduct or error (own or others') follows COPE flowchart logic: document, notify through designated channels, correct the record transparently; errata/corrections after publication per venue policy.

---

## 12. Scientific writing practice

Primary sources: Gopen & Swan, "The Science of Scientific Writing," *American Scientist* 78(6), 1990; Schimel, *Writing Science* (OUP, 2011); Peyton Jones, "How to Write a Great Research Paper" (talk/slides); Keshav (2007, reading); Heilmeier Catechism (DARPA) for framing; venue formatting guides in §1.

**Structure and story:**

1. **Frame with Heilmeier:** What are you trying to do? How is it done today, and what are the limits? What's new and why will it succeed? Who cares? What are the risks and payoffs? Costs? How will results be checked?
2. **Abstract = claim contract.** Problem, gap, approach, headline evidence (scoped numbers), one limitation-aware sentence. Every clause must map to the claim table (§3).
3. **Introduction arc:** context → problem → gap (with citations) → insight → contributions (numbered, checkable) → optional roadmap. Contributions are falsifiable statements, not topics.
4. **Reader-centric prose (Gopen & Swan):** put the topic (old information) at sentence start and the stress (new information) at the end; keep subject and verb adjacent; one paragraph = one point with a topic sentence; make the logical structure visible at the structural positions (titles, headings, first sentences).
5. **Methods for replicability:** a competent reader must be able to re-implement from the main text; defer exhaustive detail to appendix + artifact, but keep the decisions that affect interpretation in the body.
6. **Results as argument:** tables/figures answer "so what?" in caption and text; every table referenced and interpreted; report uncertainty (§5) in the same visual/numeric unit as the point estimate.
7. **Related work as positioning:** synthesize by family (§2.6); state precisely the delta to the 2–3 closest works; cite contemporaneous work honestly.
8. **Limitations without self-sabotage:** concrete, scoped, non-performative ("fails when … because …; mitigation is future work" — not "our method is not perfect").
9. **Revision workflow:** outline → claim table → figures-first draft → full draft → reverse outline → claim/evidence audit → anonymity/format audit → internal "reviewer simulation" against the actual ARR/NeurIPS review form → submit. After reviews: response (§9) then systematic revision with a per-comment change log.
10. **Style floor:** precise terms over hype; define metrics and abbreviations at first use; consistent notation; no unexplained acronyms in abstract; figures readable in grayscale at print size (ACLPUB font rules).

---

## 13. Proposed reusable `ai-research-frontier` skill structure

A skill packaging this practice, following the repository's existing skill layout (SKILL.md + progressive-disclosure references + scripts), to be added under `skills/ai-research-frontier/` (proposal only — not yet present in the repository):

```
ai-research-frontier/
├── SKILL.md                          # trigger description + workflow + hard gates (≤ ~6k words)
├── references/
│   ├── venues_and_policies.md        # §1: ARR/ACL/NeurIPS/ICML/ICLR/ACM/COPE, per-cycle check list
│   ├── literature_and_claims.md      # §§2–3: review protocol, evidence tiers, claim table schema
│   ├── reproducibility_and_stats.md  # §§4–5: artifact set, checklists, test-selection table
│   ├── ethics_and_documentation.md   # §§6–7: datasheets/model cards, checklist Q&A guidance
│   ├── review_and_publication.md     # §§8–10: rebuttal mechanics, camera-ready, license matrix
│   └── writing.md                    # §12: structure, style, revision workflow
├── scripts/
│   ├── claim_audit.py                # claim↔evidence table consistency check (non-executing lint)
│   ├── submission_preflight.py       # format/anonymity/checklist/page-limit audit vs. venue rules
│   └── paper_index.py                # builds/validates the paper/network dataset (§14)
└── assets/
    ├── claim_table.template.csv
    ├── rebuttal_planner.template.md
    └── camera_ready_checklist.template.md
```

Design rules (matching repository conventions): frontmatter `name` + `description` optimized for routing; workflow numbered and gate-ordered; hard ethics/provenance gates in SKILL.md *before* the workflow; scripts are non-executing audits/validators (no downloads, no network); venue specifics live in `references/venues_and_policies.md` with "re-check current cycle" warnings; a "Composition, waiting, and shared budgets" section binding the skill to `organization/skill_collaboration_protocol.md`.

---

## 14. Paper / citation-network dataset schema (proposal)

JSON record per paper, sufficient to drive literature reviews (§2), claim mapping (§3), and a citation/author network. Top-level collections: `papers`, `edges`, `venues`, `authors`.

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
  "checklist": {"responsible_nlp": "published", "neurips_style": "yes|no|na"},
  "reproducibility": {"code_available": true, "data_available": true, "env_spec": true,
                      "hyperparameters_reported": true, "error_bars": true},
  "notes": "...", "tags": ["survey-seed"]
}
```

**Edge records** (citation/derivation network):

```json
{"edge_id": "...", "src": "paper_id", "dst": "paper_id",
 "type": "cites|extends|benchmarks-on|reproduces|contradicts|supersedes|dataset-of|model-of",
 "context": "section/sentence where the edge is asserted",
 "polarity": "support|neutral|critique", "confidence": "verified|inferred"}
```

Validation rules: `paper_id` resolvable to exactly one identifier; `evidence.tier` consistent with `venue.peer_reviewed`; every `metrics[].baseline_source` set; every `claims[].evidence_pointer` present; `license.*` from a controlled vocabulary (SPDX/CC); edges acyclic for `supersedes`. This schema is consumable by the proposed `paper_index.py` and interoperates with OpenAlex/Semantic Scholar ingestion.

---

## 15. Source index (all accessed 2026-11-20)

**ACL/ARR:** ARR Authors <https://aclrollingreview.org/authors> · ARR CFP <https://aclrollingreview.org/cfp> · Responsible NLP Checklist <https://aclrollingreview.org/responsibleNLPresearch/> · Common Submission Problems <https://aclrollingreview.org/authorchecklist> · Reviewer Guidelines <https://aclrollingreview.org/reviewerguidelines> · ARR authors.md (anonymity/preprints) <https://github.com/acl-org/aclrollingreview/blob/main/authors.md> · ACL Author Guidelines <https://www.aclweb.org/adminwiki/index.php/ACL_Author_Guidelines> · ACL Policy on Publication Ethics <https://www.aclweb.org/adminwiki/index.php/ACL_Policy_on_Publication_Ethics> · ACL Code of Ethics <https://www.aclweb.org/portal/content/acl-code-ethics> · ACLPUB formatting <https://acl-org.github.io/ACLPUB/formatting.html> · ACLPUB final version <https://www.cs.jhu.edu/~post/tmp/aclpub/final-version.html> · Anthology copyright <https://aclanthology.org/faq/copyright/> · TACL submissions <https://transacl.org/index.php/tacl/about/submissions>

**ML venues / reproducibility:** NeurIPS Paper Checklist <https://neurips.cc/public/guides/PaperChecklist> · NeurIPS Code Submission Policy <https://neurips.cc/public/guides/CodeSubmissionPolicy> · Pineau et al. 2021, JMLR 22(164) <https://www.jmlr.org/papers/volume22/20-303/20-303.pdf> · Dodge et al. 2019, EMNLP-IJCNLP ("Show Your Work") <https://aclanthology.org/D19-1224/> · Rogers, Baldwin & Leins 2021, Findings of EMNLP (responsible data checklist) <https://aclanthology.org/2021.findings-emnlp.414/> · ACM Artifact Review & Badging v1.1 <https://www.acm.org/publications/policies/artifact-review-and-badging-current> · ACM Publication Rights & Licensing <https://www.acm.org/publications/policies/publication-rights-and-licensing-policy>

**Statistics:** Dror et al. 2018, ACL <https://aclanthology.org/P18-1128/> · test appendix <https://arxiv.org/abs/1809.01448> · Reimers & Gurevych 2017, EMNLP <https://aclanthology.org/D17-1035/> · Dror et al. 2017 (replicability analysis) · Koehn 2004 (bootstrap for MT)

**Documentation:** Mitchell et al. 2019, FAT* <https://dl.acm.org/doi/10.1145/3287560.3287596> · Gebru et al. 2021, CACM <https://arxiv.org/abs/1803.09010> · Bender & Friedman 2018, TACL <https://aclanthology.org/Q18-1041/> · Pushkarna et al. 2022, FAccT (Data Cards)

**Ethics:** COPE <https://publicationethics.org/> · Core Practices → Code of Conduct history <https://publicationethics.org/about/what-we-do/our-story/history-code-conduct> · Principles of Transparency <https://publicationethics.org/guidance/guideline/principles-transparency-and-best-practice-scholarly-publishing>

**Literature/writing methods:** Keshav 2007, SIGCOMM CCR 37(3) · Page et al. 2021 (PRISMA 2020), BMJ 372:n71 · Wohlin 2014 (snowballing), EASE · Gopen & Swan 1990, American Scientist 78(6) · Schimel 2011, *Writing Science*, OUP · Heilmeier Catechism (DARPA) · Wilkinson et al. 2016 (FAIR), *Scientific Data* 3:160018

*Charters for the three collaborating roles implementing this practice live in `scientific-research-library/agents/` (see header).*
