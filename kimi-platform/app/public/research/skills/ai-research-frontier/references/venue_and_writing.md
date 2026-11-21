# Venues, Publication Mechanics, and Scientific Writing

**Point-in-time baseline:** 2026-11-20. Venue policies change every cycle — **re-open the cited official page for the current cycle before acting on any rule below**, and record the access date in the compliance decision record.

## 1. Venue landscape

### 1.1 ACL Rolling Review (ARR)

Shared peer-review service for ACL, NAACL, EACL, EMNLP, and other \*CL venues; venues make acceptance decisions on committed papers.

- **Cycle model.** Two-monthly submission deadlines, firm, "anywhere on Earth"; submissions via OpenReview. After review: revise-and-resubmit to a later cycle **or** commit reviews to a venue by its commitment deadline — mutually exclusive options. From the October 2026 cycle ARR operates under ACL's sustainable-reviewing policy (review guarantee tied to contributing qualified reviewers; per-author submission caps) — check the current cycle announcement. Sources: <https://aclrollingreview.org/authors>, <https://aclrollingreview.org/cfp>.
- **Desk-rejection causes.** Formatting/anonymity violations; dual submissions; self-plagiarism; incorrect/incomplete/misleading Responsible NLP Checklist; resubmission-policy violations; appendix format abuse; page-limit gaming (results hidden in Limitations); fabricated references ("hallucitations"); hidden prompt injections targeting machine readers; papers two chairs judge clearly below the top-tier bar. Source: <https://aclrollingreview.org/cfp>, <https://aclrollingreview.org/authorchecklist>.
- **Originality.** ≤10% token overlap with any other submitted/published work (own preprints excluded); concurrent related submissions with overlapping authors must cite each other as `Anonymous (YEAR). Title. Under review.` and be uploaded as anonymized supplementary material.
- **Citation obligations.** Cite all relevant refereed publications; cite refereed versions in addition to/instead of superseded preprints; work appearing <3 months before the deadline is "contemporaneous" — it relieves deep comparison, never citation.
- **Anonymity.** Double-blind; since 2024-02-15 there is no preprint embargo, but the submission itself must be anonymized and non-anonymous versions declared. Source: <https://github.com/acl-org/aclrollingreview/blob/main/authors.md>.
- **Review form.** Soundness (justified in text), Excitement (explicitly subjective), Overall Assessment (Award / Conference / Findings / Resubmit bands), reproducibility judgment. Reviewer guidelines forbid lazy heuristics ("not novel" without citation, "not SOTA", "too simple"). Source: <https://aclrollingreview.org/reviewerguidelines>.

### 1.2 ACL formatting and ethics

