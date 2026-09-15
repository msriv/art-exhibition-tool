"use client";

import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { GoogleAuthProvider, getAuth, type Auth } from "firebase/auth";

/**
 * Client-side Firebase (browser only). Config values are the public web app
 * config from the Firebase console — safe to ship in client JS by design,
 * unlike anything in ./admin.ts.
 *
 * Analytics is deliberately not initialised here — not part of the spec, and
 * tracking participant behaviour on the registration forms raises the same
 * privacy question as §16 (participant data is organizer-only).
 */

function readFirebaseConfig(): FirebaseOptions {
  const config: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase web config: ${missing.join(", ")}. Check NEXT_PUBLIC_FIREBASE_* in .env.local.`,
    );
  }

  return config;
}

function getFirebaseApp() {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(readFirebaseConfig());
}

let cachedAuth: Auth | undefined;

/** The Firebase Auth instance for the browser. Google sign-in only (§1). */
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp());
  }
  return cachedAuth;
}

/** Always prompts for account selection — avoids silently reusing a stale Google session. */
export function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
