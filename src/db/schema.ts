import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  AGE_CATEGORY_CHECKS,
  CATEGORIES,
  ELIGIBILITIES,
  FILE_STATUSES,
  I_CARD_STATUSES,
  POSTER_STATUSES,
  PRIZE_STATUSES,
  REFUND_STATUSES,
  REGISTRATION_STATUSES,
  SOURCES,
  VERIFICATION_STATUSES,
  WHATSAPP_STAGES,
} from "./enums";

/**
 * Database schema — Technical Plan §4.
 *
 * Conventions used throughout:
 *
 * - Calendar dates (dob, dispatch_date) are stored as 'YYYY-MM-DD' TEXT, not
 *   as timestamps. A date of birth has no time and no timezone; storing it as
 *   an instant is how off-by-one-day age bugs happen.
 * - Points in time (submitted_at, verified_at, updated_at) are stored as unix
 *   epoch seconds and surface as JS Date objects.
 * - Money is stored in PAISE as an integer (Technical Plan §4.2 leaves the
 *   convention to us). Integer paise avoids float rounding entirely; the
 *   admin UI formats it back to rupees for display.
 * - Enumerated values get a CHECK constraint as well as a TypeScript union,
 *   because the admin dashboard can write any field directly.
 */

/** GLOB pattern matching exactly 'YYYY-MM-DD'. GLOB has no '_' wildcard, so digits are spelled out. */
const DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]";

/** Builds the SQL fragment for a CHECK constraint restricting a column to a set of values. */
function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`"${column}" IN (${values.map((v) => `'${v}'`).join(", ")})`);
}

// ---------------------------------------------------------------------------
// §4.1 participants
// ---------------------------------------------------------------------------

export const participants = sqliteTable(
  "participants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    /** Issued on first submission via the Category form. */
    registrationNumber: text("registration_number").notNull(),
    /** Assigned only once registration_status flips to 'complete' (§7). */
    entryId: text("entry_id"),

    name: text("name").notNull(),
    /** 'YYYY-MM-DD'. Required for Categories 1/2/3, not for Participation-only. */
    dob: text("dob"),

    /** Organizer-only visibility — never returned by a public API route (§16). */
    mobile: text("mobile").notNull(),
    /** Organizer-only visibility — never returned by a public API route (§16). */
    email: text("email").notNull(),

    category: text("category", { enum: CATEGORIES }).notNull(),

    consentParticipant: integer("consent_participant", { mode: "boolean" }).notNull(),
    /** Required only when the participant is under 18 at the cutoff date. */
    consentGuardian: integer("consent_guardian", { mode: "boolean" }),

    source: text("source", { enum: SOURCES }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),

    ageCategoryCheck: text("age_category_check", { enum: AGE_CATEGORY_CHECKS })
      .notNull()
      .default("n/a"),
    /**
     * 'clear', or 'flag: <reason>'. Deliberately free text rather than an enum
     * — §8.2 wants the reason carried alongside the flag.
     */
    duplicateCheck: text("duplicate_check").notNull().default("clear"),

    eligibility: text("eligibility", { enum: ELIGIBILITIES }).notNull().default("pending"),
    rejectionReason: text("rejection_reason"),

    registrationStatus: text("registration_status", { enum: REGISTRATION_STATUSES })
      .notNull()
      .default("incomplete"),

    // Manual status fields — set by an organizer, never by application logic.
    iCardStatus: text("i_card_status", { enum: I_CARD_STATUSES })
      .notNull()
      .default("not_started"),
    posterStatus: text("poster_status", { enum: POSTER_STATUSES })
      .notNull()
      .default("not_started"),
    prizeStatus: text("prize_status", { enum: PRIZE_STATUSES }),
    /** Manual record only — no refund logic exists anywhere (§14). */
    refundStatus: text("refund_status", { enum: REFUND_STATUSES })
      .notNull()
      .default("not_applicable"),
    courierTracking: text("courier_tracking"),
    /** 'YYYY-MM-DD'. */
    dispatchDate: text("dispatch_date"),
    adminRemarks: text("admin_remarks"),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("participants_registration_number_idx").on(t.registrationNumber),
    uniqueIndex("participants_entry_id_idx").on(t.entryId),
    // Duplicate detection (§8.2) queries these directly.
    index("participants_mobile_idx").on(t.mobile),
    index("participants_email_idx").on(t.email),
    // Common admin dashboard filters.
    index("participants_category_idx").on(t.category),
    index("participants_eligibility_idx").on(t.eligibility),
    index("participants_registration_status_idx").on(t.registrationStatus),
    check("participants_category_check", oneOf("category", CATEGORIES)),
    check("participants_source_check", oneOf("source", SOURCES)),
    check("participants_age_category_check", oneOf("age_category_check", AGE_CATEGORY_CHECKS)),
    check("participants_eligibility_check", oneOf("eligibility", ELIGIBILITIES)),
    check(
      "participants_registration_status_check",
      oneOf("registration_status", REGISTRATION_STATUSES),
    ),
    check("participants_i_card_status_check", oneOf("i_card_status", I_CARD_STATUSES)),
    check("participants_poster_status_check", oneOf("poster_status", POSTER_STATUSES)),
    check(
      "participants_prize_status_check",
      sql.raw(
        `"prize_status" IS NULL OR "prize_status" IN (${PRIZE_STATUSES.map((v) => `'${v}'`).join(", ")})`,
      ),
    ),
    check("participants_refund_status_check", oneOf("refund_status", REFUND_STATUSES)),
    // Dates must be plain calendar dates, not accidental ISO timestamps.
    // Note GLOB, unlike LIKE, treats '_' literally — hence the digit classes.
    check("participants_dob_format_check", sql.raw(`"dob" IS NULL OR "dob" GLOB '${DATE_GLOB}'`)),
    check(
      "participants_dispatch_date_format_check",
      sql.raw(`"dispatch_date" IS NULL OR "dispatch_date" GLOB '${DATE_GLOB}'`),
    ),
  ],
);

