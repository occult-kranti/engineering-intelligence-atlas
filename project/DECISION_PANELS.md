# Donna decision panels

Donna can convene a small expert panel for a company, office, department or group.
A group panel names one coordinating company. That grouping does not expose
private sibling-company knowledge: each job uses the coordinating company's
context plus only explicitly selected, granted knowledge transfers.

## What is implemented

The Rust `decision_panels.rs` module stores additive `decisionPanels` records in
the existing durable workspace. Old snapshots default to an empty panel list.
Convene selects one to five relevant roles, prefers existing active contracted
specialists and local employees, then hires only a missing eligible role. A paused
or fired employee is not silently resumed. Every new definition retains a stable
employee ID and a role-library assignment key for future tasks.

Convene performs no provider request. Start creates a genuine goal DAG: each
expert gets an independent current-round task and Donna's synthesis depends on
all expert jobs. Workers use the existing provider adapter, artifact validation,
cache keys, admission reservations and accounting. The synthesized report is a
recommendation. It does not mark implementation or publication complete.

| Focus | Default expert roles |
| --- | --- |
| Software | Engineering, design and architecture, security, QA |
| Design | Design and architecture, frontend and extensions, QA |
| Research | Newton analysis/synthesis, Tesla mechanism/resonance, research skeptic |
| Data | Database/cache, security, evidence research |

Callers may choose a smaller relevant set through `roleKeys`. The available keys
are defined by `DecisionPanelRoleKey` in the shared TypeScript contract. Additional
research roles include resonance advisor and paired forward/reverse coordinator.
The actual index contains the selected brief; it is included in the worker's
exact-context digest. Unrelated role changes do not invalidate an unchanged
selected role. Documents and source URLs are references, not automatically
fetched evidence and not executable capability grants.

## Runtime contract

| Action | Inputs | Result |
| --- | --- | --- |
| `convene_panel` | `companyId`, optional `scope`, `title`, `task`, `focus`, optional `roleKeys`, `maxRounds`, `maxUsd`, `maxTokens`, `maxMinutes`, `roadmapItemIds` | Draft panel and stable selected employees; no queued calls |
| `start_panel_round` | `panelId`, optional `runSettings`, `reviewed`, `knowledgeTransferIds` | One goal with independent expert jobs and dependent Donna synthesis |
| `record_panel_decision` | `panelId`, `verdict`, `summary`, nonempty `evidence` | Preserved accepted/revise/defer/reject decision for the settled round |
| `pause_panel` | `panelId` | Future round jobs pause; already dispatched calls retain accounting and may settle |
| `resume_panel` | `panelId` | Pending work becomes eligible again; completed work is not replayed |

`scope` accepts company, group, office or department. Office/department scope must
belong to `companyId`; group membership is checked at convening and starting.
`roadmapItemIds` must be visible to the coordinating company. Shared worker
contracts and selected knowledge grants are validated again at start and through
the existing dispatch and late external-action checks. A revoked contract blocks
the next start without erasing historical reports.

`maxUsd` is the **whole panel ceiling**. The runtime divides this allocation among
the configured rounds and the expert-plus-moderator requests; caller-provided run
settings cannot raise it. A new round also accounts for all preceding job usage,
including reservations and conservative estimates. `maxTokens` and `maxMinutes`
bound each request. The existing global ceiling remains authoritative. A model
provider may report anomalous observed usage above its reservation; that usage is
retained and reduces or blocks subsequent admission rather than being hidden.

The panel accepts one to five rounds. Each round has a single-iteration goal,
so the general autonomous goal ticker cannot silently run subsequent panel
rounds. A settled round moves to review. Another round requires an explicit
`revise` decision and a new `start_panel_round` call. The next prompt contains the
actual prior decision and evidence references. A final-round revise is rejected;
record a defer/reject/accepted decision, then convene a new bounded task if needed.

Panel reviews have no publication or execution capabilities. A nonempty
`runSettings.allowedTools` is rejected. Provider runs still require a selected
provider/model, pricing, normal review authorization or the configured app
autonomous mode, and an enabled worker. Missing `runSettings` uses manual mode;
this is useful for local planning and is not a claim that a model was called.

## Bounded provider example

These are shape examples. Replace the model and rates with currently verified
values. The caller must already hold the applicable authorization and configure
the provider credential in the runtime vault.

