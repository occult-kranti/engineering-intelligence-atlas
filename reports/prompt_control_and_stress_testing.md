# Prompt Engineering & Control of Director/Subagent Systems — Research Report

**Scope:** structured prompts/contracts, progressive disclosure, role/skill prompts, token/minute/dollar budgets, timeouts/aborts, pricing/cost metering, retry/idempotency, loop/no-progress detection, independent verification, prompt-injection defense, and stress/failure testing.

**Method:** 6 distinct web search rounds plus 1 direct primary-source fetch (Anthropic engineering blog). Observed documentation/literature is presented in Part A with inline URLs; original synthesis/recommendations are clearly separated in Parts B and C.

**Verification status legend:**
- **[PRIMARY]** — official vendor documentation, official engineering blog, or peer-reviewed/arXiv paper.
- **[SECONDARY — VERIFY]** — practitioner/secondary source; directionally consistent with primary material but not independently confirmed. Treat as a lead, not a fact.
- **[UNVERIFIED]** — single-source claim; do not rely on it.

---

## PART A — Observed documentation & literature (by theme)

### A1. Structured prompts / contracts for delegation

- **[PRIMARY]** Anthropic, "How we built our multi-agent research system" (fetched directly): the lead agent decomposes queries into subtasks; "Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries. Without detailed task descriptions, agents duplicate work, leave gaps, or fail to find necessary information." Early vague briefs (e.g., "research the semiconductor shortage") caused subagents to duplicate work and misinterpret scope. Effort-scaling rules were embedded in prompts: "Simple fact-finding requires just 1 agent with 3-10 tool calls, direct comparisons might need 2-4 subagents with 10-15 calls each, and complex research might use more than 10 subagents with clearly divided responsibilities." Parallelization (lead spawns 3-5 subagents; subagents use 3+ tools in parallel) "cut research time by up to 90% for complex queries."
  https://www.anthropic.com/engineering/multi-agent-research-system
- **[PRIMARY]** OpenAI Agents SDK: handoffs can carry a structured `input_type` schema (making handoffs structured rather than purely implicit); `output_type` enforces schema-constrained final outputs; guardrails exist at input, output, and tool level; `handoff_description` should be short and concrete.
  https://openai.github.io/openai-agents-python/agents/
  https://openai.github.io/openai-agents-python/guardrails/
  https://developers.openai.com/api/docs/guides/agents/orchestration
- **[SECONDARY — VERIFY]** OpenAI's structured-outputs announcement reported ~100% schema compliance with constrained decoding vs <40% for unconstrained prompting on a complex-schema eval. Caveat (well-supported logically): schema constraint guarantees the *shape* of a response, not its *truth* — a model can emit valid JSON containing fabricated content.
  https://neomeric.com/blog/ai-guardrails-structured-outputs/

### A2. Progressive disclosure / context engineering

- **[PRIMARY]** Anthropic, "Effective Context Engineering for AI Agents" (Applied AI team, Sept 2025): context engineering = curating the full token set the model sees; "context rot" — performance degrades as token volume grows (n² attention dilution). Techniques for long-horizon tasks: compaction (summarize and restart context), structured note-taking (agent-written memory outside the context window), and sub-agent architectures (specialized agents in clean contexts returning compressed summaries). Just-in-time retrieval with lightweight identifiers (paths, queries, links) preferred over loading everything upfront.
  Summarized with quotes at: https://ntlx.github.io/agentic-work-atlas/wiki/sources/20260702-anthropic-context-engineering
  and https://www.snipara.com/blog/context-engineering-anthropic-framework
- **[SECONDARY — VERIFY]** Anthropic Agent Skills implement progressive disclosure in three levels: Level 1 metadata (~100 tokens, always loaded), Level 2 SKILL.md body (<~5k tokens, loaded when triggered), Level 3 bundled resources (loaded on demand; scripts run in bash and only their output enters context). Token figures per third-party write-up of Anthropic docs.
  https://dreaming.press/posts/context-engineering-anthropic-way-claude-skills-compaction-memory.html
