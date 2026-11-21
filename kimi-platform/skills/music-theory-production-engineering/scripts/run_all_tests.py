#!/usr/bin/env python3
"""run_all_tests.py — the skill's acceptance suite (stdlib only, offline).

Runs, in order:
  1. generate_fixtures.py --verify   deterministic fixture regeneration
  2. validate_fixtures.py            MusicXML/MIDI/WAV/provenance parsing
  3. ratio_cents.py --self-test      ratio/cents known vectors
  4. wav_metrics.py --self-test      analytic RMS/peak/DC checks
  5. validate_casebook.py            casebook JSON<->md, links, no absolute paths

Exit 0 only if every step passes. Honest scope: this suite does NOT perform
W3C MusicXML XSD validation, BS.1770 LUFS, true-peak, listening tests, or any
network verification — see references/modern_labs.md for those lab tests.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

STEPS = [
    ("fixture determinism", ["generate_fixtures.py", "--verify"]),
    ("fixture parsing/validation", ["validate_fixtures.py"]),
    ("ratio/cents known vectors", ["ratio_cents.py", "--self-test"]),
    ("WAV RMS/peak/DC metrics", ["wav_metrics.py", "--self-test"]),
    ("casebook/link validation", ["validate_casebook.py"]),
]


def main():
    failed = []
    for label, cmd in STEPS:
        print(f"\n=== {label}: python3 {' '.join(cmd)} ===")
        rc = subprocess.call([sys.executable, os.path.join(HERE, cmd[0])] + cmd[1:])
        if rc != 0:
            failed.append(label)
    print("\n" + "=" * 60)
    if failed:
        print(f"ACCEPTANCE SUITE FAILED: {', '.join(failed)}")
        return 1
    print(f"ACCEPTANCE SUITE PASSED ({len(STEPS)}/{len(STEPS)} steps)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
