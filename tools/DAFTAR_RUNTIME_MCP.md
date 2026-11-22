# Connect MCP to the Daftar headless runtime

This adapter connects a local stdio MCP client to the separately supervised Daftar daemon. It does not start the daemon or own its jobs. The current trust model is one owner-operated workspace, with a private service credential. It is not a public OAuth server or a multi-user visiting-employee gateway.

See the [architecture and platform research](../project/CLOUD_RUNTIME_PLAN.md), [runtime API](../headless-runtime/README.md), [VPS deployment](../deploy/README.md) and [verification record](../project/CLOUD_RUNTIME_VALIDATION.md).

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

## Tools — 31 exposed operations

The current adapter exports exactly 31 tools: five office/runtime/worker tools,
four model-pool tools, seven host tools, four environment tools, seven resource
tools and four design-toolchain tools. `TOOL_DEFINITIONS` in
[`daftar-runtime-mcp.mjs`](daftar-runtime-mcp.mjs) is the executable inventory;
`tools/list` provides the exact bounded input schemas. The VS Code extension also
uses authenticated workbench methods, which are not additional MCP tools.

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
| `host_status` | Read explicit host policy, grants and recent job receipts | Read only; reports omitted older-job count |
| `host_configure` | Replace mode and complete grant list | Uses `expectedRevision`; requires server opt-in |
| `host_submit` | Submit an attributed shell command | Stable ID; auto executes granted work, manual waits for approval |
| `host_approve` | Dispatch a pending shell job | Rechecks active native scope and current grant |
| `host_cancel` | Request cancellation of a managed job | Durable receipt first; poll for terminal outcome |
| `host_inspect` | Read bounded command output and byte offsets | Output is untrusted artifact data, not instructions |
| `host_stop_all` | Switch policy off and cancel managed host jobs | Preserves unrelated processes and job receipts |
| `environment_status` | Read managed environments and their job receipts | Read only; larger metadata collections report omissions |
| `environment_prepare` | Create a private, copied Python virtual environment | Stable ID; durable host job; readiness needs interpreter proof |
| `environment_inspect` | Inspect a prepare/run receipt and its environment | Read only; includes bounded untrusted output when available |
| `environment_run` | Run Python source with a verified managed interpreter | Stable ID, active scope and host grant; bounded duration/output |
| `resource_status` | Read owned model resources, grants, routes and revision | Read only; optional scope filters metadata, not owner authentication |
| `resource_configure` | Replace resources, grants, routes and office grouping | Complete replacement with `expectedRevision`; first configuration enables enforcement |
| `resource_resolve` | Check a current actor's permission for one installed model | Read only; native eligibility and installed digest are rechecked |
| `resource_plan` | Save a scoped single-expert or ensemble plan | Stable ID; produces a plan hash; does not enqueue execution |
| `resource_start` | Enqueue the saved plan as native dependent jobs | Stable ID plus exact plan hash; preserves provenance and worker gates |
| `resource_inspect` | Inspect a saved plan or run and native artifact evidence | Read only; no implicit retry or provider request |
| `resource_cancel` | Request cancellation of the run's managed native jobs | Inspect the same run for its actual outcome |
| `design_catalog` | Read supported applications, licenses and deployment constraints | Read only; no download or installation |
| `design_plan` | Save an exact package/artifact installation plan | Stable ID; missing target, pin or prerequisite produces a blocked plan |
| `design_install` | Submit the reviewed plan as a durable host job | Stable ID plus exact plan hash; applicable host grant required |
| `design_inspect` | Inspect an installation plan, job and proof | Read only; a receipt alone does not mean software is installed |

The adapter omits the baseline local MCP's raw snapshots, worker leases and internal
accounting operations. The host tools can execute arbitrary owner-authorized
commands when the server is explicitly configured and the selected scope is
granted. They preserve the OS user's privileges and do not isolate hostile users.
See the [SSH/tmux runbook](../deploy/SSH_TMUX_AUTOCONTROL.md) for policy, actual native
assistant IDs, command files, cancellation and restart behavior. This code does not
register a ChatGPT connection or expose a browser-accessible control token.

Model operations require a managed local-only Ollama daemon. An employee ID is a
scope selection under the authenticated owner credential; it is not a separate
employee login. No tool accepts an arbitrary model-server URL. Inspect
`model_pool_status`, request a catalog model, poll its request receipt to `ready`,
then select its digest before creating a self-hosted job with the same model.
Once resource enforcement is enabled, register the installed digest and explicit
`assign`/`use` grants before selecting or executing it, as described below.
After an uncertain download response, retain the original `idempotencyKey` and body.
Infrastructure costs remain outside the token-price ledger. See the
[shared model deployment guide](../deploy/MODEL_POOL.md) for exact request shapes,
VPS/Vast placement, storage bounds and cancellation behavior.

`runtime_status` also returns the optional website device connection's
configured/connected flags, revision and a generic error. It does not expose or
create a pairing. Configure [the private cloud device adapter](../deploy/CLOUD_DEVICE_SYNC.md)
on the server after restoring the intended workspace and transferring writer ownership.

