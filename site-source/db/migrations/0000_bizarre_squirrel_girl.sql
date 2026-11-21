CREATE TABLE `agents` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`skill_id` bigint unsigned NOT NULL,
	`role` varchar(255) NOT NULL,
	`model_preference` json,
	`cost_class` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`created_by_run_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`node_key` varchar(64),
	`kind` enum('plan','budget-increase','artifact-accept','knowledge-promote','external-action') NOT NULL,
	`payload` json NOT NULL,
	`state` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`decided_by` varchar(255),
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`node_key` varchar(64) NOT NULL,
	`kind` varchar(64) NOT NULL,
	`title` varchar(500) NOT NULL,
	`schema_uri` varchar(500) NOT NULL,
	`storage_key` varchar(700),
	`storage_error` varchar(120),
	`content_sha256` char(64),
	`summary` text,
	`acceptance` json,
	`accepted` boolean NOT NULL DEFAULT false,
	`reviewed_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `artifacts_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `budget_ledger` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`node_key` varchar(64) NOT NULL,
	`tokens_prompt` int NOT NULL,
	`tokens_completion` int NOT NULL,
	`calls` int NOT NULL,
	`cost_usd_micros` bigint unsigned NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budget_ledger_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `dag_revisions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`revision` int NOT NULL,
	`spec` json NOT NULL,
	`plan_hash` char(64) NOT NULL,
	`created_by` bigint unsigned NOT NULL,
	`approved_by` bigint unsigned,
	`approved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dag_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `dag_revisions_project_revision_idx` UNIQUE(`project_id`,`revision`)
);

--> statement-breakpoint
CREATE TABLE `exports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`run_id` bigint unsigned,
	`format` enum('json','markdown') NOT NULL,
	`storage_key` varchar(700),
	`storage_error` varchar(120),
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exports_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `knowledge_drafts` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`source_run_id` bigint unsigned,
	`title` varchar(500) NOT NULL,
	`body` text NOT NULL,
	`state` enum('draft','in-review','promoted','rejected') NOT NULL DEFAULT 'in-review',
	`reviewer` varchar(255),
	`decided_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledge_drafts_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `owner_settings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_settings_owner_key_idx` UNIQUE(`owner_id`,`key`)
);

--> statement-breakpoint
CREATE TABLE `projects` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`goal` text NOT NULL,
	`risk_tier` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `registry_resources` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`name` varchar(500) NOT NULL,
	`type` varchar(120) NOT NULL,
	`level` varchar(120) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`url_sha256` char(64) GENERATED ALWAYS AS (sha2(`url`, 256)) STORED,
	`purpose` text NOT NULL,
	`prereqs` text NOT NULL,
	`access` varchar(255) NOT NULL,
	`license` varchar(255) NOT NULL,
	`caveat` text NOT NULL,
	`verified` varchar(120) NOT NULL,
	CONSTRAINT `registry_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_resources_url_sha256_idx` UNIQUE(`url_sha256`)
);

--> statement-breakpoint
CREATE TABLE `registry_roles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`family` varchar(255) NOT NULL,
	`mission` text NOT NULL,
	`outputs` text NOT NULL,
	`skills` text NOT NULL,
	`senior` text NOT NULL,
	`interfaces` text NOT NULL,
	`source` varchar(1000) NOT NULL,
	CONSTRAINT `registry_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_roles_name_unique` UNIQUE(`name`)
);

--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`seq` bigint unsigned NOT NULL,
	`node_key` varchar(64),
	`type` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`actor` enum('director','node','human','system') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `run_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_events_run_seq_idx` UNIQUE(`run_id`,`seq`)
);

