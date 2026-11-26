# Daftar headless runtime · integration preview

This service runs Daftar's existing Rust authority and portable office workers
without opening Electron. A VPS or VM can keep it running independently of the
owner's laptop. It starts with workers **paused** on every restart.

The service supports the current application's workspace operations, bounded
provider jobs, saved artifacts, job/schedule/goal controls and managed GitHub
operations. It preserves the existing native budget, lease, authority and
shared-service contract checks. Optional creative adapters invoke fixed tools
against reviewed project roots; trusted Unreal plugins remain executable code.
An explicit, default-off [SSH/tmux host-control mode](../deploy/SSH_TMUX_AUTOCONTROL.md)
adds owner-authorized shell jobs with company/employee attribution, durable
receipts, output bounds and cancellation.
The optional paired-device cloud adapter now reuses the existing website
snapshot/queue protocol, with explicit opt-in and encrypted pairing storage. No live
workspace has been migrated automatically. Desktop remote-client mode and a public
ChatGPT OAuth/MCP gateway remain separate integration work. See the repository's
deployment plan and the cloud-device runbook for those boundaries.

## Build and test

From the repository root, with Node 22 or newer and Rust 1.89 or newer:

```bash
npm --prefix desktop-shell ci --ignore-scripts
cargo build --release --locked --manifest-path native-core/Cargo.toml
node desktop-shell/node_modules/typescript/bin/tsc -p headless-runtime/tsconfig.json
DAFTAR_REQUIRE_NATIVE_TESTS=1 node --test headless-runtime/test/*.test.mjs
node scripts/backend-stress.mjs --employees=128 --requests=64
```

The portable TypeScript build writes to `desktop-shell/dist`, where its existing
provider dependencies resolve. Electron's installation scripts are skipped, and
the runtime does not import Electron. Full-suite native integration and company
setup tests use temporary synthetic workspaces and make no provider calls. Build
the prerequisites before running the complete suite; focused pure contract tests
can be run separately. `DAFTAR_REQUIRE_NATIVE_TESTS=1` also turns older optional
native gates into explicit failures when builds are absent; CI uses this setting.

The stress runner creates a disposable workspace, one full daemon and a second
independent native-backed HTTP command client. It verifies concurrent receipt
replay, revision conflicts, bounded HTTP backpressure, permanent-assistant
ownership, employee lifecycle and restart.
`--employees=1..1024` and `--requests=16..256` select a bounded load;
`--output=path` also saves the JSON receipt. Timings describe only that host and
load. CI retains its receipt as `backend-stress-evidence`. The runner cannot skip
missing builds and does not read existing workspaces or call model providers.

Employee definitions can be changed through `update_employee`; office and
department names through `rename_office` and `rename_department`. These owner
commands retain the normal expected-state hash and persistent command receipt.
They do not transfer employee scope or coordinator ownership. Paused employees
can be edited; retired employees remain historical records.

HTTP saturation (`BUSY`, 429) and native lock contention (`STATE_BUSY`, 409)
include `Retry-After: 1`. Retry the **same** command id, expected state hash and
body. A subsequent `CONFLICT` requires reading current state and reviewing the
intended change; a mismatched receipt must never be silently recreated. Missing
native executables and lock/read/write failures return 503 with conservative outcome
guidance instead of appearing to be invalid user requests. Invalid HTTP startup
configuration is rejected before background observers or cloud sync start.

## Configuration

The entrypoint is `node headless-runtime/server.mjs`. Set configuration before
starting it. The Docker and systemd examples under `deploy/` set these values for
a persistent service.

| Variable | Default or purpose |
|---|---|
| `DAFTAR_REPO_ROOT` | Repository root derived from the entrypoint |
| `DAFTAR_CORE_BINARY` | `<repo>/native-core/target/release/atlas-core` |
| `DAFTAR_DATA_DIR` | `<repo>/headless-runtime/.daftar-runtime`; production should use `/var/lib/daftar` |
| `DAFTAR_CONTROL_TOKEN_FILE` | **Required:** absolute path to private control-token file |
| `DAFTAR_HOST` | `127.0.0.1` |
| `DAFTAR_PORT` | `8788` |
| `DAFTAR_ALLOW_CONTAINER_BIND` | Set to `1` only when binding `0.0.0.0` inside an isolated container network |
| `DAFTAR_ALLOWED_HOSTS` | Optional comma-separated exact Host headers for an internal proxy, such as `runtime:8788` |
| `DAFTAR_CONCURRENCY` | `2`; accepts 1–4 workers |
| `DAFTAR_CREATIVE_CONFIG_FILE` | Optional absolute private creative tools/project configuration; absent means no configured creative adapters |
| `OPENAI_API_KEY_FILE` | Optional private OpenAI credential file |
| `ANTHROPIC_API_KEY_FILE` | Optional private Anthropic credential file |
| `GITHUB_TOKEN_FILE` | Optional private GitHub credential file |
| `DAFTAR_OLLAMA_BASE_URL` | `http://127.0.0.1:11434`; existing adapter requires loopback |
| `DAFTAR_OLLAMA_LOCAL_ONLY` | Set `1` only after configuring the managed daemon with `OLLAMA_NO_CLOUD=1`; otherwise shared self-hosted requests/jobs are disabled |
| `DAFTAR_CLOUD_SYNC` | `0`; set `1` to explicitly start paired-device website sync |
| `DAFTAR_CLOUD_URL` | Exact existing website HTTPS origin; HTTP only for loopback |
| `DAFTAR_CLOUD_PAIRING_FILE` | Existing owner-issued device pairing, compact JSON or device token in a private file outside the state directory |
| `DAFTAR_CLOUD_ENCRYPTION_KEY_FILE` | Separate private key file outside the state directory: 64 hex characters encoding 32 random bytes |
| `DAFTAR_CLOUD_SYNC_INTERVAL_SECONDS` | `60`; bounded to 60–3600 seconds, with no overlapping sync passes |
| `DAFTAR_CLOUD_ALLOW_KNOWN_SCHEMA_DEFAULTS` | `0`; explicit first-pairing migration of only absent parent fields to null, with released writer, empty queue and otherwise identical restored projection |