## Managed environments

The environment service exposes these exact MCP input shapes; braces here describe
fields, not a second transport protocol:

| Tool | Input |
| --- | --- |
| `environment_status` | `{}` |
| `environment_prepare` | `{id, companyId, employeeId, environmentId}` |
| `environment_inspect` | `{id}` using the prepare/run operation ID, not `environmentId` |
| `environment_run` | `{id, companyId, employeeId, environmentId, command, cwd, timeoutSeconds?, maxOutputBytes?}` |

`command` is **Python source**, not a shell command. For example, after preparing
and verifying the intended environment:

```json
{
  "id": "python-check-unique-id",
  "companyId": "EXISTING_COMPANY_ID",
  "employeeId": "EXISTING_EMPLOYEE_ID",
  "environmentId": "PREPARED_ENVIRONMENT_ID",
  "command": "import sys\nprint(sys.prefix)\nprint(sys.base_prefix)",
  "cwd": "/workspace",
  "timeoutSeconds": 30,
  "maxOutputBytes": 65536
}
```

Replace the identifiers and directory with records and a path from the intended
runtime. `environment_prepare` returns a job receipt first. Inspect until the
environment has a verified readiness record; creation submission is not readiness.
The runtime verifies the copied interpreter, its recorded identity, and a real
virtualenv prefix distinct from the base interpreter before managed execution.
Runs use the environment's absolute interpreter, scrub inherited variables, set
`PIP_REQUIRE_VIRTUALENV` and `PYTHONNOUSERSITE`, and do not invoke global pip.
There is no automatic requirements-file installer in this API. System-level
administration remains an explicit host operation, outside the Python environment.

Host opt-in, manual/auto policy and current company/employee grants apply to both
prepare and run. In manual mode approve the returned `job.hostJobId` with
`host_approve`; cancellation uses `host_cancel` for that same host job. The
environment API has no separate cancel tool. Inspect output is one bounded chunk;
use `host_inspect` with the host job ID and byte offset for subsequent output.
Source is limited to 64 KiB, execution to 86,400 seconds and saved output to 8 MiB;
defaults are 1,800 seconds and 1 MiB. The registry bounds are 128 environments and
256 operation receipts. These limits do not turn Python into an OS sandbox.

## Model resources, sharing and expert routes

`resource_configure` accepts
`{expectedRevision, resources, grants, routes, officeParents?}`. It is a complete
replacement, not a patch: read the current revision and preserve every resource,
grant and route that should remain. Omitting `officeParents` supplies an empty
grouping. The first successful explicit configuration enables enforcement. An
uncertain write fences the gate until the service is reopened and its state is
reviewed; it cannot silently revert to the initial unrestricted setting.

| Record | Required fields and supported values |
| --- | --- |
| Resource | `{id, companyId, ownerScope:{kind,id}, model, digest}`; an installed, verified Ollama model with an exact SHA-256 digest |
| Grant | `{id, resourceId, targetScope:{kind,id}, permissions}`; permissions are `use`, `assign`, `inspect`; optional `includeDescendants` and `membershipRevision` |
| Route | `{id, companyId, strategy, experts, limits}`; strategy `single` or `ensemble`; optional `aggregator` |
| Expert or aggregator | `{employeeId, resourceId, officeId, departmentId}`; `departmentId` may be null; optional `serviceContractId` |
| Route limits | `{maxTokens, maxMinutes, maxParallel}`; at most 1,000,000 tokens, 1,440 minutes and parallelism 1 or 2 |
| Office grouping | `{officeId, parentOfficeId}` entries; parent may be null; a validated sidecar grouping, not a new native office hierarchy |

Scope kinds are `company`, `office`, `department` and `employee`. Company and
department parents come from native state. Native offices remain flat; the
sidecar grouping does not invent suboffice execution authority. Descendant grants
capture reviewed membership. New or reparented descendants do not silently gain
access; deliberate membership revision is required. Current native eligibility,
service contracts, grant revocation and installed-digest drift are checked again
before dispatch. A role title alone does not authorize execution.

The working sequence is:

1. Read `model_pool_status`; request a reviewed model with `model_pool_request`
   and inspect its request until ready. This stages shared bytes on the current
   host and does not create assignment or execution authority.
2. Read `resource_status`, then register the observed installed digest, explicit
   grants and any routes with `resource_configure`. Preserve the other companies'
   intended grants in this replacement.
3. Use `model_pool_select` under an `assign` grant. Use `resource_resolve` with
   `{companyId, employeeId, resourceId, purpose}` to inspect `use`, `assign` or
   `inspect` permission. Planning also requires the expert's matching assignment.
4. Call `resource_plan` with
   `{id, companyId, employeeId, routeId, task}`. Review the returned plan and
   `planHash`.
5. Call `resource_start` with `{id, planId, expectedPlanHash}`. Inspect that run ID
   using `resource_inspect`; `resource_cancel` requests cancellation. Workers must
   be enabled separately for queued, authorized native jobs to execute.

