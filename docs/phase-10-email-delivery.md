# Phase 10: Verified email and price-alert delivery

Sauti uses Resend through the server-only mail service in `src/lib/email.ts`.

Configure these production environment variables:

- `RESEND_API_KEY`: Resend API key.
- `EMAIL_FROM`: A sender address verified in Resend.
- `APP_URL`: Public HTTPS origin for Sauti, used to generate verification, Market Insights, and preference links.

Email verification links are single-use, expire after 24 hours, and must be confirmed while signed in to the same Sauti account. Resends are limited to one per minute per account.

Price-alert delivery is created only for verified users who opted in. The in-app notification remains authoritative. Each notification has one delivery record, Resend receives a stable idempotency key, and transient failures retry up to three times during later price-watch evaluations. Configure the existing evaluator scheduler at least every 30 minutes so eligible retries are processed.
