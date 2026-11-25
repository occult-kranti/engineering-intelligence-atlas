# Connect MCP to the Daftar headless runtime

This adapter connects a local stdio MCP client to the separately supervised Daftar daemon. It does not start the daemon or own its jobs. The current trust model is one owner-operated workspace, with a private service credential. It is not a public OAuth server or a multi-user visiting-employee gateway.

See the [architecture and platform research](../project/CLOUD_RUNTIME_PLAN.md), [runtime API](../headless-runtime/README.md), [VPS deployment](../deploy/README.md) and [verification record](../project/CLOUD_RUNTIME_VALIDATION.md).

## Team definitions and ownership

`office_command` includes `update_employee` (`employeeId`, plus at least one of `name`, `role`, `skillPaths`), `rename_department` (`departmentId`, `name`) and `rename_office` (`officeId`, `name`). These follow the same unique receipt ID and expected-state-hash contract as other owner commands. The native backend checks ownership and scoped `team.manage` authority. Metadata edits cannot move employee identity, change lifecycle, or grant capabilities. Empty `skillPaths` removes skill bindings; repository paths remain validated by the native core.

Use the existing hire/fire and pause/resume commands for lifecycle changes. Donna is the global coordinator; each company, office and department retains its own permanent assistant assignment. Permanent assistants cannot be fired. A specialist retirement is terminal and retains its historical records. Scope filters in `office_query` remain read filters, not permission grants.

## Local configuration

Build and start the daemon using the runtime or deployment instructions. The MCP process needs Node 22+ and an absolute path to a private control-token file. Keep this file outside the repository and set its POSIX permissions to 0400 or 0600. The daemon and adapter must use the same credential.

```json
{
  "mcpServers": {
    "daftar-runtime": {
      "command": "node",
      "args": ["/absolute/path/daftar/tools/daftar-runtime-mcp.mjs"],
      "env": {
        "DAFTAR_RUNTIME_URL": "http://127.0.0.1:8788",
        "DAFTAR_CONTROL_TOKEN_FILE": "/absolute/private/path/control-token"
      }
    }
  }
}
```

This is the conventional configuration shape for stdio MCP clients; each host may have its own import/setup interface. The file contains only configuration paths, not the credential itself. Saving this configuration is not evidence that the ChatGPT account has installed or authorized the plugin.

## Tools

The adapter exposes 14 reviewed tools.

| Tool | Purpose | Mutation behavior |
| --- | --- | --- |
| `runtime_status` | Worker enabled/running state and capability metadata | Read only |
| `office_summary` | Collection counts, budget totals and current state hash | Read only |
| `office_query` | Bounded, optionally scoped metadata pages | Read only; read filters do not grant permissions |
| `office_command` | One explicit owner action through the native receipt transaction | Stable ID and expected state hash required |
| `worker_set_enabled` | Start or stop the runtime pool | Enabling can immediately run authorized, billable jobs |
| `model_pool_status` | Catalog, installed/loaded local models, scoped requests and assignments | Read only; at most 100 latest requests and assignments, with total counts |
| `model_pool_request` | Request a reviewed model for a company/employee | Stable idempotency key; shared download deduplication; consumes disk/network |
| `model_pool_cancel` | Cancel one scoped subscriber | Last subscriber aborts Daftar's stream; partial bytes can remain |
| `model_pool_select` | Assign an installed model digest | Does not rewrite jobs or enable workers |
| `creative_inventory` | Discover local tool readiness, approved projects, eligible employees, assignments and jobs for one company | Read/probe only; no software installation, Adobe call or creative start |
| `creative_assign` | Assign reviewed tools to an employee/project, or remove them with `toolIds: []` | Stable receipt `id`; metadata does not grant native authority |
| `creative_run` | Start one bounded operation on a project-relative asset | Stable receipt `id`; native scope, grants, limits and private configuration enforced |
| `creative_job` | Read status, safe result metadata, relative output names, sizes and hashes | Read only; no server-path disclosure or artifact download |
| `creative_cancel` | Request cancellation of one company job | Stable receipt `id`; already-dispatched Adobe usage can remain billable |

The adapter omits the baseline local MCP's raw snapshots, worker leases and internal accounting operations. It does not run arbitrary commands, provision infrastructure or expose a browser-accessible control token.

