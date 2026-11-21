# Research Director Companion (VS Code)

A companion extension for **Research Director Desktop v0.4**. It pairs with the
desktop app over a loopback-only HTTP bridge and gives you:

- **Chat sidebar** — talk to the Director from the activity bar.
- **Ask Director about Selection** — the coding-first workflow: sends *only*
  the active editor selection (plus the language id and a workspace-relative
  file label) to the Director, after an explicit confirmation.
- **Office Projects tree** — real project → room → member hierarchy.
- **Runs tree** — run status, pending approvals, produced artifacts.
- **Run controls** — start / pause / resume / recover / cancel, each with
  explicit confirmation and user-set budgets.
- **Approvals** — approve/reject with the exact `payloadHash` of the reviewed
  payload (hashes are passed verbatim, never recomputed).
- **Artifacts** — open read-only in memory, diff against workspace files
  (`vscode.diff`), apply into the workspace behind a modal confirmation and a
  validated relative-path prompt.

## Install

1. Build or download the `.vsix` (see `releases/`).
2. In VS Code: `Extensions: … → Install from VSIX…` and pick the file.

Requires VS Code ≥ 1.85 (Node 18 extension host; global `fetch`).

## Pairing

1. In the desktop app, open **Settings → Companion** and note the loopback
   host/port and the pairing password.
2. Run **Research Director: Pair with Desktop** from the Command Palette.
3. Enter host (`127.0.0.1`, `localhost`, or `[::1]` only), port (desktop
   default `4319`), and password.
4. The extension performs a `GET /v1/health` check; pairing completes only if
   the desktop answers with the expected auth.

**Research Director: Disconnect** deletes the token and the saved address.

## Security model

- The pairing token is stored **only** in VS Code Secret Storage
  (`context.secrets`). It is never written to `settings.json`,
  `workspaceState`, `globalState`, the webview HTML, or any log/output
  channel. Unit tests statically scan the sources to keep it that way.
- The bridge client talks to **loopback only** (`127.0.0.1` / `localhost` /
  `[::1]`), with Bearer auth, per-request timeouts, sanitized errors (the
  token is redacted from any error text), and capped-backoff polling.
- The chat webview runs under a strict CSP (`default-src 'none'`, nonce +
  extension-local script/style only, no `connect-src`), validates every
  `postMessage` against a schema in the extension host, and renders model
  output with `textContent` only. There is no streaming and no remote code.
- State-changing calls (project create, run start, chat send, approval
  decisions, artifact apply) all require explicit user confirmation; project
  and run payloads include `confirmed: true`.
- Artifact apply is confined to a workspace folder you pick: absolute paths,
  `..`, backslashes and NUL bytes are rejected, overwrites need a second
  modal confirmation, and server-provided paths are never trusted.
- No `child_process`, no terminals, no remote arbitrary execution, stable VS
  Code APIs only.

### Ask Director about Selection — privacy

The only context attached is: the **selected text**, the document's
**language id**, and a **workspace-relative file label**. Absolute paths are
dropped (defense in depth), the whole document is never read, and no other
files are touched (proven by `tests/coding.test.ts` with a counting fake).
With an empty selection you get a plain question input box instead of an
error.

## Limitations

- Routes are reconciled against the actual v4 desktop companion server
  (`desktop-shell src/main/companion.ts`, bridgeVersion 4, default port
  4319): `GET /health`, `GET|POST /v1/projects`, `GET /v1/office`,
  `GET /v1/runs`, `POST /v1/runs/{start,pause,resume,cancel,recover}`,
  `GET /v1/approvals`, `POST /v1/approvals/decide`,
  `GET /v1/artifacts/read`, `GET /v1/events/read`,
  `GET|POST /v1/chat/sessions`, `GET /v1/chat/sessions/:id`,
  `POST /v1/chat/sessions/:id/{send,stop}`. All endpoints are isolated in
  `src/bridge/routes.ts` + `src/bridge/types.ts` if the server evolves.
- The v4 server has **no** `GET /v1/projects/:id` and no run-by-id lookup —
  the extension uses list routes and query params only, as the server does.
- Chat send is fire-and-poll on the desktop: the extension polls
  `getSession` with capped backoff (1s→4s, 10 min cap) and shows only a
  pending indicator — there is intentionally **no fake streaming**. When no
  chat session exists, the extension creates one (it asks for provider,
  model and price rates first).
- No WebSocket: tree status updates come from conservative polling (10s
  while runs are active, 30s otherwise), so very fast state changes may
  appear delayed.
- Artifact apply writes whole files only (no patch/merge).
- Not tested in a live VS Code extension host (no GUI in the build
  environment); validated by typecheck, 82 unit/static tests, esbuild bundle
  and `.vsix` content inspection.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest unit + static-scan tests
npm run build       # esbuild bundle to dist/extension.js
npm run package     # vsce package --no-dependencies → ../releases/
```
