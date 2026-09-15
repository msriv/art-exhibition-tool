import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { maskIdentity } from "@/db/mask-identity";
import { participants } from "@/db/schema";
import { createMatchToken } from "@/lib/match-token";
import type { MatchResponse } from "@/lib/register-lookup-types";

/**
 * Looks for an existing participant when the Participation form was
 * submitted with no registration number. A match is never acted on here —
 * it's returned as a masked preview plus an opaque token, and the client
 * (src/components/register/participation-form.tsx) requires an explicit
 * "yes, link this" before the token is ever used.
 *
 * Matching signals: email or mobile only. Name is accepted in the request
 * (kept for parity with the documented contract and available for a human
 * reviewer later) but deliberately not used to trigger a match on its own —
 * it's the weakest of the three signals (nothing stops two participants
 * legitimately sharing a name), and unlike email/mobile it isn't even
 * indexed for this purpose. Matching on it risks confidently suggesting the
 * wrong person, which the confirmation prompt would only partially guard
 * against.
 *
 * Neither email nor mobile is unique in the schema (§8.2 wants a reused
 * value flagged, not rejected), so more than one existing participant can
 * share either — the most recently created match wins within each signal
 * before the email/mobile tie-break rule below applies.
 *
 * Known limitation: mobile numbers are compared as typed (trimmed, exact
 * match) — "+91 98765 43210" and "9876543210" won't match each other. Worth
 * a normalization pass later; not attempted here.
 */

const bodySchema = z.object({
  name: z.string().trim().min(1),
  mobile: z.string().trim().min(1),
  email: z.string().trim().email(),
});

async function findByEmail(email: string) {
  const [row] = await db
    .select({ id: participants.id, name: participants.name, mobile: participants.mobile, email: participants.email })
    .from(participants)
    .where(sql`lower(${participants.email}) = lower(${email})`)
    .orderBy(desc(participants.id))
    .limit(1);
  return row;
}

async function findByMobile(mobile: string) {
  const [row] = await db
    .select({ id: participants.id, name: participants.name, mobile: participants.mobile, email: participants.email })
    .from(participants)
    .where(eq(participants.mobile, mobile))
    .orderBy(desc(participants.id))
    .limit(1);
  return row;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "name, mobile, and email are required." },
      { status: 400 },
    );
  }
  const { mobile, email } = parsed.data;

  const [byEmail, byMobile] = await Promise.all([findByEmail(email), findByMobile(mobile)]);

  // Email wins if email and mobile point to different existing participants.
  const matched = byEmail ?? byMobile;

  const response: MatchResponse = matched
    ? { matched: true, matchToken: createMatchToken(matched.id), ...maskIdentity(matched) }
    : { matched: false };

  return NextResponse.json(response);
}
