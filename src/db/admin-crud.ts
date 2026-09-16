import "server-only";

import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import { db } from "./client";
import type { AdminResourceConfig, ColumnConfig } from "./admin-resources";

/**
 * The data-access half of the admin CRUD layer (§15) — one engine, driven
 * entirely by an AdminResourceConfig, backing every /api/admin/[resource]
 * route rather than one handler per table.
 *
 * `getTableColumns` is what makes this possible with real (if generic)
 * types instead of scattered `as any` — it turns a Drizzle table into a
 * plain `{ [key]: Column }` record, so a column can be looked up by the
 * same string key the resource config already uses.
 */

export type ListParams = {
  page: number;
  pageSize: number;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
  filters?: Record<string, string>;
};

export type ListResult = {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
};

function requireColumn(resource: AdminResourceConfig, key: string) {
  const column = getTableColumns(resource.table)[key];
  if (!column) {
    throw new Error(`"${key}" is not a column on resource "${resource.slug}".`);
  }
  return column;
}

function buildWhere(resource: AdminResourceConfig, params: ListParams): SQL | undefined {
  const columns = getTableColumns(resource.table);
  const clauses: SQL[] = [];

  for (const [key, value] of Object.entries(params.filters ?? {})) {
    const config = resource.columns.find((c) => c.key === key);
    const column = columns[key];
    if (!config?.filterable || !column || value === "") continue;
    clauses.push(eq(column, value));
  }

  if (params.search && resource.searchableColumns?.length) {
    const pattern = `%${params.search}%`;
    const searchClauses = resource.searchableColumns
      .map((key) => columns[key])
      .filter((column): column is NonNullable<typeof column> => !!column)
      .map((column) => like(column, pattern));
    if (searchClauses.length > 0) {
      const combined = or(...searchClauses);
      if (combined) clauses.push(combined);
    }
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export async function listResource(resource: AdminResourceConfig, params: ListParams): Promise<ListResult> {
  const where = buildWhere(resource, params);

  const sortKey = params.sortKey ?? resource.defaultSort.key;
  const sortDirection = params.sortDirection ?? resource.defaultSort.direction;
  const sortColumn = getTableColumns(resource.table)[sortKey] ?? requireColumn(resource, resource.defaultSort.key);
  const orderBy = sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn);

  const offset = (params.page - 1) * params.pageSize;

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(resource.table).where(where).orderBy(orderBy).limit(params.pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(resource.table).where(where),
  ]);

  return { rows: rows as Record<string, unknown>[], total: count, page: params.page, pageSize: params.pageSize };
}

export async function getResourceRow(
  resource: AdminResourceConfig,
  id: number,
): Promise<Record<string, unknown> | undefined> {
  const idColumn = requireColumn(resource, "id");
  const [row] = await db.select().from(resource.table).where(eq(idColumn, id)).limit(1);
  return row as Record<string, unknown> | undefined;
}

/** Empty-string -> null for nullable fields; numeric/boolean/date coercion per column type. */
function coerceValue(column: ColumnConfig, raw: unknown): unknown {
  if (raw === "" && column.nullable) return null;
  if (raw === null || raw === undefined) return raw;

  switch (column.type) {
    case "number":
    case "currency":
      return typeof raw === "number" ? raw : Number(raw);
    case "boolean":
      return typeof raw === "boolean" ? raw : raw === "true" || raw === "1" || raw === 1;
    case "datetime":
      return raw instanceof Date ? raw : new Date(raw as string);
    default:
      return raw;
  }
}

/**
 * "readOnly" only protects a value once it exists — see
 * src/components/admin/resource-form.tsx's own comment for the same
 * distinction on the UI side. A create with no registrationNumber, say,
 * would otherwise violate a NOT NULL column with no default; an update
 * must never let a client overwrite one already assigned.
 */
function coerceValues(
  resource: AdminResourceConfig,
  input: Record<string, unknown>,
  mode: "create" | "update",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const column of resource.columns) {
    if (column.key === "id") continue;
    if (column.readOnly && mode === "update") continue;
    if (!(column.key in input)) continue;
    result[column.key] = coerceValue(column, input[column.key]);
  }
  return result;
}

/**
 * Drizzle's own error `.message` for a failed query is just the SQL text
 * and params, not the reason — the actual driver error (e.g. "NOT NULL
 * constraint failed: participants.consent_participant") is one level down
 * in `.cause`. Without unwrapping it, every create/update failure looks
 * identical to an admin using the form.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause;
    if (cause instanceof Error && cause.message) return cause.message;
    return error.message;
  }
  return "Something went wrong.";
}

export async function createResourceRow(
  resource: AdminResourceConfig,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const values = coerceValues(resource, input, "create");
  const [row] = await db.insert(resource.table).values(values).returning();
  return row as Record<string, unknown>;
}

export async function updateResourceRow(
  resource: AdminResourceConfig,
  id: number,
  input: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const idColumn = requireColumn(resource, "id");
  const values = coerceValues(resource, input, "update");
  if (Object.keys(values).length === 0) {
    return getResourceRow(resource, id);
  }
  const [row] = await db.update(resource.table).set(values).where(eq(idColumn, id)).returning();
  return row as Record<string, unknown> | undefined;
}

export async function deleteResourceRow(resource: AdminResourceConfig, id: number): Promise<void> {
  const idColumn = requireColumn(resource, "id");
  await db.delete(resource.table).where(eq(idColumn, id));
}
