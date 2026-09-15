"use client";

/**
 * Uploads a file straight to storage via a short-lived signed URL (§3, §8.4).
 *
 * The signed-URL endpoint (POST /api/upload-url) and its server-side MIME/
 * size/resolution checks are milestone 7 — they don't exist yet. This is
 * written against the real, intended contract rather than stubbed, so it
 * starts working the moment that endpoint lands with no changes here. Until
 * then it fails with a clear, catchable error instead of a raw fetch
 * exception, which the calling form surfaces to the user.
 */

export type UploadKind = "artist_photo" | "artwork" | "payment_screenshot";

export class UploadNotAvailableError extends Error {
  constructor() {
    super(
      "File upload isn't available yet — this will start working once the signed-upload-URL " +
        "endpoint (milestone 7) is deployed.",
    );
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
