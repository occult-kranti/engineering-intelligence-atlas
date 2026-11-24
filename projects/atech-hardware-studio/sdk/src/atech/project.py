"""High-level :class:`Project` — assemble modules on a board and produce firmware.

A Project is a small, deterministic description of a hardware build:

    Project(board="8port", name="thermo")
        .add("button", port=1)
        .add("neopixel", port=3)
        .validate()       # raise on bad placement
        .build()          # generate + compile via PlatformIO
        .upload(port="/dev/ttyACM0")
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Optional, Sequence, Union

import yaml

from atech.catalog import get_board, get_module
from atech.catalog.models import BoardSpec, ModuleSpec
from atech.errors import PlacementError
from atech.placement import Placement, PlacementIssue, normalize_ports, validate

PortArg = Union[int, str, Sequence[Union[int, str]]]

_SLUG_RE = re.compile(r"[^a-zA-Z0-9_]+")


def _slugify(text: str) -> str:
    return _SLUG_RE.sub("_", text).strip("_").lower() or "x"


@dataclass
class ProjectModule:
    """One module placement inside a Project."""

    module_id: str
    instance: str
    ports: tuple[str, ...]
    swap_lines: bool = False
    """Give the module the port's line B where it expects line A, and the reverse.

    Single-port modules only. For hardware whose two signal lines turn out to be
    the other way round (e.g. a robot arm that only answers with TX on line B).
    """

    def to_dict(self) -> dict:
        out: dict = {"id": self.module_id, "instance": self.instance}
        if len(self.ports) == 1:
            out["port"] = self.ports[0]
        else:
            out["ports"] = list(self.ports)
        if self.swap_lines:
            out["swap_lines"] = True
        return out


@dataclass
class Project:
    """A hardware project: one board + zero or more placed modules.

    Two extension points let users build their own thing on top:

    * ``setup_code`` / ``loop_code`` — raw C++ that's spliced into the
      generated ``setup()`` / ``loop()`` after the module templates. This is
      the easy 80% case for behavior: "when the button is pressed, flash
      the LED red".
    * ``globals_code`` — raw C++ at file scope, after the module globals:
      ``#include <WiFi.h>``, helper functions, BLE callback classes.
    * ``extra_module_paths`` — directories of user-authored modules that the
      catalog loader merges with the bundled catalog. See
      :meth:`use_modules_from`. This lets a user ship their own driver +
      manifest without forking the SDK.
    """

    board: str
    name: str = "atech-project"
    modules: list[ProjectModule] = field(default_factory=list)
    globals_code: str = ""
    setup_code: str = ""
    loop_code: str = ""
    libraries: list[str] = field(default_factory=list)
    """PlatformIO ``lib_deps`` for the project's own code, e.g.
    ``"knolleary/PubSubClient@^2.8"``. Added after the modules' own libraries."""
    host_actions: bool = True
    """False = the generated firmware does not read ``Serial`` for actions, so the
    project's own code may. For firmware that needs the raw USB serial stream
    (a serial bridge). ``atech send`` then gets no answer from the board."""
    feedback: Union[bool, str] = "auto"
    """Default feedback (``atech.feedback``): ``"auto"`` shows the inputs on the
    outputs when ``loop_code`` is empty, ``True`` always, ``False`` never."""
    extra_module_paths: list[Path] = field(default_factory=list)

    # ------------------------------------------------------------------ specs
    @property
    def board_spec(self) -> BoardSpec:
        return get_board(self.board)

    def module_spec(self, module_id: str) -> ModuleSpec:
        return self._catalog()[module_id] if module_id in self._catalog() else get_module(module_id)

    def module_specs(self) -> dict[str, ModuleSpec]:
        catalog = self._catalog()
        return {m.module_id: catalog[m.module_id] for m in self.modules}

    def _catalog(self) -> dict[str, ModuleSpec]:
        """Bundled catalog merged with any external module directories.

        External entries override bundled ones with the same id — handy for
        users who want to patch a bundled module locally without touching
        the SDK source.
        """
        from atech.catalog import load_modules
        from atech.catalog.loader import load_modules_from

        merged = dict(load_modules())
        for path in self.extra_module_paths:
            merged.update(load_modules_from(path))
        return merged

    # ------------------------------------------------------------- authoring
    def use_modules_from(self, path: Union[str, Path]) -> "Project":
        """Register a directory of user-authored modules.

        The directory should contain one folder per module (each with a
        ``module.yaml`` and driver source). The bundled catalog is still
        available; external modules with the same id take precedence.
        """
        resolved = Path(path).expanduser().resolve()
        if not resolved.is_dir():
            raise FileNotFoundError(f"no module directory at {resolved}")
        if resolved not in self.extra_module_paths:
            self.extra_module_paths.append(resolved)
        return self

    def set_globals(self, code: str) -> "Project":
        """Inject C++ code at file scope, after every module's globals.

        For ``#include`` lines (``<WiFi.h>``, ``<BLEDevice.h>``), helper
        functions and classes that ``setup()`` / ``loop()`` use.
        """
        self.globals_code = code
        return self

    def set_setup(self, code: str) -> "Project":
        """Inject C++ code into ``setup()``, after every module's setup snippet.

        Variables placed on the board are in scope: e.g. an instance named
        ``btn`` is a ``ButtonModule btn(...)`` global. Use this for one-off
        configuration (``WiFi.begin(...)`` with ``#include <WiFi.h>`` in
        :meth:`set_globals`, custom calibration, etc.).
        """
        self.setup_code = code
        return self

    def set_loop(self, code: str) -> "Project":
        """Inject C++ code into ``loop()``, after every module's loop snippet.

        This is where the project's behavior lives. References any
        ``instance`` names you assigned with :meth:`add`.
        """
        self.loop_code = code
        return self

    # ------------------------------------------------------------------- API
    def add(
        self,
        module_id: str,
        port: Optional[PortArg] = None,
        *,
        ports: Optional[PortArg] = None,
        instance: Optional[str] = None,
        swap_lines: bool = False,
    ) -> "Project":
        """Place a module on the board.

        Pass ``port=1`` for a single-width module, or ``ports=(1, 2)`` for a
        double-width module. ``instance`` lets you override the auto-generated
        C++ variable name. ``swap_lines=True`` hands a single-port module the
        port's two signal lines the other way round.

        Raises :class:`PlacementError` if the resulting placement is invalid.
        """
        if port is None and ports is None:
            raise TypeError("add() requires either port=... or ports=...")
        if port is not None and ports is not None:
            raise ValueError("add() accepts port= or ports=, not both")
        if type(swap_lines) is not bool:
            raise ValueError("swap_lines must be a boolean, not a quoted string or number")
        target = port if port is not None else ports
        port_tuple = normalize_ports(target)  # type: ignore[arg-type]
        # Store double-width ports in canonical ascending (lower-first) order so
        # [1,2] and [2,1] are identical. Physical orientation (which port carries
        # which line, incl. the left-column swap) is resolved at codegen time from
        # the board geometry — see codegen._module_context.
        if len(port_tuple) == 2:
            port_tuple = tuple(
                sorted(port_tuple, key=lambda pid: self.board_spec.port(pid).slot_number or 0)
            )

        catalog = self._catalog()
        if module_id not in catalog:
            available = ", ".join(sorted(catalog)) or "(none)"
            raise KeyError(
                f"module {module_id!r} not in catalog. Available: {available}"
            )
        spec = catalog[module_id]
        chosen_instance = instance or self._next_instance(spec)
        if any(m.instance == chosen_instance for m in self.modules):
            raise PlacementError(
                f"instance name {chosen_instance!r} already used in this project"
            )

        if swap_lines and len(port_tuple) != 1:
            raise PlacementError("swap_lines only applies to single-port modules")
        candidate = ProjectModule(
            module_id=module_id,
            instance=chosen_instance,
            ports=port_tuple,
            swap_lines=bool(swap_lines),
        )
        self.modules.append(candidate)

        issues = self.validate()
        if issues:
            # roll back — leave the project untouched on bad add()
            self.modules.pop()
            raise PlacementError(_format_issues(issues))
        return self

    def remove(self, instance: str) -> "Project":
        before = len(self.modules)
        self.modules = [m for m in self.modules if m.instance != instance]
        if len(self.modules) == before:
            raise KeyError(f"no module instance named {instance!r}")
        return self

    def validate(self) -> list[PlacementIssue]:
        """Return all placement issues; empty list = valid."""
        placements = [
            Placement(module_id=m.module_id, instance=m.instance, ports=m.ports)
            for m in self.modules
        ]
        return validate(self.board_spec, placements, self.module_specs())

    def ensure_valid(self) -> "Project":
        """Raise :class:`PlacementError` if the project is not valid."""
        issues = self.validate()
        if issues:
            raise PlacementError(_format_issues(issues))
        return self

    def cautions(self) -> list[tuple[str, str, str]]:
        """Safety notes of the placed modules, as ``(instance, module_id, text)``.

        Empty for most projects. Shown by the CLI before building and flashing.
        """
        specs = self.module_specs()
        out: list[tuple[str, str, str]] = []
        for pm in self.modules:
            text = specs[pm.module_id].caution
            if text:
                out.append((pm.instance, pm.module_id, " ".join(text.split())))
        return out

    def tips(self) -> list[str]:
        """What the default feedback does here, and outputs worth adding (``atech.feedback``)."""
        from atech.feedback import tips

        return tips(self)

    def describe(self) -> str:
        """Return a human/agent-readable summary of what's on the board.

        Includes the public API (``usage`` block) of every placed module, so
        a coding agent writing the ``code:`` block knows exactly what
        method calls are available and what each instance is named.
        """
        from jinja2 import Template

        board = self.board_spec
        specs = self.module_specs()
        lines: list[str] = []
        lines.append(f"Project: {self.name}")
        lines.append(f"Board:   {board.name} ({board.id})")
        lines.append("")
        if not self.modules:
            lines.append("(no modules placed yet. In project.yaml, add entries under `modules:`,")
            lines.append(" e.g.  - {id: button, instance: btn, port: 1}   — `atech list-modules` shows the ids)")
            return "\n".join(lines)

        lines.append("Modules placed:")
        for pm in self.modules:
            spec = specs[pm.module_id]
            ports_str = ", ".join(pm.ports)
            pin_str = ", ".join(
                f"GPIO {p.gpio}"
                for port_id in pm.ports
                for p in board.port(port_id).pins
            )
            lines.append(f"  - {spec.name} (`{spec.id}`)")
            lines.append(f"      instance: {pm.instance}")
            lines.append(f"      ports:    {ports_str}   pins: {pin_str}"
                         + ("   (lines A and B swapped: swap_lines)" if pm.swap_lines else ""))

        for instance, module_id, text in self.cautions():
            lines.append("")
            lines.append(f"CAUTION — {instance} ({module_id}): {text}")
            lines.append("Tell the user this before they connect power.")

        for text in self.tips():
            lines.append("")
            lines.append(f"TIP: {text}")

        lines.append("")
        lines.append("How to use each module from your `code:` block (these methods exist on the C++ instance):")
        lines.append("")
        for pm in self.modules:
            spec = specs[pm.module_id]
            if not spec.usage:
                continue
            rendered = Template(spec.usage).render(instance=pm.instance)
            lines.append(f"# {pm.instance} ({spec.id})")
            for line in rendered.rstrip().splitlines():
                lines.append(line)
            lines.append("")

        events, actions = self.events(), self.actions()
        if not self.host_actions:
            lines.append("host_actions: false — this firmware does not read actions from the laptop;")
            lines.append("`atech send` and board.call() will get no answer. Its own code owns Serial.")
            actions = []
        lines.append("From the laptop, once this project is built and uploaded:")
        if events:
            lines.append("  events the board sends (`atech monitor`, board.events()):")
            for key, vtype, desc in events:
                lines.append(f"    {key}  ({vtype})" + (f" — {desc}" if desc else ""))
        if actions:
            lines.append("  actions the board accepts (`atech send <key> [value]`, board.call(key, value)):")
            for key, vtype, desc, handled in actions:
                note = "" if handled else "  [NOT handled by the firmware: handle it in code.loop]"
                takes = "no value" if vtype == "null" else vtype
                lines.append(f"    {key}  ({takes})" + (f" — {desc}" if desc else "") + note)
        if not events and not actions:
            lines.append("  nothing yet: these modules neither send events nor accept actions.")
        lines.append("")
        return "\n".join(lines)

    def events(self) -> list[tuple[str, str, str]]:
        """``(key, value_type, description)`` of every event the placed modules emit."""
        from jinja2 import Template

        specs = self.module_specs()
        out: list[tuple[str, str, str]] = []
        for pm in self.modules:
            for ev in specs[pm.module_id].events:
                out.append((
                    Template(ev.key).render(instance=pm.instance),
                    ev.value_type,
                    Template(ev.description or "").render(instance=pm.instance),
                ))
        return out

    def actions(self) -> list[tuple[str, str, str, bool]]:
        """``(key, value_type, description, handled_by_firmware)`` of every declared action."""
        from jinja2 import Template

        specs = self.module_specs()
        out: list[tuple[str, str, str, bool]] = []
        for pm in self.modules:
            for act in specs[pm.module_id].actions:
                out.append((
                    Template(act.key).render(instance=pm.instance),
                    act.value_type,
                    Template(act.description or "").render(instance=pm.instance),
                    bool(act.handler),
                ))
        return out

    # ----------------------------------------------------------- generation
    def generate(self, out_dir: Union[str, Path]) -> Path:
        """Write a PlatformIO project tree to ``out_dir`` and return the path."""
        from atech.codegen import generate_project

        out = Path(out_dir).expanduser().resolve()
        return generate_project(self, out)

    def build(self, out_dir: Union[str, Path, None] = None):
        """Generate + compile via PlatformIO. Returns a :class:`BuildResult`."""
        from atech.build import run_build

        target = Path(out_dir) if out_dir else _default_build_dir(self.name)
        self.generate(target)
        return run_build(target)

    def upload(self, port: Optional[str] = None, out_dir: Union[str, Path, None] = None):
        """Generate, build what changed, and flash via PlatformIO. Returns an :class:`UploadResult`.

        The firmware is regenerated from the project every time. Generating only when
        no build existed meant that an edited ``project.yaml`` was ignored and the
        previous firmware was flashed, with a success message.
        """
        from atech.upload import run_upload

        target = Path(out_dir) if out_dir else _default_build_dir(self.name)
        self.generate(target)
        return run_upload(target, port=port)

    # ---------------------------------------------------------------- YAML
    def to_yaml(self) -> str:
        data: dict = {
            "name": self.name,
            "board": self.board,
        }
        if self.extra_module_paths:
            data["modules_path"] = [str(p) for p in self.extra_module_paths]
        data["modules"] = [m.to_dict() for m in self.modules]
        if self.libraries:
            data["libraries"] = list(self.libraries)
        if not self.host_actions:
            data["host_actions"] = False
        if self.feedback != "auto":
            data["feedback"] = self.feedback
        code_block: dict = {}
        if self.globals_code:
            code_block["globals"] = self.globals_code
        if self.setup_code:
            code_block["setup"] = self.setup_code
        if self.loop_code:
            code_block["loop"] = self.loop_code
        if code_block:
            data["code"] = code_block
        return yaml.safe_dump(data, sort_keys=False)

    @classmethod
    def from_yaml(cls, text: str, *, base_dir: Optional[Path] = None) -> "Project":
        """Parse a project YAML.

        ``base_dir`` is the directory the YAML lives in; relative
        ``modules_path`` entries are resolved against it. Defaults to the
        current working directory.
        """
        try:
            data = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            mark = getattr(exc, "problem_mark", None)
            location = f" at line {mark.line + 1}, column {mark.column + 1}" if mark else ""
            raise ValueError(f"invalid project YAML{location}: {getattr(exc, 'problem', None) or 'parse error'}") from None
        if data is None:
            data = {}
        if not isinstance(data, dict):
            raise ValueError("project YAML must be a mapping")
        board = _nonempty_string(data.get("board"), "board")
        name = _nonempty_string(data.get("name", "atech-project"), "name")
        proj = cls(board=board, name=name)
        # Validate the board even when the project has no modules yet.
        proj.board_spec
        root = Path(base_dir) if base_dir is not None else Path.cwd()

        for raw_path in _as_path_list(data.get("modules_path")):
            resolved = (root / raw_path).resolve() if not Path(raw_path).is_absolute() else Path(raw_path)
            proj.use_modules_from(resolved)

        entries = data.get("modules")
        if entries is None:
            entries = []
        if not isinstance(entries, list):
            raise ValueError("modules must be a list of module mappings")
        for index, entry in enumerate(entries):
            field = f"modules[{index}]"
            if not isinstance(entry, dict):
                raise ValueError(f"{field} must be a mapping")
            module_id = _nonempty_string(entry.get("id"), f"{field}.id")
            if "port" in entry and "ports" in entry:
                raise ValueError(f"{field} must specify port or ports, not both")
            port_arg = entry.get("port", entry.get("ports"))
            if port_arg is None:
                raise ValueError(f"{field} is missing port/ports")
            instance = entry.get("instance")
            if instance is not None:
                instance = _nonempty_string(instance, f"{field}.instance")
            proj.add(
                module_id,
                ports=port_arg,
                instance=instance,
                swap_lines=_boolean(entry.get("swap_lines", False), f"{field}.swap_lines"),
            )

        code = data.get("code")
        if code is None:
            code = {}
        if not isinstance(code, dict):
            raise ValueError("code must be a mapping of globals, setup and loop strings")
        for key in ("globals", "setup", "loop"):
            value = code.get(key)
            if value is None:
                value = ""
            if not isinstance(value, str):
                raise ValueError(f"code.{key} must be a string")
            setattr(proj, f"{key}_code", value)
        libraries = data.get("libraries")
        if libraries is None:
            libraries = []
        if isinstance(libraries, str):
            libraries = [libraries]
        if not isinstance(libraries, list):
            raise ValueError("libraries must be a string or a list of strings")
        proj.libraries = [_nonempty_string(lib, "libraries entry") for lib in libraries]
        proj.host_actions = _boolean(data.get("host_actions", True), "host_actions")
        feedback = data.get("feedback", "auto")
        if type(feedback) is not bool and feedback != "auto":
            raise ValueError(f"feedback: must be true, false or auto, not {feedback!r}")
        proj.feedback = feedback
        return proj

    @classmethod
    def load(cls, path: Union[str, Path] = ".") -> "Project":
        """Load a project from ``project.yaml``, or from the directory that holds it."""
        p = Path(path).expanduser().resolve()
        if p.is_dir():
            p = p / "project.yaml"
        if not p.is_file():
            raise FileNotFoundError(f"no project.yaml at {p}")
        return cls.from_yaml(p.read_text(encoding="utf-8"), base_dir=p.parent)

    def save(self, path: Union[str, Path]) -> Path:
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(self.to_yaml(), encoding="utf-8")
        return out

    # ------------------------------------------------------------- internal
    def _next_instance(self, spec: ModuleSpec) -> str:
        base = _slugify(spec.id)
        existing = {m.instance for m in self.modules}
        i = 1
        while f"{base}_{i}" in existing:
            i += 1
        return f"{base}_{i}"


def _format_issues(issues: Iterable[PlacementIssue]) -> str:
    lines = ["invalid placement:"]
    for i in issues:
        ports = f" ({', '.join(i.ports)})" if i.ports else ""
        lines.append(f"  - [{i.instance}]{ports} {i.message}")
    return "\n".join(lines)


def _default_build_dir(project_name: str) -> Path:
    safe = _slugify(project_name)
    return Path.cwd() / ".atech" / "builds" / safe


def _as_path_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [_nonempty_string(value, "modules_path")]
    if not isinstance(value, list):
        raise ValueError("modules_path must be a path string or a list of path strings")
    return [_nonempty_string(v, "modules_path entry") for v in value]


def _nonempty_string(value, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} must be a nonempty string")
    return value


def _boolean(value, field: str) -> bool:
    if type(value) is not bool:
        raise ValueError(f"{field} must be true or false, not a quoted string or number")
    return value