// ---------------------------------------------------------------------------
// §4.2 payments
// ---------------------------------------------------------------------------

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),

    /** Paise, as declared by the participant on the form. */
    declaredAmount: integer("declared_amount").notNull(),
    /** Paise, computed server-side from category + medium + entry count (§8.3). */
    expectedAmount: integer("expected_amount").notNull(),
    feeMatch: integer("fee_match", { mode: "boolean" }).notNull(),

    /**
     * Not unique by design. §8.2 requires a reused reference to be accepted
     * and flagged for organizer review, not rejected at the database level.
     */
    upiReference: text("upi_reference").notNull(),
    paymentScreenshotUrl: text("payment_screenshot_url").notNull(),

    verificationStatus: text("verification_status", { enum: VERIFICATION_STATUSES })
      .notNull()
      .default("pending"),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
  },
  (t) => [
    index("payments_participant_id_idx").on(t.participantId),
    // Duplicate check (§8.2) and CSV reconciliation (§10) both key on this.
    index("payments_upi_reference_idx").on(t.upiReference),
    index("payments_verification_status_idx").on(t.verificationStatus),
    check(
      "payments_verification_status_check",
      oneOf("verification_status", VERIFICATION_STATUSES),
    ),
    check("payments_declared_amount_check", sql.raw(`"declared_amount" >= 0`)),
    check("payments_expected_amount_check", sql.raw(`"expected_amount" >= 0`)),
  ],
);

// ---------------------------------------------------------------------------
// §4.3 entries (artworks)
// ---------------------------------------------------------------------------

