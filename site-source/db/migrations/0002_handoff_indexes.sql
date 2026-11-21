CREATE INDEX `approvals_gate_idx` ON `approvals` (`run_id`,`node_key`,`kind`,`state`);
--> statement-breakpoint
CREATE INDEX `artifacts_handoff_idx` ON `artifacts` (`run_id`,`node_key`,`accepted`);
--> statement-breakpoint
CREATE INDEX `budget_ledger_node_idx` ON `budget_ledger` (`run_id`,`node_key`);
