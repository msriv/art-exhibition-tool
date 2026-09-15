/**
 * Applies pending Drizzle migrations from ./drizzle to the configured database.
 * Works against both a local file: URL and a remote Turso database.
 *
 *   npm run db:migrate
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readDatabaseConfig } from "../src/db/config";

async function main() {
  const { url, authToken } = readDatabaseConfig();
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  console.log(`Applying migrations to ${url} ...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
