"""``atech view``: a local web page that shows a project's board in 3D, live.

A stdlib HTTP server on 127.0.0.1. It serves the page (``static/``, three.js vendored,
nothing from the network), the bundled GLBs (``glb/``), ``scene.json`` (computed from
``project.yaml`` by :mod:`atech.view.scene` on every request) and ``events``, a
Server-Sent Events stream that says ``changed`` whenever ``project.yaml`` or a custom
module folder changes, so the page redraws while an agent edits the project.

One viewer per project: ``atech view`` first asks the viewers already on
:data:`DEFAULT_PORTS` (``whoami``) whether one serves this ``project.yaml``. If one
does, it starts nothing and returns, opening a tab only when no page is connected.
So an agent can run it after every change without piling up servers and tabs.

It never opens a serial port, so it can run beside ``atech monitor`` or ``upload``.
"""

from __future__ import annotations

import json
import mimetypes
import os
import re
import select
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib import resources
from pathlib import Path
from typing import Any

from atech.view.scene import build_scene, glb_dir

#: Tried in order, so a reloaded tab and a bookmark usually find the viewer again.
DEFAULT_PORTS = range(8740, 8750)
POLL_S = 0.3
HEARTBEAT_S = 15.0
#: How soon a closed tab stops counting as an open page.
PAGE_CHECK_S = 0.5
#: Told to the page: reconnect this soon after the server goes, so a restarted
#: viewer finds its old tab again instead of opening a second one.
RECONNECT_MS = 1000
#: How long a fresh viewer waits for such a tab before it opens one.
REATTACH_S = 1.5
_GLB_NAME = re.compile(r"^[a-z0-9-]+\.glb$")


def static_dir() -> Path:
    return Path(str(resources.files("atech.view") / "static"))


def project_file(project_dir: Path | str) -> Path:
    p = Path(project_dir).expanduser().resolve()
    return p / "project.yaml" if p.is_dir() else p


class Watcher:
    """Polls ``project.yaml`` and the project's custom module folders; counts changes."""

    def __init__(self, project_yaml: Path) -> None:
        self.project_yaml = project_yaml
        self.version = 0
        self.pages = 0  # pages connected to /events right now
        self._cond = threading.Condition()
        self._signature = self._sign()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, name="atech-view-watch", daemon=True)

    def _module_dirs(self) -> list[Path]:
        try:
            from atech.project import Project

            return [Path(p) for p in Project.load(self.project_yaml).extra_module_paths]
        except Exception:
            return []

    def _sign(self) -> tuple:
        files = [self.project_yaml]
        for d in self._module_dirs():
            if d.is_dir():
                files.extend(sorted(f for f in d.rglob("*") if f.is_file()))
        out = []
        for f in files:
            try:
                st = f.stat()
                out.append((str(f), st.st_mtime_ns, st.st_size))
            except OSError:
                out.append((str(f), None, None))
        return tuple(out)

    def _run(self) -> None:
        while not self._stop.wait(POLL_S):
            sig = self._sign()
            if sig != self._signature:
                self._signature = sig
                with self._cond:
                    self.version += 1
                    self._cond.notify_all()

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        with self._cond:
            self._cond.notify_all()

    def wait(self, seen: int, timeout: float) -> int:
        """Block until the version moves past ``seen`` (or ``timeout``); return it."""
        with self._cond:
            self._cond.wait_for(lambda: self.version != seen or self._stop.is_set(), timeout)
            return self.version


def _handler(project_yaml: Path, watcher: Watcher) -> type[BaseHTTPRequestHandler]:
    static = static_dir().resolve()
    glbs = glb_dir().resolve()

    class Handler(BaseHTTPRequestHandler):
        server_version = "atech-view"

        def log_message(self, fmt: str, *args: Any) -> None:  # quiet: the terminal is the agent's
            pass

        def _send(self, status: int, body: bytes, ctype: str, cache: bool = False) -> None:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "max-age=3600" if cache else "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _file(self, root: Path, rel: str, cache: bool) -> None:
            path = (root / rel).resolve()
            if root not in path.parents or not path.is_file():
                self._send(HTTPStatus.NOT_FOUND, b"not found", "text/plain")
                return
            ctype = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            if path.suffix == ".js":
                ctype = "text/javascript"
            elif path.suffix == ".glb":
                ctype = "model/gltf-binary"
            self._send(HTTPStatus.OK, path.read_bytes(), ctype, cache)

        def do_GET(self) -> None:  # noqa: N802 (http.server's name)
            # Only a page on this machine's own name may read the project: a web page
            # that rebinds its domain to 127.0.0.1 still sends its own Host header.
            host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
            if host not in ("127.0.0.1", "localhost", "::1"):
                self._send(HTTPStatus.FORBIDDEN, b"forbidden", "text/plain")
                return
            path = self.path.split("?", 1)[0]
            if path in ("/", "/index.html"):
                self._file(static, "index.html", cache=False)
            elif path == "/scene.json":
                scene = build_scene(project_yaml)
                scene["version"] = watcher.version
                scene["path"] = str(project_yaml)
                self._send(HTTPStatus.OK, json.dumps(scene).encode(), "application/json")
            elif path == "/events":
                self._events()
            elif path == "/whoami":
                me = {"atech_view": 1, "project": str(project_yaml), "pid": os.getpid(),
                      "pages": watcher.pages}
                self._send(HTTPStatus.OK, json.dumps(me).encode(), "application/json")
            elif path.startswith("/glb/") and _GLB_NAME.match(path[5:]):
                self._file(glbs, path[5:], cache=True)
            elif path.startswith("/static/"):
                self._file(static, path[len("/static/"):], cache=False)
            else:
                self._send(HTTPStatus.NOT_FOUND, b"not found", "text/plain")

        def _page_closed(self) -> bool:
            """A page never sends anything on /events: the socket turning readable means
            the tab closed it. A write would only notice one or two heartbeats later."""
            try:
                readable, _, _ = select.select([self.connection], [], [], 0)
                return bool(readable) and self.connection.recv(1, socket.MSG_PEEK) == b""
            except OSError:
                return True

        def _events(self) -> None:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            seen = watcher.version
            with watcher._cond:
                watcher.pages += 1
            try:
                self.wfile.write(f"retry: {RECONNECT_MS}\ndata: {seen}\n\n".encode())
                self.wfile.flush()
                quiet_since = time.monotonic()
                while True:
                    now = watcher.wait(seen, PAGE_CHECK_S)
                    if watcher._stop.is_set() or self._page_closed():
                        return
                    if now != seen:
                        seen = now
                        self.wfile.write(f"data: {now}\n\n".encode())
                    elif time.monotonic() - quiet_since >= HEARTBEAT_S:
                        self.wfile.write(b": ping\n\n")
                    else:
                        continue
                    self.wfile.flush()
                    quiet_since = time.monotonic()
            except (BrokenPipeError, ConnectionResetError, OSError):
                return
            finally:
                with watcher._cond:
                    watcher.pages -= 1

    return Handler


