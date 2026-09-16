import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { deleteResourceRow, describeError, getResourceRow, updateResourceRow } from "@/db/admin-crud";
import { getAdminResource } from "@/db/admin-resources";
import { db } from "@/db/client";
import { artistPhotos, entries, payments, scores } from "@/db/schema";

/**
 * GET/PATCH/DELETE /api/admin/[resource]/[id] (§5, §15). Same one-handler-
 * for-five-resources shape as the list/create route.
 *
 * GET on a participant also returns their payments, entries, and artist
 * photo — §15's "see their full record joined across payments, entries,
 * artist photo, and scores." Simple separate queries rather than one SQL
 * join: at this scale there's no performance reason to avoid the clearer
 * option, and every other resource stays a single flat row.
 */

type RouteContext = { params: Promise<{ resource: string; id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getParticipantRelated(participantId: number) {
  const [participantEntries, photos, participantPayments] = await Promise.all([
    db.select().from(entries).where(eq(entries.participantId, participantId)),
    db.select().from(artistPhotos).where(eq(artistPhotos.participantId, participantId)),
    db.select().from(payments).where(eq(payments.participantId, participantId)),
  ]);

  const entryScores =
    participantEntries.length > 0
      ? await Promise.all(
          participantEntries.map((entry) =>
            db.select().from(scores).where(eq(scores.entryId, entry.id)).limit(1).then((rows) => rows[0]),
          ),
        )
      : [];

  return {
    entries: participantEntries.map((entry, i) => ({ ...entry, score: entryScores[i] ?? null })),
    artistPhotos: photos,
    payments: participantPayments,
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { resource: slug, id: idParam } = await params;
  const resource = getAdminResource(slug);
  const id = parseId(idParam);
  if (!resource || id === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const row = await getResourceRow(resource, id);
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const related = slug === "participants" ? await getParticipantRelated(id) : undefined;
    return NextResponse.json({ ...row, related });
  } catch (error) {
    console.error(`GET /api/admin/${slug}/${idParam} failed:`, error);
    return NextResponse.json({ error: "Could not load the record." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { resource: slug, id: idParam } = await params;
  const resource = getAdminResource(slug);
  const id = parseId(idParam);
  if (!resource || id === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  try {
    const row = await updateResourceRow(resource, id, json as Record<string, unknown>);
    if (!row) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(row);
  } catch (error) {
    console.error(`PATCH /api/admin/${slug}/${idParam} failed:`, error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { resource: slug, id: idParam } = await params;
  const resource = getAdminResource(slug);
  const id = parseId(idParam);
  if (!resource || id === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    await deleteResourceRow(resource, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/admin/${slug}/${idParam} failed:`, error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}