- **[SECONDARY — VERIFY; MODEL-GENERATION-SPECIFIC — DO NOT TREAT AS STABLE OFFICIAL FACT]** Reports that for Claude 5-generation models Anthropic removed >80% of Claude Code's system prompt with no measured coding-eval loss, publishing "six shifts" (rules→judgment, examples→interface design, upfront→progressive disclosure, repetition→single simple descriptions, manual memory→auto-memory, simple specs→rich references). Confirm against the current Anthropic post before applying to a given model generation.
  https://www.developersdigest.tech/blog/context-engineering-claude-5-new-rules-2026

### A3. Role / skill prompts

- **[PRIMARY]** Claude Code subagent documentation best practices: design focused subagents with single clear responsibilities; write detailed prompts with specific instructions, examples, and constraints; limit tool access to what the subagent's purpose requires; version-control project subagents. Noted tradeoff: subagents start with a clean context each invocation, which preserves the main context but adds latency.
  https://docs.anthropic.com/en/docs/claude-code/sub-agents
- **[SECONDARY — VERIFY]** Later Anthropic guidance (2026) reportedly advises evaluating whether to fold subagents back into the main agent loop as skills + tools: build a small end-to-end eval (a set of ~10 golden examples is enough to start), fold one subagent at a time, and keep it as a subagent only if the folded version scores worse.
  https://aicoder.com/news/news-20261022-anthropic-fold-subagents-into-main-agent-loop-guide

### A4. Token economics of multi-agent systems

- **[PRIMARY]** Anthropic: "agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats." On the BrowseComp evaluation, "three factors explained 95% of the performance variance... token usage by itself explains 80% of the variance, with the number of tool calls and the model choice as the two other explanatory factors." Multi-agent is economically viable only "where the value of the task is high enough to pay for the increased performance," and is a poor fit where agents must share the same context or have many inter-agent dependencies.
  https://www.anthropic.com/engineering/multi-agent-research-system

### A5. Pricing & cost metering — **ALL FIGURES REQUIRE LIVE VERIFICATION BEFORE USE**

> Pricing, model names, cache rates, and discount tiers change frequently. Nothing in this section should be hard-coded; implement cost computation against a configurable price table and reconcile against provider billing APIs.

- **[PRIMARY]** Anthropic Admin API metering endpoints: `GET /v1/organizations/usage_report/messages` (token usage split into uncached input, cache reads, cache writes, and output; bucketed by minute/hour/day; groupable by API key, workspace, model, service tier) and `GET /v1/organizations/cost_report` (USD cost, daily buckets). These require an Admin API key (`sk-ant-admin...`), distinct from a standard API key. Finest attribution grain is the API key/workspace — per-end-user attribution must be implemented in your own stack via request tagging.
  https://useweckr.com/how-to/anthropic-admin-api-cost-report (secondary walkthrough of primary endpoints)
  https://docs.datadoghq.com/integrations/anthropic-usage-and-costs/
- **[PRIMARY]** OpenAI prompt caching guide: caching is automatic for eligible requests sharing a prompt prefix (minimum prefix ~1,024 tokens); cached input is billed at a discounted cached-input rate; cache hits are visible in `usage.prompt_tokens_details.cached_tokens`; cache write/read pricing is model-specific — consult the live API pricing page.
  https://developers.openai.com/api/docs/guides/prompt-caching
- **[SECONDARY — VERIFY]** Reported pricing structures (verify all against live pages before use): OpenAI Batch/Flex ≈50% below standard rates; cached input ≈10% of input price on current models; some newer models bill cache writes at a premium (reported 1.25× for 30-min TTL, 2.5× for 12-hr TTL); prompts above ~272K input tokens reportedly re-price the entire request (2× input, 1.5× output); reasoning tokens are billed as output tokens. Anthropic: 5-minute cache write ≈1.25× base input, 1-hour write ≈2×, cache read ≈0.1× (with lower rates reported on some 2026 models); Anthropic Batch API = 50% off input and output.
  https://blog.laozhang.ai/en/posts/openai-vs-claude-cache-pricing
  https://justinmckelvey.com/blog/openai-api-pricing

