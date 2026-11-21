# Frontier NLP, LLM, and Agents Research Map (2025–2026 focus)

**Verification date:** 2026-11-20  
**Companion dataset:** `/mnt/agents/output/frontier_nlp_agents_papers.json` (33 records)

## Method and verification

- Titles and URLs were checked against official ACL Anthology, OpenReview, PMLR, NeurIPS/Nature DOI pages, arXiv pages/API metadata, and author/project repositories.
- `peer-reviewed` means the venue version itself was accepted/published; `preprint` makes no peer-review claim. No record is marked ARR-under-review.
- Code/data fields are populated only where an official or author-controlled artifact was identified; `null` means no official artifact was verified.
- Reported results are contextual paper claims, not universal state-of-the-art assertions.

## Corpus snapshot

- **Records:** 33
- **Status counts:** peer-reviewed: 32, preprint: 1
- **Venue-year counts:** 2020: 1, 2023: 2, 2024: 10, 2025: 14, 2026: 6
- **Coverage:** foundation/open LLMs; reasoning; RAG; agents; evaluation; prompt optimization; alignment; interpretability; multilingual NLP; efficient language models.

### Foundation and open models
DeepSeek-R1, OLMo 2, Tulu 3, and Qwen3 trace different transparency points: peer-reviewed reasoning RL, fully open training artifacts, documented post-training, and an open-weight multilingual/hybrid-reasoning family.

### Reasoning and test-time compute
Inference Scaling Laws, s1, and The Illusion of Thinking caution that more tokens are neither free nor monotonically useful; controlled complexity and cost accounting are essential.

### RAG and grounding
RAG supplies the architectural baseline and Self-RAG makes retrieval/critique adaptive. Current evaluation must separate retrieval necessity, evidence faithfulness, citation quality, freshness, and latency.

### Agents
ReAct remains the conceptual baseline; SWE-bench/SWE-agent, OSWorld, τ-bench, TheAgentCompany, and WorkForceAgent-R1 cover software, desktop, conversational-tool, workplace, and RL-trained web settings.

### Evaluation
AI Agents That Matter and MMLU-ProX address cost-blind agent evaluation and English-centric capability claims through cost-aware methodology and parallel multilingual items.

### Prompt and program optimization
DSPy, OPRO, TextGrad, and GEPA progress from manual prompts to compiled programs, LLM optimizers, textual backpropagation, and reflective Pareto evolution. Metric overfitting and API/search cost are central risks.

### Alignment
DPO is the preference-optimization primitive; Shallow Safety and Any-Depth Alignment examine where safety behavior lives in generation and whether it survives adaptive attacks.

### Interpretability
SAEs, Patchscopes, Transcoders, and Temporal SAEs provide complementary paths from activations to features, verbalizations, and circuits; causal validation remains essential.

### Multilingual NLP
Aya, MMLU-ProX, Long CoT Across Languages, and Qwen3 shift focus from translation-only evaluation to multilingual instruction following and advanced reasoning.

### Efficient language models
OLMoE exposes MoE decisions; s1 and inference scaling optimize test-time compute; Fast-dLLM addresses diffusion-LM latency. Report quality-cost-memory-latency frontiers, not a single score.

## High-value records

### 1. DeepSeek-R1 incentivizes reasoning in LLMs through reinforcement learning (2025)
- **Authors:** DeepSeek-AI et al.
- **Venue/status:** Nature 645, 633–638 — `peer-reviewed`
- **Paper:** https://doi.org/10.1038/s41586-025-09422-z
- **Identifiers:** doi: 10.1038/s41586-025-09422-z, arxiv: 2501.12948
- **Code:** https://github.com/deepseek-ai/DeepSeek-R1
- **Data/models:** https://huggingface.co/deepseek-ai/DeepSeek-R1
- **Access/license:** Open arXiv version; Nature page may have access controls. Official repository and model artifacts are public; repository states MIT licensing for code/model materials, with third-party bases subject to their terms.
- **Topics:** LLMs, reasoning, reinforcement learning, distillation, agents
- **Methods:** pure RL (R1-Zero), multi-stage RL and supervised fine-tuning, rule-based verifiable rewards, distillation to smaller dense models
- **Datasets/benchmarks:** MATH-500, AIME 2024, GPQA Diamond, LiveCodeBench, Codeforces, MMLU
- **Contribution:** Shows that large-scale RL with verifiable rewards can elicit long chain-of-thought behaviors without starting from human-written reasoning traces, and packages the resulting reasoning behavior through distillation.
- **Limitations:** Most gains are on verifiable math/code/STEM tasks; long reasoning raises inference cost; reasoning can mix languages or be hard to audit; safety, factuality, and open-ended tasks require separate treatment.
- **Why it matters:** It is the clearest frontier reference for reasoning-centric RL, distillation, and compute allocation, and a baseline against which newer reasoning agents and efficient-reasoning claims should be checked.
- **Verified:** 2026-11-20 via Nature DOI page, arXiv API, official DeepSeek-R1 repository.

### 2. 2 OLMo 2 Furious (2025)
- **Authors:** Team OLMo, Pete Walsh, Luca Soldaini, Dirk Groeneveld, et al.
- **Venue/status:** Conference on Language Modeling (COLM) — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=2ezugTT9kU
- **Identifiers:** openreview: 2ezugTT9kU, arxiv: 2501.00656
- **Code:** https://github.com/allenai/OLMo
- **Access/license:** OpenReview and arXiv are open. OLMo releases weights, data, code, recipes, logs, and checkpoints; users must follow the licenses attached to each released artifact and any third-party data.
- **Topics:** LLMs, open models, pretraining, post-training, efficient language models
- **Methods:** dense decoder-only LMs, training-stability changes, late-stage curriculum with Dolmino Mix 1124, instruction tuning, RLVR
- **Datasets/benchmarks:** OLMo 2 7B/13B/32B, Dolmino Mix 1124, OLMo 2-Instruct, standard capability and post-training evaluations
- **Contribution:** Provides an unusually complete open replication package for a modern LM family, including full training data, recipes, logs, and intermediate checkpoints.
- **Limitations:** Does not expose every decision behind proprietary comparators; largest released scale remains below frontier closed models; data and evaluations are still English-heavy; full replication requires substantial compute.
- **Why it matters:** It turns model-development claims into inspectable artifacts, enabling work on data curation, annealing, RLVR, scaling, and reproducibility that closed reports cannot support.
- **Verified:** 2026-11-20 via COLM OpenReview page, arXiv API, AllenAI OLMo repository.

