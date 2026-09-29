import "server-only";
import { prisma } from "./prisma";
import { EmailDeliveryError, emailIsConfigured, sendEmail } from "./email";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000];

export type PriceAlertEmailPayload = { deliveryId: string; recipient: string; cohort: string; trigger: string; currentMedian: string; unit?: string; country?: string | null; location?: string | null; href: string };
export type PriceAlertEmailResult = { status: "sent" | "disabled" | "failed"; reason?: string };

function absoluteUrl(href: string) {
  const origin = process.env.APP_URL;
  if (!origin) return null;
  try { return new URL(href, origin).toString(); } catch { return null; }
}

function emailText(payload: PriceAlertEmailPayload) {
  const unit = payload.unit ?? "unit";
  const location = [payload.location, payload.country].filter(Boolean).join(", ");
  const insightsUrl = absoluteUrl(payload.href);
  const preferencesUrl = absoluteUrl("/price-watches");
  if (!insightsUrl || !preferencesUrl) return null;
  return `Your Sauti price watch has triggered.\n\nCohort: ${payload.cohort}\nCondition: ${payload.trigger}\nCurrent Sauti median asking price: $${payload.currentMedian}/${unit}${location ? `\nLocation: ${location}` : ""}\n\nThis alert is based on comparable Sauti asking prices, not completed sales.\n\nView Market Insights: ${insightsUrl}\nManage price-alert preferences: ${preferencesUrl}`;
}

export async function deliverPriceAlertEmail(payload: PriceAlertEmailPayload): Promise<PriceAlertEmailResult> {
  const text = emailText(payload);
  if (!emailIsConfigured() || !text) return { status: "disabled", reason: !emailIsConfigured() ? "provider-unconfigured" : "app-url-unconfigured" };
  try {
    await sendEmail({ to: payload.recipient, subject: `${payload.cohort} price alert from Sauti`, text, idempotencyKey: `price-alert-${payload.deliveryId}` });
    return { status: "sent" };
  } catch (error) {
    return { status: "failed", reason: error instanceof EmailDeliveryError ? error.code : "unknown" };
  }
}

export async function deliverPendingPriceAlertEmails(now = new Date(), limit = 50) {
  if (!emailIsConfigured() || !process.env.APP_URL) return { sent: 0, failed: 0, skipped: 0 };
  const deliveries = await prisma.notificationEmailDelivery.findMany({
    where: { status: "PENDING", failureCount: { lt: MAX_ATTEMPTS }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] }, orderBy: { createdAt: "asc" }, take: limit,
    include: {
      notification: {
        include: {
          user: { select: { email: true, emailVerifiedAt: true, notificationPreference: { select: { emailPriceAlerts: true } } } },
        },
      },
    },
  });
  let sent = 0; let failed = 0; let skipped = 0;
  for (const delivery of deliveries) {
    const user = delivery.notification.user;
    if (!user.emailVerifiedAt || !user.notificationPreference?.emailPriceAlerts) { skipped++; continue; }
    const result = await deliverPriceAlertEmail({ deliveryId: delivery.notificationId, recipient: user.email, cohort: delivery.cohort, trigger: delivery.trigger, currentMedian: delivery.currentMedian.toString(), unit: delivery.unit, country: delivery.country, location: delivery.location, href: delivery.href });
    if (result.status === "sent") {
      await prisma.notificationEmailDelivery.updateMany({ where: { notificationId: delivery.notificationId, status: "PENDING" }, data: { status: "SENT", attemptedAt: now, sentAt: now, nextAttemptAt: null, lastErrorCode: null } });
      sent++;
      continue;
    }
    if (result.status === "disabled") { skipped++; continue; }
    const failureCount = delivery.failureCount + 1;
    const transient = result.reason === "network" || result.reason === "resend-429" || Boolean(result.reason?.startsWith("resend-5"));
    await prisma.notificationEmailDelivery.update({ where: { notificationId: delivery.notificationId }, data: { attemptedAt: now, failureCount, lastErrorCode: result.reason?.slice(0, 100) ?? "unknown", status: transient && failureCount < MAX_ATTEMPTS ? "PENDING" : "FAILED", nextAttemptAt: transient && failureCount < MAX_ATTEMPTS ? new Date(now.getTime() + RETRY_DELAYS_MS[Math.min(failureCount - 1, RETRY_DELAYS_MS.length - 1)]) : null } });
    failed++;
  }
  return { sent, failed, skipped };
}
