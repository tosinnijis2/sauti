# Sauti admin implementation plan

## Inspection

Next.js 16.3.6 App Router, React, TypeScript, Tailwind, Prisma 7.10 and PostgreSQL.
Existing authentication uses bcrypt and signed HttpOnly jose sessions. User roles
are USER and ADMIN; sessions are invalidated by sessionVersion. Current admin
functionality is message-report moderation only. Private-content access in that
legacy screen is not yet audited and must be migrated before expanding moderation.

Reuse User, Product, Conversation, Message, MessageReport and UserBlock. Categories
are currently strings validated against a fixed list. No checkout, order, payment,
refund, dispute, review, audit, notification or marketplace settings models exist.

## Target routes

- /admin -> /admin/dashboard
- /admin/dashboard
- /admin/search
- /admin/users and /admin/users/[id] (buyer/seller filters)
- /admin/listings and /admin/listings/[id]
- /admin/categories
- /admin/orders and /admin/orders/[id]
- /admin/transactions
- /admin/disputes and /admin/disputes/[id]
- /admin/reports and /admin/reports/[id]
- /admin/reviews
- /admin/messages
- /admin/analytics
- /admin/notifications
- /admin/admins
- /admin/audit-logs
- /admin/settings

## Phases

Phase 2: protected independent shell, current database overview, bounded global
record search, real growth/category aggregates, loading/error/empty states.
Uses existing ADMIN only. No schema changes or automatic account promotion.
Commerce metrics stay unavailable, not fabricated. Navigation lists only working
destinations. Report search exposes metadata, not message content.

Phase 3: add scoped admin permissions and append-only AuditLog before write
operations; add account status/verification and listing status/feature fields;
enforce those states throughout login, public queries, chat and listing actions.
Add Category with a staged string-to-relation migration preserving existing data.
Build paginated user/listing management, detail pages, confirmation dialogs and
transactional moderation/audit writes. Protect the last privileged administrator.

Phase 4: introduce Order, Transaction and Dispute only alongside actual marketplace
workflows. Store immutable monetary snapshots and provider references, not card
data. Payment/refund operations require a provider, idempotency, verified webhooks
and explicit status transitions. Generalize MessageReport without duplicating it,
backfill current reports, and add assignment/priority/status fields.

Phase 5: order-backed reviews, recipient-specific notifications/read receipts,
audited settings, admin-role management, read-only audit search. Restrict private
message evidence to documented cases; log access before returning content and
remove the legacy unaudited moderation route. No arbitrary review text editing.

Phase 6: test permission matrix, direct action/URL access, pagination, invalid
inputs, last-admin safety, moderation enforcement, payment replay handling and
responsive keyboard navigation. Run lint, TypeScript and build after each phase.

## Metric definitions

Current listings means extant Product rows; status tracking is not yet present.
Sellers means accounts with at least one current listing, not recently online users.
Growth groups extant rows by UTC creation date. Deleted records cannot be recovered
as historical activity. Growth periods include today (partial UTC day); comparisons
use the preceding equal-length calendar period. Recent activity is an all-time
bounded feed, not an audit log. Sales cannot be inferred from listing asking prices.
