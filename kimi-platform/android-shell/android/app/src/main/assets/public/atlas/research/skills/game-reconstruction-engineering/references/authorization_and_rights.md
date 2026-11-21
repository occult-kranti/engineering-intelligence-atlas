# Authorization, rights, and evidence custody

## Contents

- Authorization record
- Rights ledger
- ROM and asset rights
- Evidence custody
- Prohibited actions
- Legal note

## Authorization record

Retain an artifact containing: target title/platform/binary identity, rights holder, owner/authority granting access, purpose (interoperability, preservation, research, porting), permitted and prohibited techniques, data restrictions, analysis window, network constraints, disclosure contacts, and approval identity. A public preservation-research scope, the rights holder's written permission, or an intentionally provided lab target can supply boundaries; read the current policy rather than assuming. Past permission, community norms ("everyone decompiles this"), or the target's age are not authorization.

## Rights ledger

Maintain one per project, updated at every gate:

- **Engine code** — which route applies: clean-room reimplementation (spec-only), matching decompilation (verified against a user-supplied original), or source port of code the rights holder has released. Record the license posture of any upstream project relied on.
- **Assets** — never redistributed. Record the bring-your-own-assets verification path (expected hashes, extraction tooling, format provenance).
- **Trademarks** — naming, branding, and disclaimer rules for any public artifact.

## ROM and asset rights

- Use the bring-your-own-ROM/assets pattern (the model used by leading ports such as Ship of Harkinian): the build verifies user-supplied asset hashes; the project ships code and extraction tooling, never the assets.
- The agent never downloads, embeds, dumps from services it does not control, or redistributes game assets, ROMs, BIOS files, keys, or trademarked branding — even "for testing."
- Any asset-extraction work requires the HUMAN-2 gate: a named human decides the legality of the extraction/distribution path before handling. Document extraction tooling with format provenance.
- Treat license metadata from APIs and catalogs as observations, not legal facts. Blank means "not collected" or "not reported"; NOASSERTION means missing-or-unrecognized; neither proves absence of a license. A no-license repository is all-rights-reserved by default — forking or republishing it requires HUMAN-4 and usually counsel.

## Evidence custody

Follow a documented Collection → Examination → Analysis → Reporting process. Preserve originals read-only, analyze copies, hash on receipt and at each stage (SHA-256 primary; MD5/SHA-1 only for ecosystem correlation), record who/what/when/where/why, and maintain custody continuity. NIST SP 800-86 (https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-86.pdf) and RFC 3227 (https://datatracker.ietf.org/doc/rfc3227/) provide the underlying evidence-handling guidance.

Use `scripts/intake_and_hash.py` for the intake record. It reads bytes without executing the target, refuses to overwrite existing records, and rejects non-regular or symlink targets. Keep target material access-controlled, segregated, and clearly labeled; do not upload it to public analysis services or third-party AI services without explicit approval.

## Prohibited actions

Regardless of technical capability:

- No DRM, anti-cheat, anti-tamper, or license-check circumvention; no bypass of online-service protections.
- No inspection of, or connection to, third-party production services or live game servers outside written scope.
- No acquisition of copyrighted assets from ROM sites, dumps, or other users.
- No publication of a reconstruction, patch, or tool before the HUMAN-3 release gate.
- Dynamic execution of target code only within explicit dynamic scope and verified isolation (disposable environment, clean snapshot, no production credentials, no route to production or real services, capture, time limits, restore procedure) — the same boundary as defensive reverse engineering.

## Legal note

Reverse-engineering legality — including interoperability exceptions, anti-circumvention rules, and contractual/EULA constraints — varies by jurisdiction, purpose, target, and method, and game reconstruction sits closer to contested territory than security research does. Provide general information only; involve qualified counsel where scope or law is uncertain.
