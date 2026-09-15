import { NextResponse, type NextRequest } from "next/server";
import { isOrganizerEmail } from "@/db/admins";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/firebase/session";

/**
 * Gates /admin (pages) and /api/admin/* (routes) behind an organizer session
 * (§16). Runs on every matched request — Proxy always executes on the
 * Node.js runtime in this Next.js version (renamed from `middleware`; see
 * the version 16 upgrade notes), which is what makes it possible to verify a
 * Firebase session cookie here at all: firebase-admin needs Node APIs an
 * Edge runtime wouldn't have.
 *
 * /admin/login and /admin/unauthorized are excluded from the auth check
 * itself (though still matched, so cookie logic below can run) — otherwise
 * an unauthenticated visit to the login page would redirect to itself.
 */

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/admin/unauthorized"]);

/** Header carrying the verified organizer email to downstream route handlers. */
const ORGANIZER_EMAIL_HEADER = "x-organizer-email";

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/admin");
}

function denyUnauthenticated(request: NextRequest): NextResponse {
  const response = isApiRequest(request.nextUrl.pathname)
    ? NextResponse.json({ error: "Sign-in required." }, { status: 401 })
    : NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

function denyUnauthorized(request: NextRequest): NextResponse {
  return isApiRequest(request.nextUrl.pathname)
    ? NextResponse.json({ error: "This account is not an approved organizer." }, { status: 403 })
    : NextResponse.redirect(new URL("/admin/unauthorized", request.url));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return denyUnauthenticated(request);
  }

  const decoded = await verifySessionCookie(sessionCookie);
  if (!decoded?.email) {
    return denyUnauthenticated(request);
  }

  if (!(await isOrganizerEmail(decoded.email))) {
    return denyUnauthorized(request);
  }

  // Strip any client-supplied value for this header before setting our own —
  // otherwise a caller could just set it directly and skip verification.
  const headers = new Headers(request.headers);
  headers.delete(ORGANIZER_EMAIL_HEADER);
  headers.set(ORGANIZER_EMAIL_HEADER, decoded.email);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
