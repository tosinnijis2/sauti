# Sauti

Sauti is a full-stack local marketplace built with Next.js App Router, TypeScript,
Tailwind CSS, PostgreSQL, and Prisma.

## Local development

1. Configure the database and auth secret in the existing `.env` file.
2. Start local Prisma Postgres with `npm run db:start`.
3. Apply migrations with `npm run db:migrate`.
4. Start the app with `npm run dev`.

Run `npm run lint`, `npm run typecheck`, and `npm run build` before shipping changes.

## Visual marketplace (Milestone 1)

Listing creation and editing now accept an optional photo file, with a local preview.
Existing Cloudinary `image/upload` and Unsplash `photo-*` URLs remain supported.
Next.js optimizes these images; redirects and local-network image fetching are
disabled. Missing or failed photos show a labeled fallback, never a stock product.
Multiple images are not implemented yet.

The marketplace uses 12-item pagination and preserves search/category/location/
country filters. `/market/[id]` provides details, related listings, sharing and the
existing seller conversation action. `/sellers/[id]` exposes only public seller
identity and listings, not contact details or authentication data. Prices retain
the existing dollar convention and are explicitly labeled USD; currency selection
is not supported yet. Persistent favorites are now available in Phase 2 below.

This milestone reuses `Product.imageUrl`: no new migration or dependency is needed.
See `docs/marketplace-milestone-1.md` for the file inventory and verification.

## Product photo uploads

The subsequent upload milestone adds nullable `Product.imagePublicId` and migration
`20260928010000_product_image_public_id`. Apply it before deploying the new build.
The form supports JPEG, PNG and WebP up to 5 MiB (shown as 5 MB), with Choose,
Replace, Remove, local preview, transfer progress and upload/save error states.

Set these server-only names in the existing `.env` (never in `NEXT_PUBLIC_*`):
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
The existing `AUTH_SECRET` signs upload receipts. Both Cloudinary credentials stay
private: per the owner's choice, files are proxied through an authenticated Sauti
route, then sent to Cloudinary using server-signed HTTPS requests. No upload preset
or additional dependency is required. No permanent binary storage is used locally
or in PostgreSQL. Deployments must permit a 5 MiB photo plus multipart overhead
and outbound HTTPS to Cloudinary.

Run `node scripts/test-uploads.mjs` for mocked-provider lifecycle/security tests.
Run `$env:LIVE_UPLOAD_TEST = '1'; node scripts/test-uploads.mjs` in PowerShell for
the real Cloudinary lifecycle suite. `node scripts/test-upload-http.mjs` also uses
real Cloudinary through the running app. Both live suites upload generated test
images and clean up their own records/assets; credentials are never printed.

Replacement/removal/deletion commits database changes before asset cleanup.
Failed cleanup is retried once and logs only the Sauti asset ID. For a logged,
unreferenced old asset, operators can use
`node scripts/retry-image-cleanup.mjs OWNER_ID PUBLIC_ID` with network access.
This refuses assets still referenced by any listing. Uploads interrupted after
Cloudinary succeeds but before receipt delivery or listing save can leave orphans;
there is no durable cleanup queue yet. See `docs/product-image-upload.md` for the
complete change inventory, security boundaries and verification results.

## Favorites and personalized dashboard (Phase 2)

Authenticated users can save listings from marketplace cards, product details,
seller profiles and dashboard previews. `/saved` is private and paginated.
The dashboard shows real listing, saved-item and conversation totals, bounded
recent listings/favorites, fresh products, and permission-filtered message previews.
New accounts get a compact welcome and fresh listings instead of empty statistics.

Apply additive migration `20260928020000_persistent_favorites` before deploying.
No additional dependencies or environment variables are required.
Run `node scripts/test-favorites.mjs` and `node scripts/test-dashboard.mjs` against
the local database and running production preview. Both clean up their own fixtures.
See `docs/phase-2-favorites-dashboard.md` for scope, security and verification.

