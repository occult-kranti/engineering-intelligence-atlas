CREATE INDEX `atlas_command_queue` ON `atlas_commands` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `daftar_event_date` ON `daftar_integration_events` (`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `atlas_message_scope_date` ON `atlas_messages` (`scope_key`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `atlas_message_cursor` ON `atlas_messages` (`created_at`,`id`);