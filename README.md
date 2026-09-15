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
| UI | Tailwind v4 + daisyUI |

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

### Organizer allow-list

§16 asks for "an organizer allow-list (env var or a small admins table)" —
this uses both, as a union:

- **`SEED_ADMIN_EMAILS`** (env var, comma-separated) — fixed until redeploy.
  A break-glass fallback so an accidental deletion of every row in `admins`
  can never lock every organizer out. Not mirrored into the database, on
  purpose: if it were, deleting that row from a future CRUD screen would look
  like it revoked access when it hadn't.
- **The `admins` table** — organizer-editable, and what's expected to grow
  over time. Nothing reads it directly; go through `src/db/admins.ts`
  (`isOrganizerEmail`, `addAdminEmail`, `removeAdminEmail`,
  `listOrganizerEmails`), which also normalises every email to lowercase so
  a casing difference in Firebase's ID token claim can't cause a false
  lockout.

Until the admin CRUD dashboard (§15, milestone 9) covers this table, add
someone with:

```bash
npm run db:add-admin -- someone@example.com "optional note"
```

Milestone 3 wires `isOrganizerEmail` into the actual request-time check
against the signed-in Firebase user.

## Firebase Auth (milestone 3)

`/admin` and `/api/admin/*` are gated by a Firebase session cookie, checked
in `src/proxy.ts` on every matching request:

1. The browser signs in with Google via the Firebase client SDK (a popup —
   `src/components/auth/sign-in-button.tsx`).
2. It POSTs the resulting ID token to `/api/auth/session`, which verifies it
   with the Admin SDK, checks the organizer allow-list, and — only if both
   pass — sets an httpOnly session cookie. A valid Google sign-in from
   someone not on the allow-list never gets a cookie at all.
3. `src/proxy.ts` verifies that cookie on every `/admin` and `/api/admin/*`
   request and forwards the verified email to route handlers via an
   `x-organizer-email` header, stripping any client-supplied value for that
   header first so it can't be spoofed.

This relies on `proxy.ts` (renamed from `middleware.ts` as of this Next.js
version) always running on the Node.js runtime — never Edge — which is what
lets `firebase-admin` run inside it at all.

**Server-side credentials are Application Default Credentials, not a
downloaded service-account key.** On Cloud Run / Firebase App Hosting this
resolves automatically to the service's own identity. For local development:

```bash
gcloud auth application-default login
```

