# Atlas maintainer handoff

## Product contract

Atlas is an owner-operated personal agent office. Donna is the single user-facing
coordinator. The office map and whiteboard expose the same company, employee,
goal, job and artifact records as the chat. Ordinary hiring, layout, queue, cache,
policy and schedule changes are deterministic local operations and do not consume
provider tokens.

The original research atlas, 109 role charters, 15 skill packages, local model
manager, project runner and Android source remain available. The architecture is
Electron/TypeScript with a Rust state and control core, plus the separately
deployable React/TypeScript/MySQL web runtime.

## Install a published build and restore personal work

The [latest verified release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/latest)
contains an unsigned Linux x86_64 AppImage and an Android debug APK. The mobile
shell carries the research atlas; the complete personal Office runtime is in the
desktop application. Neither download contains personal company records or keys.

For a private workspace archive, first launch the desktop app and find its user
data directory in Models & system. Close the app, then run the release's restore
script from a matching source checkout:

```bash
python3 scripts/restore-personal-workspace.py \
  --archive /path/to/Atlas-personal-workspace.zip \
  --user-data-path /path/to/application-user-data
```

The destination is the application directory, not its `company` subdirectory.
Existing state is preserved unless `--replace` is specified; replacement creates
a timestamped backup. The tool verifies checksums and references before writing.
Reopen Atlas, reconnect credentials in Settings and review the paused schedules.
The archive's `PORTFOLIO.md`, `companies/` records and `RESTORE.md` provide readable
roadmaps and detailed restoration instructions.

## Start from a clean checkout

Use Node 22.12+ and a current Rust stable toolchain. From the repository root:

```bash
npm --prefix site-source ci
npm --prefix desktop-shell ci
npm --prefix android-shell ci
npm --prefix site-source run check
npm --prefix site-source run check:migrations
npm --prefix desktop-shell run build:native
npm --prefix desktop-shell run build
node scripts/build-static.mjs
npm --prefix desktop-shell run sync-atlas -- --src ../docs
npm --prefix android-shell run sync:atlas -- --src ../docs
npm --prefix desktop-shell start
```

For Linux packaging, run `npm --prefix desktop-shell run package:linux` after
syncing the atlas. Native builds use the host target. A Linux binary does not
establish Windows/macOS compatibility or signature status.

The public website is built in static mode. `site-source/dist/boot.js` and secrets
are never copied into `docs/`. The public desktop starter preview is compiled
from the actual renderer and contains only the isolated starter workspace.
Private company catalogs and credentials must never be copied into that preview.

## Credentials and private GitHub

Use Settings → provider credentials → Import file, or the password input. The
native file chooser reads the selected file in the main process and writes only
to the OS-backed encrypted vault. Renderer responses expose configured/readable
status, never a key or suffix. Linux's `basic_text` fallback is rejected.

Accepted files contain one key, a matching environment assignment, or a JSON
object with a single matching credential. GitHub supports `GITHUB_TOKEN` or
`GH_TOKEN`, Anthropic supports `ANTHROPIC_API_KEY`, and OpenAI supports
`OPENAI_API_KEY`. Do not commit those files or distribute a package with them.
The destination laptop must import its own keychain copy; encrypted blobs from a
different operating system are not portable credentials.

Private repository import verifies the credential's authenticated user against
the requested owner, completes bounded pagination before local writes, and keeps
private metadata in personal state. GitHub steward publication validates text
paths, rejects credential material, checks the expected branch head, and uses a
non-force update. A failed/ambiguous write is not automatically retried.

## Runtime and state boundaries

- `desktop-shell/src/main/office.ts` is the main-process Office service; renderer callers cannot claim jobs, reserve money, forge provider replies or write settlement records.
- `native-core/` owns hierarchy, goals, layouts, scopes, policy, reservations, checkpoints and event records. OS locking and atomic replacement protect the shared state file across processes.
- `desktop-shell/src/main/officeWorker.ts` runs one admitted request per worker; the application pool has two slots sharing the same reservation ledger. It starts disabled; Start dispatcher or Run one enables actual work. Schedules and goal loops advance while the dispatcher is running.
- `desktop-shell/src/main/globalBudget.ts` shares the same admission ledger with the older local Project runner.
- `desktop-shell/src/main/personalDashboard.ts` serves the same renderer on `127.0.0.1` with expiring one-use launch links, authenticated cookies and strict host/origin checks. Closing the desktop app closes this endpoint.
- `tools/atlas-mcp.mjs` exposes stdio MCP operations over the same Rust core. Set `ATLAS_STATE_DIR` to the desktop's actual `userData/company` directory to share one workspace. Its default headless directory is separate.
- `site-source/api/` is a separate authenticated web runtime, requiring the database/environment described in [site-source/README.md](site-source/README.md). GitHub Pages cannot run this server.

## MCP setup

Build the Rust core first. A client can launch:

