import { PLATFORM_NAME } from "./platform";
import type { Category, WhatsAppStage } from "@/db/enums";

/**
 * Ready-made message text per stage (§12) — copied and sent manually by an
 * organizer via WhatsApp Web/app. Nothing here sends anything; these are
 * just starting text an organizer can edit before sending, so the wording
 * doesn't need to be exact, just useful.
 */

export type TemplateContext = {
  name: string;
  registrationNumber: string;
  category: Category;
  entryId: string | null;
  courierTracking: string | null;
  dispatchDate: string | null;
};

function categoryLabel(category: Category): string {
  return category === "participation" ? "Participation" : `Category ${category}`;
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppStage, (ctx: TemplateContext) => string> = {
  registered: (ctx) =>
    `Hi ${ctx.name}, thanks for registering for ${PLATFORM_NAME}! Your registration number is ` +
    `${ctx.registrationNumber} (${categoryLabel(ctx.category)}). We'll be in touch with next steps soon.`,

  accepted: (ctx) =>
    `Hi ${ctx.name}, good news — your registration (${ctx.registrationNumber}) has been reviewed and accepted.` +
    (ctx.entryId ? ` Your entry ID is ${ctx.entryId}.` : "") +
    ` Thank you for being part of ${PLATFORM_NAME}!`,

  results: (ctx) =>
    `Hi ${ctx.name}, results for ${categoryLabel(ctx.category)} are out! Please check in with us for your ` +
    `entry's outcome. Thank you for taking part in ${PLATFORM_NAME}.`,

  dispatched: (ctx) =>
    `Hi ${ctx.name}, your prize/certificate has been dispatched` +
    (ctx.courierTracking ? ` — tracking number ${ctx.courierTracking}` : "") +
    (ctx.dispatchDate ? ` (sent ${ctx.dispatchDate})` : "") +
    `. Thank you again for being part of ${PLATFORM_NAME}!`,
};
