# Creative VPS implementation and validation

Review date: **2026-11-24, America/New_York**. Machine receipts use UTC and therefore include 2026-11-25 timestamps. This change continues the backend update from `2333cd4b8dc8ea12eec723c6ae547a5ccfdac283`.

## Delivered behavior

The source now connects a reviewed game repository, persistent employees and scoped creative-tool jobs to a Linux runtime, its private MCP adapter and VS Code. The deployment pack is executable, not a list of suggested tools. **No active production VPS was supplied or provisioned**, so completed local work and remaining host acceptance are recorded separately.

| Layer | Delivered |
| --- | --- |
| Software setup | Official pinned Blender download, checksum verification, safe staged extraction, complete file inventory, resumable download and verified reuse; authenticated owner-supplied Unreal archive import/discovery; signed-distribution graphics package profiles |
| Native workforce | Additive setup for three departments and five specialist definitions in an existing company, repository verification, persistent native bindings, scoped expiring creative/provider grants, and department-specific tool assignments |
| Execution | Fixed Blender inspection/render/export, Unreal inspection/DataValidation, Inkscape SVG export, ffprobe media inspection and optional licensed Photoshop v2 operations |
| AI workflow | Current assignment/readiness before model spend; bounded model request JSON; host-attached company/employee/request identity; native job-scope selection checks; leased authority checks; matching durable completion evidence |
| Controls | Five authenticated HTTP routes and five creative MCP tools; 14 runtime MCP tools overall; direct runtime connection and creative controls in the 11-command VS Code extension |
| Deployment/pipeline | Dedicated-user CPU/GPU profiles, restricted Compose mounts, creative dependency image, required installer/deployment CI, container dependency/import probes and installed-extension acceptance |

Start with [installation](../deploy/creative/README.md), [company/repository setup](../integrations/creative-tools/README.md), [execution contract](../integrations/creative-tools/RUNTIME_CONTRACT.md), [Photoshop adapter](../integrations/adobe/README.md), and [MCP contract](../tools/DAFTAR_RUNTIME_MCP.md).

## Real executable evidence

Blender **4.5.17 LTS** was downloaded from its official release host. The **377,826,816-byte** archive matched SHA256 `b7d09d1aa7c346fed1e56390e815dbf1589d47324734fbad9e2007fe75ca0b8d`. The installer retained and verified **5,609 file/link entries** after both direct and service-based execution; a subsequent install returned `reused_verified`. Exact sources, host preflight and installer evidence are in [the deployment report](../deploy/creative/VALIDATION_2026-11-24.md) and [its machine receipt](../deploy/creative/validation-2026-11-24.json).

The direct Blender smoke saved a scene, rendered a 96 × 96 Cycles CPU image with four samples/two threads, and exported GLB v2. Its whole process took **1.168 seconds**; **0.280 seconds** was measured inside the script. These describe a tiny synthetic scene on this host, not production capacity. [Direct receipt](creative-blender-install-smoke.json).

The reusable creative-service smoke exercised actual version discovery, assignment replay, three operations, output hashes, repeated job receipts and orderly cleanup. It used a disposable scope/grant fixture and **18 authority callback checks**, with no production employee state or provider request. [Service receipt](creative-service-blender-smoke.json).

| Actual service operation | Verified result |
| --- | --- |
| Blender inspect | 149-byte JSON; three objects, one mesh, one scene |
| Blender render | 64 × 64 Cycles CPU, two samples; 3,733-byte PNG |
| Blender export | 1,936-byte GLB v2 |
| Inkscape 1.4 SVG export | 64 × 64 PNG; 977 bytes |
| ffprobe 7.1.5 WAV inspection | 0.1-second 48 kHz mono PCM source; 128-byte metadata |

The final two operations used installed host tools and disposable SVG/WAV files. They did not install new distro packages or run a provider. [Graphics receipt](creative-graphics-smoke.json).

A final **six-check native-backed acceptance** joined the complete path: actual Rust company/employee/department/grant records → real stdio MCP subprocess → authenticated HTTP runtime → actual Blender render. The 64 × 64 two-sample PNG was **3,737 bytes** with a verified hash. The same request replayed after full daemon/client restart with one job total; revoking the actual native grant blocked a fresh render. This used disposable native state rather than a scope fixture, zero provider calls, and no production VPS. [Native end-to-end receipt](creative-native-runtime-smoke.json) · [reproducible script](../integrations/creative-tools/smoke-native-runtime.mjs).

No actual Unreal editor or Adobe account was invoked. Unreal parser/process contracts and Adobe network contracts were tested with fixtures. A ready local executable, a licensed account, successful authentication, and a successful production job remain distinct facts.

## Automated checks

The counts below overlap where focused suites are included in the full runtime suite; they must not be summed as independent tests.

