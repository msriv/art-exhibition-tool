import "server-only";

import { eq, sql } from "drizzle-orm";
import { categoryForAge, type CompetitiveCategory } from "@/config/fees";
import { participants, payments } from "./schema";
import type { AgeCategoryCheck, Category, Eligibility } from "./enums";

/**
 * Business-rule validation (§8) — deliberately separate from the
 * transaction mechanics milestones 5/6 already built. Everything here
 * *records* an outcome; nothing here blocks a submission from completing.
 * A flagged or pending registration still gets created — it just doesn't
 * become 'eligible', which is what an organizer reviews and clears
 * manually (§15, milestone 9), matching every other check in this build
 * (fee_match, duplicate_check) that records rather than enforces.
 */

/**
 * §8.1: age vs. category, Categories 1/2/3 only. Compares dob against the
 * organizer-editable cutoff date (src/db/settings.ts), never a client- or
 * request-time value — read fresh on every call since it can change
 * between submissions.
 */
export function checkAgeCategory(
  dob: string,
  category: CompetitiveCategory,
  cutoffDate: string,
): AgeCategoryCheck {
  return categoryForAge(dob, cutoffDate) === category ? "pass" : "flag";
}

/**
 * §8.2: duplicate detection — an existing participant sharing a mobile or
 * email, or an existing payment reusing the same upi_reference. Must run
 * inside the caller's own `{ behavior: "immediate" }` transaction, using
 * the transaction handle (not `db`), and *before* inserting the new
 * participant/payment rows: the IMMEDIATE lock is what stops two
 * near-simultaneous submissions from each checking against a database that
 * doesn't yet contain the other's not-yet-committed row — the same
 * protection §7 relies on for the sequence counter, extended to this check
 * by virtue of running in the same transaction.
 *
 * Returns 'clear', or 'flag: <reason>' naming which signal matched and the
 * existing registration it matched against, for the organizer to review.
 */
export async function checkDuplicate(
  tx: {
    select: (typeof import("./client"))["db"]["select"];
  },
  fields: { mobile: string; email: string; upiReference: string },
): Promise<string> {
  const [byMobile] = await tx
    .select({ registrationNumber: participants.registrationNumber })
    .from(participants)
    .where(eq(participants.mobile, fields.mobile))
    .limit(1);
  if (byMobile) {
    return `flag: mobile already used by registration ${byMobile.registrationNumber}`;
  }

  const [byEmail] = await tx
    .select({ registrationNumber: participants.registrationNumber })
    .from(participants)
    .where(sql`lower(${participants.email}) = lower(${fields.email})`)
    .limit(1);
  if (byEmail) {
    return `flag: email already used by registration ${byEmail.registrationNumber}`;
  }

  const [byUpi] = await tx
    .select({ registrationNumber: participants.registrationNumber })
    .from(payments)
    .innerJoin(participants, eq(payments.participantId, participants.id))
    .where(eq(payments.upiReference, fields.upiReference))
    .limit(1);
  if (byUpi) {
    return `flag: UPI reference already used by registration ${byUpi.registrationNumber}`;
  }

  return "clear";
}

/**
 * §8.3's outcome: eligible only once every check that ran actually passed.
 * age_category_check of 'n/a' (Participation — no dob collected) counts as
 * passing; it was never applicable in the first place.
 */
export function computeEligibility(checks: {
  ageCategoryCheck: AgeCategoryCheck;
  duplicateCheck: string;
  feeMatch: boolean;
}): Eligibility {
  const ageOk = checks.ageCategoryCheck !== "flag";
  const duplicateOk = checks.duplicateCheck === "clear";
  return ageOk && duplicateOk && checks.feeMatch ? "eligible" : "pending";
}

/** Whether §8.1's age check even applies — participation collects no dob. */
export function isCompetitiveCategory(category: Category): category is CompetitiveCategory {
  return category === "1" || category === "2" || category === "3";
}
