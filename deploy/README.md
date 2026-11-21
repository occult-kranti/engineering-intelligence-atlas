# Run Daftar's headless office on a Linux VPS

This pack runs the new Node headless service and the existing Rust office core on one Linux machine. It keeps office state and generated artifacts in a persistent volume. Workers start **paused on every service start**, so starting a server does not start provider work.

The existing website is a separate **Sites/Cloudflare D1** application. This image does not serve that website or migrate its database. An optional, default-off [cloud device adapter](CLOUD_DEVICE_SYNC.md) can synchronize the restored runtime workspace through the website's existing paired-writer protocol. It requires an owner-issued device pairing and deliberate writer migration. The current desktop also keeps its own local state; do not run both as competing writers. The included stdio MCP adapter already targets this runtime's API. See [the cloud runtime plan](../project/CLOUD_RUNTIME_PLAN.md) for the client boundaries.

## What is included

| Component | Location or behavior |
| --- | --- |
| Service | `node /app/headless-runtime/server.mjs` |
| Native core | `/app/native-core/target/release/atlas-core` |
| Packaged company seeds and role references | `/app/company/`, read-only image content |
| Durable office state | `/var/lib/daftar/company/` |
| Durable job artifacts | `/var/lib/daftar/office-artifacts/` |
| Shared model request receipts and assignments | `/var/lib/daftar/model-pool/`; separate from office state hash |
| Optional website pairing | `DAFTAR_CLOUD_SYNC=1`; private source credential and separate encryption-key files; default off |
| Public, nonsecret liveness check | `GET /healthz`; it does not check provider readiness |
| Protected control API | `GET /v1/status`, `GET /v1/office`, `POST /v1/commands`, `POST /v1/workers` |
| Owner credential | Protected file `/run/secrets/control-token` |
| First operator access | Host loopback through SSH; stdio MCP locally or over SSH |
| Supported provider adapters | OpenAI, Anthropic, and the runtime's loopback Ollama adapter |
| Vast inference adapter | Planned separately; do not substitute a Vast key for an OpenAI key |

The runtime implements bounded office commands and provider jobs. It does not provide arbitrary shell execution, desktop GUI control, or an unrestricted cloud-account administration API.

## 1. Prepare the host

Use a Linux VPS or a **Vast VM-capable instance**, with a checkout containing this deployment pack. Commands below run from the repository root. The examples assume rootful Docker Engine on Linux, Docker Compose v2, Python 3, and an SSH account permitted to operate Docker. Install Docker Engine and its Compose plugin using the [official Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/) for your supported Ubuntu release.

A starting sizing estimate is 4 vCPU, 8 GiB RAM, and 80–160 GB SSD when inference runs elsewhere. This is a planning estimate, not a measured capacity claim. Compose currently caps this one service at 2 CPUs, 2 GiB memory, and 128 processes; adjust those values only after observing its workload. The configured worker concurrency is 1–4, initially 2.

```bash
docker version
docker compose version
python3 --version
cp deploy/.env.example deploy/.env
```

The build uses Node 24 and Rust 1.100.0 images, plus the repository's `package-lock.json` and `Cargo.lock`. Native source declares Rust 1.89 as its minimum. Images use release tags; resolve reviewed image digests in your release pipeline when publishing a production image.

Validate and build the image before creating runtime credentials:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build
```

No owner or provider credential is required to build. The build context allows only explicit runtime inputs and excludes `deploy/secrets`; directory permissions stay private on subsequent rebuilds too. Keep `.dockerignore` with the reviewed source checkout. Its exception patterns intentionally use literal paths or complete subtrees so BuildKit can skip protected directories without opening them. See [Docker build-context rules](https://docs.docker.com/build/concepts/context/) and the [BuildKit filesystem filter](https://github.com/tonistiigi/fsutil/blob/master/filter.go).

## 2. Create the control credential

```bash
sudo python3 deploy/manage-secrets.py init
```

This creates a random token without displaying it, under `deploy/secrets/control-token`. The Linux container runs as UID/GID **10001:10001**. The initializer sets that ownership, directory mode `0700`, and file mode `0400`. Existing secrets are not overwritten unless `--replace` is explicitly supplied. It rejects symlinks and does not contact any provider.

Compose mounts the directory read-only. This intentionally uses real host file permissions rather than relying on file-backed Compose secret UID/mode remapping. For rootless Docker or a user-namespace deployment, adapt the host UID mapping before starting; the supplied ownership is for the reference rootful Linux installation.

Optional provider credentials can be entered through hidden terminal prompts:

```bash
sudo python3 deploy/manage-secrets.py set openai
sudo python3 deploy/manage-secrets.py set anthropic
```

Run only the commands for providers you intend to use. Then set their **file paths**, not key values, in `deploy/.env`:

```dotenv
OPENAI_API_KEY_FILE=/run/secrets/openai-api-key
ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic-api-key
```

Leave unused provider variables blank. The optional GitHub credential uses `set github` and `GITHUB_TOKEN_FILE=/run/secrets/github-token`; it enables the runtime's existing bounded GitHub operations. Keep organization-wide cloud provisioning credentials outside this runtime until the corresponding scoped adapter exists.

## 3. Start the built image, still paused

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --no-build
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
curl --fail --silent --show-error http://127.0.0.1:8788/healthz
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs status
```