Secret files must be regular files, not symbolic links, with mode `0400` or `0600`
on POSIX systems and an owner that the
runtime user can read. The control token must contain 32–256 characters from
`A–Z`, `a–z`, `0–9`, `_`, `-`; use cryptographically random data. Credentials are
read from these files, not copied into a fabricated OS keychain. The control token
is loaded at startup, so rotate it and restart the service together. Provider
files are read when needed. Empty optional secret-file settings are ignored.

The runtime writes authoritative state below `DAFTAR_DATA_DIR/company/` and
provider artifacts below `DAFTAR_DATA_DIR/office-artifacts/`. Back up both while
the service is stopped or through a consistent backup procedure. Do not run two
independent servers with copied state files as simultaneous authorities for the
same workspace. A shared network filesystem is not a multi-host lock service.

Model requests and digest assignments live separately under `DAFTAR_DATA_DIR/model-pool/`,
with their own private atomic registry and a single-controller lock. Include this
directory in stopped-state backups. Model progress does not change the native office
state hash. An interrupted download requires deliberate review/new request after restart.

Creative assignments, durable job identities and artifacts live under
`DAFTAR_DATA_DIR/creative-tools/`, with a separate exclusive controller lock.
Include the complete directory in stopped-state backups. Queued/running jobs
recovered after restart become interrupted and are never silently re-executed.
The [creative VPS pack](../deploy/creative/README.md),
[employee/repository setup](../integrations/creative-tools/README.md) and
[runtime contract](../integrations/creative-tools/RUNTIME_CONTRACT.md) document
installation, scoped grants, fixed operations and external-service limits.

Optional website pairing is encrypted in `DAFTAR_DATA_DIR/cloud/` with an explicit
AES-GCM file-key backend. Its key and source pairing remain in a separate protected
secret directory. The runtime reports only cloud configured/connected flags, revision
and a generic error. See [cloud device setup and migration](../deploy/CLOUD_DEVICE_SYNC.md)
before enabling it; another writer or unmatched populated cloud state is preserved.

## API contract

`GET /healthz` returns nonsecret process metadata. All other routes require
`Authorization: Bearer <control-token>`. The API is intended for an authenticated
server-side client or local MCP adapter. Browser origins are rejected by default;
it does not provide browser login, CORS or OAuth. An HTTPS reverse proxy alone
does not supply those missing client flows.

| Route | Behavior |
|---|---|
| `GET /healthz` | `{ok:true,service:"daftar-headless",apiVersion:1}` |
| `GET /v1/status` | Worker enabled/running state, active job IDs and implemented capabilities |
| `GET /v1/office` | Sanitized office projection and `stateHash` |
| `POST /v1/commands` | One idempotent owner command; returns its receipt and current projection |
| `POST /v1/workers` | `{enabled:true}` starts polling; `{enabled:false}` stops and aborts active provider requests |
| `POST /v1/workers/run-once` | `{}` starts one pool pass asynchronously; returns HTTP 202 |
| `GET /v1/models?companyId=...&employeeId=...` | Reviewed catalog, installed/loaded models and this scoped request/assignment history; employee optional |
| `POST /v1/models/pull` | `{companyId,employeeId,model,idempotencyKey,maxBytes?}` requests a deduplicated model download |
| `POST /v1/models/cancel` | `{companyId,employeeId,requestId}` cancels this subscriber; never deletes model bytes |
| `POST /v1/models/select` | `{companyId,employeeId,model}` assigns a verified installed digest to the scope |
| `GET /v1/creative?companyId=...&employeeId=...` | Scoped local-tool readiness, reviewed projects, assignments and job receipts; employee optional |
| `POST /v1/creative/assign` | `{id,companyId,employeeId,projectId,toolIds}` assigns tools; an empty tool list removes the assignment |
| `POST /v1/creative/run` | `{id,companyId,employeeId,projectId,operation,input}` admits one fixed job and returns 202; admission is not completion |
| `GET /v1/creative/jobs?companyId=...&jobId=...` | Retrieves the original durable creative job and safe output metadata |
| `POST /v1/creative/cancel` | `{id,companyId,jobId}` stops local execution/waiting; remote Adobe completion may remain uncertain |
| `GET /v1/host` | Host opt-in, off/manual/auto policy, revision, explicit grants and job metadata |
| `POST /v1/host/configure` | Full `{expectedRevision,mode,grants}` replacement; stale revisions fail |
| `POST /v1/host/submit` | Stable `{id,companyId,employeeId,command,cwd,timeoutSeconds?,maxOutputBytes?}` job |
| `POST /v1/host/approve` | `{id}` approves a pending job after fresh scope/grant validation |
| `POST /v1/host/cancel` | `{id}` records cancellation; inspect its eventual terminal result |
| `POST /v1/host/inspect` | `{id,offset?}` returns at most 64 KiB of source log bytes and raw-byte offsets |
| `POST /v1/host/stop-all` | `{}` switches host policy off and requests cancellation of managed jobs |

