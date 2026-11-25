"""Offline regression tests. HTTP fixtures are simulated servers on loopback."""

from contextlib import contextmanager, redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "studio.py"
SPEC = importlib.util.spec_from_file_location("daftar_studio", SCRIPT)
studio = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = studio
SPEC.loader.exec_module(studio)

VALID = f'''<!doctype html><html lang="en"><head><title>Original test fixture</title></head>
<body><canvas id="world"></canvas><script type="module">
import * as THREE from "{studio.THREE_URL}";
const scene = new THREE.Scene();
// Valid syntax does not imply a successful render: this must never execute.
throw new Error("MUST_NOT_EXECUTE");
</script></body></html>'''


@contextmanager
def local_service(responder):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            requests.append({"path": self.path, "headers": dict(self.headers), "body": body})
            try:
                responder(self)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    worker = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requests
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=1)


def send_bytes(raw: bytes, status: int = 200, **headers):
    def responder(handler):
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(raw)))
        for name, value in headers.items():
            handler.send_header(name, value)
        handler.end_headers()
        handler.wfile.write(raw)
    return responder


def model_response(content: str = VALID, reason="stop", **extra) -> bytes:
    return json.dumps({
        "message": {"role": "assistant", "content": content, "thinking": "PRIVATE_REASONING_DO_NOT_DISPLAY"},
        "done": True, "done_reason": reason, "eval_count": 123, **extra,
    }, separators=(",", ":")).encode()


class StudioTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="daftar-adapter-test-")
        self.root = Path(self.temporary.name)
        self.prompt = self.root / "prompt.txt"
        self.prompt.write_text("An original island with an observatory and orbit controls.\n", encoding="utf-8")

    def tearDown(self):
        self.temporary.cleanup()

    def output(self, name="run"):
        return self.root / name

    def source(self, content=VALID):
        source = self.root / "source.txt"
        source.write_text(content, encoding="utf-8")
        return source

    @unittest.skipUnless(shutil.which("node"), "Node is required for the real syntax-only gate")
    def test_syntax_gate_does_not_execute_or_resolve_module(self):
        report = studio.inspect_html(VALID)
        self.assertEqual(report["status"], "ready_for_browser_review")
        self.assertEqual(report["syntax"]["status"], "passed")
        self.assertFalse(report["browser_rendered"])
        self.assertFalse(report["controls_tested"])
        self.assertEqual(report["safe_to_execute"], "not_asserted")

    @unittest.skipUnless(shutil.which("node"), "Node is required for the real syntax-only gate")
    def test_duplicate_identifiers_fail_syntax(self):
        broken = VALID.replace("const scene = new THREE.Scene();", "const repeated = 1; const repeated = 2;")
        report = studio.inspect_html(broken)
        self.assertEqual(report["status"], "rejected")
        self.assertEqual(report["syntax"]["status"], "failed")
        self.assertEqual(report["findings"][0]["code"], "invalid_javascript")

    def test_missing_node_never_claims_syntax_success(self):
        with mock.patch.object(studio.shutil, "which", return_value=None):
            report = studio.inspect_html(VALID)
        self.assertEqual(report["syntax"]["status"], "unavailable")
        self.assertEqual(report["status"], "rejected")

    def test_incomplete_and_multiple_documents_rejected(self):
        for text in [VALID.replace("</body>", ""), VALID.replace("</html>", ""), VALID + VALID]:
            with self.subTest(text=text[-40:]):
                report = studio.inspect_html(text)
                self.assertEqual(report["status"], "rejected")
                self.assertIn("incomplete_document", [finding["code"] for finding in report["findings"]])

    def test_unsupported_resources_and_dynamic_execution_rejected(self):
        substitutions = [
            VALID.replace(studio.THREE_URL, "https://example.invalid/scene.js"),
            VALID.replace("const scene =", "fetch('https://example.invalid'); const scene ="),
            VALID.replace("const scene =", "import(variable); const scene ="),
            VALID.replace("<canvas id=", "<iframe></iframe><canvas id="),
            VALID.replace("<body>", "<body onload=\"doSomething()\">"),
            VALID.replace("const scene =", "new Function('return 1'); const scene ="),
        ]
        for content in substitutions:
            with self.subTest(content=content[:50]):
                report = studio.inspect_html(content)
                self.assertEqual(report["status"], "rejected")
                self.assertEqual(report["syntax"]["status"], "not_run")

    @unittest.skipUnless(shutil.which("node"), "Node is required for the real syntax-only gate")
    def test_import_preserves_original_exactly_and_separates_derivative(self):
        original = "Some surrounding text.\r\n```html\r\n" + VALID + "\r\n```\r\n"
        source = self.root / "source.txt"
        source.write_bytes(original.encode())
        result = studio.import_response(source, self.output())
        self.assertEqual((self.output() / "original-response.txt").read_bytes(), original.encode())
        self.assertEqual((self.output() / "scene.html").read_bytes(), VALID.encode())
        self.assertEqual(result["status"], "ready_for_browser_review")
        self.assertFalse(result["generation_performed"])
        self.assertFalse(result["model_source"]["runtime_identity_verified"])
        self.assertEqual(result["artifacts"]["original-response.txt"]["sha256"], studio.digest(original.encode()))
        self.assertEqual(json.loads((self.output() / "manifest.json").read_text()), result)

    def test_existing_directory_is_never_overwritten(self):
        out = self.output()
        out.mkdir()
        marker = out / "manifest.json"
        marker.write_text("untouched")
        with self.assertRaises(studio.StudioError) as caught:
            studio.import_response(self.source(), out)
        self.assertEqual(caught.exception.code, "output_exists")
        self.assertEqual(marker.read_text(), "untouched")
        self.assertEqual(len(list(out.iterdir())), 1)

    def test_invalid_utf8_preserved_and_failure_receipt_written(self):
        source = self.root / "bad.txt"
        source.write_bytes(b"\xff\xfe")
        result = studio.import_response(source, self.output())
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["errors"][0]["code"], "invalid_utf8")
        self.assertEqual((self.output() / "original-response.txt").read_bytes(), b"\xff\xfe")
        self.assertTrue((self.output() / "manifest.json").exists())

    def test_only_literal_loopback_http_urls_are_accepted(self):
        for url, expected in [
            ("http://127.0.0.1", ("127.0.0.1", 11434)),
            ("http://localhost:1234/", ("127.0.0.1", 1234)),
            ("http://[::1]:11434", ("::1", 11434)),
        ]:
            self.assertEqual(studio.local_endpoint(url), expected)
        for url in [
            "https://localhost", "http://example.com", "http://127.1", "http://2130706433",
            "http://127.0.0.1.example.com", "http://user:secret@localhost", "http://localhost/api/chat",
            "http://localhost?token=secret", "http://localhost#fragment", "http://localhost.",
            "http://127.0.0.1:65536", "http://localhost:0", "http://localhost:",
            "http://localhost\n", "file:///tmp/server", "http://[::ffff:127.0.0.1]",
        ]:
            with self.subTest(url=url), self.assertRaises(studio.StudioError):
                studio.local_endpoint(url)

    def test_limits_fail_before_request_and_write_failure_manifest(self):
        invalid = [
            {"max_tokens": 0}, {"max_tokens": -1}, {"max_tokens": 16385},
            {"context": 4096, "max_tokens": 4096}, {"context": 65537},
            {"timeout": 0}, {"timeout": float("inf")}, {"timeout": float("nan")}, {"timeout": 301},
            {"max_response_bytes": 0}, {"max_response_bytes": 5_000_001},
            {"seed": -1}, {"endpoint": "http://example.com"},
        ]
        with mock.patch.object(studio, "post_local") as request:
            for index, options in enumerate(invalid):
                with self.subTest(options=options):
                    out = self.output(f"invalid-{index}")
                    result = studio.generate(self.prompt, out, **options)
                    self.assertEqual(result["status"], "failed")
                    self.assertFalse(result["local_request_attempted"])
                    self.assertTrue((out / "manifest.json").exists())
        request.assert_not_called()

    @unittest.skipUnless(shutil.which("node"), "Node is required for the real syntax-only gate")
    def test_mocked_ollama_preserves_raw_bytes_and_hides_reasoning_from_receipt(self):
        raw = model_response()
        with local_service(send_bytes(raw)) as (endpoint, requests):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(result["status"], "ready_for_browser_review")
        self.assertEqual((self.output() / "response.raw").read_bytes(), raw)
        self.assertEqual((self.output() / "original-response.txt").read_bytes(), VALID.encode())
        self.assertNotIn("PRIVATE_REASONING", json.dumps(result))
        self.assertNotIn("PRIVATE_REASONING", (self.output() / "original-response.txt").read_text())
        request = json.loads(requests[0]["body"])
        self.assertEqual(requests[0]["path"], "/api/chat")
        self.assertFalse(request["stream"])
        self.assertEqual(request["options"]["num_predict"], 4096)
        self.assertEqual(request["options"]["num_ctx"], 16384)
        self.assertNotIn("Authorization", requests[0]["headers"])
        self.assertFalse(result["model_source"]["runtime_identity_verified"])

    def test_truncated_generation_is_not_promoted_even_with_closing_html(self):
        raw = model_response(reason="length")
        with local_service(send_bytes(raw)) as (endpoint, _):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["errors"][0]["code"], "incomplete_generation")
        self.assertTrue((self.output() / "original-response.txt").exists())
        self.assertFalse((self.output() / "scene.html").exists())

    def test_unexpected_completion_metadata_is_recorded_as_failure(self):
        with local_service(send_bytes(model_response(reason={"unexpected": "object"}))) as (endpoint, _):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(result["completion"]["done_reason"], "unknown")
        self.assertEqual(result["status"], "failed")
        self.assertTrue((self.output() / "manifest.json").exists())

    def test_redirect_is_never_followed(self):
        raw = b"redirect body"
        with local_service(send_bytes(raw, status=302, Location="http://example.invalid/model")) as (endpoint, requests):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(len(requests), 1)
        self.assertEqual(result["errors"][0]["code"], "redirect_refused")
        self.assertEqual((self.output() / "response.raw").read_bytes(), raw)

    def test_response_byte_limit_preserves_only_unchanged_prefix(self):
        raw = b"a" * 2048
        with local_service(send_bytes(raw)) as (endpoint, _):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2, max_response_bytes=1024)
        self.assertEqual(result["errors"][0]["code"], "response_too_large")
        self.assertEqual((self.output() / "response.raw").read_bytes(), raw[:1024])
        self.assertFalse(result["artifacts"]["response.raw"]["complete"])
        self.assertFalse((self.output() / "scene.html").exists())

    def test_wall_time_limit_stops_a_slow_chunked_response(self):
        def slow(handler):
            handler.send_response(200)
            handler.send_header("Content-Type", "application/json")
            handler.send_header("Transfer-Encoding", "chunked")
            handler.end_headers()
            for _ in range(30):
                handler.wfile.write(b"1\r\na\r\n")
                handler.wfile.flush()
                time.sleep(0.025)
            handler.wfile.write(b"0\r\n\r\n")

        with local_service(slow) as (endpoint, _):
            start = time.monotonic()
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=0.1)
            duration = time.monotonic() - start
        self.assertLess(duration, 0.5)
        self.assertEqual(result["errors"][0]["code"], "generation_timeout")
        self.assertFalse(result["artifacts"]["response.raw"]["complete"])
        self.assertLessEqual((self.output() / "response.raw").stat().st_size, 5)

    def test_invalid_json_has_failure_receipt_and_exact_raw_response(self):
        raw = b'{"message":'
        with local_service(send_bytes(raw)) as (endpoint, _):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(result["errors"][0]["code"], "invalid_response")
        self.assertEqual((self.output() / "response.raw").read_bytes(), raw)

    def test_early_http_eof_is_not_marked_complete_even_when_json_is_valid(self):
        raw = model_response()

        def incomplete(handler):
            handler.send_response(200)
            handler.send_header("Content-Length", str(len(raw) + 20))
            handler.end_headers()
            handler.wfile.write(raw)
            handler.close_connection = True

        with local_service(incomplete) as (endpoint, _):
            result = studio.generate(self.prompt, self.output(), endpoint=endpoint, timeout=2)
        self.assertEqual(result["errors"][0]["code"], "incomplete_http_response")
        self.assertEqual((self.output() / "response.raw").read_bytes(), raw)
        self.assertFalse(result["artifacts"]["response.raw"]["complete"])
        self.assertFalse((self.output() / "scene.html").exists())

    def test_cli_prints_receipt_and_nonzero_status_without_source(self):
        source = self.source("PRIVATE_INPUT_WITHOUT_HTML")
        captured = io.StringIO()
        with redirect_stdout(captured):
            status = studio.main(["inspect", str(source)])
        result = json.loads(captured.getvalue())
        self.assertEqual(status, 1)
        self.assertEqual(result["status"], "rejected")
        self.assertNotIn("PRIVATE_INPUT", captured.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
