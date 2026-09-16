import { NextResponse } from "next/server";
import { CATEGORIES, type Category } from "@/db/enums";
import { listScorableEntries } from "@/db/scoring";

/**
 * GET /api/admin/scoring (§11, §15) — entries awaiting or already carrying a
 * score, with participant context, for the dedicated scoring page. Not part
 * of the generic admin CRUD from milestone 9: that operates on raw
 * `scores.id` rows, which don't exist yet for an unscored entry and give no
 * indication of which painting or participant they belong to.
 *
 * No auth check here — src/proxy.ts already gates every /api/admin/*
 * request behind the organizer session cookie.
 */

const COMPETITIVE_CATEGORIES: Set<Category> = new Set(CATEGORIES.filter((c) => c !== "participation"));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categoryParam = url.searchParams.get("category");

  if (categoryParam !== null && !COMPETITIVE_CATEGORIES.has(categoryParam as Category)) {
    return NextResponse.json({ error: `Unknown category "${categoryParam}".` }, { status: 400 });
  }

  try {
    const entries = await listScorableEntries(categoryParam as Category | undefined);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("GET /api/admin/scoring failed:", error);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }
}
