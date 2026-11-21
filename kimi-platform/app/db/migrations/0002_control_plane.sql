CREATE TABLE IF NOT EXISTS `idempotency_keys` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`scope` varchar(64) NOT NULL,
	`key` varchar(128) NOT NULL,
	`response` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idem_owner_scope_key_idx` UNIQUE(`owner_id`,`scope`,`key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('director','subagent','human-delegate') NOT NULL,
	`role` varchar(255) NOT NULL,
	`capabilities` json NOT NULL,
	`skill_refs` json NOT NULL,
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`max_concurrent_claims` int NOT NULL DEFAULT 1,
	`lease_ttl_seconds` int NOT NULL DEFAULT 120,
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workers_id` PRIMARY KEY(`id`),
	CONSTRAINT `workers_project_name_idx` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `run_events` MODIFY COLUMN `actor` enum('director','node','human','system','worker') NOT NULL;--> statement-breakpoint
ALTER TABLE `run_nodes` MODIFY COLUMN `state` enum('pending','ready','claimed','running','verifying','waiting','paused','accepted','failed','skipped','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `runs` MODIFY COLUMN `state` enum('draft','validating','queued','running','awaiting_approval','paused','completed','failed','failed_validation','stopped_budget','stopped_human','terminated_policy') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `artifacts` ADD `attempt` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `milestone_key` varchar(64);--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `attempt` int;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `assigned_worker_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `assignment_mode` enum('director','self-claim','hybrid') DEFAULT 'hybrid' NOT NULL;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `priority` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `lease_token` char(36);--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `lease_worker_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `lease_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `heartbeat_at` timestamp;--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `wait_reason` enum('dependency','approval','event');--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `milestone_key` varchar(64);--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `max_parallel_nodes` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_run_node_attempt_idx` UNIQUE(`run_id`,`node_key`,`attempt`);--> statement-breakpoint
ALTER TABLE `run_nodes` ADD CONSTRAINT `run_nodes_lease_token_idx` UNIQUE(`lease_token`);--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD CONSTRAINT `idempotency_keys_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workers` ADD CONSTRAINT `workers_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `workers_project_role_idx` ON `workers` (`project_id`,`role`,`status`);--> statement-breakpoint
CREATE INDEX `run_nodes_claimable_idx` ON `run_nodes` (`run_id`,`state`,`priority`);--> statement-breakpoint
CREATE INDEX `run_nodes_lease_idx` ON `run_nodes` (`lease_expires_at`);