# Daftar Hardware Studio

This reusable kit installs the company, five departments, named specialist assignments, shared-service contracts, a six-step roadmap and a linked whiteboard through the existing native command boundary.

The canonical definition is [`index.json`](../index.json). Run the company-kit installer first, then the company skill refresh described in [`COMPANY_SETUP_REFRESH.md`](../../../project/COMPANY_SETUP_REFRESH.md). Reapplying adds missing skills while preserving saved employee priority, paused states, completed roadmap evidence and owner board edits.

## Ownership

- **Company director**: Scoped studio director.
- **Knowledge curator**: Studio source and evidence curator.
- **Quality reviewer**: Independent studio acceptance reviewer.
- **Office steward**: Studio blueprint and ownership steward.
- **Hardware product designer**: Hardware brief and assembly design specialist.
- **Embedded SDK engineer**: Python SDK and embedded build engineer.
- **Hardware verification reviewer**: Independent firmware and measurement reviewer.

## Delivery sequence

1. **Verify SDK source and supported module inventory**. Record the pinned upstream SDK, reviewed local patch, module compatibility and license. Acceptance: source SHA/package version and a reproducible validation command are in the evidence record.
2. **Define the first hardware product**. Use the Blueprint light example to define the desired behavior, board, ports, power assumptions and assembly instructions. Acceptance: a validated recipe and explicitly declared hardware inventory.
3. **Regenerate and compare the firmware source**. Run the existing generator twice against the accepted recipe. Acceptance: deterministic source digests and negative validation cases; generation is recorded separately from compilation.
4. **Verify the target compiler build**. Compile with a recorded toolchain and board target. Acceptance: real compiler log and binary hash; retain a blocked result if the target environment is absent.
5. **Measure the behavior on available hardware**. Only after confirmed equipment and scoped authorization, perform a bounded physical check with measured voltage/current and observable behavior. Acceptance: actual measurement receipt; absent hardware remains an explicit limitation.
6. **Review and archive the product handoff**. Independent review compares expected behavior with build and measurement evidence, records open limitations and links the accepted artifacts in Donna Brain.

## Operating boundary

Creation is configuration. It makes no provider requests, starts no workers and changes no existing budget or permissions. Source presence, installation, mock tests, actual execution and deployment have separate evidence states. Reuse the current native company if an earlier queued request has already created it; resolve its actual ID before applying this kit rather than creating a same-name duplicate.
