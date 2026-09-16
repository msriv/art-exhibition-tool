import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { entries, participants, scores } from "./schema";
import type { Category } from "./enums";

/**
 * The scoring workflow (§11) — a convenience layer over the same `entries`
 * and `scores` tables the generic admin CRUD (milestone 9) already exposes,
 * but keyed by entry (with participant context alongside) rather than by a
 * raw `scores.id` an organizer would otherwise have to look up by hand.
 *
 * Only competitive categories are scored — Participation-only has no
 * ranking or prizes (both spec documents draw this as two separate tracks:
 * "Competitive Categories" vs. "Participation Only"). An entry only enters
 * the pool once its participant is 'eligible' and its own file is 'valid' —
 * a rejected or still-pending registration/file has no business being
 * ranked against genuine competitors.
 */

const COMPETITIVE_CATEGORIES: Category[] = ["1", "2", "3"];

export type ScorableEntry = {
  entryId: number;
  title: string;
  medium: string;
  participantId: number;
  participantName: string;
  registrationNumber: string;
  category: Category;
  score: number | null;
  scoringComplete: boolean;
};

export async function listScorableEntries(category?: Category): Promise<ScorableEntry[]> {
  const categoryFilter = category ? [category] : COMPETITIVE_CATEGORIES;

  const rows = await db
    .select({
      entryId: entries.id,
      title: entries.title,
      medium: entries.medium,
      participantId: participants.id,
      participantName: participants.name,
      registrationNumber: participants.registrationNumber,
      category: participants.category,
      score: scores.score,
      scoringComplete: scores.scoringComplete,
    })
    .from(entries)
    .innerJoin(participants, eq(entries.participantId, participants.id))
    .leftJoin(scores, eq(scores.entryId, entries.id))
    .where(
      and(
        inArray(participants.category, categoryFilter),
        eq(participants.eligibility, "eligible"),
        eq(entries.fileStatus, "valid"),
      ),
    );

  return rows.map((row) => ({ ...row, scoringComplete: row.scoringComplete ?? false }));
}

export async function upsertScore(
  entryId: number,
  values: { score: number; scoringComplete: boolean },
): Promise<{ id: number; entryId: number; score: number; scoringComplete: boolean }> {
  const [existing] = await db.select({ id: scores.id }).from(scores).where(eq(scores.entryId, entryId)).limit(1);

  if (existing) {
    const [row] = await db.update(scores).set(values).where(eq(scores.id, existing.id)).returning();
    return row;
  }

  const [row] = await db
    .insert(scores)
    .values({ entryId, ...values })
    .returning();
  return row;
}