### 3. Tulu 3: Pushing Frontiers in Open Language Model Post-Training (2025)
- **Authors:** Nathan Lambert, Jacob Morrison, Valentina Pyatkin, Shengyi Huang, Hamish Ivison, Faeze Brahman, et al.
- **Venue/status:** Conference on Language Modeling (COLM) — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=i1uGbfHHpH
- **Identifiers:** openreview: i1uGbfHHpH, arxiv: 2411.15124
- **Code:** https://github.com/allenai/open-instruct
- **Access/license:** OpenReview and arXiv are open. Code, model weights, datasets, and recipes are public, but the Llama base models and individual datasets carry their own licenses and use restrictions.
- **Topics:** LLMs, post-training, alignment, RLHF/RLVR, evaluation
- **Methods:** supervised fine-tuning, Direct Preference Optimization, Reinforcement Learning with Verifiable Rewards, data curation and decontamination, development/unseen evaluation split
- **Datasets/benchmarks:** Tulu 3 8B/70B/405B, core-skill instruction mixtures, multi-task development and held-out evaluations
- **Contribution:** Documents a complete, permissively inspectable post-training stack and reports negative as well as positive recipe outcomes rather than only a final model leaderboard.
- **Limitations:** Built on Llama 3.1 base-model terms; post-training data and benchmarks remain English-centric; synthetic-data quality and benchmark decontamination are not fully solved; recipe transfer to other bases is not guaranteed.
- **Why it matters:** It is a practical reference implementation for modern SFT→preference→verifiable-reward post-training and a useful audit trail for claims about RLVR and open alignment.
- **Verified:** 2026-11-20 via COLM OpenReview page, arXiv API, AllenAI open-instruct repository.

### 4. Qwen3 Technical Report (2025)
- **Authors:** An Yang, Anfeng Li, Baosong Yang, Beichen Zhang, Binyuan Hui, et al.
- **Venue/status:** arXiv — `preprint`
- **Paper:** https://arxiv.org/abs/2505.09388
- **Identifiers:** arxiv: 2505.09388
- **Code:** https://github.com/QwenLM/Qwen3
- **Data/models:** https://huggingface.co/Qwen
- **Access/license:** arXiv is open. The report states that Qwen3 models are publicly accessible under Apache-2.0; individual deployment integrations may add separate terms.
- **Topics:** LLMs, multilingual NLP, reasoning, mixture of experts, efficient language models, agents
- **Methods:** dense and MoE models, unified thinking/non-thinking modes, thinking budgets, distillation from flagship models, multilingual post-training
- **Datasets/benchmarks:** Qwen3 0.6B–235B-A22B, 119 languages and dialects, math, code, agent, and multilingual evaluations
- **Contribution:** Combines hybrid controllable reasoning, a broad dense/MoE model ladder, and expanded multilingual coverage in one publicly usable model family.
- **Limitations:** Technical-report preprint rather than peer-reviewed proceedings; training corpus and data-governance details are not fully open; reported benchmark results are not universal across deployments; long thinking remains costly.
- **Why it matters:** It is a strong current reference for open-weight multilingual reasoning models and for studying when thinking budgets help or merely add latency.
- **Verified:** 2026-11-20 via arXiv abstract and API, official Qwen3 repository, Qwen Hugging Face organization.

### 5. Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (2020)
- **Authors:** Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, and Douwe Kiela
- **Venue/status:** NeurIPS — `peer-reviewed`
- **Paper:** https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html
- **Identifiers:** arxiv: 2005.11401
- **Code/data:** No official artifact URL verified.
- **Access/license:** Conference page and arXiv are open. No single official paper repository was identified in the verified sources; downstream implementations have separate licenses.
- **Topics:** RAG, retrieval, question answering, knowledge-intensive NLP, LLMs
- **Methods:** dense passage retrieval, BART seq2seq generation, RAG-Sequence, RAG-Token, non-parametric memory
- **Datasets/benchmarks:** Natural Questions, TriviaQA, WebQuestions, Wikipedia index, MS MARCO-derived generation tasks
- **Contribution:** Established the canonical retrieve-and-generate architecture in which a differentiable neural retriever supplies explicit evidence to a generative model.
- **Limitations:** Retrieval errors propagate into generation; the index can become stale; passage-level evidence does not guarantee faithful attribution; retrieval adds latency and system complexity.
- **Why it matters:** Nearly every modern RAG, agentic-search, grounding, and provenance system inherits its assumptions; it remains the baseline for evaluating whether newer retrieval actually helps.
- **Verified:** 2026-11-20 via NeurIPS proceedings page, arXiv API.

### 6. Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection (2024)
- **Authors:** Akari Asai, Zeqiu Wu, Yizhong Wang, Avirup Sil, and Hannaneh Hajishirzi
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=hSyW5go0v8
- **Identifiers:** openreview: hSyW5go0v8, arxiv: 2310.11511
- **Code:** https://github.com/AkariAsai/self-rag
- **Access/license:** OpenReview, arXiv, and the official GitHub repository are public; check the repository for its current license and model/data terms.
- **Topics:** RAG, self-reflection, factuality, adaptive retrieval, LLMs
- **Methods:** reflection tokens, adaptive on-demand retrieval, critic-guided generation, supervised training of a single LM
- **Datasets/benchmarks:** open-domain QA, reasoning, fact verification, long-form generation with citation quality
- **Contribution:** Moves RAG from fixed top-k retrieval to learned decisions about when to retrieve, how to use passages, and how to critique generated evidence use.
- **Limitations:** Requires training with special reflection tokens; depends on retriever and evidence quality; self-critique is not a proof of factuality; adds pipeline and decoding complexity.
- **Why it matters:** It is a central bridge between classical RAG and agentic self-checking systems and provides ablations needed to separate retrieval gains from critique gains.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official Self-RAG repository.

