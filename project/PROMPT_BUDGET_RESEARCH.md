# Donna: goals, budgets and efficient specialist workflows

Research checkpoint: 2026-11-21. Sources below are original papers, official
provider documentation and the projects' own repositories. This is an engineering
decision record, not a live performance benchmark. No paid inference, managed
agent session or third-party office installation was run for this review.

## Recommended direction

Give Donna one durable goal and one user conversation. Let the application own
the work graph, budget reservations, permissions, deadlines and completion checks.
Donna should select useful specialists and synthesize evidence; organization-chart
positions do not need a model call merely because they exist.

A concise budget instruction can help a model pace work. It cannot enforce the
company's money, elapsed time, total token usage or number of child jobs. Those
limits must be checked by the runtime before dispatch and reconciled afterward.
The following research supports testing adaptive budgets, while showing why
arbitrarily smaller prompts or a perpetual “keep thinking” loop are poor defaults.

## What the papers establish

| Source | Evidence and boundary | Decision for Donna |
| --- | --- | --- |
| [TALE: Token-Budget-Aware LLM Reasoning, ACL Findings 2025](https://aclanthology.org/2025.findings-acl.1274/) ([paper](https://aclanthology.org/2025.findings-acl.1274.pdf)) | Han et al. study estimation-and-prompting and post-training approaches to reasoning budgets. Appropriate task-specific budgets reduce redundant output in their evaluated settings. They also observe non-monotonic behavior: an unrealistically small instruction can produce more tokens or worse compliance. The estimation variant has its own inference overhead; the post-training variant is a different deployment method. | Test a small set of task classes and budget bands. Count the estimator's own tokens if one is used. Prefer inexpensive deterministic routing before adding a separate model call to estimate every task. Do not promise TALE's result for current closed API models or whole-company workflows. |
| [BudgetThinker, EMNLP Findings 2026](https://aclanthology.org/2026.findings-emnlp.1465/) ([paper](https://aclanthology.org/2026.findings-emnlp.1465.pdf), [author code](https://github.com/MobileLLM/BudgetThinker)) | Wen et al. train models to interpret periodic remaining-budget control tokens using supervised fine-tuning and curriculum reinforcement learning. Evaluations cover specified 1.5B/7B text, multimodal and code settings. The paper explicitly says its reasoning budget excludes inserted control tokens and the fixed final-answer suffix; this is not strict end-to-end token control. Very small budgets can omit necessary constraints. | Use the insight that timely remaining-budget signals can matter. Do not paste specialized training tokens into OpenAI/Claude prompts and claim BudgetThinker behavior. Use documented provider controls or application-generated task checkpoints instead. |
| [s1: Simple test-time scaling, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.1025/) ([author code](https://github.com/simplescaling/s1)) | Muennighoff et al. combine fine-tuning with decoding interventions that shorten or extend model computation. More computation improves some evaluated difficult math results. This concerns a specific trained model and inference protocol, not a universal benefit from verbose output or repeated requests. | Reserve more computation for tasks whose quality improves in local evaluations. Avoid both unconditional maximum effort and a policy that always minimizes tokens regardless of correctness. |

The papers do not establish a universal token-saving percentage for Atlas. They
also do not show that writing “you have five minutes” gives a model a reliable
clock. A runtime deadline and cancellation path remain separate requirements.

## Current provider controls: keep the surfaces distinct

All features in this section are developer APIs or SDK patterns. They are separate
from consumer ChatGPT/Claude task scheduling. Atlas's existing direct model calls
do not automatically acquire a managed harness, multiagent runtime or outcome loop.

| Surface | Verified behavior | Integration implication |
| --- | --- | --- |
| [OpenAI Responses reasoning](https://developers.openai.com/api/docs/guides/reasoning) | `reasoning.effort` influences computation. `max_output_tokens` caps generated tokens, including reasoning and formatting; an incomplete response can consume tokens before visible text appears. Supported controls vary by model. | Select effort intentionally, keep an output allowance for the deliverable, and handle incomplete/unknown usage. A short visible answer does not mean the whole call was cheap. |
| [OpenAI Agents SDK orchestration](https://developers.openai.com/api/docs/guides/agents/orchestration) | A manager can call specialists as tools and retain the final reply; a handoff transfers response ownership. The guide advises adding specialists when their contract materially differs. | Donna remains the user-facing coordinator. Delegate scoped tasks with structured return values rather than handing the user between every department. |
| [OpenAI Agents API architecture](https://developers.openai.com/api/docs/guides/agents-api/architecture) | OpenAI hosts the harness and session loop; applications submit work and receive events. Compute/file access depends on an attached environment. | Treat this as a separate future execution adapter. Map its session and child IDs into the same Atlas goal/job ledger rather than maintaining a second invisible task system. |
| [Claude Messages task budgets](https://platform.claude.com/docs/en/build-with-claude/task-budgets) | The current beta adds an advisory token countdown across a multi-request agentic turn. It is not a hard cap. `max_tokens` remains a per-request ceiling. Too-small budgets can cause premature stops. Its countdown differs from cumulative billed input when history is resent. | Use only on a supported model/API with tested options. Keep the application spend ledger authoritative. Do not decrement its `remaining` value by every resent prompt; follow the documented history/compaction rules. |
| [Claude Managed Agents outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes) | An outcome describes the target and a required rubric; the harness provisions an evaluator with a separate context and feeds results back for iteration. | Model completion as acceptance criteria plus evidence. A provider grader is useful feedback; deterministic checks and any required human approval remain independent. |
| [Claude Managed Agents session budgets](https://platform.claude.com/docs/en/managed-agents/budgets) | A session limit is checked between model requests at public list prices. In-flight requests finish; the documented margin can include one request per thread plus associated tool/runtime cost. A budget is attached at session creation. | Keep a safety allocation for active work. This is different from Messages `task_budget`. If integrated, convert units carefully: `max_list_cost.amount` is a string of whole US cents, not a dollar decimal. |
| [Claude orchestration-mode example](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-effort-example) | “Orchestration mode” in this example is an application pattern using effort, mode reminders and tool descriptions, not a hidden API switch. It independently caps concurrency, queued subtasks and turns. | Model an Atlas mode as stored application policy with explicit limits. Never imply a prompt grants tools or authority the runtime has not provided. |

Claude's [Managed Agents multiagent guide](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)
also distinguishes persistent subagent threads from background workflow runs and
advisors. Choose based on whether follow-up context is needed, not a department
name. Its session budgeting includes workflow work, but that does not aggregate
Atlas jobs running through other providers.

## Application budget contract

The recommended hierarchy is company → project → goal → run → worker attempt.
Each attempt has exactly one parent and one reservation identity. Do not add a
parent's rolled-up usage to its children's usage a second time.

Before dispatch, atomically check all applicable ancestors and reserve a bounded
amount. For a provider with reliable counts, include the complete request:
instructions, tool schemas, history, files and expected output. Use a verified rate
card including cache writes, not an assumption that all cached input is discounted.
Cloud tools, storage and managed runtime charges need their own categories.

```text
available allocation = cap - settled usage - active reservations - unresolved holds
```

Reserve from that available amount; do not let two workers read the same balance
and both spend it. Reconcile once when observed usage arrives. If a request times
out after dispatch, retain its hold until its charge is resolved. Stop or pause the
affected work when accounting is unknown, while preserving any returned artifact.

This design is supported by OpenAI's official
[per-run spending-controller example](https://developers.openai.com/cookbook/articles/per_run_spending_controller_responses_api):
it reserves before a call, uses the largest configured input-category rate for the
reservation, disables automatic retries, and retains uncertain reservations. Its
sample lock covers one process; shared workers need shared atomic storage. The
example documents exclusions, so it is not a complete invoice calculator to copy
unchanged.

Keep five controls visible as separate fields:

| Control | Owner | Meaning |
| --- | --- | --- |
| Outcome and acceptance checks | Goal record | What useful completion means |
| Preferred response size / effort | Prompt and model adapter | Guidance and supported model settings |
| Total input/output/call allowance | Runtime ledger | Cumulative work permitted across descendants |
| USD allowance | Atomic reservation ledger | Cost allocation, settled amount and unresolved holds |
| Deadline and concurrency | Scheduler | When to stop admitting work and how much can run together |

Elapsed wall time differs from summed worker time. The global screen should show
both when parallel execution matters. Cancelling a local wait does not prove a
provider stopped processing or billing the already submitted request.

## A concrete Donna task packet

The following is a proposed compact template for
[`company/prompts/donna.md`](../company/prompts/donna.md) and the worker dispatch
contract. It is a design recommendation; this report does not silently change
those files or enable new live tools.

```text
Goal: <stable ID and version; intended result in one sentence>
Why: <one short company/project context summary>
Done when: <explicit checks and required evidence>
Assignment: <this worker's bounded contribution>
Inputs: <artifact IDs, source hashes, selected excerpts>
Allowed actions: <runtime-approved capabilities>
Limits: <remaining allocation, request output limit, deadline, call limit>
If blocked: preserve completed work; return the blocker and required next input.
Finish: return the artifact, evidence references, decisions, uncertainties,
        acceptance results, and the next handoff. Do not return private reasoning.
```

Budgets in the packet explain runtime state; they are not the enforcement layer.
The runtime should attach a compact update only when the remaining allocation or
scope changes meaningfully. Stable policy and skill content stays in the prefix;
changing goals, evidence and remaining budgets belong in the suffix. For provider
features that change rendered context, verify the cache implications rather than
assuming every mode change preserves a hit.

## Single chat, blueprint and office behavior

These are proposed UI/runtime decisions for the shared workspace:

1. **Single chat:** every CEO request links to a goal version. Donna reports the
   current decision, progress, blockers and next useful action. The user can inspect
   a specialist without losing the main conversation.
2. **Blueprint:** display the actual work graph, acceptance gates and artifact
   edges. Store a revision hash so changing a goal does not rewrite past runs.
   Unstarted work can be replanned; active attempts retain their original contract.
3. **Office:** persistent employees retain identity, skills and scoped memory.
   Their avatar is a view of job state. Idle employees need no model inference.
   Schedules or events enqueue bounded work instead of prompting every employee
   continuously.
4. **Hierarchy:** Donna can route straightforward work directly. A department lead
   adds a call only when decomposition, specialist selection or review adds value.
   Pass relevant goal ancestry and accepted summaries, not every company transcript.
5. **Review loop:** deterministic checks run first. Use a reviewer for consequential
   claims or work that needs judgment, with explicit evidence and bounded corrective
   attempts. A failed check produces a specific repair task; it does not restart
   the entire company or open an unlimited debate.
6. **Budget panel:** show cap, settled estimate, active reservations, unknown holds,
   remaining allocation and reason for a pause. A cache percentage and a “busy”
   animation do not measure useful progress.

The existing [worker ledger](WORKER_LEDGER.md) and
[backend architecture report](BACKEND_RESEARCH.md) are the starting audit surfaces.
Log prompt version/digests, permitted inputs/actions, short work summaries,
artifacts and verification outcomes. Avoid storing private scratchpads as a
substitute for evidence.

## Real products worth learning from

These are verified project descriptions, not independent security or performance
audits. No source code from them was copied and no installer was executed.

| Project | What its own repository describes | Atlas lesson |
| --- | --- | --- |
| [Paperclip](https://github.com/paperclipai/paperclip) | Organization goals linked to projects/tasks; mixed agent runtimes; company/agent/project budgets; atomic task checkout; persistent task threads; routines, permissions and revisioned governance. | Persist the work, goal ancestry and accountability independently of the model harness. Make budget and permission state inspectable from the same task. A reusable company template should exclude secrets. |
| [Claw-Empire](https://github.com/GreenSheep01201/claw-empire) | A visual office with departments, CEO directives, task lifecycle, provider/CLI adapters, worktree isolation, activity monitoring and task reports. | Use office/department views to make real work understandable. Keep job state, report provenance and controls primary; animation, meetings and rankings should not generate extra work simply to look active. |

Paperclip's heartbeat pattern and Claw-Empire's activity view are useful design
references. Their README claims do not establish reliability for this repository,
and a large skill catalog is not evidence that all skills are reviewed or useful.

## Tests required before claiming token efficiency

Start with reviewed fixture tasks representative of Atlas: a bounded source
comparison, a repository change with tests, a science evidence summary, and a
multi-part report. Keep source snapshots, model IDs, prompt versions and acceptance
criteria fixed within each comparison.

Compare a single worker, Donna with a small specialist graph, and that same graph
with adaptive budget guidance. Use the same task set and count planning, routing,
review, synthesis, retries and incomplete attempts. Record useful accepted output,
evidence coverage, unsupported claims, total input/output, cache categories, wall
time and configured cost. Include cold and repeated contexts separately.

The relevant cost comparison is:

```text
specialist workflow cost = planning + workers + review + synthesis + recovery
```

Concurrency can shorten the critical path while increasing that sum. A lower
token count is a win only if required work and acceptance quality are retained.
OpenAI's [Agents API usage guidance](https://developers.openai.com/api/docs/guides/agents-api/observability)
also warns that cached-input percentage is not total-task savings and that unknown
usage is not zero; its current aggregate usage does not expose every cache-write
charge needed for exact pricing.

**Implementation hypotheses to test:** deterministic task classification costs less
than an estimator call for simple jobs; scoped handoffs reduce duplicate reading;
one targeted review beats repeated all-hands review for routine changes; meaningful
remaining-budget checkpoints reduce incomplete work. None of these improvements
has been measured on live Atlas jobs in this session.

## Prioritized decisions

- **Implement now in the control plane:** one goal/job identity, inherited limits,
  atomic reservations, explicit unknown holds, artifact preservation and bounded
  scheduling. Keep the chat, blueprint and office as views of that state.
- **Evaluate next:** task-class budget bands, provider-specific effort settings,
  summary-only specialist inputs, cold/warm cache behavior and focused review.
- **Integrate only after a capability check:** Claude task budgets or managed
  outcomes, OpenAI managed harness sessions, and provider compaction. Each needs a
  dedicated adapter, tested accounting and an explicit application-state mapping.
- **Do not infer from these papers:** that special control tokens work on untrained
  API models, that the smallest token allowance is optimal, or that more employees
  always improve cost or quality.
