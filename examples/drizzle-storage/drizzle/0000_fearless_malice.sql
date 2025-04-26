CREATE TABLE `idempotent_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`storage_key` text NOT NULL,
	`request_fingerprint` text,
	`request_method` text NOT NULL,
	`request_path` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`locked_at` integer,
	`response_body` text,
	`response_headers` text,
	`response_status` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotent_requests_storage_key_unique` ON `idempotent_requests` (`storage_key`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
