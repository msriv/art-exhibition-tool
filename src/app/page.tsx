import Link from "next/link";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/config/platform";

export default function Home() {
  return (
    <div className="hero flex-1">
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
          <p className="text-base-content/70 mt-2">{PLATFORM_TAGLINE}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/register" className="btn btn-primary">
              Register
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Organizer sign-in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
