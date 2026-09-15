/**
 * Definitions for the organizer-editable `settings` table.
 *
 * Pure data and parsers, with no database import, so the seed script (plain
 * Node) and the admin resource config can both read them.
 */

export const SETTING_KEYS = {
  /** Fixed date the whole event's age calculations are measured against (§8.1). */
  AGE_CUTOFF_DATE: "age_cutoff_date",
  /**
   * The organizer's own UPI VPA (e.g. "name@bank"), shown to participants on
   * the payment step so they know where to send money. Not in the spec —
   * the forms can't render a payment step without it. Organizer-editable
   * since a UPI ID can change.
   */
  ORGANIZER_UPI_ID: "organizer_upi_id",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Matches 'YYYY-MM-DD' and rejects impossible dates like 2026-02-30. */
export function parseCalendarDate(raw: string, key: string): string {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Setting "${key}" must be a date in YYYY-MM-DD format, got "${raw}".`);
  }
  const asDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime()) || asDate.toISOString().slice(0, 10) !== value) {
    throw new Error(`Setting "${key}" is not a real calendar date: "${raw}".`);
  }
  return value;
}

/** Loose VPA shape check (`name@bank`) — not exhaustive, just catches an empty or garbled value. */
export function parseUpiId(raw: string, key: string): string {
  const value = raw.trim();
  if (!/^[\w.\-]{2,256}@[\w.\-]{2,64}$/.test(value)) {
    throw new Error(`Setting "${key}" doesn't look like a UPI ID (expected "name@bank"): "${raw}".`);
  }
  return value;
}

export type SettingDefinition = {
  key: SettingKey;
  description: string;
  /** Seeded on first run; the organizer edits it from the admin dashboard. */
  defaultValue: string;
  parse: (raw: string, key: string) => string;
};

export const SETTING_DEFINITIONS: Record<SettingKey, SettingDefinition> = {
  [SETTING_KEYS.AGE_CUTOFF_DATE]: {
    key: SETTING_KEYS.AGE_CUTOFF_DATE,
    description:
      "Date that every participant's age is calculated against for the category check. " +
      "Fixed for the whole event, so a participant's category cannot change mid-window.",
    // PLACEHOLDER — not a real event date. Replace it in the admin dashboard
    // before the age check goes live.
    defaultValue: "2026-12-31",
    parse: parseCalendarDate,
  },
  [SETTING_KEYS.ORGANIZER_UPI_ID]: {
    key: SETTING_KEYS.ORGANIZER_UPI_ID,
    description:
      "UPI ID participants should pay to. Shown on the payment step of both sign-up forms.",
    // PLACEHOLDER — not a real UPI ID. Replace it before the forms go live.
    defaultValue: "replace-with-organizer-upi-id@upi",
    parse: parseUpiId,
  },
};
