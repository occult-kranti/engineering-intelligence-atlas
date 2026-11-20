# AI Open-Model Research — Evaluation and Evidence Gates

Compiled 2026-11-20 from `sota_open_model_landscape.md` §6 and the four domain surveys. Leaderboard positions decay within weeks; methodology changes break longitudinal comparisons.

## Contents

1. Evidence labels and source hierarchy — 2. Benchmark matrix (what still discriminates) — 3. Standing evidence gates — 4. Known negative results and traps — 5. Self-check tasks

## 1. Evidence labels and source hierarchy

Label every claim inline, immediately after it. Labels are load-bearing and must propagate into any downstream artifact.

- **[R] Registry-verified metadata** — exact repo ID, pinned commit SHA, per-file byte sizes, LFS sha256, verified live against a registry API. Highest confidence for *existence and size*, says nothing about quality.
- **[I] Independently measured** — Artificial Analysis, LMArena/Arena, Vals, LiveBench, HF Open ASR Leaderboard, OmniDocBench, Matbench Discovery, GameWorld Score, academic audits, operational scorecards (ECMWF/NOAA). Preferred for all capability claims.
- **[V] Vendor- or author-reported** — model cards, lab blogs, self-run benchmarks. Admissible only with the label attached; never launder into an unlabeled assertion.
- **[SECONDARY]/unknown** — corroborate before relaying; exclude rather than guess when corroboration fails.

Evidence asymmetry is the central reading skill: vendor self-reports dominate coding-agent, GUI-agent, image-editing, TTS-latency, and music claims. Single-source scores, self-harnessed runs, and pre-release evaluations are all [V] until reproduced.

## 2. Benchmark matrix — which benchmarks still discriminate

| Domain | Benchmark (status) | Independent yardstick? | Reading guidance |
|---|---|---|---|
| General language | AA Intelligence Index v5 (methodology changed Oct 2026 — cross-date comparisons invalid); LMArena Elo | Yes [I] | Index-scale changes break longitudinal claims |
| Coding | SWE-bench Verified = **saturated at frontier**; use SWE-bench Pro, FrontierSWE, DeepSWE v1.1, Terminal-Bench 2.1/3.0/4.0 | Partial (LiveBench agentic-coding [I]; Vals SWE reruns [I]) | Harness-sensitive: cross-vendor tables are one party's run (Moonshot in Claude Code harness; DeepSeek self-harnessed) |
| Reasoning/math | AIME 2025/2026, GPQA Diamond, HLE | Registry (ai-tldr.dev) [I] | Tool-augmented scores are not pure reasoning; watch output-token cost (verbosity tax inverts price/quality rankings) |
| Long context | AA-LCR, RULER/NoLiMa | Yes [I] | Advertised windows (1M–10M) overstate reliable recall; treat max context as capacity, not recall |
| VLU | MMMU(-Pro), MathVista, OCRBench | Partial (FlagOS reruns [I]) | General VLMs lose to OCR specialists on documents |
| Image gen/edit | AA open-weights T2I / editing Elo | Yes [I] | Strongest open weights carry non-permissive licenses |
| Video | Arena I2V Elo; vendor efficiency tables | Partial | No open mandatory watermarking; ~5s clip ceiling |
| ASR | HF Open ASR Leaderboard (8-dataset avg WER) | Yes [I] | Clean-audio WER understates real-world error |
| TTS | AA Voice/TTS Elo (blind listening) | Yes [I] | Vendor latency claims on unnamed GPUs |
| OCR/documents | OmniDocBench v1.6 end-to-end; olmOCR-Bench (self-reported) | Yes (OmniDocBench) [I] | Top of board within noise; v1.5 saturated — real-document testing decisive |
| GUI/computer use | OSWorld (2024) ≠ OSWorld-Verified (Jul 2025) ≠ OSWorld 2.0 (Jun 2026) — **scores not comparable across versions** | Partial | Framework lifts (Agent S4) beat raw model swaps at ~1/65 the per-task cost of closed models [V/arXiv] |
| Proteins | CASP16 affinity challenge; FEP+ Pearson | Yes [I] | Binding ≠ function |
| Materials | Matbench Discovery; LeMat-GenBench OOD probes | Yes [I] | uMLIPs underestimate soft modes; generative outputs are hypotheses |
| Weather/climate | ECMWF/NOAA operational scorecards | Yes [I-operational] | The only domain with production-grade open-model validation |
| Single-cell | HVG/PCA/linear baselines are the yardstick | Yes [I] — and FMs fail it | Never report FM-only results |
| Robotics | GR-1, LIBERO, ALOHA real-robot; Dexter-50 | Mostly vendor [V]; paired Elo evals (GR00T 2) are a positive example | Pre-release vendor evals flagged; open-loop AV evals do not transfer to closed loop |
| World models (games) | GameWorld Score (open benchmark) | Partial | Vendor Genie-3-parity claims unreplicated |
| Security LLMs | CTIBench, CyberMetric, SecBench, FAITH harness | Partial | Defensive triage yes; offensive tasks route to frontier closed |

