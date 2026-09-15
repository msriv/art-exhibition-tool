/**
 * Shapes for the two registration API routes (§5). Provisional — milestones
 * 5 and 6 build the actual routes and may refine these, but this is the
 * contract the forms (milestone 4) are written against.
 */

export type PaintingSubmission = {
  title: string;
  medium: string;
  fileUrl: string;
};

export type PaymentSubmission = {
  declaredAmountPaise: number;
  upiReference: string;
  paymentScreenshotUrl: string;
};

export type CategoryRegistrationPayload = {
  category: "1" | "2" | "3";
  name: string;
  dob: string; // 'YYYY-MM-DD'
  mobile: string;
  email: string;
  consentParticipant: true;
  consentGuardian?: boolean;
  artistPhotoUrl: string;
  paintings: PaintingSubmission[];
  payment: PaymentSubmission;
};

export type ParticipationRegistrationPayload = {
  /**
   * Optional — someone with no prior Category submission can use this form
   * directly. Resolution order the server (milestone 6) applies:
   *   1. registrationNumber given and matches an existing participant →
   *      attach entries to that participant.
   *   2. registrationNumber omitted (or given but not found — still open,
   *      see README) → attempt to match an existing participant by name,
   *      email, or mobile (the organizer's clarification on this; distinct
   *      from §8.2's duplicate_check, which flags rather than merges).
   *   3. No match → create a new participant with a freshly-generated
   *      CP-nnnnn number, same counter mechanism as §7.
   * Name/mobile/email are always collected (not just when no number is
   * given) since they double as dedup signal even when a number is present.
   */
  registrationNumber?: string;
  name: string;
  mobile: string;
  email: string;
  consentParticipant: true;
  paintings: PaintingSubmission[];
  payment: PaymentSubmission;
};
