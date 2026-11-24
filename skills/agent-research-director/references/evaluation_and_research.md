# Evaluation and research basis

## Contents

- Evaluation design
- Research map
- Security evidence

## Evaluation design

For a concrete skill revision, use the [bounded evaluation protocol](evaluation_protocol.md) and its offline receipt gate. Freeze task splits and acceptance rules before evaluation; retain incomplete or contaminated results as inconclusive. Gate unit tests validate decision handling and do not measure agent competence.

Compare the orchestrator against a single-agent and simplest adequate workflow. Report task quality, repeated-run reliability, latency, token/tool/monetary cost, human interventions, and failure taxonomy together. Use held-out tasks and multiple runs; do not claim improvement from a successful anecdote. Rotate contaminated/saturated benchmarks and document model/version/prompt/tool differences.

Candidate evidence sources: AgentBench (ICLR 2024) https://arxiv.org/abs/2308.03688; SWE-bench (ICLR 2024) https://arxiv.org/abs/2310.06770; GAIA preprint https://arxiv.org/abs/2311.12983; τ-bench preprint https://arxiv.org/abs/2406.12045; AI Agents That Matter https://arxiv.org/abs/2407.01502; rigorous agentic-benchmark checklist https://arxiv.org/abs/2507.02825; MAST multi-agent failure analysis https://arxiv.org/abs/2503.13657.

For security, evaluate utility and attack success together with AgentDojo https://arxiv.org/abs/2406.13352, indirect prompt injection research https://arxiv.org/abs/2302.12173, InjecAgent https://arxiv.org/abs/2403.02691, and skill-injection literature such as https://arxiv.org/abs/2602.20156 and https://arxiv.org/abs/2602.14211. Adaptive attacks and tool/skill updates belong in the evaluation set; a static clean result is not proof of safety.

## Research map

| Design function | Primary research starting points |
|---|---|
| Interleaved reasoning/action | ReAct, ICLR 2023 — https://arxiv.org/abs/2210.03629 |
| Tool learning | Toolformer, NeurIPS 2023 — https://arxiv.org/abs/2302.04761 |
| Plan/decomposition | Plan-and-Solve, ACL 2023 — https://aclanthology.org/2023.acl-long.147/; Least-to-Most, ICLR 2023 — https://arxiv.org/abs/2205.10625 |
| Bounded reflection | Reflexion, NeurIPS 2023 — https://arxiv.org/abs/2303.11366; Self-Refine, NeurIPS 2023 — https://arxiv.org/abs/2303.17651 |
| Deliberate branching | Tree of Thoughts, NeurIPS 2023 — https://arxiv.org/abs/2305.10601; use selectively because of cost |
| Multi-agent collaboration | CAMEL, NeurIPS 2023 — https://arxiv.org/abs/2303.17760; AutoGen, COLM 2024 — https://arxiv.org/abs/2308.08155; MetaGPT, ICLR 2024 — https://arxiv.org/abs/2308.00352 |
| Verified skill acquisition | Voyager, TMLR 2024 — https://arxiv.org/abs/2305.16291 |
| Capability-confined security | CaMeL preprint — https://arxiv.org/abs/2503.18813; StruQ, USENIX Security 2025 — https://arxiv.org/abs/2402.06363 |
| Appropriate human reliance | Parasuraman et al., DOI 10.1109/3468.844354; Lee & See, DOI 10.1518/hfes.46.1.50.30392 |

Use arXiv links when final venue metadata is uncertain. Distinguish preprints, conference/journal publications, industry engineering posts, and original design recommendations. Do not infer universal effectiveness from benchmark-specific gains.

## Security evidence

Read indirect prompt injection, MCP tool poisoning, excessive agency, and skill supply-chain material before enabling external tools or third-party skills. Industry primary sources: OWASP prompt injection https://genai.owasp.org/llmrisk/llm01-prompt-injection/ and excessive agency https://genai.owasp.org/llmrisk/llm062025-excessive-agency/; Invariant Labs tool-poisoning disclosure https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks; Anthropic Agent Skills guidance https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills.

A skill is code plus instructions and supply-chain content. Pin and hash it, review its permissions, test adversarial cases, and require re-approval on drift. Never let content from a skill, tool, website, document, or binary silently expand the agent’s authority.
