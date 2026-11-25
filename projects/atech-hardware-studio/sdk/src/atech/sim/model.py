"""Derived physical quantities shared by every exporter."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from atech.sim.geometry import (
    Mat3,
    Quat,
    Vec3,
    compose,
    composite_inertia,
    invert,
    matrix_to_quat,
    principal_axes,
    quat_rotate,
)
from atech.sim.spec import SimSpec


@dataclass(frozen=True)
class MassProperties:
    mass_kg: float
    com_m: Vec3
    inertia_kgm2: Mat3  # about the COM, asset axes
    principal_moments_kgm2: Vec3
    principal_axes_quat: Quat  # rotation from the asset axes to the principal axes


def mass_properties(spec: SimSpec) -> MassProperties:
    """Uniform density over the parts; the total is ``spec.mass_kg``."""
    mass, com, tensor = composite_inertia(
        (spec.part_mass_kg(p), p.size_m, p.pos_m) for p in spec.parts
    )
    moments, axes = principal_axes(tensor)
    return MassProperties(mass, com, tensor, moments, axes)


def module_pose_on_board(
    board: SimSpec, ports: Sequence[int | str], module: SimSpec
) -> tuple[Vec3, Quat]:
    """Pose of a module's asset frame in the board's asset frame.

    One port: the module's connector frame coincides with the port frame. Two
    ports (a double-width module): the connector goes to the midpoint of the two
    port frames, +z out of the face, +x along the pair. +x points so that the
    module's +y (its outer face) agrees with the port frames' +y; when the port
    frames' +y is across the pair (no preference), from the lower-numbered port
    to the higher-numbered one.
    """
    if board.kind != "board" or module.kind != "module":
        raise ValueError("module_pose_on_board(board_spec, ports, module_spec)")
    if len(ports) != module.size_ports:
        raise ValueError(
            f"{module.id} spans {module.size_ports} port(s); got {len(ports)}: {list(ports)}"
        )
    _check_ports(board, [p if isinstance(p, str) else f"port_{p}" for p in ports])
    frames = sorted((board.port(p) for p in ports), key=lambda p: _num(p.port_id))
    if len({f.face for f in frames}) != 1:
        raise ValueError("a double-width module cannot span two faces of the board")
    first = frames[0].frame
    if len(frames) == 1:
        port_pos, port_quat = first.pos_m, first.quat_wxyz
    else:
        a, b = frames[0].frame.pos_m, frames[1].frame.pos_m
        port_pos = tuple((a[i] + b[i]) / 2.0 for i in range(3))
        z = quat_rotate(first.quat_wxyz, (0.0, 0.0, 1.0))
        d = tuple(b[i] - a[i] for i in range(3))
        dz = sum(d[i] * z[i] for i in range(3))
        x = tuple(d[i] - dz * z[i] for i in range(3))
        n = sum(c * c for c in x) ** 0.5
        if n == 0.0:
            raise ValueError("the two port frames coincide")
        x = tuple(c / n for c in x)
        y = (z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0])
        port_y = quat_rotate(first.quat_wxyz, (0.0, 1.0, 0.0))
        if sum(y[i] * port_y[i] for i in range(3)) < -1e-6:  # outer face would point the wrong way
            x = tuple(-c for c in x)
            y = tuple(-c for c in y)
        rot = ((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))
        port_quat = matrix_to_quat(rot)
    inv_pos, inv_quat = invert(module.connector.pos_m, module.connector.quat_wxyz)
    return compose(port_pos, port_quat, inv_pos, inv_quat)  # type: ignore[arg-type]


def _check_ports(board: SimSpec, port_ids: list[str]) -> None:
    """The same rules as placement: no reserved port, a pair must be adjacent."""
    from atech.catalog import get_board

    catalog_board = get_board(board.id)
    for pid in port_ids:
        if pid not in catalog_board.port_ids:
            raise ValueError(f"board {board.id!r} has no port {pid!r}")
        if pid in catalog_board.reserved:
            raise ValueError(f"{pid} on board {board.id!r} is reserved (USB-C / Reset)")
    if len(port_ids) == 2 and not catalog_board.is_adjacent(port_ids[0], port_ids[1]):
        raise ValueError(
            f"{port_ids[0]} and {port_ids[1]} are not an adjacent pair on board {board.id!r} "
            f"(pairs: {catalog_board.adjacent_port_pairs})"
        )


def _num(port_id: str) -> int:
    tail = port_id.rsplit("_", 1)[-1]
    return int(tail) if tail.isdigit() else 0
