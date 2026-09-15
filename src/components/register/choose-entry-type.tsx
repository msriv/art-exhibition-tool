import Link from "next/link";
import { PLATFORM_NAME } from "@/config/platform";

/**
 * Rendered at /register with no (or an unrecognized) `form` query param
 * (§3). Unrecognized values fall back here rather than erroring — the page
 * itself enforces that allow-list check before choosing which component to
 * render.
 */
export function ChooseEntryType() {
  return (
    <div className="hero flex-1">
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight">{PLATFORM_NAME}</h1>
          <p className="text-base-content/70 mt-2">Choose how you&apos;d like to enter.</p>

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
