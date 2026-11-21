#!/usr/bin/env python3
"""Target-size checker against the named authorities (deterministic, stdlib only).

Checks interactive-target rectangles against ONE named authority at a time —
never average them (WCAG 2.5.8 is a legal floor, not an ergonomic target):

  wcag-2.5.8   WCAG 2.2 SC 2.5.8 Target Size (Minimum), AA: 24x24 CSS px,
               with the geometric part of the Spacing exception implemented:
               an undersized target still passes if a 24 CSS px diameter
               circle centred on its bounding box does not intersect any
               other target's bounding box or any other undersized target's
               circle (Understanding WCAG 2.2, "Target Size (Minimum)").
  wcag-2.5.5   WCAG 2.2 SC 2.5.5 Target Size (Enhanced), AAA: 44x44 CSS px.
  apple-hig    Apple HIG: 44x44 pt default minimum hit area.
  android      Material / Android: 48x48 dp recommended touch target.

Honestly NOT implemented (geometry cannot decide them; report manually):
the remaining 2.5.8 exceptions (Equivalent control, Inline, User-agent,
Essential), and the fact that hit area != visible size (padding via
pseudo-elements is a CSS/DOM fact this script cannot see). Treat input
rectangles as the effective clickable area.

Input: JSON file
  {"authority": "wcag-2.5.8",
   "targets": [{"id": "save", "x": 0, "y": 0, "width": 20, "height": 20}, ...]}
  x/y are the top-left corner in the authority's unit (CSS px / pt / dp).

Usage:
  target_size_check.py targets.json [--authority wcag-2.5.8] [--json]

Exit codes: 0 = all targets pass, 1 = at least one failure, 2 = usage error.
"""

import argparse
import json
import math
import sys

AUTHORITIES = {
    "wcag-2.5.8": {"size": 24, "unit": "CSS px", "level": "AA",
                   "spacing_exception": True,
                   "cite": "WCAG 2.2 SC 2.5.8 Target Size (Minimum)"},
    "wcag-2.5.5": {"size": 44, "unit": "CSS px", "level": "AAA",
                   "spacing_exception": False,
                   "cite": "WCAG 2.2 SC 2.5.5 Target Size (Enhanced)"},
    "apple-hig": {"size": 44, "unit": "pt", "level": "platform guideline",
                  "spacing_exception": False,
                  "cite": "Apple Human Interface Guidelines (44x44 pt)"},
    "android": {"size": 48, "unit": "dp", "level": "platform guideline",
                "spacing_exception": False,
                "cite": "Material Design / Android accessibility (48x48 dp)"},
}

EPS = 1e-9


def _center(t):
    return (t["x"] + t["width"] / 2.0, t["y"] + t["height"] / 2.0)


def _circle_hits_rect(center, radius, t):
    """True if the circle intersects rect t (including containment)."""
    cx = min(max(center[0], t["x"]), t["x"] + t["width"])
    cy = min(max(center[1], t["y"]), t["y"] + t["height"])
    return math.hypot(center[0] - cx, center[1] - cy) <= radius + EPS


def check(targets, authority_key):
    auth = AUTHORITIES[authority_key]
    required = auth["size"]
    undersized = [t for t in targets
                  if t["width"] < required - EPS or t["height"] < required - EPS]
    circles = {t["id"]: (_center(t), required / 2.0) for t in undersized}

    results = []
    for t in targets:
        base = {"id": t["id"], "width": t["width"], "height": t["height"],
                "required": required, "authority": auth["cite"]}
        if t not in undersized:
            results.append({**base, "pass": True, "reason": "meets minimum size"})
            continue
        if not auth["spacing_exception"]:
            results.append({**base, "pass": False,
                            "reason": f"below {required}x{required} {auth['unit']}; "
                                      "this authority has no spacing exception"})
            continue
        # WCAG 2.5.8 Spacing exception, geometric part.
        center, radius = circles[t["id"]]
        blocker = None
        for other in targets:
            if other["id"] == t["id"]:
                continue
            if other["id"] in circles:
                oc, orad = circles[other["id"]]
                if math.hypot(center[0] - oc[0], center[1] - oc[1]) <= radius + orad + EPS:
                    blocker = f"24px spacing circle intersects circle of '{other['id']}'"
                    break
            elif _circle_hits_rect(center, radius, other):
                blocker = f"24px spacing circle intersects target '{other['id']}'"
                break
        if blocker:
            results.append({**base, "pass": False, "reason": blocker})
        else:
            results.append({**base, "pass": True,
                            "reason": "passes via the 2.5.8 Spacing exception "
                                      "(geometric part only)"})
    return results


def main(argv=None):
    p = argparse.ArgumentParser(
        description="Target-size check against one named authority "
                    "(WCAG 2.5.8/2.5.5, Apple HIG, Android). Never average them.")
    p.add_argument("file", help="JSON file with targets (see module docstring)")
    p.add_argument("--authority", choices=sorted(AUTHORITIES),
                   help="override the file's authority field")
    p.add_argument("--json", action="store_true", help="machine-readable output")
    args = p.parse_args(argv)

    try:
        with open(args.file, encoding="utf-8") as f:
            data = json.load(f)
        targets = data["targets"]
        authority_key = args.authority or data.get("authority", "wcag-2.5.8")
        if authority_key not in AUTHORITIES:
            raise ValueError(f"unknown authority {authority_key!r}; "
                             f"choose one of {sorted(AUTHORITIES)}")
        for t in targets:
            for k in ("id", "x", "y", "width", "height"):
                if k not in t:
                    raise ValueError(f"target missing {k!r}: {t!r}")
            if t["width"] <= 0 or t["height"] <= 0:
                raise ValueError(f"non-positive size in target {t['id']!r}")
    except (OSError, json.JSONDecodeError, KeyError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    results = check(targets, authority_key)
    failures = sum(0 if r["pass"] else 1 for r in results)
    if args.json:
        print(json.dumps({"authority": authority_key, "results": results,
                          "failures": failures}, indent=2))
    else:
        auth = AUTHORITIES[authority_key]
        print(f"authority: {auth['cite']} ({auth['size']}x{auth['size']} "
              f"{auth['unit']}, {auth['level']})")
        for r in results:
            mark = "PASS" if r["pass"] else "FAIL"
            print(f"[{mark}] {r['id']}: {r['width']}x{r['height']} - {r['reason']}")
        print(f"{len(results) - failures}/{len(results)} targets pass.")
        if authority_key == "wcag-2.5.8":
            print("note: Equivalent/Inline/User-agent/Essential exceptions and "
                  "hit-area-vs-visible-size are NOT checkable geometrically; "
                  "record them manually.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
