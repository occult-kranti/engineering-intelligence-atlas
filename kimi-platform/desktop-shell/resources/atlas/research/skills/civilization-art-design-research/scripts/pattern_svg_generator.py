#!/usr/bin/env python3
"""Deterministic SVG pattern generator for the civilization-art-design-research skill.

Generates ORIGINAL modern teaching artifacts (Python 3 stdlib only). Every SVG is
labeled "modern exercise" with its modern method credited separately from any
documented historical procedure. No output is a historical reconstruction; the
quadrature and robins-grid modes implement documented procedures (Roriczer 1486;
Robins 1994 canon grids) and say so in the file.

Modes:
  frieze      one SVG per frieze group (p111 p1m1 pm11 pmm2 p112 p1g1 pma2), built
              as transformation recipes over a declared motif (modern exercise,
              recognition protocol per Schattschneider 1978 / Washburn-Crowe 1988)
  quadrature  Roriczer-style documented ad quadratum exercise (lab L4)
  robins-grid 18-square and Amarna canon-grid exercises per Robins 1994 (lab L3)
  girih       modern polygons-in-contact decagonal exercise per Kaplan & Salesin
              2004 (lab L2), with disputed-quasiperiodicity note
  all         regenerate every bundled sample asset

Usage:
  pattern_svg_generator.py --mode frieze --group p1m1 --out out.svg
  pattern_svg_generator.py --mode quadrature --out roriczer_quadrature.svg
  pattern_svg_generator.py --mode robins-grid --variant amarna --out amarna.svg
  pattern_svg_generator.py --mode girih --contact-angle 72 --out girih.svg
  pattern_svg_generator.py --mode all --outdir assets/exercises
  pattern_svg_generator.py --self-test
"""

import argparse
import math
import os
import sys
import tempfile
import xml.etree.ElementTree as ET

INK = "#222222"
ACCENT = "#8a2be2"
GRID = "#b0b0b0"
LIGHT = "#dddddd"

LABEL_MODERN = (
    "MODERN EXERCISE - generated teaching artifact; not a historical artifact "
    "and not a reconstruction claim."
)

FRIEZE_GROUPS = ["p111", "p1m1", "pm11", "pmm2", "p112", "p1g1", "pma2"]


# ---------------------------------------------------------------- primitives

def fmt(v):
    """Deterministic float formatting."""
    return f"{v:.3f}".rstrip("0").rstrip(".") if abs(v) < 1e12 else repr(v)


def reflect_x(p, axis):
    return (2.0 * axis - p[0], p[1])


def reflect_y(p, axis):
    return (p[0], 2.0 * axis - p[1])


def rotate(p, center, angle_rad):
    dx, dy = p[0] - center[0], p[1] - center[1]
    c, s = math.cos(angle_rad), math.sin(angle_rad)
    return (center[0] + dx * c - dy * s, center[1] + dx * s + dy * c)


def translate(p, vec):
    return (p[0] + vec[0], p[1] + vec[1])


def transform_poly(poly, fn):
    return [fn(p) for p in poly]


def svg_polygon(poly, fill="none", stroke=INK, width=1.5, opacity=None):
    pts = " ".join(f"{fmt(x)},{fmt(y)}" for x, y in poly)
    op = f' fill-opacity="{opacity}"' if opacity is not None else ""
    return (
        f'<polygon points="{pts}" fill="{fill}"{op} stroke="{stroke}" '
        f'stroke-width="{width}"/>'
    )


def svg_line(p1, p2, stroke=GRID, width=0.8, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<line x1="{fmt(p1[0])}" y1="{fmt(p1[1])}" x2="{fmt(p2[0])}" '
        f'y2="{fmt(p2[1])}" stroke="{stroke}" stroke-width="{width}"{d}/>'
    )


