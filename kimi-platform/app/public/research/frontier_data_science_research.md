# Frontier Data Science and Machine Learning Research Dataset

**Version:** 1.0.0  
**Compiled:** 2026-11-21  
**Verification date:** 2026-11-21  
**Records:** 30 (14 frontier 2025-2026; 16 seminal foundations)  
**Companion machine-readable dataset:** [`frontier_data_science_papers.json`](./frontier_data_science_papers.json)

## Executive summary

This dataset pairs fourteen 2025-2026 frontier papers with sixteen influential foundations across statistical learning, causal inference, uncertainty, time series, tabular/data-centric AI, AutoML, recommender systems, graph ML, federated learning, privacy/fairness, MLOps/evaluation, and decision-making/reinforcement learning. Every record carries the same rich metadata schema: authors, year, venue/status, URLs, code/data, license/access, topics, methods, benchmarks, contribution, limitations, research relevance, provenance, and verification date.

Key status distinctions:

- **Peer-reviewed frontier records:** 14.
- **Explicit preprint-only records:** 1 (Proximal Policy Optimization Algorithms).
- **Explicit vendor/industrial benchmarks:** 1 (RecFlow: An Industrial Full Flow Recommendation Dataset).
- **Records with verified code/data artifact links:** 20 of 30.

## Scope and method

1. Selected 2025-2026 frontier papers from official OpenReview, NeurIPS, ICML/PMLR, and ICLR records and paired them with influential foundations.
2. Cross-checked titles, author lists, venue/status, abstracts, and links against official proceedings pages, OpenReview, PMLR, ACM, AAAI, arXiv, Google Scholar/Semantic Scholar-indexed search results, and verified GitHub repositories.
3. A URL is listed only when its landing page or repository was directly checked; missing code/data is represented as an empty artifact list rather than inferred.
4. Preprints and vendor-authored or industrial benchmarks are explicitly flagged in provenance; acceptance status is taken from the venue/proceedings record, not from the arXiv version.

### Verification protocol

- **Primary authority:** official OpenReview, NeurIPS proceedings, ICML/PMLR, ICLR, AAAI, ACM, and arXiv records. Where a preprint and accepted version differed, the venue/proceedings record controlled title, authors, year, and status.
- **Scholarly cross-check:** title-exact Google Scholar/Semantic Scholar-indexed searches were used to detect citation variants, author mismatches, and preprint-versus-proceedings collisions; Scholar was not allowed to override official proceedings.
- **Artifact check:** GitHub links were checked through the GitHub REST/MCP interfaces and repository license files where available. Empty `code_data` means no official artifact was verified; it does not prove that no artifact exists.
- **URL audit:** 103 unique URLs were checked on 2026-11-21. Most resolved directly with HTTP 200. OpenReview PDF and ACM pages commonly returned 403 to non-browser clients, AAAI returned a transient 520 after an earlier successful fetch, and several GitHub web-page requests timed out; each such URL was resolved through the corresponding official search/API/repository channel. No unresolved canonical paper URL remains.
- **Access caution:** `open` denotes that an official paper or manuscript was readable without payment at verification time. ACM records may enforce institution/login requirements for some users. Null licenses mean no license was verified, not that reuse is permitted.

## Dataset schema

| Field | Meaning |
|---|---|
| `record_id` | Stable topic/year slug |
| `title`, `authors`, `year`, `era` | Bibliographic identity and foundation/frontier role |
| `venue`, `publication_status` | Official venue and peer-review/presentation/preprint status |
| `topics`, `methods`, `benchmarks` | Research area, technical approach, datasets/tasks/baselines |
| `urls` | Canonical proceedings/OpenReview/arXiv/DOI/PDF links; only checked links included |
| `code_data` | Typed official/author artifacts with URL, availability, and license |
| `access` | Paper, code, and data access/license statements |
| `contribution`, `limitations`, `research_relevance` | Analytical synthesis for dataset users |
| `provenance` | Vendor affiliation, vendor-benchmark flag, preprint flag, verification-source classes |
| `verification_date` | Date the record was checked |

## Topic coverage

| Area | Records | Frontier selections | Foundation selections |
|---|---:|---|---|
| Statistical learning | 2 | On the sample complexity of semi-supervised multi-objective learning | Deep Double Descent: Where Bigger Models and More Data Hurt |
| Causal inference | 2 | Conformal Prediction for Causal Effects of Continuous Treatments | Estimating individual treatment effect: generalization bounds and algorithms |
| Uncertainty | 2 | Conformal Structured Prediction | Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles |
| Time series | 2 | Timer-XL: Long-Context Transformers for Unified Time Series Forecasting | Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting |
| Tabular/data-centric AI | 3 | ConTextTab: A Semantics-Aware Tabular In-Context Learner | Why do tree-based models still outperform deep learning on typical tabular data?; TabPFN: A Transformer That Solves Small Tabular Classification Problems in a Second |
| AutoML | 2 | AutoML-Agent: A Multi-Agent LLM Framework for Full-Pipeline AutoML | Efficient Neural Architecture Search via Parameters Sharing |
| Recommender systems | 2 | RecFlow: An Industrial Full Flow Recommendation Dataset | Neural Collaborative Filtering |
| Graph ML | 2 | AutoGFM: Automated Graph Foundation Model with Adaptive Architecture Customization | Semi-Supervised Classification with Graph Convolutional Networks |
| Federated learning | 2 | Energy-based Backdoor Defense Against Federated Graph Learning | Communication-Efficient Learning of Deep Networks from Decentralized Data |
| Privacy/fairness | 4 | Approximate Differential Privacy of the ℓ2 Mechanism; Fairness under Competition | Deep Learning with Differential Privacy; Equality of Opportunity in Supervised Learning |
| MLOps/evaluation | 3 | Benchmark Health Index: A Systematic Framework for Benchmarking the Benchmarks of LLMs | Hidden Technical Debt in Machine Learning Systems; Datasheets for Datasets |
| Decision-making/RL | 4 | Adaptive Neighborhood-Constrained Q Learning for Offline Reinforcement Learning; Causal Flow Q-Learning for Robust Offline Reinforcement Learning | Proximal Policy Optimization Algorithms; Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor |

## Record index

