#!/usr/bin/env python3
"""Casebook, role-mapping, link, and path validator (Python 3 stdlib only).

Run from anywhere; resolves the skill root as the parent of this script's
directory. Checks, failing nonzero with a report:

1. assets/repo_cases.json - all 8 cases present with required fields, valid
   40-hex pinned SHAs, ISO dates, non-empty lessons; ids match the summaries
   in references/repo_casebook.md.
2. assets/role_mapping.json - every mapped slug is in the allowed
   existing-role-slug list (no new standing roles); contexts non-empty.
3. No absolute machine paths (workspace roots, user-home roots, drive
   letters) anywhere in the skill's text files.
4. Every relative Markdown link in SKILL.md and references/*.md resolves to an
   existing file in the skill.

Usage:
  casebook_validator.py            # full check
  casebook_validator.py --self-test  # same check; alias for CI symmetry
"""

import argparse
import json
import os
import re
import sys

SKILL_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REQUIRED_CASE_FIELDS = ["id", "name", "url", "category", "license", "pinned_commit",
                        "lifecycle", "demonstrates", "implementation_lessons"]
EXPECTED_CASE_IDS = ["met-openaccess", "smithsonian-openaccess", "iiif-api",
                     "isohedral-tactile", "paperjs", "openscad", "freecad", "antiprism"]

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ABS_PATH_RE = re.compile(r"(/mnt/|/app/|/home/|/Users/|/var/|/tmp/[A-Za-z]|[A-Za-z]:[\\/][A-Za-z])")
MD_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")

TEXT_SUFFIXES = {".md", ".py", ".json", ".txt", ".svg"}


def check_repo_cases(errors):
    path = os.path.join(SKILL_ROOT, "assets", "repo_cases.json")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"repo_cases.json unreadable: {exc}")
        return
    cases = data.get("cases", [])
    ids = [c.get("id") for c in cases]
    if sorted(ids) != sorted(EXPECTED_CASE_IDS):
        errors.append(f"repo_cases.json case ids {ids} != expected {EXPECTED_CASE_IDS}")
    for c in cases:
        cid = c.get("id", "<missing id>")
        for field in REQUIRED_CASE_FIELDS:
            if field not in c:
                errors.append(f"{cid}: missing field {field!r}")
        sha = c.get("pinned_commit", {}).get("sha", "")
        if not SHA_RE.match(sha):
            errors.append(f"{cid}: pinned_commit.sha {sha!r} is not 40-hex")
        verified = c.get("license", {}).get("verified", "")
        if not DATE_RE.match(verified):
            errors.append(f"{cid}: license.verified {verified!r} is not ISO date")
        if not c.get("license", {}).get("spdx"):
            errors.append(f"{cid}: missing license.spdx")
        if not c.get("implementation_lessons"):
            errors.append(f"{cid}: empty implementation_lessons")
    # cross-check the markdown casebook names the same case ids
    md_path = os.path.join(SKILL_ROOT, "references", "repo_casebook.md")
    try:
        with open(md_path, encoding="utf-8") as fh:
            md = fh.read()
        for cid in EXPECTED_CASE_IDS:
            if cid not in md:
                errors.append(f"repo_casebook.md does not mention case id {cid!r}")
    except OSError as exc:
        errors.append(f"repo_casebook.md unreadable: {exc}")


def check_role_mapping(errors):
    path = os.path.join(SKILL_ROOT, "assets", "role_mapping.json")
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"role_mapping.json unreadable: {exc}")
        return
    allowed = set(data.get("existing_role_slugs_allowed", []))
    if not allowed:
        errors.append("role_mapping.json: empty existing_role_slugs_allowed")
    contexts = data.get("contexts", [])
    if not contexts:
        errors.append("role_mapping.json: no contexts")
    for ctx in contexts:
        name = ctx.get("context", "<unnamed>")
        for slug in ctx.get("maps_to_existing_role_slugs", []):
            if slug not in allowed:
                errors.append(f"{name}: slug {slug!r} is not an allowed existing role slug")


def iter_text_files():
    for root, dirs, files in os.walk(SKILL_ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in sorted(files):
            if os.path.splitext(name)[1] in TEXT_SUFFIXES:
                yield os.path.join(root, name)


def check_absolute_paths(errors):
    for path in iter_text_files():
        rel = os.path.relpath(path, SKILL_ROOT)
        with open(path, encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, 1):
                if "ABS_PATH_RE" in line:
                    continue  # the detector's own pattern definition
                m = ABS_PATH_RE.search(line)
                if m:
                    errors.append(f"{rel}:{lineno}: absolute path fragment {m.group(0)!r}")


def check_markdown_links(errors):
    md_files = [os.path.join(SKILL_ROOT, "SKILL.md")]
    ref_dir = os.path.join(SKILL_ROOT, "references")
    if os.path.isdir(ref_dir):
        md_files += [os.path.join(ref_dir, f) for f in sorted(os.listdir(ref_dir))
                     if f.endswith(".md")]
    for path in md_files:
        rel = os.path.relpath(path, SKILL_ROOT)
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        for target in MD_LINK_RE.findall(text):
            if target.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = target.split("#", 1)[0]
            if not target:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(resolved):
                errors.append(f"{rel}: broken relative link {target!r}")


def run():
    errors = []
    check_repo_cases(errors)
    check_role_mapping(errors)
    check_absolute_paths(errors)
    check_markdown_links(errors)
    return errors


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--self-test", action="store_true", help="run the full check (alias)")
    ap.parse_args(argv)
    errors = run()
    if errors:
        print(f"casebook validation FAILED ({len(errors)} error(s)):")
        for e in errors:
            print(" -", e)
        return 1
    print("casebook validation OK: 8 repo cases, role slugs existing-only, "
          "no absolute paths, all relative links resolve")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
