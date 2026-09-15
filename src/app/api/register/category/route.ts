import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_FEES, computeExpectedAmountPaise } from "@/config/fees";
import { db } from "@/db/client";
import { artistPhotos, entries, participants, payments } from "@/db/schema";
import { generateSequentialId } from "@/db/registration-id";

/**
 * Category (1/2/3) sign-up (§5): creates participant + payment + entries +
 * artist_photo in one transaction.
 *
 * This is milestone 5's scope — the transaction mechanics and correct data.
 * The business-rule checks §8 describes (age-vs-category, duplicate
 * detection, fee-match enforcement, file validation) are milestone 8:
 * fee_match is computed and stored here because payments.fee_match is a
 * NOT NULL column with no "not yet evaluated" state to fall back on, but a
 * mismatch does not block the registration — eligibility stays 'pending'
 * and duplicate_check/age_category_check stay at their schema defaults
 * until milestone 8 actually evaluates them.
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

  try {
    const registrationNumber = await db.transaction(
      async (tx) => {
        const registrationNumber = await generateSequentialId(tx, body.category);

        const [participant] = await tx
          .insert(participants)
          .values({
            registrationNumber,
            name: body.name,
            dob: body.dob,
            mobile: body.mobile,
            email: body.email,
            category: body.category,
            consentParticipant: body.consentParticipant,
            consentGuardian: body.consentGuardian ?? null,
            source: "category_form",
            submittedAt,
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
        });

        await tx.insert(entries).values(
          body.paintings.map((painting) => ({
            participantId: participant.id,
            title: painting.title,
            fileUrl: painting.fileUrl,
            medium: painting.medium,
            submittedAt,
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
