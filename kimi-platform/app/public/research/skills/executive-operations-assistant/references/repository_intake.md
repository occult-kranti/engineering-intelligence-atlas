# Repository intake

Owner: the permanent **repository-integration steward** (under Donna). Source of truth: `RepositoryMetadataSchema`, `REPO_ROUTING_RULES`, `routeRepository` in the shared contract. Offline verifier: `scripts/route_repositories.py` with `fixtures/repositories.fixture.json`.

## Surfaces

- **Desktop: read-only public GitHub metadata.** The steward reads *confirmed* public repository metadata only: url, owner, name, description, language, topics, license (SPDX id), archived flag, default branch, full 40-char HEAD commit SHA, visibility. It **never clones, never fetches code, never executes downloaded code**.
- **Two intake modes, enforced in code** (`validateRepositoryIntake`): `public-anonymous` reads confirmed public metadata with **no** credentials (a credential record id is rejected as `credential-not-permitted`); `credentialed-approved` uses a vault credential record and is only valid under an approved `repository.import` proposal — a missing record is rejected as `credentials-required`.
- **Web: encrypted integration.** Server-side metadata reads run through the encrypted integration path with credentials gated by the non-bypassable `credentials` gate (see [security_governance.md](security_governance.md)); credential ids live in the vault, never in payloads, logs, or fixtures.
- **Page caps and rate limits:** metadata enumeration is bounded (page caps per repository/owner, polite rate limits, idempotent re-reads keyed by URL + commit SHA). A failed read is retried ≤2× with backoff and then recorded as a typed failure — never a storm.

## Honesty rules (applied in order, all deterministic)

1. **Non-public visibility → quarantine.** Only confirmed public metadata reads are permitted; private/internal repos go to human triage.
2. **Pinned SHA:** every plan is pinned to `url + commitSha`. Drift is surfaced by the `repository_sync` job as a *proposal*, never an automatic re-import.
3. **License:** the permissive allowlist is `mit, apache-2.0, bsd-2-clause, bsd-3-clause, 0bsd, isc, cc0-1.0, unlicense, zlib`. No declared license — or any license off the allowlist (e.g., GPL) — forces `readOnly: true` and `redistributionAllowed: false`.
4. **Archived upstream → quarantined read-only reference**; a best-effort route may be recorded read-only, but nothing is assigned or redistributed.
5. **Keyword routing** into the existing `creative_technology_group` companies/departments/skills only, via the seven declared rules (cybersecurity, ai-research, backend-engineering, computational-geometry, design, music-production, mathematics). Match count decides; ties resolve to the earlier declared rule; confidence is `min(0.9, 0.4 + 0.15 × matches)`. Every rule's skill is a declared skill for its discipline — no invented skills.
6. **No match + new-domain hint** (robotics, biotech, quantum, aerospace, embedded, blockchain, hardware, autonomous) → `proposed_new_structure` at confidence **0.25**: an explicit low-confidence proposal for human approval via `repository.propose_structure`. **Never** automatic companies, departments, or roles.
7. **No match at all → quarantine.**

## Actions and gates

- `repository.assign` (medium, `plan-approval`): apply a routing plan to a company/department.
- `repository.propose_structure` (high, structural, `high-risk` + `plan-approval`): the only path to new structure; human-approved, explicit, low-confidence-labeled.
- `repository.import` (high, external, `external-writes` + `credentials` + `high-risk`): the only action that touches an external system, and it is always human-gated.

## Non-negotiables

No automatic clone, no code execution, no external writes, no redistribution of non-allowlisted code, no role/skill/structure inflation. Every routing decision is a proposal with a rationale and notes; quarantine is the default when confidence or legitimacy is absent. Known vectors (in the fixture): UI/React, AI/security, backend/db, design/geometry, music/audio (GPL → read-only), unknown/unlicensed (→ quarantine), archived (→ read-only quarantine), private (→ quarantine), new domain (→ 0.25 proposal).
