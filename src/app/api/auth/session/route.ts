import { NextResponse } from "next/server";
import { isOrganizerEmail } from "@/db/admins";
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/firebase/session";

/**
 * Exchanges a fresh Google ID token (from the client-side sign-in popup) for
 * an httpOnly session cookie — but only for an email on the organizer
 * allow-list (§16). A valid Google sign-in from anyone else is rejected
 * here; no cookie is issued, so src/proxy.ts never even sees an unauthorized
 * session.
 */
export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Missing idToken." }, { status: 400 });
  }

  let cookie: string;
  let email: string;
  try {
    ({ cookie, email } = await createSessionCookie(idToken));
  } catch {
    return NextResponse.json({ error: "Could not verify Google sign-in." }, { status: 401 });
  }

  if (!(await isOrganizerEmail(email))) {
    return NextResponse.json(
      { error: "This Google account is not on the organizer allow-list." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true, email });
  response.cookies.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return response;
}

/** Signs out by clearing the session cookie. Firebase-side token revocation isn't needed here. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
