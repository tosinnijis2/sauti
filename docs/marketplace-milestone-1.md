# Visual Marketplace: Milestone 1

## Delivered

- Optional validated image URLs in create/edit forms, with a preview.
- Shared 4:3 image cards, missing/broken photo fallback, seller avatar fallback.
- Product details, related listings, public seller profiles, share/copy controls.
- Existing seller conversations and ownership checks preserved.
- Twelve listings per page with search/category/location/country filters retained.
- Marketplace loading skeleton and retry state.

## Files changed in this milestone

- `src/app/market/page.tsx`
- `src/app/market/[id]/page.tsx` (new)
- `src/app/market/loading.tsx` (new)
- `src/app/market/error.tsx` (new)
- `src/app/sellers/[id]/page.tsx` (new)
- `src/app/listings/page.tsx`
- `src/app/listings/[id]/edit/page.tsx`
- `src/app/actions/listings.ts`
- `src/components/listing-form.tsx`
- `src/components/listing-image-field.tsx` (new)
- `src/components/product-card.tsx` (new)
- `src/components/product-image.tsx` (new)
- `src/components/seller-avatar.tsx` (new)
- `src/components/share-button.tsx` (new)
- `src/components/market-shell.tsx` (new)
- `src/components/app-shell.tsx` (mobile admin-link spacing only)
- `src/lib/images.ts` (new)
- `src/lib/market.ts` (new)
- `src/lib/validation.ts`
- `next.config.ts`
- `scripts/test-http.mjs`
- `README.md`
- `docs/marketplace-milestone-1.md` (this file)

## Database and dependencies

No schema changes, migrations, or dependencies added for this milestone.
The existing nullable `Product.imageUrl` is reused. Prior admin/messaging
migrations in the working tree are not part of this milestone.

## Commands

From the repository root, with `.env` configured:

```powershell
node node_modules/prisma/build/index.js dev start default
node node_modules/next/dist/bin/next build
node node_modules/next/dist/bin/next start -p 3101
```

Verification (HTTP suite requires the built app on port 3101):

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node scripts/test-http.mjs
node scripts/test-messaging.mjs
```

For development use `npm run dev -- --port 3101`, or invoke
`node node_modules/next/dist/bin/next dev -p 3101` if npm's system shim fails.
Stop the production preview before using that same port.

## Verification scope

Build, TypeScript, lint, HTTP integration, and messaging/recovery tests.
The HTTP suite includes image URL rejection/persistence, seller privacy,
pagination, ownership, authentication, messaging, and admin deletion permissions.
Browser checks cover desktop/mobile layout, optimized photo loading, missing/
broken photo fallbacks, product-to-seller navigation, and image preview.
Only temporary QA records are created and removed during verification.

## Boundaries and next phase

- Allowed HTTPS sources: Cloudinary `image/upload` and Unsplash `photo-*` URLs.
  Next.js image redirects and local-IP fetching are disabled. Image hosting
  must remain reachable by the application server.
- No binary upload/storage integration or multiple-image model yet.
- Existing prices are shown as USD; currency selection/conversion is not added.
- Save/heart controls are deferred until Phase 2 implements persistent favorites.
  There are no inactive save controls or fabricated marketplace records.
- Public seller pages intentionally omit email, phone, and authentication data.
- Password recovery still requires the existing email-provider configuration.

Recommended next milestone: favorites with a user/product unique constraint,
authenticated save/remove actions, saved listings, then the personalized dashboard.
Stop here for review before implementing Phase 2.