## Market Insights (Phase 3)

`/market/insights` summarizes current Sauti asking prices in USD, with the same
search, category, country and location filters as the marketplace. PostgreSQL
calculates median/average/min/max/count; summaries require at least five listings.
Location comparisons have the same minimum, and contributing listings are
paginated. The dashboard includes a compact snapshot favoring saved categories.

There are no sale-price claims, external feeds, historical trends or currency
conversions. Phase 4 now limits this dataset to ACTIVE standardized listings and
calculates prices per compatible unit. Run `node scripts/test-insights.mjs` against
the running production preview and local database. See
`docs/phase-3-market-insights.md` for methodology, verification and limitations.

## Standardized quantities and listing status (Phase 4)

Apply additive migration `20260928030000_listing_units_status` and regenerate
Prisma Client before deploying. Product now has optional decimal quantity, a
standardized unit enum, and ACTIVE/RESERVED/SOLD/INACTIVE status (default ACTIVE).
Legacy quantities/units stay null. New listings require both; legacy listings can
be upgraded through Edit. Prices apply to the entered quantity, not to each unit.

Owners can change status from My Listings or Edit. Discovery surfaces show only
ACTIVE listings. Direct links, favorites and owner views retain non-active listings
with status badges; status is not a privacy setting and never deletes a record.
Messaging history remains intact. Weight normalizes to kg, volume to litre; other
units remain separate. Insights require five ACTIVE comparable listings per group.
No historical data or new dependency was added.

Run `node scripts/test-units-status.mjs` plus the established suites. See
`docs/phase-4-units-status.md` for normalization, security, legacy behavior and QA.

## Structured commodities and package contents (Phase 5)

Apply `20260928040000_commodity_package_metadata` before running the updated app.
Listings now accept optional commodity, variety, seller-provided grade, and explicit
contents per package. Legacy fields remain null: nothing is inferred from titles.
One sack containing 50 kg for $40 normalizes to $0.80/kg; two crates containing
20 kg each for $60 normalize to $1.50/kg. Unspecified packages stay package-priced.

Insights and dashboard snapshots group by commodity, compatible normalized unit,
variety and grade. Unspecified attributes remain separate. Five ACTIVE comparable
listings are required for statistics. Search includes structured metadata as well
as existing title/description matching. Monetary calculations use Decimal and
PostgreSQL numeric arithmetic, not JavaScript floating-point aggregation.

Run `node scripts/test-commodity-metadata.mjs` alongside the existing regression
suites. See `docs/phase-5-commodity-metadata.md` for validation, QA and limitations.

## Historical asking-price snapshots (Phase 6)

Migration `20260929010000_price_snapshots` adds immutable, Decimal-based observations
for eligible ACTIVE listings. A snapshot is recorded after creation, an effective
comparison-state change, or reactivation. Description and photo-only edits do not
create observations. Listing deletion detaches rather than removes its history.

Run `node scripts/backfill-price-snapshots.mjs` once after deployment to record the
first real observation for current eligible listings. It uses execution time and is
idempotent; it never invents older dates. Market Insights uses daily medians when
two daily periods qualify, otherwise weekly medians. Each displayed period requires
five observations, and trends require two qualifying periods.

Run `node scripts/test-price-history.mjs` with the established regression suites.
See `docs/phase-6-price-history.md` for triggers, aggregation, retention and QA.

## Historical data operations (Phase 7)

Migration `20260929020000_snapshot_capture_reason` records why each observation was
captured. Administrators can inspect real snapshot health and consistency findings
at `/admin/history`. The repair command now supports `--dry-run`, appends only an
eligible ACTIVE listing's missing current state, and reports a clear summary without
rewriting immutable history.

