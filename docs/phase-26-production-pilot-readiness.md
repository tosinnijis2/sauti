# Phase 26: Production pilot readiness

This checklist is for a production-like staging deploy before a public pilot. It
does not add marketplace features, reset data, or create fake provider success.

## Required environment

Verify presence only. Never print values.

- `DATABASE_URL`
- `AUTH_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CRON_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `APP_URL`

`AUTH_SECRET` and `CRON_SECRET` must be at least 32 characters. `APP_URL` must be
the public HTTPS staging origin. `EMAIL_FROM` must be verified in Resend.

## Pre-deploy

- Confirm a recent database backup exists and document restore access (see
  [Backup and restore](#backup-and-restore)).
- Run `node node_modules/prisma/build/index.js migrate status` against staging.
- Confirm migration history is additive; do not reset, reseed, or drop staging data.
- Confirm schema compatibility with `node node_modules/prisma/build/index.js validate`.
- Confirm Cloudinary signed upload, resource lookup, and destroy permissions.
- Confirm Resend key and sender/domain are configured.
- Confirm scheduler provider stores `CRON_SECRET` as a protected secret.
- Confirm `APP_URL` generates HTTPS links and redirects for staging.

## Backup and restore

Sauti never runs a destructive migration, so the restore path is the safety net for
a bad release. Take and verify a backup before every deploy.

Take a backup (managed PostgreSQL):

```powershell
pg_dump --format=custom --file=sauti-staging-YYYYMMDD.dump $env:DATABASE_URL
```

Verify the backup is restorable before relying on it — a dump that has never been
restored is not a backup:

```powershell
createdb sauti_restore_check
pg_restore --dbname=sauti_restore_check --no-owner --no-privileges sauti-staging-YYYYMMDD.dump
```

Confirm the restored copy matches the expected shape, then drop it:

```powershell
psql $env:SAUTI_RESTORE_CHECK_URL -c "\dt"
psql $env:DATABASE_URL -c "SELECT count(*) FROM \"User\";"
dropdb sauti_restore_check
```

Record who holds restore credentials and where backups are retained. Restoring is a
last resort: prefer rolling the application back and leaving additive tables and
columns in place.

## Deploy

Run the existing production workflow:

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start
```

Use `npm run build` and `npm run start` when npm is healthy on the host.

`npm run db:migrate` maps to `prisma migrate dev` and is a **local development**
command. Never use it against staging: it can create migrations and prompt for a
reset. Deployment must use `migrate deploy`, which only applies existing migrations.

Production startup fails fast when a required variable is missing or malformed. It
names the offending keys and never prints their values, so a misconfigured deploy
refuses to serve rather than running degraded.

## Post-deploy

- Request `GET /api/health`; expect `ok: true` and `ready: true`.
- Call `POST /api/internal/evaluate-price-watches` without a bearer token; expect
  `401`.
- Call the same endpoint with `Authorization: Bearer <CRON_SECRET>`; confirm a
  run is recorded in `/admin/evaluations`.
- Confirm overlapping scheduler invocations record `SKIPPED` instead of running
  concurrently.
- Confirm stale scheduler warning clears after a successful run.
- Test email verification, verification resend, password recovery, and existing
  alert-email delivery with the actual Resend sender.
- Confirm all email links use staging `APP_URL`, are not localhost, and token
  links are single-use and expire.
- Test profile photo upload, replacement, and removal.
- Test listing image upload, replacement, and removal.
- Confirm Cloudinary cleanup retry behavior only against Sauti-owned public IDs.
- Run buyer, seller, and returning-seller smoke journeys on staging.
- Run safety/moderation smoke tests on staging.
- Review public marketplace, listing, seller, and review pages for private data
  exposure.

## Rollback

- Roll back the application release first.
- Do not run destructive down migrations against staging data.
- Keep additive tables/columns unless a reviewed data migration plan says
  otherwise.
- Check scheduler state after rollback; pause or repoint the cron if the old app
  cannot process the current schema.
- Cloudinary deletions are irreversible once a cleanup job succeeds. Failed jobs
  remain inspectable and should be reviewed before manual action.
- Resend deliveries are idempotent where supported, but already-sent emails cannot
  be recalled.

## Blocked staging checks

Local verification can prove build, migration consistency, security headers,
session-cookie settings, scheduler authorization, scheduler lease behavior,
readiness logic, mocked email behavior, and live Cloudinary behavior when network
access is allowed.

The following remain BLOCKED until a real staging URL and provider credentials are
available in that environment:

- Staging production start with all required env values.
- Staging PostgreSQL migration status and backup/restore proof.
- Staging Resend delivery and sender/domain verification.
- Staging `APP_URL` email links and redirects.
- Staging secured scheduler invocation with the actual `CRON_SECRET`.
- Staging buyer/seller/returning-seller persona smoke tests.
- Staging moderation and privacy smoke tests.
- Staging performance smoke tests against production-like data volume.

## Bounded reads

Pilot-readiness review found unbounded reads and bounded them. Browser-facing reads
are the priority; a public page must not scale its payload with a seller's history.

- `sellerTrustData` loads at most 200 of a seller's most recently active
  conversations and the earliest 200 messages of each, so `/sellers/[id]` no longer
  pulls an entire conversation history. Response-time and listing trust signals are
  computed from that sample.
- `listingAnalytics` reads at most 200 of an owner's listings.
- `evaluatePriceWatches` reads enabled watches in cursor-paged batches of 200. Every
  enabled watch is still evaluated exactly once per run; only peak memory is bounded.
- Admin evaluation history, cleanup jobs, reports, audit logs and search results are
  paginated server-side.

## Phase 26 verification results

Local results. Staging was not available, so no provider success is claimed here.

- Production build succeeds; 35 routes.
- Production start refuses to serve when a required variable is missing or when
  `APP_URL` is not HTTPS, naming only the offending keys.
- `prisma validate`, `prisma generate` and `prisma migrate status` all succeed
  against the local database with 31 migrations applied.
- Security headers are served on every response; the session cookie is `HttpOnly`,
  `SameSite=Lax`, and `Secure` in production.
- The scheduler endpoint returns 401 without a token and with a wrong token, and 200
  with the real `CRON_SECRET`. A successful run clears the stale-scheduler warning
  (`ready` flips to true) and releases the lease so the next run is not skipped.
- `/forgot-password` shows an unavailable notice with a disabled submit button when
  email is unconfigured, and never claims a delivery that did not happen.
- No localhost URLs, development ports, or obsolete endpoints appear in application
  code; localhost is referenced only in test harnesses, the local-Prisma check, and
  the documented development allowance for email origins.
- Public seller, listing and review pages expose no email addresses, phone numbers,
  message contents or deal prices. Only unpublished reviews stay unpublished.
- Full regression suite: 30 suites pass against the production build.
