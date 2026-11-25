"""URDF export (ROS / Gazebo / Isaac Sim's URDF importer). Pure Python.

A module becomes one link ``<name>`` with box visuals and colliders and its
inertia, plus frame-only links ``<name>_connector`` and ``<name>_sensor`` /
``<name>_actuator`` (and ``<name>_<port id>`` on a board) on fixed joints, the
ROS way of publishing frames.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import TYPE_CHECKING
from xml.sax.saxutils import escape, quoteattr

from atech import __version__
from atech.sim.geometry import Quat, Vec3
from atech.sim.model import mass_properties
from atech.sim.spec import Frame, SimSpec, load_board_sim, load_module_sim

if TYPE_CHECKING:
    from atech.sim.meshes import CadVisual


def _num(v: float) -> str:
    text = f"{v:.9g}"
    return "0" if text == "-0" else text


def _vec(v: Sequence[float]) -> str:
    return " ".join(_num(c) for c in v)


def quat_to_rpy(q: Quat) -> Vec3:
    """Inverse of the URDF rpy convention, radians."""
    w, x, y, z = q
    roll = math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
    sinp = max(-1.0, min(1.0, 2 * (w * y - z * x)))
    pitch = math.asin(sinp)
    yaw = math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    return (roll, pitch, yaw)


def _origin(pos: Vec3, rpy_rad: Vec3 = (0.0, 0.0, 0.0)) -> str:
    return f"<origin xyz=\"{_vec(pos)}\" rpy=\"{_vec(rpy_rad)}\"/>"


def _frame_link(parent: str, child: str, frame: Frame, pad: str) -> list[str]:
    rpy = tuple(math.radians(a) for a in frame.rpy_deg)
    return [
        f"{pad}<link name={quoteattr(child)}/>",
        f"{pad}<joint name={quoteattr(child + '_joint')} type=\"fixed\">",
        f"{pad}  <parent link={quoteattr(parent)}/>",
        f"{pad}  <child link={quoteattr(child)}/>",
        f"{pad}  {_origin(frame.pos_m, rpy)}",  # type: ignore[arg-type]
        f"{pad}</joint>",
    ]


def spec_urdf_link(
    spec: SimSpec,
    name: str,
    *,
    parent: str | None = None,
    pos: Vec3 = (0.0, 0.0, 0.0),
    quat: Quat = (1.0, 0.0, 0.0, 0.0),
    rgba: Sequence[float] | None = None,
    indent: str = "  ",
    cad: CadVisual | None = None,
    mesh_dir: str = "",
) -> str:
    """Links and fixed joints to paste inside a ``<robot>``.

    With ``parent``, adds a fixed joint ``<name>_mount`` placing the asset frame at
    ``pos`` / ``quat`` in ``parent``. With ``cad``, the visuals are its meshes
    (``<mesh_dir>/<material>.stl``) and the boxes stay as the collisions.
    """
    if not name or any(c.isspace() for c in name):
        raise ValueError(f"URDF name must be non-empty with no spaces: {name!r}")
    pad = indent
    mp = mass_properties(spec)
    (ixx, ixy, ixz), (_, iyy, iyz), (_, _, izz) = mp.inertia_kgm2
    lines = [
        (
            f"{pad}<!-- Atech {spec.kind} {escape(spec.id)} ({escape(spec.name)}); atech {__version__}."
            f" Placeholder fields: {escape(', '.join(spec.placeholders) or 'none')}. -->"
        ),
        f"{pad}<link name={quoteattr(name)}>",
        f"{pad}  <inertial>",
        f"{pad}    {_origin(mp.com_m)}",
        f"{pad}    <mass value=\"{_num(mp.mass_kg)}\"/>",
        (
            f"{pad}    <inertia ixx=\"{_num(ixx)}\" ixy=\"{_num(ixy)}\" ixz=\"{_num(ixz)}\" "
            f"iyy=\"{_num(iyy)}\" iyz=\"{_num(iyz)}\" izz=\"{_num(izz)}\"/>"
        ),
        f"{pad}  </inertial>",
    ]
    if cad is not None:
        base = mesh_dir.rstrip("/")
        for mp in cad.parts:
            lines += [
                f"{pad}  <visual name={quoteattr(f'{name}_{mp.name}_cad_visual')}>",
                f"{pad}    {_origin((0.0, 0.0, 0.0))}",
                f"{pad}    <geometry><mesh filename={quoteattr(f'{base}/{mp.name}.stl')}/></geometry>",
                (
                    f"{pad}    <material name={quoteattr(f'{name}_{mp.name}_cad_material')}>"
                    f"<color rgba=\"{_vec(mp.rgba_srgb)}\"/></material>"
                ),
                f"{pad}  </visual>",
            ]
    for part in spec.parts:
        colour = rgba if (rgba is not None and part.name == "body") else spec.colors[part.color]
        material = f"{name}_{part.name}_material"
        if cad is None:
            lines += [
                f"{pad}  <visual name={quoteattr(f'{name}_{part.name}_visual')}>",
                f"{pad}    {_origin(part.pos_m)}",
                f"{pad}    <geometry><box size=\"{_vec(part.size_m)}\"/></geometry>",
                f"{pad}    <material name={quoteattr(material)}><color rgba=\"{_vec(colour)}\"/></material>",
                f"{pad}  </visual>",
            ]
        lines += [
            f"{pad}  <collision name={quoteattr(f'{name}_{part.name}_collision')}>",
            f"{pad}    {_origin(part.pos_m)}",
            f"{pad}    <geometry><box size=\"{_vec(part.size_m)}\"/></geometry>",
            f"{pad}  </collision>",
        ]
    lines.append(f"{pad}</link>")
    lines += _frame_link(name, f"{name}_connector", spec.connector, pad)
    for role, block in (("sensor", spec.sensor), ("actuator", spec.actuator)):
        if block is not None:
            lines += _frame_link(name, f"{name}_{role}", block.frame, pad)
    for pf in spec.ports:
        lines += _frame_link(name, f"{name}_{pf.port_id}", pf.frame, pad)
    if parent:
        lines += [
            f"{pad}<joint name={quoteattr(name + '_mount')} type=\"fixed\">",
            f"{pad}  <parent link={quoteattr(parent)}/>",
            f"{pad}  <child link={quoteattr(name)}/>",
            f"{pad}  {_origin(pos, quat_to_rpy(quat))}",
            f"{pad}</joint>",
        ]
    return "\n".join(lines)


def module_urdf_link(
    module_id: str,
    name: str,
    *,
    parent: str | None = None,
    pos: Vec3 = (0.0, 0.0, 0.0),
    quat: Quat = (1.0, 0.0, 0.0, 0.0),
    rgba: Sequence[float] | None = None,
) -> str:
    """URDF links/joints for a catalog module, to paste inside a ``<robot>``."""
    return spec_urdf_link(load_module_sim(module_id), name, parent=parent, pos=pos, quat=quat, rgba=rgba)


def board_urdf_link(board_id: str, name: str, *, parent: str | None = None,
                    pos: Vec3 = (0.0, 0.0, 0.0), quat: Quat = (1.0, 0.0, 0.0, 0.0)) -> str:
    return spec_urdf_link(load_board_sim(board_id), name, parent=parent, pos=pos, quat=quat)


def spec_urdf(spec: SimSpec, *, cad: CadVisual | None = None, mesh_dir: str = "") -> str:
    """A standalone ``.urdf`` whose root link is the asset (mesh paths relative to it)."""
    source = ""
    if cad is not None:
        label = escape(cad.source).replace("--", "- -")
        source = f"<!-- Visual meshes: {label} (sha256 {cad.sha256}). -->\n"
    return (
        "<?xml version=\"1.0\"?>\n"
        f"{source}"
        f"<robot name={quoteattr(spec.asset_name)}>\n"
        f"{spec_urdf_link(spec, spec.asset_name, cad=cad, mesh_dir=mesh_dir)}\n"
        "</robot>\n"
    )