Model operations require a managed local-only Ollama daemon. An employee ID is a
scope selection under the authenticated owner credential; it is not a separate
employee login. No tool accepts an arbitrary model-server URL. Inspect
`model_pool_status`, request a catalog model, poll its request receipt to `ready`,
then select its digest before creating a self-hosted job with the same model.
After an uncertain download response, retain the original `idempotencyKey` and body.
Infrastructure costs remain outside the token-price ledger. See the
[shared model deployment guide](../deploy/MODEL_POOL.md) for exact request shapes,
VPS/Vast placement, storage bounds and cancellation behavior.

`runtime_status` also returns the optional website device connection's
configured/connected flags, revision and a generic error. It does not expose or
create a pairing. Configure [the private cloud device adapter](../deploy/CLOUD_DEVICE_SYNC.md)
on the server after restoring the intended workspace and transferring writer ownership.

### Creative task flow

The runtime owner sets `DAFTAR_CREATIVE_CONFIG_FILE` to a private, owner-reviewed configuration of executable paths and projects. The MCP caller supplies identifiers and project-relative input filenames. It cannot select an arbitrary executable, host directory, shell command, URL, or argument list. Creative identifiers begin with a letter or digit, contain only letters, digits, dots, underscores and hyphens, and are at most 100 characters.

1. Call `creative_inventory` with `companyId` and, optionally, `employeeId`. Read real configured/available status and project `allowedOperations` before planning a task.
2. Save `creative_assign` with `{id, companyId, employeeId, projectId, toolIds}`. Use an empty `toolIds` array to remove an assignment. An employee identifier selects the owner's scoped metadata; it is not a separate identity or permission grant.
3. Submit one `creative_run` with a unique stable `id`. Current scoped `creative.execute` authority is required in addition to the assignment. The service rechecks scope, assignment and authority during execution.
4. Retain the returned job ID and inspect `creative_job` with `{companyId, jobId}`. **Accepted**, **queued**, and **running** do not mean the task completed. Only **succeeded** reports a successful terminal result. Failed, cancelled and interrupted remain distinct.
5. If needed, send `creative_cancel` with a new stable cancellation `id`, `companyId` and `jobId`. Read the resulting status because the task can finish before cancellation arrives.

Example start, after reviewing and assigning the existing company/project:

```json
{
  "id": "creative-frame-unique-id",
  "companyId": "your-company",
  "employeeId": "your-artist",
  "projectId": "approved-project",
  "operation": "blender.render",
  "input": {
    "path": "scenes/main.blend",
    "frame": 1,
    "width": 1024,
    "height": 1024,
    "samples": 16
  }
}
```

Reviewed operations are `blender.inspect`, `blender.render`, `blender.export_glb`, `unreal.inspect`, `unreal.validate`, `inkscape.export_png`, `ffmpeg.probe`, `adobe.manifest` and `adobe.render`. Tool IDs are `blender`, `unreal`, `inkscape`, `ffmpeg` (the configured executable is ffprobe), and `adobe-photoshop`. Inspect/export/probe/manifest operations accept only `path`; Blender render additionally accepts `frame` (0–100000), `width` and `height` (16–2048), and `samples` (1–64). Inkscape PNG export accepts optional width/height. Adobe render accepts width/height and `format: "png" | "jpeg"`. Adobe manifest input is `.psd`; Adobe render input is `.psd`, `.png`, `.jpg` or `.jpeg`, with no PSB support. Optional values use bounded runtime defaults. Paths are at most 512 characters and cannot contain absolute roots, traversal, backslashes, percent escapes or control characters.

Blender, Inkscape and FFmpeg are distinct open-source tools. Unreal and Adobe require their own applicable licensing. An Adobe inventory row with `available: true`, `readiness: "configured_unverified"`, and `remoteAuthVerified: false` means only that the local adapter configuration is present. Inventory does not send an Adobe request or prove remote authentication. Adobe tasks send the selected approved asset to licensed external services and may incur charges. The runtime requires both private paid-request opt-in and `allowExternalUpload: true` on that project. Use the returned operation metadata and readiness flags accurately; do not call this state installed or connected.

An uncertain mutation is never retried automatically. Keep the original ID and body, inspect inventory/job status, and use the same ID only for receipt replay. A changed body with the same ID is rejected. A saved receipt with omitted detailed projection stays successful and instructs the caller to inspect current state. Outputs expose relative artifact names, byte counts and SHA-256 digests; an exact `creative://jobs/<job-id>` evidence URI may identify a retained receipt. Host paths, executable locations, raw logs, secret files and signed URLs are not returned.