Prerequisite in the Firebase console (one-time, can't be done from here):
**Authentication → Sign-in method → enable Google.**

To test locally once that's done: `npm run dev`, visit `/admin`, sign in with
an email in `SEED_ADMIN_EMAILS` or the `admins` table. Visiting `/admin`
signed out redirects to `/admin/login`; a valid-but-unlisted Google account
lands on `/admin/unauthorized` instead of looping back to sign-in.

### Firebase Storage

`storage.rules` denies all client-side read/write — every real access path is
server-mediated (a signed URL from an API route for uploads, milestone 7; the
Admin SDK for reads), both of which bypass these rules entirely, so this file
is defense-in-depth against a client SDK ever being pointed at the bucket
directly. Deploy it with:

```bash
npx firebase deploy --only storage:rules --project <firebase-project-id>
```

## Public registration (milestone 4)

`/register` serves both sign-up forms from one route via a `?form=` query
param (§3) — `category` and `participation` render the two forms below;
anything else, including no param at all, falls back to a chooser page. The
allow-list check happens server-side in `src/app/register/page.tsx`, not on
the client.

**The forms submit to endpoints that don't exist yet.** `POST
/api/register/category` (milestone 5), `POST /api/register/participation`
(milestone 6), and `POST /api/upload-url` (milestone 7) are all still
missing — the forms are written against their real, intended contracts
(`src/lib/register-types.ts`, `src/lib/upload.ts`) rather than stubbed, so
they start working with no changes once those routes land. Until then,
submitting shows a clear "not live yet" message instead of a raw fetch
failure.

- **Category form** — one submission covers participant details, up to two
  paintings (capped per `CATEGORY_FEES[category].maxEntries`, §9), a photo,
  and payment. Medium is a select constrained to that category's allowed
  list. Guardian consent only appears once a DOB computes to under 18
  against the seeded age cutoff — a client-side hint only; the authoritative
  check (§8.1) is server-side, milestone 8.
- **Participation form** — no DOB, no category, no photo, but does collect
  name/mobile/email and participant consent (§4.1 requires consent from
  every entrant, not just Category ones — missing from the first version of
  this form). Registration number is optional: someone who never submitted
  a Category form can still use this directly.

  Identity resolution is its own explicit phase before paintings/payment are
  shown, and **nothing ever resolves silently** — every path ends in either
  a human confirmation or a blocking error the person clears themselves.
  Full contract in `src/lib/register-lookup-types.ts` and
  `src/lib/register-types.ts`:
  1. Registration number given → `POST /api/register/lookup`. Found →
     identity fields lock (masked, read-only) and the form proceeds. Not
     found → a hard error naming the problem; **never** falls through to
     matching by name/email/mobile instead — a typo'd number must be fixed
     or cleared, not silently reinterpreted.
  2. Registration number omitted → `POST /api/register/match` against
     name/email/mobile. A match shows a masked preview with explicit
     **Yes, link this** / **No, this is new** buttons — distinct from
     §8.2's `duplicate_check`, which flags a possible duplicate for
     organizer review rather than merging into an existing record.
     Email wins if email and mobile independently point to different
     existing participants (rare, but decided).
  3. No match, or "No" chosen above → create a new participant with a
     freshly-generated `CP-nnnnn` number, the same counter mechanism as
     §7 — this is what makes the `CP` prefix reachable at all.

  Both endpoints return **masked previews only** (`J*** S***`,
  `98••••••10`), never real values — a registration number is sequentially
  guessable (`C2-00001`, `C2-00002`, …), so returning full PII from an
  unauthenticated lookup would violate §16 and let anyone enumerate every
  participant's contact details. The true values are used server-side at
  final submission; the match path additionally uses a short-lived opaque
  token rather than exposing the matched registration number to the client
  at all.

  Neither endpoint exists yet (milestone 6). A 404 on the lookup path
  blocks with no bypass (clearing the field is the explicit way forward).
  A 404 on the match path shows an explicit **Continue as a new
  registration** button rather than silently proceeding — the distinction
  matters: duplicate-matching is a nice-to-have with §8.2 as a backstop,
  but identity resolution should never happen without the person choosing
  it.

  Paintings are open-ended (sanity ceiling `PARTICIPATION_MAX_ENTRIES` = 20
  in `src/config/fees.ts` — not a business rule, just protection against a
  malformed request).
- **`settings.organizer_upi_id`** — added alongside the age cutoff date; the
  forms can't render a payment step without knowing where to tell
  participants to send money. **Seeded value is a placeholder** —
  `replace-with-organizer-upi-id@upi` — set the real one before the forms go
  live.

Styling is Tailwind v4 + daisyUI (`@plugin "daisyui";` in `globals.css`);
light/dark follows the visitor's OS preference automatically.

## Category sign-up API route (milestone 5)

`POST /api/register/category` — one transaction (`{ behavior: "immediate" }`,
the `BEGIN IMMEDIATE` §7 asks for) creates the registration number, the
`participants` row, the `payments` row, the `artist_photos` row, and one
`entries` row per painting.

This milestone is transaction mechanics and correct data, not business-rule
enforcement — that's milestone 8, kept deliberately separate:

- `age_category_check`, `duplicate_check`, `eligibility`, and
  `registration_status` are left at their schema defaults (`n/a`, `clear`,
  `pending`, `incomplete`). Nothing here decides whether a registration is
  valid.
- `fee_match` **is** computed and stored — `expected_amount` and
  `declared_amount` are NOT NULL columns with no "not yet evaluated" state
  to fall back on, unlike the text-enum columns above, which have `n/a`
  built in for exactly this reason. A mismatch is recorded, not acted on:
  the registration still succeeds, `fee_match` just comes back `false` for
  the organizer to see later.
- `src/db/registration-id.ts` generates the `[Category Code]-[Sequence]`
  number (§7) via a single atomic `UPDATE counters SET last_sequence =
  last_sequence + 1 RETURNING last_sequence` — safe on its own, and reused
  by milestone 6 for `CP-` numbers. Still wrapped in the caller's own
  `immediate` transaction so a failure elsewhere in the same submission
  rolls the increment back too, rather than burning a sequence number with
  no participant to show for it.

Request-shape validation (via `zod`, a new dependency) is basic correctness
— required fields, `dob` format, `paintings.length` against that category's
`maxEntries` — not the age/duplicate/fee *enforcement* milestone 8 adds on
top of the `fee_match` value already being stored here.

Verified against a local database: valid submissions create all four
tables correctly with the right defaults; missing consent, a malformed
`dob`, and too many paintings for the category all return clean 400s
before anything is written; a fee mismatch still succeeds with `fee_match:
false` recorded. Fired **15 genuinely concurrent** registrations at the
same category and confirmed 15 unique, gapless sequential numbers —
directly testing the race condition §7 exists to prevent, not just
asserting the code looks right.

## Participation sign-up API route (milestone 6)

Three routes, all re-verifying identity server-side rather than trusting
what the client already checked via `/lookup` or `/match` — a request could
reach `/api/register/participation` directly, bypassing both:

- **`POST /api/register/lookup`** — resolves a registration number. Masked
  preview only (`src/db/mask-identity.ts`); see the "Participation form"
  section above for why a registration number can't safely return real PII.
- **`POST /api/register/match`** — looks for an existing participant by
  **email or mobile only** when no registration number was given. Name is
  accepted in the request but deliberately not used to trigger a match on
  its own — nothing stops two participants sharing a name, and matching
  confidently on it risks suggesting the wrong person. Neither email nor
  mobile is unique in the schema (§8.2 wants a reused value flagged, not
  rejected), so more than one row can share either; the most recently
  created match wins per signal, then email wins if email and mobile
  independently point to different participants. Returns an opaque,
  HMAC-signed token (`src/lib/match-token.ts`, 30-minute expiry) rather
  than the matched registration number — the client never learns it, even
  after confirming.
- **`POST /api/register/participation`** — the actual submission (§6). One
  transaction (same `{ behavior: "immediate" }` pattern as Category)
  resolves identity via exactly one of three paths, then writes a
  `payments` row and one `entries` row per painting, all sharing a single
  `submittedAt` read once before any insert:
  1. `registrationNumber` given → must resolve to an existing participant.
     Not found is a hard 404 — never falls through to path 3.
  2. `confirmedMatchToken` given → re-verified (signature + expiry) and
     must still resolve to a participant that exists. Invalid or expired →
     409, telling the person to check again rather than silently creating
     a duplicate.
  3. Neither given → creates a new participant with a freshly-generated
     `CP-nnnnn` number via the same `generateSequentialId` milestone 5
     built for `C1`/`C2`/`C3`.

Known limitation, not attempted here: mobile numbers are compared exactly
as typed. `"+91 98765 43210"` and `"9876543210"` won't match each other.
Worth a normalization pass later.

Verified against a local database:
- A registration-number lookup and a case-insensitive email match
  (`PRIYA@EXAMPLE.COM` matching a stored `priya@example.com`) both resolve
  correctly with the right masked preview.
- All three identity paths correctly attach to or create a participant:
  confirmed **3 entries and 3 payments** on one participant across three
  separate submissions (original Category signup, via registration number,
  via confirmed match token) — proving both resolution paths land on the
  *same* existing record rather than creating duplicates.
- A 2-painting submission in one call shares exactly one `submittedAt`
  value — the exact §6 requirement.
- Zero orphaned rows after four different rejected attempts (unknown
  registration number, expired/garbage match token, both identity fields
  given at once, 21 paintings against the 20-item cap) — confirms the
  transaction rolls back cleanly and pre-transaction validation blocks bad
  requests before anything is written.
- Fired **10 genuinely concurrent** brand-new registrations and confirmed
  10 unique, gapless `CP-nnnnn` numbers, continuing correctly from an
  already-used counter value — the same race-safety milestone 5 proved for
  `C1`/`C2`/`C3`, now confirmed for the `CP` path specifically, which is
  what actually makes that prefix reachable.

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

## Deferred — not in scope yet, explicitly parked

Not part of the build order in §18. Raised, discussed, and deliberately
deferred rather than built — noted here so the reasoning survives between
sessions.

- **Participant accounts.** Both spec documents assume anonymous public
  forms; the only authenticated users are organizers via the allow-list.
  Real accounts would mean a second, parallel auth system (Firebase Auth
  for every participant, not a handful of organizers), a login/signup/
  password-reset flow, and a schema link between an auth UID and a
  `participants` row.
- **I-Card generation.** §13 is explicit that the system never generates an
  I-Card image — that's a manual design step in an external tool. The
  organizer has since said the actual intent is **one I-Card template
  design, filled in programmatically per participant** — a real reversal of
  §13 worth resolving explicitly when this is picked back up, not just an
  implementation detail. This also implies a participant profile page
  (itself downstream of participant accounts existing) showing their own
  submissions and, once generated, their I-Card.

Neither is scheduled; both need their own scoping pass before starting.

Working through the milestones in §18 of the technical plan.

- [x] 1. Scaffold Next.js with standalone output
- [x] 2. Turso database + Drizzle schema and migrations
- [x] 3. Firebase Auth + Firebase Storage config and security rules
- [x] 4. `/register` form routing, Category and Participation forms
- [x] 5. Category sign-up API route
- [x] 6. Participation sign-up API route (multi-entry)
- [ ] 7. Signed upload URL flow
- [ ] 8. Server-side validation (age, duplicate, fee, file)
- [ ] 9. Reusable admin CRUD table + all resources behind auth
- [ ] 10. UPI statement CSV reconciliation
- [ ] 11. Scoring and rank computation
- [ ] 12. WhatsApp message text + manual send log
- [ ] 13. Verify production build locally; configure `apphosting.yaml`
- [ ] 14. Dry run of ~20 registrations
- [ ] 15. Connect GitHub repo to a Firebase App Hosting backend; deploy
