# Donna host control over SSH and tmux

Daftar can run directly inside an existing Linux VPS or rented GPU container. You can operate it from an SSH terminal; no IDE is required. The launcher keeps the headless runtime in its own tmux server, and the owner CLI submits durable, attributed host jobs through the authenticated runtime API. Existing website and desktop clients remain separate clients; this launcher does not replace their UI or publish a website.

## What “auto” controls

Host control executes owner-authorized shell commands with the OS privileges of the Daftar runtime account. If that account is root inside a Vast container, commands have root privileges **inside that container** and its accessible mounts. This does not grant control of the physical host, another customer's container, the hypervisor, or the Vast account itself.

There are two separate switches:

1. `--enable-host-control`, or `DAFTAR_HOST_CONTROL=1` in the private configuration file, enables the host-control subsystem in the daemon process.
2. An owner policy selects `off`, `manual`, or `auto`, and names the company or employee grants. A new policy starts `off`. In `manual`, submitted jobs need approval; in `auto`, eligible jobs within the configured grants can start without a separate approval call.

Donna, sub-Donnas, and employees must use actual canonical office identities and be eligible in the office state. A grant with `employeeId: null` covers eligible employees of that company; an employee ID narrows the grant. Shared work still follows the runtime's canonical employee and active shared-service eligibility rules. A display name, visiting badge, or UI selection is not a grant.

The owner token authenticates the caller. Company and employee IDs attribute and authorize the requested scope; they are **not independently authenticated employee logins**. Host commands can use the account's full filesystem and process privileges. This is trusted-owner automation, not an OS sandbox between companies. Use separate OS users, containers, or VPS instances when companies require isolation.

## 1. Connect to the actual rented instance

Copy the current SSH command from the instance's connection panel. IPs, ports, and SSH keys vary by instance; this guide does not assume that previously pasted connection details remain valid. Keep the private SSH key on your own machine.

For an authenticated, read-only account check, use
`python3 deploy/vast-status.py --api-key-file /absolute/private/vast-api-key`.
The file must be a regular owner-owned 0400/0600 file. Add `--instance INSTANCE_ID`
to select a record from the returned page. This utility reports pagination and
allowlisted API metadata; it does not connect SSH or establish GPU readiness.

Once connected, inspect the machine before downloading models or changing its environment:

```sh
pwd
nvidia-smi
df -h /workspace
node --version
tmux -V
rustc --version
```

The runtime requires Node 22 or later, the checked-in TypeScript dependencies, and its Rust core (Rust 1.89 or later). `nvidia-smi` checks the remote GPU; a forwarded web port does not establish GPU availability. A successful SSH login in another terminal does not automatically attach this ChatGPT conversation to the server.

## 2. Obtain and build the checkout

Use an existing checkout when continuing work. For a new checkout, the current project and working branch are:

```sh
git clone --branch design/infinite-blueprint-canvas \
  https://github.com/occult-kranti/engineering-intelligence-atlas.git /workspace/daftar
cd /workspace/daftar
git status --short --branch
```

Authenticate Git with your normal private credential mechanism if the repository requires it. Do not put a token in the repository URL or commit credential files. Review local edits before switching branches or updating an existing checkout.

Install the locked dependencies deliberately, then request the build explicitly:

```sh
npm --prefix desktop-shell ci --ignore-scripts
node deploy/tmux-runtime.mjs start \
  --repo /workspace/daftar \
  --data /workspace/daftar-state \
  --build \
  --enable-host-control
```

`--build` runs the locked Cargo release build and the portable TypeScript build. It never installs npm packages. Omit `--build` when those artifacts already exist. Starting a daemon does not start provider office workers; their existing pause/resume control remains separate.

The data directory must be private (0700). The launcher creates it if absent, creates a private owner token at `/workspace/daftar-state/secrets/control-token` when none is configured, and records only configuration and secret-file paths in a 0600 supervisor file. It never prints the token. Use a persistent mounted location for `--data` if your provider's container storage is disposable.

The output distinguishes a running tmux session from API readiness. Verify the API next:

```sh
export DAFTAR_RUNTIME_URL=http://127.0.0.1:8788
export DAFTAR_CONTROL_TOKEN_FILE=/workspace/daftar-state/secrets/control-token
node deploy/host-control.mjs status
node deploy/runtime-request.mjs office
```

These exports contain a URL and a file path, not secret values. `host-control status` shows availability, policy revision, mode, grants, job summaries, and limits. The office request provides the actual company and employee IDs to use.

## Optional provider and model configuration

