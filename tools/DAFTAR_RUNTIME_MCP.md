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
node scripts/smoke-runtime-mcp.mjs
```

The second command launches a real native-backed HTTP daemon and a real stdio adapter in temporary synthetic state. It checks discovery, command application, replay, stale-state rejection, metadata filtering and process independence. It never connects an owner's workspace or invokes a model provider.
