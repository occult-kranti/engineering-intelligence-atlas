# Daftar — personal agent office

**A personal workspace for Donna, your permanent agent team, and the repositories they maintain.**

One scoped chat connects to an interactive office blueprint and an ownership
whiteboard. Companies contain offices, departments and employees; goals become
bounded dependency graphs with queues, checkpoints, budgets and evidence.

[Private signed-in office](https://atlas-command-office.whatswrong-inc.chatgpt.site) ·
[Public atlas](https://occult-kranti.github.io/engineering-intelligence-atlas/) ·
[Desktop starter preview](https://occult-kranti.github.io/engineering-intelligence-atlas/desktop-preview/chrome.html) ·
[Published releases and downloads](https://github.com/occult-kranti/engineering-intelligence-atlas/releases) ·
[Roadmap](ROADMAP.md) · [Handoff / setup](HANDOFF.md) ·
[Shared worker ledger](project/WORKER_LEDGER.md) · [Timeline](TIMELINE.md)

## Company kits — 0.6.1 integration

Two reusable company templates add a Fintech & Hackathon Studio and a Social & Digital Presence organization. The [company-kit catalog and installer](company/company-kits/README.md) define seventeen departments, eight domain specialties, scoped shared-service contracts, owned roadmap items and office whiteboards. The detailed [fintech guide](company/company-kits/fintech-hackathon/README.md) and [social-presence guide](company/company-kits/social-presence/README.md) include bounded roles, evidence rules and current official integration references. Personal client records remain in the owner workspace.

An independent review found that internal identity bindings could displace useful worker knowledge. The patch excludes that metadata from native/cloud prompts and human knowledge views, while resolving a specialist's same-company task contract within bounded context. Persistent employee definitions do not start paid workers or connect external accounts. Publication and exact release evidence will be recorded in [validation](project/VALIDATION.md).

## Studio redesign — 0.6.0 released

The shared desktop and website office now has **Violet studio** and **Golden drafting** themes: deep violet, electric green, warm gold and an ivory drawing surface. Blueprint rooms, an Ownership / Soft Board hierarchy, real roadmap status lanes and the ownership whiteboard use the same saved scope. Donna's dock contains the existing conversation and preserves an unsent draft when changing views.

Heat maps show **saved unfinished jobs**, **recorded commitment against job allowances**, or **items needing attention**. Legends, labels and unknown states travel with the metric. They do not infer employee utilization, invent schedule dates or trigger model calls. The website directory and VS Code client link to the new company-scoped views. The existing Design & Architecture role now includes color-system and data-visualization acceptance examples.

[Daftar 0.6.0 is released](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.6.0) from exact source [`5b661e5`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/5b661e57a2ac68530e50a7f452d912f169495ef5). All seven verification gates, the release job and Pages passed. Checks include 70 Rust tests, 392 desktop tests, 218 renderer assertions and 13 editor protocol tests; the public browser sweep passed 76 checks with 74 screenshots, and cloud fixtures passed 42 checks with 18 screenshots. The matching owner-private website is deployed. All three downloaded package sizes and SHA-256 hashes match GitHub metadata. [Exact release receipt](project/release-0.6.0.json) · [Validation and limits](project/VALIDATION.md).

[Design decisions](project/STUDIO_REDESIGN.md) · [Color tokens and contrast](project/STUDIO_COLOR_SYSTEM.md) · [Heat-map data contract](project/OFFICE_SIGNALS.md)

## Earlier connected office delivery — 0.5.0 history

[v0.5.0 is released](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.5.0)
from exact source
[`0b87469`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa).
All seven verification gates and the release job passed in
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825),
including packaged desktop operation, installed VSIX activation and the cloud UI
fixture. The private website and public Pages update are deployed. Checks include
70 Rust tests, 375 desktop tests and 192 renderer assertions. All three downloaded
release assets match their published SHA-256 digests. The final personal archive
was restored with the published Rust binary and paired to the deployed API;
original, restored and cloud projections matched without duplicate messages or
provider calls. [Validation](project/VALIDATION.md) records the exact evidence,
download hashes and remaining owner-laptop/keychain acceptance.

- **Donna workspace:** company/office/department/employee conversation scope, local plans, actual provider returns, and one place to inspect progress.
- **Office and whiteboard:** persistent rooms, employee positions, keyboard movement, boards and goal/job ownership mappings.
- **Permanent staff:** idempotent company staffing for subdirectors, code, QA, GitHub, knowledge and blueprint stewardship, with hire/pause/resume/fire controls.
- **Goals and execution:** plan/execute modes, bounded corrective iterations, DAG dependencies, checkpoints and optional autonomous app approval.
- **Global budgets:** USD/token reservations across Office and local Projects, early warnings, retained progress and explicit unknown-cost holds.
- **GitHub companies:** public/private owner discovery, branch inspection, comparisons and bounded text changesets published against a checked branch head.
- **Private browser:** open the same owner workspace on your laptop through the desktop app's authenticated loopback server.
- **Credentials and models:** OS-backed credential storage and native file import; live provider discovery; existing local hardware/model and Ollama controls.
- **Decision expert panels:** Donna selects reusable specialists, queues independent reviews followed by synthesis, and records evidence, disagreements and bounded decisions. Newton, Tesla, skeptic, resonance and paired-research lenses extend the role library.
- **VS Code:** an installable thin client with SecretStorage, scoped Donna, teams, roadmaps, queued commands and local/website pairing.
- **Private website:** ChatGPT sign-in, durable D1 workspace and conversations, server-held Claude credentials, explicit revision-safe desktop sync and a separately reserved cloud allocation.
- **Rust core:** durable control state, cross-process locking, atomic writes and bounded parallel repository metadata indexing.
- **Timed management:** scoped grants, Donna delegation, temporary promotions, searchable control history and an indexed company hierarchy.
- **Application directory and design:** private source-linked dashboard catalog, distinct publication/verification dates, Figma client setup and a bounded OpenPencil handoff adapter.

Provider workers start disabled. A permanent role record does not consume tokens
while idle. Public pages and their starter preview contain no personal account
state or credentials. Private website controls enqueue commands; the desktop validates and applies them on an explicit sync. Cloud Donna chat works independently within its reserved allocation.

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
- [23 role guides and sample task packets](company/role-library/index.json), including browser-extension research, exact geometry, architecture/art and music examples
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
- `vscode-extension/` — installable editor workspace with protected device credentials.
- `cloud-workspace/` — owner-private Sites/Vinext/D1 website, API, shared renderer and cloud budget ledger.
- `design-tools/` — bounded OpenPencil import, inspection and export, source/license records and design handoff examples.
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

The static atlas can be hosted from `docs/` on GitHub Pages after a reviewed build is copied there. Provider-backed agent execution, authentication, database persistence, and uploaded skill/artifact storage require the dynamic application runtime. Provider credentials must never be embedded in this repository or client bundles: use Sites runtime secrets, the encrypted owner-scoped server vault, Electron safeStorage, or Android Keystore as appropriate. Live model/API calls follow the owner’s configured review or autonomous policy and budget; platform storage and external managed-runtime charges require their own accounting.

## Daftar management and directory

The Daftar name replaces the product label while existing repository URLs, workspace IDs and backups remain compatible. CEO → Director → Donna → scoped assistants and shared employees operate through the same office blueprint, conversation and ownership whiteboard. Timed grants, temporary promotions, a searchable management ledger and a derived office index make current authority visible.

The private [application directory](https://atlas-command-office.whatswrong-inc.chatgpt.site/applications) links known repository apps and dashboards using recorded source URLs and dates; private metadata is never included in the public preview. The [Figma and open design guide](project/FIGMA_AND_DESIGN.md) documents separate MCP client sign-in and the bounded local adapter.

See [Daftar management](project/DAFTAR_MANAGEMENT.md) for the complete role, permission, promotion, directory and control flow. The shared Security specialist now includes the source-reviewed [Clouds Against Humanity learning path](company/role-library/references/clouds-against-humanity.md) and its zero-dollar access-control exercise.
