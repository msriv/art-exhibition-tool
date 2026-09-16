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
} from "@/db/enums";

/**
 * The client-safe half of the admin CRUD config (§15) — column metadata
 * only, no Drizzle table reference. Both the UI (src/components/admin/*,
 * which needs this in the browser) and the server-only resource registry
 * (src/db/admin-resources.ts, which attaches each slug's actual table to
 * this same metadata) import from here, so there is still exactly one
 * definition of each resource's shape.
 */

export type ColumnType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "boolean"
  | "date"
  | "datetime"
  | "enum";

export type ColumnConfig = {
  /** Matches the Drizzle column key (camelCase), not the DB column name. */
  key: string;
  label: string;
  type: ColumnType;
  enumValues?: readonly string[];
  /** True for system-generated/historical fields — id, counters-derived numbers, timestamps. */
  readOnly?: boolean;
  /** Nullable in the schema — the editor allows clearing it, not just leaving a default. */
  nullable?: boolean;
  /** Shown as a column in the list table. Everything is still editable in the detail view regardless. */
  showInList?: boolean;
  filterable?: boolean;
  sortable?: boolean;
};

export type AdminResourceMeta = {
  /** URL segment — /admin/[slug], /api/admin/[slug]. */
  slug: string;
  label: string;
  columns: ColumnConfig[];
  defaultSort: { key: string; direction: "asc" | "desc" };
  /** Columns matched with a case-insensitive LIKE for the free-text search box. */
  searchableColumns?: string[];
};

export const ADMIN_RESOURCE_META: Record<string, AdminResourceMeta> = {
  participants: {
    slug: "participants",
    label: "Participants",
    defaultSort: { key: "updatedAt", direction: "desc" },
    searchableColumns: ["name", "registrationNumber", "mobile", "email"],
    columns: [
      { key: "id", label: "ID", type: "number", readOnly: true },
      { key: "registrationNumber", label: "Registration #", type: "text", readOnly: true, showInList: true, sortable: true },
      { key: "entryId", label: "Entry ID", type: "text", readOnly: true, nullable: true },
      { key: "name", label: "Name", type: "text", showInList: true, sortable: true },
      { key: "dob", label: "Date of birth", type: "date", nullable: true },
      { key: "mobile", label: "Mobile", type: "text", showInList: true },
      { key: "email", label: "Email", type: "text", showInList: true },
      { key: "category", label: "Category", type: "enum", enumValues: CATEGORIES, showInList: true, filterable: true, sortable: true },
      { key: "consentParticipant", label: "Consent (participant)", type: "boolean" },
      { key: "consentGuardian", label: "Consent (guardian)", type: "boolean", nullable: true },
      { key: "source", label: "Source", type: "enum", enumValues: SOURCES },
      { key: "submittedAt", label: "Submitted at", type: "datetime", readOnly: true, sortable: true },
      { key: "ageCategoryCheck", label: "Age/category check", type: "enum", enumValues: AGE_CATEGORY_CHECKS, filterable: true },
      { key: "duplicateCheck", label: "Duplicate check", type: "text" },
      { key: "eligibility", label: "Eligibility", type: "enum", enumValues: ELIGIBILITIES, showInList: true, filterable: true, sortable: true },
      { key: "rejectionReason", label: "Rejection reason", type: "textarea", nullable: true },
      { key: "registrationStatus", label: "Registration status", type: "enum", enumValues: REGISTRATION_STATUSES, showInList: true, filterable: true },
      { key: "iCardStatus", label: "I-Card status", type: "enum", enumValues: I_CARD_STATUSES, showInList: true, filterable: true },
      { key: "posterStatus", label: "Poster status", type: "enum", enumValues: POSTER_STATUSES, showInList: true, filterable: true },
      { key: "prizeStatus", label: "Prize status", type: "enum", enumValues: PRIZE_STATUSES, nullable: true, filterable: true },
      { key: "refundStatus", label: "Refund status", type: "enum", enumValues: REFUND_STATUSES, showInList: true, filterable: true },
      { key: "courierTracking", label: "Courier tracking", type: "text", nullable: true },
      { key: "dispatchDate", label: "Dispatch date", type: "date", nullable: true },
      { key: "adminRemarks", label: "Admin remarks", type: "textarea", nullable: true },
      { key: "updatedAt", label: "Updated at", type: "datetime", readOnly: true, showInList: true, sortable: true },
    ],
  },

  payments: {
    slug: "payments",
    label: "Payments",
    defaultSort: { key: "id", direction: "desc" },
    searchableColumns: ["upiReference"],
    columns: [
      { key: "id", label: "ID", type: "number", readOnly: true },
      { key: "participantId", label: "Participant ID", type: "number", showInList: true, sortable: true },
      { key: "declaredAmount", label: "Declared amount", type: "currency", showInList: true },
      { key: "expectedAmount", label: "Expected amount", type: "currency", showInList: true },
      { key: "feeMatch", label: "Fee match", type: "boolean", showInList: true, filterable: true },
      { key: "upiReference", label: "UPI reference", type: "text", showInList: true },
      { key: "paymentScreenshotUrl", label: "Payment screenshot path", type: "text" },
      { key: "verificationStatus", label: "Verification status", type: "enum", enumValues: VERIFICATION_STATUSES, showInList: true, filterable: true, sortable: true },
      { key: "verifiedAt", label: "Verified at", type: "datetime", nullable: true },
    ],
  },

  entries: {
    slug: "entries",
    label: "Entries (artworks)",
    defaultSort: { key: "submittedAt", direction: "desc" },
    searchableColumns: ["title", "medium"],
    columns: [
      { key: "id", label: "ID", type: "number", readOnly: true },
      { key: "participantId", label: "Participant ID", type: "number", showInList: true, sortable: true },
      { key: "title", label: "Title", type: "text", showInList: true },
      { key: "fileUrl", label: "File path", type: "text" },
      { key: "medium", label: "Medium", type: "text", showInList: true },
      { key: "fileStatus", label: "File status", type: "enum", enumValues: FILE_STATUSES, showInList: true, filterable: true },
      { key: "submittedAt", label: "Submitted at", type: "datetime", readOnly: true, showInList: true, sortable: true },
    ],
  },

  "artist-photos": {
    slug: "artist-photos",
    label: "Artist Photos",
    defaultSort: { key: "id", direction: "desc" },
    columns: [
      { key: "id", label: "ID", type: "number", readOnly: true },
      { key: "participantId", label: "Participant ID", type: "number", showInList: true, sortable: true },
      { key: "fileUrl", label: "File path", type: "text", showInList: true },
      { key: "fileStatus", label: "File status", type: "enum", enumValues: FILE_STATUSES, showInList: true, filterable: true },
    ],
  },

  scores: {
    slug: "scores",
    label: "Scores",
    defaultSort: { key: "id", direction: "desc" },
    columns: [
      { key: "id", label: "ID", type: "number", readOnly: true },
      { key: "entryId", label: "Entry ID", type: "number", showInList: true, sortable: true },
      { key: "score", label: "Score", type: "number", showInList: true, sortable: true },
      { key: "scoringComplete", label: "Scoring complete", type: "boolean", showInList: true, filterable: true },
    ],
  },
};

export const ADMIN_RESOURCE_SLUGS = Object.keys(ADMIN_RESOURCE_META);

export function getAdminResourceMeta(slug: string): AdminResourceMeta | undefined {
  return ADMIN_RESOURCE_META[slug];
}