```json
{
  "action": "convene_panel",
  "companyId": "engineering-intelligence-atlas",
  "scope": { "kind": "company", "id": "engineering-intelligence-atlas" },
  "title": "Desktop and extension delivery decision",
  "task": "Compare the two implementation options. Return owners, dependencies, evidence, a failure check and unresolved disagreement.",
  "focus": "software",
  "roleKeys": ["engineering", "qa"],
  "maxRounds": 1,
  "maxUsd": 0.5,
  "maxTokens": 60000,
  "maxMinutes": 10
}
```

Use `lastAction.panelId` in the second call. For MCP, pass the action separately
and the remaining fields as the `office_command.payload` object.

```json
{
  "action": "start_panel_round",
  "panelId": "returned-panel-id",
  "reviewed": true,
  "runSettings": {
    "mode": "provider",
    "provider": "anthropic",
    "model": "verified-model-id",
    "authorized": true,
    "maxTokens": 60000,
    "maxUsd": 0.5,
    "maxMinutes": 10,
    "priceRates": { "inputUsdPerMillion": 2, "outputUsdPerMillion": 10 },
    "allowedTools": []
  }
}
```

The example $0.50 ceiling yields three per-request allocations: two experts and
Donna. If an assembled prompt cannot fit its allocation, the job remains subject
to the existing bounded worker admission rather than making an unbudgeted call.
The exact model/rates above are placeholders for the example, not a current-price
claim or instruction to use an unverified model.

## Evidence and acceptance

The UI reads reports from `panel.goalIds → goals.jobIds → jobs`, including
`summary`, `artifactUri`, `status`, actual usage and cost classification. An empty
report stays empty. The runtime never invents expert prose, provider identities,
consensus, tests or deployment receipts.

For model synthesis, the worker now reads each completed same-company predecessor
from its managed artifact store. It verifies a bounded regular file, refuses
symlinks, hard links, outside paths and files over 512,000 bytes, and binds the
full content digest to the exact-context cache key. At most 8 KiB per predecessor
and 24 KiB in total enter the prompt, with explicit complete/excerpt/unavailable/
omitted-budget reading status. Hash and excerpt come from the same bounded read.
Text is untrusted evidence, never instructions granting tools; credential-shaped
text is redacted. The full artifact remains available by reference. A change to
an omitted tail still changes its digest and invalidates cached synthesis.

The worker's admission calculation conservatively bounds input by UTF-8 bytes
plus framing overhead. Therefore the default total token allowance is 60,000 per
request, including context; it is not a request to generate that many tokens.
Output remains bounded by the provider worker limit and the smaller USD allocation.

An accepted decision requires the current expert and synthesis jobs to be
completed with artifact references, plus a nonempty explicit decision evidence
list. This verifies record completeness, not the truth of every scientific or
engineering claim. Actual source inspection, executed checks and independent
acceptance remain separate evidence. Failed or incomplete rounds may be deferred,
rejected or revised; their artifacts and budget records remain available.

Decision prompts ask for conclusions, alternatives, source/evidence references,
acceptance checks and a concise handoff. They do not request hidden reasoning.
The Newton/Tesla names are contemporary research lenses based on the enabled
documented-method skills. [Research provenance](../company/role-library/research-skill-map.json)
records reading scope. A panel does not establish human peer review, historical
endorsement, a completed proof or measured reasoning-quality improvement.

## Implementation decisions and checks

Accepted: small panels, reusable stable employee definitions, independent expert
tasks followed by a moderator, explicit feedback before another round, aggregate
USD allocation, normal global admission, and append-only decision history.

Rejected: one employee per every named topic on startup, role titles granting
tools, a group label granting sibling private data, fake panel reports, unlimited
research loops, or treating model consensus as implementation verification.

Deferred: dynamically installing arbitrary external skills, browsing every linked
source in a role index, or automatically executing a panel recommendation as code.
Those require an explicit bounded implementation/research task with supported
adapters and acceptance evidence.

Rust behavioral coverage checks role reuse, paused-staff preservation, scoped
contract revocation, group and department boundaries, authorization before paid
jobs, the review DAG, fixed panel allocations, evidence-required decisions,
explicit adaptive rounds, and pause/resume without rebilling settled work.
The TypeScript loader check exercises every bundled research lens through the
same bounded role loader used by production workers.
