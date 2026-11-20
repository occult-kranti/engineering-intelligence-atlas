# Integration Architecture Research — Read-Only Connectors for the Director

**As-of date:** 2026-11-20
**Method:** 6 distinct web research rounds against primary/official vendor documentation (GitHub Docs, Figma Developer Docs & Help Center, Google for Developers, OpenAI Platform Docs, Anthropic/Claude Platform Docs, modelcontextprotocol.io specification), with direct fetch verification of the MCP Security Best Practices document and the Anthropic Admin API reference. Non-official sources are used only where explicitly flagged.

---

## 1. GitHub

### 1.1 Copilot multi-model and third-party agents

- GitHub Copilot is a **multi-model platform**, not a single model. GitHub's official MCP concept documentation confirms MCP works across all major Copilot surfaces (IDE, Copilot CLI, GitHub.com agents): [docs.github.com/en/copilot/concepts/customizations/mcp](https://docs.github.com/en/copilot/concepts/customizations/mcp).
- Model choice is exposed to users through a **model picker** (chat, completions, agentic tasks), with some models marked "premium" and consuming premium requests. Organizations/enterprises control which models are enabled via policy; the **"MCP servers in Copilot" policy is disabled by default** for Copilot Business/Enterprise (same doc above).
- As of 2026, GitHub also offers **third-party coding agents** (Anthropic Claude and OpenAI Codex) in public preview via "Agent HQ," selectable per task from issues/PRs/VS Code for Copilot Pro+/Enterprise subscribers; these consume GitHub Actions minutes. (GitHub Blog/changelog, reported by press; verify current preview status before relying on it.)
- **Architecture implication:** the Director should treat Copilot as a *user-facing* surface governed by GitHub org policy. The Director itself does not need Copilot APIs; it needs GitHub **data** (repos, PRs, issues) via the GitHub REST/GraphQL APIs or the GitHub MCP server.

### 1.2 GitHub MCP server (official)

