CREATE TABLE `atlas_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`command` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`base_revision` integer NOT NULL,
	`created_at` text NOT NULL,
	`acknowledged_at` text,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_commands_idempotency_key_unique` ON `atlas_commands` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `atlas_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`client_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_devices_token_hash_unique` ON `atlas_devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `atlas_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_key` text NOT NULL,
	`request_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_message_request_role` ON `atlas_messages` (`request_id`,`role`);--> statement-breakpoint
CREATE TABLE `atlas_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`scope_key` text NOT NULL,
	`status` text NOT NULL,
	`request_hash` text NOT NULL,
	`reserved_micros` integer NOT NULL,
	`cost_micros` integer,
	`usage` text,
	`reply` text,
	`created_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_requests_idempotency_key_unique` ON `atlas_requests` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `atlas_workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`snapshot` text DEFAULT '{}' NOT NULL,
	`source_client_id` text,
	`updated_at` text NOT NULL
);
