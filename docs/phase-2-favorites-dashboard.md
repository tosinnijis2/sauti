# Phase 2: Favorites and Personalized Dashboard

Completed September 28, 2026. Part A was implemented and verified before Part B.
No Phase 3 features were started. No dependencies were added.

## Favorites

- Authenticated, separate idempotent save/remove server actions.
- Optimistic accessible heart controls, pending/duplicate-click protection,
  safe errors and automatic rollback after failed operations.
- Saved state on marketplace, detail, related, seller and dashboard cards.
- Private `/saved`, newest saved first, 12-item pagination and useful empty state.
- Signed-out controls link to login with an allowlisted return destination.
- Desktop Saved Listings navigation; mobile retains five bottom navigation items
  and exposes Saved Listings in dashboard quick actions.

## Database and authorization

Migration `20260928020000_persistent_favorites` was applied and Prisma Client
regenerated. It adds only Favorite and User/Product relation arrays. Favorite has
id, userId, productId, createdAt, a unique user/product constraint, indexes on
user/createdAt and productId, and cascading user/product foreign keys.

Actions derive identity exclusively from the current session, validate product
IDs, reject saving one's own listing and scope removals to that session's user.
A transaction locks the target product against concurrent deletion and duplicate
inserts use the database constraint with skipDuplicates. Repeated removal is a
safe no-op, including after product deletion. Next server-action origin checks
remain enabled. Database errors are not returned to the browser.

Saved-state lookups are batched per page, not per card. Listing/admin mutations
invalidate dashboard and saved pages. No existing marketplace records were reset
or deleted; only newly generated QA fixtures were cleaned up. The retained
Disposable upload QA 2801 listing and its photo were left unchanged.

## Dashboard data

- User: authenticated display name and configured country.
- Product: current owned count, newest three owned listings, newest three listings
  from other owners. Existing schema has no active/sold status, so the label is
  Current listings, not Active listings.
- Favorite: own count and three most recently saved products.
- Conversation: own buyer/seller membership count and three recent conversations.
- Message: latest visible message per selected conversation and up to three public
  posts in the user's country. Hidden messages and blocked authors are excluded;
  country posts must have no conversation ID.

Queries use selected fields, database limits and independent parallel requests.
Existing ProductCard, ProductImage and SellerAvatar components are reused.
New accounts omit empty activity totals and empty owned/saved sections. Dashboard
has loading and retry/error states; Saved Listings has a loading skeleton.

## Files

- `prisma/schema.prisma`, migration above.
- `src/lib/favorites.ts`, `src/lib/auth-return.ts`, `src/lib/dashboard.ts`.
- `src/app/actions/favorites.ts`; existing auth, listings and admin actions.
- `src/components/favorite-button.tsx`, product-card, auth-card, app-navigation,
  app-shell (scrollable desktop sidebar).
- `src/app/saved/page.tsx`, `src/app/saved/loading.tsx`.
- `src/app/dashboard/page.tsx`, loading.tsx and error.tsx.
- `src/app/market/page.tsx`, `src/app/market/[id]/page.tsx`,
  `src/app/sellers/[id]/page.tsx`, `src/app/login/page.tsx`.
- `scripts/test-favorites.mjs`, `scripts/test-dashboard.mjs`, README and this report.

## Verification

All executed successfully against the production preview and local PostgreSQL:

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js .`
- `node node_modules/next/dist/bin/next build`
- `node scripts/test-favorites.mjs`: persistence, concurrent duplicates, user
  isolation, private saved pages, rendered states, cascade cleanup, invalid and
  cross-origin requests, signed-out behavior and safe login return.
- `node scripts/test-dashboard.mjs`: real bounded data, three account states,
  owned/fresh separation, conversation privacy, hidden/blocked filtering, country
  isolation and absence of unsupported unread metrics.
- `node scripts/test-http.mjs`: auth, marketplace, images, validation, pagination,
  seller privacy, ownership, chat, admin permissions and deletion audit behavior.
- `node scripts/test-messaging.mjs`: membership, country isolation, blocking,
  recovery expiry/single use, hashing and session invalidation.
- `node scripts/test-uploads.mjs`: mocked provider lifecycle/security checks.
- Same upload suite with `LIVE_UPLOAD_TEST=1`: real Cloudinary lifecycle checks.
- `node scripts/test-upload-http.mjs`: real authenticated upload HTTP flow,
  content/size/origin/ownership validation and credential-free responses/bundles.

Browser QA at 1280x900 and 390x844 covered established, brand-new and favorites-only
accounts. Verified immediate heart updates, refresh persistence, detail matching,
multiple saved items, removal from Saved Listings, cross-account isolation,
working saved navigation, image rendering and no horizontal overflow. Mobile
bottom navigation remains five items. Temporary fixture accounts were removed
and the original demo-admin session restored.

## Limits and next milestone

No unread state exists, so the dashboard reports conversations instead. Fresh
listings are chronological, not category-personalized. Data refreshes through
navigation/server-action revalidation, not live subscriptions. Public popularity
counts, notifications, tracking, analytics and market intelligence are excluded.
Existing upload cleanup retry/orphan limitations remain documented in the upload
milestone; its implementation and private credentials were not changed.

Review and approve this milestone before scoping Phase 3. A future market-data
milestone should first establish reliable sources, currency/unit conventions and
freshness rules; no market intelligence was implemented here.