def _bind(host: str, port: int | None, handler: type[BaseHTTPRequestHandler]) -> ThreadingHTTPServer:
    if port is not None:
        return ThreadingHTTPServer((host, port), handler)
    for candidate in DEFAULT_PORTS:
        try:
            return ThreadingHTTPServer((host, candidate), handler)
        except OSError:
            continue
    return ThreadingHTTPServer((host, 0), handler)


def find_running(project_yaml: Path, host: str = "127.0.0.1",
                 ports: list[int] | range = DEFAULT_PORTS) -> tuple[str, dict] | None:
    """The URL and ``whoami`` of a viewer already serving ``project_yaml``, or None."""
    for candidate in ports:
        url = f"http://{host}:{candidate}/"
        try:
            with urllib.request.urlopen(url + "whoami", timeout=0.5) as r:
                me = json.loads(r.read())
        except Exception:
            continue  # nothing there, or not a viewer
        if isinstance(me, dict) and me.get("atech_view") and me.get("project") == str(project_yaml):
            return url, me
    return None


def _can_open_browser() -> bool:
    """On Linux with no display, ``webbrowser`` would fall back to a text browser in
    this very terminal; print the URL instead."""
    if sys.platform.startswith("linux"):
        return bool(os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
    return True


def serve(project_dir: Path | str, *, host: str = "127.0.0.1", port: int | None = None,
          open_browser: bool = True) -> int:
    """Serve the viewer until Ctrl-C. Returns the exit code."""
    project_yaml = project_file(project_dir)
    if not project_yaml.is_file():
        print(f"error: no project.yaml at {project_yaml}", file=sys.stderr)
        return 1
    ports = list(DEFAULT_PORTS) + ([port] if port is not None and port not in DEFAULT_PORTS else [])
    running = find_running(project_yaml, host, ports)
    if running:
        return _reuse(project_yaml, *running, open_browser=open_browser)

    watcher = Watcher(project_yaml)
    try:
        server = _bind(host, port, _handler(project_yaml, watcher))
    except OSError as exc:
        print(f"error: cannot listen on {host}:{port}: {exc}", file=sys.stderr)
        return 1
    server.daemon_threads = True
    url = f"http://{host}:{server.server_address[1]}/"
    watcher.start()

    first = build_scene(project_yaml)
    print(f"viewing {project_yaml}")
    print(f"open {url}   (redraws when project.yaml changes; Ctrl-C stops it)")
    if "error" in first:
        print(f"note: the project does not load yet: {first['error']}")
    elif first["issues"]:
        print(f"note: {len(first['issues'])} placement issue(s); the page lists them (`atech validate` too)")
    sys.stdout.flush()

    if open_browser and _can_open_browser():
        threading.Thread(target=_open_unless_reattached, args=(url, watcher), daemon=True).start()
    try:
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        pass
    finally:
        watcher.stop()
        server.server_close()
    return 0


def _reuse(project_yaml: Path, url: str, me: dict, *, open_browser: bool) -> int:
    """A viewer already serves this project: say so, and bring a page back if none is open."""
    pid = me.get("pid")
    print(f"already viewing {project_yaml} (pid {pid}; `kill {pid}` stops it)")
    if me.get("pages"):
        print(f"open {url}   (the page there is open and has redrawn by itself)")
    elif open_browser and _can_open_browser():
        _open(url)
        print(f"open {url}   (no page was open there: opened one)")
    else:
        print(f"open {url}   (no page is open there)")
    return 0


def _open_unless_reattached(url: str, watcher: Watcher) -> None:
    """A tab left by an earlier viewer on this URL reconnects by itself; open one only
    if none does."""
    deadline = time.monotonic() + REATTACH_S
    while time.monotonic() < deadline:
        if watcher.pages:
            return
        time.sleep(0.1)
    _open(url)


def _open(url: str) -> None:
    try:
        webbrowser.open(url, new=2)
    except Exception:
        pass