def svg_circle(c, r, fill="none", stroke=ACCENT, width=0.8, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (
        f'<circle cx="{fmt(c[0])}" cy="{fmt(c[1])}" r="{fmt(r)}" fill="{fill}" '
        f'stroke="{stroke}" stroke-width="{width}"{d}/>'
    )


def svg_text(p, text, size=11, fill=INK, anchor="start"):
    esc = (
        text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    )
    return (
        f'<text x="{fmt(p[0])}" y="{fmt(p[1])}" font-family="monospace" '
        f'font-size="{size}" fill="{fill}" text-anchor="{anchor}">{esc}</text>'
    )


def svg_doc(width, height, body, label_lines):
    """Wrap body elements in an SVG document with provenance comment + labels."""
    esc_label = label_lines.replace("--", "- -")
    comment = (
        f"<!--\n{esc_label}\nGenerator: scripts/pattern_svg_generator.py "
        "(civilization-art-design-research skill); deterministic, stdlib only.\n-->\n"
    )
    texts = []
    for i, line in enumerate(label_lines.splitlines()):
        texts.append(svg_text((8, height - 10 - (len(label_lines.splitlines()) - 1 - i) * 14), line, size=10, fill="#555555"))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{fmt(width)}" '
        f'height="{fmt(height)}" viewBox="0 0 {fmt(width)} {fmt(height)}">\n'
        f"{comment}"
        f'<rect x="0" y="0" width="{fmt(width)}" height="{fmt(height)}" '
        f'fill="white"/>\n' + "\n".join(body + texts) + "\n</svg>\n"
    )


# -------------------------------------------------------------------- frieze

# Asymmetric base motif inside a unit cell of width CELL, band height BAND.
CELL, BAND = 80.0, 60.0
BASE_MOTIF = [(8.0, 42.0), (30.0, 42.0), (12.0, 14.0)]  # scalene triangle

FRIEZE_LABEL = (
    "Frieze pattern {g}: modern exercise. Recognition protocol per "
    "Schattschneider (1978); field protocol per Washburn & Crowe (1988). "
    "Criteria: uncolored pattern; idealized infinite extension along the "
    "translation axis; group symbol is modern notation, never attributed to "
    "historical makers."
)


def frieze_operations(group, cell_index):
    """Return list of motif polygons for one unit cell of the given group.

    Each group is a declared transformation recipe over BASE_MOTIF. Translation
    by (CELL, 0) generates the strip; per-cell operations implement the group's
    additional isometries. Notation: IUC frieze symbols.
    """
    t = (cell_index * CELL, 0.0)
    base = transform_poly(BASE_MOTIF, lambda p: translate(p, t))
    polys = [base]
    if group == "p111":
        pass  # translations only
    elif group == "p1m1":
        # mirror lines perpendicular to the strip axis, at cell boundaries
        polys.append(transform_poly(base, lambda p: reflect_x(p, t[0] + CELL / 2)))
    elif group == "pm11":
        # mirror line along the strip axis (horizontal midline)
        polys.append(transform_poly(base, lambda p: reflect_y(p, BAND / 2)))
    elif group == "pmm2":
        polys.append(transform_poly(base, lambda p: reflect_x(p, t[0] + CELL / 2)))
        polys.append(transform_poly(base, lambda p: reflect_y(p, BAND / 2)))
        polys.append(
            transform_poly(base, lambda p: rotate(p, (t[0] + CELL / 2, BAND / 2), math.pi))
        )
    elif group == "p112":
        # half-turn centers at cell centers
        polys.append(
            transform_poly(base, lambda p: rotate(p, (t[0] + CELL / 2, BAND / 2), math.pi))
        )
    elif group == "p1g1":
        # glide reflection: half-cell translation + reflection across midline
        polys.append(
            transform_poly(base, lambda p: reflect_y(translate(p, (CELL / 2, 0.0)), BAND / 2))
        )
    elif group == "pma2":
        # vertical mirrors at cell quarter-lines + glide along the axis
        # (2-fold centers emerge at their intersections)
        mirrored = transform_poly(base, lambda p: reflect_x(p, t[0] + CELL / 4))
        polys.append(mirrored)
        glide = lambda p: reflect_y(translate(p, (CELL / 2, 0.0)), BAND / 2)
        polys.append(transform_poly(base, glide))
        polys.append(transform_poly(mirrored, glide))
    else:
        raise ValueError(f"unknown frieze group: {group}")
    return polys


