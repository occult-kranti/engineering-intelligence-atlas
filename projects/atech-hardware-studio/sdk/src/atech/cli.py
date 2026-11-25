"""``atech`` command-line interface.

Two halves match the package:

* Build/flash: ``list-boards``, ``list-modules``, ``new``, ``validate``,
  ``build``, ``upload``.
* Runtime: ``ports``, ``monitor``, ``send``.
* Seeing it: ``view`` (the board and its modules in 3D, in the browser).
* Simulation: ``sim-assets`` (USD, MJCF and URDF for modules and boards).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
from dataclasses import asdict
from pathlib import Path

from atech import __version__
from atech.catalog import get_board, list_boards, list_modules
from atech.errors import AtechError
from atech.project import Project
from atech.runtime.board import (
    ActionRejected,
    Board,
    NoAcknowledgement,
    NoBoardFoundError,
)
from atech.runtime.transport import (
    PortUnavailableError,
    all_ports,
    discover_ports,
    free_port,
)

# ----------------------------------------------------------------- runtime


def _cmd_ports(_args: argparse.Namespace) -> int:
    ports = discover_ports()
    for p in ports:
        print(p)
    if ports:
        return 0
    print("No Atech board found on USB.", file=sys.stderr)
    print("Plug the board in with a data cable (charge-only cables show nothing).", file=sys.stderr)
    others = all_ports()
    if others:
        print("Other serial ports on this machine (not boards; pass --port to use one anyway):", file=sys.stderr)
        for p in others:
            print(f"  {p}", file=sys.stderr)
    return 1


def _cmd_free_port(args: argparse.Namespace) -> int:
    device = args.port
    if not device:
        ports = discover_ports()
        if not ports:
            print("No Atech board found on USB; nothing to free.", file=sys.stderr)
            return 1
        device = ports[0].device
    killed = free_port(device)
    if killed:
        for line in killed:
            print(f"freed {device}: {line}")
    else:
        print(f"{device}: nothing was holding it (or kill tools unavailable).")
    return 0


def _cmd_monitor(args: argparse.Namespace) -> int:
    try:
        board = Board.connect(port=args.port, baud=args.baud)
    except NoBoardFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    types = args.type.split(",") if args.type else None
    keys = args.key.split(",") if args.key else None
    print(
        f"# monitoring {args.port or '<auto>'} @ {args.baud} baud (Ctrl-C to stop)",
        file=sys.stderr,
    )
    try:
        with board:
            for event in board.events(types=types, keys=keys):
                # flush=True: when stdout is a pipe (an agent, `| grep`, a log file)
                # Python buffers it, and nothing would show until 8 kB had piled up.
                if args.json:
                    print(event.model_dump_json(), flush=True)
                else:
                    print(f"[{event.type}] {event.key} = {event.value}", flush=True)
    except KeyboardInterrupt:
        return 0
    return 0


_PAIR = re.compile(r"^[A-Za-z_]\w*=")


def _send_value(parts: list[str]) -> object:
    """The value of `atech send`: `r=255 g=0` pairs, one JSON value, or plain text.

    The pairs form needs no quotes, so the same line works in bash, zsh,
    PowerShell and cmd (the Windows shells mangle `'{"r":255}'`).
    """
    def parse(text: str) -> object:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    if len(parts) == 1:
        value = parse(parts[0])
        if not isinstance(value, str) or not _PAIR.match(parts[0]):
            return value
    if parts and all(_PAIR.match(part) for part in parts):
        return {k: parse(v) for k, v in (part.split("=", 1) for part in parts)}
    return parse(" ".join(parts))


def _cmd_send(args: argparse.Namespace) -> int:
    value = _send_value(args.value)
    try:
        with Board.connect(port=args.port, baud=args.baud) as board:
            if args.no_wait:
                board.send(args.key, value)
                print(f"sent (not confirmed): {args.key} = {value!r}")
                return 0
            board.call(args.key, value, timeout=args.timeout)
    except NoBoardFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except ActionRejected as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1
    except NoAcknowledgement as exc:
        print(f"no answer: {exc}", file=sys.stderr)
        return 2
    print(f"ok: the board carried out {args.key} = {value!r}")
    return 0


_RESET_HINTS = {
    "BROWNOUT": "power problem — unstable/insufficient supply (USB cable, or a motor/LED current spike)",
    "PANIC": "firmware crashed — likely a bug in your code.loop / setup",
    "TASK_WDT": "watchdog reset — something blocked loop() too long (a long delay()?)",
    "INT_WDT": "watchdog reset — an interrupt handler ran too long",
    "WDT": "watchdog reset",
}

# Reset reasons that are not a fault, with what they mean.
_RESET_NOTES = {
    "UNKNOWN": "expected: `atech check` resets the board over USB to get this report",
}


def _cmd_check(args: argparse.Namespace) -> int:
    try:
        board = Board.connect(port=args.port, baud=args.baud)
    except NoBoardFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    with board:
        report = board.diagnostics(timeout=args.timeout)

    if report is None:
        print(
            "no boot report received in "
            f"{args.timeout:g}s.\n"
            "  • If the board was flashed with an older atech, rebuild + reflash "
            "(`atech upload`).\n"
            "  • If it stays silent, the firmware may be crash-looping before setup() "
            "finishes — check power and wiring.",
            file=sys.stderr,
        )
        return 1

    reason = report.get("reset_reason", "?")
    hint = _RESET_HINTS.get(reason) or _RESET_NOTES.get(reason, "")
    print(f"reset reason : {reason}" + (f"  <- {hint}" if hint else ""))
    heap = report.get("free_heap")
    if heap is not None:
        print(f"free heap    : {heap} bytes")

    modules = report.get("modules", [])
    problems = 0
    print("modules:")
    if not modules:
        print("  (none placed)")
    for m in modules:
        ok, det = m.get("ok"), m.get("detectable")
        if det and ok:
            status = "OK — responding"
        elif det and not ok:
            status = "NOT responding — check the port, that it is seated, and that it has power"
            problems += 1
        else:
            status = "initialized (this module has no read-back: software cannot tell if it is plugged in)"
        print(f"  {m.get('instance')!s:<10} {m.get('module')!s:<14} {status}")

    failed = problems > 0 or reason in _RESET_HINTS
    sys.stdout.flush()
    if failed:
        print("\nresult: PROBLEMS DETECTED (see above)", file=sys.stderr)
        return 1
    print("\nresult: all detectable modules responding")
    return 0


# ------------------------------------------------------------------- catalog


def _free_ports(board) -> list[int]:
    return [p.slot_number for p in board.ports if p.id not in board.reserved and p.slot_number]


def _uart_ports(board) -> list[int]:
    reserved = set(board.reserved)
    return [
        p.slot_number for p in board.ports
        if p.id not in reserved and p.slot_number and "uart" in p.compatible_interfaces
    ]


def _cmd_list_boards(args: argparse.Namespace) -> int:
    boards = list_boards()
    if args.json:
        print(json.dumps([
            {
                "id": b.id,
                "name": b.name,
                "module_ports": _free_ports(b),
                "uart_ports": _uart_ports(b),
                "reserved": b.reserved,
                "adjacent_port_pairs": [list(pair) for pair in b.adjacent_port_pairs],
            }
            for b in boards
        ], indent=2))
        return 0
    width = max(len(b.id) for b in boards) + 2
    for board in boards:
        ports = ", ".join(str(n) for n in _free_ports(board))
        uart = ", ".join(str(n) for n in _uart_ports(board)) or "none"
        print(f"{board.id:<{width}}{board.name}  (module ports: {ports}; UART on: {uart})")
    return 0


def _module_dict(module, instance: str) -> dict:
    """Everything an agent needs to use one module, with the instance name filled in."""
    from jinja2 import Template

    def r(text):
        return Template(text or "").render(instance=instance).strip()

    return {
        "id": module.id,
        "name": module.name,
        "category": module.category,
        "interface": module.interface,
        "size": module.size,
        "description": " ".join((module.description or "").split()),
        "caution": " ".join((module.caution or "").split()) or None,
        "events": [
            {"key": r(e.key), "type": e.type, "value_type": e.value_type, "description": r(e.description)}
            for e in module.events
        ],
        "actions": [
            {"key": r(a.key), "value_type": a.value_type, "description": r(a.description),
             "handled_by_firmware": bool(a.handler)}
            for a in module.actions
        ],
        "usage": r(module.usage),
    }


def _cmd_list_modules(args: argparse.Namespace) -> int:
    modules = list_modules(category=args.category)
    if args.json:
        print(json.dumps([
            {k: v for k, v in _module_dict(m, m.id).items() if k != "usage"} for m in modules
        ], indent=2))
        return 0
    if not modules:
        print(f"no modules in category {args.category!r}", file=sys.stderr)
        return 1
    w_id = max(len(m.id) for m in modules) + 2
    w_cat = max(len(m.category) for m in modules) + 2
    for m in modules:
        ports = "1 port " if m.size == 1 else "2 ports"
        flag = "  [CAUTION: see `atech info " + m.id + "`]" if m.caution else ""
        print(f"{m.id:<{w_id}}{m.category:<{w_cat}}{m.interface:<6}{ports}  {m.name}{flag}")
    print("\nDetails, API and laptop-side events/actions of one module: atech info <id>", file=sys.stderr)
    return 0


def _cmd_info(args: argparse.Namespace) -> int:
    from atech.catalog.loader import load_modules, load_modules_from

    modules = dict(load_modules())
    if args.modules_path:
        modules.update(load_modules_from(args.modules_path))
    if args.module not in modules:
        raise AtechError(
            f"no module {args.module!r}. Available: {', '.join(sorted(modules))}"
        )
    module = modules[args.module]
    info = _module_dict(module, args.instance or module.id)
    if args.json:
        print(json.dumps(info, indent=2))
        return 0
    ports = "1 port" if module.size == 1 else "2 adjacent ports"
    print(f"{info['id']} — {info['name']}  ({info['category']}, {info['interface']}, {ports})")
    if info["description"]:
        print()
        print(textwrap.fill(info["description"], width=88))
    if info["caution"]:
        print()
        print("CAUTION:")
        print(textwrap.fill(info["caution"], width=88, initial_indent="  ", subsequent_indent="  "))
    inst = args.instance or module.id
    print(f"\nIn project.yaml:  - {{id: {module.id}, instance: {inst}, "
          + ("port: N}" if module.size == 1 else "ports: [N, N+1]}"))
    print(f"\nEvents the board sends (instance `{inst}`):")
    for e in info["events"] or []:
        print(f"  {e['key']}  ({e['value_type']})  {e['description']}")
    if not info["events"]:
        print("  none")
    print("\nActions the board accepts (atech send <key> <value> / board.call):")
    for a in info["actions"] or []:
        note = "" if a["handled_by_firmware"] else "  [not handled by the firmware]"
        print(f"  {a['key']}  ({a['value_type']})  {a['description']}{note}")
    if not info["actions"]:
        print("  none")
    if info["usage"]:
        print("\nC++ API for your code: block:")
        print(textwrap.indent(info["usage"], "  "))
    return 0


def _cmd_guide(args: argparse.Namespace) -> int:
    from atech.docs import read_doc

    sys.stdout.write(read_doc(args.topic if args.topic in ("protocol", "sim", "flash") else "guide"))
    return 0


# ------------------------------------------------------------------- project


def _project_dir(args: argparse.Namespace) -> Path:
    return Path(args.project_dir).expanduser().resolve()


def _load_project(args: argparse.Namespace) -> Project:
    path = _project_dir(args) / "project.yaml"
    if not path.is_file():
        raise AtechError(
            f"no project.yaml at {path}. Run this inside a project folder, pass the folder "
            "as an argument, or create one with `atech new <name> --board <id>`."
        )
    return Project.load(path)


def _cmd_describe(args: argparse.Namespace) -> int:
    project = _load_project(args)
    print(project.describe())
    issues = project.validate()
    if issues:
        print(f"{len(issues)} placement issue(s) — fix before building:", file=sys.stderr)
        for i in issues:
            ports = f" ({', '.join(i.ports)})" if i.ports else ""
            print(f"  [{i.instance}]{ports} {i.message}", file=sys.stderr)
        return 1
    return 0


def _cmd_new(args: argparse.Namespace) -> int:
    out = Path(args.path or args.name).expanduser().resolve()
    if out.exists() and any(out.iterdir()):
        print(f"error: {out} already exists and is not empty", file=sys.stderr)
        return 1
    # Validate the board exists before we touch the filesystem.
    get_board(args.board)
    out.mkdir(parents=True, exist_ok=True)
    project = Project(board=args.board, name=args.name)
    project.save(out / "project.yaml")
    (out / "README.md").write_text(
        f"# {args.name}\n\n"
        f"Atech project targeting the **{args.board}** board.\n\n"
        f"Edit `project.yaml` to place modules, then:\n\n"
        f"```bash\n"
        f"atech describe .   # what is placed, each module's API, events and actions\n"
        f"atech validate .\n"
        f"atech build .\n"
        f"atech upload .\n"
        f"atech monitor      # events from the board\n"
        f"```\n\n"
        f"Working with a coding agent? `AGENTS.md` / `CLAUDE.md` in this folder tell it how\n"
        f"to use the SDK (same text as `atech guide`).\n",
        encoding="utf-8",
    )
    from atech.docs import read_doc

    guide = read_doc("guide")
    for name in ("AGENTS.md", "CLAUDE.md"):
        (out / name).write_text(guide, encoding="utf-8")
    print(f"created project at {out}")
    print("  project.yaml          place modules and write the behaviour here")
    print("  AGENTS.md, CLAUDE.md  instructions for your coding agent (`atech guide`)")
    print("  README.md             the commands, for people")
    print(f"next: atech list-modules, edit project.yaml, then atech validate {out.name} && atech build {out.name}")
    return 0


def _print_cautions(project) -> None:
    """Print the safety notes of the placed modules.

    On stdout, with the result: a caller that keeps only stdout must still see them.
    """
    for instance, module_id, text in project.cautions():
        print(f"\nCAUTION [{instance}] {module_id}:")
        for line in textwrap.wrap(text, width=88):
            print(f"  {line}")
    for text in project.tips():
        print("\nTIP:")
        for line in textwrap.wrap(text, width=88):
            print(f"  {line}")


def _cmd_view(args: argparse.Namespace) -> int:
    from atech.view.server import serve

    path = _project_dir(args) / "project.yaml"
    if not path.is_file():
        _load_project(args)  # raises the same "no project.yaml" message as every other command
    # A project.yaml that does not load yet is fine: the page shows why, and redraws once it does.
    return serve(_project_dir(args), port=args.port, open_browser=not args.no_open)


def _cmd_validate(args: argparse.Namespace) -> int:
    if getattr(args, "json", False):
        # One JSON document on stdout for both accepted and rejected projects.
        # This branch reads local configuration/catalogs only: it never builds,
        # downloads a toolchain, opens a serial port or flashes a device.
        try:
            project = _load_project(args)
            issues = project.validate()
            report = {
                "schema_version": 1,
                "valid": not issues,
                "project": project.name,
                "board": project.board,
                "issues": [asdict(issue) for issue in issues],
                "cautions": [
                    {"instance": instance, "module_id": module_id, "message": message}
                    for instance, module_id, message in project.cautions()
                ],
                "tips": project.tips(),
            }
        except (AtechError, KeyError, OSError, ValueError) as exc:
            message = exc.args[0] if isinstance(exc, KeyError) and exc.args else str(exc)
            report = {
                "schema_version": 1,
                "valid": False,
                "project": None,
                "board": None,
                "issues": [{"kind": "invalid_project", "message": message}],
                "cautions": [],
                "tips": [],
            }
        print(json.dumps(report, ensure_ascii=False, allow_nan=False))
        return 0 if report["valid"] else 1

    project = _load_project(args)
    issues = project.validate()
    if not issues:
        print("ok")
        _print_cautions(project)
        return 0
    print(f"{len(issues)} issue(s):", file=sys.stderr)
    for i in issues:
        ports = f" ({', '.join(i.ports)})" if i.ports else ""
        print(f"  [{i.instance}]{ports} {i.message}", file=sys.stderr)
    return 1


def _toolchain_installed() -> bool:
    """Has PlatformIO already downloaded the ESP32-S3 compiler on this machine?"""
    import os

    core = Path(os.environ.get("PLATFORMIO_CORE_DIR") or Path.home() / ".platformio")
    return (core / "packages" / "toolchain-xtensa-esp32s3").is_dir()


def _announce_first_build() -> None:
    if not _toolchain_installed():
        print(
            "first build on this machine: downloading the ESP32 compiler "
            "(about 2.4 GB on disk, once).\n"
            "This takes minutes and prints nothing until it is done. Later builds take seconds.",
            file=sys.stderr, flush=True,
        )


def _cmd_build(args: argparse.Namespace) -> int:
    project = _load_project(args)
    _announce_first_build()
    out_dir = _project_dir(args) / "build"
    result = project.build(out_dir=out_dir)
    if not result.success:
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        return result.returncode or 1
    sys.stdout.write(result.stdout)
    if result.firmware_path:
        print(f"\nfirmware: {result.firmware_path}")
    _print_cautions(project)  # last, so it is not lost above the compiler output
    return 0


def _cmd_upload(args: argparse.Namespace) -> int:
    project = _load_project(args)
    if not args.port and not discover_ports():
        # Fail before a build + three flash attempts against nothing.
        raise AtechError(
            "No Atech board found on USB, so there is nothing to upload to. Plug it in "
            "with a data cable (`atech ports` shows what is there), or pass --port."
        )
    _announce_first_build()
    out_dir = _project_dir(args) / "build"
    result = project.upload(port=args.port, out_dir=out_dir)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if not result.success:
        return result.returncode or 1
    print(f"uploaded to {result.port or '<auto>'}")
    _print_cautions(project)  # last thing on screen before the arm gets plugged in
    return 0


# -------------------------------------------------------------- sim assets


def _cmd_sim_assets(args: argparse.Namespace) -> int:
    """USD / MJCF / URDF files for modules and boards (``atech.sim``)."""
    from atech import sim
    from atech.sim.meshes import DEFAULT_TAG

    formats = sim.parse_formats(args.format)
    modules = list(args.modules)
    modules_path = Path(args.modules_path).expanduser() if args.modules_path else None
    if args.fetch is not None and (
        args.fetch in sim.sim_module_ids()
        or (modules_path is not None and (modules_path / args.fetch / "sim.yaml").is_file())
    ):
        # `--fetch distance_sensor`: argparse took the module for the optional TAG.
        modules.append(args.fetch)
        args.fetch = DEFAULT_TAG
    if args.all:
        modules = sim.sim_module_ids() + [m for m in modules if m not in sim.sim_module_ids()]
    boards = [b.strip() for item in args.board for b in item.split(",") if b.strip()]
    if not modules and not boards:
        print("error: name one or more modules, or pass --all or --board ID "
              "(`atech list-modules`, `atech list-boards`).", file=sys.stderr)
        return 2
    try:
        library = sim.mesh_library(
            Path(args.meshes) if args.meshes else None, args.fetch
        )
        written = sim.export(
            modules, formats, Path(args.out), board_ids=boards, modules_path=modules_path,
            meshes=library, on_note=lambda asset, note: print(f"# {asset}: {note}", file=sys.stderr),
        )
    except (sim.UsdUnavailableError, sim.MeshesUnavailableError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    for path in written:
        print(path)
    print(f"# {len(written)} file(s); masses (and every field in atech:placeholders) are "
          "guesses until Atech publishes datasheets.", file=sys.stderr)
    return 0


# ------------------------------------------------------------------- parser


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="atech",
        description="Firmware for Atech boards from one project.yaml: build, flash, and talk to the board.",
        epilog="New here, or a coding agent? Run `atech guide` first.",
    )
    parser.add_argument("--version", action="version", version=f"atech {__version__}")
    sub = parser.add_subparsers(dest="cmd", required=True)

    # Catalog
    p_guide = sub.add_parser(
        "guide",
        help="Print the guide for coding agents (start here). `atech guide protocol` = wire format, "
        "`atech guide sim` = simulation assets, `atech guide flash` = finding and flashing the board.",
    )
    p_guide.add_argument("topic", nargs="?", choices=["agent", "protocol", "sim", "flash"],
                         default="agent")
    p_guide.set_defaults(func=_cmd_guide)

    p_lb = sub.add_parser("list-boards", help="List bundled motherboard layouts.")
    p_lb.add_argument("--json", action="store_true", help="Machine-readable output.")
    p_lb.set_defaults(func=_cmd_list_boards)

    p_lm = sub.add_parser("list-modules", help="List bundled modules.")
    p_lm.add_argument("--category", default=None, help="Filter by category.")
    p_lm.add_argument("--json", action="store_true", help="Machine-readable output.")
    p_lm.set_defaults(func=_cmd_list_modules)

    p_info = sub.add_parser(
        "info", help="Everything about one module: description, cautions, C++ API, events, actions."
    )
    p_info.add_argument("module", help="Module id, e.g. neopixel.")
    p_info.add_argument("--instance", default=None, help="Instance name to show in the examples.")
    p_info.add_argument("--modules-path", default=None, help="Also look in this folder of custom modules.")
    p_info.add_argument("--json", action="store_true", help="Machine-readable output.")
    p_info.set_defaults(func=_cmd_info)

    # Project lifecycle
    p_new = sub.add_parser("new", help="Scaffold a new project directory.")
    p_new.add_argument("name", help="Project name (also the folder name unless --path is set).")
    p_new.add_argument("--board", required=True, help="Target board id, e.g. 8port.")
    p_new.add_argument("--path", default=None, help="Directory to create (defaults to ./<name>).")
    p_new.set_defaults(func=_cmd_new)

    p_desc = sub.add_parser(
        "describe", help="What a project places, each module's API, and its events and actions."
    )
    p_desc.add_argument("project_dir", nargs="?", default=".")
    p_desc.set_defaults(func=_cmd_describe)

    p_view = sub.add_parser(
        "view",
        help="Show the project's board and modules in 3D in the browser; redraws when project.yaml changes.",
    )
    p_view.add_argument("project_dir", nargs="?", default=".")
    p_view.add_argument("--port", type=int, default=None,
                        help="Local port for the page (default: the first free one from 8740).")
    p_view.add_argument("--no-open", action="store_true", help="Print the URL; do not open a browser.")
    p_view.set_defaults(func=_cmd_view)

    p_val = sub.add_parser("validate", help="Validate a project's placement.")
    p_val.add_argument("project_dir", nargs="?", default=".")
    p_val.add_argument("--json", action="store_true",
                       help="Print one structured validation report; no compile, download or device access.")
    p_val.set_defaults(func=_cmd_validate)

    p_build = sub.add_parser("build", help="Generate + compile firmware via PlatformIO.")
    p_build.add_argument("project_dir", nargs="?", default=".")
    p_build.set_defaults(func=_cmd_build)

    p_up = sub.add_parser("upload", help="Build (if needed) and flash to a connected board.")
    p_up.add_argument("project_dir", nargs="?", default=".")
    p_up.add_argument("--port", default=None, help="Serial port (auto-detect if omitted).")
    p_up.set_defaults(func=_cmd_upload)

    p_sim = sub.add_parser(
        "sim-assets",
        help="Write simulation assets (USD/SimReady, MuJoCo MJCF, URDF) for modules and boards.",
    )
    p_sim.add_argument("modules", nargs="*", default=[], help="Module ids, e.g. distance_sensor icm40608.")
    p_sim.add_argument("--all", action="store_true", help="Every catalog module that has sim data.")
    p_sim.add_argument("--board", action="append", default=[], metavar="ID",
                       help="Also export a board (repeat, or comma-separate: 14port,8port).")
    p_sim.add_argument("--format", default="usd,mjcf,urdf",
                       help="Comma-separated: usd, mjcf, urdf (default: all three; usd needs usd-core).")
    p_sim.add_argument("--out", required=True, help="Output directory.")
    p_sim.add_argument("--modules-path", default=None, help="Also look in this folder of custom modules.")
    cad = p_sim.add_mutually_exclusive_group()
    cad.add_argument("--meshes", default=None, metavar="DIR",
                     help="Use Atech's real CAD for the visuals: a glb_plain/ folder of atech_module_glb.zip "
                          "(atechdotdev/atech-module-renders).")
    cad.add_argument("--fetch", nargs="?", const="v1.7", default=None, metavar="TAG",
                     help="Like --meshes, downloading the release with `gh` (private repo; default v1.7; "
                          "cached in ~/.cache/atech).")
    p_sim.set_defaults(func=_cmd_sim_assets)

    # Runtime
    p_ports = sub.add_parser("ports", help="List the USB ports that look like an Atech board.")
    p_ports.set_defaults(func=_cmd_ports)

    p_mon = sub.add_parser("monitor", help="Stream events from a flashed board.")
    p_mon.add_argument("--port", default=None)
    p_mon.add_argument("--baud", type=int, default=115200)
    p_mon.add_argument("--type", default=None, help="Filter by event type(s), comma-separated.")
    p_mon.add_argument("--key", default=None, help="Filter by key(s), comma-separated.")
    p_mon.add_argument("--json", action="store_true", help="Emit raw JSON, one event per line.")
    p_mon.set_defaults(func=_cmd_monitor)

    p_free = sub.add_parser(
        "free-port", help="Kill any process holding the serial port (frees a stuck board)."
    )
    p_free.add_argument("--port", default=None, help="Port to free (auto-detect if omitted).")
    p_free.set_defaults(func=_cmd_free_port)

    p_check = sub.add_parser(
        "check", help="Reboot the board and report module health + why it failed."
    )
    p_check.add_argument("--port", default=None)
    p_check.add_argument("--baud", type=int, default=115200)
    p_check.add_argument("--timeout", type=float, default=5.0, help="Seconds to wait for the boot report.")
    p_check.set_defaults(func=_cmd_check)

    p_send = sub.add_parser(
        "send", help="Send one action and wait for the board to confirm it carried it out."
    )
    p_send.add_argument("key", help="Action key, e.g. led_fill (see `atech describe`).")
    p_send.add_argument("value", nargs="*", default=[],
                        help="Value, optional: name=value pairs (r=255 g=0 b=0), a number, "
                             "text, or one JSON value.")
    p_send.add_argument("--port", default=None)
    p_send.add_argument("--baud", type=int, default=115200)
    p_send.add_argument("--timeout", type=float, default=2.0, help="Seconds to wait for the confirmation.")
    p_send.add_argument("--no-wait", action="store_true", help="Write the action and return without waiting.")
    p_send.set_defaults(func=_cmd_send)

    return parser


def _utf8_output() -> None:
    """Print UTF-8 everywhere. A Windows pipe defaults to cp1252, which cannot
    encode some characters in the guide and the catalog, and the command died."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def main(argv: list[str] | None = None) -> int:
    _utf8_output()
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except (AtechError, PortUnavailableError, KeyError, FileNotFoundError, ValueError) as exc:
        # One line, no traceback: this is what a person or an agent acts on.
        message = exc.args[0] if isinstance(exc, KeyError) and exc.args else exc
        print(f"error: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