| # | Record ID | Year | Era | Venue/status | Preprint? | Vendor benchmark? |
|---:|---|---:|---|---|---|---|
| 1 | `stat-2020-double-descent` | 2020 | foundation | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2020 Poster | no | no |
| 2 | `stat-2025-semisupervised-mol` | 2025 | frontier | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper; NeurIPS 2025 Spotlight Poster | no | no |
| 3 | `causal-2017-ite` | 2017 | foundation | International Conference on Machine Learning (ICML), PMLR 70 — peer-reviewed conference paper | no | no |
| 4 | `causal-2025-conformal-continuous` | 2025 | frontier | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper; NeurIPS 2025 Poster | no | no |
| 5 | `uncertainty-2017-deep-ensembles` | 2017 | foundation | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper | no | no |
| 6 | `uncertainty-2025-conformal-structured` | 2025 | frontier | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2025 Poster | no | no |
| 7 | `timeseries-2021-informer` | 2021 | foundation | AAAI Conference on Artificial Intelligence — peer-reviewed conference paper; AAAI 2021 Outstanding Paper | no | no |
| 8 | `timeseries-2025-timer-xl` | 2025 | frontier | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2025 Poster | no | no |
| 9 | `tabular-2022-tree-benchmark` | 2022 | foundation | NeurIPS 2022 Datasets and Benchmarks — peer-reviewed conference paper | no | no |
| 10 | `tabular-2025-contexttab` | 2025 | frontier | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper; NeurIPS 2025 Spotlight | no | no |
| 11 | `tabular-2023-tabpfn` | 2023 | foundation | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2023 Poster | no | no |
| 12 | `automl-2018-enas` | 2018 | foundation | International Conference on Machine Learning (ICML), PMLR 80 — peer-reviewed conference paper; official PMLR title uses 'Parameters Sharing' | no | no |
| 13 | `automl-2025-agent` | 2025 | frontier | International Conference on Machine Learning (ICML), PMLR 267 — peer-reviewed conference paper | no | no |
| 14 | `recsys-2017-ncf` | 2017 | foundation | International World Wide Web Conference (WWW) — peer-reviewed conference paper | no | no |
| 15 | `recsys-2025-recflow` | 2025 | frontier | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2025 Poster; industrial benchmark | no | yes |
| 16 | `graph-2017-gcn` | 2017 | foundation | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper | no | no |
| 17 | `graph-2025-autogfm` | 2025 | frontier | International Conference on Machine Learning (ICML), PMLR 267 — peer-reviewed conference paper; ICML 2025 Oral | no | no |
| 18 | `federated-2017-fedavg` | 2017 | foundation | International Conference on Artificial Intelligence and Statistics (AISTATS), PMLR 54 — peer-reviewed conference paper | no | no |
| 19 | `federated-2025-fedtge` | 2025 | frontier | International Conference on Learning Representations (ICLR) — peer-reviewed conference paper; ICLR 2025 Oral | no | no |
| 20 | `privacy-2016-dp-sgd` | 2016 | foundation | ACM SIGSAC Conference on Computer and Communications Security (CCS) — peer-reviewed conference paper | no | no |
| 21 | `fairness-2016-equality-opportunity` | 2016 | foundation | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper | no | no |
| 22 | `privacy-2025-approx-dp-l2` | 2025 | frontier | International Conference on Machine Learning (ICML), PMLR 267 — peer-reviewed conference paper | no | no |
| 23 | `fairness-2025-competition` | 2025 | frontier | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper | no | no |
| 24 | `mlops-2015-hidden-debt` | 2015 | foundation | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper | no | no |
| 25 | `mlops-2021-datasheets` | 2021 | foundation | Communications of the ACM 64(12) — peer-reviewed journal article; earlier versions circulated from 2018 | no | no |
| 26 | `evaluation-2026-bhi` | 2026 | frontier | NeurIPS Evaluations and Datasets Track — peer-reviewed conference paper; NeurIPS 2026 Oral | no | no |
| 27 | `rl-2017-ppo` | 2017 | foundation | arXiv — arXiv preprint; not peer-reviewed; vendor-authored OpenAI paper | yes | no |
| 28 | `rl-2018-sac` | 2018 | foundation | International Conference on Machine Learning (ICML), PMLR 80 — peer-reviewed conference paper | no | no |
| 29 | `rl-2025-anq` | 2025 | frontier | Advances in Neural Information Processing Systems (NeurIPS) — peer-reviewed conference paper; NeurIPS 2025 Spotlight | no | no |
| 30 | `rl-2026-causal-flow-q` | 2026 | frontier | International Conference on Machine Learning (ICML) — peer-reviewed conference paper; ICML 2026 regular paper | no | no |

## Detailed records

### 1. Deep Double Descent: Where Bigger Models and More Data Hurt

- **Record ID:** `stat-2020-double-descent`
- **Authors:** Preetum Nakkiran, Gal Kaplun, Yamini Bansal, Tristan Yang, Boaz Barak, Ilya Sutskever
- **Year / era:** 2020 / foundation
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2020 Poster
- **Topics:** statistical learning, generalization, model scaling, interpolation
- **Methods:** empirical scaling analysis, effective model complexity, overparameterized neural networks, label-noise experiments
- **Benchmarks:** CIFAR-10, CIFAR-100, IWSLT'14 German-English, ResNet-18, CNN(width), Transformers
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=B1g5sA4twr
  - `pdf`: https://openreview.net/pdf?id=B1g5sA4twr
  - `arxiv`: https://arxiv.org/abs/1912.02292
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** CC BY-SA 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** public benchmark datasets
- **Contribution:** Unified double-descent behavior across model size, sample size, and training time, challenging the classical U-shaped risk picture for modern overparameterized learners.
- **Limitations:** Primarily empirical; results depend on architecture, regularization, label noise, and training protocol and do not provide a complete finite-sample theory.
- **Research relevance:** A foundational reference for scaling laws, benign overfitting, interpolation regimes, and the statistical theory of deep learning.
- **Vendor affiliation:** OpenAI/Google-affiliated authors
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 2. On the sample complexity of semi-supervised multi-objective learning

- **Record ID:** `stat-2025-semisupervised-mol`
- **Authors:** Tobias Wegel, Geelon So, Junhyung Park, Fanny Yang
- **Year / era:** 2025 / frontier
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper; NeurIPS 2025 Spotlight Poster
- **Topics:** statistical learning, sample complexity, semi-supervised learning, multi-objective learning
- **Methods:** minimax analysis, Bregman-loss objectives, pseudo-labeling, upper and lower sample-complexity bounds
- **Benchmarks:** theoretical multi-objective prediction tasks, semi-supervised pseudo-labeling algorithm
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=IrgQe6YjKm
  - `official_proceedings`: https://papers.nips.cc/paper_files/paper/2025/hash/ba92c896779f1477b9fddf9f380ae3f3-Abstract-Conference.html
  - `arxiv`: https://arxiv.org/abs/2508.17152
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** not applicable
- **Contribution:** Separates when extra unlabeled data can reduce labeled-sample requirements in multi-objective learning from settings in which joint-model complexity creates an unavoidable statistical cost.
- **Limitations:** Results are loss- and assumption-specific; practical pseudo-labeling can degrade under distribution shift or poorly calibrated individual-task predictors.
- **Research relevance:** Connects modern multi-task/foundation-model training with classical statistical efficiency and motivates principled use of unlabeled data.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, NeurIPS proceedings, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 3. Estimating individual treatment effect: generalization bounds and algorithms

- **Record ID:** `causal-2017-ite`
- **Authors:** Uri Shalit, Fredrik D. Johansson, David Sontag
- **Year / era:** 2017 / foundation
- **Venue:** International Conference on Machine Learning (ICML), PMLR 70
- **Publication status:** peer-reviewed conference paper
- **Topics:** causal inference, individual treatment effects, representation learning, covariate shift
- **Methods:** counterfactual regression, integral probability metric regularization, representation learning, generalization bounds
- **Benchmarks:** IHDP, Jobs, CFRNet/TARNet variants
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v70/shalit17a.html
  - `pdf`: https://proceedings.mlr.press/v70/shalit17a/shalit17a.pdf
  - `arxiv`: https://arxiv.org/abs/1606.03976
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | author repository | MIT | https://github.com/clinicalml/cfrnet |
- **Paper access:** open
- **Paper license:** PMLR open access; copyright retained by authors
- **Code license:** MIT
- **Data access:** benchmark-dependent; repository documents preprocessing
- **Contribution:** Formalized ITE estimation error through a bound involving factual loss and treatment-group representation discrepancy, leading to CFRNet/TARNet.
- **Limitations:** Assumes ignorability and overlap; unmeasured confounding, high-dimensional text/images, and policy deployment remain outside the core guarantee.
- **Research relevance:** A standard baseline and theoretical bridge between representation learning and personalized causal effect estimation.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** PMLR, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 4. Conformal Prediction for Causal Effects of Continuous Treatments