### Example mutation flow

1. Call `office_summary` or `office_query` and retain `stateHash`.
2. Prepare one command with a unique stable ID and that expected state.
3. Submit `office_command`.
4. Keep the receipt. Read the current office/job state to inspect the result.

```json
{
  "id": "owner-operation-unique-id",
  "expectedStateHash": "REPLACE_WITH_64_CHARACTER_HASH_FROM_READ",
  "command": {
    "action": "create_company",
    "id": "example-company",
    "name": "Example Company"
  }
}
```

The hash placeholder is intentionally not valid input. A new command against stale state fails. After a lost response, inspect current state and preserve the original ID/body; do not submit a fresh ID to repeat an operation that may already have committed. Same-ID replay and changed-body rejection are enforced by the native core, including after daemon restart.

## Reach a VPS over SSH

Keep the daemon bound/published to VPS loopback. Forward it to the computer running the local MCP adapter:

```bash
ssh -N -L 127.0.0.1:8788:127.0.0.1:8788 YOUR_USER@YOUR_VPS
```

The local adapter then uses `http://127.0.0.1:8788` and its private copy of the workspace control credential. Use a different local port if necessary. Both the SSH connection and daemon must remain running. This route does not make a Desktop-local plugin available on ChatGPT web/mobile.

## Connect a private VPS using OpenAI Secure MCP Tunnel

The current official [Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) supports local stdio commands and private HTTP MCP servers. Install its supported `tunnel-client` and check current CLI help before configuring a real account.

Run the client in the same private environment that can reach the daemon. Configure `DAFTAR_RUNTIME_URL`, `DAFTAR_CONTROL_TOKEN_FILE` and the tunnel's own protected runtime credential in the supervisor environment. The tunnel credential is separate from the Daftar control token.

```bash
tunnel-client help quickstart
tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile daftar \
  --tunnel-id YOUR_TUNNEL_ID \
  --mcp-command "node /opt/daftar/tools/daftar-runtime-mcp.mjs"
tunnel-client doctor --profile daftar --explain
tunnel-client run --profile daftar
```

Use **Plugins → plus → Add custom MCP server → Tunnel** where this route is available in the account. The tunnel must be associated with the intended Platform organization and ChatGPT workspace. Creation and use have different documented permissions. Installing the tunnel client does not confer these permissions.

**Do not pass `http://127.0.0.1:8788` as `--mcp-server-url`.** That address serves Daftar's REST control API, not MCP. Launch `tools/daftar-runtime-mcp.mjs` with the stdio option shown above.

The tunnel is connectivity to this owner interface; it does not add per-user authorization to the daemon. Keep an owner bridge private. A multi-user plugin needs verified identity and company-scoped authorization at its gateway.

Long work lives in Daftar's jobs. OpenAI documents a 120-second tunnel request deadline, so return a job identity and inspect its later status instead of holding a tool call through research, compilation or GPU startup.

## ChatGPT route availability

As checked on 21 November 2026, official documentation distinguishes full custom remote MCP access, local ChatGPT Desktop plugins, and Sites-hosted plugins. The custom-server Help Center page qualifies writes by plan/workspace; the newer Plugins guide documents local Desktop and Sites routes separately. Confirm the route exposed in the target account. See the [source-linked comparison](../project/CLOUD_RUNTIME_PLAN.md#5-chatgpt-control-routes).

A publicly reachable MCP server requires a proper streaming-HTTP/SSE transport and user authentication. This branch deliberately provides a private stdio adapter; its loopback bearer token is not a replacement for ChatGPT's OAuth user-authentication mechanism.

## Verification

From the repository root, after the native core and portable runtime build:

```bash
node --test tools/daftar-runtime-mcp.test.mjs
node --test headless-runtime/test/creative-http.test.mjs
node scripts/smoke-runtime-mcp.mjs
```

The HTTP tests exercise authenticated creative routing, exact query scopes, request bounds, safe errors, and successful receipt fallback. MCP tests exercise creative parameter validation, company filtering, readiness, exact receipt forwarding and no automatic retry. The final command launches a real native-backed HTTP daemon and a real stdio adapter in temporary synthetic state. It checks discovery, command application, replay, stale-state rejection, metadata filtering and process independence. It never connects an owner's workspace or invokes a model provider. Real creative executable acceptance and licensed Adobe authentication are separate checks; these synthetic transport tests do not claim them.
