# Resource Gap Fill — P0/P1 Closures for `role_resource_matrix_seed.json`

**Date:** 2026-11-20 · **Companion artifact:** `resource_gap_fill.json` (50 curated entries, machine-readable) · **Inputs:** `role_capability_depth_audit.md` §5.2 (gap table), §7 (evidence conventions), §10 (action queue item 2)

Additive curation only — no app code, workbooks, seed JSON, or repository files were modified.

---

## 1. What was closed

All eight P0/P1 resource gaps from audit §5.2 are now provisioned with **official standards, vendor docs, canonical books, or free courses** — no redundant generic resources. Each entry records URL (probe-verified 2026-11-20), access, license, caveat, level, prerequisites, target role slugs with `core`/`internal`/`conditional` flags and depth tiers, and which of the role's three seed evaluation tasks it supports (`portfolio_artifact`, `scenario_simulation`, `senior_scope_defense`).

| Gap (audit §5.2) | Priority | Entries | Target role(s) | Depth path enabled |
|---|---|---|---|---|
| Mobile development — zero iOS/Android/Flutter/RN resources | **P0** | 8 | `mobile-engineer` | Swift book / Android Compose course (foundational) → platform docs + architecture guide (core) → Flutter/RN as `conditional` cross-platform track |
| Identity/IAM — no OAuth/OIDC/SAML resources | **P0** | 10 | `iam-identity-engineer` (+1 internal edge to `security-grc-compliance-engineer`) | oauth.net (foundational) → RFC 6749, OIDC Core, SAML 2.0, SCIM, Keycloak (core) → RFC 9700 BCP, WebAuthn/FIDO2, NIST SP 800-63-4 (advanced) |
| Privacy/PETs & privacy law | **P1** | 5 | `privacy-engineer`, `legal-policy-compliance-specialist` | NIST Privacy Framework + Bhajaria (core) → Dwork–Roth DP theory + OpenDP tooling (advanced); GDPR text as legal core / engineer internal |
| SecOps tooling layer (detection, SIEM, MISP/ATT&CK, CVSS/EPSS/KEV) | **P1** | 8 | `detection-engineer`, `soc-security-analyst`, `threat-intelligence-analyst`, `vulnerability-management-engineer` | Sigma + ATT&CK + Elastic Security (core) → MITRE 11 Strategies (advanced SOC operating model); vuln trio CVSS v4.0 + EPSS + CISA KEV |
| Cloud security (CNAPP/CSPM/provider docs) | **P1** | 5 | `cloud-security-engineer` (+ internal edges to GRC) | AWS/Azure/GCP security pillars (core) → CIS Benchmarks + CSA CCM (advanced crosswalk layer) |
| Game audio (FMOD/Wwise/DSP) | **P1** | 4 | `game-audio-designer-programmer` | Game Audio Tutorial (craft core) → FMOD + Wwise docs (middleware core) → DSP Guide (programming depth for senior scope) |
| Finance for engineering companies | **P1** | 5 | `finance-operations-analyst` (+1 internal edge to `chief-technology-officer-vp-engineering`) | AccountingCoach + Financial Intelligence (foundational) → SaaS Metrics 2.0 + FinOps Framework (core) → Venture Deals (advanced) |
| GRC crosswalks (ISO 27001/SOC 2) | **P1** | 5 | `security-grc-compliance-engineer` (+ internal edge to `legal-policy-compliance-specialist`) | ISO 27001 + AICPA TSC (core) → SCF + NIST CSF OLIR mappings (crosswalk tooling) → NIST SP 800-53r5 (control catalog) |

## 2. Coverage improvements

