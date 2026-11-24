"""Local configuration regressions; no toolchain or physical board required."""

from __future__ import annotations

import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from atech import Project
from atech.cli import main
from atech.errors import PlacementError
from atech.placement import normalize_ports


class ProjectInputTests(unittest.TestCase):
    def test_real_booleans_and_auto_round_trip(self):
        text = """name: desk-light
board: 14port
host_actions: false
feedback: false
libraries: vendor/library@1.0
modules:
  - {id: button, port: 1, instance: btn, swap_lines: false}
  - {id: neopixel, port: 2, instance: led}
code:
  loop: 'if (btn.wasPressed()) { led.setAll(255, 0, 0); led.show(); }'
"""
        project = Project.from_yaml(text)
        self.assertFalse(project.host_actions)
        self.assertFalse(project.feedback)
        self.assertFalse(project.modules[0].swap_lines)
        self.assertEqual(project.libraries, ["vendor/library@1.0"])
        self.assertEqual(Project.from_yaml(project.to_yaml()).to_yaml(), project.to_yaml())
        self.assertEqual(Project.from_yaml("board: 14port").feedback, "auto")

    def test_quoted_booleans_do_not_reverse_intent(self):
        for field in ("host_actions", "feedback"):
            for value in ('"false"', '"true"', "1", "0", "1.0", "null"):
                with self.subTest(field=field, value=value):
                    with self.assertRaisesRegex(ValueError, field):
                        Project.from_yaml(f"board: 14port\n{field}: {value}\n")

    def test_swap_lines_rejects_quoted_boolean(self):
        with self.assertRaisesRegex(ValueError, r"modules\[0\].swap_lines"):
            Project.from_yaml('board: 14port\nmodules:\n - {id: button, port: 1, swap_lines: "false"}\n')
        project = Project(board="14port")
        with self.assertRaisesRegex(ValueError, "swap_lines"):
            project.add("button", port=1, swap_lines="false")
        self.assertEqual(project.modules, [])

    def test_wrong_structures_fail_with_field_context(self):
        cases = [
            ("modules: 12", "modules"),
            ("modules: {id: button}", "modules"),
            ("modules: [12]", r"modules\[0\]"),
            ("modules: [{port: 1}]", r"modules\[0\].id"),
            ("modules: [{id: button, port: 1, instance: 12}]", "instance"),
            ("code: run my lamp", "code"),
            ("code: {loop: 12}", "code.loop"),
            ("libraries: {vendor: library}", "libraries"),
            ("libraries: [12]", "libraries"),
            ("modules_path: 12", "modules_path"),
            ("modules_path: [12]", "modules_path"),
        ]
        for content, field in cases:
            with self.subTest(content=content), self.assertRaisesRegex(ValueError, field):
                Project.from_yaml("board: 14port\n" + content + "\n")

    def test_missing_invalid_and_unknown_board(self):
        for text in ("", "board: 12", "board: ''", "board: []"):
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "board"):
                Project.from_yaml(text)
        with self.assertRaisesRegex(KeyError, "not in catalog"):
            Project.from_yaml("board: absent-board")

    def test_yaml_syntax_error_is_actionable_value_error(self):
        with self.assertRaisesRegex(ValueError, "invalid project YAML at line"):
            Project.from_yaml("board: [14port\n")

    def test_ambiguous_port_fields_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "not both"):
            Project.from_yaml("board: 14port\nmodules: [{id: button, port: 1, ports: [2]}]")
        project = Project(board="14port")
        with self.assertRaisesRegex(ValueError, "not both"):
            project.add("button", port=1, ports=[2])
        self.assertEqual(project.modules, [])

    def test_empty_optional_collections_remain_valid(self):
        project = Project.from_yaml("board: 14port\nmodules: null\ncode: null\nlibraries: null\nmodules_path: null\n")
        self.assertEqual(project.validate(), [])
        self.assertEqual(project.modules, [])


class PlacementTests(unittest.TestCase):
    def test_double_width_rejects_three_ports_without_mutation(self):
        project = Project(board="14port")
        with self.assertRaisesRegex(PlacementError, "exactly 2 ports"):
            project.add("st7735_tft", ports=[1, 2, 3])
        self.assertEqual(project.modules, [])

    def test_adjacent_pair_is_canonical_in_either_order(self):
        a = Project(board="14port").add("st7735_tft", ports=[1, 2])
        b = Project(board="14port").add("st7735_tft", ports=[2, 1])
        self.assertEqual(a.to_yaml(), b.to_yaml())
        self.assertEqual(a.validate(), [])

    def test_reserved_nonadjacent_and_overlap_still_reject(self):
        with self.assertRaises((PlacementError, KeyError)):
            Project(board="14port").add("button", port=8)
        with self.assertRaises(PlacementError):
            Project(board="14port").add("st7735_tft", ports=[1, 3])
        project = Project(board="14port").add("button", port=1)
        with self.assertRaises(PlacementError):
            project.add("neopixel", port=1)
        self.assertEqual(len(project.modules), 1)

    def test_port_shape_rejections_do_not_mutate_project(self):
        for value in (True, 1.5, None, {}, [], b"123", [True], [1.2], [[1]], ""):
            with self.subTest(value=value), self.assertRaises(ValueError):
                normalize_ports(value)
        project = Project(board="14port")
        with self.assertRaises(ValueError):
            project.add("button", ports=[])
        self.assertEqual(project.modules, [])
        self.assertEqual(normalize_ports([1, "port_2"]), ("port_1", "port_2"))