### 7. Inference Scaling Laws: An Empirical Analysis of Compute-Optimal Inference for Problem-Solving with Language Models (2025)
- **Authors:** Yangzhen Wu, Zhiqing Sun, Shanda Li, Sean Welleck, and Yiming Yang
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=VNmc3GV0cI
- **Identifiers:** openreview: VNmc3GV0cI, arxiv: 2408.00724
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview and arXiv are open; no official artifact URL was verified in the reviewed sources.
- **Topics:** reasoning, test-time scaling, efficient language models, evaluation
- **Methods:** majority voting, best-of-n, weighted voting, tree search, compute-optimal inference analysis
- **Datasets/benchmarks:** MATH, Llemma 7B/34B, multiple inference-compute budgets
- **Contribution:** Quantifies when spending compute on search and voting can beat spending it on parameters, and frames inference choices as cost-performance scaling laws.
- **Limitations:** Evidence is concentrated in mathematical problem solving; exact gains depend on verifier/search quality and hardware accounting; results do not establish universal scaling exponents; open-ended generation is largely out of scope.
- **Why it matters:** It gives senior researchers a principled way to compare larger models against cheaper models with stronger decoding, rather than treating parameter count as the only scaling axis.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API.

### 8. s1: Simple test-time scaling (2025)
- **Authors:** Niklas Muennighoff, Zitong Yang, Weijia Shi, Xiang Lisa Li, Li Fei-Fei, Hannaneh Hajishirzi, Luke Zettlemoyer, Percy Liang, Emmanuel Candès, and Tatsunori Hashimoto
- **Venue/status:** EMNLP — `peer-reviewed`
- **Paper:** https://aclanthology.org/2025.emnlp-main.1025/
- **Identifiers:** doi: 10.18653/v1/2025.emnlp-main.1025, anthology: 2025.emnlp-main.1025
- **Code:** https://github.com/simplescaling/s1
- **Data/models:** https://github.com/simplescaling/s1
- **Access/license:** ACL Anthology and the official s1 repository are public; repository materials are described by the authors as open-source, with the base model subject to its own license.
- **Topics:** reasoning, test-time scaling, data curation, efficient language models
- **Methods:** 1,000-example reasoning-trace SFT, budget forcing, Wait-token continuation, early termination control
- **Datasets/benchmarks:** s1K, MATH, AIME24, Qwen2.5-32B-Instruct
- **Contribution:** Shows that careful data selection plus explicit control of thinking length can produce strong test-time scaling behavior with very little supervised reasoning data.
- **Limitations:** Focused on competition-style mathematics; depends on a strong instruction-tuned base; budget forcing can be brittle; does not address all safety or factuality risks of longer traces.
- **Why it matters:** It is an unusually reproducible minimal intervention for studying test-time compute and is a useful foil to opaque large-scale reasoning-model recipes.
- **Verified:** 2026-11-20 via ACL Anthology page, official s1 repository.

### 9. The Illusion of Thinking: Understanding the Strengths and Limitations of Reasoning Models via the Lens of Problem Complexity (2025)
- **Authors:** Parshin Shojaee, Iman Mirzadeh, Keivan Alizadeh, Maxwell Horton, Samy Bengio, and Mehrdad Farajtabar
- **Venue/status:** NeurIPS — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2506.06941
- **Identifiers:** arxiv: 2506.06941
- **Code/data:** No official artifact URL verified.
- **Access/license:** arXiv is open; no official code/data URL was identified in the verified record. The arXiv comment records the NeurIPS 2025 camera-ready status.
- **Topics:** reasoning, evaluation, large reasoning models, problem complexity
- **Methods:** controllable puzzle environments, complexity sweeps, reasoning-trace analysis, equal-inference-compute comparisons
- **Datasets/benchmarks:** controllable puzzle suites, large reasoning models and matched standard LLMs
- **Contribution:** Separates final-answer accuracy from reasoning behavior and documents regimes in which reasoning effort rises, plateaus, and then collapses as problem complexity increases.
- **Limitations:** Puzzle environments do not span the full ecology of real reasoning; trace analysis depends on tokenizer/logging choices; results should not be generalized into a universal claim that reasoning models cannot reason; external replication is important.
- **Why it matters:** It warns against leaderboard-only evaluation of reasoning and provides a controlled methodology for stress-testing whether models execute algorithms or merely mimic traces.
- **Verified:** 2026-11-20 via NeurIPS status recorded in arXiv comment, arXiv abstract and API.

### 10. ReAct: Synergizing Reasoning and Acting in Language Models (2023)
- **Authors:** Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, and Yuan Cao
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=WE_vluYUL-X
- **Identifiers:** openreview: WE_vluYUL-X, arxiv: 2210.03629
- **Code:** https://github.com/ysymyth/ReAct
- **Data/models:** https://react-lm.github.io/
- **Access/license:** OpenReview, project page, and code are public; check the repository for current license terms.
- **Topics:** agents, reasoning, tool use, question answering, interactive decision making
- **Methods:** interleaved reasoning traces and actions, few-shot prompting, environment feedback, trajectory-level inspection
- **Datasets/benchmarks:** HotpotQA, FEVER, ALFWorld, WebShop
- **Contribution:** Established the now-standard agent loop in which natural-language reasoning guides actions and observations update subsequent reasoning.
- **Limitations:** Prompt-sensitive; reasoning traces can rationalize wrong actions; tool/API errors can compound; not itself a trained policy or guarantee of grounded behavior.
- **Why it matters:** It is the seminal design pattern behind contemporary tool-using and web agents and remains a necessary baseline before claiming that a new agent architecture is better.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official ReAct project/code.

### 11. SWE-bench: Can Language Models Resolve Real-World GitHub Issues? (2024)
- **Authors:** Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, and Karthik Narasimhan
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=VTF8yNQM66
- **Identifiers:** openreview: VTF8yNQM66, arxiv: 2310.06770
- **Code:** https://github.com/princeton-nlp/SWE-bench
- **Data/models:** https://www.swebench.com/
- **Access/license:** OpenReview, arXiv, project site, code, and benchmark are public; repository and dataset licenses are stated on the official project pages.
- **Topics:** agents, software engineering, evaluation, LLMs, long context
- **Methods:** repository-level issue resolution, execution-based tests, patch generation, real GitHub issue mining
- **Datasets/benchmarks:** SWE-bench (2,294 issues), 12 Python repositories, SWE-bench Lite/Verified derivatives
- **Contribution:** Introduced a realistic, execution-grounded benchmark for resolving actual repository issues rather than isolated code-completion prompts.
- **Limitations:** Python and repository-selection bias; public issues create contamination risk; unit tests do not capture all correctness or maintainability concerns; leaderboard scores depend heavily on scaffold and compute.
- **Why it matters:** It is the reference point for agentic software engineering and forces claims about coding agents to confront repository state, tests, and reproducibility.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official SWE-bench project/repository.

