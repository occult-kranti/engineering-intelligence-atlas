# VS Code 0.9.1 candidate validation

This receipt describes the Linux x64 development candidate produced after reconciling current main with the released `v0.9.0-preview.1` source. It records a successful package build and native runtime acceptance, successful installation by the pinned VS Code CLI, and an environment-blocked installed-editor launch. It does **not** certify a running graphical editor, persistent tmux lifecycle, a GPU workload, or a production deployment.

## Artifact identity

| Field | Observed value |
| --- | --- |
| Artifact | `atlas-office-0.9.1.vsix` |
| Extension identity | `occult-kranti.atlas-office` |
| Manifest version | `0.9.1` |
| Target | Linux x64 |
| Size | 3,496,271 bytes |
| SHA-256 | `02e66dc965885103c540b214b8ae0dd0198b32bd6956e4b449b577b48840f3d2` |
| Archive files reported by VSCE | 208 |
| Contributed commands | 18 unique commands |
| Runtime manifest entries | 146 files |
| Shared-renderer manifest entries | 38 files |
| Native core SHA-256 | `8e67644f9deede39cbc87f8a704e52731deac9afe52245b2ca6eca65c98239e8` |

The packaged `src/*.js` bytes were compared with the final working-tree source and matched. The runtime manifest contains `blender_worker.py`, `blender_device.py`, `process_guard.py`, and the Adobe adapter. The renderer manifest contains the shared office modules and Donna's hashed WebP, editable Blender scene, GLB, and provenance JSON. Local asset URLs remain inside the existing webview resource policy; external network loading was not enabled.

Validation receipts are excluded from the VSIX by `.vscodeignore`, avoiding a circular checksum dependency. A future rebuild must receive its own checksum; the version number alone is not an artifact identity.

## Released functionality retained

The integration retains all fourteen released commands for the shared office canvas, desktop/cloud/private-runtime connections, native local runtime, persistent tmux runtime, SSH/Vast connection profiles, Donna compute ownership, cloud operator, MCP configuration, refresh and disconnect. It adds/preserves four company workflows: team management, Donna ownership review, creative tools, and creative development.

The full canvas remains the primary office. Creative development is accessible from its toolbar, the activity view, the compute menu and the command palette. Scoped model/creative operations use the released cached runtime client and its bounded transport, cancellation, response identity and native compare-and-swap behavior. They do not introduce a general shell command bridge.

The MoE workflow uses the reviewed exact `qwen3-coder:30b-a3b-q4_K_M` profile, distinguishes installation from load state, checks the installed and assigned digest, and prepares a concrete JSON review before download, selection or task submission. Its task allowance is 8,000 total tokens within an explicitly enforced 8,192 context profile; prompt and adapter overhead consume part of that allowance. Worker state and native authority are preserved. Blender/Unreal actions reuse approved project, employee, tool, relative-path and operation boundaries.

## Successful verification

The locked dependencies were installed with `npm ci --ignore-scripts`. `npm run build` produced the shared renderer and portable backend. `npm run package` ran the package's prepublish syntax and test gates before creating the VSIX.

| Check | Result |
| --- | --- |
| JavaScript syntax gate | Passed |
| Complete extension test suite | **197 passed, 0 failed, 0 skipped** |
| Actual packaged native runtime test | Passed: independent startup, authenticated owner mutation, clean shutdown |
| Released activation and compute lifecycle fixtures | Passed |
| Scoped company/development activation fixtures | Passed, including final review, company-switch cancellation, changed-digest rejection and stable request identities |
| Native rejected-command receipt | Passed: a rejected inner command cannot be reported as saved merely because its transport envelope succeeded |
| Scoped endpoint validation | Passed: duplicate scopes, unsupported query fields, foreign endpoints and malformed job reads are rejected before credential dispatch |
| Donna asset packaging/integrity fixture | Passed, including editable scene and GLB inclusion and missing-file rejection |
| VSIX package creation | Passed |
| Pinned VS Code CLI installation | **Passed** in a fresh temporary extensions directory |

The actual packaged-runtime test uses isolated synthetic state with provider workers paused. It does not contact a model provider, rent compute, start a stopped instance, download model weights, use owner credentials, or modify an owner's workspace.

## Installed-editor gate: environment blocked

The unchanged installed-smoke script downloaded Microsoft's pinned **VS Code 1.147.0** Linux x64 archive (reported build `286f582d285a0bc8cb4c5cf3217fc5811544b39a`) and installed the preceding candidate successfully with CLI exit status 0. The subsequent editor launch failed before the test host executed because no display server was reachable. The final candidate was then regenerated to include the completed MCP GPU-receipt projection. Its exact archive identified above was separately installed with the same official CLI into another empty temporary profile: exit status 0, version 0.9.1 and eighteen commands verified, and the installed MCP file matched current source (`fc40bae65dd24a3c565e04f61a331618235eb6be0d5f51582e90c89cc35ccf8a`). The editor source did not change between these candidates; no further graphical launch was attempted.

The workspace runs without system package-install privileges. The configured signed Debian snapshot repositories were therefore used to download only `xvfb`, `xserver-common`, `xauth` and `tmux`; these were extracted into a task-local test prefix. Their dynamic libraries resolved. Xvfb still could not create local/Unix listening sockets in this environment: its diagnostics reported `Unable to open socket`, followed by `Cannot establish any listening sockets`. A separate display probe confirmed that no X socket existed and the assigned display could not be opened. No system configuration or owner profile was changed.

One bounded, separate diagnostic tried Electron's documented [`--ozone-platform=headless`](https://github.com/electron/electron/blob/main/docs/api/command-line-switches.md#--ozone-platformplatform-linux) mode using a temporary copy of the test launcher. It added only that display-backend flag, used another isolated profile, and did not modify product source or relax additional security settings. This launch also stopped before the test host, with socket/NETLINK permission errors and `SIGTRAP`. It is recorded as a failed headless diagnostic and is not visual acceptance. No further attempts were made to bypass the environment restrictions.

The local evidence paths are:

- `.work/final-cli-install/receipt.json` and `install.log`: successful installation of the final archive, its checksum, version, command count and matching MCP source.
- `.work/package-0.9.1.log`: final build/package gate with 197 passed, zero failed and zero skipped.
- `.work/installed-smoke/install.log`: successful CLI installation of the preceding candidate before the blocked graphical attempt.
- `.work/installed-smoke/receipt.json`: `failed-before-test-host` for the graphical gate.
- `.work/installed-headless-smoke/receipt.json`: failed diagnostic with the headless-runner annotation.

No passed installed-editor receipt was produced. Graphical VS Code acceptance, the installed persistent tmux/host fixture, and Windows installation remain unverified. Re-run the normal gate on a Linux host with working display and Unix-socket support:

```sh
cd vscode-extension
xvfb-run -a npm run test:installed
```

The gate must complete under its original isolated-profile, authenticated-loopback and no-provider-dispatch rules before claiming installed-editor acceptance.

## Remaining workload acceptance

This package result does not show that the reviewed MoE model is installed, resident in GPU memory or successfully generating on the intended VPS/Vast host. It does not verify CUDA/OPTIX execution, GPU memory headroom, Unreal rendering, a live Andolan/Yuga company binding, provider grants, or ChatGPT MCP connectivity. Those claims require the corresponding target-host observations and completed task receipts. Unreal's existing headless adapter remains limited by its `-NullRHI` operation profile.
