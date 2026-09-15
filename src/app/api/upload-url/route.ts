import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CONTENT_TYPE_EXTENSIONS,
  KIND_PATH_PREFIX,
  MAX_FILE_SIZE_BYTES,
} from "@/config/file-requirements";
import { getAdminStorage } from "@/lib/firebase/admin";

/**
 * Issues a short-lived signed URL so the browser can upload a file straight
 * to Firebase Storage (§3, §8.4) — the file never passes through this
 * server, avoiding upload-size limits on the Next.js route itself.
 *
 * Scope is deliberately limited to the flow mechanics: is this a type/size
 * we accept at all, and here's somewhere safe to put it. The re-check
 * against real bytes §8.4 also asks for — MIME/size again, plus the
 * minimum pixel-resolution check for I-Card/poster printing — needs the
 * file to actually exist first, so it runs later: at registration
 * submission time, in src/db/file-validation.ts, called from the
 * Category/Participation routes right before each entries/artist_photos
 * row is written (milestone 8). Not a separate "upload finished"
 * confirmation call — there was nowhere natural for that call to update
 * anything, since no entries/artist_photos row exists yet at that point.
 *
 * `fileUrl` returned here is a bucket-relative object path, not a URL —
 * matching how the schema already documents these columns ("Firebase
 * Storage path"). Nothing about this path is ever public; reading it back
 * later means generating a fresh signed read URL server-side, same as this
 * one does for writes.
 */

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
