#!/usr/bin/env python3
"""Deterministic validator for the bundled casebook and role-resource mapping.

Validates, with no network access and no absolute workspace paths:
  1. references/architecture_backend_repo_cases.json  (schema, tiers, pins, RocksDB correction,
     postgres operational-docs key paths, pinned MIT dotnet/eShop case with no invented release tag)
  2. references/architecture_backend_role_resources.json (roles, tiers, linked standing slugs,
     ISO 42010/42030 + ATAM resources on the architecture context, SFIA PROG/SWDN/NFTS/DBDS resources)
  3. references/repo_cases.md digest consistency with the casebook
  4. references/labs_and_evaluation.md contains labs 15-17 and the evaluation-task count
  5. internal relative markdown links across SKILL.md and references/

Exit 0 on PASS, 1 on any FAIL. Stdlib only.
"""

import json
import re
import sys
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
REFS = SKILL_ROOT / "references"

EXPECTED_REFERENCES = [
    "architecture_tradeoffs.md",
    "distributed_systems.md",
    "storage_and_query_engines.md",
    "backend_platform_operations.md",
    "failure_modes.md",
    "repo_cases.md",
    "labs_and_evaluation.md",
]

EXPECTED_ROLE_SLUGS = {
    "software-architecture-principal",
    "database-systems-engineer",
    "backend-platform-staff-engineer",
}

# Standing role slugs from the 109-role catalog that the three contexts may link to
# (specialist contexts are delegation contexts, never new standing roles).
KNOWN_STANDING_SLUGS = {
    "software-solutions-architect",
    "staff-principal-engineer",
    "technical-program-manager",
    "product-manager",
    "database-engineer-dba",
    "data-engineer",
    "backend-engineer",
    "performance-engineer",
    "platform-engineer",
    "site-reliability-engineer",
    "api-integration-engineer",
    "devops-ci-cd-engineer",
    "cloud-infrastructure-engineer",
    "security-architect",
}

EVIDENCE_TIERS = {"O", "V", "C"}

failures = []
checks = 0


def check(ok, label):
    global checks
    checks += 1
    if not ok:
        failures.append(label)


def no_absolute_paths(obj, label):
    text = json.dumps(obj)
    check("/mnt/" not in text and not re.search(r'"(/[a-z]+/)+', text.replace("https://", "")),
          f"{label}: absolute workspace path embedded")


def load_json(name):
    path = REFS / name
    check(path.is_file(), f"missing {path.relative_to(SKILL_ROOT)}")
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        check(False, f"{name}: invalid JSON: {exc}")
        return None


def validate_cases(data):
    if data is None:
        return
    for key in ("schema_version", "verified_at", "verification_method", "evidence_legend", "cases"):
        check(key in data, f"casebook: missing top-level key '{key}'")
    check(set(data.get("evidence_legend", {})) == EVIDENCE_TIERS,
          "casebook: evidence_legend must define exactly O/V/C")
    no_absolute_paths(data, "casebook")

    cases = data.get("cases", [])
    check(len(cases) >= 20, f"casebook: expected >=20 cases, found {len(cases)}")
    ids = [c.get("id") for c in cases]
    check(len(ids) == len(set(ids)), "casebook: duplicate case ids")

    required = ("id", "repo", "url", "license", "lifecycle", "latest_release",
                "pinned", "learn", "cannot_learn", "category", "evidence")
    for case in cases:
        cid = case.get("id", "<no id>")
        for key in required:
            check(key in case and case[key] not in (None, ""), f"case '{cid}': missing '{key}'")
        check(str(case.get("url", "")).startswith("https://"), f"case '{cid}': url must be https")
        rel = case.get("latest_release", {})
        check("tag" in rel and "date" in rel, f"case '{cid}': latest_release needs tag+date")
        check("sha_prefix" in case.get("pinned", {}), f"case '{cid}': pinned.sha_prefix missing")
        check(isinstance(case.get("key_paths"), dict), f"case '{cid}': key_paths must be an object")

    rocks = next((c for c in cases if c.get("id") == "rocksdb"), None)
    check(rocks is not None, "casebook: rocksdb case missing")
    if rocks:
        check(rocks.get("repo") == "meta/rocksdb", "rocksdb: repo must be meta/rocksdb (facebook/rocksdb redirects)")
        check(rocks.get("latest_release", {}).get("tag") == "v11.13.2",
              f"rocksdb: latest release must be v11.13.2, found {rocks.get('latest_release', {}).get('tag')}")
        lic = rocks.get("license", "")
        check("Apache-2.0" in lic and "GPL-2.0" in lic, "rocksdb: license must be dual Apache-2.0 OR GPL-2.0")

    check(any("ARCHIVED" in c.get("lifecycle", "").upper() for c in cases),
          "casebook: expected at least one archived lifecycle case (redpanda)")

    pg = next((c for c in cases if c.get("id") == "postgres"), None)
    check(pg is not None, "casebook: postgres case missing")
    if pg:
        for path in ("doc/src/sgml/mvcc.sgml", "doc/src/sgml/monitoring.sgml",
                     "doc/src/sgml/pgstatstatements.sgml", "doc/src/sgml/ref/pgbench.sgml",
                     "doc/src/sgml/ref/pg_basebackup.sgml"):
            check(path in pg.get("key_paths", {}),
                  f"postgres: missing operational-docs key path '{path}'")

    eshop = next((c for c in cases if c.get("id") == "eshop"), None)
    check(eshop is not None, "casebook: eshop case missing")
    if eshop:
        check(eshop.get("repo") == "dotnet/eShop", "eshop: repo must be dotnet/eShop")
        check("MIT" in eshop.get("license", ""), "eshop: license must be MIT")
        check(eshop.get("pinned", {}).get("sha_prefix") == "ab10e4c68fd2",
              f"eshop: sha_prefix must be ab10e4c68fd2, found {eshop.get('pinned', {}).get('sha_prefix')}")
        check(eshop.get("pinned", {}).get("full_sha") == "ab10e4c68fd26369578ebfb3fd1ccf3b867d0444",
              "eshop: full_sha must be ab10e4c68fd26369578ebfb3fd1ccf3b867d0444")
        check(eshop.get("latest_release", {}).get("tag", "").startswith("n/a"),
              "eshop: no release tag exists — tag must stay n/a (never invent one)")
        for path in ("src/Basket.API/Program.cs", "src/Catalog.API/Program.cs",
                     "tests/Catalog.FunctionalTests/CatalogApiTests.cs",
                     "tests/Basket.FunctionalTests/RedisBasketRepositoryTests.cs"):
            check(path in eshop.get("key_paths", {}), f"eshop: missing key path '{path}'")
    return cases


