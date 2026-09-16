import { NextResponse } from "next/server";
import { computeResults } from "@/db/results";

/** GET /api/admin/results (§11) — per-category rank computation. Read-only; see src/db/results.ts. */
export async function GET() {
  try {
    const results = await computeResults();
    return NextResponse.json({ results });
  } catch (error) {
    console.error("GET /api/admin/results failed:", error);
    return NextResponse.json({ error: "Could not compute results." }, { status: 500 });
  }
}
