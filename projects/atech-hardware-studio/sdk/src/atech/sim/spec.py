"""Physical data of Atech modules and boards, read from ``sim.yaml`` files.

A module's ``sim.yaml`` sits next to its ``module.yaml`` in the catalog. A board's
lives in ``catalog/data/boards/sim/<board id>.sim.yaml`` (a sub-folder, because the
board loader reads every ``*.yaml`` directly in ``boards/`` as a board).

Frames (every exporter uses the same ones):

- **Asset frame**: metres, +z out of the top face, +x along the long side. Its
  origin is the centre of the bottom (mounting) face. Every ``pos_m`` in a
  ``sim.yaml`` is in this frame.
- **Connector frame**: where the module plugs in. A module is placed on a board
  port by making its connector frame coincide with the board's port frame.
- **Sensor / actuator frame**: for a ranging sensor +z is the boresight.

Rotations are ``rpy_deg``: roll about x, then pitch about y, then yaw about z,
all about the fixed parent axes (the URDF convention).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path
from typing import Any, Literal

import yaml

from atech.catalog import get_board, get_module, load_modules_from, module_dir
from atech.sim.geometry import Quat, Vec3, quat_from_rpy_deg

AssetKind = Literal["module", "board"]

SCHEMA_VERSION = 1
_RGBA_LEN = 4
# Names that become USD prim / attribute names, MJCF and URDF names: an identifier.
_IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
_PART_NAME = re.compile(r"[a-z][a-z0-9_]*")
# USD ``int`` attributes are 32-bit signed.
_INT32_MIN, _INT32_MAX = -(2**31), 2**31 - 1


class SimSpecError(ValueError):
    """A ``sim.yaml`` is missing or malformed."""


@dataclass(frozen=True)
class Frame:
    """A pose in the asset frame."""

    pos_m: Vec3 = (0.0, 0.0, 0.0)
    rpy_deg: Vec3 = (0.0, 0.0, 0.0)

    @property
    def quat_wxyz(self) -> Quat:
        return quat_from_rpy_deg(self.rpy_deg)


@dataclass(frozen=True)
class BoxPart:
    """One axis-aligned box of the asset's geometry (visual and collider)."""

    name: str
    size_m: Vec3
    pos_m: Vec3  # centre of the box, asset frame
    color: str  # key into SimSpec.colors
    #: how a derived visual draws the part inside its box (``PART_SHAPES``); the
    #: collider is always the box
    shape: str = "box"

    @property
    def volume_m3(self) -> float:
        return self.size_m[0] * self.size_m[1] * self.size_m[2]


@dataclass(frozen=True)
class DeviceBlock:
    """A ``sensor:`` or ``actuator:`` block: type, frame and free parameters."""

    type: str
    frame: Frame
    chip: str | None = None
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PortFrame:
    """Where a module's connector frame goes on a board (board asset frame)."""

    port_id: str
    frame: Frame
    face: Literal["top", "bottom"] = "top"


@dataclass(frozen=True)
class PhysicsMaterial:
    static_friction: float
    dynamic_friction: float
    restitution: float


@dataclass(frozen=True)
class SimSpec:
    """Everything the exporters need about one module or board."""

    kind: AssetKind
    id: str
    name: str
    asset_name: str  # prim / file / MJCF name stem, e.g. "atech_distance_sensor"
    category: str  # module category, or "board"
    interface: str | None
    size_ports: int
    i2c_address: int | None
    mass_kg: float
    colors: dict[str, tuple[float, float, float, float]]
    parts: tuple[BoxPart, ...]
    connector: Frame
    physics_material: PhysicsMaterial
    sensor: DeviceBlock | None = None
    actuator: DeviceBlock | None = None
    ports: tuple[PortFrame, ...] = ()
    semantic_qcodes: tuple[str, ...] = ()
    semantic_classes: tuple[str, ...] = ()
    placeholders: tuple[str, ...] = ()
    source_file: str = ""

    @property
    def body(self) -> BoxPart:
        return self.parts[0]

    @property
    def total_volume_m3(self) -> float:
        return sum(p.volume_m3 for p in self.parts)

    def part_mass_kg(self, part: BoxPart) -> float:
        """Mass is spread over the parts by volume (uniform density)."""
        return self.mass_kg * part.volume_m3 / self.total_volume_m3

    def port(self, port: str | int) -> PortFrame:
        pid = port if isinstance(port, str) else f"port_{port}"
        for p in self.ports:
            if p.port_id == pid:
                return p
        raise KeyError(f"board {self.id!r} has no port frame {pid!r}")