| Check | Local result |
| --- | ---: |
| Rust native core, including creative authority and leased-worker regressions | **109 passed** |
| Native release build and packaged helper copy | Passed |
| Desktop TypeScript checks and portable runtime build | Passed |
| Complete desktop unit suite | **651 passed** |
| Complete headless runtime suite with required native prerequisites | **124 passed, zero skips** |
| Creative service process/authority/durability tests, included above | **29 passed** |
| Photoshop adapter network mocks and AWS reference signing vector, included above | **26 passed** |
| Native-job creative worker adapter, included above | **11 passed** |
| Actual-native company setup and rerun behavior, included above | **8 passed** |
| Authenticated creative HTTP transport, included above | **7 passed** |
| Runtime startup cleanup, within 23 runtime-controller tests above | **3 regressions passed** |
| Both native and runtime MCP test suites | **58 passed** (30 native / 28 runtime) |
| Real Rust → HTTP → stdio MCP smoke | **10 checks passed** |
| Real native grant → stdio MCP → HTTP → actual Blender | **6 checks passed**, including restart replay and native revocation |
| VS Code unit/host/synthetic DOM checks | **51 passed** |
| Installer/deployment contract tests | **41 passed** |
| Git whitespace and workflow YAML checks | Passed |

The creative service tests include 32 concurrent duplicate requests launching one process; queue saturation; permission revocation; Donna/employee/department scope; delegate parent grants; input replacement; invalid config while queued; time, output and artifact limits; symlinks and hostile SVG references; cancellation; restart without replay; and actual parent-process death terminating the guarded child.

Company setup was verified against the real Rust state boundary. Its second application made zero kit mutations, added zero projects, issued no duplicate grants and left config/registry/native state hashes unchanged. Owner-renamed employees, paused departments, fired specialists, revoked grants and deliberately empty tool assignments were preserved or explicitly blocked as appropriate. Preview did not execute Git fsmonitor hooks or invoke the native core.

Adobe mocks verify fixed v2 endpoints, private asset transfer, absence of auth headers on storage requests, ignored remote download URLs, result bounds, no duplicate paid POST, durable uncertainty, revoked authority, cancellation and cleanup failures. An upload whose acknowledgement was lost keeps cleanup pending even after successful DELETEs, because a delayed PUT can recreate the object. These tests do not verify a real Adobe entitlement, remote bill, S3 policy or rendered Photoshop fidelity.

## Bounded backend stress

[The measured stress receipt](creative-backend-stress.json) records **10 passing checks** over **128 additional employees**, **64 duplicate deliveries** and **425 HTTP requests**. The run took **11.718 seconds** and used two independent native controllers, one full daemon, and at most eight concurrent HTTP requests per controller.

| Response | Count | Meaning in this fixture |
| --- | ---: | --- |
| 200 | 286 | Successful reads, commands and receipt replays |
| 400 | 2 | Deliberately invalid operations rejected |
| 401 | 1 | Deliberately unauthenticated request rejected |
| 409 | 25 | Expected revision/identity contention |
| 429 | 111 | Expected bounded backpressure |

The client made 120 same-envelope retries. Attempt latency was p50 **28.41 ms**, p95 **285.12 ms**, maximum **354.88 ms**. The test checked persistent assistant ownership, staff lifecycle, conflict handling, exclusive controllers and restart. It used **zero provider calls**, **zero private workspaces** and **zero infrastructure provisioning**. It is a functional contention test, not a sustained production throughput or multi-hour soak certification.

## Review corrections included

- Preserve official archive timestamps so Blender does not regenerate bundled bytecode and invalidate the installed-file inventory.
- Resolve complete internal archive symlink chains and reject traversal, unsafe privileged ancestors and sticky-parent creation races.
- Replace the Compose `/tmp` sequence explicitly; validate one restricted 1 GiB mount in the merged configuration.
- Include creative runtime/importer/skill dependencies in the strict Docker build allowlist while preserving secret exclusions.
- Release every acquired controller/observer after partial startup failure and await cleanup before an immediate retry.
- Bind model-selected project/operation and returned receipts to the actual native job scope and original request.
- Disable repository fsmonitor hooks and inherited Git directory/config overrides during preview.
- Persist/fsync Adobe pre-dispatch and remote-job receipts; never represent local cancellation or an ambiguous upload as confirmed remote cleanup.

## GitHub CI and deployment boundary

The pull request's exact-commit checks provide the publication evidence. The creative installer job is a required dependency of the main CI/release workflow. The container job builds the base and creative images, validates dependency versions/imports and runs the private runtime/MCP acceptance. The editor job packages the extension and runs its installed 11-command, seven-check-group smoke. Docker and local `vsce` were unavailable in the implementation environment, so those are GitHub CI gates rather than claimed local successes.

Existing published **0.8.0** release assets and tags retain their original source identity. This source update does not claim that old installers include the new creative features. Use the matching CI artifact or a build from this source.

Production completion requires an active owner-controlled VPS endpoint and its intended native workspace. Unreal additionally requires the authorized engine/archive and suitable host resources. Adobe additionally requires licensed API credentials, an existing private asset store and explicit paid-request/upload settings. No private IP, credential, commercial asset, production employee data or downloaded engine binary is committed in this change.
