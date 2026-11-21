#!/usr/bin/env python3
"""Run the full offline test suite for the executive-operations-assistant skill.

Suites:
  1. Repository routing vectors (route_repositories.py --fixture)
  2. Action proposal validation (validate_action_plan.py --fixture)
  3. Schedule bounds + job policy audit (schedule_check.py --fixture)
  4. Study queue construction (dedupe, cap, provider-free drafts)
  5. Documentation hygiene: every markdown link is relative and resolves;
     no absolute filesystem paths in skill docs.

Deterministic, offline, stdlib-only. Exit code 0 when everything passes.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
from assistant_contract import ContractError, build_study_queue  # noqa: E402

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
ABSOLUTE_PATH_RE = re.compile(r"(?<![\w/.-])(?:/mnt/|/home/|/Users/|/tmp/|[A-Za-z]:\\\\)")


def run_script(name: str) -> bool:
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / name), "--fixture"],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode == 0


def check_study_queue() -> bool:
    fixture = json.loads((ROOT / "fixtures" / "study_queue.fixture.json").read_text(encoding="utf-8"))
    failures = 0
    for case in fixture["cases"]:
        i = case["input"]
        try:
            got = build_study_queue(i["skillId"], i["resources"], i["goal"], i.get("evaluation", ""), i.get("cap"))
        except ContractError as exc:
            print(f"FAIL {case['name']}: {exc}")
            failures += 1
            continue
        if got != case["expected"]:
            failures += 1
            print(f"FAIL {case['name']}: output mismatch")
        else:
            print(f"ok   {case['name']}: {len(got)} draft items, providerCalls=false")
    total = len(fixture["cases"])
    print(f"\n{total - failures}/{total} study queue cases passed")
    return failures == 0


def check_docs() -> bool:
    failures = 0
    docs = [ROOT / "SKILL.md"] + sorted((ROOT / "references").glob("*.md"))
    for doc in docs:
        text = doc.read_text(encoding="utf-8")
        rel = doc.relative_to(ROOT)
        for match in ABSOLUTE_PATH_RE.finditer(text):
            failures += 1
            print(f"FAIL {rel}: absolute path in docs: {match.group(0)!r}")
        for match in LINK_RE.finditer(text):
            target = match.group(1).split("#")[0]
            if not target or "://" in target or target.startswith("mailto:"):
                continue
            if target.startswith("/"):
                failures += 1
                print(f"FAIL {rel}: absolute link {target!r}")
                continue
            if not (doc.parent / target).resolve().exists():
                failures += 1
                print(f"FAIL {rel}: broken relative link {target!r}")
    print(f"docs: {len(docs)} files checked, {failures} problems")
    return failures == 0


def main() -> int:
    results = {}
    print("== repository routing ==\n")
    results["route_repositories"] = run_script("route_repositories.py")
    print("\n== action proposal validation ==\n")
    results["validate_action_plan"] = run_script("validate_action_plan.py")
    print("\n== schedule bounds and job policies ==\n")
    results["schedule_check"] = run_script("schedule_check.py")
    print("\n== study queue ==\n")
    results["study_queue"] = check_study_queue()
    print("\n== documentation links and paths ==\n")
    results["docs"] = check_docs()

    print("\n== summary ==")
    for name, ok in results.items():
        print(f"{'PASS' if ok else 'FAIL'} {name}")
    ok = all(results.values())
    print("ALL SUITES PASSED" if ok else "SOME SUITES FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
