#!/usr/bin/env python3
"""Bounded local generation and non-executing scene inspection for Daftar.

No command installs a runtime, downloads weights, or starts a model. ``generate``
contacts an already-running Ollama service on a literal loopback address. Source
inspection runs ``node --check`` only; it never renders or executes the scene.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import http.client
import json
import math
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlsplit


MODEL = "hf.co/ccore/Qwen3.5-4B-3D-Coder:Q4_K_M"
SOURCE_REVISION = "4b9f05f3a0382725b679c5e32a338b88acaf0064"
Q4_SHA256 = "32c37c83d3ca055d30aefa679f1a1670d3e2eb889ee7cc805792d53f219cfae8"
THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js"
MAX_BYTES = 5_000_000
MAX_PROMPT_BYTES = 65_536
MAX_TOKENS = 16_384
MAX_CONTEXT = 65_536
MAX_TIMEOUT = 300.0
SYSTEM_PROMPT = (
    "Return one complete HTML document for a Three.js scene, with explicit "
    "head and body closing tags. Use only the core ES module at " + THREE_URL + ". "
    "Implement camera controls in the document. Do not use other imports, "
    "external assets, addons, or network requests. Bound geometry and animation "
    "work. Return final HTML only."
)


class StudioError(Exception):
    """An expected failure with a stable, non-source-bearing description."""

    def __init__(self, code: str, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def bounded_int(value: int | str, name: str, ceiling: int) -> int:
    if isinstance(value, bool):
        raise StudioError("invalid_limit", f"{name} must be an integer from 1 to {ceiling}.")
    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise StudioError("invalid_limit", f"{name} must be an integer from 1 to {ceiling}.") from exc
    if str(number) != str(value).strip() or not 1 <= number <= ceiling:
        raise StudioError("invalid_limit", f"{name} must be an integer from 1 to {ceiling}.")
    return number


def bounded_timeout(value: float | str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise StudioError("invalid_limit", f"timeout must be positive and at most {MAX_TIMEOUT:g} seconds.") from exc
    if isinstance(value, bool) or not math.isfinite(number) or not 0 < number <= MAX_TIMEOUT:
        raise StudioError("invalid_limit", f"timeout must be positive and at most {MAX_TIMEOUT:g} seconds.")
    return number


def local_endpoint(endpoint: str) -> tuple[str, int]:
    """Resolve no DNS: the accepted localhost spelling maps directly to IPv4."""
    if not isinstance(endpoint, str) or any(ord(char) < 33 for char in endpoint):
        raise StudioError("invalid_endpoint", "Use a literal loopback HTTP base URL without credentials or a path.")
    try:
        parsed = urlsplit(endpoint)
        port = 11434 if parsed.port is None else parsed.port
        host = parsed.hostname
    except ValueError as exc:
        raise StudioError("invalid_endpoint", "The local endpoint URL is malformed.") from exc
    if (
        parsed.scheme != "http"
        or host not in {"127.0.0.1", "::1", "localhost"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
        or parsed.netloc.endswith(":")
        or not 1 <= port <= 65535
    ):
        raise StudioError("invalid_endpoint", "Only http://127.0.0.1, http://[::1], or http://localhost base URLs are accepted.")
    return ("127.0.0.1" if host == "localhost" else host), port


def read_bounded(path: Path, limit: int) -> bytes:
    try:
        with path.open("rb") as handle:
            data = handle.read(limit + 1)
    except OSError as exc:
        raise StudioError("input_unavailable", "The input file could not be read.") from exc
    if len(data) > limit:
        raise StudioError("input_too_large", f"The input exceeds the {limit}-byte limit.")
    return data


def decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise StudioError("invalid_utf8", "The input must contain UTF-8 text.") from exc


def extract_html(content: str) -> str:
    """Extract a document while preserving the unchanged response separately."""
    start = re.search(r"<!doctype\s+html\b[^>]*>\s*<html\b|<html\b", content, re.I)
    endings = list(re.finditer(r"</html\s*>", content, re.I))
    if start is None or not endings or endings[-1].end() <= start.start():
        raise StudioError("incomplete_document", "A complete HTML document with a closing html tag is required.")
    return content[start.start():endings[-1].end()]


@dataclass
class Script:
    kind: str
    source: str | None
    text: str = ""


class SceneParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.starts: dict[str, int] = {}
        self.ends: dict[str, int] = {}
        self.scripts: list[Script] = []
        self.current_script: Script | None = None
        self.findings: list[dict[str, str]] = []

    def flag(self, code: str, detail: str) -> None:
        finding = {"code": code, "detail": detail}
        if finding not in self.findings:
            self.findings.append(finding)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.starts[tag] = self.starts.get(tag, 0) + 1
        attributes = {name.lower(): value or "" for name, value in attrs}
        if tag == "script":
            kind = attributes.get("type", "").lower()
            self.current_script = Script(kind, attributes.get("src"))
            self.scripts.append(self.current_script)
            if self.current_script.source and self.current_script.source != THREE_URL:
                self.flag("unsupported_dependency", "An external script is outside the pinned Three.js allowlist.")
        if tag in {"base", "iframe", "object", "embed"}:
            self.flag("unsupported_element", f"The {tag} element is outside the standalone-scene profile.")
        if tag == "meta" and attributes.get("http-equiv", "").lower() == "refresh":
            self.flag("navigation", "Refresh navigation is outside the standalone-scene profile.")
        if any(name.startswith("on") for name in attributes):
            self.flag("inline_handler", "Inline event attributes are not covered by the script syntax gate; use listeners in scripts.")
        for name in ("src", "srcset", "poster", "data", "href"):
            value = attributes.get(name)
            if not value or (tag == "script" and name == "src") or (tag == "a" and name == "href"):
                continue
            if not value.startswith(("#", "data:")):
                self.flag("unsupported_dependency", "A resource outside the self-contained document was found.")

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag: str) -> None:
        self.ends[tag] = self.ends.get(tag, 0) + 1
        if tag == "script":
            self.current_script = None

    def handle_data(self, data: str) -> None:
        if self.current_script is not None:
            self.current_script.text += data


IMPORT_PATTERNS = (
    re.compile(r"\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?[\"']([^\"']+)[\"']"),
    re.compile(r"\bimport\s*\(\s*[\"']([^\"']+)[\"']\s*\)"),
)


def inspect_html(content: str, *, syntax_budget: float = 10.0) -> dict:
    """Conservative dependency checks plus parsing; never execute JavaScript.

    Dependency checks are lexical and can reject harmless comments/strings. They
    are deliberately not described as a security proof or as browser testing.
    """
    report = {
        "status": "rejected",
        "source_bytes": len(content.encode("utf-8")),
        "source_sha256": digest(content.encode("utf-8")),
        "document_complete": False,
        "dependency_profile": "threejs-core-0.160.0-only",
        "dependency_check": "lexical_not_a_security_proof",
        "syntax": {"status": "not_run", "method": "node --check; no execution", "scripts_checked": 0},
        "browser_rendered": False,
        "controls_tested": False,
        "visual_review": "not_run",
        "safe_to_execute": "not_asserted",
        "findings": [],
    }
    if report["source_bytes"] > MAX_BYTES:
        report["findings"].append({"code": "input_too_large", "detail": "The scene exceeds the input limit."})
        return report
    try:
        document = extract_html(content)
    except StudioError as exc:
        report["findings"].append({"code": exc.code, "detail": exc.detail})
        return report
    parser = SceneParser()
    try:
        parser.feed(document)
        parser.close()
    except Exception:
        report["findings"].append({"code": "invalid_html", "detail": "The HTML parser could not read the scene."})
        return report
    complete = all(parser.starts.get(tag) == 1 and parser.ends.get(tag) == 1 for tag in ("html", "head", "body"))
    if not complete or parser.current_script is not None:
        parser.flag("incomplete_document", "Use one complete html/head/body document with closed script elements.")
    report["document_complete"] = complete and parser.current_script is None
    report["extracted_sha256"] = digest(document.encode("utf-8"))
    report["inline_scripts"] = len([script for script in parser.scripts if not script.source])
    if len(parser.scripts) > 64:
        parser.flag("script_limit", "At most 64 script elements are allowed in an inspected scene.")
    executable: list[Script] = []
    for script in parser.scripts[:64]:
        if script.source:
            continue
        if script.kind == "importmap":
            try:
                mapping = json.loads(script.text)
                if set(mapping) != {"imports"} or not isinstance(mapping["imports"], dict) or any(
                    target != THREE_URL for target in mapping["imports"].values()
                ):
                    raise ValueError("unsupported import map")
            except (ValueError, TypeError, KeyError):
                parser.flag("unsupported_dependency", "Only import maps targeting the pinned Three.js module are supported.")
            # Bare imports are still conservatively rejected below. Prefer the exact URL.
            continue
        if script.kind in {"application/json", "application/ld+json"}:
            try:
                json.loads(script.text)
            except ValueError:
                parser.flag("invalid_json", "A JSON script element contains invalid JSON.")
            continue
        if script.kind not in {"", "module", "text/javascript", "application/javascript"}:
            parser.flag("unsupported_script_type", "A script type outside JavaScript, import maps, or JSON was found.")
            continue
        executable.append(script)
        imports = [match.group(1) for pattern in IMPORT_PATTERNS for match in pattern.finditer(script.text)]
        if any(target != THREE_URL for target in imports):
            parser.flag("unsupported_dependency", "A module import is outside the pinned Three.js allowlist.")
        if re.search(r"\bimport\s*\((?!\s*[\"'])", script.text):
            parser.flag("computed_import", "Computed imports cannot be verified by this static profile.")
        if re.search(r"\b(?:fetch|XMLHttpRequest|WebSocket|Worker|SharedWorker|importScripts|require)\s*\(|\bsendBeacon\s*\(", script.text):
            parser.flag("unsupported_dependency", "A network, worker, or CommonJS API is outside the standalone-scene profile.")
        if re.search(r"\beval\s*\(|\bnew\s+Function\s*\(", script.text):
            parser.flag("dynamic_code", "Dynamic code generation cannot be inspected by this syntax gate.")
    for match in re.finditer(r"url\(\s*[\"']?([^\)\"']+)", document, re.I):
        if not match.group(1).strip().startswith(("data:", "#")):
            parser.flag("unsupported_dependency", "A CSS resource is outside the self-contained document.")
    if not executable:
        parser.flag("missing_script", "No inline JavaScript scene code was found.")
    report["findings"] = parser.findings
    if parser.findings:
        return report
    node = shutil.which("node")
    if not node:
        report["syntax"]["status"] = "unavailable"
        report["findings"].append({"code": "node_unavailable", "detail": "Install Node separately before claiming syntax verification; this command installs nothing."})
        return report
    deadline = time.monotonic() + max(0.01, min(float(syntax_budget), 30.0))
    with tempfile.TemporaryDirectory(prefix="daftar-scene-syntax-") as directory:
        for index, script in enumerate(executable):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                report["syntax"]["status"] = "timed_out"
                report["findings"].append({"code": "syntax_timeout", "detail": "The total syntax inspection budget expired."})
                return report
            suffix = ".mjs" if script.kind == "module" else ".cjs"
            path = Path(directory) / f"script-{index}{suffix}"
            path.write_text(script.text, encoding="utf-8")
            try:
                # Empty environment excludes NODE_OPTIONS / NODE_PATH preloads.
                checked = subprocess.run(
                    [node, "--check", str(path)], capture_output=True,
                    timeout=min(remaining, 5.0), cwd=directory, env={}, check=False,
                )
            except subprocess.TimeoutExpired:
                report["syntax"]["status"] = "timed_out"
                report["findings"].append({"code": "syntax_timeout", "detail": "A script exceeded the syntax inspection budget."})
                return report
            except OSError:
                report["syntax"]["status"] = "unavailable"
                report["findings"].append({"code": "node_unavailable", "detail": "Node could not run the syntax check."})
                return report
            report["syntax"]["scripts_checked"] += 1
            if checked.returncode:
                report["syntax"]["status"] = "failed"
                report["findings"].append({"code": "invalid_javascript", "detail": f"Node rejected script {index + 1}; inspect the preserved source. No script was executed."})
                return report
    report["syntax"]["status"] = "passed"
    report["status"] = "ready_for_browser_review"
    return report


@dataclass
class Exchange:
    raw: bytes = b""
    status_code: int | None = None
    complete: bool = False
    error: dict[str, str] | None = None


def post_local(endpoint: str, payload: dict, timeout: float, max_response_bytes: int) -> Exchange:
    """No proxies, DNS, redirects, or authentication. A watchdog bounds wall time."""
    host, port = local_endpoint(endpoint)
    timeout = bounded_timeout(timeout)
    cap = bounded_int(max_response_bytes, "max-response-bytes", MAX_BYTES)
    exchange = Exchange()
    connection = http.client.HTTPConnection(host, port, timeout=timeout)
    started = time.monotonic()
    expired = threading.Event()
    connected_socket: list[socket.socket] = []

    def interrupt() -> None:
        expired.set()
        for active in connected_socket:
            try:
                active.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
        # Shutdown interrupts a blocked read. Do not concurrently close the
        # HTTPResponse's file object while http.client is parsing chunk headers.

    watchdog = threading.Timer(timeout, interrupt)
    watchdog.daemon = True
    watchdog.start()
    try:
        connection.connect()
        if expired.is_set():
            raise TimeoutError()
        if connection.sock is not None:
            connected_socket.append(connection.sock)
            connection.sock.settimeout(max(0.001, timeout - (time.monotonic() - started)))
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        connection.request("POST", "/api/chat", body, {
            "Content-Type": "application/json", "Accept": "application/json",
            "Accept-Encoding": "identity", "Connection": "close",
        })
        response = connection.getresponse()
        exchange.status_code = response.status
        chunks: list[bytes] = []
        size = 0
        while True:
            if expired.is_set() or time.monotonic() - started >= timeout:
                raise TimeoutError()
            chunk = response.read1(min(65_536, cap + 1 - size))
            if not chunk:
                if response.length not in {None, 0}:
                    exchange.error = {"code": "incomplete_http_response", "detail": "The response ended before its declared byte count; its unchanged prefix was preserved."}
                else:
                    exchange.complete = True
                break
            chunks.append(chunk)
            size += len(chunk)
            exchange.raw = b"".join(chunks)[:cap]
            if size > cap:
                exchange.error = {"code": "response_too_large", "detail": f"The response exceeded {cap} bytes; only its unchanged prefix was preserved."}
                break
        if expired.is_set():
            raise TimeoutError()
        if exchange.error is None and response.status != 200:
            exchange.error = {"code": "redirect_refused" if 300 <= response.status < 400 else "http_error", "detail": "The local service returned a non-success status; no redirect was followed."}
        if exchange.error is None and response.getheader("Content-Encoding", "identity").lower() != "identity":
            exchange.error = {"code": "unsupported_encoding", "detail": "The local service returned an unexpected content encoding."}
    except (TimeoutError, socket.timeout):
        exchange.complete = False
        exchange.error = {"code": "generation_timeout", "detail": "The local request exceeded its wall-time budget."}
    except (OSError, http.client.HTTPException):
        exchange.complete = False
        exchange.error = {"code": "generation_timeout" if expired.is_set() else "local_service_error", "detail": "The bounded local request failed; no remote service was contacted."}
    finally:
        watchdog.cancel()
        connection.close()
    return exchange


def new_run(out: Path, operation: str) -> dict:
    try:
        out.mkdir(parents=True, exist_ok=False)
    except FileExistsError as exc:
        raise StudioError("output_exists", "Choose a new output directory; existing runs are never overwritten.") from exc
    except OSError as exc:
        raise StudioError("output_unavailable", "The output directory could not be created.") from exc
    return {
        "schema_version": 1,
        "operation": operation,
        "started_at": timestamp(),
        "status": "failed",
        "model_source": {
            "repository": "https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder",
            "revision": SOURCE_REVISION,
            "expected_q4_sha256": Q4_SHA256,
            "license": "Apache-2.0",
            "runtime_identity_verified": False,
            "identity_note": "The source revision is pinned metadata. A mutable Ollama name does not verify installed weights; obtain a matching local artifact receipt before claiming the checkpoint was executed.",
        },
        "artifacts": {},
        "errors": [],
        "browser_rendered": False,
        "controls_tested": False,
        "visual_review": "not_run",
    }


def put_artifact(out: Path, manifest: dict, name: str, data: bytes, **metadata) -> None:
    with (out / name).open("xb") as handle:
        handle.write(data)
    manifest["artifacts"][name] = {"bytes": len(data), "sha256": digest(data), **metadata}


def finish(out: Path, manifest: dict) -> dict:
    manifest["finished_at"] = timestamp()
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


def inspect_and_store(content: str, out: Path, manifest: dict) -> None:
    inspection = inspect_html(content)
    manifest["inspection"] = inspection
    try:
        scene = extract_html(content)
        put_artifact(out, manifest, "scene.html", scene.encode("utf-8"), derivative=True, executable_review_required=True)
    except StudioError:
        pass
    manifest["status"] = inspection["status"]
    if manifest["status"] != "ready_for_browser_review":
        manifest["errors"].extend(inspection["findings"])


def import_response(source: Path, out: Path) -> dict:
    manifest = new_run(out, "import")
    manifest["generation_performed"] = False
    manifest["origin"] = "user_supplied_output; model provenance unverified"
    try:
        data = read_bounded(source, MAX_BYTES)
        put_artifact(out, manifest, "original-response.txt", data, complete=True, modified=False)
        inspect_and_store(decode_text(data), out, manifest)
    except StudioError as exc:
        manifest["errors"].append({"code": exc.code, "detail": exc.detail})
    return finish(out, manifest)


def generate(
    prompt_file: Path, out: Path, *, endpoint: str = "http://127.0.0.1:11434",
    model: str = MODEL, max_tokens: int = 4096, context: int = 16384,
    timeout: float = 120.0, max_response_bytes: int = MAX_BYTES, seed: int = 1729,
) -> dict:
    manifest = new_run(out, "generate")
    manifest["local_request_attempted"] = False
    manifest["final_content_received"] = False
    try:
        local_endpoint(endpoint)
        max_tokens = bounded_int(max_tokens, "max-tokens", MAX_TOKENS)
        context = bounded_int(context, "context", MAX_CONTEXT)
        max_response_bytes = bounded_int(max_response_bytes, "max-response-bytes", MAX_BYTES)
        timeout = bounded_timeout(timeout)
        if context <= max_tokens:
            raise StudioError("invalid_limit", "Context must exceed the output-token budget, leaving room for the prompt.")
        if not isinstance(model, str) or not model.strip() or len(model) > 256 or any(ord(char) < 33 for char in model):
            raise StudioError("invalid_model", "Use a nonempty local model name without whitespace, at most 256 characters.")
        if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 2**31 - 1:
            raise StudioError("invalid_limit", "seed must be an integer from 0 to 2147483647.")
        prompt_bytes = read_bounded(prompt_file, MAX_PROMPT_BYTES)
        prompt = decode_text(prompt_bytes)
        if not prompt.strip():
            raise StudioError("empty_prompt", "The prompt must contain text.")
        put_artifact(out, manifest, "prompt.txt", prompt_bytes, modified=False)
        payload = {
            "model": model, "stream": False,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
            "options": {"num_predict": max_tokens, "num_ctx": context, "temperature": 0.6, "top_p": 0.9, "top_k": 20, "repeat_penalty": 1.0, "seed": seed},
        }
        manifest["request"] = {
            "endpoint": endpoint, "model": model, "options": payload["options"],
            "timeout_seconds": timeout, "max_response_bytes": max_response_bytes,
            "system_prompt_sha256": digest(SYSTEM_PROMPT.encode("utf-8")),
        }
        manifest["local_request_attempted"] = True
        exchange = post_local(endpoint, payload, timeout, max_response_bytes)
        put_artifact(out, manifest, "response.raw", exchange.raw, complete=exchange.complete, modified=False,
                     note="Unchanged local-service response bytes; may contain private provider reasoning. Do not publish automatically.")
        manifest["http_status"] = exchange.status_code
        if exchange.error:
            manifest["errors"].append(exchange.error)
            return finish(out, manifest)
        try:
            response = json.loads(decode_text(exchange.raw))
        except (ValueError, StudioError):
            raise StudioError("invalid_response", "The service did not return a complete UTF-8 JSON response.")
        if not isinstance(response, dict) or not isinstance(response.get("message"), dict) or not isinstance(response["message"].get("content"), str):
            raise StudioError("invalid_response", "The service response has no final message content.")
        content = response["message"]["content"]
        manifest["final_content_received"] = True
        put_artifact(out, manifest, "original-response.txt", content.encode("utf-8"), complete=True, modified=False,
                     note="Final message content only; separate reasoning fields are not copied here.")
        reason = response.get("done_reason")
        manifest["completion"] = {
            "done": response.get("done") is True,
            "done_reason": reason if isinstance(reason, str) and reason in {"stop", "length", "load", "unload"} else "unknown",
            "eval_count": response.get("eval_count") if type(response.get("eval_count")) is int else None,
        }
        if response.get("done") is not True or reason != "stop":
            raise StudioError("incomplete_generation", "The model did not report a normal completed stop; no scene was promoted for review.")
        inspect_and_store(content, out, manifest)
    except StudioError as exc:
        manifest["errors"].append({"code": exc.code, "detail": exc.detail})
    return finish(out, manifest)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    subcommands = parser.add_subparsers(dest="command", required=True)
    inspect_parser = subcommands.add_parser("inspect", help="Check complete HTML, dependency profile, and JavaScript syntax without execution.")
    inspect_parser.add_argument("source", type=Path)
    import_parser = subcommands.add_parser("import", help="Preserve an output and create a separate inspected HTML artifact in a new directory.")
    import_parser.add_argument("source", type=Path)
    import_parser.add_argument("--out", type=Path, required=True)
    generate_parser = subcommands.add_parser("generate", help="Call an already-running local Ollama service within explicit finite limits.")
    generate_parser.add_argument("--prompt-file", type=Path, required=True)
    generate_parser.add_argument("--out", type=Path, required=True)
    generate_parser.add_argument("--endpoint", default="http://127.0.0.1:11434")
    generate_parser.add_argument("--model", default=MODEL)
    generate_parser.add_argument("--max-tokens", type=int, default=4096)
    generate_parser.add_argument("--context", type=int, default=16384)
    generate_parser.add_argument("--timeout", type=float, default=120.0)
    generate_parser.add_argument("--max-response-bytes", type=int, default=MAX_BYTES)
    generate_parser.add_argument("--seed", type=int, default=1729)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "inspect":
            result = inspect_html(decode_text(read_bounded(args.source, MAX_BYTES)))
        elif args.command == "import":
            result = import_response(args.source, args.out)
        else:
            result = generate(args.prompt_file, args.out, endpoint=args.endpoint, model=args.model,
                              max_tokens=args.max_tokens, context=args.context, timeout=args.timeout,
                              max_response_bytes=args.max_response_bytes, seed=args.seed)
        # Prints receipts and bounded diagnostics, never original output or reasoning.
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0 if result["status"] == "ready_for_browser_review" else 1
    except StudioError as exc:
        print(json.dumps({"status": "failed", "errors": [{"code": exc.code, "detail": exc.detail}]}))
        return 2
    except OSError:
        print(json.dumps({"status": "failed", "errors": [{"code": "artifact_io_error", "detail": "A run artifact could not be written; inspect the new run directory before retrying elsewhere."}]}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
