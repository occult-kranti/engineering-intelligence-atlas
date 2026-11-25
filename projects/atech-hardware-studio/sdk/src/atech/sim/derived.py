"""Visuals for the assets Atech has no CAD for, built from the CAD it has.

Every Atech module shares one construction: a black shell, a navy PCB, gold pins, a
connector housing and a glass lid (the release GLBs, ``meshes.py``). A module without a
model in the release gets that construction from a **donor** with the same number of
ports, minus the donor's own parts (the AHT20 chip of ``temp-sensor``, the display of
``screen``), plus its ``sim.yaml`` parts drawn as meshes in their ``shape:`` (a box,
a box with rounded vertical edges, an elliptic cylinder, a faceted half-ellipsoid, or a
box with its +x+y vertical edge chamfered), each filling its box. The result has the
same bounds as the ``sim.yaml`` boxes, so the collision geometry and the visual agree.
A module can name its own donor (``MODULE_DONOR_OVERRIDES``): the button's shell
for a part that rises through the lid (its glass has an 11 mm opening, the
temperature sensor's a 5 mm one), or a longer shell with the connector pins under one
port cell only and an opening cut in the glass.

A board without a model gets its ``sim.yaml`` plate in the PCB of ``frame-2`` (the
14-port board), one socket housing of ``frame-2`` on every port, and its parts.

These are **not Atech CAD**. The source recorded in every exported file
(``atech:visual:source``) starts with ``derived:`` and names the donor; the parts'
sizes are the ``sim.yaml`` placeholders. Replace them when Atech's CAD release has the
model: :class:`~atech.sim.meshes.MeshLibrary` prefers a release model whenever one exists.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from typing import Any

from atech.sim.spec import BoxPart, SimSpec

#: ports a module spans -> (donor slug, donor materials that are that module's own parts)
MODULE_DONORS: dict[int, tuple[str, frozenset[str]]] = {
    1: ("temp-sensor", frozenset({"white"})),
    2: ("screen", frozenset({"gloss", "screen_art"})),
}


@dataclass(frozen=True)
class Donor:
    """A release model a derived module is built from."""

    slug: str
    own: frozenset[str]  # the donor's own parts, left out
    #: keep the pins and connector housing (``gold``, ``black_m``) only where x < this (mm)
    pins_below_x_mm: float | None = None
    #: replace the glass by a plate of the same bounds with this opening (cx, cy, sx, sy; mm)
    glass_opening_mm: tuple[float, float, float, float] | None = None


#: module id -> donor, where the default by port count does not fit
MODULE_DONOR_OVERRIDES: dict[str, Donor] = {
    # a sensor standing up through the lid, as in Atech's renders of the CO2 module
    "scd40_air_quality": Donor("button", frozenset({"gloss"})),
    # one port, but a housing two cells long (the screen's shell): pins under the
    # -x cell, the lid open over the servo connector at the +x end
    "robot_arm": Donor("screen", frozenset({"gloss", "screen_art"}), pins_below_x_mm=0.0,
                       glass_opening_mm=(13.0, 0.0, 9.0, 12.0)),
    # the same two-cell shell, the lid open over the barrel jack at the +x end
    "power_jack": Donor("screen", frozenset({"gloss", "screen_art"}), pins_below_x_mm=0.0,
                        glass_opening_mm=(14.5, 0.0, 10.0, 11.0)),
}
BOARD_DONOR = "frame-2"

#: sim.yaml colour key -> surface (metallic, roughness); unknown keys are plastic
_SURFACES: dict[str, tuple[float, float]] = {
    "chip": (0.0, 0.35),
    "connector": (0.0, 0.6),
    "white": (0.0, 0.45),
    "accent": (0.0, 0.4),
    "port": (0.0, 0.5),
    "lens": (0.0, 0.3),
    "sensor_base": (0.0, 0.5),
    "passive": (0.0, 0.5),
    "capacitor": (0.0, 0.45),
    "pin": (1.0, 0.3),
}

#: the window that cuts one 14-port socket out of frame-2, around its housing centre (mm):
#: the housing is 11.5 x 15.6 mm, its pin rows 6.35 mm off centre; the next port's
#: parts are 10 mm (along the column) and 16 mm (across) away
_SOCKET_HALF_MM = (6.5, 8.6)


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _part_mesh(part: BoxPart) -> Any:
    """A sim.yaml part as a mesh in its ``shape``, filling its box."""
    import numpy as np
    import trimesh

    sx, sy, sz = part.size_m
    cx, cy, cz = part.pos_m
    base = (cx, cy, cz - sz / 2.0)
    if part.shape == "dome":
        # Few rings and sectors: the facets read as a Fresnel lens.
        return _dome(sx / 2.0, sy / 2.0, sz, base, rings=6, sectors=16)
    if part.shape == "cylinder":
        t = np.linspace(0.0, 2 * np.pi, 48, endpoint=False)
        return _prism(np.c_[sx / 2 * np.cos(t), sy / 2 * np.sin(t)], sz, base)
    if part.shape == "cylinder_x":  # lying along x: a prism in (y, z) mapped by (u, v, w) -> (w, u, v)
        t = np.linspace(0.0, 2 * np.pi, 48, endpoint=False)
        m = _prism(np.c_[sy / 2 * np.cos(t), sz / 2 * np.sin(t)], sx, (0.0, 0.0, 0.0))
        v = np.asarray(m.vertices)
        return trimesh.Trimesh(np.c_[v[:, 2] + cx - sx / 2, v[:, 0] + cy, v[:, 1] + cz], np.asarray(m.faces), process=False)
    if part.shape == "rounded_end":  # a semicircular end at +y, as a probe's tip
        r = sx / 2
        t = np.linspace(0.0, np.pi, 25)
        outline = np.vstack([[(-r, -sy / 2), (r, -sy / 2)], np.c_[r * np.cos(t), sy / 2 - r + r * np.sin(t)]])
        return _prism(outline, sz, base)
    if part.shape == "rounded_box":
        r = min(sx, sy) * 0.08
        return _prism(_rounded_rect(sx, sy, r), sz, base)
    if part.shape == "chamfered_box":
        c = min(sx, sy) * 0.2
        hx, hy = sx / 2, sy / 2
        return _prism(np.array([(-hx, -hy), (hx, -hy), (hx, hy - c), (hx - c, hy), (-hx, hy)]), sz, base)
    box = trimesh.creation.box(extents=(sx, sy, sz))
    box.apply_translation((cx, cy, cz))
    return trimesh.Trimesh(np.asarray(box.vertices), np.asarray(box.faces), process=False)


def _rounded_rect(sx: float, sy: float, r: float, steps: int = 6) -> Any:
    """A rectangle with rounded corners, counter-clockwise, centred on the origin."""
    import numpy as np

    pts = []
    for (ccx, ccy), a0 in (((sx / 2 - r, -sy / 2 + r), -np.pi / 2), ((sx / 2 - r, sy / 2 - r), 0.0),
                           ((-sx / 2 + r, sy / 2 - r), np.pi / 2), ((-sx / 2 + r, -sy / 2 + r), np.pi)):
        for k in range(steps + 1):
            a = a0 + (np.pi / 2) * k / steps
            pts.append((ccx + r * np.cos(a), ccy + r * np.sin(a)))
    return np.array(pts)


def _prism(outline: Any, h: float, base: tuple[float, float, float]) -> Any:
    """A convex counter-clockwise outline extruded by ``h`` from a base centred at ``base``."""
    import numpy as np
    import trimesh

    n = len(outline)
    verts = np.vstack([np.c_[outline, np.zeros(n)], np.c_[outline, np.full(n, h)]]) + np.asarray(base)
    faces = []
    for i in range(1, n - 1):
        faces += [(0, i + 1, i), (n, n + i, n + i + 1)]  # bottom, top (fans)
    for i in range(n):
        j = (i + 1) % n
        faces += [(i, j, n + j), (i, n + j, n + i)]
    return trimesh.Trimesh(verts, np.asarray(faces), process=False)


def _dome(rx: float, ry: float, h: float, base: tuple[float, float, float], rings: int = 12, sectors: int = 32) -> Any:
    """The upper half of an ellipsoid (semi-axes rx, ry, h) on a flat base centred at ``base``."""
    import numpy as np
    import trimesh

    verts = [(0.0, 0.0, h)]  # apex
    for i in range(1, rings + 1):
        phi = (np.pi / 2) * i / rings  # from the apex down to the equator
        for j in range(sectors):
            th = 2 * np.pi * j / sectors
            verts.append((rx * np.sin(phi) * np.cos(th), ry * np.sin(phi) * np.sin(th), h * np.cos(phi)))
    verts.append((0.0, 0.0, 0.0))  # centre of the base
    faces = []
    ring = lambda i, j: 1 + (i - 1) * sectors + (j % sectors)  # noqa: E731
    for j in range(sectors):
        faces.append((0, ring(1, j), ring(1, j + 1)))
    for i in range(1, rings):
        for j in range(sectors):
            a, b, c, d = ring(i, j), ring(i, j + 1), ring(i + 1, j), ring(i + 1, j + 1)
            faces += [(a, c, d), (a, d, b)]
    centre = len(verts) - 1
    for j in range(sectors):
        faces.append((centre, ring(rings, j + 1), ring(rings, j)))
    mesh = trimesh.Trimesh(np.asarray(verts) + np.asarray(base), np.asarray(faces), process=False)
    if mesh.volume < 0:
        mesh.invert()
    return mesh


def _mesh_part(name: str, mesh: Any, rgba_srgb: tuple[float, float, float, float], surface: str) -> Any:
    import numpy as np

    from atech.sim.meshes import MeshPart, Pbr

    metallic, roughness = _SURFACES.get(surface, (0.0, 0.5))
    linear = tuple(round(_srgb_to_linear(c), 4) for c in rgba_srgb[:3]) + (rgba_srgb[3],)
    return MeshPart(
        name=name,
        material=name,
        rgba_linear=linear,  # type: ignore[arg-type]
        rgba_srgb=tuple(rgba_srgb),  # type: ignore[arg-type]
        vertices=np.asarray(mesh.vertices, dtype=float),
        faces=np.asarray(mesh.faces, dtype=np.int64),
        pbr=Pbr(base_color=linear, metallic=metallic, roughness=roughness),  # type: ignore[arg-type]
    )


def _cut_pins(part: Any, below_x_m: float) -> Any:
    """``part`` with only its triangles whose centre lies at x < ``below_x_m``."""
    import numpy as np

    keep = part.faces[part.vertices[part.faces].mean(axis=1)[:, 0] < below_x_m]
    used, faces = np.unique(keep, return_inverse=True)
    uvs = None if part.uvs is None else part.uvs[part.vertices[part.faces].mean(axis=1)[:, 0] < below_x_m]
    return replace(part, vertices=part.vertices[used], faces=faces.reshape(-1, 3), uvs=uvs)


def _glass_with_opening(glass: Any, opening_mm: tuple[float, float, float, float]) -> Any:
    """A plate with ``glass``'s bounds and material and a rectangular opening."""
    import numpy as np

    (x0, y0, z0), (x1, y1, z1) = glass.bounds_m
    cx, cy, sx, sy = (v / 1000.0 for v in opening_mm)
    ox0, ox1, oy0, oy1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2
    slabs = [(x0, ox0, y0, y1), (ox1, x1, y0, y1), (ox0, ox1, y0, oy0), (ox0, ox1, oy1, y1)]
    verts, faces = [], []
    for a0, a1, b0, b1 in slabs:
        if a1 <= a0 or b1 <= b0:
            continue
        m = _prism(np.array([(a0, b0), (a1, b0), (a1, b1), (a0, b1)]), z1 - z0, (0.0, 0.0, z0))
        faces.append(np.asarray(m.faces) + sum(len(v) for v in verts))
        verts.append(np.asarray(m.vertices))
    return replace(glass, vertices=np.vstack(verts), faces=np.vstack(faces), uvs=None)