Check that the protected status reports workers disabled. Missing native binaries or an unreadable control credential prevent startup. Provider and GitHub credentials are validated when used. An image health check only confirms that the HTTP service answers; a successful provider job must be verified separately after credentials and job authorization are configured.

The only published host port is **`127.0.0.1:8788`**. The service listens on `0.0.0.0` inside its container because Docker forwards to the container interface; this is explicitly enabled with `DAFTAR_ALLOW_CONTAINER_BIND=1`. Host binding remains loopback. There is no public reverse proxy in the default configuration. The container has a read-only root filesystem, no Linux capabilities, no Docker socket, and a bounded writable `/tmp` tmpfs.

## 4. Operate the runtime

Use the operator helper to read the token from its file rather than placing a token in a command argument or shell history:

```bash
# Inspect the projected office state.
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs office

# Enable provider work only after the relevant jobs and budgets are configured.
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs resume

# Stop admitting further worker work.
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs pause

# Inspect service diagnostics and current execution state.
docker compose --env-file deploy/.env -f deploy/compose.yaml logs --tail 100 runtime
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs status
```

Pausing admission requests cancellation and does not imply that all currently active jobs have finished. An already-entered managed GitHub action may finish after a pause, including if its internal preflight was still running when cancellation arrived. Inspect the active job IDs before maintenance. Service shutdown aborts active provider requests and allows a bounded settlement period; later native lease recovery handles an unconfirmed attempt. A restart always returns to paused mode.

### SSH and MCP access

For a local operator HTTP session, forward the port from a trusted workstation:

```bash
ssh -N -L 127.0.0.1:8788:127.0.0.1:8788 daftar-vps
```

Here `daftar-vps` is an SSH host alias configured by the operator. Accessing protected endpoints still requires the owner token; do not copy it into browser application code.

A stdio MCP client can invoke the adapter **inside the running container over SSH**, keeping the control token on the VPS:

```bash
ssh -T daftar-vps docker compose --env-file /opt/daftar/deploy/.env -f /opt/daftar/deploy/compose.yaml exec -T -e DAFTAR_RUNTIME_URL=http://127.0.0.1:8788 runtime node /app/tools/daftar-runtime-mcp.mjs
```

Adjust `/opt/daftar` to the actual checkout path. The adapter expects newline-delimited MCP messages on standard input; it is not an interactive terminal command. It exposes the office/worker tools and four scoped model-pool tools documented in the runtime MCP guide.

ChatGPT remote custom apps require their supported remote MCP connection route. This deployment's port 8788 is a REST control API, **not a remote HTTP MCP endpoint**. Use the official supported secure MCP tunnel where available, or implement the planned HTTPS MCP/OAuth gateway. The stdio adapter alone does not register a ChatGPT app. See the [runtime MCP guide](../tools/DAFTAR_RUNTIME_MCP.md) and [cloud runtime plan](../project/CLOUD_RUNTIME_PLAN.md) for current client-specific setup and limitations.

### Credential rotation

```bash
sudo python3 deploy/manage-secrets.py init --replace
docker compose --env-file deploy/.env -f deploy/compose.yaml restart runtime
```

This rotates only the owner token. Clients with an old copy must be updated; the in-container MCP adapter reads the new file. The restarted runtime is paused. Use `set openai --replace`, for example, to intentionally replace one provider credential.

## 5. Back up and restore state

The named volume is `daftar_runtime_data` by default. It survives container replacement and ordinary `docker compose down`. **`docker compose down -v` deletes it.** Keep backups off the VPS or Vast host as well as locally. Credentials require their own protected recovery procedure; the following archive contains only runtime state and artifacts.

After pausing and checking active jobs, stop the service for a consistent archive:

```bash
install -d -m 0700 deploy/backups
docker compose --env-file deploy/.env -f deploy/compose.yaml stop runtime
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm --no-deps -T --entrypoint tar runtime -C /var/lib/daftar -czf - . > deploy/backups/daftar-state.tar.gz
chmod 0600 deploy/backups/daftar-state.tar.gz
tar -tzf deploy/backups/daftar-state.tar.gz > /dev/null
docker compose --env-file deploy/.env -f deploy/compose.yaml start runtime
```

Choose a new archive filename for each retained backup. Confirm that each command succeeded before continuing. Restarting leaves execution paused. Archive readability is only a preliminary check: periodically restore to a separate volume and verify office state and referenced artifacts.