### 12. SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering (2024)
- **Authors:** John Yang, Carlos E. Jimenez, Alexander Wettig, Kilian Lieret, Shunyu Yao, Karthik Narasimhan, and Ofir Press
- **Venue/status:** NeurIPS — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=mXpq6ut8J3
- **Identifiers:** openreview: mXpq6ut8J3, arxiv: 2405.15793
- **Code:** https://github.com/SWE-agent/SWE-agent
- **Data/models:** https://swe-agent.com/
- **Access/license:** OpenReview, arXiv, project site, and code are public; check the repository for the current license.
- **Topics:** agents, software engineering, tool use, agent-computer interfaces, LLMs
- **Methods:** custom agent-computer interface, repository navigation, file editing, test execution, feedback-driven action loops
- **Datasets/benchmarks:** SWE-bench, HumanEvalFix
- **Contribution:** Demonstrates that interface design—what actions, observations, and editing affordances an LM sees—can materially change software-agent performance independent of model choice.
- **Limitations:** Early results are far below later heavily engineered systems; ACI benefits can be benchmark- and model-specific; interactive execution is expensive; security and sandboxing remain deployment concerns.
- **Why it matters:** It reframes agent progress as a joint model-plus-interface problem and provides an extensible open platform for controlled ACI ablations.
- **Verified:** 2026-11-20 via NeurIPS OpenReview page, arXiv API, official SWE-agent repository.

### 13. OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments (2024)
- **Authors:** Tianbao Xie, Danyang Zhang, Jixuan Chen, Xiaochuan Li, Siheng Zhao, Ruisheng Cao, Toh Jing Hua, Zhoujun Cheng, et al.
- **Venue/status:** NeurIPS Datasets and Benchmarks — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2404.07972
- **Identifiers:** arxiv: 2404.07972
- **Code:** https://github.com/xlang-ai/OSWorld
- **Data/models:** https://os-world.github.io/
- **Access/license:** arXiv, project site, code, environment, baselines, and data are public; check the repository for current license and VM/software terms.
- **Topics:** agents, multimodal NLP, computer use, evaluation, GUI grounding
- **Methods:** real operating-system environments, execution-based evaluation, multimodal observation, task setup and reset scripts
- **Datasets/benchmarks:** OSWorld (369 tasks), Ubuntu, Windows, macOS, real web and desktop applications
- **Contribution:** Moves agent evaluation from static web traces to live desktop environments with realistic files, applications, cross-application workflows, and executable success checks.
- **Limitations:** Environment setup and maintenance are substantial; GUI and software versions can drift; 369 tasks remain a sample of computer work; sandboxed scores may not transfer to unrestricted desktops.
- **Why it matters:** It is a standard stress test for generalist computer-use agents and exposes grounding and operational-knowledge failures hidden by text-only benchmarks.
- **Verified:** 2026-11-20 via NeurIPS 2024 proceedings/OpenReview listing, arXiv API, official OSWorld project/repository.

### 14. τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains (2025)
- **Authors:** Shunyu Yao, Noah Shinn, Pedram Razavi, and Karthik Narasimhan
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=roNSXZpUDN
- **Identifiers:** openreview: roNSXZpUDN, arxiv: 2406.12045
- **Code:** https://github.com/sierra-research/tau-bench
- **Access/license:** OpenReview, arXiv, and the official repository are public; check the repository for current license terms.
- **Topics:** agents, tool use, dialogue, evaluation, reliability
- **Methods:** simulated users, domain-specific API tools, policy adherence, database-state comparison, pass^k reliability
- **Datasets/benchmarks:** τ-bench airline, τ-bench retail, multi-turn tool-agent-user conversations
- **Contribution:** Evaluates whether agents follow domain rules and interact reliably with users over repeated trials, rather than whether one sampled trajectory happens to succeed.
- **Limitations:** Only a small number of domains; simulated users and APIs differ from production systems; database-state equivalence may miss some process harms; closed-model results age quickly.
- **Why it matters:** It supplies the reliability metric and conversational policy setting that single-shot tool benchmarks lack, making agent variance and rule violations measurable.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official τ-bench repository.

### 15. TheAgentCompany: Benchmarking LLM Agents on Consequential Real World Tasks (2025)
- **Authors:** Frank F. Xu, Yufan Song, Boxuan Li, Yuxuan Tang, Kritanjali Jain, Mengxue Bao, Zora Z. Wang, Xuhui Zhou, et al.
- **Venue/status:** NeurIPS Datasets and Benchmarks — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2412.14161
- **Identifiers:** arxiv: 2412.14161
- **Code:** https://github.com/TheAgentCompany/TheAgentCompany
- **Data/models:** https://the-agent-company.com/
- **Access/license:** arXiv, project site, code, data, environment, and experiments are public; check the repository for current license and third-party service terms.
- **Topics:** agents, work automation, web agents, software agents, evaluation
- **Methods:** self-contained company sandbox, web browsing, coding and program execution, coworker communication, consequential task checks
- **Datasets/benchmarks:** TheAgentCompany task suite, internal websites and company data, closed- and open-weight baseline agents
- **Contribution:** Creates a workplace-like environment in which agents must combine browsing, coding, communication, and state changes to complete economically meaningful tasks.
- **Limitations:** Sandbox realism is still limited; environment and service maintenance affect reproducibility; task completion does not measure all workplace judgment or safety; results are sensitive to scaffold and model version.
- **Why it matters:** It is a useful bridge from toy web tasks to consequential digital work and clarifies how far current agents are from autonomous long-horizon professional execution.
- **Verified:** 2026-11-20 via NeurIPS 2025 listing, arXiv API, official TheAgentCompany project/repository.

