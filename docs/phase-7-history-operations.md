# Phase 7: Historical data operations

## Health and audit

`/admin/history` is protected by the same database-backed administrator check as
the rest of the admin area. It reports real snapshot totals, recent capture counts,
eligible ACTIVE listings, current coverage, latest capture time, and commodity and
country distributions. The status is deterministic: `Needs attention` means at
least one eligible listing lacks its current effective state, or the audit found an
impossible price, invalid unit, duplicate state, or invalid product reference.
Otherwise it is `Healthy`. Snapshot failure totals are not invented because this
application has no persistent log aggregation.

The reusable audit compares each eligible ACTIVE listing with its latest snapshot,
then reports state-hash mismatches, non-positive/NaN normalized prices, invalid
normalized units, consecutive equivalent states that were not reactivations, and
non-null product references that do not resolve. It reports only IDs and observation
metadata; it does not join users or expose seller identity.

## Repair

Run `node scripts/backfill-price-snapshots.mjs --dry-run` to preview the current
database. Remove `--dry-run` to append only missing current-state observations for
eligible ACTIVE listings. The command locks and rereads each product before writing,
uses the execution timestamp, is safe to repeat, and never changes old snapshots or
invents historical dates. Its summary separates scanned, eligible, already-current,
missing, stale, created, skipped, and failed records.

## Ranges and queries

Market Insights offers 30, 90, 180, and 365-day windows plus all recorded history.
The chosen boundary is applied to `capturedAt` in PostgreSQL before daily or weekly
aggregation, and trend calculation uses only the returned in-range buckets. Sparse
bounded windows do not borrow older data. The existing cohort index on commodity,
variety, grade, normalized unit, and captured time supports the primary history
query; the country/location and product-key indexes support filtering and audit
lookups. No speculative index was added.

## Retention and privacy

A `PriceSnapshot` is an immutable asking-price observation. It contains structured
commodity, optional variety and seller-provided grade, normalized unit and price,
category, optional country/location, an effective-state hash, capture reason, and
capture time. It does not contain seller name, user ID, email, phone, authentication
data, messages, descriptions, or images.

Legitimate observations are retained indefinitely for aggregate market history for
now. Deleting a product sets `productId` to null while preserving its opaque
`productKey` and market observation. Snapshots may be deleted only for legal/privacy
requirements, confirmed corrupt data, isolated test cleanup, or an approved
operational correction. Routine listing or account deletion does not erase valid
aggregate history, and old immutable metadata is never rewritten by repair tooling.

Snapshot creation failures emit a generic structured server log containing product
ID, operation, timestamp, and fixed context. Secrets, tokens, environment values,
credentials, seller contact details, and message content are excluded.
