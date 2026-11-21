CREATE TABLE IF NOT EXISTS `autonomy_grants` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`scope` enum('project','run') NOT NULL,
	`run_id` bigint unsigned,
	`mode` enum('all','risk_based','none') NOT NULL,
	`allow_live` boolean NOT NULL DEFAULT false,
	`max_tokens` int NOT NULL,
	`max_calls` int NOT NULL,
	`max_minutes` int NOT NULL,
	`max_cost_usd_micros` bigint unsigned NOT NULL,
	`granted_by` bigint unsigned NOT NULL,
	`granted_by_name` varchar(255) NOT NULL,
	`granted_session_id` varchar(128),
	`reason` varchar(500) NOT NULL DEFAULT '',
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`revoked_by` varchar(255),
	`revoke_reason` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `autonomy_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_assignments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`room_id` bigint unsigned NOT NULL,
	`worker_id` bigint unsigned NOT NULL,
	`run_id` bigint unsigned,
	`node_key` varchar(64),
	`state` enum('active','released') NOT NULL DEFAULT 'active',
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`released_at` timestamp,
	CONSTRAINT `office_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_blueprints` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`revision` int NOT NULL,
	`spec` json NOT NULL,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`version` int NOT NULL DEFAULT 1,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`activated_at` timestamp,
	CONSTRAINT `office_blueprints_id` PRIMARY KEY(`id`),
	CONSTRAINT `office_blueprints_project_revision_idx` UNIQUE(`project_id`,`revision`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`seq` bigint unsigned NOT NULL,
	`type` varchar(64) NOT NULL,
	`payload` json NOT NULL,
	`actor` enum('director','node','human','system','worker') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `office_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `office_events_project_seq_idx` UNIQUE(`project_id`,`seq`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `office_rooms` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`blueprint_id` bigint unsigned NOT NULL,
	`room_key` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('director-suite','cartography','research-lab','studio','review','vault','ops') NOT NULL,
	`capacity` int NOT NULL,
	`eligible_role_patterns` json NOT NULL,
	`budgets` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `office_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `office_rooms_blueprint_key_idx` UNIQUE(`blueprint_id`,`room_key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whiteboard_edges` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`whiteboard_id` bigint unsigned NOT NULL,
	`edge_key` varchar(64) NOT NULL,
	`from_key` varchar(64) NOT NULL,
	`to_key` varchar(64) NOT NULL,
	`kind` enum('link','flow','annotation') NOT NULL,
	CONSTRAINT `whiteboard_edges_id` PRIMARY KEY(`id`),
	CONSTRAINT `whiteboard_edges_board_key_idx` UNIQUE(`whiteboard_id`,`edge_key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whiteboard_nodes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`whiteboard_id` bigint unsigned NOT NULL,
	`node_key` varchar(64) NOT NULL,
	`kind` enum('text','sticky','section','artifact-ref','run-node-ref') NOT NULL,
	`content` text NOT NULL,
	`position` json NOT NULL,
	`ref_run_id` bigint unsigned,
	`ref_node_key` varchar(64),
	`ref_artifact_id` bigint unsigned,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whiteboard_nodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `whiteboard_nodes_board_key_idx` UNIQUE(`whiteboard_id`,`node_key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whiteboard_notes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`whiteboard_id` bigint unsigned NOT NULL,
	`node_key` varchar(64),
	`body` text NOT NULL,
	`author` enum('human','agent','system') NOT NULL,
	`author_ref` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whiteboard_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whiteboard_revisions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`whiteboard_id` bigint unsigned NOT NULL,
	`revision` int NOT NULL,
	`doc` json NOT NULL,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whiteboard_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `whiteboard_revisions_board_rev_idx` UNIQUE(`whiteboard_id`,`revision`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `whiteboards` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`title` varchar(500) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`version` int NOT NULL DEFAULT 1,
	`owner_run_id` bigint unsigned,
	`owner_node_key` varchar(64),
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`edit_lease_token` char(36),
	`edit_lease_holder` varchar(255),
	`edit_lease_expires_at` timestamp,
	`created_by` bigint unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whiteboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `budget_ledger` ADD `room_key` varchar(64);--> statement-breakpoint
ALTER TABLE `run_nodes` ADD `room_key` varchar(64);--> statement-breakpoint
ALTER TABLE `runs` ADD `autonomy_grant_id` bigint unsigned;--> statement-breakpoint
ALTER TABLE `runs` ADD `goal_mode` varchar(32) DEFAULT 'build' NOT NULL;--> statement-breakpoint
ALTER TABLE `workers` ADD `room_key` varchar(64);--> statement-breakpoint
ALTER TABLE `workers` ADD `pending_room_key` varchar(64);--> statement-breakpoint
ALTER TABLE `workers` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `autonomy_grants` ADD CONSTRAINT `autonomy_grants_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `autonomy_grants` ADD CONSTRAINT `autonomy_grants_granted_by_users_id_fk` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_assignments` ADD CONSTRAINT `office_assignments_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_assignments` ADD CONSTRAINT `office_assignments_room_id_office_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `office_rooms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_assignments` ADD CONSTRAINT `office_assignments_worker_id_workers_id_fk` FOREIGN KEY (`worker_id`) REFERENCES `workers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_blueprints` ADD CONSTRAINT `office_blueprints_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_blueprints` ADD CONSTRAINT `office_blueprints_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_events` ADD CONSTRAINT `office_events_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_rooms` ADD CONSTRAINT `office_rooms_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `office_rooms` ADD CONSTRAINT `office_rooms_blueprint_id_office_blueprints_id_fk` FOREIGN KEY (`blueprint_id`) REFERENCES `office_blueprints`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboard_edges` ADD CONSTRAINT `whiteboard_edges_whiteboard_id_whiteboards_id_fk` FOREIGN KEY (`whiteboard_id`) REFERENCES `whiteboards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboard_nodes` ADD CONSTRAINT `whiteboard_nodes_whiteboard_id_whiteboards_id_fk` FOREIGN KEY (`whiteboard_id`) REFERENCES `whiteboards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboard_notes` ADD CONSTRAINT `whiteboard_notes_whiteboard_id_whiteboards_id_fk` FOREIGN KEY (`whiteboard_id`) REFERENCES `whiteboards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboard_revisions` ADD CONSTRAINT `whiteboard_revisions_whiteboard_id_whiteboards_id_fk` FOREIGN KEY (`whiteboard_id`) REFERENCES `whiteboards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboard_revisions` ADD CONSTRAINT `whiteboard_revisions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboards` ADD CONSTRAINT `whiteboards_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whiteboards` ADD CONSTRAINT `whiteboards_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `autonomy_grants_project_idx` ON `autonomy_grants` (`project_id`,`expires_at`);--> statement-breakpoint
CREATE INDEX `autonomy_grants_run_idx` ON `autonomy_grants` (`run_id`);--> statement-breakpoint
CREATE INDEX `office_assignments_room_state_idx` ON `office_assignments` (`room_id`,`state`);--> statement-breakpoint
CREATE INDEX `office_assignments_worker_idx` ON `office_assignments` (`worker_id`,`state`);--> statement-breakpoint
CREATE INDEX `office_assignments_run_idx` ON `office_assignments` (`run_id`);--> statement-breakpoint
CREATE INDEX `office_blueprints_project_status_idx` ON `office_blueprints` (`project_id`,`status`);--> statement-breakpoint
CREATE INDEX `office_rooms_project_idx` ON `office_rooms` (`project_id`,`room_key`);--> statement-breakpoint
CREATE INDEX `whiteboard_notes_board_idx` ON `whiteboard_notes` (`whiteboard_id`);--> statement-breakpoint
CREATE INDEX `whiteboards_project_idx` ON `whiteboards` (`project_id`);--> statement-breakpoint
CREATE INDEX `budget_ledger_room_idx` ON `budget_ledger` (`room_key`);--> statement-breakpoint
CREATE INDEX `run_nodes_room_idx` ON `run_nodes` (`run_id`,`room_key`);--> statement-breakpoint
CREATE INDEX `runs_autonomy_grant_idx` ON `runs` (`autonomy_grant_id`);