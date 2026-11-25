# Backend pipeline and headless runtime review — 24 November 2026

## Delivered behavior

The headless owner API now accepts the native `update_employee`, `rename_department`, and `rename_office` operations. They retain the same expected-state hash and durable command receipt as existing management operations. Lifecycle and ownership enforcement remain native.

The transport now distinguishes native availability failures from malformed user requests. A missing native binary or lock/read/write failure returns HTTP 503. Native write failures can occur after a rename while syncing the parent directory, so the response conservatively retains the original command identity without claiming the mutation was rejected. Native lock contention retains HTTP 409 with its specific `STATE_BUSY` code; HTTP saturation returns 429. Both contention paths include `Retry-After: 1` and preserve the command identity for replay. A changed body still fails with `REMOTE_RECEIPT_MISMATCH`; no automatic retry creates a new command.

Startup rejects invalid control tokens and concurrency settings before a runtime starts observers or cloud synchronization. Later server-construction failures close the runtime. Repeated shutdown paths share one promise. Observer, worker, cloud and model-controller cleanup are each attempted even if one rejects; this prevents a cloud shutdown failure from retaining the model registry. HTTP sockets close even when runtime cleanup rejects. Regression tests hold an active HTTP request open during failed cleanup and verify that all resource cleanups are attempted exactly once.

The required headless CI job sets `DAFTAR_REQUIRE_NATIVE_TESTS=1`: missing native or portable builds fail rather than produce a green run with skipped integration tests. It also runs the new bounded stress gate and retains its JSON evidence as `backend-stress-evidence`.

## Local validation

- `npm --prefix headless-runtime run build` — passed.
- `DAFTAR_REQUIRE_NATIVE_TESTS=1 node --test headless-runtime/test/*.test.mjs` — 40 passed, zero failed and zero skipped. This includes real native receipt replay, lost cloud acknowledgments, encrypted pairing, writer conflicts, cancellation and a deterministic injected provider job with durable artifact/accounting settlement.
- Required-native mode was separately exercised with a nonexistent prerequisite: it raised an assertion and did not skip.
- `node scripts/backend-stress.mjs --employees=256 --requests=64 --output=project/backend-stress-2026-11-24.json` — receipt and measured limits are recorded in [backend-stress-2026-11-24.json](backend-stress-2026-11-24.json). Final run passed all ten behavioral checks, including cleanup, against the final native build.

All state is synthetic and temporary. No personal workspace, real provider credential, external model endpoint, host rental or infrastructure deployment is used by these suites. The provider-completion test uses an injected deterministic adapter; its cost values are test accounting values.

## Measured load

| Measurement | Observed result |
|---|---:|
| Added employee records | 256 |
| Total employee records after load | 284 |
| Concurrent duplicate deliveries | 64; exactly one mutation |
| Competing department edits | 16; one committed, 15 stale revisions rejected |
| Total HTTP attempts, including expected rejections/retries | 564 |
| Expected HTTP capacity rejections (429) | 123 |
| Identical-envelope contention retries | 131 |
| Full scenario elapsed time | 17.45 seconds |
| Persistent hire throughput in this run | 30.53 records/second |
| HTTP attempt p50 / p95 / maximum | 33.67 / 371.34 / 583.09 ms |
| External provider calls | 0 |

Environment: Node v24.22.3, Linux x64. The receipt timestamp is `2026-11-25T00:44:08.052Z` (24 November in the client timezone). Native executable SHA-256: `82589da9b59035d5c57b07ba2f75d6523b9ba43dc0c6a4f52e6eabfe2ca92239`. Latency aggregates individual HTTP attempts, including intentional errors, and does not include the one-second retry backoff; the full scenario time includes backoff and cleanup. These are functional-load observations, not a service-level objective.

## Stress contract

The load fixture runs one complete daemon plus a second independent native command client against the same temporary state. A separate check verifies that a second full daemon cannot acquire the model registry, preserving its single-owner rule. Both command clients execute real Rust subprocesses and use the same public owner envelope; the secondary client has no worker pool.

Checks cover 64 concurrent deliveries of one company-create command, exactly one committed creation, 16 competing department edits with one winner, 256 persistent hires, repeated employee edits, receipt/body mismatch, protected Donna, paused editing, resumption, retirement, terminal-employee rejection, 64 populated-state reads, and restart/replay. It checks Donna’s global identity and every company, office and department assistant’s kind, scope and non-retired status. Ownership assertions were independently reviewed by the native backend engineer. A separate integration review required exact native error codes and cleanup before success publication; both were implemented and reviewed again without blockers.

Bounded backpressure is an expected result: identical command envelopes are retried only on HTTP 429 or native `STATE_BUSY`. Stale state and changed-body errors are not automatically retried. Receipt output distinguishes expected rejection counts from successful operations and records the tested native binary SHA-256. The runner rejects a binary that changes during the test and writes a success receipt only after every controller closes and its temporary workspace is removed.

## Reproduction

```bash
npm --prefix desktop-shell ci --ignore-scripts
cargo build --release --locked --manifest-path native-core/Cargo.toml
npm --prefix headless-runtime run build
DAFTAR_REQUIRE_NATIVE_TESTS=1 node --test headless-runtime/test/*.test.mjs
node scripts/backend-stress.mjs --employees=256 --requests=64 --output=project/backend-stress-2026-11-24.json
```

The CI load is 128 new employees with the same 64-request bursts. The script accepts 1–1,024 hires and 16–256 burst requests. Missing builds fail immediately. Performance values describe this host and this bounded functional workload; they do not certify production capacity, multi-hour operation or live provider availability. Docker, Windows packaging, external MCP clients and remote CI results belong to their separate release gates and are not asserted by this report.

## Reference

[Node.js HTTP lifecycle documentation](https://nodejs.org/api/http.html#servercloseallconnections) documents the ordering of `close`, idle cleanup and forceful active-socket closure used by the shutdown path. Application-specific behavior is established by the repository regression and native integration tests above.
