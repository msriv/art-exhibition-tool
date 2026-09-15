import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AdminUnauthorizedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold tracking-tight">Not an approved organizer</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your Google account signed in successfully, but it isn&apos;t on the
          organizer allow-list. Ask an existing organizer to add your email,
          or sign in with a different account.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton />
        </div>
      </main>
    </div>
  );
}
