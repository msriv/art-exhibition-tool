/**
 * Adds an email to the database-backed half of the organizer allow-list
 * (src/db/admins.ts). Stopgap until the admin CRUD dashboard (§15,
 * milestone 9) can do this from the browser.
 *
 *   npm run db:add-admin -- someone@example.com "optional note"
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readDatabaseConfig } from "../src/db/config";
import { admins } from "../src/db/schema";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const [rawEmail, note] = process.argv.slice(2);
  if (!rawEmail) {
    console.error('Usage: npm run db:add-admin -- someone@example.com "optional note"');
    process.exit(1);
  }

  const email = normalizeEmail(rawEmail);
  if (!EMAIL_REGEX.test(email)) {
    console.error(`"${rawEmail}" does not look like a valid email address.`);
    process.exit(1);
  }

  const { url, authToken } = readDatabaseConfig();
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  await db.insert(admins).values({ email, note: note ?? null }).onConflictDoNothing();
  console.log(`"${email}" can now sign in to /admin (once milestone 3 wires up the check).`);

  client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
