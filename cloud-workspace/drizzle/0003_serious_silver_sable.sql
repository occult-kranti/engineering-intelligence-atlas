CREATE TABLE `daftar_collaboration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text(80) NOT NULL,
	`company_id` text(120),
	`scope_id` text(200),
	`summary` text(1000) NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daftar_collab_event_date` ON `daftar_collaboration_events` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `daftar_users` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text(300) NOT NULL,
	`subject` text(300) NOT NULL,
	`email` text(320),
	`display_name` text(200),
	`status` text(20) DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daftar_user_issuer_subject` ON `daftar_users` (`issuer`,`subject`);--> statement-breakpoint
CREATE TABLE `daftar_company_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text(80) DEFAULT 'owner' NOT NULL,
	`company_id` text(120) NOT NULL,
	`user_id` text NOT NULL,
	`role` text(20) NOT NULL,
	`status` text(20) DEFAULT 'active' NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`acl_revision` integer DEFAULT 1 NOT NULL,
	`granted_by_user_id` text NOT NULL,
	`revoked_by_user_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daftar_membership_company_user` ON `daftar_company_memberships` (`company_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `daftar_membership_user` ON `daftar_company_memberships` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `daftar_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`provider` text(40) NOT NULL,
	`label` text(120) NOT NULL,
	`ciphertext` text NOT NULL,
	`nonce` text(64) NOT NULL,
	`key_version` text(40) NOT NULL,
	`account_meta` text(2000),
	`status` text(20) DEFAULT 'active' NOT NULL,
	`model` text(120),
	`cap_micros` integer,
	`input_rate_micros` integer,
	`output_rate_micros` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daftar_connection_owner` ON `daftar_connections` (`owner_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `daftar_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text(120) NOT NULL,
	`role` text(20) NOT NULL,
	`token_digest` text(64) NOT NULL,
	`intended_email` text(320),
	`invited_by_user_id` text NOT NULL,
	`status` text(20) DEFAULT 'pending' NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by_user_id` text,
	`accepted_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daftar_invitations_token_digest_unique` ON `daftar_invitations` (`token_digest`);--> statement-breakpoint
CREATE INDEX `daftar_invitation_company` ON `daftar_invitations` (`company_id`,`status`);--> statement-breakpoint
CREATE TABLE `daftar_member_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text(120) NOT NULL,
	`author_user_id` text NOT NULL,
	`visibility` text(20) NOT NULL,
	`role` text(20) NOT NULL,
	`content` text(20000) NOT NULL,
	`request_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daftar_message_company` ON `daftar_member_messages` (`company_id`,`visibility`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `daftar_member_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text(120) NOT NULL,
	`requester_user_id` text NOT NULL,
	`payer_user_id` text NOT NULL,
	`connection_id` text,
	`grant_id` text,
	`operation` text(60) NOT NULL,
	`idempotency_key` text(150) NOT NULL,
	`input_hash` text(64) NOT NULL,
	`status` text(20) NOT NULL,
	`reserved_micros` integer NOT NULL,
	`cost_micros` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` text NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daftar_request_actor_key` ON `daftar_member_requests` (`requester_user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `daftar_request_admission` ON `daftar_member_requests` (`payer_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `daftar_resource_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`beneficiary_user_id` text NOT NULL,
	`company_id` text(120) NOT NULL,
	`operations` text(1000) NOT NULL,
	`model` text(120),
	`repo_allowlist` text(4000),
	`per_request_cap_micros` integer,
	`total_cap_micros` integer,
	`max_concurrent` integer DEFAULT 1 NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daftar_grant_beneficiary` ON `daftar_resource_grants` (`beneficiary_user_id`,`company_id`);--> statement-breakpoint
CREATE TABLE `daftar_task_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text(120) NOT NULL,
	`requester_user_id` text NOT NULL,
	`approver_user_id` text,
	`assigned_user_id` text,
	`brief` text(10000) NOT NULL,
	`source_hash` text(64) NOT NULL,
	`evidence_links` text(4000),
	`status` text(20) DEFAULT 'proposed' NOT NULL,
	`queued_command_id` text,
	`native_ref` text(200),
	`decided_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `daftar_proposal_company` ON `daftar_task_proposals` (`company_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `daftar_workspace_owners` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bound_at` text NOT NULL
);
