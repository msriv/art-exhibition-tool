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
   * Present only after POST /api/register/lookup confirmed it exists (see
   * register-lookup-types.ts). A number that doesn't resolve is a hard
   * error on the form itself — never sent here, and never silently
   * replaced by a name/email/mobile guess.
   */
  registrationNumber?: string;
  /**
   * Present only after POST /api/register/match found a candidate AND the
   * user explicitly confirmed it's them. Mutually exclusive with
   * registrationNumber — at most one identity-resolution path is active.
   */
  confirmedMatchToken?: string;
  /**
   * Always collected from the form. Used to create a new participant only
   * when neither field above is present — ignored otherwise, since the
   * server uses the existing record's stored identity rather than trusting
   * client-resent values for an already-identified participant.
   */
  name: string;
  mobile: string;
  email: string;
  consentParticipant: true;
  paintings: PaintingSubmission[];
  payment: PaymentSubmission;
};
