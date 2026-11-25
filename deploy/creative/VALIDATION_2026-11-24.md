# Creative installation and deployment validation — 24 November 2026

Review date uses America/New_York. Machine receipts retain their actual UTC timestamps on 25 November. Detailed, sanitized measurements are in [`validation-2026-11-24.json`](validation-2026-11-24.json).

## Actual official Blender acceptance

Blender **4.5.17 LTS** was downloaded from the official distribution host, installed in isolated scratch storage and executed on CPU. The expected SHA256 was obtained directly from the official checksum text before installation:

- Archive: <https://download.blender.org/release/Blender4.5/blender-4.5.17-linux-x64.tar.xz>
- Checksums: <https://download.blender.org/release/Blender4.5/blender-4.5.17.sha256>
- Archive SHA256: `b7d09d1aa7c346fed1e56390e815dbf1589d47324734fbad9e2007fe75ca0b8d`
- Archive size: **377,826,816 bytes**. Expanded members: **1,165,711,107 bytes** across **6,485 entries**, including **71 relative library symlinks**.
- Completed installation inventory: **5,609 files and symlinks**. Every entry matched the receipt after both direct rendering and service acceptance. Re-running `--install` returned `reused_verified`.

The direct smoke saved the factory scene, rendered a **96 × 96 PNG with Cycles CPU, two threads and four samples**, and exported a valid GLB v2. The measured complete Blender process took **1.168 seconds**; its script reported **0.280 seconds**. PNG dimensions, GLB header/version/length and artifact hashes were verified. These are tiny fixture timings, not a production-scene throughput claim.

The reproducible service smoke passed **seven checks** through the real installed engine and the real `CreativeToolsService`, using a disposable native scope/grant fixture. It probed the executable, assigned the tool, inspected the `.blend`, rendered a **64 × 64 two-sample CPU PNG**, exported GLB, checked original-request replay and validated artifact hashes/formats. This run performed **17 authority callbacks**; callback counts vary with bounded polling. The three operations took **0.530, 0.562 and 0.481 seconds**, respectively. Controller closure and disposable-state removal completed before success was recorded. No provider was called.

## Automated checks

| Check | Result |
| --- | --- |
| `python3 -m unittest discover -s deploy/creative/tests -v` | **41 passed**, zero failures/skips |
| `DAFTAR_REQUIRE_NATIVE_TESTS=1 node --test headless-runtime/test/runtime.test.mjs` | **23 passed**, zero failures/skips, including three new startup recovery regressions |
| Actual read-only Blender `--plan` | Linux x86_64, glibc 2.41, nine schedulable CPUs, 10,451,427,328 bytes detected RAM; no GPU device nodes; no directory created |
| Actual Blender download/install/check/reuse | Passed with the official locked SHA256 and full installed-file inventory |
| Direct and service CPU smoke | Passed; artifacts and hashes retained in machine receipt |
| Docker/Compose in scratch | **Not run:** Docker is unavailable here. Required CI builds the creative image and probes Python, Inkscape and ffprobe; the creative workflow checks actual merged Compose JSON |
| Formatting | `git diff --check` passed |

The installer tests exercise read-only planning, platform/libc/CPU/disk checks, nested cgroup limits, unsafe privileged ancestors, absolute/traversing archive paths, symlink escape/cycle/chain handling, duplicate/special entries, expanded-byte/member bounds, hash failures, resume/fallback behavior, incomplete extraction cleanup, atomic publication, receipt reuse, installed-file tampering, restrictive administrator umasks, and owner-supplied Unreal ZIP layout/version checks.

The startup regressions verify that an invalid injected adapter creates no state, failed cloud/model constructors release creative ownership before an immediate server restart, and a late observer-start failure stops the observer and releases both acquired registries. Cleanup remains compatible with the synchronous `createRuntime` API; `startServer` awaits its non-enumerable cleanup promise before reporting startup failure.

## Defects found and corrected during verification

- Preserving tar mtimes was necessary: the first real Blender run otherwise regenerated bundled Python bytecode and correctly failed full inventory verification. The fixed clean installation retained all 5,609 verified file/link entries after rendering.
- Official Blender uses library symlink chains. Validation now follows only declared internal links to archived regular files, rejecting cycles, missing targets, directory pivots and escapes. Owner-provided Unreal ZIPs use the same safe internal-file rule.
- A restrictive administrator umask could publish inaccessible engine directories. New managed and extracted engine directories now receive explicit intended modes; cached imports remain private.
- Root installations under mutable ancestors could race path checks. Privileged installs now require root-owned safe ancestry, including an already existing root-owned private child beneath any sticky temporary parent.
- Docker Compose concatenates ordinary `tmpfs` sequences. The creative override now requires Compose 2.24.4+ and replaces the base mount explicitly; CI verifies exactly one restricted 1 GiB `/tmp` mount and retains loopback control access/read-only tools.
- The repository's Docker build allowlist initially excluded the new runtime/adaptor files. It now includes the creative modules, integration helpers, company setup kit and creative image inputs while preserving secret exclusions.
- Distro package checks now require a successful `dpkg-query` exit status before reporting installed packages.

## Evidence boundaries

No active VPS, GPU, authenticated Unreal archive, Epic license evidence, Adobe credentials or S3 service entitlement was supplied. This validation did not provision or start a host, perform a GPU render, execute an actual Unreal engine, activate any license, or make a live paid API/storage request. Unreal import tests use synthetic archives; actual Epic provenance remains an owner's responsibility. Adobe configuration without an authorized live request remains `configured_unverified`, and cancellation receipts do not imply that a remote operation or storage cleanup has completed.

The deployment/run instructions and dated primary references are in [`README.md`](README.md). Engine archives, installed binaries, runtime state and credential values are excluded from the repository deliverable.