- **Record ID:** `causal-2025-conformal-continuous`
- **Authors:** Maresa Schröder, Dennis Frauen, Jonas Schweisthal, Konstantin Heß, Valentyn Melnychuk, Stefan Feuerriegel
- **Year / era:** 2025 / frontier
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper; NeurIPS 2025 Poster
- **Topics:** causal inference, uncertainty quantification, continuous treatment, conformal prediction
- **Methods:** weighted conformal prediction, dose-response modeling, potential-outcome intervals, distribution-free calibration
- **Benchmarks:** semi-synthetic continuous-treatment tasks, potential-outcome prediction baselines
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=1nL84tQNnK
  - `pdf`: https://openreview.net/pdf?id=1nL84tQNnK
  - `arxiv`: https://arxiv.org/abs/2407.03094
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** benchmark-dependent
- **Contribution:** Extends finite-sample, distribution-free prediction intervals to potential outcomes under continuous doses, making uncertainty explicit for dose-response decisions.
- **Limitations:** Coverage still relies on exchangeability/weighted-exchangeability and causal identification assumptions; intervals can become conservative when overlap is weak.
- **Research relevance:** Directly supports safer personalized dosing and policy evaluation where point estimates of treatment response are insufficient.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, arXiv, NeurIPS submissions, Scholar search
- **Verification date:** 2026-11-21

### 5. Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles

- **Record ID:** `uncertainty-2017-deep-ensembles`
- **Authors:** Balaji Lakshminarayanan, Alexander Pritzel, Charles Blundell
- **Year / era:** 2017 / foundation
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper
- **Topics:** uncertainty quantification, deep ensembles, calibration, out-of-distribution detection
- **Methods:** independently trained neural-network ensembles, proper scoring rules, adversarial augmentation, predictive entropy decomposition
- **Benchmarks:** MNIST, SVHN, CIFAR-10, ImageNet, regression benchmarks
- **URLs:**
  - `canonical`: https://proceedings.neurips.cc/paper_files/paper/2017/hash/9ef2ed4b7fd2c810847ffa5fa85bce38-Abstract.html
  - `pdf`: https://proceedings.neurips.cc/paper_files/paper/2017/file/9ef2ed4b7fd2c810847ffa5fa85bce38-Paper.pdf
  - `arxiv`: https://arxiv.org/abs/1612.01474
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** NeurIPS open access; license not stated on landing page
- **Code license:** not verified
- **Data access:** public benchmarks
- **Contribution:** Established a practical, non-Bayesian baseline that improves predictive uncertainty and robustness by combining multiple independently optimized networks.
- **Limitations:** Training and inference cost scale with ensemble size; diversity is heuristic and does not guarantee calibrated or robust uncertainty under severe shift.
- **Research relevance:** Remains the reference baseline for calibration, OOD detection, active learning, and uncertainty-aware decision systems.
- **Vendor affiliation:** DeepMind
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** NeurIPS proceedings, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 6. Conformal Structured Prediction

- **Record ID:** `uncertainty-2025-conformal-structured`
- **Authors:** Botong Zhang, Shuo Li, Osbert Bastani
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2025 Poster
- **Topics:** uncertainty quantification, conformal prediction, structured prediction, optimization
- **Methods:** conformal calibration, structured-output prediction sets, exact and surrogate optimization, distribution-free coverage
- **Benchmarks:** structured prediction tasks, sequence and combinatorial-output evaluations
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=2ATD8a8P3C
  - `pdf`: https://openreview.net/pdf?id=2ATD8a8P3C
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** benchmark-dependent
- **Contribution:** Addresses the combinatorial explosion of conformal prediction sets when outputs are structured objects, providing calibrated sets with practical optimization procedures.
- **Limitations:** Optimization complexity and set size remain task dependent; marginal coverage need not imply conditional coverage for every structured subgroup.
- **Research relevance:** Important for reliable ML systems whose outputs are plans, sequences, graphs, rankings, or other structured decisions rather than scalar labels.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, ICLR record, Scholar search
- **Verification date:** 2026-11-21

### 7. Informer: Beyond Efficient Transformer for Long Sequence Time-Series Forecasting

- **Record ID:** `timeseries-2021-informer`
- **Authors:** Haoyi Zhou, Shanghang Zhang, Jieqi Peng, Shuai Zhang, Jianxin Li, Hui Xiong, Wancai Zhang
- **Year / era:** 2021 / foundation
- **Venue:** AAAI Conference on Artificial Intelligence
- **Publication status:** peer-reviewed conference paper; AAAI 2021 Outstanding Paper
- **Topics:** time series, long-sequence forecasting, efficient transformers
- **Methods:** ProbSparse self-attention, self-attention distilling, generative-style decoder, long-sequence forecasting
- **Benchmarks:** ETTh1, ETTh2, ETTm1, ECL, Weather
- **URLs:**
  - `canonical`: https://ojs.aaai.org/index.php/AAAI/article/view/17325
  - `arxiv`: https://arxiv.org/abs/2012.07436
  - `doi`: https://doi.org/10.1609/aaai.v35i12.17325
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_data_instructions | author repository | Apache-2.0 | https://github.com/zhouhaoyi/Informer2020 |
- **Paper access:** open
- **Paper license:** AAAI open access; license shown by venue page
- **Code license:** Apache-2.0
- **Data access:** public benchmark links in repository
- **Contribution:** Reduced the cost of applying transformers to very long forecasting horizons and became a widely reproduced long-sequence benchmark model.
- **Limitations:** Later work showed that simpler linear models can outperform it on some long-horizon benchmarks; architectural gains are sensitive to splits and evaluation protocols.
- **Research relevance:** A seminal reference point for efficient temporal attention and for scrutinizing modern time-series foundation models.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** AAAI, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 8. Timer-XL: Long-Context Transformers for Unified Time Series Forecasting

- **Record ID:** `timeseries-2025-timer-xl`
- **Authors:** Yong Liu, Guo Qin, Xiangdong Huang, Jianmin Wang, Mingsheng Long
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2025 Poster
- **Topics:** time series, foundation models, long-context forecasting, zero-shot learning
- **Methods:** decoder-only causal transformer, multivariate next-token prediction, universal TimeAttention, temporal and variable position embeddings, large-scale pretraining
- **Benchmarks:** univariate forecasting, multivariate forecasting, covariate-informed forecasting, zero-shot forecasting, ETT-family and standard TSF suites
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=KMCJXjlDDr
  - `pdf`: https://openreview.net/pdf?id=KMCJXjlDDr
  - `arxiv`: https://arxiv.org/abs/2410.04803
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_model_and_data_links | official repository | Apache-2.0 | https://github.com/thuml/Timer-XL |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** Apache-2.0
- **Data access:** repository links to OpenLTM, checkpoints, and public datasets
- **Contribution:** Casts univariate, multivariate, and covariate-informed forecasting as a unified long-context next-token problem and reports strong task-specific and zero-shot results.
- **Limitations:** Long-context attention remains compute intensive; pretrained-data composition and leakage controls need careful auditing when comparing against benchmark-specific models.
- **Research relevance:** A leading 2025 architecture for studying whether time-series foundation models generalize beyond narrow benchmark suites.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, ICLR virtual page, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 9. Why do tree-based models still outperform deep learning on typical tabular data?