def _feature_parts(spec: SimSpec, taken: set[str]) -> list[Any]:
    """Every sim.yaml part but the body, as meshes in its own colour."""
    out = []
    for part in spec.parts[1:]:
        name = f"derived_{part.name}"
        while name in taken:
            name += "_"
        taken.add(name)
        out.append(_mesh_part(name, _part_mesh(part), spec.colors[part.color], part.color))
    return out


def derived_module(spec: SimSpec, read_donor: Any) -> tuple[Any | None, str]:
    """``(visual, note)`` for a module without CAD; ``read_donor(slug)`` returns
    ``(parts, sha256)`` of a release model, or None when the library lacks it."""
    from atech.sim.meshes import CadVisual

    donor = MODULE_DONOR_OVERRIDES.get(spec.id)
    if donor is None and spec.size_ports in MODULE_DONORS:
        donor = Donor(*MODULE_DONORS[spec.size_ports])
    if donor is None:
        return None, f"no donor for a {spec.size_ports}-port module; boxes"
    slug = donor.slug
    got = read_donor(slug)
    if got is None:
        return None, f"donor {slug}.glb not in the mesh folder; boxes"
    parts, sha = got
    shell = []
    for p in parts:
        if p.material in donor.own:
            continue
        if donor.pins_below_x_mm is not None and p.material in ("gold", "black_m"):
            p = _cut_pins(p, donor.pins_below_x_mm / 1000.0)
        if donor.glass_opening_mm is not None and p.material == "glass":
            p = _glass_with_opening(p, donor.glass_opening_mm)
        shell.append(p)
    taken = {p.name for p in shell}
    features = _feature_parts(spec, taken)
    names = ", ".join(p.name for p in spec.parts[1:]) or "no parts"
    visual = CadVisual(
        slug=f"derived-{spec.id}",
        source=f"derived: shell of {slug}.glb (Atech CAD) + sim.yaml parts ({names}); not Atech CAD of this module",
        sha256=hashlib.sha256((sha + spec.source_file + repr(spec.parts) + repr(donor)).encode()).hexdigest(),
        parts=tuple(shell) + tuple(features),
    )
    return visual, f"derived model (shell of {slug}.glb + {names}); not Atech CAD"


