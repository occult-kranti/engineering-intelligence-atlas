# Kimi Research Director handoff

This branch preserves the Research Director platform work **additively** under [`kimi-platform/`](kimi-platform/). It was created from `main` at `bc24dde4ec3032d16e39b7a3b2e1cdf7daf3fafd` so concurrent main-branch work is not overwritten.

Start with [`kimi-platform/README.md`](kimi-platform/README.md) for setup, verification, artifacts, security notes, and deferred work.

## Branch contents

- Full React/Hono/Drizzle web application and migrations (`kimi-platform/app/`)
- Electron desktop shell with Director chat, Office, CEO, Donna, skills, and local providers (`kimi-platform/desktop-shell/`)
- Android shell and synchronized offline atlas (`kimi-platform/android-shell/`)
- VS Code companion source and VSIX (`kimi-platform/vscode-extension/`)
- Local MCP server source and npm tarball (`kimi-platform/mcp-server/`)
- Twenty-one editable skills plus packaged `.skill` files
- Agent charters, research reports, workbooks, fixtures, graphs, and repository-company proposal

## Safety

No uploaded API/GitHub token, `.env`, local credential vault, dependency directory, or build cache is included. The uploaded Claude credential was rejected by Anthropic with HTTP 403 during a read-only validation request and is not used or stored in this branch.

Large binaries are distributed as prerelease assets rather than git files. See the `kimi-research-director-v0.6.0` prerelease when available.