To restore, stop the runtime, change `DAFTAR_VOLUME_NAME` in `deploy/.env` to a **new volume name**, and extract into that new volume:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm --no-deps -T --entrypoint tar runtime -C /var/lib/daftar -xzpf - < deploy/backups/daftar-state.tar.gz
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --no-build --force-recreate
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs office
```

Preserve the original volume until the restored state is verified. Do not merge an archive into an active state directory. The current runtime uses Rust-managed files; this pack does not add PostgreSQL or Redis that the application does not yet use.

## 6. Update or roll back

Back up first. Check out the reviewed source version, rebuild the image, then recreate the service:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml build
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --force-recreate
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T runtime node /app/deploy/runtime-request.mjs status
```

Leave the existing `deploy/secrets` directory at mode `0700` and its credentials at `0400` while rebuilding. The allowlist excludes that directory before traversal; no credential removal, permission change, or privileged build is necessary. CI exercises a second build after initializing protected synthetic secrets to check this upgrade path. If a modified allowlist causes a permission error, restore the reviewed `.dockerignore` instead of making the credentials readable to the build client.

Do not assume that an older binary can read state written by a newer version. For a rollback that changes state format, restore the matching backup into a separate volume along with the older reviewed image/source. Record the source commit, image identity, and backup filename together in the deployment record.

## 7. Vast.ai specifics

For shared model downloads and inference on existing hardware, use the [model-pool deployment guide](MODEL_POOL.md). Its optional `compose.ollama.yaml` keeps Ollama on private loopback, persists model bytes separately, and disables Ollama cloud; a separate GPU overlay supports an already-configured NVIDIA host. No weights or infrastructure are provisioned by merely adding these files.

For the whole headless service, choose a Vast **VM** template that supports Docker Compose. Ordinary Vast Docker rentals are already containers and do not provide the same nested-container/systemd capabilities. The [official VM documentation](https://docs.vast.ai/guides/instances/virtual-machines) distinguishes these environments.

Run the same Compose setup inside the VM and connect over its published SSH address. Do not assume a Vast internal port and public port are equal: consult the instance's actual [network mapping](https://docs.vast.ai/guides/instances/connect/networking). The runtime stays on the VM's loopback interface.

Keep state backups outside that host. Vast [container storage and local volumes](https://docs.vast.ai/guides/instances/storage/types) have different deletion behavior; a local volume stays tied to one physical machine. The VM's built-in copy mechanism also differs from container cloud sync. Use a backup program from inside the VM when exporting the runtime archive to independent storage.

For a stable long-running installation, keep this control service on a CPU VPS and add replaceable Vast GPU workers later. The planned provider adapter must account for [Serverless billing by worker state](https://docs.vast.ai/guides/serverless/pricing), model-load time, storage, and network charges. This deployment pack does not rent a GPU, create an endpoint, or start a paid cloud instance.

## Optional: run under systemd without Docker

Use a checkout at `/opt/daftar`, Node 24, Rust 1.89 or newer, and a dedicated `daftar` system account. Build before installing the service:

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm --prefix desktop-shell ci --no-audit --no-fund
node desktop-shell/node_modules/typescript/bin/tsc -p headless-runtime/tsconfig.json
cargo build --release --locked --manifest-path native-core/Cargo.toml
npm --prefix desktop-shell prune --omit=dev --no-audit --no-fund
```

Create the account if it does not already exist, then install the configuration:

```bash
sudo useradd --system --user-group --create-home --home-dir /var/lib/daftar --shell /usr/sbin/nologin daftar
sudo install -d -m 0755 /etc/daftar
sudo python3 deploy/manage-secrets.py init --directory /etc/daftar/secrets --uid "$(id -u daftar)" --gid "$(id -g daftar)"
sudo install -m 0640 deploy/systemd/runtime.env.example /etc/daftar/runtime.env
sudo install -m 0644 deploy/systemd/daftar-runtime.service /etc/systemd/system/daftar-runtime.service
```

The unit uses `/usr/bin/node`; replace it with your installed Node 24 executable's absolute path if needed. Ensure `/opt/daftar` is readable by the service account. Add only the configured provider file paths to `/etc/daftar/runtime.env`. Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now daftar-runtime
sudo systemctl status daftar-runtime
curl --fail --silent --show-error http://127.0.0.1:8788/healthz
```

Run **one service per state directory**. Do not run this systemd service alongside the Compose service on the same port/state. The systemd alternative also starts paused and keeps its root filesystem read-only except for the designated state directory and private temporary storage.

## Verification record

This pack was prepared in an environment without Docker Engine. Local checks passed for Compose YAML parsing and the intended loopback/nonroot/read-only configuration, Node/Python helper syntax, and secret initialization (private permissions, hidden output, duplicate rejection, deliberate rotation, and symlink rejection). The systemd template requires `/usr/bin/node` on the target host; that executable path is absent in this development environment, so the template must be checked after installing Node or adjusting `ExecStart` as described above.

An actual image build, container boot, image health transition, host reboot, backup/restore, and deployment on Vast/VPS remain deployment gates. Consult the repository's runtime validation report for the separate native/HTTP/MCP checks; do not treat those checks as proof of a cloud deployment.