export const entries = sqliteTable(
  "entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    /** Firebase Storage path — the source file for poster production. */
    fileUrl: text("file_url").notNull(),
    medium: text("medium").notNull(),
    fileStatus: text("file_status", { enum: FILE_STATUSES }).notNull().default("pending"),

    /**
     * For a multi-painting Participation submission every row written by that
     * one submission carries an identical value here (§6).
     */
    submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    index("entries_participant_id_idx").on(t.participantId),
    index("entries_submitted_at_idx").on(t.submittedAt),
    index("entries_file_status_idx").on(t.fileStatus),
    check("entries_file_status_check", oneOf("file_status", FILE_STATUSES)),
  ],
);

// ---------------------------------------------------------------------------
// §4.4 artist_photos
// ---------------------------------------------------------------------------

export const artistPhotos = sqliteTable(
  "artist_photos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),

    /** Firebase Storage path — the source file for I-Card production. */
    fileUrl: text("file_url").notNull(),
    fileStatus: text("file_status", { enum: FILE_STATUSES }).notNull().default("pending"),
  },
  (t) => [
    index("artist_photos_participant_id_idx").on(t.participantId),
    check("artist_photos_file_status_check", oneOf("file_status", FILE_STATUSES)),
  ],
);

// ---------------------------------------------------------------------------
// §4.5 scores
// ---------------------------------------------------------------------------

export const scores = sqliteTable(
  "scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),

    /** Single overall score. No per-judge breakdown is modelled (§11). */
    score: real("score").notNull(),
    /** Gates rank/result computation — ranks are never computed mid-scoring. */
    scoringComplete: integer("scoring_complete", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    // One overall score per entry (§4.5), so a second row is a data error.
    uniqueIndex("scores_entry_id_idx").on(t.entryId),
    check("scores_score_check", sql.raw(`"score" >= 0`)),
  ],
);

// ---------------------------------------------------------------------------
// §4.6 whatsapp_updates
// ---------------------------------------------------------------------------

export const whatsappUpdates = sqliteTable(
  "whatsapp_updates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),

    stage: text("stage", { enum: WHATSAPP_STAGES }).notNull(),
    /** Set manually by an organizer after sending. Nothing auto-sends (§12). */
    markedSentAt: integer("marked_sent_at", { mode: "timestamp" }),
  },
  (t) => [
    // One log row per participant per stage.
    uniqueIndex("whatsapp_updates_participant_stage_idx").on(t.participantId, t.stage),
    check("whatsapp_updates_stage_check", oneOf("stage", WHATSAPP_STAGES)),
  ],
);

// ---------------------------------------------------------------------------
// §4.7 counters
// ---------------------------------------------------------------------------

export const counters = sqliteTable(
  "counters",
  {
    category: text("category", { enum: CATEGORIES }).primaryKey(),
    /** Incremented inside a transaction so concurrent submissions can't collide (§7). */
    lastSequence: integer("last_sequence").notNull().default(0),
  },
  () => [
    check("counters_category_check", oneOf("category", CATEGORIES)),
    check("counters_last_sequence_check", sql.raw(`"last_sequence" >= 0`)),
  ],
);

// ---------------------------------------------------------------------------
// settings — not in the original spec
// ---------------------------------------------------------------------------

/**
 * Organizer-editable configuration, exposed through the admin CRUD layer.
 *
 * The technical plan keeps configuration in code (§4.7), and the fee table and
 * age bands still live there. The age cutoff date moved here because the
 * organizer needs to change it without a redeploy.
 *
 * Values are TEXT regardless of their logical type. Always read them through
 * the typed accessors in ./settings.ts, which parse and validate — never
 * consume a raw value from this table directly.
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  /** Shown to the organizer in the admin UI so the field is self-explanatory. */
  description: text("description").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type ArtistPhoto = typeof artistPhotos.$inferSelect;
export type NewArtistPhoto = typeof artistPhotos.$inferInsert;
export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;
export type WhatsappUpdate = typeof whatsappUpdates.$inferSelect;
export type NewWhatsappUpdate = typeof whatsappUpdates.$inferInsert;
export type Counter = typeof counters.$inferSelect;
export type Setting = typeof settings.$inferSelect;
