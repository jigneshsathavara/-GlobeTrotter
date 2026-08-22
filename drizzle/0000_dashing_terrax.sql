CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`stop_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`notes` text,
	`activity_date` text,
	`start_time` text,
	FOREIGN KEY (`stop_id`) REFERENCES `stops`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `cities_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`region` text NOT NULL,
	`avg_cost_index` real NOT NULL,
	`popularity_score` integer NOT NULL,
	`tagline` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`day_date` text,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stops` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`city_name` text NOT NULL,
	`country` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`description` text,
	`cover_photo_url` text,
	`is_public` integer DEFAULT false NOT NULL,
	`budget_limit` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`photo_url` text,
	`language` text DEFAULT 'English' NOT NULL,
	`saved_destinations` text DEFAULT '[]' NOT NULL,
	`role` text DEFAULT 'traveler' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);