- **Record ID:** `tabular-2022-tree-benchmark`
- **Authors:** Léo Grinsztajn, Edouard Oyallon, Gaël Varoquaux
- **Year / era:** 2022 / foundation
- **Venue:** NeurIPS 2022 Datasets and Benchmarks
- **Publication status:** peer-reviewed conference paper
- **Topics:** tabular learning, data-centric AI, benchmarking, gradient-boosted trees
- **Methods:** 45-dataset benchmark, gradient-boosted decision trees, random forests, MLPs, ResNet, FT-Transformer, hyperparameter search
- **Benchmarks:** 45 numerical and heterogeneous tabular datasets, classification and regression tasks
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=Fp7__phQszn
  - `pdf`: https://openreview.net/pdf?id=Fp7__phQszn
  - `arxiv`: https://arxiv.org/abs/2207.08815
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_benchmark_data | official repository | MIT | https://github.com/LeoGrin/tabular-benchmark |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** MIT
- **Data access:** public tabular datasets with repository loaders
- **Contribution:** Demonstrated that tuned tree ensembles remain strong on medium-sized heterogeneous tabular data and identified smoothness/rotation properties that disadvantage standard deep models.
- **Limitations:** Does not settle large-scale, multimodal, temporal, or text-heavy tabular settings; benchmark conclusions depend on tuning budget and dataset curation.
- **Research relevance:** A data-centric baseline for evaluating tabular foundation models and AutoML claims.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, NeurIPS record, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 10. ConTextTab: A Semantics-Aware Tabular In-Context Learner

- **Record ID:** `tabular-2025-contexttab`
- **Authors:** Marco Spinaci, Marek Polewczyk, Maximilian Schambach, Sam Thelin
- **Year / era:** 2025 / frontier
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper; NeurIPS 2025 Spotlight
- **Topics:** tabular learning, data-centric AI, foundation models, in-context learning
- **Methods:** semantic alignment, specialized modality embeddings, table-native in-context learning, large-scale real-world tabular pretraining
- **Benchmarks:** broad tabular prediction benchmark suite, CARTE, TabPFN, TabICL, TabuLa-8B
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=kGMRb4jbTP
  - `pdf`: https://openreview.net/pdf?id=kGMRb4jbTP
  - `arxiv`: https://arxiv.org/abs/2506.10707
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_model | official repository | MIT | https://github.com/SAP-samples/contexttab |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** MIT
- **Data access:** public benchmark datasets; model artifact in repository
- **Contribution:** Combines table-native in-context learning with semantic understanding and world knowledge through modality-aware embeddings and real-world tabular pretraining.
- **Limitations:** Performance depends on the availability and quality of meaningful column/table semantics; industrial deployment still requires privacy, leakage, and robustness audits.
- **Research relevance:** Shows how data-centric metadata and semantic context can improve tabular foundation models beyond purely numeric encodings.
- **Vendor affiliation:** SAP and academic collaborators
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, NeurIPS record, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 11. TabPFN: A Transformer That Solves Small Tabular Classification Problems in a Second

- **Record ID:** `tabular-2023-tabpfn`
- **Authors:** Noah Hollmann, Samuel Müller, Katharina Eggensperger, Frank Hutter
- **Year / era:** 2023 / foundation
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2023 Poster
- **Topics:** tabular learning, AutoML, prior-data fitted networks, in-context learning
- **Methods:** transformer pretraining on synthetic Bayesian priors, single-forward-pass posterior prediction, small-table classification
- **Benchmarks:** OpenML-CC18, small numerical tabular classification tasks, AutoML and boosted-tree baselines
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=cp5PvcI6w8_
  - `pdf`: https://openreview.net/pdf?id=cp5PvcI6w8_
  - `arxiv`: https://arxiv.org/abs/2207.01848
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_model | official repository | Apache-2.0 | https://github.com/PriorLabs/TabPFN |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** Apache-2.0
- **Data access:** public OpenML benchmarks
- **Contribution:** Reframed small-table classification as amortized Bayesian inference, obtaining fast predictions competitive with heavily tuned baselines.
- **Limitations:** Original version targets small classification tables and does not directly cover large datasets, regression, drift, or rich text/categorical semantics.
- **Research relevance:** A foundational tabular foundation-model paper linking AutoML, Bayesian model averaging, and in-context learning.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 12. Efficient Neural Architecture Search via Parameters Sharing

- **Record ID:** `automl-2018-enas`
- **Authors:** Hieu Pham, Melody Y. Guan, Barret Zoph, Quoc V. Le, Jeff Dean
- **Year / era:** 2018 / foundation
- **Venue:** International Conference on Machine Learning (ICML), PMLR 80
- **Publication status:** peer-reviewed conference paper; official PMLR title uses 'Parameters Sharing'
- **Topics:** AutoML, neural architecture search, parameter sharing, resource efficiency
- **Methods:** controller RNN, shared child-model parameters, reinforcement learning, neural architecture search
- **Benchmarks:** Penn Treebank, CIFAR-10, NAS search-cost comparisons
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v80/pham18a.html
  - `pdf`: https://proceedings.mlr.press/v80/pham18a/pham18a.pdf
  - `arxiv`: https://arxiv.org/abs/1802.03268
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | author repository | Apache-2.0 | https://github.com/melodyguan/enas |
- **Paper access:** open
- **Paper license:** PMLR open access; copyright retained by authors
- **Code license:** Apache-2.0
- **Data access:** public benchmarks
- **Contribution:** Reduced architecture-search cost by orders of magnitude through parameter sharing across candidate architectures.
- **Limitations:** Weight sharing introduces ranking bias and may not predict independently trained architecture performance; search remains task and controller dependent.
- **Research relevance:** A key bridge from expensive NAS to one-shot and differentiable AutoML methods.
- **Vendor affiliation:** Google Brain
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** PMLR, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 13. AutoML-Agent: A Multi-Agent LLM Framework for Full-Pipeline AutoML

- **Record ID:** `automl-2025-agent`
- **Authors:** Patara Trirat, Wonyong Jeong, Sung Ju Hwang
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Machine Learning (ICML), PMLR 267
- **Publication status:** peer-reviewed conference paper
- **Topics:** AutoML, LLM agents, full-pipeline ML, code generation, data-centric AI
- **Methods:** multi-agent planning, retrieval-augmented prompting, task decomposition, code synthesis, autonomous evaluation and debugging
- **Benchmarks:** seven task types, 14 datasets, DS-Agent, Data Interpreter, SELA, traditional AutoML frameworks
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v267/trirat25a.html
  - `pdf`: https://raw.githubusercontent.com/mlresearch/v267/main/assets/trirat25a/trirat25a.pdf
  - `arxiv`: https://arxiv.org/abs/2410.02958
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository | CC BY-NC 4.0 | https://github.com/deepauto-ai/automl-agent |
- **Paper access:** open
- **Paper license:** PMLR open access; copyright retained by authors
- **Code license:** CC BY-NC 4.0
- **Data access:** public benchmark datasets
- **Contribution:** Automates data analysis, model selection, implementation, evaluation, and iteration through coordinated LLM agents rather than optimizing a single pipeline component.
- **Limitations:** Agent runs can be costly and nondeterministic; generated pipelines require security, leakage, and reproducibility checks before production use.
- **Research relevance:** Defines a 2025 frontier for agentic, end-to-end AutoML and raises new evaluation questions beyond leaderboard accuracy.
- **Vendor affiliation:** KAIST/DeepAuto-affiliated artifact
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** PMLR, OpenReview, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 14. Neural Collaborative Filtering

