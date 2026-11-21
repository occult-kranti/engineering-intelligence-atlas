CREATE TABLE IF NOT EXISTS `enterprise_companies` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('line','shared-services') NOT NULL,
	`mission` text NOT NULL,
	`disciplines` json NOT NULL,
	`capacity_share` int NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `enterprise_companies_ent_key_idx` UNIQUE(`enterprise_id`,`key`),
	CONSTRAINT `enterprise_companies_project_idx` UNIQUE(`project_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `enterprise_departments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`key` varchar(64) NOT NULL,
	`company_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`discipline` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enterprise_departments_ent_key_idx` UNIQUE(`enterprise_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `enterprise_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`seq` bigint unsigned NOT NULL,
	`type` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`actor` enum('director','node','human','system','worker') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `enterprise_events_ent_seq_idx` UNIQUE(`enterprise_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `enterprise_programs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`blueprint_hash` char(64) NOT NULL,
	`blueprint` json NOT NULL,
	`state` enum('draft','blueprint_ready','awaiting_plan_approval','dispatching','running','reconciling','completed','failed','stopped_budget','stopped_human') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`company_runs` json NOT NULL,
	`budget` json NOT NULL,
	`max_replans` int NOT NULL DEFAULT 2,
	`max_concurrent_runs` int NOT NULL DEFAULT 4,
	`paused_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprise_programs_id` PRIMARY KEY(`id`),
	CONSTRAINT `enterprise_programs_hash_idx` UNIQUE(`blueprint_hash`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `enterprises` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`goal` text NOT NULL,
	`status` enum('draft','active','paused','archived') NOT NULL DEFAULT 'draft',
	`budget` json NOT NULL,
	`max_concurrent_runs` int NOT NULL DEFAULT 4,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `enterprises_id` PRIMARY KEY(`id`),
	CONSTRAINT `enterprises_owner_slug_idx` UNIQUE(`owner_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `memory_entries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`scope` enum('enterprise','company','department','office') NOT NULL,
	`scope_key` varchar(64) NOT NULL,
	`artifact_ref` json NOT NULL,
	`summary` varchar(2000) NOT NULL DEFAULT '',
	`content_sha256` char(64) NOT NULL,
	`state` enum('pending','promoted','rejected','revoked') NOT NULL DEFAULT 'pending',
	`decided_by` varchar(255),
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memory_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `worker_contracts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`key` varchar(64) NOT NULL,
	`company_id` bigint unsigned NOT NULL,
	`department_id` bigint unsigned NOT NULL,
	`discipline` varchar(64) NOT NULL,
	`status` enum('proposed','active','draining','released','revoked') NOT NULL DEFAULT 'proposed',
	`version` int NOT NULL DEFAULT 1,
	`capacity_share` double NOT NULL,
	`skill_pin` json NOT NULL,
	`staffed` boolean NOT NULL DEFAULT false,
	`secondee_worker_id` bigint unsigned,
	`capacity_group_id` varchar(128),
	`decided_by` varchar(255),
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `worker_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_contracts_ent_key_idx` UNIQUE(`enterprise_id`,`key`)
);
--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `enterprise_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `enterprise_company_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `enterprise_contract_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `runs` ADD `enterprise_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `runs` ADD `enterprise_company_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `runs` ADD `enterprise_contract_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `workers` ADD `capacity_group_id` varchar(128);--> statement-breakpoint
ALTER TABLE `workers` ADD `department_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `enterprise_companies` ADD CONSTRAINT `enterprise_companies_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprise_companies` ADD CONSTRAINT `enterprise_companies_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprise_departments` ADD CONSTRAINT `enterprise_departments_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprise_departments` ADD CONSTRAINT `enterprise_departments_company_id_enterprise_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `enterprise_companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprise_events` ADD CONSTRAINT `enterprise_events_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprise_programs` ADD CONSTRAINT `enterprise_programs_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enterprises` ADD CONSTRAINT `enterprises_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memory_entries` ADD CONSTRAINT `memory_entries_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_contracts` ADD CONSTRAINT `worker_contracts_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_contracts` ADD CONSTRAINT `worker_contracts_company_id_enterprise_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `enterprise_companies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `worker_contracts` ADD CONSTRAINT `worker_contracts_department_id_enterprise_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `enterprise_departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `enterprise_companies_ent_active_idx` ON `enterprise_companies` (`enterprise_id`,`active`);--> statement-breakpoint
CREATE INDEX `enterprise_departments_company_idx` ON `enterprise_departments` (`company_id`);--> statement-breakpoint
CREATE INDEX `enterprise_events_ent_type_idx` ON `enterprise_events` (`enterprise_id`,`type`);--> statement-breakpoint
CREATE INDEX `enterprise_programs_ent_state_idx` ON `enterprise_programs` (`enterprise_id`,`state`);--> statement-breakpoint
CREATE INDEX `enterprises_owner_status_idx` ON `enterprises` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `memory_entries_ent_scope_idx` ON `memory_entries` (`enterprise_id`,`scope`,`state`);--> statement-breakpoint
CREATE INDEX `memory_entries_sha_idx` ON `memory_entries` (`content_sha256`);--> statement-breakpoint
CREATE INDEX `worker_contracts_ent_status_idx` ON `worker_contracts` (`enterprise_id`,`status`);--> statement-breakpoint
CREATE INDEX `worker_contracts_company_idx` ON `worker_contracts` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `budget_ledger_enterprise_idx` ON `budget_ledger` (`enterprise_id`,`enterprise_company_id`);--> statement-breakpoint
CREATE INDEX `runs_enterprise_idx` ON `runs` (`enterprise_id`,`state`);--> statement-breakpoint
CREATE INDEX `runs_enterprise_company_idx` ON `runs` (`enterprise_company_id`);--> statement-breakpoint
CREATE INDEX `workers_capacity_group_idx` ON `workers` (`capacity_group_id`);