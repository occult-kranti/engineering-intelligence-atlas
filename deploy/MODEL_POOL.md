# Shared self-hosted models on a VPS or Vast VM

Daftar now has an owner-operated model pool for a managed Ollama daemon. Download a reviewed model once per daemon, assign its verified digest to employees, and use that same installed model in their scoped jobs. Company prompts, artifacts and result caches remain separate. The new controls do not rent hardware or give a model unrestricted shell access.

The current catalog contains `llama3.2:1b`, `qwen3:4b`, `qwen3:8b`, and the exact MoE tag `qwen3-coder:30b-a3b-q4_K_M`. Start with a bounded test task on hardware you already control; assess actual output, memory and latency before assigning production work. Catalog inclusion does not mean a model is installed, loaded or tested. The per-request storage ceilings (3, 6, 10 and 24 GiB respectively) are admission limits, **not** actual download sizes or required RAM/VRAM.

### Primary MoE profile

`qwen3-coder:30b-a3b-q4_K_M` is the reviewed text-only, non-thinking coding profile: Q4_K_M quantization, 30.5 billion total parameters and 3.3 billion active parameters per token, under Apache-2.0. Ollama lists an approximately **19 GB download**. All model weights still need storage and working memory; the active-parameter count is not the model's VRAM requirement. These are published model facts, not measurements of a rented GPU. Sources: [exact Ollama tag](https://ollama.com/library/qwen3-coder:30b-a3b-q4_K_M), [upstream model card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct).

Daftar deliberately caps this exact profile at **8,192 context tokens** even though the upstream model supports a larger context. Before any inference request, the adapter rejects a prompt/system UTF-8 byte count plus 1,024 template allowance plus requested output tokens greater than 8,192. It always sends `options.num_ctx: 8192` and the bounded `num_predict`; setting only `OLLAMA_CONTEXT_LENGTH` would not override an explicit per-request value. For example, a 1,024-token output leaves at most 6,144 UTF-8 bytes for the combined prompt/system text. Non-ASCII text can consume more than one byte per character. Over-limit requests fail; the adapter does not silently truncate the brief.

The native worker treats job `maxTokens` as a **total input-plus-output budget**, not an output request. It uses the same joined-prompt byte calculation and reserves only the output allowance remaining below both the job budget and the model context profile. Thus an 8,000-token job can run with a smaller output allocation when its complete role/task context fits. A context that leaves no output room is rejected before reservation or provider dispatch. The adapter independently enforces the bound at dispatch.

Use the exact catalog tag with a request ceiling of `25769803776` bytes (24 GiB), inspect the installed digest and select it for the intended employee. Aliases do not bypass review. Begin with one inference request and a small output allocation; measure peak VRAM, RAM and latency on the actual host. Serialize inference and rendering on a shared GPU until combined memory use is measured. `gpt-oss` remains outside this catalog extension because its thinking/chat output needs a separate adapter review.

## 1. Enable the managed local daemon

The optional Compose overlay builds a nonroot Ollama image from the official image and gives it a persistent model volume. It shares the runtime's network namespace and listens on literal loopback; it publishes no Ollama port. The base runtime still publishes only `127.0.0.1:8788` on the host.

