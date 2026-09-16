import Link from "next/link";
import { PLATFORM_NAME } from "@/config/platform";
import { DoodleSparkle, DoodleUnderline } from "@/components/ui/doodles";

/**
 * Rendered at /register with no (or an unrecognized) `form` query param
 * (§3). Unrecognized values fall back here rather than erroring — the page
 * itself enforces that allow-list check before choosing which component to
 * render.
 */
export function ChooseEntryType() {
  return (
    <div className="hero flex-1 relative overflow-hidden">
      <DoodleSparkle className="text-primary/30 pointer-events-none absolute top-10 right-[15%] h-10 w-10" />
      <DoodleSparkle className="text-secondary/30 pointer-events-none absolute bottom-12 left-[10%] h-8 w-8 rotate-12" />
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
          <DoodleUnderline className="text-primary mx-auto mt-1 h-3 w-32" />
          <p className="font-hand text-base-content/70 mt-3 text-lg">Choose how you&apos;d like to enter.</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/register?form=category" className="card bg-base-200 hover:bg-base-300 text-left transition-colors">
              <div className="card-body">
                <h2 className="card-title text-base">Competitive Category</h2>
                <p className="text-base-content/70 text-sm">
                  Categories 1, 2, or 3 by age. Judged, with results and prizes.
                </p>
              </div>
            </Link>

            <Link href="/register?form=participation" className="card bg-base-200 hover:bg-base-300 text-left transition-colors">
              <div className="card-body">
                <h2 className="card-title text-base">Participation Only</h2>
                <p className="text-base-content/70 text-sm">
                  Any age, any medium. Not judged for rank. Already
                  registered? This adds to it — otherwise it sets one up.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
