import "server-only";

import { getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Server-side Firebase Admin SDK.
 *
 * Uses Application Default Credentials — no downloaded service-account key.
 * On Cloud Run / Firebase App Hosting this resolves to the service's own
 * identity automatically. For local development off-GCP, run
 * `gcloud auth application-default login` once, or point
 * GOOGLE_APPLICATION_CREDENTIALS at a downloaded key — either way, no code
 * here changes.
 *
 * Lazily initialised, like src/db/client.ts, so importing this module (or
 * running `next build`) never requires credentials to be present.
 */

function getFirebaseProjectId(): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set.");
  }
  return projectId;
}

function getStorageBucketName(): string {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set.");
  }
  return bucket;
}

let cachedApp: App | undefined;

function getAdminApp(): App {
  if (!cachedApp) {
    const existing = getApps();
    cachedApp =
      existing[0] ??
      initializeApp({
        credential: applicationDefault(),
        projectId: getFirebaseProjectId(),
        storageBucket: getStorageBucketName(),
      });
  }
  return cachedApp;
}

let cachedAuth: Auth | undefined;

/** Server-side Firebase Auth — verifying ID tokens and session cookies. */
export function getAdminAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getAdminApp());
  }
  return cachedAuth;
}

let cachedStorage: Storage | undefined;

/** Server-side Firebase Storage — signed URLs (milestone 7) and file re-verification (milestone 8). */
export function getAdminStorage(): Storage {
  if (!cachedStorage) {
    cachedStorage = getStorage(getAdminApp());
  }
  return cachedStorage;
}

/**
 * Proactively confirms the Admin SDK has a working credential, by actually
 * fetching an access token rather than inferring it from a later call's
 * result.
 *
 * This exists because of a real, confirmed gotcha: with no credentials at
 * all, a `Storage` request goes out with no Authorization header, and
 * Google's API responds to that anonymous request with a plain 404 ("The
 * specified bucket does not exist") rather than a 401/403 — it doesn't
 * reveal whether a private bucket exists to an unauthenticated caller.
 * `File.exists()` resolves that straight to `false`, indistinguishable
 * from a real, checked absence. Only an operation that needs the
 * credential itself before any network call — signing a URL, or this —
 * fails the way you'd actually want: loudly and specifically.
 */
export async function assertAdminCredentialsAvailable(): Promise<void> {
  const { credential } = getAdminApp().options;
  if (!credential) {
    // Shouldn't happen — getAdminApp() always initializes with an explicit
    // credential — but the type is optional, so fail clearly rather than
    // crashing on a null-dereference if that ever changes.
    throw new Error("Admin app has no credential configured.");
  }
  await credential.getAccessToken();
}
