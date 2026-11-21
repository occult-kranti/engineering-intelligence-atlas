#!/usr/bin/env python3
"""Validate the bundled UI/UX casebook and role-resource data (deterministic).

Checks, with named violations and a non-zero exit on failure:

  references/ui_ux_repo_cases.json
    - exactly 25 cases and 10 recreated-project labs, unique ids
    - required fields per case (license spdx + verification date, lifecycle,
      demonstrates, >=1 implementation lesson) and per lab (source_repos,
      task, evaluates)
    - every lab source_repo resolves to a case in the casebook
    - license-discipline anchors stay intact: axe-core = MPL-2.0 + Exhibit B,
      pa11y = LGPL-3.0-only, NVDA = GPL-2.0-or-later with exceptions,
      7GUIs = no license (all rights reserved)

  references/ui_ux_role_resources.json
    - required top-level structure, three agent-charter focus blocks with
      core/internal/conditional lists
    - every resource entry has name/url/flag/evidence; flag in
      {core, internal, conditional}; evidence tier in {E1, E2, E3}
    - the single proposed role (product-designer-ux-researcher) is present
      and no additional standing roles are minted
    - no workspace-absolute paths (/mnt/, /app/) in either bundled file;
      only external https:// URLs

Usage: validate_casebook.py [--quiet]
Exit codes: 0 = valid, 1 = violations found, 2 = file/parse error.
"""

import argparse
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REFERENCES = os.path.join(HERE, "..", "references")

CASE_REQUIRED = ("id", "name", "url", "category", "license", "lifecycle",
                 "demonstrates", "implementation_lessons")
LAB_REQUIRED = ("id", "title", "source_repos", "task", "evaluates")
EXPECTED_CASE_COUNT = 25
EXPECTED_LAB_COUNT = 10
EXPECTED_CHARTERS = ("product-ux-research-lead",
                     "design-systems-accessibility-engineer",
                     "interaction-prototyping-evaluation-specialist")
PROPOSED_ROLE_ID = "product-designer-ux-researcher"
ABS_PATH_RE = re.compile(r"/mnt/|/app/|/Users/|[A-Za-z]:\\\\")

LICENSE_ANCHORS = {
    "axe-core": ("MPL-2.0", "Exhibit B"),
    "pa11y": ("LGPL-3.0-only",),
    "nvda-screen-reader": ("GPL-2.0-or-later", "exceptions"),
    "7guis": ("no license",),
}


