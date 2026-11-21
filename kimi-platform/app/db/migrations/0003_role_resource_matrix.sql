CREATE TABLE `evaluation_reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`suite_name` varchar(120) NOT NULL,
	`suite_version` varchar(40) NOT NULL,
	`suite_hash` char(64) NOT NULL,
	`rates` json NOT NULL,
	`config` json NOT NULL,
	`report_hash` char(64) NOT NULL,
	`report` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evaluation_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registry_gaps` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`gap_id` varchar(32) NOT NULL,
	`category` varchar(60) NOT NULL,
	`role_slug` varchar(255) NOT NULL DEFAULT '',
	`role_name` varchar(500) NOT NULL DEFAULT '',
	`summary` text NOT NULL,
	`detail` text NOT NULL,
	`priority` varchar(120) NOT NULL,
	`recommended_action` text NOT NULL,
	`source` varchar(500) NOT NULL,
	CONSTRAINT `registry_gaps_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_gaps_gap_id_idx` UNIQUE(`gap_id`)
);
--> statement-breakpoint
CREATE TABLE `registry_role_candidates` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`name` varchar(500) NOT NULL,
	`status` varchar(60) NOT NULL DEFAULT 'candidate',
	`justification` text NOT NULL,
	`recommended_form` text NOT NULL,
	`split_triggers` json NOT NULL,
	`owned_conditional_capabilities` json NOT NULL,
	`draft_charter` json NOT NULL,
	CONSTRAINT `registry_role_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_role_candidates_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `registry_role_evaluation_tasks` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`task_id` varchar(32) NOT NULL,
	`role_slug` varchar(255) NOT NULL,
	`task_type` varchar(60) NOT NULL,
	`task` text NOT NULL,
	`evidence_required` text NOT NULL,
	CONSTRAINT `registry_role_evaluation_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_role_eval_tasks_task_id_idx` UNIQUE(`task_id`)
);
--> statement-breakpoint
CREATE TABLE `registry_role_profiles` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`role_index` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`family` varchar(255) NOT NULL,
	`mission` text NOT NULL,
	`senior_scope` text NOT NULL,
	`required_capabilities` json NOT NULL,
	`interfaces` json NOT NULL,
	`cross_cutting_ownership` json NOT NULL,
	`charter_source` varchar(1000) NOT NULL,
	`charter_evidence_level` varchar(120) NOT NULL,
	`resources_verified_note` varchar(255) NOT NULL,
	`depth_score` double NOT NULL,
	`depth_band` varchar(60) NOT NULL,
	`depth_heuristic` varchar(255) NOT NULL,
	`depth_factors` json NOT NULL,
	`capability_gaps` json NOT NULL,
	`decomposition_verdict` varchar(32) NOT NULL,
	`decomposition_triggers` json NOT NULL,
	`decomposition_notes` text NOT NULL,
	`scientific_resources` json NOT NULL,
	`skill_packs` json NOT NULL,
	CONSTRAINT `registry_role_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_role_profiles_slug_idx` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `registry_role_resource_links` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`link_id` varchar(32) NOT NULL,
	`role_slug` varchar(255) NOT NULL,
	`resource_url` varchar(1000) NOT NULL,
	`resource_name` varchar(500) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`type` varchar(120) NOT NULL,
	`catalog_level` varchar(255) NOT NULL,
	`prerequisite` varchar(500) NOT NULL,
	`flag` enum('core','internal','conditional') NOT NULL,
	`tier` enum('foundational','core','advanced') NOT NULL,
	`evidence` varchar(16) NOT NULL,
	`access` varchar(255) NOT NULL,
	`license` varchar(255) NOT NULL DEFAULT '',
	`trigger` varchar(500) NOT NULL DEFAULT '',
	`evaluation_task_refs` json NOT NULL,
	`stale` boolean NOT NULL DEFAULT false,
	CONSTRAINT `registry_role_resource_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_role_links_link_id_idx` UNIQUE(`link_id`)
);
--> statement-breakpoint
CREATE TABLE `registry_skill_mappings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`skill_pack` varchar(200) NOT NULL,
	`consumer_role_count` int NOT NULL,
	`consumer_roles` json NOT NULL,
	`note` varchar(1000) NOT NULL DEFAULT '',
	CONSTRAINT `registry_skill_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `registry_skill_mappings_pack_idx` UNIQUE(`skill_pack`)
);
--> statement-breakpoint
ALTER TABLE `artifacts` ADD `prompt_meta` json;--> statement-breakpoint
ALTER TABLE `registry_resources` ADD `evidence_level` varchar(16) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `registry_resources` ADD `link_check` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `registry_resources` ADD `stale` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `evaluation_reports` ADD CONSTRAINT `evaluation_reports_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `evaluation_reports_owner_idx` ON `evaluation_reports` (`owner_id`);--> statement-breakpoint
CREATE INDEX `evaluation_reports_suite_idx` ON `evaluation_reports` (`suite_hash`);--> statement-breakpoint
CREATE INDEX `registry_gaps_role_idx` ON `registry_gaps` (`role_slug`);--> statement-breakpoint
CREATE INDEX `registry_role_eval_tasks_role_idx` ON `registry_role_evaluation_tasks` (`role_slug`);--> statement-breakpoint
CREATE INDEX `registry_role_profiles_name_idx` ON `registry_role_profiles` (`name`);--> statement-breakpoint
CREATE INDEX `registry_role_links_role_idx` ON `registry_role_resource_links` (`role_slug`);--> statement-breakpoint
CREATE INDEX `registry_role_links_url_idx` ON `registry_role_resource_links` (`resource_url`);