### 16. WorkForceAgent-R1: Incentivizing Reasoning Capability in LLM-based Web Agents via Reinforcement Learning (2026)
- **Authors:** Yuchen Zhuang, Di Jin, Jiaao Chen, Wenqi Shi, Hanrui Wang, and Chao Zhang
- **Venue/status:** Findings of EACL — `peer-reviewed`
- **Paper:** https://aclanthology.org/2026.findings-eacl.3/
- **Identifiers:** doi: 10.18653/v1/2026.findings-eacl.3, anthology: 2026.findings-eacl.3, arxiv: 2505.22942
- **Code/data:** No official artifact URL verified.
- **Access/license:** ACL Anthology and arXiv are open; no official code or data release was identified on the verified Anthology record.
- **Topics:** agents, web agents, reinforcement learning, reasoning, enterprise workflows
- **Methods:** R1-style rule-based RL, format and action-correctness rewards, single-step reasoning and planning, web-navigation policies
- **Datasets/benchmarks:** WorkArena, business-oriented web-navigation tasks
- **Contribution:** Applies verifiable-reward RL directly to web-agent action selection, targeting reasoning and robustness without extensive expert demonstrations.
- **Limitations:** Evaluation is centered on WorkArena; rule rewards can encourage format compliance without deep task understanding; comparisons to proprietary agents are time-sensitive; no official artifact was verified.
- **Why it matters:** It connects the DeepSeek-R1 style of verifiable RL to operational web agents, an important step beyond prompting-only agent loops.
- **Verified:** 2026-11-20 via ACL Anthology page, arXiv API.

### 17. AI Agents That Matter (2025)
- **Authors:** Sayash Kapoor, Benedikt Stroebl, Zachary S. Siegel, Nitya Nadgir, and Arvind Narayanan
- **Venue/status:** Transactions on Machine Learning Research (TMLR) — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=Zy4uFzMviZ
- **Identifiers:** openreview: Zy4uFzMviZ, arxiv: 2407.01502
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview and arXiv are open; no official artifact URL was identified in the verified record.
- **Topics:** agents, evaluation, benchmarking, cost-aware AI, reproducibility
- **Methods:** accuracy-cost Pareto analysis, benchmark auditing, holdout design, overfitting analysis, evaluation-standard recommendations
- **Datasets/benchmarks:** analysis of contemporary agent benchmarks and evaluation practices
- **Contribution:** Shows how optimizing accuracy alone can produce needlessly costly agents and how weak holdouts and inconsistent protocols create misleading conclusions.
- **Limitations:** Primarily a methodological and empirical critique rather than a new agent; recommendations require community adoption; cost accounting depends on deployment context.
- **Why it matters:** It is required reading before publishing or deploying agent claims because it changes the unit of progress from isolated accuracy to reproducible cost-adjusted usefulness.
- **Verified:** 2026-11-20 via TMLR OpenReview page, arXiv API.

### 18. MMLU-ProX: A Multilingual Benchmark for Advanced Large Language Model Evaluation (2025)
- **Authors:** Weihao Xuan, Rui Yang, Heli Qi, Qingcheng Zeng, Yunze Xiao, Aosong Feng, Dairui Liu, Yun Xing, et al.
- **Venue/status:** EMNLP — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2503.10497
- **Identifiers:** arxiv: 2503.10497
- **Code/data:** No official artifact URL verified.
- **Access/license:** arXiv is open; no official code/data URL was verified in the reviewed sources. Benchmark use may require accepting dataset terms supplied by the authors.
- **Topics:** evaluation, multilingual NLP, LLMs, cross-lingual reasoning
- **Methods:** parallel translation and expert review, 29-language benchmark construction, cross-lingual comparisons, lite evaluation split
- **Datasets/benchmarks:** MMLU-ProX (11,829 questions per language), MMLU-ProX Lite (658 questions per language), 36 evaluated LLMs
- **Contribution:** Provides parallel advanced-reasoning questions across 29 languages, enabling more direct separation of language capability from task difficulty.
- **Limitations:** Translation and terminology artifacts remain possible; multiple-choice format does not measure generation quality; subject coverage inherits MMLU-Pro choices; public pretraining contamination is difficult to exclude.
- **Why it matters:** It is a strong current diagnostic for multilingual equity and for checking whether English reasoning gains transfer to lower-resource languages.
- **Verified:** 2026-11-20 via EMNLP 2025 acceptance source, arXiv abstract and API.

### 19. DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines (2024)
- **Authors:** Omar Khattab, Arnav Singhvi, Paridhi Maheshwari, Zhiyuan Zhang, Keshav Santhanam, Sri Vardhamanan, Saiful Haq, Ashutosh Sharma, et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2310.03714
- **Identifiers:** arxiv: 2310.03714
- **Code:** https://github.com/stanfordnlp/dspy
- **Access/license:** arXiv and official code are public; the repository carries its own open-source license and evolving APIs.
- **Topics:** prompt optimization, compound AI systems, agents, RAG, programming models
- **Methods:** declarative LM modules, text-transformation graphs, automatic prompt/demonstration compilation, metric-driven pipeline optimization
- **Datasets/benchmarks:** math word problems, multi-hop retrieval, complex QA, agent-loop case studies
- **Contribution:** Replaces hand-written prompt strings with composable programs and a compiler that optimizes prompts, demonstrations, and pipeline choices against explicit metrics.
- **Limitations:** Optimization can overfit the selected metric and dev set; search/compilation adds API and compute cost; program correctness and safety still require engineering controls; framework abstractions evolve quickly.
- **Why it matters:** It is a foundational system-level treatment of prompts as optimizable program parameters and underlies much current work on automated agent/pipeline construction.
- **Verified:** 2026-11-20 via ICLR 2024 acceptance source, arXiv API, official DSPy repository.

### 20. Large Language Models as Optimizers (2024)
- **Authors:** Chengrun Yang, Xuezhi Wang, Yifeng Lu, Hanxiao Liu, Quoc V. Le, Denny Zhou, and Xinyun Chen
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=92gvk82DE-
- **Identifiers:** openreview: 92gvk82DE-, arxiv: 2309.03409
- **Code:** https://github.com/google-deepmind/opro
- **Access/license:** OpenReview, arXiv, and official code are public; check the repository for current license terms.
- **Topics:** prompt optimization, black-box optimization, LLMs, reasoning
- **Methods:** Optimization by PROmpting (OPRO), iterative candidate generation, natural-language optimization traces, task-metric feedback
- **Datasets/benchmarks:** linear regression, traveling-salesman problems, GSM8K, BIG-Bench Hard
- **Contribution:** Shows that an LLM can act as a black-box optimizer by reading previous candidate solutions and scores, including optimizing instructions for downstream tasks.
- **Limitations:** Evaluation calls can be expensive; search can settle in local optima; results vary by optimizer model, task, and initialization; does not provide gradient-style convergence guarantees.
- **Why it matters:** It formalized LLM-in-the-loop optimization in a simple, reproducible way and remains a baseline for newer reflective and evolutionary prompt optimizers.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official OPRO repository.

