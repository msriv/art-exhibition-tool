import { headers } from "next/headers";
import { PLATFORM_NAME } from "@/config/platform";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Placeholder — the real admin CRUD dashboard is milestone 9 (§15). This
 * exists to prove the auth flow (milestone 3) end-to-end: reaching this page
 * at all means src/proxy.ts already verified the session cookie and the
 * organizer allow-list.
 */
export default async function AdminPage() {
  // Set by src/proxy.ts after verifying the session cookie against the
  // organizer allow-list — reaching this page at all means that passed.
  const organizerEmail = (await headers()).get("x-organizer-email");

  return (
    <div className="flex flex-1 flex-col px-6 py-16">
      <main className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{PLATFORM_NAME} — Admin</h1>
          <SignOutButton />
        </div>
        <p className="text-base-content/70 mt-2 text-sm">Signed in as {organizerEmail}.</p>
        <div role="alert" className="alert alert-info alert-soft mt-8 text-sm">
          <span>
            The admin CRUD dashboard isn&apos;t built yet — this page only confirms
            that Firebase Auth and the organizer allow-list are wired up correctly.
          </span>
        </div>
      </main>
    </div>
  );
}
