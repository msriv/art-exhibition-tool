import type { Category } from "@/db/enums";

/**
 * Fee table and age bands (Technical Plan §9). Kept as code, not a DB table,
 * per §4.7 — these rarely change and aren't meant to be organizer-editable
 * the way the age cutoff *date* (settings table) is.
 *
 * The technical doc (§8.1) and the stakeholder doc (§5) disagree on the
 * Category 2/3 boundary — the stakeholder doc's "10+ to 18" / "18+" overlaps
 * at 18. The technical doc's non-overlapping bands are authoritative here
 * (an 18-year-old is Category 2; Category 3 starts at 19) — flagged to the
 * user when this was built; unresolved as of writing.
 *
 * Money is in paise throughout, matching the schema convention.
 */

export type CompetitiveCategory = "1" | "2" | "3";

export type AgeBand = {
  category: CompetitiveCategory;
  minAge: number;
  /** Inclusive. null = no upper bound (Category 3). */
  maxAge: number | null;
};

export const AGE_BANDS: readonly AgeBand[] = [
  { category: "1", minAge: 5, maxAge: 10 },
  { category: "2", minAge: 11, maxAge: 18 },
  { category: "3", minAge: 19, maxAge: null },
];

export type CategoryFeeConfig = {
  category: CompetitiveCategory;
  ageBand: AgeBand;
  mediums: readonly string[];
  /** Flat fee in paise, covering up to maxEntries paintings. */
  feePaise: number;
  maxEntries: number;
};

export const CATEGORY_FEES: Record<CompetitiveCategory, CategoryFeeConfig> = {
  "1": {
    category: "1",
    ageBand: AGE_BANDS[0],
    mediums: ["Pencil colours", "Crayon colours", "Water colours"],
    feePaise: 39_900,
    maxEntries: 2,
  },
  "2": {
    category: "2",
    ageBand: AGE_BANDS[1],
    mediums: ["Water colours", "Acrylic colours", "Mixed media"],
    feePaise: 49_900,
    maxEntries: 2,
  },
  "3": {
    category: "3",
    ageBand: AGE_BANDS[2],
    mediums: ["Water colours", "Acrylic", "Charcoal", "Oil", "Mixed media"],
    feePaise: 79_900,
    maxEntries: 2,
  },
};

/** ₹99 per painting, open-ended (per the organizer's decision) — capped only
 * by PARTICIPATION_MAX_ENTRIES below as a sanity ceiling against a malformed
 * or abusive request, not a real business rule. */
export const PARTICIPATION_FEE_PER_ENTRY_PAISE = 9_900;

/** Sanity ceiling, not a business rule — flagged to the organizer as removable. */
export const PARTICIPATION_MAX_ENTRIES = 20;

export function computeExpectedAmountPaise(category: Category, entryCount: number): number {
  if (category === "participation") {
    return PARTICIPATION_FEE_PER_ENTRY_PAISE * entryCount;
  }
  return CATEGORY_FEES[category].feePaise;
}

export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Age in whole years on `asOfDate`, given a 'YYYY-MM-DD' date of birth. */
export function calculateAge(dob: string, asOfDate: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ay, am, ad] = asOfDate.split("-").map(Number);
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) {
    age -= 1;
  }
  return age;
}

/** Which competitive category a date of birth falls into as of the cutoff date, if any. */
export function categoryForAge(dob: string, cutoffDate: string): CompetitiveCategory | null {
  const age = calculateAge(dob, cutoffDate);
  const band = AGE_BANDS.find((b) => age >= b.minAge && (b.maxAge === null || age <= b.maxAge));
  return band?.category ?? null;
}
