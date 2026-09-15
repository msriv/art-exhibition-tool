import "server-only";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { readDatabaseConfig } from "./config";
import * as schema from "./schema";

/**
 * Database connection for the running application (Technical Plan §17).
 *
 * The same libSQL driver serves both environments, so local development and
 * Turso differ only by the value of TURSO_DATABASE_URL:
 *
 *   local  TURSO_DATABASE_URL=file:./local.db          (no auth token)
 *   Turso  TURSO_DATABASE_URL=libsql://<db>.turso.io   (auth token required)
 *
 * The 'server-only' import above makes this a build error if it is ever
 * imported from a client component — the connection must never reach the
 * browser, and neither must the participant data behind it (§16).
 */

// Next.js hot-reloads modules in development, which would otherwise open a new
// connection on every edit. Cache the client on globalThis to keep one.
const globalForDb = globalThis as unknown as { __libsqlClient?: Client };

function getClient(): Client {
  if (!globalForDb.__libsqlClient) {
    const { url, authToken } = readDatabaseConfig();
    globalForDb.__libsqlClient = createClient({ url, authToken });
  }
  return globalForDb.__libsqlClient;
}

export type Database = LibSQLDatabase<typeof schema>;

let cachedDb: Database | undefined;

function getDb(): Database {
  if (!cachedDb) {
    cachedDb = drizzle(getClient(), { schema });
  }
  return cachedDb;
}

/**
 * Drizzle instance. Lazily initialised behind a Proxy so that importing this
 * module doesn't itself demand environment variables — `next build` must be
 * able to compile without a live database.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