- GitHub operates an official remote MCP server at `https://api.githubcopilot.com/mcp/` (Streamable HTTP), documented in [github/github-mcp-server — Remote GitHub MCP Server](https://github.com/github/github-mcp-server/blob/main/docs/remote-server.md).
- The remote server exposes **toolsets**, and several are offered in an explicit **read-only variant** ("Read-only Link" / "Install read-only"), e.g. `copilot_spaces` and `github_support_docs_search`. This is the preferred integration shape for a read-only Director.
- Constraints relevant to us (from the docs as summarized by the repository): the Copilot coding agent supports MCP **tools only** (not MCP resources/prompts); remote MCP servers that use OAuth have historically not been supported by the *coding agent* host (bearer token/PAT used instead). This is a host limitation, not a protocol one.

### 1.3 GitHub Apps and fine-grained PATs (read-only scoping)

- **GitHub Apps:** permissions are explicitly fine-grained and selectable at registration — [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app). Key semantics from the official docs:
  - With a **user access token**, the effective permission is the *intersection* of the app's and the user's permissions ("if the app was granted permission to write… but the user can only read… the user access token can only read").
  - With an **installation access token**, only the app's permissions apply — so an App configured with only `Contents: Read`, `Metadata: Read` (Metadata is mandatory), `Issues: Read`, `Pull requests: Read` is genuinely read-only for installations.
- **Fine-grained PATs:** scoped to a resource owner and to *selected repositories*, with per-permission read/write levels — [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens). GitHub recommends fine-grained PATs over classic PATs and instructs choosing "the minimal permissions necessary." Note: **all fine-grained PATs always include read-only access to all public repositories** (official doc).
- The per-endpoint mapping of permission → access level is published in [Permissions required for fine-grained personal access tokens](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens) (e.g., `GET /repos/{owner}/{repo}/pulls/*` requires Pull requests: read; `GET .../issues` requires Issues: read).
- **Caveat (community-reported, not confirmed in official docs):** a GitHub Community discussion ([#180063](https://github.com/orgs/community/discussions/180063)) reports that on **public repositories**, a token with Issues "read-only" can still create issues, because public-repo write capability derives from the repository's publicness, not the token grant. Treat this as unverified-but-plausible; mitigate at our layer (we simply never issue write API calls — see §7).

**Director recommendation:** prefer a **GitHub App** installed per-org/repo with read-only repository permissions (short-lived installation tokens, ~1 hour, auto-expiring) over PATs. PAT fallback: fine-grained PAT, selected repos only, read-only permission set, with a set expiration date.

---

## 2. Figma

### 2.1 REST API credentials and scopes

Official: [Figma — Authentication](https://developers.figma.com/docs/rest-api/authentication/).

- Three credential types:
  - **Personal access token (PAT)** — for individual scripts/tooling against your own account.
  - **OAuth 2.0 app** — when acting on behalf of other users (authorization code flow; authorize at `https://www.figma.com/oauth`, token at `https://api.figma.com/v1/oauth/token`). This is the correct choice for the Director.
  - **Plan access token** — org-level automation (Organization/Enterprise plans only).
- Scopes are granular and read/write-split, e.g. `files:read` (read files), `file_content:read`, `file_variables:read`, `file_dev_resources:read`, `library_analytics:read`, `current_user:read`; write scopes are separate (`file_comments:write`, `file_variables:write`, `webhooks:write`, …). A read-only Director requests **only `*:read` scopes**.

### 2.2 Figma MCP server

Official docs: [developers.figma.com/docs/figma-mcp-server/](https://developers.figma.com/docs/figma-mcp-server/) (remote server installation, tools and prompts, rate limits/access pages).

- **Remote server:** `https://mcp.figma.com/mcp`, **Streamable HTTP**, **OAuth** sign-in; Figma's recommended option. Observed discovery behavior (5 Nov 2026): unauthenticated requests return `401` with `WWW-Authenticate: resource_metadata=https://mcp.figma.com/.well-known/oauth-protected-resource` — i.e., textbook MCP/RFC 9728 discovery, with Figma's authorization server at `api.figma.com`.
- **Desktop server:** served by the Figma desktop app at `http://127.0.0.1:3845/mcp`; bound to loopback; no separate sign-in; cannot write to the canvas (but can write Code Connect mappings).
- **Access control quirk:** only clients listed in **Figma's MCP Catalog** may connect to the remote server; unlisted clients must join a waitlist. A custom Director client would need to be registered/allowlisted by Figma — a real gating factor.
- **No read-only mode:** Figma documents no read-only scope/switch for the MCP server; the OAuth grant acts with the user's file access, and the remote toolset includes write tools (`use_figma` can create/edit/delete). Enforcement of read-only behavior would have to live in *our* connector (never call write tools; see §7), since tool annotations like `readOnlyHint` are hints, not enforcement.
- Rate limits are per plan/seat (e.g., ~20 calls/month on Starter/View-Collab; hundreds/day on paid Full/Dev seats) — design the Director to cache aggressively.

### 2.3 Which AI choices are internal vs. user-selectable (Figma)

Official: [Figma — Building Figma AI](https://www.figma.com/ai/our-approach/) and [Help Center — Select an AI model to use in Figma Make](https://help.figma.com/hc/en-us/articles/36400680326551-Select-an-AI-model-to-use-in-Figma-Make).

- **User-selectable:** Figma Make exposes a **model selector** in the chat; documented options include models from OpenAI, Anthropic (Claude), and Google (Gemini), alongside a Figma-chosen default; switchable mid-conversation; not available in Figma for Government.
- **Internal (not user-selectable):** Figma AI overall "is powered by a mix of third-party models and first-party models" and, per Figma, "Other capabilities, like the Figma agent, **automatically select the best model for the task at hand**." The default Make model also changes at Figma's discretion.
- **Admin controls:** AI features on/off per team/org, and a separate **content-training** toggle (default **on** for Starter/Professional; default **off** for Organization/Enterprise; never used for K-12 Education or Government). [Manage AI settings and content training](https://help.figma.com/hc/en-us/articles/17725942479127-Manage-AI-settings-and-content-training-for-your-team-or-organization).

---

## 3. Google Drive

### 3.1 OAuth scopes (least privilege)

Official references: [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) and [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes). (Direct fetch of these pages was blocked in this environment; scope semantics below match the official scope list as corroborated across Google's developer documentation and consent-screen configuration flows.)

| Scope | Access | Sensitivity tier |
|---|---|---|
| `.../auth/drive.metadata.readonly` | File metadata only | Non-restricted (sensitive) |
| `.../auth/drive.readonly` | Read/download **all** Drive files | **Restricted** |
| `.../auth/drive.file` | Only files the app created or the user opened with it (per-file, via Picker) | Non-restricted (recommended default) |
| `.../auth/drive` | Full read/write of everything | **Restricted** — never request for a read-only connector |

**Director recommendation:** request `drive.file` if per-file selection (Google Picker) is acceptable UX; otherwise `drive.readonly`. Never request `drive`.

### 3.2 Limited Use policy and verification

Official: [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).

- Apps requesting **restricted scopes** (incl. `drive.readonly`) must pass Google's OAuth **verification**, and must comply with **Limited Use**: no transferring Google user data for advertising, no human reading of data except narrow cases (security, consent, legal), etc.
- If the app **stores or transmits** restricted-scope data on servers, a **security assessment (CASA)** is required, with **re-verification at least every 12 months**. A purely client-side (desktop/mobile) Director that never sends Drive content to its own servers has a materially lighter compliance burden — a concrete argument for the local-first architecture in §7.
- Refresh tokens: request `access_type=offline` (+ `prompt=consent` when re-issuing); access tokens expire (~1 hour); handle `invalid_grant` (revocation/expiry) by prompting re-auth. Users can revoke at any time via their Google Account permissions page.

---

## 4. OpenAI

Official: [OpenAI API — Production best practices](https://developers.openai.com/api/docs/guides/production-best-practices) and the [API keys page](https://platform.openai.com/api-keys).

- **Auth:** bearer API key in `Authorization: Bearer <key>`; base URL `https://api.openai.com/v1`. Keys can be **project-scoped**; OpenAI recommends **project service accounts** for application identity rather than personal keys.
- **Key hygiene (official guidance):** never hard-code or commit keys; expose via environment variables or a secret-management service; **set an expiration date on project API keys and rotate**; admins can enforce a **maximum key lifetime** at org/project level.
- **Model discovery:** `GET /v1/models` lists models visible to the key — the Director can use this as a **credential-validation + capability-discovery** call on setup (a 401 means bad key; the model list confirms what the key can use).
- **Security properties for the Director:** the OpenAI API is *purely outbound inference* — there is no read/write surface into user data beyond what we send in prompts. Risk control = minimize what content is sent, and treat the key as the only sensitive artifact.

---

## 5. Anthropic / Claude

Official: [Claude API docs](https://platform.claude.com/docs) (authentication) and the verified [Admin API — List API Keys](https://platform.claude.com/docs/en/api/admin-api/apikeys/list-api-keys).

- **Auth:** `x-api-key: <key>` header plus a required `anthropic-version` header, against `https://api.anthropic.com`. Keys are created in the Console and are **scoped to a Workspace**. `Authorization: Bearer` is also accepted by the API/SDK for OAuth-style tokens.
- **Key management:** keys carry `status` (active/archived/expired/inactive), optional `expires_at`, a `partial_key_hint` for identification, and a principal (user or service account). The **Admin API** (`GET /v1/organizations/api_keys`, verified directly) lets org admins inventory and audit keys — useful for the Director's audit story.
- **Model discovery:** `GET /v1/models` returns available models (`data[]` of `{id, display_name, type: "model"}`) — same validation/discovery pattern as OpenAI.
- **Consumer vs API:** Claude Pro/Max subscription OAuth tokens are **not** licensed as general API credentials; the Director should use proper Console API keys (or enterprise Bedrock/Vertex routing if the customer requires data-residency).

---

## 6. Remote MCP: authorization, discovery, and tool poisoning

Primary: [MCP Authorization spec (revision 2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) and [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) (fetched and verified directly).

### 6.1 Authorization & discovery (current spec)

- Authorization is **OPTIONAL** in the spec, but for HTTP transports the following apply:
  - The MCP server is an **OAuth 2.1 resource server** and **MUST** implement **RFC 9728 Protected Resource Metadata** (`/.well-known/oauth-protected-resource`) and signal it via `401 + WWW-Authenticate: resource_metadata=...`.
  - Clients **MUST** use PRM for authorization-server discovery; the AS must offer **RFC 8414** or **OIDC Discovery** metadata.
  - **PKCE** is mandatory; **RFC 8707 Resource Indicators** bind tokens to a specific server (`resource` parameter); servers **MUST** validate audience and **MUST NOT accept or transit tokens not issued for them** (token passthrough is explicitly forbidden).
  - **Dynamic Client Registration (RFC 7591) is deprecated** (still MAY); the preferred zero-relationship mechanism is **Client ID Metadata Documents** (CIMD, client IDs as HTTPS URLs).
  - The current revision is **stateless** (no `initialize` handshake / session IDs as of 2026-07-28); legacy HTTP+SSE transport is deprecated in favor of Streamable HTTP.
- STDIO transports **SHOULD NOT** use OAuth; they read credentials from the environment.

### 6.2 Threats the spec documents (and what they mean for us)

- **Confused deputy** (proxy servers with static client IDs + consent-cookie skip): mitigations require per-client consent, exact `redirect_uri` matching, single-use short-lived `state`, `__Host-` cookies.
- **Token passthrough:** forbidden; audience validation mandatory.
- **SSRF during OAuth discovery**: clients fetch `resource_metadata`, `authorization_servers`, and AS metadata URLs that a **malicious MCP server controls**. Spec-mandated mitigations (directly verified text): require HTTPS (loopback excepted); **block private/reserved IP ranges** — `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, loopback, link-local `169.254.0.0/16` (cloud metadata!), `fc00::/7`, `fe80::/10`; validate redirect targets hop-by-hop; beware DNS-rebinding TOCTOU; consider egress proxies (e.g., Smokescreen).
- **Authorization URL validation**: clients MUST only open `https:` URLs (loopback `http:` in dev), MUST reject `javascript:`/`data:`/`file:` schemes, and MUST NOT open URLs via shell commands (RCE vector).
- **Tool poisoning / untrusted metadata:** the Tools spec states clients must treat **tool descriptions and annotations as untrusted** unless the server is trusted — a malicious server can hide instructions in tool descriptions that steer the model (first publicly demonstrated by Invariant Labs, 2025). Defense: connect only to reviewed/allowlisted servers, pin versions, hash/pin tool schemas, and put a human approval gate in front of anything consequential.
- **Local server compromise:** local (STDIO) servers are arbitrary binaries running with user privileges; spec requires consent dialogs and recommends sandboxing. **This is the spec-level justification for our "no STDIO" rule.**

---

## 7. Concrete read-only connector architecture for the Director

### 7.1 Topology

```
┌──────────────────────────── Director client (desktop Electron / Android) ───────────────────────────┐
│  UI ──► Connector Core ──► Provider Adapters (GitHub | Figma | Drive)   LLM Adapters (OpenAI|Claude) │
│              │                                                                                     │
│        Encrypted Token Vault (safeStorage / Keystore)        Egress Firewall (SSRF guard, HTTPS)   │
│              │                                                                                     │
│        Audit Log (append-only, local) ◄── Approval Gate UI ◄── Policy Engine (read-only allowlist) │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
         HTTPS only, allowlisted hosts: api.github.com, api.figma.com/mcp.figma.com,
         www.googleapis.com/oauth2.googleapis.com, api.openai.com, api.anthropic.com
```

**Hard rules:**
1. **Remote-only MCP.** The Director speaks MCP exclusively over **Streamable HTTP to first-party hosted endpoints** (GitHub `api.githubcopilot.com/mcp/`, Figma `mcp.figma.com/mcp`). **No STDIO, no `npx`/`uvx` server installation, no tool execution of any kind** — the Director never spawns a process, never opens a socket it didn't allowlist, and never invokes MCP tools that mutate state (§7.4).
2. **Read-only at three independent layers** (defense in depth, because no provider gives us perfect enforcement):
   - *Credential layer:* read-only scopes/permissions only (GitHub App read permissions; Figma `*:read` OAuth scopes; Drive `drive.readonly`/`drive.file`; MCP read-only toolsets where offered).
   - *Client layer:* the adapter code contains **no write endpoints at all** — only `GET` for REST, and an allowlist of read-only MCP tool names (e.g., `get_design_context`, `get_screenshot`, `get_metadata`, `get_variable_defs`; explicitly excluding Figma's `use_figma` and all `create/update/delete/upload` tools). HTTP method allowlist enforced in the egress layer too.
   - *Tool layer:* never invoke a tool whose annotation lacks `readOnlyHint: true`, while treating annotations as untrusted hints only (spec) — the name allowlist is the enforcement.
3. **Model discovery over hardcoding.** On key setup, validate via `GET /v1/models` (OpenAI) and `GET /v1/models` (Anthropic); cache the catalog with a TTL; never ship a hardcoded model list as truth.

### 7.2 Encrypted token vault

- **Desktop (Electron):** store tokens only after encryption with [`safeStorage.encryptString()`](https://www.electronjs.org/docs/latest/api/safe-storage) in the **main process**; persist ciphertext under `userData`. Guardrails: check `safeStorage.isEncryptionAvailable()`; on Linux, check the backend — if it falls back to `basic_text` (no OS keyring), **fail closed** and require an OS keyring rather than storing plaintext. Never expose decrypted tokens to the renderer except via a narrow IPC that returns "token present/valid" or performs the request main-side.
- **Android:** generate an AES-GCM key inside the [**Android Keystore**](https://developer.android.com/privacy-and-security/keystore) (`KeyGenParameterSpec`, `setIsStrongBoxBacked(true)` where available) so key material never enters the app process; encrypt tokens with it; require user authentication (`setUserAuthenticationRequired(true)`) for decrypt on sensitive operations.
- **Alternative (both platforms):** OAuth **refresh tokens only at rest**, access tokens kept in memory; or delegate storage to the OS credential manager via well-reviewed libraries. For enterprise deployments, optionally broker tokens through a company secret manager instead of device storage — but note the Drive CASA implications if file *content* (not just tokens) transits a server (§3.2).
- Never log tokens; scrub them from crash reports; redact `Authorization`/`x-api-key` headers in any diagnostic capture.

### 7.3 SSRF and egress protections (implementing the MCP spec's MUSTs/SHOULDs)

- Static **host allowlist** for all provider traffic; URL parsing with a vetted library (no hand-rolled IP checks — the spec warns encoding tricks defeat custom parsers).
- For **any URL discovered from an MCP server** (PRM `resource_metadata`, `authorization_servers`, AS metadata endpoints): require HTTPS; resolve DNS and **reject private/loopback/link-local ranges** (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `::1`, `169.254/16` — cloud metadata — `fc00::/7`, `fe80::/10`); pin the resolved IP between check and connect (DNS-rebinding TOCTOU); **validate every redirect hop**, don't auto-follow.
- OAuth authorization URLs: open via the platform browser API only (never `shell.openExternal` on unvalidated strings, never through a shell); scheme allowlist `https:` (+`http:` loopback in dev builds only); reject `javascript:`, `data:`, `file:`, `vbscript:`.
- Exact-match `redirect_uri` registration; cryptographically random, single-use, ≤10-minute `state`; full PKCE (S256) everywhere.

### 7.4 Approval gates

- **First connect:** explicit consent screen per provider showing exactly which scopes/permissions will be requested (mirroring the spec's consent-UI requirements: client identity, scope list, redirect URI; CSRF/`state`; no iframing).
- **Token elevation:** any future scope expansion is a new, separate consent — never bundle (scope-minimization principle from the spec).
- **MCP tool invocation:** even within the read-only allowlist, show the tool name + arguments on first use per session per server; require re-approval if the server's tool list or descriptions change between sessions (hash-pin tool schemas; this is the practical defense against **tool poisoning / rug pulls**).
- Any unrecognized provider response shape → fail closed, log, alert the user.

### 7.5 Token expiry and lifecycle

- GitHub: App **installation tokens expire in 1 hour** (refresh via app JWT); fine-grained PATs created **with an expiration date**; track `expires_at` and warn at T-7 days.
- Google: access tokens ~1 hour; refresh via stored refresh token; on `invalid_grant`, mark connection "needs re-auth" (never silently retry-loop).
- OpenAI: create project keys with expiration dates per OpenAI's own guidance; support org-enforced max lifetime.
- Anthropic: honor key `expires_at`/status visible via Console/Admin API.
- Revocation: one-tap disconnect that (a) deletes ciphertext locally, (b) calls the provider's token-revocation endpoint where available, (c) instructs the user where to verify revocation provider-side (GitHub App installations page, Google Account permissions, Figma connected apps, provider consoles).

### 7.6 Audit

- **Append-only local audit log** (hash-chained) recording: timestamp, provider, operation class (connect | read | token-refresh | revoke), endpoint/tool name (never arguments containing content, never tokens), result status, and approval-gate decisions.
- Weekly self-check job: re-run `GET /v1/models`-style validation, verify each stored credential still matches its recorded scope set, and flag drift (e.g., user broadened scopes provider-side).
- Export format for enterprise review; retention configurable; log itself contains no secrets or file contents.

---

## 8. Caveats and open items

1. **Fast-moving surface.** Copilot model lineups, Figma Make's model list, MCP spec revisions (latest checked: **2026-07-28**, stateless; DCR deprecated in favor of CIMD), and third-party-agent previews all change on monthly cadences. Every claim above is "as of 2026-11-20"; re-verify against the linked official docs before implementation freeze.
2. **Figma MCP Catalog gating.** Only Figma-catalog-listed clients can connect to `mcp.figma.com/mcp`; a bespoke Director client needs Figma's approval/waitlist. Fallback: Figma REST API with `*:read` OAuth scopes (covers the majority of read use cases, no Code Connect/canvas features).
3. **Figma MCP has no read-only mode.** Read-only must be enforced in our client (tool-name allowlist); the desktop MCP server (`127.0.0.1:3845`) is canvas-read-only but requires the desktop app and violates nothing else here.
4. **GitHub public-repo write caveat** (community discussion #180063, *not* officially confirmed): read-only-scoped tokens may still be able to write on public repos. Our client-layer "no write calls exist in code" rule makes this moot, but it argues for GitHub Apps (installation tokens) over PATs.
5. **Google verification cost.** `drive.readonly` is a restricted scope → OAuth verification + Limited Use policy + potential CASA assessment if data transits our servers. Local-first design (no Director backend touching file content) is strongly advised.
6. **Search-derived vendor facts.** Statements sourced from search snippets of official pages (Google scopes page could not be fetched directly in this environment — "audit rejected") are corroborated but not line-verified; the MCP Security Best Practices and Anthropic Admin API pages **were** fetched and verified directly.
7. No proprietary/internal (non-public) information was used anywhere in this document.
