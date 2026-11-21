# Atlas — Personal Agent Office

**A personal workspace for Donna, your permanent agent team, and the repositories they maintain.**

One scoped chat connects to an interactive office blueprint and an ownership
whiteboard. Companies contain offices, departments and employees; goals become
bounded dependency graphs with queues, checkpoints, budgets and evidence.

[Public atlas](https://occult-kranti.github.io/engineering-intelligence-atlas/) ·
[Desktop starter preview](https://occult-kranti.github.io/engineering-intelligence-atlas/desktop-preview/chrome.html) ·
[Roadmap](ROADMAP.md) · [Handoff / setup](HANDOFF.md) ·
[Shared worker ledger](project/WORKER_LEDGER.md) · [Timeline](TIMELINE.md)

## Current product

- **Donna workspace:** company/office/department/employee conversation scope, local plans, actual provider returns, and one place to inspect progress.
- **Office and whiteboard:** persistent rooms, employee positions, keyboard movement, boards and goal/job ownership mappings.
- **Permanent staff:** idempotent company staffing for subdirectors, code, QA, GitHub, knowledge and blueprint stewardship, with hire/pause/resume/fire controls.
- **Goals and execution:** plan/execute modes, bounded corrective iterations, DAG dependencies, checkpoints and optional autonomous app approval.
- **Global budgets:** USD/token reservations across Office and local Projects, early warnings, retained progress and explicit unknown-cost holds.
- **GitHub companies:** public/private owner discovery, branch inspection, comparisons and bounded text changesets published against a checked branch head.
- **Private browser:** open the same owner workspace on your laptop through the desktop app's authenticated loopback server.
- **Credentials and models:** OS-backed credential storage and native file import; live provider discovery; existing local hardware/model and Ollama controls.
- **Rust core:** durable control state, cross-process locking, atomic writes and bounded parallel repository metadata indexing.

Provider workers start disabled. A permanent role record does not consume tokens
while idle. Public pages and their starter preview contain no personal account
state or credentials. Actual private controls run in the desktop/local browser;
the separately deployed server runtime has its own authentication and database.

### Build and run

```bash
npm --prefix site-source ci
npm --prefix desktop-shell ci
npm --prefix desktop-shell run build:native
node scripts/build-static.mjs
npm --prefix desktop-shell run sync-atlas -- --src ../docs
npm --prefix desktop-shell start
```

Node22.12+ and Rust stable are required. Complete setup, MCP configuration,
credential import and limitations are in [HANDOFF.md](HANDOFF.md). Actual test,
build and deployment outcomes are in [project/VALIDATION.md](project/VALIDATION.md).

## CEO portfolio and shared teams

CEO mode adds an application-group → repository-company → office → department view above Donna's one chat. Related projects share service contracts; their repository identities, source histories and private knowledge boundaries remain separate. The six reusable services are Engineering, Design & Architecture, Research & Knowledge, Security, Hackathon, and Music & Arts.

The private owner portfolio is organized into application groups with shared specialists and source-linked proposed next steps. Optimization can pause idle duplicate assignments without deleting history. Proposed work is distinct from executed builds. The public starter preview contains isolated example data only; private portfolio records and counts are excluded from this repository.

- [Portfolio architecture](project/PORTFOLIO_ARCHITECTURE.md) and [role routing/reference index](project/ROLE_REFERENCE_INDEX.md)
- [16 role guides and sample task packets](company/role-library/index.json), including browser-extension research, exact geometry, architecture/art and music examples
- `scripts/prepare-portfolio.py` prepares a private plan; `scripts/apply-portfolio.mjs` applies it through the MCP/native boundary and retains existing roadmap progress.
- Two bounded worker slots share the native lease and budget ledger. Recurring repository reviews fetch a verified head and commit-pinned README, preserve a proposal artifact and add a labeled knowledge handoff. Publication requires its separately granted GitHub capability.
- `scripts/export-personal-workspace.py` and `scripts/restore-personal-workspace.py` move personal state and included artifacts between owner devices without credentials.

## Research foundation

A research-backed reference organization, agent-skill library, public-careers evidence snapshot, resource catalog, and controlled orchestration architecture for building software, AI, security, game, spatial-computing, architecture, and company-support capabilities.

## Repository map

- `skills/` — fifteen installable agent-skill packages and their editable source folders.
- `roles/` — 109 role folders with mission, accountable outputs, core skills, senior scope, interfaces, and public reference.
- `organization/` — team topology, leveling, hiring, governance, and role-charter references.
- `reports/` — long-form research and product/architecture documents.
- `data/` — structured workbooks, data dictionaries, acquisition notes, and analysis artifacts.
- `scientific-research-library/` — dedicated charters for mathematics, physics, chemistry, biology, science history, game reconstruction, and AI open-model research.
- `desktop-shell/` — Electron desktop source with safeStorage, local projects, hardware/model manager, and Ollama support.
- `android-shell/` — Capacitor Android source with Keystore-backed credentials, local projects, and the offline atlas.
- `site-source/` — React/TypeScript source for the research atlas and orchestration product.
- `docs/` — reviewed static atlas and Science & Models build for GitHub Pages. The dynamic orchestration product requires its server, database, and object-storage runtime; GitHub Pages alone cannot provide those services.

## Skill packages

1. `engineering-organization-architect` — organization, role, ladder, hiring, and governance design.
2. `engineering-job-market-intelligence` — policy-aware public-careers snapshots and longitudinal comparison.
3. `defensive-reverse-engineering` — authorized static-first analysis, evidence preservation, and reporting.
4. `spatial-3d-production-engineering` — Blender, spatial UX, real-time 3D, AM/printing, and physical-action gates.
5. `computational-geometry-engineering` — mathematical contracts, robust geometry, and mesh prechecks.
6. `architecture-and-built-heritage-research` — tradition-specific architectural research and conservation-aware delivery.
7. `agent-research-director` — delegation, skill registry, evidence/conflict gates, budgets, termination, and evaluation.
8. `local-model-runtime-engineering` — hardware-aware model selection, verified downloads, local serving, and provider health gates.
9. `game-reconstruction-engineering` — authorized decompilation, static recompilation, and port engineering with evidence custody, clean-room separation, ROM/asset rights gates, and reproducible builds.
10. `mathematics-research` — mathematical domains, proof/formal verification, computation, and Fibonacci/source audits.
11. `physics-research` — classical through quantum physics, computation, experiment, metrology, and engineering interfaces.
12. `chemistry-research` — chemical domains, databases, software, reproducibility, and non-operational safety review.
13. `biology-research` — biological domains, dry-lab evidence, database provenance, and safety refusals.
14. `science-history-research` — primary-source, archive, patent, and myth audits for Newton, Tesla, Fibonacci, and related history.
15. `ai-open-model-research` — modality-specific open-model discovery, evidence, licensing, hardware, and safety gates.

## Evidence discipline

Public job and repository records are time-stamped snapshots, not permanent claims. Indirect, blocked, unlicensed, deprecated, and automatically discovered content is labeled separately from verified or source-reviewed records. GitHub stars and topic counts are not adoption, quality, or security evidence. No repository code is executed by the research pipeline. Role charters are reference models, not copied confidential structures or claims of current vacancies.

## Publication and runtime

The static atlas can be hosted from `docs/` on GitHub Pages after a reviewed build is copied there. Provider-backed agent execution, authentication, database persistence, and uploaded skill/artifact storage require the dynamic application runtime. Provider credentials must never be embedded in this repository or client bundles: use the encrypted owner-scoped server vault, Electron safeStorage, or Android Keystore as appropriate. Live model/API calls follow the owner’s configured review or autonomous policy and budget; platform storage and external managed-runtime charges require their own accounting.
