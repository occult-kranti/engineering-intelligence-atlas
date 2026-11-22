# Daftar 0.9 preview — the primary VS Code office

The VS Code extension now packages the shared infinite office canvas and its own
native backend. Open companies, departments, Donna, blueprints and work surfaces
inside the editor, then place the runtime locally or on a Remote-SSH host.

Verified product source: `7766c91c6d6c3481b419623f1149a291d2da439d` on
`design/infinite-blueprint-canvas`.

**[v0.9.0-preview.1](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.9.0-preview.1)
is publicly available as a prerelease**, published at `2026-11-22T02:34:51Z`.
Its tag points to the verified source above. Both VSIXs, the verification archive
and `SHA256SUMS` were independently downloaded without authentication and their
actual bytes verified. The [publication receipt](release-0.9.0-preview.1.json)
records the public readback, asset digests and checksums.

## Install the matching package

| Where the extension runs | Asset |
| --- | --- |
| Linux x64, including a matching Vast/Remote-SSH container | [daftar-office-0.9.0-linux-x64.vsix](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.9.0-preview.1/daftar-office-0.9.0-linux-x64.vsix) |
| Windows x64 local extension host | [daftar-office-0.9.0-win32-x64.vsix](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.9.0-preview.1/daftar-office-0.9.0-win32-x64.vsix) |

In VS Code, use **Extensions → … → Install from VSIX**. Match the extension host,
including the remote machine in Remote-SSH. Backend startup requires Node 22+
from the editor or the absolute `atlas.nodePath` setting. The Linux native binary
requires glibc 2.34+ and `libgcc_s.so.1`; persistence and host shell jobs require
Linux with tmux. Installed acceptance uses VS Code 1.147.0.

Run **Daftar: Start Workspace on This Host**, then **Daftar: Open Office**.
On Linux, **Daftar: Start Persistent Workspace in tmux** keeps the daemon running
after editor detachment. **Donna Compute and Ownership** opens the owner controls.
The existing Vast instance remains stopped until the owner resumes it.

## Included

- Full shared office canvas in an editor tab, with movable Donna and a six-stage
  setup popup. Company creation reaches the same native core used by the desktop.
- **God mode — owner host control:** one revision-checked policy transaction grants
  auto host-command admission to the exact current active company set. Jobs retain
  a canonical employee, stable identity, limits and receipts. The preset runs as
  the runtime OS account; it does not alter platform approvals, budgets or instance
  lifecycle. New companies require a deliberate refresh.
- Editor-owned and persistent tmux runtime lifecycles, strict existing-host SSH
  connection, private credential handling, connector readiness and MCP setup.
- Managed Python environments, installed model ownership/sharing and bounded
  expert-route plans. Routes compose native jobs; they do not train new MoE weights.
- Reviewed design-application plans and explicit installation jobs for Blender,
  Godot, GIMP, Krita and Inkscape. Penpot remains blocked pending its managed
  container deployment path. No live design application was installed in this run.
- Permanent Cloud Compute Operator, Runtime Observer, Knowledge Steward and
  Connector Steward role definitions, with native hiring/reuse.
- Worker idle/error backoff at 15/30/60/120 seconds by default, immediate explicit
  one-shots, and owned cleanup. This is application scheduling, not VPS suspension.
- A private rolling activity journal capped at 1,000 events/1 MiB, indexed metadata
  queries, retention-gap reporting, deterministic summaries and a 64-entry cache.
  Metadata logging preserves native operation receipts when logging itself fails.
- The packaged stdio bridge exposes 35 reviewed MCP tools, including God mode and
  activity operations. A separate supported registration/tunnel connects ChatGPT.

## Verification

[Product CI 44974716262](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44974716262)
passed for the exact source above:

| Gate | Result |
| --- | --- |
| Linux extension tests | 129 passed, zero failed/skipped |
| Windows extension tests | 122 passed, zero failed; 7 Linux-only cases skipped |
| Installed Linux package | 11 checks passed, including real persistent tmux and host execution |
| Installed Windows package | 9 checks passed, including native backend readiness and shutdown |
| Shared canvas | 5 browser checks passed at 1440 × 900 with sandboxed Chrome |

The canvas gate verifies native company creation, zoom/pan, Donna movement and
setup-popup interaction. It records zero page/CSP/console/RPC errors, external
requests, provider calls or credential exposure. It uses the actual renderer and
bridge with an emulated VS Code parent and a real temporary native backend.

[Runtime/container CI 44973271977](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44973271977)
passed at `f8ba6c5`; that runtime source is unchanged in this product commit.
Separate suites passed 158 Node tests, 86 native-boundary/provider/worker tests,
26 Python deployment tests and 12 real native HTTP/stdio checks. Real tmux was
required. Container build, protected-secret rebuild, healthy boot and authenticated
API/MCP checks passed. Test-suite counts are not doubled for packaging reruns.

[SHA256SUMS](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.9.0-preview.1/SHA256SUMS)
covers exactly both VSIXs and the
[verification archive](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.9.0-preview.1/daftar-0.9.0-preview.1-verification.zip).
All four public downloads match their local hashes and GitHub asset digests.
The archive retains installed receipts, screenshots, artifact provenance, ELF
requirements and the backend evidence collection. Its extraction metadata is a
prepublication snapshot preserved unchanged; the publication receipt records the
later public release and independent download verification.

## Live acceptance still needed

The owner's Vast GPU/driver, actual model loading/inference, application
installation/display/rendering and ChatGPT MCP registration were not exercised.
The owned-process and bounded stress checks do not prove universal absence of
memory leaks. Other operating systems and CPU architectures need their own build
and acceptance before installing a native package.

[Setup guide](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/design/infinite-blueprint-canvas/project/VSCODE_PRIMARY_PRODUCT.md)
· [God mode, roles and activity](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/design/infinite-blueprint-canvas/project/OPERATIONS_CONTROL.md)
· [Full verification and screenshots](https://github.com/occult-kranti/engineering-intelligence-atlas/blob/design/infinite-blueprint-canvas/project/VSCODE_PRODUCT_VALIDATION.md)