- **Record ID:** `recsys-2017-ncf`
- **Authors:** Xiangnan He, Lizi Liao, Hanwang Zhang, Liqiang Nie, Xia Hu, Tat-Seng Chua
- **Year / era:** 2017 / foundation
- **Venue:** International World Wide Web Conference (WWW)
- **Publication status:** peer-reviewed conference paper
- **Topics:** recommender systems, collaborative filtering, implicit feedback, deep learning
- **Methods:** generalized matrix factorization, multi-layer perceptron, NeuMF fusion, negative sampling
- **Benchmarks:** MovieLens, Pinterest, HR@K, NDCG@K
- **URLs:**
  - `canonical`: https://dl.acm.org/doi/10.1145/3038912.3052569
  - `doi`: https://doi.org/10.1145/3038912.3052569
  - `arxiv`: https://arxiv.org/abs/1708.05031
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_data | author repository | MIT | https://github.com/hexiangnan/neural_collaborative_filtering |
- **Paper access:** publisher landing page; access may vary
- **Paper license:** ACM publication terms
- **Code license:** MIT
- **Data access:** MovieLens public; Pinterest data described in repository
- **Contribution:** Replaced the fixed inner product of matrix factorization with learned neural interaction functions, establishing an influential deep recommender baseline.
- **Limitations:** Later studies showed results are sensitive to negative sampling, splits, and tuning; the model uses IDs and does not directly handle rich context or sequential behavior.
- **Research relevance:** A foundational baseline for neural recommendation and for modern critiques of recommender evaluation protocols.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** ACM, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 15. RecFlow: An Industrial Full Flow Recommendation Dataset

- **Record ID:** `recsys-2025-recflow`
- **Authors:** Qi Liu, Kai Zheng, Rui Huang, Wuchao Li, Kuo Cai, Yuan Chai, Yanan Niu, Yiqun Hui, Bing Han, Na Mou, Hongning Wang, Wentian Bao, Yunen Yu, Guorui Zhou, Han Li, Yang Song, Defu Lian, Kun Gai
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2025 Poster; industrial benchmark
- **Topics:** recommender systems, industrial benchmark, full-funnel recommendation, data-centric AI
- **Methods:** six-stage industrial recommendation pipeline, exposure-aware logging, multi-stage dataset construction, online serving trace release
- **Benchmarks:** 38,247,234 interactions, 42,182 users, 9,122,262 items, 1,908,505,044 stage samples, 9,334,110 online requests over 37 days, exposure, filter, recall, pre-ranking, ranking, and re-ranking stages
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=vVHc8bGRns
  - `pdf`: https://openreview.net/pdf?id=vVHc8bGRns
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_data | official repository | CC BY-SA 4.0 | https://github.com/RecFlow-ICLR/RecFlow |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** CC BY-SA 4.0
- **Data access:** open via official repository under stated dataset terms
- **Contribution:** Releases a full-funnel, exposure-aware industrial recommendation trace rather than only the final clicked-feedback stage, enabling realistic multi-stage research.
- **Limitations:** The data reflect one Kuaishou application, period, and policy; privacy-preserving anonymization and policy confounding can limit generalization and causal interpretation.
- **Research relevance:** A high-value 2025 benchmark for exposure bias, cascading selection, offline-to-online gaps, and full-funnel recommender evaluation.
- **Vendor affiliation:** Kuaishou and collaborators
- **Vendor benchmark:** yes
- **Preprint only:** no
- **Primary verification sources:** OpenReview, ICLR record, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 16. Semi-Supervised Classification with Graph Convolutional Networks

- **Record ID:** `graph-2017-gcn`
- **Authors:** Thomas N. Kipf, Max Welling
- **Year / era:** 2017 / foundation
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper
- **Topics:** graph machine learning, semi-supervised learning, graph neural networks
- **Methods:** first-order spectral graph convolution, layer-wise propagation, semi-supervised node classification
- **Benchmarks:** Cora, Citeseer, Pubmed, NELL
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=SJU4ayYgl
  - `pdf`: https://openreview.net/pdf?id=SJU4ayYgl
  - `arxiv`: https://arxiv.org/abs/1609.02907
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_data | author repository | MIT | https://github.com/tkipf/gcn |
- **Paper access:** open
- **Paper license:** CC BY-SA 4.0 (OpenReview record)
- **Code license:** MIT
- **Data access:** public citation-network datasets
- **Contribution:** Made localized spectral graph convolutions practical and popularized the modern GCN formulation.
- **Limitations:** Shallow neighborhood smoothing can over-smooth, struggle with heterophily, and scale poorly to dynamic or heterogeneous industrial graphs without extensions.
- **Research relevance:** The canonical baseline from which message-passing, graph transformers, and graph foundation models descend.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 17. AutoGFM: Automated Graph Foundation Model with Adaptive Architecture Customization

- **Record ID:** `graph-2025-autogfm`
- **Authors:** Haibo Chen, Xin Wang, Zeyang Zhang, Haoyang Li, Ling Feng, Wenwu Zhu
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Machine Learning (ICML), PMLR 267
- **Publication status:** peer-reviewed conference paper; ICML 2025 Oral
- **Topics:** graph machine learning, graph foundation models, AutoML, architecture customization
- **Methods:** graph neural architecture search, disentangled contrastive graph encoder, invariant-guided architecture customization, curriculum architecture customization
- **Benchmarks:** diverse graph domains and tasks, graph foundation-model and GNN baselines
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v267/chen25bp.html
  - `openreview`: https://openreview.net/forum?id=fCPB0qRJT2
  - `pdf`: https://raw.githubusercontent.com/mlresearch/v267/main/assets/chen25bp/chen25bp.pdf
  - `arxiv`: https://arxiv.org/abs/2502.16749
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** PMLR/OpenReview open access
- **Code license:** not verified
- **Data access:** public graph benchmarks described in paper
- **Contribution:** Addresses the one-architecture-fits-all limitation of graph foundation models by disentangling invariant and variant graph patterns and customizing architectures across domains and tasks.
- **Limitations:** Customization introduces additional search/adaptation cost, and no official implementation was verified at the cutoff; broad-domain generality remains to be independently reproduced.
- **Research relevance:** A leading 2025 signal that graph foundation models are moving from fixed pretrained encoders toward automated, data-aware adaptation.
- **Vendor affiliation:** university/industry collaborators
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, PMLR, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 18. Communication-Efficient Learning of Deep Networks from Decentralized Data

- **Record ID:** `federated-2017-fedavg`
- **Authors:** Brendan McMahan, Eider Moore, Daniel Ramage, Seth Hampson, Blaise Agüera y Arcas
- **Year / era:** 2017 / foundation
- **Venue:** International Conference on Artificial Intelligence and Statistics (AISTATS), PMLR 54
- **Publication status:** peer-reviewed conference paper
- **Topics:** federated learning, distributed optimization, communication efficiency, privacy-oriented ML
- **Methods:** Federated Averaging, local SGD, client sampling, non-IID decentralized training
- **Benchmarks:** MNIST, CIFAR-10, language-modeling experiments, non-IID client partitions
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v54/mcmahan17a.html
  - `pdf`: https://proceedings.mlr.press/v54/mcmahan17a/mcmahan17a.pdf
  - `arxiv`: https://arxiv.org/abs/1602.05629
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** PMLR open access; copyright retained by authors
- **Code license:** not verified
- **Data access:** public and simulated federated partitions
- **Contribution:** Introduced FedAvg, showing that periodic averaging of locally trained models can reduce communication while tolerating non-IID client data.
- **Limitations:** Client drift under heterogeneity, partial participation, systems constraints, and privacy attacks require methods and safeguards beyond the basic algorithm.
- **Research relevance:** The foundational algorithm and baseline for nearly all federated optimization, personalization, and privacy research.
- **Vendor affiliation:** Google
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** PMLR, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 19. Energy-based Backdoor Defense Against Federated Graph Learning

