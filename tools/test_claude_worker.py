"""Budget/usage regressions for the development-only Claude worker; no network."""
import importlib.util
import io
import json
from decimal import Decimal
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("claude_worker", Path(__file__).with_name("claude-worker.py"))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class DevelopmentBudgetTests(unittest.TestCase):
    def test_unknown_cost_uses_reservation_and_never_free(self):
        ledger = {"calls": [{"costUsd": None, "reservedUsd": 0.31}, {"costUsd": 0, "reservedUsd": 2}, {"costUsd": 0.11}]}
        self.assertEqual(worker.accounted(ledger), Decimal("0.42"))
        with self.assertRaises(ValueError):
            worker.accounted({"calls": [{"state": "failed"}]})

    def test_invalid_money_cannot_bypass_budget(self):
        for value in [True, False, float("nan"), float("inf"), -0.01, "NaN", "-Infinity"]:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                worker.money(value)

    def test_pricing_threshold_counts_cache_input(self):
        self.assertEqual(worker.rates_for("claude-haiku-5-5", 100000)["output"], 0.5)
        self.assertEqual(worker.rates_for("claude-haiku-5-5", 100001)["output"], 2.5)
        cost, rates = worker.usage_cost("claude-haiku-5-5", {"input_tokens": 99999, "output_tokens": 100, "cache_read_input_tokens": 2})
        self.assertEqual(rates["input"], 0.5)
        self.assertEqual(cost, Decimal("0.05024960"))

    def test_observed_usage_exact_and_invalid_usage_held(self):
        cost, _ = worker.usage_cost("claude-sonnet-5-5", {"input_tokens": 2168, "output_tokens": 10484})
        self.assertEqual(cost, Decimal("0.10917600"))
        for usage in [{}, {"input_tokens": True, "output_tokens": 1}, {"input_tokens": 1, "output_tokens": -1}, {"input_tokens": 1.5, "output_tokens": 1}]:
            with self.subTest(usage=usage), self.assertRaises(ValueError):
                worker.usage_cost("claude-haiku-5-5", usage)

    def test_reservation_bounds_utf8_and_context(self):
        ascii_cost, _ = worker.reserve_cost("claude-sonnet-5-5", "a" * 100, 100)
        unicode_cost, _ = worker.reserve_cost("claude-sonnet-5-5", "🎨" * 100, 100)
        self.assertGreater(unicode_cost, ascii_cost)
        with self.assertRaises(ValueError):
            worker.reserve_cost("claude-haiku-5-5", "x" * 1000000, 100)

    def test_atomic_update_preserves_previous_file_on_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ledger.json"
            old = '{"limitUsd": 20, "calls": []}\n'
            path.write_text(old)
            def broken(data):
                data["limitUsd"] = 999
                raise RuntimeError("reject mutation")
            with self.assertRaises(RuntimeError):
                worker.locked_update(path, broken)
            self.assertEqual(path.read_text(), old)

    def test_exhausted_existing_allowance_never_dispatches_or_resets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ledger = root / "ledger.json"; task = root / "task.txt"; key = root / "key.txt"
            ledger.write_text(json.dumps({"limitUsd": 20, "calls": [{"costUsd": 19.999999}]}))
            original = ledger.read_bytes(); task.write_text("Review this bounded task."); key.write_text("sk-ant-fixture")
            argv = ["worker", "--task", str(task), "--out", str(root / "out.txt"), "--ledger", str(ledger), "--key-file", str(key), "--limit-usd", "100"]
            with patch("sys.argv", argv), patch.object(worker.urllib.request, "build_opener") as network:
                with self.assertRaisesRegex(RuntimeError, "Budget exhausted"):
                    worker.main()
                network.assert_not_called()
            self.assertEqual(ledger.read_bytes(), original)

    def test_incomplete_and_failed_output_keep_billable_truth(self):
        cases = [('max_tokens', False, 2, 'incomplete'), ('end_turn', True, 1, 'failed-after-observed-response')]
        for stop, fail_output, exit_code, state in cases:
            with self.subTest(stop=stop), tempfile.TemporaryDirectory() as directory:
                root = Path(directory); ledger = root/'ledger.json'; task = root/'task.txt'; key = root/'key.txt'
                ledger.write_text(json.dumps({'limitUsd':20,'calls':[{'costUsd':0.234182}]}))
                task.write_text('A useful independent review.'); key.write_text('sk-ant-fixture')
                out = root/'out.txt'
                if fail_output:
                    (root/'not-a-directory').write_text('fixture')
                    out = root/'not-a-directory'/'out.txt'
                result = {'usage':{'input_tokens':100,'output_tokens':200},'content':[{'type':'text','text':'Partial review.'}],'stop_reason':stop,'id':'fixture-response'}
                opener = SimpleNamespace(open=lambda *a, **kw: io.BytesIO(json.dumps(result).encode()))
                argv=['worker','--task',str(task),'--out',str(out),'--ledger',str(ledger),'--key-file',str(key)]
                with patch('sys.argv',argv), patch.object(worker.urllib.request,'build_opener',return_value=opener), patch('sys.stdout',new_callable=io.StringIO):
                    with self.assertRaises(SystemExit) as raised:
                        worker.main()
                self.assertEqual(raised.exception.code,exit_code)
                data=json.loads(ledger.read_text()); entry=data['calls'][-1]
                self.assertEqual(entry['state'],state)
                self.assertEqual(entry['costUsd'],0.0022)
                self.assertEqual(entry['usage'],result['usage'])
                self.assertEqual(worker.accounted(data),Decimal('0.236382'))

    def test_success_reports_existing_lower_allowance(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); ledger=root/'ledger.json'; task=root/'task.txt'; key=root/'key.txt'
            ledger.write_text(json.dumps({'limitUsd':20,'calls':[]})); task.write_text('Review.'); key.write_text('sk-ant-fixture')
            result={'usage':{'input_tokens':100,'output_tokens':20},'content':[{'type':'text','text':'Done.'}],'stop_reason':'end_turn'}
            opener=SimpleNamespace(open=lambda *a,**kw:io.BytesIO(json.dumps(result).encode()))
            argv=['worker','--task',str(task),'--out',str(root/'out'),'--ledger',str(ledger),'--key-file',str(key),'--limit-usd','100']
            with patch('sys.argv',argv),patch.object(worker.urllib.request,'build_opener',return_value=opener),patch('sys.stdout',new_callable=io.StringIO) as stdout:
                worker.main()
                self.assertEqual(json.loads(stdout.getvalue())['limitUsd'],20)
            self.assertEqual(json.loads(ledger.read_text())['limitUsd'],20)

    def test_unexpected_usage_overrun_halts_following_dispatch(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); ledger=root/'ledger.json'; task=root/'task.txt'; key=root/'key.txt'
            ledger.write_text(json.dumps({'limitUsd':20,'calls':[]})); task.write_text('Review.'); key.write_text('sk-ant-fixture')
            result={'usage':{'input_tokens':100000,'output_tokens':100000},'content':[{'type':'text','text':'Done.'}],'stop_reason':'end_turn'}
            opener=SimpleNamespace(open=lambda *a,**kw:io.BytesIO(json.dumps(result).encode()))
            argv=['worker','--task',str(task),'--out',str(root/'out'),'--ledger',str(ledger),'--key-file',str(key),'--max-tokens','100']
            with patch('sys.argv',argv),patch.object(worker.urllib.request,'build_opener',return_value=opener),patch('sys.stdout',new_callable=io.StringIO):
                with self.assertRaises(SystemExit) as raised:worker.main()
                self.assertEqual(raised.exception.code,2)
            data=json.loads(ledger.read_text());self.assertTrue(data['haltedReason']);self.assertEqual(data['calls'][0]['costUsd'],1.2)
            with patch('sys.argv',argv),patch.object(worker.urllib.request,'build_opener') as network:
                with self.assertRaisesRegex(RuntimeError,'ledger is halted'):worker.main()
                network.assert_not_called()


if __name__ == "__main__":
    unittest.main()
