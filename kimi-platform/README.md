# Research Director platform — verified handoff

## Scope and layout

This directory is an additive preservation of the Kimi-led platform work. It does not replace or modify the repository's concurrent main-branch implementation.

| Path | Contents |
|---|---|
| `app/` | React 19, Vite, Hono, tRPC, Drizzle/MySQL web application; Director, Office, CEO, Donna, evaluations, integrations, PWA and public atlas |
| `desktop-shell/` | Electron desktop shell with safeStorage vault, local/Ollama projects, Director chat, hierarchical Office, CEO multi-company programs, Donna operations and GitHub metadata intake |
| `android-shell/` | Capacitor Android shell, Keystore-backed provider credentials, local projects and offline atlas |
| `vscode-extension/` | VS Code companion: pairing, chat, Office/run trees, approvals, selection-based coding, artifact diff and confirmed workspace writes |
| `mcp-server/` | Local stdio MCP server for the authenticated desktop companion; read-only by default with opt-in writes |
| `skills/` | Twenty-one editable skill packages with references, scripts, samples and evaluations |
| `skill-packages/` | Installable `.skill` archives |
| `agent-charters/` | Scientific, architecture/backend, UI/UX, creative and executive digital-employee charters |
| `research/` | Reports, datasets, workbooks, golden fixtures, role/resource matrices and the agent-reference graph |
| `builds/` | Small installable VS Code and MCP packages plus the desktop AppImage checksum |

## Verified release state

- **Web:** TypeScript clean; **340 frontend/data/pure tests passed**; production build passed; full desktop/mobile production browser gate passed with no failed routes or assets.
- **Desktop:** **511 tests passed** across 36 files; main/renderer TypeScript clean; build passed; current AppImage assembled and its AppImage runtime verified.
- **VS Code companion:** **82 tests passed**; VSIX packaged and inspected.
- **MCP server:** **61 tests passed**; npm tarball packaged, fresh-installed and stdio-handshake tested.
- **Android:** **53 tests passed**; offline atlas synchronized. A fresh APK was **not** built because this environment lacks Android SDK/JDK 21.
- **Registry:** 109 standing roles, 436 resources, 1,756 role-resource links, 336 standing-role evaluations plus five candidate-only evaluations, and 21 skill mappings. Final seed replay inserted zero rows on the second run.
- **Reference graph:** 1,165 nodes and 2,614 typed edges, with no dangling references.

Previously completed serial backend gates remain part of the evidence: 16 control-plane concurrency tests, 21 autonomy/office interleaving tests, 13 enterprise database tests and 21 assistant database tests.

## Web application

```bash
cd app
npm ci
cp .env.example .env   # configure your own runtime; never commit it
npm run db:migrate
npx tsx db/seed.ts
npm run check
npm test
npm run build
npm run dev            # platform server on port 3000
```

The Kimi deployment supplies OAuth, MySQL/TiDB and object storage. An exported/self-hosted copy needs its own authentication, database, object storage and provider configuration. Do not put provider keys in browser bundles or source.

Relevant migrations are `0000` through `0006_assistant.sql`. Apply them once with the migration runner; do not blindly replay non-idempotent `ALTER TABLE` statements after bookkeeping loss.

## Desktop

Use Node 22.12 or newer for Electron packaging.

```bash
cd desktop-shell
npm ci
npm run sync-skills
npm run sync-atlas     # expects ../app/dist/public; build app first
npm run typecheck
npm test
npm run build
```

The complete current AppImage is distributed as a prerelease asset named `research-director-desktop-0.6.0-x86_64.AppImage`. It is an **unsigned debug build**: no code signing, notarization, auto-update or store approval. Verify it against `builds/DESKTOP_APPIMAGE_SHA256SUMS.txt`.

Provider keys belong in the desktop safeStorage vault. Ollama remains loopback-only. The uploaded Claude credential is not included and was not accepted by Anthropic during validation (HTTP 403); install a valid key through the vault instead of editing source.

## VS Code companion

```bash
cd vscode-extension
npm ci
npm run build
npm test
npx vsce package --no-dependencies
```

Install `builds/research-director-companion-0.4.0.vsix` through **Install from VSIX**. Pair it with the explicitly enabled desktop loopback companion. The pairing token belongs in VS Code SecretStorage. Artifact writes require a modal, workspace-contained confirmation. A live VS Code extension-host smoke test was not available in this environment.

## MCP server

```bash
cd mcp-server
npm ci
npm run build
npm test
```

The small installable package is `builds/research-director-mcp-0.1.0.tgz`. It requires a local desktop pairing token supplied through the process environment and defaults to read-only tools. Writes require `--enable-writes` and `confirmed:true`; provider-paid chat additionally requires `--enable-provider-writes`.

**Deferred:** full CEO/Donna companion HTTP parity and the final client-compatibility tool rename were paused after the MCP agent exhausted account quota. Existing stable tools and the 61-test package work, but candidate enterprise/Donna routes return an honest `capability_unavailable` until the desktop routes are added. No public unauthenticated MCP endpoint was created.

## Android

```bash
cd android-shell
npm ci
npm run sync:atlas
npm test
```

To rebuild the APK, use Node 22, JDK 21 and Android SDK/platform build tools, then run `npm run build:apk`. The older APK archive elsewhere in the workspace is not represented as this branch's current build.

## Repository-company proposal

`research/engineering-intelligence-atlas-company-proposal.json` is a validated Repository Integration Steward proposal for a dedicated atlas company with backend/database, AI research, cybersecurity and design/UX departments plus named knowledge-transfer ownership. It is a proposal for review, not a claim that a new company was silently applied or that GitHub was modified.

## Important limitations

- Feature work was frozen at the user's request; this handoff prioritizes a workable tested state over further redesign.
- No Rust/Tauri rewrite was performed. `research/runtime_optimization_decision.md` documents why incremental TypeScript optimization is the safer path.
- Provider-backed live generation was not exercised against paid APIs. Live web enterprise pumping remains mock-only; existing plan, credential, pricing and live-run approval gates are unchanged.
- Manual NVDA/VoiceOver verification was not performed; keyboard, contrast and reduced-motion behavior are covered by automated checks and screenshots.
- The current AppImage was runtime-checked; the full packaged desktop was not exercised against a live provider.
- No uploaded Claude token, GitHub token, `.env`, vault, node_modules, local database or build cache belongs in commits.