--> statement-breakpoint
CREATE TABLE `run_nodes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`run_id` bigint unsigned NOT NULL,
	`node_key` varchar(64) NOT NULL,
	`agent_id` bigint unsigned,
	`contract` json NOT NULL,
	`state` enum('pending','ready','running','verifying','accepted','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`tokens_used` int NOT NULL DEFAULT 0,
	`calls_used` int NOT NULL DEFAULT 0,
	`started_at` timestamp,
	`ended_at` timestamp,
	CONSTRAINT `run_nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_nodes_run_key_idx` UNIQUE(`run_id`,`node_key`)
);

--> statement-breakpoint
CREATE TABLE `runs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`dag_revision_id` bigint unsigned NOT NULL,
	`mode` enum('mock','live') NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(200),
	`state` enum('draft','validating','queued','running','awaiting_approval','completed','failed','failed_validation','stopped_budget','stopped_human','terminated_policy') NOT NULL DEFAULT 'draft',
	`budget` json NOT NULL,
	`started_by` bigint unsigned NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`ended_at` timestamp,
	`end_reason` varchar(500),
	CONSTRAINT `runs_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `skill_files` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`skill_id` bigint unsigned NOT NULL,
	`path` varchar(500) NOT NULL,
	`size` int NOT NULL,
	`sha256` char(64) NOT NULL,
	`kind` enum('body','script','reference','asset') NOT NULL,
	CONSTRAINT `skill_files_id` PRIMARY KEY(`id`)
);

--> statement-breakpoint
CREATE TABLE `skills` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned,
	`name` varchar(200) NOT NULL,
	`version` varchar(50) NOT NULL,
	`description` text NOT NULL,
	`manifest` json NOT NULL,
	`risk_signals` json NOT NULL,
	`body_text` text NOT NULL,
	`content_sha256` char(64) NOT NULL,
	`status` enum('quarantined','vetted','deprecated','suspended') NOT NULL DEFAULT 'quarantined',
	`provenance_url` varchar(1000) NOT NULL DEFAULT '',
	`license_declared` varchar(255) NOT NULL DEFAULT '',
	`reviewed_by` varchar(255),
	`reviewed_at` timestamp,
	`review_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `skills_name_version_idx` UNIQUE(`name`,`version`)
);

--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);

--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `agents` ADD CONSTRAINT `agents_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `approvals` ADD CONSTRAINT `approvals_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `artifacts` ADD CONSTRAINT `artifacts_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD CONSTRAINT `budget_ledger_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dag_revisions` ADD CONSTRAINT `dag_revisions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dag_revisions` ADD CONSTRAINT `dag_revisions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `exports` ADD CONSTRAINT `exports_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `exports` ADD CONSTRAINT `exports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `knowledge_drafts` ADD CONSTRAINT `knowledge_drafts_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `owner_settings` ADD CONSTRAINT `owner_settings_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `run_events` ADD CONSTRAINT `run_events_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `run_nodes` ADD CONSTRAINT `run_nodes_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `runs` ADD CONSTRAINT `runs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `runs` ADD CONSTRAINT `runs_dag_revision_id_dag_revisions_id_fk` FOREIGN KEY (`dag_revision_id`) REFERENCES `dag_revisions`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `runs` ADD CONSTRAINT `runs_started_by_users_id_fk` FOREIGN KEY (`started_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `skill_files` ADD CONSTRAINT `skill_files_skill_id_skills_id_fk` FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX `agents_project_idx` ON `agents` (`project_id`);
--> statement-breakpoint
CREATE INDEX `approvals_run_idx` ON `approvals` (`run_id`);
--> statement-breakpoint
CREATE INDEX `artifacts_run_idx` ON `artifacts` (`run_id`);
--> statement-breakpoint
CREATE INDEX `budget_ledger_run_idx` ON `budget_ledger` (`run_id`);
--> statement-breakpoint
CREATE INDEX `exports_project_idx` ON `exports` (`project_id`);
--> statement-breakpoint
CREATE INDEX `knowledge_drafts_project_idx` ON `knowledge_drafts` (`project_id`);
--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`owner_id`);
--> statement-breakpoint
CREATE INDEX `runs_project_idx` ON `runs` (`project_id`);
--> statement-breakpoint
CREATE INDEX `skill_files_skill_idx` ON `skill_files` (`skill_id`);
