import "server-only";

import { eq } from "drizzle-orm";
import { db } from "./client";
import { admins } from "./schema";

/**
 * Organizer allow-list (§16: "an organizer allow-list (env var or a small
 * admins table)"). Two sources, checked as a union:
 *
 * 1. SEED_ADMIN_EMAILS — a comma-separated env var, fixed until redeploy.
 *    Intended for one or two owner accounts as a break-glass fallback: even
 *    if every row in the `admins` table is deleted by mistake, these emails
 *    can still sign in and re-add others. Deliberately NOT mirrored into the
 *    database — if it were, deleting the row through the admin CRUD would
 *    look like it revoked access when it hadn't, since the env var would
 *    still authorize that email.
 * 2. The `admins` table — organizer-editable. This is what grows over time.
 *
 * All comparisons are case-insensitive: emails are normalised to lowercase
 * both on write and on check, since Firebase's ID token email claim casing
 * shouldn't be able to accidentally lock someone out or leave a stale
 * duplicate.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertValidEmail(email: string): void {
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(`"${email}" does not look like a valid email address.`);
  }
}

/** The fixed, env-configured fallback admins. Never stored in the database. */
export function getSeedAdminEmails(): string[] {
  const raw = process.env.SEED_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

/** True if this email is allowed into /admin, from either source. */
export async function isOrganizerEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (getSeedAdminEmails().includes(normalized)) {
    return true;
  }
  const [row] = await db
    .select({ email: admins.email })
    .from(admins)
    .where(eq(admins.email, normalized))
    .limit(1);
  return !!row;
}

/** Adds an organizer to the database-backed half of the allow-list. Idempotent. */
export async function addAdminEmail(email: string, note?: string): Promise<void> {
  const normalized = normalizeEmail(email);
  assertValidEmail(normalized);
  await db.insert(admins).values({ email: normalized, note: note ?? null }).onConflictDoNothing();
}

/**
 * Removes an organizer from the database-backed half of the allow-list.
 * Has no effect on a SEED_ADMIN_EMAILS entry — that's the point (see above).
 */
export async function removeAdminEmail(email: string): Promise<void> {
  await db.delete(admins).where(eq(admins.email, normalizeEmail(email)));
}

export type AdminListEntry = {
  email: string;
  source: "seed" | "database";
  note: string | null;
  addedAt: Date | null;
};

/** Every currently-authorized email, for display in the admin dashboard. */
export async function listOrganizerEmails(): Promise<AdminListEntry[]> {
  const dbRows = await db.select().from(admins);
  const dbEmails = new Set(dbRows.map((row) => row.email));

  const seedEntries: AdminListEntry[] = getSeedAdminEmails()
    .filter((email) => !dbEmails.has(email))
    .map((email) => ({ email, source: "seed", note: null, addedAt: null }));

  const dbEntries: AdminListEntry[] = dbRows.map((row) => ({
    email: row.email,
    source: "database",
    note: row.note,
    addedAt: row.addedAt,
  }));

  return [...seedEntries, ...dbEntries].sort((a, b) => a.email.localeCompare(b.email));
}
