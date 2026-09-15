import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/config/platform";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <main className="w-full max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{PLATFORM_TAGLINE}</p>
        <p className="mt-8 text-sm text-zinc-500">
          Sign-up forms and the organizer dashboard are not built yet.
        </p>
      </main>
    </div>
  );
}
