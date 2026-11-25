# Backend, ownership and workflow validation — 2026-11-24

## Delivered scope

This continuation integrates the previously retained conference-table prototype,
Atech SDK, skill repairs and resource-office work, and improves the native,
headless, cloud, MCP and VS Code management paths. Work was isolated from the
earlier checkout; its unfinished source was preserved. The base of the published
integration is `main` at `3a3cc3d56d7f43195ab8b857ca9f3c2bed46390e`.

The implementation was divided between a native backend engineer, an MCP/editor
engineer, a reliability engineer and the integrating lead. Independent reviews
found additional ownership, accounting and cleanup defects before publication.
These were actual delegated review passes, not claims that production Donna or
permanent model employees performed work.

## Behavior changes

### Donna, employees and departments

- `update_employee` changes a saved name, role definition or skill references.
  It preserves identity, placement, lifecycle, assignment keys and grants;
  protected/unknown fields and edits to retired definitions fail explicitly.
- `rename_office` and `rename_department` retain ownership, hierarchy and work
  references. Delegated edits require the existing scoped `team.manage` grant.
- Restored state now validates that Donna is the permanent global assistant and
  that every company, office and department has its own correctly scoped
  permanent assistant. A title does not confer authority.
- Pausing employees parks budget-waiting work. Retiring specialists cancels
  queued, running, budget-waiting and paused attempts while retaining completed
  evidence and unresolved accounting. Permanent coordinators remain protected.
- Validation reuses identity lookup maps. Native synthetic tests cover the
  30,000-employee registry bound and an existing 16,000-level department tree.

See [the native review](BACKEND_OWNERSHIP_REVIEW_2026-11-24.md) for contracts,
regressions and exact source paths.

### AI execution and accounting

Workers recheck native authority while a provider request is running and again
after its result arrives. A revoked grant, changed lease or paused scope can stop
acceptance and side effects. Returned evidence and observed usage are retained;
unknown outcomes retain conservative reservations and are not retried silently.

Global admission controls have separate semantics: a valid running reservation
may finish if the global cap becomes full or the owner pauses *new* dispatch.
This also fixes an exact-cap reservation being refused immediately before its
first provider call. Current grants, lease, employee, scope, service contract
and knowledge permissions still apply.

### Cloud relay and Donna chat

- Concurrent identical command submissions return one durable command receipt.
  Conflicting reuse of a key returns HTTP 409, rather than a generic server error.
- Chat admission uses conflict-aware inserts and returns the original request
  record. Sixteen synchronized duplicate submissions dispatched one mocked
  provider request and saved one conversation pair.
- A D1 transaction now saves the reservation and initial brief together. An
  injected brief-write failure rolls both back, sends no provider request and
  permits later recovery with the original key. It cannot permanently occupy a
  concurrency slot before dispatch.
- Cloud commands are explicitly allowlisted against the native remote protocol.
  Worker settlement and internal message import remain private operations.
- Request sizes are enforced while reading streams, including requests without
  `Content-Length`. Oversized input is cancelled before it can be fully buffered.
- A 48-request burst at 990 queued commands admits exactly the remaining ten
  places and preserves the existing queue at its 1,000-command bound.

