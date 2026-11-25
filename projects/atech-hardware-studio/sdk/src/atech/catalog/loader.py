"""Load boards and modules from the bundled catalog directory.

The catalog lives at ``atech/catalog/data/`` inside the installed package.
Boards are single YAML files; modules are folders containing ``module.yaml``
plus the driver source files. The loader caches results in-process.
"""

from __future__ import annotations

from functools import lru_cache
from importlib import resources
try:
    from importlib.resources.abc import Traversable
except ImportError:  # Python 3.10
    from importlib.abc import Traversable
from pathlib import Path
from typing import Iterator, Optional, Union

import yaml

from atech.catalog.models import BoardSpec, ModuleSpec

_DATA_PKG = "atech.catalog.data"


def _data_root() -> Traversable:
    return resources.files(_DATA_PKG)


# --------------------------------------------------------------------- boards


@lru_cache(maxsize=None)
def load_boards() -> dict[str, BoardSpec]:
    """Return every bundled board, keyed by ``BoardSpec.id``."""
    boards: dict[str, BoardSpec] = {}
    boards_dir = _data_root() / "boards"
    for entry in boards_dir.iterdir():
        if not entry.name.endswith(".yaml"):
            continue
        raw = entry.read_text(encoding="utf-8")
        data = yaml.safe_load(raw) or {}
        spec = BoardSpec.model_validate(data)
        boards[spec.id] = spec
    return boards


def get_board(board_id: str) -> BoardSpec:
    """Look up one board by id."""
    boards = load_boards()
    try:
        return boards[board_id]
    except KeyError:
        available = ", ".join(sorted(boards)) or "(none)"
        raise KeyError(
            f"board {board_id!r} not in catalog. Available: {available}"
        ) from None


def list_boards() -> list[BoardSpec]:
    """All bundled boards, sorted by id."""
    return [load_boards()[b] for b in sorted(load_boards())]


# -------------------------------------------------------------------- modules


@lru_cache(maxsize=None)
def load_modules() -> dict[str, ModuleSpec]:
    """Return every bundled module, keyed by ``ModuleSpec.id``."""
    modules: dict[str, ModuleSpec] = {}
    modules_dir = _data_root() / "modules"
    for entry in modules_dir.iterdir():
        if not entry.is_dir():
            continue
        manifest = entry / "module.yaml"
        if not manifest.is_file():
            continue
        data = yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}
        spec = ModuleSpec.model_validate(data)
        modules[spec.id] = spec
    return modules


def get_module(module_id: str) -> ModuleSpec:
    modules = load_modules()
    try:
        return modules[module_id]
    except KeyError:
        available = ", ".join(sorted(modules)) or "(none)"
        raise KeyError(
            f"module {module_id!r} not in catalog. Available: {available}"
        ) from None


def list_modules(category: Optional[str] = None) -> list[ModuleSpec]:
    """All bundled modules, optionally filtered by category."""
    modules = load_modules()
    out = [modules[m] for m in sorted(modules)]
    if category:
        out = [m for m in out if m.category == category]
    return out


def module_dir(module_id: str) -> Traversable:
    """Path to the bundled module's folder (driver source lives here)."""
    return _data_root() / "modules" / module_id


def iter_shared_driver_files() -> Iterator[tuple[str, bytes]]:
    """Yield ``(filename, bytes)`` for the shared drivers (the I2C buses).

    One copy per project, in its own library, so two modules that use
    ``SoftwareI2C`` do not link it twice. Modules name the headers they need
    in ``driver.shared``.
    """
    for entry in (_data_root() / "drivers").iterdir():
        if entry.is_file():
            yield entry.name, entry.read_bytes()


def iter_shared_helper_files() -> Iterator[tuple[str, bytes]]:
    """Yield ``(filename, bytes)`` for studio's helpers, copied into every project.

    ``atech_helpers.h`` and ``atech_ui.h`` are included by every generated
    ``main.cpp``. The rest are what the drivers include: ``atech_gestures.*`` and
    ``atech_tap_classifier.h`` (button and knob taps), ``atech_spi_hosts.h`` and
    ``atech_soft_spi.h`` (the SPI bus of the screens and the microSD card),
    ``atech_paths.h`` (the card's folder paths). They sit in one library so
    ``atech_gestures.cpp`` links once, however many modules use it."""
    for entry in (_data_root() / "shared").iterdir():
        if entry.is_file():
            yield entry.name, entry.read_bytes()


def iter_module_files(
    module_id: str,
    *,
    extra_paths: Optional[list[Path]] = None,
) -> Iterator[tuple[str, bytes]]:
    """Yield ``(filename, bytes)`` for every file in the module's folder.

    Looks in ``extra_paths`` first (external/user-authored modules), then
    falls back to the bundled catalog. Used by codegen to copy driver
    source into the generated PlatformIO project.
    """
    for root in (extra_paths or []):
        folder = root / module_id
        if folder.is_dir():
            for entry in folder.iterdir():
                if entry.is_file():
                    yield entry.name, entry.read_bytes()
            return

    bundled = module_dir(module_id)
    if not bundled.is_dir():
        raise FileNotFoundError(f"no folder for module {module_id!r}")
    for entry in bundled.iterdir():
        if entry.is_file():
            yield entry.name, entry.read_bytes()


def load_modules_from(path: Union[str, Path]) -> dict[str, ModuleSpec]:
    """Load every ``<id>/module.yaml`` in an external directory.

    Returns a dict keyed by module id. The on-disk shape is identical to
    the bundled ``catalog/data/modules/`` tree: one folder per module,
    containing a ``module.yaml`` plus the driver ``.h`` / ``.cpp`` files.
    """
    root = Path(path).expanduser().resolve()
    if not root.is_dir():
        raise FileNotFoundError(f"no module directory at {root}")
    out: dict[str, ModuleSpec] = {}
    for entry in sorted(root.iterdir()):
        if not entry.is_dir():
            continue
        manifest = entry / "module.yaml"
        if not manifest.is_file():
            continue
        try:
            data = yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            mark = getattr(exc, "problem_mark", None)
            location = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
            problem = getattr(exc, "problem", None) or "parse error"
            raise ValueError(f"invalid module YAML in {manifest}{location}: {problem}") from None
        spec = ModuleSpec.model_validate(data)
        out[spec.id] = spec
    return out
