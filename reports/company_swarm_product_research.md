# Company-of-Agents Research: Role-Based Multi-Agent Systems That Build Software/Products

**As-of date:** 2026-11-20 (point-in-time)
**Scope:** GitHub systems that build software/products/companies through teams of role-based agents; orchestration mechanics; failure evidence; skill-file standards; routing theory; reusable patterns vs. hazards; product requirements for an interactive director graph driven by skill files.
**Method:** 12 web-search rounds (~24 distinct queries) + direct GitHub REST API verification of 22 repositories on 2026-11-20.

**Confidence labels used inline:**
- **[V]** Verified directly via GitHub API on 2026-11-20 (stars, license SPDX, archived flag, last push) — point-in-time observations.
- **[P]** Primary source (official repo/README/docs, arXiv paper, vendor announcement).
- **[S]** Secondary/medium-confidence claim from 2026 third-party sources; treat as directional.

---

## 1. Verified Repository / License / Lifecycle Table

All rows marked [V] were verified via `api.github.com/repos/...` on 2026-11-20. Star counts and last-push dates are point-in-time.

| Project | Repo | License | Stars | Lifecycle as of 2026-11-20 |
|---|---|---|---|---|
| MetaGPT | [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) (old `geekan/MetaGPT` 301-redirects) [P] | MIT [V] | 71,361 [V] | Not archived but **stalled**: last push 2026-01-21 (~10 months) [V]. Commercial successor: MGX ([mgx.dev](https://mgx.dev)), renamed **Atoms** on 2026-01-13 [S] |
| ChatDev | [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev) | Apache-2.0 code [V]; **datasets CC-BY-NC-4.0, non-commercial, research-only** [P] | 34,814 [V] | Active (last push 2026-11-06) [V]. **ChatDev 2.0 "DevAll" released 2026-01-07**; classic v1.x on `chatdev1.0` branch [P] |
| AutoGen | [microsoft/autogen](https://github.com/microsoft/autogen) | Code MIT; docs CC-BY-4.0 (GitHub detects CC-BY-4.0) [V/P] | 61,946 [V] | **Maintenance mode since 2025-10-02** — bug/security fixes only, no new features; last release autogen-agentchat 0.7.5 (2025-09-30) [P/S]. Successor: Microsoft Agent Framework (MAF), 1.0 GA 2026-04-02/03 [P/S] |
| AG2 (AutoGen fork) | [ag2ai/ag2](https://github.com/ag2ai/ag2) | Apache-2.0 [V] | 5,075 [V] | Active (last push 2026-11-19) [V]. v1.0 (2026-07-27) is a rearchitecture (typed Network channels); classic ConversableAgent/GroupChat API preserved in separate `ag2-classic` [S] |
| CrewAI | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | MIT [V] | 61,109 [V] | Very active (last push 2026-11-20 [V]; weekly 1.15.x releases; ~5.7M PyPI downloads/mo [S]) |
| Agency Swarm | [VRSEN/agency-swarm](https://github.com/VRSEN/agency-swarm) | MIT [V] | 4,640 [V] | Active (last push 2026-11-16) [V]; rebuilt on OpenAI Agents SDK [P] |
| LangGraph | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | MIT [V] | 45,166 [V] | Very active (last push 2026-11-20) [V]; v1.x GA [S] |
| OpenHands | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) — **org moved from All-Hands-AI**; `All-Hands-AI/OpenHands` returns 301 to repo id 771302083 [V] | MIT [V] | 93,860 [V] | Very active (last push 2026-11-20) [V] |
| gpt-engineer | [AntonOsika/gpt-engineer](https://github.com/AntonOsika/gpt-engineer) | MIT [V] | 54,946 [V] | **ARCHIVED** [V]. Last code change merged 2024-08-08; last PyPI release 0.3.1 (2024-06); repo description: "Precursor to: https://lovable.dev" [V/P]. README redirects users to Aider and gptengineer.app → rebranded **Lovable** (Dec 2024) [P] ([lovable.dev/gpt-engineer](https://lovable.dev/gpt-engineer)) |
| Aider | [Aider-AI/aider](https://github.com/Aider-AI/aider) | Apache-2.0 [V] | 50,189 [V] | Slowing: last push 2026-05-22 [V]; last tagged release v0.86.0 (2025-08); polyglot leaderboard last refreshed 2025-11 [S] |
| Dify | [langgenius/dify](https://github.com/langgenius/dify) | **"Dify Open Source License" = Apache-2.0 + additional terms** (no operating it as a multi-tenant SaaS without written authorization; logo/copyright retention when using the frontend). GitHub: NOASSERTION [V/P] | 161,531 [V] | Very active (last push 2026-11-20 [V]; v1.19.0, Nov 2026 [S]) |
| Flowise | [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) | Apache-2.0 core + commercial `enterprise/` directory (SSO/RBAC). GitHub: NOASSERTION [V/P] | 55,576 [V] | **End of life**: Workday acquired FlowiseAI (announced 2025-08-14); code freeze 2026-07-29; repo **archived 2026-08-13** [V]; official EOL 2026-08-31; npm/Docker images deprecated [S]. Do not start new work on it |
| Langflow | [langflow-ai/langflow](https://github.com/langflow-ai/langflow) | MIT [V] | 156,784 [V] | Active (last push 2026-11-20 [V]; v1.13.1 Nov 2026 [S]). Ownership: Logspace → DataStax (2024-04) → **IBM** (acquisition closed 2025-05-28) [P/S]. Hosted DataStax Langflow cloud shut down 2026-04-09 — self-host only [S] |
| SuperAGI | [TransformerOptimus/SuperAGI](https://github.com/TransformerOptimus/SuperAGI) | MIT [V] | 17,749 [V] | **Effectively abandoned**: last tagged release v0.0.14 (2024-01-16), last push 2025-01-22 [V], 260+ open issues [S]. Company raised $10M Series A (2024-03) then pivoted to an AI sales/GTM SaaS; SuperAGI Cloud defunct [S] |
| AgentScope | [agentscope-ai/agentscope](https://github.com/agentscope-ai/agentscope) | Apache-2.0 [V] | 36,317 [V] | Very active (last push 2026-11-20) [V]. Alibaba Tongyi Lab. v1.0 (2025-08) ReAct rewrite; v2.0 (2026) is a breaking rewrite [P/S] |
| CAMEL | [camel-ai/camel](https://github.com/camel-ai/camel) | Apache-2.0 [V] | 18,048 [V] | Active (last push 2026-11-16) [V] |
| LangChain DeepAgents (newer) | [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | MIT [V] | 31,452 [V] | Active (created 2025-07; "batteries-included agent harness") [V] |
| Sim (newer) | [simstudioai/sim](https://github.com/simstudioai/sim) | Apache-2.0 [V] | 30,163 [V] | Active; visual collaborative workspace for agent workflows [V] |
| OpenAI Agents SDK (newer) | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | MIT [V] | 30,774 [V] | Active [V]. Note: OpenAI removed the Assistants API on 2026-08-26 [S] |
| Google ADK (newer) | [google/adk-python](https://github.com/google/adk-python) | Apache-2.0 [V] | 22,276 [V] | Active; code-first agent toolkit with built-in evaluation [V] |
| Microsoft Agent Framework (newer) | successor to AutoGen + Semantic Kernel; see [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) (MIT, 28,791 stars, active [V]) | MIT [V] | ~14,483 [S] | Active; 1.0 GA 2026-04, v1.x through late 2026; typed-graph Workflows (Executors + Edges), Handoff orchestration, native MCP + A2A, checkpointing/HITL [S] |
| Voyager (reference, skill library) | [MineDojo/Voyager](https://github.com/MineDojo/Voyager) | MIT [V] | 7,335 [V] | Research artifact; last push 2024-04-03 [V] |

**Lifecycle lesson [P/S]:** of the 2023 "agent wave," AutoGen is frozen, gpt-engineer archived, Flowise EOL, SuperAGI abandoned, MetaGPT stalled, Aider slowing; BabyAGI quiet (last push 2026-01) [S]; Chainlit's original team stepped back 2025-05 (community maintained) [S]. Corporate acquisition did not guarantee survival (Flowise→Workday) while it did for Langflow (DataStax→IBM). Any product must isolate framework dependencies behind an internal abstraction layer.

---

## 2. Per-System Architectural Findings

### 2.1 MetaGPT — SOP-as-code software company
Repo: https://github.com/FoundationAgents/MetaGPT · Paper: arXiv [2308.00352](https://arxiv.org/abs/2308.00352) (ICLR 2024 oral) [P]

- **Role assignment / hiring:** `Team.hire([ProductManager(), Architect(), ProjectManager(), Engineer()])`; `team.invest(investment=$)`; `team.run_project(idea)`; `team.run(n_round=5)` [P]. Roles are Python classes composed of atomic **Actions** (base `Action._aask()` → LLM call; `ActionNode` for Pydantic-structured output) [P].
- **SOPs:** philosophy `Code = SOP(Team)` [P]. Fixed software pipeline: `WritePRD` → `WriteDesign` → `WriteTasks` → `WriteCode` → `WriteCodeReview` → `WriteTest`, each emitting **structured artifacts** (PRD JSON + competitive analysis; design JSON + mermaid class/sequence diagrams; task-list JSON) rather than free-form chat [P]. Two execution modes: fixed SOP order vs. **RoleZero** (dynamic ReAct loop with tool calling); also a TeamLeader role for plan/coordination and a Data Interpreter role with code execution [P].
- **Knowledge transfer:** shared **Environment = message pool with publish/subscribe**; messages carry a `cause_by` tag and roles subscribe to the message types relevant to them (Architect watches WritePRD, etc.); routing constants `MESSAGE_ROUTE_TO_ALL/NONE/SELF` [P] (DeepWiki core-architecture docs). Role-local memory indexed by cause [P].
- **Evaluation/artifacts/cost:** 85.9% HumanEval and ~124.3 tokens/line vs ChatDev's ~248.9 (as cited in the 2026 MDPI orchestration survey) [S]. `CostManager` with `max_budget` [P]. Published telemetry: a 2048-game run consumed 21,934 prompt + 6,316 completion tokens, $1.04, 553 s — **77.6% of tokens were agents reading each other's documents** [P, paper Table 9].
- **Failures:** e.g. [issue #1672](https://github.com/FoundationAgents/MetaGPT/issues/1672) — on an internal consistency error, recovery consists of deleting the newest message from the role's memory [P]. Repo stalled since 2026-01-21 [V]; Python 3.9–<3.12 pin [P].
- **MGX / Atoms (productization):** 7 named agents — Mike (Team Leader), Emma (PM), Bob (Architect), Alex (Engineer), Iris (Deep Researcher), Sarah (SEO), David (Data Analyst); the Team Leader **activates only relevant agents (2–5 per task)**, a genuine dynamic "hiring" behavior [S]. Ships auth/DB/Stripe/deploy; "Race Mode" runs parallel build iterations; GitHub code export [S]. Launched 2025-02-19; ~$1M ARR in first month; ProductHunt #1 of day; rebranded to Atoms 2026-01-13 [S]. User complaints: context handling, reliability, memory-restoration/data-loss bugs [S].

### 2.2 ChatDev — virtual software company as a chat chain
Repo: https://github.com/OpenBMB/ChatDev · Paper: arXiv [2307.07924](https://arxiv.org/abs/2307.07924) (ACL 2024) [P]

- **Design:** waterfall **Chat Chain**: phases (design → coding → testing → documenting) decomposed into subtasks; each subtask is a multi-turn **instructor–assistant dyad** (CEO↔CTO, Reviewer↔Programmer) driven to consensus, with "communicative dehallucination" (role reversal + thought instruction) and a cumulative memory stream [P].
- **Customization:** user-definable ChatChain / Phase / Role configs; ChatChain Visualizer web demo; Art mode for image generation [P].
- **ChatDev 2.0 "DevAll" (2026-01-07):** pivots from software-company simulator to **zero-code multi-agent orchestration platform**: drag-and-drop Workflow canvas, Launch view with live intermediate artifacts (code, charts, 3D), and human-in-the-loop intervention at critical nodes; v1.x moved to `chatdev1.0` branch [P, README news].
- **Learned orchestration:** `puppeteer` branch implements *Multi-Agent Collaboration via Evolving Orchestration* (NeurIPS 2025): an RL-optimized central orchestrator that dynamically activates and sequences agents [P].
- **Hazards:** datasets are CC-BY-NC-4.0 (research only) [P]. MAST-documented failures include the CPO agent usurping the CEO role (role-spec violation), 7 communication cycles without code updates, and Wordle spec drift (fixed dictionary despite explicit instruction) [P, MAST paper].

### 2.3 AutoGen / AG2 / Microsoft Agent Framework — lifecycle cautionary tale
Repos: https://github.com/microsoft/autogen · https://github.com/ag2ai/ag2 · Paper: arXiv [2308.08155](https://arxiv.org/abs/2308.08155) [P]

- **Patterns:** ConversableAgent; GroupChat with **GroupChatManager** selecting the next speaker via policies `auto / round_robin / random / manual / custom-function` [P/S]; UserProxy executes code; AutoGen Studio no-code GUI; **Magentic-One**: an Orchestrator that plans, tracks progress, re-plans on error, and directs specialist agents (web/files/code) — arXiv [2411.04468](https://arxiv.org/abs/2411.04468) [P].
- **Failures [P/S]:** unbounded conversation loops → 5–10× expected token burn without `max_turns`/budget terminators; 30-message group chats are hard to root-cause; structured outputs unreliable in some configurations.
- **Fork fragmentation [P/S]:** original authors (Chi Wang, Qingyun Wu) left Microsoft (late 2024) and created AG2 (Apache-2.0, owns the `autogen`/`pyautogen` PyPI names); Microsoft rewrote AutoGen v0.4 (Core/AgentChat/Extensions), then froze it (maintenance mode 2025-10-02); successor Microsoft Agent Framework (MAF, GA 2026-04) merges AutoGen + Semantic Kernel with typed-graph Workflows, Handoff orchestration, native MCP+A2A, checkpointing, HITL. Package-name trap: `pip install autogen` now installs AG2-classic; `pip install autogen-agentchat` installs frozen Microsoft 0.7.5; `pip install agent-framework` installs MAF [S].

### 2.4 CrewAI — role/goal/backstory crews + event-driven flows
Repo: https://github.com/crewAIInc/crewAI · Docs: https://docs.crewai.com [P]

- **Role assignment:** declarative `Agent(role, goal, backstory)`; YAML-first config (`config/agents.yaml`, `config/tasks.yaml`) — version-controllable, CI/CD-friendly [P]. Processes: sequential / hierarchical / parallel.
- **Team-leader routing:** hierarchical process = a manager agent with `allow_delegation=True` decomposes and delegates at runtime; specialists keep `allow_delegation=False` [P]. **Known hazard: a hierarchical-delegation defect reported 2026-03 was closed without a fix** [S] — delegation behavior must be validated before relying on it.
- **Task graphs:** **Flows** (GA 2026): `@start` / `@listen` / `@router` decorators, typed state handoff between crews, conditional routing, event triggers [P/S]. Checkpointing with replay-from-step and fork (v1.14.0, SqliteProvider, 2026-04-07) [S]. Planning agent with auto-recovery for long tasks [P].
- **Memory/knowledge:** short-term / long-term / entity / contextual memory (2024) consolidated into a unified Memory class with pluggable backends (early 2026) [S]. Native MCP since v1.4.0 (2025-11); A2A client+server [S].
- **UI/enterprise:** CrewAI Studio no-code builder with YAML export; AMP Suite (ex-"AOP", 2025-10) control plane: SSO/RBAC/audit logs/FedRAMP High; pricing reduced to free Basic + custom Enterprise [S].
- **Security:** four CVEs disclosed 2026-03 (CVE-2026-2275/-2285/-2286/-2287, one CVSS 9.8); fixed in v1.14.0 by **removing the Code Interpreter tool and its Docker-sandbox fallback entirely** [S]. Lesson: sandboxed execution must be designed-in, not bolted on.
- **Scale claims [S]:** 450M agents/month executed (2025); Fortune-500 customers; $18M seed+A (Insight Partners, 2024-10).

### 2.5 Agency Swarm — capability-based communication topology
Repo: https://github.com/VRSEN/agency-swarm · Docs: https://agency-swarm.ai [P]

- **Key mechanism:** `Agency(ceo, dev, communication_flows=[(ceo, dev), (ceo, va)], shared_instructions="./manifesto.md")`; entry points are positional args; flows are directional tuples (or `ceo > dev`); a `Handoff` flow type transfers the *user* to another agent [P].
- **Enforcement worth copying:** at init, each agent receives a **scoped `SendMessage` tool containing only its allowed recipients** — disallowed communication paths do not exist in the tool schema (capability-level access control, not prompt discipline) [P].
- **Orchestrator-worker:** control always returns to the orchestrator after delegation; agents-as-tools with structured outputs [P]. Tools are Pydantic `BaseTool` classes; `shared_instructions` markdown, `shared_files_folder` (common vector store), `shared_mcp_servers` propagate to all agents [P].
- Built on the OpenAI Agents SDK (v1.x rewrite) [P]. Positioned for reliability/auditability: "no ambient conversation — every message is intentional and traceable" [S].

### 2.6 LangGraph — graph runtime + supervisor/handoff/swarm patterns
Repo: https://github.com/langchain-ai/langgraph · Supervisor lib docs: https://reference.langchain.com/python/langgraph-supervisor/supervisor [P]

- **Core:** stateful directed graphs (`StateGraph`), checkpointers (in-memory/Postgres), durable execution, human-in-the-loop interrupts, time-travel, subgraphs-as-nodes for hierarchical teams; LangSmith observability [P].
- **Multi-agent libraries:** `langgraph-supervisor` (`create_supervisor`, `create_handoff_tool`, `create_forward_message_tool` so the supervisor forwards worker output without restating it) and `langgraph-swarm` (`create_swarm`, peer handoffs via `Command(goto=..., graph=Command.PARENT)`) [P].
- **Documented engineering guidance [P/S]:** handoffs should carry **validated state + next objective + constraints + audit ID — not full transcripts**; routing state and message state must stay consistent (every handoff tool call needs its ToolMessage pair); agent names must be unique (duplicates silently break supervisor routing); least-privilege tool sets per worker; the supervisor should only route + synthesize; static rule-based routing is fine when routing logic is fixed.
- **Measured trade-off [S]:** in one 2026 comparison, Supervisor topology had higher routing accuracy (94% vs 91%) but ~2× the LLM calls of Swarm.

### 2.7 OpenHands — execution-first agent platform
Repo: https://github.com/OpenHands/OpenHands · Paper: arXiv [2407.16741](https://arxiv.org/abs/2407.16741) [P]

- **Architecture:** **CodeAct** loop — the agent emits executable Python/bash actions; observations return from a **Docker sandbox runtime**; the event stream is an action/observation log [P].
- **Knowledge/skills:** **microagents** — repo/org/user-scoped markdown knowledge files that steer behavior (e.g., "never use GPL dependencies"); memory persisted as code in a Git repo under user control [P/S].
- **Evaluation (first-class):** AgentHub of interchangeable agent implementations; evaluation harness over SWE-bench, WebArena, GAIA, HumanEvalFix, BIRD, ML-Bench etc.; remote runtime for 32× parallel evaluation; **integration tests with LLM mocking** for deterministic agent regression tests; per-run cost tracking [P]. CodeAct 2.1 reached 53% on SWE-bench Verified (2024-11) [P]; the late-2026 SWE-bench leaderboard tops out ~76.8% (mini-SWE-agent + Claude 4.5 Opus) [S]; harness choice alone swings scores 10–15 points [S].
- **UI:** web GUI with mid-task human interruption [P].

### 2.8 GPT Engineer → Aider — the CLI lineage
Repos: https://github.com/AntonOsika/gpt-engineer · https://github.com/Aider-AI/aider · Aider docs/leaderboard: https://aider.chat/docs/leaderboards/ [P]

- **gpt-engineer:** prompt-file → codebase generation, `-i` improve mode, editable "preprompts" (proto skill files) [P]. Archived; its own README recommends Aider (maintained CLI) and gptengineer.app → Lovable (managed product) [P]. Lesson: single-shot generation without a maintenance story dies.
- **Aider:** single-agent, user-directed pair programmer (not multi-agent), but contributes reusable patterns: **tree-sitter repo map** for compact codebase context; multiple **edit formats** (diff / diff-fenced / whole / patch) with edit-format-compliance as a measured metric; **architect/editor mode** — a strong planner model paired with a cheap editor model, the original 2-role model routing (o1-preview+DeepSeek set early SOTA) [P]; **git-native auto-commit per edit** (built-in undo + audit); watch mode (`AI!` comments); lint/test self-heal loop [P].
- **Evaluation honesty model:** Aider Polyglot benchmark = 225 Exercism exercises in 6 languages, 2 attempts, reporting pass rate + edit-format compliance + cost-per-run [P] (methodology: https://epoch.ai/benchmarks/aider-polyglot).

### 2.9 Dify / Flowise / Langflow — visual builders
- **Dify** ([langgenius/dify](https://github.com/langgenius/dify)): one canvas for workflows + RAG knowledge pipeline + agents; 50+ built-in tools; MCP; Community/Cloud/Enterprise tiers [P]. Heaviest self-host footprint (~15 containers) [S]. License restricts multi-tenant resale — **unsuitable as an embedded engine for a commercial product** [P].
- **Langflow** ([langflow-ai/langflow](https://github.com/langflow-ai/langflow)): MIT, Python, custom Python components, MCP client+server, any component exposable as an agent tool (agent-as-tool composition) [P/S]. **Security caveat:** the editor runs arbitrary Python with host access; user access controls are "designed for usability, not security enforcement" — tenants must be isolated at process/disk/network level [S]. Production limits reported: latency spikes, a caching memory leak; Redis job queue added in v1.11 [S]. Competitor gap analysis: no org structure, no role mandates, no budgets, no sign-off holds [S].
- **Flowise** ([FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise)): Node.js/LangChain.js, 3 builder modes (Assistant/Chatflow/Agentflow); archived 2026-08 with official reasoning that developers moved to coding agents and rigid low-code workflows hit their limits [S]. Lesson: static drag-and-drop graphs lose to dynamic agentic orchestration.

### 2.10 SuperAGI — GUI-first autonomous agents, abandoned
Repo: https://github.com/TransformerOptimus/SuperAGI [P]

- **Patterns worth reusing:** toolkit **marketplace**; **Action Console** (HITL permission gate before sensitive steps like sending email or running shell commands); performance telemetry/APM; vector-DB agent memory; agent types = Default / Fixed Task Queue / **Dynamic Task Queue** (agent adds tasks at runtime) [P]. Stack: FastAPI + Celery + Redis + Postgres + Next.js [S].
- **Failure record [S]:** agents stuck in "Thinking" loops; hallucination cascades into real-world actions; token-cost accumulation; unpatched vulnerabilities; documentation decay. Died when the company pivoted to a sales/GTM SaaS — **a framework without a committed maintainer is a liability**.

### 2.11 AgentScope — production engineering focus
Repo: https://github.com/agentscope-ai/agentscope · Papers: arXiv [2402.14034](https://arxiv.org/abs/2402.14034), [2508.16279](https://arxiv.org/abs/2508.16279) (v1.0) [P]

- **v1.0 (2025-08):** ReAct-centric; four foundational modules (message, model, memory, tool); agent functions Reply/Observe/Handle-Interrupt; **MsgHub** (pub/sub message bus for group conversation with dynamic membership) + **Pipelines** (sequential/conditional/iterative); **agents-as-tools**; layered short/long-term memory; **Runtime** (deploy agents as FastAPI services; Docker sandbox with filesystem restricted to `/tmp/agentscope/{agentId}/` and network whitelists); **Studio** (OpenTelemetry tracing, per-step token-cost visibility); **evaluation module** (`GeneralEvaluator` sequential + `RayEvaluator` distributed with resume and result aggregation); MCP + A2A support [P].
- **v2.0 (2026, breaking rewrite):** unified `Agent` + middleware hooks; MsgHub/Pipelines moved out of core; **SKILL.md skill-file support**; Claude-Code-style built-in file tools (Bash/Read/Write/Edit/Glob/Grep); 5-level permission modes; OTel as a hard dependency; Trinity-RFT online training hook [S]. Design bet: strong-ReAct/weak-orchestration — relies on strong base models [S].

### 2.12 CAMEL — role-play society + workforce with dynamic hiring
Repo: https://github.com/camel-ai/camel · Paper: arXiv [2303.17760](https://arxiv.org/abs/2303.17760) [P]

- **Role playing:** AI User ↔ AI Assistant with **inception prompting** (task-specifying system prompts enabling autonomous multi-turn dialogue); "code-as-prompt"; design principles: evolvability, scalability, statefulness; ecosystem: OWL (real-world task automation), OASIS (social simulation) [P].
- **Workforce module** (most relevant "team leader" implementation found): coordinator–planner–worker architecture with three internal agents — `coordinator_agent` (task assignment), `task_agent` (decomposition/composition), and a `new_worker_agent` template for **dynamic worker creation** [P, camel/societies/workforce]. Failure recovery is a strategy enum: **RETRY / REASSIGN / DECOMPOSE / REPLAN / CREATE_WORKER** — i.e., hire a new specialist when existing workers fail [P].

---

## 3. Failures: the MAST Taxonomy (essential reference)

**"Why Do Multi-Agent LLM Systems Fail?"** (Cemri et al., UC Berkeley; arXiv [2503.13657](https://arxiv.org/abs/2503.13657); NeurIPS 2025) [P]. 1,600+ annotated execution traces across 7 popular frameworks (incl. ChatDev, AutoGen/AG2, CrewAI, LangGraph); inter-annotator agreement κ=0.88; validated LLM-as-judge annotator (κ≈0.77 vs humans); open-sourced at [github.com/multi-agent-systems-failure-taxonomy/MAST](https://github.com/multi-agent-systems-failure-taxonomy/MAST).

**14 failure modes in 3 categories** (shares from the NeurIPS camera-ready, 1,642 LLM-annotated traces) [P]:

- **FC1 — Specification & system design (44.2%):** disobey task specification (11.8%); disobey role specification (1.5%); **step repetition (15.7%)**; loss of conversation history (2.8%); **unaware of termination conditions (12.4%)**.
- **FC2 — Inter-agent misalignment (32.3%):** conversation reset (2.2%); fail to ask for clarification (6.8%); task derailment (7.4%); information withholding (0.85%); ignored other agent's input (1.9%); **reasoning-action mismatch (13.2%)**.
- **FC3 — Task verification (23.5%):** premature termination (6.2%); no/incomplete verification (8.2%); incorrect verification (9.1%).

**Key findings [P]:**
- Multi-agent task failure rates of **41–86.7%** across the studied systems; gains over single-agent or best-of-N baselines are often minimal.
- Simple interventions help but do not fix: ChatDev improved 25.0% → 34.4% with better role specs/prompts → 40.6% with a new topology — still not deployable.
- Reliability compounds against you: at 99% per-step success a 50-step pipeline finishes correctly ~61% of the time; at 95%, a 20-step pipeline ~36%.
- "Improvements in base model capabilities will be insufficient to address the full taxonomy… good MAS design requires organizational understanding; even organizations of sophisticated individuals can fail catastrophically if the organization structure is flawed."

**Corroborating evidence [S]:** Augment Code reports 79% of production multi-agent failures originate from specification/coordination issues; GitHub's engineering team blames untyped inter-agent data, ambiguous action semantics, and absent enforcement layers. Complementary runtime "silent failure" research (arXiv 2606.08162) shows failures persist even under correct design-time construction. Pan et al. 2025 identify four runtime archetypes: premature action, over-helpfulness, context pollution, fragile execution. Gartner forecasts >40% of agentic AI projects canceled by end of 2027 [S].

---

## 4. Skill Libraries & Knowledge Transfer

### 4.1 Agent Skills open standard (pivotal for a skill-file-driven product)
- **Format:** a skill is a **folder** containing `SKILL.md` — YAML frontmatter (`name` + `description` required; optional `license`, `compatibility`, `metadata`, `allowed-tools`) + Markdown SOP body — plus optional `scripts/`, `references/`, `assets/` [P] (spec: https://agentskills.io/specification).
- **Progressive disclosure:** L1 = name+description always in context (~30–100 tokens/skill); L2 = full SKILL.md loaded on activation (<5k tokens recommended); L3 = bundled resources/scripts loaded or executed on demand — script source never enters context, only its output [P].
- **Governance timeline:** Anthropic launched Agent Skills 2025-10-16 ("Equipping agents for the real world with Agent Skills"); published as an open standard 2025-12-18 ([agentskills.io](https://agentskills.io), Apache-2.0 spec repo [agentskills/agentskills](https://github.com/agentskills/agentskills) with `skills-ref` validator); **donated to the Linux Foundation's Agentic AI Foundation (AAIF) on 2026-10-22** [P/S]. 70+ adopting platforms: Claude Code, OpenAI Codex, Gemini CLI, Cursor, GitHub Copilot, VS Code, Microsoft Agent Framework (`load_skill`/`read_skill_resource`/`run_skill_script`), AgentScope 2.0, OpenCode, etc. [S].
- **Skills ≠ MCP:** MCP tools are verbs (typed callable functions); skills are playbooks (the judgment layer: when to call which tool, in what order, how to interpret results) [S]. Anthropic's code-execution-with-MCP example cut a 150k-token tool-schema workflow to ~2k tokens (98.67% reduction) via progressive disclosure [P/S].
- **Security hazard [S]:** two early-2026 academic studies found **>25% of publicly available skills contain at least one security vulnerability**; confirmed malicious skills average 4 distinct attack vectors; 50k+ skills collected across just two registries by 2026-01. Any skill registry needs vetting, signing, and sandboxed script execution (see OWASP Top 10 for Agentic Applications 2026, https://genai.owasp.org).

### 4.2 Other knowledge-transfer mechanisms observed
- **Voyager** ([MineDojo/Voyager](https://github.com/MineDojo/Voyager); arXiv [2305.16291](https://arxiv.org/abs/2305.16291)) [P]: canonical **self-growing skill library** — the agent writes skills as executable code, stores them in a vector DB, retrieves by similarity for new tasks. The direct ancestor of "skill files as organizational memory."
- **OpenHands microagents:** markdown knowledge at repo/org/user scope; memory stored as code in Git under user control [P/S].
- **Agency Swarm:** `shared_instructions` markdown + `shared_files_folder` vector store shared across all agents [P].
- **AgentScope:** layered short-term + long-term (vector DB) memory; v2 middleware hooks [P/S].
- **CrewAI:** unified Memory class, pluggable vector backends [S].
- **ChatDev:** cumulative memory stream of instructor/assistant dialogue tuples [P].
- Related standard: **Open Agent Specification (Agent Spec)** — declarative, framework-agnostic typed component graphs for agents/workflows (Oracle, 2025-10) [S].

---

## 5. MoE vs. Agent Routing — keep the layers separate

**Do not conflate model-internal MoE with agent orchestration.** Four distinct layers [P/S]:

1. **Model MoE (inside one network):** a learned gating function activates a few expert FFN sublayers per token; experts trained jointly (Jacobs 1991; Shazeer 2017; Switch). Examples: Qwen3-235B-A22B, GLM-5.2. This is a model-architecture concern, not orchestration.
2. **Mixture-of-Agents (around models):** layered proposer models + an aggregator (Wang et al. 2024, arXiv [2406.04692](https://arxiv.org/abs/2406.04692)). Warning: **Self-MoA ("Rethinking Mixture-of-Agents: Is Mixing Different LLMs Beneficial?", Princeton 2025) — repeatedly sampling the single best model often beats mixing different LLMs**, because weak members drag the mixture down; ensembles cost ~N× per prompt [P].
3. **Model routing (pick one model per query):** RouteLLM (arXiv [2406.18665](https://arxiv.org/abs/2406.18665)), RouterDC, MixLLM, SMOOTHIE (label-free) — learned cost/quality dispatch between models [P].
4. **Agent-level routing/orchestration:** MasRouter (cascaded controller deciding collaboration mode, role assignment, and model selection); GraphRouter (routing as link prediction on a heterogeneous graph); G-Designer (dynamic communication topology per task); MoMA (Mixture of Models *and* Agents — intent recognition + context-aware state machine + dynamic masking, arXiv [2509.07571](https://arxiv.org/abs/2509.07571)); Router-R1 (RL-trained LLM orchestrator); AgentVerse (4-stage expert recruitment); GPTSwarm / DyLAN (learned topology / team selection); AgentDropout (prunes redundant agents/edges); ChatDev Puppeteer (RL orchestrator) [P/S].

**Survey synthesis** (MDPI *LLM-Based Multi-Agent Orchestration*, June 2026, https://www.mdpi.com/1999-5903/18/6/326) [P]:
- Topology taxonomy: **centralized-supervisor / decentralized-peer / hierarchical**, crossed with a static→dynamic→adaptive modifier; hierarchical suits ~3–7 agents per manager, scales linearly in a tree.
- Two complementary framings: **workflow orchestration** (route agents through a task graph; LangGraph/CrewAI/MAF) vs. **organization-level coordination** (constitute the collective itself: which agents exist, recruit, retire, restructure — AgentVerse, GPTSwarm, DyLAN). A director-graph product is the latter.
- Task-allocation strategies: role-based, capability-based (A2A Agent Cards), dynamic (availability/past performance), optimized (DSPy compiler-style, +25–65% over manual assignment).
- Open challenge: memory–coordination interplay on long horizons — which memory slice to surface is entangled with who acts next.

---

## 6. Reusable Patterns vs. Hazards

### 6.1 Reusable patterns (steal these)
1. **Structured artifact handoffs** — typed documents (PRD/Design/Task JSON) between roles beat free-form chat (MetaGPT) [P].
2. **Publish/subscribe message pool** with `cause_by` subscription filters (MetaGPT), or **scoped SendMessage tools** that make disallowed paths impossible (Agency Swarm) [P].
3. **Supervisor routes + synthesizes only; workers get least-privilege tools; handoffs carry validated state + objective + constraints + audit ID — never raw transcripts** (LangGraph guidance) [P/S].
4. **Failure-recovery strategy enum with dynamic worker creation** — RETRY / REASSIGN / DECOMPOSE / REPLAN / CREATE_WORKER (CAMEL Workforce) [P].
5. **Skill files with progressive disclosure + bundled executable scripts** (agentskills.io standard — now Linux-Foundation-governed, vendor-neutral) [P].
6. **HITL permission gates before irreversible actions** (SuperAGI Action Console, LangGraph interrupts, Agency Swarm Handoff) [P].
7. **Evaluation as first-class infrastructure:** benchmark harness + LLM-mocked integration tests + per-run cost tracking (OpenHands); honest metrics = pass rate + format compliance + cost-per-run (Aider) [P].
8. **Git-native artifacts and auto-commits as the audit/undo layer** (Aider); checkpoint / replay / fork (LangGraph, CrewAI 1.14) [P/S].
9. **Architect/editor model splitting** for cost (Aider); per-task model routing (RouteLLM family) [P].
10. **Memory as versioned files/skills in Git under user control** (OpenHands microagents; Voyager skill library) [P].

### 6.2 Hazards (design against these)
1. **MAST reality check:** 41–86.7% task failure rates; step repetition, termination-blindness, and verification gaps dominate; ~79% of production failures are specification/coordination issues [P/S]. Budgets, termination conditions, and independent verifiers are mandatory, not optional.
2. **Unbounded conversation loops** → 5–10× token burn (AutoGen) [S].
3. **Lifecycle risk:** AutoGen frozen, Flowise EOL, gpt-engineer archived, SuperAGI abandoned, MetaGPT stalled, Aider slowing — **abstract the framework layer; never hard-bind to one vendor's orchestration API** [V/S].
4. **License traps:** Dify (no multi-tenant SaaS), ChatDev datasets (CC-BY-NC), Flowise `enterprise/` dir (commercial), n8n (fair-code Sustainable Use License) [P/S].
5. **Skill supply chain:** >25% of public skills vulnerable; vet, sign, and sandbox before execution [S].
6. **Sandbox absence:** CrewAI removed its code-execution tool after CVSS 9.8 CVEs; Langflow executes arbitrary Python in-process with non-security-grade user controls [S].
7. **Config that looks governable but isn't:** CrewAI's March-2026 hierarchical-delegation defect was closed unfixed [S].
8. **Context pollution economics:** agents reading each other's full documents burned ~78% of tokens in MetaGPT's published telemetry [P].

---

## 7. Product Requirements: Interactive Director Graph Driven by Skill Files

Requirements synthesized from the findings above for a system in which an interactive **director** creates projects, hires/routes agents, and controls execution using skill files.

**R1 — Director node (organization-level coordinator).** A persistent director agent owns intent intake, project instantiation, agent hiring/routing, budget enforcement, and termination. Routing is capability-based (match task → skill metadata + agent track record), with a deterministic rule-based fast path for known intents and LLM routing only for ambiguity. (Basis: LangGraph routing guidance; Dataiku routing-engine blueprint; AgentVerse organization-level coordination.)

**R2 — Skill-file-native role definitions.** Agents are instantiated from agentskills.io-compatible packages (progressive disclosure at runtime). Extend the frontmatter with: `role`, `capabilities`, `tools-allowed`, `model-preferences` (architect vs. editor tier), `cost-class`, `input-artifact-types`, `output-artifact-types`, `verification-hook`. The skill registry is Git-backed, versioned, signed, and vetted (supply-chain gate; cf. §4.1 hazard).

**R3 — Explicit communication topology.** Declare `communication_flows` (director→worker, worker→worker, handoff-to-human) compiled into scoped send-message tools so disallowed paths do not exist in the tool schema (Agency Swarm pattern); support pub/sub topics with cause-based subscription for artifact events (MetaGPT pattern).

**R4 — Structured artifacts as the contract.** Every step produces typed artifacts (JSON Schema + files) in an artifact store; handoffs pass artifact references + validated state + objective + constraints + audit ID — never raw transcripts. Machine-checkable acceptance criteria per artifact (mitigates MAST FM-1.1 / FM-3.x).

**R5 — Task graph + durable execution.** Projects compile to a DAG/state graph with checkpointing, replay/fork, per-node budgets and timeouts, idempotent retries, and human-approval nodes. Explicit termination conditions at every level (FM-1.5). Support both fixed SOP pipelines (MetaGPT-style) and dynamic director-orchestrated decomposition (CAMEL/Atoms-style).

**R6 — Dynamic hiring with a recovery taxonomy.** The director can spawn/hire/retire agents at runtime (CAMEL Workforce CREATE_WORKER; Atoms' selective 2–5-agent activation). Failure handling implements RETRY / REASSIGN / DECOMPOSE / REPLAN / CREATE_WORKER / ESCALATE-TO-HUMAN as explicit, audited strategies.

**R7 — Sandboxed execution.** All generated code runs in isolated containers (filesystem jail, network whitelist, no host credentials — AgentScope Runtime / OpenHands Docker model). Code-execution capability is a per-skill, per-agent grant, not global. (Counterexample: CrewAI's removed interpreter; Langflow's in-process Python.)

**R8 — Independent verification layer.** Verifier agents or deterministic checks (tests, linters, schema validators, MAST-labeled LLM-as-judge) gate phase transitions; a verifier can never be the producer of the artifact it checks. Premature termination is itself a checked failure mode (FM-3.1).

**R9 — Observability & evaluation.** OpenTelemetry tracing per step (AgentScope Studio model); per-run cost accounting (MetaGPT CostManager / OpenHands cost tracking); step-level logs enabling reasoning-action-mismatch detection (FM-2.6); regression harness with LLM-mocked integration tests (OpenHands); periodic benchmark evaluations reporting pass rate + cost-per-success (Aider polyglot model); optional MAST-annotator integration for automatic failure classification.

**R10 — Interactive UI.** A live graph view: nodes = agents/projects, edges = active communication; clicking a node exposes its skill file, memory slice, artifacts, and cost; mid-run skill/SOP editing with checkpoint resume; HITL gates as first-class UI elements; replay/time-travel debugging. (Closest analogs: ChatDev 2.0 canvas, CrewAI Studio, LangGraph Platform — none combine org structure + budgets + sign-off holds + skill files; that combination is the differentiator.)

**R11 — Knowledge transfer & learning.** Cross-run memory as versioned files (OpenHands microagents pattern); successful task solutions distilled into new/updated skill files (Voyager pattern) with human review before registry promotion; per-org skill namespaces.

**R12 — Governance & licensing hygiene.** Self-owned orchestration core (avoid Dify-style multi-tenant restrictions in embedded components); framework adapters (LangGraph / CrewAI / AgentScope / MAF) behind an internal API to survive upstream EOL events (cf. §1 lifecycle lesson); RBAC; immutable audit logs; skill provenance records.

---

## 8. Methodology & Confidence Notes

- **[V] rows** were verified with direct GitHub REST API calls (`api.github.com/repos/...`) on 2026-11-20; star counts, license SPDX IDs, archived flags, and last-push dates are point-in-time and will drift.
- **[P] claims** come from official repos/READMEs/docs and arXiv papers linked inline.
- **[S] claims** come from 2026 third-party analyses (promptquorum, alicelabs, rework, vdf.ai, javisreview, netizenschoice, etc.); they are consistent across multiple sources where stated but were not independently re-verified against primary sources in every case. Product metrics (ARR, pricing, review sentiment, benchmark leaderboard positions) should be re-checked before external use.
- The `microsoft/autogen` GitHub license field reports CC-BY-4.0 because that is the docs license; the code is MIT — cite both.
- OpenHands' canonical repo moved from `All-Hands-AI/OpenHands` to the `OpenHands` org (HTTP 301 to repository id 771302083) — verified 2026-11-20.
- No application files were modified in producing this research; this document is the sole artifact.
