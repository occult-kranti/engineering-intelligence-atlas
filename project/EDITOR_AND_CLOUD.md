# Editor and cloud workspace handoff

## Purpose and ownership

The installed desktop owns the Rust office state and executes validated commands. The private website stores a sanitized office projection, scoped chat and a durable command queue. VS Code is a thin client of either endpoint. These are views into one company model, not separate sets of employees.

Donna's first Claude-backed roadmap review recommended shared contracts, explicit synchronization, idempotency, adaptive panels and honest execution status. This implementation accepts those recommendations. Supabase remains a documented future persistence adapter; the current deployed website uses Sites identity and D1 so it can be delivered without an unprovisioned database dependency.

## Local editor pairing

The desktop **Pair VS Code** action starts the existing loopback dashboard server and writes a new one-use link to the operating-system clipboard. The token is in the URL fragment, lasts five minutes, and is not returned in renderer status. VS Code exchanges it through `POST /api/session` with the exact loopback Origin and receives the existing 12-hour session cookie. Subsequent calls use `POST /api/call`, the exact Origin and that cookie. The server retains its Host, Origin, JSON and method checks.

The extension stores the connection in VS Code SecretStorage, never in workspace settings, source files, webview HTML or webview messages. Its webview has no network access and can send only the UI actions its extension controller validates. Workspace Trust is required. Connection state is editor-local and **Disconnect editor** removes it without deleting company state.

## Cloud pairing and sign-in

The signed-in website issues a revocable device credential. A pairing object may contain `baseUrl`, `deviceToken`, `siteAccessToken` and `clientId`. The Sites service token clears the platform's private-site API gate; the application device token provides the narrower workspace authorization. These are separate checks.

The desktop binds the pairing to an HTTPS origin, verifies `/api/session`, then encrypts it using Electron safeStorage. Linux `basic_text` storage is rejected. The renderer receives metadata only. A raw device token is accepted when a separate site gate is not needed; otherwise paste the full pairing JSON. Cloud credentials are never provider keys.

**Connect authenticates only. Sync now is the explicit data transfer and command execution action.** Nothing synchronizes on startup, on opening Settings, or on a timer.

For the first sync of a populated cloud workspace, restore the latest private workspace bundle first. A default local office cannot replace the imported portfolio. The initial sanitized snapshot hash must match the server seed, and the cloud enforces a single desktop writer. Revoking/releasing a writer preserves the saved snapshot and does not import running leases into another installation.

## Version 1 wire contract

All requests use JSON, bounded responses, a timeout, and redirects disabled. Cloud request bodies and responses are bounded to 8 MiB plus envelope overhead. A sync processes at most 100 pending commands.

| Endpoint | Contract |
| --- | --- |
| `GET /api/session` | Returns `signedIn`, identity/capability metadata and the budget; no provider credentials |
| `GET /api/workspace` | `{revision, snapshot, updatedAt, clientId or sourceClientId}` |
| `PUT /api/workspace` | `{expectedRevision, snapshot, clientId}`; compare-and-set returns the new `revision` and `updatedAt` or HTTP 409 |
| `POST /api/workspace/claim-writer` | `{expectedRevision,clientId}`; binds the authenticated desktop before command acknowledgements while preserving the content revision |
| `POST /api/commands` | `{expectedRevision, command:{action,payload}}`; records waiting work, not completion |
| `GET /api/commands` | `{commands:[{id,baseRevision,command:{action,payload}}]}` |
| `POST /api/commands/:id/ack` | `{ok,error?,code?}`; `code:"CONFLICT"` retains a typed conflict instead of claiming execution |
| `POST /api/chat` | `{companyId,content,requestId}` or canonical scoped aliases; server returns assistant content, usage and budget |
| `GET /api/chat?scopeKind=…&scopeId=…` | Merged saved native/cloud messages for exactly that scope, deduplicated by stable identity |
| `GET /api/cloud-threads?cursor=…` | Bounded immutable cloud message page, final cursor and optional next cursor |

### Projection and conflict rules

The desktop transfers an explicit allowlist: company hierarchy, employee definitions, jobs, schedules, cache metadata, knowledge summaries, activity, policy/budget summaries, goals/checkpoints, blueprints, portfolio, decision panels, saved `chatThreads` and `authority` with its index and ledger. It removes live lease tokens, worker IDs, local artifact paths and pending reservations. It excludes external attempt records and unknown future top-level fields. Artifact contents and repository file contents are not uploaded by this path. A likely credential found in allowed text blocks the transfer. Structured absolute local evidence references become an explicit omission marker, keeping the cloud fingerprint stable when backup restore changes the artifact directory and filename. Their original local files and references remain in the native workspace.

Cloud-origin messages import once with stable `cloud-<UUID>` identities, original timestamps and source attribution. Supported company, office, department and employee messages are preserved in full within the explicit transport limits; group messages remain online. An explicit sync imports at most 100 messages, saves partial-page progress safely, and reports remaining pages. Native messages and imported cloud replies then merge with server messages without duplication in the website and editor. No provider call occurs during message import.

Commands retain the revision the visitor saw. Before executing the batch, the desktop compares its current canonical projection with that cloud revision. Changed local state produces conflict acknowledgements without applying stale commands. Each admitted command also carries an expected state hash checked by Rust inside the state transaction, closing the race between the desktop client read and native application.