## 3. Standing evidence gates

Apply in order before any model recommendation:

1. **Independence gate** — prefer [I]-verified performance on a discriminating benchmark (matrix above) over [V] headlines. A vendor-only score enters a deliverable only with the [V] label attached.
2. **Saturation gate** — check the benchmark still discriminates (e.g., SWE-bench Verified, OmniDocBench v1.5 are saturated at the frontier); move to the harder successor.
3. **Harness gate** — ask who ran the harness and with what scaffold; self-harnessed scores (DeepSeek V4.1-Flash TB 2.1 90.6) are [V] and unreproduced until shown otherwise.
4. **Baseline gate** — where independent baseline audits exist (single-cell above all), require baseline controls; never report foundation-model-only results.
5. **Cost gate** — check output-token spend behind composite indices; rankings that invert when token cost is counted must be reported as such.
6. **Recency gate** — state the as-of date; flag methodology changes that break cross-date comparison (AA Index v5, Oct 2026); mark stale findings for re-verification.

## 4. Known negative results and traps

Load-bearing negative or cautionary findings (all 2026-11-20 snapshot):

- **Single-cell foundation models do not consistently beat HVG/PCA/linear baselines** across seven-plus independent audits (Genome Biol 2025; Nat Methods 2025; VCBench 2026) [I]. Generalize the caution: absent an independent baseline audit, assume the baseline wins.
- **Protein design models are validated for binding, not function** — a 2025 controlled challenge (Adaptyv) produced zero neutralizing hits among >1,000 designs [I].
- **Discovery agents underperform human baselines on average** (BioML-bench [I]); ScienceAgentBench/PaperBench show <20% full replication [I].
- **Unreproduced headline numbers awaiting independent confirmation:** DeepSeek-V4.1-Flash 90.6 Terminal-Bench 2.1 (self-harnessed), Beam 80.9 SWE-bench Verified, GUI-Owl-1.5 56.5% OSWorld-Verified (self-reported), GR00T 2 +236 Elo (pre-release vendor eval), vendor Genie-3-parity claims.
- **Benchmark strength decouples from formal reasoning** (DeepSeek-V3.1: 66.0 SWE-bench Verified vs 7.93% formal spec generation).
- **Long-context marketing overstates recall**; KV-cache cost dominates at advertised windows.
- **OSWorld versions are not comparable** (2024 ≠ Verified ≠ 2.0); cite the exact version with every score.
- **Robotics/AV evidence is predominantly vendor-reported**; open-loop AV evals do not transfer to closed loop.

## 5. Self-check tasks

Use these to regression-test competence; all answers must carry labels and dates.

1. A vendor blog claims "#1 open model." List everything missing before the claim is reportable, and rewrite it as a properly scoped sentence.
2. Given a 2.8T-total / 104B-active MoE, state the memory floor rule and why active parameters are irrelevant to download size.
3. A model tops SWE-bench Verified. Explain why that is weak evidence in late 2026 and name the discriminating successors.
4. A user wants "the best open image model for a US commercial product." Show why the arena #1 is inadmissible and identify the operative frontier.
5. A single-cell paper reports FM-only results beating prior FM-only results. State what is missing and what the independent audits found.
6. Classify: Apache-2.0 weights + undisclosed data + gated download + revenue trigger above $20M. Which tier(s), and what must be re-read at pin time?
