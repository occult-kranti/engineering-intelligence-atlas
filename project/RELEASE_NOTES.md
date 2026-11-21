# Daftar 0.7.0 — Freeflow company studio and private runtimes

This release brings the Freeflow conference table, company and subdepartment hierarchy, visiting-employee workspaces, shared local models, a permanent observer and a Linux headless runtime into one source tree.

## Workspace

Company seats lead into offices and nested departments. The canvas supports top and perspective views, pan/zoom/rotation, optional automatic seat browsing, edge pan, list navigation and bounded rendering. Donna is movable with pointer or keyboard and includes docking, position lock/reset, scope and connection options. Both Violet studio and Golden drafting remain available.

## Ownership and sharing

The private website adds People & access, a visiting office and an invitation review screen. Owner membership edits use revision checks; expiry/revocation and owner deactivation are rechecked at admission. Visitor canvases use a restricted projection and mask inaccessible areas. Hidden roadmap changes do not alter a visitor's counts or fingerprint. Company membership still requires access to the private Site; the release does not broaden the Site audience.

Native company and department parents are validated as forests. Departments cannot cross company or office boundaries. Parent relationships do not grant permissions or cascade pause/resume. Additive hierarchy reconciliation preserves existing custom parents and existing company records.

## Runtime, models and observer

A Node service reuses the Rust core and worker pool on a Linux VPS or Vast VM. It supplies authenticated private HTTP control, durable command receipts, optional configured cloud-device synchronization, and nine stdio MCP tools. Jobs survive an MCP client disconnect, and workers start paused after a restart.

A shared model pool deduplicates approved Ollama pulls, tracks per-company request receipts, verifies installed model digests and binds employee assignments. Shared model bytes do not share private prompts. Runtime operators must explicitly configure local-only Ollama; existing office jobs using other tags need a reviewed model assignment. Host/GPU costs remain separate from token accounting. No model weights or paid infrastructure are included in the release.

The permanent observer runs deterministic checks without a model call, uses live lease evidence for running jobs, reports index coverage and recorded ledger problems, and cannot turn a successfully committed command into an apparent failure. Its initial implementation and tests were authored through the configured Sonnet conversation and then independently reviewed and integrated.

## Verification and setup

See [the 0.7.0 validation receipt](FREEFLOW_VALIDATION.md), [VPS setup](../deploy/README.md), [shared models](../deploy/MODEL_POOL.md), [MCP setup](../tools/DAFTAR_RUNTIME_MCP.md), and [the current handoff](../HANDOFF.md). The release workflow builds Linux, Windows x64, VS Code and the Android atlas and publishes only after its gates pass. Signed installers, an owner-machine keychain test, a real Vast rental and a live ChatGPT tunnel are separate acceptance environments.