The canonical hash sorts object keys by UTF-8, preserves array order, encodes numbers by their IEEE-754 bytes, and hashes the resulting typed representation with SHA-256. Using the same numeric representation avoids JSON differences such as `0` versus `0.0`. `cloud-native-contract.test.ts` verifies the actual Rust binary against the TypeScript client.

### Durable duplicate protection

`apply_remote_command` accepts `{id,command,expectedStateHash?}`. Rust validates an explicit owner-action allowlist, runs the command on a cloned candidate, validates it, adds a SHA-256 receipt and atomically writes the state. Repeating the same ID and command is a no-op even when the HTTP acknowledgement was lost. Reusing the ID with different content fails. Nested remote commands, worker leases/settlements, arbitrary imports and publishing operations cannot cross this boundary.

Receipts are bounded at 10,000 and never silently evicted. Capacity failure preserves state and requires a reviewed export/archive migration. An acknowledged command is not a claim that an enqueued provider job has finished; its actual job state remains visible separately.

## Operating the editor

Install the release VSIX and use the Daftar activity view. Select the company, then use Donna, Team or Roadmap. Team and job pause/resume actions are scoped to visible records and validated again in the core. A decision-panel request creates a draft with a one-round, $2 ceiling and an explicit per-request token limit. It does not silently start paid panel work.

Cloud Donna replies use the server provider. Local editor briefs save a company conversation; paid goal setup and dispatch remain in the desktop controls. The extension polls visible state every 30 seconds, but never retries a billed chat request. It does not expose filesystem or terminal execution through the webview.

## MCP setup

Use the repository's existing MCP server alongside the editor:

```json
{
  "mcpServers": {
    "atlas": {
      "command": "node",
      "args": ["/absolute/path/engineering-intelligence-atlas/tools/atlas-mcp.mjs"],
      "env": {
        "ATLAS_REPO_ROOT": "/absolute/path/engineering-intelligence-atlas",
        "ATLAS_STATE_DIR": "/absolute/path/to/desktop-user-data/company",
        "ATLAS_CORE_BINARY": "/absolute/path/engineering-intelligence-atlas/desktop-shell/native/atlas-core"
      }
    }
  }
}
```

Use the same company-state directory as the desktop to avoid a separate workspace. This configuration contains paths only. Store provider and GitHub credentials in the desktop vault or server secrets; do not add them to checked-in MCP configuration. The MCP tools expose bounded core operations, not a generic terminal.

## Verification and remaining acceptance

Released source:
[`0b87469`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa),
tagged [v0.5.0](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.5.0).
The latest hosted source `03b9264757c38ae86689cc03f23defed39383498` was deployed
at `2026-11-21T03:00:33.507277Z` (20 November, America/New_York).
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825)
passed all seven gates and release, including packaged desktop operation,
installed editor activation and cloud UI. The release job completed at
`2026-11-21T03:18:11Z`. The release was published at `2026-11-21T03:18:09Z`. The separate
[Pages run](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194823)
also passed. All three downloaded release assets match published digests;
the [release record](release-0.5.0.json) and [validation](VALIDATION.md) retain the
exact hashes and final owner-archive restore/pairing receipt.

The extension's Node tests exercise endpoint validation, exact-Origin desktop pairing, token headers, revision-aware queueing, no optimistic completion, no paid retry, and response-size bounds. Desktop tests exercise encrypted origin-bound credentials, explicit-only transfer, native receipts after a lost acknowledgement, stale local state, seed protection, writer conflicts, disconnection and projection limits. The native integration test executes a real Rust binary and verifies matching canonical hashes and stale-state rejection.

Observed checks include **11 editor client tests**, **28 cloud API/directory tests**,
**3 real native contract tests** and **192 renderer assertions**. The earlier live
deployed API/native protocol imported four cloud messages without duplicate
imports on replay, applied one queued command once, exposed a saved native brief
through hosted chat, and matched the final projection hashes. It made no provider
calls and used test encryption storage rather than the installed OS keychain.
The real export/restore regression also preserves hash equality when artifact
directories and filenames change. See [the exact evidence and dates](VALIDATION.md).

Final recovery passed at `2026-11-21T03:20:41.131Z` using the Rust helper extracted
from the published AppImage and the production `CloudSyncService`. The final
personal archive restored with all included managed artifacts and no embedded
credentials. The restored device claimed the writer and synced to the latest
deployed API; original, restored and cloud projection hashes matched and no
messages were duplicated. No provider calls occurred. The verification device
was revoked and its writer assignment released afterward. This exercised actual
private state and the production API through AES-GCM test storage, separately
from the owner's installed OS keychain.

The first candidate's ambiguous cloud filter labels and invalid default USD
min/step combinations were corrected and verified by the final gates. The cloud
fixture passed 24 checks with 11 screenshots and zero provider calls; production
authentication/persistence were explicitly outside that fixture. Installed VSIX
activation passed six checks with no network requests; packaged desktop smoke
loaded native state and persisted a local goal without changing provider spend.
Production owner browser sign-in remains unverified. A CI editor result does not
establish the owner's editor session or credential store. Marketplace submission,
the owner's laptop keychain and signed cross-platform installers remain separate
delivery work.

## Primary documentation consulted

- [VS Code common capabilities and SecretStorage](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- [VS Code webview isolation and content security policy](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code extension packaging and publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

These sources establish supported platform APIs. Product sequencing and sync policy are implementation decisions, informed by Donna's bounded review and tested against the repository.
