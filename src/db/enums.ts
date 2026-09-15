/**
 * Enumerated column values, shared by the Drizzle schema, the validation
 * layer, and the admin resource configs so the three can never drift apart.
 *
 * Every one of these is also enforced at the database level with a CHECK
 * constraint (see schema.ts) — the admin dashboard writes arbitrary fields,
 * so the database is the last line of defence against a bad status value.
 */

export const CATEGORIES = ["1", "2", "3", "participation"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SOURCES = ["category_form", "participation_form"] as const;
export type Source = (typeof SOURCES)[number];

export const AGE_CATEGORY_CHECKS = ["pass", "flag", "n/a"] as const;
export type AgeCategoryCheck = (typeof AGE_CATEGORY_CHECKS)[number];

export const ELIGIBILITIES = ["pending", "eligible", "rejected"] as const;
export type Eligibility = (typeof ELIGIBILITIES)[number];

export const REGISTRATION_STATUSES = ["incomplete", "complete"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const I_CARD_STATUSES = ["not_started", "in_progress", "prepared"] as const;
export type ICardStatus = (typeof I_CARD_STATUSES)[number];

export const POSTER_STATUSES = ["not_started", "in_progress", "included"] as const;
export type PosterStatus = (typeof POSTER_STATUSES)[number];

export const PRIZE_STATUSES = ["announced", "certificate_ready"] as const;
export type PrizeStatus = (typeof PRIZE_STATUSES)[number];

/**
 * Manual field only. An organizer sets this after an off-system decision —
 * nothing in this codebase initiates, calculates, or triggers a refund
 * (Technical Plan §14).
 */
export const REFUND_STATUSES = ["not_applicable", "approved", "denied"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const VERIFICATION_STATUSES = ["pending", "verified", "unmatched"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const FILE_STATUSES = ["pending", "valid", "rejected"] as const;
export type FileStatus = (typeof FILE_STATUSES)[number];

export const WHATSAPP_STAGES = ["registered", "accepted", "results", "dispatched"] as const;
export type WhatsAppStage = (typeof WHATSAPP_STAGES)[number];

/** Prefix used when generating registration/entry IDs (Technical Plan §7). */
export const CATEGORY_CODES: Record<Category, string> = {
  "1": "C1",
  "2": "C2",
  "3": "C3",
  participation: "CP",
};
