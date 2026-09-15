import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "./admin";

/**
 * Session-cookie auth for /admin (§16).
 *
 * The browser signs in with the Firebase client SDK (popup, Google only),
 * then exchanges the resulting ID token for an httpOnly session cookie via
 * POST /api/auth/session. src/proxy.ts verifies that cookie — not the ID
 * token — on every /admin and /api/admin request, because proxy.ts always
 * runs on the Node.js runtime in this Next.js version and has no access to
 * client-side auth state; a cookie is the only thing a request carries on
 * its own.
 */

export const SESSION_COOKIE_NAME = "session";

/** Firebase's own hard cap on session cookie lifetime. */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Verifies a fresh Google ID token and exchanges it for a session cookie
 * value. Does NOT check the organizer allow-list — callers must do that
 * against the returned email before treating the caller as authorized; this
 * only proves "this is a real, currently-valid Google sign-in."
 */
export async function createSessionCookie(
  idToken: string,
): Promise<{ cookie: string; email: string }> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  if (!decoded.email) {
    throw new Error("Google sign-in did not return an email address.");
  }
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  return { cookie, email: decoded.email };
}

/** Verifies a session cookie value. Returns null rather than throwing if invalid/expired. */
export async function verifySessionCookie(cookie: string): Promise<DecodedIdToken | null> {
  try {
    return await getAdminAuth().verifySessionCookie(cookie, true /* checkRevoked */);
  } catch {
    return null;
  }
}
