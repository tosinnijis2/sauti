# Phase 3: Market Intelligence

Implemented September 28, 2026. Scope stops at current Sauti listing insights.

## What changed

- Public `/market/insights` with search, category, country and location filters.
- Median is the primary reference; average, minimum, maximum and valid listing
  count use the same selected dataset. Every price is explicitly USD and labeled
  Sauti asking prices, not sale prices or official market prices.
- Accessible location table with proportional CSS bars and textual price/count
  equivalents. Up to eight qualifying locations, ordered by listing count.
- Existing ProductCard renders paginated contributing listings (12 per page),
  including normal detail navigation, images, messaging and favorite controls.
- Market page link retains selected filters. Dashboard has a compact snapshot
  with up to three qualifying categories and a link to the full insights page.
- Honest zero/small-sample states and route loading skeleton. Existing market
  error boundary provides retry handling. No historical or external data added.

## Files and schema

New files:

- `src/lib/market-filters.ts`: shared existing marketplace filter schema/predicate.
- `src/lib/insights.ts`: database aggregation, qualification and snapshot selection.
- `src/app/market/insights/page.tsx` and `loading.tsx`.
- `src/components/market-snapshot.tsx`.
- `scripts/test-insights.mjs` and this report.

Changed files:

- `src/app/market/page.tsx`: shared filters and insights link.
- `src/app/dashboard/page.tsx`: compact snapshot.
- `src/app/actions/listings.ts`, `src/app/actions/admin.ts`: insights invalidation.
- `scripts/test-http.mjs`: distinguish insights navigation from product links in
  the pagination assertion.
- `README.md`.

No schema changes, migrations, new indexes or dependencies. The existing category
index remains available. A local EXPLAIN ANALYZE of category-filtered median
aggregation measured under 1 ms on the small fixture dataset; this is not a
production-scale benchmark or a reason to assume future large-table performance.

## Statistical method and eligibility

PostgreSQL computes `percentile_cont(0.5)` over prices, AVG, MIN, MAX and COUNT.
Odd medians are the middle value; even medians interpolate the two middle values.
No rounding occurs before aggregation; displayed prices use the existing USD
formatter at two decimal places. Each listing has equal weight, not each seller.

Price statistics are withheld below five matching listings. Each location and
dashboard category independently requires five listings. The threshold is a
product safeguard, not a statistical confidence interval or guarantee of market
coverage. Counts and individual listings remain visible below it.

Only persisted Product rows with price > 0 and <= 9,999,999,999.99 qualify. This
excludes negative/zero prices and PostgreSQL numeric NaN. Price is NOT NULL.
Deleting products removes them from future aggregates. The model has no draft,
inactive, sold or soft-delete status, so none can be inferred; all valid current
rows qualify. Eligibility must be extended if status fields are introduced.

Filtering matches marketplace semantics: exact category/country, case-insensitive
item OR description search and location substring. LIKE wildcard behavior is
unchanged from existing Prisma contains filters. SQL values are parameterized,
not interpolated as SQL source. Contributor queries reuse the shared Prisma
predicate plus the same valid-price bounds.

Location aggregation groups by trimmed/case-normalized location AND country.
Same-named locations in different countries never merge; missing country remains
a separate group. Free-text spelling variants are not geocoded or deduplicated.

An insights request uses a repeatable-read transaction so totals, location groups
and paginated contributors share one database snapshot. Aggregation is server-side;
full Product records/prices are not loaded into browser JavaScript. Independent
queries are bounded; saved card states are fetched in one batch.

Dashboard snapshot selection joins the signed-in user's saved categories against
qualifying category aggregates, prioritizes those categories, then fills remaining
slots by listing count with deterministic category ordering. This is not an AI
recommendation or behavioral tracking system. No private favorite identities or
seller contact/authentication fields are rendered.

## Tests and results

Passed:

- `node node_modules/typescript/bin/tsc --noEmit`
- `node node_modules/eslint/bin/eslint.js .`
- `node node_modules/next/dist/bin/next build`
- `node scripts/test-insights.mjs`: odd/even median; average/min/max/count;
  zero/negative/NaN exclusion; search/category/location/country filters; matching
  contributors; pagination; same-city country separation; normalization; minimum
  sample threshold; deletion crossing the threshold; SQL injection input; saved
  category preference and isolation; public HTTP and authenticated snapshot;
  no-match/small-sample output; schema eligibility assumptions; no trend copy.
- `node scripts/test-http.mjs`: auth, filters/pagination, seller privacy, ownership,
  messaging, admin permissions/deletion audit, images and validation.
- `node scripts/test-messaging.mjs`
- `node scripts/test-favorites.mjs`
- `node scripts/test-dashboard.mjs`
- `node scripts/test-uploads.mjs` (mock provider).
- Same upload suite with `LIVE_UPLOAD_TEST=1` (real Cloudinary).
- `node scripts/test-upload-http.mjs` (real upload route).

One initial insights-test failure used metadata omitted by Prisma's runtime DMMF;
the assertion now checks PostgreSQL information_schema for NOT NULL. The initial
HTTP pagination test counted the new insights link as a product; its route filter
was corrected. Both suites subsequently passed.

Browser QA at 1280x900 and 390x844 verified insufficient-data state, populated
aggregates, proportional location bars, combined filters, pagination, dashboard
snapshot/navigation and opening contributor detail pages. No horizontal overflow
was observed. Temporary clearly labeled QA listings/accounts were removed after
verification. Existing data, including Disposable upload QA 2801 and its photo,
was left unchanged. No fake production seed data was retained.

## Known limits and next milestone

- These are unweighted asking prices, not sold prices or estimates of fair value.
- No standardized quantity, unit, grade or product taxonomy exists. Category-only
  aggregates can mix unlike offers; the page explicitly warns about comparability.
- All listing prices retain the existing USD convention; no currency inference
  or conversion was introduced.
- Locations are free text. Small samples remain hidden rather than embellished.
- No historical observations, trends, alerts, notifications, external commodity
  feeds, seller analytics or AI recommendations were implemented.
- Aggregates run on request; no historical snapshots, materialized views or
  scheduled collection exists. Revisit query plans with real production volume.

Recommended next milestone: listing data quality (explicit units/quantities and
listing lifecycle/status), with a careful migration strategy for existing listings,
before adding historical price intelligence. Do not begin it without review.
