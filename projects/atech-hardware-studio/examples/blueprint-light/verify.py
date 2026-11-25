#!/usr/bin/env python3
"""Verify this catalog-grounded example without compiling or accessing hardware."""
import argparse
from contextlib import ExitStack, redirect_stderr, redirect_stdout
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch

EXAMPLE = Path(__file__).resolve().parent
STUDIO = EXAMPLE.parents[1]
SDK = STUDIO / "sdk"
sys.path.insert(0, str(SDK / "src"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(directory):
    return {
        p.relative_to(directory).as_posix(): sha(p)
        for p in sorted(directory.rglob("*")) if p.is_file()
    }


def verify():
    # These guards turn accidental compiler, serial or download calls into a
    # failed verification instead of an unintended action.
    with ExitStack() as stack:
        for target in ("subprocess.Popen", "urllib.request.urlopen", "serial.Serial",
                       "socket.create_connection"):
            stack.enter_context(patch(target, side_effect=AssertionError(
                "This example check permits local validation and generation only")))
        from atech.cli import main
        from atech.project import Project

        before = sha(EXAMPLE / "project.yaml")
        stdout, stderr = io.StringIO(), io.StringIO()
        with redirect_stdout(stdout), redirect_stderr(stderr):
            status = main(["validate", str(EXAMPLE), "--json"])
        validation = json.loads(stdout.getvalue())
        if status != 0 or stderr.getvalue() or validation.get("valid") is not True:
            raise ValueError("Example validation did not return one successful JSON response")
        project = Project.load(EXAMPLE)
        if project.host_actions is not False or project.feedback is not False:
            raise ValueError("Example must keep its explicit local button behavior")
        with tempfile.TemporaryDirectory(prefix="atech-blueprint-example-") as temporary:
            first = project.generate(Path(temporary) / "first")
            second = Project.load(EXAMPLE).generate(Path(temporary) / "second")
            generated = inventory(first)
            if generated != inventory(second):
                raise ValueError("Repeated generation changed the source tree")
        if sha(EXAMPLE / "project.yaml") != before:
            raise ValueError("Validation or generation modified the input recipe")
        source_paths = [
            "src/atech/cli.py", "src/atech/project.py", "src/atech/placement.py",
            "src/atech/codegen.py", "src/atech/catalog/loader.py",
            "src/atech/catalog/data/boards/14port.yaml",
            "src/atech/catalog/data/modules/button/module.yaml",
            "src/atech/catalog/data/modules/neopixel/module.yaml",
        ]
        return {
            "schema_version": 1,
            "example": "blueprint-light",
            "source_package": "atech 1.0.0a12 with the recorded Daftar patch",
            "project_sha256": before,
            "validation": validation,
            "validation_exit_code": status,
            "input_unchanged": True,
            "two_generated_trees_identical": True,
            "generated_file_count": len(generated),
            "generated_source_sha256": generated,
            "reviewed_source_sha256": {path: sha(SDK / path) for path in source_paths},
            "firmware_compiled": False,
            "hardware_tested": False,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true",
                        help="Replace the checked-in receipt after reviewing source changes")
    args = parser.parse_args()
    result = verify()
    receipt = EXAMPLE / "verification.json"
    if args.record:
        receipt.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    elif not receipt.is_file() or json.loads(receipt.read_text(encoding="utf-8")) != result:
        parser.exit(1, "The example differs from its recorded receipt; review the source change before --record.\n")
    print(json.dumps({
        "example": result["example"], "validation": "passed",
        "generated_file_count": result["generated_file_count"],
        "deterministic_generation": "passed", "input_unchanged": True,
        "receipt": "recorded" if args.record else "matched",
        "firmware_compiled": False, "hardware_tested": False,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
