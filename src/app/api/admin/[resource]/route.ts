import { NextResponse } from "next/server";
import { getAdminResource } from "@/db/admin-resources";
import { createResourceRow, describeError, listResource } from "@/db/admin-crud";

/**
 * GET/POST /api/admin/[resource] (§5, §15) — list (paginated/filterable/
 * sortable/searchable) and create, for any of the five resources
 * ADMIN_RESOURCES declares. One handler, not five — see
 * src/db/admin-resources.ts for the config it reads and
 * src/db/admin-crud.ts for the query building.
 *
 * No auth check here: src/proxy.ts already gates every /api/admin/* request
 * behind the organizer session cookie before it reaches this file.
 */

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type RouteContext = { params: Promise<{ resource: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { resource: slug } = await params;
  const resource = getAdminResource(slug);
  if (!resource) {
    return NextResponse.json({ error: `Unknown resource "${slug}".` }, { status: 404 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const sortKey = url.searchParams.get("sort") ?? undefined;
  const sortDirectionParam = url.searchParams.get("dir");
  const sortDirection = sortDirectionParam === "asc" || sortDirectionParam === "desc" ? sortDirectionParam : undefined;
  const search = url.searchParams.get("q") ?? undefined;

  const filters: Record<string, string> = {};
  for (const column of resource.columns) {
    if (!column.filterable) continue;
    const value = url.searchParams.get(column.key);
    if (value !== null) filters[column.key] = value;
  }

  try {
    const result = await listResource(resource, { page, pageSize, sortKey, sortDirection, search, filters });
    return NextResponse.json(result);
  } catch (error) {
    console.error(`GET /api/admin/${slug} failed:`, error);
    return NextResponse.json({ error: "Could not load records." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { resource: slug } = await params;
  const resource = getAdminResource(slug);
  if (!resource) {
    return NextResponse.json({ error: `Unknown resource "${slug}".` }, { status: 404 });
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
    const row = await createResourceRow(resource, json as Record<string, unknown>);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    console.error(`POST /api/admin/${slug} failed:`, error);
    return NextResponse.json({ error: describeError(error) }, { status: 400 });
  }
}
