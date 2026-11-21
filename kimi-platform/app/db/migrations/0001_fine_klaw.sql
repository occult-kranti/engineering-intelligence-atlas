CREATE TABLE IF NOT EXISTS `integration_discoveries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`record_id` bigint unsigned NOT NULL,
	`kind` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`payload` json NOT NULL,
	`sha256` char(64) NOT NULL,
	`status` enum('quarantined') NOT NULL DEFAULT 'quarantined',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_discoveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `integration_records` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`owner_id` bigint unsigned NOT NULL,
	`provider` enum('openai','anthropic','github','figma','google-drive','mcp') NOT NULL,
	`label` varchar(120) NOT NULL,
	`record_key` char(36) NOT NULL,
	`ciphertext` text,
	`iv` varchar(24) NOT NULL,
	`auth_tag` varchar(24) NOT NULL,
	`key_version` int NOT NULL,
	`metadata` json,
	`last_check_status` enum('unchecked','ok','failed') NOT NULL DEFAULT 'unchecked',
	`last_check_error_class` varchar(120),
	`last_check_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_records_owner_provider_label_idx` UNIQUE(`owner_id`,`provider`,`label`),
	CONSTRAINT `integration_records_record_key_idx` UNIQUE(`record_key`)
);
--> statement-breakpoint
ALTER TABLE `integration_discoveries` ADD CONSTRAINT `integration_discoveries_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_discoveries` ADD CONSTRAINT `integration_discoveries_record_id_integration_records_id_fk` FOREIGN KEY (`record_id`) REFERENCES `integration_records`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_records` ADD CONSTRAINT `integration_records_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `integration_discoveries_record_idx` ON `integration_discoveries` (`record_id`);--> statement-breakpoint
CREATE INDEX `integration_records_owner_idx` ON `integration_records` (`owner_id`);