### 21. Optimizing generative AI by backpropagating language model feedback (2025)
- **Authors:** Mert Yuksekgonul, Federico Bianchi, Joseph Boen, Sheng Liu, Zhi Huang, Carlos Guestrin, and James Zou
- **Venue/status:** Nature — `peer-reviewed`
- **Paper:** https://doi.org/10.1038/s41586-025-08661-4
- **Identifiers:** doi: 10.1038/s41586-025-08661-4, arxiv: 2406.07496, alternate_title: TextGrad: Automatic "Differentiation" via Text
- **Code:** https://github.com/zou-group/textgrad
- **Access/license:** The arXiv version and official code are open; the Nature page may have access controls. Check the repository for current license terms.
- **Topics:** prompt optimization, compound AI systems, automatic differentiation, agents, scientific AI
- **Methods:** textual gradients, natural-language feedback backpropagation, computation graphs, component-wise optimization
- **Datasets/benchmarks:** GPQA, LeetCode-Hard, molecule optimization, radiotherapy treatment planning, prompt optimization
- **Contribution:** Generalizes prompt tuning into an autograd-like framework in which LLM feedback propagates through multiple components of a compound AI system.
- **Limitations:** Textual feedback can be noisy or non-faithful; credit assignment through long graphs is difficult; API calls and evaluator quality drive cost and variance; domain demos require expert validation.
- **Why it matters:** It is a key conceptual step from single-prompt search to end-to-end optimization of heterogeneous LLM programs, agents, and scientific pipelines.
- **Verified:** 2026-11-20 via Nature DOI page, arXiv API, official TextGrad repository.

### 22. GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning (2026)
- **Authors:** Lakshya A. Agrawal, Shangyin Tan, Dilara Soylu, Noah Ziems, Rishi Khare, Krista Opsahl-Ong, Arnav Singhvi, Herumb Shandilya, et al.
- **Venue/status:** ICLR (Oral) — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2507.19457
- **Identifiers:** arxiv: 2507.19457
- **Code:** https://github.com/gepa-ai/gepa
- **Access/license:** arXiv and official code are public; the arXiv comment records acceptance to ICLR 2026 as an oral. Check the repository for current license terms.
- **Topics:** prompt optimization, agents, reflective learning, evolutionary search, LLM programs
- **Methods:** natural-language reflection, genetic/Pareto prompt evolution, trajectory diagnosis, prompt updates from trial and error
- **Datasets/benchmarks:** six benchmark tasks, AIME-2025, code optimization, GRPO and MIPROv2 comparisons
- **Contribution:** Uses rich textual feedback from rollouts to evolve prompts and maintain a Pareto frontier of complementary prompt candidates with far fewer rollouts than scalar-reward RL in the reported setting.
- **Limitations:** Comparisons depend on task, evaluator, rollout budget, and base model; prompt evolution can overfit development metrics; natural-language reflection may preserve evaluator biases; does not supersede RL for all policy-learning problems.
- **Why it matters:** It is a leading 2026 method for treating agent trajectories as interpretable training signal and is directly relevant to optimizing complex multi-prompt systems.
- **Verified:** 2026-11-20 via ICLR 2026 acceptance recorded in arXiv comment, arXiv API, official GEPA repository.

### 23. Direct Preference Optimization: Your Language Model is Secretly a Reward Model (2023)
- **Authors:** Rafael Rafailov, Archit Sharma, Eric Mitchell, Stefano Ermon, Christopher D. Manning, and Chelsea Finn
- **Venue/status:** NeurIPS — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2305.18290
- **Identifiers:** arxiv: 2305.18290
- **Code:** https://github.com/eric-mitchell/direct-preference-optimization
- **Access/license:** arXiv and the authors implementation are public; check the repository for current license terms.
- **Topics:** alignment, preference learning, RLHF, LLMs
- **Methods:** closed-form reward-policy parameterization, binary preference classification loss, KL-constrained policy optimization without explicit RL
- **Datasets/benchmarks:** sentiment control, summarization, single-turn dialogue, preference datasets
- **Contribution:** Derives a stable supervised objective for preference alignment that removes the explicit reward-model and online-RL stages used by conventional RLHF.
- **Limitations:** Offline preferences can be unrepresentative or noisy; KL and data choices still matter; preference optimization can exploit evaluator biases; does not by itself solve safety, truthfulness, or pluralistic values.
- **Why it matters:** DPO is now a standard post-training primitive and a baseline for nearly every new preference-optimization or alignment method.
- **Verified:** 2026-11-20 via NeurIPS 2023 proceedings listing, arXiv API, author implementation.

### 24. Safety Alignment Should Be Made More Than Just a Few Tokens Deep (2025)
- **Authors:** Xiangyu Qi, Ashwinee Panda, Kaifeng Lyu, Xiao Ma, Subhrajit Roy, Ahmad Beirami, Prateek Mittal, and Peter Henderson
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=6QJ4W1mE0u
- **Identifiers:** openreview: 6QJ4W1mE0u, arxiv: 2406.05946
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview and arXiv are open; no official code/data URL was identified in the verified record.
- **Topics:** alignment, safety, jailbreaks, fine-tuning attacks, interpretability
- **Methods:** shallow-alignment diagnosis, prefilling and adversarial-suffix analysis, fine-tuning attack analysis, regularized fine-tuning objective
- **Datasets/benchmarks:** multiple aligned LLMs, adversarial suffix attacks, prefilling attacks, decoding attacks, fine-tuning attacks
- **Contribution:** Unifies several jailbreak and fine-tuning vulnerabilities as symptoms of alignment concentrated in the earliest output tokens and explores deeper, more persistent safety behavior.
- **Limitations:** Does not provide a complete defense; attack and defense results are model- and dataset-specific; regularization may trade off utility; safety depth is difficult to measure independently of behavior.
- **Why it matters:** It gives alignment researchers a concrete mechanistic failure mode to measure and attack, rather than treating jailbreaks as unrelated benchmark anomalies.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API.

