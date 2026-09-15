# Painting Exhibition & Competition — Registration System

Registration, validation, judging and exhibition management for a painting
competition, built as a single Next.js application (public sign-up forms, API
routes, and the organizer dashboard in one codebase).

The authoritative build spec is `docs/Exhibition_Implementation_Plan_Technical.docx`.
`docs/Exhibition_Plan_Stakeholder_Review.docx` is the plain-language version for
the event organizer — read it for business rules and context, not for technical
decisions.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend + backend | Next.js (App Router), deployed via Firebase App Hosting |
| Database | SQLite via Turso (libSQL) with Drizzle ORM |
| File storage | Firebase Storage, signed URLs issued by API routes |
| Organizer auth | Firebase Auth (Google sign-in) + organizer allow-list |

Everything except the database now lives under one Firebase project — Auth,
Storage, and App Hosting — for a single console to administer. App Hosting
provisions and deploys to Cloud Run under the hood (Cloud Build handles the
image, so no hand-written Dockerfile), rolling out on push to the connected
GitHub branch rather than a manual `gcloud run deploy`. It requires the
Blaze (billing-enabled) plan, same as Cloud Run directly — this move is
about console consolidation, not cost. The database stays on Turso: it's
free indefinitely with the same relational querying the admin CRUD layer
(§15) needs, and a Firebase-native relational option (SQL Connect / Cloud
SQL for Postgres) costs roughly $9–10+/month after its 3-month trial, so it
wasn't worth it for a database that already works.

## Local development

```bash
npm install
cp .env.example .env.local     # defaults to a local SQLite file
npm run db:migrate             # create the schema
npm run db:seed                # counters + default settings
npm run dev
```

The app runs on http://localhost:3000.

### Database

The same libSQL driver serves local development and Turso — only
`TURSO_DATABASE_URL` differs (`file:./local.db` vs `libsql://...`), so no code
changes when switching.

| Script | Purpose |
| --- | --- |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed counters and default settings (idempotent) |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run typecheck` | `tsc --noEmit` |

Conventions worth knowing before editing the schema:

- **Money is stored in paise** as an integer, formatted to rupees in the UI.
- **Calendar dates** (`dob`, `dispatch_date`) are `'YYYY-MM-DD'` TEXT; **points
  in time** (`submitted_at`, `verified_at`, `updated_at`) are epoch seconds.
- Enumerated columns carry a CHECK constraint as well as a TypeScript union,
  because the admin dashboard writes arbitrary fields.
- `payments.upi_reference` is deliberately **not** unique — §8.2 requires a
  reused reference to be accepted and flagged, not rejected.
- The age cutoff date lives in the `settings` table (organizer-editable), not
  in code. Read it via `getAgeCutoffDate()`, never raw. **The seeded value is a
  placeholder.**

## Production build

`next.config.ts` keeps `output: 'standalone'` as a local sanity check — it's
not what App Hosting's own Cloud Build pipeline uses, but it's a quick way to
confirm the app actually builds and runs as a production server before
pushing:

```bash
npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
PORT=8080 node .next/standalone/server.js
```

Actual deployment is via Firebase App Hosting (see the build status below),
which builds and rolls out from the connected GitHub branch — no Dockerfile
or `gcloud` commands to run by hand.

## Build status

Working through the milestones in §18 of the technical plan.

- [x] 1. Scaffold Next.js with standalone output
- [x] 2. Turso database + Drizzle schema and migrations
- [ ] 3. Firebase Auth + Firebase Storage config and security rules
- [ ] 4. `/register` form routing, Category and Participation forms
- [ ] 5. Category sign-up API route
- [ ] 6. Participation sign-up API route (multi-entry)
- [ ] 7. Signed upload URL flow
- [ ] 8. Server-side validation (age, duplicate, fee, file)
- [ ] 9. Reusable admin CRUD table + all resources behind auth
- [ ] 10. UPI statement CSV reconciliation
- [ ] 11. Scoring and rank computation
- [ ] 12. WhatsApp message text + manual send log
- [ ] 13. Verify production build locally; configure `apphosting.yaml`
- [ ] 14. Dry run of ~20 registrations
- [ ] 15. Connect GitHub repo to a Firebase App Hosting backend; deploy
