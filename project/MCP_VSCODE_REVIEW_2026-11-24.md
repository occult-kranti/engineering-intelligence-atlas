# MCP and VS Code backend integration review

Date: 2026-11-24. Scope: the isolated backend continuation source; no owner production records or provider calls were used by these checks.

## Delivered behavior

The native `update_employee`, `rename_department`, and `rename_office` commands are exposed by the local MCP action schema, the runtime MCP's shared owner-action contract, and the desktop TypeScript action union. Runtime MCP commands retain their stable command receipt ID and expected state hash. The native core remains the authorization and persistence boundary.

The editor now offers **Manage team** plus **Daftar: Manage Team and Departments**. It can add a permanent employee definition; edit its name, role text or repository skill bindings; retire a specialist; add or rename offices; and create, rename, reparent, pause or resume departments. Existing employee/job pause and resume controls remain available. Role text and skill references do not mint permissions or start model processes. Retirement preserves history and is terminal; permanent assistants must be paused instead of fired.

**Review Donna ownership** produces a read-only temporary editor document from a fresh snapshot. Donna is checked as the global coordinator with no company/office/department assignment. Company assistants must belong to their company and have no office/department assignment; office and department assistants must match their exact scope. The report distinguishes record consistency from effective authorization. It counts current direct grants at the displayed scope, with the selected company used for Donna; the native core still evaluates complete grant chains. Company-scoped controls cannot edit global Donna or a foreign-company assistant referenced by a malformed pointer.

## Reliability corrections

- Editor state reads and chat responses are bound to a connection generation and selected company. Stale responses cannot restore a disconnected view, overwrite another company's conversation, or retarget a prepared command.
- Disconnect disables credential restoration before asynchronous SecretStorage deletion. A simultaneous refresh cannot reload the connection while deletion is pending.
- The extension admits one mutation/chat interaction at a time, including while a management picker is open. An ambiguous failure is not automatically retried.
- Unsent briefs persist in bounded local webview state, keyed by connection origin and company. Refresh preserves drafts. A completed send clears only the exact submitted draft; subsequent typing is retained.
- Restored connections are validated before credential dispatch. Unexpected origins, malformed session cookies, unknown connection kinds, and short credentials fail before fetch.
- Interrupted response bodies, invalid JSON shapes, oversized declared bodies and oversized streamed bodies return bounded, actionable errors. Native management failures are shown through the existing credential-redacting error path.
- Empty departments are visible in the Team view so their definitions remain manageable before employees are hired.

## Validation

| Command | Result |
| --- | --- |
| `npm --prefix vscode-extension run check` | Passed syntax checks for shipped runtime and installed-smoke harness |
| `npm --prefix vscode-extension test` | 31 passed; zero failures/skips |
| `node --test tools/atlas-mcp.test.mjs tools/daftar-runtime-mcp.test.mjs` | 51 passed; zero failures/skips |
| `git diff --check` on the owned integration files | Passed |

The editor tests include synthetic host execution, management dispatch, cross-company scope refusal, permanent-assistant retirement refusal, strict parent containment, bad skill paths, Unicode byte limits, ownership corruption, grant dates, delayed replies, concurrent sends, disconnect during a read, SecretStorage deletion races, draft recovery, and interrupted HTTP bodies. MCP tests exercise schema forwarding and preserved native rejection, protocol initialization, bounded metadata/pagination, immutable receipt envelopes, no automatic mutation retry, credential confinement, redirects, and clean stdio operation against a synthetic HTTP runtime.

The native engineer independently reviewed the editor ownership projection and identified a company-assistant/global-Donna mismatch in the first draft. The projection and fixtures were corrected to match the native ownership invariants before this report; regressions now reject substituting Donna or a foreign assistant as a company owner.

## Boundaries of this evidence

These checks do not claim a new installed VSIX release or an owner-device acceptance run. The existing installed-extension CI gate remains necessary for package installation and activation. The tests use synthetic state and host APIs; paid provider execution, live website pairing, and an external MCP client session were not exercised by this subtask. Native lifecycle, concurrency and HTTP integration stress results are recorded separately by the backend and pipeline workstreams.

The shipped extension continues to declare untrusted workspaces unsupported and checks workspace trust before control actions. Device credentials remain in VS Code SecretStorage. No MCP protocol version or external dependency was changed.

## Reference contracts

- [Native ownership and employee-management review](BACKEND_OWNERSHIP_REVIEW_2026-11-24.md)
- [VS Code extension usage](../vscode-extension/README.md)
- [Runtime MCP setup and command boundary](../tools/DAFTAR_RUNTIME_MCP.md)
- [Official VS Code Workspace Trust guidance](https://code.visualstudio.com/api/extension-guides/workspace-trust)
- [Official VS Code extension API](https://code.visualstudio.com/api/references/vscode-api)
- [MCP lifecycle specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
