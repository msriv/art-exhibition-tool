import "server-only";

import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { ADMIN_RESOURCE_META, type AdminResourceMeta } from "@/config/admin-resources";
import { artistPhotos, entries, participants, payments, scores } from "./schema";

export type { ColumnConfig, ColumnType } from "@/config/admin-resources";

/**
 * Attaches each resource's actual Drizzle table to the client-safe metadata
 * in src/config/admin-resources.ts. Kept server-only and separate from that
 * file specifically so the UI can import the column config without ever
 * pulling a database table reference into a client bundle.
 */
export type AdminResourceConfig = AdminResourceMeta & { table: SQLiteTable };

const TABLES: Record<string, SQLiteTable> = {
  participants,
  payments,
  entries,
  "artist-photos": artistPhotos,
  scores,
};

const ADMIN_RESOURCES: Record<string, AdminResourceConfig> = Object.fromEntries(
  Object.entries(ADMIN_RESOURCE_META).map(([slug, meta]) => [slug, { ...meta, table: TABLES[slug] }]),
);

export function getAdminResource(slug: string): AdminResourceConfig | undefined {
  return ADMIN_RESOURCES[slug];
}