- **ACLPUB formatting** (<https://acl-org.github.io/ACLPUB/formatting.html>, updated January 2025): mandatory **Limitations** section (no new experiments/figures/analysis; after conclusion, before references; page-limit-exempt); optional **Ethical Considerations** (same placement/exemption); unnumbered Acknowledgments before references, omitted from review versions. Page limits 8/4 (long/short) at submission, +1 at camera-ready; Limitations, Ethics, Acknowledgments, references exempt. Use the official template unmodified; validate with `aclpub_check`; refresh `.bib` with `rebiber`.
- **ACL Code of Ethics** (<https://www.aclweb.org/portal/content/acl-code-ethics>): competence, honest representation, privacy, non-discrimination, harm avoidance, transparency about limitations.
- **ACL Policy on Publication Ethics** (<https://www.aclweb.org/adminwiki/index.php/ACL_Policy_on_Publication_Ethics>): authorship per the four Vancouver/ICMJE criteria; generative models cannot be authors; COI disclosure; coordinated disclosure for newly documented harmful-behavior techniques (contact developers ≥30 days before first public disclosure; document who/when/how); reviewer conduct rules; generative-assistance rules for reviewers.
- **AI assistance (authors).** Disclose writing/coding assistance (checklist + acknowledgments); authors remain responsible for all correctness; prompt injections aimed at machine readers → desk rejection or retraction.

### 1.3 NeurIPS / ICML / ICLR

- **NeurIPS Paper Checklist** (<https://neurips.cc/public/guides/PaperChecklist>): claims match contributions; limitations; theory assumptions and complete proofs; experimental reproducibility — *some reasonable avenue* required even without code release; open access to data/code with exact run instructions (see the Code Submission Policy, anonymized repos at submission); full training/test details; error bars; compute; human-subjects, dataset documentation, broader impacts. Answers are visible to reviewers. Origin and measured effects: Pineau et al., *JMLR* 22(164), 2021.
- **ICML.** Double-blind; code submission operationally expected; concurrent overlapping submissions must cite each other. Venue-year calls at <https://icml.cc>.
- **ICLR.** Public review on OpenReview; anonymized submissions; checklists harmonized with NeurIPS. Venue-year calls at <https://iclr.cc>.

### 1.4 ACM venues and artifact evaluation

- **Artifact Review and Badging v1.1** (<https://www.acm.org/publications/policies/artifact-review-and-badging-current>): *Artifacts Available* (public archival repository with DOI; personal pages not acceptable), *Artifacts Evaluated – Functional*, *Artifacts Evaluated – Reusable*, *Results Reproduced* (independent team, author artifacts), *Results Replicated* (independent team, no author artifacts). Terminology: repeatability = same team/artifacts; reproducibility = different team/same artifacts; replicability = different team/different artifacts.
- **Publication rights** (<https://www.acm.org/publications/policies/publication-rights-and-licensing-policy>): authors retain copyright, grant ACM a non-exclusive license; from 2026-01-01 the CC options are CC-BY and CC-BY-NC-ND. Preprint/submitted/accepted versions postable on homepage, institutional, funder, and non-commercial repositories; CC-licensed works may post the VoR anywhere.

### 1.5 COPE

The cross-venue ethics backbone: a Code of Conduct plus Core Principles (integrity of the scholarly record, transparent misconduct handling, whistleblower protection, corrections/retractions, FAIR/CARE data, funding disclosure) — the successor to the 10 Core Practices. COPE flowcharts are the reference process for suspected plagiarism, fabrication, duplicate submission, and authorship disputes. Source: <https://publicationethics.org/>.

### 1.6 Per-cycle re-verification list

Before any venue-dependent decision, re-open and date-check: the current ARR cycle CFP and deadlines; the Responsible NLP Checklist; the target venue's call and commitment deadline; the current ACLPUB formatting page; the current author-response rules; the venue's rights/copyright form. Log each check (page, access date) in the compliance decision record.

## 2. Author response (rebuttal) mechanics — current ARR rules

- One general response + one per-review response, each ≤5,000 characters, **text-only, no links or images** (violation → desk rejection).
- New results only as minor direct responses to reviewer questions (an ablation, a hyperparameter variant, one extra baseline) — never unsolicited headline results.
- Triage reviews within 24h: factual misunderstanding (answer with evidence pointer), clarity objection (commit to revision), judgment disagreement (one respectful paragraph, then stop).
- The real audience is the Area Chair writing the meta-review: quote the criticism, answer with a section/table pointer or small solicited result, state the concrete committed revision ("we will revise §X to …").
- Do not press for score changes. Flag guideline-violating reviews (unsupported "not novel", score/text mismatch, lazy heuristics) through the official review-issue mechanism with specifics — never by contacting reviewers.
- After the meta-review: revise and resubmit (~1 week, with revision notes), revise longer (fresh reviewers may be requested), commit to a venue, or pursue direct review (note venue rules, e.g., the TACL 9-month gap after ARR submission). Resubmissions must address prior reviews or justify not doing so.

## 3. Camera-ready and author-version/license checks

**Camera-ready (\*ACL):** incorporate reviewer/AC comments using the extra page (9 long / 5 short); de-anonymize (authors, own-work citations, Acknowledgments); keep Limitations and Ethical Considerations; verify with `aclpub_check` (A4, embedded fonts, readable figures, two-column appendices); update submission-system metadata (title, author order, abstract); refresh the bibliography with `rebiber` and cite refereed versions; complete the copyright/license form; finalize the Responsible NLP Checklist — it is published with the paper; replace anonymized repos with canonical DOI'd archives where permitted.

**Author-version matrix (verify before posting any version):**

| Version | ACL | ACM |
|---|---|---|
| Preprint / submitted | arXiv and personal/institutional pages OK; declare in ARR form | Same, with attribution statement |
| Accepted manuscript | Per venue policy | Homepage/institutional/funder/non-commercial repositories |
| Version of Record | CC BY 4.0 (2016+; CC BY-NC-SA 3.0 earlier) — redistributable with attribution | Depends on license chosen at rights completion (CC-BY: anywhere) |

- **arXiv license choice:** CC BY 4.0 aligns with ACL Anthology licensing; set it at first submission.
- **Third-party material:** check each reused figure/table/dataset/model/code license at the pinned version; record license + version + URL in paper and README. "Open weights" ≠ "open source."
- **Anonymity residue:** before camera-ready, scrub git histories, file metadata, grant/person acknowledgments, lab-identifying dataset pages, and analytics-capable links.
- License determinations are informational, never legal advice.

## 4. Scientific writing practice

1. **Abstract = claim contract.** Problem, gap, approach, headline evidence (scoped numbers), one limitation-aware sentence. Every clause maps to the claim table.
2. **Introduction arc.** Context → problem → gap (with citations) → insight → numbered, checkable contributions → optional roadmap. Contributions are falsifiable statements, not topics.
3. **Reader-centric prose (Gopen & Swan 1990).** Topic/old information at sentence start, stress/new information at the end; subject and verb adjacent; one paragraph = one point; make logic visible at structural positions (titles, headings, first sentences).
4. **Methods for replicability.** A competent reader must be able to re-implement from the main text; exhaustive detail goes to appendix + artifact, but interpretation-affecting decisions stay in the body.
5. **Results as argument.** Every table/figure answers "so what?" in caption and text; report uncertainty in the same unit as the point estimate.
6. **Related work as positioning.** Synthesize by approach family; end each family with the open problem; state the precise delta to the 2–3 closest works; cite contemporaneous work honestly. Never a laundry list.
7. **Limitations without self-sabotage.** Concrete and scoped: "fails when … because …; mitigation is future work." No new experiments inside (ACLPUB rule).
8. **Revision workflow.** Outline → claim table → figures-first draft → full draft → reverse outline → claim/evidence audit → anonymity/format audit → internal reviewer simulation against the actual review form → submit. After reviews: response, then systematic revision with a per-comment change log and a claim diff.
9. **Style floor.** Precise terms over hype; define metrics and abbreviations at first use; consistent notation; no unexplained acronyms in the abstract; figures readable in grayscale at print size.

**Primary sources:** Gopen & Swan, *American Scientist* 78(6), 1990 · Schimel, *Writing Science* (OUP, 2011) · Keshav, *ACM SIGCOMM CCR* 37(3), 2007 · Heilmeier Catechism (DARPA) · Pineau et al., *JMLR* 22(164), 2021.
