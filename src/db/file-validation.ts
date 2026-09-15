import "server-only";

import sharp from "sharp";
import {
  CONTENT_TYPE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MIN_RESOLUTION,
  type UploadKind,
} from "@/config/file-requirements";
import { assertAdminCredentialsAvailable, getAdminStorage } from "@/lib/firebase/admin";
import type { FileStatus } from "./enums";

/**
 * §8.4's second check — MIME/size against the real uploaded object, plus
 * pixel resolution for I-Card/poster printing — run once, at registration
 * submission time (Category/Participation routes), against whatever is
 * actually sitting at `objectPath` in Storage. Everything at issuance time
 * (POST /api/upload-url) only had the client's word for what it was about
 * to upload.
 *
 * Thrown errors and a returned 'rejected' mean two different things, and
 * callers must not conflate them:
 * - `FileVerificationUnavailableError` — Storage couldn't be reached at
 *   all (no credentials, network failure). This is an environment problem,
 *   not a finding about the file, and callers should leave file_status at
 *   its 'pending' default rather than falsely recording 'rejected' for a
 *   file nobody actually looked at.
 * - A returned 'rejected' — the object was reachable and inspected, and it
 *   genuinely doesn't meet the requirements (wrong type, too large, or too
 *   low-resolution).
 *
 * Credentials are checked explicitly, up front — see
 * assertAdminCredentialsAvailable's own comment for why that can't just be
 * inferred from how `exists()`/`getMetadata()` themselves fail: with no
 * credentials at all, those calls go out anonymously and Google's API
 * returns a plain "not found" for a private bucket rather than an auth
 * error, which would otherwise look identical to a genuinely missing file.
 */

export class FileVerificationUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Could not reach Storage to verify the uploaded file.");
    this.cause = cause;
  }
}

export async function validateUploadedFile(objectPath: string, kind: UploadKind): Promise<FileStatus> {
  try {
    await assertAdminCredentialsAvailable();
  } catch (error) {
    throw new FileVerificationUnavailableError(error);
  }

  let file;
  try {
    file = getAdminStorage().bucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      // Credentials are confirmed working (checked above), so this is a
      // real finding — reachable Storage, genuinely no such object.
      return "rejected";
    }
  } catch (error) {
    throw new FileVerificationUnavailableError(error);
  }

  try {
    const [metadata] = await file.getMetadata();

    if (!metadata.contentType || !CONTENT_TYPE_EXTENSIONS[metadata.contentType]) {
      return "rejected";
    }
    if (Number(metadata.size ?? 0) > MAX_FILE_SIZE_BYTES[kind]) {
      return "rejected";
    }

    const resolutionRule = MIN_RESOLUTION[kind];
    if (resolutionRule) {
      const [buffer] = await file.download();
      const { width, height } = await sharp(buffer).metadata();
      if (!width || !height) {
        return "rejected";
      }
      const tooSmall =
        "minLongEdge" in resolutionRule
          ? Math.max(width, height) < resolutionRule.minLongEdge
          : width < resolutionRule.minWidth || height < resolutionRule.minHeight;
      if (tooSmall) {
        return "rejected";
      }
    }

    return "valid";
  } catch (error) {
    throw new FileVerificationUnavailableError(error);
  }
}

/**
 * Runs `validateUploadedFile`, but treats an unreachable Storage as "leave
 * it pending" instead of propagating — the shape every call site in the
 * registration routes actually wants, since a sandbox or outage shouldn't
 * block a registration or falsely reject someone's file.
 */
export async function validateUploadedFileOrPending(objectPath: string, kind: UploadKind): Promise<FileStatus> {
  try {
    return await validateUploadedFile(objectPath, kind);
  } catch (error) {
    if (error instanceof FileVerificationUnavailableError) {
      console.warn(`File verification unavailable for ${objectPath}:`, error.cause);
      return "pending";
    }
    throw error;
  }
}
