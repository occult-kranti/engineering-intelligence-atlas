# Cloud runtime validation receipt

> Historical foundation receipt. The integrated 0.7.0 source, tests and publishing status are recorded in [Freeflow validation](FREEFLOW_VALIDATION.md).

Checked **21 November 2026, America/New_York**. Baseline source: `f4813437466c16acb2507cabc31944d9b482ea59`. Delivery branch: `feat/cloud-runtime-mcp`.

This receipt describes the development branch's headless runtime, private control API, stdio MCP adapter and deployment configuration. It is not a production release or a live account-connection receipt.

## Executed checks

| Check | Observed outcome | Scope |
| --- | --- | --- |
| Native release compilation | Passed with Rust 1.100.0, locked Cargo dependencies | Real Linux x86-64 helper |
| Portable TypeScript compilation | Passed with repository TypeScript dependencies | Existing service/worker/provider modules compiled without Electron execution |
| Headless runtime tests | 13 passed, 0 skipped | Authentication, limits, state projection, actual Rust and injected model execution |
| Runtime MCP tests | 17 passed, 0 skipped | Tool surface, origin/credential handling, protocol behavior and synthetic HTTP subprocess |
| Actual stdio → HTTP → Rust smoke | 9 checks passed | Temporary synthetic company state, real daemon and MCP processes |
| Existing worker/provider/sync regressions | 87 passed across four test files | 47 worker tests, 31 cloud/native-sync tests and 9 provider tests |
| Deployment helper/configuration review | Passed local syntax and configuration assertions | YAML, loopback binding, nonroot execution, secret modes and isolated secret creation |
| Patch whitespace validation | Passed | `git diff --check` |

The 117 test cases and nine end-to-end smoke checks are distinct; repeated development runs are not added to these counts. The native/core tests exercised by the integration gate used the actual compiled helper, not a simulated Rust response.

### Commands

```bash
npm ci --prefix desktop-shell --ignore-scripts --no-audit --no-fund
npm --prefix desktop-shell run build:native
npm --prefix headless-runtime run build
node --test headless-runtime/test/*.test.mjs tools/daftar-runtime-mcp.test.mjs
node scripts/smoke-runtime-mcp.mjs
cd desktop-shell
npx vitest run tests/office-worker.test.ts tests/cloud-native-contract.test.ts tests/cloud-sync.test.ts tests/providers.test.ts
```

Environment: Node 24.22.3, Rust 1.100.0, Linux x86-64. Node dependencies came from the existing lockfile; no dependency versions were upgraded for this work.

## Meaningful outcomes

### Durable mutation delivery

Eight concurrent copies of one native-backed command created one company and returned seven replay receipts. A changed payload under an existing command ID was rejected. A new mutation carrying a stale state hash was rejected. A restarted runtime retained the original receipt, so replay did not create another company.

The MCP smoke independently traversed the real stdio process, authenticated HTTP service and Rust boundary. It verified five advertised tools, a successful company mutation, replay, stale-state error propagation, bounded metadata output, rejection of internal settlement, daemon survival after client disconnect and receipt survival after both daemon/MCP process replacement.

### Actual worker behavior with a mocked model

The runtime test enqueued an authorized synthetic job through the actual native authority and enabled the real `OfficeWorkerPool`. The injected provider was deliberately held after the HTTP control response completed. Repeating the enable setting did not create another dispatch. Releasing the provider produced a managed Markdown artifact and settled the recorded synthetic usage; pending reservations cleared.

The fixture's token and cost fields are simulated accounting inputs. They are not a claim of real provider spending or a model-quality benchmark.

### Pause race found and corrected

Independent review found that the existing worker created its active cancellation controller after several asynchronous preparation steps. A pause during those steps could miss the controller and allow a later provider dispatch.

The patch installs the controller before the first await and checks cancellation after claim, context, cache, reservation and authority operations. A successful claim is captured before cancellation is raised so the existing settlement path can record that no provider call was dispatched. Four regressions cover pending claim, pending authority, pending source preparation and a provider returning after stop. The late-result test preserves the generated artifact and observed fixture usage while withholding publication from that returned result. Explicit one-shot execution while the pool is paused remains supported.

Stopping workers requests cancellation; it does not undo an external request already sent. Once the managed GitHub action has been entered, its internal preflight/publication sequence does not receive the attempt's cancellation signal. That action may still finish after a pause, including when its network write had not begun at the instant of cancellation. Native job/policy controls and external-action reconciliation remain relevant to in-flight effects.

### Auth and response boundaries

Unauthenticated control calls, unconfigured Host/Origin headers, malformed command envelopes, worker-only actions and oversized bodies are rejected. Secret loading requires a regular private file. Transport/client tests reject redirects and avoid echoing provider errors or runtime credentials. A state mutation that has committed remains a successful compact receipt if its full projection cannot be safely returned.

## Deployment evidence and limits

Docker was not installed in the local execution environment, so a local image build or container boot is not claimed. A focused GitHub workflow, [`headless-runtime.yml`](../.github/workflows/headless-runtime.yml), is included to compile/test the runtime and build/boot the container with a synthetic control credential and no provider credentials. Its remote result must be checked separately before deployment.

The implementation is committed locally as `1bba562689c9adb22680be0b2222e2b9002a7926` on `feat/cloud-runtime-mcp`. Automatic approval review blocked the GitHub push because this request did not explicitly authorize publishing the changes to that external repository. No pull request or remote workflow run was created. Publishing this review branch requires the owner's approval; no alternative upload route was attempted.

The systemd directives were checked using a temporary copy with the environment's actual Node executable. The supplied `/usr/bin/node` path must exist on the chosen host or be adjusted as described in the deployment guide.

The following are **not established** by these tests:

- A rented VPS or Vast instance, GPU benchmark, live model call or infrastructure billing integration.
- Owner ChatGPT plugin installation, tunnel registration or OAuth authentication.
- Production website-to-runtime synchronization or installed desktop remote mode.
- Full private-site migration away from Sites identity/Cloudflare D1.
- Multi-user visitor authorization through the new single-owner daemon.
- General shell/build/browser execution or remote artifact download.
- A production backup/restore, cloud host failure or live external-publication recovery.

The original private website and release 0.6.1 are not changed by this branch. No owner private state, provider key or account token was used in these runtime tests. No paid cloud resource was provisioned.

## Next acceptance

After reviewing the branch and passing the container gate, select the target host and restore an isolated workspace. Verify the daemon with workers paused, then connect the chosen owner MCP route. Complete the explicit Sites runtime-device/secret adapter and desktop remote-mode work before claiming the three interfaces share a production execution authority. GPU routing and code execution have their own phases in the [cloud plan](CLOUD_RUNTIME_PLAN.md).
