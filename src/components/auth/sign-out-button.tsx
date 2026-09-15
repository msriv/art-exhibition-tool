"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleSignOut} disabled={isSigningOut} className="btn btn-outline btn-sm">
      {isSigningOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
