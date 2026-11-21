# Analysis report contract

## Required structure

1. **Executive summary** — purpose, authorized scope, principal defensive findings, confidence, and urgent actions.
2. **Sample/target identification** — source, filename/format/architecture, size, SHA-256, optional correlation hashes, original and working-copy relationships.
3. **Authorization and custody** — approval reference, permitted/prohibited actions, timestamps, custodians, storage locations, transfers, and integrity checks.
4. **Environment and reproducibility** — tool names/versions, exact commands or configuration, VM/snapshot/network controls, dependencies, and analysis dates.
5. **Static findings** — headers/imports/sections, strings, capabilities, control/data-flow observations, decompiler caveats, and relevant evidence offsets/locations.
6. **Dynamic findings** — only if authorized; execution timeline, file/registry/process/network/memory behavior, simulated environment, triggers, and coverage.
7. **Capability assessment** — observed versus inferred capabilities, prerequisites, affected assets, and confidence.
8. **Indicators and detection handoff** — contextualized IOCs/behavioral indicators, false-positive notes, YARA/Sigma/other defensive artifacts where appropriate, validation results.
9. **Risk and remediation** — defensive impact, containment/mitigation, detection deployment, owner, and coordinated disclosure status.
10. **Limitations and alternatives** — packing, anti-analysis, missing symbols/dependencies, incomplete triggers, simulation bias, tool uncertainty, and untested hypotheses.
11. **Appendices** — custody log, hashes, commands, logs, safe artifact references, and redaction/data-handling record.

## Evidence language

Use “observed” for direct evidence, “inferred” for reasoned interpretation, and “unknown/not tested” where evidence is absent. Assign confidence with rationale; never use a numeric confidence score without a defined rubric. Distinguish an indicator’s identity from maliciousness and avoid treating common libraries, IP addresses, or strings as independently malicious.

## Safe output rules

Redact credentials, personal data, confidential content, live harmful infrastructure, and unnecessary exploit detail. Store harmful artifacts only in controlled locations. Do not attach executable samples to ordinary reports. If a finding has dual-use risk, provide the minimum defensive reproduction evidence needed by the authorized audience and coordinate disclosure through the authorized channel.