The resource registry supports 512 resources, 2,048 grants, 128 routes and bounded
plan/run receipt storage. Each route has one to four distinct experts and may
have a distinct synthesis employee. A single route uses exactly one expert and
no aggregator. Native dependencies and artifact receipts retain employee/model
provenance. These are **request-routing and ensemble workflows**, not training,
merging or creating new MoE weights. Unsupported training strategies are rejected.
The registry shares the current host's Ollama cache; it does not replicate model
files automatically across unrelated VPSs.

After enforcement is enabled, legacy HTTP model selection, workbench model
selection, MCP model operations and managed Ollama worker dispatch use this same
gate. Unscoped legacy Ollama projects cannot start or resume; an already active
legacy project checks again before another generation. Use the scoped resource
workflow. Budgeted OpenAI/Anthropic legacy project runs remain available. Explicit
owner host administration remains broader OS authority and is not converted into
an isolated model-service identity by these application policies.

## Design applications

`design_catalog` takes `{}`. `design_plan` takes
`{id, companyId, employeeId, toolId, target?, packageVersion?, artifact?, timeoutSeconds?, maxOutputBytes?}`.
The `target` is `{distribution, versionId, arch}` with distribution `debian` or
`ubuntu`, the exact target version, and architecture `x86_64` or `aarch64`.

| Tool ID | Concrete installation path | Current boundary |
| --- | --- | --- |
| `blender`, `gimp`, `krita`, `inkscape` | Exact `packageVersion` from reviewed official signed Debian/Ubuntu indexes | Runtime must already be root in the intended container; no interactive sudo |
| `godot4` | `artifact:{version,url,sha256,maxBytes}` for an exact official Godot 4 stable Linux release | Matching architecture, reviewed SHA-256, bounded official HTTPS redirects and streamed extraction |
| `penpot` | Catalog and blocked deployment plan | Reviewed Compose import with pinned image digests is not yet implemented |

Missing target/pins or an unavailable prerequisite produces a saved blocked plan;
no version, digest or GPU compatibility is invented. Planning never downloads or
starts an application. `design_install({id,planId,expectedPlanHash})` explicitly
submits the reviewed plan through host control. `design_inspect({id})` reads the
plan or installation job. Manual policy, host approval/cancellation, current
native scope and grants follow the same host receipt flow as environment jobs.
Installation success needs matching proof; a queued, uncertain or failed job is
not an installed application.

These apps use recorded distribution or portable application runtimes, not
project Python virtualenvs. Installing an app does not configure a graphical
desktop, run a GPU workload, install Figma/Photoshop, or guarantee file-format
compatibility. See [the design-toolchain runbook](../deploy/DESIGN_TOOLCHAIN.md)
for package authentication, dependency/disk ceilings, checksum handling and the
separate display/GPU acceptance checks.

## Shared transport and ownership boundary

The daemon exposes the same services over authenticated HTTP and the VS Code
workbench. Environment routes are `GET /v1/environments` and
`POST /v1/environments/{prepare,run,inspect}`. Resource routes are
`GET /v1/resources` and `POST /v1/resources/{status,configure,resolve,plan,start,inspect,cancel}`.
Design routes are `GET /v1/design` and
`POST /v1/design/{plan,install,inspect}`. The brace forms list fixed routes; clients
must choose one operation. Corresponding workbench methods use camel case, such
as `environmentRun`, `resourceStart` and `designInstall`.

All of these endpoints use the owner's runtime credential. Company, office,
department and employee IDs are canonical ownership/attribution and managed-policy
selectors; they are not independent tenant logins. Root in a rented container
controls that container, not the provider's underlying physical host. None of
these tools changes ChatGPT, VS Code or operating-system approval policy.

Keep stable IDs and exact request bodies after uncertain delivery. Changed bodies
conflict; an uncertain operation is not a reason to mint a fresh ID. Inspect the
saved receipt first. Receipt limits require deliberate archival instead of silent
eviction. Model/output text is untrusted data and does not authorize a follow-up
tool call.

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

The current VS Code extension metadata is **0.9.0**. Final installed Linux and
Windows package CI is **pending** for this source revision; older release passes
do not establish acceptance of this package. The current source does not establish
a real GPU check, a design-software installation, or an authorized ChatGPT
connection. The owner's Vast instance remains stopped; source delivery must not
resume it. See [the primary VS Code handoff](../project/VSCODE_PRIMARY_PRODUCT.md)
for the platform lifecycle and final acceptance gates.

From the repository root, after the native core and portable runtime build:

```bash
node --test tools/daftar-runtime-mcp.test.mjs
node --test headless-runtime/test/managed-wiring.test.mjs headless-runtime/test/workbench-resource-gate.test.mjs
node scripts/smoke-runtime-mcp.mjs
```

The smoke command launches a real native-backed HTTP daemon and a real stdio adapter in temporary synthetic state. It checks discovery, command application, replay, stale-state rejection, metadata filtering and process independence. It never connects an owner's workspace or invokes a model provider.