Prepare the host, checkout, `.env`, and protected owner credential using [the main deployment guide](README.md). The following commands build/start containers, **not model downloads**. They are installation instructions, not a record of a deployment already performed.

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml up -d --build
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml ps
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml logs --tail 50 ollama
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml exec -T ollama ollama list
```

Verify the Ollama log reports cloud disabled. The overlay sets `OLLAMA_NO_CLOUD=1` on Ollama and `DAFTAR_OLLAMA_LOCAL_ONLY=1` on Daftar. Both are required operational settings: the Daftar flag is the operator's confirmation, not remote attestation of another process's environment. Daftar also rejects cloud aliases and inspects `/api/show` metadata before selection and generation. This matters because a signed-in local Ollama API can otherwise route requests to cloud models. [Ollama local-only configuration](https://docs.ollama.com/faq#how-do-i-disable-ollamas-cloud-features), [authentication and local cloud routing](https://docs.ollama.com/api/authentication).

`deploy/.env.example` exposes `DAFTAR_OLLAMA_IMAGE`, `DAFTAR_OLLAMA_MEMORY`, `DAFTAR_OLLAMA_CPUS`, and `DAFTAR_OLLAMA_VOLUME_NAME`. The example image uses the mutable official `latest` tag; resolve and record an explicitly reviewed `ollama/ollama@sha256:...` digest for a reproducible release. No digest is fabricated in this pack. The initial CPU container limit is 6 GiB/4 CPUs, separate from Daftar's own limits; it is intended for trying the small model, not a guarantee every catalog model fits. Only one model is loaded and one inference request runs at a time. Provision adequate host memory for both containers and the operating system. [Official Ollama Docker guide](https://docs.ollama.com/docker).

For the three smaller catalog models, the adapter sizes context conservatively from prompt UTF-8 bytes plus the requested output and template allowance, with explicit `num_ctx` between 4096 and 32768. The primary MoE uses the fixed 8192 profile above. A larger context consumes more memory. Requests beyond the relevant bound fail rather than silently relying on the daemon's default context. A failed model call does not trigger a paid fallback.

For an **already-provisioned** NVIDIA machine with compatible drivers and NVIDIA Container Toolkit, add the GPU overlay:

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml -f deploy/compose.ollama-gpu.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.ollama.yaml -f deploy/compose.ollama-gpu.yaml up -d --build
```

