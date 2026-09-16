import { NextResponse } from "next/server";
import { WHATSAPP_STAGES, type WhatsAppStage } from "@/db/enums";
import { buildMessageText } from "@/db/whatsapp";

const STAGE_SET = new Set<string>(WHATSAPP_STAGES);

/** GET /api/admin/whatsapp-text?participantId=&stage= (§12) — ready-made copy, never sent by the system itself. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const participantId = Number(url.searchParams.get("participantId"));
  const stage = url.searchParams.get("stage");

  if (!Number.isInteger(participantId) || participantId <= 0) {
    return NextResponse.json({ error: "A valid participantId is required." }, { status: 400 });
  }
  if (!stage || !STAGE_SET.has(stage)) {
    return NextResponse.json({ error: `Unknown stage "${stage}".` }, { status: 400 });
  }

  try {
    const text = await buildMessageText(participantId, stage as WhatsAppStage);
    if (text === undefined) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }
    return NextResponse.json({ text });
  } catch (error) {
    console.error("GET /api/admin/whatsapp-text failed:", error);
    return NextResponse.json({ error: "Could not build message text." }, { status: 500 });
  }
}
