# Phase 5: Structured commodity and package metadata

## Schema and compatibility

Migration `20260928040000_commodity_package_metadata` adds nullable Product fields:
commodity (Commodity enum), variety (CommodityVariety enum), grade (SellerGrade
enum), packageQuantity (Decimal(12,3)), and packageUnit (existing ListingUnit enum).
Existing records retain null metadata. No title, category, status, image or account
is rewritten. Database checks enforce commodity/variety compatibility, commodity
presence for variety/grade, paired package contents, positive contents quantities,
package outer units and measurable inner units. The migration is applied locally.

The controlled catalogue includes maize, rice, beans, wheat, cassava, potatoes,
tomatoes, onions, bananas and coffee. Initial varieties are white/yellow maize and
basmati/long-grain rice. Grades are Grade 1, Grade 2 and Standard; unspecified is
NULL. Grades and varieties are seller-provided descriptions, not certification.
Expansion requires an enum/check migration plus catalogue labels and tests.

## Listing UX and search

Create/edit forms include optional commodity controls, compatible variety choices,
and grade. Bag/sack/box/crate/bundle reveal optional contents per package. Switching
commodity or package type resets dependent controls. Both contents fields must be
provided together; recursive packages and invalid quantities are rejected in the
browser, server validation and database. Contents allow g/kg/tonne/ml/litre/item.
Existing ownership, status, image receipt and upload rules are preserved.

Cards, owned listings and details show total price, quantity, explicit per-package
contents and normalized price. Metadata is compact on cards and fuller on details.
Legacy listings remain discoverable and editable; no metadata is guessed.
Search retains title/description matches and adds controlled metadata labels.

Browser QA also found different ICU country names between Node and Chromium,
causing hydration failure in listing forms. A checked-in country catalogue now
provides identical labels/order on server and client; no country codes changed.

## Price normalization

Normalized price = total price / (listing quantity * contents per package * factor).
Contents multiply only when explicitly supplied. Factors convert g to kg (0.001),
tonne to kg (1000), and ml to litre (0.001). Item and other bases stay distinct.
Without contents, a sack remains a sack; no weight is assumed.

- 25 kg for $40: $1.60/kg.
- One sack containing 50 kg for $40: $0.80/kg.
- Two crates containing 20 kg each for $60: $1.50/kg.

The shared helper uses a cloned 60-digit Decimal implementation already supplied
by Prisma. SQL uses numeric division and middle-row averaging for median, avoiding
percentile_cont's floating-point coercion. Summary prices cross the application
boundary as decimal strings. Display rounds to six decimal places, with a less-than
threshold for positive values below 0.000001. Total prices retain two decimals.

## Insights

Exact groups are commodity + normalized unit + variety + grade. Empty grade and
variety filters select unspecified only, never a mixture of known attributes.
No commodity selection produces group discovery, not a misleading global average.
Available commodity/variety/grade options come from matching active data, retaining
the current selection for honest empty states. Existing country, location, category
and search filters remain. Unit options retain the standardized supported set.

Five ACTIVE valid listings are required per summary and per country/location row.
Contributors, median, average, low, high and counts use the same cohort. Queries use
a repeatable-read transaction. Dashboard snapshots link to those exact groups and
prioritize saved commodity/variety/grade combinations. Missing commodity or quantity
excludes a legacy listing from structured insights but not marketplace discovery.

## Verification

Automated checks: TypeScript, ESLint, production build, Prisma migration deployment
and generation; test-commodity-metadata, test-units-status, test-insights, test-http,
test-favorites, test-dashboard, test-messaging, mock/live test-uploads, and live
test-upload-http. Suites use isolated generated records and clean up only those
fixtures. Administrative test audit records remain per existing suite behavior.

Focused coverage includes persistence/edit/clear, invalid enum combinations,
package validation and DB constraints, single/multiple packages, metric conversion,
Decimal boundaries, no inferred weights, grade/variety/unspecified separation,
ACTIVE filtering, legacy rendering/search, structured search and contributor parity.

Browser QA at 1280x900 and 390x844 checked create/edit prefill, dynamic selectors,
saved package contents, $0.80/kg sack and $1.50/kg multiple-crate results, product
details, insights layouts, grade switching ($0.80 vs $1.50), variety switching
($1.00), incompatible sack-unit empty state, and no horizontal overflow. Temporary
browser records were removed. The retained listing remains SOLD, metadata null,
and its Cloudinary photo is preserved.

## Limits and next milestone

The starter variety catalogue is intentionally small. Seller-provided grades are
not independently verified and do not establish an agricultural standard. Opaque
packages have no measurable conversion. Small cohorts show insufficient-data
states; no external prices or metadata inference fill the gaps. Pricing is USD
asking-price data only. Production-scale query performance is not benchmarked.

Recommended next milestone: design historical asking-price snapshots with explicit
sample counts, cohort identity, retention and timestamps, subject to approval.
No history, alerts, external APIs, currency conversion, AI classification, official
grading or seller analytics were implemented in Phase 5.
