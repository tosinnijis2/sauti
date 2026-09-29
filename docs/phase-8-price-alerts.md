# Phase 8: Price alerts and notification preferences

## Watches and evaluation

A price watch belongs to one user and stores a structured Sauti cohort: commodity,
optional variety and grade, comparison unit, and optional country/location filters.
Supported conditions are median below or above an absolute USD value, and qualifying
median percentage drop or rise. A deterministic cohort key and database unique
constraint prevent equivalent duplicate watches for the same user, condition, and
threshold.

`node scripts/evaluate-price-watches.mjs` evaluates enabled watches using the same
`historicalPriceHistory` query and five-observation bucket threshold as Market
Insights. Absolute watches use the latest qualifying median. Percentage watches use
the latest and previous qualifying daily/weekly medians. Missing or insufficient
history does not trigger an alert.

Each watch persists `lastConditionMet`. A notification is created only when the
condition moves from false/unseen to true. Repeated true evaluations stay quiet; a
false evaluation resets the watch so a later crossing can notify again. An atomic
conditional update makes concurrent evaluator runs deterministic.

## Notifications and preferences

Notifications are private user-owned records with a concise explanation and a link
back to the watched Market Insights cohort. Users can mark one or all as read from
`/notifications`; unread counts appear in authenticated navigation. Watches can be
enabled, disabled, or deleted at `/price-watches` without deleting old notifications.

The current preference supports in-app price alerts only. When disabled, evaluation
still updates crossing state but suppresses delivery, avoiding a stale alert when the
preference is later enabled. The separate preference table can accept email or push
channel fields in a later milestone. No email, SMS, or push delivery exists yet.

All creation and mutation functions derive the user from the signed session and
scope records by owner. The evaluator logs only watch ID, operation, timestamp, and
generic failure context.
