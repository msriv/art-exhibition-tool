/**
 * Database connection configuration.
 *
 * Deliberately free of the 'server-only' guard that client.ts carries, so the
 * migrate and seed scripts — which run under plain Node, outside Next.js —
 * can reuse the same env handling instead of duplicating it.
 */

export type DatabaseConfig = {
  url: string;
  authToken: string | undefined;
};

export function readDatabaseConfig(): DatabaseConfig {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  const isRemote = !url.startsWith("file:");
  if (isRemote && !authToken) {
    throw new Error(
      `TURSO_AUTH_TOKEN is required for remote database URL "${url}". ` +
        "Local development can use TURSO_DATABASE_URL=file:./local.db instead.",
    );
  }

  return { url, authToken };
}
