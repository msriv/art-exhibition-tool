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
  /** Issued by an earlier Category submission — Participation never mints one. */
  registrationNumber: string;
  paintings: PaintingSubmission[];
  payment: PaymentSubmission;
};