def generate_frieze(group, cells=4):
    if group not in FRIEZE_GROUPS:
        raise ValueError(f"group must be one of {FRIEZE_GROUPS}")
    width, height = cells * CELL + 20, BAND + 90
    body = []
    ox, oy = 10.0, 10.0
    for i in range(cells):
        for poly in frieze_operations(group, i):
            body.append(
                svg_polygon(
                    transform_poly(poly, lambda p: (p[0] + ox, p[1] + oy)),
                    fill=ACCENT, opacity=0.25,
                )
            )
    # strip axis and cell boundaries
    body.append(svg_line((ox, oy + BAND / 2), (ox + cells * CELL, oy + BAND / 2), dash="4,3"))
    for i in range(cells + 1):
        body.append(svg_line((ox + i * CELL, oy), (ox + i * CELL, oy + BAND), stroke=LIGHT))
    label = FRIEZE_LABEL.format(g=group) + "\n" + LABEL_MODERN
    return svg_doc(width, height, body, label)


# ---------------------------------------------------------------- quadrature

QUADRATURE_LABEL = (
    "Documented-procedure exercise: ad quadratum (rotation of squares) after "
    "Mathes Roriczer, Buechlein von der Fialen Gerechtigkeit (Regensburg, 1486); "
    "facsimile/transcription in Shelby, Gothic Design Techniques (1977). Steps: "
    "(1) draw the outer square; (2) mark midpoints of its sides; (3) join the "
    "midpoints to form the rotated inner square; (4) repeat. Each rotated "
    "square's area is half its predecessor; vertices are computed geometrically "
    "(exact closure by construction, not measured from a monument)."
)


def generate_quadrature(iterations=4, side=240.0):
    width, height = side + 220, side + 120
    body = []
    ox, oy = 20.0, 20.0
    sq = [(ox, oy), (ox + side, oy), (ox + side, oy + side), (ox, oy + side)]
    body.append(svg_polygon(sq, stroke=INK, width=2.0))
    body.append(svg_text((ox, oy - 6), "step 1: outer square", size=10))
    current = sq
    for i in range(iterations):
        mids = [
            ((current[k][0] + current[(k + 1) % 4][0]) / 2,
             (current[k][1] + current[(k + 1) % 4][1]) / 2)
            for k in range(4)
        ]
        body.append(svg_polygon(mids, stroke=ACCENT, width=1.4))
        body.append(svg_text((mids[0][0] + 4, mids[0][1] - 4), f"step {i + 2}: rotate square", size=9, fill=ACCENT))
        current = mids
    # diagonals of outer square (construction aid)
    body.append(svg_line(sq[0], sq[2], dash="3,3"))
    body.append(svg_line(sq[1], sq[3], dash="3,3"))
    note = (
        f"area ratio outer:innermost = 1:{fmt(1.0 / 2 ** iterations)} "
        f"(exact: each rotation halves the area)"
    )
    body.append(svg_text((ox, oy + side + 24), note, size=10))
    label = QUADRATURE_LABEL + "\n" + LABEL_MODERN
    return svg_doc(width, height, body, label)


# ---------------------------------------------------------------- robins grid

ROBINS_LABEL = (
    "Proportion-canon grid exercise after Gay Robins, Proportion and Style in "
    "Ancient Egyptian Art (1994): standing-figure canon of {n} squares from "
    "hairline to sole ({period}). The schematic figure is an ORIGINAL lab "
    "drawing, not a traced artifact. What the grid does NOT prove: aesthetic "
    "ideals, 'sacred' ratios, or any golden-ratio encoding (Markowsky 1992 "
    "controls); grids are documented workshop practice surviving on unfinished "
    "reliefs."
)


