CREATE TABLE `assistant_jobs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`job_key` varchar(80) NOT NULL,
	`scope` enum('enterprise','company','department','office') NOT NULL,
	`scope_key` varchar(64) NOT NULL DEFAULT '',
	`kind` enum('ledger_refresh','cache_refresh','program_pump_mock','repository_sync','study_plan') NOT NULL,
	`schedule` json NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`next_run_at` bigint unsigned,
	`last_run_at` bigint unsigned,
	`run_count` int NOT NULL DEFAULT 0,
	`max_runs` int,
	`budget` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assistant_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `assistant_jobs_owner_ent_key_idx` UNIQUE(`owner_id`,`enterprise_id`,`job_key`)
);
--> statement-breakpoint
CREATE TABLE `assistant_proposals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`proposal_key` varchar(80) NOT NULL,
	`scope` enum('enterprise','company','department','office') NOT NULL,
	`actor` varchar(80) NOT NULL,
	`action` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`payload_hash` char(64) NOT NULL,
	`expected_version` int NOT NULL,
	`risk` enum('low','medium','high') NOT NULL,
	`requires_approval` boolean NOT NULL,
	`confirmed_gates` json NOT NULL,
	`status` enum('proposed','approved','rejected','executed','failed','cancelled') NOT NULL DEFAULT 'proposed',
	`result_summary` varchar(2000) NOT NULL DEFAULT '',
	`proposed_at` bigint unsigned NOT NULL,
	`decided_at` bigint unsigned,
	`executed_at` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assistant_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `assistant_proposals_owner_key_idx` UNIQUE(`owner_id`,`proposal_key`)
);
--> statement-breakpoint
CREATE TABLE `assistant_queue_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`queue_id` bigint unsigned NOT NULL,
	`item_key` varchar(120) NOT NULL,
	`item_kind` enum('company-run','study','repository-triage','custom') NOT NULL,
	`ref_id` varchar(255) NOT NULL DEFAULT '',
	`title` varchar(200) NOT NULL,
	`position` int NOT NULL,
	`status` enum('queued','dispatched','done','dropped') NOT NULL DEFAULT 'queued',
	`payload_hash` char(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assistant_queue_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `assistant_queue_items_queue_key_idx` UNIQUE(`queue_id`,`item_key`),
	CONSTRAINT `assistant_queue_items_queue_pos_idx` UNIQUE(`queue_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `assistant_work_queues` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`scope` enum('enterprise','company','department','office') NOT NULL,
	`scope_key` varchar(64) NOT NULL DEFAULT '',
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assistant_work_queues_id` PRIMARY KEY(`id`),
	CONSTRAINT `assistant_work_queues_ent_scope_idx` UNIQUE(`enterprise_id`,`scope`,`scope_key`)
);
--> statement-breakpoint
CREATE TABLE `knowledge_transfers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`transfer_key` varchar(80) NOT NULL,
	`refs` json NOT NULL,
	`handoff` json NOT NULL,
	`content_sha256` char(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `knowledge_transfers_ent_key_idx` UNIQUE(`enterprise_id`,`transfer_key`)
);
--> statement-breakpoint
CREATE TABLE `repo_assignment_plans` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`repository_id` bigint unsigned NOT NULL,
	`url` varchar(512) NOT NULL,
	`commit_sha` char(40) NOT NULL,
	`status` enum('assigned','quarantined','proposed_new_structure') NOT NULL,
	`company_key` varchar(64),
	`department_key` varchar(64),
	`discipline` varchar(64),
	`skill_id` varchar(80),
	`confidence` double NOT NULL,
	`rationale` varchar(2000) NOT NULL,
	`read_only` boolean NOT NULL DEFAULT true,
	`redistribution_allowed` boolean NOT NULL DEFAULT false,
	`notes` json NOT NULL,
	`applied_by` varchar(255),
	`applied_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repo_assignment_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `repo_assignment_plans_repo_sha_idx` UNIQUE(`repository_id`,`commit_sha`)
);
--> statement-breakpoint
CREATE TABLE `repository_records` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`url` varchar(512) NOT NULL,
	`owner_name` varchar(200) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` varchar(2000) NOT NULL DEFAULT '',
	`language` varchar(80),
	`topics` json NOT NULL,
	`license` varchar(80),
	`archived` boolean NOT NULL DEFAULT false,
	`default_branch` varchar(200) NOT NULL,
	`commit_sha` char(40) NOT NULL,
	`visibility` enum('public','private','internal') NOT NULL,
	`intake_mode` enum('public-anonymous','credentialed-approved') NOT NULL,
	`created_by_record_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `repository_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `repository_records_ent_url_idx` UNIQUE(`enterprise_id`,`url`)
);
--> statement-breakpoint
CREATE TABLE `study_queue_items` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`enterprise_id` bigint unsigned NOT NULL,
	`item_key` varchar(120) NOT NULL,
	`skill_id` varchar(80) NOT NULL,
	`resource_ref` varchar(500) NOT NULL,
	`topic` varchar(200) NOT NULL DEFAULT '',
	`goal` varchar(1000) NOT NULL,
	`evaluation` varchar(200) NOT NULL DEFAULT '',
	`status` enum('draft','queued','in-progress','completed','dropped') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `study_queue_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `study_queue_items_ent_key_idx` UNIQUE(`enterprise_id`,`item_key`)
);
--> statement-breakpoint
ALTER TABLE `enterprise_companies` ADD `archived_at` timestamp;--> statement-breakpoint
ALTER TABLE `enterprise_departments` ADD `status` enum('active','paused','archived') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `assistant_jobs` ADD CONSTRAINT `assistant_jobs_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_jobs` ADD CONSTRAINT `assistant_jobs_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_proposals` ADD CONSTRAINT `assistant_proposals_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_proposals` ADD CONSTRAINT `assistant_proposals_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_queue_items` ADD CONSTRAINT `assistant_queue_items_queue_id_assistant_work_queues_id_fk` FOREIGN KEY (`queue_id`) REFERENCES `assistant_work_queues`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_work_queues` ADD CONSTRAINT `assistant_work_queues_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistant_work_queues` ADD CONSTRAINT `assistant_work_queues_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_transfers` ADD CONSTRAINT `knowledge_transfers_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_transfers` ADD CONSTRAINT `knowledge_transfers_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repo_assignment_plans` ADD CONSTRAINT `repo_assignment_plans_repository_id_repository_records_id_fk` FOREIGN KEY (`repository_id`) REFERENCES `repository_records`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repository_records` ADD CONSTRAINT `repository_records_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `repository_records` ADD CONSTRAINT `repository_records_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `study_queue_items` ADD CONSTRAINT `study_queue_items_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `study_queue_items` ADD CONSTRAINT `study_queue_items_enterprise_id_enterprises_id_fk` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprises`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assistant_jobs_due_idx` ON `assistant_jobs` (`enabled`,`next_run_at`);--> statement-breakpoint
CREATE INDEX `assistant_jobs_owner_idx` ON `assistant_jobs` (`owner_id`,`enterprise_id`);--> statement-breakpoint
CREATE INDEX `assistant_proposals_ent_status_idx` ON `assistant_proposals` (`enterprise_id`,`status`);--> statement-breakpoint
CREATE INDEX `assistant_proposals_owner_status_idx` ON `assistant_proposals` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `assistant_queue_items_queue_status_idx` ON `assistant_queue_items` (`queue_id`,`status`);--> statement-breakpoint
CREATE INDEX `assistant_work_queues_owner_idx` ON `assistant_work_queues` (`owner_id`,`enterprise_id`);--> statement-breakpoint
CREATE INDEX `knowledge_transfers_owner_idx` ON `knowledge_transfers` (`owner_id`,`enterprise_id`);--> statement-breakpoint
CREATE INDEX `repo_assignment_plans_repo_status_idx` ON `repo_assignment_plans` (`repository_id`,`status`);--> statement-breakpoint
CREATE INDEX `repository_records_owner_idx` ON `repository_records` (`owner_id`,`enterprise_id`);--> statement-breakpoint
CREATE INDEX `study_queue_items_owner_status_idx` ON `study_queue_items` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `enterprise_departments_ent_status_idx` ON `enterprise_departments` (`enterprise_id`,`status`);