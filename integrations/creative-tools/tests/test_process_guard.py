"""Kernel-file fixtures only; no cgroup/resource limits are changed."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("process_guard", Path(__file__).resolve().parents[1] / "process_guard.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
GIB = 1024**3


class GpuMemoryTests(unittest.TestCase):
    def files(self):
        return {"/proc/self/cgroup": "0::/system.slice/daftar.service\n",
                "/proc/self/mountinfo": "50 20 0:1 / /sys/fs/cgroup ro - cgroup2 cgroup rw\n",
                "/sys/fs/cgroup/system.slice/daftar.service/memory.max": str(8 * GIB),
                "/sys/fs/cgroup/system.slice/memory.max": "max",
                "/sys/fs/cgroup/memory.max": "max"}

    def verify(self, files, memory=8 * GIB):
        def read(filename):
            if filename not in files:
                raise FileNotFoundError(filename)
            return files[filename]
        return guard.verified_cgroup_memory_limit(memory, read)

    def test_finite_service_limit_is_verified(self):
        self.assertEqual(self.verify(self.files()), 8 * GIB)

    def test_stricter_ancestor_is_honored(self):
        files = self.files()
        files["/sys/fs/cgroup/system.slice/daftar.service/memory.max"] = "max"
        files["/sys/fs/cgroup/system.slice/memory.max"] = str(4 * GIB)
        self.assertEqual(self.verify(files), 4 * GIB)

    def test_host_root_without_memory_controller_file_is_allowed_with_finite_child(self):
        files = self.files()
        del files["/sys/fs/cgroup/memory.max"]
        self.assertEqual(self.verify(files), 8 * GIB)

    def test_namespaced_container_root_limit_is_verified(self):
        files = self.files()
        files["/proc/self/cgroup"] = "0::/\n"
        files["/sys/fs/cgroup/memory.max"] = str(4 * GIB)
        self.assertEqual(self.verify(files), 4 * GIB)

    def test_mounted_subtree_is_resolved_from_kernel_mount_root(self):
        files = self.files()
        files["/proc/self/mountinfo"] = "50 20 0:1 /system.slice /sys/fs/cgroup ro - cgroup2 cgroup rw\n"
        files["/sys/fs/cgroup/daftar.service/memory.max"] = str(4 * GIB)
        self.assertEqual(self.verify(files), 4 * GIB)

    def test_unbounded_or_wider_limit_fails_closed(self):
        for value in ["max", str(16 * GIB), "unknown", "0"]:
            files = self.files()
            files["/sys/fs/cgroup/system.slice/daftar.service/memory.max"] = value
            with self.subTest(value=value), self.assertRaises(guard.GpuMemoryPrerequisite):
                self.verify(files)

    def test_missing_or_ambiguous_kernel_layout_fails_closed(self):
        for field, value in [("/proc/self/cgroup", "1:memory:/old-v1\n"),
                             ("/proc/self/cgroup", "0::/../escape\n"),
                             ("/proc/self/mountinfo", "50 20 0:1 / /tmp/fake rw - cgroup2 cgroup rw\n"),
                             ("/proc/self/cgroup", "0::/one\n0::/two\n")]:
            files = self.files()
            files[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(guard.GpuMemoryPrerequisite):
                self.verify(files)


if __name__ == "__main__":
    unittest.main()