The atomic admission implementation follows the documented transaction behavior
of [Cloudflare D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
The concurrent and fault-injection tests use real in-memory SQLite and a
transactional D1 adapter, not a live production database.

### MCP, VS Code and headless operation

The editor now exposes **Manage Team and Departments** and **Review Donna
Ownership**. Controls cover hiring, role/skill edits, specialist retirement,
office creation/renaming and department creation/renaming/reparenting/pause/resume.
The ownership view distinguishes Donna from each scope's assistant. Hosted
commands remain visibly queued until explicit native synchronization applies them.

Editor drafts persist per company and connected origin. Slow responses cannot
replace another company's view or resurrect a disconnected session. Duplicate
mutations and overlapping SecretStorage deletion are guarded. The extension
still uses Workspace Trust and SecretStorage; no permission is inferred from an
employee's role label.

The headless runtime validates configuration before starting services, attempts
all cleanup paths once, closes sockets even after cleanup errors and gives
conservative HTTP 503 guidance for uncertain native outcomes. Backpressure uses
HTTP 429 and `Retry-After`; recovery preserves the original command ID and body.

See the [MCP/editor review](MCP_VSCODE_REVIEW_2026-11-24.md) and
[runtime review](BACKEND_PIPELINE_VALIDATION_2026-11-24.md).

## Executed local validation

| Layer | Result | Evidence scope |
| --- | --- | --- |
| Rust native core | 107 tests passed; release build passed | Real native state, locking, grants, hierarchy and lifecycle |
| Desktop | 645 tests passed; TypeScript and renderer builds passed | Includes the rebuilt native helper and cloud/native contracts |
| Renderer | 361 interaction checks passed | Synthetic DOM; no visual acceptance claim |
| Cloud | 122 tests passed; TypeScript and Worker build passed | SQLite-backed API, budgets, access, concurrency and fault injection |
| VS Code | 31 tests passed; syntax and manifest/lock checks passed | Extension, client, management and webview fixtures |
| MCP | 51 tests passed | Local and headless runtime MCP adapters |
| Headless runtime | 40 tests passed, zero skips | Native integration, provider doubles, sync/restart and cleanup |
| Resource integration | 32 tests passed | Router, byte bounds, renderer assets and native prompt integration |
| Research atlas | TypeScript and build passed; 85 tests passed, 22 skipped | External database/storage/live-provider gates intentionally unavailable locally |
| Static publication | 219 client files passed integrity checks | Relative paths, CSS, PWA and asset digests |

The native helper used by the final stress run has SHA-256
`82589da9b59035d5c57b07ba2f75d6523b9ba43dc0c6a4f52e6eabfe2ca92239`.
Cloud source was rechecked after the final admission fix. A GitHub Actions result
belongs to its own commit and must be reported separately from these local runs.

### Bounded load result

The [machine-readable receipt](backend-stress-2026-11-24.json) records all ten
passed behavioral checks. One daemon and a second independent native client
shared the same disposable state. A second full daemon was correctly refused
ownership of the model registry.

| Measurement | Observed result |
| --- | ---: |
| New persistent employees / total saved employees | 256 / 284 |
| Duplicate deliveries of one create command | 64; one mutation |
| Competing edits | 16; one winner and 15 stale-revision conflicts |
| HTTP attempts, including expected rejections and retries | 564 |
| Expected HTTP 429 capacity responses | 123 |
| Correct retries using the original envelope | 131 |
| Full run time | 17.45 seconds |
| Hiring throughput | 30.53 records/second |
| HTTP attempt latency, p50 / p95 | 33.67 / 371.34 milliseconds |
| External provider calls | 0 |

These are measurements on this host with synthetic data, not production capacity
guarantees or a multi-hour soak. The harness only writes `ok:true` after all
controllers close and disposable state is removed.

## CI improvements and reproduction

The headless workflow now sets `DAFTAR_REQUIRE_NATIVE_TESTS=1`, so missing native
or portable builds fail required integration tests. It runs the bounded load
gate and retains its JSON receipt. A separate Node 24 step covers `.mjs` resource
tests that the desktop's TypeScript-only Vitest glob previously omitted, plus
catalog, skill and hosted studio drift checks.

```sh
cargo test --locked --manifest-path native-core/Cargo.toml
npm --prefix desktop-shell run build:native
npm --prefix desktop-shell run build
npm --prefix desktop-shell test
npm --prefix desktop-shell run test:renderer
npm --prefix headless-runtime run build
DAFTAR_REQUIRE_NATIVE_TESTS=1 npm --prefix headless-runtime test
node scripts/backend-stress.mjs --output /tmp/daftar-backend-stress.json
node --test cloud-workspace/tests/*.test.mjs
npm --prefix vscode-extension run check
npm --prefix vscode-extension test
node --test tools/atlas-mcp.test.mjs tools/daftar-runtime-mcp.test.mjs
```

Use Node 24 for the direct TypeScript-loading tests and the locked dependencies
for each package. The [resource validation](resource-office-2026-11-24/VALIDATION.md)
records its additional check commands.

## Production and verification boundaries

The existing Site's access policy and owner binding were inspected read-only;
it remains restricted to its owner. The complete live office snapshot exceeds
the database connector's single-row display bound, and the browser inspection
connection failed before loading the page. Therefore this review does **not**
certify every record in the live private workspace. No private snapshot,
credential, account identifier or conversation was copied into this repository.

Browser smoke testing could not run locally: the matching Playwright browser was
absent and its official download failed in this environment; the independent
cloud browser connection also failed. Existing CI browser/package gates remain
required. Installed owner-device acceptance, Windows/Android packages, external
MCP clients, live model billing and long-duration production load are separate
checks. The changes do not start paid workers, rent infrastructure, change sharing
or spend a development-model allowance.

GitHub publication and any private Site deployment are reported with their own
returned commit/version receipts. A deployment does not automatically update
the user's installed native runtime or VS Code extension.