### A6. Timeouts, aborts, retries, idempotency

- **[PRIMARY]** OpenAI rate-limit guide: on 429, honor `Retry-After` when present (treat as a minimum wait, add jitter); otherwise exponential backoff with jitter; "Limit both the number of attempts and the total time spent retrying"; unsuccessful requests still count against per-minute limits; do not retry quota/billing errors; if you manage retries in your application, disable SDK retries or account for them "so nested retry loops don't multiply requests"; a per-attempt timeout is not a whole-operation deadline — handle cancellation separately.
  https://developers.openai.com/api/docs/guides/rate-limits
  https://developers.openai.com/api/docs/guides/error-codes
- **[SECONDARY — VERIFY]** SDK default behavior (from SDK source-analysis write-ups): official OpenAI SDKs retry 408/409/429/5xx twice by default with exponential backoff + jitter; non-GET retries automatically include an idempotency key; server-requested delays above a cap fall back to client backoff. Anthropic and OpenAI Python SDKs both retry connection errors/408/409/429/5xx twice by default. Practical consequence: pick one layer to own retries (set `max_retries=0` if you implement your own) to avoid multiplicative retry storms.
  https://leeroopedia.com/index.php/Heuristic:Openai_Openai_python_Retry_Backoff_Strategy
  https://www.learnwithparam.com/blog/retry-patterns-llm-api-errors-production
- **[SECONDARY — VERIFY]** Idempotency-key testing pattern: an abandoned-mid-flight request followed by a replay with the same `Idempotency-Key` must produce exactly one committed effect — the standard way to make retries safe for side-effecting operations.
  https://automationtester.in/blog/automation-tutorials/test-api-idempotency-retries-timeouts

### A7. Loop / no-progress detection

- **[PRIMARY]** "When Agents Do Not Stop: Uncovering Infinite Agentic Loops in LLM Agents" (arXiv): defines Infinite Agentic Loops (IALs) as feedback paths (explicit loops, recursion, workflow cycles, retry/repair logic, tool reentry, multi-agent delegation) without effective termination conditions. Notes that framework limits (LangChain `max_iterations`, LangGraph recursion limits, OpenAI Agents SDK max turns, CrewAI `max_iter`) do not eliminate IALs in practice — they are omitted, misconfigured, set with ineffective bounds, or placed outside the actual feedback path; loop exit controlled by model output is "not a deterministic bound."
  https://arxiv.org/html/2607.01641v1
- **[SECONDARY — VERIFY]** Real-world failure evidence and patterns:
  - A runner dispatched 25 consecutive identical malformed tool calls before `max_iterations` fired — a 4-minute, multi-dollar "dead zone" indistinguishable from a hang. (GitHub issue) https://github.com/moltis-org/moltis/issues/658
  - Recommended result-aware detection: track normalized (tool, args, result-hash) triples; warn the model after ~3 identical triples; stop the turn after ~5; exempt legitimate polling where the same call returns changing results. (GitHub issue) https://github.com/HKUDS/nanobot/issues/2298
  - Hugging Face `ml-intern` implements a "doom loop detector": canonicalize tool-call JSON (sorted keys) before hashing; scan recent messages for ≥3 identical consecutive calls and for repeated sequences of length 2–5 (A→B→A→B); on detection inject a `[SYSTEM: REPETITION GUARD]` message; factor result hash into normalization so polling doesn't false-trip. https://www.codeline.co/thoughts/repo-review/2026/ml-intern-huggingfaces-autonomous-ml-engineer
  - Framework default iteration caps (e.g., Agents SDK max_turns default 10, LangGraph recursion_limit default 25, LangChain max_iterations default 15) are generic starting points, not production-calibrated values; set caps from measured p95 iteration counts plus buffer. https://www.openlegion.ai/en/learn/agentic-loop