- **Record ID:** `federated-2025-fedtge`
- **Authors:** Zitong Shi, Zhiwei Zhang, Minhui Xue, Guangquan Lu
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Learning Representations (ICLR)
- **Publication status:** peer-reviewed conference paper; ICLR 2025 Oral
- **Topics:** federated learning, graph ML, security, backdoor defense, robust aggregation
- **Methods:** energy-based trigger detection, local trigger synthesis, energy-guided trigger erasure, federated graph training
- **Benchmarks:** five datasets, four attack settings, FedAvg and federated-graph baselines
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=5Jc7r5aqHJ
  - `pdf`: https://openreview.net/pdf?id=5Jc7r5aqHJ
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository | not stated | https://github.com/ZitongShi/FedTGE |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** public graph datasets described by repository/paper
- **Contribution:** Removes a clean/dirty validation-set requirement from prior federated graph backdoor defenses by using local trigger synthesis and energy-guided filtering.
- **Limitations:** Defense coverage is tied to evaluated trigger families and energy separability; adaptive attackers may learn energy-aligned or stealthier triggers.
- **Research relevance:** Shows why federated learning, graph structure, and adversarial robustness must be evaluated jointly rather than as independent concerns.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, ICLR record, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 20. Deep Learning with Differential Privacy

- **Record ID:** `privacy-2016-dp-sgd`
- **Authors:** Martín Abadi, Andy Chu, Ian Goodfellow, H. Brendan McMahan, Ilya Mironov, Kunal Talwar, Li Zhang
- **Year / era:** 2016 / foundation
- **Venue:** ACM SIGSAC Conference on Computer and Communications Security (CCS)
- **Publication status:** peer-reviewed conference paper
- **Topics:** differential privacy, privacy-preserving ML, deep learning, accounting
- **Methods:** per-example gradient clipping, Gaussian noise, DP-SGD, moments accountant
- **Benchmarks:** MNIST, CIFAR-10, privacy-utility trade-offs
- **URLs:**
  - `canonical`: https://dl.acm.org/doi/10.1145/2976749.2978318
  - `doi`: https://doi.org/10.1145/2976749.2978318
  - `arxiv`: https://arxiv.org/abs/1607.00133
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | implementation_library | official maintained implementation | Apache-2.0 | https://github.com/tensorflow/privacy |
- **Paper access:** publisher landing page; access may vary
- **Paper license:** ACM publication terms
- **Code license:** Apache-2.0
- **Data access:** public benchmarks
- **Contribution:** Made rigorous per-user differential privacy practical for deep-network training through DP-SGD and tight privacy accounting.
- **Limitations:** Privacy amplification assumptions, group privacy, hyperparameter leakage, and severe utility loss at small epsilon require careful deployment analysis.
- **Research relevance:** The standard algorithmic foundation for private deep learning and a prerequisite for modern private federated and foundation-model training.
- **Vendor affiliation:** Google
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** ACM, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 21. Equality of Opportunity in Supervised Learning

- **Record ID:** `fairness-2016-equality-opportunity`
- **Authors:** Moritz Hardt, Eric Price, Nathan Srebro
- **Year / era:** 2016 / foundation
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper
- **Topics:** algorithmic fairness, equalized odds, equality of opportunity, classification
- **Methods:** post-processing fairness constraints, equalized odds, equal opportunity, oblivious and score-based predictors
- **Benchmarks:** adult income-style protected-classification settings, binary decision tasks
- **URLs:**
  - `canonical`: https://proceedings.neurips.cc/paper_files/paper/2016/hash/6a9659feb1216f14f7384ba499518b38-Abstract.html
  - `pdf`: https://proceedings.neurips.cc/paper_files/paper/2016/file/6a9659feb1216f14f7384ba499518b38-Paper.pdf
  - `arxiv`: https://arxiv.org/abs/1610.02413
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** NeurIPS open access; license not stated on landing page
- **Code license:** not verified
- **Data access:** benchmark-dependent
- **Contribution:** Defined equalized odds and equality of opportunity and showed how optimal nondiscriminatory predictors can be derived from score functions.
- **Limitations:** Group parity definitions can conflict and do not resolve causal discrimination, measurement bias, intersectionality, or long-term feedback effects.
- **Research relevance:** A canonical formalization that anchors fairness metrics, impossibility results, and responsible-ML evaluation.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** NeurIPS proceedings, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 22. Approximate Differential Privacy of the ℓ2 Mechanism

- **Record ID:** `privacy-2025-approx-dp-l2`
- **Authors:** Matthew Joseph, Alex Kulesza, Alexander Yu
- **Year / era:** 2025 / frontier
- **Venue:** International Conference on Machine Learning (ICML), PMLR 267
- **Publication status:** peer-reviewed conference paper
- **Topics:** differential privacy, Gaussian mechanism, privacy accounting, statistical learning
- **Methods:** privacy-loss distribution analysis, Laplace mechanisms, chi-squared divergences, approximate-DP characterizations
- **Benchmarks:** sensitivity-bounded vectors, Gaussian-mechanism privacy profiles, numerical privacy-accounting comparisons
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v267/joseph25a.html
  - `openreview`: https://openreview.net/forum?id=ypeehAYK7W
  - `pdf`: https://raw.githubusercontent.com/mlresearch/v267/main/assets/joseph25a/joseph25a.pdf
  - `arxiv`: https://arxiv.org/abs/2502.15929
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository path | Apache-2.0 | https://github.com/google-research/google-research/tree/master/dp_l2 |
- **Paper access:** open
- **Paper license:** PMLR/OpenReview open access
- **Code license:** Apache-2.0
- **Data access:** not applicable
- **Contribution:** Provides tighter characterizations and computable bounds for the approximate-DP behavior of Gaussian/L2 mechanisms used throughout private ML.
- **Limitations:** Primarily a mechanism/accounting result; end-to-end privacy still depends on clipping, composition, implementation, and threat-model choices.
- **Research relevance:** Improves the mathematical basis for calibrating noise and privacy budgets in DP training and analytics.
- **Vendor affiliation:** Google-affiliated authors
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, PMLR, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 23. Fairness under Competition

- **Record ID:** `fairness-2025-competition`
- **Authors:** Ronen Gradwohl, Eilam Shapira, Moshe Tennenholtz
- **Year / era:** 2025 / frontier
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper
- **Topics:** algorithmic fairness, strategic competition, game theory, selection systems
- **Methods:** competitive selection model, group-fairness constraints, equilibrium analysis, experiments with competitor strength and group size
- **Benchmarks:** synthetic competition settings, Blind and Clean fairness strategies, ablations over applicant groups and competitor strength
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=4wnXPE0ymH
  - `official_proceedings`: https://papers.nips.cc/paper_files/paper/2025/hash/4dd0a016d7d253d02473e4778414ab0b-Abstract-Conference.html
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository | MIT | https://github.com/eilamshapira/FairnessUnderCompetition |
- **Paper access:** open
- **Paper license:** CC BY 4.0/OpenReview
- **Code license:** MIT
- **Data access:** synthetic/experimental code
- **Contribution:** Shows that independently fair algorithms can interact under competition to produce outcomes that differ from their isolated fairness properties.
- **Limitations:** Stylized utility and applicant models may not capture labor-market institutions, repeated feedback, or causal discrimination pathways.
- **Research relevance:** Moves fairness analysis from a single deployed model to an ecosystem-level decision problem, an important frontier for policy and audits.
- **Vendor affiliation:** False
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, NeurIPS record, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 24. Hidden Technical Debt in Machine Learning Systems

