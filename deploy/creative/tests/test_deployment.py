import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "verify_compose.py"
spec = importlib.util.spec_from_file_location("creative_compose", SCRIPT)
compose = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compose)


class DeploymentTests(unittest.TestCase):
    def fixture(self):
        volumes = [{"target": target, "type": "bind", "read_only": True, "bind": {"create_host_path": False}}
                   for target in ["/opt/daftar-tools", "/run/daftar/creative-tools.json", "/run/secrets"]]
        volumes.append({"target": "/var/lib/daftar-creative", "type": "bind", "bind": {"create_host_path": False}})
        return {"services": {"runtime": {"read_only": True, "user": "10001:10001", "cap_drop": ["ALL"],
            "security_opt": ["no-new-privileges:true"], "ports": [{"host_ip": "127.0.0.1", "target": 8788}],
            "tmpfs": ["/tmp:rw,noexec,nosuid,nodev,size=1073741824,mode=1777"],
            "mem_limit": 16 * 1024**3, "cpus": 4, "pids_limit": 512, "volumes": volumes}}}

    def test_cpu_profile_defaults_pass_without_requesting_gpu(self):
        self.assertTrue(compose.verify(self.fixture())["ok"])

    def test_duplicate_tmp_mount_from_compose_sequence_merge_fails(self):
        value = self.fixture()
        value["services"]["runtime"]["tmpfs"].insert(0, "/tmp:rw,noexec,nosuid,nodev,size=67108864,mode=1777")
        with self.assertRaisesRegex(AssertionError, "Exactly one /tmp"):
            compose.verify(value)

    def test_public_engine_port_or_writable_binary_mount_fails(self):
        value = self.fixture()
        value["services"]["runtime"]["ports"].append({"host_ip": "0.0.0.0", "target": 30010})
        with self.assertRaises(AssertionError):
            compose.verify(value)
        value = self.fixture()
        value["services"]["runtime"]["volumes"][0]["read_only"] = False
        with self.assertRaises(AssertionError):
            compose.verify(value)

    def test_gpu_requires_explicit_single_existing_device_profile(self):
        value = self.fixture()
        value["services"]["runtime"]["deploy"] = {"resources": {"reservations": {"devices": [{"driver": "nvidia", "count": 1, "capabilities": ["gpu"]}]}}}
        self.assertTrue(compose.verify(value, gpu=True)["ok"])
        with self.assertRaises(AssertionError):
            compose.verify(value)
        value["services"]["runtime"]["deploy"]["resources"]["reservations"]["devices"][0]["count"] = "all"
        with self.assertRaises(AssertionError):
            compose.verify(value, gpu=True)


if __name__ == "__main__":
    unittest.main()
