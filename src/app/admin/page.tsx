import { headers } from "next/headers";
import Link from "next/link";
import { ADMIN_RESOURCE_SLUGS, getAdminResourceMeta } from "@/config/admin-resources";
import { PLATFORM_NAME } from "@/config/platform";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Admin dashboard home (§15) — links into the five CRUD resources, each
 * served by the same reusable table/form components
 * (src/components/admin/*) rather than a bespoke page per table.
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

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {ADMIN_RESOURCE_SLUGS.map((slug) => {
            const meta = getAdminResourceMeta(slug);
            if (!meta) return null;
            return (
              <Link
                key={slug}
                href={`/admin/${slug}`}
                className="card bg-base-200 hover:bg-base-300 transition-colors"
              >
                <div className="card-body">
                  <h2 className="card-title text-base">{meta.label}</h2>
                </div>
              </Link>
            );
          })}
          <Link href="/admin/scoring" className="card bg-base-200 hover:bg-base-300 transition-colors">
            <div className="card-body">
              <h2 className="card-title text-base">Scoring</h2>
            </div>
          </Link>
          <Link href="/admin/results" className="card bg-base-200 hover:bg-base-300 transition-colors">
            <div className="card-body">
              <h2 className="card-title text-base">Results</h2>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
