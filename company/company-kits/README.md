# Daftar company kits

The public catalog defines four reusable organizational templates: **Fintech & Hackathon Studio**, **Social & Digital Presence**, **Daftar Hardware Studio** and **Daftar 3D Game Studio**. It contains generic departments, specialist definitions, roadmap dependencies, shared-service contracts and reference documents. Client identities, private source registers, account connections and campaign evidence belong in an owner-private copy of the plan.

Creating a company does not start an agent process, make a model request, connect a social account, publish a post, enroll in an event or spend a campaign budget. The native worker, credential vault, explicit service contracts and existing authorization controls remain responsible for execution.

## Preview and apply

Use an already-initialized desktop workspace and keep one writer active while installing. The default command reads the existing native state file without calling a native snapshot, so it cannot initialize or migrate the workspace during a preview.

```sh
node scripts/apply-company-kits.mjs \
  --plan /absolute/checkout/company/company-kits/index.json \
  --state-dir /absolute/private-workspace/company
```

The preview reports projected creations and reused definitions, including assistants and directors supplied automatically by the native core. To perform the locally authorized installation:

```sh
node scripts/apply-company-kits.mjs \
  --plan /absolute/private-workspace/company-plan.json \
  --state-dir /absolute/private-workspace/company \
  --apply \
  --report /absolute/private-workspace/new-company-kit-receipt.json
```

The report must be a new absolute file. Standard output and the report contain IDs, counts and a plan hash; they omit client names, source bodies and source URLs. Keep reports in the private workspace because company IDs can themselves identify projects. The importer does not contact any network endpoint. Website publication or explicit desktop sync is a separate operation.

## Plan contract

The executable example is [index.json](index.json). The top-level object accepts only `schemaVersion: 1`, `classification` and `companies`. Classification is `public-generic-preset` or `private-owner-workspace`; the latter permits local and private artifact references. Neither permits credential material.

| Record | Required fields | Optional fields and semantics |
|---|---|---|
| Company | `key`, `id`, `name`, `office`, `departments`, `employees`, `services`, `roadmap`, `knowledge`, `board` | `group` adds membership without replacing existing members, names or status. |
| Office | `key`, `name` | Use `Main office` to reuse native creation. A kit currently targets one office. |
| Department | `key`, `name` | `Engineering` and `Research` reuse the initial native departments. |
| Employee | `key`, `name`, `role`, `skillPaths` | `departmentKey`; or `reuseAssignmentKey` to reuse a native office-level specialist. Reuse retains the existing name, role, skill priority and status; missing template skill references are appended after full-plan validation. |
| Service | `key` | `departmentKey` narrows the recipient scope. Contracts always include the selected office; a company-wide contract is a different scope. |
| Roadmap item | `key`, `title`, `description`, `dependsOn` | `ownerKey` or `serviceKey`; `departmentKey`. With neither owner field Donna owns the item. |
| Knowledge | `key`, `title`, `summary`, `artifactUri` | Stable key binds future runs to the original record. Use a new key for a distinct source revision. |
| Group | `id`, `name`, `description` | Existing metadata and paused status are preserved. |
| Whiteboard | `title` | A deterministic company board links the initial roadmap. Owner edits and later manual links are preserved. |

The complete input is validated before any apply command. Maximums are 20 companies per plan, 30 departments, 50 selected employee definitions, 20 scoped services, 100 roadmap items and 100 source knowledge records per company. Roadmap descriptions and knowledge summaries allow at most **4,000 UTF-8 bytes**. Names and IDs follow native limits. Skill references must exist in the checkout and follow `skills/.../SKILL.md`; role guides under `company/` are knowledge references rather than executable skill paths. Unknown keys, duplicate identities, unresolved references, dependency cycles, conflicting persisted bindings and known credential patterns are rejected.

