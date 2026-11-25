"""Bounded destination and interchange safety checks; Blender is not required."""
import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

HERE = Path(__file__).resolve().parent


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, HERE / filename)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


generator = module("architecture_sample_generator", "generate.py")
verifier = module("architecture_sample_verifier", "verify_samples.py")


class DestinationTests(unittest.TestCase):
    def test_new_absolute_directory_is_created_once(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "new"
            self.assertEqual(generator.new_output(str(output)), output)
            self.assertTrue(output.is_dir())
            with self.assertRaises(FileExistsError):
                generator.new_output(str(output))

    def test_existing_directory_is_not_reused_or_modified(self):
        with tempfile.TemporaryDirectory() as directory:
            sentinel = Path(directory) / "original.txt"
            sentinel.write_text("original")
            with self.assertRaises(FileExistsError):
                generator.new_output(directory)
            self.assertEqual(sentinel.read_text(), "original")

    def test_existing_file_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "original.blend"
            output.write_bytes(b"original")
            with self.assertRaises(FileExistsError):
                generator.new_output(str(output))
            self.assertEqual(output.read_bytes(), b"original")

    def test_relative_and_traversal_destinations_are_rejected(self):
        for output in ["relative", "../escape", "/tmp/../escape"]:
            with self.subTest(output=output), self.assertRaises(ValueError):
                generator.new_output(output)

    def test_symlink_ancestor_is_rejected_before_creating_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            real = root / "real"
            real.mkdir()
            (root / "link").symlink_to(real, target_is_directory=True)
            with self.assertRaises(ValueError):
                generator.new_output(str(root / "link" / "output"))
            self.assertFalse((real / "output").exists())

    def test_missing_parent_is_not_implicitly_created(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "missing" / "output"
            with self.assertRaises(ValueError):
                generator.new_output(str(output))
            self.assertFalse(output.parent.exists())


class InterchangeTests(unittest.TestCase):
    def test_manifest_cannot_reference_an_outside_path(self):
        with tempfile.TemporaryDirectory() as directory:
            for path in ["/etc/passwd", "samples/generated/../../outside", "other/file.glb"]:
                with self.subTest(path=path), self.assertRaises(ValueError):
                    verifier.private_path(Path(directory), path)

    def test_glb_external_resource_is_rejected(self):
        document = {"asset": {"version": "2.0"}, "buffers": [{"uri": "https://example.invalid/asset.bin", "byteLength": 4}]}
        encoded = json.dumps(document).encode()
        encoded += b" " * ((-len(encoded)) % 4)
        chunks = struct.pack("<I4s", len(encoded), b"JSON") + encoded + struct.pack("<I4s", 4, b"BIN\0") + b"\0" * 4
        data = struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "external.glb"
            path.write_bytes(data)
            with self.assertRaisesRegex(ValueError, "external resource"):
                verifier.inspect_glb(path)

    def test_presets_have_unique_exact_builder_coverage(self):
        presets = json.loads((HERE / "presets.json").read_text())["presets"]
        ids = [preset["id"] for preset in presets]
        self.assertEqual(len(ids), 14)
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(set(ids), set(generator.BUILDERS))


if __name__ == "__main__":
    unittest.main()