To retain provider-key paths and other supported settings across SSH disconnects, use a private environment file. The launcher parses this file as data; it does not source it as shell code. It does not forward arbitrary credentials from your login shell into the tmux daemon.

```sh
umask 077
cat > /workspace/daftar-runtime.env <<'EOF'
DAFTAR_PORT=8788
DAFTAR_CONCURRENCY=2
ANTHROPIC_API_KEY_FILE=/workspace/private/anthropic-key
OPENAI_API_KEY_FILE=/workspace/private/openai-key
GITHUB_TOKEN_FILE=/workspace/private/github-token
EOF
chmod 600 /workspace/daftar-runtime.env
```

Only include the provider entries you have created. Their secret files must be private regular files (0400/0600). Put each actual value in its corresponding file using your existing private provisioning process. Inline `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and similar raw secret settings are rejected by the launcher.

After a deliberate stop, start with the file:

```sh
node deploy/tmux-runtime.mjs start \
  --repo /workspace/daftar \
  --data /workspace/daftar-state \
  --env-file /workspace/daftar-runtime.env \
  --enable-host-control
```

Supported settings include `DAFTAR_CONTROL_TOKEN_FILE`, `DAFTAR_CORE_BINARY`, port/concurrency, the provider file paths above, the existing `DAFTAR_OLLAMA_BASE_URL` and `DAFTAR_OLLAMA_LOCAL_ONLY` options, and the existing cloud device pairing options documented in [CLOUD_DEVICE_SYNC.md](CLOUD_DEVICE_SYNC.md). The launcher binds the runtime to `127.0.0.1`; public bind settings and arbitrary environment keys are rejected.

Model downloads can be owner-submitted host jobs. Inspect GPU support, free disk, the model license, and the intended destination before running them. The [shared local model pool](MODEL_POOL.md) is the existing way to assign supported installed models to eligible employees. Downloading a model file alone does not register it with an inference server or make the website use it. Hosted API credentials do not provide downloadable hosted-model weights.

## 3. Enable a specific auto-control scope

Read `host-control status`, copy its current `host.revision`, and obtain company/employee IDs from the office state. Save a policy file, replacing the placeholders. The `0` below is only valid for a fresh policy that reports revision 0.

```json
{
  "expectedRevision": 0,
  "mode": "auto",
  "grants": [
    {
      "id": "donna-host-operations",
      "companyId": "COPY_COMPANY_ID",
      "employeeId": "COPY_EMPLOYEE_ID"
    }
  ]
}
```

```sh
node deploy/host-control.mjs configure --file /workspace/host-policy.json
```

Configuration replaces the full grant list and compares `expectedRevision` with current state. A stale revision fails; the CLI never fetches a new revision and silently overwrites another owner's changes. To grant an entire eligible company, use `"employeeId": null` in that company's grant. To require per-job approval, change mode to `manual` with the actual current revision.

## 4. Submit commands without shell-escaping surprises

Put the actual command in a file. The CLI reads its contents literally and sends one request. The following diagnostic command does not download a model or change the machine:

```sh
cat > /workspace/host-check.sh <<'EOF'
pwd
id
df -h /workspace
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi
else
  printf '%s\n' 'nvidia-smi is not installed or is not on PATH'
fi
EOF

node deploy/host-control.mjs run \
  --id host-check-001 \
  --company COPY_COMPANY_ID \
  --employee COPY_EMPLOYEE_ID \
  --cwd /workspace \
  --command-file /workspace/host-check.sh \
  --timeout-seconds 60 \
  --max-output-bytes 1048576