def _walk_strings(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _walk_strings(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _walk_strings(v, f"{path}[{i}]")
    elif isinstance(obj, str):
        yield path, obj


def check_no_absolute_paths(data, label, violations):
    for spath, s in _walk_strings(data):
        if ABS_PATH_RE.search(s):
            violations.append(f"{label}: workspace-absolute path at {spath}: {s[:80]}")


def validate_cases(casebook, violations):
    cases = casebook.get("cases")
    labs = casebook.get("recreated_project_labs")
    if not isinstance(cases, list):
        violations.append("casebook: 'cases' is missing or not a list")
        return
    if not isinstance(labs, list):
        violations.append("casebook: 'recreated_project_labs' is missing or not a list")
        return

    if len(cases) != EXPECTED_CASE_COUNT:
        violations.append(f"casebook: expected {EXPECTED_CASE_COUNT} cases, "
                          f"found {len(cases)}")
    if len(labs) != EXPECTED_LAB_COUNT:
        violations.append(f"casebook: expected {EXPECTED_LAB_COUNT} labs, "
                          f"found {len(labs)}")

    case_ids, case_names = [], set()
    for c in cases:
        for field in CASE_REQUIRED:
            if field not in c:
                violations.append(f"case {c.get('id', '?')}: missing {field!r}")
        case_ids.append(c.get("id"))
        case_names.add(str(c.get("name", "")).split(" (")[0])
        lic = c.get("license", {})
        if not lic.get("spdx") or not lic.get("verified"):
            violations.append(f"case {c.get('id', '?')}: license needs spdx + verified")
        if not c.get("implementation_lessons"):
            violations.append(f"case {c.get('id', '?')}: no implementation lessons")
        if not str(c.get("url", "")).startswith("https://"):
            violations.append(f"case {c.get('id', '?')}: url must be https:// external")

    for dup in {i for i in case_ids if case_ids.count(i) > 1}:
        violations.append(f"casebook: duplicate case id {dup!r}")

    by_id = {c.get("id"): c for c in cases}
    for anchor_id, needles in LICENSE_ANCHORS.items():
        c = by_id.get(anchor_id)
        if not c:
            violations.append(f"license anchor case {anchor_id!r} missing")
            continue
        hay = json.dumps(c).lower()
        for needle in needles:
            if needle.lower() not in hay:
                violations.append(
                    f"case {anchor_id!r}: license anchor {needle!r} not found - "
                    "license discipline detail was lost")

    lab_ids = []
    for lab in labs:
        for field in LAB_REQUIRED:
            if field not in lab:
                violations.append(f"lab {lab.get('id', '?')}: missing {field!r}")
        lab_ids.append(lab.get("id"))
        for repo in lab.get("source_repos", []):
            if repo not in case_names:
                violations.append(f"lab {lab.get('id', '?')}: source_repo "
                                  f"{repo!r} does not match any case name")
    for dup in {i for i in lab_ids if lab_ids.count(i) > 1}:
        violations.append(f"casebook: duplicate lab id {dup!r}")


def validate_role_resources(rr, violations):
    for key in ("schema_version", "generated", "flag_definitions",
                "tier_definitions", "evidence_levels", "proposed_skill",
                "proposed_role", "agent_charter_resource_focus"):
        if key not in rr:
            violations.append(f"role resources: missing top-level key {key!r}")

    role = rr.get("proposed_role", {})
    if role.get("id") != PROPOSED_ROLE_ID:
        violations.append(f"role resources: proposed_role.id must be "
                          f"{PROPOSED_ROLE_ID!r} (single candidate, no role inflation)")

    focus = rr.get("agent_charter_resource_focus", {})
    for charter in EXPECTED_CHARTERS:
        block = focus.get(charter)
        if not block:
            violations.append(f"role resources: charter focus {charter!r} missing")
            continue
        for bucket in ("core", "internal", "conditional"):
            if bucket not in block:
                violations.append(f"role resources: {charter}: missing {bucket!r}")

    resources = role.get("resources", {})
    if not all(t in resources for t in ("foundational", "core", "advanced")):
        violations.append("role resources: tiers foundational/core/advanced required")
    seen_ids = set()
    for tier, items in resources.items():
        for item in items:
            name = item.get("name", "?")
            for field in ("name", "url", "flag", "evidence"):
                if field not in item:
                    violations.append(f"resource ({tier}) {name!r}: missing {field!r}")
            if item.get("flag") not in ("core", "internal", "conditional"):
                violations.append(f"resource ({tier}) {name!r}: bad flag "
                                  f"{item.get('flag')!r}")
            if item.get("evidence") not in ("E1", "E2", "E3"):
                violations.append(f"resource ({tier}) {name!r}: bad evidence tier "
                                  f"{item.get('evidence')!r}")
            if item.get("flag") == "conditional" and "trigger" not in item:
                violations.append(f"resource ({tier}) {name!r}: conditional flag "
                                  "requires a trigger")
            seen_ids.add(name)
    if len(seen_ids) < 30:
        violations.append(f"role resources: suspiciously few resources ({len(seen_ids)})")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--quiet", action="store_true")
    args = p.parse_args(argv)

    violations = []
    paths = {
        "casebook": os.path.join(REFERENCES, "ui_ux_repo_cases.json"),
        "role resources": os.path.join(REFERENCES, "ui_ux_role_resources.json"),
    }
    data = {}
    for label, path in paths.items():
        try:
            with open(path, encoding="utf-8") as f:
                data[label] = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"error: cannot load {path}: {e}", file=sys.stderr)
            return 2

    for label, blob in data.items():
        check_no_absolute_paths(blob, label, violations)
    validate_cases(data["casebook"], violations)
    validate_role_resources(data["role resources"], violations)

    if violations:
        print(f"INVALID - {len(violations)} violation(s):")
        for v in violations:
            print(f"  - {v}")
        return 1
    if not args.quiet:
        print("OK: casebook (25 cases + 10 labs) and role resources valid; "
              "license anchors intact; no workspace-absolute paths.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
