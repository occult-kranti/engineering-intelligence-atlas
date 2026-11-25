"""MuJoCo MJCF export: a ``<body>`` to paste into a scene, or a standalone model.

Pure Python; ``mujoco`` is not needed to write the XML.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING
from xml.sax.saxutils import escape, quoteattr

from atech import __version__
from atech.sim.geometry import Quat, Vec3
from atech.sim.spec import DeviceBlock, SimSpec, load_board_sim, load_module_sim

if TYPE_CHECKING:
    from atech.sim.meshes import CadVisual

_SITE_SIZE_M = 0.002


def _num(v: float) -> str:
    text = f"{v:.9g}"
    return "0" if text == "-0" else text


def _vec(v: Sequence[float]) -> str:
    return " ".join(_num(c) for c in v)


def _check_name(name: str) -> None:
    if not name or any(c.isspace() for c in name) or "/" in name:
        raise ValueError(f"MJCF name must be non-empty with no spaces or '/': {name!r}")


def _site(name: str, pos: Vec3, quat: Quat, rgba: str) -> str:
    return (
        f"<site name={quoteattr(name)} pos=\"{_vec(pos)}\" quat=\"{_vec(quat)}\" "
        f"size=\"{_num(_SITE_SIZE_M)}\" rgba=\"{rgba}\" group=\"4\"/>"
    )


def spec_mjcf_body(
    spec: SimSpec,
    name: str,
    pos: Vec3 = (0.0, 0.0, 0.0),
    quat: Quat = (1.0, 0.0, 0.0, 0.0),
    *,
    rgba: Sequence[float] | None = None,
    freejoint: bool = False,
    indent: str = "",
    cad: CadVisual | None = None,
) -> str:
    """The ``<body>`` element for an already loaded :class:`SimSpec`.

    With ``cad`` (see :mod:`atech.sim.meshes`), the visuals are the CAD meshes
    ``<name>_<material>_cad`` (geoms in group 2, no contacts, no mass; declare
    them with :func:`spec_mjcf_assets`) and the boxes become collision-only
    geoms in group 3, hidden by MuJoCo's viewer by default.
    """
    _check_name(name)
    if rgba is not None and len(rgba) != 4:
        raise ValueError("rgba must have 4 components")
    pad = indent + "  "
    lines = [f"{indent}<body name={quoteattr(name)} pos=\"{_vec(pos)}\" quat=\"{_vec(quat)}\">"]
    lines.append(f"{pad}<!-- Atech {spec.kind} {escape(spec.id)} ({escape(spec.name)}); atech {__version__}."
                 " Fields in sim.yaml placeholders: are guesses. -->")
    if freejoint:
        lines.append(f"{pad}<freejoint name={quoteattr(name + '_free')}/>")
    if cad is not None:
        for mp in cad.parts:
            lines.append(
                f"{pad}<geom name={quoteattr(f'{name}_{mp.name}_cad')} type=\"mesh\" "
                f"mesh={quoteattr(_mesh_name(name, mp.name))} rgba=\"{_vec(mp.rgba_srgb)}\" "
                f"contype=\"0\" conaffinity=\"0\" group=\"2\" mass=\"0\"/>"
            )
    collision_only = " group=\"3\"" if cad is not None else ""
    for part in spec.parts:
        colour = rgba if (rgba is not None and part.name == "body") else spec.colors[part.color]
        half = tuple(s / 2.0 for s in part.size_m)
        friction = _num(spec.physics_material.dynamic_friction)
        lines.append(
            f"{pad}<geom name={quoteattr(f'{name}_{part.name}')} type=\"box\" size=\"{_vec(half)}\" "
            f"pos=\"{_vec(part.pos_m)}\" mass=\"{_num(spec.part_mass_kg(part))}\" "
            f"rgba=\"{_vec(colour)}\" friction=\"{friction} 0.005 0.0001\"{collision_only}/>"
        )
    con = spec.connector
    lines.append(pad + _site(f"{name}_connector", con.pos_m, con.quat_wxyz, "0 0.6 1 1"))
    for role, block in (("sensor", spec.sensor), ("actuator", spec.actuator)):
        if block is not None:
            frame = block.frame
            lines.append(pad + _site(f"{name}_{role}", frame.pos_m, frame.quat_wxyz, "1 0.2 0.2 1"))
    for pf in spec.ports:
        lines.append(pad + _site(f"{name}_{pf.port_id}", pf.frame.pos_m, pf.frame.quat_wxyz, "0.2 1 0.2 1"))
    lines.append(f"{indent}</body>")
    return "\n".join(lines)


def _mesh_name(body: str, part: str) -> str:
    return f"{body}_{part}_cad_mesh"


def spec_mjcf_assets(cad: CadVisual, name: str, mesh_dir: str) -> list[str]:
    """``<mesh>`` entries (for ``<asset>``) of the CAD geoms of body ``name``.

    ``mesh_dir`` is where the STL files are, relative to the model file, as
    :func:`atech.sim.export.export_spec` writes them: ``<mesh_dir>/<material>.stl``.
    ``inertia="shell"``: CAD parts such as a screen's art are open surfaces with no
    volume, which MuJoCo refuses to compile otherwise (the geoms carry no mass).
    """
    base = mesh_dir.rstrip("/")
    return [
        f"<mesh name={quoteattr(_mesh_name(name, mp.name))} file={quoteattr(f'{base}/{mp.name}.stl')} "
        "inertia=\"shell\"/>"
        for mp in cad.parts
    ]


def module_mjcf_body(
    module_id: str,
    name: str,
    pos: Vec3 = (0.0, 0.0, 0.0),
    quat: Quat = (1.0, 0.0, 0.0, 0.0),
    *,
    rgba: Sequence[float] | None = None,
) -> str:
    """An MJCF ``<body>`` for a catalog module, to include in a scene.

    Geoms ``<name>_<part>`` (boxes with mass; MuJoCo derives the inertia), a site
    ``<name>_connector`` at the connector frame, and ``<name>_sensor`` /
    ``<name>_actuator`` at the device frame when the module has one. No joint:
    the body is welded to its parent. ``rgba`` overrides the main body colour.
    """
    return spec_mjcf_body(load_module_sim(module_id), name, pos, quat, rgba=rgba)


def board_mjcf_body(
    board_id: str,
    name: str,
    pos: Vec3 = (0.0, 0.0, 0.0),
    quat: Quat = (1.0, 0.0, 0.0, 0.0),
    *,
    rgba: Sequence[float] | None = None,
) -> str:
    """Like :func:`module_mjcf_body` for a board; adds a site ``<name>_<port id>`` per port."""
    return spec_mjcf_body(load_board_sim(board_id), name, pos, quat, rgba=rgba)


def _device_sensors(name: str, role: str, block: DeviceBlock) -> list[str]:
    site = quoteattr(f"{name}_{role}")
    if block.type == "imu":
        return [
            f"<accelerometer name={quoteattr(name + '_accel')} site={site}/>",
            f"<gyro name={quoteattr(name + '_gyro')} site={site}/>",
        ]
    if block.type == "tof_multizone":
        cutoff = block.params.get("max_range_m")
        extra = f" cutoff=\"{_num(float(cutoff))}\"" if cutoff is not None else ""
        return [f"<rangefinder name={quoteattr(name + '_range')} site={site}{extra}/>"]
    return []


def spec_mjcf_sensors(spec: SimSpec, name: str) -> list[str]:
    """MuJoCo ``<sensor>`` children that approximate the module's sensor.

    ``imu`` → accelerometer + gyro; ``tof_multizone`` → one rangefinder along the
    boresight (the centre ray only; the 8x8 zones need ray casts in the caller).
    Others → none.
    """
    if spec.sensor is None:
        return []
    return _device_sensors(name, "sensor", spec.sensor)


def module_mjcf_sensors(module_id: str, name: str) -> list[str]:
    return spec_mjcf_sensors(load_module_sim(module_id), name)


def spec_mjcf_xml(spec: SimSpec, *, cad: CadVisual | None = None, mesh_dir: str = "") -> str:
    """A standalone model: a floor, a light, and the asset on a free joint just above it.

    With ``cad``, the visuals are its meshes, read from ``<mesh_dir>/<material>.stl``
    relative to the model file.
    """
    name = spec.asset_name
    body = spec_mjcf_body(spec, name, (0.0, 0.0, 0.05), freejoint=True, indent="    ", cad=cad)
    sensors = spec_mjcf_sensors(spec, name)
    text = [
        ("atech:asset_type", spec.kind), ("atech:id", spec.id), ("atech:name", spec.name),
        ("atech:category", spec.category), ("atech:catalog_version", __version__),
        ("atech:placeholders", ",".join(spec.placeholders)),
    ]
    if spec.interface:
        text.append(("atech:interface", spec.interface))
    if spec.i2c_address is not None:
        text.append(("atech:i2c_address", str(spec.i2c_address)))
    if cad is not None:
        text += [("atech:visual:source", cad.source), ("atech:visual:sha256", cad.sha256)]
    lines = [
        f"<mujoco model={quoteattr(name)}>",
        "  <compiler angle=\"radian\" autolimits=\"true\"/>",
        "  <option timestep=\"0.002\" gravity=\"0 0 -9.81\"/>",
        "  <custom>",
        *(f"    <text name={quoteattr(k)} data={quoteattr(v or '-')}/>" for k, v in text),
        "  </custom>",
        *(
            ["  <asset>", *(f"    {m}" for m in spec_mjcf_assets(cad, name, mesh_dir)), "  </asset>"]
            if cad is not None else []
        ),
        "  <worldbody>",
        "    <light name=\"key_light\" pos=\"0 0 1\" dir=\"0 0 -1\"/>",
        "    <geom name=\"floor\" type=\"plane\" size=\"0.5 0.5 0.01\" rgba=\"0.8 0.8 0.8 1\"/>",
        body,
        "  </worldbody>",
    ]
    if sensors:
        lines += ["  <sensor>", *(f"    {s}" for s in sensors), "  </sensor>"]
    lines.append("</mujoco>")
    return "\n".join(lines) + "\n"