def schematic_figure(n_squares, square, ox, oy, amarna=False):
    """Original schematic standing figure on an n-square canon grid.

    Grid row 0 is the hairline; row n is the sole line. Key canon levels
    (Robins 1994): shoulders ~1/9 down, elbows near mid-torso, knees low.
    Amarna variant: elongated neck/limbs, fuller torso - documented canon
    change, shown as proportion shift, not copied from any relief.
    """
    body = []
    x = ox + 2.5 * square  # figure centered on a vertical axis
    head_r = square * (0.9 if amarna else 1.0)
    head_c = (x, oy + square)
    body.append(svg_circle(head_c, head_r, stroke=INK, width=1.6))
    if amarna:
        neck = (head_c[1] + head_r, oy + 3.6 * square)
        shoulder_y, hip_y, knee_y = oy + 4.2 * square, oy + 11.5 * square, oy + 15.5 * square
        torso_w, hip_w = 1.1, 1.5
    else:
        neck = (head_c[1] + head_r, oy + 3.0 * square)
        shoulder_y, hip_y, knee_y = oy + 3.4 * square, oy + 10.0 * square, oy + 14.0 * square
        torso_w, hip_w = 1.3, 1.1
    sole_y = oy + n_squares * square
    body.append(svg_line((x, neck[0]), (x, neck[1]), stroke=INK, width=1.6))
    body.append(svg_line((x - torso_w * square, shoulder_y), (x + torso_w * square, shoulder_y), stroke=INK, width=1.6))
    # arms
    for sgn in (-1, 1):
        body.append(svg_line((x + sgn * torso_w * square, shoulder_y),
                             (x + sgn * 0.7 * square, hip_y + square), stroke=INK, width=1.4))
    # torso sides and legs
    for sgn in (-1, 1):
        body.append(svg_line((x + sgn * torso_w * square, shoulder_y),
                             (x + sgn * hip_w * square, hip_y), stroke=INK, width=1.6))
        body.append(svg_line((x + sgn * hip_w * square, hip_y),
                             (x + sgn * 0.6 * square, knee_y), stroke=INK, width=1.5))
        body.append(svg_line((x + sgn * 0.6 * square, knee_y),
                             (x + sgn * 0.7 * square, sole_y), stroke=INK, width=1.5))
    return body


def generate_robins(variant="18square", square=22.0):
    if variant == "18square":
        n, period, amarna = 18, "Old/Middle Kingdom standing-figure canon", False
    elif variant == "amarna":
        n, period, amarna = 21, "Third Intermediate/Late-period 21-square grid shown with Amarna-style (c. 1353-1336 BCE) elongated proportions", True
    else:
        raise ValueError("variant must be '18square' or 'amarna'")
    grid_w = 6 * square
    grid_h = n * square
    width, height = grid_w + 140, grid_h + 120
    ox, oy = 20.0, 20.0
    body = []
    for i in range(7):
        body.append(svg_line((ox + i * square, oy), (ox + i * square, oy + grid_h), stroke=GRID, width=0.6))
    for j in range(n + 1):
        w = 1.2 if j in (0, n) else 0.6
        body.append(svg_line((ox, oy + j * square), (ox + grid_w, oy + j * square), stroke=GRID, width=w))
    for j in range(0, n + 1, 3):
        body.append(svg_text((ox + grid_w + 6, oy + j * square + 4), str(j), size=9, fill="#777777"))
    body += schematic_figure(n, square, ox, oy, amarna=amarna)
    body.append(svg_text((ox, oy - 6), f"hairline (row 0) to sole (row {n})", size=9))
    label = ROBINS_LABEL.format(n=n, period=period) + "\n" + LABEL_MODERN
    return svg_doc(width, height, body, label)


# -------------------------------------------------------------------- girih

GIRIH_LABEL = (
    "MODERN polygons-in-contact (PIC) exercise, method per Kaplan & Salesin, "
    "'Islamic Star Patterns in Absolute Geometry', ACM ToG 23(2) (2004): 97-119 "
    "(contact angle {a} deg). Historical record: Topkapi Scroll MS H.1956 "
    "(Necipoglu 1995) and Hankin (1925) - PIC is a modern inference from that "
    "record, not a documented maker procedure. Quasiperiodicity claims "
    "(Lu & Steinhardt 2007) are DISPUTED: see Makovicky, Science 318 (2007): "
    "1383, and Cromwell, Math. Intelligencer 37(4) (2015): 30-44."
)


def regular_polygon(center, radius, n, rot=0.0):
    return [
        (center[0] + radius * math.cos(rot + 2 * math.pi * k / n),
         center[1] + radius * math.sin(rot + 2 * math.pi * k / n))
        for k in range(n)
    ]


