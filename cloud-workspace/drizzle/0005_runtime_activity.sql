CREATE TABLE `atlas_runtime_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`execution` text NOT NULL,
	`sampled_at_ms` integer NOT NULL,
	`received_at` text NOT NULL
);
