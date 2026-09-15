/**
 * Upload constraints (§8.4), shared between the pre-issuance check
 * (POST /api/upload-url, milestone 7) and the post-upload re-verification
 * (src/db/file-validation.ts, milestone 8) — the same rules apply at both
 * points, just against declared values first and real inspected bytes
 * later.
 */

export type UploadKind = "artist_photo" | "artwork" | "payment_screenshot";

export const KIND_PATH_PREFIX: Record<UploadKind, string> = {
  artist_photo: "artist-photos",
  artwork: "artwork",
  payment_screenshot: "payment-screenshots",
};

/**
 * Extension is derived from the validated content type, never trusted from
 * the client's fileName — a mismatched or spoofed extension on the object
 * path would be confusing later (e.g. an admin dashboard preview link).
 */
export const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Per-kind size cap. Not a business rule from either spec doc — a
 * deliberately generous default (nothing here has said what's too large)
 * to stop an obviously wrong upload, not to fine-tune photo quality.
 */
export const MAX_FILE_SIZE_BYTES: Record<UploadKind, number> = {
  artist_photo: 10 * 1024 * 1024,
  artwork: 15 * 1024 * 1024,
  payment_screenshot: 10 * 1024 * 1024,
};

export type ResolutionRule = { minWidth: number; minHeight: number } | { minLongEdge: number };

/**
 * The organizer's decision from early in this build: 1200×1600 for the
 * artist photo (I-Card), 2000px on the long edge for artwork (poster).
 * Payment screenshots have no resolution requirement — nothing needs to
 * print them. Only kinds with a rule here get the sharp-based dimension
 * check at registration time; the others skip straight to "valid" once
 * type/size are confirmed against the real object.
 */
export const MIN_RESOLUTION: Partial<Record<UploadKind, ResolutionRule>> = {
  artist_photo: { minWidth: 1200, minHeight: 1600 },
  artwork: { minLongEdge: 2000 },
};