- **P0 hiring pipelines unblocked.** `mobile-engineer` previously had *no* mobile-development resource (only mobile *security* and *RE*); it now has a serializable foundational→core→advanced path for both native platforms plus a trigger-gated cross-platform track — enough to run the "Mobile features" portfolio task and the offline/sync scenario as designed. `iam-identity-engineer` gains the full standards stack named in its own charter scenario ("SSO/OIDC/OAuth"), including the 2025-current items (RFC 9700, NIST SP 800-63-4 final) that most catalogs still cite in superseded form.
- **SecOps tooling layer established end-to-end.** The four SecOps charters previously shared frameworks but no tooling: detection-as-code (Sigma), technique taxonomy (ATT&CK), intel platform (MISP), SIEM reference (Elastic Security), SOC operating model (MITRE 11 Strategies), and the prioritization triad (CVSS v4.0 + EPSS + KEV) are all now mapped with cross-role edges that mirror real workflow (analyst consumes what the detection engineer authors).
- **GRC can now do its named eval task.** The "Control map" portfolio artifact requires crosswalk inputs; SCF, NIST CSF OLIR, and SP 800-53r5 supply the authoritative mappings, with ISO 27001 and AICPA TSC as the anchor frameworks.
- **Cross-functional seams wired, not duplicated.** Privacy Framework and GDPR are shared between `privacy-engineer` and `legal` with distinct flags (core vs internal); CSA CCM and CIS Benchmarks bridge cloud-security into GRC; Venture Deals gives finance a shared vocabulary with the CTO. No resource is mapped generically — every edge names the evaluation task it supports.
- **Expected depth-score effect** (per seed `scoring_rules`, recompute pending): the 20-role <70 band included `security-grc` (39), `legal` (51), `finance` (62), `game-audio` (63); mobile/IAM were the P0 hiring blockers. Each now has ≥2 foundational + ≥3 core + ≥1 advanced tier coverage against the 2/4/2 tier targets, which should lift all eight target roles toward the ≥70 "adequate" band before any hiring use.

## 3. Verification & evidence integrity

50 URLs probed 2026-11-20 (curl + Python requests, browser UA; web fetch for confirmation of one). **38 entries E3** (HTTP 200/202). **12 entries E2**, all in the audit's recheck-not-replace class:

- **Bot-walls (403):** W3C WebAuthn, FIDO Alliance, CISA KEV, MITRE, CSA CCM, ISO, FinOps, forEntrepreneurs, Taylor & Francis.
- **Google-domain SSL interception from probe sandbox:** developer.android.com ×3, cloud.google.com — official Google properties; flagged E2 rather than replaced.
- **One correction during curation:** the Dwork–Roth DP book URL at `cis.upenn.edu/~aaroth/privacybook.pdf` 404s; the correct author-posted PDF is `…/Papers/privacybook.pdf` (case-sensitive) — recorded in the entry.
- NIST SP 800-63-4 was linked to the **final 2025 publication** (`csrc.nist.gov/pubs/sp/800/63/4/final`), not the draft site.

## 4. Remaining gaps (explicitly out of scope — P2/P3, audit §5.2)

- GTM craft resources (Support 16, Customer Success 106, Sales 102, Talent 104, Brand 100, Social 98) — P2.
- CI-system-specific and cloud-provider practitioner docs for DevOps/CI-CD (31) and Cloud/Infra (30) — P2, tool-neutral by design.
- Building-code/regulatory resource for Architect (82) — P2; CAE theory textbook for CAE/FEA/CFD (90) — P2; AM feedstock/NDT for roles 71–73 — P2; narrative tooling (ink/Twine-class) for 58 — P2; rigging for 80 and psychometrics for 94 — P3.
- Unrelated action-queue items not touched here: the 3 stale 404 links (NIST GenAI Profile, two design books), the 76 unprobed catalog URLs, and the DevOps↔Platform boundary statement (audit §10, items 3–4).

## 5. How to apply

1. Merge `resource_gap_fill.json` entries into the resource catalog and add the `role_links` edges to each target role's `resources` block in the seed (respecting flag/tier as given).
2. Re-run the 2026-11-20 link probe over the 12 E2 URLs with non-bot headers before catalog publication.
3. Recompute role depth scores per `scoring_rules`; target ≥70 for all eight roles and ≥90 for the two P0 hiring pipelines (`mobile-engineer`, `iam-identity-engineer`).
