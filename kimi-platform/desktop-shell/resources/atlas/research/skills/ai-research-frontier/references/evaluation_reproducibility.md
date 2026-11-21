# Baselines, Statistical Evaluation, and Reproducibility

**Standard:** an independent researcher can regenerate the main tables/figures from the artifact alone — the bar behind ACM's *Functional/Reusable/Reproduced* badges and the NeurIPS reproducibility checklist item.

## 1. Baseline discipline

- Re-run baselines in your own common harness wherever possible. Numbers copied from other papers are labeled **copied**, with the source's data-version/preprocessing/harness caveats — different harnesses manufacture fake deltas.
- Tune baselines honestly: the same search budget protocol applies to baselines as to the proposed method; an untuned baseline is a planted weakness reviewers will find.
- The test split is sacred: model and hyperparameter selection use dev only; test is touched at pre-declared evaluation points, and every touch is logged.
- Negative results are results: log them with the same provenance as headline numbers; never silently drop them to protect a narrative.

## 2. Statistical evaluation

Reference standard: Dror, Baumer, Shlomov & Reichart, "The Hitchhiker's Guide to Testing Statistical Significance in NLP," ACL 2018 (<https://aclanthology.org/P18-1128/>, test-recommendation appendix arXiv:1809.01448). Their ACL 2017 audit — of 180 experimental long papers, 63 tested significance, 42 named the test, 36 used it correctly — is the lens reviewers apply.

1. **Paired tests for same-test-set comparisons.** Systems evaluated on the same examples are dependent samples: paired bootstrap or approximate randomization (permutation) as default; McNemar for 2×2 contingency outcomes; Wilcoxon signed-rank for perplexity-like large-outcome-space metrics; paired t-test only where normality is defensible.
2. **Bootstrap CIs everywhere.** Report 95% CIs (percentile or BCa) on headline metrics; CIs communicate precision even where significance testing is inappropriate.
3. **Multiple comparisons.** Pre-declare the primary hypothesis set; control family-wise error (Bonferroni/Holm) for confirmatory claim families; for cross-validation or multi-dataset claims use per-fold tests plus replicability analysis. Label post-hoc comparisons exploratory.
4. **Effect size and practical significance.** A significant 0.1-point delta may be meaningless; report effect size and argue whether it matters for the application.
5. **Test-set realities.** Bootstrap assumes the test set represents the population; small or skewed test sets invalidate it — say so. Report dataset size, split provenance, and contamination checks.
6. **Variance sources.** Separate seed variance, data-order variance, and (for LLM systems) sampling/decoding variance; for LLM-as-judge or generation metrics, fix seeds/temperatures and report judge agreement. Single-seed headline numbers are *exploratory*, not publishable — seed-variance distributions routinely exceed claimed SOTA deltas (Reimers & Gurevych, EMNLP 2017).
7. **Human evaluation.** Report annotator counts, recruitment/payment, full instructions, inter-annotator agreement (Krippendorff's α or similar), and power considerations; crowdwork protocols may require IRB/ethics-board approval or documented exemption.
8. **Contamination.** Check train/test leakage and benchmark-in-pretraining overlap; disclose findings with the results, including effect size where estimable. Never launder contamination out of the narrative.

## 3. Minimum artifact set

Convergent across NeurIPS/AAAI/IJCAI checklists and ACM badging:

1. Runnable source code, pinned commit.
2. Datasets or immutable links + version IDs (DOI, revision hash, checksums).
3. Pre-trained checkpoints where training cost is material, or exact training recipes.
4. A single entry-point command/script that regenerates each reported metric (evaluation harness), including baselines.
5. Machine-readable environment (`requirements.txt` / `environment.yml` / Dockerfile) with framework, CUDA/driver, and hardware recorded.
6. A README binding 1–5 into one workflow, with expected runtime and compute.

Self-audit against all six before declaring a paper submittable; justify every "no." "No" is acceptable only with justification, and never when the artifact *is* the contribution (e.g., a new open benchmark). Closed/proprietary constraints: document the reproducibility *avenue* explicitly (hosted access, API, partial release).

## 4. Reporting requirements (checklist lineage)

From the NLP Reproducibility Checklist (Dodge et al., "Show Your Work," EMNLP-IJCNLP 2019), folded into ARR checklist section C and the NeurIPS-style checklist:

- Hyperparameter search protocol (grid/random/manual), ranges tried, **best-found values**, number of trials, and which split was used for selection.
- Descriptive statistics across runs: mean/std or CIs over ≥3 seeds (≥5 preferred); state whether reported numbers are mean/median/best.
- Exact train/dev/test splits and dataset versions; preprocessing steps.
- Compute: GPU/TPU type × count, wall-clock, total GPU-hours, framework versions; expected validation results so re-runners detect silent divergence.
- Model selection rule (early-stopping criterion, checkpoint selection).

## 5. Process habits

- Keep a deterministic "golden config" per headline result; re-execute it within tolerance before the evidence pack ships ("reproduce yourself first").
- Pre-register the compute budget for final-seed replications so "ran out of budget" never decides the statistics.
- Archive the artifact to a DOI-minting repository (Zenodo/figshare/Dryad) at camera-ready — GitHub links alone do not satisfy ACM *Artifacts Available*.
- Maintain an experiment registry: every run logged with config hash, code commit, data version, seed set, compute, metrics, and the claim IDs it feeds. No untraceable numbers anywhere downstream.
- Conflicts between evidence packs (e.g., contradictory baseline numbers) are resolved by re-derivation and provenance ranking, not by averaging; document both bundles if unresolved.
- Downloads and execution of third-party code are explicit-consent actions: quarantine-staged, license-checked first; flag `trust_remote_code` paths and never silently accept them; treat model files and repo-shipped Python as untrusted code.
