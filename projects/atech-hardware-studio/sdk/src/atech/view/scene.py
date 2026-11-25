"""What ``atech view`` draws: a project's board and modules, posed, as one JSON-able dict.

Every pose is computed here, by :func:`atech.sim.model.module_pose_on_board`, the same
function ``atech sim-assets`` places modules with. The page only
applies the transforms; it holds no placement rules of its own. (Studio's
``boardplace.ts`` seats modules with hand-tuned tables instead. On the 14-port board
the two agree to within 0.6 mm for every catalog module on every port and pair,
because the release GLBs' own origin is the socket centre.)

Frames: everything is in the board's asset frame (metres, +z out of the top face,
origin at the centre of the bottom face), as in ``sim.yaml``. A module's pose places
its asset frame; its GLB is glTF +y up and is turned into the asset frame on the page
(``(x, y, z) -> (x, -z, y)``, a quarter turn about x), as ``atech.sim.meshes`` does.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources
from pathlib import Path
from typing import Any

import yaml

from atech.sim.meshes import BOARD_SLUG, MODULE_SLUG
from atech.sim.geometry import compose, invert
from atech.sim.model import module_pose_on_board
from atech.sim.spec import SimSpec, load_board_sim, load_module_sim

#: The board's reserved port that holds the USB-C power module, drawn like studio
#: draws it: always there, never a project module. (boards/<id>.yaml lists it under
#: ``reserved``; tests/test_view.py checks that it does.)
USB_PORT: dict[str, str] = {"14port": "port_8", "10port": "port_10", "8port": "port_8"}

#: What the page says under the board's name where the drawing is less certain than
#: the 14-port board's (whose layout matches studio's, tuned on hardware).
BOARD_NOTES: dict[str, str] = {
    "10port": "The socket positions come from this board's CAD, but which socket is which port "
              "number is a guess (boards/sim/10port.sim.yaml). Check against the numbers printed "
              "on the board.",
    "8port": "This board has no CAD model yet: it is drawn as boxes, its ports laid out from "
             "boards/8port.yaml. Check against the numbers printed on the board.",
}

#: Stand-ins whose connector frame is used to pose a module that has no ``sim.yaml``
#: (a custom module): both have their connector at the centre of the bottom face.
_STAND_IN = {1: "button", 2: "speaker"}


def glb_dir() -> Path:
    """The GLBs that ship in the package (the meshopt variant of the release)."""
    return Path(str(resources.files("atech.view") / "glb"))


@lru_cache(maxsize=1)
def bundled_release() -> dict[str, Any]:
    """``glb/release.json``: which release tag the bundled GLBs come from."""
    return json.loads((glb_dir() / "release.json").read_text(encoding="utf-8"))


#: Models the bundled release has that ``atech.sim.meshes.MODULE_SLUG`` does not map,
#: because sim-assets defaults to an older release without them (there, the module gets
#: a derived model instead). Its sim.yaml agrees with the CAD to 0.22 mm (tests/test_view.py).
VIEW_ONLY_SLUG: dict[str, str] = {"scd40_air_quality": "co2-sensor"}


def _slug(spec: SimSpec) -> str | None:
    table = BOARD_SLUG if spec.kind == "board" else {**MODULE_SLUG, **VIEW_ONLY_SLUG}
    slug = table.get(spec.id)
    if slug and (glb_dir() / f"{slug}.glb").is_file():
        return slug
    return None


def _boxes(spec: SimSpec) -> list[dict[str, Any]]:
    """A spec's box parts, for an asset with no GLB (the page draws them as boxes)."""
    return [
        {"name": p.name, "size": list(p.size_m), "pos": list(p.pos_m), "rgba": list(spec.colors.get(p.color, (0.6, 0.6, 0.62, 1)))}
        for p in spec.parts
    ]


def _model(spec: SimSpec) -> dict[str, Any]:
    slug = _slug(spec)
    if slug:
        return {"glb": f"glb/{slug}.glb", "source": f"Atech CAD ({slug}.glb)"}
    return {"boxes": _boxes(spec), "source": "approximate boxes (no CAD model in this release)"}


@dataclass
class _Ctx:
    board: SimSpec
    extra_paths: list[Path]


def _module_sim(module_id: str, ctx: _Ctx) -> SimSpec | None:
    for path in ctx.extra_paths:
        if (Path(path) / module_id / "sim.yaml").is_file():
            return load_module_sim(module_id, Path(path))
    try:
        return load_module_sim(module_id)
    except Exception:
        return None


def _pose(board: SimSpec, ports: list[str], spec: SimSpec) -> tuple[list[float], list[float]]:
    pos, quat = module_pose_on_board(board, ports, spec)
    return [round(v, 6) for v in pos], [round(v, 6) for v in quat]


def _generic_boxes(size_ports: int) -> list[dict[str, Any]]:
    """A neutral block over the module's cells, for a module with no ``sim.yaml``."""
    length = 0.0195 * size_ports + 0.0005 * (size_ports - 1)
    return [{"name": "body", "size": [length, 0.0195, 0.01], "pos": [0, 0, 0.005], "rgba": [0.55, 0.57, 0.62, 1]}]


_ISSUE_PREFIX = re.compile(r"^\s*-\s*\[[^\]]*\]\s*(\([^)]*\)\s*)?")


def _reason(exc: Exception) -> str:
    """The message of a refused ``Project.add``, without the ``invalid placement:`` header."""
    text = str(exc.args[0]) if isinstance(exc, KeyError) and exc.args else str(exc)  # KeyError quotes itself
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    if lines and lines[0].rstrip().endswith(":") and len(lines) > 1:
        lines = lines[1:]
    return "; ".join(_ISSUE_PREFIX.sub("", ln).strip() for ln in lines)


