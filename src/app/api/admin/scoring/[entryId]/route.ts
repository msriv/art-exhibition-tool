import { NextResponse } from "next/server";
import { z } from "zod";
import { describeError } from "@/db/admin-crud";
import { upsertScore } from "@/db/scoring";

/**
 * PUT /api/admin/scoring/:entryId (§11) — set or update the single overall
 * score for one entry. Upserts rather than requiring the caller to know
 * whether a `scores` row already exists for this entry (see upsertScore's
 * own comment) — the scoring page only ever deals in entry IDs.
 */

const bodySchema = z.object({
  score: z.number().min(0),
  scoringComplete: z.boolean(),
});

type RouteContext = { params: Promise<{ entryId: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  const { entryId: entryIdParam } = await params;
  const entryId = Number(entryIdParam);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const row = await upsertScore(entryId, parsed.data);
    return NextResponse.json(row);
  } catch (error) {
    console.error(`PUT /api/admin/scoring/${entryIdParam} failed:`, error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}