- **[UNVERIFIED]** A reported "$47,000 / 11-day" multi-agent loop incident and a claim that "23% of agent failures are infinite tool-call loops" circulate in practitioner blogs; treat as anecdotal motivation only. https://clyro.dev/blog/the-prevention-stack-ai-agent-prevention-beyond-observability/

### A8. Independent verification

- **[PRIMARY]** MAST — "Why Do Multi-Agent LLM Systems Fail?" (arXiv:2503.13657): empirically grounded taxonomy of 14 failure modes in 3 categories from 200+ (later 1,642) annotated traces, Cohen's κ = 0.88:
  - FC1 Specification/system-design failures (~42%): disobeying task requirements (FM-1.1, ~11-12%), step repetition (FM-1.3, ~16-17%), context loss (FM-1.4), failure to recognize completion (FM-1.5, ~10-12%).
  - FC2 Inter-agent misalignment (~37%): conversation resets, proceeding on wrong assumptions instead of seeking clarification, task derailment, withholding crucial information (FM-2.4), ignoring other agents' input, reasoning-action mismatch (FM-2.6, ~13%).
  - FC3 Task verification & termination (~21%): premature termination (FM-3.1, ~6%), no/incomplete verification (FM-3.2, ~8%), incorrect verification (FM-3.3, ~9%).
  - Key insights: (1) well-designed MAS can improve on the same base model — failures are often structural, not model-limited; (2) FC2 failures need deeper coordination, not just better context protocols; (3) **"Multi-Level Verification is needed... sole reliance on final-stage, low-level checks is inadequate."** Systems with explicit verifiers (MetaGPT, ChatDev) show fewer failures but verifiers are not a silver bullet (example: code passes compilation checks but violates actual game rules). Tactical prompt-level interventions yielded only ~+9-14% improvements — structural redesigns are needed.
  https://arxiv.org/html/2503.13657v3