### 25. Any-Depth Alignment: Unlocking Innate Safety Alignment of LLMs to Any-Depth (2026)
- **Authors:** Jianhui Li et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=0fuYOuJyzl
- **Identifiers:** openreview: 0fuYOuJyzl
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview is public. No official code/data URL was verified in the reviewed sources; author list is abbreviated here and the OpenReview page is canonical.
- **Topics:** alignment, safety, robustness, LLMs
- **Methods:** any-depth safety alignment, refusal-behavior analysis, depth-sensitive training
- **Datasets/benchmarks:** safety-alignment and jailbreak evaluations reported in the paper
- **Contribution:** Extends the shallow-safety critique by developing alignment intended to remain active beyond the first few generated tokens.
- **Limitations:** OpenReview metadata was used because no separate artifact was verified; defense coverage and utility trade-offs require replication; does not eliminate adaptive jailbreak risk.
- **Why it matters:** It is a current 2026 follow-on to the shallow-alignment literature and helps test whether depth-targeted training produces durable safety rather than another narrow patch.
- **Verified:** 2026-11-20 via ICLR 2026 OpenReview page, official conference listing.

### 26. Sparse Autoencoders Find Highly Interpretable Features in Language Models (2024)
- **Authors:** Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, and Lee Sharkey
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=76eOTne6DI
- **Identifiers:** openreview: 76eOTne6DI, arxiv: 2309.08600
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview and arXiv are open; no official code/data URL was identified in the verified record.
- **Topics:** interpretability, mechanistic interpretability, sparse autoencoders, LLMs
- **Methods:** overcomplete sparse autoencoders, activation reconstruction, monosemantic-feature discovery, causal feature analysis
- **Datasets/benchmarks:** language-model activations, indirect-object-identification task, automated interpretability evaluations
- **Contribution:** Demonstrates that sparse autoencoders can recover more monosemantic, causally relevant features than neuron directions, making superposition empirically tractable.
- **Limitations:** Feature dictionaries can be incomplete or split/merge concepts; automated interpretability labels are imperfect; scaling to frontier models and full circuits remains difficult; reconstruction fidelity does not guarantee causal completeness.
- **Why it matters:** It catalyzed the modern SAE research program and remains a baseline for judging newer transcoders, temporal SAEs, and feature-circuit methods.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API.

### 27. Patchscopes: A Unifying Framework for Inspecting Hidden Representations of Language Models (2024)
- **Authors:** Asma Ghandeharioun, Avi Caciularu, Adam Pearce, Lucas Dixon, and Mor Geva
- **Venue/status:** ICML (PMLR 235) — `peer-reviewed`
- **Paper:** https://proceedings.mlr.press/v235/ghandeharioun24a.html
- **Identifiers:** pmlr: v235/ghandeharioun24a, arxiv: 2401.06102
- **Code:** https://github.com/google-research/google-research/tree/master/patchscopes
- **Access/license:** PMLR and arXiv are open; the Google Research code path is public, with repository-level license terms.
- **Topics:** interpretability, hidden representations, mechanistic interpretability, LLMs
- **Methods:** representation patching, natural-language inspection, vocabulary-space projection, cross-model explanation
- **Datasets/benchmarks:** multi-hop reasoning, early-layer representation inspection, representation verbalization case studies
- **Contribution:** Unifies multiple activation-inspection methods as instances of patching hidden representations into model contexts and lets models verbalize what those representations encode.
- **Limitations:** Generated explanations can be unfaithful; results depend on the explainer model and prompt; natural-language descriptions are not complete causal accounts; method can inherit model biases.
- **Why it matters:** It provides a flexible experimental interface for representation analysis and complements, but does not replace, causal circuit methods.
- **Verified:** 2026-11-20 via PMLR paper page, arXiv API, official Patchscopes code path.

### 28. Transcoders Find Interpretable LLM Feature Circuits (2024)
- **Authors:** Jacob Dunefsky, Philippe Chlenski, and Neel Nanda
- **Venue/status:** NeurIPS — `peer-reviewed`
- **Paper:** https://arxiv.org/abs/2406.11944
- **Identifiers:** arxiv: 2406.11944
- **Code:** https://github.com/jacobdunefsky/transcoder_circuits/
- **Access/license:** arXiv and the official repository are public; check the repository for current license terms.
- **Topics:** interpretability, mechanistic interpretability, sparse circuits, LLMs
- **Methods:** transcoders, sparse MLP approximation, weights-based circuit analysis, input-dependent and input-invariant factorization
- **Datasets/benchmarks:** 120M, 410M, and 1.4B parameter language models, GPT-2 small greater-than circuit
- **Contribution:** Approximates dense MLP layers with wider sparsely activating layers to make fine-grained, weights-based circuit analysis through MLPs tractable.
- **Limitations:** Approximation error can alter circuits; experiments are limited to relatively small models; feature interpretability remains partly subjective; circuit extraction can still miss global behavior.
- **Why it matters:** It addresses a major bottleneck left by SAEs—MLP nonlinearity—and offers a concrete path from interpretable features to interpretable circuits.
- **Verified:** 2026-11-20 via NeurIPS 2024 status recorded in arXiv comment, arXiv API, official transcoder repository.

### 29. Temporal Sparse Autoencoders: Leveraging Sequential Nature of Language for More Interpretable AI (2026)
- **Authors:** William Brandon et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=bojVI4l9Kn
- **Identifiers:** openreview: bojVI4l9Kn
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview is public. No official code/data URL was verified in the reviewed sources; author list is abbreviated here and the OpenReview page is canonical.
- **Topics:** interpretability, sparse autoencoders, sequence modeling, LLMs
- **Methods:** temporal sparse autoencoders, sequence-context-aware feature learning, interpretability diagnostics
- **Datasets/benchmarks:** sequential language-model activations and interpretability evaluations reported in the paper
- **Contribution:** Extends SAEs beyond token-local activation dictionaries by exploiting sequential context, aiming to recover features that reflect linguistic dynamics.
- **Limitations:** Early 2026 method requiring independent replication; additional temporal structure increases training and analysis complexity; causal usefulness over standard SAEs must be established task by task.
- **Why it matters:** It is a current direction for making interpretability methods respect context and sequence rather than treating activations as isolated vectors.
- **Verified:** 2026-11-20 via ICLR 2026 OpenReview page, official conference listing.

