"""No network, package installation, real engine process, or owner state in tests."""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch, Mock
from types import SimpleNamespace
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "install.py"
module_spec = importlib.util.spec_from_file_location("creative_installer", SCRIPT)
installer = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(installer)
ELF = b"\x7fELF\x02\x01" + b"\x00" * 12 + b"\x3e\x00" + b"synthetic engine fixture; never executed\n"


class Response(io.BytesIO):
    def __init__(self, data, status=200, headers=None):
        super().__init__(data)
        self.status = status
        self.headers = headers or {"Content-Length": str(len(data))}


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.prefix = self.root / "tools"
        self.lock = installer.read_json(SCRIPT.parent / "tools.lock.json")
        self.spec = {**self.lock["blender"], "tool": "blender", "sourceTrust": "official_pinned_sha256",
                     "maxExtractedBytes": 1024**2}

    def tearDown(self):
        self.temporary.cleanup()

    def assert_code(self, code, callable_, *args, **kwargs):
        with self.assertRaises(installer.InstallError) as captured:
            callable_(*args, **kwargs)
        self.assertEqual(captured.exception.code, code)

    def tar(self, members=None):
        if members is None:
            members = [(self.spec["archiveRoot"] + "/blender", ELF, 0o755, None)]
        path = self.root / "source.tar.xz"
        with tarfile.open(path, "w:xz") as archive:
            for name, data, mode, link in members:
                info = tarfile.TarInfo(name)
                info.mode = mode
                info.mtime = 1700000000
                if link is not None:
                    info.type = tarfile.SYMTYPE
                    info.linkname = link
                    archive.addfile(info)
                else:
                    info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
        self.spec.update(sizeBytes=path.stat().st_size, sha256=installer.digest_file(path))
        return path

    def extracted(self, source):
        stage = self.root / "stage"
        stage.mkdir()
        return installer.extract_archive(source, stage, self.spec)

    def install(self, source):
        with patch.object(installer, "preflight", return_value={"fixture": True}):
            return installer.install_engine(self.prefix, self.spec, source)

    def entry(self, name, kind="file", size=0, target=""):
        return {"name": name, "kind": kind, "size": size, "target": target}

    def test_cli_plan_does_not_create_prefix_or_download(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output), patch.object(installer.shutil, "disk_usage", return_value=Mock(free=2**40)), patch.object(installer.urllib.request, "build_opener", side_effect=AssertionError("Plan attempted a download")):
            code = installer.main(["--plan", "--prefix", str(self.prefix)])
        self.assertEqual(code, 0, output.getvalue())
        result = json.loads(output.getvalue())
        self.assertEqual(result["status"], "planned")
        self.assertFalse(result["writes"])
        self.assertFalse(self.prefix.exists())

    def test_check_missing_install_does_not_create_prefix(self):
        process = subprocess.run([sys.executable, str(SCRIPT), "--check", "--prefix", str(self.prefix)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 2)
        self.assertEqual(json.loads(process.stdout)["status"], "not_installed")
        self.assertFalse(self.prefix.exists())

    def test_paths_require_absolute_dedicated_unsymlinked_roots(self):
        for value, code in [("relative", "UNSAFE_PATH"), ("/", "UNSAFE_PREFIX"), (str(self.root / ".." / "outside"), "UNSAFE_PATH")]:
            with self.subTest(value=value):
                self.assert_code(code, installer.managed_prefix, value)
        real = self.root / "real"
        real.mkdir()
        (self.root / "link").symlink_to(real, target_is_directory=True)
        self.assert_code("UNSAFE_PATH", installer.managed_prefix, self.root / "link" / "tools")

    def test_world_writable_install_root_rejected(self):
        self.prefix.mkdir(mode=0o777)
        self.prefix.chmod(0o777)
        self.assert_code("UNSAFE_DIRECTORY", installer.managed_prefix, self.prefix)

    def test_privileged_install_rejects_user_owned_or_mutable_ancestors(self):
        for owner, mode in [(1000, 0o755), (0, 0o777), (0, 0o775)]:
            def info(path):
                unsafe = str(path) == "/srv/imports"
                return SimpleNamespace(st_uid=owner if unsafe else 0,
                                       st_mode=stat.S_IFDIR | (mode if unsafe else 0o755))
            with self.subTest(owner=owner, mode=mode), patch.object(installer.os, "geteuid", return_value=0), patch.object(installer.Path, "lstat", info):
                self.assert_code("UNSAFE_PRIVILEGED_PARENT", installer.privileged_ancestry, Path("/srv/imports/tools"))

    def test_privileged_install_permits_root_owned_sticky_temp_ancestor(self):
        def info(path):
            return SimpleNamespace(st_uid=0, st_mode=stat.S_IFDIR | (0o1777 if str(path) == "/tmp" else 0o755))
        with patch.object(installer.os, "geteuid", return_value=0), patch.object(installer.Path, "lstat", info):
            installer.privileged_ancestry(Path("/tmp/root-private/tools"))

    def test_privileged_install_requires_preexisting_private_child_under_sticky_parent(self):
        def info(path):
            if str(path).startswith("/tmp/missing-private"):
                raise FileNotFoundError(str(path))
            return SimpleNamespace(st_uid=0, st_mode=stat.S_IFDIR | (0o1777 if str(path) == "/tmp" else 0o755))
        with patch.object(installer.os, "geteuid", return_value=0), patch.object(installer.Path, "lstat", info):
            self.assert_code("UNSAFE_PRIVILEGED_PARENT", installer.privileged_ancestry, Path("/tmp/missing-private/tools"))

    def test_platform_and_glibc_checks(self):
        with patch.object(installer.platform, "machine", return_value="aarch64"):
            self.assert_code("UNSUPPORTED_PLATFORM", installer.preflight, self.spec, self.prefix, 1)
        with patch.object(installer.platform, "libc_ver", return_value=("musl", "1.2")):
            self.assert_code("UNSUPPORTED_LIBC", installer.preflight, self.spec, self.prefix, 1)

    def test_cpu_feature_and_strict_ram_checks(self):
        with patch.object(installer.Path, "read_text", return_value="flags : sse2"):
            self.assert_code("UNSUPPORTED_CPU", installer.preflight, self.spec, self.prefix, 1)
        with patch.object(installer, "memory_limit", return_value=1024):
            self.assert_code("HARDWARE_BELOW_GUIDANCE", installer.preflight, self.spec, self.prefix, 1, True)

    def test_nested_systemd_cgroup_limits_are_included(self):
        with patch.object(installer.Path, "read_text", return_value="0::/system.slice/daftar-runtime.service\n"):
            paths = installer.cgroup_files("memory", "memory.max", "memory.limit_in_bytes")
        self.assertIn(Path("/sys/fs/cgroup/system.slice/daftar-runtime.service/memory.max"), paths)
        self.assertIn(Path("/sys/fs/cgroup/system.slice/memory.max"), paths)
        values = {"/proc/meminfo": "MemTotal: 33554432 kB\n", "/fixture/memory.max": str(2 * 1024**3)}
        with patch.object(installer, "cgroup_files", return_value=[Path("/fixture/memory.max")]), patch.object(installer.Path, "read_text", lambda path: values[str(path)]):
            self.assertEqual(installer.memory_limit(), 2 * 1024**3)
        with patch.object(installer, "cgroup_files", return_value=[Path("/fixture/cpu.max")]), patch.object(installer.Path, "read_text", return_value="200000 100000"):
            self.assertEqual(installer.cpu_quota(), 2)

    def test_disk_limit_fails_before_download(self):
        with patch.object(installer.shutil, "disk_usage", return_value=Mock(free=9)):
            self.assert_code("INSUFFICIENT_DISK", installer.disk_check, self.prefix, 10)
        self.assertFalse(self.prefix.exists())

    def test_lock_rejects_concurrent_install(self):
        with installer.install_lock(self.prefix):
            with self.assertRaises(installer.InstallError) as error:
                with installer.install_lock(self.prefix):
                    self.fail("Second installer acquired lock")
            self.assertEqual(error.exception.code, "INSTALL_BUSY")

    def test_lock_rejects_symlink_without_touching_target(self):
        self.prefix.mkdir()
        external = self.root / "external"
        external.write_text("unchanged")
        (self.prefix / ".install.lock").symlink_to(external)
        with self.assertRaises(OSError):
            with installer.install_lock(self.prefix):
                self.fail("Symlink lock was followed")
        self.assertEqual(external.read_text(), "unchanged")

    def test_archive_traversal_absolute_backslash_and_drive_paths(self):
        for name in ["../outside", "/outside", "root/../../outside", "C:/outside", "root\\..\\outside"]:
            with self.subTest(name=name):
                self.assert_code("UNSAFE_ARCHIVE_PATH", installer.validate_entries, [self.entry(name)], self.spec)

    def test_duplicate_special_hardlink_and_negative_size_members(self):
        self.assert_code("DUPLICATE_ARCHIVE_PATH", installer.validate_entries, [self.entry("root/file"), self.entry("root/./file")], self.spec)
        for kind in ("special", "hardlink", "fifo"):
            self.assert_code("UNSAFE_ARCHIVE_TYPE", installer.validate_entries, [self.entry("root/item", kind)], self.spec)
        self.assert_code("ARCHIVE_LIMIT", installer.validate_entries, [self.entry("file", size=-1)], self.spec)

    def test_expanded_size_and_entry_limits(self):
        self.assert_code("ARCHIVE_LIMIT", installer.validate_entries, [self.entry("file", size=self.spec["maxExtractedBytes"] + 1)], self.spec)
        self.assert_code("ARCHIVE_LIMIT", installer.validate_entries, [self.entry("a"), self.entry("b")], {**self.spec, "maxEntries": 1})

    def test_symlink_escape_cycle_missing_and_directory_targets_rejected(self):
        examples = [
            [self.entry("root/link", "symlink", target="../../outside")],
            [self.entry("root/link", "symlink", target="/outside")],
            [self.entry("root/a", "symlink", target="b"), self.entry("root/b", "symlink", target="a")],
            [self.entry("root/a", "symlink", target="missing")],
            [self.entry("root/a", "symlink", target="dir"), self.entry("root/dir", "dir")],
            [self.entry("root/a", "symlink", target="file"), self.entry("root/file"), self.entry("root/a/child")],
        ]
        for entries in examples:
            with self.subTest(entries=entries):
                self.assert_code("UNSAFE_ARCHIVE_LINK", installer.validate_entries, entries, self.spec)

    def test_valid_internal_library_link_chain_and_executable_modes(self):
        base = self.spec["archiveRoot"]
        source = self.tar([(base + "/blender", ELF, 0o6755, None),
                           (base + "/lib/liba.so", b"", 0o777, "liba.so.1"),
                           (base + "/lib/liba.so.1", b"", 0o777, "liba.so.1.2"),
                           (base + "/lib/liba.so.1.2", b"shared library", 0o666, None)])
        root, total = self.extracted(source)
        self.assertEqual((root / "lib/liba.so").read_bytes(), b"shared library")
        self.assertEqual(stat.S_IMODE((root / "blender").stat().st_mode), 0o755)
        self.assertEqual((root / "blender").stat().st_mtime, 1700000000)
        self.assertEqual(stat.S_IMODE((root / "lib/liba.so.1.2").stat().st_mode), 0o644)
        self.assertEqual(total, len(ELF) + len(b"shared library"))

    def test_archive_cannot_write_outside_stage(self):
        source = self.tar([("../outside", b"danger", 0o644, None)])
        self.assert_code("UNSAFE_ARCHIVE_PATH", self.extracted, source)
        self.assertFalse((self.root / "outside").exists())

    def test_checksum_mismatch_is_not_installed_or_reused(self):
        source = self.tar()
        self.spec["sha256"] = "f" * 64
        self.assert_code("CHECKSUM_MISMATCH", self.install, source)
        self.assertFalse((self.prefix / "blender" / self.spec["version"]).exists())
        self.assertFalse(list((self.prefix / "cache").glob("*.part")))

    def test_atomic_install_reuse_and_inventory_tamper_detection(self):
        source = self.tar()
        result = self.install(source)
        self.assertEqual(result["status"], "installed_verified")
        self.assertEqual(result["filesVerified"], 1)
        with patch.object(installer, "fetch_archive", side_effect=AssertionError("Reused installation downloaded again")):
            self.assertEqual(self.install(source)["status"], "reused_verified")
        Path(result["executable"]).write_bytes(ELF + b"tampered")
        self.assert_code("INSTALL_INTEGRITY_MISMATCH", self.install, source)

    def test_restrictive_admin_umask_still_publishes_readable_engine_and_private_cache(self):
        source = self.tar([(self.spec["archiveRoot"] + "/blender", ELF, 0o755, None),
                           (self.spec["archiveRoot"] + "/lib/nested/data", b"library", 0o644, None)])
        previous = os.umask(0o077)
        try:
            result = self.install(source)
        finally:
            os.umask(previous)
        root = Path(result["executable"]).parent
        for path in [self.prefix, root.parent, root, root / "lib", root / "lib/nested"]:
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o755)
        self.assertEqual(stat.S_IMODE((self.prefix / "cache").stat().st_mode), 0o700)

    def test_partial_extraction_failure_never_publishes_and_cleans_stage(self):
        source = self.tar()
        def broken_extract(archive, stage, spec):
            (stage / "partial").write_text("partial extraction")
            raise OSError("synthetic disk failure")
        with patch.object(installer, "extract_archive", side_effect=broken_extract):
            with self.assertRaises(OSError):
                self.install(source)
        self.assertFalse((self.prefix / "blender" / self.spec["version"]).exists())
        self.assertEqual(list((self.prefix / "blender").iterdir()), [])

    def test_existing_unmanaged_destination_is_not_overwritten(self):
        source = self.tar()
        target = self.prefix / "blender" / self.spec["version"]
        target.mkdir(parents=True)
        (target / "important").write_text("keep")
        self.assert_code("UNSAFE_FILE", self.install, source)
        self.assertEqual((target / "important").read_text(), "keep")

    def partial(self, payload, offset):
        cache = self.prefix / "cache"
        cache.mkdir(parents=True)
        self.spec.update(sizeBytes=len(payload), sha256=hashlib.sha256(payload).hexdigest())
        part = cache / (self.spec["archive"] + ".part")
        part.write_bytes(payload[:offset])
        part.with_name(part.name + ".json").write_text(json.dumps({key: self.spec[key] for key in ("sha256", "sizeBytes", "archive")}))
        return part

    def test_verified_range_resume(self):
        data = b"archive-data-to-resume"
        self.partial(data, 4)
        opener = Mock()
        opener.open.return_value = Response(data[4:], 206, {"Content-Length": str(len(data) - 4), "Content-Range": f"bytes 4-{len(data) - 1}/{len(data)}"})
        path = installer.fetch_archive(self.prefix, self.spec, opener=opener)
        self.assertEqual(path.read_bytes(), data)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.headers["Range"], "bytes=4-")

    def test_range_ignored_restarts_instead_of_appending(self):
        data = b"complete-archive"
        self.partial(data, 4)
        opener = Mock()
        opener.open.return_value = Response(data)
        self.assertEqual(installer.fetch_archive(self.prefix, self.spec, opener=opener).read_bytes(), data)

    def test_wrong_resume_range_rejected_preserving_original_partial(self):
        data = b"complete-archive"
        part = self.partial(data, 4)
        opener = Mock()
        opener.open.return_value = Response(data[4:], 206, {"Content-Range": f"bytes 3-{len(data) - 1}/{len(data)}"})
        self.assert_code("INVALID_CONTENT_RANGE", installer.fetch_archive, self.prefix, self.spec, opener=opener)
        self.assertEqual(part.read_bytes(), data[:4])

    def test_interrupted_download_retains_resumable_partial(self):
        data = b"complete-archive"
        part = self.partial(data, 0)
        opener = Mock()
        opener.open.return_value = Response(data[:4], 200, {"Content-Length": str(len(data))})
        self.assert_code("ARCHIVE_SIZE_MISMATCH", installer.fetch_archive, self.prefix, self.spec, opener=opener)
        self.assertEqual(part.read_bytes(), data[:4])
        self.assertTrue(part.with_name(part.name + ".json").exists())

    def test_partial_from_different_pin_rejected(self):
        data = b"archive"
        part = self.partial(data, 2)
        part.with_name(part.name + ".json").write_text("{}")
        self.assert_code("PARTIAL_IDENTITY_MISMATCH", installer.fetch_archive, self.prefix, self.spec, opener=Mock())

    def test_nonofficial_redirect_rejected(self):
        handler = installer.OfficialRedirectHandler()
        for url in ("https://example.com/archive", "http://download.blender.org/archive", "https://owner:secret@download.blender.org/archive"):
            self.assert_code("UNTRUSTED_REDIRECT", handler.redirect_request, None, None, 302, "redirect", {}, url)

    def unreal_archive(self, unsafe=None, version=None):
        path = self.root / "unreal.zip"
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("UE/Engine/Binaries/Linux/UnrealEditor", ELF)
            archive.writestr("UE/Engine/Build/Build.version", json.dumps(version or {"MajorVersion": 5, "MinorVersion": 7, "PatchVersion": 1}))
            if unsafe:
                archive.writestr(unsafe, b"danger")
        args = argparse.Namespace(tool="unreal", version="5.7.1", archive=str(path), sha256=installer.digest_file(path))
        return path, installer.archive_spec(args, self.lock)

    def test_owner_unreal_import_verifies_hash_and_version_without_account_claim(self):
        source, spec = self.unreal_archive()
        with patch.object(installer, "preflight", return_value={"fixture": True}):
            result = installer.install_engine(self.prefix, spec, source)
        self.assertEqual(result["sourceTrust"], "owner_supplied_sha256")
        discovered = installer.discover_unreal(Path(result["executable"]).parents[3])
        self.assertEqual(discovered["version"], "5.7.1")
        self.assertFalse(discovered["accountOrLicenseVerified"])
        self.assertFalse(discovered["engineExecuted"])

    def test_owner_unreal_version_mismatch_fails_before_publish(self):
        source, spec = self.unreal_archive(version={"MajorVersion": 5, "MinorVersion": 6, "PatchVersion": 0})
        with patch.object(installer, "preflight", return_value={}):
            self.assert_code("ENGINE_VERSION", installer.install_engine, self.prefix, spec, source)
        self.assertFalse((self.prefix / "unreal" / "5.7.1").exists())

    def test_unreal_zip_traversal_and_symlinks_rejected(self):
        self.assert_code("UNSAFE_ARCHIVE_PATH", self.unreal_archive, "../escape")
        path = self.root / "link.zip"
        with zipfile.ZipFile(path, "w") as archive:
            link = zipfile.ZipInfo("Engine/link")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, "../../outside")
        with self.assertRaises(installer.InstallError) as error:
            with installer.archive_reader(path, {**self.lock["unreal"], "tool": "unreal"}) as (entries, _):
                installer.validate_entries(entries, self.lock["unreal"])
        self.assertEqual(error.exception.code, "UNSAFE_ARCHIVE_LINK")

    def test_unreal_zip_accepts_internal_verified_library_symlink(self):
        source, spec = self.unreal_archive()
        with zipfile.ZipFile(source, "a") as archive:
            archive.writestr("UE/Engine/Binaries/Linux/liba.so.1", b"library")
            link = zipfile.ZipInfo("UE/Engine/Binaries/Linux/liba.so")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(link, "liba.so.1")
        spec.update(sizeBytes=source.stat().st_size, sha256=installer.digest_file(source))
        with patch.object(installer, "preflight", return_value={}):
            result = installer.install_engine(self.prefix, spec, source)
        self.assertEqual((Path(result["executable"]).parent / "liba.so").read_bytes(), b"library")

    def test_unreal_import_requires_owner_archive_hash(self):
        args = argparse.Namespace(tool="unreal", version="5.7.1", archive=None, sha256=None)
        self.assert_code("OWNER_ARCHIVE_REQUIRED", installer.archive_spec, args, self.lock)

    def test_graphics_plan_uses_distro_packages_without_running_apt(self):
        with patch.object(installer.platform, "freedesktop_os_release", return_value={"ID": "ubuntu", "VERSION_ID": "24.04"}), patch.object(installer.subprocess, "run", side_effect=AssertionError("Plan ran subprocess")):
            result = installer.graphics_profile("plan", self.prefix, "open-graphics")
        self.assertIn("libglib2.0-0t64", result["packages"])
        for package in ("inkscape", "krita", "gimp", "ffmpeg"):
            self.assertIn(package, result["packages"])
        self.assertFalse(self.prefix.exists())

    def test_graphics_check_requires_successful_dpkg_query(self):
        with patch.object(installer.platform, "freedesktop_os_release", return_value={"ID": "debian", "VERSION_ID": "12"}):
            plan = installer.graphics_profile("plan", self.prefix, "open-graphics")
            output = "".join(f"{package}\t1.0\tinstalled\n" for package in plan["packages"])
            with patch.object(installer.subprocess, "run", return_value=SimpleNamespace(returncode=1, stdout=output)):
                result = installer.graphics_profile("check", self.prefix, "open-graphics")
            self.assertFalse(result["ok"])
            self.assertEqual(result["status"], "packages_missing")


if __name__ == "__main__":
    unittest.main()
