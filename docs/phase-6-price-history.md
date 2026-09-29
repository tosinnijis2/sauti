# Phase 6: Historical asking-price snapshots

## Schema and migration

Migration `20260929010000_price_snapshots` adds the `PriceSnapshot` table without
changing or resetting Product data. Each row stores its product key, optional live
Product relation, commodity, variety, seller-provided grade, normalized unit,
Decimal(30,12) normalized price, category, country, location, SHA-256 state hash,
and actual capture timestamp.

Indexes cover capture time, commodity, normalized unit, country/location,
product/time, and commodity/variety/grade/unit/time. A positive-price database
check protects historical calculations. The Product relation uses `ON DELETE SET
NULL`: listing and account deletion remove the live relation but retain anonymous
asking-price observations. No seller identity, title, description, image, contact
data, or owner ID is copied into history.

## Capture rules and deduplication

All normal create, edit, and status flows call one server-side helper inside the
same database transaction as the Product mutation. Product rows are locked before
edits/status changes, serializing concurrent attempts.

A snapshot is eligible only when the resulting listing is ACTIVE, has structured
commodity metadata, and can be normalized under the existing Phase 5 rules. New
eligible listings capture once. Changes to normalized price, normalized unit,
commodity, variety, grade, category, country, or trimmed location capture a new
row. Price, quantity, unit, and package-content edits therefore capture only when
their effective normalized comparison state changes. Description, image, and
equivalent-value edits do not capture.

Leaving ACTIVE never deletes history and creates no observation. Moving from SOLD,
RESERVED, or INACTIVE to ACTIVE deliberately captures a fresh observation even if
its values match the last historical row. Other duplicate consecutive states are
suppressed by comparing a deterministic SHA-256 hash with the product's latest
snapshot. The hash is a deduplication key, not an authentication or privacy feature.

## Aggregation and trends

History uses the selected exact commodity + variety + grade + normalized unit,
plus category/country/location filters. Unspecified variety and grade remain exact
NULL cohorts. Free-text history is withheld because snapshots intentionally do not
retain mutable titles or descriptions; the UI asks the user to clear that filter.

PostgreSQL numeric arithmetic ranks observations within UTC buckets and averages
the middle row(s) for an exact Decimal median. A bucket must contain at least five
real observations. Daily buckets are used when at least two days qualify; otherwise
the system falls back to qualifying ISO-style Monday-based weekly buckets. Missing
periods are omitted, never interpolated. A trend appears only with two qualifying
periods and is `(latest median - previous median) / previous median * 100`, rounded
to one decimal. One qualifying period can draw one honest point but cannot produce
a percentage.

Market Insights labels the chart "Based on Sauti asking prices," identifies the
cohort/unit, shows latest and previous recorded medians and observation count, and
uses a responsive dependency-free SVG. Dashboard Market Snapshot adds only the
percentage when the same evidence threshold is met.

## Backfill

`node scripts/backfill-price-snapshots.mjs` explicitly scans current eligible ACTIVE
listings and records one baseline at execution time. It locks and rereads each
Product before capture. Re-running compares the current effective state with the
latest snapshot and creates nothing when unchanged. It does not fabricate dates,
infer metadata, or create observations for non-comparable or non-ACTIVE listings.

## Verification

Focused automated coverage verifies eligible creation; price and normalized
quantity changes; description and duplicate suppression; immutable old/new
commodity, variety and grade; ACTIVE to SOLD retention; SOLD to ACTIVE capture;
listing deletion retention; daily and weekly medians; trend percentage and minimum
evidence; free-text honesty; execution-time baseline; and idempotent backfill.

The complete Phase 5 regression set remains required: commodity metadata,
units/status, current insights, authentication/authorization HTTP, favorites,
dashboard, messaging/recovery, mocked uploads, live Cloudinary lifecycle, and live
upload HTTP. TypeScript, ESLint, production build, migration validation/deployment,
and browser logs are also checked.

Responsive QA at 1280x900 and 390x844 verified the exact cohort, two-point daily
chart, observation count, +33.3% trend, compact dashboard indicator, accessible
text alternative, no horizontal overflow, and clean fresh production browser logs.
All disposable QA products, snapshots and account records were removed afterward.

## Known limits and recommended next milestone

Snapshots are event-based observations, not continuous exchange data or completed
sales. Sparse cohorts often show "Not enough history yet." The chart has no
interpolation, forecasting, zoom, arbitrary date range, or export. Historical
free-text search is intentionally unsupported. All values remain USD asking prices;
grades and varieties remain seller-provided and unverified.

Recommended next milestone: retention and operations for historical data, including
an operator-visible capture health check, bounded date-range controls, and a written
data-retention/privacy policy. Price alerts, notifications, external feeds,
forecasting, AI prediction, currency conversion, and seller analytics remain out of
scope.
