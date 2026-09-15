"use client";

/**
 * Uploads a file straight to storage via a short-lived signed URL (§3, §8.4)
 * from POST /api/upload-url (milestone 7). MIME type and size are checked
 * before the URL is issued; the pixel-resolution check for I-Card/poster
 * printing and any re-check once the upload finishes are milestone 8 — see
 * that route's comments for why.
 *
 * The 404 handling below predates the route's existence and is now mostly
 * defensive (a mid-deploy version mismatch, a future rename) rather than
 * the expected path — kept because it degrades to a clear, catchable error
 * instead of a raw fetch exception either way.
 */

export type UploadKind = "artist_photo" | "artwork" | "payment_screenshot";

export class UploadNotAvailableError extends Error {
  constructor() {
    super("File upload isn't available right now — please try again in a moment.");
    this.name = "UploadNotAvailableError";
  }
}

/** Uploads `file` and returns its storage path/URL for use as `fileUrl` in a registration payload. */
export async function uploadFile(file: File, kind: UploadKind): Promise<string> {
  const urlResponse = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, fileName: file.name, contentType: file.type, size: file.size }),
  });

  if (urlResponse.status === 404) {
    throw new UploadNotAvailableError();
  }
  if (!urlResponse.ok) {
    const body = (await urlResponse.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not get an upload URL.");
  }

  const { uploadUrl, fileUrl } = (await urlResponse.json()) as {
    uploadUrl: string;
    fileUrl: string;
  };

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error("File upload failed partway through — please try again.");
  }

  return fileUrl;
}
