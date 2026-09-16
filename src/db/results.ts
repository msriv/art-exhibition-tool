import "server-only";

import type { Category } from "./enums";
import { listScorableEntries, type ScorableEntry } from "./scoring";

/**
 * Rank/result computation (§11) — "computed with a query over entries +
 * scores, rather than stored redundantly," and only "once scoring_complete
 * is set, avoiding a premature result while scoring is still in progress."
 *
 * That second clause is read at the category level, not just the entry
 * level: a category's results only become `ready` once *every* entry in its
 * pool has `scoring_complete`, not as soon as the entries scored so far
 * happen to include the top three. Scoring the best painting in a category
 * last would otherwise produce a confidently wrong ranking for however long
 * it stayed unscored.
 *
 * Ties use standard competition ranking (1224, not 1223 or 1234) — a rank
 * is "1 + the number of entries strictly ahead of it," so two entries tied
 * for first are both First and the next entry down is Third, not Second.
 */

const COMPETITIVE_CATEGORIES: Category[] = ["1", "2", "3"];

const RANK_LABELS: Record<number, string> = { 1: "First", 2: "Second", 3: "Third" };

export type RankedEntry = ScorableEntry & { rank: number; label: string };

export type CategoryResult = {
  category: Category;
  totalEntries: number;
  scoredCount: number;
  ready: boolean;
  ranked: RankedEntry[];
};

function rankEntries(entries: ScorableEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted
    .map((entry) => {
      const rank = 1 + sorted.filter((other) => (other.score ?? 0) > (entry.score ?? 0)).length;
      return { ...entry, rank, label: RANK_LABELS[rank] };
    })
    .filter((entry) => entry.rank <= 3)
    .sort((a, b) => a.rank - b.rank);
}

export async function computeResults(): Promise<CategoryResult[]> {
  const allEntries = await listScorableEntries();

  return COMPETITIVE_CATEGORIES.map((category) => {
    const categoryEntries = allEntries.filter((entry) => entry.category === category);
    const scoredCount = categoryEntries.filter((entry) => entry.scoringComplete).length;
    const totalEntries = categoryEntries.length;
    const ready = totalEntries > 0 && scoredCount === totalEntries;

    return {
      category,
      totalEntries,
      scoredCount,
      ready,
      ranked: ready ? rankEntries(categoryEntries) : [],
    };
  });
}