def _load_leniently(project_yaml: Path) -> tuple[Any, list[dict[str, Any]]]:
    """The project with every module entry that places, and the entries that do not.

    ``Project.load`` stops at the first bad entry; this adds the entries one at a time
    with the same ``Project.add`` (so the same checks, in the same order: the first
    module on a port keeps it) and keeps going, so the page can draw what is right
    and list what is not.
    """
    from atech.project import Project

    text = project_yaml.read_text(encoding="utf-8")
    data = yaml.safe_load(text) or {}
    if not isinstance(data, dict):
        raise ValueError("project.yaml must be a mapping")
    entries = data.get("modules") or []
    if not isinstance(entries, list):
        raise ValueError("modules: must be a list")
    project = Project.from_yaml(yaml.safe_dump({**data, "modules": []}), base_dir=project_yaml.parent)
    refused: list[dict[str, Any]] = []
    for raw in entries:
        entry = raw if isinstance(raw, dict) else {}
        port_arg = entry.get("port", entry.get("ports"))
        try:
            if not entry.get("id"):
                raise ValueError(f"module entry {raw!r} has no id")
            if port_arg is None:
                raise ValueError("no port or ports")
            project.add(entry["id"], ports=port_arg, instance=entry.get("instance"),
                        swap_lines=bool(entry.get("swap_lines", False)))
        except Exception as exc:
            ports = port_arg if isinstance(port_arg, list) else ([] if port_arg is None else [port_arg])
            refused.append({
                "instance": str(entry.get("instance") or entry.get("id") or "?"),
                "module": str(entry.get("id") or "?"),
                "ports": [p if isinstance(p, str) else f"port_{p}" for p in ports],
                "why": _reason(exc),
            })
    return project, refused


def build_scene(project_dir: Path | str) -> dict[str, Any]:
    """The scene for ``project_dir`` (or its ``project.yaml``).

    Never raises for a broken project: one that cannot be read at all comes back as
    ``{"error": ...}`` and the page keeps showing the last good scene under that
    message. A module entry that does not place (the checks ``atech validate`` runs)
    is listed in ``unplaced`` and ``issues`` with the reason, and the rest are drawn.
    """
    p = Path(project_dir).expanduser().resolve()
    project_yaml = p / "project.yaml" if p.is_dir() else p
    try:
        project, refused = _load_leniently(project_yaml)
        specs = project.module_specs()
        board_spec = project.board_spec
        board = load_board_sim(project.board)
    except Exception as exc:  # a half-written project.yaml is the normal case while editing
        return {"error": f"{type(exc).__name__}: {exc}"}

    ctx = _Ctx(board, list(project.extra_module_paths))
    known = project._catalog()  # refused entries are not in module_specs(); their names still are here
    for r in refused:
        spec = known.get(r["module"])
        r["name"] = spec.label if spec else r["module"]
        r["pins"] = []
    scene: dict[str, Any] = {
        "project": project.name,
        "board": {
            "id": board.id,
            "name": board_spec.name,
            "note": BOARD_NOTES.get(board.id),
            # every port frame, so the page can number the empty sockets
            "ports": [
                {"id": p.port_id, "pos": list(p.frame.pos_m), "face": p.face, "reserved": p.port_id in board_spec.reserved}
                for p in board.ports
            ],
            **_model(board),
        },
        "modules": [],
        "fixed": [],
        "unplaced": list(refused),
        "issues": [{"instance": r["instance"], "ports": r["ports"], "message": r["why"]} for r in refused],
        "cautions": [{"instance": inst, "module": mid, "text": text} for inst, mid, text in project.cautions()],
        "release": bundled_release().get("tag"),
    }

    usb = USB_PORT.get(board.id)
    if usb:
        usb_spec = _module_sim("usb_c", ctx)
        if usb_spec is not None:
            # module_pose_on_board refuses a reserved port (no project may use one);
            # this is its one-port case: the connector frame on the port frame.
            frame = board.port(usb).frame
            inv_pos, inv_quat = invert(usb_spec.connector.pos_m, usb_spec.connector.quat_wxyz)
            p, q = compose(frame.pos_m, frame.quat_wxyz, inv_pos, inv_quat)
            pos, quat = [round(v, 6) for v in p], [round(v, 6) for v in q]
            scene["fixed"].append({"name": "USB-C", "ports": [usb], "pos": pos, "quat": quat, **_model(usb_spec)})

    for pm in project.modules:
        catalog = specs.get(pm.module_id)
        entry: dict[str, Any] = {
            "instance": pm.instance,
            "module": pm.module_id,
            "name": catalog.label if catalog else pm.module_id,
            "ports": list(pm.ports),
            "pins": [p.gpio for port_id in pm.ports if port_id in board_spec.port_ids for p in board_spec.port(port_id).pins],
        }
        spec = _module_sim(pm.module_id, ctx)
        try:
            if spec is None:
                stand_in = load_module_sim(_STAND_IN.get(len(pm.ports), "button"))
                pos, quat = _pose(board, list(pm.ports), stand_in)
                model = {"boxes": _generic_boxes(len(pm.ports)), "source": "no 3D model (this module has no sim.yaml)"}
            else:
                pos, quat = _pose(board, list(pm.ports), spec)
                model = _model(spec)
        except (ValueError, KeyError) as exc:
            entry["why"] = str(exc)
            scene["unplaced"].append(entry)
            continue
        scene["modules"].append({**entry, "pos": pos, "quat": quat, **model})
    return scene
