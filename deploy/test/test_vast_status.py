# deploy/test/test_vast_status.py
import importlib.util
import io
import json
import os
import tempfile
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(HERE, "..", "vast-status.py")
spec = importlib.util.spec_from_file_location("vast_status", PATH)
vs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vs)

KEY = "k" * 40


def make_transport(status=200, body=None, record=None):
    if body is None:
        body = b"{}"
    if not isinstance(body, bytes):
        body = json.dumps(body).encode()

    def t(url, headers, timeout, max_bytes):
        if record is not None:
            record.append((url, headers, timeout, max_bytes))
        return status, body
    return t


def payload(**over):
    inst = {"id": 7, "actual_status": "running", "intended_status": "running",
            "gpu_name": "RTX 4090", "gpu_ram": 24000, "num_gpus": 1,
            "cpu_name": "EPYC", "cpu_cores": 16, "cpu_ram": 64000,
            "disk_space": 100.5, "ssh_host": "ssh1.vast.ai", "ssh_port": 2222,
            "public_ipaddr": "1.2.3.4", "jupyter_token": "SECRETTOKEN",
            "extra_env": {"A": "SECRETENV"}}
    inst.update(over)
    return {"success": True, "instances_found": 1, "total_instances": 1,
            "next_token": None, "instances": [inst]}