Host control requires `DAFTAR_HOST_CONTROL=1`, working Linux tmux, an explicit
policy and grants. Ordinary provider workers still start paused. Host jobs run as
the daemon's OS user; company/employee selectors are owner-directed attribution,
not separate user authentication or OS isolation. Closing the daemon leaves
detached jobs running. Lost launch responses are retained without automatic retry;
uncertain persistence fences the controller until restart and reconciliation.
The host registry retains at most 256 receipts and never silently evicts them.

Enabling workers or a one-shot pass can make provider calls for already-authorized
jobs. The same native budgets and contracts remain in effect. Disabling a worker
does not erase a reservation or claim that an interrupted call was free. The
worker settles observed usage or conservatively retains estimates for review.

An owner command uses this shape:

```json
{
  "id": "unique-operation-id",
  "expectedStateHash": "64-lowercase-hex-characters-from-GET-v1-office",
  "command": {
    "action": "pause_company",
    "companyId": "an-existing-company-id"
  }
}
```

Use the latest state hash and a stable ID for the intended operation. The core
stores the command's canonical hash and receipt atomically with its effects.
Replaying the same ID and body returns `replayed:true` without repeating the
mutation, including after a restart. Reusing an ID with a different body and
submitting a new operation against stale state both return a conflict.

If the mutation was saved but its response projection cannot be emitted, the API
returns `ok:true`, the operation ID and `snapshotOmitted:true`. **Do not create a
new ID to retry a saved operation.** An unconfirmed process outcome returns HTTP
503 and similarly requires retaining the original ID and body for any deliberate
replay. No mutation or billed request is automatically retried by this service.

The remote owner allowlist lives in `contract.mjs` and is also checked by the
native core. Worker lease, reservation, heartbeat and settlement operations stay
internal. The public projection omits live lease tokens, worker identities,
artifact paths, internal receipt lists and pending reservations. Full artifacts
remain in private storage; this API does not yet serve artifact bodies.

## Model and tool support

The runtime uses the application's existing OpenAI and Anthropic adapters and
local Ollama adapter. The model pool admits only reviewed local references, requires
active employee/company or shared-service scope, and verifies assigned digests before
cache admission and dispatch. It rejects cloud aliases and remote metadata. Missing
usage remains estimated, not a fabricated zero-token observation. See the
[model-pool runbook](../deploy/MODEL_POOL.md) for shared download, cancellation, context,
storage and infrastructure-cost limits. It does not yet accept an arbitrary OpenAI-compatible
endpoint or provide a Vast.ai serverless adapter. A local authenticated tunnel
to an Ollama service on a GPU host can preserve the loopback requirement; its
hosting charges are separate from the application's token-cost ledger.

Managed GitHub reads and publication reuse the desktop's adapters. A publication
requires an allowed tool on the job, active authority, the applicable owner and
service-contract approvals, a configured credential, and a valid expected commit
head. Ordinary provider jobs produce text artifacts. They do not run tests,
compile repositories, execute terminal commands or interact with social accounts.

## What was verified

The test suite checks authentication, Host/Origin enforcement, request/response
boundaries, request capacity, secret permissions and symlinks, nonsecret errors,
worker overlap, and preservation of successful mutation receipts when projection
fails. The native integration test verifies eight concurrent identical commands
produce one effect, changed-body and stale-state conflicts, receipt persistence
across restart, paused startup and removal of internal fields from projections.
An additional integration test runs the real office worker against an injected
mock provider, closes its completed HTTP control connection while the job runs,
and verifies the saved artifact and synthetic usage ledger. It also verifies that
repeated enable requests do not trigger another dispatch.

These tests use loopback HTTP and synthetic state. They do not establish a live
VPS deployment, GPU benchmark, provider integration test, ChatGPT OAuth connection
or migration of the existing private workspace.
