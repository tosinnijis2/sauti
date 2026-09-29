# Phase 9: Scheduled alert evaluation and observability

## Scheduler endpoint

`POST /api/internal/evaluate-price-watches` invokes the same evaluator used by
`node scripts/evaluate-price-watches.mjs`. It requires
`Authorization: Bearer <CRON_SECRET>`, compares the credential in constant time,
and never returns or logs the secret. Keep `CRON_SECRET` server-only and at least
32 characters.

No scheduler is configured by this repository. After deployment, configure one
HTTPS POST every 30 minutes (15–60 minutes is reasonable) using Vercel Cron with an
authorization header, GitHub Actions, Render/Railway cron, or another scheduler.
The provider must store `CRON_SECRET` as a protected secret and call the deployed
HTTPS origin. Do not put the secret in a query string.

## Concurrency and run history

Each invocation atomically acquires the singleton PostgreSQL evaluator lease. The
lease expires after 25 minutes so a crashed process cannot block evaluation forever.
An overlapping invocation records a `SKIPPED` run and exits successfully. Per-watch
atomic crossing updates remain the final notification deduplication boundary.

Every manual or scheduled invocation records source, status, timestamps, duration,
scanned/evaluated/skipped counts, notifications created, and errors. No secrets or
notification content are stored. `SUCCEEDED` means no watch errors, `PARTIAL` means
the run completed with watch errors, `FAILED` means the evaluator itself failed,
and `SKIPPED` means another run held the lease.

`/admin/evaluations` is admin-only. It warns deterministically when the latest run
failed, at least two of the latest three runs failed, or no successful run completed
within the expected 60-minute interval.

## Notifications and email

Notifications use stable 25-row server-side pages ordered by creation time and ID,
newest first. Read state and ownership checks are unchanged. Notification history is
retained; Phase 9 does not automatically delete old notifications.

The preference schema includes `emailPriceAlerts`, defaulting off. Delivery remains
disabled because Resend is not configured locally and Sauti has no verified-email
field or workflow. `notification-delivery.ts` defines the future delivery boundary;
the in-app notification remains the source record. No email, SMS, or push message is
sent in this phase.
