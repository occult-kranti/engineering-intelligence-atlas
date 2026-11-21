# research-director-mcp

Stdio [MCP](https://modelcontextprotocol.io) server that lets an MCP client
(e.g. **Claude Desktop**) inspect and — with explicit opt-in — control a locally
running **Research Director desktop app** through its loopback companion bridge.

- **Read-only by default.** Writes are disabled unless the server is started
  with `--enable-writes`, and every write call still requires `confirmed: true`
  in the tool input. Provider-paid chat sends require a second flag,
  `--enable-provider-writes`.
- **Loopback only.** The server refuses any companion URL that is not
  `http://127.0.0.1`, `http://localhost`, or `http://[::1]`. There is no public
  endpoint, no remote mode, no CORS surface — the MCP server only ever talks to
  a companion bound on the same machine.
- **No provider credentials here.** This server never sees, stores, or forwards
  an Anthropic/OpenAI/… API key. The desktop owns provider credentials; the MCP
  client (e.g. Claude Desktop) owns its own provider account. (A previously
  proposed "upload your Anthropic token" flow was **rejected** and is not part
  of this package.)
- **No execution.** The package contains no `child_process`, no shell, no eval,
  no file writes, no GitHub/clone operations. Assistant ("Donna") tools create
  *typed, validated proposals* only — they can never execute anything.
- **Never fake data.** Tools that depend on desktop routes your build does not
  ship (enterprise/CEO office, Donna assistant, repository/EIA) return an
  explicit `capability_unavailable` error instead of inventing data.

Requires **Node.js 20+**.

## Architecture

```
┌────────────────┐   stdio (MCP)   ┌────────────────────────┐   HTTP (loopback only)   ┌──────────────────────┐
│ Claude Desktop │ ◄─────────────► │ research-director-mcp  │ ◄──────────────────────► │ Research Director    │
│ (or other MCP  │                 │  · zod-validated tools │   Bearer pairing token   │ desktop companion    │
│  client)       │                 │  · caps + sanitization │   http://127.0.0.1:4319  │ (bridgeVersion 4)    │
└────────────────┘                 │  · write gates         │                          └──────────────────────┘
                                   └────────────────────────┘                                     │
        owns its own provider credentials                                  owns provider credentials, stores,
        (e.g. its Anthropic account)                                       runs, artifacts, encrypted token
```

Source layout:

| Path | Role |
| --- | --- |
| `src/index.ts` | Stdio entrypoint; parses flags/env once; stderr-only logging |
| `src/config.ts` | CLI flags, env vars, strict loopback URL validation (SSRF guard) |
| `src/client/routes.ts` | **Isolated route map** — the only module that knows desktop HTTP paths. STABLE (shipped in bridgeVersion 4) vs CANDIDATE (additive enterprise/assistant routes, pending desktop support) |
| `src/client/http.ts` | Loopback HTTP client: bearer auth, timeouts, streamed body cap, sanitized errors, 404-sentinel → `capability_unavailable` |
| `src/sanitize.ts` | Output caps, secret scrubbing, sensitive-key/CoT stripping |
| `src/tools/read.ts` | Read-only tools (always on) |
| `src/tools/write.ts` | Gated writes + provider-paid chat send |
| `src/tools/assistant.ts` | Enterprise / Donna / repository (EIA) tools via CANDIDATE routes |

The route map is deliberately isolated so that when the desktop adds
enterprise/assistant routes, reconciliation is an additive change in **one**
file (`src/client/routes.ts`), moving entries from `CANDIDATE_ROUTES` to
`STABLE_ROUTES`. Desktop, web, and VS Code codebases are **not** modified by
this package.

## Pairing (local setup)

1. Open the Research Director desktop app → Settings → Companion bridge →
   **Enable**. The app shows a high-entropy pairing token **once** (it stores
   only an OS-encrypted blob) and listens on `http://127.0.0.1:4319`.
2. Copy the token and provide it to this server via the environment variable
   `RESEARCH_DIRECTOR_PAIRING_TOKEN` (see below). The token is read from the
   environment **at startup only** — never from a file shipped with this
   package, never logged, never exposed in tool output (outputs are scrubbed
   against the exact token value plus common secret formats).
3. Optional: `RESEARCH_DIRECTOR_COMPANION_URL` overrides the base URL but must
   remain strict loopback http (default `http://127.0.0.1:4319`).

## Claude Desktop configuration (stdio)

Edit `claude_desktop_config.json` (see `examples/claude_desktop_config.json`):

```jsonc
{
  "mcpServers": {
    "research-director": {
      "command": "npx",
      "args": ["-y", "research-director-mcp@0.1.0"],
      "env": {
        "RESEARCH_DIRECTOR_PAIRING_TOKEN": "<PASTE_PAIRING_TOKEN_HERE>"
      }
    }
  }
}
```

With writes enabled (only if you want them):

```jsonc
"args": ["-y", "research-director-mcp@0.1.0", "--enable-writes"]
```

With provider-paid chat sends (requires both flags):

```jsonc
"args": ["-y", "research-director-mcp@0.1.0", "--enable-writes", "--enable-provider-writes"]
```

> The example file contains placeholders only. Never commit a real token.

### Handling the token securely

`env` blocks in client config files are plaintext on disk. Prefer:

- **macOS**: store the token in Keychain (`security add-generic-password`) and
  launch via a small wrapper that exports it (`security find-generic-password -w`).
- **Linux**: `secret-tool store` / systemd user `EnvironmentFile` with `0600`
  perms, or your desktop's secret-service-backed credential manager.
- **Windows**: DPAPI-backed store (e.g. Windows Credential Manager) with a
  wrapper that exports the variable.
- Rotate the token from the desktop app ("regenerate") if it may have leaked;
  the old token stops working immediately.
- Never paste the token into chat, tool arguments, screenshots, or logs.

## VS Code alternative

If you use VS Code, the companion extension (`vscode-extension` in this
workspace) talks to the same desktop companion directly and does not need this
MCP server. Both clients can coexist; they share the same pairing model.

## Tools

### Read-only (always available)

| Tool | Description |
| --- | --- |
| `health` | Companion liveness + bridge version |
| `list_projects` | All projects (metadata) |
| `get_office` | Office/org snapshot for a project (optionally per run) |
| `list_runs` | Runs with status/usage, optional project filter |
| `read_artifact` | Bounded artifact text (default 8 000 chars, hard cap 32 768) + metadata |
| `read_events` | Keyset-paged run events (`afterIndex`/`nextIndex`, ≤ 200/page) |
| `list_chat_sessions` | Chat session metadata |
| `get_chat` | Bounded chat view (most recent N messages, per-message cap) |
| `list_approvals` | Pending/decided approvals |

### Writes (`--enable-writes` **and** `confirmed: true`)

| Tool | Notes |
| --- | --- |
| `create_project` | Forwards `confirmed:true` to the desktop as well |
| `start_mock_run` | Start a run (use the desktop mock provider for no-cost runs) |
| `pause_run` / `resume_run` / `cancel_run` / `recover_run` | Run lifecycle |
| `decide_approval` | Requires `payloadHash` binding the decision to the exact reviewed payload |

### Provider-paid (also requires `--enable-provider-writes`)

| Tool | Notes |
| --- | --- |
| `send_chat_message` | Double-gated; can incur provider spend. Desktop owns the credentials |

### Enterprise / Donna / repository (capability-dependent)

| Tool | Notes |
| --- | --- |
| `enterprise.get_snapshot`, `enterprise.list_ledger` | CEO-office reads; `capability_unavailable` until the desktop ships the routes |
| `donna.list_proposals`, `donna.list_schedules` | Assistant reads |
| `donna.propose_action`, `donna.queue_proposal`, `donna.schedule` | Typed **proposals only** (write-gated); never executed by this server |
| `repository.preview_assignment` | Read-only assignment preview |
| `repository.propose_assignment` | Proposal only (write-gated) |
| `propose_repository_company` | Validated EIA company proposal; when the desktop route is unavailable it returns `applied: false` with the validated payload and never claims it was created |

## Safety model

- **Auth**: every companion request carries `Authorization: Bearer <token>`;
  the token comes from `RESEARCH_DIRECTOR_PAIRING_TOKEN` at process start and
  is never written to disk, logs, or tool results by this server.
- **SSRF guard**: the companion URL is validated at startup; only loopback
  hosts, `http:` only, no credentials/path/query. Redirects are refused.
- **Caps**: per-request timeout (8 s), streamed response cap (1 MiB), tool
  output cap (32 000 chars), per-tool input caps (artifact text, event pages,
  chat windows).
- **Sanitization**: tool outputs are scrubbed for the exact pairing token and
  common secret formats (`sk-*`, `sk-ant-*`, GitHub/Slack/Google key shapes,
  Bearer values, private keys); sensitive object keys
  (`token`/`secret`/`apiKey`/`password`/`authorization`/…) and chain-of-thought
  fields (`reasoning`, `chain_of_thought`, …) are stripped recursively.
- **Error hygiene**: upstream errors are mapped to typed codes
  (`auth_not_configured`, `auth_failed`, `capability_unavailable`,
  `companion_unreachable`, `companion_error`, `not_found`,
  `writes_disabled`, `provider_writes_disabled`, `confirmation_required`,
  `validation_failed`) with messages that never include secrets, headers, or
  raw upstream bodies.
- **No execution surface**: no child processes, shell, eval/VM, file writes,
  git/GitHub operations anywhere in the package (enforced by tests).

## Limitations

- **Local MCP only**: this is a stdio server for a same-machine client. It is
  **not** a public or unauthenticated endpoint and must not be exposed as one.
- Requires the desktop app running with the companion bridge enabled.
- Enterprise/CEO-office, Donna assistant, and repository/EIA tools depend on
  desktop companion routes that current builds (bridgeVersion 4) do not ship;
  they return `capability_unavailable` until the desktop adds them (see
  `src/client/routes.ts` CANDIDATE section).
- This server cannot and does not use an Anthropic (or any provider) key; the
  rejected "upload your provider token" design is intentionally not bundled.
- Tool outputs are capped/summarized by design; large artifacts/events must be
  paged through `read_artifact`/`read_events`.

## Development

```bash
npm install
npm run typecheck
npm test          # Vitest, incl. SDK in-memory client tests
npm run build     # tsc -> dist/
npm pack          # produces research-director-mcp-0.1.0.tgz
```

Tests cover: read tools end-to-end via the SDK in-memory transport against a
mock companion, auth failures and token non-leakage, loopback/SSRF rejection,
output caps, write flag + confirmation + payloadHash gating, the provider
double gate, `capability_unavailable` behavior, and the absence of
`child_process`/exec primitives.

## License

MIT — see `LICENSE`.
