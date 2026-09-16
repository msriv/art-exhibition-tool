import "server-only";

import { and, eq } from "drizzle-orm";
import { WHATSAPP_TEMPLATES, type TemplateContext } from "@/config/whatsapp-templates";
import { db } from "./client";
import { WHATSAPP_STAGES, type WhatsAppStage } from "./enums";
import { participants, whatsappUpdates } from "./schema";

/**
 * Manual WhatsApp workflow (§12) — GET .../whatsapp-text renders ready-made
 * copy for a participant + stage; POST .../whatsapp-log just records that an
 * organizer sent it by hand, and when. No messaging API involved anywhere.
 */

async function loadTemplateContext(participantId: number): Promise<TemplateContext | undefined> {
  const [participant] = await db
    .select({
      name: participants.name,
      registrationNumber: participants.registrationNumber,
      category: participants.category,
      entryId: participants.entryId,
      courierTracking: participants.courierTracking,
      dispatchDate: participants.dispatchDate,
    })
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1);
  return participant;
}

export async function buildMessageText(
  participantId: number,
  stage: WhatsAppStage,
): Promise<string | undefined> {
  const context = await loadTemplateContext(participantId);
  if (!context) return undefined;
  return WHATSAPP_TEMPLATES[stage](context);
}

export type SendLog = Record<WhatsAppStage, Date | null>;

export async function getSendLog(participantId: number): Promise<SendLog> {
  const rows = await db
    .select({ stage: whatsappUpdates.stage, markedSentAt: whatsappUpdates.markedSentAt })
    .from(whatsappUpdates)
    .where(eq(whatsappUpdates.participantId, participantId));

  const log = Object.fromEntries(WHATSAPP_STAGES.map((stage) => [stage, null])) as SendLog;
  for (const row of rows) {
    log[row.stage] = row.markedSentAt;
  }
  return log;
}

export async function markSent(participantId: number, stage: WhatsAppStage): Promise<Date> {
  const sentAt = new Date();
  const [existing] = await db
    .select({ id: whatsappUpdates.id })
    .from(whatsappUpdates)
    .where(and(eq(whatsappUpdates.participantId, participantId), eq(whatsappUpdates.stage, stage)))
    .limit(1);

  if (existing) {
    await db.update(whatsappUpdates).set({ markedSentAt: sentAt }).where(eq(whatsappUpdates.id, existing.id));
  } else {
    await db.insert(whatsappUpdates).values({ participantId, stage, markedSentAt: sentAt });
  }
  return sentAt;
}
