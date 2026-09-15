CREATE TABLE `artist_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`file_url` text NOT NULL,
	`file_status` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "artist_photos_file_status_check" CHECK("file_status" IN ('pending', 'valid', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `artist_photos_participant_id_idx` ON `artist_photos` (`participant_id`);--> statement-breakpoint
CREATE TABLE `counters` (
	`category` text PRIMARY KEY NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "counters_category_check" CHECK("category" IN ('1', '2', '3', 'participation')),
	CONSTRAINT "counters_last_sequence_check" CHECK("last_sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`title` text NOT NULL,
	`file_url` text NOT NULL,
	`medium` text NOT NULL,
	`file_status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "entries_file_status_check" CHECK("file_status" IN ('pending', 'valid', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `entries_participant_id_idx` ON `entries` (`participant_id`);--> statement-breakpoint
CREATE INDEX `entries_submitted_at_idx` ON `entries` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `entries_file_status_idx` ON `entries` (`file_status`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_number` text NOT NULL,
	`entry_id` text,
	`name` text NOT NULL,
	`dob` text,
	`mobile` text NOT NULL,
	`email` text NOT NULL,
	`category` text NOT NULL,
	`consent_participant` integer NOT NULL,
	`consent_guardian` integer,
	`source` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`age_category_check` text DEFAULT 'n/a' NOT NULL,
	`duplicate_check` text DEFAULT 'clear' NOT NULL,
	`eligibility` text DEFAULT 'pending' NOT NULL,
	`rejection_reason` text,
	`registration_status` text DEFAULT 'incomplete' NOT NULL,
	`i_card_status` text DEFAULT 'not_started' NOT NULL,
	`poster_status` text DEFAULT 'not_started' NOT NULL,
	`prize_status` text,
	`refund_status` text DEFAULT 'not_applicable' NOT NULL,
	`courier_tracking` text,
	`dispatch_date` text,
	`admin_remarks` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT "participants_category_check" CHECK("category" IN ('1', '2', '3', 'participation')),
	CONSTRAINT "participants_source_check" CHECK("source" IN ('category_form', 'participation_form')),
	CONSTRAINT "participants_age_category_check" CHECK("age_category_check" IN ('pass', 'flag', 'n/a')),
	CONSTRAINT "participants_eligibility_check" CHECK("eligibility" IN ('pending', 'eligible', 'rejected')),
	CONSTRAINT "participants_registration_status_check" CHECK("registration_status" IN ('incomplete', 'complete')),
	CONSTRAINT "participants_i_card_status_check" CHECK("i_card_status" IN ('not_started', 'in_progress', 'prepared')),
	CONSTRAINT "participants_poster_status_check" CHECK("poster_status" IN ('not_started', 'in_progress', 'included')),
	CONSTRAINT "participants_prize_status_check" CHECK("prize_status" IS NULL OR "prize_status" IN ('announced', 'certificate_ready')),
	CONSTRAINT "participants_refund_status_check" CHECK("refund_status" IN ('not_applicable', 'approved', 'denied')),
	CONSTRAINT "participants_dob_format_check" CHECK("dob" IS NULL OR "dob" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
	CONSTRAINT "participants_dispatch_date_format_check" CHECK("dispatch_date" IS NULL OR "dispatch_date" GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_registration_number_idx` ON `participants` (`registration_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `participants_entry_id_idx` ON `participants` (`entry_id`);--> statement-breakpoint
CREATE INDEX `participants_mobile_idx` ON `participants` (`mobile`);--> statement-breakpoint
CREATE INDEX `participants_email_idx` ON `participants` (`email`);--> statement-breakpoint
CREATE INDEX `participants_category_idx` ON `participants` (`category`);--> statement-breakpoint
CREATE INDEX `participants_eligibility_idx` ON `participants` (`eligibility`);--> statement-breakpoint
CREATE INDEX `participants_registration_status_idx` ON `participants` (`registration_status`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`declared_amount` integer NOT NULL,
	`expected_amount` integer NOT NULL,
	`fee_match` integer NOT NULL,
	`upi_reference` text NOT NULL,
	`payment_screenshot_url` text NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`verified_at` integer,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "payments_verification_status_check" CHECK("verification_status" IN ('pending', 'verified', 'unmatched')),
	CONSTRAINT "payments_declared_amount_check" CHECK("declared_amount" >= 0),
	CONSTRAINT "payments_expected_amount_check" CHECK("expected_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX `payments_participant_id_idx` ON `payments` (`participant_id`);--> statement-breakpoint
CREATE INDEX `payments_upi_reference_idx` ON `payments` (`upi_reference`);--> statement-breakpoint
CREATE INDEX `payments_verification_status_idx` ON `payments` (`verification_status`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`score` real NOT NULL,
	`scoring_complete` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "scores_score_check" CHECK("score" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_entry_id_idx` ON `scores` (`entry_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `whatsapp_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` integer NOT NULL,
	`stage` text NOT NULL,
	`marked_sent_at` integer,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "whatsapp_updates_stage_check" CHECK("stage" IN ('registered', 'accepted', 'results', 'dispatched'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_updates_participant_stage_idx` ON `whatsapp_updates` (`participant_id`,`stage`);