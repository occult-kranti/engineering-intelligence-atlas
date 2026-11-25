"""Integrity and publication tests; local disposable Git only, no providers."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

HERE = Path(__file__).absolute().parent
SPEC = importlib.util.spec_from_file_location("sync_resources", HERE / "sync_resources.py")
sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(sync)


class ResourceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="ocgs-resources-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "upstream"
        self.source.mkdir()
        self.destination = self.root / "resources"
        package = b'{"name":"disposable-test-fixture","license":"ISC"}\n'
        (self.source / "package.json").write_bytes(package)
        self.files = []
        for module in sync.MODULES:
            self.add_source(f".opencode/modules/{module}/modulefile.yaml", f"modules/{module}/modulefile.yaml", f"name: {module}\ndepends: []\n".encode())
            self.add_source(f".opencode/modules/{module}/agents/reviewer.md", f"modules/{module}/agents/reviewer.md", f"# {module} fixture\n".encode())
        self.add_source("LICENSE", "UPSTREAM-LICENSE", b"Fixture license text\n")
        env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        env.update({"GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"})
        self.git_env = env
        self.git("init", "--quiet")
        self.git("add", ".")
        self.git("-c", "user.name=Resource Test", "-c", "user.email=resource-test@example.invalid", "commit", "--quiet", "-m", "Disposable fixture")
        self.lock = {"schemaVersion": 1, "modules": list(sync.MODULES), "upstream": {
            "repository": "https://github.com/striderZA/OpenCodeGameStudios",
            "commit": self.git("rev-parse", "HEAD").strip(), "packageSha256": sync.sha256(package)}, "files": self.files}
        self.lock_path = self.root / "lock.json"
        self.lock_hash = self.write_lock()

    def git(self, *args):
        return subprocess.check_output(["git", "-C", str(self.source), *args], env=self.git_env, text=True)

    def add_source(self, source, destination, content):
        path = self.source / source
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        self.files.append({"source": source, "destination": destination, "bytes": len(content), "sha256": sync.sha256(content)})

    def write_lock(self):
        self.lock_path.write_text(json.dumps(self.lock))
        return sync.sha256(self.lock_path.read_bytes())

    def materialize(self):
        lock, digest = sync.read_lock(self.lock_path)
        return sync.synchronize(self.source, self.destination, lock, digest)

    def assert_unpublished(self):
        self.assertFalse(self.destination.exists())
        self.assertEqual(list(self.root.glob(".resources.stage-*")), [])

    def test_materialize_verify_idempotence_and_no_git_config_changes(self):
        self.git("config", "core.hooksPath", "reviewed-host-hooks")
        original_config = (self.source / ".git/config").read_bytes()
        self.assertEqual(self.materialize()["status"], "materialized")
        self.assertEqual(self.materialize()["status"], "unchanged")
        self.assertFalse(sync.verify_pack(self.destination, self.lock, self.lock_hash)["executionEnabled"])
        self.assertEqual((self.source / ".git/config").read_bytes(), original_config)

    def test_tampered_source_fails_without_publication(self):
        (self.source / self.files[1]["source"]).write_text("tampered\n")
        with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assert_unpublished()

    def test_tampered_package_provenance_fails(self):
        (self.source / "package.json").write_text("{}")
        with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assert_unpublished()

    def test_wrong_commit_fails(self):
        self.lock["upstream"]["commit"] = "0" * 40
        self.write_lock()
        with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assert_unpublished()

    def test_source_file_symlink_fails_even_if_target_hash_matches(self):
        target = self.source / self.files[1]["source"]
        outside = self.root / "outside.md"
        outside.write_bytes(target.read_bytes())
        target.unlink()
        target.symlink_to(outside)
        with self.assertRaises((sync.IntegrityError, OSError)): self.materialize()
        self.assert_unpublished()

    def test_source_directory_symlink_fails(self):
        original = self.source / ".opencode/modules/core/agents"
        alternate = self.root / "agents"
        original.rename(alternate)
        original.symlink_to(alternate, target_is_directory=True)
        with self.assertRaises((sync.IntegrityError, OSError)): self.materialize()
        self.assert_unpublished()

    def test_destination_ancestor_symlink_fails(self):
        alias = self.root / "alias"
        alias.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(sync.IntegrityError):
            sync.synchronize(self.source, alias / "resources", self.lock, self.lock_hash)
        self.assert_unpublished()

    def test_lock_path_escape_and_absolute_paths_fail(self):
        original = copy.deepcopy(self.lock)
        for key, value in [("destination", "../escape.md"), ("source", "../LICENSE"),
                           ("destination", "/tmp/escape.md"), ("source", ".opencode/modules/core/../art/modulefile.yaml")]:
            with self.subTest(key=key, value=value):
                self.lock = copy.deepcopy(original)
                self.lock["files"][1][key] = value
                self.write_lock()
                with self.assertRaises(sync.IntegrityError): sync.read_lock(self.lock_path)
        self.assert_unpublished()

    def test_executable_and_mcp_paths_cannot_enter_allowlist(self):
        original = copy.deepcopy(self.lock)
        for tail in ["plugins/runner.ts", "mcp/codex.json", "agents/code.py", "skills/link.sh"]:
            with self.subTest(tail=tail):
                self.lock = copy.deepcopy(original)
                self.lock["files"][1]["source"] = ".opencode/modules/core/" + tail
                self.lock["files"][1]["destination"] = "modules/core/" + tail
                self.write_lock()
                with self.assertRaises(sync.IntegrityError): sync.read_lock(self.lock_path)

    def test_missing_module_manifest_fails(self):
        self.lock["files"] = self.files[1:]
        self.write_lock()
        with self.assertRaises(sync.IntegrityError): sync.read_lock(self.lock_path)

    def test_changed_destination_is_preserved(self):
        self.materialize()
        changed = self.destination / self.files[1]["destination"]
        changed.write_text("User-authored modification\n")
        with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assertEqual(changed.read_text(), "User-authored modification\n")
        self.assertEqual(list(self.root.glob(".resources.stage-*")), [])

    def test_unexpected_destination_file_is_preserved(self):
        self.materialize()
        extra = self.destination / "user-notes.md"
        extra.write_text("Keep this\n")
        with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assertEqual(extra.read_text(), "Keep this\n")

    def test_destination_symlink_rejected(self):
        self.materialize()
        target = self.destination / self.files[1]["destination"]
        target.unlink()
        target.symlink_to(self.source / self.files[1]["source"])
        with self.assertRaises(sync.IntegrityError): sync.verify_pack(self.destination, self.lock, self.lock_hash)

    def test_interrupted_staging_is_cleaned_without_partial_publication(self):
        with mock.patch.object(sync, "publish_new", side_effect=OSError("simulated publish failure")):
            with self.assertRaises(OSError): self.materialize()
        self.assert_unpublished()

    def test_atomic_publish_never_replaces_concurrent_empty_directory(self):
        original = sync.publish_new
        def race(stage, target):
            target.mkdir()
            return original(stage, target)
        with mock.patch.object(sync, "publish_new", side_effect=race):
            with self.assertRaises(sync.IntegrityError): self.materialize()
        self.assertTrue(self.destination.is_dir())
        self.assertEqual(list(self.destination.iterdir()), [])
        self.assertEqual(list(self.root.glob(".resources.stage-*")), [])

    def test_duplicate_lock_keys_rejected(self):
        self.lock_path.write_text('{"schemaVersion":1,"schemaVersion":1}')
        with self.assertRaises(sync.IntegrityError): sync.read_lock(self.lock_path)

    def test_missing_source_cli_is_nonzero(self):
        result = subprocess.run([os.sys.executable, str(HERE / "sync_resources.py"), "--source", str(self.root / "missing"),
                                 "--lock", str(self.lock_path), "--destination", str(self.destination)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(json.loads(result.stderr)["status"], "failed")
        self.assert_unpublished()


if __name__ == "__main__":
    unittest.main(verbosity=2)
