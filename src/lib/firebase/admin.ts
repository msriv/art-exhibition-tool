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

/**
 * Server-side Firebase Storage. Not wired into an upload flow yet — that's
 * milestone 7 (signed URLs). This just gets the bucket handle ready.
 */
export function getAdminStorage(): Storage {
  if (!cachedStorage) {
    cachedStorage = getStorage(getAdminApp());
  }
  return cachedStorage;
}
