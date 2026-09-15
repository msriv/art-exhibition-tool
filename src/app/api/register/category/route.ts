import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_FEES, computeExpectedAmountPaise } from "@/config/fees";
import { db } from "@/db/client";
import { validateUploadedFileOrPending } from "@/db/file-validation";
import { generateSequentialId } from "@/db/registration-id";
import { checkAgeCategory, checkDuplicate, computeEligibility } from "@/db/registration-validation";
import { artistPhotos, entries, participants, payments } from "@/db/schema";
import { getAgeCutoffDate } from "@/db/settings";

/**
 * Category (1/2/3) sign-up (§5): creates participant + payment + entries +
 * artist_photo in one transaction, now with the business-rule checks §8
 * describes (age-vs-category, duplicate detection) layered onto the
 * transaction mechanics milestone 5 built.
 *
 * Every check here *records* an outcome; none of them block the
 * registration from being created (see src/db/registration-validation.ts).
 * A flagged submission still exists, in the same 'pending' state as one
 * that's simply awaiting review — an organizer clears it manually
 * (§15, milestone 9), the same pattern already used for fee_match.
 *
 * File checks run *before* the transaction opens, not inside it — they're
 * network calls to Storage, and holding the transaction's IMMEDIATE lock
 * for however long that takes would needlessly block other concurrent
 * submissions. The duplicate check, by contrast, runs *inside* the
 * transaction (fast, DB-only) specifically to get the same IMMEDIATE-lock
 * race protection §7 relies on for the sequence counter — see
 * checkDuplicate's own comment for why that matters.
 */

const CALENDAR_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const paintingSchema = z.object({
  title: z.string().trim().min(1),
  medium: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1),
});

const bodySchema = z
  .object({
    category: z.enum(["1", "2", "3"]),
    name: z.string().trim().min(1),
    dob: z.string().regex(CALENDAR_DATE_REGEX, "dob must be 'YYYY-MM-DD'"),
    mobile: z.string().trim().min(1),
    email: z.string().trim().email(),
    consentParticipant: z.literal(true),
    consentGuardian: z.boolean().optional(),
    artistPhotoUrl: z.string().trim().min(1),
    paintings: z.array(paintingSchema).min(1),
    payment: z.object({
      declaredAmountPaise: z.number().int().min(0),
      upiReference: z.string().trim().min(1),
      paymentScreenshotUrl: z.string().trim().min(1),
    }),
  })
  .superRefine((value, ctx) => {
    const maxEntries = CATEGORY_FEES[value.category].maxEntries;
    if (value.paintings.length > maxEntries) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paintings"],
        message: `Category ${value.category} allows at most ${maxEntries} paintings.`,
      });
    }
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

  const expectedAmountPaise = computeExpectedAmountPaise(body.category, 1);
  const feeMatch = body.payment.declaredAmountPaise === expectedAmountPaise;
  const submittedAt = new Date();

  const [cutoffDate, artistPhotoStatus, paintingStatuses] = await Promise.all([
    getAgeCutoffDate(),
    validateUploadedFileOrPending(body.artistPhotoUrl, "artist_photo"),
    Promise.all(body.paintings.map((p) => validateUploadedFileOrPending(p.fileUrl, "artwork"))),
  ]);
  const ageCategoryCheck = checkAgeCategory(body.dob, body.category, cutoffDate);

  try {
    const registrationNumber = await db.transaction(
      async (tx) => {
        const duplicateCheck = await checkDuplicate(tx, {
          mobile: body.mobile,
          email: body.email,
          upiReference: body.payment.upiReference,
        });
        const eligibility = computeEligibility({ ageCategoryCheck, duplicateCheck, feeMatch });

        const registrationNumber = await generateSequentialId(tx, body.category);
        // Only assigned once eligible (§7) — a fresh draw from the same
        // counter, not a copy of registrationNumber, so the numbers that
        // end up on I-Cards/posters stay dense even though
        // registration_number has gaps from anyone never approved.
        const entryId = eligibility === "eligible" ? await generateSequentialId(tx, body.category) : null;

        const [participant] = await tx
          .insert(participants)
          .values({
            registrationNumber,
            entryId,
            name: body.name,
            dob: body.dob,
            mobile: body.mobile,
            email: body.email,
            category: body.category,
            consentParticipant: body.consentParticipant,
            consentGuardian: body.consentGuardian ?? null,
            source: "category_form",
            submittedAt,
            ageCategoryCheck,
            duplicateCheck,
            eligibility,
            registrationStatus: eligibility === "eligible" ? "complete" : "incomplete",
          })
          .returning({ id: participants.id });

        await tx.insert(payments).values({
          participantId: participant.id,
          declaredAmount: body.payment.declaredAmountPaise,
          expectedAmount: expectedAmountPaise,
          feeMatch,
          upiReference: body.payment.upiReference,
          paymentScreenshotUrl: body.payment.paymentScreenshotUrl,
        });

        await tx.insert(artistPhotos).values({
          participantId: participant.id,
          fileUrl: body.artistPhotoUrl,
          fileStatus: artistPhotoStatus,
        });

        await tx.insert(entries).values(
          body.paintings.map((painting, i) => ({
            participantId: participant.id,
            title: painting.title,
            fileUrl: painting.fileUrl,
            medium: painting.medium,
            submittedAt,
            fileStatus: paintingStatuses[i],
          })),
        );

        return registrationNumber;
      },
      { behavior: "immediate" },
    );

    return NextResponse.json({ ok: true, registrationNumber }, { status: 201 });
  } catch (error) {
    console.error("POST /api/register/category failed:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
