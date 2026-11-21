#!/usr/bin/env python3
"""Check deterministic assistant job schedules.

Deterministic, offline, stdlib-only mirror of scheduleNextRun and the
assistant job policies in the shared assistant contract
(app/contracts/assistant.ts). Guarantees under check:

  - Assistant jobs never make provider calls, never make paid calls, and
    never execute proposals (all five kinds, always).
  - Intervals are clamped to [60_000 ms, 30 days].
  - At most one run is ever due: missed intervals skip forward in one
    deterministic step (no missed-run storms).
  - maxRuns is a hard terminator; disabled jobs never run; one-time jobs
    fire at most once (a pending one-time job still fires when late).

Usage:
  python3 schedule_check.py JOB.json --now EPOCH_MS
  python3 schedule_check.py --fixture [PATH]

Exit code: 0 on success / all cases pass, 1 otherwise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from assistant_contract import JOB_POLICIES, SCHEDULE_BOUNDS, schedule_next_run  # noqa: E402

DEFAULT_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "schedules.fixture.json"


def audit_job_policies(fixture: dict) -> list:
    """Every job kind must be deterministic and free (no paid/auto calls)."""
    problems = []
    declared = fixture.get("jobPolicies", {})
    for kind, (effect, provider, paid, executes) in JOB_POLICIES.items():
        row = declared.get(kind)
        if row is None:
            problems.append(f"jobPolicies missing kind {kind!r}")
            continue
        if row.get("providerCalls") is not False or row.get("paidCalls") is not False or row.get("executesProposals") is not False:
            problems.append(f"job kind {kind!r} allows provider/paid/execution effects")
        if provider or paid or executes:
            problems.append(f"contract mirror for {kind!r} is not provider-free/paid-free/non-executing")
    return problems


def run_fixture(path: Path) -> int:
    fixture = json.loads(path.read_text(encoding="utf-8"))
    failures = 0

    problems = audit_job_policies(fixture)
    if problems:
        failures += len(problems)
        for problem in problems:
            print(f"FAIL policy: {problem}")
    else:
        print(f"ok   job policies: {len(JOB_POLICIES)} kinds are provider-free, paid-free, non-executing")

    for case in fixture["cases"]:
        got = schedule_next_run(case["job"], case["now"])
        expected = case["expectedNextRun"]
        if got != expected:
            failures += 1
            print(f"FAIL {case['name']}: got {got}, expected {expected}")
        else:
            print(f"ok   {case['name']}: nextRunAt={got}")
    total = len(fixture["cases"]) + 1
    passed = total - failures
    print(f"\n{passed}/{total} schedule checks passed "
          f"(bounds: interval clamped to [{SCHEDULE_BOUNDS['minIntervalMs']}, {SCHEDULE_BOUNDS['maxIntervalMs']}] ms, "
          f"max {SCHEDULE_BOUNDS['maxCatchUpRuns']} catch-up run)")
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("job", nargs="?", help="JSON file with one AssistantJob")
    parser.add_argument("--now", type=int, help="current time as epoch milliseconds (caller-supplied; never read from a clock)")
    parser.add_argument("--fixture", nargs="?", const=str(DEFAULT_FIXTURE), default=None,
                        help="verify the schedule fixture (default: bundled fixtures/schedules.fixture.json)")
    args = parser.parse_args()

    if args.fixture is not None:
        return run_fixture(Path(args.fixture))
    if not args.job or args.now is None:
        parser.error("provide a job JSON file and --now, or --fixture")

    job = json.loads(Path(args.job).read_text(encoding="utf-8"))
    kind = job.get("kind")
    policy = JOB_POLICIES.get(kind)
    if policy is None:
        print(json.dumps({"ok": False, "code": "unknown-job-kind", "kind": kind}, indent=2))
        return 1
    next_run = schedule_next_run(job, args.now)
    print(json.dumps({
        "ok": True,
        "jobId": job.get("id"),
        "kind": kind,
        "effect": policy[0],
        "providerCalls": False,
        "paidCalls": False,
        "executesProposals": False,
        "nextRunAt": next_run,
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
