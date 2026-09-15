import { PLATFORM_NAME } from "@/config/platform";
import { SignInButton } from "@/components/auth/sign-in-button";

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Organizer sign-in. Only approved Google accounts can access this section.
        </p>
        <div className="mt-6 flex justify-center">
          <SignInButton />
        </div>
      </main>
    </div>
  );
}
