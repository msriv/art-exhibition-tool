import { NextResponse } from "next/server";
import { z } from "zod";
import { describeError } from "@/db/admin-crud";
import { db } from "@/db/client";
import { SETTING_DEFINITIONS, updateSetting, type SettingKey } from "@/db/settings";
import { settings } from "@/db/schema";

/**
 * GET/PATCH /api/admin/settings — the organizer-editable `settings` table
 * (age_cutoff_date, organizer_upi_id) has no place in the generic admin
 * CRUD from milestone 9 (it's a key/value config table, not one of the
 * five resource tables §15 names), and nothing in the app ever called
 * src/db/settings.ts's updateSetting until now — found live, when a fresh
 * production database's placeholder organizer_upi_id had no way to be
 * replaced before real participants would see it on the payment step.
 */

const KEY_SET = new Set(Object.keys(SETTING_DEFINITIONS));

const bodySchema = z.object({
  key: z.string().refine((k) => KEY_SET.has(k), "Unknown setting key."),
  value: z.string(),
});

export async function GET() {
  try {
    const rows = await db.select({ key: settings.key, value: settings.value }).from(settings);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const result = Object.values(SETTING_DEFINITIONS).map((definition) => ({
      key: definition.key,
      description: definition.description,
      value: byKey.get(definition.key) ?? null,
    }));
    return NextResponse.json({ settings: result });
  } catch (error) {
    console.error("GET /api/admin/settings failed:", error);
    return NextResponse.json({ error: "Could not load settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    await updateSetting(parsed.data.key as SettingKey, parsed.data.value);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/admin/settings failed:", error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}
