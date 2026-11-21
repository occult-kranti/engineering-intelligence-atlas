"""Synthetic local tests; never loads a real portfolio or contacts a service."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("prepare_portfolio", Path(__file__).with_name("prepare-portfolio.py"))
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class PortfolioPreparationTests(unittest.TestCase):
    def setUp(self):
        self.presets = json.loads(module.DEFAULT_PRESETS.read_text())
        self.inventory = {"fetchedAt": "2026-01-01T00:00:00Z", "repositories": [{
            "name": "synthetic-app", "repoUrl": "https://github.com/example/synthetic-app",
            "source": "synthetic", "importedAt": "2026-01-01T00:00:00Z", "visibility": "private", "defaultBranch": "main",
        }]}
        self.briefs = [{"repository": "example/synthetic-app", "visibility": "private", "branch": "main", "result": {
            "isError": False, "structuredContent": {"content": "# Synthetic\nA local prototype; integration has not run.\n", "sha": "a" * 40, "display_url": "https://github.com/example/synthetic-app/blob/main/README.md"},
        }}]
        self.review = {"schemaVersion": 1, "repositories": [{
            "repository": "example/synthetic-app", "groupKey": "control-platform", "taxonomy": ["engineering"],
            "observations": [{"statement": "README calls it a prototype.", "excerpt": "A local prototype; integration has not run."}],
            "roadmap": [{"title": f"Proposed step {i}", "rationale": "Verify the supplied prototype scope.", "acceptance": ["Retain a real fixture receipt."]} for i in range(1, 4)],
        }]}

    def plan(self):
        return module.prepare_plan(self.inventory, self.briefs, self.review, self.presets, {"inventorySha256": "b" * 64})

    def test_preserves_source_fields_and_does_not_mutate_inputs(self):
        before = copy.deepcopy((self.inventory, self.briefs, self.review))
        result = self.plan()
        self.assertEqual(result["repositories"][0]["sourceRepository"], self.inventory["repositories"][0])
        self.assertEqual(before, (self.inventory, self.briefs, self.review))
        self.assertEqual(result["application"]["status"], "prepared-not-applied")

    def test_stable_ids_and_all_steps_remain_inferred_unexecuted(self):
        self.review["repositories"][0]["roadmap"][0]["status"] = "done"
        first = self.plan(); second = self.plan()
        self.assertEqual(first, second)
        steps = first["repositories"][0]["roadmap"]
        self.assertEqual(len(steps), 3)
        self.assertTrue(all(s["inferred"] and s["status"] == "proposed" and s["verification"]["status"] == "not-run" for s in steps))
        self.assertEqual(steps[1]["dependsOn"], [steps[0]["id"]])

    def test_missing_or_duplicate_identity_rejected(self):
        self.inventory["repositories"].append(copy.deepcopy(self.inventory["repositories"][0]))
        with self.assertRaises(module.PlanError): self.plan()
        self.inventory["repositories"].pop()
        self.review["repositories"] = []
        with self.assertRaises(module.PlanError): self.plan()

    def test_source_identity_cannot_be_renamed(self):
        self.inventory["repositories"][0]["name"] = "different-name"
        with self.assertRaises(module.PlanError): self.plan()

    def test_branch_visibility_and_evidence_repository_must_match(self):
        for field, value in [("branch", "other"), ("visibility", "public")]:
            old = self.briefs[0][field]; self.briefs[0][field] = value
            with self.assertRaises(module.PlanError): self.plan()
            self.briefs[0][field] = old
        self.briefs[0]["result"]["structuredContent"]["display_url"] = "https://github.com/example/other/blob/main/README.md"
        with self.assertRaises(module.PlanError): self.plan()

    def test_fabricated_readme_excerpt_and_wrong_step_count_rejected(self):
        observation = self.review["repositories"][0]["observations"][0]
        observation["excerpt"] = "Production certified and deployed."
        with self.assertRaises(module.PlanError): self.plan()
        observation["excerpt"] = "A local prototype; integration has not run."
        self.review["repositories"][0]["roadmap"].pop()
        with self.assertRaises(module.PlanError): self.plan()

    def test_unknown_taxonomy_or_group_rejected(self):
        row = self.review["repositories"][0]
        row["taxonomy"] = ["invented-tag"]
        with self.assertRaises(module.PlanError): self.plan()
        row["taxonomy"] = ["engineering"]; row["groupKey"] = "unknown"
        with self.assertRaises(module.PlanError): self.plan()

    def test_unavailable_readme_keeps_unknown_evidence(self):
        self.briefs[0]["result"] = None
        self.review["repositories"][0]["observations"] = [{"statement": "README retrieval unavailable.", "excerpt": None}]
        row = self.plan()["repositories"][0]
        self.assertEqual(row["evidence"]["readme"]["status"], "unavailable")
        self.assertEqual(row["roadmap"][0]["basis"], "inferred-no-readme")

    def test_private_destination_inside_a_git_checkout_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); (root / ".git").mkdir()
            with self.assertRaises(module.PlanError): module.write_json(root / "private.json", self.plan(), private=True)
            self.assertFalse((root / "private.json").exists())

    def test_private_write_mode_overwrite_and_symlink_guards(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); output = root / "plan.json"
            module.write_json(output, self.plan(), private=True)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            before = output.read_bytes()
            with self.assertRaises(module.PlanError): module.write_json(output, {"changed": True}, private=True)
            self.assertEqual(output.read_bytes(), before)
            link = root / "link.json"; link.symlink_to(output)
            with self.assertRaises(module.PlanError): module.load_json(link)
            with self.assertRaises(module.PlanError): module.write_json(link, {}, private=True, replace=True)

    def test_demo_has_only_fixed_synthetic_identities(self):
        demo = module.synthetic_demo(self.presets)
        encoded = json.dumps(demo)
        self.assertNotIn("synthetic-app", encoded)
        self.assertNotIn("A local prototype", encoded)
        self.assertEqual(demo["classification"], "synthetic-demo")
        self.assertTrue(all(r["repoUrl"].startswith("https://github.com/example/demo-app-") for r in demo["repositories"]))
        poisoned = copy.deepcopy(self.presets); poisoned["groups"][0]["key"] = "private-sentinel"
        with self.assertRaises(module.PlanError): module.synthetic_demo(poisoned)


if __name__ == "__main__":
    unittest.main()
