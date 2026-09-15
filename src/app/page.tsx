import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/config/platform";

export default function Home() {
  return (
    <div className="hero flex-1">
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
          <p className="text-base-content/70 mt-2">{PLATFORM_TAGLINE}</p>
          <p className="text-base-content/50 mt-8 text-sm">
            Sign-up forms and the organizer dashboard are not built yet.
          </p>
        </div>
      </div>
    </div>
  );
}
