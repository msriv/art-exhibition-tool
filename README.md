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
| Frontend + backend | Next.js (App Router), single Docker image on Cloud Run |
| Database | SQLite via Turso (libSQL) with Drizzle ORM |
| File storage | Firebase Storage |
| Organizer auth | Firebase Auth (Google sign-in) + organizer allow-list |

## Local development

```bash
npm install
npm run dev
```

The app runs on http://localhost:3000.

## Production build

`next.config.ts` sets `output: 'standalone'` so the build emits a
self-contained server for the Docker image:

```bash
npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
PORT=8080 node .next/standalone/server.js
```

## Build status

Working through the milestones in §18 of the technical plan.

- [x] 1. Scaffold Next.js with standalone output
- [ ] 2. Turso database + Drizzle schema and migrations
- [ ] 3. Firebase Auth + Storage config and security rules
- [ ] 4. `/register` form routing, Category and Participation forms
- [ ] 5. Category sign-up API route
- [ ] 6. Participation sign-up API route (multi-entry)
- [ ] 7. Signed upload URL flow
- [ ] 8. Server-side validation (age, duplicate, fee, file)
- [ ] 9. Reusable admin CRUD table + all resources behind auth
- [ ] 10. UPI statement CSV reconciliation
- [ ] 11. Scoring and rank computation
- [ ] 12. WhatsApp message text + manual send log
- [ ] 13. Dockerfile and container verification
- [ ] 14. Dry run of ~20 registrations
- [ ] 15. Artifact Registry push and Cloud Run deploy
