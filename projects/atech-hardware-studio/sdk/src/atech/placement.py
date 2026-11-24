"""Placement validation: does this set of (module, port) assignments fit on the board?

Pure functions over typed specs — no I/O, no PlatformIO, no AI. Returns a list
of structured issues; an empty list means the placement is valid.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Sequence

from atech.catalog.models import BoardSpec, ModuleSpec

IssueKind = Literal[
    "unknown_port",
    "reserved_port",
    "overlap",
    "missing_secondary_port",
    "not_adjacent",
    "incompatible_interface",
    "unknown_module",
    "too_many",
    "wrong_port_count",
]


@dataclass(frozen=True)
class Placement:
    """One module placed on one (or two) ports of the board."""

    module_id: str
    instance: str
    ports: tuple[str, ...]   # ("port_3",) or ("port_3", "port_4") for size=2

    def __post_init__(self) -> None:
        if not self.ports:
            raise ValueError("placement requires at least one port")


@dataclass(frozen=True)
class PlacementIssue:
    """One thing wrong with a placement."""

    kind: IssueKind
    instance: str
    message: str
    ports: tuple[str, ...] = ()


def _normalize_port(port: str | int) -> str:
    if isinstance(port, bool) or not isinstance(port, (int, str)):
        raise ValueError("ports must be integer numbers or port-id strings")
    if isinstance(port, str) and not port.strip():
        raise ValueError("port ids must not be empty")
    return port if isinstance(port, str) else f"port_{port}"


def normalize_ports(ports: int | str | Sequence[int | str]) -> tuple[str, ...]:
    """Accept ``3`` / ``"port_3"`` / ``[3, 4]`` and return a canonical tuple."""
    if isinstance(ports, (int, str)):
        return (_normalize_port(ports),)
    if not isinstance(ports, Sequence) or isinstance(ports, (bytes, bytearray)):
        raise ValueError("ports must be a port number/id or a sequence of them")
    if not ports:
        raise ValueError("at least one port is required")
    return tuple(_normalize_port(p) for p in ports)


def _free_port_list(board: BoardSpec) -> str:
    reserved = set(board.reserved)
    return ", ".join(str(p.slot_number) for p in board.ports if p.id not in reserved and p.slot_number)


def _ports_with(board: BoardSpec, interface: str) -> str:
    reserved = set(board.reserved)
    return ", ".join(
        str(p.slot_number) for p in board.ports
        if p.id not in reserved and p.slot_number and interface in p.compatible_interfaces
    )


def validate(
    board: BoardSpec,
    placements: Sequence[Placement],
    modules: dict[str, ModuleSpec],
) -> list[PlacementIssue]:
    """Check every placement against the board's layout and the modules' specs.

    Returns a flat list of issues; empty list = valid.
    """
    issues: list[PlacementIssue] = []
    port_ids = set(board.port_ids)
    reserved = set(board.reserved)
    occupied: dict[str, str] = {}   # port_id -> instance that occupies it

    for p in placements:
        spec = modules.get(p.module_id)
        if spec is None:
            issues.append(PlacementIssue(
                kind="unknown_module",
                instance=p.instance,
                message=f"module {p.module_id!r} is not in the catalog",
                ports=p.ports,
            ))
            continue

        # Port existence + reserved checks. Reserved is checked first so the
        # user gets a useful message ("this is the USB-C jack") rather than
        # the generic "unknown port" — reserved positions are deliberately
        # absent from the addressable ports list.
        for port_id in p.ports:
            if port_id in reserved:
                issues.append(PlacementIssue(
                    kind="reserved_port",
                    instance=p.instance,
                    message=(
                        f"port {port_id!r} is reserved on board {board.id!r} "
                        "(it holds the USB-C module or the reset button). "
                        f"Ports that take modules: {_free_port_list(board)}"
                    ),
                    ports=(port_id,),
                ))
            elif port_id not in port_ids:
                issues.append(PlacementIssue(
                    kind="unknown_port",
                    instance=p.instance,
                    message=f"port {port_id!r} does not exist on board {board.id!r}",
                    ports=(port_id,),
                ))

        # Size vs. ports count
        if spec.size == 2 and len(p.ports) > 2:
            issues.append(PlacementIssue(
                kind="wrong_port_count",
                instance=p.instance,
                message=(
                    f"module {p.module_id!r} is double-width and requires exactly "
                    f"2 ports, but {len(p.ports)} were supplied"
                ),
                ports=p.ports,
            ))
        if spec.size == 2 and len(p.ports) < 2:
            issues.append(PlacementIssue(
                kind="missing_secondary_port",
                instance=p.instance,
                message=(
                    f"module {p.module_id!r} is double-width (size=2) but only "
                    f"{len(p.ports)} port supplied"
                ),
                ports=p.ports,
            ))
        if spec.size == 2 and len(p.ports) == 2:
            a, b = p.ports
            if not board.is_adjacent(a, b):
                issues.append(PlacementIssue(
                    kind="not_adjacent",
                    instance=p.instance,
                    message=(
                        f"ports {a!r} and {b!r} are not adjacent on board "
                        f"{board.id!r}; this module requires an adjacent pair"
                    ),
                    ports=p.ports,
                ))
        if spec.size == 1 and len(p.ports) > 1:
            issues.append(PlacementIssue(
                kind="overlap",
                instance=p.instance,
                message=(
                    f"module {p.module_id!r} is single-width but {len(p.ports)} "
                    f"ports were supplied"
                ),
                ports=p.ports,
            ))

        # Interface compatibility
        for port_id in p.ports:
            if port_id not in port_ids or port_id in reserved:
                continue
            port = board.port(port_id)
            compat = set(port.compatible_interfaces)
            # The port catalog distinguishes "digital" and "gpio" but modules
            # only declare "gpio"; treat them as the same family.
            if spec.interface == "gpio":
                compat |= {"gpio", "digital"}
            if spec.interface not in compat:
                issues.append(PlacementIssue(
                    kind="incompatible_interface",
                    instance=p.instance,
                    message=(
                        f"module {p.module_id!r} requires {spec.interface!r} "
                        f"but port {port_id!r} only supports "
                        f"{sorted(port.compatible_interfaces)}. "
                        f"Ports with {spec.interface!r} on {board.id!r}: "
                        f"{_ports_with(board, spec.interface) or 'none'}"
                    ),
                    ports=(port_id,),
                ))

        # Overlap against previously-placed modules
        for port_id in p.ports:
            prev = occupied.get(port_id)
            if prev is not None and prev != p.instance:
                issues.append(PlacementIssue(
                    kind="overlap",
                    instance=p.instance,
                    message=(
                        f"port {port_id!r} is already occupied by {prev!r}"
                    ),
                    ports=(port_id,),
                ))
            occupied[port_id] = p.instance

    # Modules the firmware can serve only once (or n times) per project
    placed: dict[str, list[Placement]] = {}
    for p in placements:
        placed.setdefault(p.module_id, []).append(p)
    for module_id, group in placed.items():
        spec = modules.get(module_id)
        limit = spec.max_per_project if spec else None
        if limit is not None and len(group) > limit:
            for extra in group[limit:]:
                issues.append(PlacementIssue(
                    kind="too_many",
                    instance=extra.instance,
                    message=(
                        f"a project takes at most {limit} {module_id} "
                        f"({', '.join(g.instance for g in group[:limit])} is placed already)"
                    ),
                    ports=extra.ports,
                ))

    return issues
