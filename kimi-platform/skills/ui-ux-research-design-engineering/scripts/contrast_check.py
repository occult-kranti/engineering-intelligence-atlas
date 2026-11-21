#!/usr/bin/env python3
"""WCAG 2.x contrast ratio checker (deterministic, stdlib only).

Computes the WCAG 2.x relative-luminance contrast ratio exactly as defined in
WCAG 2.2 (https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio) and reports
pass/fail against the normative thresholds:

  SC 1.4.3  Contrast (Minimum)   AA: 4.5:1 normal text, 3:1 large text
  SC 1.4.6  Contrast (Enhanced) AAA: 7:1 normal text, 4.5:1 large text
  SC 1.4.11 Non-text Contrast    AA: 3:1 UI components & graphical objects

Large text = >=18pt (24px) regular or >=14pt (18.66px) bold (WCAG definition).

This script intentionally does NOT implement APCA: APCA is an exploratory
candidate model removed from the WCAG 3.0 draft (2023-07) and is not normative
anywhere. Never use APCA values to pass colors that fail the ratios above.

A passing ratio here is necessary but never sufficient for conformance:
automated checks cover only the mechanical subset of accessibility barriers.

Usage:
  contrast_check.py "#1a73e8" "#ffffff"
  contrast_check.py "#767676" "#ffffff" --large-text
  contrast_check.py --pairs pairs.json          # batch mode, exit 1 on failure
  contrast_check.py "#abc" "#fff" --json        # machine-readable single result

Batch file format (pairs.json):
  [{"name": "body text", "foreground": "#333333", "background": "#ffffff",
    "large_text": false, "level": "AA"}, ...]
  "level" is "AA" (default) or "AAA"; large_text defaults to false.
  Items with "kind": "non-text" are checked against SC 1.4.11 (3:1).

Exit codes: 0 = all checks pass, 1 = at least one failure, 2 = usage error.
"""

import argparse
import json
import re
import sys

AA_NORMAL = 4.5       # SC 1.4.3
AA_LARGE = 3.0        # SC 1.4.3 (large text)
AAA_NORMAL = 7.0      # SC 1.4.6
AAA_LARGE = 4.5       # SC 1.4.6 (large text)
NON_TEXT = 3.0        # SC 1.4.11

_HEX_RE = re.compile(r"^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")


def parse_color(value, background_rgb=None):
    """Parse #rgb / #rrggbb / #rrggbbaa to (r, g, b) floats in 0..1.

    An 8-digit color carries alpha and is composited over background_rgb
    (or opaque white if no background is available).
    """
    m = _HEX_RE.match(value.strip())
    if not m:
        raise ValueError(f"not a 3/6/8-digit hex color: {value!r}")
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    if len(h) == 8:
        a = int(h[6:8], 16) / 255.0
        base = background_rgb if background_rgb is not None else (1.0, 1.0, 1.0)
        r, g, b = (a * c + (1 - a) * bc for c, bc in zip((r, g, b), base))
    return (r, g, b)


def _linearize(channel):
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb):
    """WCAG 2.x relative luminance of an sRGB color."""
    r, g, b = (_linearize(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(rgb1, rgb2):
    """WCAG 2.x contrast ratio, 1.0..21.0."""
    l1, l2 = relative_luminance(rgb1), relative_luminance(rgb2)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def threshold(level="AA", large_text=False, kind="text"):
    if kind == "non-text":
        return NON_TEXT, "SC 1.4.11 Non-text Contrast (AA)"
    if level.upper() == "AAA":
        return (AAA_LARGE if large_text else AAA_NORMAL), \
            "SC 1.4.6 Contrast (Enhanced) AAA" + (" large text" if large_text else "")
    return (AA_LARGE if large_text else AA_NORMAL), \
        "SC 1.4.3 Contrast (Minimum) AA" + (" large text" if large_text else "")


def check_pair(foreground, background, level="AA", large_text=False, kind="text"):
    bg = parse_color(background)
    fg = parse_color(foreground, background_rgb=bg)
    ratio = contrast_ratio(fg, bg)
    req, criterion = threshold(level, large_text, kind)
    return {
        "foreground": foreground,
        "background": background,
        "ratio": round(ratio, 2),
        "required": req,
        "criterion": criterion,
        "pass": ratio >= req,
    }


def main(argv=None):
    p = argparse.ArgumentParser(
        description="WCAG 2.x contrast ratio check (no APCA; see module docstring).")
    p.add_argument("foreground", nargs="?", help="text/element color, e.g. #1a73e8")
    p.add_argument("background", nargs="?", help="background color, e.g. #ffffff")
    p.add_argument("--large-text", action="store_true",
                   help=">=18pt regular or >=14pt bold")
    p.add_argument("--level", choices=["AA", "AAA"], default="AA")
    p.add_argument("--non-text", action="store_true",
                   help="UI component / graphical object (SC 1.4.11, 3:1)")
    p.add_argument("--pairs", metavar="FILE",
                   help="JSON batch file (see module docstring)")
    p.add_argument("--json", action="store_true", help="machine-readable output")
    args = p.parse_args(argv)

    if args.pairs:
        with open(args.pairs, encoding="utf-8") as f:
            items = json.load(f)
        if not isinstance(items, list):
            print("error: pairs file must contain a JSON list", file=sys.stderr)
            return 2
        results, failures = [], 0
        for i, item in enumerate(items):
            try:
                res = check_pair(
                    item["foreground"], item["background"],
                    level=item.get("level", "AA"),
                    large_text=item.get("large_text", False),
                    kind=item.get("kind", "text"))
            except (KeyError, ValueError) as e:
                print(f"error: pair #{i}: {e}", file=sys.stderr)
                return 2
            res["name"] = item.get("name", f"pair #{i}")
            results.append(res)
            failures += 0 if res["pass"] else 1
        if args.json:
            print(json.dumps({"results": results, "failures": failures}, indent=2))
        else:
            for r in results:
                mark = "PASS" if r["pass"] else "FAIL"
                print(f"[{mark}] {r['name']}: {r['foreground']} on {r['background']} "
                      f"= {r['ratio']}:1 (needs {r['required']}:1, {r['criterion']})")
            print(f"{len(results) - failures}/{len(results)} pairs pass.")
        return 1 if failures else 0

    if not args.foreground or not args.background:
        p.error("provide FOREGROUND and BACKGROUND, or --pairs FILE")
    try:
        res = check_pair(args.foreground, args.background, args.level,
                         args.large_text, "non-text" if args.non_text else "text")
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        mark = "PASS" if res["pass"] else "FAIL"
        print(f"contrast ratio: {res['ratio']}:1")
        print(f"{mark}: {res['criterion']} requires {res['required']}:1")
    return 0 if res["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