```

For piped input, use `--command-file -`. For an already prepared job envelope, use `run --file /absolute/job.json`, or `run --file -` with piped JSON. The envelope fields are `id`, `companyId`, `employeeId`, `command`, `cwd`, and optional `timeoutSeconds`/`maxOutputBytes`. There is no `--command` or `--token` option.

Job submission returns a stable ID and current job state promptly. It does not hold the terminal or an MCP call open until a long model download finishes. A client timeout does not prove that submission failed: inspect the original ID and retain its exact body. The client does not retry automatically; do not make a new ID merely because a response was lost.

```sh
node deploy/host-control.mjs inspect --id host-check-001
node deploy/host-control.mjs inspect --id host-check-001 --offset 65536
node deploy/host-control.mjs approve --id host-check-001
node deploy/host-control.mjs cancel --id host-check-001
node deploy/host-control.mjs stop-all
```

Use `approve` for a job awaiting manual approval. Inspection returns bounded output and `nextOffset`; use that returned offset for the next read instead of assuming the example value. Job output can contain anything the command prints, so keep private material out of command output. Cancellation and stopping work should be verified by inspecting status afterward.

Current engine bounds are 64 KiB per command, 256 retained jobs, 256 grants, a 1–86,400-second timeout (default 1,800), up to 8 MiB of retained output per job (default 1 MiB), and at most 64 KiB per inspection chunk. The server validates these bounds; the CLI also bounds input to 256 KiB. The status response remains the live source for supported limits.

## 5. Leave SSH, reconnect, and stop deliberately

```sh
node deploy/tmux-runtime.mjs status --data /workspace/daftar-state
node deploy/tmux-runtime.mjs attach --data /workspace/daftar-state
```

Detach from tmux with **Ctrl+B**, then **D**. Closing the SSH connection leaves the detached daemon running. The launcher uses a dedicated `daftar-runtime-…` socket and a `runtime` session. It never kills your normal tmux server or unrelated sessions. Repeating `start` returns the existing session and leaves its configuration and token intact; apply configuration changes with a deliberate stop/start.

Daemon stdout/stderr are stored at `/workspace/daftar-state/supervisor/runtime.log`, with three rotated segments. Each segment is capped at 1 MiB and uses private permissions. Use `tail -n 100` on the log when startup fails. This log is separate from host-job output and the job ledger.

Stopping the API daemon and cancelling host work are separate operations. Host jobs may have their own durable tmux sessions and can continue when the API restarts. If you intend to cancel host work as well, do so while the API is still available:

```sh
node deploy/host-control.mjs stop-all
node deploy/host-control.mjs status
node deploy/tmux-runtime.mjs stop --data /workspace/daftar-state
```

The supervisor asks the managed runtime to shut down, allows a bounded grace period, and terminates only its child daemon if that child does not exit. It does not restart the daemon after a crash, replay commands, reboot the instance, or survive a host reboot as a running process. For automatic daemon startup after a machine reboot, adapt the existing [systemd service](systemd/daftar-runtime.service) on a host that actually runs systemd. Back up the persistent data directory and protected credential files separately before destroying a rented instance.

## MCP and ChatGPT access

The same owner-authenticated host operations are exposed by the existing stdio adapter, `tools/daftar-runtime-mcp.mjs`. A local MCP-capable client may invoke it over your configured SSH alias while the control token stays on the VPS:

```sh
ssh -T YOUR_CONFIGURED_SSH_ALIAS \
  env DAFTAR_RUNTIME_URL=http://127.0.0.1:8788 \
      DAFTAR_CONTROL_TOKEN_FILE=/workspace/daftar-state/secrets/control-token \
  node /workspace/daftar/tools/daftar-runtime-mcp.mjs
```

This command is a stdio MCP transport for a client, not an interactive shell. Use the actual configured SSH host/key/port and installed repository path. The host tool family supports status, policy configuration, submission, approval, inspection, cancellation, and stopping all host jobs. For long jobs, submit once and inspect by ID in later calls.

ChatGPT web access additionally needs its supported MCP connection route. Follow the current Secure MCP Tunnel setup in [DAFTAR_RUNTIME_MCP.md](../tools/DAFTAR_RUNTIME_MCP.md) for the stdio adapter and your account. The REST server on port 8788 is not an HTTP MCP server, and an SSH login or local port forward alone does not install a ChatGPT app or grant this conversation access. Do not expose an unauthenticated shell service or put the owner token in browser frontend code.

## Continuing in VS Code later

VS Code Remote SSH is optional. Connect it to the same host and open the existing `/workspace/daftar` checkout to continue on `design/infinite-blueprint-canvas`; use `git status --short --branch` to verify local work first. The CLI, persistent runtime, and job IDs continue to work independently of that editor. Git publication and any live-server deployment must be verified separately; the existence of these scripts is not a claim that either happened.

## Verification

```sh
node --test deploy/test/host-control-cli.test.mjs
DAFTAR_REQUIRE_TMUX=1 node --test deploy/test/tmux-runtime.test.mjs
```

The supervisor tests first try creating an isolated real tmux session. Restricted executors may prohibit Unix sockets despite having a working `tmux -V`; local tests report that capability as an explicit skip. `DAFTAR_REQUIRE_TMUX=1` makes the missing capability a failure for VPS/CI acceptance. The separate tmux simulator test verifies argument construction and private-state behavior, and is not evidence that native tmux works on a particular server. These tests never connect to Vast or another external service.