Native `create_company` creates one company assistant, one office assistant, two department assistants and six office-level specialists. Templates reuse those identities rather than hiring equivalent specialists again. Additional departments receive the native shared department assistant. The reusable assignment keys are `subdirector`, `blueprint-steward`, `knowledge-curator`, `qa-lead`, `github-steward` and `code-engineer`.

Domain-specific hires use the selected existing skill paths. In 0.6.1 the worker resolves the selected employee's same-company binding to a source-knowledge key named `prompt-<employee-key>` and includes that compact task contract within its six-record knowledge allowance. Internal bindings never occupy source-context slots. Malformed or conflicting bindings cannot select arbitrary or other-company records. Full charter documents remain references rather than automatically fetched content; a job should still supply its exact outcome and evidence. The native hire API does not assign a role-library `assignmentKey`, and no role metadata grants execution authority.

## Shared services and ownership

Shared services must already exist. The importer never runs portfolio optimization or recreates the shared-service pool. Supported service keys are `engineering`, `design-architecture`, `research-knowledge`, `security`, `hackathon` and `music-arts`.

A new contract reuses the service's existing employee IDs and has an empty `allowedTools` list. It grants no GitHub, social, browser or deployment execution capability. Existing contracts are matched by service, recipient company, office and department. Paused/revoked contracts remain paused/revoked; missing work that would depend on such a contract fails preflight instead of silently reactivating it. Roadmap items with shared owners carry the matching contract ID.

## Idempotence, interruptions and owner edits

Company, roadmap, contract and new room/board IDs are stable. Native offices, departments and employees receive runtime-generated IDs, so the importer writes concise **company kit identity** records into the native knowledge ledger. Each binding records only the kit key, entity key, entity ID and company scope. The `daftar-kit://` reference is an internal identity marker, not a web address. Its summary also carries identity, because the existing cloud projection deliberately omits all `artifactUri` fields.

On a repeat run, bindings resolve owner-renamed entities and existing records retain their edits. Existing roadmap progress/evidence, grants, paused states, groups, room positions and whiteboards are kept. New input keys add new records. Editing an existing template description is not a migration of owner data; intentional changes belong in the normal application controls.

If a command committed but its response was interrupted before a binding was written, the next run attempts recovery by exact scoped identity. Multiple candidates fail instead of selecting arbitrarily. Do not edit or run a second importer against partially installed identities before reconciliation. A multi-command import is additive and restartable, **not one cross-command transaction**. There is no rollback that deletes created company records. A command failure requires reading the persisted state and rerunning; never infer that a lost response means the preceding command failed to commit.

The initial office map lays out the selected departments. Subsequent imports preserve bound room placement and the company board. If a future plan adds departments or roadmap keys, review placement and add those new roadmap links to the existing board through the normal UI; the importer does not reset an owner-edited board to the template.

## Verification

```sh
node --test scripts/test-company-kits.mjs
```

The suite runs against the actual packaged Rust core in temporary synthetic workspaces. It covers the four-company catalog, dependency ownership, shared-service reuse, no worker dispatch, restart idempotence, owner edits, interrupted responses, private receipt filtering, conflicting bindings and a CLI preview that leaves state bytes unchanged. No private source data or model calls are used by the suite.

## November company refresh

The [company setup refresh](../../project/COMPANY_SETUP_REFRESH.md) documents the current 21 runtime summaries, 350 source records and exact public source pins. The separate refresh CLI updates saved staff skill references; importing a missing kit creates organizational records. Neither operation starts paid jobs or changes an existing runtime permission. A local receipt is separate from the paired desktop sync needed to update the live website.

The added [Hardware Studio](hardware-studio/README.md) and [3D Game Studio](threejs-game-studio/README.md) retain source, validation and production limits. Existing company names, skills, pauses, grants, room placement, roadmap progress and evidence remain owner-controlled. Repeated imports append missing skills once while preserving existing priority; a fired bound employee or overflowing skill set fails preflight instead of being silently recreated.