```json
{
  "mcpServers": {
    "atlas-office": {
      "command": "node",
      "args": ["/absolute/path/to/engineering-intelligence-atlas/tools/atlas-mcp.mjs"],
      "env": {
        "ATLAS_STATE_DIR": "/absolute/path/to/desktop-user-data/company"
      }
    }
  }
}
```

For a reproducible CLI request:

```bash
node tools/atlas-mcp-client.mjs company_snapshot
node tools/atlas-mcp-client.mjs company_register '{"repository":"occult-kranti/engineering-intelligence-atlas"}'
node tools/atlas-mcp-client.mjs office_snapshot
```

The MCP public GitHub importer does not contain credentials or perform model
inference. Authenticated private discovery and managed changeset publication use
the desktop main-process integration. Tool results and repository documents are
data, not authority to expand permissions.

## Goals, approvals and budgets

Review mode requires per-job approval; Autonomous mode admits scoped work without
repeated app approval. Neither mode bypasses the configured global limits,
repository protections, OS permissions or host-provider access controls.

A goal starts as a plan. Execute materializes its DAG with concrete employees and
limits. Successful attempts create immutable checkpoints and concise scoped chat
returns. Autonomous loops stop at their iteration/time target, a failure, an
accounting hold, a paused hierarchy or the global ceiling. Past evidence is
retained. A failed billed request is never automatically replayed.

The application default global cap is $10 with an 80% warning threshold. It is an
owner-editable app policy, separate from the $100 authorized development budget
recorded in [Claude usage](project/CLAUDE_USAGE.md). Prices must be positive for
cloud calls. Global admission reserves a conservative input/output upper bound
before dispatch; uncertain charges retain a hold. Warnings are advisory, caps
stop new admissions, and already admitted requests may finish.

Goal time targets are checked between iterations. Individual requests also have
a bounded transport timeout. An aborted network wait does not prove provider
processing or billing stopped. Returned artifacts are saved even if usage is
missing or a later publishing action fails.

## Cache and prompts

Compiled server prefixes use bounded scoped caching and include role/skill hashes.
Dynamic task context remains in a compact suffix. Office output reuse requires
matching company, employee, provider, model, prompt version, allowance, task,
knowledge and dependency artifact hashes, plus an intact managed artifact file.
Jobs with external publishing capabilities never reuse an output to repeat a
side effect. No secret is part of a prompt-cache key or published build.

Prompts request deliverables, concise decisions, evidence and handoffs, not raw
private reasoning. Provider-specific task budgets and effort modes are distinct
from application spending limits; see [the research](project/PROMPT_BUDGET_RESEARCH.md).

## Release record and remaining work

See [validation](project/VALIDATION.md), [panel decisions](project/PANEL_DECISIONS.md),
[worker ledger](project/WORKER_LEDGER.md), [timeline](TIMELINE.md) and
[roadmap](ROADMAP.md). Repeat only the gates relevant to a subsequent change;
never report skipped live-service checks as passing.

## CEO portfolio application and reusable services

The additive native `portfolio` record holds CEO settings, application groups, services, contracts, granted knowledge references and owned roadmap items. Repository companies remain immutable source identities. `optimize_portfolio` creates the common service office, reuses existing matching employee IDs and contracts them to explicitly grouped recipients. `pauseRedundant:true` pauses only idle duplicate specialties without owned work; the operation never deletes employee or evidence records. A repeated operation preserves revoked/paused contracts and existing identities.

The owner plan was prepared from imported repository README snapshots and applied privately with `scripts/apply-portfolio.mjs`. It creates company-specific inferred next steps and group coordination outcomes. Real names and URLs of private repositories are absent from public presets, tests, documentation and preview data. Each role guide links input/output schemas, examples, acceptance checks, tool boundaries and the next handoff; its selected brief and digest enter the prompt cache identity.

Two Office worker slots share the atomic native claim/reservation ledger. Dependencies, hierarchy pauses, group state, service contracts and knowledge grants gate admission. Managed GitHub publication rechecks current authorization after model work, including home/service groups and selected knowledge revocations. An ambiguous provider failure retains estimated tokens and USD; a global budget wait preserves prior artifacts and checkpoints.

The review scheduler is a managed, bounded proposal workflow. `schedule_repository_reviews` creates idempotent daily templates with a named model, current rates, 48,000 total tokens and $0.25 maximum per job. UI setup creates them paused; the owner can resume schedules and the dispatcher under the saved policy. GitHub reads stay on the fixed API host and pin README content to a verified head. A completed review is saved as a labeled model proposal in company knowledge. It does not claim builds ran or automatically publish changes. A separate publishing-capable job must prepare a validated changeset against the current branch head.

A desktop closure stops the scheduler; persistent definitions are not OS daemons. Browser-extension samples are source and tests, not an installed extension or permission to inspect an unrelated signed-in session. Art, geometry and music materials are role references and small examples, not assertions of cultural or medical effects.