def derived_board(spec: SimSpec, read_donor: Any) -> tuple[Any | None, str]:
    """``(visual, note)`` for a board without CAD: its plate, ``frame-2``'s socket on
    every port, and its parts."""
    import numpy as np
    import trimesh

    from atech.sim.meshes import CadVisual, MeshPart

    got = read_donor(BOARD_DONOR)
    if got is None:
        return None, f"donor {BOARD_DONOR}.glb not in the mesh folder; boxes"
    parts, sha = got
    donor = {p.material: p for p in parts}
    if "socket" not in donor or "board" not in donor:
        return None, f"{BOARD_DONOR}.glb has no socket / board material; boxes"

    # One socket housing of the donor: everything of `socket` within a port's footprint
    # around the donor's port 1 (sim.yaml 14port: x -19.5 mm, y 50 mm, facing -x). Its
    # housing centre sits 3.5 mm inward of the port frame.
    src = donor["socket"]
    centre = np.array([-0.01598, 0.05, 0.0])
    hx, hy = (v / 1000.0 for v in _SOCKET_HALF_MM)
    tri_c = src.vertices[src.faces].mean(axis=1)
    keep = (np.abs(tri_c[:, 0] - centre[0]) < hx) & (np.abs(tri_c[:, 1] - centre[1]) < hy)
    one = trimesh.Trimesh(src.vertices, src.faces[keep], process=False)
    one.remove_unreferenced_vertices()
    one.apply_translation(-centre)
    seat_z = float(one.vertices[:, 2].min())

    body = spec.body
    plate_z = body.size_m[2]
    sockets = []
    for port in spec.ports:
        if port.port_id in _reserved(spec) or port.face == "bottom":
            continue  # reserved positions are parts; two-sided boards have their own CAD (10port)
        # The donor socket faces -x (left column, yaw 90); turn it to this port's yaw and
        # put its centre 3.5 mm inward of the port frame, its foot on the plate.
        yaw = np.radians(port.frame.rpy_deg[2] - 90.0)
        rot = trimesh.transformations.rotation_matrix(yaw, (0, 0, 1))
        inward = rot[:3, :3] @ np.array([0.0035, 0.0, 0.0])
        mesh = one.copy()
        mesh.apply_transform(rot)
        x, y, _ = port.frame.pos_m
        mesh.apply_translation((x + inward[0], y + inward[1], plate_z - seat_z))
        sockets.append(mesh)
    if not sockets:
        return None, "no top-face ports to put sockets on; boxes"
    merged = trimesh.util.concatenate(sockets)
    plate = trimesh.creation.box(extents=body.size_m)
    plate.apply_translation(body.pos_m)
    board_part = donor["board"]
    socket_part = donor["socket"]
    out = [
        MeshPart(name="board", material="board", rgba_linear=board_part.rgba_linear, rgba_srgb=board_part.rgba_srgb,
                 vertices=np.asarray(plate.vertices, float), faces=np.asarray(plate.faces, np.int64),
                 pbr=board_part.pbr),
        MeshPart(name="socket", material="socket", rgba_linear=socket_part.rgba_linear,
                 rgba_srgb=socket_part.rgba_srgb, vertices=np.asarray(merged.vertices, float),
                 faces=np.asarray(merged.faces, np.int64), pbr=socket_part.pbr),
    ]
    out += _feature_parts(spec, {"board", "socket"})
    visual = CadVisual(
        slug=f"derived-{spec.id}",
        source=f"derived: sim.yaml plate in {BOARD_DONOR}.glb's PCB + its socket housing per port "
               f"(Atech CAD); not Atech CAD of this board",
        sha256=hashlib.sha256((sha + spec.source_file + repr(spec.parts) + repr(spec.ports)).encode()).hexdigest(),
        parts=tuple(out),
    )
    return visual, f"derived model ({BOARD_DONOR}.glb's PCB and sockets on the sim.yaml layout); not Atech CAD"


def _reserved(spec: SimSpec) -> set[str]:
    from atech.catalog import get_board

    try:
        return set(get_board(spec.id).reserved)
    except Exception:  # a board from elsewhere: no catalog entry to ask
        return set()
