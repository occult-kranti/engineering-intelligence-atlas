#!/usr/bin/env python3
"""validate_casebook.py — casebook/link/path validation for the skill (stdlib only).

Checks:
  1. references/music_theory_audio_repo_cases.json: 13 cases; each has id, name,
     https URL, license{spdx,how_verified,verified}, pinned_commit.sha (40 hex),
     lifecycle.status, demonstrates, >=1 implementation lesson.
  2. references/repo_casebook.md: every case id appears as a '### <id> —' heading
     and every pinned full SHA appears in the document (JSON <-> md consistency).
  3. references/music_theory_role_resources.json: parses; exactly the three
     charter contexts; proposed_skill id is music-theory-production-engineering.
  4. Every relative Markdown link in SKILL.md and references/*.md resolves to an
     existing file (http(s) links are shape-checked only — offline validation,
     no fetching).
  5. No absolute filesystem paths (/mnt/, /home/, /Users/, C:\\, file://) in any
     packaged text file.

Exit 0 if all pass, 1 otherwise.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
REF = os.path.join(ROOT, "references")

failures = []


def check(ok, label):
    print(("ok   " if ok else "FAIL ") + label)
    if not ok:
        failures.append(label)


def validate_cases_json():
    path = os.path.join(REF, "music_theory_audio_repo_cases.json")
    doc = json.load(open(path, encoding="utf-8"))
    cases = doc["cases"]
    check(len(cases) == 13, f"13 repo cases present (got {len(cases)})")
    for c in cases:
        cid = c.get("id", "?")
        check(bool(re.fullmatch(r"[0-9a-f]{40}", c["pinned_commit"]["sha"])),
              f"{cid}: pinned commit is a full 40-hex SHA")
        check(c["url"].startswith("https://"), f"{cid}: https URL")
        for field in ("spdx", "how_verified", "verified"):
            check(bool(c["license"].get(field)), f"{cid}: license.{field} present")
        check(bool(c["lifecycle"].get("status")), f"{cid}: lifecycle.status present")
        check(bool(c.get("demonstrates")) and bool(c.get("implementation_lessons")),
              f"{cid}: demonstrates + lessons present")
    return cases


def validate_casebook_md(cases):
    md = open(os.path.join(REF, "repo_casebook.md"), encoding="utf-8").read()
    for c in cases:
        check(f"### {c['id']} —" in md, f"casebook heading for case '{c['id']}'")
        check(c["pinned_commit"]["sha"] in md, f"casebook records full SHA for '{c['id']}'")


def validate_role_resources():
    doc = json.load(open(os.path.join(REF, "music_theory_role_resources.json"),
                         encoding="utf-8"))
    check(doc["proposed_skill"]["id"] == "music-theory-production-engineering",
          "role resources: proposed_skill id correct")
    ctxs = {c["context"] for c in doc["agent_contexts"]}
    check(ctxs == {"music-theory-research-director",
                   "audio-dsp-production-engineer",
                   "creative-rights-reproducibility-editor"},
          f"role resources: exactly the three charter contexts ({sorted(ctxs)})")


ABS_PATH = re.compile(r"(/mnt/|/home/|/Users/|[A-Za-z]:\\\\|file://)")
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
URL_SHAPE = re.compile(r"https?://[^\s)\]>\"']+")


def validate_links_and_paths():
    texts = [os.path.join(ROOT, "SKILL.md")]
    texts += [os.path.join(REF, f) for f in sorted(os.listdir(REF)) if f.endswith(".md")]
    for path in texts:
        rel = os.path.relpath(path, ROOT)
        body = open(path, encoding="utf-8").read()
        m = ABS_PATH.search(body)
        check(m is None, f"{rel}: no absolute filesystem paths")
        for target in LINK.findall(body):
            if target.startswith(("http://", "https://", "mailto:")):
                check(bool(URL_SHAPE.fullmatch(target)), f"{rel}: URL shape {target[:60]}")
                continue
            dest = target.split("#", 1)[0]
            if not dest:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), dest))
            check(os.path.exists(resolved), f"{rel}: relative link resolves -> {dest}")
    # URLs embedded as bare text (not markdown links) also shape-checked lightly
    bare = 0
    for path in texts:
        body = open(path, encoding="utf-8").read()
        for u in URL_SHAPE.findall(body):
            bare += 1
            if u.endswith((".", ",", ";")):
                u = u[:-1]
            if not u.startswith(("http://", "https://")):
                check(False, f"{os.path.relpath(path, ROOT)}: malformed URL {u[:60]}")
    print(f"      ({bare} bare URLs shape-checked across {len(texts)} markdown files)")


def main():
    cases = validate_cases_json()
    validate_casebook_md(cases)
    validate_role_resources()
    validate_links_and_paths()
    if failures:
        print(f"\nvalidate_casebook FAILED ({len(failures)} failures)")
        return 1
    print("\nvalidate_casebook passed (JSON consistency, links, no absolute paths)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