That overlay reserves one existing GPU; it does not create an instance or make a purchase. Confirm device visibility and a bounded inference before enabling production jobs. [Docker GPU reservation documentation](https://docs.docker.com/compose/how-tos/gpu-support/).

Use the same file set for later `up`, `stop`, `start`, and `down` operations. Because Ollama shares the runtime's network namespace, recreate both services together when replacing the runtime container. A standalone container restart keeps the existing namespace; changing the container identity requires the paired recreation.

## 2. Request, inspect, assign, and use a model

Use the desktop's Models & system panel for its local runtime, or the [private runtime MCP adapter](../tools/DAFTAR_RUNTIME_MCP.md) for the VPS. The owner credential already grants access to these controls. `companyId` and `employeeId` identify the intended scope; they are not a fabricated employee login.

| Action | MCP tool | Protected runtime API |
| --- | --- | --- |
| Catalog and state | `model_pool_status` | `GET /v1/models?companyId=...&employeeId=...` (employee optional) |
| Request download | `model_pool_request` | `POST /v1/models/pull` |
| Cancel request | `model_pool_cancel` | `POST /v1/models/cancel` |
| Assign installed model | `model_pool_select` | `POST /v1/models/select` |

Example request body, after choosing actual company and employee IDs from office metadata:

```json
{
  "companyId": "existing-company-id",
  "employeeId": "existing-employee-id",
  "model": "llama3.2:1b",
  "idempotencyKey": "owner-model-request-001",
  "maxBytes": 3221225472
}
```

Retain the same key and body after an uncertain response. Same-body replay returns the original request; changed-body replay fails. Poll status until `ready`, then select using `{companyId,employeeId,model}`. Create or approve a normal native job with `provider:"ollama"` and that exact `model`, its token/time limits, authority and tools. Enable workers only when those jobs are ready. Selection does not rewrite queued jobs or switch an existing paid route.

Jobs validate the active company, employee/location, shared-service contract when applicable, and the selected installed digest before cache/budget admission and again before provider dispatch. A replaced model requires deliberate reselection. Local token charges remain zero; observed token counts still enter job accounting. Missing usage becomes an estimate needing review instead of a fabricated zero-token observation. VPS/GPU time, electricity, model storage and bandwidth remain separate infrastructure costs.

The request lifecycle is `queued → pulling → ready`, with `failed`, `cancelled`, or `interrupted` alternatives. At most one Daftar pull runs at a time; concurrent requests for the same model subscribe to it. Per-layer progress replaces repeated updates instead of double-counting them. One employee's cancellation leaves other subscribers running. Cancelling the last subscriber aborts the pull stream; it does not call model deletion. A daemon may retain partial downloads or continue work requested by another client. [Ollama pull API](https://docs.ollama.com/api/pull.md).

Progress limits can stop Daftar's stream after the daemon has written bytes. Use a dedicated filesystem/volume quota for a strict storage ceiling; keep space for existing and partial models. Inspect partial storage locally before cleanup, and do not delete a shared model while employees are using it. The service never automatically evicts another employee's model.

## 3. State, restart, and backup

`/var/lib/daftar/model-pool/registry.json` stores request receipts and digest assignments with atomic replacement, separately from the native office state hash. It is private (0600 inside a 0700 directory), bounded to 512 request receipts and 512 assignments, and protected by a single-controller lock. Back up the entire Daftar state volume while stopped. Stop the controller before an operator archives a full registry; deleting receipt history loses its replay protection.

On startup, incomplete requests become `interrupted`; no download resumes automatically. Inspect inventory and submit a new request deliberately if needed. Installed and loaded are separate states: `/api/tags` identifies disk installations, while `/api/ps` reports loaded models. A completed download is ready only after terminal success and verified local inventory. [Installed models](https://docs.ollama.com/api/tags), [running models](https://docs.ollama.com/api/ps).

The model bytes live in the separate `daftar_ollama_models` volume by default. Preserve that volume across container replacement; `down -v` removes named volumes. Keep its backup separate from company artifacts. Models can usually be fetched again, but a mutable upstream tag may no longer resolve to the same digest; record and preserve any exact model version required for reproducibility. Multiple physical hosts can each require their own model bytes.

## 4. VPS and Vast placement

A stable CPU VPS can run the controller, native state and private MCP bridge; an already-controlled GPU host can run inference. The first implementation intentionally accepts only configured loopback origins. With a **systemd/native Daftar service on the VPS**, an operator-managed encrypted SSH forward can connect the private remote daemon:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:11434:127.0.0.1:11434 gpu-host
```

`gpu-host` must be a trusted SSH configuration entry with a verified host key. Keep Ollama on that host's loopback with `OLLAMA_NO_CLOUD=1`; set Daftar's local-only confirmation only after verifying it. Supervise the tunnel separately. The Docker runtime has its own loopback namespace, so a forward on the host is not automatically reachable inside that container. The provided Compose profile instead runs Ollama in the runtime's namespace on the same host.

For the entire stack on Vast, choose a VM-capable rental and run the reviewed Compose setup inside it. An ordinary Vast Docker rental is already a container and is not interchangeable with a VM for this runbook. Preserve independent backups and review hourly compute, storage, transfer, stopping and deletion behavior before committing spend. No live prices are assumed. The application's token/provider spending cap does not cap the infrastructure provider's bill; budget those charges explicitly. [Vast virtual machines](https://docs.vast.ai/guides/instances/virtual-machines), [storage types](https://docs.vast.ai/guides/instances/storage/types), [serverless pricing](https://docs.vast.ai/guides/serverless/pricing).

## Verification limits

Automated tests run a real loopback HTTP fake daemon and synthetic office state. They verify deduplication, scoped receipts, cancellation, fresh contract revocation, progress/byte bounds, idempotency/restart, digest pinning, cloud denial, missing-usage accounting, and owner HTTP/MCP routes. MoE tests additionally check exact mixed-case quantization tags, fixed `num_ctx`, prompt-plus-output rejection, catalog admission and digest changes. They transfer no model weights and invoke no paid API. Docker image build/boot, GPU drivers, hardware performance, disk-quota behavior and a live Vast/VPS connection require deployment verification on the target host.
