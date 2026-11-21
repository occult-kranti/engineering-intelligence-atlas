#!/usr/bin/env python3
"""Route confirmed public repository metadata into the existing enterprise.

Deterministic, offline, stdlib-only mirror of routeRepository in the shared
assistant contract (app/contracts/assistant.ts). It reads metadata JSON and
prints a RepoAssignmentPlan-shaped PROPOSAL. It never clones, fetches,
imports, executes, or writes anything external, and it never creates
companies, departments, roles, or skills automatically.

Usage:
  python3 route_repositories.py METADATA.json      # one object or a list
  python3 route_repositories.py --fixture [PATH]   # verify fixture vectors

Exit code: 0 when routing/verification succeeds, 1 on mismatch or invalid
input. Applying any printed plan still requires the repository.assign or
repository.propose_structure human approval gate in the runtime.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assistant_contract import ContractError, route_repository  # noqa: E402

DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "repositories.fixture.json"

EXPECTED_KEYS = ("status", "companyKey", "departmentKey", "discipline", "skillId", "confidence", "readOnly", "redistributionAllowed")


def run_fixture(path: Path) -> int:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    failures = 0
    for vector in fixture["vectors"]:
        try:
            plan = route_repository(vector["metadata"])
        except ContractError as exc:
            print(f"FAIL {vector['id']}: routing raised {exc}")
            failures += 1
            continue
        expected = vector["expected"]
        mismatches = [k for k in EXPECTED_KEYS if plan[k] != expected[k]]
        if mismatches:
            failures += 1
            print(f"FAIL {vector['id']}: {mismatches}")
            for k in mismatches:
                print(f"  {k}: got {plan[k]!r}, expected {expected[k]!r}")
        else:
            print(f"ok   {vector['id']}: {plan['status']}"
                  + (f" -> {plan['companyKey']}/{plan['departmentKey']} ({plan['skillId']}, confidence {plan['confidence']})"
                     if plan["status"] == "assigned" else ""))
    total = len(fixture["vectors"])
    print(f"\n{total - failures}/{total} routing vectors passed")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("metadata", nargs="?", help="JSON file with one metadata object or a list of them")
    parser.add_argument("--fixture", nargs="?", const=str(DEFAULT_FIXTURE), default=None,
                        help="verify the routing fixture (default: bundled fixtures/repositories.fixture.json)")
    args = parser.parse_args()

    if args.fixture is not None:
        return run_fixture(Path(args.fixture))
    if not args.metadata:
        parser.error("provide a metadata JSON file or --fixture")

    data = json.loads(Path(args.metadata).read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else [data]
    plans = []
    for item in items:
        metadata = item.get("metadata", item)
        plans.append(route_repository(metadata))
    out = plans if isinstance(data, list) else plans[0]
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ContractError as exc:
        print(f"error: {exc}", file=sys.stderr)
        sys.exit(1)