class KeyFileTests(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.addCleanup(self.d.cleanup)

    def write(self, content=KEY + "\n", mode=0o600, name="key"):
        p = os.path.join(self.d.name, name)
        with open(p, "w") as f:
            f.write(content)
        os.chmod(p, mode)
        return p

    def test_valid(self):
        self.assertEqual(vs.read_api_key(self.write()), KEY)
        self.assertEqual(vs.read_api_key(self.write(mode=0o400, name="k2")), KEY)

    def test_bad_mode(self):
        with self.assertRaises(vs.CliError):
            vs.read_api_key(self.write(mode=0o644))

    def test_symlink(self):
        p = self.write()
        link = os.path.join(self.d.name, "link")
        os.symlink(p, link)
        with self.assertRaises(vs.CliError):
            vs.read_api_key(link)

    def test_relative(self):
        with self.assertRaises(vs.CliError):
            vs.read_api_key("relative/key")

    def test_too_long_file(self):
        with self.assertRaises(vs.CliError):
            vs.read_api_key(self.write(content="a" * 600))

    def test_bad_format(self):
        for c in ("short\n", "a" * 40 + " b\n", "a" * 40 + "\nextra\n", "a" * 39 + "$\n"):
            with self.assertRaises(vs.CliError):
                vs.read_api_key(self.write(content=c))

    def test_directory(self):
        with self.assertRaises(vs.CliError):
            vs.read_api_key(self.d.name)


class FetchTests(unittest.TestCase):
    def test_request_shape(self):
        rec = []
        vs.fetch_instances(KEY, make_transport(body=payload(), record=rec))
        url, headers, timeout, mx = rec[0]
        self.assertEqual(url, "https://console.vast.ai/api/v1/instances/")
        self.assertEqual(headers["Authorization"], "Bearer " + KEY)
        self.assertEqual(timeout, 20)
        self.assertEqual(mx, 2 * 1024 * 1024)

    def test_malformed_json(self):
        with self.assertRaises(vs.CliError):
            vs.fetch_instances(KEY, make_transport(body=b"{not json"))

    def test_bad_schema(self):
        for b in (b"[]", b'{"instances": "x"}', b'{"a":1}',
                  b'{"success":false,"instances":[]}', b'{"success":1,"instances":[]}'):
            with self.assertRaises(vs.CliError):
                vs.fetch_instances(KEY, make_transport(body=b))

    def test_status_sanitized(self):
        for code in (401, 403, 500, 301):
            with self.assertRaises(vs.CliError) as cm:
                vs.fetch_instances(KEY, make_transport(status=code, body=b"leak " + KEY.encode()))
            self.assertEqual(cm.exception.status, code)
            self.assertNotIn(KEY, str(cm.exception))

    def test_oversized(self):
        with self.assertRaises(vs.CliError):
            vs.fetch_instances(KEY, make_transport(body=b"x" * (vs.MAX_BODY + 1)))

    def test_redirect_refused_by_handler(self):
        h = vs._NoRedirect()
        self.assertIsNone(h.redirect_request(None, None, 301, "m", {}, "https://evil.example/"))

    def test_transport_rejects_foreign_host(self):
        for url in ("https://evil.example/x", "https://console.vast.ai/elsewhere",
                    "http://console.vast.ai/api/v1/instances/"):
            with self.assertRaises(vs.CliError):
                vs.default_transport(url, {}, 1, 10)

    def test_mid_response_failure_is_sanitized_and_closed(self):
        response = mock.Mock()
        response.read.side_effect = TimeoutError("sensitive " + KEY)
        opener = mock.Mock()
        opener.open.return_value = response
        with mock.patch.object(vs.urllib.request, "build_opener", return_value=opener):
            with self.assertRaises(vs.CliError) as result:
                vs.default_transport(vs.API_URL, {}, 1, 10)
        self.assertNotIn(KEY, str(result.exception))
        response.close.assert_called_once()


class ReportTests(unittest.TestCase):
    def test_allowlist_no_leak(self):
        r = vs.build_report(payload())
        s = json.dumps(r)
        self.assertNotIn("SECRETTOKEN", s)
        self.assertNotIn("SECRETENV", s)
        self.assertNotIn("jupyter", s)
        inst = r["instances"][0]
        self.assertFalse(inst["gpu_verified"])
        self.assertTrue(inst["api_metadata_only"])
        self.assertEqual(inst["ssh_hint"], ["ssh", "-p", "2222", "root@ssh1.vast.ai"])
        self.assertEqual(r["account_instance_count"], 1)

    def test_ssh_injection(self):
        for host in ("a;rm -rf /", "host name", "-oProxyCommand=x y", "a$(id).com", "", None, 5, "h" * 300,
                     "host.example\n", "host.example\r", "fe80::1%bad zone", "fe80::1%eth0"):
            inst = vs.sanitize_instance(payload(ssh_host=host)["instances"][0])
            self.assertIsNone(inst["ssh_host"], host)
            self.assertIsNone(inst["ssh_hint"])

    def test_invalid_port(self):
        for port in (0, 65536, -1, "22", True, None, 2.5):
            inst = vs.sanitize_instance(payload(ssh_port=port)["instances"][0])
            self.assertIsNone(inst["ssh_port"], port)
            self.assertIsNone(inst["ssh_hint"])

    def test_text_bounded_and_types(self):
        inst = vs.sanitize_instance(payload(gpu_name="x" * 500, num_gpus="many", cpu_cores=None)["instances"][0])
        self.assertEqual(len(inst["gpu_name"]), 160)
        self.assertIsNone(inst["num_gpus"])
        self.assertIsNone(inst["cpu_cores"])

    def test_missing_instance(self):
        with self.assertRaises(vs.CliError):
            vs.build_report(payload(), 999)

    def test_selected_instance(self):
        r = vs.build_report(payload(), 7)
        self.assertEqual(r["instance"]["id"], 7)
        self.assertNotIn("instances", r)

    def test_pagination(self):
        p = payload()
        p["next_token"] = "abc"
        r = vs.build_report(p)
        self.assertTrue(r["has_more"])
        self.assertNotIn("abc", json.dumps(r))
        self.assertFalse(vs.build_report(payload())["has_more"])

    def test_non_dict_instance(self):
        with self.assertRaises(vs.CliError):
            vs.build_report({"instances": [1]})


class MainTests(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.TemporaryDirectory()
        self.addCleanup(self.d.cleanup)
        self.p = os.path.join(self.d.name, "key")
        with open(self.p, "w") as f:
            f.write(KEY)
        os.chmod(self.p, 0o600)

    def test_success(self):
        out = io.StringIO()
        rc = vs.main(["--api-key-file", self.p], make_transport(body=payload()), out)
        self.assertEqual(rc, 0)
        self.assertNotIn(KEY, out.getvalue())
        json.loads(out.getvalue())

    def test_http_failure_exit(self):
        out = io.StringIO()
        rc = vs.main(["--api-key-file", self.p], make_transport(status=403), out)
        self.assertEqual(rc, 1)
        self.assertEqual(out.getvalue(), "")

    def test_bad_instance_arg(self):
        with self.assertRaises(SystemExit):
            vs.main(["--api-key-file", self.p, "--instance", "0"], make_transport())


if __name__ == "__main__":
    unittest.main()
