# VS Code 0.9.2 local validation checkpoint

Date: 2026-11-26. Platform: Linux x64.

The exact local VSIX below passed the official VS Code CLI installation, all **199 extension tests with zero skips**, and the installed runtime/venv acceptance gate. The runtime gate used **VS Code 1.147.0's actual Node 24.22.1 executable** without opening a GUI. The new candidate's real Extension Development Host, Linux tmux and Windows acceptance results were **pending normal CI at this checkpoint**. Consult the matching source revision's CI receipts for those later results.

## Artifact identity

| Item | Value |
| --- | --- |
| File | `atlas-office-0.9.2.vsix` |
| Target | `linux-x64` |
| Size | 3,499,697 bytes |
| VSIX SHA-256 | `8d1427183df16ee2b5fdfa7f0442a7376d931d3e427bcc942c859b00bc6614c4` |
| Runtime manifest SHA-256 | `47d207e5282a9ee513c37c8567aa6e50490c41329e074daafcb1e5560bed3932` |
| Canvas manifest SHA-256 | `8fb7254befd85b9753673954ec2eae2872a72a00047e9dd25eb317456c87dcc4` |
| Selected source-tree SHA-256 | `8404a10d77b9a8e985153122df2170ed8b959a1ba0ebb781a7051b6c8513d31d` |
| Source file count | 443 |
| Restored base commit | `6c94b76b18260903f2db7fda54617f009b379d71` |
| Final installed-runtime run | 2026-11-26T05:32:59.332Z to 2026-11-26T05:33:06.860Z |

The package includes 208 archive files, with 146 files bound by the native runtime manifest. The source fingerprint is computed from the sorted sequence `relative path + NUL + SHA256(file bytes) + LF` for existing tracked or unignored code/configuration files under the roots recorded in `.work/installed-runtime/source-digests.json`. That file contains every included path and hash, along with the exact scope and extensions. It identifies the tested working tree before publication; it is not a claim that the unchanged base commit contains these changes. Documentation files are excluded so this validation record does not hash itself.

The hash above identifies this **local** artifact. A separately built CI artifact has its own platform, digest and installation receipt.

## Changes exercised

- Machine-scoped `atlas.pythonPath` passes an explicitly selected absolute Python interpreter to newly started owned and persistent runtimes. Invalid paths fail before dispatch, and an ambient `DAFTAR_PYTHON_PATH` cannot silently override the setting.
- The installed workbench uses that configured interpreter to create its own venv. VS Code and the Node/Rust backend retain their separate runtimes.
- Managed environments reject system site-packages and changed pinned configuration before starting another job.
- Trusted managed-environment and design-tool wrapper commands explicitly retain Electron Node mode. Python, package-manager and ordinary shell subprocesses continue to receive their scrubbed environments.
- The package also incorporates the completed Donna/Andolan company-context changes from the shared source tree.

## Local acceptance evidence

| Gate | Observed result |
| --- | --- |
| Build and syntax checks | Passed; runtime and shared-canvas manifests regenerated |
| Package prepublish suite | 199 passed, 0 failed, 0 skipped; `DAFTAR_REQUIRE_LOCAL_RUNTIME=1` |
| Official VS Code 1.147.0 CLI | Installed this exact VSIX into an isolated temporary extension directory |
| Runtime executable | Downloaded editor executable in its supported Node mode, v24.22.1 |
| Actual installed native lifetimes | 6 complete start/read/stop cycles |
| Concurrent starts | 12 per cycle, coalesced to one owned runtime |
| Concurrent native reads | 16 per cycle, all completed |
| Duplicate native mutation delivery | 16 identical deliveries; one resulting company persisted across all six lifetimes |
| Authentication/ownership | Wrong credential rejected and a second same-storage launcher refused in every cycle |
| Cleanup | Closed listener and zero child/timer/listener residue in every cycle; lock/token files removed |
| Recorded runtime HTTP requests | 146; the read-only creation poll count can vary with completion time |
| Python workbench creation | Real venv created through the separately installed package, stable replay used one job |
| Explicit interpreter | New `pyvenv.cfg` recorded the selected launch-venv Python as its bootstrap interpreter |
| Offline package execution | Local wheel installed, imported and executed with result 42, then uninstalled |
| Python isolation | Separate prefix, isolated mode, user/global package directories excluded, base Python unable to import probe |
| Python/pip versions | 3.12.14 / 25.0.1 |
| Provider/package-index dispatch | 0 / 0 |

These are bounded lifecycle and integration checks. They are not GPU inference/render throughput measurements or a long-duration production load test.

### Evidence files

The local output directory is `.work/installed-runtime/`:

- `receipt.json`: exact VSIX digest, actual editor Node version, six lifecycle records, traffic count and Python proof.
- `install.log`: official CLI installation outcome.
- `package.log`: final package/prepublish output, including all 199 test results.
- `source-digests.json`: source scope, individual file digests and aggregate fingerprint.

Reproduction after the native/shared-renderer prerequisites:

```sh
npm run build
DAFTAR_REQUIRE_LOCAL_RUNTIME=1 npm run package
DAFTAR_PYTHON_PATH=/absolute/path/to/python3 npm run test:installed-runtime
```

On Windows, set the environment variables using that shell's normal syntax and use the matching Windows package.

## Normal CI acceptance added for this candidate

The existing `test:installed` gate launches the separate test-host extension and activates Daftar from the installed VSIX, as described by the [official extension-testing documentation](https://code.visualstudio.com/api/working-with-extensions/testing-extension). Linux additionally checks the actual installed editor → dedicated tmux → native host runner path. This candidate extends that Linux fixture to prepare an isolated managed venv, execute its locally installed package through the managed tmux job, check stable prepare/run replay, reject changed system-site and pinned configuration without creating jobs, restore the original configuration, and run successfully again. The fixture returns host policy to off and stops only its own test supervisor.

The portable CLI/runtime/venv gate runs on both operating systems. Managed tmux execution is Linux-only. The local executor does not provide the Unix sockets/display needed for the real GUI/tmux gate; no unsupported GUI workaround was attempted. The local installed-runtime receipt therefore explicitly records `guiActivationVerified: false` and `managedTmuxVerified: false`. Those fields must not be substituted for the separate CI installed-smoke receipt.

No claim is made here about live GPU availability, a Vast.ai instance restart, Unreal rendering, owner-machine software installation, billed provider work or ChatGPT account connectivity.
