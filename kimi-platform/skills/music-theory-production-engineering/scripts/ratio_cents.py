#!/usr/bin/env python3
"""ratio_cents.py — deterministic ratio <-> cents conversion (stdlib only).

Formula: cents = 1200 * log2(f2 / f1).

Known vectors (theory_foundations.md §2; lab M1 requires 0.1-cent agreement
with a computed reference table; this self-test asserts 0.001 cent):

    octave            2:1            1200.000 cents
    just fifth        3:2             701.955 cents
    just major third  5:4             386.314 cents
    syntonic comma   81:80             21.506 cents
    Pythagorean comma 531441:524288    23.460 cents
    12-TET semitone  2**(1/12)        100.000 cents

Usage:
    python3 ratio_cents.py 3 2          # cents for the ratio 3:2
    python3 ratio_cents.py --tet12      # 12-TET semitone deviation table
    python3 ratio_cents.py --self-test  # verify known vectors; exit 1 on failure
"""
import math
import sys

TOLERANCE_CENTS = 0.001

# (name, numerator, denominator, expected_cents)
KNOWN_VECTORS = [
    ("octave", 2, 1, 1200.000),
    ("just fifth", 3, 2, 701.955),
    ("just fourth", 4, 3, 498.045),
    ("just major third", 5, 4, 386.314),
    ("just minor third", 6, 5, 315.641),
    ("syntonic comma", 81, 80, 21.506),
    ("Pythagorean comma", 531441, 524288, 23.460),
    ("12-TET semitone", None, None, 100.000),
]


def ratio_to_cents(numerator, denominator):
    """Cents for the frequency ratio numerator/denominator."""
    if numerator <= 0 or denominator <= 0:
        raise ValueError("ratio terms must be positive")
    return 1200.0 * math.log2(numerator / denominator)


def cents_to_ratio(cents):
    """Frequency ratio for an interval in cents."""
    return 2.0 ** (cents / 1200.0)


def tet12_semitone_cents():
    return ratio_to_cents(2.0 ** (1.0 / 12.0), 1.0)


def tet12_deviation_table():
    """Cents of just intervals vs. the nearest 12-TET step (reference: any root)."""
    rows = []
    just = [(1, 1), (16, 15), (9, 8), (6, 5), (5, 4), (4, 3),
            (45, 32), (3, 2), (8, 5), (5, 3), (9, 5), (15, 8), (2, 1)]
    for i, (n, d) in enumerate(just):
        c = ratio_to_cents(n, d)
        rows.append((f"{n}:{d}", i, c, c - 100.0 * i))
    return rows


def self_test():
    failures = []
    for name, n, d, expected in KNOWN_VECTORS:
        got = tet12_semitone_cents() if n is None else ratio_to_cents(n, d)
        # expected values are stated to 0.001 in the source; compare rounded
        if abs(got - expected) > TOLERANCE_CENTS + 0.0005:
            failures.append(f"{name}: got {got:.3f}, expected {expected:.3f}")
        else:
            print(f"ok   {name}: {got:.3f} cents (expected {expected:.3f})")
    # round-trip property: cents -> ratio -> cents
    for cents in (0.0, 100.0, 701.955, 1200.0):
        rt = ratio_to_cents(cents_to_ratio(cents), 1.0)
        if abs(rt - cents) > 1e-9:
            failures.append(f"round-trip failed at {cents} cents (got {rt})")
    if failures:
        print("SELF-TEST FAILED:")
        for f in failures:
            print("  " + f)
        return 1
    print(f"self-test passed ({len(KNOWN_VECTORS)} known vectors + round-trip)")
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    if "--tet12" in argv:
        print("just ratio | 12-TET step | just cents | deviation (cents)")
        for label, step, c, dev in tet12_deviation_table():
            print(f"{label:>10} | {step:>11} | {c:>10.3f} | {dev:+.3f}")
        return 0
    args = [a for a in argv if not a.startswith("-")]
    if len(args) != 2:
        print(__doc__)
        return 2
    n, d = int(args[0]), int(args[1])
    print(f"{n}:{d} = {ratio_to_cents(n, d):.3f} cents")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