# ---------------------------------------------------------------- parsing


def _vec3(raw: Any, where: str) -> Vec3:
    if not isinstance(raw, (list, tuple)) or len(raw) != 3:
        raise SimSpecError(f"{where}: expected a list of 3 numbers, got {raw!r}")
    try:
        x, y, z = (float(v) for v in raw)
    except (TypeError, ValueError):
        raise SimSpecError(f"{where}: expected numbers, got {raw!r}") from None
    if not all(math.isfinite(v) for v in (x, y, z)):
        raise SimSpecError(f"{where}: numbers must be finite, got {raw!r}")
    return (x, y, z)


def _check_identifier(name: str, where: str) -> str:
    if not _IDENTIFIER.fullmatch(name):
        raise SimSpecError(
            f"{where}: {name!r} must be an identifier (letters, digits, '_'; not starting "
            "with a digit): it becomes a USD prim/attribute name"
        )
    return name


def _frame(raw: Any, where: str) -> Frame:
    raw = raw or {}
    if not isinstance(raw, dict):
        raise SimSpecError(f"{where}: expected a mapping with pos_m / rpy_deg")
    return Frame(
        pos_m=_vec3(raw.get("pos_m", [0, 0, 0]), f"{where}.pos_m"),
        rpy_deg=_vec3(raw.get("rpy_deg", [0, 0, 0]), f"{where}.rpy_deg"),
    )


def _positive(raw: Any, where: str) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise SimSpecError(f"{where}: expected a number, got {raw!r}") from None
    if not math.isfinite(value) or value <= 0:
        raise SimSpecError(f"{where}: must be a finite number > 0, got {value}")
    return value


def _colors(raw: Any, where: str) -> dict[str, tuple[float, float, float, float]]:
    if not isinstance(raw, dict) or "body" not in raw:
        raise SimSpecError(f"{where}.colors: needs at least a 'body' colour")
    out: dict[str, tuple[float, float, float, float]] = {}
    for key, value in raw.items():
        if not isinstance(value, (list, tuple)) or len(value) != _RGBA_LEN:
            raise SimSpecError(f"{where}.colors.{key}: expected [r, g, b, a] in 0..1")
        try:
            rgba = tuple(float(v) for v in value)
        except (TypeError, ValueError):
            raise SimSpecError(f"{where}.colors.{key}: expected numbers, got {value!r}") from None
        if not all(0.0 <= c <= 1.0 for c in rgba):  # also rejects NaN
            raise SimSpecError(f"{where}.colors.{key}: components must be in 0..1")
        out[_check_identifier(str(key), f"{where}.colors")] = rgba  # type: ignore[assignment]
    return out


def _device(raw: Any, where: str) -> DeviceBlock | None:
    if raw is None:
        return None
    if not isinstance(raw, dict) or "type" not in raw:
        raise SimSpecError(f"{where}: needs a 'type'")
    params = {k: v for k, v in raw.items() if k not in ("type", "frame", "chip")}
    _check_identifier(str(raw["type"]), f"{where}.type")
    for key, value in params.items():
        _check_identifier(str(key), f"{where}")
        if not _is_param_value(value):
            raise SimSpecError(
                f"{where}.{key}: parameters must be a number, a string, a bool, or a "
                f"flat list of numbers or strings (finite; ints within 32 bits); got {value!r}"
            )
    chip = raw.get("chip")
    return DeviceBlock(
        type=str(raw["type"]),
        frame=_frame(raw.get("frame"), f"{where}.frame"),
        chip=str(chip) if chip is not None else None,
        params=params,
    )


def _is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return _INT32_MIN <= value <= _INT32_MAX
    return isinstance(value, float) and math.isfinite(value)


def _is_param_value(value: Any) -> bool:
    if isinstance(value, (bool, str)) or _is_number(value):
        return True
    if isinstance(value, list) and value:
        if all(_is_number(v) for v in value):
            return True
        return all(isinstance(v, str) for v in value)
    return False


