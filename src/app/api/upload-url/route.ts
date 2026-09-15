import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminStorage } from "@/lib/firebase/admin";

/**
 * Issues a short-lived signed URL so the browser can upload a file straight
 * to Firebase Storage (§3, §8.4) — the file never passes through this
 * server, avoiding upload-size limits on the Next.js route itself.
 *
 * Scope is deliberately limited to the flow mechanics: is this a type/size
 * we accept at all, and here's somewhere safe to put it. What §8.4 also
 * asks for — checking again once the browser reports the upload finished,
 * and the minimum pixel-resolution check for I-Card/poster printing with a
 * library like sharp — needs the actual file bytes, which don't exist
 * until after the signed URL is used, so that's milestone 8's job, not
 * this one. There's an open design question there too: whether that
 * re-check happens via a confirmation call after upload, or when the
 * registration is finally submitted (milestones 5/6 currently trust
 * `fileUrl` as an opaque string with no re-verification against Storage at
 * all) — not resolved here.
 *
 * `fileUrl` returned here is a bucket-relative object path, not a URL —
 * matching how the schema already documents these columns ("Firebase
 * Storage path"). Nothing about this path is ever public; reading it back
 * later means generating a fresh signed read URL server-side, same as this
 * one does for writes.
 */

type UploadKind = "artist_photo" | "artwork" | "payment_screenshot";

const KIND_PATH_PREFIX: Record<UploadKind, string> = {
  artist_photo: "artist-photos",
  artwork: "artwork",
  payment_screenshot: "payment-screenshots",
};

/**
 * Per-kind size cap. Not a business rule from either spec doc — a
 * deliberately generous default (nothing here has said what's too large)
 * to stop an obviously wrong upload, not to fine-tune photo quality.
 */
const MAX_FILE_SIZE_BYTES: Record<UploadKind, number> = {
  artist_photo: 10 * 1024 * 1024,
  artwork: 15 * 1024 * 1024,
  payment_screenshot: 10 * 1024 * 1024,
};

/**
 * Extension is derived from the validated content type, never trusted from
 * the client's fileName — a mismatched or spoofed extension on the object
 * path would be confusing later (e.g. a admin dashboard preview link).
 */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const SIGNED_URL_TTL_MS = 10 * 60 * 1000;

const bodySchema = z.object({
  kind: z.enum(["artist_photo", "artwork", "payment_screenshot"]),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  size: z.number().int().positive(),
});

export async function POST(request: Request) {
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
  const { kind, contentType, size } = parsed.data;

  const extension = CONTENT_TYPE_EXTENSIONS[contentType];
  if (!extension) {
    return NextResponse.json(
      { error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." },
      { status: 400 },
    );
  }

  const maxSize = MAX_FILE_SIZE_BYTES[kind];
  if (size > maxSize) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.floor(maxSize / (1024 * 1024))}MB).` },
      { status: 400 },
    );
  }

  const objectPath = `${KIND_PATH_PREFIX[kind]}/${randomUUID()}.${extension}`;

  try {
    const [uploadUrl] = await getAdminStorage()
      .bucket()
      .file(objectPath)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + SIGNED_URL_TTL_MS,
        contentType,
      });

    return NextResponse.json({ uploadUrl, fileUrl: objectPath });
  } catch (error) {
    console.error("POST /api/upload-url failed:", error);
    return NextResponse.json({ error: "Could not prepare an upload. Please try again." }, { status: 500 });
  }
}