def _ray_intersection(p, d, q, e):
    """Solve p + t*d = q + s*e for t; None if parallel."""
    det = d[0] * (-e[1]) - d[1] * (-e[0])
    if abs(det) < 1e-12:
        return None
    bx, by = q[0] - p[0], q[1] - p[1]
    return (bx * (-e[1]) - by * (-e[0])) / det


def _pic_star(tile_center, poly, contact_angle, stroke, width_):
    """Per-tile polygons-in-contact star: from every edge midpoint, rays leave
    at the declared contact angle to the edge and terminate where they meet the
    adjacent edges' rays (computed intersection, not fixed length). Simplified
    PIC teaching rule - no inference to closure across tiles."""
    n = len(poly)
    theta = math.radians(contact_angle)
    out = []
    rays = []  # (midpoint, unit direction), both orientations per edge
    for k in range(n):
        a, b = poly[k], poly[(k + 1) % n]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        d = (tile_center[0] - mid[0], tile_center[1] - mid[1])
        dn = math.hypot(*d)
        inward = (d[0] / dn, d[1] / dn)  # unit normal toward tile center
        e = (-inward[1], inward[0])  # unit tangent along the edge
        rays.append((mid, (math.cos(theta) * inward[0] + math.sin(theta) * e[0],
                           math.cos(theta) * inward[1] + math.sin(theta) * e[1])))
        rays.append((mid, (math.cos(theta) * inward[0] - math.sin(theta) * e[0],
                           math.cos(theta) * inward[1] - math.sin(theta) * e[1])))
    # tile boundary distance per ray (exit through any non-origin edge)
    edges = [(poly[k], poly[(k + 1) % n]) for k in range(n)]

    def exit_t(p, d):
        t_min = None
        for a, b in edges:
            if (p[0] - (a[0] + b[0]) / 2) ** 2 + (p[1] - (a[1] + b[1]) / 2) ** 2 < 1e-9:
                continue  # the origin edge
            t = _ray_intersection(p, d, a, (b[0] - a[0], b[1] - a[1]))
            if t is None or t <= 1e-9:
                continue
            # intersection must lie on the segment a-b
            ex, ey = p[0] + t * d[0], p[1] + t * d[1]
            if (min(a[0], b[0]) - 1e-9 <= ex <= max(a[0], b[0]) + 1e-9 and
                    min(a[1], b[1]) - 1e-9 <= ey <= max(a[1], b[1]) + 1e-9):
                if t_min is None or t < t_min:
                    t_min = t
        return t_min

    # PIC rule: each ray terminates at its nearest intersection with another
    # ray, and never beyond its own tile boundary (simplified per-tile rule)
    for i, (p, d) in enumerate(rays):
        best = exit_t(p, d)
        for j, (q, e2) in enumerate(rays):
            if i == j or (q[0] == p[0] and q[1] == p[1]):
                continue
            t = _ray_intersection(p, d, q, e2)
            if t is not None and t > 1e-9 and (best is None or t < best):
                best = t
        if best is None:
            continue
        p2 = (p[0] + best * d[0], p[1] + best * d[1])
        out.append(svg_line(p, p2, stroke=stroke, width=width_))
    return out


def generate_girih(contact_angle=72.0):
    """Central regular decagon ringed by 10 edge-sharing decagons (edge-to-edge
    cluster), each carrying a per-tile polygons-in-contact star at the declared
    contact angle - the simplified PIC teaching rule of Kaplan & Salesin 2004."""
    R = 60.0
    width = height = 560.0
    center = (width / 2, height / 2 - 30)
    rot = math.pi / 2
    central = regular_polygon(center, R, 10, rot)
    body = []
    ap = R * math.cos(math.pi / 10)
    # ring of edge-sharing neighbor decagons (tile outlines first, stars on top)
    ring = []
    for k in range(10):
        a, b = central[k], central[(k + 1) % 10]
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        d = (mid[0] - center[0], mid[1] - center[1])
        dn = math.hypot(*d)
        u = (d[0] / dn, d[1] / dn)
        nc = (center[0] + u[0] * 2 * ap, center[1] + u[1] * 2 * ap)
        ring.append((nc, regular_polygon(nc, R, 10, rot)))
    for nc, npoly in ring:
        body.append(svg_polygon(npoly, stroke=GRID, width=1.0))
    body.append(svg_polygon(central, stroke=INK, width=1.8))
    for nc, npoly in ring:
        body += _pic_star(nc, npoly, contact_angle, ACCENT, 1.0)
    body += _pic_star(center, central, contact_angle, INK, 1.4)
    label = GIRIH_LABEL.format(a=fmt(contact_angle)) + "\n" + LABEL_MODERN
    return svg_doc(width, height, body, label)