#: ``shape:`` of a sim.yaml part: each fills the part's box (``atech.sim.derived``)
PART_SHAPES = ("box", "rounded_box", "rounded_end", "cylinder", "cylinder_x", "dome", "chamfered_box")


def _parts(raw: dict, colors: dict, where: str) -> tuple[BoxPart, ...]:
    size = _vec3(raw.get("size_m"), f"{where}.size_m")
    if any(s <= 0 for s in size):
        raise SimSpecError(f"{where}.size_m: every dimension must be > 0")
    parts = [BoxPart("body", size, (0.0, 0.0, size[2] / 2.0), "body")]
    for i, entry in enumerate(raw.get("parts") or []):
        pw = f"{where}.parts[{i}]"
        if not isinstance(entry, dict) or "name" not in entry:
            raise SimSpecError(f"{pw}: needs name, size_m, pos_m, color")
        name = str(entry["name"])
        if not _PART_NAME.fullmatch(name) or name == "body":
            raise SimSpecError(
                f"{pw}.name: lowercase snake_case starting with a letter, not 'body' (got {name!r})"
            )
        psize = _vec3(entry.get("size_m"), f"{pw}.size_m")
        if any(s <= 0 for s in psize):
            raise SimSpecError(f"{pw}.size_m: every dimension must be > 0")
        color = str(entry.get("color", "body"))
        if color not in colors:
            raise SimSpecError(f"{pw}.color: {color!r} is not in colors")
        shape = str(entry.get("shape", "dome" if "dome" in name else "box"))
        if shape not in PART_SHAPES:
            raise SimSpecError(f"{pw}.shape: one of {', '.join(PART_SHAPES)} (got {shape!r})")
        parts.append(BoxPart(name, psize, _vec3(entry.get("pos_m"), f"{pw}.pos_m"), color, shape))
    names = [p.name for p in parts]
    if len(set(names)) != len(names):
        raise SimSpecError(f"{where}.parts: duplicate part names {names}")
    return tuple(parts)


def _physics_material(raw: Any, where: str) -> PhysicsMaterial:
    raw = raw or {}
    if not isinstance(raw, dict):
        raise SimSpecError(f"{where}.physics_material: expected a mapping")
    try:
        material = PhysicsMaterial(
            static_friction=float(raw.get("static_friction", 0.5)),
            dynamic_friction=float(raw.get("dynamic_friction", 0.4)),
            restitution=float(raw.get("restitution", 0.1)),
        )
    except (TypeError, ValueError):
        raise SimSpecError(f"{where}.physics_material: expected numbers") from None
    if not (math.isfinite(material.static_friction) and material.static_friction >= 0.0):
        raise SimSpecError(f"{where}.physics_material.static_friction: must be >= 0")
    if not (math.isfinite(material.dynamic_friction) and material.dynamic_friction >= 0.0):
        raise SimSpecError(f"{where}.physics_material.dynamic_friction: must be >= 0")
    if not 0.0 <= material.restitution <= 1.0:
        raise SimSpecError(f"{where}.physics_material.restitution: must be in 0..1")
    return material


def _placeholders(raw: dict, where: str) -> tuple[str, ...]:
    entries = raw.get("placeholders") or []
    if not isinstance(entries, list) or not all(isinstance(e, str) for e in entries):
        raise SimSpecError(f"{where}.placeholders: expected a list of field paths")
    for path in entries:
        node: Any = raw
        for key in path.split("."):
            if not isinstance(node, dict) or key not in node:
                raise SimSpecError(f"{where}.placeholders: {path!r} names no field in the file")
            node = node[key]
    return tuple(entries)


