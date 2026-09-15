import "server-only";

import { eq, sql } from "drizzle-orm";
import { counters } from "./schema";
import { CATEGORY_CODES, type Category } from "./enums";

const SEQUENCE_PAD_LENGTH = 5;

/** Minimal interface this needs — satisfied by both `db` and a transaction handle. */
type CounterWriter = {
  update: (typeof import("./client"))["db"]["update"];
};

/**
 * Increments `counters.last_sequence` for `category` and returns the
 * formatted ID: `[Category Code]-[Sequence]`, e.g. `C2-00147` or `CP-00032`
 * (§7). The single `UPDATE ... RETURNING` is atomic on its own — two
 * concurrent callers can't read the same pre-increment value — but this
 * must still be called from inside the caller's own transaction (opened
 * with `{ behavior: "immediate" }`, per §7) so that if anything else in the
 * same submission fails, the increment rolls back with it rather than
 * burning a sequence number with no participant to show for it.
 */
export async function generateSequentialId(tx: CounterWriter, category: Category): Promise<string> {
  const [row] = await tx
    .update(counters)
    .set({ lastSequence: sql`${counters.lastSequence} + 1` })
    .where(eq(counters.category, category))
    .returning({ lastSequence: counters.lastSequence });

  if (!row) {
    throw new Error(`No counter row exists for category "${category}" — run \`npm run db:seed\`.`);
  }

  return `${CATEGORY_CODES[category]}-${String(row.lastSequence).padStart(SEQUENCE_PAD_LENGTH, "0")}`;
}
