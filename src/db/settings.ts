import "server-only";

import { eq } from "drizzle-orm";
import { db } from "./client";
import { settings } from "./schema";
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  type SettingKey,
} from "./setting-definitions";

/**
 * Typed access to the organizer-editable `settings` table.
 *
 * Values are stored as TEXT and are editable by hand through the admin CRUD
 * screen, so every read goes through a parser. Nothing outside this file
 * should touch the raw column — a malformed cutoff date would otherwise
 * silently miscategorise children by age rather than failing loudly.
 */

export { SETTING_DEFINITIONS, SETTING_KEYS, type SettingKey };

async function readSetting(key: SettingKey): Promise<string> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  if (!row) {
    throw new Error(
      `Setting "${key}" is missing from the database. Run \`npm run db:seed\` to restore defaults.`,
    );
  }
  return row.value;
}

/**
 * The fixed date age is measured against, as 'YYYY-MM-DD'.
 * Throws rather than falling back if the stored value is missing or malformed.
 */
export async function getAgeCutoffDate(): Promise<string> {
  const definition = SETTING_DEFINITIONS[SETTING_KEYS.AGE_CUTOFF_DATE];
  return definition.parse(await readSetting(definition.key), definition.key);
}

/** Writes a setting after validating it, so the admin UI can't store a bad value. */
export async function updateSetting(key: SettingKey, rawValue: string): Promise<void> {
  const definition = SETTING_DEFINITIONS[key];
  if (!definition) {
    throw new Error(`Unknown setting key "${key}".`);
  }
  const validated = definition.parse(rawValue, key);

  await db
    .update(settings)
    .set({ value: validated, updatedAt: new Date() })
    .where(eq(settings.key, key));
}
