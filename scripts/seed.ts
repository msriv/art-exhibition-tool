/**
 * Seeds the rows the application needs in order to function at all:
 * the per-category ID counters (§7) and the organizer-editable settings.
 *
 * Idempotent — existing rows are left untouched, so running it against a
 * live database will not reset a counter or overwrite an edited setting.
 *
 *   npm run db:seed
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readDatabaseConfig } from "../src/db/config";
import { CATEGORIES } from "../src/db/enums";
import { counters, settings } from "../src/db/schema";
import { SETTING_DEFINITIONS } from "../src/db/setting-definitions";

async function main() {
  const { url, authToken } = readDatabaseConfig();
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  const counterRows = CATEGORIES.map((category) => ({ category, lastSequence: 0 }));
  await db.insert(counters).values(counterRows).onConflictDoNothing();
  console.log(`Counters ensured for: ${CATEGORIES.join(", ")}`);

  const settingRows = Object.values(SETTING_DEFINITIONS).map((definition) => ({
    key: definition.key,
    value: definition.defaultValue,
    description: definition.description,
    updatedAt: new Date(),
  }));
  await db.insert(settings).values(settingRows).onConflictDoNothing();
  for (const definition of Object.values(SETTING_DEFINITIONS)) {
    console.log(`Setting ensured: ${definition.key} (default "${definition.defaultValue}")`);
  }

  console.log("Seed complete.");
  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
