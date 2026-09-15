CREATE TABLE `admins` (
	`email` text PRIMARY KEY NOT NULL,
	`note` text,
	`added_at` integer NOT NULL,
	CONSTRAINT "admins_email_format_check" CHECK("email" LIKE '%_@_%.__%'),
	CONSTRAINT "admins_email_lowercase_check" CHECK("email" = lower("email"))
);
