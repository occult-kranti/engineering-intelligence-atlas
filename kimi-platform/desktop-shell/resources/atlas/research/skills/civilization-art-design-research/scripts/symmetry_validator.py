#!/usr/bin/env python3
"""Transformation/symmetry validator (Python 3 stdlib only).

Honest scope: this script verifies ONLY whether a finite set of 2D point
primitives in a JSON fixture is invariant - within a declared numeric
tolerance - under a STATED transformation (translation, rotation, reflection,
glide reflection), or whether one declared cell maps onto another under a
stated transformation. It does NOT classify frieze or wallpaper groups from
arbitrary images or patterns; group classification remains a criteria-declared
protocol task (Schattschneider 1978 flowchart; Washburn & Crowe 1988) - see
references/symmetry_and_proportion.md. A PASS here means "the declared
transformation is a symmetry of this finite fixture within tolerance", nothing
more.

Fixture format (a JSON list of vectors, or an object with a "vectors" list):
[
  {
    "name": "square under quarter-turn",
    "kind": "invariance",              # or "cell_consistency"
    "points": [[x, y], ...],           # the finite set
    "transformation": {
      "type": "rotation",              # translation|rotation|reflection|glide
      "center": [0, 0],                # rotation
      "angle_deg": 90,                 # rotation
      "vector": [1, 0],                # translation
      "axis_point": [0, 0],            # reflection / glide
      "axis_dir": [1, 0],              # reflection / glide (unit or not)
      "glide_vector": [0.5, 0]         # glide (must be parallel to axis)
    },
    "target_points": [[x, y], ...],    # cell_consistency only
    "tolerance": 1e-6,
    "expected": true                   # the known-vector verdict
  }
]

Usage:
  symmetry_validator.py FIXTURE.json          # evaluate vectors vs expected
  symmetry_validator.py --self-test           # bundled known vectors
"""

import argparse
import json
import math
import os
import sys

EPS = 1e-12


def _translate(p, v):
    return (p[0] + v[0], p[1] + v[1])


def _rotate(p, c, deg):
    a = math.radians(deg)
    dx, dy = p[0] - c[0], p[1] - c[1]
    co, si = math.cos(a), math.sin(a)
    return (c[0] + dx * co - dy * si, c[1] + dx * si + dy * co)


def _unit(v):
    n = math.hypot(v[0], v[1])
    if n < EPS:
        raise ValueError("zero-length axis/vector")
    return (v[0] / n, v[1] / n)


def _reflect(p, axis_point, axis_dir):
    u = _unit(axis_dir)
    d = (p[0] - axis_point[0], p[1] - axis_point[1])
    proj = d[0] * u[0] + d[1] * u[1]
    foot = (axis_point[0] + proj * u[0], axis_point[1] + proj * u[1])
    return (2 * foot[0] - p[0], 2 * foot[1] - p[1])


def _glide(p, axis_point, axis_dir, glide_vector):
    u = _unit(axis_dir)
    g = glide_vector
    # glide vector must be parallel to the axis, otherwise the "glide
    # reflection" is malformed - refuse rather than guess
    cross = abs(g[0] * u[1] - g[1] * u[0])
    if cross > 1e-9 * max(1.0, math.hypot(*g)):
        raise ValueError("glide_vector is not parallel to the reflection axis")
    r = _reflect(p, axis_point, axis_dir)
    return (r[0] + g[0], r[1] + g[1])


def apply_transformation(t, p):
    kind = t["type"]
    if kind == "translation":
        return _translate(p, t["vector"])
    if kind == "rotation":
        return _rotate(p, t["center"], t["angle_deg"])
    if kind == "reflection":
        return _reflect(p, t["axis_point"], t["axis_dir"])
    if kind == "glide":
        return _glide(p, t["axis_point"], t["axis_dir"], t["glide_vector"])
    raise ValueError(f"unknown transformation type: {kind!r}")


def _covered(source_points, target_points, tol):
    """True iff every source point has a target point within tol and the sets
    have equal cardinality (so the map is a bijection of the finite set)."""
    if len(source_points) != len(target_points):
        return False
    used = [False] * len(target_points)
    for p in source_points:
        hit = -1
        for j, q in enumerate(target_points):
            if not used[j] and math.hypot(p[0] - q[0], p[1] - q[1]) <= tol:
                hit = j
                break
        if hit < 0:
            return False
        used[hit] = True
    return True


def evaluate(vector):
    tol = float(vector.get("tolerance", 1e-6))
    pts = [tuple(p) for p in vector["points"]]
    t = vector["transformation"]
    mapped = [apply_transformation(t, p) for p in pts]
    kind = vector.get("kind", "invariance")
    if kind == "invariance":
        result = _covered(mapped, pts, tol)
    elif kind == "cell_consistency":
        target = [tuple(p) for p in vector["target_points"]]
        result = _covered(mapped, target, tol)
    else:
        raise ValueError(f"unknown vector kind: {kind!r}")
    return result


def run_fixture(path, verbose=True):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    vectors = data["vectors"] if isinstance(data, dict) else data
    failures = 0
    for v in vectors:
        name = v.get("name", "<unnamed>")
        try:
            result = evaluate(v)
        except (KeyError, ValueError) as exc:
            print(f"ERROR {name}: malformed vector: {exc}")
            failures += 1
            continue
        expected = bool(v.get("expected", True))
        ok = result == expected
        if not ok:
            failures += 1
        if verbose or not ok:
            verdict = "symmetric" if result else "not symmetric"
            match = "OK" if ok else f"MISMATCH (expected {expected})"
            print(f"{'PASS' if ok else 'FAIL'} {name}: {verdict} [{match}]")
    return failures


def self_test():
    fixture = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        os.pardir, "assets", "fixtures", "symmetry_known_vectors.json",
    )
    if not os.path.exists(fixture):
        print(f"FAIL: known-vector fixture not found at {fixture}")
        return 1
    failures = run_fixture(fixture)
    if failures:
        print(f"self-test FAILED: {failures} vector(s)")
        return 1
    print("self-test OK: all known vectors match expected verdicts")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fixture", nargs="?", help="path to a JSON vector fixture")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="print only failures")
    args = ap.parse_args(argv)
    if args.self_test:
        return self_test()
    if not args.fixture:
        ap.error("fixture path required unless --self-test")
    failures = run_fixture(args.fixture, verbose=not args.quiet)
    print(f"{failures} mismatch(es)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
