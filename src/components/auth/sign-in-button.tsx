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
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={handleSignIn} disabled={isSigningIn} className="btn btn-primary">
        {isSigningIn && <span className="loading loading-spinner loading-sm" />}
        {isSigningIn ? "Signing in…" : "Sign in with Google"}
      </button>
      {error && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
