# Phase 4: Standardized Quantity, Units and Listing Status

## Changes

New listings require a positive quantity and a standardized unit; their price
applies to that entire quantity. Create/edit forms and listing cards/details show
total price, quantity/unit and derived price per base unit. My Listings has an
owner-only status selector and edit forms also support status changes.

Legacy rows still render their total price with quantity/unit marked unspecified.
The owner gets an Add quantity and unit link. Legacy edits can leave both blank;
partial pairs are rejected. Once standardized, edits must retain both fields.
Neither migration nor application invents missing quantities or units.

## Schema and migration

Applied additive migration `20260928030000_listing_units_status`, regenerated
Prisma Client; no reset, new dependency or historical table.

- `ListingStatus`: ACTIVE, RESERVED, SOLD, INACTIVE.
- `ListingUnit`: ITEM, KG, G, TONNE, LITRE, ML, DOZEN, BAG, SACK, BOX, CRATE, BUNDLE.
- `Product.quantity`: nullable Decimal(12,3), maximum 999,999,999.999.
- `Product.unit`: nullable ListingUnit.
- `Product.status`: required ListingStatus, default ACTIVE (including old rows).
- Database check requires either both quantity/unit null or both present with
  positive bounded quantity. The bound also excludes numeric NaN.

Application validation rejects arbitrary units, missing new-listing fields,
nonpositive quantities, scientific notation and more than three decimal places.
Price must be positive with at most two decimal places. No derived price is stored.

## Normalization

One explicit rules table drives JavaScript display helpers and parameterized SQL:

| Listed unit | Base unit | Base quantity multiplier |
| --- | --- | --- |
| g | kg | 0.001 |
| kg | kg | 1 |
| tonne | kg | 1000 |
| ml | litre | 0.001 |
| litre | litre | 1 |
| item, dozen, bag, sack, box, crate, bundle | unchanged | 1 |

Normalized asking price = total price / (quantity * multiplier). A dozen remains
its own group; no package-content or bag/sack weight assumptions are made. Amounts
are formatted to up to six fractional USD digits; smaller positive values display
as less than $0.000001 rather than zero. Listed totals retain two-decimal USD format.

## Status and security

ACTIVE-only discovery applies to marketplace filters/counts/pagination, seller
profiles, related products, fresh dashboard products and landing-page previews.
RESERVED is not included in discovery or active supply. SOLD and INACTIVE likewise
stay out. All statuses remain in My Listings and the owner's recent dashboard
listings, with badges. Dashboard Your listings count covers all owned statuses.

Direct product links and Saved Listings remain accessible with clear status labels
and an inactive notice on non-ACTIVE details. Status is not an access-control/privacy
setting. Favorites and existing conversation/message history are not deleted.
Messaging remains available through the existing permission-checked workflow.

Status actions get identity from the authenticated session, validate product ID and
enum, and use an atomic update constrained by ownerId. Client-supplied userId is
ignored. Full edits retain existing transactional owner checks and image receipt
verification. Status changes update updatedAt, so stale photo receipts remain
protected by the existing revision check. No Cloudinary asset is deleted by a
status transition. Relevant market, insight, saved, owner and dashboard paths are
revalidated; errors are sanitized and pending controls are disabled.

## Market Insights

The explicit Compare per unit filter defaults to kg, with separate litre/item/
dozen/bag/sack/box/crate/bundle choices. Weight and volume variants normalize before
aggregation. Only ACTIVE rows with valid price and quantity/unit qualify. Legacy
rows are excluded from both statistics and contributing listings.

PostgreSQL calculates median/average/min/max on normalized unit price, not listing
total. Every selected unit group and country/location subgroup independently needs
five rows; incompatible groups cannot be pooled to reach the threshold. Dashboard
snapshot aggregation groups by category AND base unit, while preserving saved-
category priority. Links carry the selected base unit.

Existing server-side aggregation, repeatable-read snapshot, contributor pagination,
parameterized SQL, batched favorite state and hidden/private message rules remain.
No historical snapshots, external feeds, alerts or currency conversion were added.

## Files

- Prisma schema and additive migration above.
- `src/lib/units.ts`, `validation.ts`, `listings.ts`, `market.ts`,
  `market-filters.ts`, `insight-filters.ts`, `insights.ts`, `dashboard.ts`.
- `src/components/listing-form.tsx`, `listing-price.tsx`, `listing-status.tsx`,
  `listing-status-control.tsx`, `product-card.tsx`, `market-snapshot.tsx`.
- Listing/admin actions; owner listings/edit, marketplace/details/insights,
  seller, landing and dashboard pages.
- New `scripts/test-units-status.mjs`; updated insights and create/upload test
  fixtures; README and this report. Previous phase reports describe their original
  behavior; this phase supersedes status and unit eligibility described there.

## Verification

Executed successfully:

- TypeScript `--noEmit`, ESLint, Next.js production build.
- `test-units-status.mjs`: precision/unit validation, ACTIVE defaults, required
  pairs, ownership on edits/status actions, unsigned/cross-origin rejection,
  ACTIVE-only public discovery, retained owner/saved/conversation records, legacy
  preservation/upgrades, kg/g/tonne and litre/ml conversion parity, per-unit
  aggregates, package/dozen/item separation and minimum comparable samples.
- `test-insights.mjs`: established aggregate/filter/pagination/security tests,
  updated to standardized kg fixtures and ACTIVE-aware eligibility.
- `test-http.mjs`, `test-favorites.mjs`, `test-dashboard.mjs`,
  `test-messaging.mjs`.
- `test-uploads.mjs` with both mocked and live Cloudinary providers.
- `test-upload-http.mjs` with real Cloudinary uploads and quantity/unit fields.

An initial new-test assertion failed because React inserts HTML comments between
USD/ and its dynamic unit label; it now checks the text without hydration comments.
No statistical or authorization assertion failed.

Browser QA at 1280x900 and 390x844: created 25 kg/$40 listing, marked Sold without
deletion, edited to 25,000 g and reactivated, confirmed $1.60/kg remained unchanged.
Legacy fixture upgraded through Edit. Insights showed five weight listings at
$1.60/kg separately from five bag listings at $10/bag; dashboard showed distinct
unit groups. Forms, status badges, controls and insights had no horizontal overflow.
Accessibility review corrected the status selector's label association.

Temporary QA accounts/listings were removed after checks. The retained upload QA
listing/photo and all other pre-existing data were preserved; its quantity and unit
remain unspecified. Preview remains on localhost:3101.

## Limits and next milestone

Units improve dimensional comparability, not product identity, grade, condition or
package contents. Category-only summaries can still combine different commodities;
use product search to narrow them. Per-bag prices do not imply equal bag weights.
Location names remain free text. Five listings is a minimum sample, not a confidence
interval; prices remain unweighted seller asking prices, not completed sales.

Quantity allows three decimals for every unit, including package/count units;
fractional packages are not prohibited in this milestone. There is no stock ledger,
partial-sale workflow, reservation expiry or sale audit trail. Direct non-active
links remain public as described above.

Recommended next milestone: structured commodity/grade and package-content metadata
with seller-confirmed legacy enrichment. Review this phase before starting anything
else. Historical price tracking was not started.