- **[PRIMARY]** Reflexion (arXiv:2303.11366, NeurIPS 2023): Actor + Evaluator + Self-Reflection roles; converts binary/scalar/environment feedback into verbal reflections stored in episodic memory for subsequent trials; reported 91% pass@1 on HumanEval (vs 80% for GPT-4 baseline) and +22% absolute over ReAct on ALFWorld. Documented caveat: gains depend on evaluator quality; weak self-written unit tests produce false-positive passes. https://arxiv.org/abs/2303.11366
- **[PRIMARY]** ReAct (arXiv:2210.03629): interleaved Thought/Action/Observation; outperforms CoT-only and act-only baselines on knowledge-intensive and decision-making tasks; documented weakness — non-informative tool results can derail reasoning and be hard to recover from; hybrid ReAct + CoT/self-consistency performs best. https://arxiv.org/pdf/2210.03629 and https://www.promptingguide.ai/techniques/react
- **[PRIMARY]** OpenAI Agents SDK guardrails guide: input guardrails (validate before expensive work), output guardrails (validate/redact final output), tool guardrails (check tool arguments/results), and human-in-the-loop approvals that pause a run before side effects. https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- **[SECONDARY — VERIFY]** Verifier-pattern write-up: independence requires the verifier to have *no shared context* with the generator (shared context makes the reviewer inherit the generator's assumptions); give verifiers specific operational criteria and structured verdict outputs; cap verification retry loops and define escalation; using different model families for generation vs verification adds independence. https://www.mindstudio.ai/blog/verifier-pattern-multi-agent-systems-independent-review

### A9. Prompt-injection defense

- **[PRIMARY]** AgentDojo (arXiv:2406.13352, NeurIPS Datasets & Benchmarks 2024): dynamic benchmark with four task suites (banking, slack, travel, workspace) evaluating both task utility and attack success rate (ASR) under indirect prompt injection delivered through tool results; standard metrics: benign utility, utility under attack, ASR. Code/results: https://github.com/ethz-spylab/agentdojo and https://agentdojo.spylab.ai/results/. Paper: https://ar5iv.labs.arxiv.org/html/2406.13352
- **[PRIMARY]** CaMeL — "Defeating Prompt Injections by Design" (arXiv:2503.18813; Google, Google DeepMind, ETH Zurich): a privileged LLM converts the trusted user query into a program in a restricted Python subset (fixing control and data flow *before* untrusted data is touched); a quarantined LLM parses untrusted data with no tools; a custom interpreter attaches capability metadata to every value, tracks provenance, and enforces security policies at each tool call. Results: v1 solved 67% of AgentDojo tasks with provable security; v2 (newer models) 77% vs 84% undefended. Stated non-goals/limitations: text-to-text manipulation not causing exfiltration, injection-induced phishing, and exception-based side channels (recommend explicit result-type error handling instead of exceptions). Code: https://github.com/google-research/camel-prompt-injection. Paper: https://arxiv.org/pdf/2503.18813v1
- **[SECONDARY — VERIFY]** Simon Willison's framing (he coined "prompt injection"): model-level probabilistic defenses are insufficient — "in application security 99% is a failing grade"; CaMeL's significance is that it doesn't use more AI to defend AI. Also the "lethal trifecta": an agent with (a) access to private data, (b) exposure to untrusted content, and (c) ability to act externally is exploitable; removing any one leg breaks the standard exfiltration path.
  https://simonwillison.net/2025/Apr/11/camel/
  https://www.davidlambauer.de/prompt-injection-attacks-the-new-ai-security-threat-and-how-to-prevent-it/
- **[SECONDARY — VERIFY]** Anthropic's deployed mitigations for computer-use/browser agents (adversarial RL + classifiers) reportedly reduced prompt-injection attack success to ~1% against adaptive attackers in one documented evaluation — meaningful but non-zero; layer with architectural controls.
  https://labs.cloudsecurityalliance.org/research/csa-research-note-agentic-blabbering-ai-browser-phishing-202/
- **[SECONDARY — VERIFY]** Cross-agent trust exploitation: a 2025 evaluation (arXiv:2507.06850, "The Dark Side of LLMs") reportedly found 82.4% of 17 tested models executed malicious commands when requested by *peer agents* even where they resisted the same instruction delivered directly. Cited in: https://www.overt.is/OVERT_1.1_Annexes.pdf
- **[SECONDARY — VERIFY]** Real CI/CD injection incidents (2025-2026): PR titles/issue bodies/comments injected into AI coding agents in GitHub Actions led to credential exfiltration; one Claude Code GitHub Action issue was rated CVSS 9.4. Vendor mitigations that only add "guardrail prompts" do not change the underlying threat model (untrusted text and trusted instructions share one context). Recommended pattern: sanitize GitHub event inputs, minimal token scopes, OIDC short-TTL tokens, human review before agent-generated external actions.
  https://gethasp.com/guides/comment-and-control-prompt-injection/
  https://cc.bruniaux.com/security/threats/

### A10. Anthropic multi-agent system — additional primary findings (directly fetched)

From https://www.anthropic.com/engineering/multi-agent-research-system:
- Architecture: orchestrator-worker; LeadResearcher plans, saves the plan to Memory (to survive context truncation past 200K tokens), spawns parallel subagents with clean context windows, synthesizes, decides whether more research is needed, then hands off to a CitationAgent that attributes claims to sources.
- Result: Opus 4 lead + Sonnet 4 subagents outperformed single-agent Opus 4 by 90.2% on Anthropic's internal research eval.
- Prompting principles: (1) think like your agents (simulate with exact prompts/tools to observe failure modes); (2) teach the orchestrator to delegate (objective/output format/tools/boundaries per subtask); (3) scale effort to query complexity with explicit rules; (4) tool design and selection are critical — each tool needs a distinct purpose and clear description; (5) let agents improve themselves (a tool-testing agent rewriting flawed tool descriptions cut task completion time 40%); (6) start wide, then narrow down (search heuristics); (7) guide the thinking process (extended thinking as a controllable scratchpad); (8) parallel tool calling (cut research time up to 90%).
- Evaluation: start immediately with small samples (~20 queries); a single LLM-as-judge call with a rubric (factual accuracy, citation accuracy, completeness, source quality, tool efficiency) scoring 0.0-1.0 plus pass/fail was most consistent with human judgment; human evaluation still catches what automation misses (e.g., SEO-content-farm source bias).
- Production: agents are stateful and errors compound — build resumable execution with checkpoints rather than restarts; combine model adaptability with deterministic safeguards (retry logic, checkpoints); full production tracing to debug non-determinism; rainbow deployments (gradual traffic shift, old and new versions running simultaneously) so updates don't break in-flight agents.

---

## PART B — Original implementable rules (recommendations synthesized from Part A; not sourced verbatim)

Rule IDs R1-R19 for traceability.

### Contracts & decomposition
- **R1.** Every subagent dispatch is a structured object: `{objective, output_schema, allowed_tools, source_guidance, boundaries/out_of_scope, budget}` — extending Anthropic's four observed fields with schema and budget. The harness rejects dispatches missing required fields. (Basis: A1.)
- **R2.** Enforce output contracts via schema-constrained decoding (e.g., OpenAI `output_type`, Anthropic tool-use JSON), not prompt pleading. Validate in code. Treat "schema-valid but semantically wrong" as the remaining risk class and route it to verification (R12). (Basis: A1.)
- **R3.** Embed effort-scaling rules in the director prompt (fact-finding: 1 agent / 3-10 tool calls; comparison: 2-4 agents; deep research: 10+ with disjoint scopes) AND hard-cap fan-out in harness code regardless of what the director requests. (Basis: A1, A10.)

### Budgets & metering
- **R4.** Four budget dimensions per run AND per subagent: max_iterations, max_tokens (in+out), max_wall_clock, max_dollars. Compute dollars from metered usage × a *configurable, regularly refreshed* price table (see A5 — all pricing requires live verification). On breach: stop gracefully, return partial results plus a structured `termination_reason`. (Basis: A4, A7.)
- **R5.** Meter per-agent, per-call: model, uncached input, cache reads, cache writes, output, reasoning tokens. Reconcile weekly against provider cost APIs (Anthropic `cost_report`; OpenAI usage endpoints/dashboard). Attribute spend by issuing per-worker API keys or per-request metadata tags, since provider-side attribution stops at key/workspace granularity. (Basis: A5.)
- **R6.** Keep shared prefixes (system prompt, tool schemas) byte-identical across subagents to maximize cache hits; route lookup/formatting subagents to cheaper model tiers; use batch/flex-class endpoints for non-urgent verification passes. (Basis: A5 — rates to be verified live.)

### Timeouts, retries, idempotency
- **R7.** Timeouts at three levels: per-LLM-call, per-tool-call, per-run deadline. A cancelled attempt cancels its pending retries. A per-attempt timeout is not a whole-operation deadline. (Basis: A6.)
- **R8.** Exactly one retry layer: either configure the SDK's retries or implement your own with SDK retries disabled — never both. Retry only transient classes (429, 5xx, timeouts, connection errors) with `Retry-After` as a floor, exponential backoff + jitter, and caps on both attempts and total elapsed time. Never retry auth/quota/billing errors. (Basis: A6.)
- **R9.** All side-effecting tool calls carry an idempotency key derived from (run_id, subtask_id, action_hash). Irreversible actions (send, delete, pay, publish) additionally require a human or policy approval gate. Test that an abandoned-then-replayed request commits exactly once. (Basis: A6, A8 guardrails.)

### Loop / no-progress detection
- **R10.** Result-aware loop detection in the harness (not delegated to the model): hash (tool_name, canonicalized_args, result_hash); inject a warning to the model after 3 identical triples; hard-stop the turn after 5. Exempt polling where result_hash changes. Also detect repeating sequences of length 2-5 (A→B→A→B). `max_iterations` is the backstop, never the primary defense, and must be placed on the actual feedback path (including retry/repair loops and delegation cycles). (Basis: A7.)
- **R11.** Track a progress signal per run (new artifacts, state diffs, new unique sources, verified checklist items). N consecutive steps with zero state change → escalate to the director or abort with diagnostics. (Basis: A7.)

### Verification
- **R12.** Multi-level verification (per MAST Insight 3): (a) cheap deterministic checks at the worker level (compile, tests, schema, ground-truth lookups); (b) an independent verifier agent with *no shared context* with the generator — different model family where feasible — given explicit operational criteria and returning a structured verdict; (c) a director-level acceptance check against the original contract before anything is reported done. "Premature termination" is defined as the director accepting output that fails (c). (Basis: A8.)
- **R13.** Reflexion-style retry loops: feed evaluator failure text (not raw trajectories) into the next attempt; cap attempts (e.g., 3); on final failure, surface the failure explicitly — never silently accept. Guard against false-positive passes from weak self-generated tests by preferring deterministic evaluators where they exist. (Basis: A8.)

### Prompt-injection defense
- **R14.** Audit every agent against the lethal trifecta (private data + untrusted content + external action); eliminate at least one leg per agent wherever possible. Use read-only summarizer subagents (no tools) for untrusted content. (Basis: A9.)
- **R15.** Do not rely on prompt-level "ignore injected instructions" as a control. Enforce separation architecturally, CaMeL-style: the director generates a plan whose control flow is fixed before untrusted data is read; policy checks at each tool call act on data provenance (taint tags on values derived from untrusted sources); sensitive actions require trusted provenance or human approval. (Basis: A9.)
- **R16.** Treat peer-agent and subagent messages as untrusted data, not instructions (cross-agent command-execution finding, A9). The director re-derives all decisions from its own contract; subagent output never directly triggers privileged actions. (Basis: A9.)
- **R17.** Least privilege per subagent: scoped tool lists, sandboxed execution, allowlisted egress domains, secrets kept out of the agent's context and environment, short-TTL credentials. For CI/CD agents: sanitize all event-derived text (PR titles, issue bodies, comments) before it enters any prompt. (Basis: A3, A9.)

### Progressive disclosure & context
- **R18.** The director's standing context carries only: role, contract schema, escalation rules, and an index of available skills/tools. Playbooks, domain knowledge, and long tool references live in load-on-demand skill files (~100-token metadata until triggered). Subagents start with clean contexts and receive only their brief — not the director's history. (Basis: A2, A10.)
- **R19.** Write a checkpoint/ledger (plan, completed subtasks, key findings, budget consumed) to durable storage at each major step so aborts and errors resume from checkpoints, not from scratch. Roll out prompt/config changes via gradual (rainbow) deployment so in-flight agents are not broken mid-run. (Basis: A10.)

---

## PART C — Stress / failure-test matrix (original design, mapped to sourced failure modes)

| # | Test | Injected fault | Expected control | Maps to |
|---|------|----------------|------------------|---------|
| S1 | Identical-call loop | Tool always returns the same error | Warn @3 identical (tool,args,result) triples; stop @5; partial result + `loop_detected` reason | R10; A7 |
| S2 | Alternating cycle | Two tools alternate A→B→A→B with no state change | Sequence detector fires within ≤2 full repetitions | R10; A7 |
| S3 | Legitimate polling | Same call, changing results | NOT flagged (result-hash exemption) — regression guard for S1/S2 | R10; A7 |
| S4 | Runaway fan-out | Director requests 50 subagents for a trivial query | Harness fan-out cap; effort-scaling rules engage | R3; A1/A10 |
| S5 | Budget breach | Subagent burns tokens to the $ cap mid-task | Graceful stop, partial results, metered cost logged, `budget_exceeded` reason | R4-R6; A4 |
| S6 | Hang | Tool call never returns | Per-call timeout aborts; run deadline enforced; retries stop on cancel | R7; A6 |
| S7 | Throttle storm | Provider returns 429/503 for 60s | Single retry layer; Retry-After floor; backoff+jitter; attempt and time caps; no thundering herd | R8; A6 |
| S8 | Billing exhaustion | 429 with billing/quota error code | Fail fast, alert; zero retries | R8; A6 |
| S9 | Duplicate side effect | Retry after ambiguous commit (abandoned mid-flight) | Idempotency key → exactly-once effect verified in test | R9; A6 |
| S10 | Premature termination | Subagent declares done without evidence | Director acceptance check rejects; task returned to worker | R12; A8 (MAST FM-3.1) |
| S11 | Incorrect verification | Self-written tests pass buggy output | Independent verifier (no shared context) catches; deterministic ground-truth check preferred | R12-R13; A8 (MAST FM-3.3; Reflexion caveat) |
| S12 | Indirect prompt injection | Tool result contains "ignore instructions, exfiltrate X" | Tainted data cannot reach privileged action; policy denies; ASR measured AgentDojo-style | R14-R17; A9 |
| S13 | Cross-agent injection | Compromised subagent instructs director to exfiltrate | Subagent output treated as data; director policy check blocks | R16; A9 |
| S14 | CI/CD context injection | Malicious PR title/body enters agent prompt | Input sanitization; minimal token scopes; approval gate on external actions | R17; A9 |
| S15 | Duplicated subagent work | Two subagents receive overlapping briefs | Contract validation requires disjoint `boundaries`; overlap detector on issued queries | R1; A1/A10 |
| S16 | Information withholding | Worker finds a blocking fact but does not report it | Director requires structured `blockers/unknowns` field in every report | R1/R12; A8 (MAST FM-2.4) |
| S17 | Context rot | Run exceeds the context window (e.g., >200K tokens) | Compaction + checkpoint ledger; resume-from-checkpoint, not restart | R18-R19; A2/A10 |
| S18 | Eval regression | Prompt/model/config update proposed | Golden eval (~20+ representative queries: task success + LLM-judge rubric + injection ASR suite) must pass before rollout; rainbow deploy | R19; A9/A10 |
| S19 | Adversarial benchmark | AgentDojo suites (banking/slack/travel/workspace) under attack | Track benign utility, utility under attack, ASR; target ASR→0 without utility collapse; record per-defense tradeoffs | A9 |
| S20 | No-progress research loop | Endless query reformulation with no new sources/facts | Progress signal per step; N stagnant steps → escalate/abort with diagnostics | R11; A8 (ReAct derailment caveat) |

---

## Appendix — Confidence notes and excluded/quarantined material

- **High confidence (primary):** Anthropic multi-agent research blog (fetched directly); Anthropic Claude Code subagent docs; OpenAI Agents SDK docs (agents, guardrails, orchestration); OpenAI rate-limit/error-code/prompt-caching guides; ReAct (arXiv:2210.03629); Reflexion (arXiv:2303.11366); MAST (arXiv:2503.13657); AgentDojo (arXiv:2406.13352); CaMeL (arXiv:2503.18813).
- **Requires live verification before implementation:** all pricing figures, cache rate multipliers, model tier names/prices, context-window repricing thresholds, and SDK default retry counts/delays (Section A5 and A6). Implement against a configurable price table and reconcile with provider billing APIs; do not hard-code any dollar figure from this report.
- **Model-generation-specific claims** (e.g., "80% system prompt removal for Claude 5", "fold subagents into skills" guidance) are time- and model-specific; re-confirm against current vendor guidance before applying to a given model generation.
- **Quarantined as unverifiable/anecdotal (not used as basis for any rule):** the "$47,000 / 11-day agent loop" incident report; the "23% of agent failures are infinite loops" statistic; various 2026 third-party model price tables (partially conflicting across sources — e.g., differing model names and rates — indicating churn); the "111,253 tokens per subagent spawn" re-measurement claim. Sources retained in search notes but deliberately excluded from the evidentiary sections above.
- No files other than this one were created or modified.