class JsonValidationTests(unittest.TestCase):
    def run_validation(self, content, *, json_mode=True, external_module_yaml=None):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            if content is not None:
                (folder / "project.yaml").write_text(content, encoding="utf-8")
            if external_module_yaml is not None:
                manifest = folder / "custom" / "broken" / "module.yaml"
                manifest.parent.mkdir(parents=True)
                manifest.write_text(external_module_yaml, encoding="utf-8")
            before = {str(p.relative_to(folder)): p.read_bytes() for p in folder.rglob("*") if p.is_file()}
            out, err = io.StringIO(), io.StringIO()
            args = ["validate", str(folder)] + (["--json"] if json_mode else [])
            # Fail the test if validation ever tries hardware, compiler or network work.
            with patch("subprocess.run", side_effect=AssertionError("must not compile")), \
                 patch("atech.runtime.transport.serial.Serial", side_effect=AssertionError("must not open hardware")), \
                 patch("urllib.request.urlopen", side_effect=AssertionError("must not download")), \
                 contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = main(args)
            after = {str(p.relative_to(folder)): p.read_bytes() for p in folder.rglob("*") if p.is_file()}
            self.assertEqual(after, before)
        return code, out.getvalue(), err.getvalue()

    def test_valid_report_is_single_json_document(self):
        code, out, err = self.run_validation("name: desk-light\nboard: 14port\nmodules: [{id: button, port: 1}]")
        result = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(err, "")
        self.assertEqual(result["schema_version"], 1)
        self.assertTrue(result["valid"])
        self.assertEqual(result["project"], "desk-light")
        self.assertEqual(result["board"], "14port")
        self.assertEqual(result["issues"], [])
        self.assertIsInstance(result["tips"], list)

    def test_invalid_reports_are_json_and_nonzero(self):
        for content in (
            None,
            "board: [14port",
            "board: 14port\nmodules: 12",
            'board: 14port\nhost_actions: "false"',
            "board: 14port\nmodules: [{id: st7735_tft, ports: [1, 2, 3]}]",
        ):
            with self.subTest(content=content):
                code, out, err = self.run_validation(content)
                result = json.loads(out)
                self.assertEqual(code, 1)
                self.assertFalse(result["valid"])
                self.assertEqual(result["issues"][0]["kind"], "invalid_project")
                self.assertTrue(result["issues"][0]["message"])
                self.assertEqual(err, "")

    def test_external_catalog_yaml_error_is_json_with_location(self):
        code, out, err = self.run_validation(
            "board: 14port\nmodules_path: custom\n",
            external_module_yaml="id: [unterminated\n",
        )
        result = json.loads(out)
        self.assertEqual(code, 1)
        self.assertEqual(err, "")
        self.assertEqual(result["schema_version"], 1)
        self.assertFalse(result["valid"])
        self.assertIsNone(result["project"])
        self.assertIsNone(result["board"])
        issue = result["issues"][0]
        self.assertEqual(issue["kind"], "invalid_project")
        self.assertIn(str(Path("custom") / "broken" / "module.yaml"), issue["message"])
        self.assertRegex(issue["message"], r"at line \d+, column \d+")

    def test_cautions_survive_json_mode(self):
        code, out, err = self.run_validation("board: 14port\nmodules: [{id: robot_arm, port: 3}]")
        result = json.loads(out)
        self.assertEqual(code, 0)
        self.assertEqual(err, "")
        self.assertEqual(result["cautions"][0]["module_id"], "robot_arm")
        self.assertIn("12 V", result["cautions"][0]["message"])

    def test_existing_text_mode_remains_available(self):
        code, out, err = self.run_validation("board: 14port", json_mode=False)
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("ok\n"))
        self.assertEqual(err, "")
        code, out, err = self.run_validation("board: 14port\nmodules: 12", json_mode=False)
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertIn("error: modules", err)
        self.assertNotIn("Traceback", err)


if __name__ == "__main__":
    unittest.main()
