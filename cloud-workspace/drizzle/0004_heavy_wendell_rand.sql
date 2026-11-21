ALTER TABLE `daftar_member_requests` ADD `execution_snapshot` text;--> statement-breakpoint
ALTER TABLE `daftar_member_requests` ADD `usage_json` text;--> statement-breakpoint
ALTER TABLE `daftar_member_requests` ADD `result_json` text;--> statement-breakpoint
ALTER TABLE `daftar_member_requests` ADD `cost_basis` text;--> statement-breakpoint
CREATE INDEX `daftar_request_connection_status` ON `daftar_member_requests` (`connection_id`,`status`);--> statement-breakpoint
CREATE INDEX `daftar_request_grant_status` ON `daftar_member_requests` (`grant_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `daftar_message_request_role` ON `daftar_member_messages` (`request_id`,`role`);