# -------------------------------------------------------------------- driver

def generate(mode, group=None, variant=None, contact_angle=72.0):
    if mode == "frieze":
        return generate_frieze(group or "p1m1")
    if mode == "quadrature":
        return generate_quadrature()
    if mode == "robins-grid":
        return generate_robins(variant or "18square")
    if mode == "girih":
        return generate_girih(contact_angle)
    raise ValueError(f"unknown mode: {mode}")


def all_assets():
    out = {}
    for g in FRIEZE_GROUPS:
        out[f"frieze_{g}.svg"] = generate_frieze(g)
    out["roriczer_quadrature.svg"] = generate_quadrature()
    out["robins_grid_18square.svg"] = generate_robins("18square")
    out["robins_grid_amarna.svg"] = generate_robins("amarna")
    out["girih_pic_decagon.svg"] = generate_girih()
    return out


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def self_test():
    """Generate every asset twice; require byte-identical output, well-formed
    XML, and mandatory honesty labels."""
    assets = all_assets()
    again = all_assets()
    errors = []
    for name, svg in assets.items():
        if svg != again[name]:
            errors.append(f"{name}: non-deterministic output")
        try:
            ET.fromstring(svg)
        except ET.ParseError as exc:
            errors.append(f"{name}: malformed SVG: {exc}")
        if "MODERN EXERCISE" not in svg and "Documented-procedure exercise" not in svg:
            errors.append(f"{name}: missing modern-exercise/procedure label")
    checks = {
        "roriczer_quadrature.svg": ["Roriczer", "1486", "ad quadratum", "Shelby"],
        "robins_grid_18square.svg": ["Robins", "18", "does NOT prove", "Markowsky"],
        "robins_grid_amarna.svg": ["Amarna", "21"],
        "girih_pic_decagon.svg": ["Kaplan & Salesin", "2004", "DISPUTED", "Cromwell", "Topkapi"],
        "frieze_p1g1.svg": ["Schattschneider", "Washburn & Crowe", "modern notation"],
    }
    for name, needles in checks.items():
        for needle in needles:
            if needle not in assets[name]:
                errors.append(f"{name}: missing required text {needle!r}")
    if errors:
        for e in errors:
            print("FAIL:", e)
        return 1
    print(f"self-test OK: {len(assets)} assets, deterministic, well-formed, labels present")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mode", choices=["frieze", "quadrature", "robins-grid", "girih", "all"])
    ap.add_argument("--group", choices=FRIEZE_GROUPS, help="frieze group (mode=frieze)")
    ap.add_argument("--variant", choices=["18square", "amarna"], help="canon variant (mode=robins-grid)")
    ap.add_argument("--contact-angle", type=float, default=72.0, help="PIC contact angle in degrees (mode=girih)")
    ap.add_argument("--out", help="output SVG path (single-asset modes)")
    ap.add_argument("--outdir", help="output directory (mode=all)")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args(argv)

    if args.self_test:
        return self_test()
    if not args.mode:
        ap.error("--mode is required unless --self-test")
    if args.mode == "all":
        outdir = args.outdir or tempfile.mkdtemp(prefix="pattern_assets_")
        os.makedirs(outdir, exist_ok=True)
        for name, svg in all_assets().items():
            write(os.path.join(outdir, name), svg)
        print(f"wrote {len(all_assets())} assets to {outdir}")
        return 0
    svg = generate(args.mode, group=args.group, variant=args.variant, contact_angle=args.contact_angle)
    if args.out:
        write(args.out, svg)
        print(f"wrote {args.out}")
    else:
        sys.stdout.write(svg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
