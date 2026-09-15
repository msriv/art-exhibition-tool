"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Signs in with Google via Firebase Auth, then exchanges the ID token for
 * this app's own session cookie (POST /api/auth/session) — src/proxy.ts
 * checks that cookie, not Firebase's client-side auth state, on every
 * subsequent /admin request.
 */
export function SignInButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    setError(null);
    setIsSigningIn(true);
    try {
      const credential = await signInWithPopup(getFirebaseAuth(), createGoogleProvider());
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 403) {
          router.push("/admin/unauthorized");
          return;
        }
        throw new Error(body?.error ?? "Sign-in failed.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSigningIn ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
