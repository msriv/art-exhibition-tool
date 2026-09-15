import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, opaque token confirming "the user was shown a match for
 * participant N and said yes" (src/lib/register-lookup-types.ts). Stateless
 * — an HMAC-signed payload, not a database row — since this app has no
 * existing session/cache store to put one in and the scale doesn't warrant
 * adding one just for this.
 *
 * The client only ever holds this token, never the matched participant's
 * registration number, so a confirmed match can't be used to go fishing for
 * other participants' data even indirectly.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — long enough to finish the form

function getSecret(): string {
  const secret = process.env.MATCH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("MATCH_TOKEN_SECRET is not set. Copy .env.example to .env.local and fill it in.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createMatchToken(participantId: number): string {
  const payload = JSON.stringify({ pid: participantId, exp: Date.now() + TOKEN_TTL_MS });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

/** Verifies signature and expiry; returns the participant id if valid, otherwise null. */
export function verifyMatchToken(token: string): number | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      pid: number;
      exp: number;
    };
    if (typeof payload.pid !== "number" || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload.pid;
  } catch {
    return null;
  }
}
