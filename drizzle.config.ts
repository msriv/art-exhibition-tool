import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it does not get .env.local loading for
// free. The npm scripts pass --env-file to Node for that.
const url = process.env.TURSO_DATABASE_URL ?? "file:./local.db";

export default defineConfig({
  dialect: "turso",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
