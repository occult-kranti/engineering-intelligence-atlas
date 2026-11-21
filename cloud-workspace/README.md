# Daftar private cloud office · 0.8.0 source candidate

Daftar is the renamed personal command office built in the existing Engineering Intelligence Atlas repository. This directory contains its owner-private website: the shared desktop renderer, ChatGPT sign-in, D1 persistence, Donna chat, device pairing and a durable relay for native commands. Existing Atlas package IDs, API paths and URLs remain compatible.

- [Private Daftar website](https://atlas-command-office.whatswrong-inc.chatgpt.site)
- [Private application directory](https://atlas-command-office.whatswrong-inc.chatgpt.site/applications)
- [Public atlas and read-only example](https://occult-kranti.github.io/engineering-intelligence-atlas/)
- [Executed release validation](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/main/project/VALIDATION.md)
- [Desktop and editor setup](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/main/project/EDITOR_AND_CLOUD.md)

## Continuous canvas entry

The owner website now opens the shared continuous canvas. Top-level `/`, `/access` and `/applications` probe the existing session and redirect only a signed-in owner with the required owner capability. The access/application routes select their corresponding canvas surface; company and supported workspace deep links are preserved. Signed-out or failed session checks retain the original usable entry content.

The parent renderer hosts the existing forms in same-origin elements using `?canvas=1`. Embedded routes omit the full site header/hero, retain semantic forms and drafts, and never start another owner redirect. Known authentication links escape the frame only through user navigation. `/visit` and `/join` remain valid independent entry routes with their existing restricted projections and invitation-fragment consumption; they are not redirected into the owner workspace.

The wrapper does not change API authorization, create grants, modify the Site audience or add a postMessage bridge. [The 0.8.0 candidate record](../project/ENDLESS_CANVAS_VALIDATION.md) tracks source checks separately from publication and hosted acceptance; the earlier deployment receipt does not certify this candidate.

## One workspace, explicit responsibilities

| Surface | Responsibility |
| --- | --- |
| Desktop and Rust core | Authoritative office state, bounded worker admission, validated commands, local artifacts, repository operations and durable receipts |
| Private website | Saved projection, cloud messages, owner access, device credentials, command queue and cloud request accounting |
| VS Code extension | Thin client of the paired desktop or website; credentials in SecretStorage |
| Public GitHub Pages | Static research atlas and synthetic read-only preview; no personal state or API credentials |

The shared renderer has one scoped Donna composer. Hosted chat returns server-provider text. Desktop chat can save local plans and create bounded goals through the existing worker controls. On explicit sync, cloud-origin company, office, department and employee messages enter their corresponding native thread. Saved native conversations are uploaded in the sanitized projection and merged with cloud messages by stable identity, so the website and editor can continue the same scoped conversation without duplicate replies. Group-scoped cloud messages currently remain on the website.

Hosted chat has no terminal, filesystem, hiring, code execution or publishing tools. A model roadmap is a proposal. Native command application, provider completion, code changes, tests and GitHub publication have separate evidence.

## Identity and environment

Keep this Site owner-private. The Sites platform owns sign-in, session cookies and trusted identity headers. The API checks the trusted owner email and uses the platform subject when available; a deterministic owner identifier supports the platform subject-header rollout. Browser writes additionally require the exact same-origin `Origin`. A different hosting proxy must reproduce this trusted-header boundary; arbitrary incoming identity headers are not credentials.

The owner creates desktop or VS Code device pairings. Pairings contain an application device token and, where required, the platform's private-site service-access token. These are independent checks: service access alone does not authorize a workspace request. Device tokens are hashed in D1, expire after 30 days and can be revoked. Desktop pairings bind their client identity to the authenticated device. Editor devices can read, chat and queue supported commands; they cannot publish snapshots or acknowledge native effects.

The desktop stores pairing secrets through OS encryption and rejects Linux plaintext storage. VS Code uses SecretStorage. The website presents a copy action for a newly created pairing. Treat the copied value as a password.

| Server binding | Purpose |
| --- | --- |
| `DB` | Sites-managed D1 binding from `.openai/hosting.json` |
| `ANTHROPIC_API_KEY` | Server-only Claude credential |
| `ATLAS_OWNER_EMAIL` | Exact owner identity allowlist |
| `ATLAS_ADMIN_TOKEN` | Separate owner automation credential |
| `ATLAS_SITE_ACCESS_TOKEN` | Platform-issued service-access credential included in authorized pairings |
| `ATLAS_CLOUD_CAP_USD` | Atomic cloud admission allocation; currently `5` |

Configure actual values through server environment secrets. Never commit `.env*`, `.dev.vars*`, tokens, personal snapshots or runtime state. The cloud API does not require the owner's GitHub token. Provider credentials never enter the public bundle.

## Persistence and synchronization

`db/schema.ts` and ordered `drizzle/` migrations define eight tables: workspace, devices, commands, messages, provider requests, application catalog, integrations and integration events. The cloud snapshot is a bounded projection of native state, including saved conversations, timed authority, its index and ledger. It excludes live leases, worker identities, local artifact paths and pending reservation details. Repository files and artifact bodies are not uploaded by this path.

**Connect authenticates. Sync now transfers.** No startup upload or background sync is implied. Explicit sync validates queued commands, imports supported cloud messages, then publishes a new projection. The empty database is created and claimed atomically by its initial snapshot upload. A populated seed must match the first desktop's projection; restore the supplied private workspace before connecting a fresh laptop.

Every queued command retains its base revision. The desktop compares this with the saved revision and local state. Rust checks an expected state hash inside the command transaction and stores a durable receipt. A lost acknowledgment can be retried without duplicating native effects. Stale commands become visible conflicts. An acknowledgment of a queued job does not claim that the model job has completed.

To replace a lost laptop or expired pairing, revoke its active device access, then use **Release previous desktop writer** on the owner page. Release compares both revision and writer identity, refuses an active unrevoked device, and preserves the snapshot. The replacement desktop must still restore/match that snapshot. Revocation alone never transfers ownership.

Cloud message pagination returns immutable IDs and cursors. Persist `cursor` even when `nextCursor` is null. The native import uses stable receipts and cloud provenance; a retry does not reinsert messages or call a model. Messages are preserved in full within the explicit 60,000 UTF-16-unit / 240,000 UTF-8-byte limit, with bounded pages and an import envelope large enough for Unicode. Group messages stay saved online and are reported as unsupported by this native import version.

The application directory combines saved companies with owner-indexed repository and website records. It keeps repository creation, website-record creation, first publication, last change and HTTP verification separate. An HTTP response is reachability evidence, not a functional acceptance test. Unconfirmed repository associations stay visibly unconfirmed. Catalog writes use revision checks, a streamed 2 MiB limit, at most 500 records, HTTPS source validation and credential rejection in both URL queries and fragments.

The Figma connection form saves a company-owned design-file reference and the official remote MCP endpoint. It does not store OAuth tokens or claim that a ChatGPT Figma connection authorizes the user's editor. Follow the provided official VS Code client setup to authenticate that client separately. Events for catalog updates and integration changes appear in the private ledger.

## HTTP API

All `/api/` routes require application authentication and return non-cacheable JSON. Native command execution is still validated by the Rust allowlist.

| Endpoint | Contract |
| --- | --- |
| `GET /api/health` | Service version, persistence and execution metadata |
| `GET /api/session` | Identity, client ID, capabilities and budget; no provider key |
| `GET /api/provider-status` | Owner-only provider connectivity probe; no generation request |
| `GET /api/workspace` | `{revision,snapshot,sourceClientId,updatedAt}` |
| `PUT /api/workspace` | `{expectedRevision,clientId,snapshot}`; compare-and-set from the authenticated writer or owner administration |
| `POST /api/workspace/claim-writer` | `{expectedRevision,clientId}`; claim an existing unowned snapshot without changing its content revision |
| `POST /api/workspace/release-writer` | Owner-only `{expectedRevision,expectedClientId}` after revocation/expiry |
| `GET /api/devices` | Owner-only device metadata |
| `POST /api/devices` | Owner-only `{name,kind}` where kind is `desktop` or `vscode`; returns pairing metadata and credentials |
| `DELETE /api/devices/:id` | Revoke access; preserve writer assignment and saved work |
| `GET /api/commands` | Up to 100 pending commands with `baseRevision` |
| `POST /api/commands` | `{expectedRevision,idempotencyKey,command:{action,payload}}`; HTTP 202 means queued |
| `POST /api/commands/:id/ack` | Writer acknowledgment `{ok,error?,code?}`; conflict remains an explicit status |
| `DELETE /api/commands/:id` | Cancel future admission; already applied native work retains its receipt |
| `GET /api/chat?scopeKind=…&scopeId=…` | Saved messages and budget for a validated scope |
| `POST /api/chat` | `{scope:{kind,id},message,idempotencyKey}`; editor aliases `{companyId,content,requestId}` also work |
| `GET /api/cloud-threads` | Browser thread projection |
| `GET /api/cloud-threads?cursor=…` | Up to 100 messages plus `cursor` and `nextCursor`; use an empty initial cursor |
| `GET /api/activity` | Recent queue outcomes, provider accounting and budget |
| `GET /api/applications` | Revisioned private catalog entries and update time |
| `PUT /api/applications` | Owner-only `{expectedRevision,entries}`; atomic catalog and ledger event |
| `GET /api/integrations/figma` | Saved nonsecret company design references |
| `POST /api/integrations/figma` | Owner-only `{companyId,fileUrl}`; retains explicit client-authorization-required status |
| `GET /api/integration-ledger` | Latest 200 directory and integration events |

## Donna and the shared budget

The provider adapter selects `claude-sonnet-5-5`, medium effort and `between_tools` thinking, with bounded output. It reads text blocks and observed usage. Parameter choices follow the [official Sonnet 5.5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide); verify supported options and prices before changing models. The model receives bounded saved scope context and recent history. Company context excludes other-company knowledge. Explicit Donna portfolio scope can summarize the saved portfolio. Source text is data, not authority to execute tools.

One SQL admission statement reserves a conservative input/output allowance, checks total committed cloud cost and bounds concurrent requests. Completed idempotency keys reuse their result. Unknown outcomes retain their reservation and saved brief; they are not automatically retried or counted as free. A cap blocks new admission while preserving completed work and in-flight accounting.

The cloud has **$5 allocated from the same $100 development-session ceiling**. The native global ledger holds that allocation while the cloud ledger tracks its actual requests. The allocation is not additional budget or observed spend. Do not release the native hold while the cloud can spend it. Setting an environment variable does not itself create the matching native hold; maintain both sides deliberately. [Usage evidence](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/main/project/CLAUDE_USAGE.md) separates observed charges, unresolved reservations and allocation.

Workers requests use manual redirect handling and reject redirects explicitly, keeping provider credentials on the fixed origin. The hosted runtime rejected the original `redirect:"error"` setting before dispatch. Its early request reservations remain conservatively retained. A successful production response must have its own receipt in the validation record.

## D1 and the optional Supabase path

D1 is implemented because the owner-private Sites deployment already supplies identity, Worker execution and a storage binding. One writer and a compact revision protocol keep this desktop-focused release coherent. This sequencing choice is not a claim that D1 outperforms all alternatives.

A future Supabase adapter should preserve revision, idempotency, cursor and budget semantics while adding explicit owner/organization records, access policies, migrations and concurrency tests. Supabase documents combining Auth with row-level authorization and checking authenticated ownership; see [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security). No Supabase database was provisioned or unrelated existing database modified for this release.

## Build, tests and shared renderer

Use Node.js 22.13 or newer and the checked-in lockfile. From this directory:

```sh
npm ci
npx tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

API tests execute the migration SQL in ephemeral SQLite with a D1 facade and mock provider responses. They make no paid model calls. Compilation, API tests, real sign-in, production provider calls and owner-laptop installation are distinct acceptance checks.

After building the desktop renderer, update its generated cloud copy:

```sh
node scripts/sync-desktop.mjs /absolute/path/to/engineering-intelligence-atlas
```

Edit the desktop renderer sources, then run `node scripts/sync-desktop.mjs /absolute/path/to/engineering-intelligence-atlas` from this directory after building the desktop. The script copies the shared studio tokens into `app/studio-tokens.css` and emits content-addressed renderer, signal, style and transport assets in `public/workspace/`. The authored cloud transport now lives in `scripts/cloud-bridge.js`; edit that source, never its generated hashed copy. It queues owner commands and never claims optimistic native completion.

The website and shared office use the same Violet studio / Golden drafting preference, saved as `daftar-studio-theme` on this origin. Blueprint, Ownership, Roadmap and Whiteboard links preserve company scope from the application directory. The theme is a local presentation preference; it does not change the D1 workspace revision or enqueue a native command. Heat signals are derived from the last received snapshot and keep unknown data separate from a confirmed zero. See [the signal contract](../project/OFFICE_SIGNALS.md) and [color system](../project/STUDIO_COLOR_SYSTEM.md).

Clean clones use the portable execution profile. `npm run dev` starts local development; `npm start` previews an already-built Worker on loopback. Portable mock identity is development-only and absent from production; local protected routes still need matching test bindings and a migrated database. Managed Sites checkouts use their ignored execution-profile selection and the Sites lifecycle helpers. This project has no source `wrangler.jsonc`; builds generate `dist/server/wrangler.json`.

Keep `.openai/hosting.json`, schema, migrations and migration metadata in source. Add a migration for schema changes; never rewrite an applied production migration. After building, apply the first migration only to a fresh local preview database with:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_absent_valeria_richards.sql
```

Apply later pending migrations once and in order. Sites publication applies production migrations separately. Reuse the existing Site project ID, preserve owner-private access, configure secrets through the platform, and exclude local runtime directories and publication archives from source control.

The adjacent editor package uses the [official VS Code extension-testing APIs](https://code.visualstudio.com/api/working-with-extensions/testing-extension) for its installed-VSIX acceptance gate. Packaging and Extension Host activation are separate from an actual user's editor session; report each result at its observed scope.
