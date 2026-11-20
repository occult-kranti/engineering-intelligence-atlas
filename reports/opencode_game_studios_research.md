# Deep Source Study: striderZA/OpenCodeGameStudios (as of 2026-11-20)

**Repo**: https://github.com/striderZA/OpenCodeGameStudios
**Method**: Read-only study via GitHub MCP/API. No clone, no execution.
**Snapshot ref (master HEAD at study time)**: `85aa449a0cbc2ca44916455185c9d3b4a23a7429` — "chore: prepare v0.14.1 (#123)", 2026-11-13T04:38:20Z ([commit](https://github.com/striderZA/OpenCodeGameStudios/commit/85aa449a0cbc2ca44916455185c9d3b4a23a7429)). No commits after 2026-11-13, so this tree is current as of 2026-11-20.
**Latest release**: [v0.14.1 — "Harness-Aware Setup & Harness Tool Map"](https://github.com/striderZA/OpenCodeGameStudios/releases/tag/v0.14.1), published 2026-11-13. 22 releases total, from v0.1.2 (2026-05-01, "First public release") to v0.14.1.

Inline links below are pinned to the `85aa449…` blob/tree where a blob SHA was verified; directory listings were performed before file reads throughout.

---

## 1. License (checked first, per instruction)

- [`LICENSE`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/LICENSE) is the **MIT License**, Copyright (c) 2026 OpenCode Game Studios (blob `406ab19c…`, 1078 bytes). **Not AGPL.**
- ⚠️ **Inconsistency**: [`package.json`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/package.json) declares `"license": "ISC"`, contradicting the LICENSE file and the README badge. Flag as a repo bug.
- Upstream lineage: evolved from [Claude Code Game Studios (CCGS)](https://github.com/Donchitos/Claude-Code-Game-Studios) (attributed in README/AGENTS.md). No copyleft contamination observed; MIT permits reuse with attribution. Autopilot (third-party playtest tool) is Apache-2.0 and referenced by URL only, not vendored.
- `.gitmodules` ([blob](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.gitmodules)) declares exactly one submodule: `tools/aseprite-mcp` → https://github.com/striderZA/aseprite-mcp.git (Aseprite MCP server; its own license not inspected).

---

## 2. What this repo is (and is not)

**It is a harness-agnostic agent/skill *framework*** for AI-assisted game development: 52 agents, 78 skills, 78 slash commands, 11 path-scoped rule files, 22 installable theme modules, targeting five coding-agent harnesses (OpenCode V2, Pi, oh-my-pi, Claude Code, Codex).

**It is not a game.** Evidence:
- [`src/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/src) contains only `.gitkeep` and an `AGENTS.md` scaffold note.
- [`prototypes/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/prototypes) contains only `.gitkeep`.
- [`production/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/production) contains only `session-logs/.gitkeep` — i.e., all the state-file conventions (`production/stage.txt`, `session-state/active.md`, sprints, epics) are **contracts awaiting a game project**, with zero in-repo instance data.
- The demo game lives in a separate repo, [OCGS-Pong](https://github.com/striderZA/OCGS-Pong) (linked from README; not studied).

**Implemented code** (actual executable/interpretable artifacts): `.opencode/plugins/*.ts` (3 OpenCode plugins), `.pi/extensions/*/index.ts` (9 Pi/omp extensions), `.opencode/modules/install.mjs` + module trees, `tools/*.mjs` migration/symlink/hook utilities, `.githooks/` (commit-msg, pre-commit), `tests/**` (plugin/hook/extension/omp/module/workflow/e2e suites), CI workflows.

**Docs/prompt-layer only** (no code): all 52 agent `.md` files, all 78 skill `SKILL.md` files, all 78 command stubs, all rules, all templates. Their "behavior" is prompt engineering executed by the host harness's model.

---

## 3. Repository map (verified by directory listing)

| Path | Contents | Type |
|---|---|---|
| [`AGENTS.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/AGENTS.md) | 16.3 KB project/agent-harness config doc: tech-stack placeholders, coordination rules, collaboration protocol, context management, workflow modes, command catalog, studio hierarchy | Prompt config |
| [`opencode.json`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/opencode.json) | OpenCode V2 config: 3 plugins, 1 inline command (`hybrid-prototype`), 4 MCP servers (autopilot/godot/unity disabled; aseprite enabled), 22 permission rules | Config |
| [`package.json`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/package.json) | v0.14.1, test scripts (`test:plugins`, `test:hooks`, `test:extensions`, `test:omp`, `test:parity`, `test:modules`, `test:framework`), devDeps: tsx, minimatch | Config |
| [`.agents/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents) | **Canonical content**: `agents/` (52 files), `skills/` (78 dirs), `commands/` (78 md + README), `rules/` (11 files), `modules/` (22 module sources for non-OpenCode targets) | Prompt content |
| [`.opencode/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.opencode) | `agents|commands|rules|skills` are **git symlinks** → `.agents/`; `plugins/` (3 TS plugins + tests); `modules/` (install CLI + 22 OpenCode-target mirrors) | Mixed |
| [`.pi/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.pi) | `settings.json` (`enableSkillCommands`), `extensions/`: `ocgs-audit`, `ocgs-changelog`, `ocgs-core`, `ocgs-drift-detector`, `ocgs-hooks`, `ocgs-path-guard`, `ocgs-question`, `ocgs-tool-map`, `ocgs-validate` | Code |
| [`.omp/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.omp) | [`config.yml`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.omp/config.yml) wires 8 of the 9 Pi extensions (excludes `ocgs-core`); `mcp.json` | Config |
| [`.claude/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.claude) | Only `rules/ocgs-framework.md` — Claude Code agents/skills/commands are *generated at install time* by `/init-template --harness claude`, not tracked | Config stub |
| [`.cursor/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.cursor) | Only `rules/ocgs-framework.mdc` — minimal Cursor integration (rules only; Cursor is not a full harness target) | Config stub |
| [`.github/workflows/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.github/workflows) | [`agent-validation.yml`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.github/workflows/agent-validation.yml) (4 jobs: agents, workflow integrity, modules, plugins), [`test.yml`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.github/workflows/test.yml) (`npm test`), `stale.yml` | CI |
| [`tests/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/tests) | `agents/` (validate.mjs structural checker), `workflow/` (gates/invariants/paths/references + run-all), `extensions/`, `git-hooks/`, `modules/`, `omp/`, `e2e/` (parity) | Test code |
| [`skill-testing-framework/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/skill-testing-framework) | Self-contained skill/agent *behavioral* test harness: `catalog.yaml`, `quality-rubric.md`, spec dirs per category, spec templates | Prompt-test infra |
| `docs/` | `framework/` (17 refs + 36 templates), `architecture/` (ADRs), `engine-reference/` (version-pinned Godot 4.7.2 / Unity / UE5 / SFML3 / Raylib / Bevy 0.19 docs), `examples/` (12 session walkthroughs), harness compat guides | Docs |
| `tools/` | `migrate-to-agents.mjs`, `migrate-to-modules.mjs`, `fix-opencode-symlinks.mjs`, `git-hooks/`, submodule `aseprite-mcp` | Code |

---

## 4. Orchestration mechanics — mapped to the requested dimensions

### 4.1 Roles (52 agents, 3 tiers)

Hierarchy in [`AGENTS.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/AGENTS.md) and [`docs/framework/agent-coordination-map.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/agent-coordination-map.md):

- **Tier 1 Directors** (primary agents): `creative-director`, `technical-director`, `producer`. Directors run with `maxTurns: 30` frontmatter ([creative-director.md](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents/agents/creative-director.md)) — the only budget control in agent frontmatter.
- **Tier 2 Leads**: game-designer, lead-programmer, art-director (functions as Tier 1 for gates), audio-director, narrative-director, qa-lead, release-manager, localization-lead.
- **Tier 3 Specialists**: 25 generalists + 18 engine specialists across Godot(5)/Unity(5)/UE5(5)/SFML3(1)/Raylib(1)/Bevy(1).
- Every agent file has: required frontmatter (`description`, `maxTurns`) and required sections (**Collaboration Protocol**, **Key Responsibilities**, **What This Agent Must NOT Do**, **Delegation Map**) — enforced in CI by [`tests/agents/validate.mjs`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/tests/agents/validate.mjs) (`REQUIRED_AGENT_FRONTMATTER`, `REQUIRED_AGENT_SECTIONS`). Delegation tables are explicit: e.g., creative-director → {game-designer, art-director, audio-director, narrative-director}; lead-programmer → 6 programmer specialists; producer may assign to any agent *within that agent's domain*.
- Hybrid mode slims 52 → 10 roles with an explicit merge map ([`docs/hybrid-workflow.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/hybrid-workflow.md)).

### 4.2 Skills (78) and commands (78)

Each skill is a directory `.agents/skills/<name>/SKILL.md` with frontmatter (`name`, `description`, `user-invocable`, `allowed-tools`, optional `agent`, `argument-hint`, `isolation`). Commands (`.agents/commands/<name>.md`) are thin stubs with `description`/`skill`/`category` frontmatter routing to a skill — validated for referential integrity in CI. Categories: onboarding, design, architecture, stories, qa, prototyping, team, release, ops. Nine `team-*` skills are the multi-agent orchestrators.

### 4.3 Communication / delegation

- **Subagent spawn**: OpenCode `Task` tool with `subagent_type`. Canonical content is written in OpenCode vocabulary; a harness **tool-map** translates at runtime: [`.pi/extensions/ocgs-tool-map/index.ts`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.pi/extensions/ocgs-tool-map/index.ts) injects a mapping into the system prompt on `before_agent_start` — omp: `Task`→`task` (with `subagent_type`→`agent`, prompt→`task`, required `solutionSpace`), `question`→`ask`; Pi: no subagent tool exists, so agents are told to *do the work directly and never claim to have delegated*. Harness detection uses event markers (Pi `systemPromptOptions`, omp `reason`) with prompt-shape fallback; an idempotence marker `<!-- ocgs-tool-map:v1 -->` prevents double injection.
- **Pi delegation was tried and retired**: `ocgs-delegation` (Task tool + `/consult`) was removed in v0.14.1 because Pi's `ExtensionContext.sessionManager` is a `ReadonlySessionManager` with no sub-session API ([CHANGELOG](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/CHANGELOG.md), [commit 0ac3a55](https://github.com/striderZA/OpenCodeGameStudios/commit/0ac3a5584bb8b86046d3a040508bf513c93ccf6b)). The SDK's `createAgentSession()` path is explicitly documented as *unevaluated*.
- **Parallel Task protocol** ([`docs/framework/coordination-rules.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/coordination-rules.md)): issue all independent Task calls before awaiting any; collect all before dependent phases; surface BLOCKED immediately; always produce a partial report. "Agent teams" (multiple independent sessions sharing a task list) are documented as **future/unsupported** — "OpenCode does not currently support this pattern."
- **Structured decision capture**: `question` tool (OpenCode) / `ask` (omp) with an "Explain → Capture" pattern — full prose analysis first, then a structured option call; subagents structure text so the orchestrator can re-present options. omp answers are logged to `agent-decisions.jsonl` by `ocgs-question`. A real bug class was found and fixed here: skills that *narrated* the question call instead of making it caused a loop ([#120/#122](https://github.com/striderZA/OpenCodeGameStudios/commit/29b27c2354f413deed235fdd2e974ce7b831197a)); six guided skills now carry an explicit "question-tool discipline" preamble with exact per-harness call shapes (see [team-qa SKILL.md](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents/skills/team-qa/SKILL.md) header).

### 4.4 State

- **"The file is the memory, not the conversation."** [`docs/framework/context-management.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/context-management.md): `production/session-state/active.md` is a living checkpoint (current task, progress checklist, decisions, open questions), updated after each milestone; a `<!-- STATUS -->Epic/Feature/Task<!-- /STATUS -->` block feeds a status-line breadcrumb in Production+ stages.
- **Tiny state files as machine-readable gates**: `production/stage.txt` (current phase), `production/review-mode.txt` (`full|lean|solo`), `production/workflow-mode.txt` (`hybrid|full`).
- **Incremental/skeleton-first writing**: create the file skeleton immediately, draft one section at a time, write on approval — keeps context at ~3–5k tokens for the current section instead of 30–50k.
- **Compaction discipline**: compact proactively at 60–70% context; compaction summary must preserve the state-file reference, modified files, decisions, test results, blockers, current step; post-compaction recovery = re-read `active.md`. The `ccgs-hooks.ts` plugin implements pre/post-compact hooks (`experimental.session.compacting`, `experimental.compaction.autocontinue`) and `ocgs-hooks` archives session context on stop (per CHANGELOG v0.14.0: "Subagent sessions cannot archive the parent `active.md`" — a documented limitation).

### 4.5 Pause / wait / cancel

- **Pause-for-approval is the dominant pattern**: "May I write this to [filepath]?" before every Write/Edit; multi-file changesets need batch approval; no commits without user instruction (AGENTS.md "Collaboration Protocol": Question → Options → Decision → Draft → Approval). Gate skills explicitly state the verdict is advisory and must never hard-block the user.
- **Cancel**: every `question` decision point in team skills includes escape options (e.g., team-qa Phase 2: "Cancel — resolve blockers first"); on smoke-check FAIL the cycle stops and must be re-run.
- **Wait**: [`autopilot-playtest/SKILL.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents/skills/autopilot-playtest/SKILL.md) Phase 1.2 implements a bounded polling wait for MCP tool availability — "make one cheap read-only call… at most 20 such checks," then stop with instructions; Phase 4 polls `wait` until the run returns, forbidding other game tools meanwhile, and honors user steering arriving with later tool results.
- **Error Recovery Protocol** (team skills): surface BLOCKED immediately, assess downstream dependencies, offer skip/retry/stop via `question`, always emit a partial report.

### 4.6 Budgets / time

- **Token/context budgets** (context-management.md): Light ~3k, Medium ~8k, Heavy ~15k tokens startup; subagents used for >5k-token research to keep the main session clean.
- **Agent turn budget**: `maxTurns: 30` on director agents (framework-wide validator requires the field on every agent).
- **Time-boxing**: `/explore` prototypes strictly 1–2 days per idea with explicit **TIMEOUT** verdict ("If it's not testable after 2 days, verdict is TIMEOUT"); hybrid discovery 2–4 weeks max per prototype with "kill cheaply" rule; producer sprint rules: tasks sized 1–3 days, 20% capacity buffer, critical path flagged, milestone risks flagged 2 sprints ahead ([producer.md](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents/agents/producer.md)).
- **Autopilot cost awareness**: "Each run costs model tokens"; "Do not run this on every PR or in CI. Runs take minutes and cost tokens."

### 4.7 Artifact contracts

- **Gate verdict contracts**: directors must emit a verdict token on the *first line* of their response — `[GATE-ID]: APPROVE|CONCERNS|REJECT` (CD), `REALISTIC|CONCERNS|UNREALISTIC` (PR), `READY|CONCERNS|NOT READY` (phase gates) — "Never bury the verdict inside paragraphs — the calling skill reads the first line for the verdict token" (agent files + [`docs/framework/director-gates.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/director-gates.md)).
- **22 named gates** with five fields each (Trigger, Context to pass, Prompt, Verdicts, special handling): CD-PILLARS, CD-GDD-ALIGN, CD-SYSTEMS, CD-NARRATIVE, CD-PLAYTEST, TD-SYSTEM-BOUNDARY, TD-FEASIBILITY, TD-ARCHITECTURE, TD-ADR, TD-ENGINE-RISK, PR-SCOPE, PR-SPRINT, PR-MILESTONE, PR-EPIC, LP-FEASIBILITY, LP-CODE-REVIEW, QL-STORY-READY, QL-TEST-COVERAGE, ND-CONSISTENCY, AD-VISUAL, AD-CONCEPT-VISUAL, AD-ART-BIBLE + four *-PHASE-GATEs. Skills reference gates **by ID only** — prompts live in one shared document to eliminate drift.
- **Escalation/merge semantics for parallel gates**: "Any NOT READY → minimum FAIL; any CONCERNS → minimum CONCERNS; all READY → eligible for PASS" (strictest-verdict wins), plus an artifact-check conjunction.
- **Verdict recording**: outcomes are written into document status headers (`> **[Director] Review ([GATE-ID])**: APPROVED [date] …`) and phase-gate outcomes into `architecture.md` / `session-state/active.md`.
- **36 document templates** in [`docs/framework/templates/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/templates) (GDD, ADR, sprint plan, test plan/evidence, UX spec, art bible, risk register, post-mortem, incident response…).
- **Structured outputs in skills**: e.g., gate-check's fixed report format (Required Artifacts X/Y, Quality Checks, Blockers, Verdict) and its **Chain-of-Verification** step (generate 5 challenge questions designed to disprove the drafted verdict, answer independently, revise, and record `Chain-of-Verification: N questions checked — verdict unchanged|revised`).
- **Workflow-selection scoring contract**: 5 questions × 0–3 points → Hybrid (0–5) / Hybrid-with-upgrade-path (6–10) / Full OCGS (11–15) ([gate-check SKILL.md](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.agents/skills/gate-check/SKILL.md)).

### 4.8 Evaluation

- **Structural CI** ([agent-validation.yml](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/.github/workflows/agent-validation.yml)): `tests/agents/validate.mjs` (frontmatter + required sections + skill→agent and command→skill reference integrity; 209/209 at release), `tests/workflow/run-all.mjs` (4 suites: `gates.mjs`, `invariants.mjs`, `paths.mjs`, `references.mjs`), module validation + installer tests, plugin tests (19 suites / 177 tests), hook tests (13 suites / 54 tests), extension tests (68), omp tests, e2e parity (4).
- **Behavioral eval of skills/agents** — [`skill-testing-framework/`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429/skill-testing-framework): a per-skill and per-agent behavioral spec library + [`quality-rubric.md`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/skill-testing-framework/quality-rubric.md) with binary PASS/WARN/FAIL metrics per category (e.g., **G1–G5** for gates: review-mode read, full/lean/solo director-panel behavior, no auto-advance of `stage.txt`; **T1–T5** for teams: named agents, parallel-where-independent, BLOCKED surfacing, collect-all-before-proceeding, usage-error on missing arg; **AN1–AN4** for analysis: read-only scan, structured findings, no auto-write, no gates during analysis; agent rubrics D/L/S/E/Q/O with verdict-vocabulary and domain-boundary checks). Driven by `/skill-test static|spec|category|audit` and `/skill-improve` (test → diagnose → fix → retest loop), tracked in [`catalog.yaml`](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/skill-testing-framework/catalog.yaml) with `last_*`/`last_*_result` fields per entry (all blank at HEAD — coverage tracking exists but no run results are committed). Fully optional/removable.
- **Human-in-loop evaluation**: playtest gates require ≥3 sessions and "core fantasy delivered" attested by an unprompted playtester; automated (Autopilot) evidence is permanently marked "Automated playtest. Does not count toward human playtest sessions."

### 4.9 Safety

- **Permission deny-list** in `opencode.json`: denies `rm -rf *`, force pushes, `git reset --hard`, `git clean -f`, `sudo`, `chmod 777`, any `*.env*` read/cat/type/redirect; allows read-only git/ls/pytest. (Verified in-repo; the v0.14.0 changelog confirms deny rules take effect under V2, e.g. `git reset --hard HEAD` → Permission denied.)
- **Git hooks**: `.githooks/pre-commit` blocks staged credentials, conflict markers, >20 MB files, broken symlink stubs, and conditionally runs validation suites; `commit-msg` enforces Conventional Commits. Installed via `npm run hooks:install` (`tools/git-hooks/install.mjs`).
- **Path guard**: `ocgs-path-guard` extension injects path-scoped rules; "no unilateral cross-domain changes" is a coordination rule enforced by prompt + drift detection.
- **Privacy**: Autopilot integration mandates sharing OFF (recordings/screenshots/traces/memories are uploaded by default), bring-your-own keys, never paste keys in chat, addon excluded from release presets, MCP server ships `disabled: true` — opt-in only ([autopilot-integration.md](https://github.com/striderZA/OpenCodeGameStudios/blob/85aa449a0cbc2ca44916455185c9d3b4a23a7429/docs/framework/autopilot-integration.md)).
- **Prototype isolation**: `/explore` has `isolation: worktree` frontmatter; explore code must never import from `src/` and must carry an `EXPLORE PROTOTYPE - NOT FOR PRODUCTION` header; productionized ideas are rewritten from scratch.
- **Read-only skill classes**: analysis/review skills are constrained to Read/Glob/Grep during analysis with writes only behind "May I write" (enforced by rubric metrics R1/AN1/AN3).

---

## 5. Implemented vs. documented vs. unsupported

**Implemented (code with tests):**
- 3 OpenCode plugins (`ccgs-hooks.ts`, `drift-detector.ts`, `changelog-generator.ts`) — 177 tests; the 12 original CCGS bash hooks mapped to OpenCode V2 events (full mapping table in README).
- 9 Pi extensions (8 wired for omp); `ocgs-tool-map` verified by runtime probe on omp 18.16.0; Pi runtime explicitly *not* exercised ([commit 0ac3a55](https://github.com/striderZA/OpenCodeGameStudios/commit/0ac3a5584bb8b86046d3a040508bf513c93ccf6b) "Not verified" section).
- Module installer (`install.mjs`) with 5 harness targets, mirrored module trees (`.opencode/modules/` 224 files, `.agents/modules/` 220 files — the drift between them is a *documented known gap*).
- CI validation, git hooks, migration/symlink-repair tools.

**Documented but prompt-layer only:**
- All multi-agent orchestration ("spawn via Task", parallel gates, verdict collection) is prose the model must follow; nothing *enforces* parallel dispatch or first-line verdicts at runtime except the model's instruction-following. The quality rubric tests instructions, not behavior.
- Review modes (`full/lean/solo`) depend on a one-line file the model must remember to read.
- 52-agent hierarchy is consultative theater unless the harness spawns subagents; on Pi there are no subagents at all.

**Unsupported / known gaps (self-reported, creditably):**
- Subagent `model:` frontmatter fails with `ProviderModelNotFoundError` on some models via `task` (README Known Issues — tracked upstream in OpenCode).
- `.opencode/*` symlinks inert on stock Windows (`core.symlinks=false`) — repair tool provided.
- Question-narration loop #120 **fixed but not reproduced** — "the narration loop itself was not reproduced" ([commit 29b27c2](https://github.com/striderZA/OpenCodeGameStudios/commit/29b27c2354f413deed235fdd2e974ce7b831197a)).
- Autopilot: CI replay deferred; cold-start unmeasured; Godot 4.6 untested; interactive answer paths of question tool untested (need TUI run).
- Command expansion unverified headlessly (`opencode run` passes `/cmd` as plain text).
- Two tracked module trees require manual sync; some docs still reference `pi.json` where Pi reads `mcp.json` (documented wrong, deliberately unfixed in that pass).
- `package.json` license field (ISC) contradicts LICENSE (MIT).
- Skill-testing catalog has zero recorded run results (all `last_*` fields empty).
- No game code, no production instance data — the framework is unexercised in-repo (demo is external: OCGS-Pong).

---

## 6. Commit history / release trajectory

Releases v0.1.2 (2026-05-01) → v0.14.1 (2026-11-13), ~6.5 months, 22 tags. Arc: CCGS port fix (v0.2.0) → Godot MCP (v0.3.0) → framework hardening (v0.4–0.5) → Aseprite MCP (v0.6) → modular framework (v0.7) → SFML3/Raylib (v0.8, v0.11) → Unity MCP (v0.9) → **multi-harness `.agents/` migration + 9 Pi extensions** (v0.10.0) → Windows fixes (v0.12.1) → Bevy + OpenCode V2 plugin migration (v0.13.x) → **omp support, git hooks, Autopilot playtesting, model-assignment removal** (v0.14.0) → harness-aware installer for 5 harnesses, Unity CLI, Pi delegation retirement, question-loop fix (v0.14.1). Single author (Jaco du Preez). All PRs show real local test runs with explicit "Not verified" sections — an unusually honest verification culture.

---

## 7. Recommendation: a dedicated game-studio orchestration skill

OCGS's gap is that orchestration is distributed prose: the parallel-gate protocol, verdict merging, BLOCKED recovery, review-mode resolution, and state-file updates are re-implemented by hand in every `team-*` and gate skill. A single dedicated skill — call it **`studio-orchestrate`** — should own the control plane, with domain skills as pure task producers:

**Proposed contract (synthesized from OCGS patterns, generalized):**

1. **Inputs**: a workflow manifest (phases; per-phase agent list with dependency edges; gate IDs; artifact paths), review mode, and a state file path.
2. **Deterministic prelude (not model judgment)**: resolve review mode (`--review` arg → `production/review-mode.txt` → default); read stage file; verify every upstream artifact path exists *and has content*; fail fast with a fix-list before any spawn.
3. **Spawn planner**: build the dependency DAG; issue all independent subagent calls in one turn; never start a dependent phase before all inputs resolve. (OCGS says this in prose; the skill should make the plan *explicit* — print the wave schedule before executing it.)
4. **Verdict protocol**: subagents return `FIRST-LINE: [GATE-ID]: VERDICT` + rationale; orchestrator parses, merges strictest-wins, and records verdicts into artifact status headers and the session-state file — one writer, single source of truth.
5. **Budgets**: per-agent `maxTurns`, per-phase wall-clock/step budget with explicit TIMEOUT verdicts (the `/explore` pattern), context budget per delegation (>5k-token reads go to subagents), and a bounded-retry wait primitive for external tool readiness (the 20-check pattern).
6. **Pause/cancel/resume**: every phase transition is an approval point with Skip/Retry/Narrow/Stop options; any interruption resumes from the state file (checkpoint after each artifact write, not at end); partial reports are mandatory output, never discarded.
7. **Artifact contract**: skeleton-first file creation, per-section "May I write", verdict/status headers updated atomically with the artifact.
8. **Self-verification**: chain-of-verification pass before final verdicts (adopted verbatim as a pattern from gate-check §5a).
9. **Harness portability**: canonical OpenCode vocabulary + a tool-map translation layer, and a "no-subagent fallback" mode (Pi-style) that serializes the DAG into direct work with explicit "delegation unavailable" labeling.

This turns OCGS's nine near-identical `team-*` skills into data (manifests) plus one engine.

## 8. Recommendations for your existing workflows

(Framed as transferable patterns; adapt names to your repos.)

**agent-research-director workflow**
- Adopt the **gate-ID registry**: a single shared document of named review gates (Trigger / Context / Prompt / Verdicts) that research skills reference by ID — kills prompt drift across skills (OCGS director-gates.md).
- Adopt **first-line verdict tokens** with strictest-wins merging for parallel researcher panels (e.g., `FACT-CHECK: PASS|CONCERNS|FAIL`), so the director can parse subagent output mechanically instead of re-reading prose.
- Adopt the **question-tool discipline preamble**: exact per-harness call shapes, same-turn call requirement, no narration/pseudo-code — directly prevents the loop bug OCGS hit (#120).
- Add **chain-of-verification** before final research verdicts (5 self-disproving questions, independently answered, revision recorded).
- Copy the **coverage catalog** idea: `catalog.yaml` with `last_tested`/`last_result` per skill + a binary rubric (PASS/WARN/FAIL) per skill category — gives you an auditable eval trail for research skills.
- Adopt the **"evidence tier" labeling**: OCGS permanently labels automated playtests as non-human evidence; do the same for web-search-derived vs. primary-source-verified claims (this study's "observed vs. inferred" split is the same pattern).

**spatial workflow** (assumed: spatial/3D/asset pipelines)
- Borrow **engine-reference version pinning**: per-engine `VERSION.md` + breaking-changes/deprecated-API docs, and a TD-ENGINE-RISK-style gate that flags post-knowledge-cutoff API use before implementation.
- Borrow the **art-bible/asset-spec artifact chain**: visual-identity anchor → bible (9 sections) → per-asset specs → generation prompts, each behind a named sign-off gate (AD-CONCEPT-VISUAL, AD-ART-BIBLE, AD-VISUAL).
- Use **prototype isolation** (`isolation: worktree`, NOT-FOR-PRODUCTION headers, no imports from production, rewrite-to-productionize) for spatial experiments.

**game workflow**
- Adopt the **phase-gate checklist contract**: explicit required-artifact + quality-check lists per transition, content-verified (not just existence), with MANUAL CHECK NEEDED for unverifiable items — never assume PASS.
- Keep **vertical-slice-as-hard-gate** (any NO ⇒ FAIL regardless of other checks) and the ≥3 human playtest sessions requirement with automated evidence explicitly excluded.
- Use **workflow-mode scoring** (5 questions → hybrid/full) instead of asking users to self-identify process needs.

**reverse-engineering workflow**
- Mirror `/reverse-document` + `docs/examples/reverse-document-workflow-example.md` patterns: derive architecture docs *from code* using the `architecture-doc-from-code.md` and `design-doc-from-implementation.md` templates — skeleton-first, section-by-section approval.
- Adopt **read-only scan discipline** (AN1): analysis phase restricted to Read/Glob/Grep, findings table with severities, all writes gated — essential for RE where the target must not be mutated.
- Add the **bounded-wait primitive** for tool/service readiness (max-N cheap read-only probes, then stop with diagnostics) when driving external decompilers/emulators via MCP.
- For RE legality/safety, replicate the Autopilot privacy pattern: opt-in-disabled integrations by default, explicit "never paste keys", and documented data-sharing posture per tool.

## 9. Study provenance & confidence

- **Coverage**: root listing, README, AGENTS.md, LICENSE, package.json, opencode.json, .gitmodules, CHANGELOG.md; directory listings of `.agents/{agents,skills,commands,rules}`, `.claude`, `.cursor`, `.opencode`, `.pi/extensions`, `.omp`, `.github/workflows`, `tests`, `skill-testing-framework`, `production`, `prototypes`, `docs`, `docs/framework`, `docs/framework/templates`, `docs/examples`, `src`, `tools`; full reads of 2 director agents, gate-check, team-qa, explore, autopilot-playtest skills, director-gates.md, coordination-rules.md, agent-coordination-map.md, context-management.md, hybrid-workflow.md, quality-rubric.md, catalog.yaml, autopilot-integration.md, plugins README, validate.mjs, ocgs-tool-map/index.ts, .omp/config.yml, .pi/settings.json; 22 releases; 10 recent commits.
- **Not read in full**: 50 of 52 agent files (structure inferred from validator requirements + spot checks — medium-high confidence), most of 78 SKILL.md files (patterns inferred from 4 full reads + rubric — medium confidence), plugin/extension bodies other than ocgs-tool-map, `docs/pi-*.md`/`omp-compatibility.md` (key facts came via commits/changelog), engine-reference docs, `design/`, UPGRADING.md, module-validation-output.txt.
- **Confidence**: High on all claims cited to a blob/commit above; medium on generalizations across unopened skill files. No code was executed; all "verified" statements quote the author's own verification notes, which are specific and candid about what was *not* verified.
