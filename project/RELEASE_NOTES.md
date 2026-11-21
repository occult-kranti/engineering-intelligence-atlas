# Daftar 0.6.1 — company kits and useful worker context

This patch adds reusable Fintech & Hackathon Studio and Social & Digital Presence company kits, a validated additive installer, and a worker-context correction found during the independent setup review.

## Company setup

The public catalog contains two generic companies, seventeen departments, eight domain specialties, eighteen owned roadmap steps, shared-service contracts, blueprint rooms, whiteboards and detailed operating guides. The native core supplies its normal director, specialist and assistant definitions; the installer reuses those records where appropriate. Personal source registers and company records are installed only in the owner's private workspace and are excluded from public installers and previews.

The installer previews without writes, validates references and capacity before applying, preserves owner names/progress/layout/status and reuses stable identities across reruns or an interrupted operation. It uses the existing MCP/native command API, with no provider request or external social action. The importer is additive, not an all-or-nothing database transaction; retained bindings allow a validated restart.

## Worker-context correction

Company-kit identity bindings are control metadata. They must not crowd source knowledge out of a specialist's bounded prompt. The worker excludes those binding records and resolves the selected specialist's same-company task contract where valid. Role descriptions and source knowledge do not grant tools or authority. Full reference documents remain links rather than automatically fetched files.

## Operating guides

- Fintech: opportunity qualification, current official event sources, sandbox product lanes, prototype verification, demo/submission readiness and continuity.
- Social presence: individuals through organizations, brand/editorial and creative production, channels/community, growth/lifecycle, account trust, provenance, measurement, supported platform capabilities and client separation.
- Existing private source material remains evidence-qualified: source input, draft, user-reported action, publication receipt and measured outcome are separate states.

Creating these companies does not connect financial/social accounts, start background workers, submit to a hackathon, buy advertising or publish messages. Those actions remain separately supported runtime operations with their existing scope and authorization.

## Verification and compatibility

The release workflow publishes this version only after its seven required jobs succeed, including the new real-native company-kit suite and focused worker-context tests. The existing Rust state schema, website API and explicit desktop sync protocol are retained. The Linux AppImage remains unsigned; actual owner-device keychain acceptance and signed cross-platform packaging are separate work. The VS Code attachment is the thin client, and Android carries the research atlas rather than the full native Office.

See the [company-kit guide](../company/company-kits/README.md), [roadmap](../ROADMAP.md), [handoff](../HANDOFF.md) and [validation](VALIDATION.md) for current evidence and remaining work.
