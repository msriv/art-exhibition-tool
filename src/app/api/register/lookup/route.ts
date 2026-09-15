import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { maskIdentity } from "@/db/mask-identity";
import { participants } from "@/db/schema";
import type { LookupResponse } from "@/lib/register-lookup-types";

/**
 * Resolves a registration number the user typed into the Participation
 * form. Returns a masked preview only — never the real name/mobile/email —
 * since a registration number is sequentially guessable and §16 forbids
 * public routes from returning contact details. See
 * src/lib/register-lookup-types.ts for the full design rationale.
 *
 * A miss here is meant to be a hard stop on the form, not a hint to try
 * matching by name/email/mobile instead — that distinction is enforced by
 * the client (src/components/register/participation-form.tsx), not here;
 * this route just answers the one question it's asked.
 */

const bodySchema = z.object({
  registrationNumber: z.string().trim().min(1),
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
    return NextResponse.json({ error: "registrationNumber is required." }, { status: 400 });
  }

  const [participant] = await db
    .select({ name: participants.name, mobile: participants.mobile, email: participants.email })
    .from(participants)
    .where(eq(participants.registrationNumber, parsed.data.registrationNumber))
    .limit(1);

  const response: LookupResponse = participant
    ? { found: true, ...maskIdentity(participant) }
    : { found: false };

  return NextResponse.json(response);
}
