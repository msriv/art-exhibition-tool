import Link from "next/link";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/config/platform";
import { DoodleSparkle, DoodleSwirl, DoodleUnderline } from "@/components/ui/doodles";

export default function Home() {
  return (
    <div className="hero flex-1 relative overflow-hidden">
      <DoodleSwirl className="text-primary/30 pointer-events-none absolute top-10 left-[8%] h-16 w-16 -rotate-12 sm:h-20 sm:w-20" />
      <DoodleSparkle className="text-secondary/40 pointer-events-none absolute top-16 right-[12%] h-10 w-10 sm:h-12 sm:w-12" />
      <DoodleSparkle className="text-primary/30 pointer-events-none absolute bottom-16 left-[15%] h-6 w-6 rotate-12 sm:h-8 sm:w-8" />
      <DoodleSwirl className="text-secondary/30 pointer-events-none absolute right-[10%] bottom-10 h-12 w-12 rotate-45 sm:h-16 sm:w-16" />

      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
          <DoodleUnderline className="text-primary mx-auto mt-1 h-3 w-40" />
          <p className="font-hand text-base-content/70 mt-3 text-xl">{PLATFORM_TAGLINE}</p>
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