Market Insights can bound history to 30, 90, 180, or 365 days, or use all recorded
history. PostgreSQL applies the selected `capturedAt` boundary before aggregation;
sparse ranges remain empty instead of silently using older observations. Run
`node scripts/test-history-operations.mjs` and `node scripts/test-price-history.mjs`.
Retention, privacy, health thresholds, query indexes, and repair behavior are
documented in `docs/phase-7-history-operations.md`.

## Price alerts and in-app notifications (Phase 8)

Authenticated users can create cohort-prefilled watches from Market Insights and
manage them at `/price-watches`. Supported triggers are median below/above a USD
threshold and qualifying median percentage drops/rises. Run
`node scripts/evaluate-price-watches.mjs` manually or from a future scheduler.

Crossing state prevents duplicate alerts while a condition remains true. Private
notifications appear at `/notifications`, support individual/all read actions, and
surface an unread navigation badge. In-app price alerts can be disabled independently;
email, SMS, and push delivery are not implemented. See
`docs/phase-8-price-alerts.md` and run `node scripts/test-price-watches.mjs`.

## Scheduled alert operations (Phase 9)

The price-watch evaluator can be invoked manually or through authenticated
`POST /api/internal/evaluate-price-watches`. Configure the server-only `CRON_SECRET`
and send it as a Bearer token. A PostgreSQL lease prevents overlapping work, while
every invocation records durable metrics visible to administrators at
`/admin/evaluations`.

Notifications now use 25-row server pagination and are retained indefinitely for
now. The email preference is modeled but unavailable because Sauti does not yet have
verified-email semantics or configured email delivery. See
`docs/phase-9-alert-operations.md` and run `node scripts/test-alert-operations.mjs`.

## Messaging and password recovery

Messages includes private product conversations and public country rooms. Country
filters use the listing's country; existing listings can set it when edited.
Messages refresh every five seconds. Members can block accounts and report messages;
users with the ADMIN database role can review reports at `/messages/moderation`.

Password recovery needs `RESEND_API_KEY`, a verified sender in `EMAIL_FROM`, and
`APP_URL` set to the application's public HTTPS origin (HTTP localhost is allowed
for development). Missing credentials show an unavailable message, never a fake
delivery confirmation. Reset tokens expire after 30 minutes and can be used once.
Changing a password invalidates existing sessions.

Run `node scripts/test-messaging.mjs` against a running local database to test chat
permissions and recovery. It creates temporary records and deletes only those records.
After building and starting the production server on port 3101, run
`node scripts/test-http.mjs` for registration, login/logout, listings and messaging
HTTP integration checks. Set `TEST_APP_URL` to use another local port.

## Administration (Phase 2)

`/admin` redirects to `/admin/dashboard`. Only database users with role `ADMIN`
can access the overview and paginated `/admin/search`. Regular users receive a
not-found response; signed-out visitors must log in. Roles are checked server-side
on each request, including data access. No accounts are promoted automatically.

The overview reports actual database totals, UTC growth, current category counts,
and recent registrations/listings. Commerce figures remain unavailable until order
and payment workflows exist. Search exposes selected user/listing/report metadata,
not password hashes or private message content. The report badge is an unresolved
report count, not a per-admin notification inbox.

Admins can permanently delete regular users and products from Search records.
Message moderation lists public-room messages and reported private messages only.
Deletion requires a reason and typed DELETE confirmation, enforced server-side.
Administrator accounts cannot be deleted. User deletion cascades to owned listings,
messages and conversations, including other participants' messages in those threads.
Product deletion preserves conversation history. Every administrative deletion is
recorded transactionally in AuditLog; logs retain target IDs after deletion and
cannot be edited through the dashboard. Integration tests retain their labeled
deletion audit records while cleaning up their temporary users.

The full route and migration plan is in `docs/admin-plan.md`. Fine-grained admin
roles, other management operations and commerce workflows remain later phases.
The HTTP integration suite also tests admin authorization, role revocation, search
validation, and sensitive-field exclusion.