def validate_roles(data):
    if data is None:
        return
    no_absolute_paths(data, "role-resources")
    skill = data.get("proposed_skill", {})
    check(skill.get("name") == "architecture-database-backend-engineering",
          "role-resources: proposed_skill.name mismatch")
    check(skill.get("structure", {}).get("references") == EXPECTED_REFERENCES,
          "role-resources: reference list must match the seven bundled references")

    roles = data.get("roles", [])
    check({r.get("slug") for r in roles} == EXPECTED_ROLE_SLUGS,
          f"role-resources: roles must be exactly {sorted(EXPECTED_ROLE_SLUGS)}")
    for role in roles:
        slug = role.get("slug", "<no slug>")
        for key in ("charter", "mission", "core_competencies", "resources",
                    "labs", "failure_modes_focus", "linked_role_slugs", "linked_skills"):
            check(key in role and role[key], f"role '{slug}': missing/empty '{key}'")
        check(len(role.get("core_competencies", [])) >= 5, f"role '{slug}': <5 core competencies")
        for res in role.get("resources", []):
            title = res.get("title", "<no title>")
            check(res.get("tier") in EVIDENCE_TIERS, f"role '{slug}' resource '{title}': bad tier")
            check(bool(res.get("url")) and bool(res.get("accessed")),
                  f"role '{slug}' resource '{title}': needs url+accessed")
        unknown = set(role.get("linked_role_slugs", [])) - KNOWN_STANDING_SLUGS
        check(not unknown, f"role '{slug}': linked_role_slugs not in standing catalog: {sorted(unknown)}")

    by_slug = {r.get("slug"): r for r in roles}
    arch_titles = " | ".join(res.get("title", "") for res in by_slug.get("software-architecture-principal", {}).get("resources", []))
    for marker in ("42010", "42030", "ATAM"):
        check(marker in arch_titles,
              f"role 'software-architecture-principal': missing '{marker}' resource")
    be_titles = " | ".join(res.get("title", "") for res in by_slug.get("backend-platform-staff-engineer", {}).get("resources", []))
    for marker in ("PROG", "SWDN", "NFTS"):
        check(marker in be_titles,
              f"role 'backend-platform-staff-engineer': missing SFIA '{marker}' resource")
    db_titles = " | ".join(res.get("title", "") for res in by_slug.get("database-systems-engineer", {}).get("resources", []))
    check("DBDS" in db_titles,
          "role 'database-systems-engineer': missing SFIA 'DBDS' resource")


def validate_digest_and_links(cases):
    digest_path = REFS / "repo_cases.md"
    if digest_path.is_file() and cases:
        digest = digest_path.read_text(encoding="utf-8")
        for case in cases:
            check(case["id"] in digest, f"digest: case id '{case['id']}' missing from repo_cases.md")
            tag = case.get("latest_release", {}).get("tag", "")
            if tag and tag not in ("n/a", "rolling") and not tag.startswith("n/a"):
                check(tag in digest, f"digest: tag '{tag}' for '{case['id']}' missing from repo_cases.md")

    labs_path = REFS / "labs_and_evaluation.md"
    if labs_path.is_file():
        labs = labs_path.read_text(encoding="utf-8")
        for marker in ("## Lab 15 ", "## Lab 16 ", "## Lab 17 ",
                       "dotnet/eShop", "ab10e4c68fd26369578ebfb3fd1ccf3b867d0444",
                       "p50/p95/p99", "pgbench", "pg_stat_statements", "pg_basebackup",
                       "RTO", "RPO", "ATAM", "42010"):
            check(marker in labs, f"labs_and_evaluation.md: missing '{marker}'")
        check("evaluation tasks 1\u20139" in labs or "1\u20139" in labs.split("Contents")[0],
              "labs_and_evaluation.md: contents must advertise evaluation tasks 1\u20139")

    md_files = [SKILL_ROOT / "SKILL.md"] + [REFS / name for name in EXPECTED_REFERENCES]
    link_re = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
    for md in md_files:
        check(md.is_file(), f"missing {md.relative_to(SKILL_ROOT)}")
        if not md.is_file():
            continue
        for target in link_re.findall(md.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("#") or target.startswith("mailto:"):
                continue
            target = target.split("#")[0].split(" ")[0]
            if not target:
                continue
            check((md.parent / target).resolve().is_file(),
                  f"{md.name}: broken relative link -> {target}")


def main():
    cases = validate_cases(load_json("architecture_backend_repo_cases.json"))
    validate_roles(load_json("architecture_backend_role_resources.json"))
    validate_digest_and_links(cases)

    print(f"validate_casebook: {checks - len(failures)}/{checks} checks passed")
    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("PASS: casebook, role mapping, digest, and internal links are consistent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