- **Record ID:** `mlops-2015-hidden-debt`
- **Authors:** D. Sculley, Gary Holt, Daniel Golovin, Eugene Davydov, Todd Phillips, Dietmar Ebner, Vinay Chaudhary, Michael Young, Jean-François Crespo, Dan Dennison
- **Year / era:** 2015 / foundation
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper
- **Topics:** MLOps, technical debt, production ML, monitoring, data dependencies
- **Methods:** systems analysis, production-case patterns, dependency and pipeline-risk taxonomy
- **Benchmarks:** Google-scale production ML system patterns, boundary erosion, entanglement, hidden feedback loops, pipeline jungles
- **URLs:**
  - `canonical`: https://proceedings.neurips.cc/paper_files/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html
  - `pdf`: https://proceedings.neurips.cc/paper_files/paper/2015/file/86df7dcfd896fcaf2674f757a2463eba-Paper.pdf
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** open
- **Paper license:** NeurIPS open access; license not stated
- **Code license:** not verified
- **Data access:** not applicable
- **Contribution:** Named and taxonomized the maintenance, coupling, monitoring, and data-dependency risks that arise when ML models enter long-lived production systems.
- **Limitations:** Primarily experiential rather than a controlled study; modern LLM/agent operations require extensions to its original batch/supervised-system framing.
- **Research relevance:** Still the conceptual foundation for MLOps, model monitoring, reproducibility, and lifecycle governance.
- **Vendor affiliation:** Google
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** NeurIPS proceedings, Scholar search
- **Verification date:** 2026-11-21

### 25. Datasheets for Datasets

- **Record ID:** `mlops-2021-datasheets`
- **Authors:** Timnit Gebru, Jamie Morgenstern, Briana Vecchione, Jennifer Wortman Vaughan, Hanna Wallach, Hal Daumé III, Kate Crawford
- **Year / era:** 2021 / foundation
- **Venue:** Communications of the ACM 64(12)
- **Publication status:** peer-reviewed journal article; earlier versions circulated from 2018
- **Topics:** MLOps, dataset documentation, data-centric AI, evaluation, governance
- **Methods:** documentation questionnaire, dataset lifecycle audit, motivation, composition, collection, labeling, use, and maintenance sections
- **Benchmarks:** documentation case studies, dataset lifecycle questions, provenance and recommended-use checks
- **URLs:**
  - `canonical`: https://dl.acm.org/doi/10.1145/3458723
  - `doi`: https://doi.org/10.1145/3458723
  - `arxiv`: https://arxiv.org/abs/1803.09010
- **Code/data:**
  - None verified at cutoff.
- **Paper access:** publisher landing page; access may vary
- **Paper license:** ACM publication terms
- **Code license:** not verified
- **Data access:** not applicable
- **Contribution:** Standardized dataset documentation as an engineering and governance artifact covering provenance, consent, labeling, intended use, and maintenance.
- **Limitations:** Self-reported datasheets can be incomplete or stale; the framework alone does not enforce correctness, privacy, or downstream compliance.
- **Research relevance:** Foundational to data-centric AI, dataset audits, model evaluation, and regulatory documentation workflows.
- **Vendor affiliation:** Microsoft/Google/Cornell/NYU-affiliated authors
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** ACM, arXiv, Scholar search
- **Verification date:** 2026-11-21

### 26. Benchmark Health Index: A Systematic Framework for Benchmarking the Benchmarks of LLMs

- **Record ID:** `evaluation-2026-bhi`
- **Authors:** Longyuan Zhu, Hairan Hua, Linlin Miao, Wei Wang, Bing Zhao
- **Year / era:** 2026 / frontier
- **Venue:** NeurIPS Evaluations and Datasets Track
- **Publication status:** peer-reviewed conference paper; NeurIPS 2026 Oral
- **Topics:** MLOps, AI evaluation, benchmark quality, LLM assessment, measurement validity
- **Methods:** Benchmark Health Index, design-to-execution stage decomposition, weighted quality dimensions, benchmark scoring rubric
- **Benchmarks:** 18 dimensions across design, implementation, execution, and transparency stages, 44 benchmarks spanning 15 capability domains
- **URLs:**
  - `canonical`: https://arxiv.org/abs/2507.10571
  - `code`: https://github.com/SKYLENAGE-AI/Benchmark_Health_Index
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code_and_framework | official repository | Apache-2.0 | https://github.com/SKYLENAGE-AI/Benchmark_Health_Index |
- **Paper access:** arXiv open manuscript; venue page indexed through OpenReview
- **Paper license:** arXiv license not specified
- **Code license:** Apache-2.0
- **Data access:** framework and benchmark metadata in repository
- **Contribution:** Turns benchmark quality itself into a measurable object, revealing design, implementation, execution, and transparency gaps across widely used LLM benchmarks.
- **Limitations:** Index weights and domain coverage embed value judgments; scores can become stale as benchmarks are revised or contaminated.
- **Research relevance:** A 2026 evaluation-governance framework for avoiding overclaiming from weak, contaminated, or poorly documented benchmarks.
- **Vendor affiliation:** Alibaba/SKYLENAGE-affiliated artifact
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** arXiv, OpenReview profile, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 27. Proximal Policy Optimization Algorithms

- **Record ID:** `rl-2017-ppo`
- **Authors:** John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, Oleg Klimov
- **Year / era:** 2017 / foundation
- **Venue:** arXiv
- **Publication status:** arXiv preprint; not peer-reviewed; vendor-authored OpenAI paper
- **Topics:** decision-making, reinforcement learning, policy optimization, vendor preprint
- **Methods:** clipped surrogate objective, trust-region-style policy updates, actor-critic learning, generalized advantage estimation
- **Benchmarks:** OpenAI Gym continuous-control tasks, Atari, sample-complexity and wall-clock comparisons
- **URLs:**
  - `canonical`: https://arxiv.org/abs/1707.06347
  - `pdf`: https://arxiv.org/pdf/1707.06347
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | reference_implementation | archived official repository | MIT | https://github.com/openai/baselines |
- **Paper access:** arXiv
- **Paper license:** arXiv distribution; license not specified
- **Code license:** MIT
- **Data access:** public simulation benchmarks
- **Contribution:** Introduced a simple first-order policy-optimization objective that became a default RL and later RLHF algorithm.
- **Limitations:** Preprint status means there is no peer-reviewed venue record; benchmark tuning and implementation details substantially affect stability and reported gains.
- **Research relevance:** Included deliberately as a clearly labeled vendor preprint because of its exceptional influence on deep RL and RLHF practice.
- **Vendor affiliation:** OpenAI
- **Vendor benchmark:** no
- **Preprint only:** yes
- **Primary verification sources:** arXiv, OpenAI Baselines, Scholar search
- **Verification date:** 2026-11-21

### 28. Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor

- **Record ID:** `rl-2018-sac`
- **Authors:** Tuomas Haarnoja, Aurick Zhou, Pieter Abbeel, Sergey Levine
- **Year / era:** 2018 / foundation
- **Venue:** International Conference on Machine Learning (ICML), PMLR 80
- **Publication status:** peer-reviewed conference paper
- **Topics:** decision-making, reinforcement learning, maximum entropy RL, off-policy learning
- **Methods:** stochastic actor, twin Q critics, entropy regularization, off-policy replay
- **Benchmarks:** MuJoCo continuous-control suite, sample-efficiency and asymptotic-return comparisons
- **URLs:**
  - `canonical`: https://proceedings.mlr.press/v80/haarnoja18b.html
  - `pdf`: https://proceedings.mlr.press/v80/haarnoja18b/haarnoja18b.pdf
  - `arxiv`: https://arxiv.org/abs/1801.01290
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | author repository | MIT | https://github.com/haarnoja/sac |
- **Paper access:** open
- **Paper license:** PMLR open access; copyright retained by authors
- **Code license:** MIT
- **Data access:** public simulation benchmarks
- **Contribution:** Combined off-policy sample efficiency with entropy-regularized stochastic policies, establishing SAC as a durable continuous-control baseline.
- **Limitations:** Simulation benchmarks do not capture all real-world safety and reset constraints; temperature tuning and reward scale strongly affect behavior.
- **Research relevance:** A foundational bridge between probabilistic inference, exploration, and practical deep actor-critic control.
- **Vendor affiliation:** UC Berkeley/Google-affiliated authors
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** PMLR, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 29. Adaptive Neighborhood-Constrained Q Learning for Offline Reinforcement Learning

- **Record ID:** `rl-2025-anq`
- **Authors:** Mengyuan Chen, Mingcai Chen, Yusen Huo, Dong Xing, Yunpeng Qing, Qingmin Lin, Zongzhang Zhang, Changjie Fan
- **Year / era:** 2025 / frontier
- **Venue:** Advances in Neural Information Processing Systems (NeurIPS)
- **Publication status:** peer-reviewed conference paper; NeurIPS 2025 Spotlight
- **Topics:** decision-making, offline reinforcement learning, Q-learning, distribution shift
- **Methods:** adaptive behavior-state neighborhood, implicit distribution-distance estimation, neighborhood-constrained value backup, offline Q-learning
- **Benchmarks:** D4RL Gym-MuJoCo, AntMaze, NeoRL, CQL, IQL, EDAC, SAC-RND
- **URLs:**
  - `canonical`: https://openreview.net/forum?id=qgi5TfBXBw
  - `pdf`: https://openreview.net/pdf?id=qgi5TfBXBw
  - `arxiv`: https://arxiv.org/abs/2412.04959
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository | not stated | https://github.com/thu-rllab/ANQ |
- **Paper access:** open
- **Paper license:** CC BY 4.0 (OpenReview record)
- **Code license:** not verified
- **Data access:** public D4RL/NeoRL benchmarks
- **Contribution:** Dynamically relaxes or tightens pessimism according to local data support, seeking better balance between in-distribution exploitation and out-of-distribution conservatism.
- **Limitations:** Neighborhood estimation adds hyperparameters and compute; performance remains benchmark- and dataset-quality dependent.
- **Research relevance:** Represents the 2025 movement from uniformly pessimistic offline RL toward adaptive, state-dependent conservatism.
- **Vendor affiliation:** university/industry collaborators
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** OpenReview, NeurIPS submissions, arXiv, GitHub, Scholar search
- **Verification date:** 2026-11-21

### 30. Causal Flow Q-Learning for Robust Offline Reinforcement Learning

- **Record ID:** `rl-2026-causal-flow-q`
- **Authors:** Zeyuan Xu, Zeyuan Liu, Mohammadsajad Abavisani, Negar Hassanpour, Rong Jin, Matthew Clairmont, Krishnaram Kenthapadi, Marianna Protopapas, Andrea Pugliese, Tyler Kertzner, Chitra Agastya, Muir Humphrey, Andrei Lupu, Zhifeng Chen, Parameswaran Raman
- **Year / era:** 2026 / frontier
- **Venue:** International Conference on Machine Learning (ICML)
- **Publication status:** peer-reviewed conference paper; ICML 2026 regular paper
- **Topics:** decision-making, offline reinforcement learning, causal inference, distributionally robust optimization, confounding
- **Methods:** causal influence diagram, hidden-confounder sensitivity model, flow-matching behavior model, robust Q-learning, Lipschitz-constrained Bellman error
- **Benchmarks:** D4RL MuJoCo and AntMaze, confounded datasets with injected confounders, d20 distributional-robustness tasks, random-confounder perturbations
- **URLs:**
  - `canonical`: https://arxiv.org/abs/2602.07074
  - `pdf`: https://arxiv.org/pdf/2602.07074
- **Code/data:**
  | Type | Availability | License | URL |
  |---|---|---|---|
  | code | official repository | Apache-2.0 | https://github.com/CausalAILab/Causal-Flow-Q-Learning-for-Robust-Offline-Reinforcement-Learning |
- **Paper access:** arXiv open manuscript; ICML 2026 acceptance verified through ICML/OpenReview listing
- **Paper license:** arXiv license not specified
- **Code license:** Apache-2.0
- **Data access:** public D4RL-derived benchmarks and generated confounded variants
- **Contribution:** Unifies causal hidden-confounder analysis with flow-based behavior modeling and robust offline value learning, extending DRO beyond observable uncertainty.
- **Limitations:** Guarantees depend on the assumed sensitivity parameter and causal structure; learned bounds can be loose or mis-specified in complex real systems.
- **Research relevance:** A 2026 bridge among causal inference, uncertainty, and offline RL, directly relevant to high-stakes policies trained from observational logs.
- **Vendor affiliation:** academic/industry collaborators
- **Vendor benchmark:** no
- **Preprint only:** no
- **Primary verification sources:** arXiv, ICML author/schedule record, GitHub, Scholar search
- **Verification date:** 2026-11-21

## Cross-cutting synthesis

1. **Evaluation is shifting upward in the stack.** The frontier records evaluate not only predictive accuracy but benchmark health, full-funnel recommender exposure, ecosystem fairness, and robustness to hidden confounders.
2. **Foundation models are meeting classical statistical constraints.** Timer-XL, ConTextTab, AutoGFM, and AutoML-Agent promise reusable priors and automation, while sample-complexity theory, tree benchmarks, and hidden technical debt remain necessary checks.
3. **Uncertainty is becoming decision-facing.** Conformal methods now target structured outputs and continuous treatments, and offline RL increasingly models support mismatch and confounding rather than returning a single policy score.
4. **Data-centric artifacts are first-class research objects.** RecFlow, the 45-dataset tabular benchmark, Datasheets, and the Benchmark Health Index emphasize provenance, stage-aware evaluation, and documentation.
5. **Trust constraints cut across domains.** DP accounting, fairness under competition, federated graph backdoors, and private deep learning show that accuracy-first comparisons omit deployment-critical risk.

## Caveats

- This is a curated 30-paper dataset, not a complete survey of every 2025-2026 Tier-A paper.
- `foundation` is used for influence within this collection, not as a claim that a paper is the earliest work on its subject.
- Repository contents can change after the verification date; pin commits before reproducing results.
- Vendor affiliation does not imply invalidity, but it is retained to support independent-review and conflict-of-interest analysis.
- No application or repository source tree was edited; only the two requested files under `/mnt/agents/output/` were created.
