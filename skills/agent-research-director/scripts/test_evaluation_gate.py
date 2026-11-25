"""Synthetic receipt tests exercise gate decisions; they are not agent benchmarks."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("evaluation_gate", Path(__file__).with_name("evaluation_gate.py"))
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


def fixture():
    h = lambda value: gate.digest(value)
    protocol = {
        "schema_version": 1, "experiment_id": "synthetic-unit-fixture", "repetitions": 2,
        "min_mean_gain": 0.1, "max_case_regression": 0, "max_external_provider_usd": 0,
        "frozen_at": "2026-11-24T12:00:00Z",
        "skill_sha256": {"baseline": h("baseline"), "candidate": h("candidate")},
        "environment": {"model_id": "fixture-model", "settings_sha256": h("settings"), "tools_sha256": h("tools")},
        "cases": [
            {"id": cid, "split": split, "critical": critical, "input_sha256": h(cid), "rubric_sha256": h("rubric-" + cid)}
            for cid, split, critical in [("d1", "development", False), ("d2", "development", True), ("h1", "held_out", False), ("h2", "held_out", True)]
        ],
    }
    receipt = {
        "schema_version": 1, "experiment_id": protocol["experiment_id"], "protocol_sha256": gate.digest(protocol),
        # This declared kind is a parser fixture. No observed agent runs occur in these tests.
        "evidence_kind": "observed_agent_runs", "independent_review": True, "environment_verified": True,
        "held_out_contaminated": False, "tuning_case_ids": ["d1", "d2"], "results": [],
    }
    for variant in ("baseline", "candidate"):
        for case in protocol["cases"]:
            for repetition in (1, 2):
                receipt["results"].append({
                    "variant": variant, "case_id": case["id"], "repetition": repetition,
                    "skill_sha256": protocol["skill_sha256"][variant], "environment": copy.deepcopy(protocol["environment"]),
                    "input_sha256": case["input_sha256"], "rubric_sha256": case["rubric_sha256"],
                    "evaluated_at": "2026-11-24T12:01:00Z", "status": "evaluated",
                    "score": 0.5 if variant == "baseline" else 0.7, "critical_failures": [],
                    "evidence_ref": "fixture://raw/" + variant + "/" + case["id"] + "/" + str(repetition),
                    "judge_id": "fixture-independent-judge", "external_provider_usd": 0,
                    "platform_usd": None, "platform_tokens": None,
                })
    return protocol, receipt


class EvaluationGateTests(unittest.TestCase):
    def setUp(self):
        self.p, self.r = fixture()

    def result(self):
        return gate.evaluate(self.p, self.r)

    def refresh(self):
        self.r["protocol_sha256"] = gate.digest(self.p)

    def candidate(self, case="h1", repetition=1):
        return next(x for x in self.r["results"] if x["variant"] == "candidate" and x["case_id"] == case and x["repetition"] == repetition)

    def test_complete_paired_receipt_qualifies_without_automatic_promotion(self):
        result = self.result()
        self.assertEqual(result["decision"], "candidate-qualified")
        self.assertFalse(result["automatic_promotion"])
        self.assertAlmostEqual(result["metrics"]["held_out_mean_gain"], 0.2)

    def test_no_gain_rejects(self):
        for row in self.r["results"]:
            row["score"] = 0.5
        self.assertEqual(self.result()["decision"], "reject")

    def test_gain_below_predeclared_threshold_rejects(self):
        self.p["min_mean_gain"] = 0.3
        self.refresh()
        self.assertEqual(self.result()["decision"], "reject")

    def test_average_gain_does_not_hide_critical_failure(self):
        self.candidate("h2")["critical_failures"] = ["authority was expanded"]
        self.assertEqual(self.result()["decision"], "reject")

    def test_critical_repetition_regression_is_not_averaged_away(self):
        self.candidate("h2")["score"] = 0.4
        self.candidate("h2", 2)["score"] = 1.0
        self.assertEqual(self.result()["decision"], "reject")

    def test_critical_case_cannot_use_general_regression_allowance(self):
        self.p["max_case_regression"] = 0.5
        self.refresh()
        self.candidate("h2")["score"] = 0.1
        self.assertEqual(self.result()["decision"], "reject")

    def test_noncritical_case_regression_rejects_at_default_zero_allowance(self):
        self.candidate()["score"] = 0.1
        self.candidate("h1", 2)["score"] = 0.1
        self.candidate("h2")["score"] = 1.0
        self.candidate("h2", 2)["score"] = 1.0
        self.assertEqual(self.result()["decision"], "reject")

    def test_missing_pair_is_inconclusive_not_subset_success(self):
        self.r["results"].pop()
        result = self.result()
        self.assertEqual(result["decision"], "inconclusive")
        self.assertIsNone(result["external_provider_usd"])

    def test_duplicate_outcome_is_inconclusive(self):
        self.r["results"].append(copy.deepcopy(self.r["results"][0]))
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_duplicate_case_id_across_splits_is_inconclusive(self):
        self.p["cases"][2]["id"] = "d1"
        self.refresh()
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_environment_drift_is_inconclusive(self):
        self.candidate()["environment"]["settings_sha256"] = gate.digest("changed")
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_unknown_environment_is_inconclusive(self):
        self.r["environment_verified"] = False
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_task_or_rubric_drift_is_inconclusive(self):
        for field in ("input_sha256", "rubric_sha256"):
            with self.subTest(field=field):
                p, r = fixture()
                r["results"][0][field] = gate.digest("changed")
                self.assertEqual(gate.evaluate(p, r)["decision"], "inconclusive")

    def test_wrong_skill_hash_is_inconclusive(self):
        self.candidate()["skill_sha256"] = gate.digest("unreviewed")
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_nonfinite_boolean_or_out_of_range_score_is_inconclusive(self):
        for score in (float("nan"), float("inf"), True, -0.1, 1.1, "0.9"):
            with self.subTest(score=score):
                p, r = fixture()
                r["results"][0]["score"] = score
                self.assertEqual(gate.evaluate(p, r)["decision"], "inconclusive")

    def test_contamination_or_tuning_overlap_is_inconclusive(self):
        self.r["held_out_contaminated"] = True
        self.assertEqual(self.result()["decision"], "inconclusive")
        self.r["held_out_contaminated"] = False
        self.r["tuning_case_ids"].append("h1")
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_unknown_external_cost_is_not_zero(self):
        self.candidate()["external_provider_usd"] = None
        result = self.result()
        self.assertEqual(result["decision"], "inconclusive")
        self.assertIsNone(result["external_provider_usd"])

    def test_unknown_platform_telemetry_does_not_invent_external_spend(self):
        result = self.result()
        self.assertFalse(result["platform_telemetry_complete"])
        self.assertEqual(result["external_provider_usd"], 0)
        self.assertEqual(result["decision"], "candidate-qualified")

    def test_recorded_spend_exceeding_zero_budget_rejects(self):
        self.candidate()["external_provider_usd"] = 0.01
        self.assertEqual(self.result()["decision"], "reject")

    def test_missing_output_or_judge_evidence_is_inconclusive(self):
        for field in ("evidence_ref", "judge_id"):
            with self.subTest(field=field):
                p, r = fixture()
                r["results"][0][field] = ""
                self.assertEqual(gate.evaluate(p, r)["decision"], "inconclusive")

    def test_unavailable_outcome_and_insufficient_repetitions_are_inconclusive(self):
        self.candidate()["status"] = "unavailable"
        self.assertEqual(self.result()["decision"], "inconclusive")
        self.p, self.r = fixture()
        self.p["repetitions"] = 1
        self.refresh()
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_synthetic_or_nonindependent_results_do_not_claim_improvement(self):
        self.r["evidence_kind"] = "synthetic_gate_fixture"
        self.assertEqual(self.result()["decision"], "inconclusive")
        self.r["evidence_kind"] = "observed_agent_runs"
        self.r["independent_review"] = False
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_evaluation_before_freeze_is_inconclusive(self):
        self.candidate()["evaluated_at"] = "2026-11-24T11:00:00Z"
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_changed_protocol_without_new_receipt_is_inconclusive(self):
        self.p["min_mean_gain"] = 0.05
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_duplicate_json_keys_and_nan_are_rejected_by_loader(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "receipt.json"
            for text in ('{"score":0,"score":1}', '{"score":NaN}'):
                p.write_text(text)
                with self.assertRaises(ValueError):
                    gate.load_json(p)

    def test_input_objects_are_not_mutated(self):
        before = json.dumps([self.p, self.r], sort_keys=True)
        self.result()
        self.assertEqual(json.dumps([self.p, self.r], sort_keys=True), before)

    def test_unbounded_repetition_or_case_counts_are_inconclusive(self):
        self.p["repetitions"] = 10 ** 9
        self.refresh()
        self.assertEqual(self.result()["decision"], "inconclusive")
        self.p, self.r = fixture()
        self.p["cases"] = self.p["cases"] * 51
        self.refresh()
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_unbounded_outcome_count_is_inconclusive(self):
        self.r["results"] = self.r["results"] * 501
        self.assertEqual(self.result()["decision"], "inconclusive")

    def test_different_ids_cannot_hide_identical_inputs_across_splits(self):
        shared_input = self.p["cases"][0]["input_sha256"]
        self.p["cases"][2]["input_sha256"] = shared_input
        for row in self.r["results"]:
            if row["case_id"] == "h1":
                row["input_sha256"] = shared_input
        self.refresh()
        result = self.result()
        self.assertEqual(result["decision"], "inconclusive")
        self.assertTrue(any("input hashes overlap" in reason for reason in result["reasons"]))

    def test_known_critical_regression_rejects_with_unrelated_missing_pair(self):
        self.candidate("h2")["score"] = 0.4
        self.candidate("h2", 2)["score"] = 1.0
        self.r["results"] = [r for r in self.r["results"] if not (r["variant"] == "baseline" and r["case_id"] == "d1" and r["repetition"] == 1)]
        result = self.result()
        self.assertEqual(result["decision"], "reject")
        self.assertIsNone(result["metrics"]["held_out_mean_gain"])
        self.assertFalse(result["metrics"]["paired_outcomes_complete"])

    def test_nonobject_skill_hash_mapping_is_inconclusive(self):
        for invalid in (["baseline", "candidate"], None, "baseline", 7):
            with self.subTest(invalid=invalid):
                self.p, self.r = fixture()
                self.p["skill_sha256"] = invalid
                self.refresh()
                self.assertEqual(self.result()["decision"], "inconclusive")

    def test_huge_integer_numeric_fields_are_inconclusive(self):
        for field in ("min_mean_gain", "max_case_regression", "max_external_provider_usd"):
            with self.subTest(field=field):
                self.p, self.r = fixture()
                self.p[field] = 10 ** 400
                self.refresh()
                self.assertEqual(self.result()["decision"], "inconclusive")

    def test_cost_accumulator_overflow_cannot_crash_or_qualify(self):
        self.p["max_external_provider_usd"] = 1e308
        self.refresh()
        for row in self.r["results"]:
            row["external_provider_usd"] = 1e308
        result = self.result()
        self.assertEqual(result["decision"], "reject")
        self.assertIsNone(result["external_provider_usd"])
        json.dumps(result, allow_nan=False)


if __name__ == "__main__":
    unittest.main()
