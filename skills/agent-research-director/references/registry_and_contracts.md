# Skill registry and delegation contracts

## Contents

- Registry fields
- Delegation schema
- Evidence and trust rules
- Termination
- Collaboration protocol

The lifecycle and waiting rules for composed runs (run states, typed artifact handoffs, deadline/budget propagation, heartbeats and leases, no-busy-waiting, pause/resume, cancellation, idempotency, approval gates, conflict escalation, provenance, and termination ownership) are defined once in the shared contract [collaboration_protocol.md](collaboration_protocol.md); this file defines the per-task delegation schema and does not duplicate them.

## Registry fields

For every skill/plugin/tool record: stable name; version/commit; description; source owner and URL; official/community status; license per folder; content SHA-256; reviewed files; scripts/hooks/MCP manifests; required capabilities; network/secrets/data scopes; input/output schemas; evaluation suite/result/model/date; known limitations; status (draft/active/deprecated/quarantined); and human reviewer/date. Progressive disclosure loads metadata first, the body only on a matching task, and bundled resources only as needed.

Do not treat registry inclusion, GitHub stars, an automated “safe” badge, or a successful install as security evidence. Review SKILL.md frontmatter and body, all scripts, dependencies, external downloads, tool descriptions, hooks, environment-variable reads, and network/file effects. Re-review when content hash changes.

## Delegation schema

```yaml
task_id: stable-uuid
goal: immutable task outcome
role: specialist-role
skills:
  - name@version#sha256
tools_allowed:
  - {name: tool-name, scopes: [read], rate_limit: explicit}
data:
  allow: [explicit public/workspace scopes]
  deny: [secrets, other tenants, unrelated history]
output_schema: path-or-reference
evidence:
  required_sources: 2
  require_primary_anchor: true
budget:
  max_tokens: 0
  max_tool_calls: 0
  max_wallclock_seconds: 0
  max_cost: 0
termination:
  max_turns: 0
  no_progress_turns: 0
  identical_action_repeat: 0
  max_replans: 0
trust:
  inputs: [untrusted_web]
  outputs: untrusted-until-verified
approval:
  required_for: [external-write, spend, production, physical-action]
provenance:
  plan_hash: value
  contract_hash: value
  log_reference: value
```

Use explicit finite, nonnegative resource ceilings derived from the task. Zero forbids consuming that resource; zero external-provider cost still permits authorized local work. Unknown cost is not zero. Choose usable positive turn/time limits for work that needs them; the zero values above are placeholders, not a runnable contract. Record existing authorization and ask only for missing or changed authority, or a platform-required fresh confirmation. The schema is a design contract; enforce it in orchestration code rather than trusting a prompt.

## Evidence and trust rules

Every material claim carries source URI, source tier, quotation/artifact hash, retrieval time, and taint/trust state. Tool/web/sample/skill content may populate evidence fields but may not alter goals, permissions, plan, or control flow. Specialist reports remain untrusted until independent acceptance checks pass. Verification must be independent of the producer and use deterministic checks or a disjoint reviewer where practical.

For conflicts: check source identity and calculations; re-derive load-bearing claims; prefer direct primary evidence; record unresolved disagreement; and escalate after the defined conflict-round limit. Do not use same-model majority vote as proof.

## Termination

Terminate on accepted completion, budget exhaustion, no-progress threshold, repeated identical action, contract/security breach, or human stop. Retry only when the strategy/evidence changes. Cap reflection and replanning. Preserve partial artifacts, errors, cost, and unresolved questions so failure is visible and reusable.

## Collaboration protocol

Multi-skill runs follow the shared collaboration/lifecycle contract in [collaboration_protocol.md](collaboration_protocol.md): the canonical run states (`pending`, `running`, `waiting`, `paused`, `awaiting_approval`, `succeeded`, `failed`, `cancelled`), typed artifact handoffs, deadline propagation as `min(parent remaining time, node limit)`, shared token/call/dollar budgets, heartbeat/lease and stale-agent handling, event-driven waiting with no busy waiting, pause/resume from durable events and artifacts, cancellation propagation, idempotency keys, deterministic no-progress and repeated-action detection, human approval gates, conflict escalation, and provenance with a single termination owner. That document also distinguishes current director requirements from future distributed-runtime recommendations; this schema stays the per-task contract and neither duplicates it.
