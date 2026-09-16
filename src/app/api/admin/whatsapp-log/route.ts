import { NextResponse } from "next/server";
import { z } from "zod";
import { describeError } from "@/db/admin-crud";
import { WHATSAPP_STAGES } from "@/db/enums";
import { getSendLog, markSent } from "@/db/whatsapp";

/**
 * §12's POST /api/admin/whatsapp-log — "simply records that a message was
 * marked as sent, and when." Nothing here sends anything.
 *
 * The GET here isn't named in the spec, but the page needs some way to show
 * which of a participant's four stages are already marked sent (and when)
 * before an organizer decides what to send next — reading the same table
 * POST writes to, under the same route.
 */

const bodySchema = z.object({
  participantId: z.number().int().positive(),
  stage: z.enum(WHATSAPP_STAGES),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const participantId = Number(url.searchParams.get("participantId"));
  if (!Number.isInteger(participantId) || participantId <= 0) {
    return NextResponse.json({ error: "A valid participantId is required." }, { status: 400 });
  }

  try {
    const log = await getSendLog(participantId);
    return NextResponse.json({ log });
  } catch (error) {
    console.error("GET /api/admin/whatsapp-log failed:", error);
    return NextResponse.json({ error: "Could not load send log." }, { status: 500 });
  }
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const markedSentAt = await markSent(parsed.data.participantId, parsed.data.stage);
    return NextResponse.json({ markedSentAt });
  } catch (error) {
    console.error("POST /api/admin/whatsapp-log failed:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}