### 30. Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model (2024)
- **Authors:** Ahmet Üstün, Viraat Aryabumi, Zheng-Xin Yong, Wei-Yin Ko, Daniel D’souza, Gbemileke Onilude, Neel Bhandari, Shivalika Singh, et al.
- **Venue/status:** ACL (Best Paper Award) — `peer-reviewed`
- **Paper:** https://aclanthology.org/2024.acl-long.845/
- **Identifiers:** doi: 10.18653/v1/2024.acl-long.845, anthology: 2024.acl-long.845, arxiv: 2402.07827
- **Code:** https://github.com/cohere-ai/aya
- **Data/models:** https://huggingface.co/datasets/CohereForAI/aya_dataset
- **Access/license:** ACL Anthology, arXiv, code, dataset, and model pages are public; model and dataset use are governed by the licenses on their Cohere-for-AI artifact pages.
- **Topics:** multilingual NLP, instruction tuning, LLMs, evaluation, safety
- **Methods:** massively multilingual instruction fine-tuning, data-mixture ablations, data pruning, toxicity/bias/safety analysis, human evaluation
- **Datasets/benchmarks:** Aya dataset, Aya model, 101 instruction languages, evaluation across 99 languages
- **Contribution:** Provides an open-access multilingual instruction model and a broad evaluation suite, with explicit attention to lower-resource languages and safety.
- **Limitations:** Coverage and quality remain uneven across languages; translated or synthetic instruction data can carry artifacts; safety analysis does not eliminate language-specific harms; base-model and dataset licenses constrain reuse.
- **Why it matters:** It is a reference point for multilingual inclusion and a reminder that post-training recipes and safety conclusions do not automatically transfer across languages.
- **Verified:** 2026-11-20 via ACL Anthology page, arXiv page, official Aya repository/dataset.

### 31. Long Chain-of-Thought Reasoning Across Languages (2026)
- **Authors:** Jiashun Jin et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=3mmxhL6Alj
- **Identifiers:** openreview: 3mmxhL6Alj
- **Code/data:** No official artifact URL verified.
- **Access/license:** OpenReview is public. No official code/data URL was verified in the reviewed sources; author list is abbreviated here and the OpenReview page is canonical.
- **Topics:** multilingual NLP, reasoning, long chain-of-thought, cross-lingual transfer, LLMs
- **Methods:** long chain-of-thought transfer, multilingual reasoning training, cross-language evaluation
- **Datasets/benchmarks:** multilingual reasoning evaluations reported in the paper
- **Contribution:** Studies how long-form reasoning behavior can be induced or transferred beyond English, addressing the English bias of many reasoning-model recipes.
- **Limitations:** OpenReview metadata was used because no separate artifact was verified; language and domain coverage require scrutiny; long traces increase inference cost and can hide translation or reasoning errors.
- **Why it matters:** It is directly relevant to making reasoning models globally useful and to separating multilingual language understanding from reasoning-trace language.
- **Verified:** 2026-11-20 via ICLR 2026 OpenReview page, official conference listing.

### 32. OLMoE: Open Mixture-of-Experts Language Models (2025)
- **Authors:** Niklas Muennighoff, Luca Soldaini, Dirk Groeneveld, Kyle Lo, Jacob Morrison, Sewon Min, Weijia Shi, Pete Walsh, et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=9aZzvW5lIa
- **Identifiers:** openreview: 9aZzvW5lIa, arxiv: 2409.02060
- **Code:** https://github.com/allenai/OLMoE
- **Access/license:** OpenReview, arXiv, code, weights, data, and logs are public; users must follow the licenses attached to each OLMoE artifact and third-party data.
- **Topics:** efficient language models, mixture of experts, open models, pretraining, routing
- **Methods:** sparse MoE, 1B active / 7B total parameters, routing analysis, open pretraining on 5T tokens, instruction adaptation
- **Datasets/benchmarks:** OLMoE-1B-7B, OLMoE-1B-7B-Instruct, MoE training and routing ablations
- **Contribution:** Releases a complete open MoE stack at a compute-relevant active-parameter scale, including weights, training data, code, and logs.
- **Limitations:** Single principal scale limits scaling conclusions; routing specialization and load balance remain active research issues; performance depends on total memory as well as active compute; language/domain coverage follows the released corpus.
- **Why it matters:** It is an unusually transparent testbed for MoE routing, efficiency, and pretraining decisions that proprietary MoE reports do not expose.
- **Verified:** 2026-11-20 via ICLR OpenReview page, arXiv API, official OLMoE repository.

### 33. Fast-dLLM: Training-free Acceleration of Diffusion LLM by Enabling KV Cache and Parallel Decoding (2026)
- **Authors:** Chengyue Wu et al.
- **Venue/status:** ICLR — `peer-reviewed`
- **Paper:** https://openreview.net/forum?id=4P8xYUQhOb
- **Identifiers:** openreview: 4P8xYUQhOb
- **Code:** https://github.com/NVlabs/Fast-dLLM
- **Access/license:** OpenReview and the official repository are public; check the repository for current license terms. Author list is abbreviated here and OpenReview is canonical.
- **Topics:** efficient language models, diffusion language models, inference acceleration, parallel decoding, KV cache
- **Methods:** training-free acceleration, KV-cache reuse, parallel decoding, diffusion-LM inference engineering
- **Datasets/benchmarks:** diffusion LLM inference benchmarks reported in the paper
- **Contribution:** Adapts KV caching and parallel decoding ideas to diffusion language models without retraining, targeting a key latency bottleneck in this emerging model class.
- **Limitations:** Specific to diffusion-style LMs rather than standard autoregressive models; speed-quality trade-offs depend on hardware and decoding settings; broader task and safety effects need replication.
- **Why it matters:** It is an important efficiency paper for researchers tracking alternatives to autoregressive decoding and the systems work needed to make them practical.
- **Verified:** 2026-11-20 via ICLR 2026 OpenReview page, official Fast-dLLM repository.

## Practical reading priorities

1. **Agents:** ReAct → SWE-bench/SWE-agent → OSWorld/τ-bench → TheAgentCompany → AI Agents That Matter → WorkForceAgent-R1.
2. **Reasoning:** Inference Scaling Laws → s1 → DeepSeek-R1 → The Illusion of Thinking.
3. **Grounding:** RAG → Self-RAG; test retrieval necessity, faithfulness, freshness, and cost.
4. **Optimization:** DSPy → OPRO → TextGrad → GEPA.
5. **Alignment/interpretability:** DPO → Shallow Safety → Any-Depth; SAEs → Patchscopes → Transcoders → Temporal SAEs.
6. **Multilingual/efficiency:** Aya → MMLU-ProX → Long CoT → Qwen3 → OLMoE/Fast-dLLM.

## Cautions

- This is a curated research map, not a complete bibliography.
- Time-sensitive benchmark rankings and universal SOTA claims are intentionally omitted.
- For abbreviated consortium author lists, the linked official page is canonical.
- Re-check artifact licenses before redistribution or commercial use.
