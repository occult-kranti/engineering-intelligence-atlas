#!/usr/bin/env python3
"""Validate assistant action proposals against the closed policy set.

Deterministic, offline, stdlib-only mirror of validateAssistantAction in the
shared assistant contract (app/contracts/assistant.ts). Authorization lives
in this code, never in prompt text. Enforced, in order:

  contract version -> closed action set -> payload hash integrity ->
  policy-derived risk/approval -> actor scope coverage -> forbidden payload
  keys (no side effects, secrets, or reasoning) -> drain+preserve on
  fire/archive -> human approval -> explicit confirmation of every gate.

The gates are non-bypassable: an approval without every required gate
confirmed is rejected. This tool only VALIDATES; it never executes.

Usage:
  python3 validate_action_plan.py PROPOSAL.json [--approval APPROVAL.json]
  python3 validate_action_plan.py --fixture [PATH]

APPROVAL.json shape: {"approved": true, "confirmedGates": ["plan-approval"]}
Exit code: 0 when valid (or all fixture cases pass), 1 otherwise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assistant_contract import (  # noqa: E402
    ContractError,
    build_cache_invalidation_report,
    reorder_queue_items,
    validate_action,
    validate_repository_intake,
)

DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "action_plans.fixture.json"


def _check(case: dict, fn) -> tuple:
    """Run fn(); return (ok_flag, error_code_or_None)."""
    try:
        fn()
        return (True, None)
    except ContractError as exc:
        return (False, exc.code)


def run_fixture(path: Path) -> int:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    failures = 0
    total = 0

    def report(name: str, got: tuple, expected: tuple) -> None:
        nonlocal failures, total
        total += 1
        if got != expected:
            failures += 1
            print(f"FAIL {name}: got {got}, expected {expected}")
        else:
            verdict = "valid" if got[0] else f"rejected ({got[1]})"
            print(f"ok   {name}: {verdict}")

    for case in fixture["cases"]:
        report(case["name"], _check(case, lambda c=case: validate_action(c["proposal"], c["approval"])),
               (case["expect"]["ok"], case["expect"]["code"]))

    for case in fixture.get("queueReorder", {}).get("cases", []):
        if "expectError" in case:
            report(case["name"], _check(case, lambda c=case: reorder_queue_items(c["items"], c["orderedIds"])),
                   (False, case["expectError"]))
        else:
            got = reorder_queue_items(case["items"], case["orderedIds"])
            total += 1
            if got != case["expected"]:
                failures += 1
                print(f"FAIL {case['name']}: reordered output mismatch")
            else:
                print(f"ok   {case['name']}: dense positions 1..{len(got)}")

    for case in fixture.get("cacheInvalidation", {}).get("cases", []):
        i = case["input"]
        build = lambda c=case: build_cache_invalidation_report(  # noqa: E731
            c["input"]["namespace"], c["input"]["scopeKey"], c["input"]["removedKeys"], c["input"]["invalidatedAt"])
        if "expectError" in case:
            report(case["name"], _check(case, build), (False, case["expectError"]))
        else:
            got = build()
            total += 1
            if got != case["expected"]:
                failures += 1
                print(f"FAIL {case['name']}: report mismatch")
            else:
                print(f"ok   {case['name']}: receipt counts only ({got['removedKeys']} keys)")

    for case in fixture.get("repositoryIntake", {}).get("cases", []):
        report(case["name"], _check(case, lambda c=case: validate_repository_intake(c["request"])),
               (case["expect"]["ok"], case["expect"].get("code")))

    print(f"\n{total - failures}/{total} action/queue/cache/intake cases passed")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("proposal", nargs="?", help="JSON file with one AssistantActionProposal")
    parser.add_argument("--approval", help="JSON file with {\"approved\": bool, \"confirmedGates\": [...]}")
    parser.add_argument("--fixture", nargs="?", const=str(DEFAULT_FIXTURE), default=None,
                        help="verify the action fixture (default: bundled fixtures/action_plans.fixture.json)")
    args = parser.parse_args()

    if args.fixture is not None:
        return run_fixture(Path(args.fixture))
    if not args.proposal:
        parser.error("provide a proposal JSON file or --fixture")

    proposal = json.loads(Path(args.proposal).read_text(encoding="utf-8"))
    approval = json.loads(Path(args.approval).read_text(encoding="utf-8")) if args.approval else None
    try:
        validate_action(proposal, approval)
    except ContractError as exc:
        print(json.dumps({"ok": False, "code": exc.code, "message": str(exc)}, indent=2))
        return 1
    print(json.dumps({"ok": True, "action": proposal["action"], "id": proposal["id"]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
