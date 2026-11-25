"""Atech SDK — open-source Python interface to Atech motherboards.

Two complementary halves:

* **Build** — assemble a project, validate placement, generate firmware,
  compile with PlatformIO, flash to a board. See :class:`Project`.
* **Runtime** — talk to a flashed board over USB serial. See
  :class:`atech.runtime.Board` (also re-exported as :class:`Board` here).
"""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version

from atech.build import BuildResult
from atech.catalog import (
    BoardSpec,
    ModuleSpec,
    get_board,
    get_module,
    list_boards,
    list_modules,
)
from atech.errors import (
    AtechError,
    BuildError,
    CatalogError,
    PlacementError,
    UploadError,
)
from atech.placement import Placement, PlacementIssue
from atech.project import Project, ProjectModule
from atech.runtime import (
    Action,
    ActionError,
    ActionRejected,
    Board,
    Event,
    MockTransport,
    NoAcknowledgement,
    NoBoardFoundError,
    PortUnavailableError,
    SerialTransport,
    discover_ports,
)
from atech.upload import UploadResult

# Single source of truth is `version` in pyproject.toml.
try:
    __version__ = _pkg_version("atech")
except PackageNotFoundError:  # running from a source tree without an install
    __version__ = "0.0.0+unknown"

__all__ = [
    # Build half
    "Project",
    "ProjectModule",
    "Placement",
    "PlacementIssue",
    "BoardSpec",
    "ModuleSpec",
    "BuildResult",
    "UploadResult",
    "list_boards",
    "list_modules",
    "get_board",
    "get_module",
    # Runtime half
    "Board",
    "Event",
    "Action",
    "SerialTransport",
    "MockTransport",
    "discover_ports",
    "NoBoardFoundError",
    "ActionError",
    "ActionRejected",
    "NoAcknowledgement",
    "PortUnavailableError",
    # Errors
    "AtechError",
    "BuildError",
    "CatalogError",
    "PlacementError",
    "UploadError",
    "__version__",
]
