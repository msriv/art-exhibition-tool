import Link from "next/link";
import { computeResults } from "@/db/results";

/**
 * computeResults() reads straight from the database via the libSQL driver,
 * not `fetch()` — none of the signals Next uses to detect that a Server
 * Component needs per-request data, since this page also takes no dynamic
 * route params and calls neither `cookies()` nor `headers()`. Left to
 * Next's default inference, this page got prerendered once at build time
 * and served that same frozen snapshot forever after — a scored entry would
 * never show up. Forcing it dynamic here is what makes every request
 * actually recompute results from the current data.
 */
export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = { "1": "Category 1", "2": "Category 2", "3": "Category 3" };

export default async function AdminResultsPage() {
  const results = await computeResults();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="link link-primary text-sm">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Results</h1>
      <p className="text-base-content/70 mt-1 text-sm">
        Computed fresh from entries and scores, per category — never stored. A category&apos;s results only appear
        once every eligible entry in it has been scored, so a still-in-progress category never shows a partial
        ranking.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {results.map((result) => (
          <div key={result.category} className="card bg-base-200">
            <div className="card-body">
              <h2 className="card-title text-base">{CATEGORY_LABELS[result.category]}</h2>
              {!result.ready ? (
                <p className="text-base-content/70 text-sm">
                  {result.totalEntries === 0
                    ? "No eligible entries yet."
                    : `Scoring in progress — ${result.scoredCount} of ${result.totalEntries} entries scored.`}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {result.ranked.map((entry) => (
                    <li key={entry.entryId} className="flex items-baseline justify-between gap-4 text-sm">
                      <span>
                        <span className="font-semibold">{entry.label}</span> — {entry.participantName} (
                        {entry.registrationNumber}) — <span className="italic">{entry.title}</span>
                      </span>
                      <span className="text-base-content/70">{entry.score}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
