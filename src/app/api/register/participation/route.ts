import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeExpectedAmountPaise, PARTICIPATION_MAX_ENTRIES } from "@/config/fees";
import { db } from "@/db/client";
import { validateUploadedFileOrPending } from "@/db/file-validation";
import { generateSequentialId } from "@/db/registration-id";
import { checkDuplicate, computeEligibility } from "@/db/registration-validation";
import { entries, participants, payments } from "@/db/schema";
import { verifyMatchToken } from "@/lib/match-token";

/**
 * Participation-only sign-up (§5, §6, §8). Handles all three identity paths
 * the form (src/components/register/participation-form.tsx) can resolve
 * to — re-verified here rather than trusted from the client, since a
 * request could reach this endpoint directly without going through
 * /lookup or /match first:
 *
 *   1. registrationNumber given -> must resolve to an existing participant.
 *      A miss is a hard error, never a silent fall-through to path 2.
 *   2. confirmedMatchToken given -> must still verify (signature + not
 *      expired) and resolve to a participant that still exists.
 *   3. Neither given -> creates a new participant with a freshly-generated
 *      CP-nnnnn number (same mechanism as Category's C1/C2/C3, §7).
 *
 * Multi-entry handling (§6): submittedAt is read once, before any writes,
 * and every entries row from this submission shares that exact value —
 * never a separately-stamped time per painting.
 *
 * §8's business-rule checks (duplicate detection, eligibility, entry_id
 * assignment) apply *only* to path 3. Paths 1 and 2 add entries/a payment
 * to a participant whose own age/duplicate/eligibility state was already
 * decided when they were first created — a later top-up submission never
 * re-evaluates or overwrites that; re-reviewing a still-pending
 * participant is an organizer/admin-dashboard concern (milestone 9), not
 * something a new submission does on its own. age_category_check doesn't
 * apply to any path here at all — Participation never collects a dob.
 *
 * File checks (§8.4) do apply uniformly to every path's paintings, and run
 * before the transaction opens for the same reason as the Category route:
 * they're Storage network calls, and holding the IMMEDIATE lock for their
 * duration would needlessly block other concurrent submissions.
 */

class RegistrationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const paintingSchema = z.object({
  title: z.string().trim().min(1),
  medium: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
});

const bodySchema = z
  .object({
    registrationNumber: z.string().trim().min(1).optional(),
    confirmedMatchToken: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    mobile: z.string().trim().min(1),
    email: z.string().trim().email(),
    consentParticipant: z.literal(true),
    paintings: z.array(paintingSchema).min(1).max(PARTICIPATION_MAX_ENTRIES),
    payment: z.object({
      declaredAmountPaise: z.number().int().min(0),
      upiReference: z.string().trim().min(1),
      paymentScreenshotUrl: z.string().trim().min(1),
    }),
  })
  .refine((v) => !(v.registrationNumber && v.confirmedMatchToken), {
    message: "Provide at most one of registrationNumber or confirmedMatchToken.",
  });

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;

  const expectedAmountPaise = computeExpectedAmountPaise("participation", body.paintings.length);
  const feeMatch = body.payment.declaredAmountPaise === expectedAmountPaise;
  const submittedAt = new Date();

  const paintingStatuses = await Promise.all(
    body.paintings.map((p) => validateUploadedFileOrPending(p.fileUrl, "artwork")),
  );

  try {
    const registrationNumber = await db.transaction(
      async (tx) => {
        let participantId: number;
        let registrationNumber: string;

        if (body.registrationNumber) {
          const [existing] = await tx
            .select({ id: participants.id, registrationNumber: participants.registrationNumber })
            .from(participants)
            .where(eq(participants.registrationNumber, body.registrationNumber))
            .limit(1);
          if (!existing) {
            // Never falls through to match-by-PII — a typo has to be fixed
            // by the person, not silently reinterpreted.
            throw new RegistrationError("We couldn't find that registration number.", 404);
          }
          participantId = existing.id;
          registrationNumber = existing.registrationNumber;
        } else if (body.confirmedMatchToken) {
          const matchedParticipantId = verifyMatchToken(body.confirmedMatchToken);
          if (matchedParticipantId === null) {
            throw new RegistrationError("That confirmation has expired. Please check again.", 409);
          }
          const [existing] = await tx
            .select({ id: participants.id, registrationNumber: participants.registrationNumber })
            .from(participants)
            .where(eq(participants.id, matchedParticipantId))
            .limit(1);
          if (!existing) {
            throw new RegistrationError("That confirmed match no longer exists. Please check again.", 409);
          }
          participantId = existing.id;
          registrationNumber = existing.registrationNumber;
        } else {
          const duplicateCheck = await checkDuplicate(tx, {
            mobile: body.mobile,
            email: body.email,
            upiReference: body.payment.upiReference,
          });
          // No dob is ever collected here, so the age check never applies —
          // 'n/a' counts as passing in computeEligibility.
          const eligibility = computeEligibility({ ageCategoryCheck: "n/a", duplicateCheck, feeMatch });

          registrationNumber = await generateSequentialId(tx, "participation");
          // Fresh draw from the same counter once eligible (§7) — not a
          // copy of registrationNumber — same reasoning as the Category
          // route: keeps entry_id dense even though registration_number
          // has gaps from anyone never approved.
          const entryId = eligibility === "eligible" ? await generateSequentialId(tx, "participation") : null;

          const [created] = await tx
            .insert(participants)
            .values({
              registrationNumber,
              entryId,
              name: body.name,
              dob: null,
              mobile: body.mobile,
              email: body.email,
              category: "participation",
              consentParticipant: body.consentParticipant,
              consentGuardian: null,
              source: "participation_form",
              submittedAt,
              duplicateCheck,
              eligibility,
              registrationStatus: eligibility === "eligible" ? "complete" : "incomplete",
            })
            .returning({ id: participants.id });
          participantId = created.id;
        }

        await tx.insert(payments).values({
          participantId,
          declaredAmount: body.payment.declaredAmountPaise,
          expectedAmount: expectedAmountPaise,
          feeMatch,
          upiReference: body.payment.upiReference,
          paymentScreenshotUrl: body.payment.paymentScreenshotUrl,
        });

        await tx.insert(entries).values(
          body.paintings.map((painting, i) => ({
            participantId,
            title: painting.title,
            fileUrl: painting.fileUrl,
            medium: painting.medium,
            submittedAt, // same value for every painting in this submission (§6)
            fileStatus: paintingStatuses[i],
          })),
        );

        return registrationNumber;
      },
      { behavior: "immediate" },
    );

    return NextResponse.json({ ok: true, registrationNumber }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/register/participation failed:", error);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}
