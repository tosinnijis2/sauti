# Product Image Upload Milestone

## Architecture

The owner explicitly chose server-proxied uploads to keep **both** the API key and
API secret out of browser responses. This supersedes the original direct-upload
preference. Browser -> authenticated `/api/uploads/product` -> server-signed
Cloudinary HTTPS upload -> signed Sauti receipt -> listing action -> PostgreSQL.
Only URLs/public IDs/receipts reach the browser; neither credential is returned.
The server holds bounded temporary bytes in memory, never permanent files or DB
binaries. No unsigned preset, upload widget or new dependency is used.

Cloudinary request signing follows its [authentication signature documentation](https://cloudinary.com/documentation/authentication_signatures).
Signed parameters include a server-generated public ID under
`sauti/products/<owner-id>/<random-uuid>`, overwrite=false, timestamp and allowed
formats. Requests use SHA-256 signatures. The original Phase 1 delivery allowlist
is unchanged for backwards compatibility.

## UX

- Choose Photo, drag/drop, local 4:3 preview, Replace Photo and Remove Photo.
- JPEG, PNG and WebP, maximum 5 MiB (5 MB UI label).
- Transfer progress followed by upload processing/saving status; duplicate submit
  and form changes disabled while a request is running.
- Upload failure blocks saving until retried or the seller explicitly removes
  the selected photo. Form values survive errors.
- Existing photos remain when editing without changing the photo.
- Replacement saves the new URL/public ID first, then cleans up the old asset.
- Removal clears both DB fields before deleting the previous managed asset.
- Seller deletion, admin product deletion and admin user-deletion cascades use
  database-stored IDs for cleanup after the transaction commits.

## Schema and configuration

One nullable field: `Product.imagePublicId String?`.
Migration: `prisma/migrations/20260928010000_product_image_public_id/migration.sql`.
Applied locally and Prisma Client regenerated. No other fields changed.

Required existing `.env` names:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- AUTH_SECRET (existing session configuration, also used for audience-bound receipts)

All three Cloudinary names were configured and live tests succeeded. No additional
local Cloudinary setup is needed. `.env` remains ignored; no `.env.example` created.

Deployment commands:

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start -p 3101
```

## Security

- Authentication and same-origin POST checks before reading file data.
- MIME allowlist, nonempty/5 MiB size limit, magic-byte checks on client/server;
  Cloudinary performs image decoding and format restrictions too.
- Actual multipart stream bounded, not just Content-Length.
- Per-process upload attempt throttle (20 per authenticated user per ten minutes).
- Server-only credentials and fixed external endpoint; provider errors sanitized.
- Signed 30-minute receipts bind owner, product ID, image metadata and edit revision.
- Listing actions reject arbitrary imageUrl/imagePublicId submissions.
- Server-side ownership and row locks; stale replacement receipts rejected.
- Create receipts target a generated primary key, preventing duplicate consumption.
- Receipt-backed saves reverify provider metadata and asset existence. Attachment
  and cleanup serialize on the owner row; cleanup rechecks all listing references.
- Cleanup accepts only server-managed owner-prefixed IDs obtained from the DB.
- Legacy URLs without public IDs are preserved and never remotely deleted.
- Credential scans cover `.next/static` JavaScript/maps and upload/public responses.

## Files changed

- prisma/schema.prisma
- prisma/migrations/20260928010000_product_image_public_id/migration.sql (new)
- src/components/listing-image-field.tsx
- src/components/listing-form.tsx
- src/app/listings/[id]/edit/page.tsx
- src/app/api/uploads/product/route.ts (new)
- src/app/actions/listings.ts
- src/lib/cloudinary.ts (new)
- src/lib/listings.ts (new)
- src/lib/listing-image-cleanup.ts (new)
- src/lib/images.ts
- src/lib/validation.ts
- src/lib/admin/deletion.ts
- scripts/test-http.mjs
- scripts/test-uploads.mjs (new)
- scripts/test-upload-http.mjs (new)
- scripts/retry-image-cleanup.mjs (new)
- README.md
- docs/product-image-upload.md (this file)

## Verification

- TypeScript, ESLint and Next.js production build.
- Existing HTTP integration suite and messaging/recovery suite.
- Mock-provider upload suite: formats, oversize/spoofed files, signed metadata,
  preserve/replace/remove, replay rejection, ownership, delete/admin cleanup,
  cleanup failure safety, and legacy URLs.
- Live Cloudinary lifecycle suite: real JPEG/PNG/WebP uploads and asset cleanup.
- Live HTTP upload suite: authentication, CSRF, other-owner rejection, MIME/content/
  size errors, upload receipt persistence, public rendering, and credential scans.
- Browser: selected JPG, local preview, loading state, saved listing and product
  detail image at mobile width; unsupported-file feedback and desktop/mobile
  layout checks. Saved-image replacement/removal were verified by automated live
  tests, not repeated destructively against the retained browser test listing.
- The owner requested that browser-created `Disposable upload QA 2801` remain
  unchanged. It and its photo are intentionally retained. Destructive lifecycle
  verification uses separate automated test records, not that listing.

## Limitations

- Proxy uploads require hosting request limits above 5 MiB plus 64 KiB multipart
  overhead, sufficient memory and request duration. A platform with a lower fixed
  limit needs a compatible proxy host or a revisited direct-upload decision.
- Throttling is process-local; multi-instance production needs a shared limiter.
- Receipt-backed saves consume Cloudinary Admin API metadata lookups and are
  subject to that account's API quotas.
- Cloudinary or DB interruptions can leave uploaded-but-unattached assets. No
  persistent outbox/reconciliation job was added because this milestone limits
  schema changes to the nullable image field.
- Failed cleanup makes two attempts and logs the asset ID, without rolling back
  successful listing changes. `scripts/retry-image-cleanup.mjs` checks for current
  DB references before operator-initiated retries. Use it only for logged old
  assets, not pending uploads with unexpired receipts.
- One photo per listing. No favorites or other Phase 2 work was started.