def _semantics(raw: Any, where: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    raw = raw or {}
    if not isinstance(raw, dict):
        raise SimSpecError(f"{where}.semantic: expected a mapping")
    qcodes = tuple(str(q) for q in raw.get("wikidata_qcode") or [])
    for q in qcodes:
        if not (q.startswith("Q") and q[1:].isdigit()):
            raise SimSpecError(f"{where}.semantic.wikidata_qcode: {q!r} is not a Q-code")
    classes = tuple(str(c) for c in raw.get("class") or [])
    return qcodes, classes


def _load_yaml(text: str, where: str) -> dict:
    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        raise SimSpecError(f"{where}: not valid YAML: {exc}") from None
    if not isinstance(data, dict):
        raise SimSpecError(f"{where}: top level must be a mapping")
    if data.get("schema") != SCHEMA_VERSION:
        raise SimSpecError(f"{where}: schema must be {SCHEMA_VERSION}")
    return data


_ASSET_NAME = re.compile(r"atech_[a-z][a-z0-9_]*")


def _asset_name(raw: Any, module_id: str, where: str) -> str:
    """``atech_<module id>``, or the product's own name from ``asset_name:`` (the
    robot-arm module is sold as the Robot Arm Integrator)."""
    if raw is None:
        return f"atech_{module_id}"
    if not isinstance(raw, str) or not _ASSET_NAME.fullmatch(raw):
        raise SimSpecError(f"{where}.asset_name: atech_ then lowercase snake_case (got {raw!r})")
    return raw


def _common(data: dict, where: str) -> dict[str, Any]:
    colors = _colors(data.get("colors"), where)
    qcodes, classes = _semantics(data.get("semantic"), where)
    return {
        "mass_kg": _positive(data.get("mass_kg"), f"{where}.mass_kg"),
        "colors": colors,
        "parts": _parts(data, colors, where),
        "connector": _frame(data.get("connector"), f"{where}.connector"),
        "physics_material": _physics_material(data.get("physics_material"), where),
        "semantic_qcodes": qcodes,
        "semantic_classes": classes,
        "placeholders": _placeholders(data, where),
    }


# ----------------------------------------------------------------- public


@dataclass(frozen=True)
class Product:
    """An Atech product with simulation data but no firmware in the SDK: a power
    module, or a module the SDK has no driver for yet. ``atech sim-assets`` exports it;
    ``project.yaml`` cannot place it. Its catalog facts are the ``product:`` block of
    its ``catalog/data/products/<id>/sim.yaml``."""

    id: str
    name: str
    category: str
    interface: str | None
    size: int
    i2c_address: int | None


def product_sim_path(product_id: str) -> Path:
    return Path(str(resources.files("atech.catalog.data") / "products" / product_id / "sim.yaml"))


def product_ids() -> list[str]:
    """Products (``Product``) that have a ``sim.yaml``."""
    root = Path(str(resources.files("atech.catalog.data") / "products"))
    return sorted(d.name for d in root.iterdir() if (d / "sim.yaml").is_file()) if root.is_dir() else []


def load_product(product_id: str) -> Product | None:
    path = product_sim_path(product_id)
    if not path.is_file():
        return None
    where = f"products/{product_id}/sim.yaml"
    raw = _load_yaml(path.read_text(encoding="utf-8"), where).get("product")
    if not isinstance(raw, dict) or not raw.get("name") or not raw.get("category"):
        raise SimSpecError(f"{where}.product: needs name, category, size (ports), interface")
    size = raw.get("size", 1)
    if size not in (1, 2):
        raise SimSpecError(f"{where}.product.size: 1 or 2 ports (got {size!r})")
    address = raw.get("i2c_address")
    if address is not None and not isinstance(address, int):
        raise SimSpecError(f"{where}.product.i2c_address: an integer (got {address!r})")
    return Product(product_id, str(raw["name"]), str(raw["category"]), raw.get("interface"), size, address)


def module_sim_path(module_id: str, modules_path: Path | None = None) -> Path:
    """Where a module's ``sim.yaml`` lives (custom modules folder first, then the
    catalog, then the sim-only products)."""
    if modules_path is not None:
        custom = Path(modules_path) / module_id / "sim.yaml"
        if custom.is_file():
            return custom
    bundled = Path(str(module_dir(module_id) / "sim.yaml"))
    if not bundled.is_file() and product_sim_path(module_id).is_file():
        return product_sim_path(module_id)
    return bundled


def board_sim_path(board_id: str) -> Path:
    root = resources.files("atech.catalog.data") / "boards" / "sim" / f"{board_id}.sim.yaml"
    return Path(str(root))


def load_module_sim(module_id: str, modules_path: Path | None = None) -> SimSpec:
    """Read and check one module's ``sim.yaml``; catalog facts come from ``module.yaml``."""
    module = None
    if modules_path is not None:
        module = load_modules_from(modules_path).get(module_id)
    if module is None:
        try:
            module = get_module(module_id)
        except KeyError:
            module = load_product(module_id)
            if module is None:
                raise
    _check_identifier(module.id, f"module id {module.id!r}")
    path = module_sim_path(module_id, modules_path)
    if not path.is_file():
        looked = [str(path)]
        if modules_path is not None:
            looked.insert(0, str(Path(modules_path) / module_id / "sim.yaml"))
        raise SimSpecError(
            f"module {module_id!r} has no sim.yaml (looked at {', '.join(looked)}); "
            "it cannot be exported yet"
        )
    where = f"{module_id}/sim.yaml"
    data = _load_yaml(path.read_text(encoding="utf-8"), where)
    common = _common(data, where)
    sensor = _device(data.get("sensor"), f"{where}.sensor")
    actuator = _device(data.get("actuator"), f"{where}.actuator")
    if data.get("ports"):
        raise SimSpecError(f"{where}: 'ports' is for boards only")
    return SimSpec(
        kind="module",
        id=module.id,
        name=module.name,
        asset_name=_asset_name(data.get("asset_name"), module.id, where),
        category=module.category,
        interface=module.interface,
        size_ports=module.size,
        i2c_address=module.i2c_address,
        sensor=sensor,
        actuator=actuator,
        source_file=(
            f"atech/catalog/data/modules/{module_id}/sim.yaml"
            if path == module_sim_path(module_id)
            else str(path)
        ),
        **common,
    )


def load_board_sim(board_id: str) -> SimSpec:
    """Read and check one board's ``sim.yaml``; port ids come from the board YAML."""
    board = get_board(board_id)
    path = board_sim_path(board_id)
    if not path.is_file():
        raise SimSpecError(f"board {board_id!r} has no sim.yaml (looked at {path})")
    where = f"boards/sim/{board_id}.sim.yaml"
    data = _load_yaml(path.read_text(encoding="utf-8"), where)
    common = _common(data, where)
    raw_ports = data.get("ports") or {}
    if not isinstance(raw_ports, dict):
        raise SimSpecError(f"{where}.ports: expected a mapping port id -> frame")
    known = set(board.port_ids) | set(board.reserved)
    ports: list[PortFrame] = []
    for pid, raw in raw_ports.items():
        if pid not in known:
            raise SimSpecError(f"{where}.ports.{pid}: not a port of board {board_id!r}")
        if raw is not None and not isinstance(raw, dict):
            raise SimSpecError(f"{where}.ports.{pid}: expected a mapping with pos_m / rpy_deg / face")
        face = (raw or {}).get("face", "top")
        if face not in ("top", "bottom"):
            raise SimSpecError(f"{where}.ports.{pid}.face: 'top' or 'bottom'")
        ports.append(PortFrame(pid, _frame(raw, f"{where}.ports.{pid}"), face))
    usable = set(board.port_ids) - set(board.reserved)
    missing = sorted(usable - {p.port_id for p in ports})
    if missing:
        raise SimSpecError(f"{where}.ports: no frame for module port(s) {missing}")
    return SimSpec(
        kind="board",
        id=board.id,
        name=board.name,
        asset_name=f"atech_board_{board.id}",
        category="board",
        interface=None,
        size_ports=len(usable),
        i2c_address=None,
        ports=tuple(sorted(ports, key=lambda p: _port_number(p.port_id))),
        source_file=f"atech/catalog/data/boards/sim/{board_id}.sim.yaml",
        **common,
    )


def _port_number(port_id: str) -> int:
    tail = port_id.rsplit("_", 1)[-1]
    return int(tail) if tail.isdigit() else 0


def sim_module_ids() -> list[str]:
    """Catalog modules that have a ``sim.yaml``, then the sim-only products."""
    from atech.catalog import list_modules

    return [m.id for m in list_modules() if module_sim_path(m.id).is_file()] + product_ids()


def sim_board_ids() -> list[str]:
    from atech.catalog import list_boards

    return [b.id for b in list_boards() if board_sim_path(b.id).is_file()]
